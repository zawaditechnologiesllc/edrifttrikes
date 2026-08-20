/**
 * The post-purchase delivery journey — the single source of truth for what
 * stage an order is in, when it advances, and exactly what the customer is
 * told at each step.
 *
 * Used by:
 *  - app/api/cron/orders     (the scheduler that advances orders + emails)
 *  - lib/orders.ts           (the paid transition)
 *  - lib/email.ts            (email copy)
 *  - components/storefront/OrderTracker.tsx (the customer-facing timeline)
 *  - app/admin/orders/*      (admin stage control)
 *
 * DELIBERATELY DEPENDENCY-FREE: no Supabase, no Next, no env. It is pure
 * functions over plain data, which is what makes it unit-testable (see
 * tests/fulfillment.test.ts) and safe to import from both server and client
 * components.
 */

export type FulfillmentStage =
  | "awaiting_payment"
  | "confirmed"
  | "shipped"
  | "arriving"
  | "ready_for_collection"
  | "delivered"
  | "cancelled";

/**
 * THE SCHEDULE. `afterDays` counts from the moment payment cleared (paid_at),
 * never from when the order was created — an order that sat unpaid for a week
 * must not skip straight to "shipped" the second it's paid.
 *
 * Changing a number here changes the whole system: the scheduler, the emails
 * and the customer timeline all read from this one table.
 */
export const FULFILLMENT_SCHEDULE = [
  { stage: "confirmed", afterDays: 0 },
  { stage: "shipped", afterDays: 3 },
  { stage: "arriving", afterDays: 25 },
  { stage: "ready_for_collection", afterDays: 28 },
] as const satisfies readonly { stage: FulfillmentStage; afterDays: number }[];

/** Days after payment that the customer is told to expect the package. */
export const ESTIMATED_DELIVERY_DAYS = 28;

/** Stages the scheduler is allowed to move an order through, in order. */
export const SCHEDULED_STAGES: FulfillmentStage[] = FULFILLMENT_SCHEDULE.map(
  (s) => s.stage
);

/**
 * Terminal stages the scheduler must never touch. Once an order is delivered
 * or cancelled the automation stops — only an admin moves it after that.
 */
export const TERMINAL_STAGES: FulfillmentStage[] = ["delivered", "cancelled"];

/** Every stage an admin may select, including the manual-only ones. */
export const ALL_STAGES: FulfillmentStage[] = [
  "awaiting_payment",
  ...SCHEDULED_STAGES,
  "delivered",
  "cancelled",
];

export type StageCopy = {
  /** Short badge text for the dashboard and admin list. */
  label: string;
  /** Timeline heading + email subject line. */
  title: string;
  /**
   * What the customer is told. `{date}` is replaced with the estimated
   * delivery date when one is known.
   */
  message: string;
};

export const STAGE_COPY: Record<FulfillmentStage, StageCopy> = {
  awaiting_payment: {
    label: "Awaiting payment",
    title: "Awaiting payment",
    message:
      "We've received your order and are waiting for payment to clear. Nothing ships until it does.",
  },
  confirmed: {
    label: "Confirmed",
    title: "Order confirmed — preparing your shipment",
    message:
      "Payment cleared and your order is confirmed. Our garage crew is preparing your build for dispatch, and we'll email you the moment it leaves the workshop. Estimated delivery: {date}.",
  },
  shipped: {
    label: "Shipped",
    title: "Your order has shipped",
    message:
      "Your order has left the garage and is now with our shipping partner. It's on its way to you — estimated delivery: {date}.",
  },
  arriving: {
    label: "Arriving",
    title: "Shipping complete — your package is arriving",
    message:
      "Shipping is complete. Your package has reached the destination hub and is being prepared for handover to your local courier. You should receive it by {date}.",
  },
  ready_for_collection: {
    label: "Ready for collection",
    title: "Your package is ready for collection",
    message:
      "Your package is ready for collection. Kindly wait for a courier email or call to collect, or to confirm door delivery.",
  },
  delivered: {
    label: "Delivered",
    title: "Delivered — enjoy the ride",
    message:
      "Your order has been delivered. Send us a photo of the first drift — and reach out any time if something isn't right.",
  },
  cancelled: {
    label: "Cancelled",
    title: "Order cancelled",
    message:
      "This order has been cancelled. If you believe that's a mistake, reply to this email and we'll sort it out.",
  },
};

