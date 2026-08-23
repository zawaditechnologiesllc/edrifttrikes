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
  defaultColor,
  resolveColor,
  colorsFromDescription,
  colorsFromPhrase,
  descriptionBody,
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

describe("the headings a real product sheet actually uses", () => {
  /**
   * The bug this covers: the importer and the description reader kept their
   * own separate lists of colour headings. A sheet saying "Colour Options:"
   * imported perfectly and then showed no swatches — the colours were in the
   * database with nothing willing to read them. They share one list now.
   */

  test("finds colours under every heading an admin plausibly writes", () => {
    const sheets: [string, string[]][] = [
      ["Colors: Black, Red", ["Black", "Red"]],
      ["Colours: Black, Red", ["Black", "Red"]],
      ["Color: Black, Red", ["Black", "Red"]],
      ["Available Colors: Black, Red", ["Black", "Red"]],
      ["Available Colours: Black, Red", ["Black", "Red"]],
      ["Colors Available: Black, Red", ["Black", "Red"]],
      ["Colours Available: Black, Red", ["Black", "Red"]],
      ["Color Options: Black, Red", ["Black", "Red"]],
      ["Colour Options: Black, Red", ["Black", "Red"]],
      ["Colour Choices: Black, Red", ["Black", "Red"]],
      ["Color Variants: Black, Red", ["Black", "Red"]],
      ["Colorways: Black, Red", ["Black", "Red"]],
      ["Frame Colours: Black, Red", ["Black", "Red"]],
      ["Finish Options: Black, Red", ["Black", "Red"]],
      ["Finishes: Black, Red", ["Black", "Red"]],
      ["Shades: Black, Red", ["Black", "Red"]],
    ];
    for (const [line, expected] of sheets) {
      const found = colorsFromDescription(`A trike.\n\n${line}\n\nShips flat.`);
      assert.deepEqual(found.map((c) => c.name), expected, `"${line}" found nothing`);
    }
  });

  test("reads a heading on its own line with the colours beneath it", () => {
    // The commonest layout in a real sheet, and the one a colon-only match
    // dropped silently.
    for (const heading of ["Colours", "COLORS", "Colour Options:", "- Colors"]) {
      const found = colorsFromDescription(
        `Spec text.\n\n${heading}\n- Midnight Black\n- Voltage Blue\n\nShips flat.`
      );
      assert.deepEqual(
        found.map((c) => c.name),
        ["Midnight Black", "Voltage Blue"],
        `heading "${heading}" found nothing`
      );
    }
  });

  test("takes it from an underscored or hyphenated key too", () => {
    assert.deepEqual(
      colorsFromDescription("Spec.\n\ncolor_options: Black, Red").map((c) => c.name),
      ["Black", "Red"]
    );
    assert.deepEqual(
      colorsFromDescription("Spec.\n\nframe-colours: Black, Red").map((c) => c.name),
      ["Black", "Red"]
    );
  });

  test("PROSE that merely mentions colour is not a colour list", () => {
    // The cost of getting this wrong is a sentence appearing as a swatch on
    // the shop, which looks broken to every buyer who sees it.
    for (const prose of [
      "The frame comes in a colour that suits the rider. It weighs 42kg.",
      "Choose the colour of your wheels when you order.",
      "A 3000W hub motor with a 30-mile range.",
    ]) {
      assert.deepEqual(colorsFromDescription(prose), [], `matched: ${prose}`);
    }
  });

  test("strips a bare heading and its list out of the displayed description", () => {
    // The swatches say it already; leaving the list in the prose says it
    // twice, and says it worse.
    assert.equal(
      descriptionBody("Spec text.\n\nColours\n- Midnight Black\n- Voltage Blue\n\nShips flat."),
      "Spec text.\n\nShips flat."
    );
  });
});

