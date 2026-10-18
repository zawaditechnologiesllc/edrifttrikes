"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { REGIONS, regionFromHost, type Region } from "@/lib/regions";
import { approximate, currencyNoteFor } from "@/lib/currency";

/**
 * Which regional storefront the browser is on, for everything that renders a
 * price or a region-specific line.
 *
 * ═══ WHY THE HOSTNAME IS READ IN THE BROWSER ═══════════════════════════════
 *
 * Reading the Host header on the server means calling headers(), and calling
 * headers() opts the page out of static rendering. Every product page and the
 * whole catalogue would become an origin render per visit, to decide the
 * wording of a secondary price line. At this shop's traffic that is a bad
 * trade, and nothing load-bearing is decided here: the canonical URL is set
 * server-side in middleware, the legal pages are identical on every hostname,
 * and the checkout recomputes money server-side in dollars regardless of what
 * this showed.
 *
 * Starts on the worldwide region and corrects after mount, so the server HTML
 * and the first client render agree and the approximate price simply appears.
 */
const RegionContext = createContext<Region>(REGIONS.global);

export function useRegion(): Region {
  return useContext(RegionContext);
}

export default function RegionProvider({ children }: { children: ReactNode }) {
  const [region, setRegion] = useState<Region>(REGIONS.global);

  useEffect(() => {
    setRegion(regionFromHost(window.location.hostname));
  }, []);

  return <RegionContext.Provider value={region}>{children}</RegionContext.Provider>;
}

/**
 * The approximate local price, under the dollar price.
 *
 * ⚠️ RENDERS NOTHING ON A DOLLAR STOREFRONT, and nothing when the rate behind
 * it has gone stale (lib/currency.ts). The dollar price beside it is always
 * the one that is charged, which is why this one always carries the word
 * "approx." — two prices with no indication of which is taken is a dispute
 * waiting to be filed.
 */
export function LocalPrice({
  cents,
  className = "",
}: {
  cents: number;
  className?: string;
}) {
  const region = useRegion();
  const text = approximate(cents, region.currency);
  if (!text) return null;
  return (
    <span className={`block text-on-surface-variant/80 text-xs mt-0.5 ${className}`}>
      {text}
    </span>
  );
}

/**
 * The sentence that names which currency is actually charged.
 *
 * Belongs next to a total, not in a footer: the moment a second number appears
 * beside the amount, the buyer needs to know which one their bank will show.
 */
export function CurrencyNote({ className = "" }: { className?: string }) {
  const region = useRegion();
  if (region.currency === "USD") return null;
  return (
    <p className={`text-outline text-[11px] leading-relaxed mt-2 ${className}`}>
      {currencyNoteFor(region.currency)}
    </p>
  );
}
