import { test, describe, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  apiLoginId,
  authorizeNetConfigured,
  authorizeNetEnv,
  createHostedPaymentToken,
  fetchTransaction,
  hostedFormUrl,
  parseAnetJson,
} from "../lib/authorize-net";

/**
 * Authorize.Net.
 *
 * The parts that can silently take or fail to take money: which endpoint gets
 * hit, whether a response was understood, and — above all — whether a
 * transaction counts as PAID. Held-for-review is the one with no equivalent in
 * the Stripe or PayPal paths and the one most likely to be got wrong.
 */

const realEnv = { ...process.env };

beforeEach(() => {
  process.env.AUTHORIZENET_API_LOGIN_ID = "login";
  process.env.AUTHORIZENET_TRANSACTION_KEY = "key";
  process.env.AUTHORIZENET_ENV = "sandbox";
});

afterEach(() => {
  process.env = { ...realEnv };
});

describe("configuration", () => {
  /**
   * One account, three variables — the same shape as PAYPAL_CLIENT_ID /
   * PAYPAL_SECRET / PAYPAL_ENV. Swapping to a different Authorize.Net account
   * is swapping these, which is the same operation as rotating a Stripe key.
   */
  test("both credentials present means configured", () => {
    assert.equal(authorizeNetConfigured(), true);
    assert.equal(apiLoginId(), "login");
  });

  test("either credential missing disables the method", () => {
    delete process.env.AUTHORIZENET_TRANSACTION_KEY;
    assert.equal(authorizeNetConfigured(), false);

    process.env.AUTHORIZENET_TRANSACTION_KEY = "key";
    delete process.env.AUTHORIZENET_API_LOGIN_ID;
    assert.equal(authorizeNetConfigured(), false);
  });

  test("whitespace is not a credential", () => {
    // A secret set to an empty-looking value must take Authorize.Net off the
    // checkout page, not offer a method that fails at the gateway.
    process.env.AUTHORIZENET_API_LOGIN_ID = "   ";
    assert.equal(authorizeNetConfigured(), false);
  });

  test("credentials are read at call time, not at import", () => {
    // On Cloudflare, secrets are runtime bindings invisible at module scope. A
    // module-scope read would silently disable the method in production only.
    delete process.env.AUTHORIZENET_API_LOGIN_ID;
    assert.equal(authorizeNetConfigured(), false);
    process.env.AUTHORIZENET_API_LOGIN_ID = "late-arrival";
    assert.equal(authorizeNetConfigured(), true);
    assert.equal(apiLoginId(), "late-arrival");
  });

  test("env defaults to sandbox rather than production", () => {
    // If the value is missing or misspelled, the safe failure is taking no real
    // money — not taking it against the wrong endpoint.
    delete process.env.AUTHORIZENET_ENV;
    assert.equal(authorizeNetEnv(), "sandbox");
    process.env.AUTHORIZENET_ENV = "PRODUCTIOM";
    assert.equal(authorizeNetEnv(), "sandbox");
  });

  test("production is recognised whatever the case", () => {
    process.env.AUTHORIZENET_ENV = "Production";
    assert.equal(authorizeNetEnv(), "production");
  });

  test("the hosted form URL follows the environment", () => {
    // A production account pointed at the sandbox endpoint takes no money and
    // reports success, which is the worst of both.
    assert.match(hostedFormUrl(), /^https:\/\/test\.authorize\.net\//);
    process.env.AUTHORIZENET_ENV = "production";
    assert.match(hostedFormUrl(), /^https:\/\/accept\.authorize\.net\//);
  });
});

describe("the byte-order mark", () => {
  /**
   * Authorize.Net prefixes its JSON with a UTF-8 BOM, which JSON.parse rejects.
   * They have said they will not fix it — too many integrations depend on the
   * workaround — so this is permanent, not a shim.
   */
  test("parses a response that carries one", () => {
    const data = parseAnetJson<{ token: string }>('﻿{"token":"abc"}');
    assert.equal(data.token, "abc");
  });

  test("parses one that does not", () => {
    assert.equal(parseAnetJson<{ token: string }>('{"token":"abc"}').token, "abc");
  });

  test("says what came back when it is not JSON at all", () => {
    // A gateway outage returns an HTML error page; "Unexpected token <" tells
    // nobody anything.
    assert.throws(() => parseAnetJson("<html>502</html>"), /unparseable JSON/);
    assert.throws(() => parseAnetJson("﻿   "), /empty response/);
  });
});

/* -------------------------------------------------------------------------- */

/** Stand in for the gateway, returning a BOM-prefixed body as it really does. */
function stubGateway(body: unknown) {
  const calls: { url: string; body: unknown }[] = [];
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
    return new Response("﻿" + JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  return calls;
}

describe("minting the hosted payment page", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("sends the configured credentials and our order number", async () => {
    const calls = stubGateway({ token: "form-token", messages: { resultCode: "Ok" } });
    const token = await createHostedPaymentToken({
      amountCents: 425984,
      orderNumber: "EDT-7A3F91C2",
      returnUrl: "https://shop.example/return",
      cancelUrl: "https://shop.example/checkout",
      email: "rider@example.com",
    });
    assert.equal(token, "form-token");

    const sent = calls[0].body as Record<string, never>;
    const req = sent.getHostedPaymentPageRequest as Record<string, never>;
    assert.equal((req.merchantAuthentication as Record<string, string>).name, "login");
    // Credentials go in the BODY, not a header — unlike Stripe and PayPal.
    assert.equal(
      (req.merchantAuthentication as Record<string, string>).transactionKey,
      "key"
    );
    assert.equal(req.refId, "EDT-7A3F91C2");
    const tx = req.transactionRequest as Record<string, never>;
    assert.equal(tx.transactionType, "authCaptureTransaction");
    // Cents to a decimal string, which is what the gateway takes.
    assert.equal(tx.amount, "4259.84");
    assert.equal((tx.order as Record<string, string>).invoiceNumber, "EDT-7A3F91C2");
  });

  test("hits the endpoint for the configured environment", async () => {
    const calls = stubGateway({ token: "t", messages: { resultCode: "Ok" } });
    await createHostedPaymentToken({
      amountCents: 100,
      orderNumber: "EDT-1",
      returnUrl: "https://x/r",
      cancelUrl: "https://x/c",
    });
    assert.equal(calls[0].url, "https://apitest.authorize.net/xml/v1/request.api");

    process.env.AUTHORIZENET_ENV = "production";
    const live = stubGateway({ token: "t", messages: { resultCode: "Ok" } });
    await createHostedPaymentToken({
      amountCents: 100,
      orderNumber: "EDT-1",
      returnUrl: "https://x/r",
      cancelUrl: "https://x/c",
    });
    assert.equal(live[0].url, "https://api.authorize.net/xml/v1/request.api");
  });

  test("throws with the gateway's own reason when it refuses", async () => {
    stubGateway({
      messages: {
        resultCode: "Error",
        message: [{ code: "E00007", text: "User authentication failed." }],
      },
    });
    await assert.rejects(
      () =>
        createHostedPaymentToken({
          amountCents: 100,
          orderNumber: "EDT-1",
          returnUrl: "https://x/r",
          cancelUrl: "https://x/c",
        }),
      /E00007.*User authentication failed/
    );
  });

  test("throws rather than returning an empty token", async () => {
    // An empty token posts the buyer to a page that cannot render a card form.
    stubGateway({ messages: { resultCode: "Ok" } });
    await assert.rejects(
      () =>
        createHostedPaymentToken({
          amountCents: 100,
          orderNumber: "EDT-1",
          returnUrl: "https://x/r",
          cancelUrl: "https://x/c",
        }),
      /no payment page token/
    );
  });
});

describe("what counts as paid", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const transaction = (over: Record<string, unknown>) => ({
    messages: { resultCode: "Ok" },
    transaction: {
      transId: "60115585081",
      transactionStatus: "capturedPendingSettlement",
      responseCode: 1,
      settleAmount: "4259.84",
      order: { invoiceNumber: "EDT-7A3F91C2" },
      ...over,
    },
  });

  test("response code 1 is money taken", async () => {
    stubGateway(transaction({}));
    const t = await fetchTransaction("60115585081");
    assert.equal(t.paid, true);
    assert.equal(t.heldForReview, false);
    assert.equal(t.amountCents, 425984);
    assert.equal(t.orderNumber, "EDT-7A3F91C2");
  });

  test("HELD FOR REVIEW is not paid", async () => {
    /**
     * Code 4. The gateway has the transaction but has not approved it. It has
     * no equivalent in the Stripe or PayPal paths, and treating it as paid
     * means shipping goods against money that may never arrive.
     */
    stubGateway(transaction({ responseCode: 4 }));
    const t = await fetchTransaction("60115585081");
    assert.equal(t.paid, false);
    assert.equal(t.heldForReview, true);
  });

  test("declined and error are not paid", async () => {
    for (const code of [2, 3]) {
      stubGateway(transaction({ responseCode: code }));
      const t = await fetchTransaction("60115585081");
      assert.equal(t.paid, false, `code ${code} was treated as paid`);
      assert.equal(t.heldForReview, false);
    }
  });

  test("an unknown code is not paid", async () => {
    // Anything we do not recognise must fail closed.
    stubGateway(transaction({ responseCode: 99 }));
    assert.equal((await fetchTransaction("x")).paid, false);
    stubGateway(transaction({ responseCode: undefined }));
    assert.equal((await fetchTransaction("x")).paid, false);
  });

  test("falls back to the authorised amount before settlement", async () => {
    stubGateway(transaction({ settleAmount: undefined, authAmount: "10.00" }));
    assert.equal((await fetchTransaction("x")).amountCents, 1000);
  });

  test("a missing amount is zero, not NaN", async () => {
    // NaN would compare unequal to the order total and refuse the payment,
    // which is the right outcome — but it must be a number to get there.
    stubGateway(transaction({ settleAmount: undefined, authAmount: undefined }));
    assert.equal((await fetchTransaction("x")).amountCents, 0);
  });

  test("the lookup carries the same credentials the payment page did", async () => {
    // Asking with different keys than the ones that took the money is how a
    // real payment becomes invisible; the return handler guards the swapped-
    // account case separately, by comparing the login id recorded on the order.
    const calls = stubGateway(transaction({}));
    await fetchTransaction("60115585081");
    const req = (calls[0].body as Record<string, never>)
      .getTransactionDetailsRequest as Record<string, never>;
    assert.equal((req.merchantAuthentication as Record<string, string>).name, "login");
    assert.equal(req.transId, "60115585081");
  });

  test("a lookup the gateway rejects throws rather than reporting unpaid", async () => {
    // The difference matters: "not paid" and "we could not ask" need different
    // handling, and conflating them loses real payments.
    stubGateway({
      messages: { resultCode: "Error", message: [{ code: "E00040", text: "Not found." }] },
    });
    await assert.rejects(() => fetchTransaction("nope"), /E00040/);
  });
});
