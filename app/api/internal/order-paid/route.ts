import { NextResponse } from "next/server";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { isInternalRequest } from "@/lib/internal-auth";
import { markOrderPaid, type PaidVia } from "@/lib/orders";

export const dynamic = "force-dynamic";

/**
 * Internal: "this order has been paid".
 *
 * Exists so the Stripe webhook — which must live on Render, because verifying
 * a Stripe signature needs the raw request body — runs the exact same paid
 * transition as the PayPal and admin paths instead of a second, drifting copy
 * of the logic in JavaScript. Render verifies the signature, then calls here.
 *
 * Auth: the INTERNAL_API_KEY shared secret. Idempotent — a replayed Stripe
 * event returns transitioned:false and sends no second email.
 *
 * POST { orderId?, orderNumber?, paypalOrderId?, paidVia? }
 */
export async function POST(request: Request) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!adminConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    orderId?: string;
    orderNumber?: string;
    paypalOrderId?: string;
    paidVia?: string;
  };

  // Whitelist the source rather than storing whatever the caller sent — this
  // value is displayed to the admin as the record of how money arrived.
  const paidVia: PaidVia | undefined =
    body.paidVia === "stripe" || body.paidVia === "paypal" || body.paidVia === "manual"
      ? body.paidVia
      : undefined;

  const by = {
    id: typeof body.orderId === "string" ? body.orderId : undefined,
    orderNumber: typeof body.orderNumber === "string" ? body.orderNumber : undefined,
    paypalOrderId:
      typeof body.paypalOrderId === "string" ? body.paypalOrderId : undefined,
  };
  if (!by.id && !by.orderNumber && !by.paypalOrderId) {
    return NextResponse.json(
      { error: "orderId, orderNumber or paypalOrderId required" },
      { status: 400 }
    );
  }

  const result = await markOrderPaid(createAdminClient(), by, { paidVia });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, reason: result.reason },
      { status: result.reason === "order_not_found" ? 404 : 409 }
    );
  }

  return NextResponse.json({
    ok: true,
    transitioned: result.transitioned,
    orderNumber: result.order?.order_number,
  });
}
