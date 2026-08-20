"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_SITE_SETTINGS } from "@/lib/company";
import type { Announcement } from "@/lib/announcements";
import type { PublicSiteData, SiteSettings } from "@/lib/types";

/**
 * Distributes the public, admin-edited site values to client components: the
 * footer contact info and shipping fee, and the live announcement stripe.
 *
 * The root layout passes the server-fetched values; on mount we refresh once
 * from /api/settings because statically prerendered routes (cart, marketing
 * pages) carry BUILD-TIME values — without the refresh, an admin's change
 * wouldn't show there until the next deploy. The checkout API recomputes money
 * server-side regardless, so this only affects display.
 *
 * Both live behind ONE fetch and one provider deliberately: they refresh for
 * exactly the same reason, and two providers would mean two requests on every
 * page load to render one header and one footer.
 */
const SiteSettingsContext = createContext<SiteSettings>(DEFAULT_SITE_SETTINGS);
const AnnouncementsContext = createContext<Announcement[]>([]);

export function useSiteSettings(): SiteSettings {
  return useContext(SiteSettingsContext);
}

/** The live announcements, already time-filtered server-side. */
export function useAnnouncements(): Announcement[] {
  return useContext(AnnouncementsContext);
}

export default function SiteSettingsProvider({
  settings,
  announcements = [],
  children,
}: {
  settings: SiteSettings;
  announcements?: Announcement[];
  children: React.ReactNode;
}) {
  const [current, setCurrent] = useState<SiteSettings>(settings);
  const [notices, setNotices] = useState<Announcement[]>(announcements);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((fresh: PublicSiteData | null) => {
        if (!fresh || cancelled) return;
        if (fresh.settings) setCurrent(fresh.settings);
        if (Array.isArray(fresh.announcements)) setNotices(fresh.announcements);
      })
      .catch(() => {
        /* keep the server-provided values */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SiteSettingsContext.Provider value={current}>
      <AnnouncementsContext.Provider value={notices}>
        {children}
      </AnnouncementsContext.Provider>
    </SiteSettingsContext.Provider>
  );
}
