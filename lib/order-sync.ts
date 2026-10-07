/**
 * Reconciling what Stripe took with what this shop recorded.
 *
 * ═══ THE GAP THIS CLOSES ═══════════════════════════════════════════════════
 *
 * An order is created BEFORE the buyer reaches the payment page, and it is the
 * webhook — Stripe → Render → /api/internal/order-paid → markOrderPaid — that
 * later turns it from `pending` into `paid`. One link in that chain being down
 * does not lose the order and does not lose the money; it loses the TRANSITION.
 * The row sits in `pending` for ever: absent from Paid Orders, absent from the
 * revenue figure, never emailed, never scheduled for delivery, while Stripe
 * shows the payment as perfectly successful.
 *
 * From the admin that looks exactly like "the order was never recorded", which
 * is why it is worth saying plainly: the row is almost always there. What is
 * missing is the word "paid" on it.
 *
 * So this asks Stripe directly, order by order, and applies the transition the
 * webhook should have. It also looks the other way — for payments Stripe has
 * that this shop has no row for at all, which is the genuinely missing case
 * and needs a manual order rather than a repair.
 *
 * ═══ WHAT IT WILL NOT DO ═══════════════════════════════════════════════════
 *
 * It never invents a payment. An order is only ever marked paid because a
 * Stripe session for it came back `payment_status: "paid"`; anything else is
 * reported and left alone. It never un-marks, never cancels, never refunds,
 * and never touches an order that is already paid, fulfilled, cancelled or
 * refunded. Every write goes through markOrderPaid, which is idempotent, so
 * running it twice is the same as running it once.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** The shape of a Stripe Checkout Session this module cares about. */
export type SessionLike = {
  id: string;
  payment_status?: string | null;
  status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  created?: number | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
  payment_intent?: string | { id?: string } | null;
  metadata?: Record<string, string> | null;
};

/** The order columns reconciliation reads. */
export type OrderLike = {
  id: string;
  order_number: string;
  status: string;
  email?: string | null;
  total_cents?: number | null;
  stripe_session_id?: string | null;
  gateway_reference?: string | null;
};

/**
 * Has Stripe actually taken the money for this session?
 *
 * `payment_status` is the field that answers it, and the only one. A session's
 * `status` tells you whether the PAGE was completed, which is not the same
 * thing — an expired session can be complete, and a `paid` one is paid whatever
 * else is true of it. Deliberately narrow: `no_payment_required` is not money
 * and must never mark an order paid.
 */
export function sessionIsPaid(session: SessionLike): boolean {
  return String(session?.payment_status ?? "").toLowerCase() === "paid";
}

/** The payment reference to record against an order, when there is one. */
export function sessionReference(session: SessionLike): string {
  const intent = session?.payment_intent;
  const intentId = typeof intent === "string" ? intent : intent?.id;
  return String(intentId || session?.id || "");
}

/** The buyer's address as Stripe has it, for reporting an unmatched payment. */
export function sessionEmail(session: SessionLike): string {
  return String(
    session?.customer_details?.email || session?.customer_email || ""
  ).toLowerCase();
}

const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Which order does this Stripe session belong to?
 *
 * In priority order, because the later keys are weaker:
 *
 *  1. `metadata.order_id` — what the checkout writes and what the webhook
 *     reads. Exact, and present on every session this storefront created.
 *  2. `metadata.order_number` — the same thing by its human name, for a session
 *     created before the id was carried, or by hand.
 *  3. the session id or PaymentIntent recorded ON the order, which is how a
 *     manually typed order links itself to a payment.
 *
 * Email is deliberately NOT a fallback. One buyer can have several orders, and
 * matching on it would mark the wrong one paid — a mistake that sends a
 * delivery schedule for goods nobody bought.
 */
