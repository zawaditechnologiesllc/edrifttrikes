import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildProductSheet, productSheetFilename } from "../lib/product-sheet";
import { parseColors } from "../lib/colors";
import { parseRichText } from "../lib/rich-text";
import { COMPANY, DEFAULT_SITE_SETTINGS } from "../lib/company";
import { formatDeliveryWindow } from "../lib/delivery";
import { toWinAnsi } from "../lib/pdf";
import type { Product, SiteSettings } from "../lib/types";

/**
 * The downloadable product information sheet.
 *
 * The promise to the buyer is that the sheet says everything the store knows
 * about the product — so these tests read the text back out of the generated
 * PDF and check the facts are actually on the page, not merely passed in.
 */

/** Every string the finished PDF draws, joined for searching. */
function sheetText(bytes: Uint8Array): string {
  const source = asText(bytes);
  const out: string[] = [];
  const re = /\(((?:[^\\()]|\\.)*)\)\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    out.push(match[1].replace(/\\([\\()])/g, "$1"));
  }
  return out.join("\n");
}

function asText(bytes: Uint8Array): string {
  let source = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    source += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 8192)));
  }
  return source;
}

function pageCount(bytes: Uint8Array): number {
  return Number(/\/Type \/Pages \/Count (\d+)/.exec(asText(bytes))?.[1] ?? 0);
}

const A4_HEIGHT = 841.89;

/**
 * Every text baseline, in PDF coordinates, grouped by the page it is drawn on.
 *
 * Content streams are written uncompressed and in page order, so the drawing
 * operators read straight back out. Each drawing call is its own `q … Q` block;
 * blocks carrying a `cm` are the watermark and the images, which position
 * themselves with a matrix — their text matrix is the origin and says nothing
 * about where they land, so they are skipped.
 */
function textBaselinesByPage(bytes: Uint8Array): number[][] {
  const pages: number[][] = [];
  for (const [, stream] of asText(bytes).matchAll(/\nstream\n([\s\S]*?)\nendstream/g)) {
    if (!stream.includes(" Tm")) continue; // an image, not a page
    const baselines: number[] = [];
    for (const [, block] of stream.matchAll(/\bq\n([\s\S]*?)\nQ\b/g)) {
      if (block.includes(" cm")) continue;
      for (const [, y] of block.matchAll(/1 0 0 1 -?[\d.]+ (-?[\d.]+) Tm/g)) {
        baselines.push(Number(y));
      }
    }
    pages.push(baselines);
  }
  return pages;
}

const NOW = new Date("2026-08-20T00:00:00Z");

const PRODUCT = {
  id: "p1",
  slug: "volt-s1-pro",
  name: "Volt S1 Pro",
  tagline: "3000W of rear-wheel chaos.",
  description: [
    "A rear-wheel-drive electric drift trike built around a 3000W hub motor.",
    "",
    "In the box:",
    "- The assembled trike",
    "- A 60V fast charger",
  ].join("\n"),
  price_cents: 189900,
  compare_at_cents: 219900,
  category_id: "c1",
  power: "electric",
  skill_level: "Intermediate",
  top_speed: "32 mph",
  range_miles: "18-22 miles",
  stock: 7,
  status: "active",
  is_new: true,
  featured: true,
  shipping_cents: null,
  free_shipping: false,
  badge: "New build",
  hero_image: null,
  colors: parseColors("Midnight Black #101010, Voltage Blue #1e5bff, Gunmetal"),
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  category: {
    id: "c1",
    slug: "drift-trikes",
    name: "Electric Drift Trikes",
    description: null,
    image_url: null,
    position: 1,
  },
  specs: [
    { id: "s1", product_id: "p1", label: "Motor", value: "3000W rear hub", position: 1 },
    { id: "s2", product_id: "p1", label: "Battery", value: "60V 20Ah lithium-ion", position: 2 },
    { id: "s3", product_id: "p1", label: "Warranty", value: "12 months on the frame", position: 3 },
  ],
} as unknown as Product;

