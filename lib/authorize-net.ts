/**
 * Authorize.Net — a third card gateway alongside Stripe and PayPal.
 *
 * Accept Hosted: we mint a short-lived form token, the browser posts it to
 * Authorize.Net's own payment page, and the buyer's card never touches us. Same
 * shape as the Stripe Checkout redirect and the PayPal approval flow, so this
 * is a third instance of a pattern the codebase already runs twice — see
 * docs/AUTHORIZE-NET.md for why that shape was chosen over Accept.js.
 *
 * ═══ MULTI-ACCOUNT BY DESIGN ═══════════════════════════════════════════════
 *
 * An Authorize.Net gateway account is bound to ONE merchant account, with one
 * acquirer, in one country, settling one set of currencies. There is no key
 * that fans out across processors: five accounts in five countries means five
 * sets of credentials, and the integration has to hold all of them and pick
 * one per order. That is what ACCOUNTS below is.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * CREDENTIALS LIVE IN THE ENVIRONMENT, NOT THE DATABASE. A transaction key is
 * a bearer credential for moving money; the admin picks WHICH account is live
 * (a short id, stored in site_settings) but the keys themselves stay in
 * Cloudflare/Render secrets, where a database read cannot reach them.
 *
 * Plain fetch, no SDK: the official `authorizenet` package pulls in winston and
 * file-system logging and will not run on Workers.
 */

import { serverEnv } from "@/lib/env";

/* -------------------------------------------------------------------------- */
/* Accounts                                                                    */
/* -------------------------------------------------------------------------- */

export type AuthorizeNetAccount = {
  /** Short stable key the admin selects by, e.g. "us", "uk", "au". */
  id: string;
  /** Human label for the admin UI. */
  label: string;
  /** API Login ID. */
  loginId: string;
  /** Transaction Key. */
  transactionKey: string;
  /** `sandbox` or `production` — must match the key type. */
  env: "sandbox" | "production";
  /**
   * Currencies this account's merchant account can settle. Informational: the
   * store prices in USD, and this is what tells an admin which account can
   * actually take that money.
   */
  currencies: string[];
  /** ISO country of the merchant account, for the admin's benefit. */
  country?: string;
};

const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Every configured account, from AUTHORIZENET_ACCOUNTS.
 *
 * A JSON array, so five accounts are one secret rather than twenty variables:
 *
 *   [{"id":"us","label":"United States","loginId":"…","transactionKey":"…",
 *     "env":"production","currencies":["USD"],"country":"US"}]
 *
 * Malformed JSON disables the method rather than throwing: a typo in a secret
 * must not take checkout down, it must take Authorize.Net off the page and
 * leave Stripe and PayPal working.
 */
export function authorizeNetAccounts(): AuthorizeNetAccount[] {
  const raw = clean(serverEnv("AUTHORIZENET_ACCOUNTS"));
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[authorize-net] AUTHORIZENET_ACCOUNTS is not valid JSON");
    return [];
  }
  if (!Array.isArray(parsed)) {
    console.error("[authorize-net] AUTHORIZENET_ACCOUNTS must be a JSON array");
    return [];
  }

  const seen = new Set<string>();
  const out: AuthorizeNetAccount[] = [];
  for (const entry of parsed) {
    const a = (entry ?? {}) as Record<string, unknown>;
    const id = clean(a.id).toLowerCase();
    const loginId = clean(a.loginId);
    const transactionKey = clean(a.transactionKey);
    // An account missing any of the three is not an account. Skipping it beats
    // offering a payment method that will fail at the gateway.
    if (!id || !loginId || !transactionKey) continue;
    if (seen.has(id)) continue; // first wins; a duplicate id is a config error
    seen.add(id);
    out.push({
      id,
      label: clean(a.label) || id.toUpperCase(),
      loginId,
      transactionKey,
      env: clean(a.env).toLowerCase() === "production" ? "production" : "sandbox",
      currencies: Array.isArray(a.currencies)
        ? a.currencies.map((c) => clean(c).toUpperCase()).filter(Boolean)
        : [],
      country: clean(a.country).toUpperCase() || undefined,
    });
  }
  return out;
}

