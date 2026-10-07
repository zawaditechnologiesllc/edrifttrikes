import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  describeOrphan,
  emptyReport,
  matchOrderForSession,
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
