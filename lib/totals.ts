export const DEFAULT_SHIPPING_CENTS = 5000; // $50 — until the admin sets a fee
export const TAX_RATE = 0.08;

export type ShippingConfig = {
  /** Flat, constant fee per order (admin-set in /admin/settings). */
  shipping_cents?: number;
  /** When true, every order ships free. */
  free_shipping?: boolean;
};

/**
 * Order money math — the single source of truth for cart, checkout page, and
 * the checkout API. Shipping is a constant flat fee (or free) controlled by
 * the admin via site settings; pass those in so all three surfaces agree.
 */
export function computeTotals(subtotalCents: number, config?: ShippingConfig) {
  const fee = config?.free_shipping
    ? 0
    : config?.shipping_cents ?? DEFAULT_SHIPPING_CENTS;
  const shipping = subtotalCents === 0 ? 0 : fee;
  const tax = Math.round(subtotalCents * TAX_RATE);
  const total = subtotalCents + shipping + tax;
  return { subtotal: subtotalCents, shipping, tax, total };
}
