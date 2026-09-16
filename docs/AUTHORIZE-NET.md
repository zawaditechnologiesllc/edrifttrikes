# Authorize.Net

**Implemented and wired end to end** — checkout, database, admin, invoices and
webhooks. It is **dormant until credentials are set**: with no
`AUTHORIZENET_ACCOUNTS` secret, the method simply is not offered, exactly as
PayPal behaves without its keys.

Research notes on the API, and the plan this was built from, follow the setup.

Read [`PAYMENTS.md`](PAYMENTS.md) first — it describes the two-host split
(Cloudflare starts a payment, Render confirms it) that this fits into.

---

## Turning it on

1. **Run the migrations**: `0018_gateway_reference.sql` and
   `0019_authorizenet_account.sql`. Admin → System lists them.
2. **Set `AUTHORIZENET_ACCOUNTS`** on Cloudflare *and* Render — a JSON array,
   one entry per gateway account:

   ```json
   [
     {"id":"us","label":"United States","loginId":"…","transactionKey":"…",
      "env":"production","currencies":["USD"],"country":"US"},
     {"id":"uk","label":"United Kingdom","loginId":"…","transactionKey":"…",
      "env":"production","currencies":["GBP","EUR"],"country":"GB"}
   ]
   ```

3. **Set `AUTHORIZENET_SIGNATURE_KEY`** on Render (webhooks only).
4. **Point the webhook** at `https://<render-url>/authorizenet/webhook` and
   subscribe to `net.authorize.payment.authcapture.created`.
5. **Pick the live account** in Admin → Settings → Authorize.Net.

Check `/api/health` → `payments.authorizenet`: it reports **how many accounts
parsed**, which is the actual question when the method is not appearing. `0`
means the secret is missing or malformed — never the ids, never the keys.

### Several accounts, and why

An Authorize.Net gateway account is bound to **one** merchant account, with one
acquirer, in one country, settling one set of currencies. **There is no key that
fans out across processors.** Five accounts in five countries means five
credential sets, which is why the secret is an array and why `orders`
records which account took each payment.

That last part is not bookkeeping: **a refund has to go back through the account
that took the money**, so an order paid on the UK account cannot be refunded
from the US one. `gateway_account` on the order is what tells you which.

Changing the live account applies to **new** payments only. Orders already paid
keep the account that took them.

---

---

## 0. The gate: this still decides whether any of it is usable

**Authorize.Net is a gateway, not a processor.** It does not settle money; it
passes transactions to an acquiring bank. That means two accounts, not one:
the Authorize.Net gateway account, and a **merchant account with an acquirer**.
(Authorize.Net will sell you a bundled one.)

And the bundle has a hard geographic condition:

> A merchant must be based in the **United States, Canada, the United Kingdom,
> Europe or Australia**, with a **bank account in that country**. Businesses
> elsewhere are directed to Cybersource.

This store's manufacturing is in Foshan, Guangdong. The registered entity in
Settings → Invoice identity is an **LLC**, which is a US form — so this may be
fine. But it turns on a question only you can answer:

- [ ] Is the legal entity registered in a supported country?
- [ ] Is there a business bank account **in that same country**?

If the answer to either is no, Authorize.Net is not available to you — the code
is built and dormant, and setting credentials you cannot obtain is not a step
you can take. **This is the one thing that has to be true before any of it
works.**

One further expectation to set: because a real acquiring bank is involved,
underwriting is typically **slower and more documentation-heavy than Stripe's**,
not less. Adding Authorize.Net is not a way around an underwriting problem.

---

## 1. Which integration shape — and why it matters

The choice here decides your **PCI DSS scope**, which is the single most
consequential decision in the whole project.

| Option | How it works | PCI scope | Fit here |
| --- | --- | --- | --- |
| **Accept Hosted** | Authorize.Net hosts the card form. You request a token, the browser posts it to their page. | **SAQ-A** — card data never touches you | ✅ **Recommended** |
| **Accept.js** | Their JS tokenises the card in the browser; you charge the opaque token server-side. | SAQ-A-EP | Possible, more work |
| **Raw card to your server** | You post the PAN to their API yourself. | **SAQ-D** — full audit, quarterly scans | ❌ Never |

**Recommendation: Accept Hosted.** Not only for the PCI scope, but because it
is the same shape as what the codebase already does twice — create an order,
send the buyer to the provider, confirm on return plus a webhook. Stripe
Checkout and PayPal both work exactly this way, so Accept Hosted is a third
instance of a pattern that already exists rather than a new one.

Accept.js buys you an on-page form at the cost of SAQ-A-EP and a client-side
integration. The store already tried an inline card form once (PayPal Advanced
Card Fields, `NEXT_PUBLIC_PAYPAL_CARD_FIELDS`) — look at how much that is
actually used before paying for it again.

---

## 2. The API, concretely

### Endpoints

