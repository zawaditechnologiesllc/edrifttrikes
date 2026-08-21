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
  const response = await googleRequest(query, country);
  if (response.error) console.error(`[address] google autocomplete — ${response.error}`);
  return parseGoogleSuggestions(response.data);
}

/** The autocomplete call itself, so the health probe runs the SAME request. */
async function googleRequest(query: string, country?: string | null): Promise<ProviderResult> {
  const body: Record<string, unknown> = {
    input: query,
    // The documented "address" collection: every address type, and nothing
    // else. Listing individual type names instead would put the exact spelling
    // of four constants between us and a working checkout, and a rejected
    // request looks identical to no matches from the buyer's side.
    includedPrimaryTypes: ["address"],
  };
  const region = isoCode(country);
  if (region) body.includedRegionCodes = [region.toLowerCase()];

  return fetchJson("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": googleKey() as string,
      // Ask for only the fields we use — Google bills by what you request.
      "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text",
    },
    body: JSON.stringify(body),
  });
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
  if (response.error) console.error(`[address] google place details — ${response.error}`);
  return parseGooglePlaceDetails(response.data);
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

  const streetNumber = part("street_number");
  const route = part("route");
  const building = part("premise") || part("subpremise");

  // A route with no number and no named building is a STREET, not a place a
  // parcel can be delivered to. Filling the form with "Pennsylvania Avenue NW"
  // gives the buyer an address that looks complete and is not — worse than
  // leaving them to type it, because they will not look twice at a field that
  // filled itself.
  if (route && !streetNumber && !building) return null;

  const street = [streetNumber, route].filter(Boolean).join(" ") || building;
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

  const response = await censusRequest(query);
  if (response.error) console.error(`[address] census geocoder — ${response.error}`);
  return parseCensusResponse(response.data);
}

/** The geocoder call itself, so the health probe runs the SAME request. */
function censusRequest(query: string): Promise<ProviderResult> {
  const url = new URL(CENSUS_URL);
  url.searchParams.set("address", query);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");
  return fetchJson(url.toString());
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

/** What a provider call actually did — the part a silent catch used to lose. */
type ProviderResult = {
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
  /** Short, safe description of why it failed. Never contains the API key. */
  error?: string;
};

/**
 * Fetch with a hard timeout, returning parsed JSON AND why it failed.
 *
 * The timeout is not optional: this runs inside a checkout request, and a
 * provider that hangs would hold a Worker open until the platform kills it.
 *
 * The reason is not optional either. The buyer must never see a provider error,
 * but swallowing it entirely left no way to tell a missing key from a malformed
 * request from a genuine no-match — which is exactly what you need to know when
 * the box is empty on a deployment you cannot attach a debugger to. See
 * probeAddressLookup and /api/health/address.
 */
async function fetchJson(url: string, init?: RequestInit): Promise<ProviderResult> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        ok: false,
        status: response.status,
        data: null,
        error: describeFailure(response.status, body),
      };
    }
    return {
      ok: true,
      status: response.status,
      data: (await response.json()) as Record<string, unknown>,
    };
  } catch (e) {
    const message = String((e as Error)?.name === "TimeoutError" ? "timed out" : (e as Error)?.message || e);
    return { ok: false, status: 0, data: null, error: `request failed: ${message}`.slice(0, 200) };
  }
}

/**
 * Turn a provider rejection into the action that fixes it.
 *
 * Deliberately does NOT pass the raw body through: a provider error is echoed
 * into a public health endpoint, and third-party error text is not something to
 * reflect unfiltered. Only the status and a recognised reason survive.
 */
function describeFailure(status: number, body: string): string {
  const b = body.toLowerCase();
  if (b.includes("api key not valid") || b.includes("api_key_invalid")) {
    return `${status}: the Google API key is not valid`;
  }
  if (b.includes("api key expired")) return `${status}: the Google API key has expired`;
  if (b.includes("permission_denied") || b.includes("has not been used") || b.includes("is disabled")) {
    return `${status}: the key is valid but the Places API (New) is not enabled for that project`;
  }
  if (b.includes("referer") || b.includes("referrer") || b.includes("ip address")) {
    return `${status}: the key has an application restriction that blocks server-side calls`;
  }
  if (b.includes("resource_exhausted") || status === 429) return `${status}: quota exhausted`;
  if (b.includes("invalid_argument") || status === 400) {
    return `${status}: the provider rejected the request as malformed`;
  }
  return `${status}: the provider rejected the request`;
}

/**
 * Run a real lookup against whatever provider is configured, and report what
 * happened — for /api/health/address.
 *
 * This exists because the sandbox this was written in cannot reach either
 * provider, so the only place the network path can be proven is the deployment
 * itself. Hitting one URL on the live site tells you which provider is active,
 * whether it answered, and if not, exactly why.
 */
export async function probeAddressLookup(query = "1600 Pennsylvania Ave NW, Washington, DC"): Promise<{
  provider: AddressProvider;
  configured: boolean;
  ok: boolean;
  suggestions: number;
  sample: string | null;
  error?: string;
  hint?: string;
}> {
  const provider = addressProvider();
  const configured = provider === "google" ? Boolean(googleKey()) : true;

  const result =
    provider === "google"
      ? await googleProbe(query)
      : await censusProbe(query);

  return {
    provider,
    configured,
    ok: result.suggestions.length > 0,
    suggestions: result.suggestions.length,
    sample: result.suggestions[0]?.label ?? null,
    ...(result.error ? { error: result.error } : {}),
    ...(result.suggestions.length === 0 && !result.error
      ? {
          hint:
            provider === "census"
              ? "The keyless US geocoder matches COMPLETE addresses, not partial ones, and only in the United States. Set GOOGLE_MAPS_API_KEY for worldwide type-ahead."
              : "The provider answered but matched nothing for this query.",
        }
      : {}),
  };
}

async function googleProbe(query: string) {
  const response = await googleRequest(query, "US");
  return {
    suggestions: parseGoogleSuggestions(response.data),
    error: response.error,
  };
}

async function censusProbe(query: string) {
  const response = await censusRequest(query);
  return {
    suggestions: parseCensusResponse(response.data),
    error: response.error,
  };
}
