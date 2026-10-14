/**
 * The vocabulary of an order's status: the five values, what each one means for
 * the customer, and how a batch of them is reported.
 *
 * ═══ WHY THIS HOLDS NO LOGIC ═══════════════════════════════════════════════
 *
 * Because the admin's selection bar is a CLIENT component and needs all of it.
 * The transition itself — `applyStatusChange` in lib/orders.ts — reads the
 * database and sends email, so anything importing it is server-only. Keeping
 * the two apart is what lets the warning an admin reads before pressing Apply
 * come from the same table the sender uses, rather than from a second copy
 * that drifts.
 */

/** The order_status enum in the database — anything else is rejected. */
export const ORDER_STATUSES = [
  "pending",
  "paid",
  "fulfilled",
  "cancelled",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(v: unknown): v is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(String(v));
}

/**
 * What each status means for the customer, and what they are told.
 *
 * Written down rather than left implicit because the admin UI has to warn
 * about one of them before fifty are sent at once. `email` is the subject a
 * customer sees; null means nothing is sent and why is stated.
 */
export const STATUS_EFFECT: Record<
  OrderStatus,
  { label: string; email: string | null; note: string }
> = {
  pending: {
    label: "Pending",
    email: "Awaiting payment",
    note: "Tells the customer payment is outstanding and nothing ships until it clears. On an order they have already paid for, that is alarming — turn the email off when you are correcting a mistake.",
  },
  paid: {
    label: "Paid",
    email: "Order confirmed — preparing your shipment",
    note: "Runs the same transition the payment webhooks do: stamps paid_at, starts the delivery schedule and sends the confirmation. Refuses an order that is cancelled or refunded.",
  },
  fulfilled: {
    label: "Fulfilled",
    email: "Delivered — enjoy the ride",
    note: "Marks the order delivered and closes its delivery tracker.",
  },
  refunded: {
    label: "Refunded",
    email: "Refund issued",
    note: "Stops the delivery schedule and emails the refund notice. Does NOT move money — refund through the gateway that took it.",
  },
  cancelled: {
    label: "Cancelled",
    email: "Order cancelled",
    note: "Stops the delivery schedule so nothing further is sent about a package that is not coming.",
  },
};

/** What happened to one order. Every field is something an admin may need. */
export type StatusOutcome = {
  orderId: string;
  orderNumber: string | null;
  customerEmail: string | null;
  from: OrderStatus | null;
  to: OrderStatus;
  /** The row's status actually moved. */
  changed: boolean;
  /** A customer email was sent for this change. */
  emailed: boolean;
  /** Why nothing happened, when nothing did. */
  skipped?: "already_in_status" | "not_found";
  /** The status change itself failed; nothing was written. */
  error?: string;
  /** The status changed and is saved; the email did not go. */
  emailError?: string;
  /** Anything else worth telling the admin. */
  notes: string[];
};

/* -------------------------------------------------------------------------- */
/* Reading a batch back                                                        */
/* -------------------------------------------------------------------------- */

export type BatchSummary = {
  changed: number;
  emailed: number;
  alreadyThere: number;
  failed: number;
  emailsFailed: number;
};

export function summarize(outcomes: StatusOutcome[]): BatchSummary {
  return {
    changed: outcomes.filter((o) => o.changed).length,
    emailed: outcomes.filter((o) => o.emailed).length,
    alreadyThere: outcomes.filter((o) => o.skipped === "already_in_status").length,
    failed: outcomes.filter((o) => o.error).length,
    emailsFailed: outcomes.filter((o) => o.emailError).length,
  };
}

/** One line a human can read, from a batch of any size. */
export function describeBatch(outcomes: StatusOutcome[], to: OrderStatus): string {
  const s = summarize(outcomes);
  if (outcomes.length === 0) return "Nothing selected.";
  const parts: string[] = [];
  parts.push(`${s.changed} order${s.changed === 1 ? "" : "s"} → ${to}`);
  if (s.emailed) parts.push(`${s.emailed} customer${s.emailed === 1 ? "" : "s"} emailed`);
  if (s.alreadyThere) parts.push(`${s.alreadyThere} already ${to}`);
  if (s.emailsFailed) parts.push(`${s.emailsFailed} email${s.emailsFailed === 1 ? "" : "s"} failed to send`);
  if (s.failed) parts.push(`${s.failed} could not be changed`);
  return `${parts.join(", ")}.`;
}

/* -------------------------------------------------------------------------- */
/* Doing a lot of them                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The most orders ONE server call will process.
 *
 * ═══ THIS NUMBER IS A CLOUDFLARE LIMIT, NOT A GUESS ════════════════════════
 *
 * A Worker request on the free plan may make 50 subrequests (1,000 on Workers
 * Paid — see docs/SCALING.md). One status change costs roughly seven: read the
 * row, load it, write the status, move the delivery stage, claim the stage on
 * the timeline, link a guest account, send the email. Forty orders in a single
 * action would die partway through with some customers emailed and some not —
 * the worst available outcome, and silent.
 *
 * So the server does a few per call and the BROWSER loops, which also buys a
 * progress bar and something the admin can stop. Six is five sevens plus
 * headroom; raising it on Workers Paid is safe.
 */
export const BULK_CHUNK = 6;

/**
 * Gap left between orders that sent an email.
 *
 * Resend's free tier allows two requests a second. Fifty confirmations fired
 * as fast as a loop can go get rate-limited, and a rate-limited email is a
 * customer who never hears about a status their order has already moved to.
 */
export const EMAIL_PACE_MS = 600;

/** Split a selection into calls the server will accept. */
export function chunkIds(ids: string[], size: number = BULK_CHUNK): string[][] {
  const unique = Array.from(new Set(ids.map((v) => String(v).trim()).filter(Boolean)));
  const out: string[][] = [];
  for (let i = 0; i < unique.length; i += Math.max(1, size)) {
    out.push(unique.slice(i, i + Math.max(1, size)));
  }
  return out;
}
