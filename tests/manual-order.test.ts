import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MANUAL_ITEM_FIELDS,
  MANUAL_SHIPPING_FIELDS,
  MAX_MANUAL_ITEMS,
  buildManualOrder,
  manualOrderFromForm,
  parsePaidAt,
  parseQty,
  signedDollarsToCents,
  type ManualOrderInput,
} from "../lib/manual-order";

/**
 * Typing in an order for money that arrived somewhere the shop could not see.
 *
 * The checkout creates an order BEFORE the buyer reaches a payment page, so a
 * storefront sale always leaves a row. A payment link, an invoice, a bank
 * transfer or a sale agreed over the phone leaves none — and the customer is
 * waiting on something there is no record of.
 *
 * The property these tests exist for: THE TOTAL IS NEVER TYPED. It is the sum
 * of the lines plus shipping plus tax, every time, so an invoice can always be
 * explained to the person who paid it. An admin who needs a different figure
 * adds a negative line. A form that let someone type a total would eventually
 * produce an order whose parts do not add up to what was charged, and no
 * amount of care at the keyboard prevents that.
 */

const NOW = new Date("2026-10-06T09:00:00.000Z");

const base = (over: Partial<ManualOrderInput> = {}): ManualOrderInput => ({
  email: "rider@example.com",
  status: "pending",
  items: [{ name: "Voltage Drift", price: "1899.00", qty: "1" }],
  ...over,
});

/** Build and assert it succeeded, returning the draft. */
const ok = (input: ManualOrderInput) => {
  const result = buildManualOrder(input, NOW);
  assert.equal(result.ok, true, `expected success, got: ${(result as { errors?: string[] }).errors?.join(" / ")}`);
  if (!result.ok) throw new Error("unreachable");
  return result;
};

/** Build and assert it failed, returning the messages. */
const fails = (input: ManualOrderInput): string[] => {
  const result = buildManualOrder(input, NOW);
  assert.equal(result.ok, false, "expected failure");
  if (result.ok) throw new Error("unreachable");
  return result.errors;
};

describe("reading the amounts an admin types", () => {
  test("plain dollars, with or without the decorations", () => {
    assert.equal(signedDollarsToCents("1899"), 189900);
    assert.equal(signedDollarsToCents("1899.00"), 189900);
    assert.equal(signedDollarsToCents("$1,899.00"), 189900);
    assert.equal(signedDollarsToCents(" 1899.5 "), 189950);
  });

  test("NEGATIVE is allowed here, unlike the shop's price filter", () => {
    // This is how a discount or a part refund is recorded without breaking the
    // rule that the total is the sum of its parts.
    assert.equal(signedDollarsToCents("-100"), -10000);
    assert.equal(signedDollarsToCents("-$1,000.50"), -100050);
  });

  test("anything that is not an amount is refused, not coerced to zero", () => {
    // Silently reading "about 1900" as 0 would create a free order.
    for (const junk of ["", "   ", "abc", "19.999", "1e5", "--5"]) {
      assert.equal(signedDollarsToCents(junk), null, junk);
    }
  });

  test("a comma must be a thousands separator, properly grouped", () => {
    // The shared dollarsToCents() just strips commas, which is right for the
    // shop's price filter and wrong here: it reads "1,2,3" as $123 and puts a
    // number nobody typed on an invoice.
    assert.equal(signedDollarsToCents("1,2,3"), null);
    assert.equal(signedDollarsToCents("1,89,900"), null);
    assert.equal(signedDollarsToCents("1,899.00"), 189900);
    assert.equal(signedDollarsToCents("123,456.78"), 12345678);
  });

  test("an amount over the ceiling is REFUSED, not quietly clamped", () => {
    // dollarsToCents() caps at $1,000,000, which is right for a price filter
    // and wrong on an invoice: a typed 12,345,678.90 would come back as a
    // silent $1,000,000. A mistake should be shown.
    assert.equal(signedDollarsToCents("12,345,678.90"), null);
    assert.equal(signedDollarsToCents("1000001"), null);
    assert.equal(signedDollarsToCents("1000000"), 100000000);
  });

  test("quantities are whole and bounded", () => {
    assert.equal(parseQty(""), 1);
    assert.equal(parseQty("3"), 3);
    assert.equal(parseQty("999"), 999);
    for (const junk of ["0", "-1", "1.5", "1000", "two", " 3 x"]) {
      assert.equal(parseQty(junk), null, junk);
    }
  });
});

