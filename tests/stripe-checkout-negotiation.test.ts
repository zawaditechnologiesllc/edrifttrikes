import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type Stripe from "stripe";
import {
  DROPPABLE_PARAMS,
  DROP_ORDER,
  MANAGED_PAYMENTS_OFF,
  MINIMAL_SESSION,
  PROTECTED_PARAMS,
  isProtected,
  namedProtected,
  REQUIRED_PARAMS,
  applyAdjustments,
  createCheckoutSession,
  droppableFor,
  errorMessage,
  forgetLearnedAdjustments,
  isInvalidRequest,
  learnedAdjustments,
  mentionsManagedPayments,
  negotiate,
  offendingParams,
  omitPath,
} from "../lib/stripe-checkout";
import { stripeCompanyContent } from "../lib/stripe-branding";

/**
 * Creating a Checkout Session against an account whose configuration we do not
 * control.
 *
 * THE FAILURE THESE TESTS COME FROM: a new Stripe account had Managed Payments
 * on by default, which refuses `custom_text`. Stripe answered the session
 * create with a 400, so no session existed, so every buyer saw "Card checkout
 * is unavailable right now". A storefront taken down by a sentence of
 * marketing copy on Stripe's own page.
 *
 * The rule under test: presentation is negotiable, the money and the plumbing
 * are not. Two properties matter more than the rest —
 *
 *   1. a bad request (wrong amount, bad URL) must NOT be papered over by
 *      dropping features until something succeeds; the real error has to
 *      surface, or a genuine bug becomes invisible.
 *   2. `metadata` must never be dropped. The Stripe webhook reads
 *      session.metadata.order_id to mark the order paid, so a session without
 *      it takes the money and leaves the order unpaid forever — worse than a
 *      checkout that refuses to start.
 */

/** The exact error this account returned, as it came out of the Stripe logs. */
const MANAGED_PAYMENTS_ERROR = {
  type: "StripeInvalidRequestError",
  rawType: "invalid_request_error",
  message:
    "custom_text cannot be used with Managed Payments, which is enabled by " +
    "default on your account. Remove custom_text, or pass " +
    "managed_payments[enabled]=false to disable it for this request. You can " +
    "configure whether Managed Payments is enabled by default at " +
    "https://dashboard.stripe.com/acct_1U1leF8FsoQ83VZf/settings/managed-payments.",
};

const invalid = (message: string, param?: string) => ({
  type: "StripeInvalidRequestError",
  rawType: "invalid_request_error",
  message,
  ...(param ? { param } : {}),
});

/** A realistic session body: presentation on top of money and plumbing. */
const PARAMS = {
  mode: "payment",
  customer_email: "rider@example.com",
  line_items: [
    { quantity: 1, price_data: { currency: "usd", unit_amount: 189900, product_data: { name: "Voltage Drift" } } },
  ],
  success_url: "https://edrifttrikes.shop/order-confirmation?order=ED-1",
  cancel_url: "https://edrifttrikes.shop/checkout",
  metadata: { order_id: "o-1", order_number: "ED-1" },
  customer_creation: "always",
  submit_type: "pay",
  adaptive_pricing: { enabled: true },
  custom_text: { submit: { message: "Ships in 10–14 days" } },
  payment_intent_data: {
    description: "Order ED-1",
    metadata: { order_id: "o-1", order_number: "ED-1" },
    statement_descriptor_suffix: "EDRIFT",
    shipping: { name: "Ada Rider", address: { line1: "1 Drift Way", country: "US" } },
  },
} as const;

type Body = Record<string, unknown>;

