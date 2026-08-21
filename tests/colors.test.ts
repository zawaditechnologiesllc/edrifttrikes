import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseProductText } from "../lib/product-import";
import * as colors from "../lib/colors";
import {
  MAX_COLORS,
  colorKey,
  formatColors,
  matchColor,
  parseColors,
  productColors,
  requiresColorChoice,
} from "../lib/colors";

/**
 * Product colours parsed from the admin's text sheet.
 *
 * Two things must hold: an admin typing a product sheet by hand shouldn't have
 * to remember a syntax, and a buyer must never be able to order a colour the
 * product doesn't come in.
 */

describe("parseColors", () => {
  test("reads a plain comma-separated list", () => {
    assert.deepEqual(parseColors("Midnight Black, Voltage Blue, Hazard Lime"), [
      { name: "Midnight Black", hex: null },
      { name: "Voltage Blue", hex: null },
      { name: "Hazard Lime", hex: null },
    ]);
  });

  test("picks up a hex however the admin wrote it", () => {
    // All three are things a person actually types.
    for (const input of [
      "Voltage Blue #1e5bff",
      "#1e5bff Voltage Blue",
      "Voltage Blue (#1e5bff)",
      "Voltage Blue [#1e5bff]",
    ]) {
      assert.deepEqual(
        parseColors(input),
        [{ name: "Voltage Blue", hex: "#1e5bff" }],
        `failed on: ${input}`
      );
    }
  });

  test("expands shorthand hex so CSS and comparisons see one form", () => {
    assert.deepEqual(parseColors("Red #f00"), [{ name: "Red", hex: "#ff0000" }]);
  });

  test("accepts semicolons and newlines as separators", () => {
    assert.equal(parseColors("Black; White\nLime").length, 3);
  });

  test("a colour without a hex still works — it just has no swatch", () => {
    assert.deepEqual(parseColors("Gunmetal"), [{ name: "Gunmetal", hex: null }]);
  });

  test("drops duplicates, keeping the first", () => {
    const out = parseColors("Black #000000, black, BLACK #ffffff");
    assert.equal(out.length, 1);
    assert.equal(out[0].name, "Black");
    assert.equal(out[0].hex, "#000000");
  });

  test("ignores empty entries from trailing or doubled separators", () => {
    assert.equal(parseColors("Black, , White,,").length, 2);
  });

  test("returns nothing for absent or blank input", () => {
    assert.deepEqual(parseColors(null), []);
    assert.deepEqual(parseColors(undefined), []);
    assert.deepEqual(parseColors("   "), []);
    assert.deepEqual(parseColors(",,,"), []);
  });

  test("caps the list — a hundred colours is a mistake, not a range", () => {
    const many = Array.from({ length: 50 }, (_, i) => `Colour ${i}`).join(", ");
    assert.equal(parseColors(many).length, MAX_COLORS);
  });

  test("bounds a runaway name rather than storing it whole", () => {
    const out = parseColors("x".repeat(200));
    assert.ok(out[0].name.length <= 40);
  });
});

describe("productColors", () => {
  test("reads the stored jsonb shape", () => {
    assert.deepEqual(
      productColors([{ name: "Voltage Blue", hex: "#1e5bff" }]),
      [{ name: "Voltage Blue", hex: "#1e5bff" }]
    );
  });

  test("tolerates a plain array of strings", () => {
    assert.deepEqual(productColors(["Black", "White"]), [
      { name: "Black", hex: null },
      { name: "White", hex: null },
    ]);
  });

  test("tolerates a raw string, as if it came straight from the sheet", () => {
    assert.deepEqual(productColors("Black #000"), [{ name: "Black", hex: "#000000" }]);
  });

  test("a hand-edited or malformed row must not break a product page", () => {
    assert.deepEqual(productColors(null), []);
    assert.deepEqual(productColors(42), []);
    assert.deepEqual(productColors({}), []);
    assert.deepEqual(productColors([null, 7, { nope: 1 }]), []);
    assert.deepEqual(productColors([{ name: "Black", hex: "not-a-hex" }]), [
      { name: "Black", hex: null },
    ]);
  });
});