describe("colours written as a SENTENCE, not under a heading", () => {
  /**
   * Taken from a real product sheet. There is no heading and no colon — the
   * colours are one bullet in a spec list:
   *
   *   • Available in Red, Black, White, Blue, and Purple
   *
   * The heading parser never saw it, so the product had no swatches at all
   * while the information sat in the description the whole time.
   */
  const REAL_SHEET = [
    "The 60V 5000W High-Speed Electric Drift Kart is built for riders who want",
    "serious speed, long-range electric performance, and responsive drift control.",
    "",
    "- 5000W peak power electric drift system",
    "- 60V 30Ah CATL LiFePO4 battery",
    "- Up to 70 km/h top speed",
    "- Maximum load capacity of 200 kg",
    "- Net weight of 93.3 kg",
    "- Designed for indoor and outdoor track riding",
    "- Available in Red, Black, White, Blue, and Purple",
    "- CE certified",
    "- Customized configuration available",
  ].join("\n");

  test("finds them in a real product sheet", () => {
    assert.deepEqual(
      colorsFromDescription(REAL_SHEET).map((c) => c.name),
      ["Red", "Black", "White", "Blue", "Purple"]
    );
  });

  test("the Oxford comma does not become a colour called 'and Purple'", () => {
    // "Red, Black, and Purple" splits on commas first, leaving the conjunction
    // stuck to the last item — which would go on the shop as a swatch.
    assert.deepEqual(
      colorsFromPhrase("Available in Red, Black, and Purple").map((c) => c.name),
      ["Red", "Black", "Purple"]
    );
  });

  test("reads the other ways a sheet says it", () => {
    for (const [line, expected] of [
      ["Available in Red, Black, White and Blue", ["Red", "Black", "White", "Blue"]],
      ["Comes in Midnight Black, Voltage Blue and Hazard Lime.", ["Midnight Black", "Voltage Blue", "Hazard Lime"]],
      ["Available in Red, Black and White colours.", ["Red", "Black", "White"]],
      ["Choose from Stealth Grey, Inferno Red or Arctic White", ["Stealth Grey", "Inferno Red", "Arctic White"]],
      ["• Offered in Matte Black and Gloss Red", ["Matte Black", "Gloss Red"]],
    ] as [string, string[]][]) {
      assert.deepEqual(colorsFromPhrase(line).map((c) => c.name), expected, line);
    }
  });

  test("REFUSES anything that is not a colour list", () => {
    // The cost of a false positive is a sentence fragment rendered as a swatch
    // on the live shop, which looks broken to every buyer who sees it.
    for (const line of [
      "Available in the UK, Europe and North America",
      "Available in 3 sizes and 2 configurations",
      "Available in 48V, 60V and 72V",
      "Available in stock",
      "Available in Red",
      "Customized configuration available",
      "Up to 70 km/h top speed",
      "Maximum load capacity of 200 kg",
    ]) {
      assert.deepEqual(colorsFromPhrase(line), [], `matched: ${line}`);
    }
  });

  test("a real heading still wins over a sentence", () => {
    // The heading is what the admin wrote deliberately; the sentence is prose
    // that happens to list colours.
    assert.deepEqual(
      colorsFromDescription("Colors: Stealth, Lime\n\n- Available in Red, Black and White")
        .map((c) => c.name),
      ["Stealth", "Lime"]
    );
  });

  test("every spec bullet in the real sheet stays out of the colour list", () => {
    const found = colorsFromDescription(REAL_SHEET).map((c) => c.name.toLowerCase());
    for (const spec of ["5000w", "certified", "configuration", "kg", "battery"]) {
      assert.ok(!found.some((c) => c.includes(spec)), `"${spec}" became a colour`);
    }
  });
});

describe("what colour a line gets when nobody picked one", () => {
  /**
   * The shop does not block checkout to make someone choose. Every unit has a
   * colour whether or not a buyer thought about it, so an unchosen line takes
   * the first colour on the product — the order the admin wrote them in the
   * sheet, which makes the default a decision rather than an accident.
   *
   * The product page selects the same value from the moment it loads, so the
   * buyer always SEES what is going in the cart. A default they never saw
   * would be a support conversation, not a saved sale.
   */
  const offered = parseColors("Red, Black, White, Blue, Purple");

  test("takes the FIRST colour on the product", () => {
    assert.equal(defaultColor(offered), "Red");
    assert.equal(resolveColor(offered, null), "Red");
    assert.equal(resolveColor(offered, undefined), "Red");
    assert.equal(resolveColor(offered, ""), "Red");
  });

  test("a product with no colours has no default — that is not a colour", () => {
    assert.equal(defaultColor([]), null);
    assert.equal(resolveColor([], null), null);
    assert.equal(resolveColor([], "Red"), null);
  });

  test("an actual choice still wins, in the product's own spelling", () => {
    assert.equal(resolveColor(offered, "blue"), "Blue");
    assert.equal(resolveColor(offered, "  WHITE  "), "White");
  });

  test("a colour the product does NOT come in is not silently defaulted", () => {
    // matchColor stays the guard for that: quietly substituting would put a
    // colour on the order the buyer explicitly did not ask for, and the
    // packing slip would be the first they heard of it. The checkout route
    // refuses this case rather than calling resolveColor.
    assert.equal(matchColor(offered, "Chartreuse"), null);
  });

  test("the default follows the sheet's order, not the alphabet", () => {
    assert.equal(defaultColor(parseColors("Purple, Black, Red")), "Purple");
  });
});