/** A Stripe stand-in that refuses the given parameters, one error at a time. */
function fakeStripe(opts: {
  /** Paths that make the create fail, with the error it fails with. */
  refuse: (body: Body) => unknown | null;
}) {
  const calls: Body[] = [];
  const stripe = {
    checkout: {
      sessions: {
        create: async (body: Body) => {
          calls.push(JSON.parse(JSON.stringify(body)));
          const err = opts.refuse(body);
          if (err) throw err;
          return { id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" };
        },
      },
    },
  };
  return { stripe: stripe as unknown as Pick<Stripe, "checkout">, calls };
}

const has = (body: Body, path: string): boolean => {
  const parts = path.split(".");
  let cur: unknown = body;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return false;
    if (!(p in (cur as Record<string, unknown>))) return false;
    cur = (cur as Record<string, unknown>)[p];
  }
  return true;
};

const quiet = () => {};

/* -------------------------------------------------------------------------- */

describe("reading Stripe's error", () => {
  test("an invalid_request error is recognised from any of its shapes", () => {
    assert.equal(isInvalidRequest(MANAGED_PAYMENTS_ERROR), true);
    assert.equal(isInvalidRequest({ rawType: "invalid_request_error" }), true);
    assert.equal(isInvalidRequest({ raw: { type: "invalid_request_error" } }), true);
  });

  test("a decline, a rate limit and a network error are NOT negotiable", () => {
    // Retrying these with one less feature would hide what actually happened.
    assert.equal(isInvalidRequest({ type: "StripeCardError", message: "declined" }), false);
    assert.equal(isInvalidRequest({ type: "StripeRateLimitError" }), false);
    assert.equal(isInvalidRequest({ type: "StripeConnectionError" }), false);
    assert.equal(isInvalidRequest(new Error("socket hang up")), false);
    assert.equal(isInvalidRequest(undefined), false);
  });

  test("the parameter is found in the prose when Stripe sets no param field", () => {
    // The real error: no `param`, the name only in the message.
    assert.equal("param" in MANAGED_PAYMENTS_ERROR, false);
    assert.ok(offendingParams(MANAGED_PAYMENTS_ERROR).includes("custom_text"));
  });

  test("and in the param field when it is set", () => {
    assert.ok(offendingParams(invalid("not allowed", "adaptive_pricing")).includes("adaptive_pricing"));
  });

  test("bracket notation is normalised to dots", () => {
    assert.ok(
      offendingParams(invalid("nope", "payment_intent_data[shipping]")).includes(
        "payment_intent_data.shipping"
      )
    );
  });

  test("the 'unknown parameter' shape is read too", () => {
    assert.ok(
      offendingParams(invalid("Received unknown parameter: managed_payments")).includes(
        "managed_payments"
      )
    );
  });

  test("Managed Payments is identified as the cause", () => {
    assert.equal(mentionsManagedPayments(MANAGED_PAYMENTS_ERROR), true);
    assert.equal(mentionsManagedPayments(invalid("something else")), false);
  });

  test("the message survives whichever field carries it", () => {
    assert.match(errorMessage({ raw: { message: "from raw" } }), /from raw/);
  });
});