describe("matchColor", () => {
  const COLORS = parseColors("Midnight Black #101010, Voltage Blue #1e5bff");

  test("matches case- and space-insensitively", () => {
    assert.equal(matchColor(COLORS, "voltage blue"), "Voltage Blue");
    assert.equal(matchColor(COLORS, "  VOLTAGE   BLUE  "), "Voltage Blue");
  });

  test("returns the PRODUCT's spelling, so the order reads consistently", () => {
    assert.equal(matchColor(COLORS, "midnight black"), "Midnight Black");
  });

  test("REFUSES a colour the product doesn't come in", () => {
    // The checkout API relies on this: a crafted request must not be able to
    // order a variant that doesn't exist.
    assert.equal(matchColor(COLORS, "Chrome"), null);
    assert.equal(matchColor(COLORS, ""), null);
    assert.equal(matchColor(COLORS, null), null);
    assert.equal(matchColor(COLORS, undefined), null);
  });

  test("a product with no colours matches nothing", () => {
    assert.equal(matchColor([], "Black"), null);
  });
});

describe("round-tripping and helpers", () => {
  test("formatColors survives a parse round trip", () => {
    const line = "Midnight Black #101010, Voltage Blue #1e5bff, Gunmetal";
    assert.equal(formatColors(parseColors(line)), line);
  });

  test("colorKey normalises for comparison", () => {
    assert.equal(colorKey("  Voltage   Blue "), "voltage blue");
  });

  test("a choice is only required when the product offers colours", () => {
    assert.equal(requiresColorChoice([]), false);
    assert.equal(requiresColorChoice(parseColors("Black")), true);
  });
});

describe("colours from the admin .txt sheet", () => {
  test("reads a single comma-separated line", () => {
    const p = parseProductText("Colors: Midnight Black #101010, Voltage Blue");
    assert.deepEqual(parseColors(p.fields.colors).map((c) => c.name), [
      "Midnight Black",
      "Voltage Blue",
    ]);
  });

  test("accepts the British spelling", () => {
    const p = parseProductText("Colours: Gunmetal");
    assert.equal(parseColors(p.fields.colors)[0].name, "Gunmetal");
    assert.deepEqual(p.unknownKeys, [], "Colours: was reported as an unknown key");
  });

  test("keeps colours written one per line, with or without bullets", () => {
    // An admin writing a product sheet naturally lists these vertically.
    // Dropping those lines silently lost colours with no warning.
    const p = parseProductText(
      ["Colors: Midnight Black", "Voltage Blue", "- Hazard Lime", "* Gunmetal"].join("\n")
    );
    assert.deepEqual(parseColors(p.fields.colors).map((c) => c.name), [
      "Midnight Black",
      "Voltage Blue",
      "Hazard Lime",
      "Gunmetal",
    ]);
  });

  test("a blank line ends the list, so following prose isn't swallowed", () => {
    const p = parseProductText(
      [
        "Colors: Black",
        "White",
        "",
        "Description: This paragraph must not become a colour.",
      ].join("\n")
    );
    assert.deepEqual(parseColors(p.fields.colors).map((c) => c.name), ["Black", "White"]);
    assert.match(p.fields.description, /must not become a colour/);
  });

  test("a sheet with no colours leaves the product without any", () => {
    const p = parseProductText("Name: Volt S1 Pro\nPrice: 100");
    assert.deepEqual(parseColors(p.fields.colors), []);
    assert.equal(requiresColorChoice(parseColors(p.fields.colors)), false);
  });

  test("the downloadable template demonstrates the Colors line", async () => {
    const { PRODUCT_TEMPLATE } = await import("../lib/product-import");
    const p = parseProductText(PRODUCT_TEMPLATE);
    assert.ok(
      parseColors(p.fields.colors).length >= 2,
      "the template should show a working colour list"
    );
  });
});

