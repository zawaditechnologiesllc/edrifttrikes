/**
 * Announcements — the short notices that scroll across the stripe at the top of
 * every storefront page.
 *
 * ONE DEFINITION OF "LIVE", used in three places that must agree: the stripe
 * itself, the admin list (which labels each row scheduled / live / expired /
 * off), and the API the storefront refreshes from. If they disagreed, an admin
 * would see "Live" against a notice no visitor can read.
 *
 * DEPENDENCY-FREE so the browser, the server and the tests all run the same
 * code.
 */

export type Announcement = {
  id: string;
  message: string;
  /** Optional destination. Always run through normalizeHref before rendering. */
  href: string | null;
  /** The admin's on/off switch, independent of the schedule. */
  active: boolean;
  /** Null means "already running". */
  starts_at: string | null;
  /** Null means "until I turn it off". */
  ends_at: string | null;
  position: number;
  created_at: string;
  updated_at?: string;
};

/** The stripe is one line of text; longer than this stops informing anyone. */
export const MAX_MESSAGE_LENGTH = 200;

/** Beyond a handful, nothing gets read before it scrolls away. */
export const MAX_LIVE_ANNOUNCEMENTS = 8;

/** What the admin list shows against each row. */
export type AnnouncementState = "live" | "scheduled" | "expired" | "off";

function time(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Where an announcement sits right now.
 *
 * `off` wins over everything: an admin who unticks Active means it, whatever
 * the dates say. A row whose window has passed reads `expired` rather than
 * `off`, so the list distinguishes "I turned this off" from "this ran its
 * course" — they call for different actions.
 */
export function announcementState(a: Announcement, now: Date = new Date()): AnnouncementState {
  if (!a.active) return "off";
  const at = now.getTime();
  const start = time(a.starts_at);
  const end = time(a.ends_at);
  if (end !== null && at >= end) return "expired";
  if (start !== null && at < start) return "scheduled";
  return "live";
}

export function isLive(a: Announcement, now: Date = new Date()): boolean {
  return announcementState(a, now) === "live";
}

/**
 * The announcements a visitor should see, in the order they scroll past.
 *
 * Sorted by the admin's position first and creation time second, so two rows
 * left at the default position still have a stable order rather than whatever
 * the database happened to return.
 */
export function liveAnnouncements(
  list: Announcement[] | null | undefined,
  now: Date = new Date()
): Announcement[] {
  return (list ?? [])
    .filter((a) => a && typeof a.message === "string" && a.message.trim() && isLive(a, now))
    .sort(
      (a, b) =>
        a.position - b.position ||
        (time(a.created_at) ?? 0) - (time(b.created_at) ?? 0)
    )
    .slice(0, MAX_LIVE_ANNOUNCEMENTS);
}

/**
 * Make an admin-entered link safe to render.
 *
 * The message and its link go straight into an anchor on every page of the
 * storefront, so this is the boundary that keeps a `javascript:` or `data:` URL
 * out of it. Only two shapes survive: a same-site path, and an absolute http(s)
 * URL. Anything else returns null and the announcement renders as plain text —
 * which is a working announcement, just not a clickable one.
 */
export function normalizeHref(raw: string | null | undefined): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  // A same-site path. "//evil.com" is protocol-relative, not a path, so it is
  // excluded here and has to survive the absolute-URL check below (it won't).
  if (value.startsWith("/") && !value.startsWith("//")) {
    return value.slice(0, 500);
  }

  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString().slice(0, 500);
    }
  } catch {
    // Not a URL at all — e.g. someone typed a bare page name.
  }
  return null;
}

/** Trim and bound a message the way the database constraint will. */
export function normalizeMessage(raw: string | null | undefined): string {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
}

/**
 * How long one full pass of the stripe should take, in seconds.
 *
 * Scaled to the text so the reading speed stays constant: a fixed duration
 * makes a long notice race past and a short one crawl. Bounded at both ends so
 * a single word doesn't sit still and a full set doesn't take a minute.
 */
export function tickerDurationSeconds(messages: string[]): number {
  const characters = messages.join("").length;
  return Math.min(120, Math.max(18, Math.round(characters * 0.28)));
}