describe("what may and may not be given up", () => {
  test("presentation is droppable", () => {
    for (const p of ["custom_text", "adaptive_pricing", "submit_type", "customer_creation"]) {
      assert.equal(droppableFor(p), p, p);
    }
  });

  test("the money and the plumbing are not", () => {
    for (const p of REQUIRED_PARAMS) {
      assert.equal(droppableFor(p), null, `${p} must never be dropped`);
    }
  });

  test("metadata is NOT droppable — the webhook marks the order paid from it", () => {
    assert.equal(droppableFor("metadata"), null);
    assert.ok(REQUIRED_PARAMS.includes("metadata"));
    // The PaymentIntent's copy is only dispute evidence, so that one may go.
    assert.equal(droppableFor("payment_intent_data.metadata"), "payment_intent_data.metadata");
  });

  test("a nested complaint resolves to the nearest thing we can remove", () => {
    assert.equal(
      droppableFor("payment_intent_data.shipping.address.line1"),
      "payment_intent_data.shipping"
    );
  });

  test("an ambiguous bare leaf name is never guessed at", () => {
    // `metadata` ends two droppable paths and names a required one — refuse.
    assert.equal(droppableFor("metadata"), null);
    // `shipping` ends exactly one, so it resolves.
    assert.equal(droppableFor("shipping"), "payment_intent_data.shipping");
  });

  test("A PARAMETER NOBODY HAS HEARD OF IS STILL NEGOTIABLE", () => {
    // The open-world rule, and the whole point of the rewrite: Managed
    // Payments shipped after the SDK this repo pins, so a closed list of
    // droppable names cannot contain the next conflict. Anything not
    // protected may go.
    assert.equal(droppableFor("ui_mode"), "ui_mode");
    assert.equal(droppableFor("some_feature_stripe_ships_in_2027"), "some_feature_stripe_ships_in_2027");
    assert.equal(droppableFor("tax_id_collection"), "tax_id_collection");
  });

  test("but the protected core and everything inside it is not", () => {
    assert.equal(droppableFor("line_items"), null);
    assert.equal(droppableFor("line_items.0.price_data.unit_amount"), null);
    assert.equal(droppableFor("metadata.order_id"), null);
    assert.equal(isProtected("success_url"), true);
    assert.equal(isProtected("payment_intent_data.metadata"), false);
  });

  test("nothing at all is not a parameter", () => {
    assert.equal(droppableFor(""), null);
  });
});

describe("deciding what to try next", () => {
  const fresh = { applied: [], pending: [], rejected: [] };

  test("Managed Payments: keep our copy, switch the product off for the request", () => {
    const next = negotiate(MANAGED_PAYMENTS_ERROR, fresh);
    assert.deepEqual(next, {
      applied: [MANAGED_PAYMENTS_OFF],
      // Held back: what we would drop if the opt-out is refused in turn.
      pending: ["drop:custom_text"],
      rejected: [],
    });
  });

  test("if the opt-out is refused, fall back to dropping what it protected", () => {
    const afterOptOut = negotiate(MANAGED_PAYMENTS_ERROR, fresh)!;
    const next = negotiate(
      invalid("Received unknown parameter: managed_payments"),
      afterOptOut
    );
    assert.deepEqual(next, {
      applied: ["drop:custom_text"],
      pending: [],
      rejected: [MANAGED_PAYMENTS_OFF],
    });
  });

  test("a refused opt-out is never offered to this account again", () => {
    // Otherwise: opt-out refused → removed → Managed Payments complains again
    // → opt-out re-added, for ever.
    const after = negotiate(invalid("Received unknown parameter: managed_payments"), {
      applied: [MANAGED_PAYMENTS_OFF],
      pending: [],
      rejected: [],
    })!;
    assert.deepEqual(after.rejected, [MANAGED_PAYMENTS_OFF]);
    const next = negotiate(MANAGED_PAYMENTS_ERROR, after)!;
    assert.equal(next.applied.includes(MANAGED_PAYMENTS_OFF), false);
    assert.ok(next.applied.includes("drop:custom_text"));
  });

  test("a learned opt-out that no longer works is simply removed and retried", () => {
    // Nothing pending, because the opt-out came from the remembered shape
    // rather than from this negotiation. Removing it is still a new request.
    const next = negotiate(invalid("Received unknown parameter: managed_payments"), {
      applied: [MANAGED_PAYMENTS_OFF],
      pending: [],
      rejected: [],
    });
    assert.deepEqual(next, {
      applied: [],
      pending: [],
      rejected: [MANAGED_PAYMENTS_OFF],
    });
  });

  test("a plain parameter refusal drops that parameter", () => {
    // The original adaptive-pricing case, which used to be hard-coded.
    const next = negotiate(invalid("adaptive_pricing is not available", "adaptive_pricing"), fresh);
    assert.deepEqual(next, {
      applied: ["drop:adaptive_pricing"],
      pending: [],
      rejected: [],
    });
  });

  test("A BAD REQUEST IS NOT NEGOTIATED — the real error has to surface", () => {
    // Dropping features until a wrong amount succeeds would be the worst
    // possible behaviour: it would hide a money bug behind a working checkout.
    assert.equal(
      negotiate(
        invalid("Invalid integer: -5", "line_items[0][price_data][unit_amount]"),
        fresh
      ),
      null
    );
    assert.equal(negotiate(invalid("Not a valid URL", "success_url"), fresh), null);
    assert.equal(negotiate(invalid("Invalid metadata", "metadata"), fresh), null);
  });

  test("a non-negotiable error class is never negotiated", () => {
    assert.equal(negotiate({ type: "StripeAPIError", message: "custom_text" }, fresh), null);
  });

  test("the same parameter is never dropped twice — it escalates instead", () => {
    const next = negotiate(invalid("nope", "custom_text"), {
      applied: ["drop:custom_text"],
      pending: [],
      rejected: [],
    })!;
    assert.equal(
      next.applied.filter((a) => a === "drop:custom_text").length,
      1,
      "custom_text should not be dropped a second time"
    );
    assert.ok(next.applied.includes(MINIMAL_SESSION));
  });

  test("an error that names NOTHING falls back to the minimal session", () => {
    // The case no parsing can cover: an account refusing something in wording
    // none of the patterns match. One bare-bones attempt is still a payment
    // page the buyer can complete.
    const next = negotiate(invalid("This account cannot create sessions like that."), fresh)!;
    assert.deepEqual(next.applied, [MINIMAL_SESSION]);
  });

  test("…but NEVER when the complaint was about the protected core", () => {
    // Stripping the page bare until Stripe accepts a bad amount would be the
    // worst behaviour in the file.
    assert.equal(negotiate(invalid("Invalid integer", "line_items[0][quantity]"), fresh), null);
    assert.equal(negotiate(invalid("metadata is too long", "metadata"), fresh), null);
    assert.equal(namedProtected(invalid("Invalid integer", "line_items[0][quantity]")), true);
    assert.equal(namedProtected(MANAGED_PAYMENTS_ERROR), false);
  });

  test("and the minimal session is only ever tried once", () => {
    assert.equal(
      negotiate(invalid("still no good"), {
        applied: [MINIMAL_SESSION],
        pending: [],
        rejected: [],
      }),
      null
    );
  });
});

