import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Public site settings (footer contact + shipping fee). Everything in
 * site_settings is public by design — never add secrets to that table.
 *
 * Exists because statically rendered pages (cart, marketing pages) bake the
 * layout's settings at build time; SiteSettingsProvider re-fetches from here
 * on mount so admins' changes show up without a redeploy.
 */
export async function GET() {
  const settings = await getSiteSettings();
  return NextResponse.json(settings, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
