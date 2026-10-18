import { REGIONS, type Region, type RegionKey } from "@/lib/regions";

/**
 * Noticing that a visitor is on the wrong storefront, and offering the right
 * one.
 *
 * ═══ WHY THIS OFFERS AND NEVER REDIRECTS ═══════════════════════════════════
 *
 * Because the links are the point. The whole reason the regional subdomains
 * exist is that each team hands theirs out — on Instagram, in a bio, in a
 * message. A geo-redirect breaks every one of those: the UAE team's link
 * stops landing on the UAE storefront for anyone travelling, anyone on a VPN,
 * and anyone the edge guesses wrong about. It also breaks the shop's own
 * canonical URLs for a search engine, which follows links from everywhere.
 *
 * And the guess IS sometimes wrong. A country is inferred from an IP address:
 * corporate VPNs, satellite links, roaming SIMs and privacy relays all move
 * people somewhere they are not. That is a fine basis for a suggestion and a
 * terrible basis for a decision, so this produces a line of text with a link
 * in it, and the visitor stays exactly where they chose to be.
 */

/** Where each country's buyers are best served. Null means no strong match. */
export type Suggestion = { region: Region; countryCode: string } | null;

/** The United States, and the territories its distributor covers. */
const USA = new Set(["US", "PR", "VI", "GU", "AS", "MP"]);

const CANADA = new Set(["CA"]);

/**
 * The Gulf, because the UAE storefront says it covers the Gulf.
 *
 * The six GCC states. Not "the Middle East": Lebanon and Jordan are not served
 * by that distributor, and suggesting otherwise would be a promise nobody
 * made.
 */
const GULF = new Set(["AE", "SA", "KW", "QA", "BH", "OM"]);

/**
 * Europe, geographically — wider than the EU on purpose.
 *
 * ⚠️ THIS IS NOT A LEGAL CLASSIFICATION. The Europe storefront is a
 * presentation: a distributor, a currency to think in, and a link to the
 * consumer-rights page. A buyer in Switzerland or Norway wants all three, and
 * none of it claims they are in the EU. The rights page states its own scope
 * in its first sentence ("the European Union, the European Economic Area or
 * the United Kingdom"), so a visitor outside that reads a conditional, not a
 * claim about them — see lib/compliance.ts for why that distinction is kept
 * carefully everywhere.
 */
const EUROPE = new Set([
  // EU 27
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE",
  // EEA and the UK
  "IS", "LI", "NO", "GB",
  // The rest of geographic Europe, including the microstates and the
  // dependencies that buy through it
  "CH", "AD", "MC", "SM", "VA", "AL", "BA", "ME", "MK", "RS", "XK", "MD",
  "UA", "BY", "GI", "FO", "GG", "JE", "IM",
]);

const BY_COUNTRY: [Set<string>, RegionKey][] = [
  [USA, "usa"],
  [CANADA, "canada"],
  [GULF, "uae"],
  [EUROPE, "europe"],
];

/**
 * Which storefront serves this country, or the worldwide one.
 *
 * Returns null for an unknown or missing country rather than guessing — "no
 * signal" and "nowhere in particular" are different answers, and only the
 * second should ever produce a suggestion.
 */
export function regionForCountry(code: string | null | undefined): Region | null {
  const c = String(code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return null;
  // T1 is Tor, XX is "unknown" — both are the edge saying it does not know.
  if (c === "XX" || c === "T1") return null;
  for (const [set, key] of BY_COUNTRY) {
    if (set.has(c)) return REGIONS[key];
  }
  return REGIONS.global;
}

/**
 * Should this visitor be told about a different storefront?
 *
 * ⚠️ RETURNS NULL FAR MORE OFTEN THAN IT RETURNS A SUGGESTION, and that is the
 * design. A banner that appears when it is not needed is worse than no banner:
 * it trains people to dismiss the strip without reading it, which is exactly
 * where the shipping and currency notices live.
 *
 * It stays quiet when:
 *   - the edge gave no country, or one it could not resolve;
 *   - the visitor is already on the storefront for their country;
 *   - they are on the apex or the worldwide storefront AND their country has
 *     no regional home — the worldwide shop is already the right answer.
 */
export function switchSuggestion(
  current: Region,
  country: string | null | undefined
): Suggestion {
  const code = String(country ?? "").trim().toUpperCase();
  const target = regionForCountry(code);
  if (!target) return null;
  if (target.key === current.key) return null;
  return { region: target, countryCode: code };
}

/**
 * The same page, on the other storefront.
 *
 * ⚠️ KEEPS THE PATH. Somebody reading a product page who is offered a better
 * storefront should arrive at THAT PRODUCT, not at a homepage they then have
 * to navigate back from — the offer is supposed to save them work, and losing
 * their place costs more than the currency line gains.
 *
 * The query string and hash are dropped deliberately: they carry a filter or a
 * campaign tag from the storefront being left, and neither is guaranteed to
 * mean the same thing on the one being joined.
 */
export function switchUrl(target: Region, path: string, apex = "edrifttrikes.shop"): string {
  const clean = String(path ?? "/").split("?")[0].split("#")[0] || "/";
  const withSlash = clean.startsWith("/") ? clean : `/${clean}`;
  const host = target.subdomain ? `${target.subdomain}.${apex}` : apex;
  return `https://${host}${withSlash}`;
}
