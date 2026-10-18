"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { switchSuggestion, switchUrl, type Suggestion } from "@/lib/geo";
import { countryName } from "@/lib/countries";
import {
  AUTO_COLLAPSE_MS,
  COLLAPSE_ANIMATION_MS,
  hushForSession,
  hushForever,
  isHushed,
} from "@/lib/region-hint";
import { useRegion } from "./RegionProvider";

/**
 * "You look like you're in Germany — our Europe storefront may suit you
 * better." Offered once, folded away on any answer, and never acted on
 * automatically.
 *
 * ═══ THE RULES THIS FOLLOWS ════════════════════════════════════════════════
 *
 * IT NEVER REDIRECTS. Each team hands out their own storefront link; a
 * geo-redirect would break every one of those for anyone travelling, on a VPN,
 * or simply guessed wrong about. See lib/geo.ts.
 *
 * IT KEEPS THEIR PLACE. Switching from a product page lands on that product on
 * the other storefront, not on a homepage they have to navigate back from.
 *
 * IT FOLDS AWAY ON ANY ANSWER — "Stay here", or fifteen seconds of silence.
 * The two answers are remembered differently and deliberately: a decision
 * lasts, silence does not. lib/region-hint.ts has the reasoning.
 *
 * ⚠️ THE TIMER PAUSES ON HOVER AND ON FOCUS. A banner that vanishes while the
 * pointer is travelling towards its link is worse than one that never
 * appeared — the reader saw an offer, reached for it, and the site took it
 * away. It also means a keyboard user tabbing onto the link always has time.
 *
 * IT COSTS NOTHING WHEN THERE IS NOTHING TO SAY. The country lookup is skipped
 * entirely for a visitor who has already been asked here. No request, no
 * layout shift, no banner.
 */
export default function RegionSwitchNotice() {
  const region = useRegion();
  const [suggestion, setSuggestion] = useState<Suggestion>(null);
  const [href, setHref] = useState("");
  /** Folded, but still in the DOM while the fold animates. */
  const [collapsed, setCollapsed] = useState(false);
  /** Gone. */
  const [done, setDone] = useState(false);
  /** True while the pointer or keyboard focus is on the banner. */
  const held = useRef(false);

  const stores = () => ({
    local: typeof window === "undefined" ? null : window.localStorage,
    session: typeof window === "undefined" ? null : window.sessionStorage,
  });

  /* ── find out whether there is anything to say ──────────────────────────── */
  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    let hushed = false;
    try {
      hushed = isHushed(host, stores());
    } catch {
      /* storage unavailable — ask */
    }
    if (hushed) return;

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

  /** Fold it up, then take it out of the page once the fold has finished. */
  const collapse = useCallback((remember: () => void) => {
    remember();
    setCollapsed(true);
    setTimeout(() => setDone(true), COLLAPSE_ANIMATION_MS);
  }, []);

  /* ── fold it away after a while, unless they are using it ───────────────── */
  useEffect(() => {
    if (!suggestion || collapsed) return;

    const host = window.location.hostname.toLowerCase();
    let timer: ReturnType<typeof setTimeout>;

    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // Held = the pointer is on it or something inside has focus. Wait and
        // look again rather than pulling it away mid-reach.
        if (held.current) return arm();
        collapse(() => hushForSession(host, stores().session));
      }, AUTO_COLLAPSE_MS);
    };

    arm();
    return () => clearTimeout(timer);
  }, [suggestion, collapsed, collapse]);

  if (!suggestion || !href || done) return null;

  const where = countryName(suggestion.countryCode) ?? "your country";

  return (
    <aside
      aria-label="Storefront suggestion"
      aria-hidden={collapsed || undefined}
      onMouseEnter={() => (held.current = true)}
      onMouseLeave={() => (held.current = false)}
      onFocus={() => (held.current = true)}
      onBlur={() => (held.current = false)}
      /*
       * The fold is a grid row going from 1fr to 0fr, which animates to the
       * content's real height without anyone having to measure it or hard-code
       * a max-height that breaks the moment the sentence wraps to two lines on
       * a phone. `motion-reduce` turns the animation off for anyone who has
       * asked their system for less of it — the banner still goes, it just
       * goes at once.
       */
      className={`grid transition-[grid-template-rows,opacity] duration-[400ms] ease-out motion-reduce:transition-none ${
        collapsed
          ? "grid-rows-[0fr] opacity-0"
          : "grid-rows-[1fr] opacity-100 border-b border-secondary/30"
      } bg-secondary/10`}
    >
      <div className="overflow-hidden">
        <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="text-on-surface-variant">
            It looks like you&apos;re in <strong className="text-white">{where}</strong>.
            Our <strong className="text-white">{suggestion.region.label}</strong>{" "}
            storefront is set up for you — same products, same prices.
          </span>
          <a
            href={href}
            // Switching navigates away, so there is nothing left to fold — but
            // the answer is still an answer, and a visitor who comes back
            // should not be asked about this storefront again.
            onClick={() => hushForever(window.location.hostname.toLowerCase(), stores().local)}
            className="font-label-bold text-[11px] uppercase tracking-widest text-secondary hover:underline"
          >
            Switch to {suggestion.region.label} →
          </a>
          <button
            type="button"
            onClick={() =>
              collapse(() => hushForever(window.location.hostname.toLowerCase(), stores().local))
            }
            className="ml-auto font-label-bold text-[11px] uppercase tracking-widest text-on-surface-variant hover:text-white"
          >
            {/* Named rather than an ✕: "stay here" is the actual choice, and it
                is the one that should feel like a decision rather than a
                dismissal. */}
            Stay here
          </button>
        </div>
      </div>
    </aside>
  );
}
