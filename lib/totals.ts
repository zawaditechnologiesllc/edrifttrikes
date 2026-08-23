export const DEFAULT_SHIPPING_CENTS = 5000; // $50 — until the admin sets a fee

/**
 * Fallback sales tax, in basis points (800 = 8.00%), used until an admin sets a
 * rate in /admin/settings.
 *
 * Basis points, not a float: tax feeds a charged amount, and integer math keeps
 * the result exact instead of accumulating float error.
 *
 * ⚠️ ONE FLAT RATE FOR EVERY BUYER. This is a placeholder, not a tax engine —
 * it has no notion of the buyer's state, country, VAT/GST, or nexus rules. If
 * you sell across state or national borders, a real tax provider (Stripe Tax,
 * TaxJar, Avalara) is what you need; the rate here is only a stopgap.
 */
export const DEFAULT_TAX_RATE_BPS = 800;

export type ShippingConfig = {
  /** Store-wide flat fee — the default for products without their own fee. */
  shipping_cents?: number;
  /** When true, every order ships free regardless of per-product fees. */
  free_shipping?: boolean;
  /** Sales tax in basis points (800 = 8.00%). Admin-set in /admin/settings. */
  tax_rate_bps?: number;
};

/** Tax on a subtotal, in cents, at the store's configured rate. */
export function computeTax(subtotalCents: number, config?: ShippingConfig): number {
  const base = Number.isFinite(subtotalCents) && subtotalCents > 0 ? subtotalCents : 0;
  const raw = config?.tax_rate_bps;
  const bps = typeof raw === "string" ? Number(raw) : (raw ?? DEFAULT_TAX_RATE_BPS);
  // Guard against a nonsense value reaching a charge: a negative or absurd rate
  // means bad data, and falling back beats billing it.
  const safeBps = Number.isFinite(bps) && bps >= 0 && bps <= 5000 ? bps : DEFAULT_TAX_RATE_BPS;
  return Math.round((base * safeBps) / 10_000);
}

export type TotalsItem = {
  price_cents: number;
  qty: number;
  /** Per-product fee (admin-set at upload); null/undefined = store default. */
  shipping_cents?: number | null;
  /** This product ships free. */
  free_shipping?: boolean;
};

/**
 * Order money math — the single source of truth for cart, checkout page, and
 * the checkout API. Shipping is charged per unit: each product uses its own
 * admin-set fee (or the store default), free-shipping products contribute
 * nothing, and the store-wide free_shipping switch zeroes everything.
 */
/**
 * A money value that can be trusted downstream.
 *
 * Everything here ends up on a screen a buyer reads and, eventually, in an
 * amount somebody is charged. A single undefined price — a cart entry saved by
 * an older build, a settings row with a null column, a hand-edited product —
 * would otherwise turn the whole order into NaN and the checkout would show
 * nothing where the total goes.
 */
function money(value: unknown, fallback = 0): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Quantity, as an integer of at least one. */
function count(value: unknown): number {
  const n = Math.floor(money(value, 1));
  return n >= 1 ? n : 1;
}

export function computeCartTotals(items: TotalsItem[], config?: ShippingConfig) {
  const lines = Array.isArray(items) ? items : [];
  const subtotal = lines.reduce((n, i) => n + money(i?.price_cents) * count(i?.qty), 0);
  const defaultFee = money(config?.shipping_cents, DEFAULT_SHIPPING_CENTS);
  const shipping =
    config?.free_shipping || subtotal === 0
      ? 0
      : lines.reduce(
          (n, i) =>
            n +
            (i?.free_shipping
              ? 0
              : money(i?.shipping_cents ?? defaultFee, defaultFee)) *
              count(i?.qty),
          0
        );
  const tax = computeTax(subtotal, config);
  const total = subtotal + shipping + tax;
  return { subtotal, shipping, tax, total };
}

/** Fee a single product advertises (product page display). */
export function productShippingCents(
  product: { shipping_cents?: number | null; free_shipping?: boolean },
  config?: ShippingConfig
): number {
  if (config?.free_shipping || product.free_shipping) return 0;
  return product.shipping_cents ?? config?.shipping_cents ?? DEFAULT_SHIPPING_CENTS;
}
