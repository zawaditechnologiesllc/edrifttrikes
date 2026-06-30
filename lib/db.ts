import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/admin";
import type { Article, Category, Order, Product, Profile } from "@/lib/types";

/**
 * Server-side data access. All reads go through the cookie-aware client so RLS
 * applies. Every function degrades gracefully to empty/null when Supabase isn't
 * configured yet, so the storefront still renders during previews.
 */

export async function getCategories(): Promise<Category[]> {
  if (!supabaseConfigured()) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .order("position", { ascending: true });
  return data ?? [];
}

export async function getProducts(opts?: {
  categorySlug?: string;
  power?: string;
  sort?: "newest" | "price-asc" | "price-desc";
  limit?: number;
}): Promise<Product[]> {
  if (!supabaseConfigured()) return [];
  const supabase = createClient();
  let query = supabase
    .from("products")
    .select("*, category:categories(*)")
    .eq("status", "active");

  if (opts?.categorySlug) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", opts.categorySlug)
      .maybeSingle();
    if (cat) query = query.eq("category_id", cat.id);
  }
  if (opts?.power) query = query.eq("power", opts.power);

  if (opts?.sort === "price-asc") query = query.order("price_cents", { ascending: true });
  else if (opts?.sort === "price-desc") query = query.order("price_cents", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  if (opts?.limit) query = query.limit(opts.limit);

  const { data } = await query;
  return (data as Product[]) ?? [];
}

export async function getFeaturedProducts(limit = 4): Promise<Product[]> {
  return getProducts({ sort: "newest", limit });
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (!supabaseConfigured()) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from("products")
    .select("*, category:categories(*), images:product_images(*), specs:product_specs(*)")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const product = data as Product;
  product.images = (product.images ?? []).sort((a, b) => a.position - b.position);
  product.specs = (product.specs ?? []).sort((a, b) => a.position - b.position);
  return product;
}

export async function searchProducts(q: string): Promise<Product[]> {
  if (!supabaseConfigured() || !q.trim()) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("products")
    .select("*, category:categories(*)")
    .eq("status", "active")
    .or(`name.ilike.%${q}%,tagline.ilike.%${q}%,description.ilike.%${q}%`)
    .limit(24);
  return (data as Product[]) ?? [];
}

export async function getArticles(limit?: number): Promise<Article[]> {
  if (!supabaseConfigured()) return [];
  const supabase = createClient();
  let query = supabase
    .from("articles")
    .select("*")
    .eq("published", true)
    .order("published_at", { ascending: false });
  if (limit) query = query.limit(limit);
  const { data } = await query;
  return (data as Article[]) ?? [];
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  if (!supabaseConfigured()) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from("articles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as Article) ?? null;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  if (!supabaseConfigured()) return null;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return (data as Profile) ?? null;
}

export async function getMyOrders(): Promise<Order[]> {
  if (!supabaseConfigured()) return [];
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("orders")
    .select("*, items:order_items(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return (data as Order[]) ?? [];
}

export async function getWishlist(): Promise<Product[]> {
  if (!supabaseConfigured()) return [];
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("wishlist_items")
    .select("product:products(*, category:categories(*))")
    .eq("user_id", user.id);
  return ((data ?? []) as unknown as { product: Product | null }[])
    .map((r) => r.product)
    .filter((p): p is Product => Boolean(p));
}

export async function isInWishlist(productId: string): Promise<boolean> {
  if (!supabaseConfigured()) return false;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("wishlist_items")
    .select("product_id")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();
  return Boolean(data);
}

export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  if (!supabaseConfigured()) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from("orders")
    .select("*, items:order_items(*)")
    .eq("order_number", orderNumber)
    .maybeSingle();
  return (data as Order) ?? null;
}
