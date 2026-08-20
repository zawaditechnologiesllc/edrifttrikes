# Payments — architecture & configuration

The definitive reference for how checkout works, **which secret goes on which
host**, and what the buyer sees. If checkout says *"paused"* or *"PayPal is
unavailable,"* the cause is almost always a variable in the wrong place or a
`PAYPAL_ENV` that doesn't match the keys — this page is the fix.

---

## 1. Two hosts, two jobs

| Host | What it does for payments | Which keys it needs |
| --- | --- | --- |
| **Cloudflare** (storefront) | Renders `/checkout`, and `/api/checkout` **creates** the order + the payment session/redirect. | The **create** keys (secret key / client id + secret). |
| **Render** (`/server`) | Receives **webhooks** and sends **email** receipts. | The **verify** keys (webhook secret / webhook id). |

Rule of thumb: **Cloudflare starts the payment, Render confirms it.**

---

## 2. Environment variable matrix (copy this exactly)

Set these as **runtime** variables (Cloudflare: *Settings → Variables and
Secrets*; Render: *Environment*). Variables with the same name **must hold the
same value** on both hosts.

| Variable | Cloudflare | Render | Purpose |
| --- | :---: | :---: | --- |
| `STRIPE_SECRET_KEY` | ✅ | ✅ | CF creates the Checkout Session; Render's webhook confirms + emails |
| `STRIPE_WEBHOOK_SECRET` | — | ✅ | Render verifies Stripe's webhook signature |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ➖ optional | — | Not needed for the redirect flow |
| `PAYPAL_CLIENT_ID` | ✅ | ✅ | CF creates + captures the order; Render verifies the webhook |
| `PAYPAL_SECRET` | ✅ | ✅ | same |
| `PAYPAL_ENV` | ✅ | ✅ | `sandbox` or `live` — **must match the key type, same on both hosts** |
| `PAYPAL_WEBHOOK_ID` | — | ✅ | Render verifies PayPal's webhook signature |
| `RENDER_API_URL` | ✅ | — | CF → Render base URL (email/contact). Missing ⇒ **no receipts** |
| `INTERNAL_API_KEY` | ✅ | ✅ | Shared secret; **identical** on both |

Verify what the **running** Worker actually sees at **`/api/health`** →
`payments`, `render`, `turnstile` blocks (booleans only, never values). The
prettier admin view is **`/admin/status`** with a "Checkout live / paused" chip.

> **`PAYPAL_ENV` mismatch is the #1 failure.** Sandbox keys need
> `PAYPAL_ENV=sandbox`; live keys need `PAYPAL_ENV=live`. A mismatch authenticates
> against the wrong PayPal endpoint → `401 invalid_client` → the checkout shows
> *"PayPal is unavailable right now."* Keep `PAYPAL_ENV` **the same on Cloudflare
> and Render.**

---

## 3. How a payment actually flows (what the buyer sees)

Both providers today are **redirect / hosted-page** flows — the buyer is sent to
Stripe's or PayPal's secure page to enter payment details. **Card data never
touches our servers** (best case for PCI + security).

**Stripe**
1. Buyer clicks **Pay** → `/api/checkout` creates a Stripe Checkout Session.
2. Browser redirects to **Stripe's hosted page** → buyer enters card there.
3. Stripe redirects back to `/order-confirmation`; Stripe's webhook → Render marks the order **paid** and emails the receipt.

**PayPal**
1. Buyer clicks **Pay** → `/api/checkout` creates a PayPal order.
2. Browser redirects to **PayPal's hosted page**. There the buyer can pay with
   their PayPal balance **or** click **"Pay with Debit or Credit Card"** (guest —
   no PayPal account), because we send `landing_page: "BILLING"` and your
   account has **"PayPal account optional" ON**.
3. PayPal returns to `/api/paypal/capture`, which captures, marks **paid**, and
   emails the receipt. (The Render webhook is the backup/reconciliation layer.)

---

## 4. What checkout looks like per configuration

Driven by which keys the Worker sees (`stripeConfigured()` / `paypalConfigured()`):

| Connected | Checkout UI | On click |
| --- | --- | --- |
| **PayPal only** | One button: **"Pay with PayPal or card"** | → PayPal hosted page (PayPal or card) |
| **Stripe only** | One button: **"Pay $X securely"** | → Stripe hosted page (card) |
| **Both** | A **Card / PayPal** chooser (Card is the default) | *Card* → Stripe · *PayPal* → PayPal |
| **Neither** | Disabled button + **"Checkout temporarily paused — very high volume of orders… try again in a few hours"** | — |

So yes — with **both** connected, the buyer gets to choose **Card (Stripe)** or
**PayPal**, and PayPal itself still also accepts cards on its page.

---

## 5. Inline card fields on `/checkout` (no redirect, no "create account")

