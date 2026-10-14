/**
 * Chasing an order that was placed but never paid for.
 *
 * An order row is created the moment the checkout form is submitted. If payment
 * never follows, that row is a buyer who wanted the thing and stopped — the
 * most convertible audience the store has.
 *
 * ═══ THE CADENCE: THREE TIMES A WEEK, FOR EIGHT WEEKS ══════════════════════
 *
 * Counted from when the order was created, so buyers land on different days of
 * the week rather than the whole list being mailed in one burst:
 *
 *   day 0                  sent by the checkout API itself (lib/email.ts)
 *   days 2, 4, 7           week 1
 *   days 9, 11, 14         week 2
 *   …                      and so on
 *   days 51, 53, 56        week 8 — the last
 *
 * Twenty-four sends, and then never again.
 *
 * ⚠️ THIS IS A LOT OF EMAIL, AND THE SAFEGUARDS ARE NOT OPTIONAL. The previous
 * schedule was four sends over twelve days, and the reason it stopped there is
 * still true: a shop that keeps mailing about an order someone decided against
 * stops being a shop they read. What makes twenty-four survivable rather than
 * reputational suicide is everything the sweep checks before each one:
 *
 *   - the moment the buyer pays for ANYTHING, the chase stops;
 *   - every send carries a one-click unsubscribe, and an opt-out is honoured
 *     permanently and across every order that address has (lib/email-optout.ts);
 *   - one email per address per run, however many pending orders they have;
 *   - the copy rotates and leads with a product, not a nag — twenty-four
 *     variations of "you forgot something" is a spam complaint, and a spam
 *     complaint on this domain costs the order confirmations too.
 *
 * That last point is not theoretical here: this domain is already carrying an
 * ISP blocklist entry (docs/BLOCKLIST-APPEALS.md), and complaint rate is the
 * signal those feeds weigh most.
 *
 * DEPENDENCY-FREE, like lib/fulfillment.ts, so the schedule is unit-testable
 * without a database and the copy can be rendered anywhere.
 */

/** A step number in the sequence. Step 1 is the checkout email, not a reminder. */
export type ReminderStep = number;

/**
 * Which days of each week carry a send, counted from the order.
 *
 * Three a week, spaced so no two land on consecutive days: day 2, day 4, day 7
 * of each seven-day block. A buyer who ordered on a Tuesday hears on Thursday,
 * Saturday and the following Tuesday — not three mornings in a row.
 */
export const REMINDER_DAYS_IN_WEEK = [2, 4, 7] as const;

/** How many weeks the sequence runs. Three a week × eight weeks = 24 sends. */
export const REMINDER_WEEKS = 8;

/**
 * THE SCHEDULE. Step 1 is the email the checkout API sends immediately; it is
 * listed so the numbering matches the event rows and nothing has to remember
 * that the cron's first send is really the second email.
 *
 * Generated rather than written out, because twenty-five hand-typed offsets is
 * twenty-five chances for one of them to be wrong by a day in a way no one
 * would ever notice.
 */
export const ABANDONED_SCHEDULE: { step: number; afterDays: number }[] = [
  { step: 1, afterDays: 0 },
  ...Array.from({ length: REMINDER_WEEKS }, (_, week) =>
    REMINDER_DAYS_IN_WEEK.map((day) => week * 7 + day)
  )
    .flat()
    .map((afterDays, i) => ({ step: i + 2, afterDays })),
];

/** Steps the scheduler is responsible for. Step 1 is not one of them. */
export const REMINDER_STEPS: ReminderStep[] = ABANDONED_SCHEDULE.filter(
  (s) => s.step > 1
).map((s) => s.step);

/** The last step in the sequence — the one that says goodbye. */
export const FINAL_REMINDER_STEP = REMINDER_STEPS[REMINDER_STEPS.length - 1];

/** After this many days an unpaid order is left alone for good. */
export const ABANDONED_LAST_DAY =
  ABANDONED_SCHEDULE[ABANDONED_SCHEDULE.length - 1].afterDays;

