export const DEFAULT_SHIPPING_CENTS = 5000; // $50 — until the admin sets a fee
export const TAX_RATE = 0.08;

export type ShippingConfig = {
  /** Store-wide flat fee — the default for products without their own fee. */
  shipping_cents?: number;
  /** When true, every order ships free regardless of per-product fees. */
  free_shipping?: boolean;
};

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
  const tax = Math.round(subtotal * TAX_RATE);
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
