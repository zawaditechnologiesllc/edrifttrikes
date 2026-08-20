export const dynamic = "force-dynamic";

import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { announcementState, type Announcement } from "@/lib/announcements";
import AnnouncementsManager from "./AnnouncementsManager";

export const metadata = { title: "Announcements" };

export default async function AdminAnnouncements() {
  if (!adminConfigured()) {
    return (
      <p className="p-8 text-on-surface-variant">
        Connect Supabase (URL + service role key) to manage announcements.
      </p>
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("announcements")
    .select("*")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  // The one failure worth naming: the table doesn't exist yet. Everything on
  // this page depends on it, so an empty list would be a lie.
  if (error) {
    return (
      <div className="p-8">
        <h1 className="font-display-lg text-display-lg-mobile text-white uppercase mb-2">
          Announcements
        </h1>
        <p className="text-error max-w-2xl mt-4">
          The announcements table isn&apos;t there yet. Run{" "}
          <code className="text-secondary">
            supabase/migrations/0014_announcements.sql
          </code>{" "}
          in the Supabase SQL Editor, then reload this page.
        </p>
        <p className="text-on-surface-variant text-sm mt-3">({error.message})</p>
      </div>
    );
  }

  const announcements = (data as Announcement[]) ?? [];
  const liveCount = announcements.filter((a) => announcementState(a) === "live").length;

  return (
    <div className="p-8">
      <h1 className="font-display-lg text-display-lg-mobile text-white uppercase mb-2">
        Announcements
      </h1>
      <p className="text-on-surface-variant mb-8 max-w-2xl">
        Short notices that scroll across the stripe at the very top of every
        storefront page — a sale, a shipping delay, a restock, a holiday
        cut-off.{" "}
        {liveCount === 0
          ? "Nothing is showing right now, so there is no stripe."
          : `${liveCount} showing right now.`}
      </p>
      <AnnouncementsManager announcements={announcements} />
    </div>
  );
}
