import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { supabaseConfigured, adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SITE_SETTINGS } from "@/lib/company";
import { maskEmail, orderOwnershipFilter, verifiedUserEmail } from "@/lib/account";
import {
  categoryVisible,
  hiddenCategoryIds,
  productVisible,
  visibleCategories,
  visibleProducts,
} from "@/lib/categories";
import type { Announcement } from "@/lib/announcements";
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
/** Announcements have their own tag so publishing one doesn't dump the catalog. */
export const ANNOUNCEMENTS_TAG = "announcements";

// How long cached reads stay fresh before a background refresh. Content changes
// still propagate immediately on admin save via revalidateTag; these are just
// the ceiling for picking up out-of-band edits.
const CATALOG_TTL = 300; // seconds
const SEARCH_TTL = 60; // seconds — search keys are user-supplied, keep them short-lived

/**
 * Say out loud when a catalogue read fails.
 *
 * ═══ WHY THIS EXISTS ═══════════════════════════════════════════════════════
 *
 * Every read here used to be written `const { data } = await query`, which
 * throws the `error` away. The caller then gets an empty array, and an empty
 * array renders as an empty shop — so a BROKEN catalogue and an EMPTY
 * catalogue looked exactly alike, from the storefront and from the logs.
 *
 * That is not a theoretical problem: a wrong anon key, an RLS policy that
 * stopped matching, a paused Supabase project and a rate limit all land in
 * that same silent hole, and none of them leave a trace to search for.
 *
 * The code still degrades to empty — a failed catalogue read must not take the
 * page down — but now it says why in the Worker log first.
 * ═══════════════════════════════════════════════════════════════════════════
 */
/**
 * Never let the CACHE LAYER take a page down.
 *
 * ═══ THE FAILURE THIS GUARDS ═══════════════════════════════════════════════
 *
 * These reads are wrapped in `unstable_cache`, which needs Next's incremental
 * cache to be present. When it is not, the call does not return empty — it
 * THROWS `Invariant: incrementalCache missing in unstable_cache`.
 *
 * The root layout awaits getSiteSettings() and getAnnouncements() on EVERY
 * page, so a throw there is not a degraded footer, it is every route in the
 * site failing to render. That surfaces as the error boundary on every
 * navigation while a full reload may still work, because the two take
 * different paths through the cache.
 *
 * So each cached read is wrapped: a cache-layer failure logs and falls back to
 * the same value the function already returns when Supabase is absent. Losing
 * the cache costs latency and some Supabase queries. It must not cost the
 * storefront.
 * ═══════════════════════════════════════════════════════════════════════════
 */
async function neverThrow<T>(what: string, read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (e) {
    console.error(
      `[db] ${what} CACHE LAYER failed: ${String((e as Error)?.message || e).slice(0, 300)}` +
        " — serving the fallback. If this says 'incrementalCache missing', the Worker" +
        " has no incremental cache bound (see open-next.config.ts)."
    );
    return fallback;
  }
}

function logReadFailure(
  what: string,
  error: { message?: string; code?: string; hint?: string; details?: string } | null
) {
  if (!error) return;
  const code = error.code ? ` [${error.code}]` : "";
  const hint = error.hint ? ` hint: ${error.hint}` : "";
  const detail = error.details ? ` (${error.details})` : "";
  console.error(`[db] ${what} read FAILED${code}: ${error.message ?? "unknown"}${detail}${hint}`);
}
/**
 * Deliberately the same as CATALOG_TTL, not shorter.
 *
 * The root layout reads announcements, and Next takes the MINIMUM revalidate
 * across everything a page touches — so a 60s ttl here quietly dropped every
 * static marketing page from 5-minute to 1-minute revalidation, five times the
 * origin renders for a stripe that rarely changes.
 *
 * Admin edits don't wait for this: saving calls revalidateTag(ANNOUNCEMENTS_TAG)
 * and revalidatePath("/", "layout"). Only a SCHEDULED start or end waits, and a
 * marketing banner opening a few minutes late is not worth the traffic.
 */
const ANNOUNCEMENTS_TTL = CATALOG_TTL;

/**
 * EVERY category row, switched on or off.
 *
 * ONE READ, TWO USES: the visible list the storefront shows, and the hidden
 * ids every product read excludes. They have to come from the same row set, or
 * the two can disagree — a category vanishing from the nav while its products
 * stay in the grid is exactly the half-applied rule lib/categories.ts exists
 * to prevent.
 *
 * Not filtered in the query on purpose: `.eq("active", true)` against a
 * database that has not run migration 0021 fails the whole read and empties
 * the nav, while a row with no `active` field simply is not `false`.
 */
const getAllCategoriesCached = unstable_cache(
  async (): Promise<Category[]> => {
    if (!supabaseConfigured()) return [];
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("position", { ascending: true });
    logReadFailure("categories", error);
    return (data as Category[]) ?? [];
  },
  ["categories"],
  { revalidate: CATALOG_TTL, tags: [CATALOG_TAG] }
);

