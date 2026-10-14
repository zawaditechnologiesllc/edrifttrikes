import { test, describe, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  BULK_CHUNK,
  BULK_STAGES,
  ORDER_STATUSES,
  STATUS_EFFECT,
  chunkIds,
  describeBatch,
  isOrderStatus,
  isStage,
  stageAllowedForStatus,
  stageEffect,
  summarize,
  type OrderStatus,
  type StageOutcome,
  type StatusOutcome,
} from "../lib/order-status";
import { applyStageChange, applyStatusChange } from "../lib/orders";
import { ALL_STAGES, STAGE_COPY, type FulfillmentStage } from "../lib/fulfillment";

/**
 * CHANGING MANY ORDERS AT ONCE — their payment status, or their delivery stage.
 *
 * A bulk control over order status is a bulk control over two things that
 * cannot be taken back: what the shop's books say happened, and what a
 * customer has already read in their inbox. So these tests are mostly about
 * restraint — what must NOT happen.
 *
 * The three that would do real damage:
 *   - re-emailing an order that was already in the target status (a customer
 *     reads a duplicate confirmation as a second charge);
 *   - a failed email rolling back the status, so a paid order looks unpaid;
 *   - a cancelled or refunded order left on the delivery schedule, where the
 *     cron job walks it through "shipped" and "out for delivery" and emails
 *     the customer about a package that is not coming.
 */

const DAY = 86_400_000;
const PAID = new Date("2026-03-01T09:00:00Z");

type Row = Record<string, unknown>;

/**
 * A Supabase stand-in over MANY orders, keeping the one behaviour the
 * send-once rule rests on: order_events is UNIQUE (order_id, stage) and a
 * clash comes back as 23505.
 */
