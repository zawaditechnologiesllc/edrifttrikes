import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  STRIPE_CUSTOM_TEXT_LIMIT,
  afterSubmitMessage,
  clampCustomText,
  paymentDescription,
  stripeCompanyContent,
  submitMessage,
} from "../lib/stripe-branding";
import { COMPANY } from "../lib/company";
import { ESTIMATED_DELIVERY_DAYS } from "../lib/fulfillment";
import { DEFAULT_DUTY_RATE_BPS } from "../lib/totals";

/**
 * Company content on the Stripe-hosted Checkout page.
 *
 * The failure that matters here is silent and total: an over-length or
 * malformed custom_text makes the whole session create fail, which means no
 * card checkout at all. The other is subtler — quoting a delivery window or
 * duty rate on Stripe's page that disagrees with the email we send minutes
 * later.
 */

describe("clampCustomText", () => {
  test("leaves normal copy untouched apart from whitespace", () => {
    assert.equal(clampCustomText("  hello   world  "), "hello world");
  });

  test("never exceeds Stripe's limit — over-length breaks checkout entirely", () => {
    const long = "word ".repeat(1000);
    const out = clampCustomText(long);
    assert.ok(out.length <= STRIPE_CUSTOM_TEXT_LIMIT, `${out.length} chars`);
  });

  test("cuts at a word boundary rather than mid-word", () => {
    const out = clampCustomText("alpha bravo charlie delta", 14);
    assert.equal(out, "alpha bravo");
  });

  test("still clamps when there is no usable word boundary", () => {
    const out = clampCustomText("x".repeat(50), 10);
    assert.equal(out.length, 10);
  });
});

describe("custom_text messages", () => {
  test("both fit inside Stripe's 1200-character limit", () => {
    assert.ok(submitMessage().length <= STRIPE_CUSTOM_TEXT_LIMIT);
    assert.ok(afterSubmitMessage().length <= STRIPE_CUSTOM_TEXT_LIMIT);
  });

  test("the pay-button message names the company and how to reach it", () => {
    const m = submitMessage();
    assert.ok(m.includes(COMPANY.name), "company name missing");
    assert.ok(m.includes(COMPANY.supportEmail), "support address missing");
  });

  test("quotes the SAME delivery window and duty rate as our own checkout", () => {
    // If these drift, Stripe's page contradicts the email the buyer gets
    // minutes later.
    const m = submitMessage();
    assert.ok(
      m.includes(String(ESTIMATED_DELIVERY_DAYS)),
      "delivery estimate does not match lib/fulfillment.ts"
    );
    assert.ok(
      m.includes(String(DEFAULT_DUTY_RATE_BPS / 100)),
      "duty rate does not match lib/totals.ts"
    );
  });

  test("is explicit that duty is not collected by us", () => {
    const m = submitMessage().toLowerCase();
    assert.match(m, /not included/);
    assert.match(m, /never collect/);
  });

  test("the post-payment message says what happens next", () => {
    const m = afterSubmitMessage().toLowerCase();
    assert.match(m, /email/);
    assert.match(m, /ship/);
  });
});

describe("stripeCompanyContent", () => {
  test("produces the shape the Stripe SDK expects", () => {
    const content = stripeCompanyContent("EDT-ABCD1234");
    assert.equal(content.submit_type, "pay");
    assert.ok(content.custom_text.submit.message.length > 0);
    assert.ok(content.custom_text.after_submit.message.length > 0);
    assert.ok(content.payment_intent_data.description.includes("EDT-ABCD1234"));
  });

  test("the charge description carries the order number for reconciliation", () => {
    const d = paymentDescription("EDT-99887766");
    assert.ok(d.includes("EDT-99887766"));
    assert.ok(d.includes(COMPANY.name));
  });
});
