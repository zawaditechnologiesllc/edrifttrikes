# Deployment Guide — E-Drift Trikes

Complete, end-to-end deployment for the full stack:

| Layer | Service | What it runs |
| --- | --- | --- |
| Storefront + admin + checkout | **Vercel** | the Next.js app in this repo root |
| Auth · Database · Image storage | **Supabase** | schema in `supabase/migrations` |
| Email · Stripe webhook · contact | **Render** | the Node service in `/server` |
| Payments | **Stripe** | checkout + webhook |
| Transactional email | **Resend** | sent from the Render service |

Deploy order matters — do it top to bottom. You'll create Supabase first (it
issues the keys everything else needs), then Render (it issues a URL Vercel
needs), then Vercel, then wire Stripe's webhook back to Render.

> **One-time cost reality check:** Vercel's free **Hobby** plan is for
> non-commercial use. A store that takes payments is commercial, so plan to be
> on **Vercel Pro (~$20/mo)** once you go live. Supabase and Render can start on
> free tiers — see [`SCALING.md`](./SCALING.md) for when to upgrade each.

---

## 0. Prerequisites

- Accounts: **GitHub** (this fork), **Supabase**, **Render**, **Vercel**,
  **Stripe**, **Resend**.
- The repo pushed to your GitHub account.
- Generate one shared secret now — you'll paste the *same* value into both Render
  and Vercel later as `INTERNAL_API_KEY`:
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
   This creates all tables, row-level-security policies, the `is_admin()` helper,
   and the public **`product-images`** storage bucket.

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
- **Site URL**: `https://YOUR-APP.vercel.app` (update after Vercel is live, or set
  to your custom domain).
- **Redirect URLs**: add `https://YOUR-APP.vercel.app/auth/callback`.

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
   | `SITE_URL` | `https://YOUR-APP.vercel.app` (fill after Vercel, or your domain) |
   | `INTERNAL_API_KEY` | the shared secret from Step 0 *(blueprint can also generate one — if so, copy it for Vercel)* |
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

## 3. Vercel (storefront + admin)

1. Vercel → **Add New… → Project** → import this repo. Framework auto-detects as
   Next.js; root directory is the repo root (not `/server`).
2. Add environment variables (**Project Settings → Environment Variables**),
   for Production (and Preview if you use it):

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SITE_URL` | `https://YOUR-APP.vercel.app` (or your domain) |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key |
   | `RENDER_API_URL` | the Render URL from Step 2 |
   | `INTERNAL_API_KEY` | **exact same** shared secret as Render |
   | `STRIPE_SECRET_KEY` | Stripe secret key |
   | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |

3. Deploy. Note the production URL.
4. Go back and set `SITE_URL` (Render) and the Supabase **Site URL / Redirect
   URL** (Step 1e) to this real URL if you used a placeholder. Add a custom domain
   in Vercel → **Domains** when ready, then update those three places to the
   domain.

> If a value is missing the app degrades gracefully rather than crashing (e.g.
> no Stripe key → order is placed and emailed directly; no Render URL → emails
> are skipped and logged). "Degrades" is for local/preview — for a live store,
> set them all.

---

## 4. Stripe (payments)

1. Stripe Dashboard → **Developers → API keys**: copy **Secret key**
   (`sk_...`) and **Publishable key** (`pk_...`).
   - `STRIPE_SECRET_KEY` → Vercel **and** Render.
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → Vercel.
2. Create the webhook → **Developers → Webhooks → Add endpoint**:
   - **Endpoint URL**: `https://edrift-backend.onrender.com/stripe/webhook`
     (your Render URL + `/stripe/webhook`).
   - **Events**: `checkout.session.completed`.
   - Save, reveal the **Signing secret** (`whsec_...`) → set as
     `STRIPE_WEBHOOK_SECRET` on **Render**, and redeploy Render.
3. Flow: Vercel creates the Checkout Session → Stripe processes payment →
   Stripe calls the Render webhook → Render marks the order `paid` and sends the
   confirmation email. Test with Stripe **test mode** keys and card
   `4242 4242 4242 4242` before switching to live keys.

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
- **Hero image**: the file picker uploads straight to Supabase Storage
  (`product-images` bucket) — no manual URL needed.
- Set **Status = Active** so it shows on the storefront. Save.
- Product pages, `/shop`, and the homepage refresh within seconds (cache tags
  bust on save).

**Good to know about the current admin form:**
- It handles the **core product + one hero image**. That's enough for a complete,
  sellable listing.
- The schema also supports a **multi-image gallery** (`product_images`) and a
  **spec table** (`product_specs`), but those aren't in the form yet. To add them
  today, insert rows via the Supabase **Table editor** (see `seed.sql` for the
  shape). Ask and I can extend the admin form to manage gallery images and specs
  directly.

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
- [ ] Vercel deployed; all env vars set; custom domain (optional) wired.
- [ ] `INTERNAL_API_KEY` is **identical** on Render and Vercel.
- [ ] Stripe webhook → Render `/stripe/webhook`, `STRIPE_WEBHOOK_SECRET` set.
- [ ] Resend domain verified; test email received.
- [ ] Your account promoted to **admin**; a real product uploaded and visible.
- [ ] `RENDER_BACKEND_URL` variable set; keep-warm workflow green.
- [ ] **Test purchase** end-to-end in Stripe test mode (order → paid → email),
      then switch to live keys.
- [ ] Ran the load test in [`SCALING.md`](./SCALING.md) before posting to
      Instagram.

---

## 9. Environment variables at a glance

**Vercel (Next.js app):**
```
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RENDER_API_URL
INTERNAL_API_KEY
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
```

**Render (`/server`):**
```
SITE_URL
INTERNAL_API_KEY            # same value as Vercel
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
EMAIL_FROM
ORDERS_NOTIFICATION_EMAIL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

**GitHub Actions (keep-warm):**
```
RENDER_BACKEND_URL         # repo *variable*, not a secret
```

For scaling behavior, capacity limits, and upgrade triggers, see
[`SCALING.md`](./SCALING.md).
