"use client";

import { useEffect, useState } from "react";
import { switchSuggestion, switchUrl, type Suggestion } from "@/lib/geo";
import { countryName } from "@/lib/countries";
import { useRegion } from "./RegionProvider";

/**
 * "You look like you're in Germany — our Europe storefront may suit you
 * better." Offered once, dismissible, and never acted on automatically.
 *
 * ═══ THE RULES THIS FOLLOWS ════════════════════════════════════════════════
 *
 * IT NEVER REDIRECTS. Each team hands out their own storefront link; a
 * geo-redirect would break every one of those for anyone travelling, on a VPN,
 * or simply guessed wrong about. The visitor stays where they chose to be and
 * gets a sentence with a link in it. See lib/geo.ts.
 *
 * IT KEEPS THEIR PLACE. Switching from a product page lands on that product on
 * the other storefront, not on a homepage they have to navigate back from.
 *
 * IT ASKS ONCE. A dismissal is remembered per storefront, so somebody who said
 * no on usa. is not asked again every time they open a page there. A banner
 * that keeps coming back trains people to dismiss the strip without reading
 * it — and that strip is also where the shipping exclusions and the currency
 * note live.
 *
 * IT COSTS NOTHING WHEN THERE IS NOTHING TO SAY. The country lookup is skipped
 * entirely for a visitor who has already dismissed it here, and on the
 * apex/worldwide storefront for a country with no regional home. No request,
 * no layout shift, no banner.
 */

const DISMISSED_KEY = "edrift.region-hint-dismissed";

/** Hosts this visitor has already said no on. Never throws. */
function dismissedHosts(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    // Private mode, or blocked storage. Treat it as "not dismissed" and
    // accept that we may ask again — the alternative is never asking.
    return [];
  }
}

function remember(host: string): void {
  try {
    const next = [...new Set([...dismissedHosts(), host])].slice(-10);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
  } catch {
    /* nothing to do — the banner simply may reappear */
  }
}

export default function RegionSwitchNotice() {
  const region = useRegion();
  const [suggestion, setSuggestion] = useState<Suggestion>(null);
  const [href, setHref] = useState("");

  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    if (dismissedHosts().includes(host)) return;

    let cancelled = false;
    const controller = new AbortController();
    // A country lookup is never worth holding anything up for.
    const timer = setTimeout(() => controller.abort(), 4000);

    fetch("/api/geo", { signal: controller.signal, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { country?: string | null } | null) => {
        if (cancelled || !data) return;
        const hit = switchSuggestion(region, data.country);
        if (!hit) return;
        setSuggestion(hit);
        setHref(switchUrl(hit.region, window.location.pathname));
      })
      .catch(() => {
        /* offline, aborted, or not behind Cloudflare — say nothing */
      })
      .finally(() => clearTimeout(timer));

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [region]);

  if (!suggestion || !href) return null;

  const where = countryName(suggestion.countryCode) ?? "your country";

  return (
    <aside
      aria-label="Storefront suggestion"
      className="bg-secondary/10 border-b border-secondary/30"
    >
      <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="text-on-surface-variant">
          It looks like you&apos;re in <strong className="text-white">{where}</strong>.
          Our <strong className="text-white">{suggestion.region.label}</strong>{" "}
          storefront is set up for you — same products, same prices.
        </span>
        <a
          href={href}
          className="font-label-bold text-[11px] uppercase tracking-widest text-secondary hover:underline"
        >
          Switch to {suggestion.region.label} →
        </a>
        <button
          type="button"
          onClick={() => {
            remember(window.location.hostname.toLowerCase());
            setSuggestion(null);
          }}
          className="ml-auto font-label-bold text-[11px] uppercase tracking-widest text-on-surface-variant hover:text-white"
        >
          {/* Named rather than an ✕: "stay here" is the actual choice, and it
              is the one that should feel like a decision rather than a
              dismissal. */}
          Stay here
        </button>
      </div>
    </aside>
  );
}
