/**
 * Product colours — parsed from the admin's plain-text product sheet, offered
 * to the buyer on the product page, and carried through to the order.
 *
 * The admin writes one line in the .txt upload:
 *
 *   Colors: Midnight Black #101010, Voltage Blue #1e5bff, Hazard Lime
 *
 * Names are what the customer sees and what ends up on the order; the optional
 * hex only paints the swatch. A colour without one still works — it renders as
 * a labelled button instead of a dot.
 *
 * DEPENDENCY-FREE so the admin form can run it in the browser (via FileReader),
 * the product page can render from it, and the checkout API can validate
 * against it — all from the same definition.
 */

import {
  COLOR_HEADINGS,
  isBareColorHeading,
  parseProductText,
} from "@/lib/product-import";

export type ProductColor = {
  /** What the buyer picks and what is stored on the order line. */
  name: string;
  /** `#rrggbb` for the swatch, or null when the sheet didn't give one. */
  hex: string | null;
};

/** More than this on one product is a data-entry mistake, not a range. */
export const MAX_COLORS = 24;
const MAX_NAME_LENGTH = 40;

/** `#abc` / `#aabbcc`, with or without the hash. */
const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Expand `#abc` to `#aabbcc` so CSS and comparisons see one form. */
function normalizeHex(raw: string): string | null {
  const m = raw.trim().match(HEX_RE);
  if (!m) return null;
  const body = m[1].toLowerCase();
  const full =
    body.length === 3
      ? body
          .split("")
          .map((c) => c + c)
          .join("")
      : body;
  return `#${full}`;
}

/**
 * Colour names are compared case- and space-insensitively everywhere: the
 * buyer's browser, the checkout API and the admin all have to agree that
 * "voltage blue" is the "Voltage Blue" on the product.
 */
export function colorKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Parse the admin's colour line into a list.
 *
 * Accepts commas, semicolons or newlines as separators, and an optional hex
 * anywhere in the entry — "Voltage Blue #1e5bff", "#1e5bff Voltage Blue" and
 * "Voltage Blue (#1e5bff)" all work, because an admin typing a product sheet
 * shouldn't have to remember a syntax.
 *
 * Duplicates (by name) are dropped, keeping the first — a repeated colour in
 * the sheet is a typo, and rendering it twice looks broken.
 */
export function parseColors(input: string | null | undefined): ProductColor[] {
  if (!input) return [];

  const out: ProductColor[] = [];
  const seen = new Set<string>();

  for (const entry of String(input).split(/[,;\n]/)) {
    const raw = entry.trim();
    if (!raw) continue;

    // Pull the hex out wherever it sits, and treat what's left as the name.
    let hex: string | null = null;
    const name = raw
      .replace(/[([]?\s*#?[0-9a-f]{6}\s*[)\]]?|[([]?\s*#[0-9a-f]{3}\s*[)\]]?/gi, (match) => {
        const parsed = normalizeHex(match.replace(/[()[\]\s]/g, ""));
        if (parsed && !hex) hex = parsed;
        return "";
      })
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_NAME_LENGTH);

    if (!name) continue;

    const key = colorKey(name);
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ name, hex });
    if (out.length >= MAX_COLORS) break;
  }

  return out;
}

/** Render a colour list back to the single line an admin edits. */
export function formatColors(colors: ProductColor[]): string {
  return colors.map((c) => (c.hex ? `${c.name} ${c.hex}` : c.name)).join(", ");
}

/**
 * Read whatever is stored on a product back into a usable list.
 *
 * Tolerant on purpose: the column is jsonb, and a hand-edited row (or an older
 * shape that was just an array of strings) must not break a product page.
 */
export function productColors(value: unknown): ProductColor[] {
  if (!value) return [];
  if (typeof value === "string") return parseColors(value);
  if (!Array.isArray(value)) return [];

  const out: ProductColor[] = [];
  const seen = new Set<string>();
  for (const entry of value.slice(0, MAX_COLORS)) {
    let name = "";
    let hex: string | null = null;
    if (typeof entry === "string") {
      name = entry;
    } else if (entry && typeof entry === "object") {
      const o = entry as Record<string, unknown>;
      name = typeof o.name === "string" ? o.name : "";
      hex = typeof o.hex === "string" ? normalizeHex(o.hex) : null;
    }
    name = name.trim().slice(0, MAX_NAME_LENGTH);
    if (!name) continue;
    const key = colorKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, hex });
  }
  return out;
}

/**
 * Resolve a buyer-supplied colour against what the product actually offers.
 *
 * Returns the product's own spelling, so the order records "Voltage Blue"
 * however the request happened to capitalise it — and null when the colour
 * isn't on the product, which is what the checkout API refuses on.
 */