export function matchOrderForSession(
  session: SessionLike,
  orders: OrderLike[]
): OrderLike | null {
  const meta = session?.metadata ?? {};
  const byId = clean(meta.order_id);
  if (byId) {
    const hit = orders.find((o) => o.id === byId);
    if (hit) return hit;
  }
  const byNumber = clean(meta.order_number);
  if (byNumber) {
    const hit = orders.find((o) => o.order_number === byNumber);
    if (hit) return hit;
  }

  const sessionId = clean(session?.id);
  const intent = sessionReference(session);
  const hit = orders.find((o) => {
    const refs = [clean(o.stripe_session_id), clean(o.gateway_reference)].filter(Boolean);
    return refs.some((r) => r === sessionId || (intent && r === intent));
  });
  return hit ?? null;
}

/** Statuses that are already settled or closed — never touched by a sync. */
const SETTLED = new Set(["paid", "fulfilled", "cancelled", "refunded"]);

/**
 * Should this order be marked paid on the strength of this session?
 *
 * Both halves have to be true: Stripe says the money is in, AND the order is
 * still waiting for it. Returning a REASON rather than a boolean so the report
 * can say why nothing happened, which is the difference between "working as
 * intended" and "silently did nothing".
 */
export function repairDecision(
  order: OrderLike,
  session: SessionLike
): { act: boolean; reason: string } {
  if (!sessionIsPaid(session)) {
    return {
      act: false,
      reason: `Stripe says payment_status="${session?.payment_status ?? "unknown"}", not paid`,
    };
  }
  if (SETTLED.has(String(order.status).toLowerCase())) {
    return { act: false, reason: `already ${order.status}` };
  }
  return { act: true, reason: "Stripe confirms this was paid" };
}

/** A payment Stripe has that this shop has no order for. */
export type OrphanPayment = {
  sessionId: string;
  reference: string;
  email: string;
  amountCents: number;
  currency: string;
  /** ISO, from Stripe's `created` (seconds). */
  paidAt: string | null;
};

export function describeOrphan(session: SessionLike): OrphanPayment {
  return {
    sessionId: clean(session.id),
    reference: sessionReference(session),
    email: sessionEmail(session),
    amountCents: Number(session.amount_total ?? 0),
    currency: String(session.currency ?? "usd").toLowerCase(),
    paidAt: session.created
      ? new Date(Number(session.created) * 1000).toISOString()
      : null,
  };
}

export type SyncReport = {
  /** Stripe sessions examined. */
  scanned: number;
  /** Paid sessions that matched an order. */
  matched: number;
  /** Order numbers this run transitioned to paid. */
  repaired: string[];
  /** Paid sessions whose order was already settled — the healthy case. */
  alreadyPaid: number;
  /** Paid Stripe payments with NO order row at all. */
  orphans: OrphanPayment[];
  /** Anything that went wrong, per order, rather than failing the whole run. */
  problems: string[];
  /** True when Stripe could not be reached or is not configured. */
  blocked?: string;
};

export const emptyReport = (): SyncReport => ({
  scanned: 0,
  matched: 0,
  repaired: [],
  alreadyPaid: 0,
  orphans: [],
  problems: [],
});

/**
 * The report in a sentence, for the admin page.
 *
 * Written so that the GOOD outcome is unmistakable. "Nothing to repair" is the
 * answer most of the time and has to read as reassurance, not as failure.
 */
export function summarizeSync(report: SyncReport): string {
  if (report.blocked) return report.blocked;

  const parts: string[] = [];
  parts.push(
    `Checked ${report.scanned} Stripe payment${report.scanned === 1 ? "" : "s"}.`
  );

  if (report.repaired.length > 0) {
    parts.push(
      `Marked ${report.repaired.length} order${report.repaired.length === 1 ? "" : "s"} paid: ${report.repaired.join(", ")}.`
    );
  } else {
    parts.push("No order was waiting on a payment Stripe had already taken.");
  }

  if (report.orphans.length > 0) {
    parts.push(
      `${report.orphans.length} payment${report.orphans.length === 1 ? " has" : "s have"} no order at all — ` +
        "create one with New order so it can be invoiced and tracked."
    );
  }

  if (report.problems.length > 0) {
    parts.push(`${report.problems.length} could not be checked.`);
  }

  return parts.join(" ");
}
