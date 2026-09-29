import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getStripe, stripeConfigured } from "../lib/stripe";

/**
 * Rotating STRIPE_SECRET_KEY.
 *
 * ═══ THE BUG THIS EXISTS TO STOP ═══════════════════════════════════════════
 *
 * The Stripe client is cached per Worker isolate. Caching it on "have I built
 * one?" alone meant that after a key rotation an isolate kept handing back the
 * client built from the OLD key: the new key was read, the null check passed,
 * and the stale client was returned anyway — so every call authenticated with a
 * revoked secret and came back 401.
 *
 * It failed intermittently, because only WARM isolates were affected, and
 * redeploying appeared to fix it by discarding them all. That is exactly the
 * shape of "I rotated the keys and checkout broke".
 * ═══════════════════════════════════════════════════════════════════════════
 */

const realEnv = { ...process.env };
afterEach(() => {
  process.env = { ...realEnv };
});

/**
 * Deliberately NOT shaped like real Stripe keys. An `sk_test_…` literal, even a
 * fabricated one, trips GitHub's secret-scanning push protection and blocks the
 * push. Nothing here needs the real format: getStripe() passes the string
 * straight to the Stripe constructor, which does not parse it, and no request
 * is ever made with it.
 */
const A = "rotation-fixture-key-one";
const B = "rotation-fixture-key-two";

describe("a rotated key takes effect on the next request", () => {
  test("A NEW KEY PRODUCES A NEW CLIENT", () => {
    process.env.STRIPE_SECRET_KEY = A;
    const first = getStripe();
    assert.ok(first);

    process.env.STRIPE_SECRET_KEY = B;
    const second = getStripe();
    assert.ok(second);

    // The whole fix. Before it, `second` was the very same object as `first`,
    // still carrying key A.
    assert.notEqual(first, second, "the rotated key returned the stale client");
  });

  test("the same key keeps the same client, so nothing is rebuilt per request", () => {
    process.env.STRIPE_SECRET_KEY = A;
    const first = getStripe();
    const second = getStripe();
    assert.equal(first, second);
  });

  test("rotating back again is still honoured", () => {
    process.env.STRIPE_SECRET_KEY = A;
    const first = getStripe();
    process.env.STRIPE_SECRET_KEY = B;
    getStripe();
    process.env.STRIPE_SECRET_KEY = A;
    const back = getStripe();
    assert.notEqual(back, first, "rotating back reused a stale client");
  });
});

describe("removing and re-adding the key — the delete/deploy/add/deploy habit", () => {
  test("no key means no client, and no crash", () => {
    delete process.env.STRIPE_SECRET_KEY;
    assert.equal(getStripe(), null);
    assert.equal(stripeConfigured(), false);
  });

  test("re-adding a DIFFERENT key after a gap builds a client on that key", () => {
    process.env.STRIPE_SECRET_KEY = A;
    const first = getStripe();

    delete process.env.STRIPE_SECRET_KEY;
    assert.equal(getStripe(), null);

    process.env.STRIPE_SECRET_KEY = B;
    const after = getStripe();
    assert.ok(after);
    assert.notEqual(after, first, "the re-added key reused the client from before the gap");
  });

  test("the key is read at call time, never at import", () => {
    // On Cloudflare, secrets are runtime bindings invisible at module scope.
    delete process.env.STRIPE_SECRET_KEY;
    assert.equal(stripeConfigured(), false);
    process.env.STRIPE_SECRET_KEY = A;
    assert.equal(stripeConfigured(), true);
  });

  test("stripeConfigured agrees with getStripe, which is what admin and checkout each read", () => {
    // The admin panel and the checkout page run the SAME check. If they ever
    // disagree on screen, the cause is a cached page, not the configuration.
    for (const key of [A, B]) {
      process.env.STRIPE_SECRET_KEY = key;
      assert.equal(stripeConfigured(), Boolean(getStripe()));
    }
    delete process.env.STRIPE_SECRET_KEY;
    assert.equal(stripeConfigured(), Boolean(getStripe()));
  });
});
