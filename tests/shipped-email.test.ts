import { test, describe, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { sendFulfillmentEmail } from "../lib/email";
import { generateTrackingNumber } from "../lib/couriers";
import { DELIVERY_BUFFER_DAYS } from "../lib/delivery";
import type { Order } from "../lib/types";

/**
 * The email a customer gets when their order ships.
 *
 * It carries two things this store had to get right: an explanation of why the
 * quoted date is so far out, and a tracking number that either leads somewhere
 * or is honestly presented as not leading anywhere. Both are tested against the
 * RENDERED HTML rather than the copy strings, because the failure that matters
 * is what lands in the inbox.
 */

const realFetch = globalThis.fetch;
const realEnv = { ...process.env };

/** Capture the payload that would go to Resend, without sending anything. */
function captureResend(): { payload: () => Record<string, unknown> } {
  let sent: Record<string, unknown> = {};
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    if (String(url).includes("api.resend.com")) {
      sent = JSON.parse(String(init?.body ?? "{}"));
      return new Response(JSON.stringify({ id: "sent" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  return { payload: () => sent };
}

const BASE = {
  id: "o1",
  order_number: "ED-2026-0148",
  email: "rider@example.com",
  currency: "usd",
  subtotal_cents: 189900,
  shipping_cents: 0,
  tax_cents: 0,
  total_cents: 189900,
  status: "paid",
  created_at: "2026-08-01T10:00:00Z",
  paid_at: "2026-08-01T10:04:00Z",
  estimated_delivery_at: "2026-08-21T10:04:00Z",
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
      color: "Voltage Blue",
    },
  ],
} as unknown as Order;

const order = (extra: Record<string, unknown> = {}) =>
  ({ ...BASE, ...extra }) as unknown as Order;

/** Render the shipped email and hand back its HTML. */
async function shippedHtml(extra: Record<string, unknown> = {}): Promise<string> {
  const cap = captureResend();
  await sendFulfillmentEmail(order(extra), "shipped");
  return String(cap.payload().html ?? "");
}

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "E-Drift Trikes <orders@edrifttrikes.shop>";
});

afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...realEnv };
});

describe("why the date is so far out", () => {
  test("the shipped email explains the buffer", async () => {
    const html = await shippedHtml();
    assert.match(html, new RegExp(`${DELIVERY_BUFFER_DAYS}-day buffer`));
    assert.match(html, /hold-up at the courier/i);
    assert.match(html, /arrive ahead of it/i);
  });

  test("and still gives them the date", async () => {
    const html = await shippedHtml();
    assert.match(html, /August 21, 2026/);
  });

  test("the explanation is not repeated on the delivered notice", async () => {
    const cap = captureResend();
    await sendFulfillmentEmail(order(), "delivered");
    assert.doesNotMatch(String(cap.payload().html ?? ""), /buffer/i);
  });
});

describe("the tracking number in the inbox", () => {
  test("is a link when the courier has a tracking page", async () => {
    const html = await shippedHtml({
      tracking_number: "1Z999AA10123456784",
      courier: "UPS",
    });
    assert.match(html, /href="https:\/\/www\.ups\.com\/track\?tracknum=1Z999AA10123456784"/);
    assert.match(html, /1Z999AA10123456784/);
    assert.match(html, /\(UPS\)/);
  });

  test("is PLAIN TEXT for our own reference, even with a courier selected", async () => {
    // The one that would cost a support conversation: UPS has never heard of
    // an EDT- number, so a link would land the customer on "not found" and
    // they would conclude nothing had shipped.
    const ours = generateTrackingNumber();
    const html = await shippedHtml({ tracking_number: ours, courier: "UPS" });
    assert.match(html, new RegExp(ours));
    assert.doesNotMatch(html, /href="https:\/\/www\.ups\.com/);
  });

  test("is plain text when we hold no tracking page for that courier", async () => {
    const html = await shippedHtml({ tracking_number: "ABC123", courier: "Yodel" });
    assert.match(html, /ABC123/);
    assert.match(html, /\(Yodel\)/);
    assert.doesNotMatch(html, /href="https?:\/\/(?!.*edrifttrikes)/);
  });

  test("says nothing about tracking when there is no number yet", async () => {
    const html = await shippedHtml();
    assert.doesNotMatch(html, /Tracking number/);
  });

  test("a courier name with an ampersand cannot break the markup", async () => {
    const html = await shippedHtml({
      tracking_number: "ABC123",
      courier: "Smith & Sons <Couriers>",
    });
    assert.doesNotMatch(html, /Smith & Sons <Couriers>/);
    assert.match(html, /Smith &amp; Sons/);
  });
});

describe("the confirmation receipt", () => {
  test("links the tracking number there too, when it can", async () => {
    const cap = captureResend();
    await sendFulfillmentEmail(
      order({ tracking_number: "1Z999AA10123456784", courier: "UPS" }),
      "confirmed"
    );
    const html = String(cap.payload().html ?? "");
    assert.match(html, /Your receipt/);
    assert.match(html, /href="https:\/\/www\.ups\.com\/track\?tracknum=1Z999AA10123456784"/);
  });
});
