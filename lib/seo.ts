import { COMPANY } from "@/lib/company";
import type { Product, SiteSettings } from "@/lib/types";

/**
 * Structured data — the mechanism by which a search engine decides that a
 * business is a real entity rather than a domain that appeared last month.
 *
 * ═══ THE ONE RULE ═══════════════════════════════════════════════════════════
 *
 * EVERYTHING HERE MUST BE TRUE AND CHECKABLE.
 *
 * There is no aggregateRating in this file and there must never be one until
 * the store has real reviews from a real review platform. Ratings markup with
 * no reviews behind it is the single most common cause of a Google manual
 * action for structured-data spam, and the penalty is losing rich results
 * across the whole domain — the opposite of what a new store needs.
 *
 * The same goes for the business details: a placeholder address published as
 * schema.org PostalAddress is worse than publishing none, because a
 * legitimacy scanner that checks the address and finds nothing marks the site
 * DOWN. isReal() below is what stops that happening by accident.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHAT ACTUALLY MOVES A LEGITIMACY SCORE, in rough order:
 *   1. Verifiable contact details that resolve — a real address, a phone number
 *      that answers, an email on the domain.
 *   2. Domain age and a public WHOIS that is not hidden behind privacy.
 *   3. Real reviews on a platform the scanners read (Trustpilot, Google).
 *   4. A consistent entity: same name, address and phone in the markup, the
 *      footer, the policies and the business listings.
 *   5. Working policy pages — returns, shipping, contact.
 *
 * This file does (4) and (5), and refuses to fake (1) or (3).
 */

/**
 * Values shipped as defaults or left as TODOs. Publishing one of these as fact
 * is worse than publishing nothing, so they are treated as absent.
 */
const PLACEHOLDERS = [
  "[registered business address",
  "[governing-law jurisdiction",
  "100 drift lane",
  "los angeles, ca 90001",
  "+1 (555)",
  "555-01",
  "update in lib/company.ts",
  "hello@edrifttrikes.shop",
  "example.com",
];

/** True when a value is present AND is not one of the shipped placeholders. */
export function isReal(value: string | null | undefined): boolean {
  const v = String(value ?? "").trim();
  if (v.length < 2) return false;
  const lower = v.toLowerCase();
  return !PLACEHOLDERS.some((p) => lower.includes(p));
}

/** Drop null/undefined/empty keys — schema.org would rather have no key. */
function compact<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

/** Canonical site URL, without a trailing slash. */
export function siteUrl(base?: string | null): string {
  return String(base || COMPANY.siteUrl).replace(/\/+$/, "");
}

/**
 * The business itself.
 *
 * `OnlineStore` rather than a bare `Organization`: it is the more specific type
 * for a shop that sells direct, and specificity is what lets a search engine
 * connect the site to an entity instead of guessing.
 *
 * Contact details come from the settings the admin edits, so the markup and the
 * footer can never disagree — an inconsistent NAP (name, address, phone) across
 * a site is one of the things a scanner explicitly scores down.
 */
export function organizationSchema(
  settings: SiteSettings | null | undefined,
  base?: string | null
): Record<string, unknown> {
  const url = siteUrl(base);
  const street = settings?.address_line1;
  const locality = settings?.address_line2;

  const address =
    isReal(street) || isReal(locality)
      ? compact({
          "@type": "PostalAddress",
          streetAddress: isReal(street) ? street : null,
          // address_line2 is a free-text "city, region, country" line in this
          // store's settings, so it goes in as one field rather than being
          // split on guesswork.
          addressLocality: isReal(locality) ? locality : null,
        })
      : null;

  return compact({
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": `${url}/#organization`,
    name: COMPANY.name,
    legalName: isReal(COMPANY.legalName) ? COMPANY.legalName : null,
    url,
    logo: isReal(settings?.logo_url) ? settings?.logo_url : `${url}/icon.svg`,
    email: isReal(settings?.company_email) ? settings?.company_email : COMPANY.supportEmail,
    telephone: isReal(settings?.company_phone) ? settings?.company_phone : null,
    address,
    // Named because it is true and because a scanner comparing the site's claim
    // against its hosting and registration data expects to find it stated.
    areaServed: "Worldwide",
    contactPoint: compact({
      "@type": "ContactPoint",
      contactType: "customer support",
      email: isReal(settings?.company_email) ? settings?.company_email : COMPANY.supportEmail,
      telephone: isReal(settings?.company_phone) ? settings?.company_phone : null,
      availableLanguage: "English",
    }),
  });
}

