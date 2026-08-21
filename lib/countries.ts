import { parseBlockedCountries } from "@/lib/geo";

/**
 * Country list for the checkout address form.
 *
 * Stores ISO 3166-1 alpha-2 codes only and derives the display names at runtime
 * via `Intl.DisplayNames`, which every target runtime (browsers, Workers, Node)
 * ships. That keeps this file small and gives correctly spelled, up-to-date
 * names for free instead of a hand-maintained 250-line name table that drifts.
 *
 * The value SUBMITTED is the full country name, not the code — that's what
 * shipping labels and the admin order view want to read.
 */

// Sorted by code; the UI sorts by display name after resolving.
const ISO_CODES = [
  "AD","AE","AF","AG","AI","AL","AM","AO","AR","AT","AU","AW","AZ","BA","BB",
  "BD","BE","BF","BG","BH","BI","BJ","BM","BN","BO","BR","BS","BT","BW","BY",
  "BZ","CA","CD","CF","CG","CH","CI","CL","CM","CN","CO","CR","CU","CV","CW",
  "CY","CZ","DE","DJ","DK","DM","DO","DZ","EC","EE","EG","ER","ES","ET","FI",
  "FJ","FM","FO","FR","GA","GB","GD","GE","GF","GG","GH","GI","GL","GM","GN",
  "GP","GQ","GR","GT","GU","GW","GY","HK","HN","HR","HT","HU","ID","IE","IL",
  "IM","IN","IQ","IR","IS","IT","JE","JM","JO","JP","KE","KG","KH","KI","KM",
  "KN","KP","KR","KW","KY","KZ","LA","LB","LC","LI","LK","LR","LS","LT","LU",
  "LV","LY","MA","MC","MD","ME","MG","MH","MK","ML","MM","MN","MO","MQ","MR",
  "MT","MU","MV","MW","MX","MY","MZ","NA","NC","NE","NG","NI","NL","NO","NP",
  "NR","NZ","OM","PA","PE","PF","PG","PH","PK","PL","PR","PS","PT","PW","PY",
  "QA","RE","RO","RS","RU","RW","SA","SB","SC","SD","SE","SG","SI","SK","SL",
  "SM","SN","SO","SR","SS","ST","SV","SX","SY","SZ","TC","TD","TG","TH","TJ",
  "TL","TM","TN","TO","TR","TT","TV","TW","TZ","UA","UG","US","UY","UZ","VA",
  "VC","VE","VG","VI","VN","VU","WS","XK","YE","ZA","ZM","ZW",
] as const;

/** Shown at the top of the select — the store's main markets. */
const PRIORITY_CODES = ["US", "CA", "GB", "AU", "NZ", "IE"];

export type Country = { code: string; name: string };

let cache: Country[] | null = null;

/**
 * Every country we ship to, display-name sorted, main markets first.
 * Computed once — the list never changes within a process.
 *
 * Blocked countries are removed here rather than filtered at each call site,
 * which means the checkout select cannot offer one AND validateShippingField
 * rejects one automatically: isKnownCountry reads this same list. A VPN cannot
 * get around it, because it is about where the goods are going, not where the
 * browser is.
 */
export function countries(): Country[] {
  if (cache) return cache;
  // In the browser, take the list the server injected (PublicEnvScript) so both
  // sides render the SAME select; BLOCKED_COUNTRIES is not a NEXT_PUBLIC_ var,
  // so process.env would be empty here and the two would disagree.
  //
  // The injection only carries a live value on DYNAMICALLY rendered pages, but
  // the select exists on exactly one page — /checkout — and that page is
  // dynamic. `null` (never configured) falls through to the default list.
  const injected =
    typeof window !== "undefined" ? window.__EDRIFT_ENV?.BLOCKED_COUNTRIES : undefined;
  const blocked = parseBlockedCountries(
    injected !== undefined
      ? injected
      : typeof process !== "undefined"
        ? process.env.BLOCKED_COUNTRIES
        : undefined
  );

  let display: Intl.DisplayNames | null = null;
  try {
    display = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    // Runtime without full ICU — fall back to the raw codes rather than
    // rendering an empty country select.
    display = null;
  }

  const all: Country[] = ISO_CODES.filter((code) => !blocked.includes(code)).map(
    (code) => ({
      code,
      name: (display?.of(code) ?? code) || code,
    })
  );

  const priority = PRIORITY_CODES.map((c) => all.find((x) => x.code === c)).filter(
    (c): c is Country => Boolean(c)
  );
  const rest = all
    .filter((c) => !PRIORITY_CODES.includes(c.code))
    .sort((a, b) => a.name.localeCompare(b.name));

  cache = [...priority, ...rest];
  return cache;
}

/** Names only — what the form submits and what validation checks against. */
export function countryNames(): string[] {
  return countries().map((c) => c.name);
}

/**
 * True when `value` names a country we ship to.
 *
 * Case- and space-insensitive, and accepts a bare ISO code too, so an
 * autofilled "us" or "United States " still passes instead of blocking a
 * legitimate order on formatting.
 */
export function isKnownCountry(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return false;
  return countries().some(
    (c) => c.name.toLowerCase() === v || c.code.toLowerCase() === v
  );
}

/** Canonical country name for a user-supplied name or code, or null. */
export function normalizeCountry(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  const hit = countries().find(
    (c) => c.name.toLowerCase() === v || c.code.toLowerCase() === v
  );
  return hit ? hit.name : null;
}

/**
 * ISO alpha-2 code for a user-supplied name or code, or null.
 *
 * The mirror of normalizeCountry: the checkout form submits a code while an
 * order row stores the display name, so anything reasoning about WHERE an order
 * is going (delivery windows, shipping zones) needs to get back to the code
 * from either one.
 */
export function countryCode(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  const hit = countries().find(
    (c) => c.code.toLowerCase() === v || c.name.toLowerCase() === v
  );
  return hit ? hit.code : null;
}
