import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { supabaseConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Live public data for cart items: price, stock, and shipping fee. The cart
 * stores a snapshot from add-to-cart time in localStorage; CartProvider calls
 * this on load so a product's edited price/shipping fee shows correctly in
 * the cart and checkout instead of the stale snapshot. (The checkout API
 * recomputes everything server-side regardless — this is display accuracy.)
 */
export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);
  if (ids.length === 0 || !supabaseConfigured()) {
    return NextResponse.json({ products: [] });
  }
  const { data } = await createPublicClient()
    .from("products")
    .select("*")
    .in("id", ids);
  const products = (data ?? []).map((p) => ({
    id: p.id as string,
    price_cents: p.price_cents as number,
    stock: p.stock as number,
    status: p.status as string,
    shipping_cents: (p.shipping_cents ?? null) as number | null,
    free_shipping: Boolean(p.free_shipping),
  }));
  return NextResponse.json({ products });
}
