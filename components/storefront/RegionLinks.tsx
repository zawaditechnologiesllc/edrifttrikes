"use client";

import { REGIONAL_SITES, regionHome } from "@/lib/regions";
import { useHost } from "./RegionProvider";

/**
 * The five storefronts, linked from every page.
 *
 * ═══ WHY THE LINKS ARE ABSOLUTE ════════════════════════════════════════════
 *
 * Because they cross hostnames, which is the one thing a relative link cannot
 * do. A visitor on europe.edrifttrikes.shop clicking "United States" has to
 * land on usa.edrifttrikes.shop — a relative `/` would reload the storefront
 * they are already on and look like a dead link. So each href is built by
 * regionHome(), which is also what makes these safe to paste anywhere: the
 * same URL works from a browser, an Instagram bio or a printed card.
 *
 * ⚠️ PLAIN ANCHORS, NOT next/link. These leave the current origin, so there is
 * no client-side route to take — and Next's prefetching has nothing useful to
 * do with a different host.
 *
 * The storefront the visitor is already on is marked rather than hidden.
 * Dropping it would leave a different number of links on each hostname, which
 * reads as a mistake; marking it answers "where am I?", which on a shop with
 * five front doors is a real question.
 *
 * ⚠️ MARKED BY HOSTNAME, NOT BY REGION. The apex is the worldwide storefront,
 * so asking the region would mark the "Worldwide" link there — on a link that
 * points at global.edrifttrikes.shop, which is not the page the visitor is on.
 * `aria-current="page"` means "this link is where you already are", and a
 * screen reader will say so. On the apex nothing is marked, which is correct:
 * it is the main site, and the row is a list of ways out of it.
 */
export default function RegionLinks() {
  const host = useHost();

  return (
    <nav
      aria-label="Our storefronts"
      className="flex flex-wrap items-center gap-x-6 gap-y-3"
    >
      {REGIONAL_SITES.map((region) => {
        const here = host !== "" && host === new URL(regionHome(region)).hostname;
        return (
          <a
            key={region.key}
            href={regionHome(region)}
            aria-current={here ? "page" : undefined}
            className={
              here
                ? "text-secondary font-label-bold text-xs uppercase tracking-widest"
                : "text-on-surface-variant hover:text-primary transition-colors font-label-bold text-xs uppercase tracking-widest"
            }
          >
            {region.label}
            {/* The currency is the useful half: it is what a visitor is
                choosing between, and it saves a click to find out. */}
            <span className={here ? "ml-2 text-secondary/70" : "ml-2 text-outline"}>
              {region.currency}
            </span>
            {here && <span className="sr-only"> (you are here)</span>}
          </a>
        );
      })}
    </nav>
  );
}
