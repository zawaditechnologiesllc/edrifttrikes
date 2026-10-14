import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ABANDONED_LAST_DAY,
  ABANDONED_SCHEDULE,
  ABANDONED_WINDOW_DAYS,
  FINAL_REMINDER_STEP,
  REMINDER_STEPS,
  dueReminder,
  isFinalReminder,
  isSettled,
  reminderCopy,
  reminderStage,
  shouldRemind,
  stepsUpTo,
} from "../lib/abandoned";

/**
 * Chasing an unpaid order.
 *
 * Two things have to hold, and they pull against each other: the store must
 * actually follow up (that is the whole point), and it must stop the instant
 * there is any reason to — because the failure mode here is not a missed sale,
 * it is mailing a paying customer about an order they already completed.
 */

const DAY = 86_400_000;
const PLACED = new Date("2026-08-01T10:00:00Z");
const at = (days: number) => new Date(PLACED.getTime() + days * DAY);

describe("the cadence", () => {
  test("IS THREE A WEEK FOR EIGHT WEEKS — 24 sends, days 2 to 56", () => {
    const days = ABANDONED_SCHEDULE.filter((s) => s.step !== 1).map((s) => s.afterDays);
    assert.equal(days.length, 24, "not 3 a week for 8 weeks");
    assert.deepEqual(days.slice(0, 6), [2, 4, 7, 9, 11, 14], "the first fortnight");
    assert.deepEqual(days.slice(-3), [51, 53, 56], "the last week");
    assert.equal(ABANDONED_LAST_DAY, 56);
  });

  test("no two sends land on consecutive days", () => {
    // Two mornings in a row reads as a malfunction, and a malfunction is what
    // people report as spam.
    const days = ABANDONED_SCHEDULE.map((s) => s.afterDays);
    for (let i = 1; i < days.length; i++) {
      assert.ok(days[i] - days[i - 1] >= 2, `day ${days[i - 1]} then day ${days[i]}`);
    }
  });

  test("the schedule only ever moves forward", () => {
    const days = ABANDONED_SCHEDULE.map((s) => s.afterDays);
    const steps = ABANDONED_SCHEDULE.map((s) => s.step);
    assert.deepEqual([...days].sort((a, b) => a - b), days, "days out of order");
    assert.deepEqual(steps, steps.map((_, i) => i + 1), "step numbers have a gap");
  });

  test("the checkout's own email is step 1, so the numbering never drifts", () => {
    assert.equal(ABANDONED_SCHEDULE[0].step, 1);
    assert.equal(ABANDONED_SCHEDULE[0].afterDays, 0);
    assert.equal(REMINDER_STEPS[0], 2);
    assert.equal(REMINDER_STEPS.length, 24);
  });

  test("nothing is due before the first reminder falls", () => {
    assert.equal(dueReminder(PLACED, at(0)), null);
    assert.equal(dueReminder(PLACED, at(1)), null);
    assert.equal(dueReminder(PLACED, at(1.9)), null);
  });

  test("each reminder becomes due on its day and stays due", () => {
    assert.equal(dueReminder(PLACED, at(2)), 2);
    assert.equal(dueReminder(PLACED, at(3.9)), 2);
    assert.equal(dueReminder(PLACED, at(4)), 3);
    assert.equal(dueReminder(PLACED, at(6.9)), 3);
    assert.equal(dueReminder(PLACED, at(7)), 4);
    assert.equal(dueReminder(PLACED, at(56)), 25);
  });

  test("EVERY STEP IN THE SCHEDULE IS REACHABLE ON ITS OWN DAY", () => {
    // A generated schedule is one off-by-one away from a step that can never
    // fire, and nobody would notice: the sequence would simply be shorter.
    for (const entry of ABANDONED_SCHEDULE) {
      if (entry.step === 1) continue;
      assert.equal(dueReminder(PLACED, at(entry.afterDays)), entry.step, `day ${entry.afterDays}`);
    }
  });

  test("a sweep that ran late sends ONE correct email, not a burst", () => {
    // Same reasoning as dueStage(): if the cron was down for a week, the buyer
    // must not wake up to four reminders about one order.
    assert.equal(dueReminder(PLACED, at(20)), 9);
    assert.equal(dueReminder(PLACED, at(ABANDONED_LAST_DAY + 1)), 25);
  });

  test("STOPS for good past the window", () => {
    // Switching this feature on must not mail every pending order the database
    // has ever accumulated.
    assert.equal(dueReminder(PLACED, at(ABANDONED_WINDOW_DAYS + 0.1)), null);
    assert.equal(dueReminder(PLACED, at(90)), null);
    assert.equal(dueReminder(PLACED, at(400)), null);
  });

  test("a clock skew that dates an order in the future fires nothing", () => {
    assert.equal(dueReminder(at(5), PLACED), null);
  });

  test("survives a malformed timestamp rather than emailing on a NaN", () => {
    assert.equal(dueReminder("not-a-date", at(5)), null);
  });

  test("the last reminder is the last", () => {
    assert.equal(isFinalReminder(25), true);
    assert.equal(isFinalReminder(24), false);
    assert.equal(Math.max(...REMINDER_STEPS), 25);
  });

  test("stepsUpTo covers everything a late sweep has to claim", () => {
    // The sweep records the earlier steps too, so a resumed cron cannot go
    // back and send a day-2 email to someone who already got the day-56 one.
    assert.deepEqual(stepsUpTo(2), [2]);
    assert.deepEqual(stepsUpTo(4), [2, 3, 4]);
    assert.equal(stepsUpTo(25).length, 24);
  });
});

