import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  BLOCKED_MESSAGE,
  COUNTRY_HEADER,
  DEFAULT_BLOCKED_COUNTRIES,
  countryFromHeaders,
  isApiPath,
  isBlockedCountry,
  isExemptPath,
  parseBlockedCountries,
} from "../lib/geo";
import { countries, isKnownCountry, normalizeCountry } from "../lib/countries";
import { blockedCountriesRaw } from "../lib/env";

/**
 * Refusing business from a set of countries.
 *
 * Two failure modes, and they are not equally bad. Letting a blocked visitor
 * through costs a chargeback. Blocking a paying customer by accident costs the
 * sale AND the customer, silently, with no error anyone will ever see. So the
 * tests below lean hard on the second: unknown countries are served, exempt
 * paths stay reachable, and nothing but an exact two-letter match is refused.
 */

/** Stand-in for the Headers object middleware is handed. */
const headers = (values: Record<string, string>) => ({
  get: (name: string) => values[name.toLowerCase()] ?? null,
});

describe("the configured list", () => {
  test("blocks India, Pakistan and Bangladesh out of the box", () => {
    assert.deepEqual([...DEFAULT_BLOCKED_COUNTRIES], ["IN", "PK", "BD"]);
  });

  test("an ABSENT variable falls back to the default", () => {
    // Forgetting to set the variable must not quietly disable the block.
    assert.deepEqual(parseBlockedCountries(undefined), ["IN", "PK", "BD"]);
    assert.deepEqual(parseBlockedCountries(null), ["IN", "PK", "BD"]);
  });

  test("an EMPTY variable blocks nothing — that has to be expressible", () => {
    // The way to turn the block off in a hurry, without a deploy.
    assert.deepEqual(parseBlockedCountries(""), []);
    assert.deepEqual(parseBlockedCountries("   "), []);
  });

  test("reads commas, spaces and newlines alike", () => {
    assert.deepEqual(parseBlockedCountries("IN,PK"), ["IN", "PK"]);
    assert.deepEqual(parseBlockedCountries("IN PK"), ["IN", "PK"]);
    assert.deepEqual(parseBlockedCountries("IN,\n  PK ,BD"), ["IN", "PK", "BD"]);
  });

  test("normalises case and drops duplicates", () => {
    assert.deepEqual(parseBlockedCountries("in,In,IN"), ["IN"]);
  });

  test("ignores anything that is not an ISO alpha-2 code", () => {
    // A typo in a dashboard variable must not become a country.
    assert.deepEqual(parseBlockedCountries("IN, INDIA, 99, P, ??, BD"), ["IN", "BD"]);
    assert.deepEqual(parseBlockedCountries("nonsense"), []);
  });
});

describe("deciding whether a visitor is blocked", () => {
  const blocked = ["IN", "PK", "BD"];

  test("matches a listed country whatever case it arrives in", () => {
    assert.equal(isBlockedCountry("IN", blocked), true);
    assert.equal(isBlockedCountry("in", blocked), true);
    assert.equal(isBlockedCountry(" pk ", blocked), true);
  });

  test("serves everyone else", () => {
    for (const code of ["US", "GB", "CA", "AU", "NP", "LK", "AE"]) {
      assert.equal(isBlockedCountry(code, blocked), false, `${code} was blocked`);
    }
  });

  test("an UNKNOWN country is served, never refused", () => {
    // The whole point: a geo lookup that fails is a lost sale if it defaults
    // to "block". It must default to "serve".
    assert.equal(isBlockedCountry(null, blocked), false);
    assert.equal(isBlockedCountry(undefined, blocked), false);
    assert.equal(isBlockedCountry("", blocked), false);
  });

  test("does not match on a prefix or a longer string", () => {
    // "IND" is not "IN"; a substring match here would block Indonesia's "ID"
    // neighbours and anything else that happened to start with the letters.
    assert.equal(isBlockedCountry("IND", blocked), false);
    assert.equal(isBlockedCountry("I", blocked), false);
  });

  test("an empty list blocks nobody", () => {
    assert.equal(isBlockedCountry("IN", []), false);
  });
});

describe("paths the block must never touch", () => {
  test("the explanation page itself, or it loops forever", () => {
    assert.equal(isExemptPath("/unavailable"), true);
  });

  test("payment callbacks — the money has already moved", () => {
    // Refusing a webhook does not prevent a payment, it loses the order.
    assert.equal(isExemptPath("/api/paypal/webhook"), true);
    assert.equal(isExemptPath("/api/internal/stripe-paid"), true);
  });

  test("the cron and health endpoints, which exist to be reachable", () => {
    assert.equal(isExemptPath("/api/cron/fulfillment"), true);
    assert.equal(isExemptPath("/api/health"), true);
    assert.equal(isExemptPath("/api/health/address"), true);
  });

  test("static assets", () => {
    for (const path of [
      "/_next/static/chunk.js",
      "/assets/edrift-logo.svg",
      "/favicon.ico",
      "/icon.svg",
      "/robots.txt",
      "/sitemap.xml",
    ]) {
      assert.equal(isExemptPath(path), true, `${path} was not exempt`);
    }
  });

  test("the storefront is NOT exempt — otherwise there is no block", () => {
    for (const path of ["/", "/shop", "/product/voltage-drift", "/checkout", "/api/checkout"]) {
      assert.equal(isExemptPath(path), false, `${path} slipped through`);
    }
  });

  test("an api path that merely CONTAINS an exempt word is still blocked", () => {
    // Prefix matching, not substring: "/api/cart/health-check" is not a health
    // endpoint and must not inherit its exemption.
    assert.equal(isExemptPath("/api/cart/health-check"), false);
    assert.equal(isExemptPath("/shop/unavailable"), false);
  });
});