describe("when the money arrived", () => {
  test("a blank date means now", () => {
    assert.equal(parsePaidAt("", NOW)?.toISOString(), NOW.toISOString());
  });

  test("A DATE IS READ AS NOON, NOT MIDNIGHT", () => {
    // Midnight on a date is the previous evening everywhere west of UTC, so a
    // backfilled order would show the day BEFORE the one that was typed — and
    // the delivery estimate, which counts from this, would be a day out too.
    const d = parsePaidAt("2026-09-01", NOW)!;
    assert.equal(d.toISOString(), "2026-09-01T12:00:00.000Z");
    // Still the 1st in Los Angeles and in Sydney.
    assert.equal(d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }), "2026-09-01");
    assert.equal(d.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" }), "2026-09-01");
  });

  test("a full timestamp is taken as given", () => {
    assert.equal(parsePaidAt("2026-09-01T18:30:00.000Z", NOW)?.toISOString(), "2026-09-01T18:30:00.000Z");
  });

  test("a date that is not a date is refused", () => {
    assert.equal(parsePaidAt("last tuesday", NOW), null);
  });
});

describe("the total is the sum of its parts", () => {
  test("lines, times quantity, plus shipping and tax", () => {
    const { order } = ok(
      base({
        items: [
          { name: "Trike", price: "1899.00", qty: "2" },
          { name: "Spare sleeves", price: "49.00", qty: "1" },
        ],
        shippingFee: "50",
        tax: "100.25",
      })
    );
    assert.equal(order.subtotal_cents, 189900 * 2 + 4900);
    assert.equal(order.shipping_cents, 5000);
    assert.equal(order.tax_cents, 10025);
    assert.equal(order.total_cents, order.subtotal_cents + 5000 + 10025);
  });

  test("a negative line is a discount and comes off the total", () => {
    const { order } = ok(
      base({
        items: [
          { name: "Trike", price: "1899.00", qty: "1" },
          { name: "Launch discount", price: "-199.00", qty: "1" },
        ],
        shippingFee: "0",
      })
    );
    assert.equal(order.subtotal_cents, 189900 - 19900);
    assert.equal(order.total_cents, 170000);
  });

  test("THE TOTAL CANNOT BE TYPED — it always equals the parts", () => {
    // There is no total field, and this is the assertion that keeps it that
    // way: whatever is in the form, the three parts add up to it.
    const { order } = ok(base({ shippingFee: "75.50", tax: "12.34" }));
    assert.equal(
      order.total_cents,
      order.subtotal_cents + order.shipping_cents + order.tax_cents
    );
  });

  test("blank shipping and tax are zero, not errors", () => {
    const { order } = ok(base({}));
    assert.equal(order.shipping_cents, 0);
    assert.equal(order.tax_cents, 0);
    assert.equal(order.total_cents, order.subtotal_cents);
  });

  test("an order worth less than nothing is refused", () => {
    const errors = fails(
      base({ items: [{ name: "Correction", price: "-500", qty: "1" }] })
    );
    assert.ok(errors.some((e) => /less than nothing/i.test(e)), errors.join(" / "));
  });
});

