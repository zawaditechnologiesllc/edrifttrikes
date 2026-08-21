# Deployment Guide — E-Drift Trikes

Complete, end-to-end deployment for the full stack:

| Layer | Service | What it runs |
| --- | --- | --- |
| Storefront + admin + checkout | **Cloudflare** (Workers, via OpenNext) | the Next.js app in this repo root |
| Auth · Database · Image storage | **Supabase** | schema in `supabase/migrations` |
| Email · Stripe webhook · contact | **Render** | the Node service in `/server` |
| Payments | **Stripe** and/or **PayPal** | checkout + capture/webhook |
| Transactional email | **Resend** | sent from the Render service |

Deploy order matters — do it top to bottom. You'll create Supabase first (it
issues the keys everything else needs), then Render (it issues a URL the app
needs), then Cloudflare, then wire Stripe's webhook back to Render.

> **Why Cloudflare:** its free tier **allows commercial use** (a store taking
> payments) — static page serving is unlimited/free and Workers include 100,000
> requests/day free — so a real store can launch at $0 and scale far before
> paying. The app runs on Cloudflare through the
> [OpenNext](https://opennext.js.org/cloudflare) adapter. See
> [`SCALING.md`](./SCALING.md) for the capacity math and upgrade triggers.

---

## 0. Prerequisites

- Accounts: **GitHub** (this fork), **Supabase**, **Render**, **Cloudflare**,
  **Stripe** and/or **PayPal**, **Resend**.
- Node 20+ locally, and the repo pushed to your GitHub account.
- Generate one shared secret now — you'll paste the *same* value into both Render
  and Cloudflare later as `INTERNAL_API_KEY`:
  ```bash
  openssl rand -hex 32
  ```
  Save it somewhere temporary.

---

## 1. Supabase (do this first)

### 1a. Create the project
1. Supabase → **New project**. Pick a region close to your customers.
2. Set a strong database password (save it).

### 1b. Create the schema
1. Open **SQL Editor**.
2. Run each migration **in order**, pasting the file contents and clicking Run:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_contact.sql`
   - `supabase/migrations/0003_featured_site_settings.sql`
   - `supabase/migrations/0004_shipping_and_articles.sql`
   - `supabase/migrations/0005_product_shipping.sql`
   This creates all tables, row-level-security policies, the `is_admin()` helper,
   the public **`product-images`** storage bucket, the products' **featured**
   flag, the **site_settings** table (footer contact + shipping fee), the
   complete set of **Tech Lab articles**, and **per-product shipping** columns.
   On an existing database just run the migrations you haven't run yet — all
   are safe to re-run.

### 1c. Seed starter data (recommended)
Run `supabase/seed.sql`. It creates the three **categories** (`trikes`, `parts`,
`gear`) and a set of demo products so the site isn't empty.
- Categories must exist before you can assign products to them, so even if you
  delete the demo products later, keep (or recreate) the categories.
- To clear the demo products but keep categories:
  ```sql
  delete from public.products;   -- categories, RLS, storage all remain
  ```

### 1d. Grab your keys
**Project Settings → API**, copy:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL`
- **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` *(secret — server only, never
  ship to the browser)*

### 1e. Auth redirect URL
**Authentication → URL Configuration**:
- **Site URL**: `https://edrifttrikes.shop` (your live domain — or
  `https://YOUR-WORKER.workers.dev` until the custom domain is attached).
- **Redirect URLs**: add `https://edrifttrikes.shop/**` (one wildcard covers
  `/auth/callback` **and** the password-reset landing
  `/auth/callback?next=/account/update-password`). Add `http://localhost:3000/**`
  too if you develop locally.

### 1f. Auth email templates
**Authentication → Emails → Templates** — paste the branded templates from
[`../supabase/email-templates/`](../supabase/email-templates/) (at minimum
*Confirm signup* and *Reset Password*). For production deliverability, enable
**custom SMTP** (reuse Resend). Full walkthrough + the env-var matrix:
[`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md).

> You'll come back in **Step 6** to promote your own account to admin — you can't
> do it until you've signed up once on the live site.

---

## 2. Render backend (`/server`)

The app **requires** this service for email, the Stripe webhook, and the contact
form. `render.yaml` in the repo root is a blueprint Render reads automatically.

1. Render → **New +** → **Blueprint** → connect this repo. Render detects
   `render.yaml` and proposes the `edrift-backend` web service (`rootDir: server`).
2. Set the environment variables (blueprint marks most as `sync: false`, meaning
   *you* fill them in):

   | Variable | Value |
   | --- | --- |
   | `SITE_URL` | `https://YOUR-WORKER.workers.dev` (fill after Cloudflare, or your domain) |
   | `INTERNAL_API_KEY` | the shared secret from Step 0 *(blueprint can also generate one — if so, copy it for Cloudflare)* |
   | `SUPABASE_URL` | Supabase Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key |
   | `RESEND_API_KEY` | from Resend (Step 5) |
   | `EMAIL_FROM` | e.g. `E-Drift Trikes <orders@yourdomain.com>` |
   | `ORDERS_NOTIFICATION_EMAIL` | where new-order alerts go |
   | `STRIPE_SECRET_KEY` | Stripe secret key (Step 4) |
   | `STRIPE_WEBHOOK_SECRET` | from Stripe webhook (Step 4) — add after you create it |

3. Deploy. When it's live, copy the service URL (e.g.
   `https://edrift-backend.onrender.com`). Health check: open `/health` → should
   return `{"ok":true,...}`.

