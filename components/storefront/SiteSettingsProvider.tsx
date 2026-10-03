"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_SITE_SETTINGS } from "@/lib/company";
import type { Announcement } from "@/lib/announcements";
import type { Category, PublicSiteData, SiteSettings } from "@/lib/types";

/**
 * Distributes the public, admin-edited site values to client components: the
 * footer contact info and shipping fee, the live announcement stripe, and the
 * categories a visitor may see.
 *
 * The root layout passes the server-fetched values; on mount we refresh once
 * from /api/settings because statically prerendered routes (cart, marketing
 * pages) carry BUILD-TIME values — without the refresh, an admin's change
 * wouldn't show there until the next deploy. The checkout API recomputes money
 * server-side regardless, so this only affects display.
 *
 * All three live behind ONE fetch and one provider deliberately: they refresh
 * for exactly the same reason, and separate providers would mean a request
 * each on every page load to render one header and one footer.
 *
 * THE CATEGORIES ARE A VISIBILITY RULE, not decoration: the header and footer
 * are client components, so without this they had to hard-code the category
 * links — and a hard-coded link survives the admin switching that category
 * off. The refresh matters more for them than for the contact details: a
 * statically prerendered page carries BUILD-TIME links, so a category switched
 * off after the last deploy is still in that page's HTML until this fetch
 * lands. Nothing behind the link works (see lib/categories.ts — the products,
 * the pages and the checkout are all gated server-side), but the link itself
 * is only gone once this returns.
 */
const SiteSettingsContext = createContext<SiteSettings>(DEFAULT_SITE_SETTINGS);
const AnnouncementsContext = createContext<Announcement[]>([]);
const CategoriesContext = createContext<Category[]>([]);

export function useSiteSettings(): SiteSettings {
  return useContext(SiteSettingsContext);
}

/** The live announcements, already time-filtered server-side. */
export function useAnnouncements(): Announcement[] {
  return useContext(AnnouncementsContext);
}

/**
 * The categories a visitor may see — already filtered to the switched-on ones
 * server-side, so no client component has to know the rule.
 */
export function useCategories(): Category[] {
  return useContext(CategoriesContext);
}

export default function SiteSettingsProvider({
  settings,
  announcements = [],
  categories = [],
  children,
}: {
  settings: SiteSettings;
  announcements?: Announcement[];
  categories?: Category[];
  children: React.ReactNode;
}) {
  const [current, setCurrent] = useState<SiteSettings>(settings);
  const [notices, setNotices] = useState<Announcement[]>(announcements);
  const [ranges, setRanges] = useState<Category[]>(categories);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((fresh: PublicSiteData | null) => {
        if (!fresh || cancelled) return;
        if (fresh.settings) setCurrent(fresh.settings);
        if (Array.isArray(fresh.announcements)) setNotices(fresh.announcements);
        // Replaced even when empty: every category being switched off is a
        // real state, and `.length &&` would have left the stale links up.
        if (Array.isArray(fresh.categories)) setRanges(fresh.categories);
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
        <CategoriesContext.Provider value={ranges}>
          {children}
        </CategoriesContext.Provider>
      </AnnouncementsContext.Provider>
    </SiteSettingsContext.Provider>
  );
}