describe("what it refuses", () => {
  test("no customer email", () => {
    assert.ok(fails(base({ email: "" })).some((e) => /email is required/i.test(e)));
  });

  test("an email that is not one", () => {
    assert.ok(fails(base({ email: "rider@localhost" })).some((e) => /not an email/i.test(e)));
  });

  test("an order with no lines", () => {
    assert.ok(fails(base({ items: [] })).some((e) => /at least one line/i.test(e)));
    assert.ok(fails(base({ items: [{ name: "", price: "", qty: "" }] })).some((e) => /at least one line/i.test(e)));
  });

  test("a line with no description", () => {
    assert.ok(
      fails(base({ items: [{ name: "", price: "10", qty: "1" }] })).some((e) =>
        /Line 1: a description is required/.test(e)
      )
    );
  });

  test("a status the database does not have", () => {
    assert.ok(fails(base({ status: "shipped" })).some((e) => /not an order status/i.test(e)));
  });

  test("a payment method it does not know", () => {
    assert.ok(fails(base({ paidVia: "bitcoin" })).some((e) => /not a payment method/i.test(e)));
  });

  test("more lines than it will carry", () => {
    const items = Array.from({ length: MAX_MANUAL_ITEMS + 1 }, (_, i) => ({
      name: `Line ${i}`,
      price: "1.00",
      qty: "1",
    }));
    assert.ok(fails(base({ items })).some((e) => /cannot have more than/i.test(e)));
  });

  test("EVERY problem at once, not the first", () => {
    // An admin retyping a ten-line order should not find its faults one
    // submit at a time.
    const errors = fails({
      email: "",
      status: "nonsense",
      items: [
        { name: "", price: "abc", qty: "0" },
        { name: "Fine", price: "10", qty: "1" },
      ],
    });
    assert.ok(errors.length >= 4, `only got: ${errors.join(" / ")}`);
    assert.ok(errors.some((e) => /email/i.test(e)));
    assert.ok(errors.some((e) => /not an order status/i.test(e)));
    assert.ok(errors.some((e) => /Line 1: a description/.test(e)));
    assert.ok(errors.some((e) => /Line 1: "abc" is not a price/.test(e)));
    assert.ok(errors.some((e) => /Line 1: quantity/.test(e)));
  });
});

describe("the shape it hands to the database", () => {
  test("the address goes through the checkout's own whitelist", () => {
    const { order } = ok(
      base({
        shipping: {
          first_name: "Ada",
          last_name: "Rider",
          address: "1 Drift Way",
          city: "Austin",
          state: "Texas",
          zip: "78701",
          country: "us",
          // Not a checkout field. A manual order must not be able to smuggle
          // keys the rest of the system does not know about.
          internal_note: "VIP",
        },
      })
    );
    assert.equal(order.shipping_address.internal_note, undefined);
    assert.equal(order.shipping_address.first_name, "Ada");
    // Canonicalised, so labels and invoices read the same as a real order.
    assert.equal(order.shipping_address.country, "United States");
  });

  test("a blank order number is left for the database to generate", () => {
    const { order } = ok(base({ orderNumber: "   " }));
    assert.equal("order_number" in order, false);
  });

  test("a given order number is kept, so it can match an external record", () => {
    const { order } = ok(base({ orderNumber: "INV-2026-114" }));
    assert.equal(order.order_number, "INV-2026-114");
  });

  test("a settled order gets a paid timestamp and a method", () => {
    const { order } = ok(base({ status: "paid", paidAt: "2026-09-01" }));
    assert.equal(order.paid_at, "2026-09-01T12:00:00.000Z");
    // Blank "paid via" on a settled order is recorded as manual rather than
    // left null — the order list shows how money arrived, and "unknown" there
    // is worse than "by hand".
    assert.equal(order.paid_via, "manual");
  });

  test("and keeps the gateway it was actually paid through", () => {
    const { order } = ok(
      base({ status: "paid", paidVia: "stripe", gatewayReference: "pi_3QabcDEF" })
    );
    assert.equal(order.paid_via, "stripe");
    assert.equal(order.gateway_reference, "pi_3QabcDEF");
  });

  test("an unpaid order carries no paid timestamp", () => {
    const { order } = ok(base({ status: "pending", paidAt: "2026-09-01" }));
    assert.equal(order.paid_at, null);
  });

  test("a refunded order can be created directly", () => {
    // The whole point of the Refunded tab: an order that arrived already
    // closed, because the money came and went before anyone typed it in.
    const { order } = ok(base({ status: "refunded" }));
    assert.equal(order.status, "refunded");
    assert.equal(order.paid_at, null);
  });

  test("the currency is stored the way the rest of the system expects it", () => {
    assert.equal(ok(base({ currency: "USD" })).order.currency, "usd");
    assert.equal(ok(base({})).order.currency, "usd");
  });

  test("a product-backed line keeps its link, and a typed one does not invent one", () => {
    const { items } = ok(
      base({
        items: [
          { name: "Trike", price: "1899", qty: "1", productId: "p-1", slug: "voltage-drift", imageUrl: "/a.jpg", color: "Blue" },
          { name: "Crate fee", price: "75", qty: "1" },
        ],
      })
    );
    assert.deepEqual(items[0], {
      name: "Trike",
      price_cents: 189900,
      qty: 1,
      product_id: "p-1",
      slug: "voltage-drift",
      image_url: "/a.jpg",
      color: "Blue",
    });
    assert.equal(items[1].product_id, null);
    assert.equal(items[1].slug, null);
    assert.equal(items[1].color, null);
  });
});

