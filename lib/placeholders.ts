/**
 * Telling a real business detail from a shipped placeholder.
 *
 * ═══ WHY THIS IS ITS OWN MODULE ════════════════════════════════════════════
 *
 * Because the rule was only half-applied, and the half that was missing is the
 * half the world reads.
 *
 * The structured data (lib/seo.ts) and the invoices (lib/invoice.ts) were
 * careful: they check every value and omit anything that is still a
 * placeholder, on the stated principle that a missing detail scores better
 * than a fake one. The FOOTER did not check at all — so while the machine-
 * readable schema stayed clean, every page of the site published a +1 (555)
 * number, a made-up street address and a generic mailbox to anyone looking.
 *
 * That combination — a young domain on a cheap TLD, with contact details that
 * do not resolve to anything — is close to the textbook fingerprint of a scam
 * storefront, and it is the fingerprint that automated reputation feeds score.
 * Those feeds are what ISP and corporate filters subscribe to.
 *
 * So the rule lives here, with no dependencies, and both the server and the
 * browser use the same one.
 */

/**
 * Values that ship with the project and mean "nobody has filled this in".
 *
 * `+1 (555) 01xx` is not merely unused: 555-0100 through 555-0199 is the range
 * reserved for fiction. Any checker recognises it on sight, which is precisely
 * why publishing one is worse than publishing nothing.
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

/** The value if it is real, otherwise nothing. For rendering. */
export function realOrNull(value: string | null | undefined): string | null {
  return isReal(value) ? String(value).trim() : null;
}

/**
 * The example contact details this project used to ship as *live* defaults.
 *
 * They are examples now, and nothing more: the grey hint text in Admin →
 * Settings, and the fixture the tests use to prove that none of it can reach a
 * customer. `DEFAULT_SITE_SETTINGS` holds nulls instead, so a shop that has
 * filled nothing in shows nothing rather than inventing a place of business.
 *
 * ⚠️ NEVER RENDER THESE. Every one of them is matched by `isReal` above.
 */
export const EXAMPLE_CONTACT = {
  company_email: "hello@edrifttrikes.shop",
  company_phone: "+1 (555) 010-0000",
  address_line1: "100 Drift Lane",
  address_line2: "Los Angeles, CA 90001, USA",
} as const;
