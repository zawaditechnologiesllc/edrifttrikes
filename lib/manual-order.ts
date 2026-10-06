import { dollarsToCents } from "@/lib/price-filter";
import { normalizeShipping } from "@/lib/validation";
import type { PaidVia } from "@/lib/orders";

/**
 * An order typed in by hand, in the admin, for a payment that happened
 * somewhere this storefront could not see.
 *
 * ═══ WHY A SHOP NEEDS THIS ═════════════════════════════════════════════════
 *
 * Every order the checkout creates exists in the database BEFORE the buyer is
 * sent to a payment page, so a storefront sale always has a row. A payment
 * that did not come through the storefront has none: a Stripe payment link, an
 * invoice, a charge taken in the Dashboard, a bank transfer, a sale agreed over
 * the phone. The money is real, the customer is waiting, and there is nothing
 * to fulfil, invoice or track against.
 *
 * This builds that missing row, in exactly the shape the checkout would have
 * produced, so everything downstream — the delivery ladder, the invoice, the
 * tracking emails, the customer's account — works on it without knowing it was
 * typed rather than bought.
 *
 * ═══ TWO RULES ═════════════════════════════════════════════════════════════
 *
 * THE TOTAL IS NEVER TYPED. It is the sum of the lines plus shipping plus tax,
 * always, the same as a real order. An admin who needs the total to come out
 * at a different figure adds a line with a negative price — a discount, a
 * part-refund, a price match — which keeps the invoice readable and keeps
 * "what was charged" equal to "what the parts add up to". A typed total that
 * silently disagrees with its own line items is how a shop ends up unable to
 * explain an invoice to a customer.
 *
 * THE ADDRESS GOES THROUGH THE SAME WHITELIST as a real checkout
 * (normalizeShipping), so a manual order cannot carry fields the rest of the
 * system does not know about, and its country is stored in the one spelling
 * the shipping labels and invoices expect.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Statuses a manual order may be created in. */
export const MANUAL_ORDER_STATUSES = [
  "pending",
  "paid",
  "fulfilled",
  "cancelled",
  "refunded",
] as const;
export type ManualOrderStatus = (typeof MANUAL_ORDER_STATUSES)[number];

/** Where the money came from, when it has already been taken. */
export const MANUAL_PAID_VIA: readonly PaidVia[] = [
  "stripe",
  "paypal",
  "authorizenet",
  "manual",
];

/** The most lines one manual order may carry — a bound, not a design limit. */
export const MAX_MANUAL_ITEMS = 40;

/**
 * The largest amount a single line may carry, in dollars.
 *
 * The same ceiling dollarsToCents() uses, stated here because this module
 * REFUSES at it rather than clamping to it — see signedDollarsToCents.
 */
export const MAX_LINE_DOLLARS = 1_000_000;

export type ManualItemInput = {
  name?: string;
  /** Dollars, as typed. Negative is allowed — see the discount rule above. */
  price?: string;
  qty?: string;
  productId?: string;
  slug?: string;
  imageUrl?: string;
  color?: string;
};

export type ManualOrderInput = {
  email?: string;
  orderNumber?: string;
  status?: string;
  currency?: string;
  paidVia?: string;
  gatewayReference?: string;
  gatewayAccount?: string;
  /** `YYYY-MM-DD` or a full ISO timestamp. Blank means "now". */
  paidAt?: string;
  shippingFee?: string;
  tax?: string;
  note?: string;
  shipping?: Record<string, string>;
  items?: ManualItemInput[];
};

export type ManualOrderLine = {
  name: string;
  price_cents: number;
  qty: number;
  product_id: string | null;
  slug: string | null;
  image_url: string | null;
  color: string | null;
};

export type ManualOrderDraft = {
  email: string;
  order_number?: string;
  status: ManualOrderStatus;
  currency: string;
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  shipping_address: Record<string, string>;
  paid_via: PaidVia | null;
  gateway_reference: string | null;
  gateway_account: string | null;
  /** ISO, only when the order is being created already paid. */
  paid_at: string | null;
  note: string | null;
};

export type ManualOrderResult =
  | { ok: true; order: ManualOrderDraft; items: ManualOrderLine[] }
  | { ok: false; errors: string[] };

/* -------------------------------------------------------------------------- */
/* Small parsers                                                               */
/* -------------------------------------------------------------------------- */

const text = (v: unknown, max = 200): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/**
 * Dollars to cents, allowing a NEGATIVE value.
 *
 * dollarsToCents() refuses negatives on purpose — it serves the shop's price
 * filter, where a negative price is meaningless. An order line may legitimately
 * be negative: that is how a discount, a price match or a part-refund is
 * recorded without breaking the rule that the total is the sum of its parts.
 */