describe("colours already sitting in a product's description", () => {
  /**
   * Products uploaded before colours had a column of their own kept their
   * `Colors:` line as ordinary description text. The information was in the
   * database all along — it was just never read. This is what makes the picker
   * appear on those products with no re-upload and no migration.
   */
  const { colorsFromDescription, descriptionBody, productColorOptions } = colors;

  test("reads a colour line written among the prose", () => {
    const names = colorsFromDescription(
      "A rear-wheel-drive drift trike.\n\nColors: Midnight Black #101010, Voltage Blue\n\nShips in a crate."
    ).map((c) => c.name);
    assert.deepEqual(names, ["Midnight Black", "Voltage Blue"]);
  });

  test("finds the heading wherever it sits, not just on the first line", () => {
    // The regex needs the multiline flag: a description almost never opens
    // with its colour list.
    assert.equal(colorsFromDescription("Built in-house.\n\nColours:\n- Gunmetal\n").length, 1);
  });

  test("handles one colour per line, bulleted or not, either spelling", () => {
    const names = colorsFromDescription(
      "Built in-house.\n\nAvailable colours:\n- Midnight Black\n- Voltage Blue\n* Hazard Lime\n\nShips flat."
    ).map((c) => c.name);
    assert.deepEqual(names, ["Midnight Black", "Voltage Blue", "Hazard Lime"]);
  });

  test("STOPS at prose when the list runs straight into a sentence", () => {
    // A deliberate upload can trust every line after `Colors:`; a stored
    // description cannot — there may be no blank line before the prose resumes,
    // and "Weighs 42kg and ships in a crate." must never become a buyable
    // colour.
    const names = colorsFromDescription(
      "Colors: Black, Red\nWeighs 42kg and ships in a crate to your door."
    ).map((c) => c.name);
    assert.deepEqual(names, ["Black", "Red"]);
  });

  test("is not fooled by the word colour used in ordinary prose", () => {
    assert.deepEqual(
      colorsFromDescription("The frame colour is applied by powder coating after welding."),
      []
    );
    assert.deepEqual(colorsFromDescription("A 3000W hub motor and a 60V pack."), []);
    assert.deepEqual(colorsFromDescription(null), []);
    assert.deepEqual(colorsFromDescription(""), []);
  });

  test("the stored column always wins over the description", () => {
    // Once an admin has set colours explicitly, a stale line in the prose must
    // not override them.
    assert.deepEqual(
      productColorOptions({
        colors: [{ name: "Stored Blue", hex: "#0000ff" }],
        description: "Colors: Ignored Black",
      }).map((c) => c.name),
      ["Stored Blue"]
    );
  });

  test("a product with no stored colours falls back to its description", () => {
    assert.deepEqual(
      productColorOptions({
        colors: [],
        description: "Colors: Midnight Black, Voltage Blue",
      }).map((c) => c.name),
      ["Midnight Black", "Voltage Blue"]
    );
  });

  test("a product with neither offers no choice, rather than a broken one", () => {
    assert.deepEqual(productColorOptions({}), []);
    assert.deepEqual(productColorOptions({ colors: null, description: null }), []);
  });
});

describe("the description shown to buyers", () => {
  const { descriptionBody } = colors;

  test("drops the colour lines, because the swatches already say it", () => {
    assert.equal(
      descriptionBody("A drift trike.\n\nColors: Black, Red\n\nShips in a crate."),
      "A drift trike.\n\nShips in a crate."
    );
  });

  test("drops a multi-line colour list too", () => {
    assert.equal(
      descriptionBody("Built in-house.\n\nAvailable colours:\n- Black\n- Red\n\nShips flat."),
      "Built in-house.\n\nShips flat."
    );
  });

  test("resumes at the prose when the list runs into it", () => {
    assert.equal(
      descriptionBody("Colors: Black, Red\nWeighs 42kg and ships in a crate to your door."),
      "Weighs 42kg and ships in a crate to your door."
    );
  });

  test("leaves a description with no colour line completely alone", () => {
    const text = "A rear-wheel-drive drift trike.\n\nThe frame colour is powder coated.";
    assert.equal(descriptionBody(text), text);
  });

  test("is empty when the description was only a colour list", () => {
    assert.equal(descriptionBody("Colour options: Gunmetal, Arctic White"), "");
    assert.equal(descriptionBody(null), "");
  });
});
