import { test, describe, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { sweepAbandonedOrders, syncProductColors } from "../lib/orders";

/**
 * The sweep that actually sends the follow-ups.
 *
 * lib/abandoned.ts decides WHEN; this decides WHO, and it is the part that can
 * email a real customer the wrong thing. The failure that matters is not a
 * missed reminder — it is chasing somebody who already paid, or sending the
 * same person the same email twice because two cron runs overlapped.
 *
 * So these run the real function against a fake Supabase that behaves like the
 * real one in the ways that matter: the unique (order_id, stage) constraint,
 * and query filters that actually filter.
 */

const DAY = 86_400_000;
const NOW = new Date("2026-08-20T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY).toISOString();

type Row = Record<string, unknown>;

/**
 * A Supabase stand-in.
 *
 * Only the surface the sweep uses, but the parts it does implement behave like
 * Postgres: `order_events` rejects a duplicate (order_id, stage) with code
 * 23505, which is the whole basis of send-once.
 */
function fakeDb(seed: Row[] | Partial<Record<string, Row[]>>) {
  // An array is shorthand for "these are the orders" — the common case.
  const tables: Record<string, Row[]> = Array.isArray(seed)
    ? { orders: seed, order_events: [], products: [] }
    : { orders: [], order_events: [], products: [], ...seed };

  const table = (name: string) => {
    const rows = () => (tables[name] ??= []);
    const filters: ((r: Row) => boolean)[] = [];
    let limitTo = Infinity;

    const builder: Record<string, unknown> = {
      select() {
        return builder;
      },
      eq(col: string, val: unknown) {
        filters.push((r) => r[col] === val);
        return builder;
      },
      in(col: string, vals: unknown[]) {
        filters.push((r) => vals.includes(r[col]));
        return builder;
      },
      not(col: string, _op: string, _val: unknown) {
        filters.push((r) => r[col] !== null && r[col] !== undefined);
        return builder;
      },
      gte(col: string, val: string) {
        filters.push((r) => String(r[col]) >= val);
        return builder;
      },
      order() {
        return builder;
      },
      limit(n: number) {
        limitTo = n;
        return builder;
      },
      update(patch: Row) {
        return {
          eq(col: string, val: unknown) {
            for (const r of rows()) if (r[col] === val) Object.assign(r, patch);
            return Promise.resolve({ error: null });
          },
        };
      },
      insert(row: Row) {
        // The real constraint: order_events is UNIQUE (order_id, stage), which
        // is the entire basis of send-once.
        if (name === "order_events") {
          const clash = rows().some(
            (e) => e.order_id === row.order_id && e.stage === row.stage
          );
          if (clash) return Promise.resolve({ error: { code: "23505", message: "duplicate" } });
        }
        rows().push(row);
        return Promise.resolve({ error: null });
      },
      then(resolve: (v: { data: Row[]; error: null }) => unknown) {
        const out = rows().filter((r) => filters.every((f) => f(r))).slice(0, limitTo);
        return Promise.resolve(resolve({ data: out, error: null }));
      },
    };
    return builder;
  };

  return {
    db: { from: (name: string) => table(name) } as never,
    events: (tables.order_events ??= []),
    products: (tables.products ??= []),
  };
}

const order = (over: Row = {}): Row => ({
  id: `id-${Math.random().toString(36).slice(2)}`,
  order_number: "ED-2026-0148",
  email: "rider@example.com",
  status: "pending",
  created_at: daysAgo(3),
  currency: "usd",
  subtotal_cents: 189900,
  shipping_cents: 5000,
  tax_cents: 15192,
  total_cents: 210092,
  shipping_address: {},
  items: [],
  ...over,
});

// Capture sends without touching the network.
const realFetch = globalThis.fetch;
const realEnv = { ...process.env };
let sentTo: { to: string; subject: string }[] = [];

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.EMAIL_FROM = "E-Drift <orders@edrifttrikes.shop>";
  process.env.NEXT_PUBLIC_SITE_URL = "https://edrifttrikes.shop";
  sentTo = [];
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    if (String(url).includes("api.resend.com")) {
      const body = JSON.parse(String(init?.body ?? "{}"));
      sentTo.push({ to: body.to, subject: body.subject });
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

describe("who gets chased", () => {
  test("an unpaid order three days old gets the first reminder", async () => {
    const { db } = fakeDb([order({ created_at: daysAgo(3) })]);
    const result = await sweepAbandonedOrders(db, { now: NOW });
    assert.equal(result.emailed, 1);
    assert.equal(sentTo.length, 1);
    assert.match(sentTo[0].subject, /Still thinking it over/);
  });

  test("a day-old order is left alone", async () => {
    const { db } = fakeDb([order({ created_at: daysAgo(1) })]);
    const result = await sweepAbandonedOrders(db, { now: NOW });
    assert.equal(result.emailed, 0);
    assert.equal(result.skipped.not_due, 1);
  });

  test("the day-12 order gets the LAST reminder, not the first", async () => {
    const { db } = fakeDb([order({ created_at: daysAgo(12) })]);
    await sweepAbandonedOrders(db, { now: NOW });
    assert.match(sentTo[0].subject, /Last reminder/);
  });

  test("an order the sweep missed for a week gets ONE email, not three", async () => {
    // The cron was down. dueReminder returns the furthest due step and the
    // skipped ones are claimed silently.
    const { db, events } = fakeDb([order({ created_at: daysAgo(13) })]);
    await sweepAbandonedOrders(db, { now: NOW });
    assert.equal(sentTo.length, 1, "sent more than one email");
    assert.match(sentTo[0].subject, /Last reminder/);
    // All three steps are claimed, so a later run cannot work backwards.
    assert.deepEqual(
      events.map((e) => e.stage).sort(),
      ["abandoned_2", "abandoned_3", "abandoned_4"]
    );
  });
});

describe("who does NOT get chased", () => {
  test("someone who has since bought ANYTHING", async () => {
    // The condition the whole sequence turns on.
    const { db } = fakeDb([
      order({ created_at: daysAgo(7) }),
      order({ id: "other", status: "paid", order_number: "ED-2026-0200" }),
    ]);
    const result = await sweepAbandonedOrders(db, { now: NOW });
    assert.equal(result.emailed, 0);
    assert.equal(result.skipped.already_bought, 1);
    assert.equal(sentTo.length, 0);
  });

  test("a buyer whose OTHER order is only fulfilled, not merely paid", async () => {
    const { db } = fakeDb([
      order({ created_at: daysAgo(7) }),
      order({ id: "other", status: "fulfilled" }),
    ]);
    assert.equal((await sweepAbandonedOrders(db, { now: NOW })).emailed, 0);
  });

  test("an order older than the window — switching this on must not blast history", async () => {
    const { db } = fakeDb([order({ created_at: daysAgo(90) })]);
    const result = await sweepAbandonedOrders(db, { now: NOW });
    assert.equal(result.scanned, 0, "an ancient order was even fetched");
    assert.equal(sentTo.length, 0);
  });

  test("an order that is no longer pending is never fetched", async () => {
    const { db } = fakeDb([order({ status: "cancelled", created_at: daysAgo(5) })]);
    const result = await sweepAbandonedOrders(db, { now: NOW });
    assert.equal(result.scanned, 0);
    assert.equal(sentTo.length, 0);
  });
});

describe("send-once, under overlapping cron runs", () => {
  test("a second sweep in the same window sends nothing", async () => {
    const { db } = fakeDb([order({ created_at: daysAgo(3) })]);
    const first = await sweepAbandonedOrders(db, { now: NOW });
    const second = await sweepAbandonedOrders(db, { now: NOW });
    assert.equal(first.emailed, 1);
    assert.equal(second.emailed, 0);
    assert.equal(second.skipped.already_sent, 1);
    assert.equal(sentTo.length, 1);
  });

  test("the day-7 reminder still lands after the day-3 one was sent", async () => {
    // Send-once is per STEP, not per order — otherwise the sequence would stop
    // after the first email.
    const rows = [order({ created_at: daysAgo(3) })];
    const { db } = fakeDb(rows);
    await sweepAbandonedOrders(db, { now: NOW });
    assert.equal(sentTo.length, 1);

    const later = new Date(NOW.getTime() + 4 * DAY);
    await sweepAbandonedOrders(db, { now: later });
    assert.equal(sentTo.length, 2, "the second reminder never went out");
    assert.match(sentTo[1].subject, /waiting/);
  });

  test("nothing is sent after the last step, however often it runs", async () => {
    const { db } = fakeDb([order({ created_at: daysAgo(12) })]);
    await sweepAbandonedOrders(db, { now: NOW });
    await sweepAbandonedOrders(db, { now: new Date(NOW.getTime() + DAY) });
    await sweepAbandonedOrders(db, { now: new Date(NOW.getTime() + 2 * DAY) });
    assert.equal(sentTo.length, 1);
  });
});

describe("what the reminder carries", () => {
  test("a link that restores the exact order, not a bare cart", async () => {
    // Sending them to an empty cart asks them to find the trike again — the
    // work that made them give up the first time.
    const row = order({ id: "11111111-2222-3333-4444-555555555555", created_at: daysAgo(3) });
    const { db } = fakeDb([row]);
    let html = "";
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      if (String(url).includes("api.resend.com")) {
        html = JSON.parse(String(init?.body ?? "{}")).html ?? "";
      }
      return new Response(JSON.stringify({ id: "s" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    await sweepAbandonedOrders(db, { now: NOW });
    assert.match(html, /\/cart\?recover=11111111-2222-3333-4444-555555555555/);
  });
});

describe("failure never becomes a duplicate", () => {
  test("a send that fails is not retried on the next run", async () => {
    // The claim is taken before the send. A missed reminder beats a duplicate.
    const { db } = fakeDb([order({ created_at: daysAgo(3) })]);
    globalThis.fetch = (async () =>
      new Response("boom", { status: 500 })) as typeof fetch;
    const first = await sweepAbandonedOrders(db, { now: NOW });
    assert.equal(first.emailed, 0);
    assert.equal(first.skipped.send_failed, 1);

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ id: "s" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
    const second = await sweepAbandonedOrders(db, { now: NOW });
    assert.equal(second.emailed, 0, "the failed send was retried");
  });
});

describe("filling in colours the admin already wrote", () => {
  test("writes colours found in a description onto the product", async () => {
    // Products uploaded before colours had a column kept their `Colors:` line
    // as description text. This turns the read-time fallback into real data.
    const products = [
      { id: "p1", colors: [], description: "A trike.\n\nColors: Midnight Black, Voltage Blue\n\nShips flat." },
    ];
    const { db } = fakeDb({ products });
    const result = await syncProductColors(db, {});
    assert.equal(result.updated, 1);
    assert.deepEqual(
      (products[0].colors as { name: string }[]).map((c) => c.name),
      ["Midnight Black", "Voltage Blue"]
    );
  });

  test("NEVER overwrites colours a product already has", async () => {
    const products = [
      {
        id: "p1",
        colors: [{ name: "Admin Chose This", hex: null }],
        description: "Colors: Something Else",
      },
    ];
    const { db } = fakeDb({ products });
    const result = await syncProductColors(db, {});
    assert.equal(result.updated, 0);
    assert.deepEqual(
      (products[0].colors as { name: string }[]).map((c) => c.name),
      ["Admin Chose This"]
    );
  });

  test("leaves a description with no colour line alone", async () => {
    const products = [{ id: "p1", colors: [], description: "A 3000W hub motor." }];
    const { db } = fakeDb({ products });
    assert.equal((await syncProductColors(db, {})).updated, 0);
    assert.deepEqual(products[0].colors, []);
  });

  test("is idempotent — a second run changes nothing", async () => {
    const products = [{ id: "p1", colors: [], description: "Colors: Black, Red" }];
    const { db } = fakeDb({ products });
    const first = await syncProductColors(db, {});
    const second = await syncProductColors(db, {});
    assert.equal(first.updated, 1);
    assert.equal(second.updated, 0);
  });
});
