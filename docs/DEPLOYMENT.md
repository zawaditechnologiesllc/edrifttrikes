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

> **Why Cloudflare instead of Vercel:** Vercel's free Hobby plan forbids
> commercial use (a store taking payments), which would force Vercel Pro
> (~$20/mo) on day one. Cloudflare's free tier **allows** commercial use — static
> page serving is unlimited/free and Workers include 100,000 requests/day free —
> so a real store can launch at $0 and scale far before paying. The app runs on
> Cloudflare through the [OpenNext](https://opennext.js.org/cloudflare) adapter.
> See [`SCALING.md`](./SCALING.md) for the capacity math and upgrade triggers.

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
   This creates all tables, row-level-security policies, the `is_admin()` helper,
   the public **`product-images`** storage bucket, the products' **featured**
   flag, the **site_settings** table (footer contact + shipping fee), and the
   complete set of **Tech Lab articles**. On an existing database just run the
   migrations you haven't run yet — all are safe to re-run.

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
- **Site URL**: `https://YOUR-WORKER.workers.dev` (update after Cloudflare is
  live, or set to your custom domain).
- **Redirect URLs**: add `https://YOUR-WORKER.workers.dev/auth/callback`.

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
>   "release-2026-07-22c"`. If your deployed `/api/health` shows an older value
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

### 4b. PayPal (optional)
1. PayPal Developer dashboard → **Apps & Credentials** → create an app → copy the
   **Client ID** and **Secret**.
2. On **Cloudflare** set `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, and `PAYPAL_ENV`
   (`sandbox` to test, `live` to go live). No Render webhook is needed — the app
   creates *and* captures the PayPal order itself on return.
3. Flow: app creates a PayPal order → buyer approves on PayPal → PayPal returns to
   `/api/paypal/capture` → the app captures, marks the order `paid`, and emails
   the receipt. Test in `sandbox` with a PayPal sandbox buyer account first.

---

## 5. Resend (email)

1. Resend → create an **API key** → `RESEND_API_KEY` on **Render**.
2. Verify your sending domain (Resend → Domains) so `EMAIL_FROM` can use
   `@yourdomain.com`. Until verified you can test with Resend's sandbox sender,
   but production email needs a verified domain.

---

## 6. Make yourself admin + upload products

The admin dashboard (`/admin`) is gated on `profiles.role = 'admin'`. Signing up
creates a profile with role `customer`, so promote yourself once:

1. On the **live site**, go to `/login` and **register** with your email
   (`okoth59@gmail.com`).
2. In Supabase **SQL Editor**, run:
   ```sql
   update public.profiles set role = 'admin'
   where email = 'okoth59@gmail.com';
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
- **Shipping** — one constant flat fee applied to every order (default $50),
  or tick **Free shipping on all orders** to ship free. Cart, checkout, the
  charge itself, and email receipts all follow this setting; delivery takes
  12–20 days depending on the shipping route (stated on the site and in the
  confirmation email).

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
