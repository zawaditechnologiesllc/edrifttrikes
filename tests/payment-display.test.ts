import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  PAYMENT_SOURCES,
  METHOD_LABEL,
  REFERENCE_LABEL,
  SOURCE_LABEL,
  customerPaymentLine,
  formatPaidAt,
  gatewayReference,
  methodLabel,
  paymentRows,
  paymentSource,
  referenceLabel,
  sourceLabel,
} from "../lib/payment-display";
import type { Order } from "../lib/types";

/**
 * How a payment is described, everywhere it is described.
 *
 * These tests exist because the same payment used to be phrased four different
 * ways on four screens. The load-bearing assertions are the ones that check
 * every source is covered and that the admin's depth never leaks to the buyer.
 */

const order = (over: Partial<Order> = {}): Order =>
  ({
    id: "o1",
    order_number: "EDT-7A3F91C2",
    user_id: null,
    email: "rider@example.com",
    status: "paid",
    subtotal_cents: 389800,
    shipping_cents: 5000,
    tax_cents: 31584,
    total_cents: 426384,
    currency: "usd",
    shipping_address: null,
    stripe_session_id: null,
    paid_at: "2026-03-03T14:07:00.000Z",
    paid_via: "stripe",
    gateway_reference: "cs_live_a1b2c3",
    created_at: "2026-03-03T13:50:00.000Z",
    updated_at: "2026-03-03T14:07:00.000Z",
    ...over,
  }) as Order;

describe("naming a payment source", () => {
  test("every source has all three labels", () => {
    // A provider added to the list but missed in a map is how "Authorizenet"
    // ended up on a screen in the first place.
    for (const source of PAYMENT_SOURCES) {
      assert.ok(SOURCE_LABEL[source], `${source} has no badge label`);
      assert.ok(METHOD_LABEL[source], `${source} has no method label`);
      assert.ok(REFERENCE_LABEL[source], `${source} has no reference label`);
    }
  });

  test("authorizenet is never shown raw", () => {
    const o = order({ paid_via: "authorizenet" });
    assert.equal(methodLabel(o), "Card (Authorize.Net)");
    assert.equal(sourceLabel(o), "Authorize.Net");
    assert.equal(referenceLabel(o), "Transaction ID");
  });

  test("the reference is named for the system that issued it", () => {
    assert.equal(referenceLabel(order({ paid_via: "stripe" })), "Checkout session");
    assert.equal(referenceLabel(order({ paid_via: "paypal" })), "PayPal order");
    assert.equal(
      referenceLabel(order({ paid_via: "authorizenet" })),
      "Transaction ID"
    );
  });

  test("an unrecorded source says so rather than inventing one", () => {
    // Orders paid before migration 0007 have no source, and reconciling
    // takings depends on telling that apart from a known one.
    const o = order({ paid_via: null });
    assert.equal(paymentSource(o), null);
    assert.equal(methodLabel(o), "Not recorded");
    assert.equal(sourceLabel(o), "Unknown");
  });

  test("an unknown value is not passed through to the screen", () => {
    const o = order({ paid_via: "sepa" });
    assert.equal(paymentSource(o), null);
    assert.equal(methodLabel(o), "Not recorded");
  });

  test("case and padding do not create a second unknown source", () => {
    assert.equal(paymentSource(order({ paid_via: " AuthorizeNet " })), "authorizenet");
  });
});

describe("the gateway reference", () => {
  test("prefers the honest column", () => {
    const o = order({
      gateway_reference: "60115585081",
      stripe_session_id: "cs_old",
    });
    assert.equal(gatewayReference(o), "60115585081");
  });

  test("falls back for orders predating migration 0018", () => {
    // stripe_session_id carried every provider's id before 0018 split them.
    const o = order({ gateway_reference: null, stripe_session_id: "cs_live_x" });
    assert.equal(gatewayReference(o), "cs_live_x");
  });

  test("null when there is genuinely none", () => {
    const o = order({ gateway_reference: null, stripe_session_id: null });
    assert.equal(gatewayReference(o), null);
    // Empty strings are not references either.
    assert.equal(gatewayReference(order({ gateway_reference: "  ", stripe_session_id: "" })), null);
  });
});