describe("when to stop", () => {
  const pending = { status: "pending", created_at: PLACED.toISOString() };

  test("chases a pending order once a reminder is due", () => {
    assert.deepEqual(shouldRemind(pending, at(3)), { send: true, step: 2 });
  });

  test("STOPS the moment the buyer has bought anything", () => {
    // The condition that matters most. Being chased about an abandoned cart
    // after you have already paid makes a customer doubt the shop.
    const result = shouldRemind({ ...pending, hasBoughtSince: true }, at(7));
    assert.deepEqual(result, { send: false, reason: "already_bought" });
  });

  test("stops on every settled status, not just paid", () => {
    // Mailing "you left something behind" about an order the STORE cancelled
    // reads as incompetence.
    for (const status of ["paid", "fulfilled", "cancelled", "refunded"]) {
      const result = shouldRemind({ ...pending, status }, at(12));
      assert.equal(result.send, false, `${status} was still chased`);
      assert.match((result as { reason: string }).reason, /status_/);
    }
  });

  test("is case-insensitive about status, because data is messy", () => {
    assert.equal(isSettled("PAID"), true);
    assert.equal(isSettled("Refunded"), true);
    assert.equal(isSettled("pending"), false);
    assert.equal(isSettled(null), false);
    assert.equal(isSettled(undefined), false);
  });

  test("says why it is not sending, so a sweep can be reasoned about", () => {
    assert.deepEqual(shouldRemind(pending, at(1)), { send: false, reason: "not_due" });
    assert.deepEqual(shouldRemind(pending, at(90)), { send: false, reason: "too_old" });
    assert.deepEqual(shouldRemind({ status: "pending" }, at(5)), {
      send: false,
      reason: "no_created_at",
    });
  });

  test("an order settled AND old is still refused, not accidentally chased", () => {
    assert.equal(shouldRemind({ ...pending, status: "paid" }, at(90)).send, false);
  });
});

describe("the event stage each reminder claims", () => {
  test("is stable and distinct per step — it IS the lock", () => {
    // order_events is UNIQUE on (order_id, stage). If two steps produced the
    // same string, the second would silently never send.
    const stages = REMINDER_STEPS.map(reminderStage);
    assert.equal(stages[0], "abandoned_2");
    assert.equal(stages[stages.length - 1], "abandoned_25");
    assert.equal(new Set(stages).size, stages.length, "two steps claim the same lock");
  });

  test("cannot collide with a fulfilment stage", () => {
    // The same table carries the delivery timeline.
    for (const stage of REMINDER_STEPS.map(reminderStage)) {
      assert.ok(stage.startsWith("abandoned_"));
    }
  });
});

