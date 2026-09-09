import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildInvoice,
  documentRecord,
  verifyUrl,
  invoiceFilename,
  invoiceMoney,
  invoiceNumber,
  isPayable,
  sellerFor,
  sellerSnapshot,
} from "../lib/invoice";
import { DEFAULT_SITE_SETTINGS } from "../lib/company";
import type { Order, SiteSettings } from "../lib/types";

/**
 * ORDER INVOICES.
 *
 * These documents leave the building: a customer files one, an accountant
 * reconciles one, a payment processor is handed one as proof the business is
 * real. So the tests read the text back out of the finished PDF and check the
 * facts are actually printed — not merely passed in.
 *
 * The one that matters most is the refusal: no paid invoice for an unpaid
 * order, ever.
 */

function asText(bytes: Uint8Array): string {
  let source = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    source += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 8192)));
  }
  return source;
}

/** Every string the finished PDF draws, joined for searching. */
function pdfText(bytes: Uint8Array): string {
  const out: string[] = [];
  const re = /\(((?:[^\\()]|\\.)*)\)\s*Tj/g;
  let match: RegExpExecArray | null;
  const source = asText(bytes);
  while ((match = re.exec(source))) out.push(match[1].replace(/\\([\\()])/g, "$1"));
  return out.join("\n");
}

function pageCount(bytes: Uint8Array): number {
  return Number(/\/Type \/Pages \/Count (\d+)/.exec(asText(bytes))?.[1] ?? 0);
}

/**
 * The invoice is dated to the order, not to the day it was generated — so
 * there is no "now" to inject any more, and this is the date the documents
 * below should carry.
 */
const ORDER_PLACED = "2026-08-14T10:22:00Z";

const SETTINGS: SiteSettings = {
  ...DEFAULT_SITE_SETTINGS,
  company_email: "orders@edrifttrikes.shop",
  company_phone: "+86 757 8100 2233",
  address_line1: "Building 6, Lecong Industrial Park",
  address_line2: "Shunde District, Foshan, Guangdong 528315, China",
  legal_name: "Zawadi Technologies LLC",
  dba_name: "E-Drift Trikes & Go Carts",
  tax_id: "EIN 88-1234567",
  invoice_footer: "Payment by card or PayPal only.",
};

const BASE = {
  id: "order-1",
  order_number: "EDT-7A3F91C2",
  email: "ada.lovelace@example.net",
  currency: "usd",
  subtotal_cents: 389800,
  shipping_cents: 5000,
  tax_cents: 31584,
  total_cents: 426384,
  shipping_address: {
    first_name: "Ada",
    last_name: "Lovelace",
    address: "1142 Westminster Bridge Road",
    city: "Austin",
    state: "TX",
    zip: "78701",
    country: "United States",
  },
  created_at: ORDER_PLACED,
  updated_at: "2026-09-01T08:00:00Z",
  items: [
    { id: "i1", name: "60V 5000W High-Speed Electric Drift Kart", price_cents: 189900, qty: 2, color: "Voltage Blue" },
    { id: "i2", name: "Slide-Sleeve Set", price_cents: 10000, qty: 1, color: null },
  ],
} as unknown as Order;

const UNPAID = {
  ...BASE,
  status: "pending",
  paid_at: null,
  paid_via: null,
  fulfillment_stage: "awaiting_payment",
  stripe_session_id: null,
} as Order;

const PAID = {
  ...BASE,
  status: "paid",
  paid_at: "2026-08-15T09:14:33Z",
  paid_via: "stripe",
  fulfillment_stage: "in_transit",
  stripe_session_id: "cs_live_a1b2c3d4e5f6",
  estimated_delivery_at: "2026-09-12T00:00:00Z",
  tracking_number: "1234567890",
  courier: "DHL Express",
} as unknown as Order;

const build = (order: Order, variant: "proforma" | "paid", settings = SETTINGS) =>
  buildInvoice({ order, settings, variant });

