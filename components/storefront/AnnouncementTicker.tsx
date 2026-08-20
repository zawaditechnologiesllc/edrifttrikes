"use client";

import Link from "next/link";
import { useAnnouncements } from "@/components/storefront/SiteSettingsProvider";
import { normalizeHref, tickerDurationSeconds } from "@/lib/announcements";
import type { Announcement } from "@/lib/announcements";

/**
 * The announcement stripe: the admin's live notices scrolling across the very
 * top of every storefront page.
 *
 * HOW THE LOOP WORKS: the track holds the notices TWICE and slides left by
 * exactly half its width. At the moment it reaches -50% the second copy sits
 * precisely where the first began, so resetting to 0 is invisible and the
 * scroll never appears to jump or restart.
 *
 * The duration scales with the text (tickerDurationSeconds) rather than being
 * fixed, so reading speed stays constant whether there is one short notice or
 * eight long ones.
 *
 * ACCESSIBILITY: motion that never stops is genuinely hard to read for some
 * people, so the track pauses on hover and on keyboard focus, and anyone whose
 * system asks for reduced motion gets the notices as static, wrapping text
 * instead of an animation (see .ticker-track in globals.css). The second copy
 * is decoration — it is aria-hidden AND stripped of its links, because a
 * focusable element inside aria-hidden content is a trap: invisible to a screen
 * reader but still reachable with the Tab key.
 */
export default function AnnouncementTicker() {
  const announcements = useAnnouncements();
  if (announcements.length === 0) return null;

  const duration = tickerDurationSeconds(announcements.map((a) => a.message));

  return (
    <aside
      aria-label="Store announcements"
      className="group relative w-full overflow-hidden bg-secondary text-on-secondary-fixed border-b border-black/10"
    >
      <div
        className="ticker-track flex w-max items-center py-2 font-label-bold text-[11px] uppercase tracking-widest"
        // Inline because the value depends on this particular content, not on
        // the design — Tailwind has no class for "however long this text takes
        // to read".
        style={{ animationDuration: `${duration}s` }}
      >
        <div className="flex items-center">
          {announcements.map((a) => (
            <Notice key={a.id} announcement={a} />
          ))}
        </div>
        <div className="flex items-center" aria-hidden="true">
          {announcements.map((a) => (
            <Notice key={a.id} announcement={a} decorative />
          ))}
        </div>
      </div>
    </aside>
  );
}

function Notice({
  announcement,
  decorative,
}: {
  announcement: Announcement;
  /** The duplicated copy: plain text only, so nothing here can take focus. */
  decorative?: boolean;
}) {
  const href = decorative ? null : normalizeHref(announcement.href);
  const text = <span className="whitespace-nowrap">{announcement.message}</span>;
  const linkClass = "whitespace-nowrap underline-offset-4 hover:underline focus-visible:underline";

  return (
    <span className="inline-flex items-center gap-8 px-5">
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rotate-45 bg-on-secondary-fixed/40"
      />
      {!href ? (
        text
      ) : href.startsWith("/") ? (
        <Link href={href} className={linkClass}>
          {announcement.message}
        </Link>
      ) : (
        // External: a plain anchor, opened in a new tab so a visitor mid-basket
        // doesn't lose the store.
        <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {announcement.message}
        </a>
      )}
    </span>
  );
}
