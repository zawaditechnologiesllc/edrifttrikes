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
