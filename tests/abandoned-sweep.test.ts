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

  /**
   * `orders.status` reads through the embedded row, the way PostgREST filters
   * an `!inner` join. The best-seller query is the only caller that needs it,
   * and without it that filter silently matched nothing — which looked exactly
   * like "the shop has sold nothing".
   */
  const read = (row: Row, col: string): unknown =>
    col.split(".").reduce<unknown>(
      (value, part) => (value && typeof value === "object" ? (value as Row)[part] : undefined),
      row
    );

  const table = (name: string) => {
    const rows = () => (tables[name] ??= []);
    const filters: ((r: Row) => boolean)[] = [];
    let limitTo = Infinity;
    let rangeFrom = 0;
    const results = () =>
      rows()
        .filter((r) => filters.every((f) => f(r)))
        .slice(rangeFrom, rangeFrom + limitTo);

    const builder: Record<string, unknown> = {
      select() {
        return builder;
      },
      eq(col: string, val: unknown) {
        filters.push((r) => read(r, col) === val);
        return builder;
      },
      in(col: string, vals: unknown[]) {
        filters.push((r) => vals.includes(read(r, col)));
        return builder;
      },
      not(col: string, _op: string, _val: unknown) {
        filters.push((r) => read(r, col) !== null && read(r, col) !== undefined);
        return builder;
      },
      gte(col: string, val: string) {
        filters.push((r) => String(read(r, col)) >= val);
        return builder;
      },
      order() {
        return builder;
      },
      maybeSingle() {
        return Promise.resolve({ data: results()[0] ?? null, error: null });
      },
      limit(n: number) {
        limitTo = n;
        return builder;
      },
      // Postgres-style inclusive range, which is what Supabase sends and what
      // the colour sync uses to page through the catalogue.
      range(from: number, to: number) {
        rangeFrom = from;
        limitTo = to - from + 1;
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
      /**
       * `ignoreDuplicates` upsert, which is how the sweep records the steps a
       * late run skipped — one write instead of one per step.
       */
      upsert(input: Row | Row[]) {
        for (const row of Array.isArray(input) ? input : [input]) {
          const clash = rows().some(
            (e) =>
              (name === "order_events" &&
                e.order_id === row.order_id &&
                e.stage === row.stage) ||
              (name !== "order_events" && e.email === row.email)
          );
          if (!clash) rows().push(row);
        }
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
  // Signs the one-click unsubscribe token. Without it these emails REFUSE to
  // send — see the test for that below.
  process.env.INTERNAL_API_KEY = "test-internal-key";
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
  test("an unpaid order two days old gets the first reminder", async () => {
    const { db } = fakeDb([order({ created_at: daysAgo(2) })]);
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

  test("the day-56 order gets the LAST reminder, not the first", async () => {
    const { db } = fakeDb([order({ created_at: daysAgo(56) })]);
    await sweepAbandonedOrders(db, { now: NOW });
    assert.match(sentTo[0].subject, /Last email/);
  });

  test("AN ORDER THE SWEEP MISSED FOR WEEKS GETS ONE EMAIL, NOT TWENTY", async () => {
    // The cron was down. dueReminder returns the furthest due step and the
    // skipped ones are recorded silently — the buyer must not wake up to two
    // months of backlog in one morning.
    const { db, events } = fakeDb([order({ created_at: daysAgo(57) })]);
    await sweepAbandonedOrders(db, { now: NOW });
    assert.equal(sentTo.length, 1, "sent more than one email");
    assert.match(sentTo[0].subject, /Last email/);
    // Every step is accounted for, so a later run cannot work backwards.
    assert.equal(events.length, 24);
    assert.equal(events.filter((e) => e.email_sent === true).length, 1);
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
    const { db } = fakeDb([order({ created_at: daysAgo(2) })]);
    const first = await sweepAbandonedOrders(db, { now: NOW });
    const second = await sweepAbandonedOrders(db, { now: NOW });
    assert.equal(first.emailed, 1);
    assert.equal(second.emailed, 0);
    assert.equal(second.skipped.already_sent, 1);
    assert.equal(sentTo.length, 1);
  });

  test("the next reminder still lands after the first one was sent", async () => {
    // Send-once is per STEP, not per order — otherwise the sequence would stop
    // after the first email.
    const rows = [order({ created_at: daysAgo(2) })];
    const { db } = fakeDb(rows);
    await sweepAbandonedOrders(db, { now: NOW });
    assert.equal(sentTo.length, 1);

    const later = new Date(NOW.getTime() + 2 * DAY);
    await sweepAbandonedOrders(db, { now: later });
    assert.equal(sentTo.length, 2, "the second reminder never went out");
    assert.match(sentTo[1].subject, /waiting/);
  });

  test("ALL 24 LAND, ONE AT A TIME, OVER THE TWO MONTHS", async () => {
    // The sequence is generated, so the thing worth proving is that running
    // the real sweep every day for two months produces exactly the schedule —
    // not 24 on day 2, and not silence after the first week.
    const { db } = fakeDb([order({ created_at: daysAgo(0) })]);
    for (let day = 0; day <= 70; day++) {
      await sweepAbandonedOrders(db, { now: new Date(NOW.getTime() + day * DAY) });
    }
    assert.equal(sentTo.length, 24, "the sequence did not run to length");
    assert.equal(new Set(sentTo.map((m) => m.subject)).size >= 9, true, "too much repetition");
    assert.match(sentTo[sentTo.length - 1].subject, /Last email/);
  });

  test("nothing is sent after the last step, however often it runs", async () => {
    const { db } = fakeDb([order({ created_at: daysAgo(56) })]);
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
    const row = order({ id: "11111111-2222-3333-4444-555555555555", created_at: daysAgo(2) });
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

  test("REACHES PRODUCTS PAST THE FIRST PAGE", async () => {
    // The bug this replaced: one page of rows was read and the rest of the
    // catalogue was never looked at, so a shop's 201st product could not be
    // filled in no matter how many times the sweep ran.
    const products = Array.from({ length: 250 }, (_, i) => ({
      id: `p${String(i).padStart(3, "0")}`,
      name: `Trike ${i}`,
      colors: [],
      description: "Colors: Black, Red",
    }));
    const { db } = fakeDb({ products });
    const result = await syncProductColors(db, { limit: Infinity, pageSize: 100 });
    assert.equal(result.updated, 250);
    assert.equal(
      products.filter((p) => (p.colors as unknown[]).length > 0).length,
      250,
      "some products were never reached"
    );
  });

  test("the write cap bounds WRITES, not what it looks at", async () => {
    // The cron passes a small cap to stay inside its time budget. The report
    // still has to describe the whole catalogue, or it would tell the owner
    // their shop is smaller than it is.
    const products = Array.from({ length: 30 }, (_, i) => ({
      id: `p${String(i).padStart(3, "0")}`,
      name: `Trike ${i}`,
      colors: [],
      description: "Colors: Black",
    }));
    const { db } = fakeDb({ products });
    const result = await syncProductColors(db, { limit: 5, pageSize: 10 });
    assert.equal(result.updated, 5);
    assert.equal(result.scanned, 30, "it stopped counting when it stopped writing");
  });

  test("reports which products still have no colours anywhere", async () => {
    // The useful half of the report: the owner can only add a Colors: line to
    // a product sheet if they know which sheet is missing one.
    const products = [
      { id: "p1", name: "Volt S1", colors: [], description: "Colors: Black" },
      { id: "p2", name: "Hub Motor", colors: [], description: "A 3000W hub motor." },
      { id: "p3", name: "Helmet", colors: [{ name: "Matte White", hex: null }], description: "" },
    ];
    const { db } = fakeDb({ products });
    const result = await syncProductColors(db, { limit: Infinity });
    assert.equal(result.updated, 1);
    assert.equal(result.alreadyHad, 1);
    assert.deepEqual(result.missing, ["Hub Motor"]);
  });

  test("falls back to the id when a product has no name", async () => {
    const products = [{ id: "p9", name: null, colors: [], description: "no colours here" }];
    const { db } = fakeDb({ products });
    assert.deepEqual((await syncProductColors(db, {})).missing, ["p9"]);
  });
});

/* -------------------------------------------------------------------------- */
/* What three a week for two months made necessary                             */
/* -------------------------------------------------------------------------- */

/**
 * The old sequence was four emails about an order the recipient placed days
 * earlier — transactional, and nobody needed an escape hatch from it. Twenty-
 * four over two months carrying a product offer is marketing, and the rules
 * below are what stop that becoming a spam complaint.
 *
 * A spam complaint is not just a lost sale. It is scored against the sending
 * DOMAIN, which is the same domain the order confirmations leave on — so the
 * downside of getting this wrong is paying customers not hearing that their
 * money arrived, on a domain already carrying an ISP blocklist entry.
 */
describe("the safeguards the long sequence needs", () => {
  test("SOMEBODY WHO UNSUBSCRIBED IS NEVER WRITTEN TO AGAIN", async () => {
    const { db } = fakeDb({
      orders: [order({ created_at: daysAgo(2) })],
      email_opt_outs: [{ email: "rider@example.com" }],
    });
    const result = await sweepAbandonedOrders(db, { now: NOW });
    assert.equal(result.emailed, 0);
    assert.equal(result.skipped.opted_out, 1);
    assert.equal(sentTo.length, 0);
  });

  test("an opt-out matches however the address was capitalised", async () => {
    const { db } = fakeDb({
      orders: [order({ created_at: daysAgo(2), email: "Rider@Example.COM" })],
      email_opt_outs: [{ email: "rider@example.com" }],
    });
    assert.equal((await sweepAbandonedOrders(db, { now: NOW })).emailed, 0);
  });

  test("IT FAILS CLOSED WHEN THE OPT-OUT LIST CANNOT BE READ", async () => {
    // Not knowing who unsubscribed is not the same as nobody having
    // unsubscribed, and mailing someone who opted out is the single mistake
    // this whole mechanism exists to prevent.
    const { db } = fakeDb({ orders: [order({ created_at: daysAgo(2) })] });
    const broken = {
      from: (name: string) =>
        name === "email_opt_outs"
          ? {
              select: () => ({
                in: () => Promise.resolve({ data: null, error: { message: "boom" } }),
              }),
            }
          : (db as unknown as { from: (n: string) => unknown }).from(name),
    } as never;
    const result = await sweepAbandonedOrders(broken, { now: NOW });
    assert.equal(result.emailed, 0);
    assert.equal(result.skipped.opted_out, 1);
    assert.equal(sentTo.length, 0);
  });

  test("ONE EMAIL PER PERSON PER RUN, NOT ONE PER ORDER", async () => {
    // A buyer with three pending orders is still one person. Three of these on
    // the same morning is the fastest route from campaign to spam complaint.
    const { db } = fakeDb([
      order({ id: "o1", created_at: daysAgo(2), order_number: "ED-1" }),
      order({ id: "o2", created_at: daysAgo(2), order_number: "ED-2" }),
      order({ id: "o3", created_at: daysAgo(2), order_number: "ED-3" }),
    ]);
    const result = await sweepAbandonedOrders(db, { now: NOW });
    assert.equal(sentTo.length, 1, `wrote ${sentTo.length} times to one person`);
    assert.equal(result.skipped.already_written_to_this_run, 2);
  });

  test("but two different people both hear", async () => {
    const { db } = fakeDb([
      order({ id: "o1", created_at: daysAgo(2), email: "a@example.com" }),
      order({ id: "o2", created_at: daysAgo(2), email: "b@example.com" }),
    ]);
    await sweepAbandonedOrders(db, { now: NOW });
    assert.deepEqual(sentTo.map((m) => m.to).sort(), ["a@example.com", "b@example.com"]);
  });

  test("NOTHING IS SENT AT ALL IF NO UNSUBSCRIBE LINK CAN BE BUILT", async () => {
    // Marketing email without a working opt-out is a legal problem in three
    // jurisdictions and a deliverability problem everywhere. Refusing to send
    // is the only safe failure.
    delete process.env.INTERNAL_API_KEY;
    const { db } = fakeDb([order({ created_at: daysAgo(2) })]);
    const result = await sweepAbandonedOrders(db, { now: NOW });
    assert.equal(sentTo.length, 0, "it sent marketing mail with no way out of it");
    assert.equal(result.skipped.send_failed, 1);
  });

  test("every email carries the unsubscribe link and the one-click headers", async () => {
    const { db } = fakeDb([order({ created_at: daysAgo(2) })]);
    let sent: Record<string, unknown> = {};
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      if (String(url).includes("api.resend.com")) {
        sent = JSON.parse(String(init?.body ?? "{}"));
      }
      return new Response(JSON.stringify({ id: "s" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    await sweepAbandonedOrders(db, { now: NOW });
    assert.match(String(sent.html), /\/unsubscribe\?/, "no unsubscribe link in the body");
    const headers = sent.headers as Record<string, string> | undefined;
    assert.ok(headers?.["List-Unsubscribe"], "no List-Unsubscribe header");
    assert.equal(headers?.["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  });
});

describe("the offer the campaign carries", () => {
  const SOLD = (productId: string, qty: number) => ({
    product_id: productId,
    qty,
    orders: { status: "paid", created_at: daysAgo(10) },
  });

  const PRODUCT = {
    id: "p-top",
    name: "VOLTAGE DRIFT",
    slug: "voltage-drift",
    status: "active",
    stock: 4,
    price_cents: 189900,
    compare_at_cents: 219900,
    hero_image: "/assets/trike-voltage-blue.jpg",
    tagline: "The one most riders land on",
  };

  test("THE BEST SELLER IS COUNTED, NOT THE FEATURED FLAG", async () => {
    const { db } = fakeDb({
      orders: [order({ created_at: daysAgo(7) })],
      order_items: [SOLD("p-other", 1), SOLD("p-top", 9)],
      products: [PRODUCT, { ...PRODUCT, id: "p-other", name: "DIRT RIPPER", featured: true }],
    });
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
    assert.match(html, /Our best seller/i);
    assert.match(html, /VOLTAGE DRIFT/);
    assert.ok(!html.includes("DIRT RIPPER"), "it promoted the featured one, not the best-selling one");
  });

  test("a genuine reduction is shown; a fictional one is not", async () => {
    const { db } = fakeDb({
      orders: [order({ created_at: daysAgo(7) })],
      order_items: [SOLD("p-top", 9)],
      products: [PRODUCT],
    });
    let html = "";
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      if (String(url).includes("api.resend.com")) {
        html = JSON.parse(String(init?.body ?? "{}")).html ?? "";
      }
      return new Response(JSON.stringify({ id: "s" }), { status: 200 });
    }) as typeof fetch;

    await sweepAbandonedOrders(db, { now: NOW });
    // formatMoney drops ".00" on a whole amount, which is what the rest of the
    // store shows — the email must not invent a different convention.
    assert.match(html, /\$1,899\b/, "the real price is missing");
    assert.match(html, /\$2,199\b/, "the compare-at price is missing");
    assert.match(html, /line-through/, "the old price is not struck through");
  });

  test("THE FIRST TWO EMAILS CARRY NO OFFER", async () => {
    // They go out while the decision is still live. Leading with a different
    // product then is answering a question nobody asked.
    const { db } = fakeDb({
      orders: [order({ created_at: daysAgo(2) })],
      order_items: [SOLD("p-top", 9)],
      products: [PRODUCT],
    });
    let html = "";
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      if (String(url).includes("api.resend.com")) {
        html = JSON.parse(String(init?.body ?? "{}")).html ?? "";
      }
      return new Response(JSON.stringify({ id: "s" }), { status: 200 });
    }) as typeof fetch;

    await sweepAbandonedOrders(db, { now: NOW });
    assert.ok(!/Our best seller/i.test(html), "the first reminder led with a different product");
  });

  test("a sold-out best seller is not promoted at all", async () => {
    // A two-month campaign pointing at a dead end is worse than no offer: the
    // offer is the part of the email that asks the reader to click.
    const { db } = fakeDb({
      orders: [order({ created_at: daysAgo(7) })],
      order_items: [SOLD("p-top", 9)],
      products: [{ ...PRODUCT, stock: 0 }],
    });
    let html = "";
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      if (String(url).includes("api.resend.com")) {
        html = JSON.parse(String(init?.body ?? "{}")).html ?? "";
      }
      return new Response(JSON.stringify({ id: "s" }), { status: 200 });
    }) as typeof fetch;

    await sweepAbandonedOrders(db, { now: NOW });
    assert.ok(html.length > 0, "nothing was sent at all");
    assert.ok(!/Our best seller/i.test(html), "it promoted a sold-out product");
  });

  test("a shop that has sold nothing still sends a readable email", async () => {
    const { db } = fakeDb({ orders: [order({ created_at: daysAgo(7) })] });
    let html = "";
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      if (String(url).includes("api.resend.com")) {
        html = JSON.parse(String(init?.body ?? "{}")).html ?? "";
      }
      return new Response(JSON.stringify({ id: "s" }), { status: 200 });
    }) as typeof fetch;

    const result = await sweepAbandonedOrders(db, { now: NOW });
    assert.equal(result.emailed, 1);
    assert.ok(!/undefined|\[object/.test(html), "a hole where the product name went");
  });
});