describe("no invoice claims a payment that did not happen", () => {
  /**
   * The one hard rule in the module. A document headed "PAID IN FULL" for an
   * order nobody paid for is a fabricated record, and issuing one does far more
   * damage than a button that refuses to work.
   */
  test("refuses a paid invoice for a pending order", async () => {
    await assert.rejects(() => build(UNPAID, "paid"), /not paid/i);
  });

  test("refuses one for a cancelled or refunded order", async () => {
    for (const status of ["cancelled", "refunded", "pending"]) {
      await assert.rejects(
        () => build({ ...PAID, status } as Order, "paid"),
        /not paid/i,
        `a ${status} order produced a paid invoice`
      );
    }
  });

  test("refuses one for an order marked paid but with no payment date", async () => {
    // status without paid_at means the transition never completed. Dating an
    // invoice from nothing is how a document ends up contradicting the gateway.
    await assert.rejects(
      () => build({ ...PAID, paid_at: null } as Order, "paid"),
      /not paid/i
    );
  });

  test("isPayable agrees with what the button offers", async () => {
    assert.equal(isPayable(UNPAID), false);
    assert.equal(isPayable(PAID), true);
    assert.equal(isPayable({ status: "fulfilled", paid_at: PAID.paid_at } as Order), true);
    assert.equal(isPayable({ status: "paid", paid_at: null } as Order), false);
  });

  test("a proforma is always available — that is the point of it", async () => {
    for (const order of [UNPAID, PAID]) {
      const bytes = await build(order, "proforma");
      assert.ok(bytes.length > 1000);
    }
  });
});

describe("what a proforma says", () => {
  test("names itself as one, and says no payment was received", async () => {
    const text = pdfText(await build(UNPAID, "proforma"));
    assert.match(text, /PROFORMA INVOICE/);
    assert.match(text, /PAYMENT DUE/);
    assert.match(text, /not a tax invoice/i);
    assert.match(text, /No payment has been received/i);
  });

  test("shows the amount owed rather than a balance of nil", async () => {
    const text = pdfText(await build(UNPAID, "proforma"));
    assert.match(text, /Amount due/);
    assert.ok(!text.includes("Balance due"), "a proforma showed a settled balance");
    assert.ok(!text.includes("PAID IN FULL"));
  });

  test("carries no payment date or gateway reference, because there is none", async () => {
    const text = pdfText(await build(UNPAID, "proforma"));
    assert.ok(!text.includes("PAYMENT RECEIVED"));
    assert.match(text, /HOW TO PAY/);
  });
});

describe("what a paid invoice says", () => {
  test("states it is settled, and reconciles to nil", async () => {
    const text = pdfText(await build(PAID, "paid"));
    assert.match(text, /^INVOICE$/m);
    assert.match(text, /PAID IN FULL/);
    assert.match(text, /Balance due/);
    assert.ok(!text.includes("PROFORMA"));
    assert.ok(!text.includes("Amount due"));
  });

  test("records how, when, and against which gateway reference", async () => {
    // The block that lets somebody check the document against the processor's
    // own record. Without the reference the two cannot be reconciled at all.
    const text = pdfText(await build(PAID, "paid"));
    assert.match(text, /PAYMENT RECEIVED/);
    assert.match(text, /Card \(Stripe\)/);
    assert.match(text, /15 Aug 2026/);
    assert.match(text, /cs_live_a1b2c3d4e5f6/);
  });

  test("shows the delivery it is evidence of", async () => {
    const text = pdfText(await build(PAID, "paid"));
    assert.match(text, /DHL Express/);
    assert.match(text, /1234567890/);
    assert.match(text, /In transit/);
  });
});

