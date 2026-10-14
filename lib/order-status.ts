import { ALL_STAGES, STAGE_COPY, type FulfillmentStage } from "@/lib/fulfillment";

/**
 * The vocabulary of what an admin can change about an order in bulk — its
 * payment STATUS and its delivery STAGE — what each value means for the
 * customer, and how a batch of either is reported.
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

/**
 * What happened to one order. Every field is something an admin may need.
 *
 * Generic over the thing being changed, because a status change and a stage
 * change report identically — and the admin reads ONE list afterwards. Two
 * shapes would have meant two renderers and, before long, two different ideas
 * of what "already there" means.
 */
export type ChangeOutcome<T extends string> = {
  orderId: string;
  orderNumber: string | null;
  customerEmail: string | null;
  from: T | null;
  to: T;
  /** The row actually moved. */
  changed: boolean;
  /** A customer email was sent for this change. */
  emailed: boolean;
  /** Why nothing happened, when nothing did. */
  skipped?: "already_there" | "not_found";
  /** The change itself failed; nothing was written. */
  error?: string;
  /** The change is saved; the email did not go. */
  emailError?: string;
  /** Anything else worth telling the admin. */
  notes: string[];
};

export type StatusOutcome = ChangeOutcome<OrderStatus>;
export type StageOutcome = ChangeOutcome<FulfillmentStage>;
/** Either kind, for the report renderer, which does not care which it got. */
export type AnyOutcome = ChangeOutcome<string>;

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

export function summarize(outcomes: AnyOutcome[]): BatchSummary {
  return {
    changed: outcomes.filter((o) => o.changed).length,
    emailed: outcomes.filter((o) => o.emailed).length,
    alreadyThere: outcomes.filter((o) => o.skipped === "already_there").length,
    failed: outcomes.filter((o) => o.error).length,
    emailsFailed: outcomes.filter((o) => o.emailError).length,
  };
}

/** One line a human can read, from a batch of any size. */
export function describeBatch(outcomes: AnyOutcome[], to: string): string {
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

/* -------------------------------------------------------------------------- */
/* The other thing an admin changes in bulk: the delivery stage                */
/* -------------------------------------------------------------------------- */

/**
 * Stages an admin may set by hand, newest journey order.
 *
 * The same list the single-order form offers, so the bulk control cannot drift
 * from it — ALL_STAGES is the schedule plus the two manual ends.
 */
export const BULK_STAGES: FulfillmentStage[] = ALL_STAGES;

export function isStage(v: unknown): v is FulfillmentStage {
  return (ALL_STAGES as readonly string[]).includes(String(v));
}

/**
 * What setting a stage does beyond sending its email.
 *
 * Only the stages that do something SURPRISING are written down. Everything
 * else moves the customer's tracker and emails them, which is what the subject
 * line already says — a note repeating it would be noise an admin learns to
 * skip past, and then they skip past these too.
 */
const STAGE_NOTE: Partial<Record<FulfillmentStage, string>> = {
  awaiting_payment:
    "Puts the order back before payment. On an order the customer has already paid for this reads as a problem with their money — turn the email off when you are correcting a mistake.",
  delivered:
    "Closes the delivery tracker. It does not change the payment status: set that to Fulfilled separately if you want the order marked complete in the books.",
  cancelled:
    "Stops the delivery schedule so nothing further is sent about a package that is not coming. It does not change the payment status, and it does not refund anything.",
  ready_for_collection:
    "Tells the customer to wait for the courier to arrange collection or confirm door delivery — the one stage that asks them to do something.",
  shipped:
    "Says the order has left the workshop, quoting the delivery estimate. If the tracking number is not on the order yet, add it first — the email carries it.",
};

/**
 * One stage, described the way the status table describes a status.
 *
 * Built from STAGE_COPY rather than restated, so the subject an admin is
 * warned about before pressing Apply is the subject the customer receives.
 */
export function stageEffect(stage: FulfillmentStage): {
  label: string;
  email: string;
  note: string;
} {
  const copy = STAGE_COPY[stage];
  return {
    label: copy.label,
    email: copy.title,
    note:
      STAGE_NOTE[stage] ??
      "Moves the customer's delivery tracker to this stage and emails them to say so.",
  };
}

/**
 * Stages that would be a lie on an order whose money has gone back.
 *
 * Telling someone their refunded order has shipped is the same failure the
 * status control already refuses in the other direction — and in bulk it is
 * the easy mistake, because a refunded row looks like any other row in a
 * selection of forty. Only closing such an order is allowed.
 */
export function stageAllowedForStatus(
  stage: FulfillmentStage,
  status: string | null | undefined
): boolean {
  const closed = status === "cancelled" || status === "refunded";
  return !closed || stage === "cancelled";
}
