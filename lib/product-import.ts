/**
 * Parse a plain-text product sheet into product-form values, so an admin can
 * prefill the form from a .txt file instead of typing every field.
 *
 * Format: one `Key: value` per line (keys are case-insensitive, with common
 * aliases). The description may span multiple lines — everything after
 * `Description:` belongs to it until the next recognized `Key:` line. Images
 * can't come from a text file; they're picked in the form as usual.
 *
 * `Colors:` gives the buyer something to choose on the product page. Write them
 * on one line, one per line, or both — a blank line ends the list:
 *   Colors: Midnight Black #101010, Voltage Blue #1e5bff
 *   Hazard Lime
 * The hex is optional and only paints the swatch — see lib/colors.ts.
 *
 * Client-safe: pure string parsing, no server imports (the form runs it in the
 * browser via FileReader).
 */

export type ParsedProduct = {
  /** Form text-field values keyed by input name (name, slug, price, …). */
  fields: Record<string, string>;
  /** Checkbox values keyed by input name (is_new, featured). */
  checks: Record<string, boolean>;
  /** Raw category text — the form resolves it against real categories. */
  category?: string;
  /** Keys in the file that didn't match anything (reported, not fatal). */
  unknownKeys: string[];
};

/**
 * Every heading an admin might put a colour list under.
 *
 * ONE LIST, because two things read it: the sheet importer below, and
 * colorsFromDescription() in lib/colors.ts, which is what makes the colour
 * picker appear on products uploaded before colours had a column. When those
 * two disagreed, a product sheet saying "Colour Options:" imported fine and
 * then showed no swatches — the information was in the database and nothing
 * was reading it.
 *
 * Written in American spelling; the British forms are generated, so adding an
 * alias here covers both.
 */
const COLOR_HEADINGS_US = [
  "color",
  "colors",
  "available colors",
  "colors available",
  "color options",
  "color choices",
  "color variants",
  "colorways",
  "frame color",
  "frame colors",
  "finish",
  "finishes",
  "finish options",
  "available finishes",
  "shades",
];

/** American + British spelling of every heading above. */
export const COLOR_HEADINGS: string[] = [
  ...new Set(
    COLOR_HEADINGS_US.flatMap((h) => [h, h.replace(/\bcolor/g, "colour")])
  ),
];

const COLOR_KEY_ENTRIES: Record<string, string> = Object.fromEntries(
  COLOR_HEADINGS.map((h) => [h, h.includes("colour") ? "colours_alias" : "colors"])
);

/**
 * True when a whole line is nothing but a colour heading.
 *
 * A sheet often writes the heading on its own line with the colours beneath it
 * as bullets, and requiring a colon would silently drop every one of them. The
 * WHOLE line has to be the heading — a sentence merely containing the word
 * "colours" is prose, not a heading.
 */
