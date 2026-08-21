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
import { formatDeliveryWindow } from "../lib/delivery";

/**
 * Company content on the Stripe-hosted Checkout page.
 *
 * The failure that matters here is silent and total: an over-length or
 * malformed custom_text makes the whole session create fail, which means no
 * card checkout at all. The other is subtler — quoting a delivery window or
 * window on Stripe's page that disagrees with the email we send minutes
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

  test("quotes the SAME delivery window as our own checkout", () => {
    // If these drift, Stripe's page contradicts the email the buyer gets
    // minutes later.
    const m = submitMessage();
    assert.ok(
      m.includes(formatDeliveryWindow()),
      "delivery estimate does not match lib/delivery.ts"
    );
  });

  test("quotes the DESTINATION's window once the buyer has given one", () => {
    // Stripe's page is shown after the address is filled in, so quoting the
    // base window there would under-promise for a buyer half a world away.
    const uk = submitMessage("GB");
    assert.ok(uk.includes(formatDeliveryWindow("GB")), "the window is not the destination's");
    assert.ok(uk.includes("United Kingdom"), "the destination is not named");
    assert.notEqual(uk, submitMessage("US"), "every destination reads the same");
  });

  test("falls back to neutral wording for a country it cannot place", () => {
    // Never echo an unrecognised string from the request back onto a payment
    // page: it is buyer-supplied text on a page about their money.
    const m = submitMessage("Wakanda");
    assert.ok(m.includes("your address"));
    assert.ok(!m.includes("Wakanda"));
  });

  test("says NOTHING about duty, customs or import charges", () => {
    // The payment page is the last thing read before committing. A line about
    // customs there reads as an unquantified surcharge and costs the sale —
    // which is why it was removed from the whole store.
    for (const message of [submitMessage(), submitMessage("GB"), afterSubmitMessage()]) {
      assert.doesNotMatch(message, /duty|customs|import charge|tariff/i, message);
    }
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