/**
 * The switched-off category ids, for excluding their products.
 *
 * Its own try/catch rather than neverThrow(), because this runs INSIDE the
 * cached product read and the fallback has to be the fail-open one: an
 * unreadable category list means "nothing is known to be hidden", which shows
 * a product that should have been hidden. The other way round would empty the
 * entire shop. One is a visibility bug; the other is an outage.
 */
async function hiddenCategoryIdSet(): Promise<Set<string>> {
  try {
    return new Set(hiddenCategoryIds(await getAllCategoriesCached()));
  } catch (e) {
    console.error(
      `[db] could not read categories to hide: ${String((e as Error)?.message || e).slice(0, 200)}` +
        " — showing every active product, including any in a switched-off category."
    );
    return new Set();
  }
}

/**
 * The PostgREST filter that excludes a switched-off category's products.
 *
 * Exported for tests, because it is the one piece of this file that can empty
 * the shop by being subtly wrong, and it cannot be checked by reading it:
 *
 *  - `category_id.is.null` has to ride along in the same `or`, because SQL's
 *    NOT IN is NULL for a NULL column. Without it, every UNCATEGORISED product
 *    would disappear the moment one category was switched off.
 *  - it returns null for an empty list rather than a filter that matches
 *    nothing, so a shop with no hidden categories adds no filter at all.
 *
 * The read that uses it falls back to an unfiltered query if the server
 * rejects it — see getProductsCached.
 */
