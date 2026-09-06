import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  STATEMENT_DESCRIPTOR_LIMIT,
  fulfillmentMetadata,
  isStripeSessionId,
  statementDescriptorSuffix,
  stripeShipping,
} from "../lib/stripe-fulfillment";
import { normalizeShipping } from "../lib/validation";

/**
 * What the payment processor is told about a real delivery.
 *
 * These are not cosmetic. A charge with no destination and no proof of shipment
 * is, to a risk model, a charge for nothing — and a malformed value here fails
 * the session create outright, which is a lost sale rather than a lost field.
 * So the rule throughout is: send it correctly, or send nothing.
 */

describe("the shipping address Stripe receives", () => {
  const full = {
    first_name: "Ada",
    last_name: "Lovelace",
    address: "12 Kingsway",
    address2: "Unit 4",
    city: "Austin",
    state: "TX",
    zip: "78701",
    country: "United States",
    phone: "+1 512 555 0199",
  };

  test("is built from the address the buyer already typed", () => {
    assert.deepEqual(stripeShipping(full), {
      name: "Ada Lovelace",
      phone: "+1 512 555 0199",
      address: {
        line1: "12 Kingsway",
        line2: "Unit 4",
        city: "Austin",
        state: "TX",
        postal_code: "78701",
        country: "US",
      },
    });
  });

  test("reads the SAME keys the checkout actually stores", () => {
    // The one way this silently breaks: someone renames a field in
    // lib/validation.ts and every charge quietly loses its destination. So the
    // input here comes through the real normalizer, not a hand-written object.
    const stored = normalizeShipping(full);
    const shipping = stripeShipping(stored);
    assert.ok(shipping, "the normalized checkout address produced nothing");
    assert.equal(shipping.name, "Ada Lovelace");
    assert.equal(shipping.address.line1, "12 Kingsway");
    assert.equal(shipping.address.country, "US");
  });

  test("converts the country to the ISO code Stripe demands", () => {
    assert.equal(stripeShipping({ ...full, country: "GB" })?.address.country, "GB");
    assert.equal(
      stripeShipping({ ...full, country: "United Kingdom" })?.address.country,
      "GB"
    );
  });

  test("returns null rather than a half-built address", () => {
    // Stripe requires a name, a line 1 and a resolvable country. Sending a
    // partial object fails the session create — and a failed session is a lost
    // sale, where a missing shipping block is merely a missing shipping block.
    assert.equal(stripeShipping({ ...full, country: "Freedonia" }), null);
    assert.equal(stripeShipping({ ...full, address: "" }), null);
    assert.equal(stripeShipping({ ...full, first_name: "", last_name: "" }), null);
    assert.equal(stripeShipping(null), null);
    assert.equal(stripeShipping(undefined), null);
  });

  test("omits the optional lines instead of sending empty strings", () => {
    const minimal = stripeShipping({
      first_name: "Ada",
      address: "12 Kingsway",
      country: "US",
    });
    assert.deepEqual(minimal, {
      name: "Ada",
      address: { line1: "12 Kingsway", country: "US" },
    });
    assert.ok(!("phone" in (minimal as object)));
  });

  test("survives a name with only a surname", () => {
    assert.equal(stripeShipping({ ...full, first_name: "" })?.name, "Lovelace");
  });
});

