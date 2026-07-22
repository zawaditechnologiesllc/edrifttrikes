"use client";

import { createContext, useContext } from "react";
import { DEFAULT_SITE_SETTINGS } from "@/lib/company";
import type { SiteSettings } from "@/lib/types";

/**
 * Distributes the admin-edited site settings (footer contact info) to client
 * components. The root layout fetches them once per request (cached, see
 * getSiteSettings in lib/db.ts) and mounts this provider, so both server and
 * client pages get the same values — SiteFooter is rendered by client pages
 * like /cart, which rules out fetching inside the footer itself.
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
  return (
    <SiteSettingsContext.Provider value={settings}>
      {children}
    </SiteSettingsContext.Provider>
  );
}
