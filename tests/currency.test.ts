import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  DISPLAY_CURRENCIES,
  RATES,
  RATES_AS_OF,
  RATE_MAX_AGE_DAYS,
  SETTLEMENT_CURRENCY,
  approximate,
  convert,
  currencyNoteFor,
  formatIn,
  isDisplayCurrency,
  ratesAreStale,
  roundForDisplay,
} from "../lib/currency";
import { NOT_SHIPPED_CODES, allCountries, countries, countryName, shipsTo } from "../lib/countries";

/**
 * SHOWING A PRICE YOU DO NOT CHARGE.
 *
 * Every price is stored in US cents and every payment settles in US dollars.
 * The regional storefronts quote in CAD, AED and EUR, which is a display
 * convenience and nothing more — and the failure mode is not a rounding error,
 * it is a buyer who believes the euro number is what leaves their account.
 *
 * So the tests that matter are about honesty: the word "approx." is always
 * present, the dollar settlement is always stated, and a rate too old to stand
 * behind produces NO second number rather than a stale one.
 */

const FRESH = new Date(RATES_AS_OF.getTime() + 86_400_000);
const STALE = new Date(RATES_AS_OF.getTime() + (RATE_MAX_AGE_DAYS + 1) * 86_400_000);

describe("what is charged, versus what is shown", () => {
  test("the shop settles in one currency, and it is dollars", () => {
    assert.equal(SETTLEMENT_CURRENCY, "USD");
    assert.equal(RATES.USD, 1);
  });

  test("a dollar storefront gets no second price at all", () => {
    // Nothing to convert, so nothing to misread.
    assert.equal(convert(189900, "USD", FRESH), null);
    assert.equal(approximate(189900, "USD", FRESH), null);
  });

  test("converts to each quoted currency", () => {
    assert.equal(convert(100_00, "AED", FRESH), Math.round(10000 * RATES.AED));
    assert.equal(convert(100_00, "EUR", FRESH), Math.round(10000 * RATES.EUR));
    assert.equal(convert(100_00, "CAD", FRESH), Math.round(10000 * RATES.CAD));
  });

  test("THE WORD APPROX. IS PART OF THE OUTPUT", () => {
    // Two prices and no indication of which one is taken is the whole risk.
    for (const code of ["EUR", "CAD", "AED"]) {
      const text = approximate(189900, code, FRESH);
      assert.ok(text, code);
      assert.match(text!, /^approx\. /, `${code}: ${text}`);
    }
  });

  test("every note says the charge is in US dollars", () => {
    for (const code of DISPLAY_CURRENCIES) {
      assert.match(currencyNoteFor(code, FRESH), /US dollars/, code);
    }
  });

  test("an unknown currency is simply not shown", () => {
    for (const bad of ["GBP", "", "usd ", "xyz", null, undefined]) {
      assert.equal(convert(1000, bad as string, FRESH), null, String(bad));
    }
    assert.match(currencyNoteFor("GBP", FRESH), /US dollars/);
  });

  test("a bad amount produces nothing rather than a nonsense price", () => {
    for (const bad of [Number.NaN, Infinity, -Infinity]) {
      assert.equal(convert(bad, "EUR", FRESH), null, String(bad));
    }
  });
});

describe("a rate that has gone stale", () => {
  test("stops being shown rather than being shown wrong", () => {
    // Four months of EUR movement is several percent — enough that a buyer
    // comparing the numbers would notice, and noticing costs the sale.
    assert.equal(ratesAreStale(FRESH), false);
    assert.equal(ratesAreStale(STALE), true);
    assert.equal(convert(189900, "EUR", STALE), null);
    assert.equal(approximate(189900, "CAD", STALE), null);
  });

  test("and the note stops promising a conversion", () => {
    const note = currencyNoteFor("EUR", STALE);
    assert.match(note, /US dollars/);
    assert.ok(!/approximate/i.test(note), note);
  });

  test("A PEGGED CURRENCY DOES NOT EXPIRE", () => {
    // The dirham has been fixed to the dollar since 1997. Hiding it after four
    // months would be treating a constant as a guess.
    assert.equal(RATES.AED, 3.6725);
    assert.ok(convert(189900, "AED", STALE) !== null);
    assert.match(currencyNoteFor("AED", STALE), /pegged/i);
  });

  test("a clock that reads before the rates were set is stale too", () => {
    const before = new Date(RATES_AS_OF.getTime() - 86_400_000);
    assert.equal(ratesAreStale(before), true);
  });
});

describe("how the number reads", () => {
  test("rounds to something a price tag would say", () => {
    assert.equal(roundForDisplay(174_708), 174_700);
    assert.equal(roundForDisplay(174_751), 174_800);
  });

  test("formats with the currency's own symbol", () => {
    assert.match(formatIn(174_700, "EUR"), /€/);
    assert.match(formatIn(174_700, "AED"), /AED|د\.إ/);
  });

  test("NO QUOTED CURRENCY RENDERS AS A BARE DOLLAR SIGN", () => {
    // The approximate price sits directly under the dollar price that is
    // actually charged. A second "$1,899" there says nothing — and in en-CA
    // the Canadian dollar renders exactly that way, which is why the locale
    // table does not use it.
    for (const code of DISPLAY_CURRENCIES) {
      if (code === SETTLEMENT_CURRENCY) continue;
      const text = formatIn(174_700, code);
      assert.ok(
        !/^\$/.test(text.trim()),
        `${code} renders as "${text}" — indistinguishable from the USD price`
      );
    }
    assert.match(formatIn(174_700, "CAD"), /CA\$/);
  });

  test("only the four quoted currencies are accepted", () => {
    for (const c of DISPLAY_CURRENCIES) assert.equal(isDisplayCurrency(c), true, c);
    for (const c of ["GBP", "JPY", "usd", "", null]) {
      assert.equal(isDisplayCurrency(c), false, String(c));
    }
  });
});

describe("the countries this shop will not ship to", () => {
  test("Nigeria and India are not offered at checkout", () => {
    const offered = countries().map((c) => c.code);
    assert.ok(!offered.includes("NG"), "Nigeria is still in the picker");
    assert.ok(!offered.includes("IN"), "India is still in the picker");
  });

  test("but they are still in the FULL list, so old orders still render", () => {
    // An order placed before the exclusion still needs a country name, a flag
    // and a delivery band in the admin.
    const all = allCountries().map((c) => c.code);
    assert.ok(all.includes("NG"));
    assert.ok(all.includes("IN"));
    assert.equal(countryName("NG"), "Nigeria");
    assert.equal(countryName("IN"), "India");
  });

  test("shipsTo refuses them by code and by name, in any casing", () => {
    for (const v of ["NG", "ng", "Nigeria", " nigeria ", "IN", "India"]) {
      assert.equal(shipsTo(v), false, v);
    }
  });

  test("AND DOES NOT CATCH THEIR NEIGHBOURS", () => {
    // A sloppy match here quietly loses real markets: Niger, Indonesia and
    // India's neighbours are all still sold to.
    for (const v of ["NE", "Niger", "ID", "Indonesia", "PK", "Pakistan", "BD", "Bangladesh"]) {
      assert.equal(shipsTo(v), true, v);
    }
  });

  test("the picker is the full list minus exactly the exclusions", () => {
    assert.equal(countries().length, allCountries().length - NOT_SHIPPED_CODES.length);
  });

  test("nothing is a destination", () => {
    assert.equal(shipsTo(""), false);
    assert.equal(shipsTo(null), false);
    assert.equal(shipsTo(undefined), false);
  });
});
