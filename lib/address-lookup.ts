/**
 * Address autocomplete — the server half.
 *
 * SERVER ONLY. The whole point of doing this here rather than in the browser is
 * that the API key never leaves the Worker. A Google Maps key shipped to the
 * client is a key anyone can lift and bill to your account, and this codebase
 * has twice been bitten by NEXT_PUBLIC_* values being baked in at build time —
 * a server-side key sidesteps both problems.
 *
 * TWO PROVIDERS, chosen by what is configured:
 *
 *   GOOGLE — used when GOOGLE_MAPS_API_KEY is set. Worldwide, genuine
 *   type-ahead, and what the checkouts buyers are used to actually run on. It
 *   takes two calls: predictions while typing, then one details lookup for the
 *   address components — but only for the one address the buyer clicks, which
 *   is what keeps the bill small.
 *
 *   CENSUS — the fallback, so the feature works with no account and no key at
 *   all. The US Census Bureau geocoder is public domain, needs no key, and
 *   returns full components in a single call. US addresses only; buyers
 *   elsewhere type the address as they always have.
 *
 * Every failure — a bad key, a provider outage, a timeout — returns no
 * suggestions rather than an error. Autocomplete is a convenience laid over a
 * form that already works without it, and a checkout must never break because a
 * geocoder is having a bad day.
 */

import { serverEnv } from "@/lib/env";

/** The fields a picked address fills in, matching CHECKOUT_FIELDS names. */
export type AddressPrefill = {
  address: string;
  city: string;
  state: string;
  zip: string;
  /** ISO alpha-2 — the checkout country select stores codes, not names. */
  country: string;
};

export type AddressSuggestion = {
  /** Opaque token to pass back to resolveAddress; empty when prefill is inline. */
  id: string;
  /** What the buyer reads in the dropdown. */
  label: string;
  /**
   * Present when the provider already gave us the components, so picking the
   * address costs no second request.
   */
  prefill?: AddressPrefill;
};

export type AddressProvider = "google" | "census";

/** Shortest input worth a lookup — anything less matches half a city. */
export const MIN_QUERY_LENGTH = 4;
const MAX_QUERY_LENGTH = 120;
const MAX_SUGGESTIONS = 6;
const TIMEOUT_MS = 3500;

export function addressProvider(): AddressProvider {
  return googleKey() ? "google" : "census";
}

function googleKey(): string | undefined {
  return serverEnv("GOOGLE_MAPS_API_KEY") || serverEnv("GOOGLE_PLACES_API_KEY");
}

/** True when a query is worth sending to a provider at all. */
export function usableQuery(q: string): boolean {
  return normalizeQuery(q).length >= MIN_QUERY_LENGTH;
}

export function normalizeQuery(q: string): string {
  return String(q ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
}

/**
 * Addresses matching what the buyer has typed so far.
 *
 * `country` narrows the search to where they said they are, which is both more
 * accurate and cheaper. Never throws.
 */
export async function suggestAddresses(
  query: string,
  country?: string | null
): Promise<{ suggestions: AddressSuggestion[]; provider: AddressProvider }> {
  const provider = addressProvider();
  const q = normalizeQuery(query);
  if (!usableQuery(q)) return { suggestions: [], provider };

  try {
    const suggestions =
      provider === "google"
        ? await googleSuggest(q, country)
        : await censusSuggest(q, country);
    return { suggestions: suggestions.slice(0, MAX_SUGGESTIONS), provider };
  } catch {
    // A provider that is down, rate-limiting us, or returning nonsense must
    // leave the buyer with a form they can still type into.
    return { suggestions: [], provider };
  }
}

/**
 * The components for one picked suggestion.
 *
 * Only Google needs this; the Census fallback returns components inline, so its
 * suggestions already carry `prefill` and never reach here.
 */
export async function resolveAddress(id: string): Promise<AddressPrefill | null> {
  const placeId = String(id ?? "").trim().slice(0, 300);
  if (!placeId || !googleKey()) return null;
  try {
    return await googleDetails(placeId);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Google Places (New)
// ---------------------------------------------------------------------------

async function googleSuggest(
  query: string,
  country?: string | null
): Promise<AddressSuggestion[]> {
  const body: Record<string, unknown> = {
    input: query,
    // Street addresses only. Without this the list fills with cities and
    // businesses, none of which can fill a shipping form.
    includedPrimaryTypes: ["street_address", "premise", "subpremise", "route"],
  };
  const region = isoCode(country);
  if (region) body.includedRegionCodes = [region.toLowerCase()];

  const response = await fetchJson("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": googleKey() as string,
      // Ask for only the fields we use — Google bills by what you request.
      "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text",
    },
    body: JSON.stringify(body),
  });

  return parseGoogleSuggestions(response);
}

/**
 * Predictions out of a Places autocomplete response.
 *
 * Split from the fetch so it can be tested against a real response shape —
 * field names are the thing that actually breaks here, and no amount of
 * exercising the network would catch a typo in one.
 */
export function parseGoogleSuggestions(
  response: Record<string, unknown> | null
): AddressSuggestion[] {
  const raw = Array.isArray(response?.suggestions) ? response.suggestions : [];
  return raw
    .map((s: Record<string, unknown>) => {
      const p = s?.placePrediction as Record<string, unknown> | undefined;
      const placeId = typeof p?.placeId === "string" ? p.placeId : "";
      const text = (p?.text as Record<string, unknown> | undefined)?.text;
      const label = typeof text === "string" ? text : "";
      return placeId && label ? { id: placeId, label } : null;
    })
    .filter(Boolean) as AddressSuggestion[];
}

async function googleDetails(placeId: string): Promise<AddressPrefill | null> {
  const response = await fetchJson(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "X-Goog-Api-Key": googleKey() as string,
        "X-Goog-FieldMask": "addressComponents",
      },
    }
  );

  return parseGooglePlaceDetails(response);
}