/**
 * The wiring between the form and the parser.
 *
 * The part most likely to break silently. A renamed input does not throw — it
 * arrives blank, and the order is created missing an address or a payment
 * reference the admin is certain they typed. So the names are checked against
 * the component that emits them, not against a list written from memory.
 */
describe("reading the admin form", () => {
  /** A submission with exactly the names NewOrderForm renders. */
  const submission = () => {
    const f = new FormData();
    f.set("email", "Rider@Example.com");
    f.set("order_number", "INV-2026-114");
    f.set("status", "paid");
    f.set("currency", "usd");
    f.set("paid_via", "stripe");
    f.set("gateway_reference", "pi_3QabcDEF");
    f.set("gateway_account", "acct_1U1leF");
    f.set("paid_at", "2026-09-28");
    f.set("shipping_fee", "50.00");
    f.set("tax", "151.92");
    f.set("note", "Paid by bank transfer");
    for (const [k, v] of Object.entries({
      first_name: "Ada", last_name: "Rider", address: "1 Drift Way",
      address2: "Unit 4", city: "Austin", state: "Texas", zip: "78701",
      country: "us", phone: "+15550100123",
    })) {
      f.set(`shipping.${k}`, v);
    }
    f.set("item.0.name", "Voltage Drift");
    f.set("item.0.price", "1,899.00");
    f.set("item.0.qty", "1");
    f.set("item.0.productId", "p-1");
    f.set("item.0.slug", "voltage-drift");
    f.set("item.0.imageUrl", "/assets/trike.jpg");
    f.set("item.0.color", "Volt Blue");
    f.set("item.1.name", "Returning customer discount");
    f.set("item.1.price", "-100");
    f.set("item.1.qty", "1");
    return f;
  };

  test("EVERY field the form sends arrives", () => {
    const input = manualOrderFromForm(submission());
    assert.equal(input.email, "Rider@Example.com");
    assert.equal(input.orderNumber, "INV-2026-114");
    assert.equal(input.status, "paid");
    assert.equal(input.paidVia, "stripe");
    assert.equal(input.gatewayReference, "pi_3QabcDEF");
    assert.equal(input.gatewayAccount, "acct_1U1leF");
    assert.equal(input.paidAt, "2026-09-28");
    assert.equal(input.shippingFee, "50.00");
    assert.equal(input.tax, "151.92");
    assert.equal(input.note, "Paid by bank transfer");
    assert.equal(input.shipping?.address2, "Unit 4");
    assert.equal(input.shipping?.phone, "+15550100123");
    assert.equal(input.items?.length, 2);
    assert.equal(input.items?.[0].color, "Volt Blue");
  });

  test("and the whole submission builds the order it should", () => {
    const result = buildManualOrder(manualOrderFromForm(submission()), NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const { order, items } = result;
    assert.equal(order.email, "rider@example.com");
    assert.equal(order.order_number, "INV-2026-114");
    assert.equal(order.status, "paid");
    assert.equal(order.paid_via, "stripe");
    assert.equal(order.paid_at, "2026-09-28T12:00:00.000Z");
    assert.equal(order.shipping_address.country, "United States");
    assert.equal(items.length, 2);
    // 1899.00 − 100.00 + 50.00 shipping + 151.92 tax
    assert.equal(order.subtotal_cents, 189900 - 10000);
    assert.equal(order.total_cents, 179900 + 5000 + 15192);
    assert.equal(
      order.total_cents,
      order.subtotal_cents + order.shipping_cents + order.tax_cents
    );
  });

  test("blank rows between filled ones are skipped, not counted", () => {
    const f = new FormData();
    f.set("email", "rider@example.com");
    f.set("item.0.name", "Trike");
    f.set("item.0.price", "100");
    f.set("item.0.qty", "1");
    // item.1 left entirely empty — a line the admin added and cleared.
    f.set("item.2.name", "Crate");
    f.set("item.2.price", "75");
    f.set("item.2.qty", "1");
    const input = manualOrderFromForm(f);
    assert.equal(input.items?.length, 2);
    const result = buildManualOrder(input, NOW);
    assert.equal(result.ok, true);
  });

  test("an empty form is refused rather than creating a free order", () => {
    const result = buildManualOrder(manualOrderFromForm(new FormData()), NOW);
    assert.equal(result.ok, false);
  });

  test("THE COMPONENT'S FIELD NAMES ARE THE ONES READ HERE", () => {
    // The guard that makes the rest of this suite mean something: if someone
    // renames an input in NewOrderForm, this fails instead of the field
    // silently arriving blank on every order from then on.
    const src = readFileSync(
      new URL("../app/admin/orders/NewOrderForm.tsx", import.meta.url),
      "utf8"
    );
    const emitted = new Set(
      [...src.matchAll(/name=\{?`?"?([a-zA-Z_.$}{0-9\[\]]+)"?`?\}?/g)]
        .map((m) => m[1])
        .filter((n) => !n.includes("{"))
    );
    // Template-literal line names come through as `item.${i}.name`; normalise.
    const templated = [...src.matchAll(/name=\{`item\.\$\{i\}\.([a-zA-Z]+)`\}/g)].map(
      (m) => m[1]
    );

    const topLevel = [
      "email", "order_number", "status", "currency", "paid_via",
      "gateway_reference", "gateway_account", "paid_at", "shipping_fee",
      "tax", "note",
    ];
    for (const name of topLevel) {
      assert.ok(emitted.has(name), `NewOrderForm no longer sends "${name}"`);
    }
    for (const field of MANUAL_SHIPPING_FIELDS) {
      assert.ok(
        emitted.has(`shipping.${field}`),
        `NewOrderForm no longer sends "shipping.${field}"`
      );
    }
    for (const field of MANUAL_ITEM_FIELDS) {
      assert.ok(
        templated.includes(field),
        `NewOrderForm no longer sends "item.<n>.${field}"`
      );
    }
    // And the notify checkbox, whose absence would silently invert the
    // email default (wantsNotify reads a missing field as "yes, email them").
    assert.ok(emitted.has("notify"), "the notify control is gone");
    assert.ok(
      /name="notify"\s+value="off"/.test(src),
      "the hidden notify=off is gone — unticking would start emailing customers"
    );
  });
});
