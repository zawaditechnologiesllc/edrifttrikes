import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  describeOrphan,
  emptyReport,
  matchOrderForSession,
  reconcileStripePayments,
  repairDecision,
  sessionEmail,
  sessionIsPaid,
  sessionReference,
  summarizeSync,
  type OrderLike,
  type SessionLike,
} from "../lib/order-sync";

/**
 * Reconciling what Stripe took with what the shop recorded.
 *
 * THE FAILURE: the order row is created before the buyer reaches the payment
 * page, and the webhook turns it from `pending` into `paid` afterwards. Break
 * that chain and the money still arrives, the row still exists, but the
 * transition is lost — the order sits pending for ever, out of Paid Orders and
 * out of the revenue figure, while Stripe shows a perfectly good payment.
 *
 * This module decides which orders to repair. Two properties matter more than
 * anything else here, because both failures are expensive in the same
 * direction — they move money that nobody paid:
 *
 *   1. an order is marked paid ONLY on `payment_status: "paid"`;
 *   2. a session is matched to an order by its ID, never by its buyer's email,
 *      because one buyer can have several orders and the wrong one would be
 *      marked paid, shipped and scheduled.
 */

const session = (over: Partial<SessionLike> = {}): SessionLike => ({
  id: "cs_test_abc",
  payment_status: "paid",
  status: "complete",
  amount_total: 189900,
  currency: "usd",
  created: 1_790_000_000,
  customer_details: { email: "Rider@Example.com" },
  payment_intent: "pi_3Qabc",
  metadata: { order_id: "o-1", order_number: "EDT-AAAA1111" },
  ...over,
});

const order = (over: Partial<OrderLike> = {}): OrderLike => ({
  id: "o-1",
  order_number: "EDT-AAAA1111",
  status: "pending",
  email: "rider@example.com",
  total_cents: 189900,
  stripe_session_id: "cs_test_abc",
  ...over,
});

describe("has the money actually arrived", () => {
  test("only payment_status 'paid' counts", () => {
    assert.equal(sessionIsPaid(session({ payment_status: "paid" })), true);
  });

  test("everything else does not", () => {
    for (const status of ["unpaid", "no_payment_required", "", null, undefined]) {
      assert.equal(
        sessionIsPaid(session({ payment_status: status as string })),
        false,
        String(status)
      );
    }
  });

  test("a COMPLETE session is not the same as a paid one", () => {
    // The session's `status` says the page was finished; `payment_status` says
    // whether money moved. Confusing the two marks unpaid orders as paid.
    assert.equal(
      sessionIsPaid(session({ status: "complete", payment_status: "unpaid" })),
      false
    );
  });

  test("'no_payment_required' is never money", () => {
    assert.equal(sessionIsPaid(session({ payment_status: "no_payment_required" })), false);
  });
});

describe("which order a payment belongs to", () => {
  const orders = [
    order({ id: "o-1", order_number: "EDT-AAAA1111" }),
    order({ id: "o-2", order_number: "EDT-BBBB2222", stripe_session_id: "cs_test_two" }),
  ];

  test("by the order id the checkout wrote into metadata", () => {
    const hit = matchOrderForSession(session({ metadata: { order_id: "o-2" } }), orders);
    assert.equal(hit?.id, "o-2");
  });

  test("by the order number when the id is absent", () => {
    const hit = matchOrderForSession(
      session({ metadata: { order_number: "EDT-BBBB2222" } }),
      orders
    );
    assert.equal(hit?.id, "o-2");
  });

  test("by the reference recorded on the order, for a manual one", () => {
    const manual = [
      order({ id: "o-9", order_number: "INV-7", stripe_session_id: null, gateway_reference: "pi_3Qxyz" }),
    ];
    const hit = matchOrderForSession(
      session({ metadata: {}, payment_intent: "pi_3Qxyz", id: "cs_unknown" }),
      manual
    );
    assert.equal(hit?.id, "o-9");
  });

  test("EMAIL IS NEVER A MATCH", () => {
    // One buyer, two orders. Matching on the address would mark whichever came
    // first paid — and ship it.
    const twoForOneBuyer = [
      order({ id: "o-a", order_number: "A", email: "rider@example.com", stripe_session_id: null }),
      order({ id: "o-b", order_number: "B", email: "rider@example.com", stripe_session_id: null }),
    ];
    const hit = matchOrderForSession(
      session({ metadata: {}, payment_intent: null, id: "cs_nothing_matches" }),
      twoForOneBuyer
    );
    assert.equal(hit, null);
  });

  test("an unmatched payment is null, not a guess", () => {
    assert.equal(
      matchOrderForSession(session({ metadata: {}, id: "cs_zzz", payment_intent: "pi_zzz" }), orders),
      null
    );
  });

  test("metadata for an order that no longer exists does not fall through to a wrong one", () => {
    const hit = matchOrderForSession(
      session({ metadata: { order_id: "deleted" }, id: "cs_gone", payment_intent: "pi_gone" }),
      orders
    );
    assert.equal(hit, null);
  });
});