describe("the facts every invoice has to carry", () => {
  test("is dated to the day the order was placed", async () => {
    // NOT the day the PDF was generated. An invoice records a transaction, so
    // it carries that transaction's date — an August order downloaded in
    // September is an August invoice, and one dated "today" would not line up
    // with the gateway record it exists to corroborate.
    const text = pdfText(await build(PAID, "paid"));
    assert.match(text, /INVOICE DATE/);
    assert.match(text, /14 Aug 2026/, "the invoice is not dated to the order");
    assert.match(text, /Issued 14 Aug 2026/, "the masthead is not dated to the order");
  });

  test("carries no second date that contradicts the first", async () => {
    // The footer used to stamp "generated <today>", which reintroduced exactly
    // the discrepancy that dating to the order removes.
    const text = pdfText(await build(PAID, "paid"));
    assert.ok(!/generated/i.test(text), "the footer still stamps a generation date");
    // And no separate "order placed" cell: two cells showing one date read as a
    // template bug rather than as corroboration.
    assert.ok(!text.includes("ORDER PLACED"));
  });

  test("the same order always produces the same document", async () => {
    // Determinism follows from dating to the order, and it matters: two
    // downloads of one invoice must not disagree about their own date.
    const a = await build(PAID, "paid");
    const b = await build(PAID, "paid");
    assert.deepEqual(Array.from(a), Array.from(b));
  });

  test("the payment date is still the payment date", async () => {
    // Not re-dated to the order: it is a different fact, and the one that
    // reconciles this document against the gateway's record of the charge.
    const text = pdfText(await build(PAID, "paid"));
    assert.match(text, /PAYMENT RECEIVED/);
    assert.match(text, /15 Aug 2026/);
  });

  test("the order number and an invoice number derived from it", async () => {
    const text = pdfText(await build(PAID, "paid"));
    assert.match(text, /EDT-7A3F91C2/);
    assert.match(text, /INV-EDT-7A3F91C2/);
  });

  test("the customer's email, which is what ties it to the payment", async () => {
    const text = pdfText(await build(PAID, "paid"));
    assert.match(text, /ada\.lovelace@example\.net/);
  });

  test("the customer's name once, not twice", async () => {
    // The name is the heading of the Bill To block AND the first line of the
    // address; printing both looked like a template bug.
    const text = pdfText(await build(PAID, "paid"));
    assert.equal(text.split("Ada Lovelace").length - 1, 1);
  });

  test("the full delivery address", async () => {
    const text = pdfText(await build(PAID, "paid"));
    assert.match(text, /1142 Westminster Bridge Road/);
    assert.match(text, /Austin, TX, 78701/);
    assert.match(text, /United States/);
  });

  test("every line item, with its colour and its own maths", async () => {
    const text = pdfText(await build(PAID, "paid"));
    assert.match(text, /60V 5000W High-Speed Electric Drift Kart/);
    assert.match(text, /Colour: Voltage Blue/);
    assert.match(text, /USD 1,899\.00/); // unit
    assert.match(text, /USD 3,798\.00/); // 2 × unit
  });

  test("the money, broken down and totalled", async () => {
    const text = pdfText(await build(PAID, "paid"));
    assert.match(text, /Subtotal/);
    assert.match(text, /USD 3,898\.00/);
    assert.match(text, /Shipping/);
    assert.match(text, /USD 50\.00/);
    assert.match(text, /Tax/);
    assert.match(text, /USD 315\.84/);
    assert.match(text, /USD 4,263\.84/);
  });

  test("a zero tax line still prints", async () => {
    // Omitting it leaves the reader unable to tell whether no tax applied or
    // somebody forgot it.
    const text = pdfText(await build({ ...PAID, tax_cents: 0 } as Order, "paid"));
    assert.match(text, /Tax/);
    assert.match(text, /USD 0\.00/);
  });

  test("the currency, named outright", async () => {
    const text = pdfText(await build(PAID, "paid"));
    assert.match(text, /CURRENCY/);
    assert.match(text, /USD/);
  });

  test("the page count, on every page", async () => {
    const bytes = await build(PAID, "paid");
    assert.equal(pageCount(bytes), 2, "invoice page plus the machine-readable one");
    assert.match(pdfText(bytes), /page 1 of 2/);
    assert.match(pdfText(bytes), /page 2 of 2/);
  });
});

describe("money on an invoice", () => {
  test("always carries the cents", async () => {
    // lib/format.ts drops them on a round figure, which is right in a catalogue
    // and wrong here: "USD 1,899" reads as an approximation.
    assert.equal(invoiceMoney(189900), "USD 1,899.00");
    assert.equal(invoiceMoney(0), "USD 0.00");
    assert.equal(invoiceMoney(5), "USD 0.05");
  });

  test("names the currency rather than leaning on a bare symbol", () => {
    assert.equal(invoiceMoney(1000, "eur"), "EUR 10.00");
    assert.equal(invoiceMoney(1000, "gbp"), "GBP 10.00");
  });

  test("survives a broken amount instead of printing NaN", () => {
    assert.equal(invoiceMoney(NaN), "USD 0.00");
    assert.equal(invoiceMoney(Infinity), "USD 0.00");
  });
});