The app ships **PayPal Advanced Card Fields** — card inputs rendered directly on
the checkout page, so the buyer never leaves your site and never sees PayPal's
"Save info & create your PayPal account" prompt. It's **opt-in and safe by
default**: off unless you turn it on, and if the account isn't eligible it hides
and falls back to the redirect button.

**Turn it on**

1. In your PayPal Business account, enable **"Advanced Credit and Debit Card
   Payments"** (a.k.a. Advanced Checkout). PayPal must approve/enable it — some
   accounts/regions have it by default, others require applying. Without it the
   inline fields aren't eligible and won't show.
2. Set **`NEXT_PUBLIC_PAYPAL_CARD_FIELDS=1`** on Cloudflare (runtime var) and
   redeploy. (`PAYPAL_CLIENT_ID` is exposed to the browser SDK automatically —
   it's a public value.)
3. **Test in sandbox first** (`PAYPAL_ENV=sandbox`): go to `/checkout`, fill
   email + shipping, and pay with a
   [sandbox test card](https://developer.paypal.com/tools/sandbox/card-testing/).
   Confirm the order flips to **paid** and the receipt sends. Then switch to live.

**How it behaves**
- Card entry (number / expiry / CVV) appears **inline**; the buyer stays on your
  page — no redirect, no account‑creation prompt.
- A secondary **"Or pay with a PayPal account"** button still offers the redirect
  for buyers who prefer their PayPal balance.
- If `NEXT_PUBLIC_PAYPAL_CARD_FIELDS` is unset/`0`, or the account isn't eligible,
  checkout is exactly the redirect flow — nothing changes.

> Flow: `submit()` → `/api/checkout` creates the order → PayPal validates the card
> (incl. 3‑D Secure) → `POST /api/paypal/capture` captures + emails the receipt.

**Alternative — Stripe** also gives a clean, no‑account card form (hosted or
inline Payment Element) with no PayPal approval needed. If you'd rather route
cards through Stripe, add the Stripe keys (§2) and ask and I'll wire the inline
Stripe Payment Element.

---

## 6. Go-live checklist for payments

- [ ] `PAYPAL_ENV` matches the key type **and** is identical on Cloudflare + Render.
- [ ] `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET` on **both** hosts; `PAYPAL_WEBHOOK_ID` on Render.
- [ ] Stripe: `STRIPE_SECRET_KEY` on both; `STRIPE_WEBHOOK_SECRET` on Render; webhook → `https://<render>/stripe/webhook`.
- [ ] `RENDER_API_URL` + `INTERNAL_API_KEY` on Cloudflare (else no receipts).
- [ ] Redeploy Cloudflare **and** Render after changing variables.
- [ ] `/api/health` shows the providers you expect as `true`; `/admin/status` says **"Checkout live."**
- [ ] One end-to-end test order per provider (sandbox first), confirm redirect → paid → receipt.


## Company content on the Stripe page

Stripe Checkout is **hosted by Stripe** — you cannot inject HTML, CSS or scripts
into it. What you can put there:

| What | Where it's set |
| --- | --- |
| Logo, icon, brand colour, accent colour, font | Stripe Dashboard → Settings → Branding. Not settable from code. |
| Text by the pay button | `custom_text.submit` — [`lib/stripe-branding.ts`](../lib/stripe-branding.ts) |
| Text after the confirmation button | `custom_text.after_submit` — same file |
| Charge description (follows into Stripe's receipt) | `payment_intent_data.description` |
| Button wording | `submit_type: "pay"` |

Each `custom_text` slot allows up to 1200 characters. **An over-length or
malformed value fails the whole session create**, which means no card checkout
at all — so `clampCustomText()` trims defensively and a test asserts the limit.

The copy is derived from `COMPANY`, `ESTIMATED_DELIVERY_DAYS` and
`DEFAULT_DUTY_RATE_BPS` rather than written inline, so the delivery window and
duty rate quoted on Stripe's page cannot drift from the ones in our own checkout
and in the emails the buyer receives minutes later. Tests assert that agreement.

### The page after payment is entirely ours

`success_url` sends the buyer to `/order-confirmation` on our own domain, with
the full receipt, the delivery tracker and the duty notice. There is no Stripe
restriction there — that is the right place for substantial company content.

### Not enabled, available if wanted

- **Terms-of-service acceptance** (`consent_collection.terms_of_service` plus
  `custom_text.terms_of_service_acceptance`) forces a tick-box linking your
  terms. It requires a terms URL configured in the Stripe Dashboard first —
  **without it the API call fails and card checkout breaks**, which is why it is
  off by default.
- **Custom fields** (`custom_fields`) can collect up to three extra answers.
- **Statement descriptor suffix** controls what appears on the buyer's card
  statement and is one of the best defences against "I don't recognise this
  charge" chargebacks. It needs the account-level descriptor set in the
  Dashboard and has strict character rules.
