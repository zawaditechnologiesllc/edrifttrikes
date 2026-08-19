"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders a Cloudflare Turnstile widget inside a form. On success Turnstile
 * injects a hidden `cf-turnstile-response` input into the surrounding form,
 * which the server action verifies. Renders nothing when no site key is set,
 * so forms work unchanged until you configure NEXT_PUBLIC_TURNSTILE_SITE_KEY.
 *
 * THE KEY IS RESOLVED AT RUNTIME, not only from the build-time inline. On
 * Cloudflare, NEXT_PUBLIC_* only reaches the client bundle if it was present at
 * BUILD time; a key set as a runtime Worker variable leaves the bundle holding
 * an empty string. That produced a silent, total failure: no widget rendered,
 * so no token was submitted, so the server — whose secret IS readable at
 * runtime — rejected every genuine submission with "Verification failed".
 * `window.__EDRIFT_ENV` (components/PublicEnvScript.tsx) closes that gap.
 */
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export default function Turnstile({ siteKey: siteKeyProp = "" }: { siteKey?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Resolved after mount so the server and client render the same markup —
  // reading window during render would be a hydration mismatch.
  const [siteKey, setSiteKey] = useState(siteKeyProp);

  // Three sources, in order of cost:
  //  1. the build-time inline (prop) — present when set as a build variable;
  //  2. window.__EDRIFT_ENV — the layout's runtime injection, which carries a
  //     real value only on DYNAMICALLY rendered pages;
  //  3. /api/public-env — the only source that works on a STATICALLY
  //     prerendered page such as /support, whose layout was rendered at build
  //     time with the variable unset.
  // Without (3) the widget silently never renders on static pages and every
  // submission is rejected as unverified.
  useEffect(() => {
    if (siteKey) return;
    let cancelled = false;

    const injected = window.__EDRIFT_ENV?.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (injected) {
      setSiteKey(injected);
      return;
    }

    fetch("/api/public-env")
      .then((r) => (r.ok ? r.json() : null))
      .then((env: { NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string } | null) => {
        if (!cancelled && env?.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
          setSiteKey(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
        }
      })
      .catch(() => {
        /* Turnstile stays absent; the server fails open (lib/turnstile.ts). */
      });

    return () => {
      cancelled = true;
    };
  }, [siteKey]);

  useEffect(() => {
    if (!siteKey) return;
    let interval: ReturnType<typeof setInterval> | undefined;

    const render = () => {
      if (!window.turnstile || !containerRef.current || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "dark",
      });
    };

    if (window.turnstile) {
      render();
    } else if (!document.querySelector(`script[src^="https://challenges.cloudflare.com/turnstile"]`)) {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.onload = render;
      document.head.appendChild(s);
    } else {
      interval = setInterval(() => {
        if (window.turnstile) {
          if (interval) clearInterval(interval);
          render();
        }
      }, 200);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  return <div ref={containerRef} />;
}
