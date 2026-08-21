import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  describeRange,
  dollarsToCents,
  isUnbounded,
  matchesRange,
  parsePriceRange,
  priceBands,
  rangeKey,
} from "../lib/price-filter";

/**
 * Narrowing the shop by price.
 *
 * The bands are derived from the real catalogue, which is the whole point: a
 * hard-coded ladder goes stale the first time prices move, and a buyer who
 * clicks a band and lands on an empty grid concludes the shop is broken rather
 * than that the band was empty. So the tests below care most about two things —
 * every band on screen contains something, and the ladder covers the catalogue
 * with no gaps and no double-counting.
 */

/** A plausible catalogue: gear, parts, then the trikes. */
const CATALOGUE = [1900, 4900, 8900, 29900, 89900, 129900, 189900, 249900, 349900];

describe("reading a price a person typed", () => {
  test("accepts the shapes people actually type", () => {
    assert.equal(dollarsToCents("1299"), 129900);
    assert.equal(dollarsToCents("$1,299"), 129900);
    assert.equal(dollarsToCents(" 1299.50 "), 129950);
    assert.equal(dollarsToCents("0"), 0);
  });

  test("REFUSES nonsense instead of reading it as zero", () => {
    // The failure that matters: "abc" becoming 0 would silently apply a
    // max-price filter of nothing and show an empty shop.
    for (const junk of ["abc", "", "  ", "-5", "1.999", "1e5", null, undefined, {}]) {
      assert.equal(dollarsToCents(junk), null, `${JSON.stringify(junk)} was accepted`);
    }
  });

  test("caps an absurd number rather than passing it to the database", () => {
    assert.equal(dollarsToCents("99999999999"), 100_000_000);
  });
});

describe("reading the URL", () => {
  test("no parameters means no filter", () => {
    const r = parsePriceRange({});
    assert.deepEqual(r, { min: null, max: null });
    assert.equal(isUnbounded(r), true);
    assert.equal(rangeKey(r), undefined);
  });

  test("a band parameter is cents, because we generated it", () => {
    assert.deepEqual(parsePriceRange({ price: "100000-199999" }), {
      min: 100000,
      max: 199999,
    });
  });

  test("an open-ended band has no ceiling", () => {
    assert.deepEqual(parsePriceRange({ price: "300000-" }), { min: 300000, max: null });
  });

  test("a zero floor is no floor — so the label reads 'Under $X'", () => {
    const r = parsePriceRange({ price: "0-99999" });
    assert.deepEqual(r, { min: null, max: 99999 });
    assert.equal(describeRange(r), "Under $1,000");
  });

  test("the custom form is dollars, because a person typed it", () => {
    assert.deepEqual(parsePriceRange({ min: "$1,299", max: "2000" }), {
      min: 129900,
      max: 200000,
    });
  });

  test("a reversed range is swapped, not rejected", () => {
    // Somebody who puts 2000 in "from" and 500 in "to" means the range between
    // them. Showing them an empty shop for it would be pedantry.
    assert.deepEqual(parsePriceRange({ min: "2000", max: "500" }), {
      min: 50000,
      max: 200000,
    });
  });

  test("a band wins over stale custom values", () => {
    assert.deepEqual(parsePriceRange({ price: "100000-199999", min: "9", max: "10" }), {
      min: 100000,
      max: 199999,
    });
  });

  test("garbage filters nothing rather than everything", () => {
    assert.equal(isUnbounded(parsePriceRange({ min: "abc", max: "???" })), true);
    assert.equal(isUnbounded(parsePriceRange({ price: "wat" })), true);
  });

  test("a range round-trips through its own key", () => {
    for (const key of ["0-99999", "100000-199999", "300000-"]) {
      assert.equal(rangeKey(parsePriceRange({ price: key })), key);
    }
  });
});