describe("who the seller is", () => {
  test("the trading name the admin edits wins, on every order", async () => {
    // The store trades under one current name and every document says so —
    // including documents for orders placed under an older name.
    const order = {
      ...PAID,
      seller_snapshot: {
        dbaName: "Old Trading Name",
        legalName: "Old Holdings LLC",
        taxId: "EIN 88-0000000",
      },
    } as unknown as Order;
    const text = pdfText(await build(order, "paid"));
    assert.match(text, /E-Drift Trikes & Go Carts/);
    assert.match(text, /EIN 88-1234567/);
    assert.ok(!text.includes("Old Trading Name"), "the stale snapshot was printed");
    assert.ok(!text.includes("EIN 88-0000000"));
  });

  test("the snapshot fills in only what the settings do not have", async () => {
    // It stays useful as a fallback and as a record of what the shop was called
    // at the time, without being what the document prints.
    const seller = sellerFor(
      { seller_snapshot: { taxId: "EIN 88-0000000", dbaName: "Old Trading Name" } } as unknown as Order,
      { ...SETTINGS, tax_id: null }
    );
    assert.equal(seller.display, "E-Drift Trikes & Go Carts", "settings should still win");
    assert.equal(seller.taxId, "EIN 88-0000000", "the snapshot should have filled the gap");
  });

  test("works for an order that never stored a snapshot", async () => {
    const text = pdfText(await build({ ...PAID, seller_snapshot: null } as Order, "paid"));
    assert.match(text, /E-Drift Trikes & Go Carts/);
    assert.match(text, /EIN 88-1234567/);
  });

  test("names the registered entity under the trading name when they differ", async () => {
    const text = pdfText(await build({ ...PAID, seller_snapshot: null } as Order, "paid"));
    assert.match(text, /a trading name of Zawadi Technologies LLC/);
  });

  test("does not say 'a trading name of' when the two are the same", () => {
    const seller = sellerFor({ seller_snapshot: null } as Order, {
      ...SETTINGS,
      legal_name: "E-Drift Trikes & Go Carts",
      dba_name: "E-Drift Trikes & Go Carts",
    });
    assert.equal(seller.legalName, null);
  });

  test("prints no placeholder details, ever", async () => {
    // A shop that has filled nothing in gets a document with less on it — not
    // one advertising "100 Drift Lane" and a 555 number, which tells a reviewer
    // it came off an unfinished template.
    const text = pdfText(
      await build({ ...UNPAID, seller_snapshot: null } as Order, "proforma", DEFAULT_SITE_SETTINGS)
    );
    for (const junk of ["100 Drift Lane", "555", "Los Angeles, CA 90001", "hello@edrifttrikes.shop"]) {
      assert.ok(!text.includes(junk), `the invoice printed the placeholder "${junk}"`);
    }
    // But it still says how to reach the seller: the placeholder email falls
    // through to the real support address rather than leaving the block blank.
    assert.match(text, /support@edrifttrikes\.shop/);
  });

  test("drops the city when there is no real street line", async () => {
    // Half an address on a legal document is worse than none: it claims a
    // location it cannot support.
    const seller = sellerFor({ seller_snapshot: null } as Order, {
      ...SETTINGS,
      address_line1: "100 Drift Lane",
      address_line2: "Shunde District, Foshan, China",
    });
    assert.deepEqual(seller.addressLines, []);
  });
});

const NOW = new Date("2026-09-09T12:00:00Z");

describe("the snapshot recorded at checkout", () => {
  test("records what the shop was called, and when", () => {
    const snap = sellerSnapshot(SETTINGS, NOW);
    assert.equal(snap.dbaName, "E-Drift Trikes & Go Carts");
    assert.equal(snap.legalName, "Zawadi Technologies LLC");
    assert.equal(snap.taxId, "EIN 88-1234567");
    assert.equal(snap.capturedAt, NOW.toISOString());
  });

  test("never freezes a placeholder onto an order", () => {
    const snap = sellerSnapshot(DEFAULT_SITE_SETTINGS, NOW);
    assert.equal(snap.addressLine1, null);
    assert.equal(snap.addressLine2, null);
    assert.equal(snap.phone, null);
    assert.equal(snap.email, null);
  });

  test("never keeps a city with no street to go with it", () => {
    const snap = sellerSnapshot(
      { ...SETTINGS, address_line1: "100 Drift Lane" } as SiteSettings,
      NOW
    );
    assert.equal(snap.addressLine1, null);
    assert.equal(snap.addressLine2, null);
  });
});

