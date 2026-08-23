/**
 * Format integer cents as a currency string.
 *
 * NEVER RETURNS "$NaN". A page that quotes money is the last place a bad number
 * should surface as one: a buyer who sees "$NaN" where the total goes does not
 * report a bug, they close the tab. Anything that is not a finite number falls
 * back to zero, which is wrong in a way that is visibly wrong rather than
 * alarming — and computeCartTotals guards the inputs so it should never happen.
 */
export function formatMoney(cents: number, currency = "usd"): string {
  const amount = Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
    maximumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format(amount / 100);
}