describe("matching a product", () => {
  test("is inclusive at both ends", () => {
    assert.equal(matchesRange(100000, { min: 100000, max: 199999 }), true);
    assert.equal(matchesRange(199999, { min: 100000, max: 199999 }), true);
    assert.equal(matchesRange(99999, { min: 100000, max: 199999 }), false);
    assert.equal(matchesRange(200000, { min: 100000, max: 199999 }), false);
  });

  test("an unbounded side does not bound", () => {
    assert.equal(matchesRange(9_999_900, { min: 300000, max: null }), true);
    assert.equal(matchesRange(100, { min: null, max: 99999 }), true);
  });

  test("everything matches no filter", () => {
    for (const p of CATALOGUE) {
      assert.equal(matchesRange(p, { min: null, max: null }), true);
    }
  });
});

describe("building the bands", () => {
  const bands = priceBands(CATALOGUE);

  test("every band on screen has something in it", () => {
    // The one that matters. An empty band is a link to an empty shop.
    assert.ok(bands.length > 1);
    for (const b of bands) assert.ok(b.count > 0, `${b.label} is empty`);
  });

  test("the bands PARTITION the catalogue — nothing lost, nothing counted twice", () => {
    // Band edges are one cent apart precisely so a product priced exactly on a
    // boundary lands in one band, not two.
    const total = bands.reduce((sum, b) => sum + b.count, 0);
    assert.equal(total, CATALOGUE.length);
    for (const price of CATALOGUE) {
      const hits = bands.filter((b) => matchesRange(price, { min: b.min, max: b.max }));
      assert.equal(hits.length, 1, `$${price / 100} matched ${hits.length} bands`);
    }
  });

  test("the cheapest and the dearest product are both reachable", () => {
    const first = bands[0];
    const last = bands[bands.length - 1];
    assert.equal(matchesRange(Math.min(...CATALOGUE), { min: first.min, max: first.max }), true);
    assert.equal(matchesRange(Math.max(...CATALOGUE), { min: last.min, max: last.max }), true);
    // Open at both extremes, so no future price can fall off either end.
    assert.equal(first.min, null);
    assert.equal(last.max, null);
  });

  test("the boundaries are round numbers, not raw arithmetic", () => {
    // "$1,000 – $2,000" reads as a decision. "$1,067 – $2,134" reads as a bug.
    for (const b of bands) {
      assert.doesNotMatch(b.label, /\.\d/, `${b.label} has cents in it`);
      assert.match(b.label, /^(Under \$[\d,]+|\$[\d,]+ – \$[\d,]+|\$[\d,]+ & up)$/);
    }
  });

  test("each key round-trips to the range it describes", () => {
    for (const b of bands) {
      assert.deepEqual(parsePriceRange({ price: b.key }), { min: b.min, max: b.max });
    }
  });

  test("no ladder at all when a ladder would be meaningless", () => {
    // A single band covering everything is a control that does nothing, and it
    // is better not to draw one.
    assert.deepEqual(priceBands([]), []);
    assert.deepEqual(priceBands([29900]), []);
    assert.deepEqual(priceBands([29900, 89900]), []);
    assert.deepEqual(priceBands([29900, 29900, 29900, 29900]), []);
  });

  test("copes with a catalogue priced within a few dollars", () => {
    const tight = [129900, 134900, 139900, 141900];
    const b = priceBands(tight);
    assert.ok(b.length > 1, "a tight cluster still divides");
    assert.equal(b.reduce((s, x) => s + x.count, 0), tight.length);
  });

  test("copes with free items and with one very expensive one", () => {
    const odd = [0, 0, 1900, 4900, 999900];
    const b = priceBands(odd);
    assert.equal(b.reduce((s, x) => s + x.count, 0), odd.length);
    for (const x of b) assert.ok(x.count > 0);
  });

  test("never runs away on a catalogue with a huge spread", () => {
    const spread = [100, 500, 1000, 50000, 5_000_000];
    assert.ok(priceBands(spread).length <= 13);
  });
});

describe("what the shopper is told", () => {
  test("describes the active range in words", () => {
    assert.equal(describeRange({ min: null, max: 99999 }), "Under $1,000");
    assert.equal(describeRange({ min: 50000, max: 200000 }), "$500 – $2,000");
    assert.equal(describeRange({ min: 300000, max: null }), "$3,000 & up");
  });

  test("says nothing when nothing is filtered", () => {
    assert.equal(describeRange({ min: null, max: null }), null);
  });
});
