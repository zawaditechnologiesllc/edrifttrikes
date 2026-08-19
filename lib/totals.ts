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

/**
 * Estimated import duty, in basis points (1350 = 13.50%).
 *
 * ⚠️ THIS IS NOT CHARGED BY THE STORE. It is disclosed to the buyer so they
 * know what their own customs authority will bill them on arrival — they pay
 * it directly to their local government, not to us. It is deliberately kept
 * OUT of the order total; see computeCartTotals below.
 *
 * ⚠️ ONE FLAT RATE FOR EVERY DESTINATION. Real duty varies by country, by
 * product classification (HS code) and by de-minimis thresholds, and some
 * destinations charge nothing at all. This is an indicative figure, which is
 * why every place it is shown labels it an estimate.
 */
export const DEFAULT_DUTY_RATE_BPS = 1350;

export type ShippingConfig = {
  /** Store-wide flat fee — the default for products without their own fee. */
  shipping_cents?: number;
  /** When true, every order ships free regardless of per-product fees. */
  free_shipping?: boolean;
  /** Sales tax in basis points (800 = 8.00%). Admin-set in /admin/settings. */
  tax_rate_bps?: number;
  /** Import duty estimate in basis points (1350 = 13.50%). */
  duty_rate_bps?: number;
};

/** Tax on a subtotal, in cents, at the store's configured rate. */
export function computeTax(subtotalCents: number, config?: ShippingConfig): number {
  const bps = config?.tax_rate_bps ?? DEFAULT_TAX_RATE_BPS;
  // Guard against a nonsense value reaching a charge: a negative or absurd rate
  // means bad data, and falling back beats billing it.
  const safeBps = Number.isFinite(bps) && bps >= 0 && bps <= 5000 ? bps : DEFAULT_TAX_RATE_BPS;
  return Math.round((subtotalCents * safeBps) / 10_000);
}

/**
 * Estimated import duty, in cents.
 *
 * Assessed on the SUBTOTAL — the declared value of the goods — which is the
 * base customs authorities actually use, and never on the order total (that
 * would compound duty onto our shipping and sales tax).
 *
 * The result is informational. Nothing in the checkout adds it to what the
 * buyer is charged.
 */
export function computeDuty(subtotalCents: number, config?: ShippingConfig): number {
  const bps = config?.duty_rate_bps ?? DEFAULT_DUTY_RATE_BPS;
  const safeBps =
    Number.isFinite(bps) && bps >= 0 && bps <= 10_000 ? bps : DEFAULT_DUTY_RATE_BPS;
  return Math.round((subtotalCents * safeBps) / 10_000);
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
 *
 * `duty` is returned but is NOT part of `total`. It is an estimate of what the
 * buyer's own customs authority will charge them on arrival, shown so the bill
 * isn't a surprise; the store never collects it. Anything that charges a card
 * must use `total` — adding `duty` to a charge would be taking money for a tax
 * we do not remit.
 */
export function computeCartTotals(items: TotalsItem[], config?: ShippingConfig) {
  const subtotal = items.reduce((n, i) => n + i.price_cents * i.qty, 0);
  const defaultFee = config?.shipping_cents ?? DEFAULT_SHIPPING_CENTS;
  const shipping =
    config?.free_shipping || subtotal === 0
      ? 0
      : items.reduce(
          (n, i) =>
            n + (i.free_shipping ? 0 : (i.shipping_cents ?? defaultFee)) * i.qty,
          0
        );
  const tax = computeTax(subtotal, config);
  const total = subtotal + shipping + tax;
  // Deliberately after `total` is computed, and deliberately not added to it.
  const duty = computeDuty(subtotal, config);
  return { subtotal, shipping, tax, total, duty };
}

/** Fee a single product advertises (product page display). */
export function productShippingCents(
  product: { shipping_cents?: number | null; free_shipping?: boolean },
  config?: ShippingConfig
): number {
  if (config?.free_shipping || product.free_shipping) return 0;
  return product.shipping_cents ?? config?.shipping_cents ?? DEFAULT_SHIPPING_CENTS;
}