describe("applying the adjustments", () => {
  test("the opt-out is added, not substituted", () => {
    const body = applyAdjustments(PARAMS, [MANAGED_PAYMENTS_OFF]);
    assert.deepEqual(body.managed_payments, { enabled: false });
    assert.ok(has(body, "custom_text"), "our copy must survive the opt-out");
  });

  test("a drop removes exactly one thing", () => {
    const body = applyAdjustments(PARAMS, ["drop:custom_text"]);
    assert.equal(has(body, "custom_text"), false);
    assert.ok(has(body, "adaptive_pricing"));
    assert.ok(has(body, "metadata"));
  });

  test("a nested drop leaves its siblings alone", () => {
    const body = applyAdjustments(PARAMS, ["drop:payment_intent_data.shipping"]);
    assert.equal(has(body, "payment_intent_data.shipping"), false);
    assert.ok(has(body, "payment_intent_data.description"));
    assert.ok(has(body, "payment_intent_data.metadata"));
  });

  test("a block emptied by its last drop is removed, not sent empty", () => {
    const body = applyAdjustments(
      { a: 1, block: { only: true } },
      ["drop:block.only"]
    );
    assert.deepEqual(body, { a: 1 });
  });

  test("the caller's params are never mutated", () => {
    const before = JSON.stringify(PARAMS);
    applyAdjustments(PARAMS, ["drop:custom_text", "drop:payment_intent_data.shipping", MANAGED_PAYMENTS_OFF]);
    assert.equal(JSON.stringify(PARAMS), before);
  });

  test("dropping something absent is a no-op", () => {
    assert.deepEqual(omitPath({ a: 1 }, "b.c.d"), { a: 1 });
    assert.deepEqual(omitPath({ a: 1 }, ""), { a: 1 });
  });

  test("every droppable path can actually be applied to a real body", () => {
    // Guards against a typo in DROPPABLE_PARAMS that would silently never fire.
    for (const path of DROPPABLE_PARAMS) {
      const body = applyAdjustments(PARAMS, [`drop:${path}`]);
      assert.equal(has(body, path), false, `${path} was not removed`);
    }
  });
});