/**
 * How far back the sweep looks.
 *
 * Deliberately not "forever". Switching this on must not mail every pending
 * order the database has ever accumulated — some are months old and their
 * buyers have long since moved on. Anything older than this window is never
 * contacted, which makes turning it on safe.
 *
 * Two days of slack past the final send, so an order that reaches day 56 while
 * the scheduler is down still gets its goodbye when the scheduler comes back,
 * rather than falling out of the window mid-sequence.
 */
export const ABANDONED_WINDOW_DAYS = ABANDONED_LAST_DAY + 2;

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
    if (age >= entry.afterDays) due = entry.step;
  }
  return due;
}

/** Every reminder step at or before `step` — what a late sweep has to claim. */
export function stepsUpTo(step: ReminderStep): ReminderStep[] {
  return REMINDER_STEPS.filter((s) => s <= step);
}

/** True once the store should stop chasing, whatever else is true. */
export function isFinalReminder(step: number): boolean {
  return step >= FINAL_REMINDER_STEP;
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
  /** The lead paragraphs, above the offer and the receipt. */
  paragraphs: string[];
  /** Label on the button back to the cart. */
  cta: string;
  /** Whether this one carries the best-seller block. */
  showOffer: boolean;
};

/** What the offer block needs to know, so this module stays database-free. */
export type OfferProduct = {
  name: string;
  /** Formatted, e.g. "$1,899.00" — formatting lives with the money code. */
  price: string;
  /** The higher price it is reduced from, when there genuinely is one. */
  was?: string | null;
};

/**
 * The angles the middle of the sequence rotates through.
 *
 * ═══ WHY THIS IS A ROTATION AND NOT A COUNTDOWN ════════════════════════════
 *
 * Because twenty-four variations of "you forgot something" is not a campaign,
 * it is a complaint rate — and a complaint rate on this domain costs the order
 * confirmations too, not just these. Each angle below says something the buyer
 * did not already know: what the thing is made of, what happens if it is wrong
 * for them, who else bought one. The unpaid order is mentioned once, at the
 * end, as a link rather than a lecture.
 *
 * Seven of them against a three-a-week cadence means the same angle returns
 * about every two and a half weeks, by which time it is a different email.
 *
 * ⚠️ NOT ONE OF THESE INVENTS ANYTHING. No manufactured deadline, no stock
 * pressure that is not real, no discount the shop is not actually running —
 * the offer block shows a price reduction only when the product genuinely
 * carries one. A promise the shop cannot keep costs more than the sale it wins.
 */
