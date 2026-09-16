/**
 * How a payment is described, everywhere it is described.
 *
 * ═══ ONE SOURCE, EVERY SURFACE ═════════════════════════════════════════════
 *
 * The admin order page, the Paid Orders list, the invoice PDF, the rider's
 * dashboard and the receipt all report the same payment, and before this they
 * each phrased it their own way: one printed the raw `paid_via` column, so
 * Authorize.Net read as "Authorizenet"; one showed a bare id with no hint of
 * whether it was a Stripe session, a PayPal order or a transaction id; two
 * described the store as taking "Stripe or PayPal" months after a third gateway
 * shipped. Everything on those screens now comes from here.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE ADMIN AND THE CUSTOMER GET DIFFERENT DEPTHS. `paymentRows` is the full
 * internal record — gateway ids, which merchant account took it. `customerPaymentLine`
 * is one sentence with none of that: a buyer needs to know their card went
 * through, not which login id the money landed on.
 *
 * DEPENDENCY-FREE: pure functions over a plain order, so the PDF writer, the
 * server components and the tests all read the same strings.
 */

import type { Order } from "@/lib/types";

/** Every way money can reach the store, in the order the admin filters them. */
export const PAYMENT_SOURCES = [
  "stripe",
  "paypal",
  "authorizenet",
  "manual",
] as const;

export type PaymentSource = (typeof PAYMENT_SOURCES)[number];

const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Normalise whatever is in `paid_via` to a known source, or null. */
export function paymentSource(order: Pick<Order, "paid_via">): PaymentSource | null {
  const via = clean(order.paid_via).toLowerCase();
  return (PAYMENT_SOURCES as readonly string[]).includes(via)
    ? (via as PaymentSource)
    : null;
}

/** Short badge text — the admin lists and filter tabs. */
export const SOURCE_LABEL: Record<PaymentSource, string> = {
  stripe: "Stripe",
  paypal: "PayPal",
  authorizenet: "Authorize.Net",
  manual: "Manual",
};

/** Full method name — invoices and the payment panel. */
export const METHOD_LABEL: Record<PaymentSource, string> = {
  stripe: "Card (Stripe)",
  paypal: "PayPal",
  authorizenet: "Card (Authorize.Net)",
  manual: "Recorded manually",
};

/**
 * What the gateway's id actually IS, per provider.
 *
 * "Reference: 60115585081" tells an admin chasing a payment nothing about where
 * to go and look it up. Naming it does.
 */
export const REFERENCE_LABEL: Record<PaymentSource, string> = {
  stripe: "Checkout session",
  paypal: "PayPal order",
  authorizenet: "Transaction ID",
  manual: "Reference",
};

export function methodLabel(order: Pick<Order, "paid_via">): string {
  const source = paymentSource(order);
  // Orders paid before migration 0007 have no recorded source. Saying so beats
  // implying one, because reconciling takings depends on the difference.
  return source ? METHOD_LABEL[source] : "Not recorded";
}

export function sourceLabel(order: Pick<Order, "paid_via">): string {
  const source = paymentSource(order);
  return source ? SOURCE_LABEL[source] : "Unknown";
}

/**
 * The gateway's own id for the payment.
 *
 * `stripe_session_id` is the fallback because it carried every provider's id
 * before migration 0018 split them apart — older orders still only have it.
 */
export function gatewayReference(
  order: Pick<Order, "gateway_reference" | "stripe_session_id">
): string | null {
  return clean(order.gateway_reference) || clean(order.stripe_session_id) || null;
}

export function referenceLabel(order: Pick<Order, "paid_via">): string {
  const source = paymentSource(order);
  return source ? REFERENCE_LABEL[source] : "Reference";
}

/* -------------------------------------------------------------------------- */
/* The admin's full record                                                     */
/* -------------------------------------------------------------------------- */

export type PaymentRow = {
  label: string;
  value: string;
  /** Render in a monospace-ish, breakable style — it is an identifier. */
  mono?: boolean;
  /** Why this row is here, for a title attribute. Only where it isn't obvious. */
  hint?: string;
};

type PaymentOrder = Pick<
  Order,
  | "paid_via"
  | "paid_at"
  | "gateway_reference"
  | "stripe_session_id"
  | "gateway_account"
  | "status"
>;

/**
 * Everything known about how this order was paid, as labelled rows.
 *
 * Returns [] when there is nothing to show, so a caller can drop the whole
 * panel rather than render an empty heading.
 */
export function paymentRows(order: PaymentOrder): PaymentRow[] {
  const rows: PaymentRow[] = [];
  const reference = gatewayReference(order);
  const account = clean(order.gateway_account);
  const paidAt = clean(order.paid_at);

  if (!order.paid_via && !reference && !account && !paidAt) return rows;

  rows.push({ label: "Method", value: methodLabel(order) });

  if (paidAt) {
    rows.push({
      // Date AND time: two payments on the same day are routine, and the time
      // is what matches a row here to a row in the gateway's dashboard.
      label: "Paid",
      value: formatPaidAt(paidAt),
    });
  } else if (order.status === "pending") {
    rows.push({
      label: "Paid",
      value: "Not yet — payment has not cleared",
    });
  }

  if (reference) {
    rows.push({ label: referenceLabel(order), value: reference, mono: true });
  }

  if (account) {
    rows.push({
      label: "Gateway account",
      value: account,
      mono: true,
      hint: "The merchant account that took this payment. A refund has to go back through this one, even after the credentials are swapped.",
    });
  }

  return rows;
}

/** "3 March 2026, 14:07" — unambiguous across locales, no seconds. */
export function formatPaidAt(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

/* -------------------------------------------------------------------------- */
/* What the buyer sees                                                         */
/* -------------------------------------------------------------------------- */

/**
 * One sentence for the rider's dashboard and the receipt.
 *
 * Deliberately free of gateway ids and account names: they mean nothing to a
 * buyer, and publishing which merchant account took a payment is the store's
 * business, not the customer's. Returns null when there is nothing true to say.
 */
export function customerPaymentLine(
  order: Pick<Order, "paid_via" | "paid_at" | "status">
): string | null {
  if (order.status === "cancelled" || order.status === "refunded") return null;
  const paidAt = clean(order.paid_at);
  if (!paidAt) return null;

  const source = paymentSource(order);
  const how =
    source === "stripe" || source === "authorizenet"
      ? "by card"
      : source === "paypal"
        ? "with PayPal"
        : null;

  const when = formatPaidAt(paidAt);
  // "Payment received on …" when we cannot honestly name the method — a manual
  // entry covers bank transfer, cash on collection and a gateway that failed to
  // call back, and guessing between them on the buyer's receipt is worse than
  // leaving it out.
  return how ? `Paid ${how} on ${when}.` : `Payment received on ${when}.`;
}
