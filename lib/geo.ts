/**
 * Countries the store does not serve.
 *
 * WHY THIS EXISTS: a run of stolen-card attempts from a handful of countries.
 * The store carries the chargeback on every one of those, so refusing the
 * business is a commercial decision about fraud loss, not a judgement about
 * anyone. It is the same control a payment processor offers in its own
 * dashboard, applied one layer earlier.
 *
 * BLOCKED IN THREE PLACES, deliberately, because each catches what the others
 * cannot:
 *
 *   1. middleware.ts — page requests, by the IP's country. Stops casual
 *      traffic. Trivially defeated by a VPN, so it is a filter, not a wall.
 *   2. lib/countries.ts — the checkout country list. A blocked country is not
 *      a shipping destination the form will accept, which a VPN cannot change,
 *      because it is about where the goods go rather than where the browser is.
 *   3. app/api/checkout — the same rule server-side, so a crafted request that
 *      never touched the form is refused too.
 *
 * ⚠️ NONE OF THIS STOPS A STOLEN CARD. It stops a stolen card being used from
 * one of these countries to ship to one of these countries. A carder on a VPN,
 * shipping to a mule address elsewhere, walks straight through — the control
 * that actually catches that is at the payment layer (Stripe Radar: block
 * mismatched issuing country, require CVC and postal-code match). See
 * docs/PAYMENTS.md.
 *
 * DEPENDENCY-FREE so middleware, the checkout API and the country list can all
 * read the same definition.
 */

/** ISO alpha-2 codes refused by default. Override with BLOCKED_COUNTRIES. */
export const DEFAULT_BLOCKED_COUNTRIES = ["IN", "PK", "BD"] as const;

/**
 * Parse the configured list.
 *
 * Read from a Worker variable rather than hard-coded alone, because a fraud
 * list that needs a pull request to change is a fraud list that does not get
 * changed. An empty string is a deliberate "block nothing" — distinct from the
 * variable being absent, which falls back to the default.
 */
export function parseBlockedCountries(raw?: string | null): string[] {
  if (raw === undefined || raw === null) return [...DEFAULT_BLOCKED_COUNTRIES];
  const codes = String(raw)
    .split(/[,\s]+/)
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
  // "" or a string of junk means block nothing; that has to be expressible.
  return [...new Set(codes)];
}

/** True when `country` (ISO alpha-2, any case) is on the list. */
export function isBlockedCountry(
  country: string | null | undefined,
  blocked: readonly string[]
): boolean {
  const code = String(country ?? "").trim().toUpperCase();
  if (!code || code.length !== 2) return false;
  return blocked.includes(code);
}

/**
 * Paths the block must NEVER apply to.
 *
 * Everything here would break the store rather than protect it if a geo lookup
 * came back wrong, or if a legitimate service happened to route through a
 * blocked region:
 *
 *   - the page explaining the block (an infinite redirect otherwise)
 *   - payment webhooks and captures — money has already moved; refusing the
 *     callback would lose the order, not prevent it
 *   - the internal + cron endpoints that drive fulfilment
 *   - health checks, which exist to be reachable when things are wrong
 *   - static assets, which are served before the Worker anyway
 */
export function isExemptPath(pathname: string): boolean {
  const path = String(pathname ?? "");
  return (
    path === "/unavailable" ||
    path.startsWith("/api/internal") ||
    path.startsWith("/api/cron") ||
    path.startsWith("/api/paypal") ||
    path.startsWith("/api/health") ||
    path.startsWith("/_next") ||
    path.startsWith("/assets") ||
    path === "/favicon.ico" ||
    path === "/icon.svg" ||
    path === "/robots.txt" ||
    path === "/sitemap.xml"
  );
}

/**
 * The header Cloudflare puts the visitor's country in.
 *
 * `XX` is what it uses for an unknown or reserved address, and must never be
 * treated as a country — an unknown visitor is served, not refused.
 */
/**
 * What a refused request is told.
 *
 * One string, because the middleware and the checkout API both say it and a
 * buyer who somehow sees both must not get two different explanations. It names
 * no country and accuses nobody: the person reading it is overwhelmingly likely
 * to be an ordinary customer.
 */
export const BLOCKED_MESSAGE =
  "We're not able to take orders from your location.";

/**
 * True for a request that expects JSON back.
 *
 * A rewrite to the /unavailable PAGE is right for a browser and wrong for an
 * API call: the page has no POST handler, so a refused checkout would come back
 * as 405 Method Not Allowed with an HTML body, and the form would report a bug
 * that isn't one. API paths get a JSON 403 instead.
 */
export function isApiPath(pathname: string): boolean {
  return String(pathname ?? "").startsWith("/api/");
}

export const COUNTRY_HEADER = "cf-ipcountry";

export function countryFromHeaders(headers: {
  get(name: string): string | null;
}): string | null {
  const raw = headers.get(COUNTRY_HEADER) ?? headers.get("x-vercel-ip-country");
  const code = String(raw ?? "").trim().toUpperCase();
  if (!code || code === "XX" || code === "T1" || code.length !== 2) return null;
  return code;
}
