import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderConfirmationEmail } from "@/lib/email";
import type { Order } from "@/lib/types";

// Stripe calls this when a Checkout Session completes. Marks the order paid
// and emails the confirmation. Configure STRIPE_WEBHOOK_SECRET + endpoint in Stripe.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const sig = request.headers.get("stripe-signature");
  const body = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, secret);
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature failed: ${(err as Error).message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as { metadata?: { order_id?: string } };
    const orderId = session.metadata?.order_id;
    if (orderId) {
      const admin = createAdminClient();
      const { data: order } = await admin
        .from("orders")
        .update({ status: "paid" })
        .eq("id", orderId)
        .select("*, items:order_items(*)")
        .single();
      if (order) await sendOrderConfirmationEmail(order as Order).catch(() => {});
    }
  }

  return NextResponse.json({ received: true });
}