> **Free tier note:** the service sleeps after ~15 min idle and cold-starts in
> ~50s. Enable keep-warm in **Step 7** so this doesn't bite during a campaign.

---

## 3. Cloudflare (storefront + admin)

The app runs on Cloudflare Workers via the OpenNext adapter. Two ways to deploy —
pick one:

**Option A — Git-connected (recommended).**
1. Cloudflare dashboard → **Workers & Pages → Create → Workers → Connect to Git**
   → pick this repo. (Choose *Workers*, not *Pages* — OpenNext outputs a Worker.)
2. Build settings:
   - **Build command:** `npm run cf:build`
   - **Deploy command:** `npx wrangler deploy`
   - **Root directory:** repo root (leave default; `/server` is ignored here — it
     deploys to Render on its own).
3. Add the environment variables below, then trigger a deploy. Every push to your
   branch redeploys.

**Option B — Deploy from your machine.**
```bash
npm install
npx wrangler login
npm run deploy      # = opennextjs-cloudflare build && ... deploy
```

**Environment variables** (dashboard → your Worker → **Settings → Variables**;
mark secrets as *Encrypted*):

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SITE_URL` | `https://YOUR-WORKER.workers.dev` (or your domain) |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key (secret) |
   | `RENDER_API_URL` | the Render URL from Step 2 |
   | `INTERNAL_API_KEY` | **exact same** shared secret as Render (secret) |
   | `STRIPE_SECRET_KEY` | Stripe secret key (secret) — if using Stripe |
   | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key — if using Stripe |
   | `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET` / `PAYPAL_ENV` | if using PayPal (secret) |

> **Where to set the variables — this matters.** A Git-connected Worker has TWO
> separate variable stores, and the app needs both:
>
> 1. **Runtime** — Worker → **Settings → Variables and Secrets**. Set **all** the
>    variables above here (secrets as *Encrypted*). This is what the running
>    Worker reads for server code: the admin panel, checkout, email, Turnstile.
> 2. **Build** — Worker → **Settings → Build → Variables and secrets**. Set at
>    least the `NEXT_PUBLIC_*` ones here too. These are inlined into the browser
>    bundle during `npm run cf:build`; without them the *client-side* pieces
>    (login form, wishlist button) have no Supabase config at build time. The app
>    also injects the public Supabase URL/anon key at request time as a fallback,
>    but setting build vars is still the reliable path.
>
> Changing a runtime variable takes effect on save; changing a build variable
> needs a redeploy (rebuild).

> **Troubleshooting — admin says "Connect Supabase":** visit **`/api/health`** on
> your deployed site. It reports (as booleans, never values) exactly what the
> running Worker sees, e.g. `{"adminReady": true, "supabase": {"url": true,
> "serviceRoleKey": false}}`.
>
> - **Check `diag` first.** The current code reports `"diag":
>   "release-2026-07-22e"`. If your deployed `/api/health` shows an older value
>   (or 404s), Cloudflare is building an old commit — usually because the
>   Worker is connected to a fork or branch that hasn't pulled the latest code.
>   Sync the deployed repo/branch with this one and redeploy before debugging
>   anything else.
> - If `serviceRoleKey` is `false`, the service-role key isn't reaching the
>   runtime Worker — set **`SUPABASE_SERVICE_ROLE_KEY`** (exact name, the
>   Supabase *service_role* secret, not the anon key) under your Worker →
>   **Settings → Variables and Secrets** (runtime), then redeploy. The server
>   also accepts a non-public **`SUPABASE_URL`** if the public URL wasn't
>   available at build time.

After the first deploy, set `SITE_URL` (Render) and the Supabase **Site URL /
Redirect URL** (Step 1e) to your real Worker/domain URL. Add a custom domain
under the Worker's **Domains & Routes** when ready, then update those places.

> If a value is missing the app degrades gracefully rather than crashing (e.g.
> no payment keys → order is placed and emailed directly; no Render URL → emails
> are skipped and logged). "Degrades" is for local/preview — for a live store,
> set them all.

---

## 4. Payments (Stripe and/or PayPal)

Checkout automatically shows whichever providers are connected — **both** (buyer
chooses), **one** (that one), or **neither** (order placed + emailed directly).

