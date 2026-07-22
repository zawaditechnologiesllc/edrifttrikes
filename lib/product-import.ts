/**
 * Parse a plain-text product sheet into product-form values, so an admin can
 * prefill the form from a .txt file instead of typing every field.
 *
 * Format: one `Key: value` per line (keys are case-insensitive, with common
 * aliases). The description may span multiple lines — everything after
 * `Description:` belongs to it until the next recognized `Key:` line. Images
 * can't come from a text file; they're picked in the form as usual.
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
  let inDescription = false;
  const descriptionLines: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    // `Key: value` — the key side must be short words, so a colon inside prose
    // (e.g. a URL in the description) doesn't start a new field.
    const m = line.match(/^([A-Za-z][A-Za-z0-9 _-]{0,30})\s*[:=]\s*(.*)$/);
    const field = m ? KEY_MAP[normalizeKey(m[1])] : undefined;

    if (!field) {
      if (inDescription && line.trim()) descriptionLines.push(line.trim());
      else if (m && line.trim()) unknownKeys.push(m[1].trim());
      continue;
    }

    const value = m![2].trim();
    inDescription = field === "description";

    switch (field) {
      case "description":
        if (value) descriptionLines.push(value);
        break;
      case "price":
      case "compare_at":
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
        checks[field] = TRUTHY.has(value.toLowerCase());
        break;
      case "category":
        category = value;
        break;
      case "slug":
        fields.slug = slugify(value);
        break;
      default:
        fields[field] = value;
    }
  }

  if (descriptionLines.length) fields.description = descriptionLines.join("\n");
  if (!fields.slug && fields.name) fields.slug = slugify(fields.name);

  return { fields, checks, category, unknownKeys };
}

/** Downloadable starting point shown next to the import control. */
export const PRODUCT_TEMPLATE = `Name: Volt S1 Pro
Slug: volt-s1-pro
Tagline: Precision torque for full-lock drifts
Description: Write the full product description here.
Extra lines keep adding to the description
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
`;