describe("the admin's full record", () => {
  test("an Authorize.Net payment reports all four facts", () => {
    const rows = paymentRows(
      order({
        paid_via: "authorizenet",
        gateway_reference: "60115585081",
        gateway_account: "5KP3u95bQpv",
      })
    );
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.value]));
    assert.equal(byLabel["Method"], "Card (Authorize.Net)");
    assert.equal(byLabel["Transaction ID"], "60115585081");
    assert.equal(byLabel["Gateway account"], "5KP3u95bQpv");
    assert.match(byLabel["Paid"], /3 March 2026/);
  });

  test("the gateway account explains itself", () => {
    // It looks like noise until you know a refund has to go back through it.
    const rows = paymentRows(order({ gateway_account: "5KP3u95bQpv" }));
    const account = rows.find((r) => r.label === "Gateway account");
    assert.ok(account?.hint);
    assert.match(account.hint, /refund/i);
  });

  test("ids are flagged for breakable rendering", () => {
    const rows = paymentRows(order({ gateway_account: "acct" }));
    for (const label of ["Checkout session", "Gateway account"]) {
      assert.equal(rows.find((r) => r.label === label)?.mono, true, label);
    }
    assert.notEqual(rows.find((r) => r.label === "Method")?.mono, true);
  });

  test("an unpaid order says the payment has not cleared", () => {
    const rows = paymentRows(
      order({ status: "pending", paid_at: null, paid_via: null })
    );
    assert.match(rows.find((r) => r.label === "Paid")?.value ?? "", /not/i);
  });

  test("nothing known means no panel at all", () => {
    // An empty heading over an empty list reads as a bug.
    const rows = paymentRows(
      order({
        paid_via: null,
        paid_at: null,
        gateway_reference: null,
        stripe_session_id: null,
        gateway_account: null,
        status: "paid",
      })
    );
    assert.deepEqual(rows, []);
  });

  test("the paid time carries a clock, not just a date", () => {
    // Several orders a day is the goal; the time is what matches a row here to
    // a row in the gateway's own dashboard.
    assert.match(formatPaidAt("2026-03-03T14:07:00.000Z"), /14:07/);
    assert.match(formatPaidAt("2026-03-03T14:07:00.000Z"), /3 March 2026/);
  });

  test("a broken timestamp is a dash, not 'Invalid Date'", () => {
    assert.equal(formatPaidAt("not-a-date"), "—");
    assert.equal(formatPaidAt(null), "—");
    assert.equal(formatPaidAt(undefined), "—");
  });
});

describe("what the buyer is told", () => {
  test("card gateways read as 'by card', not by brand", () => {
    // Which processor took it is the store's business. The buyer asked whether
    // their card went through.
    for (const via of ["stripe", "authorizenet"]) {
      assert.match(customerPaymentLine(order({ paid_via: via }))!, /Paid by card on/);
    }
  });

  test("PayPal is named, because the buyer chose it by name", () => {
    assert.match(customerPaymentLine(order({ paid_via: "paypal" }))!, /with PayPal/);
  });

  test("NO GATEWAY IDS OR ACCOUNTS EVER REACH THE BUYER", () => {
    // The whole reason this is a separate function from paymentRows.
    for (const via of [...PAYMENT_SOURCES, null, "sepa"]) {
      const line = customerPaymentLine(
        order({
          paid_via: via,
          gateway_reference: "cs_live_SECRETREF",
          gateway_account: "5KP3u95bQpv",
        })
      );
      if (!line) continue;
      assert.ok(!line.includes("SECRETREF"), `${via} leaked the reference`);
      assert.ok(!line.includes("5KP3u95bQpv"), `${via} leaked the account`);
    }
  });

  test("a manual payment does not guess at a method", () => {
    // Manual covers bank transfer, cash on collection and a gateway that never
    // called back. Picking one for the buyer's receipt would be a fiction.
    const line = customerPaymentLine(order({ paid_via: "manual" }))!;
    assert.match(line, /Payment received on/);
    assert.doesNotMatch(line, /card|paypal/i);
  });

  test("an unpaid order gets no payment line at all", () => {
    assert.equal(
      customerPaymentLine(order({ status: "pending", paid_at: null })),
      null
    );
  });

  test("a cancelled or refunded order does not still claim to be paid", () => {
    for (const status of ["cancelled", "refunded"] as const) {
      assert.equal(customerPaymentLine(order({ status })), null, status);
    }
  });
});