export function signedDollarsToCents(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const negative = raw.startsWith("-");
  const body = (negative ? raw.slice(1) : raw).trim();

  /*
   * Commas must be THOUSANDS SEPARATORS, properly grouped.
   *
   * dollarsToCents() simply strips them, which is right for the shop's price
   * filter — but here it would read "1,2,3" as $123 and put a number nobody
   * typed on an order. On the filter a misread means odd search results; on an
   * order it means an invoice that disagrees with the charge.
   */
  if (body.includes(",") && !/^\$?\d{1,3}(,\d{3})*(\.\d{1,2})?$/.test(body)) {
    return null;
  }

  /*
   * Refuse what dollarsToCents() would CLAMP.
   *
   * It caps at $1,000,000 — sensible for a price filter, wrong here: a typed
   * 12,345,678.90 would come back as a silent $1,000,000 and go onto an
   * invoice as a number nobody entered. Over the limit is a mistake, and a
   * mistake should be shown, not rounded.
   */
  const magnitude = Number(body.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(magnitude) || magnitude > MAX_LINE_DOLLARS) return null;

  const cents = dollarsToCents(body);
  if (cents === null) return null;
  return negative ? -cents : cents;
}

/** A quantity an order can actually carry: a whole number, 1–999. */
export function parseQty(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return 1;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (n < 1 || n > 999) return null;
  return n;
}

/**
 * When the money arrived.
 *
 * A date alone is read as NOON UTC, not midnight. Midnight on a date is the
 * previous evening in every timezone west of UTC, so a backfilled order would
 * show the day before the one the admin typed — and the delivery estimate,
 * which counts from this, would be a day out with it.
 */
export function parsePaidAt(value: unknown, now: Date = new Date()): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return now;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T12:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

const EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

/* -------------------------------------------------------------------------- */
/* The build                                                                   */
/* -------------------------------------------------------------------------- */

/** The address fields a manual order may carry — the checkout's own set. */
export const MANUAL_SHIPPING_FIELDS = [
  "first_name",
  "last_name",
  "address",
  "address2",
  "city",
  "state",
  "zip",
  "country",
  "phone",
] as const;

/** The line fields each repeated row carries, as `item.<n>.<field>`. */
export const MANUAL_ITEM_FIELDS = [
  "name",
  "price",
  "qty",
  "productId",
  "slug",
  "imageUrl",
  "color",
] as const;

/**
 * Read the admin form.
 *
 * ═══ WHY THIS IS HERE AND NOT IN THE ACTION ════════════════════════════════
 *
 * Because the wiring between the form's field NAMES and this parser is the
 * part most likely to break silently. A renamed input does not throw; it
 * simply arrives blank, and the order is created missing an address or a
 * payment reference that the admin is certain they typed. In the action it
 * could only be checked by submitting the form; here a test builds a FormData
 * with the component's real names and proves every one of them lands.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function manualOrderFromForm(formData: FormData): ManualOrderInput {
  const str = (key: string): string => {
    const v = formData.get(key);
    return typeof v === "string" ? v : "";
  };

  const shipping: Record<string, string> = {};
  for (const field of MANUAL_SHIPPING_FIELDS) {
    const value = str(`shipping.${field}`);
    if (value.trim()) shipping[field] = value;
  }

  const items: ManualItemInput[] = [];
  for (let i = 0; i < MAX_MANUAL_ITEMS; i++) {
    const row: Record<string, string> = {};
    for (const field of MANUAL_ITEM_FIELDS) row[field] = str(`item.${i}.${field}`);
    // A row the form never rendered contributes nothing; buildManualOrder
    // drops the empty ones anyway, but stopping here keeps the array honest.
    if (!Object.values(row).some((v) => v.trim())) continue;
    items.push(row as ManualItemInput);
  }

  return {
    email: str("email"),
    orderNumber: str("order_number"),
    status: str("status") || "pending",
    currency: str("currency") || "usd",
    paidVia: str("paid_via"),
    gatewayReference: str("gateway_reference"),
    gatewayAccount: str("gateway_account"),
    paidAt: str("paid_at"),
    shippingFee: str("shipping_fee"),
    tax: str("tax"),
    note: str("note"),
    shipping,
    items,
  };
}

/**
 * Validate and assemble a manual order. Pure: no database, no clock of its own
 * unless you let it default, so the whole thing is testable.
 *
 * Reports EVERY problem it finds rather than the first. An admin retyping a
 * ten-line order should not discover its faults one submit at a time.
 */
