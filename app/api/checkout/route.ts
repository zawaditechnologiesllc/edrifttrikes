import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, supabaseConfigured } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { paypalConfigured, createPayPalOrder } from "@/lib/paypal";
import { computeCartTotals } from "@/lib/totals";
import { publicSiteUrl } from "@/lib/env";

type IncomingItem = { productId: string; qty: number };

// Shown when no payment provider is reachable — buyers get a friendly pause
// message instead of an order that can't be paid.
const CHECKOUT_PAUSED =
  "We're receiving a very high volume of orders right now — please try again in a few hours.";

export async function POST(request: Request) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: CHECKOUT_PAUSED }, { status: 503 });
  }
  const stripe = getStripe();
  if (!stripe && !paypalConfigured()) {
    return NextResponse.json({ error: CHECKOUT_PAUSED }, { status: 503 });
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
  // Bound the work a single request can cause (DB lookups, order rows).
  if (items.length > 50) {
    return NextResponse.json({ error: "Too many items in one order." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Recompute everything server-side from the DB (never trust client prices).
  // select("*") so per-product shipping columns come through when present,
  // without failing on a database that hasn't run migration 0005 yet.
  const ids = items.map((i) => i.productId);
  const { data: products } = await admin
    .from("products")
    .select("*")
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
        product_id: p.id as string,
        name: p.name as string,
        slug: p.slug as string,
        price_cents: p.price_cents as number,
        qty,
        image_url: p.hero_image as string | null,
        shipping_cents: (p.shipping_cents ?? null) as number | null,
        free_shipping: Boolean(p.free_shipping),
      };
    })
    .filter(Boolean) as {
    product_id: string;
    name: string;
    slug: string;
    price_cents: number;
    qty: number;
    image_url: string | null;
    shipping_cents: number | null;
    free_shipping: boolean;
  }[];

  if (lineItems.length === 0) {
    return NextResponse.json({ error: "No purchasable items in cart." }, { status: 400 });
  }

  // Read the admin-set shipping fee fresh (money math must never be stale).
  // If the settings table/columns don't exist yet, fall back to defaults.
  const { data: settingsRow } = await admin
    .from("site_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  const totals = computeCartTotals(lineItems, settingsRow ?? undefined);

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

  // Shouldn't be reachable (both providers were checked up front); if a
  // request lands here anyway, pause rather than take an unpayable order.
  return NextResponse.json({ error: CHECKOUT_PAUSED }, { status: 503 });
}
