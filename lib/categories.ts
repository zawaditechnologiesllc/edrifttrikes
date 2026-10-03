import type { Category } from "@/lib/types";

/**
 * What the storefront is allowed to show — one rule, in one place.
 *
 * ═══ HIDDEN MEANS HIDDEN ═══════════════════════════════════════════════════
 *
 * A category switched off in Admin → Categories must leave NO trace on the
 * storefront: no nav link, no footer link, no hero button, no homepage tile,
 * no filter in the shop sidebar, no products of its own anywhere, no product
 * pages, no sitemap entries, and no way to buy what is in it.
 *
 * That last clause is the reason this file exists rather than each page doing
 * its own check. The first version of the toggle hid the LINKS and left the
 * products in the grid, so switching a range off produced a shop that still
 * sold it — only now with no way to browse it. A visibility rule that half the
 * code knows about is worse than no rule, because the gaps are invisible until
 * a customer finds one.
 *
 * Everything here is a pure function of rows that were already read, so it is
 * cheap to apply everywhere and can be tested without a database.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** A link to a category, ready for a nav, a footer or a hero button. */
export type CategoryLink = { key: string; label: string; href: string };

/**
 * Is this category shown on the storefront?
 *
 * `active === false` and nothing else is hidden. A row read from a database
 * that has not run migration 0021 has no `active` field at all, and an
 * undefined value MUST read as visible — otherwise deploying the toggle before
 * running its migration would empty the entire shop.
 */
export function categoryVisible(category?: Category | null): boolean {
  if (!category) return false;
  return category.active !== false;
}

/** The categories a visitor may see, in the order the admin arranged them. */
export function visibleCategories(categories: Category[]): Category[] {
  return (categories ?? []).filter((c) => categoryVisible(c));
}

/**
 * The ids of the switched-off categories.
 *
 * Deliberately the positive test (`=== false`) rather than `!categoryVisible`:
 * this list is used to EXCLUDE things, so a row whose `active` column is
 * missing must not land in it.
 */
export function hiddenCategoryIds(categories: Category[]): string[] {
  return (categories ?? [])
    .filter((c) => c?.active === false)
    .map((c) => String(c.id ?? ""))
    .filter(Boolean);
}

/**
 * Is this product hidden because of the category it is filed under?
 *
 * For callers that have a `category_id` but no joined category row — the
 * checkout, which reads products with the service-role key and a plain
 * `select("*")`.
 *
 * A product filed under NOTHING is not hidden: it was never in a category, so
 * no category can hide it. Only a positive match against a known-hidden id
 * hides anything, which keeps every failure mode fail-open: an unreadable
 * category list means an empty `hiddenIds`, which hides nothing.
 */
export function hiddenByCategory(
  categoryId: string | null | undefined,
  hiddenIds: ReadonlySet<string>
): boolean {
  if (!categoryId) return false;
  return hiddenIds.has(String(categoryId));
}

/**
 * Is this product shown on the storefront, judged by its JOINED category?
 *
 * ⚠️ REQUIRES THE JOIN — `select("*, category:categories(*)")`. A product read
 * without it has no category row to judge, and this returns true: a missing
 * join is a programming mistake, and the honest failure for one is "the filter
 * did nothing", not "the catalogue is empty". Callers that cannot join must
 * use hiddenByCategory() with an explicit id list instead.
 */
export function productVisible(product: {
  category_id?: string | null;
  category?: Category | null;
}): boolean {
  if (!product) return false;
  // Filed under nothing is not the same as filed under something hidden.
  if (!product.category_id) return true;
  if (!product.category) return true;
  return product.category.active !== false;
}

/** Keep only the products a visitor may see. Needs the joined category. */
export function visibleProducts<T extends { category_id?: string | null; category?: Category | null }>(
  products: T[]
): T[] {
  return (products ?? []).filter((p) => productVisible(p));
}

/* -------------------------------------------------------------------------- */
/* Links                                                                       */
/* -------------------------------------------------------------------------- */
/*
 * The nav, the footer and the hero used to hard-code Trikes / Parts / Dirt
 * Bikes. Three copies of a list the admin can change, which is why switching a
 * category off left three live links pointing at it. They are all built from
 * the real categories now, so the toggle reaches them by construction.
 */

/** Everything a visitor may browse, one link per visible category. */
export function categoryLinks(categories: Category[]): CategoryLink[] {
  return visibleCategories(categories).map((c) => ({
    key: String(c.id || c.slug),
    label: c.name,
    href: `/shop?category=${encodeURIComponent(c.slug)}`,
  }));
}

/** The whole shop, unfiltered — the one link that is always safe to show. */
export const ALL_PRODUCTS_LINK: CategoryLink = {
  key: "all",
  label: "Shop the fleet",
  href: "/shop",
};

/**
 * The hero's call-to-action buttons: one per product line, at most two.
 *
 * Two is what the hero has room for, and two is what it was designed around —
 * a filled primary and an outlined secondary. With every category switched off
 * (or no database) it falls back to the whole shop rather than rendering a
 * hero with nothing to click.
 */
export function heroLinks(categories: Category[]): CategoryLink[] {
  const links = categoryLinks(categories)
    .slice(0, 2)
    .map((l) => ({ ...l, label: `Shop ${l.label}` }));
  return links.length > 0 ? links : [ALL_PRODUCTS_LINK];
}

/**
 * The single CTA used on marketing pages ("Ready to ride?").
 *
 * The first product line if there is one, the whole shop otherwise.
 */
export function primaryShopLink(categories: Category[]): CategoryLink {
  return heroLinks(categories)[0] ?? ALL_PRODUCTS_LINK;
}