/** The site, so the search box and the name resolve to one thing. */
export function websiteSchema(base?: string | null): Record<string, unknown> {
  const url = siteUrl(base);
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${url}/#website`,
    name: COMPANY.name,
    url,
    publisher: { "@id": `${url}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${url}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** First paragraph of a description, bounded — a snippet, not the whole sheet. */
function descriptionSummary(description: string | null | undefined): string | undefined {
  const text = String(description ?? "").trim();
  if (!text) return undefined;
  const first = text.split(/\n\s*\n/)[0].replace(/\s+/g, " ").trim();
  return first ? first.slice(0, 300) : undefined;
}

/**
 * One product, with its real price and real availability.
 *
 * NO aggregateRating and NO review. Both are permitted by schema.org and both
 * are a manual action waiting to happen on a shop that has neither. When real
 * reviews exist, they get added from the review data — not invented here.
 */
export function productSchema(
  product: Product,
  opts: { base?: string | null; colors?: string[] } = {}
): Record<string, unknown> {
  const url = siteUrl(opts.base);
  const price = (product.price_cents ?? 0) / 100;

  return compact({
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    // The tagline first: it is the one-line summary a search result wants,
    // where the description is the full sheet.
    description: product.tagline || descriptionSummary(product.description),
    image: product.hero_image ? [product.hero_image] : undefined,
    sku: product.slug,
    color: opts.colors && opts.colors.length > 0 ? opts.colors : undefined,
    brand: { "@type": "Brand", name: COMPANY.name },
    offers: compact({
      "@type": "Offer",
      url: `${url}/product/${product.slug}`,
      priceCurrency: "USD",
      price: price.toFixed(2),
      // Truthful, and read directly off the stock the store actually has.
      availability:
        (product.stock ?? 0) > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": `${url}/#organization` },
    }),
  });
}

/**
 * What is still missing before this store looks established to a scanner.
 *
 * Surfaced in the admin rather than buried in a doc, because these are the
 * things that actually decide the score and every one of them is a five-minute
 * job for the owner and impossible for anyone else.
 */
export type TrustGap = { key: string; label: string; why: string; done: boolean };

export function trustGaps(settings: SiteSettings | null | undefined): TrustGap[] {
  return [
    {
      key: "address",
      label: "A real postal address",
      why: "Scanners look one up and score the site down when it resolves to nothing. A placeholder is worse than blank.",
      done: isReal(settings?.address_line1) && isReal(settings?.address_line2),
    },
    {
      key: "phone",
      label: "A phone number that answers",
      why: "A +1 (555) number is a fictional-number range. Any checker recognises it on sight.",
      done: isReal(settings?.company_phone),
    },
    {
      key: "email",
      label: "A contact email on your own domain",
      why: "A free-mail address on a shop is one of the strongest negative signals there is.",
      done: isReal(settings?.company_email),
    },
    {
      key: "legalName",
      label: "The registered legal entity name",
      why: "It has to match your company registration and your payment processor, or the three disagree.",
      done: isReal(COMPANY.legalName) && COMPANY.legalName !== COMPANY.name,
    },
    {
      key: "governingLaw",
      label: "A governing-law jurisdiction in the policies",
      why: "Terms with a bracketed placeholder read as a template nobody has finished.",
      done: isReal(COMPANY.governingLaw),
    },
  ];
}