export function hiddenCategoryFilter(ids: Iterable<string>): string | null {
  const list = [...ids]
    .filter(Boolean)
    // Quoted only when it has to be, which is the same rule postgrest-js
    // applies to the values of its own .in()/.notIn() — a comma or a bracket
    // inside an unquoted value would end the list early and change what the
    // filter means. Our ids are uuids, so in practice nothing is quoted; this
    // is here so a text primary key could never rewrite the query.
    .map((id) => (/[,()"]/.test(id) ? `"${id.replace(/"/g, "")}"` : id));
  if (list.length === 0) return null;
  return `category_id.is.null,category_id.not.in.(${list.join(",")})`;
}

const getProductsCached = unstable_cache(
  async (opts?: {
    categorySlug?: string;
    power?: string;
    sort?: "newest" | "price-asc" | "price-desc";
    limit?: number;
  }): Promise<Product[]> => {
    if (!supabaseConfigured()) return [];
    const supabase = createPublicClient();

    let categoryId: string | null = null;
    if (opts?.categorySlug) {
      const { data: cat } = await supabase
        .from("categories")
        .select("*")
        .eq("slug", opts.categorySlug)
        .maybeSingle();
      /**
       * A slug that names nothing, or names a switched-off category, returns
       * NO products — it previously fell through and showed the entire
       * catalogue, so a typo or a hidden category quietly became "everything".
       */
      if (!categoryVisible(cat as Category | null)) {
        console.warn(
          `[db] category "${opts.categorySlug}" is unknown or switched off — returning no products`
        );
        return [];
      }
      categoryId = String((cat as Category).id);
    }

    /**
     * Pinned to one visible category already? Then there is nothing left to
     * exclude. Otherwise find the switched-off ones.
     */
    const hidden = categoryId ? new Set<string>() : await hiddenCategoryIdSet();

    /**
     * Built in a factory because it may be run TWICE — see the retry below.
     *
     * The hidden categories are excluded in the query as well as in JS, and
     * the reason is `limit`: trimming 60 rows down to 40 afterwards would show
     * a short homepage with no way to tell why.
     */
    const build = (excludeHidden: boolean) => {
      let query = supabase
        .from("products")
        .select("*, category:categories(*)")
        .eq("status", "active");
      if (categoryId) query = query.eq("category_id", categoryId);
      if (opts?.power) query = query.eq("power", opts.power);
      if (excludeHidden) {
        const filter = hiddenCategoryFilter(hidden);
        if (filter) query = query.or(filter);
      }
      if (opts?.sort === "price-asc") query = query.order("price_cents", { ascending: true });
      else if (opts?.sort === "price-desc") query = query.order("price_cents", { ascending: false });
      else query = query.order("created_at", { ascending: false });
      if (opts?.limit) query = query.limit(opts.limit);
      return query;
    };

    let { data, error } = await build(hidden.size > 0);

    /**
     * ⚠️ THE EXCLUSION MUST NOT BE ABLE TO EMPTY THE SHOP.
     *
     * A rejected filter comes back as an error with no rows, which renders as
     * an empty catalogue — the single worst failure this storefront has, and
     * one that would be caused by the visibility feature rather than by
     * anything the owner did. So if the filtered read fails, it is run again
     * WITHOUT the filter and the JS filter below does the hiding instead.
     *
     * The cost of the fallback is a short page when `limit` is in play. The
     * cost of not having it is a shop with nothing in it.
     */
    if (error && hidden.size > 0) {
      console.error(
        `[db] products read with the hidden-category filter FAILED: ${error.message}` +
          " — retrying without it; hidden products are still filtered in memory."
      );
      ({ data, error } = await build(false));
    }

    logReadFailure("products", error);
    /**
     * A read that SUCCEEDED and found nothing is a different problem from one
     * that failed, and the two need different fixes — so they get different
     * log lines. Public catalogue reads use the anon key, where products are
     * gated twice: by the `status = 'active'` filter above and again by the
     * products_public_read RLS policy. Admin reads use the service role and
     * bypass both, which is how a catalogue can be full in /admin/products and
     * empty on the storefront at the same time.
     */
    if (!error && (!data || data.length === 0)) {
      console.warn(
        "[db] products read returned NO ROWS (the query did not fail). " +
          "Check products.status = 'active' and the products_public_read RLS " +
          "policy for the anon role — /admin/products reads with the service " +
          "role and bypasses both."
      );
    }
    /**
     * THE AUTHORITATIVE FILTER, on the joined category row. The query-level
     * exclusion above is an optimisation for `limit`; this is the rule, and it
     * is what makes the rule hold when that exclusion was skipped or retried
     * away.
     */
    return visibleProducts((data as Product[]) ?? []);
  },
  ["products"],
  { revalidate: CATALOG_TTL, tags: [CATALOG_TAG] }
);
/*
 * getFeaturedProducts / getFlaggedFeatured were removed here.
 *
 * They fetched only `featured = true` products, capped at four, for the old
 * homepage strip. The homepage now shows the whole active catalogue via
 * getProducts() and orders featured-first in the page itself, so a separate
 * featured-only query had no caller — and one still named
 * "getFeaturedProducts" would have been the first place someone looked to
 * change the homepage grid.
 *
 * The `featured` column is still used: app/page.tsx sorts on it, and the admin
 * product form still sets it.
 */

const getSiteSettingsCached = unstable_cache(
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

/**
 * Every announcement, live or not — the time filtering is done by
 * liveAnnouncements() so the stripe and the admin list share one definition.
 *
 * Cached like the catalog. Admin saves revalidate by tag immediately; a
 * scheduled start or end waits for the ttl — see ANNOUNCEMENTS_TTL.
 */
const getAnnouncementsCached = unstable_cache(
  async (): Promise<Announcement[]> => {
    if (!supabaseConfigured()) return [];
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    // Migration 0014 not run yet — the storefront simply has no stripe.
    if (error) return [];
    return (data as Announcement[]) ?? [];
  },
  ["announcements"],
  { revalidate: ANNOUNCEMENTS_TTL, tags: [ANNOUNCEMENTS_TAG] }
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
    /**
     * A switched-off category takes its products' pages with it. Returning
     * null here is what makes /product/<slug> a 404 rather than a live,
     * buyable page nothing links to — the one leak a link-only fix leaves,
     * and the one a search engine or an old bookmark finds first.
     */
    if (!productVisible(product)) {
      console.warn(
        `[db] product "${slug}" belongs to a switched-off category — serving 404`
      );
      return null;
    }
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
    // Filtered in JS, not in the query: this read already uses `or` for the
    // term match, and a second one would be AND-ed onto it in a way that is
    // far easier to get wrong than it is to read.
    return visibleProducts((data as Product[]) ?? []);
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
  // A saved product whose category was switched off drops out of the Parts Bin
  // too — it is no longer something this shop offers, and leaving it there
  // means a "Add to cart" button the checkout will refuse.
  return visibleProducts(
    ((data ?? []) as unknown as { product: Product | null }[])
      .map((r) => r.product)
      .filter((p): p is Product => Boolean(p))
  );
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

/* -------------------------------------------------------------------------- */
/* Cache-safe public wrappers                                                 */
/* -------------------------------------------------------------------------- */
/*
 * Every caller goes through these rather than the cached functions directly,
 * so a cache-layer failure degrades instead of throwing. See neverThrow above
 * for why that matters more than it looks: two of these are awaited by the
 * root layout, which puts them on every page in the site.
 */

/** The categories a visitor may see. Admin reads the table directly. */
export function getCategories(): Promise<Category[]> {
  return neverThrow(
    "categories",
    async () => visibleCategories(await getAllCategoriesCached()),
    []
  );
}

export function getProducts(opts?: {
  categorySlug?: string;
  power?: string;
  sort?: "newest" | "price-asc" | "price-desc";
  limit?: number;
}): Promise<Product[]> {
  return neverThrow("products", () => getProductsCached(opts), []);
}

export function getSiteSettings(): Promise<SiteSettings> {
  return neverThrow("site settings", () => getSiteSettingsCached(), DEFAULT_SITE_SETTINGS);
}

export function getAnnouncements(): Promise<Announcement[]> {
  return neverThrow("announcements", () => getAnnouncementsCached(), []);
}
