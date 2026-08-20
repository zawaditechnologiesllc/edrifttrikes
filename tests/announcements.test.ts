import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_LIVE_ANNOUNCEMENTS,
  MAX_MESSAGE_LENGTH,
  announcementState,
  isLive,
  liveAnnouncements,
  normalizeHref,
  normalizeMessage,
  tickerDurationSeconds,
  type Announcement,
} from "../lib/announcements";

/**
 * Announcements — the scrolling stripe at the top of the storefront.
 *
 * Two things have to hold. An admin's schedule must mean exactly what it says,
 * because a sale banner that fires a day early or lingers a week is worse than
 * no banner. And a link an admin types goes into an anchor on every page of the
 * store, so it is a real injection boundary.
 */

const NOW = new Date("2026-08-20T12:00:00Z");

function make(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: overrides.id ?? "a1",
    message: "Free shipping this week",
    href: null,
    active: true,
    starts_at: null,
    ends_at: null,
    position: 0,
    created_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

describe("when an announcement is showing", () => {
  test("no schedule means it runs until switched off", () => {
    assert.equal(announcementState(make(), NOW), "live");
  });

  test("before its start it is scheduled, not live", () => {
    const a = make({ starts_at: "2026-08-25T00:00:00Z" });
    assert.equal(announcementState(a, NOW), "scheduled");
    assert.equal(isLive(a, NOW), false);
  });

  test("after its end it is finished, not live", () => {
    const a = make({ ends_at: "2026-08-19T00:00:00Z" });
    assert.equal(announcementState(a, NOW), "expired");
    assert.equal(isLive(a, NOW), false);
  });

  test("inside its window it is live", () => {
    const a = make({ starts_at: "2026-08-19T00:00:00Z", ends_at: "2026-08-21T00:00:00Z" });
    assert.equal(announcementState(a, NOW), "live");
  });

  test("switching it off beats any schedule", () => {
    // An admin who unticks Active means it, whatever the dates say.
    const a = make({ active: false, starts_at: "2026-08-01T00:00:00Z" });
    assert.equal(announcementState(a, NOW), "off");
  });

  test("distinguishes 'I turned this off' from 'this ran its course'", () => {
    // The admin list shows these differently because they need different
    // actions: one is a switch to flip, the other a row to delete or reschedule.
    assert.equal(announcementState(make({ active: false }), NOW), "off");
    assert.equal(
      announcementState(make({ ends_at: "2026-01-01T00:00:00Z" }), NOW),
      "expired"
    );
  });

  test("the boundaries are exact", () => {
    const startsNow = make({ starts_at: NOW.toISOString() });
    assert.equal(isLive(startsNow, NOW), true, "should be live the instant it starts");
    const endsNow = make({ ends_at: NOW.toISOString() });
    assert.equal(isLive(endsNow, NOW), false, "should stop the instant it ends");
  });

  test("an unparseable date is ignored rather than hiding the notice", () => {
    // A hand-edited row must not silently blank the stripe.
    assert.equal(isLive(make({ starts_at: "not a date" }), NOW), true);
    assert.equal(isLive(make({ ends_at: "" }), NOW), true);
  });
});

describe("liveAnnouncements", () => {
  test("keeps only what a visitor should see", () => {
    const list = [
      make({ id: "live" }),
      make({ id: "off", active: false }),
      make({ id: "later", starts_at: "2027-01-01T00:00:00Z" }),
      make({ id: "done", ends_at: "2026-01-01T00:00:00Z" }),
    ];
    assert.deepEqual(
      liveAnnouncements(list, NOW).map((a) => a.id),
      ["live"]
    );
  });

  test("orders by the admin's position, then by age", () => {
    const list = [
      make({ id: "c", position: 2 }),
      make({ id: "a", position: 0, created_at: "2026-08-01T00:00:00Z" }),
      make({ id: "b", position: 0, created_at: "2026-08-05T00:00:00Z" }),
    ];
    // Two rows left at the default position still need a stable order, or the
    // stripe reshuffles itself between page loads.
    assert.deepEqual(
      liveAnnouncements(list, NOW).map((a) => a.id),
      ["a", "b", "c"]
    );
  });

  test("caps the set — past a handful nothing gets read", () => {
    const many = Array.from({ length: 20 }, (_, i) => make({ id: `a${i}`, position: i }));
    assert.equal(liveAnnouncements(many, NOW).length, MAX_LIVE_ANNOUNCEMENTS);
  });

  test("drops blank messages rather than scrolling empty space", () => {
    const list = [make({ id: "blank", message: "   " }), make({ id: "real" })];
    assert.deepEqual(
      liveAnnouncements(list, NOW).map((a) => a.id),
      ["real"]
    );
  });

  test("survives no data at all", () => {
    assert.deepEqual(liveAnnouncements(null, NOW), []);
    assert.deepEqual(liveAnnouncements(undefined, NOW), []);
    assert.deepEqual(liveAnnouncements([], NOW), []);
  });
});

describe("normalizeHref", () => {
  test("allows a path on this site", () => {
    assert.equal(normalizeHref("/shop"), "/shop");
    assert.equal(normalizeHref("  /shop?category=trikes  "), "/shop?category=trikes");
  });

  test("allows an absolute http(s) address", () => {
    assert.equal(normalizeHref("https://example.com/sale"), "https://example.com/sale");
    assert.equal(normalizeHref("http://example.com/"), "http://example.com/");
  });

  test("REFUSES anything that could execute", () => {
    // This value is rendered into an anchor on every page of the storefront.
    for (const bad of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "  javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
    ]) {
      assert.equal(normalizeHref(bad), null, `allowed: ${bad}`);
    }
  });

  test("refuses a protocol-relative URL, which is not a path", () => {
    // "//evil.com" LOOKS like a path but navigates off-site.
    assert.equal(normalizeHref("//evil.com"), null);
  });

  test("returns null for nothing, so the notice renders as plain text", () => {
    assert.equal(normalizeHref(null), null);
    assert.equal(normalizeHref(undefined), null);
    assert.equal(normalizeHref("   "), null);
    assert.equal(normalizeHref("shop"), null); // a bare word is not a link
  });

  test("bounds the length", () => {
    const long = normalizeHref("/" + "a".repeat(2000));
    assert.ok(long && long.length <= 500);
  });
});

describe("normalizeMessage", () => {
  test("collapses whitespace so a pasted line doesn't break the stripe", () => {
    assert.equal(normalizeMessage("  Free   shipping\n  this week "), "Free shipping this week");
  });

  test("bounds the length to what the database accepts", () => {
    assert.equal(normalizeMessage("x".repeat(500)).length, MAX_MESSAGE_LENGTH);
  });

  test("gives an empty string for nothing", () => {
    assert.equal(normalizeMessage(null), "");
    assert.equal(normalizeMessage("   "), "");
  });
});

describe("tickerDurationSeconds", () => {
  test("scales with the text, so reading speed stays constant", () => {
    // A fixed duration makes a long notice race past and a short one crawl.
    const short = tickerDurationSeconds(["Sale"]);
    const long = tickerDurationSeconds([
      "Free shipping on every trike until Sunday",
      "New Volt S1 Pro colours just landed",
      "Holiday cut-off for Christmas delivery is 15 December",
    ]);
    assert.ok(long > short);
  });

  test("is bounded at both ends", () => {
    assert.ok(tickerDurationSeconds([""]) >= 18, "a short notice would sit still");
    const huge = Array.from({ length: 50 }, () => "x".repeat(200));
    assert.ok(tickerDurationSeconds(huge) <= 120, "a full set would take forever");
  });
});
