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
   no PayPal account), because we send `landing_page: "GUEST_CHECKOUT"` and your
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

## 5. Want card fields embedded ON your checkout page (no redirect)?

Today card entry happens on the provider's hosted page. If you want the card
form to appear **inline on `/checkout`** instead, that's a separate, larger
build — pick one:

- **Stripe Elements / Payment Element** — Stripe-hosted iframe fields embedded in
  our page. PCI-friendly, no PayPal approval needed. **Medium effort**, and the
  cleanest inline-card UX. *Recommended if you want inline cards.*
- **PayPal Advanced Checkout** (hosted card fields) — inline card fields via
  PayPal. Requires PayPal to **approve "Advanced Checkout"** on your account
  first, and more client code.

The current redirect flow needs **no approval** and already accepts cards — it's
the fastest path to live. Open an issue / ask to schedule the inline-fields
upgrade when you want it.

---

## 6. Go-live checklist for payments

- [ ] `PAYPAL_ENV` matches the key type **and** is identical on Cloudflare + Render.
- [ ] `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET` on **both** hosts; `PAYPAL_WEBHOOK_ID` on Render.
- [ ] Stripe: `STRIPE_SECRET_KEY` on both; `STRIPE_WEBHOOK_SECRET` on Render; webhook → `https://<render>/stripe/webhook`.
- [ ] `RENDER_API_URL` + `INTERNAL_API_KEY` on Cloudflare (else no receipts).
- [ ] Redeploy Cloudflare **and** Render after changing variables.
- [ ] `/api/health` shows the providers you expect as `true`; `/admin/status` says **"Checkout live."**
- [ ] One end-to-end test order per provider (sandbox first), confirm redirect → paid → receipt.