const SETTINGS: SiteSettings = { ...DEFAULT_SITE_SETTINGS };

const build = (overrides?: {
  product?: Partial<Product>;
  settings?: Partial<SiteSettings>;
  logo?: Uint8Array | null;
  siteUrl?: string | null;
}) =>
  buildProductSheet({
    product: { ...PRODUCT, ...overrides?.product } as Product,
    settings: { ...SETTINGS, ...overrides?.settings },
    logo: overrides?.logo ?? null,
    siteUrl: overrides && "siteUrl" in overrides ? overrides.siteUrl : "https://edrifttrikes.shop",
    now: NOW,
  });

describe("what the sheet says", () => {
  test("is a PDF a reader will open", async () => {
    const bytes = await build();
    assert.equal(String.fromCharCode(...bytes.subarray(0, 5)), "%PDF-");
    assert.ok(pageCount(bytes) >= 1);
  });

  test("carries every fact the store knows about the product", async () => {
    const text = await build().then(sheetText);
    for (const fact of [
      "Volt S1 Pro",
      "NEW BUILD",
      "3000W of rear-wheel chaos.",
      "$1,899", // price
      "$2,199", // compare-at
      "Electric Drift Trikes", // category
      "Electric", // power
      "32 mph",
      "18-22 miles",
      "Intermediate",
      "volt-s1-pro", // product code
      "Midnight Black",
      "Voltage Blue",
      "Gunmetal",
      "#101010",
      "3000W rear hub", // spec value
      "Battery", // spec label
      "12 months on the frame",
    ]) {
      assert.ok(text.includes(fact), `the sheet never mentions "${fact}"`);
    }
  });

  test("prints the whole description, paragraphs and bullets alike", async () => {
    const text = await build().then(sheetText);
    assert.ok(text.includes("rear-wheel-drive electric drift trike"));
    assert.ok(text.includes("The assembled trike"), "a bullet was dropped");
    assert.ok(text.includes("A 60V fast charger"), "a bullet was dropped");
  });

  test("quotes the same delivery window as the rest of the store", async () => {
    // A second, different number here would be a promise the checkout page and
    // the confirmation email don't keep.
    const text = await build().then(sheetText);
    // Folded through toWinAnsi first: the en dash in "12–20" is stored as a
    // single WinAnsi byte in the PDF, so the UTF-8 spelling would never match.
    assert.ok(
      text.includes(toWinAnsi(`${formatDeliveryWindow()} from payment`)),
      "the sheet quotes a window the rest of the site doesn't"
    );
  });

  test("says how to reach us", async () => {
    const text = await build().then(sheetText);
    assert.ok(text.includes(COMPANY.supportEmail), "no support email on the sheet");
    assert.ok(text.includes(COMPANY.name));
    assert.ok(
      text.includes("https://edrifttrikes.shop/product/volt-s1-pro"),
      "no link back to the listing"
    );
    assert.ok(text.includes(SETTINGS.company_phone!));
    assert.ok(text.includes("100 Drift Lane, Los Angeles, CA 90001, USA"));
  });

  test("does not double the slash when the site URL has a trailing one", async () => {
    const text = await build({ siteUrl: "https://edrifttrikes.shop/" }).then(sheetText);
    assert.ok(text.includes("https://edrifttrikes.shop/product/volt-s1-pro"));
    assert.ok(!text.includes("shop//product"), "the product URL came out doubled");
  });

  test("numbers every page and dates the sheet", async () => {
    const text = await build().then(sheetText);
    assert.match(text, /Page 1 of \d/);
    assert.ok(text.includes("August 20, 2026"), "the sheet is not dated");
  });
});

