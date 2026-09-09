/**
 * ORDER INVOICES — the document a customer files, an accountant reconciles, and
 * a payment processor asks for when it wants proof the business is real.
 *
 * TWO DOCUMENTS PER ORDER, because an order has two states and they are not the
 * same claim:
 *
 *   PROFORMA INVOICE  Issued before payment. States what is owed and that
 *                     nothing has been received. It is not a tax invoice and
 *                     says so on its face.
 *   INVOICE           Issued once payment has cleared. States what was paid,
 *                     when, by what method, against which gateway reference,
 *                     and that the balance is nil.
 *
 * THE PAID VARIANT WILL NOT RENDER FOR AN UNPAID ORDER. `buildInvoice` throws
 * rather than produce a document asserting a payment that never happened —
 * a receipt for money nobody sent is a fabricated record, and it is exactly the
 * document that turns a routine review into a closed account.
 *
 * WHO THE SELLER IS comes from the settings the admin edits, so changing the
 * trading name changes it on every invoice — including ones for orders already
 * placed. That is a deliberate choice by the store owner: the shop trades under
 * one current name and every document should say so.
 *
 * ⚠️ THE CONSEQUENCE, so nobody rediscovers it by surprise: an invoice already
 * sent to somebody will not match the one downloaded for the same order after
 * the name changes. The per-order `seller_snapshot` is still written at
 * checkout and still readable, both as an audit trail of what the shop was
 * called at the time and as the fallback below — it is simply no longer what
 * the document prints.
 *
 * The PDF is written by lib/pdf.ts — no dependencies, so this runs unchanged on
 * Cloudflare Workers.
 */

import { PdfDocument, A4, type PdfImage } from "@/lib/pdf";
import { COMPANY, DEFAULT_SITE_SETTINGS } from "@/lib/company";
import { STAGE_COPY, type FulfillmentStage } from "@/lib/fulfillment";
// The same placeholder guard the structured data uses. Printing "[Registered
// business address — update in lib/company.ts]" on an invoice is worse than
// printing nothing: it tells a reviewer the document came off an unfinished
// template. One list, so the two can never disagree about what is real.
import { isReal } from "@/lib/seo";
import { trackingUrlFor } from "@/lib/couriers";
import { encodeQr } from "@/lib/qr";
import type { Order, OrderItem, SellerSnapshot, SiteSettings } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Style                                                                       */
/* -------------------------------------------------------------------------- */

// An invoice is a printed document: laid out light regardless of the
// storefront's dark theme, and in ink that photocopies and faxes legibly.
const INK = "#101014";
const MUTED = "#5c5f6b";
const HAIRLINE = "#d9dbe2";
const PANEL = "#f4f5f8";
const ACCENT = "#8fbf00";
const DUE = "#a8630a";
const PAID = "#1c7a3e";

const MARGIN = 44;
const CONTENT_WIDTH = A4.width - MARGIN * 2;
const BOTTOM = A4.height - 64;

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type InvoiceVariant = "proforma" | "paid";

/**
 * The address the invoice's QR code points at.
 *
 * A page that states the order's number, date, total and payment status, read
 * live — so somebody holding the printed document can check it against the
 * record rather than take it on trust. That is the whole value of the code: a
 * square that resolves to nothing corroborates nothing.
 */
export function verifyUrl(orderNumber: string, siteUrl?: string | null): string {
  const base = String(siteUrl || COMPANY.siteUrl).replace(/\/+$/, "");
  return `${base}/verify/${encodeURIComponent(orderNumber)}`;
}

export type InvoiceOptions = {
  order: Order;
  settings: SiteSettings;
  variant: InvoiceVariant;
  /** Raw logo bytes (PNG or JPEG). Omitted or undecodable → text watermark. */
  logo?: Uint8Array | null;
  siteUrl?: string | null;
};

/* -------------------------------------------------------------------------- */
/* Identity                                                                    */
/* -------------------------------------------------------------------------- */

const text = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
};

export type ResolvedSeller = {
  /** The name at the top of the document — the DBA where there is one. */
  display: string;
  /** The registered entity, when it differs from the display name. */
  legalName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  addressLines: string[];
  /** True when any of it fell back to the order's stored snapshot. */
  fromSnapshot: boolean;
};

/**
 * Who the seller is on this order's invoice.
 *
 * CURRENT SETTINGS FIRST. The trading name is edited in admin and every
 * document follows it, which is what the store owner asked for. The order's own
 * `seller_snapshot` is the fallback — it covers a field the settings do not
 * have, and it keeps a record of what the shop was called when the order was
 * placed. The company constants fill in for a field set nowhere at all.
 */