| | URL |
| --- | --- |
| Sandbox API | `https://apitest.authorize.net/xml/v1/request.api` |
| Production API | `https://api.authorize.net/xml/v1/request.api` (the official SDK ships `api2.authorize.net`; both resolve) |
| Hosted form — sandbox | `https://test.authorize.net/payment/payment` |
| Hosted form — production | `https://accept.authorize.net/payment/payment` |

### Authentication is in the body, not a header

Unlike Stripe (bearer token) and PayPal (OAuth), **every** Authorize.Net request
carries its credentials inside the JSON:

```json
{
  "getHostedPaymentPageRequest": {
    "merchantAuthentication": {
      "name": "<API Login ID>",
      "transactionKey": "<Transaction Key>"
    },
    "refId": "<our order number>",
    "transactionRequest": {
      "transactionType": "authCaptureTransaction",
      "amount": "4259.84"
    },
    "hostedPaymentSettings": {
      "setting": [
        { "settingName": "hostedPaymentReturnOptions", "settingValue": "{\"url\":\"https://…/api/authorize-net/return\",\"cancelUrl\":\"https://…/checkout\"}" },
        { "settingName": "hostedPaymentButtonOptions",  "settingValue": "{\"text\":\"Pay\"}" },
        { "settingName": "hostedPaymentOrderOptions",   "settingValue": "{\"show\":false}" }
      ]
    }
  }
}
```

The response carries a **`token`**. The browser then POSTs that token as a form
field to the hosted form URL above. The token is short-lived — an expired one
shows an error page instead of the form — so mint it at the moment of redirect,
not when the cart is built. *(Confirm the exact window against your account; the
documentation says it expires but we could not reach the page that states the
duration — see §6.)*

`transactionType: "authCaptureTransaction"` authorises **and** settles in one
step, which matches what the store does today with Stripe and PayPal.

### Reading the response

Two levels, and you must check both:

- `messages.resultCode` — `"Ok"` or `"Error"` for the **request**
- `transactionResponse.responseCode` — for the **transaction**:

| Code | Meaning | What we should do |
| --- | --- | --- |
| `1` | Approved | Mark paid |
| `2` | Declined | Tell the buyer, leave the order pending |
| `3` | Error | Tell the buyer, log it |
| `4` | **Held for review** | ⚠️ *Not* paid. Leave pending; a webhook resolves it later |

Code `4` has no equivalent in the current Stripe/PayPal paths and is the one
most likely to be mishandled. An order held for review that we mark paid is an
order we ship without being paid for.

`transactionResponse.transId` is the gateway reference — the analogue of the
Stripe `cs_`/PaymentIntent id, and what belongs on the invoice.

---

## 3. What was built

| File | What it does |
| --- | --- |
| `lib/authorize-net.ts` *(new)* | Mirror of `lib/paypal.ts`: `authorizeNetConfigured()`, `createHostedPaymentToken()`, `fetchTransaction()`. Plain fetch, no SDK — see §4. |
| `app/api/checkout/route.ts` | A third branch beside `method === "paypal"`. The order row, totals, colour validation, origin capture and abandoned-cart email all already happen before the branch — none of that changes. |
| `app/checkout/CheckoutClient.tsx` | `PaymentMethod` gains `"authorizenet"`; a third button; `methods` prop gains the flag. |
| `app/api/authorize-net/return/route.ts` *(new)* | The return handler, analogous to `/api/paypal/capture`. **Must not trust the query string** — re-fetch the transaction from the API before marking anything paid. |
| `server/src/index.js` | A `/authorizenet/webhook` endpoint that verifies the signature (§4) and calls the existing `/api/internal/order-paid`. No new confirmation logic — that route is already idempotent. |
| `lib/orders.ts` | `PaidVia` gains `"authorizenet"`. |
| `app/api/internal/order-paid/route.ts` | Its `paidVia` whitelist gains the same value. |
| `app/admin/orders/paid/page.tsx` | Filter + badge for the third source. |
| `lib/invoice.ts` | `PAYMENT_METHODS` gains a label, so the invoice's payment block and the QR record name it. |
| `docs/PAYMENTS.md`, `README.md`, `.env.example` | The variable matrix. |

`orders.paid_via` needed no change — it is free text (migration 0007), the same
reason the seven fulfilment stages needed none.

### The column overload, resolved

`orders.stripe_session_id` had been holding **two** different things: Stripe
`cs_…` sessions and PayPal order ids, with `isStripeSessionId()` existing only
to tell them apart by prefix. Authorize.Net's `transId` is a bare number with no
prefix, which would have made that column unusable.

Migration 0018 adds **`gateway_reference`** — the honest name — backfilled from
`stripe_session_id`, and all three paths now write it. `stripe_session_id` is
left in place and still written, because the PayPal capture route looks orders
up by it; dropping a column live code reads is how a deploy takes checkout down.

### Where the credentials live

