import { NextResponse } from "next/server";
import { createAdminClient, supabaseConfigured } from "@/lib/supabase/admin";
import { capturePayPalOrder, type PayPalCapture } from "@/lib/paypal";
import { markOrderPaid, loadOrder } from "@/lib/orders";
import { publicSiteUrl } from "@/lib/env";
import type { Order } from "@/lib/types";

/**
 * PayPal capture endpoints — the redirect return (GET) and the inline
 * card-fields callback (POST).
 *
 * SECURITY: the buyer controls every value in the return URL, including which
 * order number it names. So the order we mark paid is NEVER taken from the URL
 * alone — we always re-derive it from the capture PayPal gives back and refuse
 * anything that doesn't line up. See verifyCapture() below.
 */

/**
 * Confirm the money PayPal actually took belongs to the order we're about to
 * mark paid.
 *
 * Two independent checks, both required:
 *  1. IDENTITY — the capture's custom_id (our order id) / invoice_id (our order
 *     number) must match the order. Without this a buyer can approve a $60
 *     order and replay the token against their $6,000 one.
 *  2. AMOUNT — the captured total must equal the order total. Without this a
 *     stale or tampered PayPal order could settle a large order for a small
 *     amount.
 */
function verifyCapture(
  capture: PayPalCapture,
  order: Order
): { ok: true } | { ok: false; reason: string } {
  const identifiers = [capture.customId, capture.invoiceId, capture.referenceId].filter(
    Boolean
  ) as string[];

  // PayPal echoes back at least one of custom_id / invoice_id / reference_id
  // for orders we created (createPayPalOrder sets all three). If none came
  // back, we cannot prove which order was paid — refuse.
  if (identifiers.length === 0) {
    return { ok: false, reason: "capture carried no order identifier" };
  }
  const matchesOrder = identifiers.some(
    (id) => id === order.id || id === order.order_number
  );
  if (!matchesOrder) {
    return {
      ok: false,
      reason: `capture belongs to a different order (${identifiers.join(", ")})`,
    };
  }

  if (typeof capture.amountCents !== "number") {
    return { ok: false, reason: "capture carried no amount" };
  }
  if (capture.amountCents !== order.total_cents) {
    return {
      ok: false,
      reason: `captured ${capture.amountCents} but order total is ${order.total_cents}`,
    };
  }

  return { ok: true };
}

/**
 * Redirect return handler. PayPal sends the buyer here after they approve,
 * appending `token` (the PayPal order id). We capture, verify the capture
 * really belongs to this order, mark it paid, and send them to the receipt.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const orderNumber = searchParams.get("order") || "";
  const paypalOrderId = searchParams.get("token") || "";
  const siteUrl = publicSiteUrl() || origin;

  if (!orderNumber || !paypalOrderId || !supabaseConfigured()) {
    return NextResponse.redirect(`${siteUrl}/checkout?error=paypal`);
  }

  const admin = createAdminClient();

  // Resolve the order BEFORE capturing so we have something to verify against.
  const order = await loadOrder(admin, { orderNumber });
  if (!order) {
    return NextResponse.redirect(`${siteUrl}/checkout?error=paypal`);
  }

  const capture = await capturePayPalOrder(paypalOrderId).catch(
    () => ({ ok: false }) as PayPalCapture
  );
  if (!capture.ok) {
    return NextResponse.redirect(`${siteUrl}/checkout?error=paypal`);
  }

  const verified = verifyCapture(capture, order);
  if (!verified.ok) {
    // Money moved but it does not belong to this order — never mark it paid.
    // Logged loudly because it is either a serious bug or an attempt to pay a
    // large order with a small capture.
    console.error(
      `[paypal capture] REJECTED for ${orderNumber}: ${verified.reason}`
    );
    return NextResponse.redirect(`${siteUrl}/checkout?error=paypal`);
  }

  await markOrderPaid(admin, { id: order.id }, { paidVia: "paypal" });

  return NextResponse.redirect(`${siteUrl}/order-confirmation?order=${orderNumber}`);
}

/**
 * Inline card-fields capture. The PayPal Card Fields SDK approves on-page and
 * calls this with the PayPal order id. The order is looked up by the PayPal
 * order id we stored at creation, so the mapping is server-side — and the
 * capture is still verified against it.
 */
export async function POST(request: Request) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  const { orderID } = await request.json().catch(() => ({ orderID: null }));
  const paypalOrderId = typeof orderID === "string" ? orderID : "";
  if (!paypalOrderId) {
    return NextResponse.json({ error: "orderID required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const order = await loadOrder(admin, { paypalOrderId });
  if (!order) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  const capture = await capturePayPalOrder(paypalOrderId).catch(
    () => ({ ok: false }) as PayPalCapture
  );
  if (!capture.ok) {
    return NextResponse.json({ error: "capture_failed" }, { status: 502 });
  }

  const verified = verifyCapture(capture, order);
  if (!verified.ok) {
    console.error(
      `[paypal capture] REJECTED for ${order.order_number}: ${verified.reason}`
    );
    return NextResponse.json({ error: "capture_mismatch" }, { status: 400 });
  }

  await markOrderPaid(admin, { id: order.id }, { paidVia: "paypal" });

  return NextResponse.json({ ok: true, orderNumber: order.order_number });
}