export function sellerFor(
  order: Pick<Order, "seller_snapshot">,
  settings: SiteSettings | null | undefined
): ResolvedSeller {
  const snap = (order.seller_snapshot ?? null) as SellerSnapshot | null;
  const fromSnapshot = Boolean(snap && Object.keys(snap).length > 0);

  const dba = text(settings?.dba_name) ?? text(snap?.dbaName);
  const legal = text(settings?.legal_name) ?? text(snap?.legalName);
  const display = dba ?? legal ?? COMPANY.name;

  // An address is a unit, not two independent lines: with no real street line
  // there is no address, and printing the city on its own would leave a legal
  // document claiming a location it cannot support.
  const line1 = text(settings?.address_line1) ?? text(snap?.addressLine1);
  const line2 = text(settings?.address_line2) ?? text(snap?.addressLine2);
  const addressLines = isReal(line1)
    ? [line1, isReal(line2) ? line2 : null].filter((l): l is string => Boolean(l))
    : [];

  // The first REAL candidate, not the first non-empty one: a settings email
  // still holding the shipped placeholder should fall through to the support
  // address rather than leaving the invoice with no way to contact the seller.
  const email = [settings?.company_email, snap?.email, COMPANY.supportEmail].find(
    (candidate) => isReal(text(candidate))
  );
  const phone = [settings?.company_phone, snap?.phone].find((candidate) =>
    isReal(text(candidate))
  );

  return {
    display,
    // Only worth a second line when it actually says something different.
    legalName: legal && legal !== display ? legal : null,
    taxId: text(settings?.tax_id) ?? text(snap?.taxId),
    email: text(email),
    phone: text(phone),
    addressLines,
    fromSnapshot,
  };
}

/**
 * The seller identity to freeze onto a new order.
 *
 * Called at checkout. Placeholder values are stored as null rather than frozen,
 * so an order placed before the shop's real details were filled in does not
 * carry "100 Drift Lane" forever.
 */
