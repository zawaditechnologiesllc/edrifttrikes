"use client";

import Link from "next/link";
import NewsletterForm from "./NewsletterForm";
import { useCategories, useSiteSettings } from "./SiteSettingsProvider";
import { categoryLinks } from "@/lib/categories";
import { realOrNull } from "@/lib/placeholders";
import { Icon } from "@/components/Icon";
import ShippingExclusions from "./ShippingExclusions";
import { COMPANY } from "@/lib/company";

export default function SiteFooter() {
  const settings = useSiteSettings();
  // Built from the real categories, never written down here: a hard-coded
  // footer link is a door to a category the admin has switched off.
  const ranges = categoryLinks(useCategories());

  /*
   * ⚠️ NEVER PUBLISH A PLACEHOLDER CONTACT DETAIL.
   *
   * These render on every page of the site, which makes them the first thing a
   * person — or a reputation scanner — checks. Until an admin saves real ones
   * this component was printing a +1 (555) number (the range reserved for
   * FICTION), a made-up street address and a generic mailbox.
   *
   * A young domain on a cheap TLD with contact details that resolve to nothing
   * is close to the textbook fingerprint of a scam storefront, and that
   * fingerprint is what the automated feeds behind ISP and corporate filters
   * score. The structured data and the invoices already dropped unfilled
   * values on exactly this reasoning; the footer simply never did.
   *
   * Showing nothing is not a loss. A missing line is neutral; a fictional one
   * is evidence against you.
   */
  const email = realOrNull(settings.company_email);
  const phone = realOrNull(settings.company_phone);
  const addressLine1 = realOrNull(settings.address_line1);
  const addressLine2 = realOrNull(settings.address_line2);

  return (
    <footer className="w-full bg-surface-container-lowest border-t border-secondary/20">
      <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12">
        <div className="space-y-5 lg:col-span-2 max-w-sm">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/edrift-logo.svg" alt="E-Drift Trikes" className="h-11 w-11" />
            <h2 className="font-headline-md text-headline-md tracking-tighter leading-none">
              <span className="text-secondary">E-DRIFT</span> <span className="text-white">TRIKES</span>
            </h2>
          </div>
          <p className="text-on-surface-variant font-body-md">
            A global electric drift-trike and go-cart manufacturer, selling
            direct to riders — no middlemen, no markups.
          </p>
          {/* Said on every page, because "worldwide" above needs its footnote. */}
          <ShippingExclusions className="text-xs" />
          <NewsletterForm />
        </div>
        <div className="space-y-4">
          <h4 className="font-label-bold text-label-bold text-white uppercase tracking-widest">
            Shop
          </h4>
          <nav className="flex flex-col gap-2">
            {ranges.map((c) => (
              <Link key={c.key} href={c.href} className="text-on-surface-variant hover:text-primary transition-colors">
                {c.label}
              </Link>
            ))}
            <Link href="/shop" className="text-on-surface-variant hover:text-primary transition-colors">All Rigs</Link>
            <Link href="/wishlist" className="text-on-surface-variant hover:text-primary transition-colors">Parts Bin</Link>
          </nav>
        </div>
        <div className="space-y-4">
          <h4 className="font-label-bold text-label-bold text-white uppercase tracking-widest">
            Company
          </h4>
          <nav className="flex flex-col gap-2">
            <Link href="/our-story" className="text-on-surface-variant hover:text-primary transition-colors">About Us</Link>
            <Link href="/tech-lab" className="text-on-surface-variant hover:text-primary transition-colors">The Tech Lab</Link>
            <Link href="/support" className="text-on-surface-variant hover:text-primary transition-colors">Support</Link>
          </nav>
        </div>
        <div className="space-y-4">
          <h4 className="font-label-bold text-label-bold text-white uppercase tracking-widest">
            Legal
          </h4>
          <nav className="flex flex-col gap-2">
            <Link href="/terms" className="text-on-surface-variant hover:text-primary transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="text-on-surface-variant hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href="/returns" className="text-on-surface-variant hover:text-primary transition-colors">Returns &amp; Refunds</Link>
            <Link href="/shipping-warranty" className="text-on-surface-variant hover:text-primary transition-colors">Shipping &amp; Warranty</Link>
            {/* Statutory rights, not our policy — see the page for why the two
                are kept apart. Linked everywhere, not only on europe., because
                the right attaches to where the BUYER is, not which hostname
                they happened to use. */}
            <Link href="/eu-consumer-rights" className="text-on-surface-variant hover:text-primary transition-colors">EU &amp; UK Consumer Rights</Link>
          </nav>
        </div>
        <div className="space-y-4">
          <h4 className="font-label-bold text-label-bold text-white uppercase tracking-widest">
            Contact
          </h4>
          <div className="flex flex-col gap-3 text-on-surface-variant">
            {/* The support address is always real — it is a constant, not a
                setting — so there is always one way to reach a human here. */}
            <a
              href={`mailto:${email ?? COMPANY.supportEmail}`}
              className="flex items-start gap-2 hover:text-primary transition-colors break-all"
            >
              <Icon name="mail" className="w-4 h-4 mt-1 shrink-0" />
              <span>{email ?? COMPANY.supportEmail}</span>
            </a>
            {phone && (
              <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="flex items-start gap-2 hover:text-primary transition-colors">
                <Icon name="call" className="w-4 h-4 mt-1 shrink-0" />
                <span>{phone}</span>
              </a>
            )}
            {(addressLine1 || addressLine2) && (
              <span className="flex items-start gap-2">
                <Icon name="location_on" className="w-4 h-4 mt-1 shrink-0" />
                <span>
                  {addressLine1}
                  {addressLine1 && addressLine2 && <br />}
                  {addressLine2}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-white/5">
        <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-6 flex flex-col md:flex-row justify-between items-center gap-3 text-on-surface-variant font-label-bold text-[10px] tracking-widest uppercase">
          <span>© {new Date().getFullYear()} E-Drift Trikes &amp; Go Carts. All rights reserved.</span>
          <span>Manufactured &amp; shipped worldwide</span>
        </div>
      </div>
    </footer>
  );
}
