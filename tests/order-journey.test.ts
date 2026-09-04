import { test, describe, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { advanceOrder, markOrderPaid, setOrderStage } from "../lib/orders";
import {
  SCHEDULED_STAGES,
  STAGE_COPY,
  TRACKER_STAGES,
  type FulfillmentStage,
} from "../lib/fulfillment";
import type { Order } from "../lib/types";

/**
 * THE WHOLE JOURNEY, END TO END.
 *
 * The stage table in lib/fulfillment.ts is unit-tested next door; this runs the
 * real transition code against a fake Postgres and watches what lands in a
 * customer's inbox over twenty-eight simulated days.
 *
 * The failures it exists to catch are the ones a customer would actually feel:
 * a step that advances the tracker but sends no confirmation, the same
 * confirmation arriving twice because two cron runs overlapped, or the tracker
 * and the emails telling two different stories.
 */

const DAY = 86_400_000;
const PAID = new Date("2026-03-01T09:00:00Z");
const at = (days: number) => new Date(PAID.getTime() + days * DAY);

type Row = Record<string, unknown>;

/**
 * A Supabase stand-in that keeps the one behaviour the send-once rule rests on:
 * order_events is UNIQUE (order_id, stage), and a clash comes back as 23505.
 */
function fakeDb(seed: Row) {
  const tables: Record<string, Row[]> = {
    orders: [seed],
    order_events: [],
    profiles: [],
  };

  const table = (name: string) => {
    const rows = () => (tables[name] ??= []);
    const filters: ((r: Row) => boolean)[] = [];

    const results = () => rows().filter((r) => filters.every((f) => f(r)));

    const builder: Record<string, unknown> = {
      select: () => builder,
      eq(col: string, val: unknown) {
        filters.push((r) => r[col] === val);
        return builder;
      },
      in(col: string, vals: unknown[]) {
        filters.push((r) => vals.includes(r[col]));
        return builder;
      },
      is(col: string, val: unknown) {
        filters.push((r) => (r[col] ?? null) === val);
        return builder;
      },
      not(col: string) {
        filters.push((r) => r[col] !== null && r[col] !== undefined);
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      maybeSingle() {
        return Promise.resolve({ data: results()[0] ?? null, error: null });
      },
      update(patch: Row) {
        const apply = () => {
          for (const r of results()) Object.assign(r, patch);
          return Promise.resolve({ error: null, data: results() });
        };
        const chain: Record<string, unknown> = {
          eq(col: string, val: unknown) {
            filters.push((r) => r[col] === val);
            return chain;
          },
          in(col: string, vals: unknown[]) {
            filters.push((r) => vals.includes(r[col]));
            return chain;
          },
          then(resolve: (v: unknown) => unknown) {
            return apply().then(resolve);
          },
        };
        return chain;
      },
      insert(row: Row) {
        if (name === "order_events") {
          const clash = rows().some(
            (e) => e.order_id === row.order_id && e.stage === row.stage
          );
          if (clash) {
            return Promise.resolve({
              error: { code: "23505", message: "duplicate key" },
            });
          }
        }
        rows().push({ ...row, created_at: new Date().toISOString() });
        return Promise.resolve({ error: null });
      },
      then(resolve: (v: { data: Row[]; error: null }) => unknown) {
        return Promise.resolve(resolve({ data: results(), error: null }));
      },
    };
    return builder;
  };

  return {
    db: { from: (name: string) => table(name) } as never,
    order: () => tables.orders[0] as unknown as Order,
    events: () => tables.order_events,
  };
}

const seedOrder = (over: Row = {}): Row => ({
  id: "order-1",
  order_number: "ED-2026-0311",
  email: "rider@example.com",
  // Owned by an account, so the paid path has no invite to generate — this
  // test is about the stage journey, not about guest onboarding.
  user_id: "user-1",
  status: "pending",
  paid_at: null,
  fulfillment_stage: "awaiting_payment",
  created_at: PAID.toISOString(),
  currency: "usd",
  subtotal_cents: 189900,
  shipping_cents: 5000,
  tax_cents: 0,
  total_cents: 194900,
  shipping_address: { country: "US" },
  tracking_number: null,
  courier: null,
  items: [],
  ...over,
});

const realFetch = globalThis.fetch;
const realEnv = { ...process.env };
/** Subjects, in the order a customer would receive them. */
let inbox: string[] = [];

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.EMAIL_FROM = "E-Drift <orders@edrifttrikes.shop>";
  process.env.NEXT_PUBLIC_SITE_URL = "https://edrifttrikes.shop";
  inbox = [];
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    if (String(url).includes("api.resend.com")) {
      inbox.push(JSON.parse(String(init?.body ?? "{}")).subject);
    }
    return new Response(JSON.stringify({ id: "sent" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...realEnv };
});

/** The stage a subject line belongs to, or null if it isn't a stage email. */
function stageOf(subject: string): FulfillmentStage | null {
  for (const stage of Object.keys(STAGE_COPY) as FulfillmentStage[]) {
    if (subject.startsWith(`${STAGE_COPY[stage].title} ·`)) return stage;
  }
  return null;
}

/** Run the scheduler once an hour for `days` days, exactly as the cron does. */
async function runClock(db: never, get: () => Order, days: number) {
  for (let hour = 0; hour <= days * 24; hour++) {
    await advanceOrder(db, get(), new Date(PAID.getTime() + hour * 3_600_000));
  }
}

describe("a normal order, day 0 to day 28", () => {
  test("the customer is told about every step, once each, in order", async () => {
    const { db, order, events } = fakeDb(seedOrder());

    await markOrderPaid(db, { id: "order-1" }, { paidAt: PAID, paidVia: "stripe" });
    await runClock(db, order, 28);

    // Every scheduled stage produced exactly one email, in schedule order.
    assert.deepEqual(inbox.map(stageOf), [...SCHEDULED_STAGES]);

    // …and every one of them is on the timeline the tracker reads.
    assert.deepEqual(
      events().map((e) => e.stage),
      [...SCHEDULED_STAGES]
    );

    // The order itself ends where the schedule ends.
    assert.equal(order().fulfillment_stage, "ready_for_collection");
  });

  test("the new steps are not silent — each one emails like the old ones", async () => {
    const { db, order } = fakeDb(seedOrder());
    await markOrderPaid(db, { id: "order-1" }, { paidAt: PAID });
    await runClock(db, order, 28);

    for (const stage of ["preparing", "in_transit", "out_for_delivery"] as const) {
      assert.ok(
        inbox.some((s) => stageOf(s) === stage),
        `no confirmation email for ${stage}`
      );
    }
  });

  test("the subject lines are the tracker's own words", async () => {
    // What lands in the inbox and what shows on the dashboard come from one
    // table; this is what stops a future edit changing only one of them.
    const { db, order } = fakeDb(seedOrder());
    await markOrderPaid(db, { id: "order-1" }, { paidAt: PAID });
    await runClock(db, order, 28);

    assert.deepEqual(
      inbox,
      SCHEDULED_STAGES.map((s) => `${STAGE_COPY[s].title} · ED-2026-0311`)
    );
  });
});

describe("the things that would double-email a customer", () => {
  test("a scheduler run that overlaps itself sends nothing twice", async () => {
    const { db, order } = fakeDb(seedOrder());
    await markOrderPaid(db, { id: "order-1" }, { paidAt: PAID });

    // Two runs at the same instant, racing on the same stage.
    const now = at(3);
    await Promise.all([
      advanceOrder(db, order(), now),
      advanceOrder(db, order(), now),
    ]);

    const shipped = inbox.filter((s) => stageOf(s) === "shipped");
    assert.equal(shipped.length, 1, "shipped was emailed twice");
  });

  test("a repeated payment webhook confirms once", async () => {
    const { db } = fakeDb(seedOrder());
    await markOrderPaid(db, { id: "order-1" }, { paidAt: PAID });
    await markOrderPaid(db, { id: "order-1" }, { paidAt: PAID });
    assert.equal(inbox.filter((s) => stageOf(s) === "confirmed").length, 1);
  });

  test("a scheduler that was down for a fortnight sends ONE email, not six", async () => {
    // The whole point of catching up in a jump: the customer learns where the
    // order is now, rather than receiving the last three weeks in one minute.
    const { db, order, events } = fakeDb(seedOrder());
    await markOrderPaid(db, { id: "order-1" }, { paidAt: PAID });
    inbox = [];

    await advanceOrder(db, order(), at(25));

    assert.deepEqual(inbox.map(stageOf), ["arriving"]);
    // The skipped stages are still on the timeline, so the tracker's history
    // has no holes in it.
    assert.deepEqual(
      events().map((e) => e.stage),
      ["confirmed", "preparing", "shipped", "in_transit", "arriving"]
    );
  });
});

describe("the admin driving it by hand", () => {
  test("picking a new stage emails the customer, same as the clock would", async () => {
    const { db, order } = fakeDb(
      seedOrder({ status: "paid", paid_at: PAID.toISOString(), fulfillment_stage: "shipped" })
    );
    inbox = [];

    const result = await setOrderStage(db, "order-1", "out_for_delivery");

    assert.equal(result.ok, true);
    assert.equal(result.emailed, true);
    assert.deepEqual(inbox.map(stageOf), ["out_for_delivery"]);
    assert.equal(order().fulfillment_stage, "out_for_delivery");
  });

  test("every stage on the rail can be set by hand and confirms", async () => {
    // The customer's rail is the promise; an admin has to be able to honour any
    // rung of it when the courier is ahead of, or behind, the schedule.
    for (const stage of TRACKER_STAGES) {
      const { db, order } = fakeDb(
        seedOrder({ status: "paid", paid_at: PAID.toISOString(), fulfillment_stage: "confirmed" })
      );
      inbox = [];
      const result = await setOrderStage(db, "order-1", stage);
      assert.equal(result.ok, true, `${stage} could not be set`);
      assert.deepEqual(inbox.map(stageOf), [stage], `${stage} sent the wrong email`);
      assert.equal(order().fulfillment_stage, stage);
    }
  });

  test("moving ahead by hand does not make the rest land all at once", async () => {
    // setOrderStage back-dates the anchor, so the stages after the one the
    // admin picked still fall due on their own days.
    const { db, order } = fakeDb(seedOrder({ status: "paid" }));
    await setOrderStage(db, "order-1", "shipped", { sendEmail: false });
    inbox = [];

    // Immediately afterwards the clock should have nothing to do — the order is
    // three days in, not twenty-eight.
    const moved = await advanceOrder(db, order(), new Date());
    assert.equal(moved, null);
    assert.equal(inbox.length, 0);
    assert.equal(order().fulfillment_stage, "shipped");
  });

  test("marking it delivered stops the automation for good", async () => {
    const { db, order } = fakeDb(
      seedOrder({ status: "paid", paid_at: PAID.toISOString(), fulfillment_stage: "ready_for_collection" })
    );
    await setOrderStage(db, "order-1", "delivered");
    inbox = [];

    const moved = await advanceOrder(db, order(), at(400));
    assert.equal(moved, null, "a delivered order was advanced by the scheduler");
    assert.equal(inbox.length, 0);
  });

  test("a cancelled order is never emailed a delivery update again", async () => {
    const { db, order } = fakeDb(
      seedOrder({ status: "paid", paid_at: PAID.toISOString(), fulfillment_stage: "shipped" })
    );
    await setOrderStage(db, "order-1", "cancelled");
    inbox = [];

    await runClock(db, order, 28);
    assert.equal(inbox.length, 0);
  });
});

describe("an order that was never paid", () => {
  test("does not move, and hears nothing about delivery", async () => {
    const { db, order } = fakeDb(seedOrder());
    await runClock(db, order, 28);
    assert.equal(inbox.length, 0);
    assert.equal(order().fulfillment_stage, "awaiting_payment");
  });
});
