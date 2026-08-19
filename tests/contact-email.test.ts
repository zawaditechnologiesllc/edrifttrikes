import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { resendFailureHint, sendContactMessage } from "../lib/email";

/**
 * The support form must never 500.
 *
 * The regression this pins: `sendContactMessage` used to return the customer
 * acknowledgement send un-caught. `resendSend` throws on any non-2xx, and
 * Resend rejects mail to a customer's address until a sending domain is
 * verified — so every support message from a real visitor threw out of a
 * server action, which the browser sees as a 500.
 */

const realFetch = globalThis.fetch;

/** Stub Resend's HTTP API with a fixed response for every send. */
function stubResend(status: number, body: Record<string, unknown>) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

/** Reject only when sending to a specific recipient — Resend's real behaviour. */
function stubResendRejectingRecipient(blocked: string) {
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    const payload = JSON.parse(String(init?.body ?? "{}")) as { to?: string };
    if (payload.to === blocked) {
      return new Response(
        JSON.stringify({
          message: `You can only send testing emails to your own email address. To send emails to other recipients, please verify a domain at resend.com/domains`,
        }),
        { status: 403, headers: { "content-type": "application/json" } }
      );
    }
    return new Response(JSON.stringify({ id: "sent" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

const MESSAGE = {
  name: "A rider",
  email: "customer@example.com",
  subject: "Question about shipping",
  message: "When will my order arrive?",
};

describe("sendContactMessage", () => {
  const previousKey = process.env.RESEND_API_KEY;
  const previousNotify = process.env.ORDERS_NOTIFICATION_EMAIL;

  afterEach(() => {
    globalThis.fetch = realFetch;
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
    if (previousNotify === undefined) delete process.env.ORDERS_NOTIFICATION_EMAIL;
    else process.env.ORDERS_NOTIFICATION_EMAIL = previousNotify;
  });

  test("does not throw when Resend rejects the customer acknowledgement", async () => {
    // The exact production shape: mail to the store's own address is accepted,
    // mail to the customer is refused because the domain isn't verified.
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.ORDERS_NOTIFICATION_EMAIL = "owner@edrifttrikes.shop";
    stubResendRejectingRecipient(MESSAGE.email);

    const result = await sendContactMessage(MESSAGE);

    // The store still hears about it — which is what decides the customer sees
    // a success screen rather than a 500.
    assert.equal(result.ownerNotified, true);
    assert.equal(result.customerAcknowledged, false);
    assert.ok(result.error, "the failure reason should be reported for logging");
  });

  test("does not throw when Resend rejects everything", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.ORDERS_NOTIFICATION_EMAIL = "owner@edrifttrikes.shop";
    stubResend(422, { message: "The from address is not verified." });

    const result = await sendContactMessage(MESSAGE);

    assert.equal(result.ownerNotified, false);
    assert.equal(result.customerAcknowledged, false);
    assert.ok(result.error);
  });

  test("does not throw when the network itself fails", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    globalThis.fetch = (async () => {
      throw new Error("connect ECONNREFUSED");
    }) as typeof fetch;

    const result = await sendContactMessage(MESSAGE);
    assert.equal(result.ownerNotified, false);
    assert.equal(result.customerAcknowledged, false);
  });

  test("reports both sends when Resend accepts them", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.ORDERS_NOTIFICATION_EMAIL = "owner@edrifttrikes.shop";
    stubResend(200, { id: "sent" });

    const result = await sendContactMessage(MESSAGE);
    assert.equal(result.ownerNotified, true);
    assert.equal(result.customerAcknowledged, true);
    assert.equal(result.error, undefined);
  });
});

describe("resendFailureHint", () => {
  test("names the domain-verification remedy, the dominant failure", () => {
    for (const message of [
      "You can only send testing emails to your own email address.",
      "The edrifttrikes.shop domain is not verified.",
      "Please verify a domain at resend.com/domains",
    ]) {
      const hint = resendFailureHint(message);
      assert.ok(hint, `no hint for: ${message}`);
      assert.match(hint, /domain/i);
    }
  });

  test("stays quiet for unrelated failures rather than misdiagnosing them", () => {
    assert.equal(resendFailureHint("Rate limit exceeded"), null);
    assert.equal(resendFailureHint("HTTP 500"), null);
    assert.equal(resendFailureHint(""), null);
  });
});