describe("creating the session against a real account's refusals", () => {
  test("the account in the logs: one retry, and our copy survives", async () => {
    let seen = 0;
    const { stripe, calls } = fakeStripe({
      refuse: (body) => {
        seen++;
        // Refuses custom_text unless Managed Payments is switched off.
        if (body.custom_text && !body.managed_payments) return MANAGED_PAYMENTS_ERROR;
        return null;
      },
    });

    const result = await createCheckoutSession(stripe, { ...PARAMS }, quiet);
    assert.equal(result.attempts, 2);
    assert.equal(seen, 2);
    assert.deepEqual(result.applied, [MANAGED_PAYMENTS_OFF]);
    // The session was created WITH our copy, which was the point.
    assert.ok(has(calls[1], "custom_text"));
    assert.deepEqual(calls[1].managed_payments, { enabled: false });
    assert.ok(has(calls[1], "metadata"));
  });

  test("and the second buyer pays for none of that discovery", async () => {
    const { stripe, calls } = fakeStripe({
      refuse: (body) => (body.custom_text && !body.managed_payments ? MANAGED_PAYMENTS_ERROR : null),
    });
    await createCheckoutSession(stripe, { ...PARAMS }, quiet);
    const second = await createCheckoutSession(stripe, { ...PARAMS }, quiet);
    assert.equal(second.attempts, 1, "the learned shape should be used straight away");
    assert.equal(calls.length, 3);
    assert.deepEqual(learnedAdjustments(stripe as object), [MANAGED_PAYMENTS_OFF]);
    forgetLearnedAdjustments(stripe as object);
  });

  test("an account that cannot opt out loses the copy instead of the sale", async () => {
    const { stripe, calls } = fakeStripe({
      refuse: (body) => {
        if (body.managed_payments) return invalid("Received unknown parameter: managed_payments");
        if (body.custom_text) return MANAGED_PAYMENTS_ERROR;
        return null;
      },
    });
    const result = await createCheckoutSession(stripe, { ...PARAMS }, quiet);
    assert.equal(result.attempts, 3);
    assert.deepEqual(result.applied, ["drop:custom_text"]);
    const final = calls[2];
    assert.equal(has(final, "custom_text"), false);
    assert.equal(has(final, "managed_payments"), false);
    // Everything that matters is still on the request.
    for (const p of REQUIRED_PARAMS) assert.ok(has(final, p), `${p} was lost`);
    forgetLearnedAdjustments(stripe as object);
  });

  test("an account that refuses EVERY presentation parameter still takes the money", async () => {
    const { stripe, calls } = fakeStripe({
      refuse: (body) => {
        if (body.managed_payments) return invalid("Received unknown parameter: managed_payments");
        for (const path of DROPPABLE_PARAMS) {
          if (has(body, path)) return invalid(`${path.split(".").pop()} is not supported`, path);
        }
        return null;
      },
    });
    const result = await createCheckoutSession(stripe, { ...PARAMS }, quiet);
    const final = calls[calls.length - 1];
    for (const p of REQUIRED_PARAMS) assert.ok(has(final, p), `${p} was lost`);
    for (const p of DROPPABLE_PARAMS) assert.equal(has(final, p), false, `${p} survived`);
    assert.ok(result.session.id);
    forgetLearnedAdjustments(stripe as object);
  });

  test("a bad amount surfaces as Stripe's own error, after ONE call", async () => {
    const boom = invalid("Invalid integer: -5", "line_items[0][price_data][unit_amount]");
    const { stripe, calls } = fakeStripe({ refuse: () => boom });
    await assert.rejects(() => createCheckoutSession(stripe, { ...PARAMS }, quiet), (e) => e === boom);
    assert.equal(calls.length, 1, "a money bug must not be retried into the ground");
  });

  test("a refusal of metadata fails the checkout rather than orphaning a payment", async () => {
    const boom = invalid("Invalid metadata", "metadata");
    const { stripe } = fakeStripe({ refuse: () => boom });
    await assert.rejects(() => createCheckoutSession(stripe, { ...PARAMS }, quiet), (e) => e === boom);
  });

  test("a card decline is not negotiated", async () => {
    const boom = { type: "StripeCardError", message: "Your card was declined" };
    const { stripe, calls } = fakeStripe({ refuse: () => boom });
    await assert.rejects(() => createCheckoutSession(stripe, { ...PARAMS }, quiet), (e) => e === boom);
    assert.equal(calls.length, 1);
  });

  test("a learned shape that stops working is forgotten, not applied forever", async () => {
    // The account's configuration changed under us — Managed Payments was
    // switched off in the Dashboard, so the opt-out is now an unknown
    // parameter. The stale knowledge must not wedge the checkout.
    let managedPaymentsExists = true;
    const { stripe } = fakeStripe({
      refuse: (body) => {
        if (body.managed_payments && !managedPaymentsExists) {
          return invalid("Received unknown parameter: managed_payments");
        }
        if (body.custom_text && !body.managed_payments && managedPaymentsExists) {
          return MANAGED_PAYMENTS_ERROR;
        }
        return null;
      },
    });

    const first = await createCheckoutSession(stripe, { ...PARAMS }, quiet);
    assert.deepEqual(first.applied, [MANAGED_PAYMENTS_OFF]);

    managedPaymentsExists = false;
    const second = await createCheckoutSession(stripe, { ...PARAMS }, quiet);
    // It recovered within the one checkout rather than failing.
    assert.ok(second.session.id);
    assert.equal(
      learnedAdjustments(stripe as object).includes(MANAGED_PAYMENTS_OFF),
      false,
      "the stale adjustment should not have been kept"
    );
    forgetLearnedAdjustments(stripe as object);
  });

  test("the happy path is still exactly one call and remembers nothing", async () => {
    const { stripe, calls } = fakeStripe({ refuse: () => null });
    const result = await createCheckoutSession(stripe, { ...PARAMS }, quiet);
    assert.equal(calls.length, 1);
    assert.deepEqual(result.applied, []);
    assert.deepEqual(learnedAdjustments(stripe as object), []);
    // Everything we asked for went out as asked.
    for (const p of ["custom_text", "adaptive_pricing", "submit_type", "metadata"]) {
      assert.ok(has(calls[0], p), p);
    }
    assert.equal(has(calls[0], "managed_payments"), false);
  });
});

