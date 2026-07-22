"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_SITE_SETTINGS } from "@/lib/company";
import type { SiteSettings } from "@/lib/types";

/**
 * Distributes the admin-edited site settings (footer contact info + shipping
 * fee) to client components. The root layout passes the server-fetched value;
 * on mount we refresh once from /api/settings because statically prerendered
 * routes (cart, marketing pages) carry build-time values — without the
 * refresh, an admin's fee/contact change wouldn't show there until the next
 * deploy. The checkout API recomputes money server-side regardless, so this
 * only affects display.
 */
const SiteSettingsContext = createContext<SiteSettings>(DEFAULT_SITE_SETTINGS);

export function useSiteSettings(): SiteSettings {
  return useContext(SiteSettingsContext);
}

export default function SiteSettingsProvider({
  settings,
  children,
}: {
  settings: SiteSettings;
  children: React.ReactNode;
}) {
  const [current, setCurrent] = useState<SiteSettings>(settings);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((fresh: SiteSettings | null) => {
        if (fresh && !cancelled) setCurrent(fresh);
      })
      .catch(() => {
        /* keep the server-provided value */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SiteSettingsContext.Provider value={current}>
      {children}
    </SiteSettingsContext.Provider>
  );
}
