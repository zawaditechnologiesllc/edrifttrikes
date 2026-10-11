"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { REGIONS, regionFromHost, type Region } from "@/lib/regions";

/**
 * The strip that tells a visitor which regional storefront they are on.
 *
 * ═══ WHY THIS READS THE HOSTNAME IN THE BROWSER ════════════════════════════
 *
 * Because the alternative costs more than it is worth. Reading the Host header
 * on the server means calling headers(), and calling headers() opts the page
 * out of static rendering — so every visit to the homepage would become an
 * origin render to decide the wording of one strip. At this shop's traffic
 * that is a bad trade.
 *
 * Nothing that MATTERS is decided here. The canonical URL is set server-side
 * in middleware, and the legal pages are the same documents on every hostname.
 * This is presentation: which distributor serves you, and a link to the rights
 * that attach where you are.
 *
 * Renders nothing on the apex, and nothing at all until mounted, so the
 * server-rendered HTML and the first client render agree.
 */
export default function RegionNotice() {
  const [region, setRegion] = useState<Region>(REGIONS.global);

  useEffect(() => {
    setRegion(regionFromHost(window.location.hostname));
  }, []);

  if (!region.subdomain) return null;

  return (
    <aside
      className="bg-surface-container border-b border-white/10"
      aria-label={`${region.label} storefront`}
    >
      <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-label-bold text-[11px] uppercase tracking-widest text-secondary">
          {region.label}
        </span>
        <span className="text-on-surface-variant">{region.blurb}</span>
        <span className="text-on-surface-variant/70">{region.currencyNote}</span>
        {region.euConsumerLaw && (
          <Link
            href="/eu-consumer-rights"
            className="ml-auto text-secondary font-label-bold text-[11px] uppercase tracking-widest hover:underline"
          >
            Your EU consumer rights →
          </Link>
        )}
      </div>
    </aside>
  );
}
