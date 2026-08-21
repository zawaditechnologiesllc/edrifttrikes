import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_QUERY_LENGTH,
  normalizeQuery,
  parseCensusResponse,
  parseGooglePlaceDetails,
  parseGoogleSuggestions,
  usableQuery,
} from "../lib/address-lookup";

/**
 * Address autocomplete.
 *
 * What is worth testing here is the PARSING. The network call either reaches a
 * provider or it doesn't, and the module already treats every failure as "no
 * suggestions"; the thing that silently breaks is a field name — a provider
 * renaming `shortText`, or the street being assembled out of the wrong pieces.
 * So these run real response shapes through the parsers and check what comes
 * out is something a checkout form can actually be filled with.
 */

describe("what is worth a lookup", () => {
  test("ignores anything too short to mean an address", () => {
    // Two characters match half a city and cost a provider call per keystroke.
    assert.equal(usableQuery(""), false);
    assert.equal(usableQuery("1"), false);
    assert.equal(usableQuery("10"), false);
    assert.equal(usableQuery("100 "), false, "trimmed to three characters");
    assert.equal(usableQuery("100 D"), true);
    assert.ok(MIN_QUERY_LENGTH >= 3);
  });

  test("collapses whitespace, so the same address isn't two queries", () => {
    assert.equal(normalizeQuery("  100   Drift   Lane  "), "100 Drift Lane");
  });

  test("bounds the query, so nothing can push a giant string at a provider", () => {
    assert.ok(normalizeQuery("x".repeat(5000)).length <= 120);
  });
});

describe("Google predictions", () => {
  // The shape Places Autocomplete (New) returns for the field mask we ask for.
  const RESPONSE = {
    suggestions: [
      {
        placePrediction: {
          place: "places/ChIJ1",
          placeId: "ChIJ1",
          text: { text: "1600 Pennsylvania Avenue NW, Washington, DC, USA" },
        },
      },
      {
        placePrediction: {
          placeId: "ChIJ2",
          text: { text: "350 5th Ave, New York, NY, USA" },
        },
      },
    ],
  };

  test("reads the place id and the label a buyer reads", () => {
    assert.deepEqual(parseGoogleSuggestions(RESPONSE), [
      { id: "ChIJ1", label: "1600 Pennsylvania Avenue NW, Washington, DC, USA" },
      { id: "ChIJ2", label: "350 5th Ave, New York, NY, USA" },
    ]);
  });

  test("drops a prediction missing either half rather than rendering a blank row", () => {
    const out = parseGoogleSuggestions({
      suggestions: [
        { placePrediction: { placeId: "ok", text: { text: "10 Real St" } } },
        { placePrediction: { placeId: "", text: { text: "No id" } } },
        { placePrediction: { placeId: "no-text" } },
        { queryPrediction: { text: { text: "not an address" } } },
        {},
      ],
    });
    assert.deepEqual(out, [{ id: "ok", label: "10 Real St" }]);
  });

  test("an empty, missing or malformed response is just no suggestions", () => {
    assert.deepEqual(parseGoogleSuggestions(null), []);
    assert.deepEqual(parseGoogleSuggestions({}), []);
    assert.deepEqual(parseGoogleSuggestions({ suggestions: "nope" as never }), []);
  });
});

describe("Google place details", () => {
  const US_PLACE = {
    addressComponents: [
      { longText: "1600", shortText: "1600", types: ["street_number"] },
      { longText: "Pennsylvania Avenue Northwest", shortText: "Pennsylvania Ave NW", types: ["route"] },
      { longText: "Washington", shortText: "Washington", types: ["locality", "political"] },
      { longText: "District of Columbia", shortText: "DC", types: ["administrative_area_level_1", "political"] },
      { longText: "United States", shortText: "US", types: ["country", "political"] },
      { longText: "20500", shortText: "20500", types: ["postal_code"] },
    ],
  };

  test("fills every field the checkout form asks for", () => {
    assert.deepEqual(parseGooglePlaceDetails(US_PLACE), {
      address: "1600 Pennsylvania Avenue Northwest",
      city: "Washington",
      state: "DC",
      zip: "20500",
      country: "US",
    });
  });

  test("uses the SHORT form for state and country", () => {
    // The country select stores ISO codes, and a shipping label wants "DC",
    // not "District of Columbia".
    const out = parseGooglePlaceDetails(US_PLACE);
    assert.equal(out?.state, "DC");
    assert.equal(out?.country, "US");
  });

  test("falls back through the administrative levels for a city", () => {
    // Plenty of the world has no `locality`. Leaving the city blank would make
    // the buyer retype the one field the lookup was supposed to save them.
    const uk = parseGooglePlaceDetails({
      addressComponents: [
        { longText: "10", shortText: "10", types: ["street_number"] },
        { longText: "Downing Street", shortText: "Downing St", types: ["route"] },
        { longText: "London", shortText: "London", types: ["postal_town"] },
        { longText: "England", shortText: "England", types: ["administrative_area_level_1"] },
        { longText: "United Kingdom", shortText: "GB", types: ["country"] },
        { longText: "SW1A 2AA", shortText: "SW1A 2AA", types: ["postal_code"] },
      ],
    });
    assert.equal(uk?.city, "London");
    assert.equal(uk?.country, "GB");
    assert.equal(uk?.zip, "SW1A 2AA");
  });

  test("refuses a result with no street line", () => {
    // A city-level match would half-fill the form with something that can't be
    // delivered to, and a buyer scanning the page might not notice.
    assert.equal(
      parseGooglePlaceDetails({
        addressComponents: [
          { longText: "Paris", shortText: "Paris", types: ["locality"] },
          { longText: "France", shortText: "FR", types: ["country"] },
        ],
      }),
      null
    );
  });

  test("survives a malformed response", () => {
    assert.equal(parseGooglePlaceDetails(null), null);
    assert.equal(parseGooglePlaceDetails({}), null);
    assert.equal(parseGooglePlaceDetails({ addressComponents: [1, "x", null] as never }), null);
  });
});

