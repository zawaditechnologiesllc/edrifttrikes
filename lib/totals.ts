export const FREE_SHIPPING_THRESHOLD = 150000; // $1,500
export const FLAT_SHIPPING = 5000; // $50
export const TAX_RATE = 0.08;

export function computeTotals(subtotalCents: number) {
  const shipping = subtotalCents >= FREE_SHIPPING_THRESHOLD || subtotalCents === 0 ? 0 : FLAT_SHIPPING;
  const tax = Math.round(subtotalCents * TAX_RATE);
  const total = subtotalCents + shipping + tax;
  return { subtotal: subtotalCents, shipping, tax, total };
}
