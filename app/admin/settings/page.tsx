export const dynamic = "force-dynamic";

import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { DEFAULT_SITE_SETTINGS } from "@/lib/company";
import type { SiteSettings } from "@/lib/types";
import SettingsForm from "./SettingsForm";

export const metadata = { title: "Site settings" };

export default async function AdminSettings() {
  let settings: SiteSettings = DEFAULT_SITE_SETTINGS;
  if (adminConfigured()) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("site_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (data) settings = data as SiteSettings;
  }

  return (
    <div className="p-8">
      <h1 className="font-display-lg text-display-lg-mobile text-white uppercase mb-2">
        Site Settings
      </h1>
      <p className="text-on-surface-variant mb-8 max-w-2xl">
        Contact details shown in the footer on every page. Leave a field empty
        to hide it.
      </p>
      <SettingsForm settings={settings} />
    </div>
  );
}
