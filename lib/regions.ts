import { currencyNoteFor, type DisplayCurrency } from "@/lib/currency";

/**
 * The regional storefronts: usa, canada, uae, europe and global, on subdomains
 * of the main site.
 *
 * ═══ WHAT A SUBDOMAIN IS AND IS NOT ════════════════════════════════════════
 *
 * It is one catalogue, one database, one checkout, presented with the facts
 * that are true for a buyer in that region: which distributor serves them,
 * what delivery actually takes, which consumer-protection regime they buy
 * under, and which legal annex applies.
 *
 * It is NOT four websites. Four hostnames serving identical pages is how a
 * shop teaches a search engine that three quarters of its pages are
 * duplicates — and, at worst, how it acquires a doorway-site reputation,
 * which is the kind of signal that gets a domain filtered. Every shared page
 * therefore points its canonical at the apex, so the regional hostnames add
 * reach without splitting the site against itself. Only the region's own
 * landing page is canonical to itself, because only it is genuinely different.
 *
 * ⚠️ A REGION IS A PRESENTATION, NOT A JURISDICTION CLAIM. Serving europe.
 * does not place this business, its servers or its data in the EU, and nothing
 * here should ever be written as though it did. Where the law attaches to
 * where the BUYER is — the EU/EEA withdrawal right, the legal guarantee — it
 * attaches wherever they bought from, apex or subdomain alike. See
 * lib/compliance.ts.
 */

export const REGION_KEYS = ["global", "usa", "canada", "uae", "europe"] as const;
export type RegionKey = (typeof REGION_KEYS)[number];

export type Region = {
  key: RegionKey;
  /** The subdomain label, or null for the apex. */
  subdomain: string | null;
  label: string;
  /** One line under the hero, naming who this storefront is for. */
  blurb: string;
  /**
   * The currency this storefront QUOTES in.
   *
   * ⚠️ Not what it charges. Every payment settles in US dollars — see
   * lib/currency.ts for why that distinction is load-bearing rather than
   * pedantic. A region whose currency is USD shows one price and no note.
   */
  currency: DisplayCurrency;
  /**
   * True where EU/EEA consumer law attaches — the 14-day withdrawal right, the
   * two-year legal guarantee, GPSR. Drives which legal annex is shown.
   */
  euConsumerLaw: boolean;
  /** Consumer-protection regimes worth naming to a buyer here. */
  regimes: string[];
};

export const REGIONS: Record<RegionKey, Region> = {
  /*
   * The worldwide storefront, reachable at BOTH the apex and global.
   *
   * `global.edrifttrikes.shop` is an alias, not a fifth catalogue: same
   * products, same prices, same policies, canonicalising to the apex. It
   * exists so "global" sits beside "usa" and "europe" in anything that lists
   * the storefronts, rather than being the odd one out with no address.
   */
  global: {
    key: "global",
    subdomain: "global",
    label: "Worldwide",
    blurb: "Factory-direct to riders in every country we ship to.",
    currency: "USD",
    euConsumerLaw: false,
    regimes: [],
  },
  usa: {
    key: "usa",
    subdomain: "usa",
    label: "United States",
    blurb: "Served by our United States distributor.",
    currency: "USD",
    euConsumerLaw: false,
    regimes: ["US state consumer-protection law", "FTC mail-order rules"],
  },
  canada: {
    key: "canada",
    subdomain: "canada",
    label: "Canada",
    blurb: "Served by our Canadian distributor.",
    currency: "CAD",
    euConsumerLaw: false,
    regimes: ["Provincial consumer-protection law"],
  },
  uae: {
    key: "uae",
    subdomain: "uae",
    label: "United Arab Emirates",
    blurb: "Served by our UAE distributor, covering the Gulf.",
    currency: "AED",
    euConsumerLaw: false,
    regimes: ["UAE Consumer Protection Law (Federal Law No. 15 of 2020)"],
  },
  europe: {
    key: "europe",
    subdomain: "europe",
    label: "Europe",
    blurb: "Served by our European distributor.",
    currency: "EUR",
    euConsumerLaw: true,
    regimes: [
      "EU Consumer Rights Directive 2011/83/EU",
      "EU legal guarantee of conformity (Directive (EU) 2019/771)",
      "EU General Product Safety Regulation (EU) 2023/988",
      "GDPR (Regulation (EU) 2016/679)",
    ],
  },
};

