import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { regionForCountry, switchSuggestion, switchUrl } from "../lib/geo";
import { REGIONAL_SITES, REGIONS } from "../lib/regions";

/**
 * NOTICING A VISITOR IS ON THE WRONG STOREFRONT.
 *
 * Each team hands out their own subdomain, so people arrive on a storefront
 * that has nothing to do with where they are — a European clicking the USA
 * team's Instagram link is the ordinary case, not the edge case.
 *
 * The failure that matters is not a missed suggestion. It is a banner that
 * fires when it should not: shown often enough, people dismiss the whole strip
 * without reading it, and that strip is where the shipping exclusions and the
 * "charged in US dollars" line live. So most of these assert SILENCE.
 */

describe("which storefront serves a country", () => {
  test("the obvious ones", () => {
    assert.equal(regionForCountry("US")?.key, "usa");
    assert.equal(regionForCountry("CA")?.key, "canada");
    assert.equal(regionForCountry("AE")?.key, "uae");
    assert.equal(regionForCountry("DE")?.key, "europe");
  });

  test("the US distributor covers the territories too", () => {
    for (const code of ["PR", "VI", "GU", "AS", "MP"]) {
      assert.equal(regionForCountry(code)?.key, "usa", code);
    }
  });

  test("the UAE storefront covers the Gulf, and only the Gulf", () => {
    // Its own blurb says "covering the Gulf". The six GCC states — not "the
    // Middle East", because that distributor does not serve Lebanon or Jordan
    // and suggesting otherwise would be a promise nobody made.
    for (const code of ["AE", "SA", "KW", "QA", "BH", "OM"]) {
      assert.equal(regionForCountry(code)?.key, "uae", code);
    }
    for (const code of ["LB", "JO", "IL", "EG", "IQ", "IR"]) {
      assert.notEqual(regionForCountry(code)?.key, "uae", code);
    }
  });

  test("Europe is geographic, so it includes the non-EU ones", () => {
    // The storefront is a distributor and a currency to think in, not a legal
    // classification — a Swiss or Norwegian buyer wants both.
    for (const code of ["CH", "NO", "IS", "GB", "RS", "UA", "AD"]) {
      assert.equal(regionForCountry(code)?.key, "europe", code);
    }
  });

  test("everywhere else is the worldwide storefront", () => {
    for (const code of ["KE", "ZA", "BR", "JP", "AU", "SG", "MX"]) {
      assert.equal(regionForCountry(code)?.key, "global", code);
    }
  });

  test("NO SIGNAL IS NOT THE SAME AS NOWHERE IN PARTICULAR", () => {
    // "XX" is Cloudflare saying it could not place the visitor and "T1" is
    // Tor. Treating either as a country would suggest a storefront on the
    // strength of nothing.
    for (const code of ["XX", "T1", "", "   ", "USA", "u", "1", null, undefined]) {
      assert.equal(regionForCountry(code as string), null, String(code));
    }
  });

  test("case and whitespace do not matter", () => {
    assert.equal(regionForCountry(" de ")?.key, "europe");
    assert.equal(regionForCountry("gb")?.key, "europe");
  });
});

describe("when to say something", () => {
  test("THE CASE THIS EXISTS FOR: a European on the USA storefront", () => {
    const hit = switchSuggestion(REGIONS.usa, "DE");
    assert.ok(hit);
    assert.equal(hit!.region.key, "europe");
    assert.equal(hit!.countryCode, "DE");
  });

  test("and says nothing to an American on it", () => {
    assert.equal(switchSuggestion(REGIONS.usa, "US"), null);
  });

  test("every storefront stays quiet for its own country", () => {
    for (const [code, key] of [
      ["US", "usa"],
      ["CA", "canada"],
      ["AE", "uae"],
      ["FR", "europe"],
      ["KE", "global"],
    ] as const) {
      assert.equal(switchSuggestion(REGIONS[key], code), null, `${code} on ${key}`);
    }
  });

  test("NOTHING IS SAID WITHOUT A COUNTRY", () => {
    // Off Cloudflare — local development, a plain Node host — there is no
    // country at all, and a banner built on a guess about a guess is worse
    // than no banner.
    for (const region of REGIONAL_SITES) {
      for (const bad of [null, undefined, "", "XX", "T1"]) {
        assert.equal(switchSuggestion(region, bad), null, `${region.key} / ${bad}`);
      }
    }
  });

  test("the worldwide storefront is not pushed at people it does not help", () => {
    // Somebody in Kenya on the apex or on global. is already in the right
    // place; a banner there is pure noise.
    assert.equal(switchSuggestion(REGIONS.global, "KE"), null);
    assert.equal(switchSuggestion(REGIONS.global, "BR"), null);
  });

  test("but IS offered to someone stranded on a regional storefront", () => {
    // A Kenyan reading "Served by our United States distributor" is reading
    // something untrue about their own order.
    const hit = switchSuggestion(REGIONS.usa, "KE");
    assert.ok(hit);
    assert.equal(hit!.region.key, "global");
  });

  test("every suggestion points somewhere else", () => {
    // A suggestion to switch to where you already are is a bug that reads as
    // a broken site.
    for (const region of [...REGIONAL_SITES, REGIONS.global]) {
      for (const code of ["US", "CA", "AE", "DE", "KE", "JP", "SA", "GB"]) {
        const hit = switchSuggestion(region, code);
        if (hit) assert.notEqual(hit.region.key, region.key, `${code} on ${region.key}`);
      }
    }
  });
});

describe("where the switch link goes", () => {
  test("THE SAME PAGE, ON THE OTHER STOREFRONT", () => {
    // Losing someone's place costs more than the currency line gains.
    assert.equal(
      switchUrl(REGIONS.europe, "/product/voltage-drift"),
      "https://europe.edrifttrikes.shop/product/voltage-drift"
    );
    assert.equal(switchUrl(REGIONS.uae, "/shop"), "https://uae.edrifttrikes.shop/shop");
  });

  test("the homepage stays the homepage", () => {
    assert.equal(switchUrl(REGIONS.canada, "/"), "https://canada.edrifttrikes.shop/");
    assert.equal(switchUrl(REGIONS.canada, ""), "https://canada.edrifttrikes.shop/");
  });

  test("a query string or hash is dropped", () => {
    // They carry a filter or a campaign tag from the storefront being left,
    // and neither is guaranteed to mean the same thing on the new one.
    assert.equal(
      switchUrl(REGIONS.europe, "/shop?category=trikes&utm_source=ig"),
      "https://europe.edrifttrikes.shop/shop"
    );
    assert.equal(switchUrl(REGIONS.europe, "/shop#specs"), "https://europe.edrifttrikes.shop/shop");
  });

  test("a path without its leading slash still produces a valid URL", () => {
    assert.equal(switchUrl(REGIONS.usa, "shop"), "https://usa.edrifttrikes.shop/shop");
  });

  test("every storefront has a reachable switch URL", () => {
    for (const region of [...REGIONAL_SITES, REGIONS.global]) {
      const url = switchUrl(region, "/cart");
      assert.match(url, /^https:\/\//, region.key);
      assert.equal(new URL(url).pathname, "/cart", region.key);
    }
  });
});
