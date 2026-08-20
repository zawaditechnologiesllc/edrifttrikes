import { NextResponse } from "next/server";
import { getAnnouncements, getSiteSettings } from "@/lib/db";
import { liveAnnouncements } from "@/lib/announcements";
import type { PublicSiteData } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * The public site data client components refresh from: footer contact details,
 * shipping fee, and the live announcements.
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
 * isn't shipped to a browser before it is due.
 */
export async function GET() {
  const [settings, announcements] = await Promise.all([
    getSiteSettings(),
    getAnnouncements(),
  ]);
  const body: PublicSiteData = {
    settings,
    announcements: liveAnnouncements(announcements),
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
