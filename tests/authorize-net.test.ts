import { test, describe, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  authorizeNetAccounts,
  authorizeNetConfigured,
  createHostedPaymentToken,
  fetchTransaction,
  hostedFormUrl,
  parseAnetJson,
  resolveAccount,
  type AuthorizeNetAccount,
} from "../lib/authorize-net";

/**
 * Authorize.Net.
 *
 * The parts that can silently take or fail to take money: which account gets
 * charged, whether a response was understood, and — above all — whether a
 * transaction counts as PAID. Held-for-review is the one with no equivalent in
 * the Stripe or PayPal paths and the one most likely to be got wrong.
 */

const realEnv = { ...process.env };

const ACCOUNTS = [
  {
    id: "us",
    label: "United States",
    loginId: "us-login",
    transactionKey: "us-key",
    env: "production",
    currencies: ["USD"],
    country: "US",
  },
  {
    id: "uk",
    label: "United Kingdom",
    loginId: "uk-login",
    transactionKey: "uk-key",
    env: "sandbox",
    currencies: ["GBP", "EUR"],
    country: "GB",
  },
];

beforeEach(() => {
  process.env.AUTHORIZENET_ACCOUNTS = JSON.stringify(ACCOUNTS);
});

afterEach(() => {
  process.env = { ...realEnv };
});