describe("the keyless US fallback", () => {
  // The shape the Census Bureau geocoder returns. It hands back the street in
  // eight separate pieces, which the parser has to reassemble in order.
  const RESPONSE = {
    result: {
      addressMatches: [
        {
          matchedAddress: "1600 PENNSYLVANIA AVE NW, WASHINGTON, DC, 20500",
          addressComponents: {
            fromAddress: "1600",
            toAddress: "1698",
            preQualifier: "",
            preDirection: "",
            preType: "",
            streetName: "PENNSYLVANIA",
            suffixType: "AVE",
            suffixDirection: "NW",
            suffixQualifier: "",
            city: "WASHINGTON",
            state: "DC",
            zip: "20500",
          },
        },
      ],
    },
  };

  test("reassembles the street in the right order, and fills the rest", () => {
    assert.deepEqual(parseCensusResponse(RESPONSE), [
      {
        id: "",
        label: "1600 PENNSYLVANIA AVE NW, WASHINGTON, DC, 20500",
        prefill: {
          address: "1600 PENNSYLVANIA AVE NW",
          city: "WASHINGTON",
          state: "DC",
          zip: "20500",
          country: "US",
        },
      },
    ]);
  });

  test("carries its components inline, so picking one costs no second request", () => {
    const [first] = parseCensusResponse(RESPONSE);
    assert.ok(first.prefill, "the fallback should not need a resolve call");
    assert.equal(first.id, "", "an id would send the client off to resolve nothing");
  });

  test("keeps the directional and qualifier pieces of a street name", () => {
    const out = parseCensusResponse({
      result: {
        addressMatches: [
          {
            matchedAddress: "100 N OLD STATE HWY 1 S, SOMEWHERE, CA, 90001",
            addressComponents: {
              fromAddress: "100",
              preDirection: "N",
              preType: "OLD",
              streetName: "STATE HWY 1",
              suffixDirection: "S",
              city: "SOMEWHERE",
              state: "CA",
              zip: "90001",
            },
          },
        ],
      },
    });
    assert.equal(out[0].prefill?.address, "100 N OLD STATE HWY 1 S");
  });

  test("drops a match with no usable street rather than half-filling the form", () => {
    const out = parseCensusResponse({
      result: {
        addressMatches: [
          { matchedAddress: "SOMEWHERE, CA", addressComponents: { city: "SOMEWHERE" } },
          { addressComponents: { fromAddress: "1", streetName: "MAIN" } },
        ],
      },
    });
    assert.deepEqual(out, []);
  });

  test("no match, or a malformed response, is just no suggestions", () => {
    assert.deepEqual(parseCensusResponse({ result: { addressMatches: [] } }), []);
    assert.deepEqual(parseCensusResponse({ result: {} }), []);
    assert.deepEqual(parseCensusResponse({}), []);
    assert.deepEqual(parseCensusResponse(null), []);
  });
});

describe("what a prefill is allowed to contain", () => {
  test("every field is a plain string the checkout form can hold", () => {
    // The prefill is written straight into form state, so a null or an object
    // sneaking through would render "[object Object]" into a shipping address.
    const outputs = [
      parseGooglePlaceDetails({
        addressComponents: [
          { longText: "1", shortText: "1", types: ["street_number"] },
          { longText: "A St", shortText: "A St", types: ["route"] },
        ],
      }),
      ...parseCensusResponse({
        result: {
          addressMatches: [
            {
              matchedAddress: "1 A ST, X, CA, 1",
              addressComponents: { fromAddress: "1", streetName: "A", suffixType: "ST" },
            },
          ],
        },
      }).map((s) => s.prefill ?? null),
    ];
    for (const prefill of outputs) {
      assert.ok(prefill, "a usable street should have produced a prefill");
      for (const [key, value] of Object.entries(prefill)) {
        assert.equal(typeof value, "string", `${key} is not a string`);
      }
    }
  });
});