export function authorizeNetConfigured(): boolean {
  return authorizeNetAccounts().length > 0;
}

/**
 * The account an order should be charged against.
 *
 * `preferred` is the id the admin selected in settings. It wins when it names a
 * configured account; otherwise the first configured account is used, so a
 * setting left pointing at an account that has since been removed degrades to
 * taking the payment rather than refusing it.
 */
export function resolveAccount(
  preferred?: string | null
): AuthorizeNetAccount | null {
  const accounts = authorizeNetAccounts();
  if (accounts.length === 0) return null;
  const want = clean(preferred).toLowerCase();
  return accounts.find((a) => a.id === want) ?? accounts[0];
}

/** API endpoint for an account's environment. */
function apiUrl(account: AuthorizeNetAccount): string {
  return account.env === "production"
    ? "https://api.authorize.net/xml/v1/request.api"
    : "https://apitest.authorize.net/xml/v1/request.api";
}

/** Where the browser POSTs the form token. */
export function hostedFormUrl(account: AuthorizeNetAccount): string {
  return account.env === "production"
    ? "https://accept.authorize.net/payment/payment"
    : "https://test.authorize.net/payment/payment";
}

/* -------------------------------------------------------------------------- */
/* Transport                                                                   */
/* -------------------------------------------------------------------------- */

type AnetMessages = {
  resultCode?: string;
  message?: { code?: string; text?: string }[];
};

/**
 * POST a request and parse the reply.
 *
 * ⚠️ THE BOM. Authorize.Net prefixes its JSON responses with a UTF-8 byte-order
 * mark, which JSON.parse rejects outright. They have said they will not fix it —
 * too many integrations now depend on the workaround — so stripping it is
 * permanent, not a temporary shim.
 */
async function call<T>(
  account: AuthorizeNetAccount,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(apiUrl(account), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return parseAnetJson<T>(text);
}

/** Exported for tests: strip the BOM, then parse. */
export function parseAnetJson<T>(text: string): T {
  const trimmed = text.replace(/^﻿/, "").trim();
  if (!trimmed) throw new Error("Authorize.Net returned an empty response");
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(
      `Authorize.Net returned unparseable JSON: ${trimmed.slice(0, 200)}`
    );
  }
}

/** The envelope-level result, which is separate from the transaction result. */
function envelopeError(messages: AnetMessages | undefined): string | null {
  if (!messages) return "no messages in response";
  if (clean(messages.resultCode).toLowerCase() === "ok") return null;
  const first = messages.message?.[0];
  return `${clean(first?.code) || "unknown"}: ${clean(first?.text) || "request rejected"}`;
}

/* -------------------------------------------------------------------------- */
/* Hosted payment page                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Mint a form token for the hosted payment page.
 *
 * The token is short-lived, so this is called at the moment of redirect rather
 * than when the cart is built — an expired token shows the buyer an error page
 * instead of a card form.
 */
