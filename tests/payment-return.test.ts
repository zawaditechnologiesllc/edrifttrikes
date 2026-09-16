import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { confirmationView, checkoutNotice } from "../lib/payment-return";

/**
 * What the buyer is told when a gateway hands them back.
 *
 * The property that matters most is negative: a query parameter the buyer
 * controls must never be able to turn an unpaid order into a confirmed one.
 */

describe("the confirmation page reads the order, not the URL", () => {
  test("a paid order is confirmed", () => {
    const view = confirmationView("paid");
    assert.equal(view.tone, "confirmed");
    assert.equal(view.settled, true);
    assert.match(view.title, /confirmed/i);
  });

  test("a fulfilled order is confirmed too", () => {
    assert.equal(confirmationView("fulfilled").settled, true);
  });

  test("A PENDING ORDER IS NEVER CONFIRMED, whatever the URL says", () => {
    // The whole point. The buyer controls the return request, so a crafted
    // ?payment=… must not be able to dress an unpaid order up as a paid one.
    for (const hint of [
      undefined,
      null,
      "review",
      "paid",
      "confirmed",
      "success",
      "COMPLETED",
      "../../paid",
    ]) {
      const view = confirmationView("pending", hint);
      assert.equal(view.settled, false, `hint ${String(hint)} claimed settled`);
      assert.notEqual(view.tone, "confirmed");
      assert.doesNotMatch(
        view.title,
        /confirmed/i,
        `hint ${String(hint)} produced a confirmation heading`
      );
    }
  });

  test("held for review says so, rather than 'pending'", () => {
    // It is a real, distinct state: the card details went through and the
    // processor is deciding. Telling that buyer "we haven't seen a payment"
    // invites them to pay a second time.
    const view = confirmationView("pending", "review");
    assert.equal(view.tone, "review");
    assert.match(view.message, /reviewing/i);
    assert.match(view.message, /nothing is charged twice/i);
  });

  test("a plain pending order suggests a refresh rather than a second payment", () => {
    const view = confirmationView("pending");
    assert.equal(view.tone, "pending");
    assert.match(view.message, /refresh/i);
  });

  test("the hint is case- and whitespace-insensitive", () => {
    assert.equal(confirmationView("pending", "  Review ").tone, "review");
  });

  test("a repeated query parameter cannot smuggle a second value", () => {
    // Next hands back an array when ?payment= appears twice.
    const view = confirmationView("pending", ["review", "paid"] as unknown as string);
    assert.equal(view.tone, "review");
    assert.equal(view.settled, false);
  });

  test("cancelled and refunded are neither confirmed nor pending", () => {
    const cancelled = confirmationView("cancelled");
    assert.equal(cancelled.tone, "stopped");
    assert.equal(cancelled.settled, false);
    assert.match(cancelled.title, /cancelled/i);

    const refunded = confirmationView("refunded");
    assert.equal(refunded.tone, "stopped");
    assert.match(refunded.message, /on its way back/i);
  });

  test("a cancelled order ignores a 'review' hint", () => {
    assert.equal(confirmationView("cancelled", "review").tone, "stopped");
  });

  test("an unreadable order keeps the reassuring copy", () => {
    /**
     * The Stripe redirect can land here before the webhook has, and the guest
     * receipt lookup can fail outright. Neither means the payment failed, and
     * alarming someone who has just paid is worse than the generic line —
     * nothing downstream treats this as proof of payment.
     */
    for (const status of [null, undefined]) {
      const view = confirmationView(status);
      assert.equal(view.tone, "confirmed");
      assert.equal(view.settled, true);
    }
  });

  test("every branch names an icon the set actually has", () => {
    // Icon falls back to a meaningless dot for an unknown name.
    const known = new Set(["check_circle", "schedule", "error_outline"]);
    for (const status of ["paid", "pending", "cancelled", "refunded"] as const) {
      assert.ok(known.has(confirmationView(status).icon), status);
    }
  });
});

describe("the checkout banner after a failed return", () => {
  test("a declined card says no money was taken", () => {
    const notice = checkoutNotice({ payment: "failed" });
    assert.ok(notice);
    assert.match(notice.message, /no money has been taken/i);
  });

  test("an incomplete return says no money was taken", () => {
    const notice = checkoutNotice({ payment: "incomplete" });
    assert.ok(notice);
    assert.match(notice.message, /nothing has been charged/i);
  });

  test("PayPal's own failure is finally rendered", () => {
    // app/api/paypal/capture redirects with ?error=paypal on four separate
    // paths, and nothing read the parameter until this existed.
    const notice = checkoutNotice({ error: "paypal" });
    assert.ok(notice);
    assert.match(notice.title, /paypal/i);
    assert.match(notice.message, /no money has been taken/i);
  });

  test("a buyer who backed out is not told they were declined", () => {
    // Both gateways' cancelUrl points here. Telling someone who chose to
    // cancel that their card was refused is both wrong and alarming.
    const notice = checkoutNotice({ payment: "cancelled" });
    assert.ok(notice);
    assert.match(notice.title, /cancelled/i);
    assert.doesNotMatch(notice.message, /declined/i);
    assert.match(notice.message, /no money has been taken/i);
  });

  test("EVERY branch answers 'was I charged?'", () => {
    // The one question a bounced buyer has. Leaving it unanswered is what
    // produces a duplicate payment or a chargeback.
    for (const params of [
      { payment: "failed" },
      { payment: "incomplete" },
      { payment: "cancelled" },
      { error: "paypal" },
    ]) {
      const notice = checkoutNotice(params);
      assert.ok(notice);
      assert.match(
        notice.message,
        /no money has been taken|nothing has been charged/i,
        JSON.stringify(params)
      );
    }
  });

  test("a clean checkout shows no banner", () => {
    assert.equal(checkoutNotice({}), null);
    assert.equal(checkoutNotice({ payment: "", error: "" }), null);
    assert.equal(checkoutNotice({ payment: null, error: null }), null);
  });

  test("an unrecognised value shows no banner rather than a generic scare", () => {
    assert.equal(checkoutNotice({ payment: "banana" }), null);
    assert.equal(checkoutNotice({ error: "stripe" }), null);
  });

  test("the reason is case-insensitive", () => {
    assert.ok(checkoutNotice({ payment: "FAILED" }));
    assert.ok(checkoutNotice({ error: " PayPal " }));
  });
});
