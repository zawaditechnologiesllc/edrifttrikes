/**
 * How long delivery takes, as QUOTED TO THE CUSTOMER.
 *
 * One definition for every surface — product pages, the cart, checkout, the
 * Stripe payment page, the PDF product sheet, the policy pages and every email.
 * A store that promises twelve days at checkout and then emails a date four
 * weeks out ends up arguing with its own customers, so the number has exactly
 * one home.
 *
 * NOT THE SAME THING as lib/fulfillment.ts. That module is the internal
 * schedule of WHEN each tracking email fires (day 0, 3, 25, 28). This one is
 * what the buyer is told to expect. They answer different questions, and
 * conflating them is what let the site say "12–20 days" while the confirmation
 * email said 28.
 *
 * THE MODEL: a base window of 12–20 days, plus a transit allowance of up to 7
 * days for how far the parcel has to travel. The allowances below are the
 * store's own routing assumptions, not carrier data — they are all in one table
 * precisely so they can be re-tuned from real delivery times later.
 */

import { countryCode } from "@/lib/countries";

/** Fastest a parcel arrives, anywhere. */
export const DELIVERY_MIN_DAYS = 12;

/** Slowest, on the shortest route. Distant destinations add to this. */
export const DELIVERY_BASE_MAX_DAYS = 20;

/** The most any destination can add to the base window. */
export const MAX_ROUTE_EXTRA_DAYS = 7;

/**
 * Transit allowance by destination, in days on top of the base window.
 *
 * Four bands rather than a per-country table: the difference between shipping
 * to France and to Germany isn't something this store can predict, but the
 * difference between North America and central Africa is.
 */
export const ROUTE_ZONES = {
  /** The United States and its territories — the shortest route. */
  domestic: 0,
  /** A land border or a short sea route away. */
  near: 3,
  /** Established lanes with predictable transit times. */
  established: 5,
  /** Everywhere else: longer haul, less predictable clearance. */
  extended: MAX_ROUTE_EXTRA_DAYS,
} as const;

const DOMESTIC = new Set(["US", "PR", "VI", "GU", "AS", "MP"]);

const NEAR = new Set(["CA", "MX"]);

const ESTABLISHED = new Set([
  // Western and northern Europe
  "GB", "IE", "FR", "DE", "NL", "BE", "LU", "ES", "PT", "IT", "AT", "CH",
  "DK", "SE", "NO", "FI", "IS", "MC", "LI", "AD", "SM", "MT",
  // Central and eastern EU
  "PL", "CZ", "SK", "HU", "SI", "HR", "EE", "LV", "LT", "GR", "CY", "RO", "BG",
  // Oceania and the established Asian hubs
  "AU", "NZ", "JP", "KR", "SG", "HK", "TW",
  // Gulf and Israel — short, well-served air lanes
  "AE", "QA", "IL",
]);

export type DeliveryWindow = {
  /** Earliest day, counted from the moment payment clears. */
  min: number;
  /** Latest day — the date the customer is given. */
  max: number;
  /** Days this destination adds over the base window. */
  extraDays: number;
  /** ISO code the window was resolved for; null when the destination is unknown. */
  country: string | null;
};

/**
 * Which transit band a destination falls into.
 *
 * Takes either an ISO code or a display name, because the checkout form submits
 * a code while an order row stores the name — both have to resolve to the same
 * window. A destination we can't place at all is treated as `extended`: an
 * unrecognised country is far away far more often than it is next door.
 */
export function routeZone(country: string | null | undefined): keyof typeof ROUTE_ZONES {
  const code = countryCode(String(country ?? ""));
  if (!code) return "extended";
  if (DOMESTIC.has(code)) return "domestic";
  if (NEAR.has(code)) return "near";
  if (ESTABLISHED.has(code)) return "established";
  return "extended";
}

/**
 * The window to quote for a destination.
 *
 * With NO destination — a product page, a cart before the address is filled in —
 * this is the base 12–20 days. That is the shortest honest quote, and it is
 * always shown next to wording that says longer routes take more; quoting the
 * worst case to everyone would misprice the offer for the home market.
 */
export function deliveryWindow(country?: string | null): DeliveryWindow {
  const hasDestination = Boolean(String(country ?? "").trim());
  const extraDays = hasDestination ? ROUTE_ZONES[routeZone(country)] : 0;
  return {
    min: DELIVERY_MIN_DAYS + extraDays,
    max: DELIVERY_BASE_MAX_DAYS + extraDays,
    extraDays,
    country: hasDestination ? countryCode(String(country)) : null,
  };
}

/**
 * Days after payment that the customer is told to expect the package — the far
 * end of their own window, which is the date that goes on the order.
 */
export function deliveryDaysFor(country?: string | null): number {
  return deliveryWindow(country).max;
}

/** "12–20 days". */
export function formatDeliveryWindow(country?: string | null): string {
  const w = deliveryWindow(country);
  return `${w.min}–${w.max} days`;
}

/**
 * A full sentence for the destination, or for none.
 *
 * The "varies by destination" half is not decoration: without it the base
 * window reads as a promise to every buyer, including the ones a week further
 * away.
 */
export function deliveryEstimateSentence(country?: string | null): string {
  const w = deliveryWindow(country);
  // The caveat turns on whether we KNOW the destination, not on how far it is.
  // Once the buyer has chosen a country the window is theirs, and telling a
  // buyer in the home market that "longer routes add up to 7 days" is noise
  // about someone else's order.
  if (String(country ?? "").trim()) {
    return `${w.min}–${w.max} days to your destination, tracked the whole way.`;
  }
  return `${w.min}–${w.max} days, tracked the whole way. Longer routes add up to ${MAX_ROUTE_EXTRA_DAYS} days.`;
}
