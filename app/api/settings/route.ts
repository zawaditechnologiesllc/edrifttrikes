import { NextResponse } from "next/server";
import { getAnnouncements, getCategories, getSiteSettings } from "@/lib/db";
import { liveAnnouncements } from "@/lib/announcements";
import type { PublicSiteData } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * The public site data client components refresh from: footer contact details,
 * shipping fee, the live announcements, and the categories a visitor may see.
 *
 * Everything here is public by design — never add a secret to site_settings or
 * announcements.
 *
 * WHY IT EXISTS: statically rendered pages (cart, marketing pages, support)
 * bake the layout's values at BUILD time, so an admin's change wouldn't show on
 * them until the next deploy. SiteSettingsProvider re-fetches from here on
 * mount. Announcements ride along in the same request rather than getting their
 * own, because every page would otherwise make two calls to render one header.
 *
 * The announcements are filtered to the live set HERE so a scheduled notice
 * isn't shipped to a browser before it is due. The categories are filtered to
 * the switched-on ones for the same reason, one step stronger: a switched-off
 * category must not be NAMED to a browser at all, so the hidden rows never
 * leave the server.
 */
export async function GET() {
  const [settings, announcements, categories] = await Promise.all([
    getSiteSettings(),
    getAnnouncements(),
    getCategories(),
  ]);
  const body: PublicSiteData = {
    settings,
    announcements: liveAnnouncements(announcements),
    categories,
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
