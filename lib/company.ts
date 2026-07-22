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
  supportEmail: "support@edrifttrikes.com",
  // TODO: set your real registered business address.
  address: "[Registered business address — update in lib/company.ts]",
  // TODO: set the governing-law jurisdiction your lawyer advises (state / country).
  governingLaw: "[governing-law jurisdiction — update in lib/company.ts]",
  // Days a customer must allow support to resolve an issue before disputing a charge.
  disputeWindowDays: 7,
  // How long, in days, returns are accepted after delivery.
  returnWindowDays: 30,
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
  company_email: "hello@edrifttrikes.com",
  company_phone: "+1 (555) 010-0000",
  address_line1: "100 Drift Lane",
  address_line2: "Los Angeles, CA 90001, USA",
};
