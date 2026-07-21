import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { supabaseConfigured } from "@/lib/supabase/admin";
import type { Article, Category, Order, Product, Profile } from "@/lib/types";

/**
 * Server-side data access. Every function degrades gracefully to empty/null
 * when Supabase isn't configured yet, so the storefront still renders.
 *
 * Public catalog/content reads use the cookie-free anon client so the pages
 * that call them can be statically rendered and ISR-cached (fast TTFB).
 * User-specific reads (profile, orders, wishlist) use the cookie-aware client.
 *
 * The public reads are additionally wrapped in `unstable_cache`, giving a
 * shared server-side data cache that survives even when a page is rendered
 * dynamically (e.g. the shop page with filters, or search). This means a
 * traffic spike is absorbed by the cache instead of turning into one Supabase
 * query per visitor. Admin mutations bust the cache via `revalidateTag` (see
 * CATALOG_TAG / CONTENT_TAG usage in app/admin/actions.ts).
 */

/** Cache tags — admin writes call revalidateTag() with these to refresh reads. */
export const CATALOG_TAG = "catalog";
export const CONTENT_TAG = "content";

// How long cached reads stay fresh before a background refresh. Content changes
// still propagate immediately on admin save via revalidateTag; these are just
// the ceiling for picking up out-of-band edits.
const CATALOG_TTL = 300; // seconds
const SEARCH_TTL = 60; // seconds — search keys are user-supplied, keep them short-lived

export const getCategories = unstable_cache(
  async (): Promise<Category[]> => {
    if (!supabaseConfigured()) return [];
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("position", { ascending: true });
    return data ?? [];
  },
  ["categories"],
  { revalidate: CATALOG_TTL, tags: [CATALOG_TAG] }
);

export const getProducts = unstable_cache(
  async (opts?: {
    categorySlug?: string;
    power?: string;
    sort?: "newest" | "price-asc" | "price-desc";
    limit?: number;
  }): Promise<Product[]> => {
    if (!supabaseConfigured()) return [];
    const supabase = createPublicClient();
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
  },
  ["products"],
  { revalidate: CATALOG_TTL, tags: [CATALOG_TAG] }
);

export async function getFeaturedProducts(limit = 4): Promise<Product[]> {
  return getProducts({ sort: "newest", limit });
}

export const getProductBySlug = unstable_cache(
  async (slug: string): Promise<Product | null> => {
    if (!supabaseConfigured()) return null;
    const supabase = createPublicClient();
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
  },
  ["product-by-slug"],
  { revalidate: CATALOG_TTL, tags: [CATALOG_TAG] }
);

export const searchProducts = unstable_cache(
  async (q: string): Promise<Product[]> => {
    if (!supabaseConfigured()) return [];
    // Sanitize before interpolating into the PostgREST `or` filter: strip the
    // characters that are meaningful to that filter syntax (comma, parens,
    // wildcards, backslash) so a crafted query can't break or rewrite it, and
    // cap the length to keep scans cheap.
    const term = q
      .replace(/[%,()\\*]/g, " ")
      .trim()
      .slice(0, 60);
    if (!term) return [];
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("products")
      .select("*, category:categories(*)")
      .eq("status", "active")
      .or(`name.ilike.%${term}%,tagline.ilike.%${term}%,description.ilike.%${term}%`)
      .limit(24);
    return (data as Product[]) ?? [];
  },
  ["search-products"],
  { revalidate: SEARCH_TTL, tags: [CATALOG_TAG] }
);

export const getArticles = unstable_cache(
  async (limit?: number): Promise<Article[]> => {
    if (!supabaseConfigured()) return [];
    const supabase = createPublicClient();
    let query = supabase
      .from("articles")
      .select("*")
      .eq("published", true)
      .order("published_at", { ascending: false });
    if (limit) query = query.limit(limit);
    const { data } = await query;
    return (data as Article[]) ?? [];
  },
  ["articles"],
  { revalidate: CATALOG_TTL, tags: [CONTENT_TAG] }
);

export const getArticleBySlug = unstable_cache(
  async (slug: string): Promise<Article | null> => {
    if (!supabaseConfigured()) return null;
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("articles")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    return (data as Article) ?? null;
  },
  ["article-by-slug"],
  { revalidate: CATALOG_TTL, tags: [CONTENT_TAG] }
);

export async function getCurrentProfile(): Promise<Profile | null> {
  if (!supabaseConfigured()) return null;
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*, items:order_items(*)")
    .eq("order_number", orderNumber)
    .maybeSingle();
  return (data as Order) ?? null;
}