describe("reading the country off the request", () => {
  test("takes Cloudflare's header", () => {
    assert.equal(countryFromHeaders(headers({ [COUNTRY_HEADER]: "IN" })), "IN");
  });

  test("uppercases and trims, because headers are not trustworthy", () => {
    assert.equal(countryFromHeaders(headers({ [COUNTRY_HEADER]: " pk " })), "PK");
  });

  test("XX and T1 mean UNKNOWN, not a country", () => {
    // XX is Cloudflare's reserved/unknown value and T1 is Tor. Treating either
    // as a country would compare a placeholder against the block list.
    assert.equal(countryFromHeaders(headers({ [COUNTRY_HEADER]: "XX" })), null);
    assert.equal(countryFromHeaders(headers({ [COUNTRY_HEADER]: "T1" })), null);
  });

  test("a missing or malformed header is unknown", () => {
    assert.equal(countryFromHeaders(headers({})), null);
    assert.equal(countryFromHeaders(headers({ [COUNTRY_HEADER]: "" })), null);
    assert.equal(countryFromHeaders(headers({ [COUNTRY_HEADER]: "INDIA" })), null);
  });

  test("an unknown visitor is therefore SERVED", () => {
    // Reading the two functions together, which is how middleware uses them.
    const country = countryFromHeaders(headers({ [COUNTRY_HEADER]: "XX" }));
    assert.equal(isBlockedCountry(country, ["IN", "PK", "BD"]), false);
  });
});

describe("the checkout country list", () => {
  /**
   * The layer a VPN cannot get around. The middleware block is about where the
   * browser is; this is about where the goods are going, and a shipping address
   * has to be a real place the store is willing to send a crate to.
   */

  test("does not offer a blocked country as a destination", () => {
    const codes = new Set(countries().map((c) => c.code));
    for (const code of DEFAULT_BLOCKED_COUNTRIES) {
      assert.equal(codes.has(code), false, `${code} is still in the select`);
    }
  });

  test("rejects one submitted by name, so a crafted POST fails too", () => {
    for (const name of ["India", "Pakistan", "Bangladesh"]) {
      assert.equal(isKnownCountry(name), false, `${name} was accepted`);
      assert.equal(normalizeCountry(name), null, `${name} normalised`);
    }
  });

  test("still ships to everywhere else, including the neighbours", () => {
    // The block is three countries, not a region. Getting this wrong would
    // quietly delete a chunk of the addressable market.
    for (const name of ["Nepal", "Sri Lanka", "United States", "United Kingdom"]) {
      assert.equal(isKnownCountry(name), true, `${name} was lost`);
    }
    assert.ok(countries().length > 200, `only ${countries().length} countries left`);
  });
});

describe("what a refused request gets back", () => {
  test("an API path is answered with JSON, not the page", () => {
    // A rewrite sends a POST to a page with no POST handler: 405 and HTML,
    // which the checkout form would surface as a bug rather than a refusal.
    assert.equal(isApiPath("/api/checkout"), true);
    assert.equal(isApiPath("/api/cart/recover"), true);
  });

  test("a page path is not", () => {
    assert.equal(isApiPath("/"), false);
    assert.equal(isApiPath("/checkout"), false);
    assert.equal(isApiPath("/apiary"), false);
  });

  test("the wording accuses nobody and names no country", () => {
    // Most people who see this are ordinary customers, not carders.
    assert.ok(BLOCKED_MESSAGE.length > 0);
    assert.doesNotMatch(BLOCKED_MESSAGE, /fraud|stolen|India|Pakistan|Bangladesh|banned/i);
  });
});

describe("reading the variable", () => {
  /**
   * An EMPTY list and an ABSENT one mean different things, and the ordinary
   * env reader cannot tell them apart — it treats empty as missing, which is
   * right for an API key and wrong for a list that is allowed to be empty.
   */
  const restore = process.env.BLOCKED_COUNTRIES;
  const after = () => {
    if (restore === undefined) delete process.env.BLOCKED_COUNTRIES;
    else process.env.BLOCKED_COUNTRIES = restore;
  };

  test("an empty variable survives as an empty string, not as 'unset'", () => {
    try {
      process.env.BLOCKED_COUNTRIES = "";
      assert.equal(blockedCountriesRaw(), "");
      // Which is what makes "block nothing" reachable without a deploy.
      assert.deepEqual(parseBlockedCountries(blockedCountriesRaw()), []);
    } finally {
      after();
    }
  });

  test("a configured list is read verbatim", () => {
    try {
      process.env.BLOCKED_COUNTRIES = "IN,NG";
      assert.deepEqual(parseBlockedCountries(blockedCountriesRaw()), ["IN", "NG"]);
    } finally {
      after();
    }
  });

  test("an unset variable falls back to the default", () => {
    try {
      delete process.env.BLOCKED_COUNTRIES;
      assert.equal(blockedCountriesRaw(), undefined);
      assert.deepEqual(parseBlockedCountries(blockedCountriesRaw()), ["IN", "PK", "BD"]);
    } finally {
      after();
    }
  });
});