/** Form fields out of a Places details response. */
export function parseGooglePlaceDetails(
  response: Record<string, unknown> | null
): AddressPrefill | null {
  const components = Array.isArray(response?.addressComponents)
    ? (response.addressComponents as Record<string, unknown>[])
    : [];
  const part = (type: string, short = false): string => {
    const hit = components.find((c) => {
      // A hand-mangled or unexpected entry must not throw: this parses a third
      // party's JSON, and the caller is a buyer half-way through checkout.
      if (!c || typeof c !== "object") return false;
      const types = Array.isArray(c.types) ? (c.types as string[]) : [];
      return types.includes(type);
    });
    if (!hit) return "";
    const value = short ? hit.shortText : hit.longText;
    return typeof value === "string" ? value : "";
  };

  const street = [part("street_number"), part("route")].filter(Boolean).join(" ");
  const prefill: AddressPrefill = {
    address: street,
    // US addresses use `locality`; a lot of the world doesn't have one, so fall
    // back through the administrative levels rather than leaving the city blank.
    city: part("locality") || part("postal_town") || part("sublocality") || part("administrative_area_level_2"),
    state: part("administrative_area_level_1", true),
    zip: part("postal_code"),
    country: part("country", true).toUpperCase(),
  };
  // A result with no street line can't fill a shipping form — better to leave
  // the buyer typing than to half-fill it and have them not notice.
  return prefill.address ? prefill : null;
}

// ---------------------------------------------------------------------------
// US Census Bureau geocoder — keyless fallback
// ---------------------------------------------------------------------------

const CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";

async function censusSuggest(
  query: string,
  country?: string | null
): Promise<AddressSuggestion[]> {
  // US-only by construction. Asking it about a French address wastes a request
  // and always returns nothing.
  const region = isoCode(country);
  if (region && region !== "US") return [];

  const url = new URL(CENSUS_URL);
  url.searchParams.set("address", query);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");

  return parseCensusResponse(await fetchJson(url.toString()));
}

/**
 * Matches out of a Census geocoder response.
 *
 * The geocoder returns the street in eight separate pieces, which is the part
 * most likely to be assembled wrong — hence a pure function with tests over it.
 */
export function parseCensusResponse(
  response: Record<string, unknown> | null
): AddressSuggestion[] {
  const matches = (response?.result as Record<string, unknown> | undefined)?.addressMatches;
  if (!Array.isArray(matches)) return [];

  return matches
    .map((m: Record<string, unknown>) => {
      const label = typeof m.matchedAddress === "string" ? m.matchedAddress : "";
      const c = (m.addressComponents ?? {}) as Record<string, unknown>;
      const str = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
      // The geocoder returns the street in pieces; the form wants one line.
      const address = [
        str("fromAddress"),
        str("preQualifier"),
        str("preDirection"),
        str("preType"),
        str("streetName"),
        str("suffixType"),
        str("suffixDirection"),
        str("suffixQualifier"),
      ]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (!label || !address) return null;
      return {
        // Components came back with the match, so there is nothing to resolve.
        id: "",
        label,
        prefill: {
          address,
          city: str("city"),
          state: str("state"),
          zip: str("zip"),
          country: "US",
        },
      };
    })
    .filter(Boolean) as AddressSuggestion[];
}

// ---------------------------------------------------------------------------

/** ISO alpha-2 if `value` already looks like one; the form submits codes. */
function isoCode(value?: string | null): string | null {
  const v = String(value ?? "").trim();
  return /^[A-Za-z]{2}$/.test(v) ? v.toUpperCase() : null;
}

/**
 * Fetch with a hard timeout, returning parsed JSON.
 *
 * The timeout is not optional: this runs inside a checkout request, and a
 * provider that hangs would hold a Worker open until the platform kills it.
 */
async function fetchJson(
  url: string,
  init?: RequestInit
): Promise<Record<string, unknown> | null> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as Record<string, unknown>;
}