export function buildManualOrder(
  input: ManualOrderInput,
  now: Date = new Date()
): ManualOrderResult {
  const errors: string[] = [];

  // --- who ----------------------------------------------------------------
  const email = text(input.email, 254).toLowerCase();
  if (!email) errors.push("A customer email is required — it is how the order is found and who hears about it.");
  else if (!EMAIL.test(email)) errors.push(`"${email}" is not an email address.`);

  // --- lines --------------------------------------------------------------
  const rawItems = (input.items ?? []).filter(
    (i) => text(i?.name) || text(i?.price) || text(i?.productId)
  );
  if (rawItems.length === 0) {
    errors.push("An order needs at least one line.");
  }
  if (rawItems.length > MAX_MANUAL_ITEMS) {
    errors.push(`An order cannot have more than ${MAX_MANUAL_ITEMS} lines.`);
  }

  const items: ManualOrderLine[] = [];
  rawItems.slice(0, MAX_MANUAL_ITEMS).forEach((raw, index) => {
    const line = index + 1;
    const name = text(raw.name);
    const price = signedDollarsToCents(raw.price);
    const qty = parseQty(raw.qty);

    if (!name) errors.push(`Line ${line}: a description is required.`);
    if (price === null) errors.push(`Line ${line}: "${text(raw.price) || "(blank)"}" is not a price.`);
    if (qty === null) errors.push(`Line ${line}: quantity must be a whole number from 1 to 999.`);
    if (!name || price === null || qty === null) return;

    items.push({
      name,
      price_cents: price,
      qty,
      product_id: text(raw.productId) || null,
      slug: text(raw.slug) || null,
      image_url: text(raw.imageUrl, 2048) || null,
      color: text(raw.color, 40) || null,
    });
  });

  // --- money --------------------------------------------------------------
  const subtotal = items.reduce((sum, i) => sum + i.price_cents * i.qty, 0);

  const shippingRaw = text(input.shippingFee);
  const shipping = shippingRaw ? signedDollarsToCents(shippingRaw) : 0;
  if (shipping === null) errors.push(`"${shippingRaw}" is not a shipping amount.`);

  const taxRaw = text(input.tax);
  const tax = taxRaw ? signedDollarsToCents(taxRaw) : 0;
  if (tax === null) errors.push(`"${taxRaw}" is not a tax amount.`);

  const total = subtotal + (shipping ?? 0) + (tax ?? 0);
  /*
   * A negative total would be a refund, not an order, and nothing downstream —
   * invoice, gateway reference, delivery ladder — means anything against one.
   * Caught here rather than at the database, which would take it.
   */
  if (errors.length === 0 && total < 0) {
    errors.push("The order totals less than nothing. Check the discount lines.");
  }

  // --- status and payment --------------------------------------------------
  const status = (text(input.status) || "pending") as ManualOrderStatus;
  if (!MANUAL_ORDER_STATUSES.includes(status)) {
    errors.push(`"${status}" is not an order status.`);
  }

  const paidViaRaw = text(input.paidVia);
  const paidVia = paidViaRaw ? (paidViaRaw as PaidVia) : null;
  if (paidVia && !MANUAL_PAID_VIA.includes(paidVia)) {
    errors.push(`"${paidViaRaw}" is not a payment method.`);
  }

  const settled = status === "paid" || status === "fulfilled";
  const paidAt = settled ? parsePaidAt(input.paidAt, now) : null;
  if (settled && paidAt === null) {
    errors.push(`"${text(input.paidAt)}" is not a date.`);
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    order: {
      email,
      // Blank means "let the database generate one", which is what the
      // checkout relies on — so a manual order numbers itself the same way.
      ...(text(input.orderNumber, 40) ? { order_number: text(input.orderNumber, 40) } : {}),
      status,
      currency: (text(input.currency, 3) || "usd").toLowerCase(),
      subtotal_cents: subtotal,
      shipping_cents: shipping ?? 0,
      tax_cents: tax ?? 0,
      total_cents: total,
      shipping_address: normalizeShipping(input.shipping ?? {}),
      paid_via: settled ? (paidVia ?? "manual") : paidVia,
      gateway_reference: text(input.gatewayReference) || null,
      gateway_account: text(input.gatewayAccount) || null,
      paid_at: paidAt ? paidAt.toISOString() : null,
      note: text(input.note, 500) || null,
    },
    items,
  };
}
