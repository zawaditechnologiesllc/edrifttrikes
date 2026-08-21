import { NextResponse } from "next/server";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/cart/recover?order=<uuid>
 *
 * The line items of one unpaid order, so the link in an abandoned-order email
 * can put the exact things the buyer chose — including the colour — back in
 * their cart. Without this the email could only say "come back to the shop",
 * which is the part they had already done.
 *
 * THE ORDER ID IS THE CAPABILITY. It is a random UUID that appears nowhere
 * public; the order NUMBER, which is short and guessable, is deliberately not
 * accepted here. And the response is line items only — never the email, the
 * address, or the totals — so the worst a leaked link can reveal is which trike
 * somebody put in a cart.
 *
 * PENDING ORDERS ONLY. Once an order is paid the link stops working, which
 * means an old email cannot re-fill a cart for something already bought.
 */

/** Rough UUID shape. Anything else is not an id we issued. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const id = (new URL(request.url).searchParams.get("order") || "").trim();
  // Same empty answer for a malformed id, an unknown one and a paid one: this
  // endpoint should never help anyone tell those apart.
  const empty = NextResponse.json(
    { items: [] },
    { headers: { "cache-control": "private, no-store" } }
  );

  if (!UUID.test(id) || !adminConfigured()) return empty;

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, status, items:order_items(*)")
    .eq("id", id)
    .maybeSingle();

  if (!order || order.status !== "pending") return empty;

  const rows = (order.items ?? []) as Record<string, unknown>[];
  const items = rows
    .filter((i) => typeof i.product_id === "string" && i.product_id)
    .map((i) => ({
      productId: i.product_id as string,
      slug: (i.slug as string) ?? "",
      name: (i.name as string) ?? "",
      priceCents: Number(i.price_cents) || 0,
      qty: Math.max(1, Math.min(999, Number(i.qty) || 1)),
      imageUrl: (i.image_url as string | null) ?? null,
      color: (i.color as string | null) ?? null,
    }));

  return NextResponse.json(
    { items },
    { headers: { "cache-control": "private, no-store" } }
  );
}