/** Every region that has a subdomain, in the order they are listed to a buyer. */
export const REGIONAL_SITES: Region[] = [
  REGIONS.usa,
  REGIONS.canada,
  REGIONS.uae,
  REGIONS.europe,
  REGIONS.global,
];

/**
 * The sentence shown under this storefront's prices.
 *
 * Derived rather than stored, so a currency whose rate has gone stale silently
 * stops promising a conversion it is no longer making — the note and the
 * number come from the same check.
 */
export function currencyNote(region: Region, now: Date = new Date()): string {
  return currencyNoteFor(region.currency, now);
}

/**
 * Which storefront is this request on?
 *
 * Reads only the leftmost label, and only when the rest of the host matches a
 * site we serve — so `europe.edrifttrikes.shop` is the Europe storefront while
 * `europe.edrifttrikes.shop.evil.test` is not anything. Host headers are
 * attacker-controlled; this one decides which legal annex a buyer is shown, so
 * it refuses anything it does not recognise rather than guessing.
 */
export function regionFromHost(host: string | null | undefined): Region {
  const raw = String(host ?? "")
    .trim()
    .toLowerCase()
    .split(",")[0]            // a proxy may append; the first is the request's
    .replace(/:\d+$/, "")     // drop the port
    .replace(/\.$/, "");      // and a fully-qualified trailing dot
  if (!raw) return REGIONS.global;

  const labels = raw.split(".");
  if (labels.length < 2) return REGIONS.global;

  const candidate = labels[0];
  const hit = REGIONAL_SITES.find((r) => r.subdomain === candidate);
  if (!hit) return REGIONS.global;

  /*
   * The remainder has to be a host this site actually answers on. Without this
   * check any domain ending in our name — or a local hostname — would select a
   * region, and with it a different set of legal statements.
   */
  const rest = labels.slice(1).join(".");
  return isKnownApex(rest) ? hit : REGIONS.global;
}

/** The apex hosts the regional subdomains may sit under. */
const APEX_HOSTS = ["edrifttrikes.shop", "www.edrifttrikes.shop"];

function isKnownApex(host: string): boolean {
  if (APEX_HOSTS.includes(host)) return true;
  // Local and preview hosts, so the regions can be exercised before release.
  if (host === "localhost" || host.startsWith("127.0.0.1")) return true;
  if (host.endsWith(".workers.dev") || host.endsWith(".pages.dev")) return true;
  return false;
}

/** The absolute home of a region's storefront. */
export function regionHome(region: Region, apex = "edrifttrikes.shop"): string {
  return region.subdomain
    ? `https://${region.subdomain}.${apex}`
    : `https://${apex}`;
}

/**
 * Where a page's canonical should point.
 *
 * The region landing page is its own canonical, because it is the one page
 * whose content is genuinely regional. EVERYTHING ELSE canonicalises to the
 * apex: the catalogue, the product pages and the policies are the same
 * documents whichever hostname served them, and saying so is what stops four
 * hostnames reading as three copies of a shop.
 */
export function canonicalFor(
  region: Region,
  path: string,
  apex = "edrifttrikes.shop"
): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  /*
   * global. is an ALIAS of the apex, so even its landing page canonicalises
   * away. Letting it self-canonicalise would tell a search engine that the
   * same worldwide storefront exists twice, which is precisely the duplicate
   * signal the rest of this file exists to avoid.
   */
  if (region.key !== "global" && region.subdomain && clean === "/") {
    return `${regionHome(region, apex)}/`;
  }
  return `https://${apex}${clean === "/" ? "/" : clean}`;
}
