import { test, describe, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { noReplyFrom, refundCopy, sendRefundEmail } from "../lib/email";
import { COMPANY } from "../lib/company";
import type { Order } from "../lib/types";

/**
 * The refund notice.
 *
 * Marking an order refunded used to send the customer nothing at all — their
 * first sign was a credit appearing, or failing to appear, on a statement days
 * later. This is the one email in the store that is purely about money leaving
 * an order, so what it promises has to be exactly what the business does.
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

const ORDER = {
  id: "o1",
  order_number: "ED-2026-0148",
  email: "rider@example.com",
  currency: "usd",
  subtotal_cents: 189900,
  shipping_cents: 0,
  tax_cents: 15192,
  total_cents: 205092,
  status: "refunded",
  created_at: "2026-08-01T10:00:00Z",
  paid_at: "2026-08-01T10:04:00Z",
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

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "E-Drift Trikes <orders@edrifttrikes.shop>";
  delete process.env.EMAIL_FROM_NOREPLY;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...realEnv };
});

describe("noReplyFrom", () => {
  test("keeps the sending domain, because that is what Resend verified", () => {
    // Resend verifies a DOMAIN, so no-reply@ on the same domain can send too.
    // Inventing an address on some other domain would simply bounce.
    process.env.EMAIL_FROM = "E-Drift Trikes <orders@edrifttrikes.shop>";
    assert.equal(noReplyFrom(), "E-Drift Trikes <no-reply@edrifttrikes.shop>");
  });

  test("handles a bare address with no display name", () => {
    process.env.EMAIL_FROM = "orders@edrifttrikes.shop";
    assert.equal(noReplyFrom(), `${COMPANY.name} <no-reply@edrifttrikes.shop>`);
  });

  test("leaves the resend.dev sandbox alone — only onboarding@ may send there", () => {
    // Rewriting this one would break every refund email on a store that hasn't
    // verified a domain yet, which is exactly when the owner is testing.
    process.env.EMAIL_FROM = "E-Drift Trikes <onboarding@resend.dev>";
    assert.equal(noReplyFrom(), "E-Drift Trikes <onboarding@resend.dev>");
  });

  test("falls back safely when EMAIL_FROM is unset or unparseable", () => {
    delete process.env.EMAIL_FROM;
    assert.ok(noReplyFrom().includes("resend.dev"));
    process.env.EMAIL_FROM = "not an address";
    assert.equal(noReplyFrom(), "not an address");
  });

  test("an explicit override wins", () => {
    process.env.EMAIL_FROM_NOREPLY = "E-Drift <do-not-reply@edrifttrikes.shop>";
    assert.equal(noReplyFrom(), "E-Drift <do-not-reply@edrifttrikes.shop>");
  });
});

describe("what the refund notice promises", () => {
  const copy = refundCopy(ORDER);

  test("names the amount and the order", () => {
    assert.ok(copy.subject.includes("ED-2026-0148"));
    const all = copy.paragraphs.join(" ");
    assert.ok(all.includes("$2,050.92"), "the refund amount is missing");
    assert.ok(all.includes("ED-2026-0148"));
  });

  test("quotes the processing window the business actually works to", () => {
    // Refunds are issued by hand. If COMPANY.refundProcessingDays changes, the
    // email must change with it rather than keeping a stale promise.
    const all = copy.paragraphs.join(" ");
    assert.ok(
      all.includes(`within ${COMPANY.refundProcessingDays} days`),
      "the email does not state the processing window"
    );
    assert.ok(all.toLowerCase().includes("manually"), "it does not say refunds are manual");
  });

  test("tells the customer what to do if the money hasn't appeared", () => {
    const all = copy.paragraphs.join(" ").toLowerCase();
    assert.ok(all.includes("bank"), "no guidance about the bank");
    assert.ok(
      all.includes("has not appeared") || all.includes("not appeared"),
      "it never addresses the money not showing up"
    );
  });

  test("reads as a statement of fact, not an apology or a promise to chase", () => {
    // This email closes a loop. Anything that invites a reply belongs in the
    // footer pointing at support, not in the body.
    const all = copy.paragraphs.join(" ");
    assert.ok(!/sorry|apolog/i.test(all), "the body editorialises");
    assert.ok(!/we will contact you|get back to you/i.test(all));
  });
});

describe("how the refund notice is sent", () => {
  test("comes from no-reply on the company domain", async () => {
    const cap = captureResend();
    await sendRefundEmail(ORDER);
    assert.equal(cap.payload().from, "E-Drift Trikes <no-reply@edrifttrikes.shop>");
  });

  test("still routes a reply to a human", async () => {
    // "No-reply" describes the mailbox, not the customer's options — someone
    // who hits reply about their money must not land in a void.
    const cap = captureResend();
    await sendRefundEmail(ORDER);
    assert.equal(cap.payload().reply_to, COMPANY.supportEmail);
  });

  test("goes to the buyer, with the refund amount in the body", async () => {
    const cap = captureResend();
    await sendRefundEmail(ORDER);
    const sent = cap.payload();
    assert.equal(sent.to, "rider@example.com");
    assert.match(String(sent.subject), /Refund initiated/);
    const html = String(sent.html);
    assert.ok(html.includes("$2,050.92"));
    assert.ok(html.includes("ED-2026-0148"));
    assert.ok(html.includes(COMPANY.supportEmail), "no support address to chase");
  });

  test("itemises the order in refund language, not shipping language", async () => {
    // The shared items block is written for delivery updates. On a refund,
    // "In this shipment" and "Shipped free of charge" describe something that
    // is now explicitly not happening.
    const cap = captureResend();
    await sendRefundEmail(ORDER);
    const html = String(cap.payload().html);
    assert.ok(html.includes("Volt S1 Pro"), "the items are missing");
    assert.ok(html.includes("Voltage Blue"), "the colour bought is missing");
    assert.ok(!html.includes("In this shipment"), "shipping wording leaked in");
    assert.ok(!html.includes("Shipped free of charge"), "shipping wording leaked in");
  });

  test("surfaces a rejection instead of reporting a send that never happened", async () => {
    // The admin has to know the customer was not told — that is the difference
    // between a closed loop and a support ticket.
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: "domain is not verified" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
    await assert.rejects(() => sendRefundEmail(ORDER), /not verified/i);
  });

  test("without Resend configured it does not pretend to have sent", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RENDER_API_URL;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    await sendRefundEmail(ORDER);
    assert.equal(called, false, "it called out with no mail path configured");
  });
});