**In the environment, never the database.** `site_settings.authorizenet_account`
holds a short id (`"us"`, `"uk"`) naming an entry in the secret; the transaction
keys stay in Cloudflare and Render. A transaction key is a bearer credential for
moving money, and keeping it out of Postgres means a leaked service-role key, a
bad RLS policy or a stray backup cannot reach it.

The admin dropdown is built from the ids and labels only — the keys never cross
to the browser.

---

## 4. Four things that cost a day each (all handled — here is where)

Each is a well-known, still-unfixed characteristic of this API. All four are
dealt with in the code; this is where, so nobody "fixes" one by removing it.

### 1. JSON responses begin with a byte-order mark

`JSON.parse()` throws on it. Authorize.Net **decided not to fix this** —
too many integrations now depend on the workaround — so it is permanent:

```ts
const text = await res.text();
const data = JSON.parse(text.replace(/^﻿/, ""));
```

### 2. The webhook signature key is used as UTF-8 — *not* hex-decoded

The header is `X-ANET-Signature: sha512=<UPPERCASE HEX>`, an HMAC-SHA512 of the
**raw request body**:

`verifyAuthorizeNetSignature()` in `server/src/authorizenet.js`. There is a test
that signs with the **hex-decoded** key and asserts it is rejected — so if
somebody "fixes" it to match transHashSHA2, that test fails rather than the
webhook silently refusing every notification.

The trap: the **same account** also issues a `transHashSHA2` for receipts, and
*that* one requires the key hex-decoded to binary (`Buffer.from(key, "hex")`).
Same key, two different treatments. Using the hex form for webhooks is the
single commonest reason signature checks fail.

Note this needs the **raw body**, so on Render the route must be registered with
`express.raw()` **before** `express.json()` — exactly as `/stripe/webhook`
already is.

### 3. The official npm SDK will not run on Cloudflare Workers

`authorizenet` depends on `winston`, `winston-daily-rotate-file` and
`https-proxy-agent` — file-system logging and Node HTTP agents. **No dependency
was added**: `lib/authorize-net.ts` is plain `fetch`, as `lib/paypal.ts` is.

### 4. Duplicate-transaction rejection

Two identical transactions within a short window are rejected as duplicates
(error `E00027`) rather than processed twice. Our order number goes out as
`refId` and as the invoice number, so gateway records and ours reconcile — and
an `E00027` surfaces with the gateway's own wording rather than a generic
failure.

### And one with no equivalent in the other two paths

**Response code 4 is "held for review" — it is NOT paid.** The gateway has the
transaction but has not approved it. Neither Stripe Checkout nor PayPal has this
state, which is exactly why it is easy to treat as success and ship goods
against money that never arrives.

The return handler refuses it explicitly and sends the buyer to the confirmation
page with `?payment=review` rather than to a decline. The webhook resolves it if
and when the gateway approves. `fetchTransaction()` reports `paid` and
`heldForReview` as separate booleans so the two can never be conflated.

---

## 5. Environment variables

| Variable | Cloudflare | Render | Purpose |
| --- | :---: | :---: | --- |
| `AUTHORIZENET_ACCOUNTS` | ✅ | ✅ | JSON array of accounts — login id, transaction key and `env` per account. One secret, however many accounts |
| `AUTHORIZENET_SIGNATURE_KEY` | — | ✅ | Render verifies webhook signatures |

There is no separate `AUTHORIZENET_ENV`: each account carries its own, because
nothing stops one account being live while another is still in sandbox. An
unrecognised value falls back to **sandbox** — the safe failure is taking no
real money, not taking it against the wrong endpoint.

---

## 6. What could not be verified here

Stated plainly so nobody treats this document as more certain than it is.

**`developer.authorize.net` and `apitest.authorize.net` are both blocked by this
environment's egress proxy**, so the official API reference could not be read
directly and **no live request was made**. Everything above comes from:

- Authorize.Net's own SDK and sample-code repositories (cloned and read
  directly — endpoints, `authCaptureTransaction`, the hosted-page request shape,
  the `transHashSHA2` hex-decoding, the SDK's dependencies)
- their published documentation via search, and developer-community threads for
  the BOM and signature-key behaviours

Specifically **unconfirmed**, and worth checking against a real sandbox account
before relying on them:

- the exact **hosted-page token lifetime**
- the precise **duplicate-transaction window**
- whether **element order** within the JSON matters (it is XML-derived, and this
  is widely reported, but we could not confirm it from a primary source)

The first real task of any implementation should be a sandbox account and one
successful transaction — before writing anything that assumes the above.

---

## 7. Is it worth doing?

Worth asking, since the answer is not automatic.

**For:** a second card gateway is genuine redundancy. If one account has a
problem, orders keep flowing — and for a store that has had payment-provider
difficulties, that is the strongest argument available.

**Against:** it is a third surface for every future payment change to touch, and
it does not solve an underwriting problem — Authorize.Net's is stricter, not
looser, because a real acquiring bank sits behind it.

The gate in §0 decides it. If the entity and bank account qualify, the
redundancy argument is a good one.