describe("the statement descriptor", () => {
  /**
   * The line a cardholder sees on their bank statement. One they do not
   * recognise gets disputed as fraud, and that dispute counts against the
   * account whether or not it is won — so this is a fraud-rate control, not
   * branding.
   */
  test("passes a name that is already short and clean", () => {
    assert.equal(statementDescriptorSuffix("EDRIFTTRIKES"), "EDRIFTTRIKES");
  });

  test("cuts a long name at a word boundary, not mid-word", () => {
    // "E-DRIFT TRIK" on a statement looks like a broken charge, which is the
    // reaction this field exists to prevent.
    assert.equal(statementDescriptorSuffix("E-Drift Trikes & Go Carts"), "E-Drift");
  });

  test("strips the characters Stripe rejects", () => {
    assert.equal(statementDescriptorSuffix('Bad<>"*Chars'), "BadChars");
    for (const ch of ["<", ">", "\\", "'", '"', "*"]) {
      assert.ok(!statementDescriptorSuffix(`Shop${ch}Name`)?.includes(ch));
    }
  });

  test("refuses anything Stripe would refuse, rather than losing the sale", () => {
    // A rejected descriptor fails the whole session create. Better to fall back
    // to the account default than to take the checkout down over a label.
    assert.equal(statementDescriptorSuffix("12345"), null, "digits only");
    assert.equal(statementDescriptorSuffix("A"), null, "too short");
    assert.equal(statementDescriptorSuffix("   "), null);
    assert.equal(statementDescriptorSuffix(""), null);
    assert.equal(statementDescriptorSuffix(null), null);
    assert.equal(statementDescriptorSuffix(undefined), null);
  });

  test("never exceeds what Stripe allows, even when asked to", () => {
    const long = "A".repeat(100);
    const out = statementDescriptorSuffix(long, 999);
    assert.ok(out);
    assert.ok(out.length <= STATEMENT_DESCRIPTOR_LIMIT);
  });

  test("leaves room for the account prefix by default", () => {
    // Stripe prepends the account's own prefix and caps the total at 22.
    const out = statementDescriptorSuffix("A".repeat(50));
    assert.ok(out && out.length <= 12);
  });
});

describe("the fulfillment evidence attached to a payment", () => {
  const base = {
    orderNumber: "ED-2026-0311",
    courier: "DHL Express",
    trackingNumber: "1234567890",
    shippedAt: "2026-03-04T09:00:00Z",
    stage: "shipped",
  };

  test("uses the field names Stripe's own dispute evidence uses", () => {
    // So answering a dispute is a copy, not a translation.
    const meta = fulfillmentMetadata(base);
    assert.equal(meta.shipping_carrier, "DHL Express");
    assert.equal(meta.shipping_tracking_number, "1234567890");
    assert.equal(meta.shipping_date, "2026-03-04");
    assert.equal(meta.order_number, "ED-2026-0311");
  });

  test("includes a tracking link only when it would actually resolve", () => {
    assert.ok(fulfillmentMetadata(base).shipping_tracking_url?.includes("dhl.com"));
  });

  test("never links out for one of our own internal references", () => {
    // A dispute reviewer sent to a courier's "not found" page reads it as
    // evidence that nothing shipped — worse than no link at all.
    const meta = fulfillmentMetadata({
      ...base,
      courier: "E-Drift Logistics",
      trackingNumber: "EDT-2603-G625N2-C",
    });
    assert.equal(meta.shipping_tracking_url, undefined);
    assert.equal(meta.shipping_tracking_number, "EDT-2603-G625N2-C");
  });

  test("omits what it does not know instead of writing empty values", () => {
    // `shipping_tracking_number: ""` tells a reviewer less than nothing.
    const meta = fulfillmentMetadata({
      orderNumber: "ED-2026-0311",
      courier: null,
      trackingNumber: null,
    });
    assert.deepEqual(meta, { order_number: "ED-2026-0311" });
  });

  test("stays inside Stripe's metadata limits", () => {
    const meta = fulfillmentMetadata(base);
    assert.ok(Object.keys(meta).length <= 50);
    for (const [k, v] of Object.entries(meta)) {
      assert.ok(k.length <= 40, `key ${k} is too long`);
      assert.ok(v.length <= 500, `value for ${k} is too long`);
    }
  });
});

describe("telling a Stripe payment from a PayPal one", () => {
  test("recognises a Checkout Session id", () => {
    assert.equal(isStripeSessionId("cs_test_a1b2c3"), true);
  });

  test("rejects the PayPal order id the same column also carries", () => {
    // orders.stripe_session_id predates PayPal and was reused for it. Looking a
    // PayPal id up in Stripe is a guaranteed 404 on every shipped order.
    assert.equal(isStripeSessionId("5O190127TN364715T"), false);
    assert.equal(isStripeSessionId(null), false);
    assert.equal(isStripeSessionId(undefined), false);
    assert.equal(isStripeSessionId(""), false);
  });
});