describe("shipping, duty and tax", () => {
  test("states the shipping fee that actually applies", async () => {
    const text = await build().then(sheetText);
    assert.ok(text.includes("$50"), "the shipping fee is missing");
  });

  test("says FREE, and shows the fee it replaces, when the product ships free", async () => {
    const text = await build({ product: { free_shipping: true } }).then(sheetText);
    assert.ok(text.includes("FREE"), "free shipping is not called out");
    assert.ok(text.includes("$50"), "the struck-through fee is missing");
    assert.ok(text.includes("free on this product"));
  });

  test("honours the store-wide free shipping switch", async () => {
    const text = await build({ settings: { free_shipping: true } }).then(sheetText);
    assert.ok(text.includes("FREE"));
  });

  test("uses a product's own fee over the store default", async () => {
    const text = await build({ product: { shipping_cents: 12500 } }).then(sheetText);
    assert.ok(text.includes("$125"), "the per-product shipping fee was ignored");
  });

  test("discloses the duty as an estimate the BUYER pays their own government", async () => {
    // The store never collects it and it is not in the order total. Saying
    // otherwise on a printed sheet would be a misstatement about money.
    const text = await build().then(sheetText);
    assert.ok(text.includes("13.5%"), "the duty rate is missing");
    assert.ok(text.includes("NOT charged by us"), "the sheet implies we collect the duty");
    assert.ok(
      text.includes("not part of your order total"),
      "the sheet does not say the duty sits outside the total"
    );
    assert.ok(text.includes("customs authority"));
  });
});

describe("degrading gracefully", () => {
  test("a product with nothing but a name and a price still produces a sheet", async () => {
    const bytes = await build({
      product: {
        tagline: null,
        description: null,
        badge: null,
        compare_at_cents: null,
        category: null,
        specs: [],
        colors: [],
        top_speed: null,
        range_miles: null,
        skill_level: null,
      },
      settings: {
        company_email: null,
        company_phone: null,
        address_line1: null,
        address_line2: null,
      },
      siteUrl: null,
    });
    const text = sheetText(bytes);
    assert.equal(pageCount(bytes), 1);
    assert.ok(text.includes("Volt S1 Pro"));
    assert.ok(text.includes("$1,899"));
    // The support address is a constant, so it is on the sheet regardless.
    assert.ok(text.includes(COMPANY.supportEmail));
    assert.ok(!text.includes("AVAILABLE COLOURS"), "an empty colour section was drawn");
  });

  test("an out-of-stock product says so rather than claiming stock", async () => {
    const text = await build({ product: { stock: 0 } }).then(sheetText);
    assert.ok(text.includes("Out of stock"));
    assert.ok(!text.includes("0 available"));
  });

  test("with no logo the company name becomes the watermark", async () => {
    const bytes = await build({ logo: null });
    const source = asText(bytes);
    assert.doesNotMatch(source, /\/Subtype \/Image/, "an image appeared without a logo");
    assert.ok(sheetText(bytes).includes(COMPANY.name.toUpperCase()), "no fallback watermark");
  });

  test("an undecodable logo costs the branding, never the download", async () => {
    // fetchLogo hands over whatever the storage URL returned; a WebP or a
    // truncated file must not turn a spec-sheet request into a 500.
    const bytes = await build({ logo: new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4]) });
    assert.ok(sheetText(bytes).includes("Volt S1 Pro"));
    assert.ok(pageCount(bytes) >= 1);
  });

  test("nothing is ever drawn outside the page body, however it paginates", async () => {
    // The bug this pins: a page break inside a label/value row used to leave
    // the row drawing from the PREVIOUS page's cursor, so it landed below the
    // footer — and then every following block broke again, inflating the sheet
    // from two pages to five with text spilling off each one.
    const specs = Array.from({ length: 40 }, (_, i) => ({
      id: `s${i}`,
      product_id: "p1",
      label: `Specification ${i + 1}`,
      value: `A value long enough to wrap onto a second line inside its column, number ${i + 1}.`,
      position: i,
    }));
    const bytes = await build({ product: { specs } as Partial<Product> });
    assert.ok(pageCount(bytes) >= 3, "the fixture did not force enough page breaks");

    for (const [page, baselines] of textBaselinesByPage(bytes).entries()) {
      for (const y of baselines) {
        // In PDF coordinates: 0 is the bottom of the page. The footer rule sits
        // at 44pt and the top margin at 44pt from the top.
        assert.ok(y >= 20, `page ${page + 1} draws text at ${y}, below the footer`);
        assert.ok(
          y <= A4_HEIGHT - 30,
          `page ${page + 1} draws text at ${y}, above the top margin`
        );
      }
    }
  });

  test("a long description pushes onto more pages, keeping the running head", async () => {
    const long = Array.from(
      { length: 60 },
      (_, i) => `Paragraph ${i + 1}: this build is assembled and tested before it ships.`
    ).join("\n\n");
    const bytes = await build({ product: { description: long } });
    assert.ok(pageCount(bytes) > 1, "a very long description stayed on one page");
    const text = sheetText(bytes);
    assert.match(text, /Page 1 of [2-9]/);
    assert.ok(text.includes("VOLT S1 PRO"), "later pages lost the running head");
    assert.ok(text.includes("Paragraph 60"), "the description was truncated");
    // Everything after the description must still be there.
    assert.ok(text.includes(COMPANY.supportEmail));
  });
});