function fakeDb(seeds: Row[]) {
  const tables: Record<string, Row[]> = {
    orders: seeds.map((s) => ({ ...s })),
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
      single() {
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
            return Promise.resolve({ error: { code: "23505", message: "duplicate key" } });
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
    row: (id: string) => tables.orders.find((o) => o.id === id) as Row,
    events: () => tables.order_events,
  };
}

const seed = (id: string, over: Row = {}): Row => ({
  id,
  order_number: `ED-2026-${id}`,
  email: `${id}@example.com`,
  // Owned by an account, so no guest invite is generated — these tests are
  // about the transition, not onboarding.
  user_id: `user-${id}`,
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
let inbox: { to: unknown; subject: string }[] = [];
/** Set to make every Resend call fail, the way a spent daily quota does. */
let emailBreaks = false;

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.EMAIL_FROM = "E-Drift <orders@edrifttrikes.shop>";
  process.env.NEXT_PUBLIC_SITE_URL = "https://edrifttrikes.shop";
  inbox = [];
  emailBreaks = false;
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    if (String(url).includes("api.resend.com")) {
      if (emailBreaks) {
        return new Response(JSON.stringify({ message: "Daily quota exceeded" }), {
          status: 429,
          headers: { "content-type": "application/json" },
        });
      }
      const body = JSON.parse(String(init?.body ?? "{}"));
      inbox.push({ to: body.to, subject: body.subject });
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

/** Run the transition over a list of ids, the way the bulk action does. */
async function runBatch(
  db: never,
  ids: string[],
  to: OrderStatus,
  notify = true
): Promise<StatusOutcome[]> {
  const out: StatusOutcome[] = [];
  for (const id of ids) out.push(await applyStatusChange(db, id, to, { notify }));
  return out;
}

describe("every status tells the customer something", () => {
  test("EACH ONE HAS ITS OWN EMAIL, and the table says which", () => {
    // The user's requirement was "users must be emailed". This is the list of
    // what they get, kept next to the code that sends it.
    for (const status of ORDER_STATUSES) {
      const effect = STATUS_EFFECT[status];
      assert.ok(effect.label.length > 2, status);
      assert.ok(effect.note.length > 40, `${status} does not explain itself`);
      assert.ok(effect.email, `${status} claims to send no email`);
    }
  });

  test("the promised subject is the one the stage table actually sends", () => {
    // Copy drift between the admin's warning and the customer's inbox is how
    // an admin sends something they did not mean to.
    assert.equal(STATUS_EFFECT.fulfilled.email, STAGE_COPY.delivered.title);
    assert.equal(STATUS_EFFECT.cancelled.email, STAGE_COPY.cancelled.title);
    assert.equal(STATUS_EFFECT.pending.email, STAGE_COPY.awaiting_payment.title);
  });

  test("paid emails the confirmation and starts the schedule", async () => {
    const { db, row } = fakeDb([seed("a")]);
    const [out] = await runBatch(db, ["a"], "paid");
    assert.equal(out.changed, true);
    assert.equal(out.emailed, true);
    assert.equal(row("a").status, "paid");
    assert.ok(row("a").paid_at, "paid_at is the anchor every later stage counts from");
    assert.equal(row("a").fulfillment_stage, "confirmed");
    assert.match(inbox[0].subject, new RegExp(STAGE_COPY.confirmed.title));
  });

  test("fulfilled emails the delivery notice — it used to email nothing", async () => {
    // The old code wrote fulfillment_stage directly, which skipped the email
    // entirely: the customer was never told their order had arrived.
    const { db, row } = fakeDb([seed("a", { status: "paid", paid_at: PAID.toISOString() })]);
    const [out] = await runBatch(db, ["a"], "fulfilled");
    assert.equal(out.changed, true);
    assert.equal(out.emailed, true);
    assert.equal(row("a").status, "fulfilled");
    assert.equal(row("a").fulfillment_stage, "delivered");
    assert.match(inbox.at(-1)!.subject, new RegExp(STAGE_COPY.delivered.title));
  });

  test("cancelled emails the cancellation — it used to email nothing", async () => {
    const { db, row } = fakeDb([seed("a", { status: "paid", paid_at: PAID.toISOString() })]);
    const [out] = await runBatch(db, ["a"], "cancelled");
    assert.equal(out.emailed, true);
    assert.equal(row("a").status, "cancelled");
    assert.match(inbox.at(-1)!.subject, new RegExp(STAGE_COPY.cancelled.title));
  });

  test("refunded sends the refund notice and NOT a second cancellation", async () => {
    // Two emails for one refund reads as two refunds.
    const { db, row } = fakeDb([seed("a", { status: "paid", paid_at: PAID.toISOString() })]);
    const [out] = await runBatch(db, ["a"], "refunded");
    assert.equal(out.emailed, true);
    assert.equal(row("a").status, "refunded");
    assert.equal(inbox.length, 1, `got ${inbox.map((m) => m.subject).join(" | ")}`);
    assert.ok(!new RegExp(STAGE_COPY.cancelled.title).test(inbox[0].subject));
  });

  test("the email goes to the address on the order", async () => {
    const { db } = fakeDb([seed("a", { email: "rider@example.com" })]);
    await runBatch(db, ["a"], "paid");
    assert.match(JSON.stringify(inbox[0].to), /rider@example\.com/);
  });
});

describe("what must not happen", () => {
  test("AN ORDER ALREADY IN THE TARGET STATUS IS LEFT ALONE", async () => {
    // The property the whole bulk control rests on: tick forty rows, mark them
    // paid, and the eight that were already paid must not be re-confirmed.
    const { db } = fakeDb([seed("a", { status: "paid", paid_at: PAID.toISOString() })]);
    const [out] = await runBatch(db, ["a"], "paid");
    assert.equal(out.changed, false);
    assert.equal(out.emailed, false);
    assert.equal(out.skipped, "already_there");
    assert.equal(inbox.length, 0, "it emailed an order that was already paid");
  });

  test("a mixed selection only emails the ones that moved", async () => {
    const { db } = fakeDb([
      seed("a"),
      seed("b", { status: "fulfilled" }),
      seed("c"),
    ]);
    const outs = await runBatch(db, ["a", "b", "c"], "fulfilled");
    const s = summarize(outs);
    assert.equal(s.changed, 2);
    assert.equal(s.emailed, 2);
    assert.equal(s.alreadyThere, 1);
    assert.equal(inbox.length, 2);
  });

  test("A FAILED EMAIL NEVER ROLLS BACK THE STATUS", async () => {
    // The status is the record of what happened; the email is a notification
    // about it. Losing the first because the second failed is how a paid order
    // ends up looking unpaid.
    const { db, row } = fakeDb([seed("a", { status: "paid", paid_at: PAID.toISOString() })]);
    emailBreaks = true;
    const [out] = await runBatch(db, ["a"], "fulfilled");
    assert.equal(out.changed, true, "the status was rolled back");
    assert.equal(row("a").status, "fulfilled");
    assert.equal(out.emailed, false);
    assert.ok(out.emailError, "a failed email was reported as a success");
  });

  test("a failed REFUND email still leaves the refund recorded", async () => {
    const { db, row } = fakeDb([seed("a", { status: "paid", paid_at: PAID.toISOString() })]);
    emailBreaks = true;
    const [out] = await runBatch(db, ["a"], "refunded");
    assert.equal(row("a").status, "refunded");
    assert.ok(out.emailError);
    // And it says what to do about it rather than just failing.
    assert.match(out.emailError!, /quota|limit|customer|Resend/i);
  });

  test("CANCELLING STOPS THE DELIVERY SCHEDULE", async () => {
    // Otherwise the cron job keeps walking the order through "shipped" and
    // "out for delivery", emailing about a package that is not coming.
    for (const status of ["cancelled", "refunded"] as const) {
      const { db, row } = fakeDb([
        seed("a", { status: "paid", paid_at: PAID.toISOString(), fulfillment_stage: "preparing" }),
      ]);
      await runBatch(db, ["a"], status);
      assert.equal(row("a").fulfillment_stage, "cancelled", status);
    }
  });

  test("marking a refunded order paid is refused, not quietly confirmed", async () => {
    const { db, row } = fakeDb([seed("a", { status: "refunded" })]);
    const [out] = await runBatch(db, ["a"], "paid");
    assert.equal(out.changed, false);
    assert.ok(out.error, "a closed order was marked paid");
    assert.equal(row("a").status, "refunded");
    assert.equal(inbox.length, 0);
  });

  test("turning the email off changes the status and sends nothing", async () => {
    const { db, row } = fakeDb([seed("a", { status: "paid", paid_at: PAID.toISOString() })]);
    const [out] = await runBatch(db, ["a"], "fulfilled", false);
    assert.equal(out.changed, true);
    assert.equal(row("a").status, "fulfilled");
    assert.equal(out.emailed, false);
    assert.equal(inbox.length, 0, "it emailed with notifications off");
    assert.equal(out.emailError, undefined, "silence was reported as a failure");
  });

  test("an order that does not exist is reported, not thrown", async () => {
    const { db } = fakeDb([seed("a")]);
    const [out] = await runBatch(db, ["nope"], "paid");
    assert.equal(out.skipped, "not_found");
    assert.ok(out.error);
  });

  test("one bad order does not stop the rest of the batch", async () => {
    const { db, row } = fakeDb([seed("a"), seed("b", { status: "refunded" }), seed("c")]);
    const outs = await runBatch(db, ["a", "b", "c"], "paid");
    assert.equal(outs.length, 3);
    assert.equal(row("a").status, "paid");
    assert.equal(row("c").status, "paid", "a failure in the middle lost the rest");
    assert.equal(summarize(outs).failed, 1);
  });

  test("every order in the batch is reported, in order", async () => {
    // "40 of 40 updated" with no detail is unverifiable, and this runs over
    // money and customer email.
    const { db } = fakeDb([seed("a"), seed("b"), seed("c")]);
    const outs = await runBatch(db, ["a", "b", "c"], "cancelled");
    assert.deepEqual(outs.map((o) => o.orderId), ["a", "b", "c"]);
    for (const o of outs) {
      assert.ok(o.orderNumber, "no order number to show the admin");
      assert.ok(o.customerEmail, "no customer address to show the admin");
      assert.equal(o.from, "pending");
      assert.equal(o.to, "cancelled");
    }
  });
});

describe("splitting a selection into calls the server will take", () => {
  test("a selection is cut into chunks of BULK_CHUNK", () => {
    const ids = Array.from({ length: 14 }, (_, i) => `id-${i}`);
    const chunks = chunkIds(ids);
    assert.ok(chunks.every((c) => c.length <= BULK_CHUNK), "a chunk exceeds the cap");
    assert.deepEqual(chunks.flat(), ids, "ids were lost or reordered");
  });

  test("THE SAME ID TWICE IS SENT ONCE", () => {
    // The second run is the one that could double-email.
    assert.deepEqual(chunkIds(["a", "b", "a", " b ", "", "  "]), [["a", "b"]]);
  });

  test("nothing selected produces no calls at all", () => {
    assert.deepEqual(chunkIds([]), []);
  });

  test("a chunk size of zero does not hang", () => {
    assert.deepEqual(chunkIds(["a", "b"], 0), [["a"], ["b"]]);
  });
});

describe("what the admin reads afterwards", () => {
  const outcome = (over: Partial<StatusOutcome>): StatusOutcome => ({
    orderId: "x",
    orderNumber: "ED-1",
    customerEmail: "a@example.com",
    from: "pending",
    to: "paid",
    changed: false,
    emailed: false,
    notes: [],
    ...over,
  });

  test("it counts what happened, not what was asked for", () => {
    const s = summarize([
      outcome({ changed: true, emailed: true }),
      outcome({ changed: true, emailed: false, emailError: "rate limited" }),
      outcome({ skipped: "already_there" }),
      outcome({ error: "closed" }),
    ]);
    assert.deepEqual(s, {
      changed: 2,
      emailed: 1,
      alreadyThere: 1,
      failed: 1,
      emailsFailed: 1,
    });
  });

  test("the summary line mentions the failures, not just the wins", () => {
    const line = describeBatch(
      [
        outcome({ changed: true, emailed: true }),
        outcome({ error: "closed" }),
        outcome({ changed: true, emailError: "quota" }),
      ],
      "paid"
    );
    assert.match(line, /paid/);
    assert.match(line, /email/i);
    assert.match(line, /could not be changed/);
  });

  test("an empty batch says so rather than claiming success", () => {
    assert.match(describeBatch([], "paid"), /Nothing selected/i);
  });

  test("only the five database statuses are accepted", () => {
    for (const s of ORDER_STATUSES) assert.equal(isOrderStatus(s), true, s);
    for (const s of ["shipped", "delivered", "", "PAID", "drop table", null, undefined]) {
      assert.equal(isOrderStatus(s), false, String(s));
    }
  });
});

/* -------------------------------------------------------------------------- */
/* The other thing that moves in bulk: the delivery stage                      */
/* -------------------------------------------------------------------------- */

/** Run the stage transition over a list of ids, the way the bulk action does. */
async function runStages(
  db: never,
  ids: string[],
  to: FulfillmentStage,
  notify = true
): Promise<StageOutcome[]> {
  const out: StageOutcome[] = [];
  for (const id of ids) out.push(await applyStageChange(db, id, to, { notify }));
  return out;
}

describe("moving the delivery stage in bulk", () => {
  test("EVERY STAGE IS OFFERED, AND EVERY ONE EMAILS SOMETHING", () => {
    assert.deepEqual(BULK_STAGES, ALL_STAGES, "the bulk list drifted from the real one");
    for (const stage of BULK_STAGES) {
      const effect = stageEffect(stage);
      assert.equal(effect.email, STAGE_COPY[stage].title, `${stage} promises the wrong subject`);
      assert.equal(effect.label, STAGE_COPY[stage].label, stage);
      assert.ok(effect.note.length > 30, `${stage} has no explanation`);
    }
  });

  test("it moves the stage and emails that stage's own copy", async () => {
    const { db, row } = fakeDb([seed("a", { status: "paid", paid_at: PAID.toISOString(), fulfillment_stage: "confirmed" })]);
    const [out] = await runStages(db, ["a"], "shipped");
    assert.equal(out.changed, true);
    assert.equal(out.emailed, true);
    assert.equal(out.from, "confirmed");
    assert.equal(row("a").fulfillment_stage, "shipped");
    assert.match(inbox.at(-1)!.subject, new RegExp(STAGE_COPY.shipped.title));
  });

  test("AN ORDER ALREADY AT THAT STAGE IS LEFT ALONE", async () => {
    // setOrderStage deliberately re-sends when a human asks for ONE order.
    // In a selection of forty, the ones already there are the ones nobody is
    // thinking about, and re-sending to them is the whole spam risk.
    const { db } = fakeDb([seed("a", { status: "paid", fulfillment_stage: "shipped" })]);
    const [out] = await runStages(db, ["a"], "shipped");
    assert.equal(out.changed, false);
    assert.equal(out.skipped, "already_there");
    assert.equal(inbox.length, 0, "it re-emailed a stage the order was already at");
  });

  test("A REFUNDED ORDER IS NEVER TOLD IT HAS SHIPPED", async () => {
    // The easy mistake in bulk: a refunded row looks like any other row.
    for (const status of ["refunded", "cancelled"] as const) {
      const { db, row } = fakeDb([seed("a", { status, fulfillment_stage: "cancelled" })]);
      const [out] = await runStages(db, ["a"], "shipped");
      assert.equal(out.changed, false, status);
      assert.match(out.error ?? "", /Refused/, status);
      assert.equal(row("a").fulfillment_stage, "cancelled", status);
      assert.equal(inbox.length, 0, status);
    }
  });

  test("but a closed order can still be moved to Cancelled", async () => {
    const { db, row } = fakeDb([
      seed("a", { status: "refunded", fulfillment_stage: "preparing" }),
    ]);
    const [out] = await runStages(db, ["a"], "cancelled");
    assert.equal(out.changed, true);
    assert.equal(row("a").fulfillment_stage, "cancelled");
  });

  test("the rule itself, stated once", () => {
    for (const stage of ALL_STAGES) {
      assert.equal(stageAllowedForStatus(stage, "paid"), true, stage);
      assert.equal(stageAllowedForStatus(stage, "pending"), true, stage);
      assert.equal(
        stageAllowedForStatus(stage, "refunded"),
        stage === "cancelled",
        `${stage} on a refunded order`
      );
      assert.equal(
        stageAllowedForStatus(stage, "cancelled"),
        stage === "cancelled",
        `${stage} on a cancelled order`
      );
    }
  });

  test("a failed email never rolls back the stage", async () => {
    const { db, row } = fakeDb([seed("a", { status: "paid", fulfillment_stage: "confirmed" })]);
    emailBreaks = true;
    const [out] = await runStages(db, ["a"], "shipped");
    assert.equal(out.changed, true, "the stage was rolled back");
    assert.equal(row("a").fulfillment_stage, "shipped");
    assert.ok(out.emailError);
  });

  test("turning the email off moves the stage silently", async () => {
    const { db, row } = fakeDb([seed("a", { status: "paid", fulfillment_stage: "confirmed" })]);
    const [out] = await runStages(db, ["a"], "delivered", false);
    assert.equal(row("a").fulfillment_stage, "delivered");
    assert.equal(out.emailed, false);
    assert.equal(out.emailError, undefined, "silence was reported as a failure");
    assert.equal(inbox.length, 0);
  });

  test("an unpaid order is moved, with a warning that the scheduler will not continue", async () => {
    // Allowed on purpose — shipping before payment clears is a real thing —
    // but the admin is told the automation stops there.
    const { db, row } = fakeDb([seed("a", { status: "pending" })]);
    const [out] = await runStages(db, ["a"], "shipped");
    assert.equal(row("a").fulfillment_stage, "shipped");
    assert.ok(
      out.notes.some((n) => /scheduler will not advance/i.test(n)),
      `no warning: ${out.notes.join(" | ")}`
    );
  });

  test("a missing order is reported, not thrown", async () => {
    const { db } = fakeDb([seed("a")]);
    const [out] = await runStages(db, ["nope"], "shipped");
    assert.equal(out.skipped, "not_found");
    assert.ok(out.error);
  });

  test("one refused order does not stop the rest of the batch", async () => {
    const { db, row } = fakeDb([
      seed("a", { status: "paid", fulfillment_stage: "confirmed" }),
      seed("b", { status: "refunded", fulfillment_stage: "cancelled" }),
      seed("c", { status: "paid", fulfillment_stage: "confirmed" }),
    ]);
    const outs = await runStages(db, ["a", "b", "c"], "shipped");
    assert.equal(row("a").fulfillment_stage, "shipped");
    assert.equal(row("c").fulfillment_stage, "shipped", "a refusal in the middle lost the rest");
    assert.equal(summarize(outs).failed, 1);
    assert.equal(summarize(outs).changed, 2);
  });

  test("every order is reported with what an admin needs to read", async () => {
    const { db } = fakeDb([seed("a", { status: "paid" }), seed("b", { status: "paid" })]);
    const outs = await runStages(db, ["a", "b"], "preparing");
    assert.deepEqual(outs.map((o) => o.orderId), ["a", "b"]);
    for (const o of outs) {
      assert.ok(o.orderNumber);
      assert.ok(o.customerEmail);
      assert.equal(o.to, "preparing");
    }
  });

  test("only real stages are accepted", () => {
    for (const stage of ALL_STAGES) assert.equal(isStage(stage), true, stage);
    for (const bad of ["paid", "posted", "", "SHIPPED", null, undefined]) {
      assert.equal(isStage(bad), false, String(bad));
    }
  });

  test("the summary line reads the same for stages as for statuses", () => {
    const outs: StageOutcome[] = [
      { orderId: "a", orderNumber: "ED-1", customerEmail: "a@x.com", from: "confirmed", to: "shipped", changed: true, emailed: true, notes: [] },
      { orderId: "b", orderNumber: "ED-2", customerEmail: "b@x.com", from: "shipped", to: "shipped", changed: false, emailed: false, skipped: "already_there", notes: [] },
    ];
    const line = describeBatch(outs, "shipped");
    assert.match(line, /1 order → shipped/);
    assert.match(line, /1 customer emailed/);
    assert.match(line, /1 already shipped/);
  });
});
