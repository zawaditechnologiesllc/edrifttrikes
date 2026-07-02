import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET /api/wishlist?productId=… → { saved } for the signed-in user.
export async function GET(request: Request) {
  const productId = new URL(request.url).searchParams.get("productId");
  if (!productId || !supabaseConfigured()) return NextResponse.json({ saved: false });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ saved: false });

  const { data } = await supabase
    .from("wishlist_items")
    .select("product_id")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();
  return NextResponse.json({ saved: Boolean(data) });
}

// POST /api/wishlist { productId } → toggles, returns { saved } (401 when signed out).
export async function POST(request: Request) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const { productId } = await request.json().catch(() => ({ productId: null }));
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data: existing } = await supabase
    .from("wishlist_items")
    .select("product_id")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing) {
    await supabase.from("wishlist_items").delete().eq("user_id", user.id).eq("product_id", productId);
    return NextResponse.json({ saved: false });
  }
  await supabase.from("wishlist_items").insert({ user_id: user.id, product_id: productId });
  return NextResponse.json({ saved: true });
}
