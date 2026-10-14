import type { Product } from "@/lib/types";

/**
 * Which product actually sells best, counted rather than guessed.
 *
 * ═══ WHY IT IS COUNTED FROM PAID ORDERS ════════════════════════════════════
 *
 * `featured` is an opinion an admin set once. This is a fact: units that
 * somebody paid for. If the shop's best seller is not the one on the homepage
 * banner, the reminder campaign should be promoting the one people buy, and
 * the only way to know that is to count.
 *
 * PENDING ORDERS DO NOT COUNT. An abandoned checkout is not a sale, and the
 * sequence this feeds is sent precisely to people whose order is pending — so
 * counting them would let a single indecisive buyer nominate the product that
 * then gets promoted back at them.
 */

/** Only paid money counts. */
export const SELLING_STATUSES = ["paid", "fulfilled"] as const;

/** How far back to count. A year, so one old spike cannot define it forever. */
export const BEST_SELLER_WINDOW_DAYS = 365;

/** The most line items to read in one pass, so the query stays bounded. */
export const BEST_SELLER_ROW_LIMIT = 2000;

export type SoldLine = {
  product_id: string | null;
  qty: number | null;
};

export type Ranked = { productId: string; units: number };

/**
 * Rank products by units sold, highest first.
 *
 * Pure, so the ranking is testable without a database and the query that feeds
 * it can change shape without touching the arithmetic.
 */
export function rankBySold(lines: SoldLine[]): Ranked[] {
  const units = new Map<string, number>();
  for (const line of lines) {
    const id = line.product_id;
    if (!id) continue; // a deleted product: the sale happened, the product did not survive
    const qty = Number(line.qty ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    units.set(id, (units.get(id) ?? 0) + qty);
  }
  return [...units.entries()]
    .map(([productId, n]) => ({ productId, units: n }))
    // Ties broken by id so the "best seller" does not flip between two equal
    // products on every run, which would make the campaign look random.
    .sort((a, b) => b.units - a.units || a.productId.localeCompare(b.productId));
}

/**
 * Is this product fit to be promoted?
 *
 * The campaign runs for two months. Promoting something that has since been
 * unpublished or sold out is how a buyer clicks through to a 404 — worse than
 * sending no offer at all, because it is the one part of the email that asked
 * them to do something.
 */
export function isPromotable(product: Pick<Product, "status" | "stock" | "slug"> | null | undefined): boolean {
  if (!product) return false;
  if (String(product.status ?? "") !== "active") return false;
  if (!product.slug) return false;
  const stock = product.stock;
  // Null stock means "not tracked", which is not the same as "none left".
  return stock === null || stock === undefined || Number(stock) > 0;
}
