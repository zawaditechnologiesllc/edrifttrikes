import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ABANDONED_LAST_DAY,
  ABANDONED_SCHEDULE,
  ABANDONED_WINDOW_DAYS,
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
  test("is day 3, day 7 and day 12 after the order was placed", () => {
    assert.deepEqual(
      ABANDONED_SCHEDULE.filter((s) => s.step !== 1).map((s) => s.afterDays),
      [3, 7, 12]
    );
  });

  test("the checkout's own email is step 1, so the numbering never drifts", () => {
    assert.equal(ABANDONED_SCHEDULE[0].step, 1);
    assert.equal(ABANDONED_SCHEDULE[0].afterDays, 0);
    assert.deepEqual(REMINDER_STEPS, [2, 3, 4]);
  });

  test("nothing is due before the first reminder falls", () => {
    assert.equal(dueReminder(PLACED, at(0)), null);
    assert.equal(dueReminder(PLACED, at(1)), null);
    assert.equal(dueReminder(PLACED, at(2.9)), null);
  });

  test("each reminder becomes due on its day and stays due", () => {
    assert.equal(dueReminder(PLACED, at(3)), 2);
    assert.equal(dueReminder(PLACED, at(6.9)), 2);
    assert.equal(dueReminder(PLACED, at(7)), 3);
    assert.equal(dueReminder(PLACED, at(11.9)), 3);
    assert.equal(dueReminder(PLACED, at(12)), 4);
  });

  test("a sweep that ran late sends ONE correct email, not a burst of three", () => {
    // Same reasoning as dueStage(): if the cron was down for a week, the buyer
    // must not wake up to three reminders about one order.
    assert.equal(dueReminder(PLACED, at(13)), 4);
    assert.equal(dueReminder(PLACED, at(ABANDONED_LAST_DAY + 1)), 4);
  });

  test("STOPS for good past the window", () => {
    // Switching this feature on must not mail every pending order the database
    // has ever accumulated.
    assert.equal(dueReminder(PLACED, at(ABANDONED_WINDOW_DAYS + 0.1)), null);
    assert.equal(dueReminder(PLACED, at(60)), null);
    assert.equal(dueReminder(PLACED, at(400)), null);
  });

  test("a clock skew that dates an order in the future fires nothing", () => {
    assert.equal(dueReminder(at(5), PLACED), null);
  });

  test("survives a malformed timestamp rather than emailing on a NaN", () => {
    assert.equal(dueReminder("not-a-date", at(5)), null);
  });

  test("the last reminder is the last", () => {
    assert.equal(isFinalReminder(4), true);
    assert.equal(isFinalReminder(3), false);
    assert.equal(Math.max(...REMINDER_STEPS), 4);
  });

  test("stepsUpTo covers everything a late sweep has to claim", () => {
    // The sweep claims the earlier steps too, so a resumed cron cannot go back
    // and send a day-3 email to someone who already got the day-12 one.
    assert.deepEqual(stepsUpTo(2), [2]);
    assert.deepEqual(stepsUpTo(3), [2, 3]);
    assert.deepEqual(stepsUpTo(4), [2, 3, 4]);
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
    assert.deepEqual(stages, ["abandoned_2", "abandoned_3", "abandoned_4"]);
    assert.equal(new Set(stages).size, stages.length);
  });

  test("cannot collide with a fulfilment stage", () => {
    // The same table carries the delivery timeline.
    for (const stage of REMINDER_STEPS.map(reminderStage)) {
      assert.ok(stage.startsWith("abandoned_"));
    }
  });
});

describe("what the reminders say", () => {
  const steps: (2 | 3 | 4)[] = [2, 3, 4];

  test("every one names the order and offers a way back", () => {
    for (const step of steps) {
      const copy = reminderCopy(step, "ED-2026-0148");
      assert.ok(copy.subject.includes("ED-2026-0148"), `step ${step} subject`);
      assert.ok(copy.paragraphs.join(" ").includes("ED-2026-0148"), `step ${step} body`);
      assert.ok(copy.cta.length > 0);
      assert.ok(copy.title.length > 0);
    }
  });

  test("each one is different — three copies of the same email is spam", () => {
    const subjects = steps.map((s) => reminderCopy(s, "X").subject);
    assert.equal(new Set(subjects).size, 3);
    const bodies = steps.map((s) => reminderCopy(s, "X").paragraphs.join(" "));
    assert.equal(new Set(bodies).size, 3);
  });

  test("the last one says it is the last, and that doing nothing is fine", () => {
    const copy = reminderCopy(4, "ED-2026-0148");
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
