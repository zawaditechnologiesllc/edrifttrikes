import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { supabaseConfigured, adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SITE_SETTINGS } from "@/lib/company";
import { maskEmail, orderOwnershipFilter, verifiedUserEmail } from "@/lib/account";
import type { Article, Category, Order, Product, Profile, SiteSettings } from "@/lib/types";

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
export const SETTINGS_TAG = "settings";

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

const getFlaggedFeatured = unstable_cache(
  async (limit: number): Promise<Product[]> => {
    if (!supabaseConfigured()) return [];
    const supabase = createPublicClient();
    // If the `featured` column doesn't exist yet (migration 0003 not run),
    // this errors and `data` is null — callers fall back to newest products.
    const { data } = await supabase
      .from("products")
      .select("*, category:categories(*)")
      .eq("status", "active")
      .eq("featured", true)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data as Product[]) ?? [];
  },
  ["featured-products"],
  { revalidate: CATALOG_TTL, tags: [CATALOG_TAG] }
);

/** Admin-flagged featured products; falls back to newest when none are flagged. */
export async function getFeaturedProducts(limit = 4): Promise<Product[]> {
  const flagged = await getFlaggedFeatured(limit);
  if (flagged.length > 0) return flagged;
  return getProducts({ sort: "newest", limit });
}

export const getSiteSettings = unstable_cache(
  async (): Promise<SiteSettings> => {
    if (!supabaseConfigured()) return DEFAULT_SITE_SETTINGS;
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("site_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    return (data as SiteSettings) ?? DEFAULT_SITE_SETTINGS;
  },
  ["site-settings"],
  { revalidate: CATALOG_TTL, tags: [SETTINGS_TAG] }
);

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

/**
 * Every order belonging to the signed-in rider — including the ones they placed
 * as a guest, before they had an account.
 *
 * Guest checkouts store user_id = NULL, so matching on user_id alone hid a
 * buyer's own purchase history from them permanently. Two mechanisms cover it:
 *
 *  1. `claimGuestOrders` links those rows to the account, making the ownership
 *     permanent (and correct at the RLS level) rather than re-derived forever.
 *  2. The query still matches unclaimed rows by confirmed email, so the
 *     dashboard is right even on the request where claiming failed or the
 *     migration hasn't run.
 *
 * Both are gated on a CONFIRMED email — see verifiedUserEmail above.
 */
export async function getMyOrders(): Promise<Order[]> {
  if (!supabaseConfigured()) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const email = verifiedUserEmail(user);

  // Link any guest orders to this account first, so what follows is simply
  // "their orders". Best-effort: the query below still finds them if it fails.
  if (email && adminConfigured()) {
    try {
      // Imported lazily: lib/orders pulls in the email templates, and lib/db is
      // imported by nearly every page — a static import would put the mail
      // stack in all of their bundles for the sake of one dashboard call.
      const { claimGuestOrders } = await import("@/lib/orders");
      await claimGuestOrders(createAdminClient(), user.id, email);
    } catch (e) {
      console.error("[db] claiming guest orders failed:", String((e as Error)?.message || e));
    }
  }

  // Covers both routes in one round trip: rows already owned, plus unclaimed
  // rows placed with this confirmed address. See lib/account.ts.
  const ownership = orderOwnershipFilter(user.id, email);

  const { data, error } = await supabase
    .from("orders")
    .select("*, items:order_items(*), events:order_events(*)")
    .or(ownership)
    .order("created_at", { ascending: false });

  // order_events arrives with migration 0006. On a database that hasn't run it
  // yet the embed fails the whole query, so fall back to orders without the
  // tracking timeline rather than showing the rider an empty dashboard.
  if (error) {
    const { data: fallback } = await supabase
      .from("orders")
      .select("*, items:order_items(*)")
      .or(ownership)
      .order("created_at", { ascending: false });
    return (fallback as Order[]) ?? [];
  }
  return sortOrderEvents((data as Order[]) ?? []);
}

/** Timeline rows come back unordered from the embed; the tracker wants oldest first. */
function sortOrderEvents(orders: Order[]): Order[] {
  for (const o of orders) {
    if (o.events) {
      o.events.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }
  }
  return orders;
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

export type Receipt = {
  order: Order;
  /**
   * True when the viewer has not proved the order is theirs, so personal
   * details have been stripped. The page shows less, rather than nothing.
   */
  redacted: boolean;
};

/**
 * Load an order for the confirmation / receipt page.
 *
 * THE PROBLEM THIS SOLVES: the page previously used only the cookie-aware
 * client, so RLS applied — and a guest who had just paid was, by definition,
 * not signed in. `auth.uid()` was null, the policy matched nothing, and the
 * buyer landed on a blank receipt seconds after being charged.
 *
 * So: try RLS first, which returns the complete order to its rightful owner.
 * Only if that finds nothing do we fall back to a privileged read keyed on the
 * order number, and that copy is REDACTED — the email is masked and the
 * shipping address removed — because an order number alone is a weak claim to
 * someone's personal data.
 *
 * The order number is 8 random hex characters (~4.3 billion), so enumeration
 * is impractical, but the redaction means that even a lucky guess yields no
 * name, address or contact details.
 */
export async function getReceiptByNumber(
  orderNumber: string
): Promise<Receipt | null> {
  const owned = await getOrderByNumber(orderNumber);
  if (owned) return { order: owned, redacted: false };

  if (!adminConfigured()) return null;

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("orders")
      .select("*, items:order_items(*), events:order_events(*)")
      .eq("order_number", orderNumber)
      .maybeSingle();
    if (!data) return null;

    const order = sortOrderEvents([data as Order])[0];
    return {
      order: {
        ...order,
        email: maskEmail(order.email),
        // Never hand back a delivery address on the strength of an order number.
        shipping_address: null,
      },
      redacted: true,
    };
  } catch (e) {
    console.error("[db] receipt lookup failed:", String((e as Error)?.message || e));
    return null;
  }
}

export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  if (!supabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, items:order_items(*), events:order_events(*)")
    .eq("order_number", orderNumber)
    .maybeSingle();

  // Same graceful degradation as getMyOrders when migration 0006 is pending.
  if (error) {
    const { data: fallback } = await supabase
      .from("orders")
      .select("*, items:order_items(*)")
      .eq("order_number", orderNumber)
      .maybeSingle();
    return (fallback as Order) ?? null;
  }
  if (!data) return null;
  return sortOrderEvents([data as Order])[0];
}
