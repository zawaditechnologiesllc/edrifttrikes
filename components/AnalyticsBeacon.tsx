"use client";

import { useEffect } from "react";

/** Set once per page load — React may run the effect twice in development. */
let injected = false;

/**
 * Loads the Cloudflare Web Analytics beacon.
 *
 * WHY A CLIENT COMPONENT, when a plain <script> tag in the layout would be
 * shorter: the layout of a STATICALLY prerendered page — the homepage, /cart,
 * /support — is rendered at BUILD time. A token set only as a runtime Worker
 * variable would be empty in that HTML, so the beacon would never load on
 * exactly the pages worth measuring, and it would look like the store had no
 * traffic. Same failure that took out the Turnstile widget on /support; same
 * three-source fix (see components/Turnstile.tsx and /api/public-env).
 *
 * Injecting into <head> after mount rather than rendering the tag keeps the
 * server and client markup identical, so there is nothing to mismatch.
 */
export default function AnalyticsBeacon({ token: tokenProp = "" }: { token?: string }) {
  useEffect(() => {
    if (injected) return;
    let cancelled = false;

    const load = (token: string) => {
      if (!token || injected || cancelled) return;
      if (document.querySelector('script[src*="cloudflareinsights"]')) return;
      injected = true;
      const el = document.createElement("script");
      el.defer = true;
      el.src = "https://static.cloudflareinsights.com/beacon.min.js";
      el.setAttribute("data-cf-beacon", JSON.stringify({ token }));
      document.head.appendChild(el);
    };

    // 1. Build-time value, when set as a build variable.
    if (tokenProp) return load(tokenProp);
    // 2. The layout's runtime injection — real only on a dynamic page.
    const fromWindow = window.__EDRIFT_ENV?.CLOUDFLARE_ANALYTICS_TOKEN;
    if (fromWindow) return load(fromWindow);
    // 3. The only source a statically prerendered page can trust.
    fetch("/api/public-env")
      .then((r) => (r.ok ? r.json() : null))
      .then((env: { CLOUDFLARE_ANALYTICS_TOKEN?: string } | null) => {
        if (!cancelled && env?.CLOUDFLARE_ANALYTICS_TOKEN) {
          load(env.CLOUDFLARE_ANALYTICS_TOKEN);
        }
      })
      .catch(() => {
        /* No analytics. Never a reason for a page to misbehave. */
      });

    return () => {
      cancelled = true;
    };
  }, [tokenProp]);

  return null;
}
