/**
 * Showing a buyer a price in the money they think in.
 *
 * ═══ WHAT THIS DOES AND, MORE IMPORTANTLY, WHAT IT DOES NOT ════════════════
 *
 * Every price in this shop is stored once, in US cents, and every payment is
 * taken in US dollars. That is a property of the data model (one
 * `price_cents` per product), of the checkout (`currency: "usd"` to the
 * gateway), of the refund path and of the admin's revenue totals, which add
 * `total_cents` across orders without looking at what currency each was in.
 *
 * So this module converts for DISPLAY and says so. A buyer on
 * europe.edrifttrikes.shop sees "≈ €1,740" beside "$1,899", and the charge on
 * their card is $1,899. Quoting a price you do not charge, without saying
 * which is which, is a misleading price indication — in the EU explicitly so —
 * and it is also how a customer opens a dispute for an amount that does not
 * match what they agreed to.
 *
 * ⚠️ CHARGING in euros is a much larger change than showing them, and this
 * module is deliberately not a half-step towards it. It would need per-
 * currency prices (or FX at capture), a gateway configured for each currency,
 * refunds in the original currency, invoices that total correctly, and admin
 * reporting that stops summing mixed currencies as though they were one. None
 * of that is here.
 */

/** The currency each storefront quotes in. Settlement is always USD. */
export const DISPLAY_CURRENCIES = ["USD", "CAD", "AED", "EUR"] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

/** What the shop actually charges, everywhere. */
export const SETTLEMENT_CURRENCY = "USD";

/**
 * Units of each currency per 1 USD.
 *
 * ⚠️ TWO OF THESE ARE GUESSES WITH A SHELF LIFE, AND ONE IS NOT.
 *
 * AED is PEGGED to the dollar at 3.6725 by the UAE central bank and has been
 * since 1997. It does not drift and does not need updating.
 *
 * EUR and CAD float. The numbers below are a starting point, not a feed —
 * update them when they are visibly wrong, or wire an FX source into the
 * hourly cron. What stops a stale rate becoming a lie is `RATES_AS_OF` and the
 * staleness check in `convert()`: past the cutoff the shop shows the dollar
 * price alone rather than a number it can no longer stand behind.
 */
export const RATES: Record<DisplayCurrency, number> = {
  USD: 1,
  AED: 3.6725, // pegged — see above
  EUR: 0.92,
  CAD: 1.37,
};

/** Currencies that do not float, so a date cannot make them wrong. */
const PEGGED: DisplayCurrency[] = ["USD", "AED"];

/** When the floating rates above were last set, in UTC. */
export const RATES_AS_OF = new Date("2026-10-18T00:00:00Z");

/**
 * How long a floating rate may be used for.
 *
 * Long enough that nobody has to babysit it, short enough that a rate which
 * has drifted far from reality stops being shown. Four months of EUR movement
 * is routinely several percent — enough that a buyer comparing the two numbers
 * would notice, and noticing is what costs the sale.
 */
export const RATE_MAX_AGE_DAYS = 120;

export function ratesAreStale(now: Date = new Date()): boolean {
  const age = (now.getTime() - RATES_AS_OF.getTime()) / 86_400_000;
  return age > RATE_MAX_AGE_DAYS || age < 0;
}

export function isDisplayCurrency(v: unknown): v is DisplayCurrency {
  return (DISPLAY_CURRENCIES as readonly string[]).includes(String(v));
}

/**
 * The same money, in another currency, as integer minor units.
 *
 * Returns null when there is nothing honest to show: an unknown currency, a
 * bad amount, or a floating rate that has gone stale. A caller that gets null
 * shows the dollar price on its own, which is always correct.
 */
export function convert(
  cents: number,
  to: string,
  now: Date = new Date()
): number | null {
  if (!Number.isFinite(cents)) return null;
  const code = String(to ?? "").toUpperCase();
  if (!isDisplayCurrency(code)) return null;
  if (code === SETTLEMENT_CURRENCY) return null; // nothing to add
  if (!PEGGED.includes(code) && ratesAreStale(now)) return null;
  return Math.round(cents * RATES[code]);
}

/**
 * Round a converted amount to something a price tag would actually say.
 *
 * `1899 * 0.92 = 1747.08`, and "€1,747.08" reads like a bank statement rather
 * than a price. Rounding to the nearest whole unit keeps it looking like a
 * price — and since it is explicitly approximate, the rounding costs nothing.
 */
export function roundForDisplay(minorUnits: number): number {
  return Math.round(minorUnits / 100) * 100;
}

/**
 * Locale per currency, chosen so the result is UNAMBIGUOUS beside a dollar
 * price — not so it looks most native.
 *
 * ⚠️ CAD IS FORMATTED en-US ON PURPOSE. In en-CA the Canadian dollar is the
 * local currency, so it renders a bare "$2,602" — which sits directly under
 * "$1,899" charged in US dollars and tells the buyer nothing about which is
 * which. en-US renders "CA$2,602". The whole point of the second line is to be
 * read as a different currency; a formatting choice that hides that undoes it.
 */
const LOCALES: Record<DisplayCurrency, string> = {
  USD: "en-US",
  CAD: "en-US", // see above — "CA$", never a bare "$"
  AED: "en-AE",
  EUR: "de-DE",
};

export function formatIn(minorUnits: number, currency: DisplayCurrency): string {
  return new Intl.NumberFormat(LOCALES[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(minorUnits / 100);
}

/**
 * The approximate local price, or nothing.
 *
 * ⚠️ THE WORD "APPROX." IS PART OF THE OUTPUT, not decoration a caller may
 * drop. Without it this is a second price, and a shop showing two prices
 * without saying which one it takes is a shop arguing with its customers
 * later.
 */
export function approximate(
  cents: number,
  currency: string,
  now: Date = new Date()
): string | null {
  const converted = convert(cents, currency, now);
  if (converted === null) return null;
  const code = String(currency).toUpperCase() as DisplayCurrency;
  return `approx. ${formatIn(roundForDisplay(converted), code)}`;
}

/** The sentence a storefront puts under its prices. */
export function currencyNoteFor(
  currency: string,
  now: Date = new Date()
): string {
  const code = String(currency ?? "").toUpperCase();
  if (!isDisplayCurrency(code) || code === SETTLEMENT_CURRENCY) {
    return "Prices are shown and charged in US dollars.";
  }
  if (!PEGGED.includes(code) && ratesAreStale(now)) {
    // Say nothing about a conversion that is not being shown.
    return "Prices are shown and charged in US dollars.";
  }
  const pegged = PEGGED.includes(code);
  return (
    `Prices are charged in US dollars. The ${code} figures are approximate` +
    (pegged
      ? `, converted at the fixed rate the ${code} is pegged to the dollar at.`
      : ", for guidance only — your bank converts at its own rate on the day.")
  );
}