export async function createHostedPaymentToken(params: {
  account: AuthorizeNetAccount;
  amountCents: number;
  orderNumber: string;
  returnUrl: string;
  cancelUrl: string;
  email?: string;
}): Promise<string> {
  const amount = (Math.max(0, Math.round(params.amountCents)) / 100).toFixed(2);

  const settings = [
    {
      settingName: "hostedPaymentReturnOptions",
      settingValue: JSON.stringify({
        url: params.returnUrl,
        cancelUrl: params.cancelUrl,
        showReceipt: false,
      }),
    },
    { settingName: "hostedPaymentButtonOptions", settingValue: JSON.stringify({ text: "Pay" }) },
    // Our own checkout already showed the basket; repeating it on their page is
    // the noise the checkout was stripped back to remove.
    { settingName: "hostedPaymentOrderOptions", settingValue: JSON.stringify({ show: false }) },
    {
      settingName: "hostedPaymentPaymentOptions",
      settingValue: JSON.stringify({ showCreditCard: true, showBankAccount: false }),
    },
    // Return by POST to our handler, which re-fetches the transaction before it
    // believes anything — see app/api/authorize-net/return.
    {
      settingName: "hostedPaymentIFrameCommunicatorUrl",
      settingValue: JSON.stringify({ url: "" }),
    },
  ];

  const body = {
    getHostedPaymentPageRequest: {
      merchantAuthentication: {
        name: params.account.loginId,
        transactionKey: params.account.transactionKey,
      },
      // Our order number travels with the transaction, so the gateway's record
      // and ours can be reconciled without guesswork.
      refId: params.orderNumber.slice(0, 20),
      transactionRequest: {
        transactionType: "authCaptureTransaction",
        amount,
        order: { invoiceNumber: params.orderNumber.slice(0, 20) },
        ...(params.email ? { customer: { email: params.email.slice(0, 255) } } : {}),
      },
      hostedPaymentSettings: { setting: settings },
    },
  };

  const data = await call<{ token?: string; messages?: AnetMessages }>(
    params.account,
    body
  );
  const failure = envelopeError(data.messages);
  if (failure) throw new Error(`Authorize.Net refused the payment page — ${failure}`);
  const token = clean(data.token);
  if (!token) throw new Error("Authorize.Net returned no payment page token");
  return token;
}

/* -------------------------------------------------------------------------- */
/* Reading a transaction back                                                  */
/* -------------------------------------------------------------------------- */

/**
 * What a settled (or not) transaction actually says.
 *
 * `paid` is deliberately narrow: ONLY response code 1 is money taken. Code 4 is
 * "held for review" — the gateway has the transaction but has not approved it,
 * and treating that as paid means shipping goods nobody has paid for. It has no
 * equivalent in the Stripe or PayPal paths, which is exactly why it is easy to
 * get wrong.
 */
export type AuthorizeNetTransaction = {
  /** True only for an approved, captured transaction. */
  paid: boolean;
  /** True when the gateway is holding it for review — not paid, not refused. */
  heldForReview: boolean;
  transId: string;
  /** Amount the gateway actually took, in cents. */
  amountCents: number;
  /** Our order number, echoed back from the invoice number. */
  orderNumber: string;
  status: string;
  message: string;
};

const RESPONSE_CODE: Record<string, string> = {
  "1": "approved",
  "2": "declined",
  "3": "error",
  "4": "held for review",
};

/** Money as cents, from Authorize.Net's decimal string. */
function toCents(value: unknown): number {
  const n = Number(clean(value) || value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/**
 * Fetch a transaction by id and report what it really is.
 *
 * THE RETURN HANDLER MUST USE THIS rather than trusting what came back in the
 * browser. The buyer controls the return request; only the gateway's own answer
 * establishes that money moved, for how much, and against which order.
 */
export async function fetchTransaction(
  account: AuthorizeNetAccount,
  transId: string
): Promise<AuthorizeNetTransaction> {
  const data = await call<{
    transaction?: {
      transId?: string;
      transactionStatus?: string;
      responseCode?: number | string;
      authAmount?: number | string;
      settleAmount?: number | string;
      order?: { invoiceNumber?: string };
      responseReasonDescription?: string;
    };
    messages?: AnetMessages;
  }>(account, {
    getTransactionDetailsRequest: {
      merchantAuthentication: {
        name: account.loginId,
        transactionKey: account.transactionKey,
      },
      transId: clean(transId),
    },
  });

  const failure = envelopeError(data.messages);
  if (failure) throw new Error(`Authorize.Net transaction lookup failed — ${failure}`);

  const t = data.transaction ?? {};
  const code = String(t.responseCode ?? "");
  return {
    paid: code === "1",
    heldForReview: code === "4",
    transId: clean(t.transId) || clean(transId),
    // settleAmount once settled, authAmount before that; either is what the
    // gateway took, and the caller compares it against the order total.
    amountCents: toCents(t.settleAmount ?? t.authAmount),
    orderNumber: clean(t.order?.invoiceNumber),
    status: clean(t.transactionStatus),
    message:
      clean(t.responseReasonDescription) ||
      RESPONSE_CODE[code] ||
      `response code ${code || "unknown"}`,
  };
}