/**
 * The coupling that would rot silently.
 *
 * The negotiation can only give up a parameter whose NAME it knows. Rename a
 * key in stripeCompanyContent — or add a new one — and the ladder quietly
 * stops covering it: the first account that refuses it takes the whole
 * checkout down again, with nothing to show which rung was missing. So the
 * list is checked against what the branding module actually produces.
 */
describe("every presentation parameter we send is negotiable", () => {
  const company = stripeCompanyContent("ED-1", "United States", 189900) as Record<
    string,
    unknown
  >;

  test("the branding module sends nothing the ladder cannot give up", () => {
    for (const key of Object.keys(company)) {
      if (key === "payment_intent_data") continue;
      assert.ok(
        DROPPABLE_PARAMS.includes(key),
        `stripeCompanyContent() sends "${key}", which the negotiation cannot drop — ` +
          `add it to DROPPABLE_PARAMS (or to REQUIRED_PARAMS if it must never go)`
      );
    }
  });

  test("including the fields it nests under payment_intent_data", () => {
    const pid = (company.payment_intent_data ?? {}) as Record<string, unknown>;
    for (const key of Object.keys(pid)) {
      assert.ok(
        DROPPABLE_PARAMS.includes(`payment_intent_data.${key}`),
        `payment_intent_data.${key} is sent but cannot be dropped`
      );
    }
  });

  test("the parameters the checkout route adds itself are covered too", () => {
    // Not introspectable from here, so they are pinned by name: these are the
    // four the route spreads in beside the branding content.
    for (const key of [
      "customer_creation",
      "customer_email",
      "payment_intent_data.shipping",
      "payment_intent_data.statement_descriptor_suffix",
      "payment_intent_data.metadata",
    ]) {
      assert.ok(DROPPABLE_PARAMS.includes(key), key);
    }
  });

  test("and the irreducible ones are not in the droppable list at all", () => {
    for (const key of REQUIRED_PARAMS) {
      assert.equal(
        DROPPABLE_PARAMS.includes(key),
        false,
        `${key} appears in BOTH lists — it would be negotiated away`
      );
    }
  });
});