describe("whether to repair an order", () => {
  test("a pending order with a paid session is repaired", () => {
    const d = repairDecision(order({ status: "pending" }), session());
    assert.equal(d.act, true);
  });

  test("an unpaid session never repairs anything, and says why", () => {
    const d = repairDecision(order({ status: "pending" }), session({ payment_status: "unpaid" }));
    assert.equal(d.act, false);
    assert.match(d.reason, /payment_status="unpaid"/);
  });

  test("ALREADY SETTLED ORDERS ARE LEFT ALONE", () => {
    // Re-running the sync must be a no-op, and a refunded order must never be
    // walked back to paid by a payment that is still sitting in Stripe.
    for (const status of ["paid", "fulfilled", "cancelled", "refunded"]) {
      const d = repairDecision(order({ status }), session());
      assert.equal(d.act, false, status);
      assert.match(d.reason, new RegExp(`already ${status}`));
    }
  });

  test("status casing does not let a settled order through", () => {
    assert.equal(repairDecision(order({ status: "REFUNDED" }), session()).act, false);
  });
});

describe("reading a payment for the report", () => {
  test("the reference prefers the PaymentIntent", () => {
    assert.equal(sessionReference(session()), "pi_3Qabc");
    assert.equal(sessionReference(session({ payment_intent: { id: "pi_obj" } })), "pi_obj");
  });

  test("and falls back to the session id", () => {
    assert.equal(sessionReference(session({ payment_intent: null })), "cs_test_abc");
  });

  test("the email is lower-cased from either place Stripe puts it", () => {
    assert.equal(sessionEmail(session()), "rider@example.com");
    assert.equal(
      sessionEmail(session({ customer_details: null, customer_email: "A@B.COM" })),
      "a@b.com"
    );
  });

  test("an orphan carries what is needed to type the order in by hand", () => {
    const o = describeOrphan(session());
    assert.equal(o.amountCents, 189900);
    assert.equal(o.currency, "usd");
    assert.equal(o.email, "rider@example.com");
    assert.equal(o.reference, "pi_3Qabc");
    assert.equal(o.paidAt, new Date(1_790_000_000 * 1000).toISOString());
  });
});

describe("what the admin is told", () => {
  test("nothing wrong reads as reassurance, not as failure", () => {
    const text = summarizeSync({ ...emptyReport(), scanned: 12, matched: 12, alreadyPaid: 12 });
    assert.match(text, /Checked 12 Stripe payments/);
    assert.match(text, /No order was waiting/);
  });

  test("repairs are named, so they can be checked", () => {
    const text = summarizeSync({
      ...emptyReport(),
      scanned: 5,
      matched: 5,
      repaired: ["EDT-AAAA1111", "EDT-BBBB2222"],
    });
    assert.match(text, /Marked 2 orders paid: EDT-AAAA1111, EDT-BBBB2222/);
  });

  test("a payment with no order points at the fix", () => {
    const text = summarizeSync({
      ...emptyReport(),
      scanned: 3,
      orphans: [describeOrphan(session())],
    });
    assert.match(text, /1 payment has no order at all/);
    assert.match(text, /New order/);
  });

  test("being blocked is reported as itself, not as a clean run", () => {
    const text = summarizeSync({ ...emptyReport(), blocked: "Stripe is not configured" });
    assert.equal(text, "Stripe is not configured");
  });

  test("singular and plural both read correctly", () => {
    assert.match(summarizeSync({ ...emptyReport(), scanned: 1 }), /Checked 1 Stripe payment\./);
    assert.match(
      summarizeSync({ ...emptyReport(), scanned: 2, repaired: ["X"] }),
      /Marked 1 order paid/
    );
  });
});

