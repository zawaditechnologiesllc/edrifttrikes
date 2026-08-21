import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeCartTotals,
  computeTax,
  productShippingCents,
  DEFAULT_SHIPPING_CENTS,
  DEFAULT_TAX_RATE_BPS,
} from "../lib/totals";

/**
 * Order money math. This is what a customer is charged, so the cases below are
 * about the ways a total can be wrong by real money — not coverage for its own
 * sake.
 */

describe("computeTax", () => {
  test("uses the default rate when the store hasn't set one", () => {
    assert.equal(computeTax(10_000), 800); // 8% of $100
    assert.equal(computeTax(10_000, {}), 800);
  });

  test("honours an admin-set rate", () => {
    assert.equal(computeTax(10_000, { tax_rate_bps: 0 }), 0);
    assert.equal(computeTax(10_000, { tax_rate_bps: 725 }), 725);
    assert.equal(computeTax(199_99, { tax_rate_bps: 825 }), 1650);
  });

  test("rounds to whole cents rather than emitting fractions", () => {
    // 8.25% of $33.33 = 274.97…  A fractional cent would be rejected by the
    // payment provider, so this must always land on an integer.
    const tax = computeTax(3333, { tax_rate_bps: 825 });
    assert.equal(Number.isInteger(tax), true);
    assert.equal(tax, 275);
  });

  test("falls back rather than billing a nonsense rate", () => {
    // Bad data must never reach a charge as a 900% tax.
    assert.equal(computeTax(10_000, { tax_rate_bps: -100 }), 800);
    assert.equal(computeTax(10_000, { tax_rate_bps: 90_000 }), 800);
    assert.equal(computeTax(10_000, { tax_rate_bps: NaN }), 800);
  });
});

describe("computeCartTotals", () => {
  const item = (over: Partial<{ price_cents: number; qty: number }> = {}) => ({
    price_cents: 100_000,
    qty: 1,
    ...over,
  });

  test("totals = subtotal + shipping + tax", () => {
    const t = computeCartTotals([item()], { shipping_cents: 5000, tax_rate_bps: 800 });
    assert.equal(t.subtotal, 100_000);
    assert.equal(t.shipping, 5000);
    assert.equal(t.tax, 8000);
    assert.equal(t.total, 113_000);
  });

  test("shipping is charged per unit, not per line", () => {
    const t = computeCartTotals([item({ qty: 3 })], { shipping_cents: 5000 });
    assert.equal(t.shipping, 15_000);
  });

  test("a per-product fee overrides the store default", () => {
    const t = computeCartTotals(
      [{ price_cents: 50_000, qty: 2, shipping_cents: 2500 }],
      { shipping_cents: 5000 }
    );
    assert.equal(t.shipping, 5000); // 2 × $25, not 2 × $50
  });

  test("free-shipping products contribute no shipping", () => {
    const t = computeCartTotals(
      [
        { price_cents: 50_000, qty: 1, free_shipping: true },
        { price_cents: 50_000, qty: 1 },
      ],
      { shipping_cents: 5000 }
    );
    assert.equal(t.shipping, 5000); // only the second item
  });

  test("the store-wide free shipping switch zeroes everything", () => {
    const t = computeCartTotals([item({ qty: 4 })], {
      shipping_cents: 5000,
      free_shipping: true,
    });
    assert.equal(t.shipping, 0);
  });

  test("an empty cart costs nothing — no phantom shipping or tax", () => {
    const t = computeCartTotals([], { shipping_cents: 5000 });
    assert.deepEqual(t, { subtotal: 0, shipping: 0, tax: 0, total: 0 });
  });

  test("falls back to the documented defaults with no config at all", () => {
    const t = computeCartTotals([item()]);
    assert.equal(t.shipping, DEFAULT_SHIPPING_CENTS);
    assert.equal(t.tax, (100_000 * DEFAULT_TAX_RATE_BPS) / 10_000);
  });
});

describe("what the buyer is charged", () => {
  test("the totals carry NOTHING but subtotal, shipping, tax and total", () => {
    // The store used to disclose an estimated import duty here. It was removed
    // because it read like a surcharge and cost sales. This asserts the shape
    // stays clean: a stray extra key would surface as a line on the cart, the
    // checkout, the receipt and every email at once.
    const t = computeCartTotals([{ price_cents: 100_000, qty: 1 }]);
    assert.deepEqual(Object.keys(t).sort(), ["shipping", "subtotal", "tax", "total"]);
  });

  test("the total is exactly what a card is charged", () => {
    const t = computeCartTotals([
      { price_cents: 100_000, qty: 2 },
      { price_cents: 25_000, qty: 1 },
    ]);
    assert.equal(t.total, t.subtotal + t.shipping + t.tax);
  });
});

describe("productShippingCents", () => {
  test("prefers the product fee, then the store fee, then the default", () => {
    assert.equal(productShippingCents({ shipping_cents: 1500 }, { shipping_cents: 5000 }), 1500);
    assert.equal(productShippingCents({}, { shipping_cents: 5000 }), 5000);
    assert.equal(productShippingCents({}), DEFAULT_SHIPPING_CENTS);
  });

  test("free shipping wins, from either the product or the store", () => {
    assert.equal(productShippingCents({ free_shipping: true }, { shipping_cents: 5000 }), 0);
    assert.equal(productShippingCents({ shipping_cents: 9999 }, { free_shipping: true }), 0);
  });
});
