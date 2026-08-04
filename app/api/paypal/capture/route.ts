import { NextResponse } from "next/server";
import { createAdminClient, supabaseConfigured } from "@/lib/supabase/admin";
import { capturePayPalOrder } from "@/lib/paypal";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { publicSiteUrl } from "@/lib/env";
import type { Order } from "@/lib/types";

/**
 * PayPal return handler. PayPal redirects the buyer here after they approve,
 * appending `token` (the PayPal order id). We capture the payment, mark our
 * order paid, email the confirmation, and send the buyer to the receipt.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const orderNumber = searchParams.get("order") || "";
  const paypalOrderId = searchParams.get("token") || "";
  const siteUrl = publicSiteUrl() || origin;

  if (!orderNumber || !paypalOrderId || !supabaseConfigured()) {
    return NextResponse.redirect(`${siteUrl}/checkout?error=paypal`);
  }

  const capture = await capturePayPalOrder(paypalOrderId).catch(() => ({ ok: false }));
  if (!capture.ok) {
    return NextResponse.redirect(`${siteUrl}/checkout?error=paypal`);
  }

  const admin = createAdminClient();

  // Only flip to paid (and email) once, so a repeated return can't double-send.
  const { data: existing } = await admin
    .from("orders")
    .select("status")
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (existing && existing.status !== "paid") {
    const { data: order } = await admin
      .from("orders")
      .update({ status: "paid", stripe_session_id: paypalOrderId })
      .eq("order_number", orderNumber)
      .select("*, items:order_items(*)")
      .single();
    if (order)
      await sendOrderConfirmationEmail(order as Order).catch((e) =>
        console.error("[paypal capture] confirmation email failed:", e)
      );
  }

  return NextResponse.redirect(`${siteUrl}/order-confirmation?order=${orderNumber}`);
}

/**
 * Inline card-fields capture. The PayPal Card Fields SDK approves on-page and
 * calls this with the PayPal order id; we capture, mark our order paid, email,
 * and return JSON (the browser then routes to the receipt). Mapped by the
 * PayPal order id we stored on the order at creation (stripe_session_id).
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

  const capture = await capturePayPalOrder(paypalOrderId).catch(() => ({ ok: false }));
  if (!capture.ok) {
    return NextResponse.json({ error: "capture_failed" }, { status: 502 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("orders")
    .select("order_number, status")
    .eq("stripe_session_id", paypalOrderId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  // Mark paid + email once (idempotent), same guard as the redirect flow.
  if (existing.status !== "paid") {
    const { data: order } = await admin
      .from("orders")
      .update({ status: "paid" })
      .eq("stripe_session_id", paypalOrderId)
      .eq("status", "pending")
      .select("*, items:order_items(*)")
      .maybeSingle();
    if (order)
      await sendOrderConfirmationEmail(order as Order).catch((e) =>
        console.error("[paypal capture] confirmation email failed:", e)
      );
  }

  return NextResponse.json({ ok: true, orderNumber: existing.order_number });
}
