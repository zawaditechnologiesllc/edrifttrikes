import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  requestThreeDSecure,
  THREE_DS_VALUE_THRESHOLD_CENTS,
} from "../lib/stripe-fulfillment";

/**
 * When to ask the issuing bank to verify its own cardholder.
 *
 * 3-D Secure is the one control that moves liability for a fraudulent
 * chargeback off the merchant and onto the issuer. Getting the policy wrong in
 * either direction is expensive: too little and four-figure chargebacks land on
 * the account's fraud rate, too much and ordinary buyers meet a bank prompt on
 * a small order.
 */

describe("expensive orders are verified", () => {
  test("a crated trike is well over the line", () => {
    assert.equal(
      requestThreeDSecure({ totalCents: 426384, riskLevel: "clear" }),
      "any"
    );
  });

  test("the threshold itself is included", () => {
    assert.equal(
      requestThreeDSecure({ totalCents: THREE_DS_VALUE_THRESHOLD_CENTS, riskLevel: "clear" }),
      "any"
    );
  });

  test("a small clean order is left to Stripe's own judgement", () => {
    // Friction on a $40 accessory buys nothing and costs conversions.
    assert.equal(
      requestThreeDSecure({ totalCents: 4000, riskLevel: "clear" }),
      "automatic"
    );
  });
});

describe("our own origin checks finally do something", () => {
  /**
   * lib/risk.ts has always flagged Tor, VPN and hosting networks, timezone
   * mismatches and country mismatches — and the result was written to the order
   * and then ignored. Every payment went to Stripe identically.
   */
  test("a flagged origin is verified at ANY value", () => {
    for (const level of ["review", "high"]) {
      assert.equal(
        requestThreeDSecure({ totalCents: 500, riskLevel: level }),
        "any",
        `risk level ${level} was not verified`
      );
    }
  });

  test("a clear origin on a small order is not", () => {
    assert.equal(requestThreeDSecure({ totalCents: 500, riskLevel: "clear" }), "automatic");
  });

  test("case and padding do not let a flag slip through", () => {
    assert.equal(requestThreeDSecure({ totalCents: 500, riskLevel: " HIGH " }), "any");
  });
});

describe("failing safe", () => {
  test("an unknown or missing risk level still respects the value rule", () => {
    // Orders placed before migration 0015 have no risk level at all.
    for (const level of [null, undefined, "", "banana"]) {
      assert.equal(
        requestThreeDSecure({ totalCents: 426384, riskLevel: level }),
        "any",
        `level ${String(level)} lost the value rule`
      );
      assert.equal(
        requestThreeDSecure({ totalCents: 500, riskLevel: level }),
        "automatic",
        `level ${String(level)} over-verified a small order`
      );
    }
  });

  test("a nonsense total does not throw or force verification", () => {
    assert.equal(
      requestThreeDSecure({ totalCents: Number.NaN, riskLevel: "clear" }),
      "automatic"
    );
  });

  test("only ever returns a value Stripe accepts", () => {
    // A bad string here is a rejected session, which is a lost sale.
    const allowed = new Set(["any", "automatic"]);
    for (const totalCents of [0, 500, 99_999, 100_000, 9_999_999, Number.NaN]) {
      for (const riskLevel of ["clear", "review", "high", null, "nonsense"]) {
        assert.ok(
          allowed.has(requestThreeDSecure({ totalCents, riskLevel })),
          `${totalCents}/${riskLevel}`
        );
      }
    }
  });
});