describe("numbering and filenames", () => {
  test("a proforma and its invoice are distinguishable", () => {
    assert.equal(invoiceNumber("EDT-7A3F91C2", "proforma"), "PRO-EDT-7A3F91C2");
    assert.equal(invoiceNumber("EDT-7A3F91C2", "paid"), "INV-EDT-7A3F91C2");
  });

  test("the same order always produces the same number", () => {
    // Downloading twice must not yield two documents claiming to be different
    // invoices for one transaction.
    assert.equal(
      invoiceNumber("EDT-7A3F91C2", "paid"),
      invoiceNumber("EDT-7A3F91C2", "paid")
    );
  });

  test("filenames are safe to put in a Content-Disposition header", () => {
    assert.equal(invoiceFilename("EDT-7A3F91C2", "paid"), "INV-EDT-7A3F91C2.pdf");
    // A quote or a semicolon here would break out of the quoted filename.
    const nasty = invoiceFilename('EDT"; rm -rf /', "proforma");
    assert.match(nasty, /^[A-Za-z0-9-]+\.pdf$/);
  });

  test("an order with no number still downloads as something findable", () => {
    assert.match(invoiceFilename("", "paid"), /\.pdf$/);
  });
});

describe("documents that are awkward rather than typical", () => {
  test("a long order paginates and repeats the column headings", async () => {
    const many = {
      ...PAID,
      items: Array.from({ length: 14 }, (_, i) => ({
        id: `x${i}`,
        name: `Replacement part ${i + 1} — a deliberately long description that wraps`,
        price_cents: 4500 + i,
        qty: 1,
        color: null,
      })),
    } as unknown as Order;
    const bytes = await build(many, "paid");
    assert.ok(pageCount(bytes) > 1, "14 line items fitted on one page");
    // Two headings means the continuation is labelled rather than being an
    // unexplained grid of numbers.
    assert.ok(pdfText(bytes).split("DESCRIPTION").length - 1 >= 2);
    assert.match(pdfText(bytes), /page 2 of/);
  });

  test("an order with no items produces a document rather than a crash", async () => {
    const text = pdfText(await build({ ...PAID, items: [] } as Order, "paid"));
    assert.match(text, /No line items recorded/);
  });

  test("the invoice itself is one page; the record gets the second", async () => {
    /**
     * TWO PAGES ON PURPOSE, and this is the test that pins it.
     *
     * The machine-readable record needs a physically large code — carrying a
     * whole document takes several hundred bytes, and squeezed into the gutter
     * beside the totals the modules came out around a third of a millimetre:
     * fine on a screen, gone after one photocopy. A code too dense to scan is
     * not a smaller feature, it is no feature.
     *
     * So the invoice proper still ends on page one — nothing about the document
     * a person reads has moved — and page two is the record, in both forms.
     */
    for (const [order, variant] of [[PAID, "paid"], [UNPAID, "proforma"]] as const) {
      const bytes = await build(order, variant);
      assert.equal(pageCount(bytes), 2, `${variant} is not two pages`);
    }
    // Everything a person reads is on page one: the totals are the last thing
    // before the record section.
    const text = pdfText(await build(PAID, "paid"));
    assert.ok(
      text.indexOf("Balance due") < text.indexOf("THIS DOCUMENT, MACHINE-READABLE"),
      "the invoice content ran past the record section"
    );
  });

  test("a missing address does not take the document down", async () => {
    const text = pdfText(
      await build({ ...PAID, shipping_address: null } as Order, "paid")
    );
    assert.match(text, /ada\.lovelace@example\.net/);
  });
});

