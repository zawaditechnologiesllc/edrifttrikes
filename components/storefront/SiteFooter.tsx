"use client";

import Link from "next/link";
import NewsletterForm from "./NewsletterForm";
import { useSiteSettings } from "./SiteSettingsProvider";
import { Icon } from "@/components/Icon";

export default function SiteFooter() {
  const settings = useSiteSettings();
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
            direct to riders in every country — no middlemen, no markups.
          </p>
          <NewsletterForm />
        </div>
        <div className="space-y-4">
          <h4 className="font-label-bold text-label-bold text-white uppercase tracking-widest">
            Shop
          </h4>
          <nav className="flex flex-col gap-2">
            <Link href="/shop?category=trikes" className="text-on-surface-variant hover:text-primary transition-colors">Trikes</Link>
            <Link href="/shop?category=parts" className="text-on-surface-variant hover:text-primary transition-colors">Parts</Link>
            <Link href="/shop?category=gear" className="text-on-surface-variant hover:text-primary transition-colors">Gear</Link>
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
          </nav>
        </div>
        <div className="space-y-4">
          <h4 className="font-label-bold text-label-bold text-white uppercase tracking-widest">
            Contact
          </h4>
          <div className="flex flex-col gap-3 text-on-surface-variant">
            {settings.company_email && (
              <a href={`mailto:${settings.company_email}`} className="flex items-start gap-2 hover:text-primary transition-colors break-all">
                <Icon name="mail" className="w-4 h-4 mt-1 shrink-0" />
                <span>{settings.company_email}</span>
              </a>
            )}
            {settings.company_phone && (
              <a href={`tel:${settings.company_phone.replace(/[^+\d]/g, "")}`} className="flex items-start gap-2 hover:text-primary transition-colors">
                <Icon name="call" className="w-4 h-4 mt-1 shrink-0" />
                <span>{settings.company_phone}</span>
              </a>
            )}
            {(settings.address_line1 || settings.address_line2) && (
              <span className="flex items-start gap-2">
                <Icon name="location_on" className="w-4 h-4 mt-1 shrink-0" />
                <span>
                  {settings.address_line1}
                  {settings.address_line1 && settings.address_line2 && <br />}
                  {settings.address_line2}
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