const ANGLES: {
  subject: (order: string, offer?: OfferProduct | null) => string;
  title: string;
  lead: (offer?: OfferProduct | null) => string;
  second: string;
  cta: string;
}[] = [
  {
    subject: (_o, offer) =>
      offer ? `${offer.name} is our most-ordered build` : "Our most-ordered build",
    title: "What most people end up buying",
    lead: (offer) =>
      offer
        ? `If you are still deciding, this is the one that outsells everything else we make: the ${offer.name}. It is the build most riders land on, and the one our workshop knows best.`
        : "If you are still deciding, it may help to know which build most riders land on — it is the one our workshop knows best.",
    second:
      "Every trike is assembled, tested and crated by hand before it leaves, and we send tracking at each step of the journey.",
    cta: "See the build",
  },
  {
    subject: () => "What's actually in the crate",
    title: "What arrives, and what to do with it",
    lead: () =>
      "A fair question before spending this kind of money: what turns up. The trike ships crated and largely assembled — wheels, battery, charger and tools in the box, with the handful of final steps in the printed guide.",
    second:
      "If you want the spec sheet for anything in the range before you decide, reply to this email and we will send the PDF.",
    cta: "Look again",
  },
  {
    subject: () => "If it turns out to be the wrong one",
    title: "The part nobody asks about until afterwards",
    lead: () =>
      "Buying a large item from a factory on the other side of the world comes down to one question: what happens if it is wrong. You have 30 days from delivery to send it back, and buyers in the EU and UK have a separate 14-day right to withdraw on top of that.",
    second:
      "Faults are ours to fix. We would rather tell you that now than have you find out you needed it.",
    cta: "Pick up where you left off",
  },
  {
    subject: (_o, offer) =>
      offer ? `Still available: ${offer.name}` : "Still available",
    title: "Nothing has gone anywhere",
    lead: (offer) =>
      offer
        ? `The ${offer.name} is still in production and still shipping — we build to order rather than to a shelf, so nothing you were looking at has sold out from under you.`
        : "We build to order rather than to a shelf, so nothing you were looking at has sold out from under you.",
    second:
      "Delivery is quoted generously on purpose: we add a week of slack to every estimate so a hold-up at the courier does not turn into a broken promise at our end.",
    cta: "Carry on",
  },
  {
    subject: () => "Ask us anything about it",
    title: "A person reads these",
    lead: () =>
      "This is an automated email, but the reply address is not. Spec, fit, delivery to your country, whether a part will work with something you already own — reply and a human will answer properly.",
    second:
      "Plenty of orders sit unpaid because of one unanswered question. If that is this one, it is an easy thing to fix.",
    cta: "Go back to your order",
  },
  {
    subject: () => "Where these are actually made",
    title: "Direct from the people who build it",
    lead: () =>
      "There is no middleman on this. We manufacture in Foshan and sell direct, which is why the price is what it is and why the person answering your email can go and look at the machine.",
    second:
      "Payment is handled by Stripe, PayPal or Authorize.Net on their own systems — we never see or store your card details.",
    cta: "Finish your order",
  },
  {
    subject: (_o, offer) =>
      offer ? `${offer.name}, and what it costs to run` : "What it costs to run",
    title: "After the purchase price",
    lead: (offer) =>
      offer
        ? `The ${offer.name} charges from an ordinary wall socket, and a full charge costs less than a cup of coffee. There is no fuel, no oil and no service schedule — brakes, tyres and the belt are the only consumables.`
        : "These charge from an ordinary wall socket, and a full charge costs less than a cup of coffee. No fuel, no oil, no service schedule — brakes, tyres and the belt are the only consumables.",
    second:
      "Spare parts are listed on the site and shipped from the same factory, so a worn part is a part you can actually replace.",
    cta: "Take another look",
  },
];

/**
 * What each reminder says.
 *
 * The first two keep the original wording — they are the ones sent while the
 * decision is still live, and nothing about them needed changing. From there
 * the sequence rotates through ANGLES, and the last one says goodbye and means
 * it.
 */
export function reminderCopy(
  step: ReminderStep,
  orderNumber: string,
  offer?: OfferProduct | null
): ReminderCopy {
  if (step === 2) {
    return {
      subject: `Still thinking it over? Order ${orderNumber} is saved`,
      title: "Your order is still here",
      paragraphs: [
        `We're holding order ${orderNumber} for you. It hasn't been paid for yet, so nothing has been charged and nothing has shipped.`,
        "If something got in the way — a card that wouldn't go through, a question you wanted answered first — just reply to this email and a person will help. Otherwise everything you picked is one click away.",
      ],
      cta: "Finish your order",
      showOffer: false,
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
      showOffer: false,
    };
  }

  if (isFinalReminder(step)) {
    return {
      subject: `Last email about order ${orderNumber}`,
      title: "Last note about this one",
      paragraphs: [
        `This is the last email we'll send about order ${orderNumber}. If you'd rather not go ahead, you don't need to do anything — an unpaid order simply expires and you'll never be charged.`,
        "If you do still want it, it's all here, at the same price.",
      ],
      cta: "Complete your order",
      showOffer: true,
    };
  }

  // Steps 4 onwards rotate. Offset by 4 so step 4 is the first angle.
  const angle = ANGLES[(step - 4) % ANGLES.length];
  return {
    subject: angle.subject(orderNumber, offer),
    title: angle.title,
    paragraphs: [
      angle.lead(offer),
      angle.second,
      `Order ${orderNumber} is still unpaid and still saved — nothing has been charged.`,
    ],
    cta: angle.cta,
    showOffer: true,
  };
}
