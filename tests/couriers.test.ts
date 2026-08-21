import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  COURIERS,
  COURIER_GROUPS,
  COURIER_NAMES,
  INTERNAL_COURIER,
  TRACKING_PREFIX,
  findCourier,
  generateTrackingNumber,
  isKnownCourier,
  isValidInternalTracking,
  looksInternal,
  trackingUrlFor,
} from "../lib/couriers";

/**
 * Who carries the parcel, and what the customer is handed to follow it.
 *
 * The expensive mistake here is not a missing courier — it is a LINK THAT
 * DOESN'T WORK. A customer who clicks "track" and lands on "not found" does not
 * conclude the link is wrong; they conclude nothing shipped, and they email
 * support. So most of what follows is about when NOT to produce a link.
 */

describe("the list", () => {
  test("is long enough to be worth calling a list", () => {
    assert.ok(COURIERS.length > 60, `only ${COURIERS.length} couriers`);
  });

  test("has no duplicate names — a select with two identical rows is a bug", () => {
    assert.equal(new Set(COURIER_NAMES).size, COURIER_NAMES.length);
  });

  test("covers the carriers a store like this actually uses", () => {
    for (const name of [
      "DHL Express",
      "FedEx",
      "UPS",
      "USPS",
      "Royal Mail",
      "Canada Post",
      "Australia Post",
      "Aramex",
      "Correios (Brazil)",
      "Posta Kenya",
    ]) {
      assert.ok(isKnownCourier(name), `${name} is missing`);
    }
  });

  test("groups every courier — nothing falls outside an optgroup", () => {
    const grouped = COURIER_GROUPS.flatMap((g) => g.couriers).length;
    assert.equal(grouped, COURIERS.length);
    for (const group of COURIER_GROUPS) {
      assert.ok(group.label.length > 0);
      assert.ok(group.couriers.length > 0, `${group.label} is empty`);
    }
  });

  test("every tracking URL is https and has somewhere to put the number", () => {
    for (const c of COURIERS) {
      if (!c.trackingUrl) continue;
      assert.ok(c.trackingUrl.startsWith("https://"), `${c.name} is not https`);
      assert.ok(c.trackingUrl.includes("{n}"), `${c.name} has no {n} slot`);
    }
  });

  test("matches a name regardless of case or stray whitespace", () => {
    assert.equal(findCourier("  ups  ")?.name, "UPS");
    assert.equal(findCourier("dhl express")?.name, "DHL Express");
  });

  test("does not match something that isn't on it", () => {
    assert.equal(findCourier("Some Guy With A Van"), null);
    assert.equal(findCourier(""), null);
    assert.equal(findCourier(null), null);
    assert.equal(isKnownCourier(undefined), false);
  });

  test("the in-house option carries no tracking URL", () => {
    // There is no external site to send anyone to, and inventing one would
    // send the customer somewhere that says the parcel doesn't exist.
    const internal = findCourier(INTERNAL_COURIER);
    assert.ok(internal, "the in-house courier is missing from the list");
    assert.equal(internal?.trackingUrl, undefined);
  });
});

describe("generating our own reference", () => {
  const AT = new Date("2026-08-21T12:00:00Z");

  test("has a stable, readable shape", () => {
    const n = generateTrackingNumber(AT, () => 0.5);
    assert.match(n, /^EDT-2608-[0-9A-Z]{6}-[0-9A-Z]$/);
    assert.ok(n.startsWith(`${TRACKING_PREFIX}-`));
  });

  test("carries the year and month, so a stale reference is obvious", () => {
    assert.ok(generateTrackingNumber(new Date("2027-01-09T00:00:00Z"), () => 0).includes("-2701-"));
  });

  test("never repeats in any realistic number of shipments", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(generateTrackingNumber());
    assert.equal(seen.size, 5000);
  });

  test("uses no character that gets misread off a printed label", () => {
    // These get read down a phone line. I/1, O/0, L and U are the pairs that
    // cost a support conversation.
    const body = generateTrackingNumber(AT, () => 0.99).split("-")[2];
    for (const c of ["I", "L", "O", "U", "0", "1"]) {
      assert.ok(!body.includes(c), `body contains ${c}`);
    }
  });

  test("survives a random() that returns exactly 1", () => {
    // Math.random() is documented as [0,1), but an injected one need not be,
    // and indexing past the end would put the string "undefined" in a
    // customer's tracking number.
    const n = generateTrackingNumber(AT, () => 1);
    assert.match(n, /^EDT-2608-[0-9A-Z]{6}-[0-9A-Z]$/);
    assert.ok(!n.includes("undefined"));
  });

  test("survives an invalid date rather than emitting EDT-NaNNaN-…", () => {
    assert.match(generateTrackingNumber(new Date("nonsense")), /^EDT-\d{4}-/);
  });

  test("the check character catches a single mistyped character", () => {
    const n = generateTrackingNumber(AT, () => 0.3);
    assert.equal(isValidInternalTracking(n), true);
    const swapped = n.slice(0, -1) + (n.endsWith("2") ? "3" : "2");
    assert.equal(isValidInternalTracking(swapped), false);
  });

  test("recognises its own shape whatever case it is typed in", () => {
    const n = generateTrackingNumber(AT, () => 0.7);
    assert.equal(looksInternal(n.toLowerCase()), true);
    assert.equal(looksInternal(`  ${n}  `), true);
  });

  test("does not mistake a real courier's number for one of ours", () => {
    for (const real of ["1Z999AA10123456784", "9400111899223197428490", "EE123456789US", ""]) {
      assert.equal(looksInternal(real), false, `${real} looked internal`);
    }
  });
});

describe("where the customer is sent", () => {
  test("a known courier and a real number produce a link", () => {
    assert.equal(
      trackingUrlFor("UPS", "1Z999AA10123456784"),
      "https://www.ups.com/track?tracknum=1Z999AA10123456784"
    );
  });

  test("the number is URL-encoded, so a stray space cannot break the link", () => {
    assert.ok(trackingUrlFor("FedEx", "123 456")?.includes("123%20456"));
  });

  test("NO LINK for a courier we hold no tracking page for", () => {
    // Better a plain string than a link that lands on an error page.
    assert.equal(trackingUrlFor("Yodel", "ABC123"), null);
    assert.equal(trackingUrlFor("Some Guy With A Van", "ABC123"), null);
  });

  test("NO LINK for our own reference, even with a real courier selected", () => {
    // The one that matters. UPS has never heard of an EDT- number; sending the
    // customer to UPS with it produces "not found", which reads as "they
    // haven't shipped it".
    const ours = generateTrackingNumber();
    assert.equal(trackingUrlFor("UPS", ours), null);
    assert.equal(trackingUrlFor("DHL Express", ours), null);
  });

  test("NO LINK without a number, or without a courier", () => {
    assert.equal(trackingUrlFor("UPS", ""), null);
    assert.equal(trackingUrlFor("UPS", null), null);
    assert.equal(trackingUrlFor(null, "1Z999AA10123456784"), null);
    assert.equal(trackingUrlFor("", "1Z999AA10123456784"), null);
  });
});