describe("branding", () => {
  test("an uploaded logo is embedded, at the top and as the watermark", async () => {
    const logo = await makeRgbaPng();
    const bytes = await build({ logo });
    const source = asText(bytes);
    assert.match(source, /\/Subtype \/Image/, "the logo was not embedded");
    assert.match(source, /\/SMask \d+ 0 R/, "the logo's transparency was flattened");
    // The watermark goes behind every page, and the masthead draws it once more.
    assert.equal((source.match(/\/Im0 Do/g) ?? []).length, pageCount(bytes) + 1);
    assert.match(source, /\/ca 0\.07/, "the watermark is not faint");
    // With a logo there is no text watermark competing with it.
    assert.ok(!sheetText(bytes).includes(COMPANY.name.toUpperCase()));
  });
});

describe("productSheetFilename", () => {
  test("is something a buyer will recognise in their downloads", () => {
    assert.equal(
      productSheetFilename(PRODUCT),
      "Volt-S1-Pro-product-information.pdf"
    );
  });

  test("strips anything that could break a Content-Disposition header", () => {
    const name = productSheetFilename({
      ...PRODUCT,
      name: 'Volt "S1" (Pro) — 3000W; rm -rf /',
    } as Product);
    assert.match(name, /^[A-Za-z0-9-]+\.pdf$/);
    assert.ok(!name.includes('"'));
  });

  test("falls back rather than producing a nameless file", () => {
    assert.equal(
      productSheetFilename({ ...PRODUCT, name: "你好", slug: "" } as Product),
      "product-information.pdf"
    );
  });
});

describe("rich text is parsed once, for the page and the sheet alike", () => {
  test("the same blocks drive both", () => {
    // If these ever diverged, the printed sheet and the product page would
    // disagree about where a paragraph ends.
    const blocks = parseRichText(PRODUCT.description!);
    assert.deepEqual(
      blocks.map((b) => b.type),
      ["p", "p", "ul"]
    );
    assert.deepEqual((blocks[2] as { items: string[] }).items, [
      "The assembled trike",
      "A 60V fast charger",
    ]);
  });
});

/** A 2x2 RGBA PNG — the shape a real logo upload has. */
async function makeRgbaPng(): Promise<Uint8Array> {
  const width = 2;
  const height = 2;
  const stride = width * 4;
  const raw = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = y * (stride + 1) + 1 + x * 4;
      raw[at] = 30;
      raw[at + 1] = 91;
      raw[at + 2] = 255;
      raw[at + 3] = 200;
    }
  }
  const cs = new CompressionStream("deflate");
  const writer = cs.writable.getWriter() as WritableStreamDefaultWriter<Uint8Array>;
  void writer.write(raw);
  void writer.close();
  const idat = new Uint8Array(await new Response(cs.readable).arrayBuffer());

  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    new DataView(out.buffer).setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    return out;
  };
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA

  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
