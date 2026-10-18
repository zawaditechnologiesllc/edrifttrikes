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

/**
 * Countries this shop does not ship to.
 *
 * ═══ A DISCLAIMER IS NOT A CONTROL ═════════════════════════════════════════
 *
 * Saying "we do not ship to X" on a policy page and then letting somebody from
 * X complete a checkout produces an order that has to be refunded by hand,
 * after they have paid, which is a worse experience than never selling to them
 * — and on a card network it is a refund rate, which is a thing acquirers
 * watch. So this list is enforced in three places at once: the destination is
 * missing from the checkout picker, `isKnownCountry` rejects it so a typed or
 * autofilled value cannot slip through, and the shipping policy says so in
 * words.
 *
 * ⚠️ IT DOES NOT ERASE THEM FROM THE CODE LIST. Orders already placed to these
 * destinations still have to render in the admin, still need a delivery band
 * and still need a flag — so `countryName`, `countryCode` and the rest resolve
 * against the FULL list. Only the places that decide "can somebody buy this,
 * to here, now" consult the shippable one.
 */
export const NOT_SHIPPED_CODES = ["NG", "IN"] as const;

export function shipsTo(codeOrName: string | null | undefined): boolean {
  const v = String(codeOrName ?? "").trim().toLowerCase();
  if (!v) return false;
  return !allCountries().some(
    (c) =>
      (NOT_SHIPPED_CODES as readonly string[]).includes(c.code) &&
      (c.code.toLowerCase() === v || c.name.toLowerCase() === v)
  );
}

/** The excluded destinations, named, for the disclaimer that says so. */
export function notShippedNames(): string[] {
  return (NOT_SHIPPED_CODES as readonly string[])
    .map((code) => countryName(code) ?? code)
    .sort((a, b) => a.localeCompare(b));
}

export type Country = { code: string; name: string };

let cache: Country[] | null = null;
let shippableCache: Country[] | null = null;

/**
 * EVERY country, including the ones this shop will not ship to.
 *
 * For reading back what already exists: an order placed before a destination
 * was excluded still has to show a country name and a flag in the admin, and
 * still needs a delivery band. Nothing that decides whether a NEW order may be
 * placed should use this — use `countries()`.
 */
export function allCountries(): Country[] {
  if (cache) return cache;

  let display: Intl.DisplayNames | null = null;
  try {
    display = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    // Runtime without full ICU — fall back to the raw codes rather than
    // rendering an empty country select.
    display = null;
  }

  const all: Country[] = ISO_CODES.map((code) => ({
    code,
    name: (display?.of(code) ?? code) || code,
  }));

  const priority = PRIORITY_CODES.map((c) => all.find((x) => x.code === c)).filter(
    (c): c is Country => Boolean(c)
  );
  const rest = all
    .filter((c) => !PRIORITY_CODES.includes(c.code))
    .sort((a, b) => a.name.localeCompare(b.name));

  cache = [...priority, ...rest];
  return cache;
}

/**
 * The countries a buyer may choose: everywhere this shop ships.
 *
 * This is what the checkout picker renders and what validation checks against,
 * so an excluded destination is both unselectable and unsubmittable.
 */
export function countries(): Country[] {
  if (shippableCache) return shippableCache;
  shippableCache = allCountries().filter(
    (c) => !(NOT_SHIPPED_CODES as readonly string[]).includes(c.code)
  );
  return shippableCache;
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
 *
 * ⚠️ FALSE for an excluded destination, deliberately — this is the check that
 * stops a typed or autofilled "Nigeria" reaching a paid order that then has to
 * be refunded by hand.
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
  // The FULL list: an order already placed to an excluded destination still
  // needs a delivery band and still has to render.
  const hit = allCountries().find(
    (c) => c.code.toLowerCase() === v || c.name.toLowerCase() === v
  );
  return hit ? hit.code : null;
}

/**
 * A country's display name from its ISO code.
 *
 * Falls back to the code itself on a runtime without region data, so the admin
 * panel never renders an empty cell where a country should be.
 */
export function countryName(code: string | null | undefined): string | null {
  const c = String(code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(c) || c;
  } catch {
    return c;
  }
}

/**
 * The flag emoji for an ISO alpha-2 code, or null.
 *
 * Built from regional indicator symbols rather than a lookup table: 🇰🇪 is
 * literally "K" + "E" shifted into a different Unicode block, so every country
 * works for free and none can go missing. Used in the admin order list, where a
 * flag is read at a glance and a two-letter code is not.
 */
export function flagEmoji(code: string | null | undefined): string | null {
  const c = String(code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return null;
  const BASE = 0x1f1e6; // 🇦
  return String.fromCodePoint(
    BASE + (c.charCodeAt(0) - 65),
    BASE + (c.charCodeAt(1) - 65)
  );
}
