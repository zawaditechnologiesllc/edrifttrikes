/**
 * The downloadable product information sheet — one product, rendered to a PDF a
 * buyer can keep, print, or forward to whoever signs off on the purchase.
 *
 * WHAT IT CONTAINS: everything the store knows about the product. Name, badge
 * and tagline; price and any compare-at price; category, power, top speed,
 * range, skill level and availability; the shipping fee (or FREE) and the
 * delivery estimate the fulfilment emails actually commit to; every colour it
 * comes in, with its swatch; the full description, laid out with the same block
 * rules as the product page; the complete technical specification; the duty and
 * tax disclosure; and how to order and reach us.
 *
 * BRANDING: the logo the admin uploads in /admin/settings is drawn at the top
 * of page one and, faintly, as a watermark behind every page. With no logo
 * uploaded the watermark falls back to the company name set large and light, so
 * the sheet still reads as ours.
 *
 * The PDF itself is written by lib/pdf.ts — no dependencies, so this runs
 * unchanged on Cloudflare Workers.
 */

import { PdfDocument, A4, type PdfImage } from "@/lib/pdf";
import { COMPANY } from "@/lib/company";
import { productColors } from "@/lib/colors";
import { parseRichText } from "@/lib/rich-text";
import { formatMoney } from "@/lib/format";
import { MAX_ROUTE_EXTRA_DAYS, formatDeliveryWindow } from "@/lib/delivery";
import {
  DEFAULT_DUTY_RATE_BPS,
  DEFAULT_SHIPPING_CENTS,
  productShippingCents,
} from "@/lib/totals";
import type { Product, SiteSettings } from "@/lib/types";

// A sheet is a printed document, so it is laid out light regardless of the
// storefront's dark theme. The brand lime only ever appears as an accent on
// white — as body text it would be unreadable.
const INK = "#101014";
const MUTED = "#5c5f6b";
const HAIRLINE = "#d9dbe2";
const PANEL = "#f4f5f8";
const ACCENT = "#8fbf00"; // the brand lime, darkened enough to read on paper

const MARGIN = 44;
const CONTENT_WIDTH = A4.width - MARGIN * 2;
/** Nothing is drawn below this — the footer lives underneath. */
const BOTTOM = A4.height - 56;

const LABEL_WIDTH = 132;

export type ProductSheetOptions = {
  product: Product;
  settings: SiteSettings;
  /** Raw logo bytes (PNG or JPEG). Omitted or undecodable → text watermark. */
  logo?: Uint8Array | null;
  /** Absolute storefront URL, so the sheet can point back at the listing. */
  siteUrl?: string | null;
  /** Injected in tests so the generated date is stable. */
  now?: Date;
};

