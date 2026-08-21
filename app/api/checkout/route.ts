import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, supabaseConfigured } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { stripeCompanyContent } from "@/lib/stripe-branding";
import { paypalConfigured, createPayPalOrder } from "@/lib/paypal";
import { computeCartTotals } from "@/lib/totals";
import { validateCheckout, normalizeShipping } from "@/lib/validation";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { matchColor, productColors } from "@/lib/colors";
import { publicSiteUrl } from "@/lib/env";
import type { Order } from "@/lib/types";

type IncomingItem = { productId: string; qty: number; color?: string | null };

// Shown when no payment provider is reachable — buyers get a friendly pause
// message instead of an order that can't be paid.
const CHECKOUT_PAUSED =
  "We're receiving a very high volume of orders right now — please try again in a few hours.";

/** Coerce a client-supplied quantity to a sane positive integer (1–999). */
function safeQty(v: unknown): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 999);
}

/**
 * Keep only well-formed string values from the client's shipping object.
 *
 * Runs BEFORE validation so the validator sees strings, never objects or
 * numbers a crafted request might have sent.
 */
function stringFields(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

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

  const email = (payload.email || "").trim().toLowerCase().slice(0, 254);
  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  if (rawItems.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }
  // Bound the work a single request can cause (DB lookups, order rows).
  if (rawItems.length > 50) {
    return NextResponse.json({ error: "Too many items in one order." }, { status: 400 });
  }

  // Validate the contact + address with the SAME rules the form uses
  // (lib/validation.ts). The browser check is a convenience for the buyer; this
  // is the one that decides whether an order is created, because anything can
  // POST here. `field` tells the form which input to highlight.
  const check = validateCheckout({ email, shipping: stringFields(payload.shipping) });
  if (!check.ok) {
    return NextResponse.json(
      { error: check.firstErrorMessage, field: check.firstErrorField },
      { status: 400 }
    );
  }

  // Normalize incoming items: keep only string product ids, coerce quantities
  // to sane integers, and collapse duplicates so a client can't smuggle in
  // NaN/negative/huge quantities.
  // Keyed by product AND colour: the same trike in two colours is two order
  // lines, so collapsing on product id alone would silently merge them and ship
  // the wrong thing.
  const byLine = new Map<string, { productId: string; color: string | null; qty: number }>();
  for (const it of rawItems) {
    const pid = typeof it?.productId === "string" ? it.productId : "";
    if (!pid) continue;
    const color =
      typeof it?.color === "string" && it.color.trim() ? it.color.trim().slice(0, 40) : null;
    const key = `${pid}::${color ?? ""}`;
    const existing = byLine.get(key);
    byLine.set(key, {
      productId: pid,
      color,
      qty: Math.min(999, (existing?.qty ?? 0) + safeQty(it?.qty)),
    });
  }
  const items: IncomingItem[] = [...byLine.values()];
  if (items.length === 0) {
    return NextResponse.json({ error: "No valid items in cart." }, { status: 400 });
  }

  // Trimmed, length-bounded, whitelisted keys only, with the country stored in
  // its canonical spelling.
  const shipping = normalizeShipping(stringFields(payload.shipping));

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

  // A colour the product doesn't come in must never reach an order — the
  // packing slip would name something that cannot be shipped. matchColor also
  // returns the PRODUCT's spelling, so the order reads consistently however the
  // request capitalised it.
  let colorError: string | null = null;

  const lineItems = items
    .map((i) => {
      const p = products.find((x) => x.id === i.productId);
      if (!p || p.status !== "active") return null;
      const qty = Math.max(1, Math.min(i.qty, p.stock > 0 ? p.stock : i.qty));

      const offered = productColors(p.colors);
      let color: string | null = null;
      if (offered.length > 0) {
        color = matchColor(offered, i.color);
        if (!color) {
          colorError =
            i.color
              ? `"${String(i.color).slice(0, 40)}" isn't a colour ${p.name} comes in. Please choose again.`
              : `Choose a colour for ${p.name} before checking out.`;
          return null;
        }
      }

      return {
        product_id: p.id as string,
        name: p.name as string,
        slug: p.slug as string,
        price_cents: p.price_cents as number,
        qty,
        color,
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
    color: string | null;
    image_url: string | null;
    shipping_cents: number | null;
    free_shipping: boolean;
  }[];

  if (colorError) {
    return NextResponse.json({ error: colorError }, { status: 400 });
  }

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
      shipping_address: shipping,
    })
    .select()
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: "Could not create order." }, { status: 500 });
  }

  const itemRows = lineItems.map((i) => ({
    order_id: order.id,
    product_id: i.product_id,
    name: i.name,
    slug: i.slug,
    price_cents: i.price_cents,
    qty: i.qty,
    image_url: i.image_url,
    color: i.color,
  }));
  {
    const { error } = await admin.from("order_items").insert(itemRows);
    // Migration 0012 not run yet → no `color` column. Store the line without
    // it: losing the colour on the record beats losing the whole order.
    if (error) {
      console.error("[checkout] order_items insert failed:", error.message);
      await admin.from("order_items").insert(
        itemRows.map(({ color: _color, ...rest }) => rest)
      );
    }
  }

  // Order confirmation goes out IMMEDIATELY, the moment the buyer places the
  // order — before they are handed to Stripe/PayPal, not after payment clears.
  // A buyer who closes the tab mid-payment still has a receipt with their order
  // number. The separate "payment cleared / preparing shipment" email is sent
  // by markOrderPaid() once the provider confirms (lib/orders.ts).
  //
  // Never let a mail failure kill a paid-for order: log and carry on.
  await sendOrderConfirmationEmail({
    ...(order as Order),
    items: lineItems.map((i) => ({
      id: i.product_id,
      order_id: order.id,
      product_id: i.product_id,
      name: i.name,
      slug: i.slug,
      price_cents: i.price_cents,
      qty: i.qty,
      image_url: i.image_url,
      color: i.color,
    })),
  }).catch((e) => console.error("[checkout] order confirmation email failed:", e));

  const siteUrl = publicSiteUrl() || new URL(request.url).origin;
  const method = (payload.method || "").toLowerCase();

  // PayPal path — create the order and hand off to PayPal to approve. Capture
  // happens on return at /api/paypal/capture.
  if (method === "paypal" && paypalConfigured()) {
    try {
      const { id: paypalOrderId, approveUrl } = await createPayPalOrder({
        amountCents: totals.total,
        orderNumber: order.order_number,
        orderId: order.id,
        returnUrl: `${siteUrl}/api/paypal/capture?order=${order.order_number}`,
        cancelUrl: `${siteUrl}/checkout`,
      });
      // Persist the PayPal order id so the inline card-fields flow can capture
      // by it (POST /api/paypal/capture). The redirect flow maps by order_number
      // instead, so this is harmless there.
      await admin.from("orders").update({ stripe_session_id: paypalOrderId }).eq("id", order.id);
      if (!approveUrl) throw new Error("no approve url");
      // `id` + `orderNumber` are used by the inline PayPal card fields;
      // `url` by the redirect flow.
      return NextResponse.json({ url: approveUrl, id: paypalOrderId, orderNumber: order.order_number });
    } catch (e) {
      // Log the real cause to the Worker logs, and echo a short, secret-free
      // reason in a `debug` field (not shown to buyers — visible in DevTools →
      // Network) so setup issues can be diagnosed without server log access.
      const reason = String((e as Error)?.message || e).slice(0, 300);
      console.error("[checkout] PayPal order create failed:", reason);
      return NextResponse.json(
        {
          error: "PayPal is unavailable right now. Please try card instead.",
          debug: reason,
        },
        { status: 502 }
      );
    }
  }

  // Stripe path — real payment (default when configured).
  if (stripe) {
    try {
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
      // Our own copy on Stripe's hosted page — who is charging, the delivery
      // window, and the import duty they owe separately. Derived from the same
      // constants as our checkout and emails so the three cannot disagree.
      // See lib/stripe-branding.ts. Logo and colours are Dashboard settings.
      ...stripeCompanyContent(order.order_number, shipping.country),
    });
    await admin.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);
    return NextResponse.json({ url: session.url });
    } catch (e) {
      const reason = String((e as Error)?.message || e).slice(0, 300);
      console.error("[checkout] Stripe session create failed:", reason);
      return NextResponse.json(
        { error: "Card checkout is unavailable right now. Please try again.", debug: reason },
        { status: 502 }
      );
    }
  }

  // Shouldn't be reachable (both providers were checked up front); if a
  // request lands here anyway, pause rather than take an unpayable order.
  return NextResponse.json({ error: CHECKOUT_PAUSED }, { status: 503 });
}