/**
 * The complete parameter surface, read from the SDK rather than remembered.
 *
 * "Can we read all the Checkout configurations Stripe accepts?" — not from
 * Stripe's API, which publishes no machine-readable map of what a given
 * account will accept, and not from its documentation, which changes faster
 * than any list in here. But the SDK's own typings are an exact, versioned
 * statement of every parameter THIS build can send, so that is the inventory
 * these tests hold the code against.
 *
 * `managed_payments` is deliberately absent from that inventory: the feature
 * shipped after the pinned SDK, which is exactly why the opt-out needs a cast
 * and may be refused — and why the negotiation had to stop depending on a
 * closed list of names.
 */
describe("the pinned SDK's parameter inventory", () => {
  /** Top-level properties of SessionCreateParams, by brace depth. */
  const sdkParams = (() => {
    const src = readFileSync(
      new URL("../node_modules/stripe/types/Checkout/SessionsResource.d.ts", import.meta.url),
      "utf8"
    );
    const body = src.slice(src.indexOf("interface SessionCreateParams {"));
    const names: string[] = [];
    let depth = 0;
    let line = "";
    for (const ch of body) {
      if (ch === "{") { depth++; line = ""; continue; }
      if (ch === "}") { depth--; if (depth === 0) break; line = ""; continue; }
      if (ch === "\n") {
        if (depth === 1) {
          const m = /^\s*([a-z_][a-z0-9_]*)\??\s*:/.exec(line);
          if (m) names.push(m[1]);
        }
        line = "";
        continue;
      }
      line += ch;
    }
    return new Set(names);
  })();

  test("the inventory parsed at all", () => {
    // If this ever reads empty, every assertion below would pass vacuously.
    assert.ok(sdkParams.size > 20, `only found ${sdkParams.size} parameters`);
    for (const known of ["mode", "line_items", "success_url", "custom_text", "adaptive_pricing"]) {
      assert.ok(sdkParams.has(known), known);
    }
  });

  test("EVERY PROTECTED PARAMETER IS SPELLED CORRECTLY", () => {
    // The highest-value assertion in this file. A typo here — "metdata" —
    // would silently make the real metadata droppable, and the first account
    // that objected to it would take the money with no way to reconcile it.
    for (const p of PROTECTED_PARAMS) {
      assert.ok(
        sdkParams.has(p),
        `PROTECTED_PARAMS names "${p}", which is not a Checkout Session parameter ` +
          `in the pinned SDK — a typo here unprotects the real one`
      );
    }
  });

  test("the preference order names real parameters too", () => {
    for (const p of DROP_ORDER) {
      const top = p.split(".")[0];
      assert.ok(
        sdkParams.has(top),
        `DROP_ORDER names "${p}", whose root "${top}" is not a session parameter`
      );
    }
  });

  test("the two lists never overlap", () => {
    for (const p of PROTECTED_PARAMS) {
      assert.equal(DROP_ORDER.includes(p), false, `${p} is in both lists`);
    }
  });

  test("a parameter in the SDK that we have no opinion about is negotiable", () => {
    // Which is the correct default for all ~40 of them: we send a handful, and
    // anything else that ever appears in a session body can be given up.
    const unopinionated = [...sdkParams].filter(
      (p) => !PROTECTED_PARAMS.includes(p) && !DROP_ORDER.includes(p)
    );
    assert.ok(unopinionated.length > 10, "expected most parameters to be unlisted");
    for (const p of unopinionated) {
      assert.equal(droppableFor(p), p, `${p} should be negotiable by default`);
    }
  });
});

