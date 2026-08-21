/**
 * Chasing an order that was placed but never paid for.
 *
 * An order row is created the moment the checkout form is submitted. If payment
 * never follows, that row is a buyer who wanted the thing and stopped — the
 * most convertible audience the store has, and until now one it never wrote to
 * again.
 *
 * THE CADENCE, counted from when the order was created:
 *
 *   day 0   sent by the checkout API itself (lib/email.ts)
 *   day 3   a nudge
 *   day 7   a firmer one
 *   day 12  the last
 *
 * And then never again. A shop that keeps mailing about an order someone
 * decided against stops being a shop they read.
 *
 * DEPENDENCY-FREE, like lib/fulfillment.ts, so the schedule is unit-testable
 * without a database and the copy can be rendered anywhere.
 */

export type ReminderStep = 2 | 3 | 4;

/**
 * THE SCHEDULE. Step 1 is the email the checkout API sends immediately; it is
 * listed so the numbering matches the event rows and nothing has to remember
 * that the cron's first send is really the second email.
 */
export const ABANDONED_SCHEDULE = [
  { step: 1, afterDays: 0 },
  { step: 2, afterDays: 3 },
  { step: 3, afterDays: 7 },
  { step: 4, afterDays: 12 },
] as const;

/** Steps the scheduler is responsible for. Step 1 is not one of them. */
export const REMINDER_STEPS: ReminderStep[] = [2, 3, 4];

/** After this many days an unpaid order is left alone for good. */
export const ABANDONED_LAST_DAY = 12;

/**
 * How far back the sweep looks.
 *
 * Deliberately not "forever". Switching this feature on must not mail every
 * pending order the database has ever accumulated — some are months old and
 * their buyers have long since moved on. Anything older than this window is
 * never contacted, which makes turning it on safe.
 */
export const ABANDONED_WINDOW_DAYS = 14;

const DAY_MS = 86_400_000;

/** The event-row stage a reminder claims. Must be stable — it is the lock. */
export function reminderStage(step: number): string {
  return `abandoned_${step}`;
}

/** Days since `createdAt`, as a float. */
function daysSince(createdAt: Date | string, now: Date): number {
  const created = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  if (Number.isNaN(created.getTime())) return -1;
  return (now.getTime() - created.getTime()) / DAY_MS;
}

/**
 * The furthest reminder now due for an order created at `createdAt`, or null.
 *
 * Returns the LAST due step rather than the next one, so an order the scheduler
 * missed for a week gets one correct email rather than a burst of three. Same
 * reasoning as dueStage() in lib/fulfillment.ts.
 */
export function dueReminder(
  createdAt: Date | string,
  now: Date = new Date()
): ReminderStep | null {
  const age = daysSince(createdAt, now);
  if (age < 0) return null;
  // A clock skew that puts the order in the future must not fire everything.
  if (age > ABANDONED_WINDOW_DAYS) return null;

  let due: ReminderStep | null = null;
  for (const entry of ABANDONED_SCHEDULE) {
    if (entry.step === 1) continue;
    if (age >= entry.afterDays) due = entry.step as ReminderStep;
  }
  return due;
}

/** Every reminder step at or before `step` — what a late sweep has to claim. */
export function stepsUpTo(step: ReminderStep): ReminderStep[] {
  return REMINDER_STEPS.filter((s) => s <= step);
}

/** True once the store should stop chasing, whatever else is true. */
export function isFinalReminder(step: number): boolean {
  return step >= 4;
}

/**
 * Statuses that mean the chase is over.
 *
 * `paid` and `fulfilled` are the obvious ones. `cancelled` and `refunded`
 * matter just as much: mailing "you left something behind" about an order the
 * store itself cancelled reads as incompetence.
 */
const SETTLED = new Set(["paid", "fulfilled", "cancelled", "refunded"]);

export function isSettled(status: string | null | undefined): boolean {
  return SETTLED.has(String(status ?? "").toLowerCase());
}

/**
 * Should this order be chased right now?
 *
 * `hasBoughtSince` is the condition the store owner actually asked for: if the
 * person behind this email has bought ANYTHING in the meantime — this order
 * under a different row, or a completely separate one — the chase stops. Being
 * chased about an abandoned cart after you have already paid is the kind of
 * thing that makes a customer doubt the shop knows what it is doing.
 */
export function shouldRemind(order: {
  status?: string | null;
  created_at?: string | null;
  hasBoughtSince?: boolean;
}, now: Date = new Date()): { send: false; reason: string } | { send: true; step: ReminderStep } {
  if (isSettled(order.status)) return { send: false, reason: `status_${order.status}` };
  if (order.hasBoughtSince) return { send: false, reason: "already_bought" };
  if (!order.created_at) return { send: false, reason: "no_created_at" };

  const step = dueReminder(order.created_at, now);
  if (!step) {
    const age = daysSince(order.created_at, now);
    return { send: false, reason: age > ABANDONED_WINDOW_DAYS ? "too_old" : "not_due" };
  }
  return { send: true, step };
}

export type ReminderCopy = {
  subject: string;
  title: string;
  /** The lead paragraphs, above the receipt. */
  paragraphs: string[];
  /** Label on the button back to the cart. */
  cta: string;
};

/**
 * What each reminder says.
 *
 * The three escalate in urgency and shorten as they go — by the last one the
 * buyer has ignored two emails, and a fourth wall of text is not what changes
 * their mind. None of them invents a discount, a deadline the store does not
 * actually enforce, or stock pressure that is not real: a promise the shop
 * cannot keep costs more than the sale it wins.
 */
export function reminderCopy(step: ReminderStep, orderNumber: string): ReminderCopy {
  if (step === 2) {
    return {
      subject: `Still thinking it over? Order ${orderNumber} is saved`,
      title: "Your order is still here",
      paragraphs: [
        `We're holding order ${orderNumber} for you. It hasn't been paid for yet, so nothing has been charged and nothing has shipped.`,
        "If something got in the way — a card that wouldn't go through, a question you wanted answered first — just reply to this email and a person will help. Otherwise everything you picked is one click away.",
      ],
      cta: "Finish your order",
    };
  }
  if (step === 3) {
    return {
      subject: `Your build is waiting — order ${orderNumber}`,
      title: "Ready when you are",
      paragraphs: [
        `Order ${orderNumber} is still unpaid, and still yours if you want it.`,
        "Every trike is built and tested before it ships, and we send tracking at each step. If you were weighing it up and have a question about spec, delivery or fit, reply here and we'll answer properly.",
      ],
      cta: "Complete your order",
    };
  }
  return {
    subject: `Last reminder about order ${orderNumber}`,
    title: "Last note about this one",
    paragraphs: [
      `This is the last email we'll send about order ${orderNumber}. If you'd rather not go ahead, you don't need to do anything — an unpaid order simply expires and you'll never be charged.`,
      "If you do still want it, it's all here.",
    ],
    cta: "Complete your order",
  };
}
