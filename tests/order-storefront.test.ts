import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { checkoutHost } from "../lib/request-origin";
import {
  REGIONAL_SITES,
  isKnownStorefront,
  regionHome,
  storefrontLabel,
} from "../lib/regions";

/**
 * The Storefront column on the orders table: which of the regional sites an
 * order was placed through.
 *
 * The column records the HOST, not the region. The host is the fact; which
 * region it means is an interpretation that lives in lib/regions.ts and can
 * change when a storefront is added or renamed. Storing the interpretation
 * would freeze last year's reading into this year's orders.
 *
 * The Host header is attacker-controlled, so everything here is a RECORD and
 * never a decision. Nothing about the order — price, currency, legal text or
 * shipping eligibility — may be derived from it.
 */

function hosted(host: string | null): Request {
  return new Request("https://example.test/api/checkout", {
    method: "POST",
    headers: host === null ? {} : { host },
  });
}

describe("the host recorded against an order", () => {
  test("is the hostname the buyer actually checked out on", () => {
    assert.equal(checkoutHost(hosted("usa.edrifttrikes.shop")), "usa.edrifttrikes.shop");
  });

  test("is normalised so one storefront is not recorded several ways", () => {
    // Same storefront, four spellings a proxy or a browser can produce.
    for (const raw of [
      "USA.EDRIFTTRIKES.SHOP",
      "usa.edrifttrikes.shop:443",
      "usa.edrifttrikes.shop.",
      "  usa.edrifttrikes.shop  ",
    ]) {
      assert.equal(checkoutHost(hosted(raw)), "usa.edrifttrikes.shop", raw);
    }
  });

  test("takes the first host when a proxy has appended its own", () => {
    assert.equal(
      checkoutHost(hosted("usa.edrifttrikes.shop, internal.lb")),
      "usa.edrifttrikes.shop"
    );
  });

  test("is null rather than junk when there is no usable host", () => {
    assert.equal(checkoutHost(hosted(null)), null);
    assert.equal(checkoutHost(hosted("   ")), null);
  });

  test("refuses anything that is not shaped like a hostname", () => {
    // A header carrying a path, a scheme, whitespace or markup did not come
    // from a browser addressing this site, and must not reach a DB column
    // that an admin page later renders.
    for (const bad of [
      "evil.test/<script>alert(1)</script>",
      "http://usa.edrifttrikes.shop",
      "usa.edrifttrikes.shop/checkout",
      "usa edrifttrikes shop",
      "'; drop table orders; --",
    ]) {
      assert.equal(checkoutHost(hosted(bad)), null, bad);
    }
  });

  test("refuses a header carrying a newline", () => {
    // The runtime's own Headers rejects a CRLF before we ever see it, which
    // is why this one cannot go through the list above — constructing the
    // Request throws. The guard is still checked here, against a raw stub,
    // because it is what holds if this ever runs behind something laxer.
    for (const bad of [
      "usa.edrifttrikes.shop\nx-injected: 1",
      "usa.edrifttrikes.shop\r\nx-injected: 1",
    ]) {
      const raw = { headers: { get: () => bad } } as unknown as Request;
      assert.equal(checkoutHost(raw), null, JSON.stringify(bad));
    }
  });

  test("cannot grow past the longest legal hostname", () => {
    const long = "a".repeat(400) + ".edrifttrikes.shop";
    const got = checkoutHost(hosted(long));
    assert.ok(got !== null && got.length <= 253, String(got?.length));
  });
});

describe("reading a recorded host back as a storefront", () => {
  test("names every storefront we publish", () => {
    for (const region of REGIONAL_SITES) {
      const host = new URL(regionHome(region)).hostname;
      assert.equal(storefrontLabel(host), region.label, host);
      assert.ok(isKnownStorefront(host), host);
    }
  });

  test("reads the apex as the Worldwide storefront", () => {
    for (const host of ["edrifttrikes.shop", "www.edrifttrikes.shop"]) {
      assert.equal(storefrontLabel(host), "Worldwide", host);
      assert.ok(isKnownStorefront(host), host);
    }
  });

  test("shows an unrecognised host AS the host, never as a storefront", () => {
    /**
     * This is the one that matters. regionFromHost answers `global` both for
     * the apex and as its fallback for a host it does not recognise, so
     * reading its answer back here would label every spoofed Host header
     * "Worldwide" — an order from nowhere would sit in the column looking
     * like a legitimate Worldwide sale. The column has to be able to say
     * "I do not know this host".
     */
    for (const host of [
      "foo.example.com",
      "europe.edrifttrikes.shop.evil.test",
      "edrifttrikes.shop.evil.test",
      "usa.edrifttrikes.shop.attacker.test",
      "notaregion.edrifttrikes.shop",
      "edrifttrikes.shop.co",
    ]) {
      assert.equal(storefrontLabel(host), host, host);
      assert.equal(isKnownStorefront(host), false, host);
    }
  });

  test("has nothing to show when nothing was recorded", () => {
    // An order typed in by an admin, or placed before migration 0023.
    for (const empty of [null, undefined, "", "   "]) {
      assert.equal(storefrontLabel(empty), null, JSON.stringify(empty));
      assert.equal(isKnownStorefront(empty), false, JSON.stringify(empty));
    }
  });

  test("survives the round trip from header to column to label", () => {
    for (const region of REGIONAL_SITES) {
      const host = new URL(regionHome(region)).hostname;
      const recorded = checkoutHost(hosted(host.toUpperCase() + ":443"));
      assert.equal(storefrontLabel(recorded), region.label, region.key);
    }
  });
});
