import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { resendFailureHint, sendInBackground } from "../lib/email";

/**
 * Email must never be able to cost an order.
 *
 * ═══ THE EXPOSURE THIS CLOSES ══════════════════════════════════════════════
 *
 * A failed send never could: every order row is written before any email is
 * attempted, and every send is caught. DELAY was the real exposure. The
 * checkout awaited the cart-recovery email outright, and the Resend call had
 * no timeout — so a provider that was slow, which is what a provider at its
 * daily limit becomes before it starts refusing outright, held the checkout
 * request open BEFORE the Stripe session was created.
 *
 * Under load that is how a shop stops taking orders without anything looking
 * broken: the row recorded, no payment page, nothing for the buyer to pay on.
 */

/** Resolves only when released — stands in for a provider that has stalled. */
function hangingSend() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { send: () => promise, release };
}

describe("a send that stalls must not hold up the caller", () => {
  test("THE CALLER IS RELEASED AT THE DEADLINE, not when the provider answers", async () => {
    const { send, release } = hangingSend();
    const started = Date.now();
    await sendInBackground("stalled provider", send, 40);
    const waited = Date.now() - started;

    assert.ok(waited < 1000, `waited ${waited}ms for a send that never finished`);
    release();
  });

  test("a send that finishes first is not delayed by the deadline", async () => {
    const started = Date.now();
    await sendInBackground("fast provider", async () => "ok", 5000);
    const waited = Date.now() - started;
    // It must return as soon as the send does, not sit out the full deadline.
    assert.ok(waited < 1000, `waited ${waited}ms for a send that returned at once`);
  });

  test("a send that THROWS is caught, not propagated", async () => {
    // The order is already written by the time this runs; an exception here
    // would unwind a request that has nothing left to do but succeed.
    await assert.doesNotReject(() =>
      sendInBackground("rejecting provider", async () => {
        throw new Error("Resend: daily limit reached");
      }, 40)
    );
  });

  test("a send that throws SYNCHRONOUSLY is caught too", async () => {
    // Written as send().then().catch(), a synchronous throw escapes before the
    // catch is attached and takes the caller with it — which is exactly what
    // this helper exists to prevent. Caught in the first version; this is what
    // found it.
    await assert.doesNotReject(() =>
      sendInBackground(
        "exploding provider",
        () => {
          throw new Error("bad config");
        },
        40
      )
    );
  });
});

describe("naming the failure in the logs", () => {
  test("THE DAILY LIMIT IS NAMED, and says orders are unaffected", () => {
    for (const message of [
      "Too many requests",
      "You have reached your daily limit",
      "rate limit exceeded",
      "HTTP 429",
      "Monthly quota exceeded",
    ]) {
      const hint = resendFailureHint(message);
      assert.ok(hint, `no hint for "${message}"`);
      assert.match(hint!, /ORDERS ARE UNAFFECTED/);
    }
  });

  test("a timeout is named as a timeout", () => {
    const hint = resendFailureHint("TimeoutError: signal timed out");
    assert.ok(hint);
    assert.match(hint!, /did not answer in time/);
    assert.match(hint!, /order is unaffected/i);
  });

  test("the unverified-domain case still has its own hint", () => {
    const hint = resendFailureHint("You can only send testing emails to your own address");
    assert.ok(hint);
    assert.match(hint!, /sending domain|verified/i);
  });

  test("an unrecognised failure gets no invented advice", () => {
    assert.equal(resendFailureHint("some other problem"), null);
    assert.equal(resendFailureHint(""), null);
  });
});
