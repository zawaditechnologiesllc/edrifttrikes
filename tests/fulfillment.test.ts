import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ALL_STAGES,
  SCHEDULE_SPAN_DAYS,
  FULFILLMENT_SCHEDULE,
  SCHEDULED_STAGES,
  STAGE_COPY,
  TRACKER_STAGES,
  addDays,
  dueStage,
  estimatedDeliveryAt,
  isSchedulable,
  stageMessage,
  stageProgress,
  stagesBetween,
  type FulfillmentStage,
} from "../lib/fulfillment";
import { DELIVERY_BUFFER_DAYS } from "../lib/delivery";

/**
 * The delivery journey. These tests exist because the scheduler emails real
 * customers: an off-by-one here is a wrong promise in someone's inbox.
 */

const PAID = new Date("2026-01-01T12:00:00Z");
const at = (days: number) => addDays(PAID, days);

describe("the schedule itself", () => {
  test("matches the agreed timings: day 0, 1, 3, 10, 25, 27, 28", () => {
    assert.deepEqual(
      FULFILLMENT_SCHEDULE.map((s) => [s.stage, s.afterDays]),
      [
        ["confirmed", 0],
        ["preparing", 1],
        ["shipped", 3],
        ["in_transit", 10],
        ["arriving", 25],
        ["out_for_delivery", 27],
        ["ready_for_collection", 28],
      ]
    );
  });

  test("still ends on the same day the old four-step schedule did", () => {
    // The extra steps are visibility, not delay. If adding them had pushed the
    // final stage past day 28 every delivery quote on the site would be wrong.
    const last = FULFILLMENT_SCHEDULE[FULFILLMENT_SCHEDULE.length - 1];
    assert.equal(last.stage, "ready_for_collection");
    assert.equal(last.afterDays, 28);
    assert.equal(SCHEDULE_SPAN_DAYS, 28);
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

  test("every scheduled stage is a stage the admin can also pick by hand", () => {
    // A stage the scheduler can reach but an admin cannot is a stage nobody can
    // correct when the courier is ahead of, or behind, the clock.
    for (const stage of SCHEDULED_STAGES) {
      assert.ok(ALL_STAGES.includes(stage), `${stage} is missing from ALL_STAGES`);
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

describe("the tracker rail", () => {
  /**
   * What the customer sees on their dashboard. It is the schedule plus
   * `delivered`, because a rail that stops at "ready for collection" reads like
   * a story with no ending — but `delivered` cannot be on the schedule, since a
   * clock has no way of knowing a parcel actually arrived.
   */
  test("is the schedule, in order, then delivered", () => {
    assert.deepEqual(TRACKER_STAGES, [...SCHEDULED_STAGES, "delivered"]);
  });

  test("ends at delivered", () => {
    assert.equal(TRACKER_STAGES[TRACKER_STAGES.length - 1], "delivered");
  });

  test("has no dead ends — every rung has copy to render", () => {
    for (const stage of TRACKER_STAGES) {
      assert.ok(STAGE_COPY[stage]?.label, `${stage} has no label for the rail`);
    }
  });

  test("carries no closed stages", () => {
    // `cancelled` and `awaiting_payment` are rendered as their own panels, not
    // as rungs; putting either on the rail would light a step that never fires.
    assert.ok(!TRACKER_STAGES.includes("cancelled"));
    assert.ok(!TRACKER_STAGES.includes("awaiting_payment"));
  });

  test("every rung is findable — the tracker indexes against this list", () => {
    // OrderTracker does TRACKER_STAGES.indexOf(stage); a stage the customer can
    // actually be in but that is absent here would light the wrong marker.
    for (const stage of SCHEDULED_STAGES) {
      assert.ok(TRACKER_STAGES.indexOf(stage) >= 0, `${stage} is not on the rail`);
    }
    assert.ok(TRACKER_STAGES.indexOf("delivered") >= 0);
  });
});

describe("the steps added to fill the silent weeks", () => {
  /**
   * Between "shipped" on day 3 and "arriving" on day 25 the old schedule said
   * nothing for three weeks, which is exactly the window a buyer starts
   * wondering whether the order exists. These three stages are what that gap
   * was replaced with, so their wording is worth pinning.
   */
  test("preparing says the build is being worked on, not merely queued", () => {
    const m = STAGE_COPY.preparing.message.toLowerCase();
    assert.match(m, /bench|assembl/);
    assert.match(m, /crat/);
  });

  test("in transit explains the quiet rather than leaving it unexplained", () => {
    const m = STAGE_COPY.in_transit.message.toLowerCase();
    assert.match(m, /on the long leg|left our shipping partner/);
    assert.match(m, /quiet/);
  });

  test("out for delivery tells the buyer somebody has to receive it", () => {
    const m = STAGE_COPY.out_for_delivery.message.toLowerCase();
    assert.match(m, /local courier/);
    assert.match(m, /receive it/);
    assert.match(m, /depot/);
  });

  test("each new stage carries a delivery date where one still helps", () => {
    // Out for delivery deliberately does not: quoting a date to somebody whose
    // parcel is on a van today reads as a delay, not an estimate.
    assert.ok(STAGE_COPY.preparing.message.includes("{date}"));
    assert.ok(STAGE_COPY.in_transit.message.includes("{date}"));
    assert.ok(!STAGE_COPY.out_for_delivery.message.includes("{date}"));
  });

  test("none of them promise a date they cannot keep", () => {
    for (const stage of ["preparing", "in_transit", "out_for_delivery"] as const) {
      const m = STAGE_COPY[stage].message.toLowerCase();
      for (const claim of ["guarantee", "will arrive", "no later than"]) {
        assert.ok(!m.includes(claim), `${stage} promises "${claim}"`);
      }
    }
  });
});

describe("dueStage", () => {
  test("a fresh payment is confirmed, not shipped", () => {
    assert.equal(dueStage(PAID, PAID), "confirmed");
    assert.equal(dueStage(PAID, at(0.9)), "confirmed");
  });

  test("day 1 is on the bench", () => {
    assert.equal(dueStage(PAID, at(1)), "preparing");
    assert.equal(dueStage(PAID, at(2.9)), "preparing");
  });

  test("day 3 ships", () => {
    assert.equal(dueStage(PAID, at(3)), "shipped");
    assert.equal(dueStage(PAID, at(9.9)), "shipped");
  });

  test("day 10 is the long leg", () => {
    // The gap this stage exists to fill: without it the customer sees nothing
    // between day 3 and day 25.
    assert.equal(dueStage(PAID, at(10)), "in_transit");
    assert.equal(dueStage(PAID, at(24.9)), "in_transit");
  });

  test("day 25 is 'shipping complete / arriving'", () => {
    assert.equal(dueStage(PAID, at(25)), "arriving");
    assert.equal(dueStage(PAID, at(26.9)), "arriving");
  });

  test("day 27 is with the local courier", () => {
    assert.equal(dueStage(PAID, at(27)), "out_for_delivery");
    assert.equal(dueStage(PAID, at(27.9)), "out_for_delivery");
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
      "preparing",
      "shipped",
      "in_transit",
      "arriving",
      "out_for_delivery",
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
    assert.deepEqual(stagesBetween("confirmed", "preparing"), ["preparing"]);
    assert.deepEqual(stagesBetween("arriving", "out_for_delivery"), [
      "out_for_delivery",
    ]);
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

describe("the shipped email explains the long window", () => {
  /**
   * The quoted date is padded on purpose. Without saying so, a buyer reads a
   * three-week estimate as the store being slow; with it, they read the same
   * date as the store being careful — and they stop watching the calendar.
   */
  const shipped = STAGE_COPY.shipped.message;

  test("names the buffer, and names the same number lib/delivery.ts holds", () => {
    // The sentence is written out in fulfillment.ts (which stays import-free),
    // so THIS is what stops the copy and the constant drifting apart.
    assert.match(shipped, new RegExp(`${DELIVERY_BUFFER_DAYS}-day buffer`));
    assert.equal(DELIVERY_BUFFER_DAYS, 7);
  });

  test("says WHY the window is padded, not just that it is", () => {
    assert.match(shipped, /hold-up at the courier/i);
  });

  test("sets the expectation that the parcel lands early", () => {
    assert.match(shipped, /arrive ahead of it/i);
  });

  test("still carries the date itself", () => {
    assert.ok(shipped.includes("{date}"));
    const resolved = stageMessage("shipped", new Date("2026-09-10T00:00:00Z"));
    assert.ok(!resolved.includes("{date}"));
    assert.match(resolved, /September/);
  });

  test("promises nothing it cannot keep", () => {
    // "Guaranteed" and "will arrive" are refund arguments waiting to happen.
    for (const claim of ["guarantee", "guaranteed", "will arrive", "no later than"]) {
      assert.ok(
        !shipped.toLowerCase().includes(claim),
        `the shipped copy promises "${claim}"`
      );
    }
  });

  test("the buffer note is on the SHIPPED stage only", () => {
    // It answers "why is this date so far out", which is a question the buyer
    // asks when the parcel is in transit — not on the cancellation notice.
    for (const stage of ALL_STAGES.filter((s) => s !== "shipped")) {
      assert.doesNotMatch(
        STAGE_COPY[stage].message,
        /buffer/i,
        `${stage} also mentions a buffer`
      );
    }
  });
});
