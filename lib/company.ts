/**
 * Central company + legal details used across the policy pages.
 *
 * ⚠️ BEFORE RELYING ON THE POLICY PAGES IN PRODUCTION:
 *  - These policies are a strong starting template, NOT legal advice. Have a
 *    qualified attorney review them, especially because you sell worldwide —
 *    mandatory consumer-protection laws (EU/UK/Australia and others) and card
 *    network rules can override contract terms, and some clauses below are not
 *    enforceable everywhere.
 *  - Fill in every value marked TODO with your real registered details.
 */
export const COMPANY = {
  name: "E-Drift Trikes & Go Carts",
  // TODO: confirm the exact registered legal entity name (e.g. "Zawadi Technologies LLC").
  legalName: "E-Drift Trikes & Go Carts",
  supportEmail: "support@edrifttrikes.shop",
  /**
   * The canonical storefront URL. Used where a link has to be absolute and no
   * request is in hand — the PDF product sheets, for instance. NEXT_PUBLIC_SITE_URL
   * takes precedence wherever it is set; this is the fallback.
   */
  siteUrl: "https://edrifttrikes.shop",
  // TODO: set your real registered business address.
  address: "[Registered business address — update in lib/company.ts]",
  // TODO: set the governing-law jurisdiction your lawyer advises (state / country).
  governingLaw: "[governing-law jurisdiction — update in lib/company.ts]",
  // Days a customer must allow support to resolve an issue before disputing a charge.
  disputeWindowDays: 7,
  // How long, in days, returns are accepted after delivery.
  returnWindowDays: 30,
  /**
   * Working days we tell a customer to allow for a refund to reach their bank.
   * Refunds are issued by hand, so this is a real commitment, not a gateway
   * estimate — the refund email quotes it, and so does the returns policy.
   */
  refundProcessingDays: 7,
  lastUpdated: "July 21, 2026",
} as const;

import type { SiteSettings } from "@/lib/types";

/**
 * Placeholder footer contact info, shown until the admin saves real values in
 * /admin/settings (stored in the `site_settings` table). Kept here — not in
 * lib/db.ts — so client components can import it without pulling server code.
 */
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  id: 1,
  company_email: "hello@edrifttrikes.shop",
  company_phone: "+1 (555) 010-0000",
  address_line1: "100 Drift Lane",
  address_line2: "Los Angeles, CA 90001, USA",
  shipping_cents: 5000,
  free_shipping: false,
  tax_rate_bps: 800,
  logo_url: null,
};