export function sellerSnapshot(
  settings: SiteSettings | null | undefined,
  now: Date = new Date()
): SellerSnapshot {
  const keep = (v: string | null | undefined) => (isReal(v) ? (text(v) as string) : null);
  const line1 = keep(settings?.address_line1);
  return {
    legalName: keep(settings?.legal_name),
    dbaName: keep(settings?.dba_name),
    taxId: keep(settings?.tax_id),
    email: keep(settings?.company_email),
    phone: keep(settings?.company_phone),
    addressLine1: line1,
    // Never freeze a city with no street to go with it — see sellerFor().
    addressLine2: line1 ? keep(settings?.address_line2) : null,
    capturedAt: now.toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Numbering + naming                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The invoice number.
 *
 * Derived from the order number rather than a counter: it has to be stable —
 * downloading the same invoice twice must not produce two different documents —
 * and unique, which the order number already guarantees. The prefix keeps a
 * proforma and the invoice that replaces it distinguishable at a glance and in
 * a filename.
 */
export function invoiceNumber(orderNumber: string, variant: InvoiceVariant): string {
  const base = String(orderNumber || "").trim() || "UNKNOWN";
  return variant === "paid" ? `INV-${base}` : `PRO-${base}`;
}

export function invoiceFilename(orderNumber: string, variant: InvoiceVariant): string {
  const safe = invoiceNumber(orderNumber, variant)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${safe || "invoice"}.pdf`;
}

/** True when this order may be issued a paid invoice. */
export function isPayable(order: Pick<Order, "status" | "paid_at">): boolean {
  return (
    (order.status === "paid" || order.status === "fulfilled") && Boolean(order.paid_at)
  );
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Money, always with cents.
 *
 * lib/format.ts drops the decimals on a round figure, which is right in a
 * catalogue and wrong on an invoice — "$1,899" in a totals column reads as an
 * approximation, and an invoice is not an approximation. The ISO code rather
 * than a bare symbol, because "$" is ambiguous across half our destinations.
 */
export function invoiceMoney(cents: number, currency = "usd"): string {
  const amount = Number.isFinite(cents) ? cents : 0;
  const code = (currency || "usd").toUpperCase();
  return `${code} ${(amount / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return `${formatDate(d)} ${d.toISOString().slice(11, 16)} UTC`;
}

const PAYMENT_METHODS: Record<string, string> = {
  stripe: "Card (Stripe)",
  paypal: "PayPal",
  manual: "Recorded manually",
};

/** The buyer's name and address, as lines. */
function buyerLines(order: Order): string[] {
  const a = (order.shipping_address ?? {}) as Record<string, unknown>;
  const s = (k: string) => text(a[k]);
  return [
    [s("first_name"), s("last_name")].filter(Boolean).join(" ") || null,
    s("address"),
    s("address2"),
    [s("city"), s("state"), s("zip")].filter(Boolean).join(", ") || null,
    s("country"),
    s("phone"),
  ].filter((l): l is string => Boolean(l));
}

/* -------------------------------------------------------------------------- */
/* The document                                                                */
/* -------------------------------------------------------------------------- */

export async function buildInvoice(
  opts: InvoiceOptions
): Promise<Uint8Array<ArrayBuffer>> {
  const { order, variant } = opts;
  const settings = opts.settings ?? DEFAULT_SITE_SETTINGS;
  const paid = variant === "paid";

  /**
   * THE INVOICE IS DATED TO THE DAY THE ORDER WAS PLACED, not the day the PDF
   * happened to be generated. An invoice records a transaction, so it carries
   * the date of that transaction — an August order downloaded in September is
   * an August invoice, and one dated "today" would not line up with the
   * gateway record it exists to corroborate.
   *
   * It also makes the document deterministic: the same order always produces
   * the same invoice, so downloading it twice cannot yield two documents that
   * disagree about their own date.
   */
  const issuedAt = order.created_at;

  if (paid && !isPayable(order)) {
    // The one hard refusal in this module. A document that says "PAID" for an
    // order nobody paid for is a fabricated record, and issuing one is far more
    // damaging than not having the button work.
    throw new Error(
      `Order ${order.order_number} is not paid, so no paid invoice can be issued. ` +
        "Mark it paid first, or download the proforma instead."
    );
  }

  const seller = sellerFor(order, settings);
  const number = invoiceNumber(order.order_number, variant);
  const title = paid ? "INVOICE" : "PROFORMA INVOICE";

  const doc = new PdfDocument({
    title: `${title} ${number}`,
    author: seller.display,
    subject: `${title} for order ${order.order_number}`,
  });

  const logo = opts.logo ? await doc.addImage(opts.logo) : null;
  let y = 0;

  const startPage = (first: boolean) => {
    doc.addPage();
    drawWatermark(doc, logo, seller.display, paid);
    y = first
      ? drawMasthead(doc, logo, seller, title, number, issuedAt)
      : drawContinuation(doc, number, order.order_number);
  };

  /**
   * Where to draw a block of `height`, breaking the page first if it will not
   * fit. Takes the caller's cursor and hands back the one to use, so a block
   * that paginates internally (the item table) can keep its own position
   * without a getter/setter pair threaded through it.
   */
  const need = (height: number, cursor: number = y): number => {
    if (cursor + height > BOTTOM) {
      startPage(false);
      return y;
    }
    return cursor;
  };

  startPage(true);

  y = drawStatusBar(doc, y, order, paid);
  y = drawMeta(doc, y, order, variant, issuedAt);
  y = drawParties(doc, y, order, seller);
  y = drawItems(doc, y, order, need);
  /**
   * The totals occupy the right-hand column only, which used to leave a tall
   * empty band down the left of every invoice. The verification code goes
   * there: it costs no vertical space at all, and it sits beside the figure a
   * reader is most likely to be checking.
   */
  const totalsTop = need(130, y);
  const afterTotals = drawTotals(doc, totalsTop, order, paid);
  const afterVerify = drawVerification(
    doc,
    totalsTop,
    verifyUrl(order.order_number, opts.siteUrl)
  );
  y = Math.max(afterTotals, afterVerify);

  y = drawPayment(doc, need(90, y), order, paid);
  y = drawFulfillment(doc, need(80, y), order);
  y = drawNotes(doc, need(60, y), settings, paid);

  drawFooters(doc, seller, number, order);
  return doc.toBytes();
}

/* -------------------------------------------------------------------------- */
/* Layout pieces                                                               */
/* -------------------------------------------------------------------------- */

function drawWatermark(
  doc: PdfDocument,
  logo: PdfImage | null,
  companyName: string,
  paid: boolean
): void {
  if (logo) {
    const box = PdfDocument.fit(logo.width, logo.height, A4.width * 0.6, A4.height * 0.36);
    doc.drawImage(logo, {
      x: (A4.width - box.width) / 2,
      y: (A4.height - box.height) / 2,
      width: box.width,
      height: box.height,
      opacity: 0.06,
    });
    return;
  }
  doc.drawWatermarkText(paid ? "PAID" : companyName.toUpperCase(), {
    size: paid ? 96 : 46,
    color: paid ? PAID : INK,
    opacity: 0.05,
  });
}

/** Page one masthead: seller on the left, document identity on the right. */
function drawMasthead(
  doc: PdfDocument,
  logo: PdfImage | null,
  seller: ResolvedSeller,
  title: string,
  number: string,
  issuedAt: string
): number {
  let left = MARGIN + 4;
  if (logo) {
    const box = PdfDocument.fit(logo.width, logo.height, 140, 46);
    doc.drawImage(logo, { x: MARGIN, y: MARGIN - 8, width: box.width, height: box.height });
    left = MARGIN + 2;
  }

  const nameY = logo ? MARGIN + 52 : MARGIN + 6;
  doc.drawText(seller.display, { x: left, y: nameY, size: 13, font: "bold", color: INK });

  doc.drawText(title, {
    x: A4.width - MARGIN,
    y: MARGIN + 6,
    size: 22,
    font: "bold",
    color: INK,
    align: "right",
    tracking: 1.2,
  });
  doc.drawText(number, {
    x: A4.width - MARGIN,
    y: MARGIN + 24,
    size: 10,
    color: MUTED,
    align: "right",
    tracking: 0.6,
  });
  doc.drawText(`Issued ${formatDate(issuedAt)}`, {
    x: A4.width - MARGIN,
    y: MARGIN + 38,
    size: 8,
    color: MUTED,
    align: "right",
  });

  const ruleY = Math.max(nameY, MARGIN + 44) + 14;
  doc.drawLine(MARGIN, ruleY, A4.width - MARGIN, ruleY, { color: INK, width: 1.4 });
  doc.drawLine(MARGIN, ruleY, MARGIN + 70, ruleY, { color: ACCENT, width: 3 });
  return ruleY + 18;
}

function drawContinuation(doc: PdfDocument, number: string, orderNumber: string): number {
  doc.drawText(number, { x: MARGIN, y: MARGIN + 6, size: 9, font: "bold", color: INK });
  doc.drawText(`Order ${orderNumber}`, {
    x: A4.width - MARGIN,
    y: MARGIN + 6,
    size: 9,
    color: MUTED,
    align: "right",
  });
  const ruleY = MARGIN + 16;
  doc.drawLine(MARGIN, ruleY, A4.width - MARGIN, ruleY, { color: HAIRLINE, width: 0.6 });
  return ruleY + 20;
}

/**
 * The single line a reader looks for first: is this paid, and for how much.
 *
 * A proforma says so in its own words rather than leaving it to be inferred
 * from a missing payment date — an unpaid document that merely omits the word
 * "unpaid" is one somebody will eventually mistake for a receipt.
 */
function drawStatusBar(doc: PdfDocument, top: number, order: Order, paid: boolean): number {
  const h = 34;
  const color = paid ? PAID : DUE;
  doc.drawRect(MARGIN, top, CONTENT_WIDTH, h, { color, opacity: 0.08 });
  doc.drawRect(MARGIN, top, 3.5, h, { color });

  doc.drawText(paid ? "PAID IN FULL" : "PAYMENT DUE", {
    x: MARGIN + 14,
    y: top + 15,
    size: 9,
    font: "bold",
    color,
    tracking: 1.4,
  });
  doc.drawText(
    paid
      ? `Settled ${formatDate(order.paid_at)} · nothing further is owed on this order`
      : "This is a proforma invoice, not a tax invoice. No payment has been received.",
    { x: MARGIN + 14, y: top + 27, size: 8, color: INK }
  );

  doc.drawText(invoiceMoney(order.total_cents, order.currency), {
    x: A4.width - MARGIN - 14,
    y: top + 22,
    size: 14,
    font: "bold",
    color: INK,
    align: "right",
  });
  return top + h + 16;
}

/** Invoice number, both dates, the order reference. Two columns of pairs. */
function drawMeta(
  doc: PdfDocument,
  top: number,
  order: Order,
  variant: InvoiceVariant,
  issuedAt: string
): number {
  const rows: [string, string][] = [
    ["Invoice number", invoiceNumber(order.order_number, variant)],
    // Invoice date IS the order date — see issuedAt in buildInvoice. There is
    // deliberately no separate "order placed" cell any more: two cells showing
    // the same date read as a template bug rather than as corroboration.
    ["Invoice date", formatDate(issuedAt)],
    ["Order number", order.order_number],
    [
      // The payment date is NOT re-dated to the order: it is a different fact,
      // and it is the field that reconciles this document against the gateway's
      // own record of the charge.
      variant === "paid" ? "Payment received" : "Payment terms",
      variant === "paid" ? formatDate(order.paid_at) : "Due on receipt",
    ],
    ["Currency", (order.currency || "usd").toUpperCase()],
  ];

  const colW = CONTENT_WIDTH / 3;
  let y = top;
  rows.forEach(([label, value], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = MARGIN + col * colW;
    const rowY = top + row * 30;
    doc.drawText(label.toUpperCase(), {
      x,
      y: rowY,
      size: 6.5,
      color: MUTED,
      tracking: 0.9,
    });
    doc.drawText(value, { x, y: rowY + 12, size: 9.5, font: "bold", color: INK });
    y = rowY + 12;
  });
  return y + 18;
}

/** Who is billing whom, side by side. */
function drawParties(
  doc: PdfDocument,
  top: number,
  order: Order,
  seller: ResolvedSeller
): number {
  const colW = (CONTENT_WIDTH - 24) / 2;
  const rightX = MARGIN + colW + 24;

  const heading = (label: string, x: number) =>
    doc.drawText(label.toUpperCase(), {
      x,
      y: top,
      size: 6.5,
      color: MUTED,
      tracking: 1.1,
    });
  heading("From", MARGIN);
  heading("Bill to", rightX);

  const sellerLines: string[] = [];
  // "a trading name of X" only when the registered entity actually differs —
  // printing it when the two match reads as boilerplate.
  if (seller.legalName) sellerLines.push(`a trading name of ${seller.legalName}`);
  sellerLines.push(...seller.addressLines);
  if (seller.taxId) sellerLines.push(`Tax / registration no. ${seller.taxId}`);
  if (seller.email) sellerLines.push(seller.email);
  if (seller.phone) sellerLines.push(seller.phone);

  // buyerLines() leads with the name, which is drawn as the block's heading —
  // so it is dropped from the body here rather than printed twice.
  const [buyerName, ...buyerRest] = buyerLines(order);
  // The customer's email is on every invoice: it is how the document is tied to
  // the account and to the payment, and it is the first field anyone verifying
  // a transaction looks for.
  const buyerBlock = [order.email, ...buyerRest];

  const write = (lines: string[], x: number, boldFirst: string | null): number => {
    let cy = top + 14;
    if (boldFirst) {
      doc.drawText(boldFirst, { x, y: cy, size: 10, font: "bold", color: INK });
      cy += 13;
    }
    for (const line of lines) {
      for (const wrapped of doc.wrap(line, colW, "regular", 8.5)) {
        doc.drawText(wrapped, { x, y: cy, size: 8.5, color: INK });
        cy += 11;
      }
    }
    return cy;
  };

  const a = write(sellerLines, MARGIN, seller.display);
  const b = write(buyerBlock, rightX, buyerName ?? null);
  return Math.max(a, b) + 14;
}

/** The line-item table. Paginates, redrawing its header on each new page. */
function drawItems(
  doc: PdfDocument,
  top: number,
  order: Order,
  need: (h: number, cursor: number) => number
): number {
  // Right-aligned money columns, so the decimal points line up down the page.
  const qtyX = MARGIN + CONTENT_WIDTH - 210;
  const unitX = MARGIN + CONTENT_WIDTH - 120;
  const amountX = MARGIN + CONTENT_WIDTH;
  const descW = qtyX - MARGIN - 40;

  const header = (y: number): number => {
    doc.drawRect(MARGIN, y, CONTENT_WIDTH, 20, { color: PANEL });
    const ty = y + 13;
    doc.drawText("DESCRIPTION", { x: MARGIN + 10, y: ty, size: 6.5, color: MUTED, tracking: 1 });
    doc.drawText("QTY", { x: qtyX, y: ty, size: 6.5, color: MUTED, tracking: 1, align: "right" });
    doc.drawText("UNIT PRICE", { x: unitX, y: ty, size: 6.5, color: MUTED, tracking: 1, align: "right" });
    doc.drawText("AMOUNT", { x: amountX - 10, y: ty, size: 6.5, color: MUTED, tracking: 1, align: "right" });
    return y + 28;
  };

  let cursor = header(top);

  const items = (order.items ?? []) as OrderItem[];
  if (items.length === 0) {
    doc.drawText("No line items recorded on this order.", {
      x: MARGIN + 10,
      y: cursor + 4,
      size: 9,
      color: MUTED,
    });
    cursor += 22;
  }

  for (const item of items) {
    const qty = Number(item.qty) || 0;
    const unit = Number(item.price_cents) || 0;
    const lines = doc.wrap(item.name || "Item", descW, "regular", 9.5);
    const rowH = Math.max(22, lines.length * 12 + 8 + (item.color ? 11 : 0));

    const rowY = need(rowH, cursor);
    // A page break inside the table has to bring the column headings with it,
    // or the continuation reads as an unlabelled grid of numbers.
    cursor = rowY === cursor ? cursor : header(rowY);

    let ty = cursor + 4;
    for (const line of lines) {
      doc.drawText(line, { x: MARGIN + 10, y: ty, size: 9.5, color: INK });
      ty += 12;
    }
    if (item.color) {
      doc.drawText(`Colour: ${item.color}`, { x: MARGIN + 10, y: ty, size: 8, color: MUTED });
      ty += 11;
    }

    const numY = cursor + 4;
    doc.drawText(String(qty), { x: qtyX, y: numY, size: 9.5, color: INK, align: "right" });
    doc.drawText(invoiceMoney(unit, order.currency), {
      x: unitX,
      y: numY,
      size: 9.5,
      color: INK,
      align: "right",
    });
    doc.drawText(invoiceMoney(unit * qty, order.currency), {
      x: amountX - 10,
      y: numY,
      size: 9.5,
      font: "bold",
      color: INK,
      align: "right",
    });

    const bottom = Math.max(ty, numY + 12) + 4;
    doc.drawLine(MARGIN, bottom, MARGIN + CONTENT_WIDTH, bottom, {
      color: HAIRLINE,
      width: 0.5,
    });
    cursor = bottom + 6;
  }

  return cursor + 4;
}

/** Subtotal through to the amount owed. */
function drawTotals(doc: PdfDocument, top: number, order: Order, paid: boolean): number {
  const boxW = 250;
  const x = MARGIN + CONTENT_WIDTH - boxW;
  const labelX = x + 12;
  const valueX = MARGIN + CONTENT_WIDTH - 12;
  let y = top;

  const row = (label: string, value: string, bold = false) => {
    doc.drawText(label, { x: labelX, y, size: 9, color: bold ? INK : MUTED, font: bold ? "bold" : "regular" });
    doc.drawText(value, {
      x: valueX,
      y,
      size: 9,
      font: bold ? "bold" : "regular",
      color: INK,
      align: "right",
    });
    y += 14;
  };

  row("Subtotal", invoiceMoney(order.subtotal_cents, order.currency));
  row(
    "Shipping",
    order.shipping_cents > 0 ? invoiceMoney(order.shipping_cents, order.currency) : "Free"
  );
  // A zero-tax line still prints. An invoice that simply omits tax leaves the
  // reader unable to tell whether none applied or somebody forgot it.
  row("Tax", invoiceMoney(order.tax_cents, order.currency));

  doc.drawLine(x, y - 4, MARGIN + CONTENT_WIDTH, y - 4, { color: INK, width: 0.8 });
  y += 8;
  row("Total", invoiceMoney(order.total_cents, order.currency), true);

  if (paid) {
    row("Amount paid", `-${invoiceMoney(order.total_cents, order.currency)}`);
    doc.drawRect(x, y - 4, boxW, 26, { color: PAID, opacity: 0.1 });
    y += 12;
    doc.drawText("Balance due", { x: labelX, y, size: 9, font: "bold", color: PAID });
    doc.drawText(invoiceMoney(0, order.currency), {
      x: valueX,
      y,
      size: 9,
      font: "bold",
      color: PAID,
      align: "right",
    });
    y += 20;
  } else {
    doc.drawRect(x, y - 4, boxW, 26, { color: DUE, opacity: 0.1 });
    y += 12;
    doc.drawText("Amount due", { x: labelX, y, size: 9, font: "bold", color: DUE });
    doc.drawText(invoiceMoney(order.total_cents, order.currency), {
      x: valueX,
      y,
      size: 9,
      font: "bold",
      color: DUE,
      align: "right",
    });
    y += 20;
  }
  return y + 10;
}

/**
 * The payment record.
 *
 * On a paid invoice this is the part that matters to anyone checking the
 * document against a gateway: method, date, and the processor's own reference,
 * so the two records can actually be reconciled against each other.
 */
function drawPayment(doc: PdfDocument, top: number, order: Order, paid: boolean): number {
  const h = 64;
  doc.drawRect(MARGIN, top, CONTENT_WIDTH, h, { color: PANEL });
  doc.drawText(paid ? "PAYMENT RECEIVED" : "HOW TO PAY", {
    x: MARGIN + 12,
    y: top + 15,
    size: 6.5,
    color: MUTED,
    tracking: 1.1,
  });

  if (!paid) {
    const lines = doc.wrap(
      "Payment is taken online by card or PayPal at checkout. Return to your order to complete " +
        "payment; nothing is dispatched until it clears. This document is issued for your records " +
        "and does not itself request or confirm a transfer.",
      CONTENT_WIDTH - 24,
      "regular",
      8.5
    );
    let y = top + 30;
    for (const line of lines) {
      doc.drawText(line, { x: MARGIN + 12, y, size: 8.5, color: INK });
      y += 11;
    }
    return top + h + 12;
  }

  const method = PAYMENT_METHODS[String(order.paid_via ?? "")] ?? "Not recorded";
  const pairs: [string, string][] = [
    ["Method", method],
    ["Date", formatDateTime(order.paid_at)],
    ["Reference", order.stripe_session_id ?? "—"],
  ];
  const colW = (CONTENT_WIDTH - 24) / 3;
  pairs.forEach(([label, value], i) => {
    const x = MARGIN + 12 + i * colW;
    doc.drawText(label.toUpperCase(), { x, y: top + 34, size: 6.5, color: MUTED, tracking: 0.9 });
    // The gateway reference is long; wrapped rather than truncated, because a
    // reference cut in half cannot be reconciled against anything.
    let y = top + 46;
    for (const line of doc.wrap(value, colW - 10, "regular", 8)) {
      doc.drawText(line, { x, y, size: 8, color: INK });
      y += 10;
    }
  });
  return top + h + 12;
}

/**
 * Where it went and how it got there.
 *
 * Not decoration: for a physical-goods seller this is the block that turns an
 * invoice into evidence that something real was shipped to a real address.
 */
function drawFulfillment(doc: PdfDocument, top: number, order: Order): number {
  const stage = (order.fulfillment_stage ?? "awaiting_payment") as FulfillmentStage;
  const link = trackingUrlFor(order.courier, order.tracking_number);

  const rows: [string, string][] = [
    ["Status", STAGE_COPY[stage]?.label ?? "—"],
    ["Courier", order.courier || "Not yet assigned"],
    ["Tracking", order.tracking_number || "Not yet assigned"],
    ["Estimated delivery", formatDate(order.estimated_delivery_at)],
  ];

  doc.drawText("DELIVERY", {
    x: MARGIN,
    y: top,
    size: 6.5,
    color: MUTED,
    tracking: 1.1,
  });
  doc.drawLine(MARGIN, top + 6, MARGIN + CONTENT_WIDTH, top + 6, {
    color: HAIRLINE,
    width: 0.6,
  });

  const colW = CONTENT_WIDTH / 4;
  rows.forEach(([label, value], i) => {
    const x = MARGIN + i * colW;
    doc.drawText(label.toUpperCase(), { x, y: top + 20, size: 6.5, color: MUTED, tracking: 0.9 });
    let y = top + 32;
    for (const line of doc.wrap(value, colW - 10, "regular", 8.5)) {
      doc.drawText(line, { x, y, size: 8.5, color: INK });
      y += 10;
    }
  });

  let y = top + 56;
  if (link) {
    for (const line of doc.wrap(`Track this shipment: ${link}`, CONTENT_WIDTH, "regular", 7.5)) {
      doc.drawText(line, { x: MARGIN, y, size: 7.5, color: MUTED });
      y += 9;
    }
  }
  return y + 10;
}

/**
 * The verification code, in the empty column beside the totals.
 *
 * THE CODE AND THE ADDRESS BOTH APPEAR, deliberately. Somebody reading the PDF
 * on a screen will not scan anything, so the URL has to be legible as text;
 * somebody holding the paper will not type it, so the code has to be scannable.
 * And an unlabelled QR on an invoice is exactly what a phishing document looks
 * like — saying where it goes, in words, is what makes it a feature rather than
 * a request for trust.
 *
 * Returns the bottom of what it drew, so the caller can carry on below whichever
 * of this and the totals runs longer.
 */
function drawVerification(doc: PdfDocument, top: number, url: string): number {
  // Level Q survives roughly a quarter of the symbol being lost, which is the
  // right trade for something that will be photocopied, faxed and photographed
  // off a screen at an angle.
  let matrix: ReturnType<typeof encodeQr>;
  try {
    matrix = encodeQr(url, "Q");
  } catch (e) {
    // A code that cannot be built is left out entirely. The invoice is complete
    // without it, and half a QR is worse than none.
    console.error("[invoice] could not build the verification code:", e);
    return top;
  }

  const box = 72;
  const colW = CONTENT_WIDTH - 250 - 24; // whatever the totals block leaves
  const quiet = 4; // modules of clear margin; a scanner needs it to lock on
  const unit = box / (matrix.size + quiet * 2);

  doc.drawText("VERIFY THIS DOCUMENT", {
    x: MARGIN,
    y: top,
    size: 6.5,
    color: MUTED,
    tracking: 1.1,
  });

  const qrTop = top + 8;
  // White ground under the whole symbol, quiet zone included: a QR printed onto
  // a tinted panel does not scan.
  doc.drawRect(MARGIN, qrTop, box, box, { color: "#ffffff" });
  for (let r = 0; r < matrix.size; r++) {
    for (let c = 0; c < matrix.size; c++) {
      if (!matrix.modules[r][c]) continue;
      doc.drawRect(
        MARGIN + (c + quiet) * unit,
        qrTop + (r + quiet) * unit,
        // A hair of overlap, so neighbouring dark modules meet cleanly rather
        // than showing hairlines where the renderer rounds them apart.
        unit + 0.05,
        unit + 0.05,
        { color: INK }
      );
    }
  }

  // The sentence sits beside the code; the URL goes underneath, across the whole
  // column. Squeezed into the narrow strip next to the code it wrapped
  // mid-token — "…/verify/EDT-7A3F91C" then "2" — which makes an address look
  // like two broken ones.
  const textX = MARGIN + box + 12;
  let y = qrTop + 10;
  for (const line of doc.wrap(
    "Scan, or open the address below, to check this invoice against our records.",
    colW - box - 12,
    "regular",
    7.5
  )) {
    doc.drawText(line, { x: textX, y, size: 7.5, color: INK });
    y += 9.5;
  }

  y = Math.max(y, qrTop + box) + 10;
  for (const line of doc.wrap(url, colW, "bold", 7.5)) {
    doc.drawText(line, { x: MARGIN, y, size: 7.5, font: "bold", color: INK });
    y += 9.5;
  }

  return y + 8;
}

/** Terms, the admin's own footer note, and the returns policy. */
function drawNotes(
  doc: PdfDocument,
  top: number,
  settings: SiteSettings,
  paid: boolean
): number {
  const note = text(settings.invoice_footer);
  const standard = paid
    ? `Goods remain covered by our returns policy for ${COMPANY.returnWindowDays} days from delivery. ` +
      `Refunds are issued to the original payment method and take up to ${COMPANY.refundProcessingDays} working days to reach your bank.`
    : "This proforma invoice is issued for your records. It is not a demand for payment by transfer, " +
      "and no goods are dispatched until payment has cleared through the checkout.";

  doc.drawText("NOTES", { x: MARGIN, y: top, size: 6.5, color: MUTED, tracking: 1.1 });
  let y = top + 14;
  for (const line of doc.wrap(standard, CONTENT_WIDTH, "regular", 8)) {
    doc.drawText(line, { x: MARGIN, y, size: 8, color: MUTED });
    y += 10;
  }
  if (note) {
    y += 4;
    for (const line of doc.wrap(note, CONTENT_WIDTH, "regular", 8)) {
      doc.drawText(line, { x: MARGIN, y, size: 8, color: INK });
      y += 10;
    }
  }
  return y + 10;
}

function drawFooters(
  doc: PdfDocument,
  seller: ResolvedSeller,
  number: string,
  order: Order
): void {
  const identity = [seller.display, seller.legalName, seller.taxId]
    .filter(Boolean)
    .join(" · ");
  doc.eachPage((page, total) => {
    doc.drawLine(MARGIN, A4.height - 46, A4.width - MARGIN, A4.height - 46, {
      color: HAIRLINE,
      width: 0.6,
    });
    doc.drawText(identity, { x: MARGIN, y: A4.height - 34, size: 7, color: MUTED });
    // No "generated on" stamp. The document is dated to the order, and a second
    // date in the footer saying otherwise is exactly the contradiction that
    // dating it to the order was meant to remove.
    doc.drawText(`${number} · order ${order.order_number} · page ${page} of ${total}`, {
      x: A4.width - MARGIN,
      y: A4.height - 34,
      size: 7,
      color: MUTED,
      align: "right",
    });
  });
}
