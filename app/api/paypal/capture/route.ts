import { NextResponse } from "next/server";
import { createAdminClient, supabaseConfigured } from "@/lib/supabase/admin";
import { capturePayPalOrder } from "@/lib/paypal";
import { sendOrderConfirmationEmail } from "@/lib/email";
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin;

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
    if (order) await sendOrderConfirmationEmail(order as Order).catch(() => {});
  }

  return NextResponse.redirect(`${siteUrl}/order-confirmation?order=${orderNumber}`);
}