export function matchColor(
  colors: ProductColor[],
  requested: string | null | undefined
): string | null {
  if (!requested) return null;
  const key = colorKey(requested);
  if (!key) return null;
  return colors.find((c) => colorKey(c.name) === key)?.name ?? null;
}

/** True when the buyer must choose before this product can be added to a cart. */
export function requiresColorChoice(colors: ProductColor[]): boolean {
  return colors.length > 0;
}

// ---------------------------------------------------------------------------
// Colours already sitting in a product's description
// ---------------------------------------------------------------------------

/**
 * Does this line introduce a colour list?
 *
 * BUILT FROM THE IMPORTER'S OWN HEADING LIST rather than a regex written here.
 * When the two were maintained separately they drifted, and a sheet that said
 * "Colour Options:" imported perfectly and then showed no swatches — the
 * colours were sitting in the database with nothing willing to read them.
 *
 * Two shapes count: `Heading: value` and a heading alone on its line with the
 * colours beneath it.
 */
// `m` matters: the heading is almost never the first line of a description.
// No `g` flag — .test() would then carry lastIndex between calls and start
// missing every other match.
const COLOR_KEY = new RegExp(
  `^\\s*(?:${COLOR_HEADINGS.map((h) => h.replace(/ /g, "[\\s_-]+")).join("|")})\\s*[:=]`,
  "im"
);

/** True for either shape, on a single line. */
function isColorHeadingLine(line: string): boolean {
  return COLOR_KEY.test(line) || isBareColorHeading(line);
}

/** True when a whole description contains a colour list anywhere in it. */
function hasColorHeading(text: string): boolean {
  return text.split(/\r?\n/).some(isColorHeadingLine);
}

/**
 * A colour name a person would actually write.
 *
 * Only used on the DESCRIPTION path, never on an explicit upload. The import
 * parser treats every bare line after `Colors:` as another colour, which is
 * right for a sheet an admin wrote deliberately — but a stored description can
 * run straight from a colour list into prose with no blank line between them,
 * and "Weighs 42kg and ships in a crate." must not become a colour a buyer can
 * pick.
 */
function plausibleColorName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 28) return false;
  if (trimmed.split(/\s+/).length > 4) return false;
  if (/[.!?;]$/.test(trimmed)) return false;
  return /\p{L}/u.test(trimmed);
}

/**
 * Colours mentioned inside a product's description text.
 *
 * This is what makes the colour picker appear on products that were uploaded
 * BEFORE colours had a column of their own. Back then a `Colors:` line inside
 * the description body was simply kept as description text, so the information
 * is already in the database — it just was never read.
 *
 * Reuses parseProductText rather than re-implementing the syntax, so the
 * multi-line lists, bullets and British spellings all behave exactly as they do
 * in an upload. Only the plausibility filter is extra; see above.
 *
 * lib/product-import.ts has no imports of its own, so depending on it here
 * keeps this module usable in the browser, on the server and in the Worker.
 */
export function colorsFromDescription(
  description: string | null | undefined
): ProductColor[] {
  const text = String(description ?? "");
  if (!text.trim() || !hasColorHeading(text)) return [];
  return parseColors(parseProductText(text).fields.colors).filter((c) =>
    plausibleColorName(c.name)
  );
}

/**
 * The colours a buyer may choose for a product.
 *
 * Prefers the stored `colors` column, and falls back to whatever the admin
 * already wrote in the description. Every surface that offers or validates a
 * colour must call THIS, not productColors — the product page offering a choice
 * the checkout then rejects is worse than offering none at all.
 */
export function productColorOptions(product: {
  colors?: unknown;
  description?: string | null;
}): ProductColor[] {
  const stored = productColors(product?.colors);
  if (stored.length > 0) return stored;
  return colorsFromDescription(product?.description);
}

/**
 * The description with its colour lines removed, for display.
 *
 * The colours are rendered as swatches now, so leaving "Colors: Black, Red" in
 * the prose says the same thing twice — and says it worse.
 */
export function descriptionBody(description: string | null | undefined): string {
  const text = String(description ?? "");
  if (!text.trim()) return "";

  const out: string[] = [];
  let skipping = false;
  for (const line of text.split(/\r?\n/)) {
    if (isColorHeadingLine(line)) {
      skipping = true;
      continue;
    }
    if (skipping) {
      const bare = line.trim().replace(/^[-*]\s*/, "");
      // A blank line ends the colour list, exactly as it does on import.
      if (!bare) {
        skipping = false;
        continue;
      }
      // Still inside the list only while the lines still look like colours.
      if (plausibleColorName(bare)) continue;
      skipping = false;
    }
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