/**
 * The runner itself — shared by the admin button and the hourly scheduler.
 *
 * It is on the scheduler because a repair that only happens when somebody
 * remembers to click is not a guarantee. A webhook outage, a rate-limited
 * hour, a deploy at the wrong moment: all of it has to heal whether or not
 * anyone is watching.
 */
describe("running the reconciliation", () => {
  /** A Supabase stand-in: one `from("orders").select(...)` chain. */
  function fakeAdmin(rows: OrderLike[], opts: { failFullSelect?: boolean; failAll?: boolean } = {}) {
    const selects: string[] = [];
    return {
      selects,
      admin: {
        from: () => ({
          select(columns: string) {
            selects.push(columns);
            const failing =
              opts.failAll || (opts.failFullSelect && columns.includes("gateway_reference"));
            const result = failing
              ? { data: null, error: { message: 'column "gateway_reference" does not exist' } }
              : { data: rows, error: null };
            const chain = {
              order: () => chain,
              limit: () => Promise.resolve(result),
            };
            return chain;
          },
        }),
      },
    };
  }

  const paidSession = (id: string, orderId: string | null, amount = 1000): SessionLike => ({
    id,
    payment_status: "paid",
    status: "complete",
    amount_total: amount,
    currency: "usd",
    created: 1_790_000_000,
    customer_details: { email: "buyer@example.com" },
    payment_intent: `pi_${id}`,
    metadata: orderId ? { order_id: orderId } : ({} as Record<string, string>),
  });

  test("REPAIRS THE ORDERS STRIPE HAD ALREADY PAID", async () => {
    const rows = [order({ id: "o-1", order_number: "A", status: "pending" })];
    const marked: string[] = [];
    const report = await reconcileStripePayments({
      admin: fakeAdmin(rows).admin,
      listSessions: async () => ({ data: [paidSession("cs_1", "o-1")], has_more: false }),
      markPaid: async (id) => {
        marked.push(id);
        return { ok: true };
      },
    });
    assert.deepEqual(report.repaired, ["A"]);
    assert.deepEqual(marked, ["o-1"]);
  });

  test("EMAIL IS OFF unless the caller asks for it", async () => {
    // The scheduler must never email: these payments are hours or days old and
    // a confirmation out of nowhere reads as a second charge.
    const seen: boolean[] = [];
    await reconcileStripePayments({
      admin: fakeAdmin([order({ id: "o-1", order_number: "A", status: "pending" })]).admin,
      listSessions: async () => ({ data: [paidSession("cs_1", "o-1")], has_more: false }),
      markPaid: async (_id, opts) => {
        seen.push(opts.sendEmail);
        return { ok: true };
      },
    });
    assert.deepEqual(seen, [false]);
  });

  test("and it is passed through when it is asked for", async () => {
    const seen: boolean[] = [];
    await reconcileStripePayments({
      admin: fakeAdmin([order({ id: "o-1", order_number: "A", status: "pending" })]).admin,
      listSessions: async () => ({ data: [paidSession("cs_1", "o-1")], has_more: false }),
      markPaid: async (_id, opts) => {
        seen.push(opts.sendEmail);
        return { ok: true };
      },
      sendEmail: true,
    });
    assert.deepEqual(seen, [true]);
  });

  test("an unpaid session repairs nothing", async () => {
    let called = 0;
    const report = await reconcileStripePayments({
      admin: fakeAdmin([order({ id: "o-1", order_number: "A", status: "pending" })]).admin,
      listSessions: async () => ({
        data: [{ ...paidSession("cs_1", "o-1"), payment_status: "unpaid" }],
        has_more: false,
      }),
      markPaid: async () => {
        called++;
        return { ok: true };
      },
    });
    assert.equal(called, 0);
    assert.deepEqual(report.repaired, []);
  });

  test("a payment with no order is reported, never created", async () => {
    const report = await reconcileStripePayments({
      admin: fakeAdmin([]).admin,
      listSessions: async () => ({ data: [paidSession("cs_x", null, 25900)], has_more: false }),
      markPaid: async () => ({ ok: true }),
    });
    assert.equal(report.orphans.length, 1);
    assert.equal(report.orphans[0].amountCents, 25900);
    assert.deepEqual(report.repaired, []);
  });

  test("ONE ORDER IS NEVER REPAIRED TWICE IN A RUN", async () => {
    // Two paid sessions against the same order — a retried checkout. The
    // second must be counted as already paid, not marked again.
    const rows = [order({ id: "o-1", order_number: "A", status: "pending" })];
    let calls = 0;
    const report = await reconcileStripePayments({
      admin: fakeAdmin(rows).admin,
      listSessions: async () => ({
        data: [paidSession("cs_1", "o-1"), paidSession("cs_2", "o-1")],
        has_more: false,
      }),
      markPaid: async () => {
        calls++;
        return { ok: true };
      },
    });
    assert.equal(calls, 1);
    assert.equal(report.repaired.length, 1);
    assert.equal(report.alreadyPaid, 1);
  });

  test("a failed transition is reported, and the run continues", async () => {
    const rows = [
      order({ id: "o-1", order_number: "A", status: "pending" }),
      order({ id: "o-2", order_number: "B", status: "pending", stripe_session_id: "cs_2" }),
    ];
    const report = await reconcileStripePayments({
      admin: fakeAdmin(rows).admin,
      listSessions: async () => ({
        data: [paidSession("cs_1", "o-1"), paidSession("cs_2", "o-2")],
        has_more: false,
      }),
      markPaid: async (id) =>
        id === "o-1" ? { ok: false, reason: "order_refunded" } : { ok: true },
    });
    assert.deepEqual(report.repaired, ["B"]);
    assert.deepEqual(report.problems, ["A: order_refunded"]);
  });

  test("a database without migration 0018 still reconciles", async () => {
    // gateway_reference does not exist there, and the whole select fails on it.
    // Dropping that one column beats dropping the repair.
    const fake = fakeAdmin([order({ id: "o-1", order_number: "A", status: "pending" })], {
      failFullSelect: true,
    });
    const report = await reconcileStripePayments({
      admin: fake.admin,
      listSessions: async () => ({ data: [paidSession("cs_1", "o-1")], has_more: false }),
      markPaid: async () => ({ ok: true }),
    });
    assert.deepEqual(report.repaired, ["A"]);
    assert.equal(fake.selects.length, 2, "it should have retried without the column");
    assert.ok(fake.selects[1].includes("gateway_reference") === false);
  });

  test("an unreadable orders table is reported, not silently empty", async () => {
    const report = await reconcileStripePayments({
      admin: fakeAdmin([], { failAll: true }).admin,
      listSessions: async () => ({ data: [], has_more: false }),
      markPaid: async () => ({ ok: true }),
    });
    assert.match(report.blocked ?? "", /Could not read orders/);
  });

  test("Stripe being unreachable is reported, not treated as 'nothing to do'", async () => {
    const report = await reconcileStripePayments({
      admin: fakeAdmin([]).admin,
      listSessions: async () => {
        throw new Error("connection reset");
      },
      markPaid: async () => ({ ok: true }),
    });
    assert.match(report.blocked ?? "", /Stripe refused the request/);
    assert.match(summarizeSync(report), /Stripe refused/);
  });

  test("paging stops at the limit rather than walking Stripe for ever", async () => {
    let pages = 0;
    await reconcileStripePayments({
      admin: fakeAdmin([]).admin,
      listSessions: async () => {
        pages++;
        return { data: [paidSession(`cs_${pages}`, null)], has_more: true };
      },
      markPaid: async () => ({ ok: true }),
      maxPages: 3,
    });
    assert.equal(pages, 3);
  });

  test("a run with nothing to fix writes nothing at all", async () => {
    let calls = 0;
    const report = await reconcileStripePayments({
      admin: fakeAdmin([order({ id: "o-1", order_number: "A", status: "paid" })]).admin,
      listSessions: async () => ({ data: [paidSession("cs_1", "o-1")], has_more: false }),
      markPaid: async () => {
        calls++;
        return { ok: true };
      },
    });
    assert.equal(calls, 0);
    assert.equal(report.alreadyPaid, 1);
    assert.match(summarizeSync(report), /No order was waiting/);
  });
});