export function isBareColorHeading(line: string): boolean {
  const bare = String(line ?? "")
    .trim()
    .replace(/^[-*•]\s*/, "")
    .replace(/[:=]\s*$/, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return COLOR_HEADINGS.includes(bare);
}

// normalized alias -> form field name ("" = handled specially)
const KEY_MAP: Record<string, string> = {
  "name": "name",
  "product": "name",
  "product name": "name",
  "title": "name",
  "slug": "slug",
  "url": "slug",
  "tagline": "tagline",
  "subtitle": "tagline",
  "description": "description",
  "details": "description",
  "body": "description",
  "price": "price",
  "price usd": "price",
  "compare at": "compare_at",
  "compare at price": "compare_at",
  "compare": "compare_at",
  "was": "compare_at",
  "old price": "compare_at",
  "msrp": "compare_at",
  "stock": "stock",
  "quantity": "stock",
  "qty": "stock",
  "inventory": "stock",
  "badge": "badge",
  "label": "badge",
  "category": "category",
  "power": "power",
  "power type": "power",
  "top speed": "top_speed",
  "speed": "top_speed",
  "range": "range_miles",
  "range miles": "range_miles",
  "skill level": "skill_level",
  "skill": "skill_level",
  "status": "status",
  "new": "is_new",
  "is new": "is_new",
  "mark as new": "is_new",
  "featured": "featured",
  "feature": "featured",
  "shipping": "shipping_fee",
  "shipping fee": "shipping_fee",
  "shipping cost": "shipping_fee",
  "free shipping": "free_shipping",
  ...COLOR_KEY_ENTRIES,
};

const TRUTHY = new Set(["yes", "y", "true", "1", "on", "✓", "x"]);

function normalizeKey(raw: string): string {
  return raw.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function cleanMoney(v: string): string {
  const n = parseFloat(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n.toFixed(2) : "";
}

function normalizePower(v: string): string {
  const s = v.toLowerCase();
  if (s.startsWith("elec")) return "electric";
  if (s.startsWith("gas")) return "gas";
  if (s.startsWith("grav")) return "gravity";
  return "na";
}

function normalizeStatus(v: string): string {
  const s = v.toLowerCase();
  if (s.startsWith("draft")) return "draft";
  if (s.startsWith("arch")) return "archived";
  return "active";
}

export function parseProductText(text: string): ParsedProduct {
  const fields: Record<string, string> = {};
  const checks: Record<string, boolean> = {};
  const unknownKeys: string[] = [];
  let category: string | undefined;
  // Two fields may span lines: the description, and the colour list — an admin
  // writing a product sheet naturally puts one colour per line, and silently
  // dropping those was losing colours without any warning.
  let inDescription = false;
  let inColors = false;
  const descriptionLines: string[] = [];
  const colorLines: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    // `Key: value` — the key side must be short words, so a colon inside prose
    // (e.g. a URL in the description) doesn't start a new field.
    const m = line.match(/^([A-Za-z][A-Za-z0-9 _-]{0,30})\s*[:=]\s*(.*)$/);
    let field = m ? KEY_MAP[normalizeKey(m[1])] : undefined;
    // A colour heading alone on its line, with the colours listed beneath it.
    // Recognised only when the ENTIRE line is the heading, so a sentence that
    // happens to mention colour stays prose.
    const bareColorHeading = !field && isBareColorHeading(line);
    if (bareColorHeading) field = "colors";

    if (!field) {
      // Keep blank lines inside the description — they mark paragraph breaks,
      // which the product page renders (along with -, *, 1. bullet points).
      if (inDescription) descriptionLines.push(line.trim());
      // A bare line under `Colors:` is another colour. A blank line ends the
      // list, so a following prose paragraph isn't swallowed as a colour.
      else if (inColors) {
        const trimmed = line.trim().replace(/^[-*]\s*/, "");
        if (trimmed) colorLines.push(trimmed);
        else inColors = false;
      } else if (m && line.trim()) unknownKeys.push(m[1].trim());
      continue;
    }

    const value = bareColorHeading ? "" : m![2].trim();
    inDescription = field === "description";
    inColors = field === "colors" || field === "colours_alias";

    // British and American spellings both map here.
    const target = field === "colours_alias" ? "colors" : field;

    switch (target) {
      case "description":
        if (value) descriptionLines.push(value);
        break;
      case "price":
      case "compare_at":
      case "shipping_fee":
        fields[field] = cleanMoney(value);
        break;
      case "stock":
        fields.stock = String(parseInt(value.replace(/[^0-9]/g, ""), 10) || 0);
        break;
      case "power":
        fields.power = normalizePower(value);
        break;
      case "status":
        fields.status = normalizeStatus(value);
        break;
      case "is_new":
      case "featured":
      case "free_shipping":
        checks[field] = TRUTHY.has(value.toLowerCase());
        break;
      case "category":
        category = value;
        break;
      case "slug":
        fields.slug = slugify(value);
        break;
      case "colors":
        // Kept as the admin's raw text; the form and the product page parse it
        // with lib/colors.ts, so there is one parser rather than two.
        if (value) colorLines.push(value);
        break;
      default:
        fields[target] = value;
    }
  }

  if (descriptionLines.length) {
    fields.description = descriptionLines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  // Joined with commas so lib/colors.ts sees one list however it was laid out.
  if (colorLines.length) fields.colors = colorLines.join(", ");
  if (!fields.slug && fields.name) fields.slug = slugify(fields.name);

  return { fields, checks, category, unknownKeys };
}

/** Downloadable starting point shown next to the import control. */
export const PRODUCT_TEMPLATE = `Name: Volt S1 Pro
Slug: volt-s1-pro
Tagline: Precision torque for full-lock drifts
Description: Write the full product description here.
Blank lines start a new paragraph, and lines beginning
with - or 1. become bullet / numbered points:

- UHMWPE slide sleeves for buttery transitions
- 72V custom-wound brushless motor
- Aircraft-grade 6061 aluminium frame

Everything keeps adding to the description
until the next "Key:" line.
Price: 2499.99
Compare at: 2999.99
Stock: 10
Badge: NEW
Category: trikes
Power: electric
Top speed: 45 mph
Range: 30 miles
Skill level: Expert
Status: active
New: yes
Featured: yes
Shipping fee: 50.00
Free shipping: no
Colors: Midnight Black #101010, Voltage Blue #1e5bff, Hazard Lime #c4f731
`;