describe("several accounts, because that is how the gateway works", () => {
  /**
   * An Authorize.Net gateway account is bound to one merchant account, one
   * acquirer and one country. There is no key that fans out across processors:
   * five countries means five credential sets, and the integration holds all of
   * them and picks one per order.
   */
  test("reads every configured account", () => {
    const accounts = authorizeNetAccounts();
    assert.equal(accounts.length, 2);
    assert.deepEqual(accounts.map((a) => a.id), ["us", "uk"]);
    assert.equal(accounts[0].env, "production");
    assert.equal(accounts[1].env, "sandbox");
  });

  test("the admin's choice decides which account is charged", () => {
    assert.equal(resolveAccount("uk")?.loginId, "uk-login");
    assert.equal(resolveAccount("us")?.loginId, "us-login");
  });

  test("a choice naming an account that no longer exists still takes the money", () => {
    // Falling back beats refusing the payment: an account removed from the
    // secret should not take checkout down with it.
    assert.equal(resolveAccount("removed")?.id, "us");
    assert.equal(resolveAccount(null)?.id, "us");
    assert.equal(resolveAccount(undefined)?.id, "us");
  });

  test("each account gets the endpoints for its OWN environment", () => {
    // A production account pointed at the sandbox endpoint takes no money and
    // reports success, which is the worst of both.
    const [us, uk] = authorizeNetAccounts();
    assert.match(hostedFormUrl(us), /^https:\/\/accept\.authorize\.net\//);
    assert.match(hostedFormUrl(uk), /^https:\/\/test\.authorize\.net\//);
  });

  test("env defaults to sandbox rather than production", () => {
    // If the value is missing or misspelled, the safe failure is taking no real
    // money — not taking it against the wrong endpoint.
    process.env.AUTHORIZENET_ACCOUNTS = JSON.stringify([
      { id: "x", loginId: "l", transactionKey: "k" },
      { id: "y", loginId: "l", transactionKey: "k", env: "PRODUCTIOM" },
    ]);
    assert.deepEqual(authorizeNetAccounts().map((a) => a.env), ["sandbox", "sandbox"]);
  });
});

describe("bad configuration disables the method, it does not crash checkout", () => {
  test("no secret at all", () => {
    delete process.env.AUTHORIZENET_ACCOUNTS;
    assert.deepEqual(authorizeNetAccounts(), []);
    assert.equal(authorizeNetConfigured(), false);
    assert.equal(resolveAccount("us"), null);
  });

  test("malformed JSON", () => {
    // A typo in a secret must take Authorize.Net off the checkout page and
    // leave Stripe and PayPal working — not throw inside the checkout route.
    process.env.AUTHORIZENET_ACCOUNTS = "{not json";
    assert.deepEqual(authorizeNetAccounts(), []);
    assert.equal(authorizeNetConfigured(), false);
  });

  test("an object instead of an array", () => {
    process.env.AUTHORIZENET_ACCOUNTS = JSON.stringify({ id: "us" });
    assert.deepEqual(authorizeNetAccounts(), []);
  });

  test("entries missing credentials are skipped, not half-offered", () => {
    process.env.AUTHORIZENET_ACCOUNTS = JSON.stringify([
      { id: "good", loginId: "l", transactionKey: "k" },
      { id: "no-key", loginId: "l" },
      { id: "no-login", transactionKey: "k" },
      { loginId: "l", transactionKey: "k" },
    ]);
    assert.deepEqual(authorizeNetAccounts().map((a) => a.id), ["good"]);
  });

  test("a duplicate id does not create two accounts under one name", () => {
    process.env.AUTHORIZENET_ACCOUNTS = JSON.stringify([
      { id: "us", loginId: "first", transactionKey: "k" },
      { id: "us", loginId: "second", transactionKey: "k" },
    ]);
    const accounts = authorizeNetAccounts();
    assert.equal(accounts.length, 1);
    assert.equal(accounts[0].loginId, "first");
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

const ACCOUNT: AuthorizeNetAccount = {
  id: "us",
  label: "US",
  loginId: "login",
  transactionKey: "key",
  env: "sandbox",
  currencies: ["USD"],
};

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

  test("sends the account's credentials and our order number", async () => {
    const calls = stubGateway({ token: "form-token", messages: { resultCode: "Ok" } });
    const token = await createHostedPaymentToken({
      account: ACCOUNT,
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

  test("hits the endpoint for the account's environment", async () => {
    const calls = stubGateway({ token: "t", messages: { resultCode: "Ok" } });
    await createHostedPaymentToken({
      account: { ...ACCOUNT, env: "production" },
      amountCents: 100,
      orderNumber: "EDT-1",
      returnUrl: "https://x/r",
      cancelUrl: "https://x/c",
    });
    assert.equal(calls[0].url, "https://api.authorize.net/xml/v1/request.api");
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
          account: ACCOUNT,
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
          account: ACCOUNT,
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
    const t = await fetchTransaction(ACCOUNT, "60115585081");
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
    const t = await fetchTransaction(ACCOUNT, "60115585081");
    assert.equal(t.paid, false);
    assert.equal(t.heldForReview, true);
  });

  test("declined and error are not paid", async () => {
    for (const code of [2, 3]) {
      stubGateway(transaction({ responseCode: code }));
      const t = await fetchTransaction(ACCOUNT, "60115585081");
      assert.equal(t.paid, false, `code ${code} was treated as paid`);
      assert.equal(t.heldForReview, false);
    }
  });

  test("an unknown code is not paid", async () => {
    // Anything we do not recognise must fail closed.
    stubGateway(transaction({ responseCode: 99 }));
    assert.equal((await fetchTransaction(ACCOUNT, "x")).paid, false);
    stubGateway(transaction({ responseCode: undefined }));
    assert.equal((await fetchTransaction(ACCOUNT, "x")).paid, false);
  });

  test("falls back to the authorised amount before settlement", async () => {
    stubGateway(transaction({ settleAmount: undefined, authAmount: "10.00" }));
    assert.equal((await fetchTransaction(ACCOUNT, "x")).amountCents, 1000);
  });

  test("a missing amount is zero, not NaN", async () => {
    // NaN would compare unequal to the order total and refuse the payment,
    // which is the right outcome — but it must be a number to get there.
    stubGateway(transaction({ settleAmount: undefined, authAmount: undefined }));
    assert.equal((await fetchTransaction(ACCOUNT, "x")).amountCents, 0);
  });

  test("a lookup the gateway rejects throws rather than reporting unpaid", async () => {
    // The difference matters: "not paid" and "we could not ask" need different
    // handling, and conflating them loses real payments.
    stubGateway({
      messages: { resultCode: "Error", message: [{ code: "E00040", text: "Not found." }] },
    });
    await assert.rejects(() => fetchTransaction(ACCOUNT, "nope"), /E00040/);
  });
});
