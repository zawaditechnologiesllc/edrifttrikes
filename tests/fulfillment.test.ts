import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ALL_STAGES,
  SCHEDULE_SPAN_DAYS,
  FULFILLMENT_SCHEDULE,
  SCHEDULED_STAGES,
  STAGE_COPY,
  addDays,
  dueStage,
  estimatedDeliveryAt,
  isSchedulable,
  stageMessage,
  stageProgress,
  stagesBetween,
  type FulfillmentStage,
} from "../lib/fulfillment";

/**
 * The delivery journey. These tests exist because the scheduler emails real
 * customers: an off-by-one here is a wrong promise in someone's inbox.
 */

const PAID = new Date("2026-01-01T12:00:00Z");
const at = (days: number) => addDays(PAID, days);

describe("the schedule itself", () => {
  test("matches the agreed timings: day 0, 3, 25, 28", () => {
    assert.deepEqual(
      FULFILLMENT_SCHEDULE.map((s) => [s.stage, s.afterDays]),
      [
        ["confirmed", 0],
        ["shipped", 3],
        ["arriving", 25],
        ["ready_for_collection", 28],
      ]
    );
  });

  test("is strictly increasing — a later stage can never come due first", () => {
    const days = FULFILLMENT_SCHEDULE.map((s) => s.afterDays);
    for (let i = 1; i < days.length; i++) {
      assert.ok(days[i] > days[i - 1], `stage ${i} is not after stage ${i - 1}`);
    }
  });

  test("every stage has customer-facing copy", () => {
    for (const stage of ALL_STAGES) {
      const copy = STAGE_COPY[stage];
      assert.ok(copy, `no copy for ${stage}`);
      assert.ok(copy.label.length > 0);
      assert.ok(copy.title.length > 0);
      assert.ok(copy.message.length > 0);
    }
  });

  test("the final stage tells the customer to await the courier", () => {
    // This is the wording the store owner specified; it must survive edits.
    const message = STAGE_COPY.ready_for_collection.message.toLowerCase();
    assert.match(message, /ready for collection/);
    assert.match(message, /courier/);
    assert.match(message, /collect/);
    assert.match(message, /door delivery/);
  });
});

describe("dueStage", () => {
  test("a fresh payment is confirmed, not shipped", () => {
    assert.equal(dueStage(PAID, PAID), "confirmed");
    assert.equal(dueStage(PAID, at(2.9)), "confirmed");
  });

  test("day 3 ships", () => {
    assert.equal(dueStage(PAID, at(3)), "shipped");
    assert.equal(dueStage(PAID, at(24.9)), "shipped");
  });

  test("day 25 is 'shipping complete / arriving'", () => {
    assert.equal(dueStage(PAID, at(25)), "arriving");
    assert.equal(dueStage(PAID, at(27.9)), "arriving");
  });

  test("day 28 is ready for collection, and stays there", () => {
    assert.equal(dueStage(PAID, at(28)), "ready_for_collection");
    assert.equal(dueStage(PAID, at(400)), "ready_for_collection");
  });

  test("catches up in one jump after a scheduler outage", () => {
    // A scheduler down for three weeks must not crawl the order forward one
    // tick at a time — the customer sees where their order actually is.
    assert.equal(dueStage(PAID, at(26)), "arriving");
  });

  test("accepts an ISO string, as the database returns", () => {
    assert.equal(dueStage(PAID.toISOString(), at(3)), "shipped");
  });
});

describe("stagesBetween", () => {
  test("returns the stages crossed, in order", () => {
    assert.deepEqual(stagesBetween("confirmed", "ready_for_collection"), [
      "shipped",
      "arriving",
      "ready_for_collection",
    ]);
  });

  test("is empty when nothing has changed — the no-op the cron relies on", () => {
    assert.deepEqual(stagesBetween("shipped", "shipped"), []);
    assert.deepEqual(stagesBetween("confirmed", "confirmed"), []);
  });

  test("never moves an order backwards", () => {
    assert.deepEqual(stagesBetween("arriving", "shipped"), []);
    assert.deepEqual(stagesBetween("ready_for_collection", "confirmed"), []);
  });

  test("a single hop is a single stage", () => {
    assert.deepEqual(stagesBetween("confirmed", "shipped"), ["shipped"]);
  });
});

describe("isSchedulable", () => {
  test("only paid orders move", () => {
    assert.equal(isSchedulable("confirmed", "paid"), true);
    assert.equal(isSchedulable("confirmed", "pending"), false);
  });

  test("closed orders are left alone", () => {
    // Emailing "your package is arriving" about a refunded order is the exact
    // failure this guard prevents.
    assert.equal(isSchedulable("cancelled", "paid"), false);
    assert.equal(isSchedulable("delivered", "paid"), false);
  });

  test("the last stage is the end of the line", () => {
    assert.equal(isSchedulable("ready_for_collection", "paid"), false);
  });
});

describe("delivery estimate", () => {
  test("is quoted from the payment date", () => {
    const eta = estimatedDeliveryAt(PAID);
    assert.equal(eta.toISOString(), at(SCHEDULE_SPAN_DAYS).toISOString());
  });

  test("the quoted date is not before the final stage is reached", () => {
    // Promising delivery before "ready for collection" fires would have us
    // contradicting ourselves in two emails.
    const finalDay = FULFILLMENT_SCHEDULE[FULFILLMENT_SCHEDULE.length - 1].afterDays;
    assert.ok(SCHEDULE_SPAN_DAYS >= finalDay);
  });

  test("stage copy interpolates the real date, never a literal {date}", () => {
    const message = stageMessage("shipped", at(28));
    assert.doesNotMatch(message, /\{date\}/);
    assert.match(message, /2026/);
  });

  test("degrades gracefully when no estimate is stored", () => {
    const message = stageMessage("shipped", null);
    assert.doesNotMatch(message, /\{date\}/);
    assert.match(message, /shortly/);
  });
});

describe("stageProgress", () => {
  test("rises monotonically across the journey and ends at 1", () => {
    let previous = -1;
    for (const stage of SCHEDULED_STAGES as FulfillmentStage[]) {
      const p = stageProgress(stage);
      assert.ok(p > previous, `${stage} did not advance the progress bar`);
      previous = p;
    }
    assert.equal(stageProgress("ready_for_collection"), 1);
    assert.equal(stageProgress("delivered"), 1);
  });

  test("is zero before the journey starts", () => {
    assert.equal(stageProgress("awaiting_payment"), 0);
    assert.equal(stageProgress("cancelled"), 0);
  });
});