const DAY_MS = 86_400_000;

/** Date `days` after `from`. */
export function addDays(from: Date | string, days: number): Date {
  const base = typeof from === "string" ? new Date(from) : from;
  return new Date(base.getTime() + days * DAY_MS);
}

/** The delivery date a customer is quoted, derived from when they paid. */
export function estimatedDeliveryAt(paidAt: Date | string): Date {
  return addDays(paidAt, ESTIMATED_DELIVERY_DAYS);
}

/** Human-readable delivery date for emails and the tracker ("12 March 2026"). */
export function formatDeliveryDate(value: Date | string | null | undefined): string {
  if (!value) return "shortly";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "shortly";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Resolve `{date}` in a stage message against the order's delivery estimate. */
export function stageMessage(
  stage: FulfillmentStage,
  estimatedDelivery?: Date | string | null
): string {
  return STAGE_COPY[stage].message.replace(
    "{date}",
    formatDeliveryDate(estimatedDelivery)
  );
}

/**
 * Days after payment that a scheduled stage falls due, or null for the
 * manual-only stages. Used to back-date an anchor when an admin moves an order
 * forward by hand, so the scheduler carries on from the right point.
 */
export function stageOffsetDays(stage: FulfillmentStage): number | null {
  const step = FULFILLMENT_SCHEDULE.find((s) => s.stage === stage);
  return step ? step.afterDays : null;
}

/** Position of a stage in the scheduled sequence, or -1 for manual stages. */
export function stageIndex(stage: FulfillmentStage): number {
  return SCHEDULED_STAGES.indexOf(stage);
}

/**
 * The furthest stage an order paid at `paidAt` should have reached by `now`.
 *
 * Returns the LAST due stage rather than the next one, so an order that was
 * paid 40 days ago (or a scheduler that was down for a week) lands directly on
 * its correct current stage instead of crawling forward one cron tick at a
 * time.
 */
export function dueStage(
  paidAt: Date | string,
  now: Date = new Date()
): FulfillmentStage {
  const paid = typeof paidAt === "string" ? new Date(paidAt) : paidAt;
  const elapsedDays = (now.getTime() - paid.getTime()) / DAY_MS;
  let due: FulfillmentStage = FULFILLMENT_SCHEDULE[0].stage;
  for (const step of FULFILLMENT_SCHEDULE) {
    if (elapsedDays >= step.afterDays) due = step.stage;
  }
  return due;
}

/**
 * Every stage between `current` (exclusive) and `target` (inclusive).
 *
 * The scheduler records an event row for each so the customer's timeline stays
 * complete even when several stages come due at once — but only emails the
 * final one, so nobody gets four emails in a single minute.
 */
export function stagesBetween(
  current: FulfillmentStage,
  target: FulfillmentStage
): FulfillmentStage[] {
  const from = stageIndex(current);
  const to = stageIndex(target);
  if (to < 0 || to <= from) return [];
  return SCHEDULED_STAGES.slice(from + 1, to + 1);
}

/** True when the scheduler is allowed to advance this order automatically. */
export function isSchedulable(
  stage: FulfillmentStage,
  status: string
): boolean {
  if (TERMINAL_STAGES.includes(stage)) return false;
  if (stage === "ready_for_collection") return false; // already at the end
  return status === "paid";
}

/** Progress through the journey as a 0–1 fraction, for the tracker bar. */
export function stageProgress(stage: FulfillmentStage): number {
  if (stage === "delivered") return 1;
  if (stage === "cancelled" || stage === "awaiting_payment") return 0;
  const i = stageIndex(stage);
  if (i < 0) return 0;
  return (i + 1) / SCHEDULED_STAGES.length;
}
