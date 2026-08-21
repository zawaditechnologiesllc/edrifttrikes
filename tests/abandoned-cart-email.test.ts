import { test, describe, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { noReplyFrom, sendAbandonedCartEmail } from "../lib/email";
import { COMPANY } from "../lib/company";
import type { Order } from "../lib/types";

/**
 * The email an UNPAID order gets.
 *
 * An order row exists the moment the checkout form is submitted, before any
 * money has moved. The store used to send a confirmation there — confirming an
 * order the buyer might never pay for, and one an admin has not yet accepted.
 * This is what goes out instead: what they chose, and a way back to finish.
 *
 * The confirmation is now the `confirmed` fulfilment email, which fires only
 * when the order is actually marked paid.
 */

const realFetch = globalThis.fetch;
const realEnv = { ...process.env };

/** Capture what would go to Resend, without sending anything. */
function captureResend(): { all: () => Record<string, unknown>[] } {
  const sent: Record<string, unknown>[] = [];
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    if (String(url).includes("api.resend.com")) {
      sent.push(JSON.parse(String(init?.body ?? "{}")));
      return new Response(JSON.stringify({ id: "sent" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  return { all: () => sent };
}

const ORDER = {
  id: "o1",
  order_number: "ED-2026-0148",
  email: "rider@example.com",
  user_id: null,
  currency: "usd",
  subtotal_cents: 189900,
  shipping_cents: 5000,
  tax_cents: 15192,
  total_cents: 210092,
  // The state that matters: the row exists, the money does not.
  status: "pending",
  created_at: "2026-08-21T10:00:00Z",
  updated_at: "2026-08-21T10:00:00Z",
  stripe_session_id: null,
  shipping_address: {
    first_name: "A",
    last_name: "Rider",
    address: "1600 Pennsylvania Ave NW",
    city: "Washington",
    state: "DC",
    zip: "20500",
    country: "United States",
  },
  items: [
    {
      id: "i1",
      order_id: "o1",
      product_id: "p1",
      name: "Volt S1 Pro",
      slug: "volt-s1-pro",
      price_cents: 189900,
      qty: 1,
      image_url: null,
      color: "Midnight Black",
    },
  ],
} as unknown as Order;

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.EMAIL_FROM = "E-Drift Trikes <orders@edrifttrikes.shop>";
  process.env.NEXT_PUBLIC_SITE_URL = "https://edrifttrikes.shop";
  delete process.env.ORDERS_NOTIFICATION_EMAIL;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...realEnv };
});

/** Readable text of the buyer's copy. */
function buyerText(sent: Record<string, unknown>[]): string {
  const buyer = sent.find((m) => m.to === ORDER.email);
  assert.ok(buyer, "nothing was sent to the buyer");
  return String(buyer.html)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("who it goes to and how it is sent", () => {
  test("goes to the address on the order", async () => {
    const cap = captureResend();
    await sendAbandonedCartEmail(ORDER);
    assert.equal(cap.all()[0].to, "rider@example.com");
  });

  test("comes from no-reply on our own domain, replying to support", async () => {
    // Resend verifies a whole DOMAIN, so no-reply@ on the sending domain is
    // already authorised. An address on any other domain would simply bounce.
    const cap = captureResend();
    await sendAbandonedCartEmail(ORDER);
    const sent = cap.all()[0];
    assert.equal(sent.from, noReplyFrom());
    assert.match(String(sent.from), /no-reply@edrifttrikes\.shop/);
    // A buyer replying about their money must still reach a person.
    assert.equal(sent.reply_to, COMPANY.supportEmail);
  });

  test("the subject says the order is waiting, not that it is confirmed", async () => {
    const cap = captureResend();
    await sendAbandonedCartEmail(ORDER);
    const subject = String(cap.all()[0].subject);
    assert.ok(subject.includes(ORDER.order_number), "the order number is missing");
    assert.doesNotMatch(subject, /confirm/i, "the subject confirms an unpaid order");
  });
});

describe("what it tells the buyer", () => {
  test("is explicit that nothing has been charged", async () => {
    // The single most important line. A buyer who thinks they have paid will
    // wait for a delivery that is never coming, and then dispute.
    const cap = captureResend();
    await sendAbandonedCartEmail(ORDER);
    const text = buyerText(cap.all());
    assert.match(text, /haven't received payment/i);
    assert.match(text, /nothing has been charged/i);
  });

  test("never claims the order is confirmed or placed", async () => {
    const cap = captureResend();
    await sendAbandonedCartEmail(ORDER);
    const text = buyerText(cap.all());
    assert.doesNotMatch(text, /order (is )?confirmed/i);
    assert.doesNotMatch(text, /thanks for your order/i);
  });

  test("carries the full receipt, so they know exactly what is waiting", async () => {
    const cap = captureResend();
    await sendAbandonedCartEmail(ORDER);
    const text = buyerText(cap.all());
    assert.ok(text.includes("ED-2026-0148"), "no order number");
    assert.ok(text.includes("Volt S1 Pro"), "the item is missing");
    assert.ok(text.includes("Midnight Black"), "the chosen colour is missing");
    assert.ok(text.includes("$2,100.92"), "the total is missing");
    assert.ok(text.includes("1600 Pennsylvania Ave NW"), "the address is missing");
  });

  test("gives them a way back to finish", async () => {
    const cap = captureResend();
    await sendAbandonedCartEmail(ORDER);
    assert.match(String(cap.all()[0].html), /https:\/\/edrifttrikes\.shop\/cart/);
  });

  test("says NOTHING about duty, customs or import charges", async () => {
    const cap = captureResend();
    await sendAbandonedCartEmail(ORDER);
    for (const message of cap.all()) {
      assert.doesNotMatch(String(message.html), /duty|customs|import charge|tariff/i);
    }
  });
});

describe("the alert to the store owner", () => {
  test("fires on the UNPAID order, because that is what needs acting on", async () => {
    // The admin is the one who marks an order paid. Telling them only once
    // payment lands would be telling them after the thing they had to do.
    process.env.ORDERS_NOTIFICATION_EMAIL = "owner@edrifttrikes.shop";
    const cap = captureResend();
    await sendAbandonedCartEmail(ORDER);
    const alert = cap.all().find((m) => m.to === "owner@edrifttrikes.shop");
    assert.ok(alert, "the owner was not alerted");
    assert.match(String(alert.subject), /unpaid/i);
    assert.match(String(alert.html), /mark it paid/i);
  });

  test("is skipped when no alert address is configured", async () => {
    const cap = captureResend();
    await sendAbandonedCartEmail(ORDER);
    assert.equal(cap.all().length, 1, "something other than the buyer copy was sent");
  });

  test("a failed owner alert never costs the buyer their email", async () => {
    // Best-effort by design: the buyer's copy is the one that matters.
    process.env.ORDERS_NOTIFICATION_EMAIL = "owner@edrifttrikes.shop";
    let call = 0;
    globalThis.fetch = (async () => {
      call += 1;
      // First call is the buyer, second is the owner alert.
      if (call === 2) return new Response("nope", { status: 500 });
      return new Response(JSON.stringify({ id: "sent" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    await sendAbandonedCartEmail(ORDER);
    assert.equal(call, 2, "the owner alert was never attempted");
  });
});