describe("the record the code carries", () => {
  /**
   * The code holds the DOCUMENT, not a link to it: scanning shows the invoice's
   * own contents with no network round trip. So what is tested here is that
   * every fact on the paper is in the record. That the code actually scans is
   * verified by decoding it off the rendered page — see docs/FULFILLMENT.md.
   */
  const record = (order: Order, variant: "proforma" | "paid") =>
    documentRecord(order, sellerFor(order, SETTINGS), variant);

  test("carries no URL — it is the document, not a pointer to it", () => {
    for (const [order, variant] of [[PAID, "paid"], [UNPAID, "proforma"]] as const) {
      assert.ok(!/https?:\/\//.test(record(order, variant)), `${variant} embeds a link`);
    }
  });

  test("identifies the seller, the entity behind it, and the tax number", () => {
    const r = record(PAID, "paid");
    assert.match(r, /E-Drift Trikes & Go Carts/);
    assert.match(r, /Zawadi Technologies LLC/);
    assert.match(r, /EIN 88-1234567/);
  });

  test("identifies the buyer and where it went", () => {
    const r = record(PAID, "paid");
    assert.match(r, /ada\.lovelace@example\.net/);
    assert.match(r, /Austin, TX, United States/);
  });

  test("carries every line item with its own arithmetic", () => {
    const r = record(PAID, "paid");
    assert.match(r, /2 x 60V 5000W High-Speed Electric Drift Kart \(Voltage Blue\) @ 1899\.00 = 3798\.00/);
    assert.match(r, /1 x Slide-Sleeve Set @ 100\.00 = 100\.00/);
  });

  test("carries the money, and it agrees with the printed document", () => {
    const r = record(PAID, "paid");
    assert.match(r, /Subtotal: 3898\.00 USD/);
    assert.match(r, /Shipping: 50\.00 USD/);
    assert.match(r, /Tax: 315\.84 USD/);
    assert.match(r, /TOTAL: 4263\.84 USD/);
  });

  test("the paid record states the payment and its gateway reference", () => {
    const r = record(PAID, "paid");
    assert.match(r, /^INVOICE$/m);
    assert.match(r, /PAID IN FULL 15 Aug 2026/);
    assert.match(r, /Method: Card \(Stripe\)/);
    assert.match(r, /Ref: cs_live_a1b2c3d4e5f6/);
    assert.match(r, /Balance due: 0\.00 USD/);
  });

  test("the proforma record says outright that nothing was paid", () => {
    // The record must not be mistakable for a receipt when read on its own,
    // away from the document it came off.
    const r = record(UNPAID, "proforma");
    assert.match(r, /PROFORMA INVOICE - UNPAID/);
    assert.match(r, /AMOUNT DUE: 4263\.84 USD/);
    assert.match(r, /No payment received\./);
    assert.ok(!r.includes("PAID IN FULL"));
    assert.ok(!r.includes("Balance due"));
  });

  test("the printed copy on the page is the SAME string the code encodes", async () => {
    // Rendered from one string, so the two cannot drift into disagreeing —
    // which is exactly what a reader compares them for.
    const text = pdfText(await build(PAID, "paid"));
    for (const line of record(PAID, "paid").split("\n")) {
      if (!line.trim()) continue;
      assert.ok(
        text.includes(line),
        `the page does not print the record line: ${line}`
      );
    }
  });

  test("stays small enough to stay scannable", () => {
    // Every byte pushes the symbol denser, and past roughly 900 the modules get
    // too fine to survive print at the size the page allows.
    for (const [order, variant] of [[PAID, "paid"], [UNPAID, "proforma"]] as const) {
      const bytes = new TextEncoder().encode(record(order, variant)).length;
      assert.ok(bytes < 900, `${variant} record is ${bytes} bytes`);
    }
  });

  test("points at this order's verification page", () => {
    assert.equal(
      verifyUrl("EDT-7A3F91C2", "https://edrifttrikes.shop"),
      "https://edrifttrikes.shop/verify/EDT-7A3F91C2"
    );
  });

  test("tolerates a trailing slash on the site URL", () => {
    assert.equal(
      verifyUrl("EDT-1", "https://edrifttrikes.shop/"),
      "https://edrifttrikes.shop/verify/EDT-1"
    );
  });

  test("escapes an order number rather than building a broken address", () => {
    assert.equal(
      verifyUrl("EDT 1/2?x", "https://x.co"),
      "https://x.co/verify/EDT%201%2F2%3Fx"
    );
  });

  test("falls back to the company URL when none is passed", () => {
    assert.match(verifyUrl("EDT-1"), /^https:\/\/[^/]+\/verify\/EDT-1$/);
  });

  test("the live-check address is still printed, as readable text", async () => {
    // A separate thing from the code: the code says what the paper says, this
    // says what our records say. A reviewer on a screen will not scan anything.
    for (const [order, variant] of [[PAID, "paid"], [UNPAID, "proforma"]] as const) {
      const text = pdfText(
        await buildInvoice({ order, settings: SETTINGS, variant, siteUrl: "https://edrifttrikes.shop" })
      );
      assert.ok(
        text.includes("https://edrifttrikes.shop/verify/EDT-7A3F91C2"),
        `${variant}: the verification URL is not on the page as text`
      );
    }
  });

  test("the machine-readable section appears on both documents", async () => {
    for (const [order, variant] of [[PAID, "paid"], [UNPAID, "proforma"]] as const) {
      const text = pdfText(await buildInvoice({ order, settings: SETTINGS, variant }));
      assert.match(text, /THIS DOCUMENT, MACHINE-READABLE/, `missing from the ${variant}`);
      assert.match(text, /WHAT THE CODE CONTAINS/, `missing from the ${variant}`);
    }
  });
});