describe("what the reminders say", () => {
  const steps = REMINDER_STEPS;
  const OFFER = { name: "VOLTAGE DRIFT", price: "$1,899.00", was: "$2,199.00" };

  test("every one names the order and offers a way back", () => {
    for (const step of steps) {
      const copy = reminderCopy(step, "ED-2026-0148", OFFER);
      assert.ok(
        copy.paragraphs.join(" ").includes("ED-2026-0148"),
        `step ${step} body does not name the order`
      );
      assert.ok(copy.cta.length > 0, `step ${step} has no call to action`);
      assert.ok(copy.title.length > 0, `step ${step} has no title`);
      assert.ok(copy.subject.length > 0, `step ${step} has no subject`);
    }
  });

  test("NO TWO CONSECUTIVE EMAILS READ ALIKE", () => {
    // Twenty-four of these go out over two months. Two identical-looking ones
    // in a row is what a reader marks as spam, and a spam complaint is scored
    // against the domain the order confirmations also leave on.
    for (let i = 1; i < steps.length; i++) {
      const a = reminderCopy(steps[i - 1], "X", OFFER);
      const b = reminderCopy(steps[i], "X", OFFER);
      assert.notEqual(a.subject, b.subject, `steps ${steps[i - 1]} and ${steps[i]}`);
      assert.notEqual(a.title, b.title, `steps ${steps[i - 1]} and ${steps[i]}`);
      assert.notEqual(a.paragraphs[0], b.paragraphs[0], `steps ${steps[i - 1]} and ${steps[i]}`);
    }
  });

  test("the sequence draws on several distinct angles, not one with the numbers changed", () => {
    const leads = new Set(steps.map((s) => reminderCopy(s, "X", OFFER).paragraphs[0]));
    assert.ok(leads.size >= 7, `only ${leads.size} distinct openings across 24 emails`);
  });

  test("the offer rides on most of them, but not the first two", () => {
    // The first two are sent while the decision is still live; leading with a
    // different product then is answering a question nobody asked.
    assert.equal(reminderCopy(2, "X", OFFER).showOffer, false);
    assert.equal(reminderCopy(3, "X", OFFER).showOffer, false);
    const withOffer = steps.filter((s) => reminderCopy(s, "X", OFFER).showOffer).length;
    assert.equal(withOffer, steps.length - 2);
  });

  test("it still reads when there is no best seller to show", () => {
    // A brand-new shop has sold nothing, and the copy must not have a hole in
    // it where the product name was going to go.
    for (const step of steps) {
      const copy = reminderCopy(step, "ED-1", null);
      assert.ok(!/undefined|null|\{\}/.test(copy.subject), `step ${step} subject: ${copy.subject}`);
      assert.ok(
        !/undefined|null/.test(copy.paragraphs.join(" ")),
        `step ${step} body`
      );
    }
  });

  test("NOTHING INVENTS A DISCOUNT OR A DEADLINE", () => {
    // A promise the shop cannot keep costs more than the sale it wins, and
    // over 24 emails the temptation to manufacture urgency is the whole risk.
    const everything = steps
      .flatMap((s) => {
        const c = reminderCopy(s, "ED-1", OFFER);
        return [c.subject, c.title, ...c.paragraphs];
      })
      .join(" ");
    for (const invented of [
      /\d+% off/i,
      /expires? (today|tomorrow|in \d)/i,
      /only \d+ left/i,
      /last chance to save/i,
      /hurry/i,
      /limited time/i,
      /act now/i,
    ]) {
      assert.ok(!invented.test(everything), `the copy invented: ${invented}`);
    }
  });

  test("the last one says it is the last, and that doing nothing is fine", () => {
    const copy = reminderCopy(FINAL_REMINDER_STEP, "ED-2026-0148");
    assert.match(copy.paragraphs.join(" "), /last email/i);
    assert.match(copy.paragraphs.join(" "), /never be charged|don't need to do anything/i);
  });

  test("every one is clear that nothing has been charged", () => {
    // The buyer must never think they have already paid.
    for (const step of steps) {
      const text = reminderCopy(step, "X").paragraphs.join(" ").toLowerCase();
      assert.match(text, /unpaid|hasn't been paid|not.*charged|never be charged/);
    }
  });

  test("invents no discount, deadline or stock pressure", () => {
    // A promise the shop does not actually enforce costs more than the sale it
    // wins — and "only 2 left!" in an automated email is a lie by default.
    for (const step of steps) {
      const copy = reminderCopy(step, "X");
      const text = `${copy.subject} ${copy.paragraphs.join(" ")}`.toLowerCase();
      for (const claim of ["% off", "discount", "coupon", "expires in", "hurry", "only 1 left", "selling fast"]) {
        assert.ok(!text.includes(claim), `step ${step} claims "${claim}"`);
      }
    }
  });

  test("says nothing about duty or customs, like the rest of the store", () => {
    for (const step of steps) {
      const copy = reminderCopy(step, "X");
      assert.doesNotMatch(
        `${copy.subject} ${copy.paragraphs.join(" ")}`,
        /duty|customs|import charge|tariff/i
      );
    }
  });
});
