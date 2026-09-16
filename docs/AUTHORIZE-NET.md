# Authorize.Net — what adding it would take

Research notes and an integration plan for adding Authorize.Net alongside
Stripe and PayPal. **Nothing is implemented yet**; this is the document that
says what the work is, what it costs, and what could stop it.

Read [`PAYMENTS.md`](PAYMENTS.md) first — it describes the two-host split
(Cloudflare starts a payment, Render confirms it) that any third provider has
to fit into.

---

## 0. The gate: check this before writing any code

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

If the answer to either is no, Authorize.Net is not available and the rest of
this document is moot. **Confirm this before any development starts** — it is
a week of work that a single "no" makes worthless.

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

## 3. How it maps onto this codebase

The good news: the shape already exists twice, and `lib/paypal.ts` is the
template to copy — plain `fetch`, credentials read at **call** time via
`serverEnv()` (Cloudflare secrets are not visible at module scope), and a
`…Configured()` predicate so the method simply is not offered when unset.

| File | Change |
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

**No migration is needed.** `orders.paid_via` is free-text (migration 0007), so a
third value needs no schema change — the same reason the seven fulfilment stages
needed none.

### ⚠️ One structural problem to decide on first

`orders.stripe_session_id` **already holds two different things**: Stripe `cs_…`
session ids and PayPal order ids. `isStripeSessionId()` in
`lib/stripe-fulfillment.ts` exists solely to tell them apart by prefix.

Adding a third gateway makes that column a three-way overload, and
Authorize.Net's `transId` is a bare number with no prefix to detect. Two ways
out, and this should be decided **before** the code is written:

1. **Add a `gateway_reference` column** (and migrate the existing values). Clean,
   costs one migration, makes `isStripeSessionId` unnecessary.
2. **Keep overloading**, storing something like `anet_<transId>` so a prefix
   check still works. Cheaper now, one more piece of cleverness to remember.

Recommendation: **(1)**. The column name is already a lie for PayPal orders; a
third tenant makes it a trap.

---

## 4. Four things that will each cost you a day

These are not obscure. Each is a well-known, still-unfixed characteristic of
this API.

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

```js
const expected = crypto
  .createHmac("sha512", process.env.AUTHORIZENET_SIGNATURE_KEY)  // plain string
  .update(rawBody)
  .digest("hex")
  .toUpperCase();
```

The trap: the **same account** also issues a `transHashSHA2` for receipts, and
*that* one requires the key hex-decoded to binary (`Buffer.from(key, "hex")`).
Same key, two different treatments. Using the hex form for webhooks is the
single commonest reason signature checks fail.

Note this needs the **raw body**, so on Render the route must be registered with
`express.raw()` **before** `express.json()` — exactly as `/stripe/webhook`
already is.

### 3. The official npm SDK will not run on Cloudflare Workers

`authorizenet` depends on `winston`, `winston-daily-rotate-file` and
`https-proxy-agent` — file-system logging and Node HTTP agents. Use plain
`fetch`, as `lib/paypal.ts` does. This is not a limitation in practice; the API
is a single POST endpoint.

### 4. Duplicate-transaction rejection

Two identical transactions within a short window are rejected as duplicates
(error `E00027`) rather than processed twice. Helpful — but it means a legitimate
retry can fail, so surface it as something other than a generic decline. Send our
order number as `refId` so gateway records and ours can be reconciled.

---

## 5. Work breakdown

Assuming Accept Hosted and the `gateway_reference` column:

| # | Task | Rough size |
| --- | --- | --- |
| 1 | `lib/authorize-net.ts` + unit tests (BOM stripping, response-code mapping, held-for-review) | ~half a day |
| 2 | Migration: `gateway_reference`, backfill from `stripe_session_id` | ~2 hours |
| 3 | Checkout branch + the return route | ~half a day |
| 4 | Checkout UI: third method | ~2 hours |
| 5 | Render webhook + signature verification + tests | ~half a day |
| 6 | Admin: badge, filter, invoice label | ~2 hours |
| 7 | Sandbox end-to-end: approve, decline, **held for review**, duplicate, webhook replay | ~half a day |
| 8 | Docs + env matrix | ~2 hours |

**Roughly 2½–3 days of development**, plus however long the merchant account
takes to underwrite — which is the long pole and is not in our control.

### Environment variables it would add

Not yet in `.env.example`, because nothing reads them yet.

| Variable | Cloudflare | Render | Purpose |
| --- | :---: | :---: | --- |
| `AUTHORIZENET_API_LOGIN_ID` | ✅ | ✅ | Identifies the account on every call |
| `AUTHORIZENET_TRANSACTION_KEY` | ✅ | ✅ | Secret, paired with the login id |
| `AUTHORIZENET_SIGNATURE_KEY` | — | ✅ | Render verifies webhook signatures |
| `AUTHORIZENET_ENV` | ✅ | ✅ | `sandbox` or `production` — **must match the key type, same on both hosts**, exactly the trap `PAYPAL_ENV` already sets |

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
