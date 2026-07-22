import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, supabaseConfigured } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { paypalConfigured, createPayPalOrder } from "@/lib/paypal";
import { computeTotals } from "@/lib/totals";
import { publicSiteUrl } from "@/lib/env";
import { sendOrderConfirmationEmail } from "@/lib/email";
import type { Order } from "@/lib/types";

type IncomingItem = { productId: string; qty: number };

export async function POST(request: Request) {
  if (!supabaseConfigured()) {
    return NextResponse.json(
      { error: "Store is not connected to Supabase yet." },
      { status: 503 }
    );
  }

  let payload: {
    email?: string;
    items?: IncomingItem[];
    shipping?: Record<string, string>;
    method?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = (payload.email || "").trim();
  const items = payload.items || [];
  if (!email || items.length === 0) {
    return NextResponse.json({ error: "Email and at least one item are required." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Recompute everything server-side from the DB (never trust client prices).
  const ids = items.map((i) => i.productId);
  const { data: products } = await admin
    .from("products")
    .select("id, slug, name, price_cents, hero_image, stock, status")
    .in("id", ids);

  if (!products || products.length === 0) {
    return NextResponse.json({ error: "No valid products in cart." }, { status: 400 });
  }

  const lineItems = items
    .map((i) => {
      const p = products.find((x) => x.id === i.productId);
      if (!p || p.status !== "active") return null;
      const qty = Math.max(1, Math.min(i.qty, p.stock > 0 ? p.stock : i.qty));
      return {
        product_id: p.id,
        name: p.name,
        slug: p.slug,
        price_cents: p.price_cents,
        qty,
        image_url: p.hero_image as string | null,
      };
    })
    .filter(Boolean) as {
    product_id: string;
    name: string;
    slug: string;
    price_cents: number;
    qty: number;
    image_url: string | null;
  }[];

  if (lineItems.length === 0) {
    return NextResponse.json({ error: "No purchasable items in cart." }, { status: 400 });
  }

  const subtotal = lineItems.reduce((n, i) => n + i.price_cents * i.qty, 0);
  const totals = computeTotals(subtotal);

  // Who is buying (if logged in)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Create the order
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      user_id: user?.id ?? null,
      email,
      status: "pending",
      subtotal_cents: totals.subtotal,
      shipping_cents: totals.shipping,
      tax_cents: totals.tax,
      total_cents: totals.total,
      shipping_address: payload.shipping ?? null,
    })
    .select()
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: "Could not create order." }, { status: 500 });
  }

  await admin.from("order_items").insert(
    lineItems.map((i) => ({
      order_id: order.id,
      product_id: i.product_id,
      name: i.name,
      slug: i.slug,
      price_cents: i.price_cents,
      qty: i.qty,
      image_url: i.image_url,
    }))
  );

  const siteUrl = publicSiteUrl() || new URL(request.url).origin;
  const method = (payload.method || "").toLowerCase();

  // PayPal path — create the order and hand off to PayPal to approve. Capture
  // happens on return at /api/paypal/capture.
  if (method === "paypal" && paypalConfigured()) {
    try {
      const { approveUrl } = await createPayPalOrder({
        amountCents: totals.total,
        orderNumber: order.order_number,
        orderId: order.id,
        returnUrl: `${siteUrl}/api/paypal/capture?order=${order.order_number}`,
        cancelUrl: `${siteUrl}/checkout`,
      });
      if (!approveUrl) throw new Error("no approve url");
      return NextResponse.json({ url: approveUrl });
    } catch {
      return NextResponse.json(
        { error: "PayPal is unavailable right now. Please try card instead." },
        { status: 502 }
      );
    }
  }

  // Stripe path — real payment (default when configured).
  const stripe = getStripe();
  if (stripe) {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [
        ...lineItems.map((i) => ({
          quantity: i.qty,
          price_data: {
            currency: "usd",
            unit_amount: i.price_cents,
            product_data: { name: i.name },
          },
        })),
        ...(totals.shipping > 0
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: "usd",
                  unit_amount: totals.shipping,
                  product_data: { name: "Shipping" },
                },
              },
            ]
          : []),
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: totals.tax,
            product_data: { name: "Tax" },
          },
        },
      ],
      success_url: `${siteUrl}/order-confirmation?order=${order.order_number}`,
      cancel_url: `${siteUrl}/checkout`,
      metadata: { order_id: order.id, order_number: order.order_number },
    });
    await admin.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);
    return NextResponse.json({ url: session.url });
  }

  // No Stripe — place order + send confirmation directly.
  const fullOrder = { ...order, items: lineItems.map((i) => ({ ...i })) } as unknown as Order;
  await sendOrderConfirmationEmail(fullOrder).catch(() => {});

  return NextResponse.json({ orderNumber: order.order_number });
}