describe("the last resort", () => {
  test("the minimal session keeps the protected core and nothing else", () => {
    const body = applyAdjustments(PARAMS, [MANAGED_PAYMENTS_OFF, MINIMAL_SESSION]);
    assert.deepEqual(Object.keys(body).sort(), [...PROTECTED_PARAMS].sort());
    // Including the opt-out: the point is to stop guessing about this account.
    assert.equal("managed_payments" in body, false);
    assert.equal("custom_text" in body, false);
    // And the order is still reconcilable, which is the whole constraint.
    assert.deepEqual(body.metadata, PARAMS.metadata);
  });

  test("an account that refuses something WITHOUT naming it still takes the money", async () => {
    const { stripe, calls } = fakeStripe({
      refuse: (body) =>
        Object.keys(body).length > PROTECTED_PARAMS.length
          ? invalid("This account cannot create Checkout Sessions with these settings.")
          : null,
    });
    const result = await createCheckoutSession(stripe, { ...PARAMS }, quiet);
    assert.ok(result.session.id);
    assert.deepEqual(result.applied, [MINIMAL_SESSION]);
    const final = calls[calls.length - 1];
    for (const p of PROTECTED_PARAMS) assert.ok(has(final, p), `${p} was lost`);
    forgetLearnedAdjustments(stripe as object);
  });

  test("a future Stripe feature that conflicts with a parameter we send is handled", async () => {
    // The scenario this rewrite exists for: a product Stripe switches on by
    // default in 2027 that refuses something, named in wording nobody has
    // written a pattern for yet, about a parameter not in DROP_ORDER.
    const { stripe, calls } = fakeStripe({
      refuse: (body) =>
        body.ui_mode
          ? invalid("ui_mode cannot be used with Instant Settlement, enabled by default.")
          : null,
    });
    const result = await createCheckoutSession(
      stripe,
      { ...PARAMS, ui_mode: "hosted" },
      quiet
    );
    assert.ok(result.session.id);
    assert.deepEqual(result.applied, ["drop:ui_mode"]);
    // Precisely that one parameter — not the minimal session, not our copy.
    assert.ok(has(calls[1], "custom_text"));
    assert.ok(has(calls[1], "metadata"));
    forgetLearnedAdjustments(stripe as object);
  });

  test("NO TWO REQUESTS ARE EVER IDENTICAL, so nothing can spin", async () => {
    // The guarantee that bounds the whole negotiation. Reading a parameter
    // name out of prose can name something we do not send — here, `locale` —
    // and "dropping" it changes nothing. Re-sending that same body would be a
    // wasted call for a guaranteed-identical answer, so the loop notices and
    // thinks again instead of asking again.
    const { stripe, calls } = fakeStripe({
      refuse: () => invalid("locale cannot be used with Managed Payments.", "locale"),
    });
    await assert.rejects(() => createCheckoutSession(stripe, { ...PARAMS }, quiet));

    const bodies = calls.map((c) => JSON.stringify(c));
    assert.equal(
      new Set(bodies).size,
      bodies.length,
      `the same request was sent more than once:\n${bodies.join("\n")}`
    );
    // And it stops quickly: the original, the opt-out, the minimal session.
    assert.ok(calls.length <= 3, `sent ${calls.length} requests`);
    forgetLearnedAdjustments(stripe as object);
  });
});