/** A filename a buyer will recognise in their downloads folder. */
export function productSheetFilename(product: Product): string {
  const base =
    String(product.name || product.slug || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  // A name with nothing WinAnsi-safe in it (or a product with no slug) still
  // has to download as something a person can find again.
  return base ? `${base}-product-information.pdf` : "product-information.pdf";
}

export async function buildProductSheet(
  opts: ProductSheetOptions
): Promise<Uint8Array<ArrayBuffer>> {
  const { product, settings } = opts;
  const now = opts.now ?? new Date();
  const companyName = COMPANY.name;

  const doc = new PdfDocument({
    title: `${product.name} — Product Information`,
    author: companyName,
    subject: `Product information sheet for ${product.name}`,
  });

  const logo = opts.logo ? await doc.addImage(opts.logo) : null;

  // --- Page flow ----------------------------------------------------------
  // `y` is the distance from the top of the page down to the next baseline.
  let y = 0;

  const startPage = (first: boolean) => {
    doc.addPage();
    drawWatermark(doc, logo, companyName);
    y = first ? drawHeader(doc, logo, companyName, now) : drawContinuationHeader(doc, product);
  };

  /**
   * Break to a new page when `height` more points won't fit, and hand back the
   * cursor to carry on from.
   *
   * RETURNING the cursor is the point: a caller holding its own copy of `y`
   * would otherwise keep drawing from the pre-break position, laying the block
   * out below the bottom of the fresh page and forcing another break on the
   * next call.
   */
  const need = (height: number): number => {
    if (y + height > BOTTOM) startPage(false);
    return y;
  };

  startPage(true);

  // --- Title block --------------------------------------------------------
  if (product.badge) {
    const badge = product.badge.toUpperCase();
    const w = doc.measure(badge, "bold", 8) + 16;
    doc.drawRect(MARGIN, y - 9, w, 15, { color: ACCENT });
    doc.drawText(badge, { x: MARGIN + 8, y: y + 1, size: 8, font: "bold", color: "#1c2400" });
    y += 24;
  }

  for (const line of doc.wrap(product.name, CONTENT_WIDTH, "bold", 26)) {
    y += 26;
    doc.drawText(line, { x: MARGIN, y, size: 26, font: "bold", color: INK });
    y += 6;
  }

  if (product.tagline) {
    y += 8;
    for (const line of doc.wrap(product.tagline, CONTENT_WIDTH - 12, "regular", 11)) {
      y += 15;
      doc.drawLine(MARGIN, y - 11, MARGIN, y + 4, { color: ACCENT, width: 3 });
      doc.drawText(line, { x: MARGIN + 12, y, size: 11, color: MUTED });
    }
  }

  // --- Price panel --------------------------------------------------------
  y += 24;
  const shipFee = productShippingCents(product, settings);
  const shipsFree = shipFee === 0;
  const struckFee =
    product.shipping_cents ?? settings.shipping_cents ?? DEFAULT_SHIPPING_CENTS;

  doc.drawRect(MARGIN, y, CONTENT_WIDTH, 54, { color: PANEL });
  doc.drawRect(MARGIN, y, 4, 54, { color: ACCENT });
  doc.drawText("PRICE", { x: MARGIN + 18, y: y + 19, size: 8, font: "bold", color: MUTED, tracking: 1 });
  doc.drawText(formatMoney(product.price_cents), {
    x: MARGIN + 18,
    y: y + 42,
    size: 20,
    font: "bold",
    color: INK,
  });
  if (product.compare_at_cents && product.compare_at_cents > product.price_cents) {
    const priceWidth = doc.measure(formatMoney(product.price_cents), "bold", 20);
    const was = `was ${formatMoney(product.compare_at_cents)}`;
    doc.drawText(was, { x: MARGIN + 26 + priceWidth, y: y + 42, size: 10, color: MUTED });
    // Struck through by hand — PDF has no underline/strike operator.
    doc.drawLine(
      MARGIN + 26 + priceWidth + doc.measure("was ", "regular", 10),
      y + 38.5,
      MARGIN + 26 + priceWidth + doc.measure(was, "regular", 10),
      y + 38.5,
      { color: MUTED, width: 0.7 }
    );
  }

  doc.drawText("SHIPPING", {
    x: MARGIN + CONTENT_WIDTH - 18,
    y: y + 19,
    size: 8,
    font: "bold",
    color: MUTED,
    align: "right",
    tracking: 1,
  });
  if (shipsFree) {
    doc.drawText("FREE", {
      x: MARGIN + CONTENT_WIDTH - 18,
      y: y + 42,
      size: 20,
      font: "bold",
      color: "#3d7a00",
      align: "right",
    });
    const freeWidth = doc.measure("FREE", "bold", 20);
    const struck = formatMoney(struckFee);
    const struckWidth = doc.measure(struck, "regular", 10);
    const struckX = MARGIN + CONTENT_WIDTH - 26 - freeWidth - struckWidth;
    doc.drawText(struck, { x: struckX, y: y + 42, size: 10, color: MUTED });
    doc.drawLine(struckX, y + 38.5, struckX + struckWidth, y + 38.5, { color: MUTED, width: 0.7 });
  } else {
    doc.drawText(formatMoney(shipFee), {
      x: MARGIN + CONTENT_WIDTH - 18,
      y: y + 42,
      size: 20,
      font: "bold",
      color: INK,
      align: "right",
    });
  }
  y += 54;

  // --- At a glance --------------------------------------------------------
  const facts: [string, string][] = [];
  if (product.category?.name) facts.push(["Category", product.category.name]);
  const power = POWER_LABELS[product.power] ?? null;
  if (power) facts.push(["Power", power]);
  if (product.top_speed) facts.push(["Top speed", product.top_speed]);
  if (product.range_miles) facts.push(["Range", product.range_miles]);
  if (product.skill_level) facts.push(["Skill level", product.skill_level]);
  facts.push([
    "Availability",
    product.stock > 0 ? `In stock — ${product.stock} available` : "Out of stock",
  ]);
  facts.push([
    "Estimated delivery",
    `${formatDeliveryWindow()} from payment — add up to ${MAX_ROUTE_EXTRA_DAYS} days for distant routes`,
  ]);
  facts.push(["Product code", product.slug]);

  y = section(doc, "AT A GLANCE", need);
  for (const [label, value] of facts) {
    y = row(doc, label, value, need);
  }

  // --- Colours ------------------------------------------------------------
  const colors = productColors(product.colors);
  if (colors.length > 0) {
    y = section(doc, "AVAILABLE COLOURS", need);
    for (const color of colors) {
      need(20);
      y += 14;
      // A swatch only where the product sheet gave a hex; otherwise an outline,
      // so the sheet never invents a colour it wasn't told.
      if (color.hex) {
        doc.drawRect(MARGIN, y - 8, 11, 11, { color: color.hex });
      } else {
        doc.drawRect(MARGIN, y - 8, 11, 11, { color: HAIRLINE });
        doc.drawRect(MARGIN + 1, y - 7, 9, 9, { color: "#ffffff" });
      }
      doc.drawText(color.name, { x: MARGIN + 20, y, size: 10, color: INK });
      if (color.hex) {
        doc.drawText(color.hex.toUpperCase(), {
          x: MARGIN + 20 + doc.measure(color.name, "regular", 10) + 10,
          y,
          size: 8,
          color: MUTED,
        });
      }
      y += 6;
    }
    y += 4;
    need(16);
    y += 12;
    doc.drawText("Choose your colour on the product page before adding to the cart.", {
      x: MARGIN,
      y,
      size: 9,
      color: MUTED,
    });
  }

  // --- Description --------------------------------------------------------
  if (product.description && product.description.trim()) {
    y = section(doc, "ABOUT THIS BUILD", need);
    for (const block of parseRichText(product.description)) {
      if (block.type === "p") {
        for (const paragraphLine of block.lines) {
          for (const line of doc.wrap(paragraphLine, CONTENT_WIDTH, "regular", 10)) {
            need(15);
            y += 14;
            doc.drawText(line, { x: MARGIN, y, size: 10, color: INK });
          }
        }
        y += 6;
      } else {
        block.items.forEach((item, index) => {
          const marker = block.type === "ol" ? `${index + 1}.` : "•";
          const lines = doc.wrap(item, CONTENT_WIDTH - 18, "regular", 10);
          lines.forEach((line, i) => {
            need(15);
            y += 14;
            if (i === 0) doc.drawText(marker, { x: MARGIN + 2, y, size: 10, color: ACCENT });
            doc.drawText(line, { x: MARGIN + 18, y, size: 10, color: INK });
          });
        });
        y += 6;
      }
    }
  }

  // --- Technical specification --------------------------------------------
  if (product.specs && product.specs.length > 0) {
    y = section(doc, "TECHNICAL SPECIFICATION", need);
    for (const spec of product.specs) {
      y = row(doc, spec.label, spec.value, need);
    }
  }

  // --- Duty and tax -------------------------------------------------------
  y = section(doc, "DUTY, TAX AND WHAT YOU PAY", need);
  const dutyPercent = (DEFAULT_DUTY_RATE_BPS / 100).toFixed(2).replace(/\.?0+$/, "");
  for (const note of [
    `The price above is the price of the trike. Shipping is ${
      shipsFree ? "free on this product" : `${formatMoney(shipFee)} per unit`
    }, and sales tax is added at checkout.`,
    `An import duty of about ${dutyPercent}% of the goods value is shown at checkout as an estimate. It is NOT charged by us and is not part of your order total — your own customs authority bills it directly when the shipment arrives, and you pay them.`,
    "Duty varies by country and by how a product is classified, and some destinations charge nothing at all. Treat the figure as indicative and check with your local customs office if you need an exact amount.",
  ]) {
    for (const line of doc.wrap(note, CONTENT_WIDTH, "regular", 9.5)) {
      need(14);
      y += 13;
      doc.drawText(line, { x: MARGIN, y, size: 9.5, color: INK });
    }
    y += 6;
  }

  // --- Ordering and contact ------------------------------------------------
  y = section(doc, "HOW TO ORDER AND REACH US", need);
  const site = normalizeSiteUrl(opts.siteUrl);
  const contact: [string, string][] = [];
  if (site) contact.push(["Order online", `${site}/product/${product.slug}`]);
  contact.push(["Support email", COMPANY.supportEmail]);
  if (settings.company_email && settings.company_email !== COMPANY.supportEmail) {
    contact.push(["General enquiries", settings.company_email]);
  }
  if (settings.company_phone) contact.push(["Phone", settings.company_phone]);
  const address = [settings.address_line1, settings.address_line2].filter(Boolean).join(", ");
  if (address) contact.push(["Address", address]);
  contact.push(["Returns", `${COMPANY.returnWindowDays} days from delivery`]);
  for (const [label, value] of contact) {
    y = row(doc, label, value, need);
  }

  // --- Footer, once the page count is known --------------------------------
  const generated = formatDate(now);
  doc.eachPage((page, total) => {
    doc.drawLine(MARGIN, A4.height - 44, A4.width - MARGIN, A4.height - 44, {
      color: HAIRLINE,
      width: 0.6,
    });
    doc.drawText(`${companyName} · ${COMPANY.supportEmail}`, {
      x: MARGIN,
      y: A4.height - 32,
      size: 8,
      color: MUTED,
    });
    doc.drawText(`Prices and specification as of ${generated} · Page ${page} of ${total}`, {
      x: A4.width - MARGIN,
      y: A4.height - 32,
      size: 8,
      color: MUTED,
      align: "right",
    });
  });

  return doc.toBytes();
}

// ---------------------------------------------------------------------------
// Layout pieces
// ---------------------------------------------------------------------------

const POWER_LABELS: Record<string, string> = {
  electric: "Electric",
  gas: "Gas",
  gravity: "Gravity (no motor)",
  na: "",
};

/** Full-page logo watermark, or the company name when there is no logo. */
function drawWatermark(doc: PdfDocument, logo: PdfImage | null, companyName: string): void {
  if (logo) {
    const box = PdfDocument.fit(logo.width, logo.height, A4.width * 0.68, A4.height * 0.42);
    doc.drawImage(logo, {
      x: (A4.width - box.width) / 2,
      y: (A4.height - box.height) / 2,
      width: box.width,
      height: box.height,
      opacity: 0.07,
    });
    return;
  }
  doc.drawWatermarkText(companyName.toUpperCase(), { size: 52, color: INK, opacity: 0.05 });
}

/** Page one masthead: logo, company name, document type, date. Returns the new y. */
function drawHeader(
  doc: PdfDocument,
  logo: PdfImage | null,
  companyName: string,
  now: Date
): number {
  let textX = MARGIN;
  if (logo) {
    const box = PdfDocument.fit(logo.width, logo.height, 150, 52);
    doc.drawImage(logo, { x: MARGIN, y: MARGIN - 6, width: box.width, height: box.height });
    textX = MARGIN + box.width + 18;
  }
  doc.drawText(companyName, {
    x: A4.width - MARGIN,
    y: MARGIN + 8,
    size: 12,
    font: "bold",
    color: INK,
    align: "right",
  });
  doc.drawText("PRODUCT INFORMATION SHEET", {
    x: A4.width - MARGIN,
    y: MARGIN + 24,
    size: 8,
    color: MUTED,
    align: "right",
    tracking: 1.4,
  });
  doc.drawText(formatDate(now), {
    x: A4.width - MARGIN,
    y: MARGIN + 38,
    size: 8,
    color: MUTED,
    align: "right",
  });
  // Keeps the rule clear of the logo even when there is none.
  void textX;
  const ruleY = MARGIN + 56;
  doc.drawLine(MARGIN, ruleY, A4.width - MARGIN, ruleY, { color: INK, width: 1.4 });
  doc.drawLine(MARGIN, ruleY, MARGIN + 70, ruleY, { color: ACCENT, width: 3 });
  return ruleY + 26;
}

/** Slim running head on pages two and up. Returns the new y. */
function drawContinuationHeader(doc: PdfDocument, product: Product): number {
  doc.drawText(product.name.toUpperCase(), {
    x: MARGIN,
    y: MARGIN,
    size: 8,
    font: "bold",
    color: MUTED,
    tracking: 1,
  });
  doc.drawText("PRODUCT INFORMATION SHEET", {
    x: A4.width - MARGIN,
    y: MARGIN,
    size: 8,
    color: MUTED,
    align: "right",
    tracking: 1,
  });
  const ruleY = MARGIN + 10;
  doc.drawLine(MARGIN, ruleY, A4.width - MARGIN, ruleY, { color: HAIRLINE, width: 0.8 });
  return ruleY + 24;
}

/**
 * A section heading with its accent rule. Returns the new y.
 *
 * The cursor comes back from `need`, never from the `y` argument: after a page
 * break the argument is a position on the PREVIOUS page.
 */
function section(
  doc: PdfDocument,
  title: string,
  need: (height: number) => number
): number {
  // Reserve the heading AND a first row, so a heading never ends a page alone.
  let next = need(58) + 34;
  doc.drawText(title, { x: MARGIN, y: next, size: 9, font: "bold", color: INK, tracking: 1.2 });
  next += 8;
  doc.drawLine(MARGIN, next, A4.width - MARGIN, next, { color: HAIRLINE, width: 0.6 });
  doc.drawLine(MARGIN, next, MARGIN + 34, next, { color: ACCENT, width: 2 });
  return next + 4;
}

/** One label/value line, with the value wrapped in its own column. */
function row(
  doc: PdfDocument,
  label: string,
  value: string,
  need: (height: number) => number
): number {
  const valueWidth = CONTENT_WIDTH - LABEL_WIDTH;
  const lines = doc.wrap(value, valueWidth, "regular", 10);
  let next = need(lines.length * 14 + 8);
  lines.forEach((line, i) => {
    next += 14;
    if (i === 0) {
      doc.drawText(label, { x: MARGIN, y: next, size: 9, font: "bold", color: MUTED });
    }
    doc.drawText(line, { x: MARGIN + LABEL_WIDTH, y: next, size: 10, color: INK });
  });
  next += 4;
  doc.drawLine(MARGIN, next, A4.width - MARGIN, next, { color: HAIRLINE, width: 0.4 });
  return next;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** Trim a trailing slash so the product URL doesn't come out doubled. */
function normalizeSiteUrl(url: string | null | undefined): string | null {
  const trimmed = String(url ?? "").trim().replace(/\/+$/, "");
  return trimmed || null;
}