> **Which key goes on which host, the buyer's flow, and per-config UX:
> [`PAYMENTS.md`](./PAYMENTS.md)** — the definitive payments reference (env-var
> matrix, `PAYPAL_ENV` gotcha, and the inline-card upgrade path).

### 4a. Stripe
1. Stripe Dashboard → **Developers → API keys**: copy **Secret key** (`sk_...`)
   and **Publishable key** (`pk_...`).
   - `STRIPE_SECRET_KEY` → **Cloudflare and Render** (yes, both — the app creates
     the session, Render's webhook confirms it).
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → Cloudflare.
2. Create the webhook → **Developers → Webhooks → Add endpoint**:
   - **Endpoint URL**: `https://<your-render-url>/stripe/webhook`.
   - **Events**: `checkout.session.completed`.
   - Save, reveal the **Signing secret** (`whsec_...`) → set `STRIPE_WEBHOOK_SECRET`
     on **Render**, and redeploy Render.
3. Flow: app creates the Checkout Session → Stripe processes payment → Stripe
   calls the **Render** webhook → Render marks the order `paid` and emails the
   receipt. Test with **test mode** keys and card `4242 4242 4242 4242`.

### 4b. PayPal (optional) — with debit/credit **card** capture

This uses a **PayPal Business account** and captures both PayPal-balance payments
**and** debit/credit **cards** — the buyer does **not** need a PayPal account to
pay by card. It's the standard PayPal Checkout redirect flow (no "Advanced
Checkout" approval required).

**1. Get live REST credentials (from your Business account).**
- Log in to the [PayPal Developer dashboard](https://developer.paypal.com/dashboard/)
  with your **Business** account.
- **Apps & Credentials** → toggle to **Live** → **Create App** → copy the
  **Client ID** and **Secret**. (Use the **Sandbox** toggle first to test.)

**2. ⚠️ Enable card payments without a PayPal account (the key setting).**
Card capture only appears if guest checkout is turned on for the account:
- PayPal **business** account → **Account Settings → Website payments →
  Website preferences** (a.k.a. *Website Payment Preferences*).
- Set **"PayPal account optional"** to **ON**.
- Save. (New accounts sometimes need a live transaction or a day for this to
  take effect. If the card form still doesn't show, confirm the account is a
  **Business** account and is fully verified.)

> The app already asks PayPal for the card/billing page
> (`landing_page: "BILLING"` in `lib/paypal.ts`). Without the account setting
> above, PayPal ignores it and shows the login page instead — so this toggle is
> what actually unlocks cards.

**3. Set the environment variables** on **Cloudflare** (the host running the app):

| Variable | Value |
| --- | --- |
| `PAYPAL_CLIENT_ID` | Live app Client ID |
| `PAYPAL_SECRET` | Live app Secret |
| `PAYPAL_ENV` | `live` (use `sandbox` while testing) |

The app creates **and** captures the order itself, so payments work without a
webhook. A webhook is **recommended** as a safety net for refunds, disputes, and
reconciliation — see **4c** below.

**4. Flow:** app creates a PayPal order → buyer is sent to PayPal and pays with
**PayPal _or_ a card** (guest) → PayPal returns to `/api/paypal/capture` → the app
captures, marks the order `paid`, and emails the receipt.

**5. Test before go-live.** With `PAYPAL_ENV=sandbox`, use a
[sandbox](https://developer.paypal.com/dashboard/accounts) **business** account
(enable "PayPal account optional" on it too) and pay once with a
[test card](https://developer.paypal.com/tools/sandbox/card-testing/) via the
"Pay with Debit or Credit Card" option to confirm the card path captures. Then
switch `PAYPAL_ENV=live` with the live credentials.

> **Want card fields embedded directly on the checkout page** (no PayPal
> redirect)? That's PayPal **Advanced Checkout** (Advanced Card Payments /
> hosted card fields) — a larger integration that also requires PayPal to
> approve "Advanced Checkout" on your account. The redirect flow above is the
> no-approval path that already accepts cards; open an issue if you want the
> embedded-fields upgrade.

### 4c. PayPal webhook (recommended safety net)

The synchronous capture above handles the happy path. The webhook on **Render**
(`POST /paypal/webhook`) is the reconciliation layer — it catches cases the
redirect can't: a capture that completes after our page hand-off, and
**refunds / disputes / chargebacks** that happen days later. It verifies every
event's signature with PayPal before acting, and the paid→email step is
idempotent, so it never double-sends alongside the synchronous capture.

**1. Create the webhook** in the PayPal Developer dashboard:
- **Apps & Credentials** → open your app → scroll to **Webhooks** → **Add Webhook**.
- **Webhook URL**: `https://<your-render-url>/paypal/webhook`
- **Event types** — the dashboard lists events by a **plain-English description**,
  not by the `UPPER.DOTTED` code name, so they look different from the list below.
  You have two options:

  - **Easiest — choose "All events."** The webhook only acts on the five events
    in the table below and safely ignores everything else (it just replies
    `200`), so subscribing to all of them is harmless and future-proof.

  - **Or select them individually.** Tick the events whose description matches
    these — PayPal groups them under **Payments** (the capture events) and
    **Customer Disputes**:

    | Code name (what PayPal sends → what the app matches) | How it appears in the dashboard (description may vary slightly) |
    | --- | --- |
    | `PAYMENT.CAPTURE.COMPLETED` | "A payment capture completes" |
    | `PAYMENT.CAPTURE.DENIED` | "A payment capture is denied" |
    | `PAYMENT.CAPTURE.REFUNDED` | "A merchant refunds a payment capture" |
    | `PAYMENT.CAPTURE.REVERSED` | "PayPal reverses a payment capture" |
    | `CUSTOMER.DISPUTE.CREATED` | "A dispute is created" |

- Save, then copy the generated **Webhook ID**.

> The `UPPER.DOTTED` names are PayPal's canonical `event_type` values — the exact
> strings PayPal puts in the webhook payload, and what `server/src/index.js`
> switches on. The dashboard's descriptive labels are just the UI; the code is
> unaffected by how you pick them. When in doubt, pick **All events**.

**2. Set the env vars on Render** (PayPal creds are needed here too, to verify
signatures):

| Variable | Value |
| --- | --- |
| `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET` | same as the app |
| `PAYPAL_ENV` | `live` (or `sandbox` while testing) |
| `PAYPAL_WEBHOOK_ID` | the Webhook ID from step 1 |

Redeploy Render. (Until `PAYPAL_WEBHOOK_ID` is set, `/paypal/webhook` returns 503
and the app still works on the synchronous capture alone.)

**3. What each event does:**

| Event | Effect |
| --- | --- |
| `PAYMENT.CAPTURE.COMPLETED` | Marks the order `paid` + emails the receipt — only if still `pending` (dedupes vs the synchronous capture) |
| `PAYMENT.CAPTURE.DENIED` | Cancels the order (only while still `pending`) |
| `PAYMENT.CAPTURE.REFUNDED` / `REVERSED` | Marks the order `refunded` + alerts the store owner |
| `CUSTOMER.DISPUTE.CREATED` | Alerts the store owner to review it |

> Sandbox has its own webhooks — create a separate one pointing at the same
> Render URL while testing with `PAYPAL_ENV=sandbox`, then swap `PAYPAL_WEBHOOK_ID`
> for the live one at go-live. Test deliveries can be sent from the webhook's page
> in the dashboard.

---

## 5. Resend (email)

Order receipts, welcome, newsletter and contact mail all go out through Resend.

### Recommended: send directly from the app (no separate backend)

The app sends email **itself** via the Resend API whenever `RESEND_API_KEY` is
present — you do **not** need the `/server` Render backend just for email.

1. Resend → create an **API key**.
2. **On your app host (Cloudflare)** set, as runtime variables:
   - `RESEND_API_KEY`
   - `EMAIL_FROM` — an address on a **verified** domain, e.g.
     `E-Drift Trikes <no-reply@edrifttrikes.shop>`
   - `ORDERS_NOTIFICATION_EMAIL` — where new-order/contact alerts go
3. **Verify your sending domain** in Resend → Domains (add `edrifttrikes.shop`
   and its DNS records; wait for "Verified").
4. Redeploy.

That's it — receipts send straight from the app. (If instead you run the
`/server` Render backend, set the same three vars there and point
`RENDER_API_URL` at it; the app falls back to that when `RESEND_API_KEY` isn't
set on the app.)

> ### ⚠️ Why a customer's receipt might not arrive
> Once email is wired, delivery failures are almost always Resend config — and
> they used to **fail silently**. Two traps:
> - **Test sender `onboarding@resend.dev`** (the default when `EMAIL_FROM` is
>   unset): Resend only delivers test-domain mail to **your own Resend account
>   address** — so *customers never receive it*. Verify a domain and set
>   `EMAIL_FROM` to it.
> - **`EMAIL_FROM` on an unverified domain**: Resend rejects the send.
>
> **Diagnose in one click** (signed in as an admin):
> `https://edrifttrikes.shop/api/health/email` shows how email is wired
> (`via: resend-direct` / `render-backend` / `none`) and the `EMAIL_FROM` in use;
> `…/api/health/email?to=some-customer@example.com` sends a **real test email**
> and returns Resend's exact result — including the precise error if rejected.
> Errors are logged too, no longer swallowed.

---

## 6. Make yourself admin + upload products

The admin dashboard (`/admin`) is gated on `profiles.role = 'admin'`. Signing up
creates a profile with role `customer`, so promote yourself once:

1. On the **live site**, go to `/login` and **register** with your email
   (the address you registered with).
2. In Supabase **SQL Editor**, run:
   ```sql
   update public.profiles set role = 'admin'
   where email = 'you@example.com';  -- the address you registered with
   ```
3. Reload `/admin` — you now have access.

**Uploading a product** (`/admin/products` → **New product**):
- Fill name, **slug** (URL-safe, e.g. `volt-s1-pro`), price, stock, category,
  power, and the descriptive fields.
- **Or import from a text file**: the New-product form has an *Import from
  text file* box — download the template, fill in `Key: value` lines (the
  description can span multiple lines), pick the file, and every matching
  field prefills. Review, add images, save. Images always come from the file
  pickers, not the text file.
- Tick **Featured (homepage)** to pin the product to the homepage's featured
  section. When nothing is flagged, the newest active products show instead.
- Images: up to **10 MB per image**, uploaded **from your browser straight to
  Supabase Storage** — image bytes never pass through the Cloudflare Worker,
  so saves stay fast on any Workers plan. The Save button shows each step
  ("Authorizing image upload…", "Uploading image 1 of 3…", "Saving product…"),
  every step has a timeout, and any failure prints its reason next to the
  button — a save can no longer hang silently. If "Authorizing image upload…"
  fails, check `/api/health` (`adminReady` must be true and `diag` current).
- **Hero image**: the file picker uploads straight to Supabase Storage
  (`product-images` bucket) — no manual URL needed.
- Set **Status = Active** so it shows on the storefront. Save.
- Product pages, `/shop`, and the homepage refresh within seconds (cache tags
  bust on save).

**Good to know about the admin form:**
- It handles the **core product + hero image + a multi-image gallery**. Use the
  **Gallery images** field to upload several photos for the product page, and tick
  a gallery image's **Del** box to remove it on save.
- The schema also supports a **spec table** (`product_specs`), which isn't in the
  form yet — add spec rows via the Supabase **Table editor** (see `seed.sql` for
  the shape) if you want the spec list on a product page.

**Site settings** (`/admin/settings`):
- **Footer contact info** — the company email, phone, and address shown in the
  footer ship with placeholders; edit them any time. Leave a field empty to
  hide it.
- **Shipping** — the store-wide default flat fee (default $50), or tick
  **Free shipping on all orders**. Each product can also set its **own**
  shipping fee (or free-shipping flag) on the product form — the product page
  then shows the fee, or the fee crossed out next to FREE. Order shipping is
  the sum of per-item fees; cart, checkout, the charge itself, and email
  receipts all agree. Delivery takes 12–20 days depending on the shipping
  route.
- **System page** (`/admin/status`) — live view of every configuration item
  (Supabase, Render, Stripe, PayPal, Turnstile), whether checkout is live or
  paused, and a payment log of the last 30 orders (method, status, total).
  When **no payment provider is connected, checkout is paused**: buyers see a
  &ldquo;high order volume — try again in a few hours&rdquo; notice and no
  unpayable orders are taken.

**Tech Lab**: migration `0004` ships six complete, published articles (DIY,
tech, riding, safety). Edit or unpublish them in `/admin/articles`, which also
lets you write new ones.

**Is Supabase ready?** Yes — once Steps 1–1e are done and you've promoted your
account (this step), the database, RLS, storage bucket, and admin upload flow are
all live. You can start uploading real products immediately.

---

## 7. Keep the Render backend warm

Prevents the free-tier cold start from delaying order emails / contact during a
spike.

1. In GitHub → repo **Settings → Secrets and variables → Actions → Variables**,
   add a variable `RENDER_BACKEND_URL` = your Render URL
   (e.g. `https://edrift-backend.onrender.com`).
2. The workflow `.github/workflows/keep-render-warm.yml` then pings `/health`
   every ~10 min. (GitHub's scheduler is best-effort; for extra reliability also
   point a free monitor like cron-job.org / UptimeRobot at `<render>/health`.)

---

## 8. Go-live checklist

- [ ] Migrations `0001` + `0002` run; `seed.sql` run (categories exist).
- [ ] Supabase **Site URL** + **Redirect URL** point at the real domain.
- [ ] Render deployed; `/health` returns ok; all env vars set.
- [ ] Cloudflare Worker deployed; all env vars set; custom domain (optional) wired.
- [ ] `INTERNAL_API_KEY` is **identical** on Render and Cloudflare.
- [ ] At least one payment provider connected (Stripe and/or PayPal).
- [ ] Stripe webhook → Render `/stripe/webhook`, `STRIPE_WEBHOOK_SECRET` set (if
      using Stripe).
- [ ] PayPal webhook → Render `/paypal/webhook`, `PAYPAL_WEBHOOK_ID` + PayPal
      creds set on Render (if using PayPal — see §4c).
- [ ] Resend domain verified; test email received.
- [ ] Your account promoted to **admin**; a real product uploaded and visible.
- [ ] `RENDER_BACKEND_URL` variable set; keep-warm workflow green.
- [ ] **Test purchase** end-to-end (Stripe test card / PayPal sandbox: order →
      paid → email), then switch to live keys.
- [ ] Ran the load test in [`SCALING.md`](./SCALING.md) before posting to
      Instagram.

---

## 9. Environment variables at a glance

**Cloudflare (Next.js app):**
```
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RENDER_API_URL
INTERNAL_API_KEY
STRIPE_SECRET_KEY                    # if using Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY   # if using Stripe
PAYPAL_CLIENT_ID                     # if using PayPal
PAYPAL_SECRET                        # if using PayPal
PAYPAL_ENV                           # sandbox | live
GOOGLE_MAPS_API_KEY                  # optional — upgrades address autocomplete
```

**Render (`/server`):**
```
SITE_URL
INTERNAL_API_KEY            # same value as Cloudflare
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
EMAIL_FROM
ORDERS_NOTIFICATION_EMAIL
STRIPE_SECRET_KEY           # if using Stripe
STRIPE_WEBHOOK_SECRET       # if using Stripe
```

**GitHub Actions (keep-warm):**
```
RENDER_BACKEND_URL         # repo *variable*, not a secret
```

**Cloudflare (Turnstile bot protection — optional):**
```
NEXT_PUBLIC_TURNSTILE_SITE_KEY   # build-time (client widget)
TURNSTILE_SECRET_KEY             # server verification
```

For scaling behavior, capacity limits, and upgrade triggers, see
[`SCALING.md`](./SCALING.md).

---

## 10. Security hardening

The app ships secure by default: Row Level Security on every table, admin writes
gated by `requireAdmin()`, server-side price recomputation at checkout, the
service-role key server-only, Stripe webhook signature verification, sanitized
search, and security headers (incl. HSTS). The steps below add edge-level
protection you configure in dashboards.

### 10a. Bot protection on public forms (Turnstile) — recommended before launch
Stops spam/abuse of the contact and newsletter forms (which send email through
Render/Resend). The code is already wired; it activates when you add the keys.

1. Cloudflare dashboard → **Turnstile** → **Add site**. Add your domain; choose
   the **Managed** widget.
2. Copy the **Site Key** and **Secret Key**.
3. On your Worker → **Settings → Variables and Secrets**, add:
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = the Site Key
   - `TURNSTILE_SECRET_KEY` = the Secret Key (mark as a Secret)
4. **Redeploy** (the site key is baked in at build time). The contact and
   newsletter forms now show the widget and reject unverified submissions.

### 10b. Rate limiting (WAF)
Protects checkout/API/forms from volumetric abuse during a spike.
1. Cloudflare dashboard → your domain → **Security → WAF → Rate limiting rules**
   → **Create rule**.
2. Suggested starter rules:
   - Path `/api/checkout` — more than **10 requests/minute per IP** → **Block**
     (or Managed Challenge).
   - Paths `/support` and any form POSTs — more than **20/minute per IP** →
     **Managed Challenge**.
3. Deploy the rule. Tune thresholds to your real traffic.

### 10c. HSTS (force HTTPS)
Already sent by the app as a `Strict-Transport-Security` header. For belt-and-
suspenders, also enable it at the edge: Cloudflare → **SSL/TLS → Edge
Certificates → HTTP Strict Transport Security (HSTS)** → Enable (max-age 6+
months). Only do this once you're sure the site is always HTTPS.

### 10d. Admin account
- Use a **strong, unique password** for the admin login — it can create/delete
  products and read orders.
- Keep the admin email/role limited to people who need it (`profiles.role`).
- Full TOTP MFA needs an in-app enrollment flow (not a dashboard toggle) — ask
  if you want it built.

### 10e. Secrets hygiene
- `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `PAYPAL_SECRET`, `TURNSTILE_SECRET_KEY`, and `INTERNAL_API_KEY` are secrets —
  set them only as encrypted variables in Cloudflare/Render, never client-side,
  never committed. (`.env*` is git-ignored.)
- The service-role key bypasses RLS — treat it like a root password. Rotate it in
  Supabase (Settings → API) if it's ever exposed.


## Product colours

Add a `Colors:` line to a product .txt and buyers get swatches to choose from:

```
Colors: Midnight Black #101010, Voltage Blue #1e5bff
Hazard Lime
- Gunmetal #4a4a4a
```

One line, one per line, or both — a blank line ends the list. `Colours:` works
too. The hex is optional and only paints the swatch; a colour without one shows
as a labelled button. Duplicates are dropped and the list is capped at 24.

Import the file in the admin product form and the Colours field fills in, with
a live swatch preview so a typo shows up there rather than on the live page.
You can also just type the field directly.

What it changes downstream:

- The product page requires a choice before Add to Cart or Buy Now, and says so
  if the buyer clicks without picking.
- The colour is part of the cart line's identity — the same trike in two
  colours is two lines, not one with a doubled quantity.
- The checkout API re-validates the colour against the product, so a crafted
  request can't order a variant that doesn't exist, and stores the product's own
  spelling on the order line.
- The colour appears in the cart, at checkout, on the receipt, in the
  confirmation and shipping emails, on the rider dashboard, and on the admin
  order page for packing.

Requires `supabase/migrations/0012_product_colors.sql`. Until it runs, products
save without colours and the admin form warns which migration is missing.

## Product information sheets (PDF)

Every product page carries a **Download product information** link. It serves
`/product/<slug>/information` — a PDF built from the live product record at the
moment it is requested, so it can never go stale: whatever the admin last saved
is what the buyer downloads.

The sheet contains everything the store knows about the product: name, badge and
tagline; price and any compare-at price; category, power, top speed, range,
skill level and stock; the shipping fee (or FREE, with the fee it replaces shown
struck through); the delivery estimate from `lib/fulfillment.ts`, so it never
promises something the fulfilment emails don't; every colour with its swatch;
the full description, laid out with the same block rules as the product page;
the complete technical specification; what the buyer pays; and how to order
and reach us.

### The store logo

Upload it once in **Admin → Settings → Store logo**. It is drawn at the top of
page one and, at 7% opacity, as the watermark behind every page.

Your browser converts the file to a **PNG scaled to 600px** before uploading.
That matters: PDF can only embed PNG and JPEG, and PNG is the one that keeps a
transparent background — a JPEG logo prints as a white box. If the conversion
can't run (an SVG, say), the server refuses the upload and tells you to export a
PNG. With no logo uploaded, the watermark falls back to the company name set
large and light, so the sheet still reads as yours.

Check the result with **Preview product sheet (PDF)** on any product's edit page.

Requires `supabase/migrations/0013_store_logo.sql`. Until it runs, the logo
upload reports which migration is missing and the sheets use the text watermark.

### How the PDF is generated

`lib/pdf.ts` writes the PDF bytes directly — no dependency, because the
storefront runs on Cloudflare Workers where bundle size and CPU are budgeted.
It uses the PDF standard-14 fonts (Helvetica), so nothing is embedded and
**text is limited to the WinAnsi character set**: curly quotes, dashes, degree
signs and accented Latin letters are fine, but a non-Latin script cannot be
rendered without embedding a font. `lib/product-sheet.ts` lays the page out on
top of it.

Images go in the cheap way where possible. An opaque PNG's own deflate stream is
already a valid PDF image stream (PDF's `/Predictor 15` is exactly PNG's row
filtering), so it is embedded untouched — no decompression, no quality loss. A
PNG with alpha is inflated, split into colour and mask, and re-compressed;
JPEG is passed straight through as `/DCTDecode`.

Nothing about the logo can break a download: a fetch that fails, times out,
exceeds 4 MB or turns out not to be an embeddable image simply falls back to the
text watermark.

## Announcements (the scrolling stripe)

**Admin → Announcements** creates the short notices that scroll across a stripe
at the very top of every storefront page — a sale, a shipping delay, a restock,
a holiday cut-off. Create, edit, reorder, switch on/off and delete them there.

Each notice has:

- **Message** — one line, up to 200 characters. Long enough to say something,
  short enough to read as it scrolls past.
- **Link** (optional) — a path on this site (`/shop`) or a full `https://`
  address. Anything else is refused: this value goes into an anchor on every
  page of the store, so `javascript:` and `data:` URLs never reach it.
- **Start / End** (optional) — in *your* local time. Leave both empty to run it
  until you switch it off. Queue a Black Friday banner weeks ahead and let it
  expire on its own.
- **Order** — lower numbers scroll first.
- **Active** — your on/off switch, independent of the schedule. Unticking it
  wins over any dates.

The admin list labels each row **Showing now**, **Scheduled**, **Finished** or
**Off**, using the same `announcementState()` the storefront uses to decide what
to render — so the label can never disagree with what a visitor sees.

Saving publishes immediately (the save revalidates the announcements tag and the
root layout). A *scheduled* start or end is picked up within the catalog cache
window instead, since nothing triggers it — see `ANNOUNCEMENTS_TTL` in
`lib/db.ts` for why that isn't shorter.

The stripe scrolls right-to-left, the way a news ticker does, pauses while
someone hovers or tabs into it, and does not animate at all for visitors whose
system asks for reduced motion — they get the notices as static text.

Requires `supabase/migrations/0014_announcements.sql`. Until it runs, the admin
page says so and the storefront simply has no stripe.

## Refund emails

Setting an order's status to **refunded** in the admin now emails the customer.
Before, it changed the status and sent nothing — their first sign was a credit
appearing, or failing to appear, on a statement days later.

The email states the refund amount, itemises what is being refunded, and says
refunds are processed manually and should reach their bank within
`COMPANY.refundProcessingDays` days (7). It then tells them what to do if the
money hasn't shown up: check with their bank first, because a pending credit can
clear before it becomes visible.

It is sent from **no-reply@** on your sending domain, derived from `EMAIL_FROM`
— Resend verifies a whole domain, so `no-reply@` on the same domain as your
normal sender is already authorised. On the `resend.dev` sandbox (where only
`onboarding@` may send) the normal sender is used instead. Set
`EMAIL_FROM_NOREPLY` to override.

`reply_to` still points at `COMPANY.supportEmail`, so a customer who replies
anyway reaches a person rather than a void, and the footer names that address.

Unticking **Email the customer** on the order page suppresses it, the same way
it suppresses a stage email. If the send fails, the status change still stands
and the admin is told the customer was *not* notified, with the reason.

## Delivery windows

Every delivery estimate on the site comes from one file: `lib/delivery.ts`. The
product page, the cart, checkout, Stripe's payment page, the PDF product sheet,
the policy and FAQ pages, and the date on every order all read it, so they
cannot disagree.

**The model.** A base window of **12–20 days**, plus a transit allowance of up
to **7 days** for how far the parcel travels:

| Destination | Adds | Quoted |
| --- | --- | --- |
| US and its territories | 0 | 12–20 days |
| Canada, Mexico | 3 | 15–23 days |
| Western/central Europe, UK, Australia, NZ, Japan, Korea, Singapore, HK, Taiwan, UAE, Qatar, Israel | 5 | 17–25 days |
| Everywhere else, and anything unrecognised | 7 | 19–27 days |

Where no destination is known — a product page, a cart before the address is
filled in — the base window is shown alongside wording that says longer routes
add up to 7 days. Once the buyer picks a country, every surface narrows to
*their* window, including Stripe's payment page.

These allowances are the store's own routing assumptions, not carrier data.
They are all in one table in `lib/delivery.ts` so they can be re-tuned against
real delivery times.

**The date on the order** (`orders.estimated_delivery_at`, shown in the tracker
and in every stage email) is the far end of that buyer's own window. A buyer in
the US is given day 20; a buyer in Brazil day 27.

**This is NOT the tracking schedule.** `lib/fulfillment.ts` still runs its stage
emails on the same 0 / 3 / 25 / 28-day cadence, and `SCHEDULE_SPAN_DAYS` is 28.
That number is the cadence the automation fires on, and it is deliberately the
outer bound: the longest quoted window (27 days) still lands inside it. A test
pins that invariant — if a route allowance is ever raised past it, the suite
fails rather than letting the store promise a delivery after the point it stops
updating the customer.

## Address autocomplete at checkout

Typing a street address at checkout offers matching addresses; picking one fills
in the city, state, postal code and country.

**The key never reaches the browser.** Lookups go through
`/api/address/suggest` and `/api/address/resolve`, so the credential stays on
the Worker. A `NEXT_PUBLIC_*` key would be baked into the bundle at build time
and lifted by anyone who looked.

**Two providers, chosen by what is configured:**

- **Google Places** — used when `GOOGLE_MAPS_API_KEY` is set. Worldwide, true
  type-ahead, and what most checkouts buyers are used to actually run on. Needs
  a Google Cloud project with billing and the *Places API (New)* enabled.
  Predictions are cheap; the billed details lookup happens only when a buyer
  actually clicks an address.
- **US Census Bureau geocoder** — the keyless fallback, so the feature works
  with no account at all. Public domain, no key, US addresses only. Buyers
  elsewhere type the address as they always have.

**The form starts with the country.** It is the first field, full width,
because everything below it depends on the answer: the address lookup is scoped
to that country (more accurate and cheaper), and the last two fields are
relabelled to whatever that country calls them — State/ZIP code for a US buyer,
County/Postcode for a British one, Province/Postal code for a Canadian.
`checkoutFieldsFor()` in `lib/validation.ts` holds the terms for the main
markets and falls back to neutral wording elsewhere; inventing a term for a
country we don't know is worse than the generic label. Relabelling is display
only — a test asserts no country override can change `required`, `maxLength`,
`autoComplete` or the field order, so the browser and the server never stop
agreeing about what a valid address is.

**It is an enhancement, never a dependency.** Every keystroke goes straight into
the form. If no provider is configured, the provider is down, the request times
out, or the buyer's address simply isn't in the database, the dropdown never
appears and the form works exactly as it did before. Nothing tells the buyer
anything is wrong, because nothing is.

⚠️ The Census fallback's network path could not be exercised from the
development sandbox (the host is blocked by its egress policy). The response
parsing is unit-tested against the geocoder's documented response shape; the
first real request will be from production. If it returns nothing there, check
the Worker can reach `geocoding.geo.census.gov` — or just set
`GOOGLE_MAPS_API_KEY`, which is the better provider anyway.
