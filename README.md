# E-Drift Trikes — Storefront + Admin

A dynamic, sellable storefront for **E-Drift Trikes**, built from the *Voltage
Drift* design system (exported from Google Stitch) as a production **Next.js**
app with a full **admin dashboard**, **Supabase** auth/data/storage, **Resend**
email, and **Stripe** checkout.

| Layer | Service |
| --- | --- |
| Frontend + commerce server | **Cloudflare** (Next.js on Workers via the **OpenNext** adapter) |
| Backend service (email · webhooks · contact) | **Render** (`/server`) |
| Auth · DB · Storage | **Supabase** |
| Transactional email | **Resend** (sent from the Render service) |
| Payments | **Stripe** and/or **PayPal** |
| Repo | **GitHub** |

The system is split into two deployables:

- **Cloudflare (Next.js)** — the storefront + admin, all synchronous commerce
  (catalog, cart, checkout session creation, orders). Built with
  [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) (`npm run deploy`).
- **Render (`/server`)** — a required Node/Express backend that owns
  transactional **email** (Resend), the **Stripe webhook**, and the **contact**
  endpoint. The app calls it server-to-server with a shared `INTERNAL_API_KEY`.

> Design language: *Voltage Drift* — Anton display type, Inter body, Voltage Blue
> (`#1e5bff`) actions, Hazard Lime (`#c4f731`) accents, on a charcoal/off-white
> "Garage vs. Showroom" base. Tokens in [`tailwind.config.ts`](./tailwind.config.ts),
> brand spec in [`docs/DESIGN.md`](./docs/DESIGN.md).

## What works

**Storefront** — dynamic, data-driven from Supabase:
- Shop with category / power / sort filters, dynamic product pages, search.
- Client cart (drawer + full cart page) with live totals.
- Checkout that recomputes prices server-side, creates an order, and either
  redirects to **Stripe Checkout** (when configured) or places the order and
  emails confirmation directly.
- Email-only accounts (no Google/Apple): register, login, logout, order history.
- Tech Lab content (articles) and newsletter signup.

**Admin dashboard** (`/admin`, gated by `role = 'admin'`):
- Overview with revenue / orders / products / riders.
- Products CRUD with **image upload to Supabase Storage** — images are
  auto-optimized (resized + WebP) in the browser and cached for a year to keep
  Storage egress low ([`docs/SCALING.md`](./docs/SCALING.md)).
- Orders list + detail: change payment status, move the delivery stage, and
  save a tracking number / courier — each save reports success or the exact
  error. Marking an order **paid** by hand starts the delivery journey and
  emails the customer, exactly as a payment webhook would.
- **Paid orders** (`/admin/orders/paid`): everything money has actually been
  received for, whether confirmed by a Stripe/PayPal webhook or marked paid by
  an admin. Revenue totals, a source badge per order, and filters by gateway.
- **Messages** (`/admin/messages`): the support inbox fed by the contact form,
  with an unanswered badge in the nav. Reply from the dashboard and the
  customer is emailed directly, with their original message quoted.
- Categories and Tech Lab article management.
- **System** page: one-click catalog **export to JSON** (backup / migrate to a
  fresh project — see [`docs/MIGRATION.md`](./docs/MIGRATION.md)).

**Order tracking + automated delivery journey**
- Order confirmation email goes out **immediately** when the buyer places the
  order, before they're handed to Stripe/PayPal.
- Once payment clears (Stripe webhook, PayPal capture, or an admin marking it
  paid) the order enters a tracked delivery journey and the customer gets a
  shipping confirmation.
- A scheduler then advances every paid order and emails at each step:

  | Day after payment | Stage | What the customer is told |
  | --- | --- | --- |
  | 0 | Confirmed | Payment cleared, shipment being prepared |
  | 3 | Shipped | Left the garage, with the shipping partner |
  | 25 | Arriving | Shipping complete, quotes the arrival date |
  | 28 | Ready for collection | Wait for the courier to call/email to collect or confirm door delivery |

- Riders follow it live on `/account` and the receipt page; admins see the same
  timeline, can jump an order forward, and can attach a tracking number.
- Timings live in one place — [`lib/fulfillment.ts`](./lib/fulfillment.ts).

> **Full guide: [`docs/FULFILLMENT.md`](./docs/FULFILLMENT.md)** — the schedule,
> how orders get marked paid, why nobody is ever emailed twice, the scheduler
> setup, and how to test the whole 28-day journey in a minute.

**Backend / data**
- Full Postgres schema with Row-Level Security (`supabase/migrations/0001_init.sql`).
- Seed of real catalog + articles (`supabase/seed.sql`).
- Resend emails: welcome, order confirmation, delivery-stage updates, newsletter.
- Stripe Checkout + webhook to mark orders paid; PayPal captures verified
  against the order before anything is marked paid.

## Project structure

```
app/
  layout.tsx                 # fonts, CartProvider, CartDrawer, Enhancements
  page.tsx                   # homepage (Voltage Drift hero/marketing)
  shop/ product/[slug]/ search/ cart/ checkout/ order-confirmation/
  account/                   # rider dashboard (orders, sign out)
  login/                     # email auth (AuthForm + server actions)
  tech-lab/  tech-lab/[slug]/ # content hub + articles
  our-story/ support/ shipping-warranty/ wishlist/ electric-trikes/
  admin/                     # dashboard, products, orders, paid orders,
                             # messages, categories, articles
  api/checkout/  api/paypal/capture/  auth/callback/
  api/cron/orders/           # the fulfillment scheduler
  api/internal/order-paid/   # shared paid transition (called by Render)
  not-found.tsx
components/
  cart/{CartProvider,CartDrawer,AddToCartButton}.tsx
  storefront/{SiteHeader,SiteFooter,ProductCard,NewsletterForm}.tsx
  Enhancements.tsx
lib/
  db.ts types.ts format.ts totals.ts email.ts stripe.ts paypal.ts
  fulfillment.ts             # the delivery schedule — stages, timings, copy
  orders.ts                  # markOrderPaid / advanceOrder (one impl, idempotent)
  internal-auth.ts           # shared-secret auth for server-to-server calls
  actions/newsletter.ts
  supabase/{client,server,admin,public,middleware}.ts
tests/                       # node --test: money math + delivery schedule
supabase/
  migrations/0001_init.sql   # schema + RLS + storage bucket
  migrations/0006_...sql     # fulfillment tracking + configurable tax
  migrations/0007_...sql     # payment source + contact-message replies
  seed.sql                   # catalog + articles
public/assets/               # migrated product/hero imagery
```

## Getting started

```bash
npm install
cp .env.example .env.local     # fill in the keys below
npm run dev                    # http://localhost:3000
```

### 1. Supabase
1. Create a project, copy the URL + anon key + service-role key into `.env.local`.
2. Run **every file in `supabase/migrations/` in order (0001 → 0007)**, then
   **`supabase/seed.sql`**, in the Supabase SQL editor (or `supabase db push`).
   This creates all tables, RLS policies, the `product-images` storage bucket,
   the order-tracking timeline, and seeds the catalog. Each migration is safe to
   re-run.
3. **Make yourself an admin**: register through `/login`, then in the SQL editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
   You can now reach `/admin`.

### 2. Render backend (required)
The backend lives in [`/server`](./server) and is deployed via the root
[`render.yaml`](./render.yaml) blueprint (New → Blueprint → connect this repo).
Set its env (`SITE_URL`, `INTERNAL_API_KEY`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`,
`ORDERS_NOTIFICATION_EMAIL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`). Then
on **Cloudflare** set `RENDER_API_URL` to the Render URL and `INTERNAL_API_KEY`
to the same shared value. Run locally with `cd server && npm install && npm start`.

### 3. Resend (email) — on Render
Add `RESEND_API_KEY` + verified `EMAIL_FROM` to the **Render** service. It sends
welcome, order-confirmation, newsletter and contact emails.

### 4. Payments — Stripe and/or PayPal
Checkout shows whichever provider is connected (both → the buyer chooses; one →
that one; neither → order is placed and emailed directly).

- **Stripe** — add `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` on
  Cloudflare (the app creates checkout sessions). Point the Stripe **webhook** at
  the Render service `https://<render-url>/stripe/webhook` (event
  `checkout.session.completed`) and set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
  on Render — it marks orders paid and emails the confirmation. (Yes, the Stripe
  secret goes in **both** the app and Render.)
- **PayPal** — add `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_ENV` on Cloudflare.
  The app creates *and* captures PayPal orders itself (no Render webhook needed),
  and accepts **debit/credit cards** (guest — no PayPal account needed) once you
  enable **"PayPal account optional"** on the Business account. See
  [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) §4b.

> **Payments reference — which key goes where + the buyer flow:
> [`docs/PAYMENTS.md`](./docs/PAYMENTS.md).** The Cloudflare-vs-Render env matrix,
> the `PAYPAL_ENV` sandbox/live gotcha, what checkout looks like with one or both
> providers, and how to add inline card fields later.

> The app builds and previews **without any keys** — data calls degrade to empty
> states so you can see the design before wiring services.

## Environment variables

See [`.env.example`](./.env.example): `NEXT_PUBLIC_SITE_URL`, Supabase
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`), Resend (`RESEND_API_KEY`, `EMAIL_FROM`),
Stripe (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
`STRIPE_WEBHOOK_SECRET`), PayPal (`PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`,
`PAYPAL_ENV`).

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Homepage |
| `/shop` · `/product/[slug]` · `/search` | Catalog, product, search |
| `/cart` · `/checkout` · `/order-confirmation` | Buying funnel |
| `/login` · `/account` | Email auth + rider dashboard |
| `/tech-lab` · `/tech-lab/[slug]` | Content hub + articles |
| `/our-story` · `/support` · `/shipping-warranty` · `/wishlist` | Content pages |
| `/admin` (+ products, orders, paid orders, messages, categories, articles) | Admin dashboard |
| `/api/checkout` · `/api/paypal/capture` · `/auth/callback` | App server endpoints |
| `/api/cron/orders` · `/api/internal/order-paid` | Internal — shared-secret auth |
| Render: `/health` `/email/*` `/contact` `/stripe/webhook` `/paypal/webhook` `/orders/advance` | Backend service |

## Deployment

> **Full step-by-step guide: [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)** —
> Supabase → Render → Cloudflare → Stripe/PayPal → Resend, in order, with every
> env var, the admin-promotion SQL, product upload, and a go-live checklist. The
> bullets below are the summary.
>
> **Supabase env matrix + auth URLs + email templates:
> [`docs/SUPABASE_SETUP.md`](./docs/SUPABASE_SETUP.md)** — which variable goes on
> Cloudflare vs Render, the exact Site URL / redirect URLs to add, why there's no
> connection pooler to configure, and the branded auth email templates in
> [`supabase/email-templates/`](./supabase/email-templates/).

- **Cloudflare** — create a Workers project; build command `npm run cf:build` (or
  `npx opennextjs-cloudflare build`), deploy with `npm run deploy`; add all env
  vars in the dashboard. Runs Next.js via the OpenNext adapter.
- **Supabase** — run the migration + seed; set Auth → URL config **Site URL** to
  `https://edrifttrikes.shop` and add `https://edrifttrikes.shop/**` to the
  redirect allow-list (covers `/auth/callback` + password reset).
- **Stripe / PayPal** — add the live keys; point the Stripe webhook at Render.
- **Render** — deploy `/server` via `render.yaml` for email, the Stripe webhook,
  and contact.

> **Scaling / high traffic:** see **[`docs/SCALING.md`](./docs/SCALING.md)** for
> the capacity runbook — how the site absorbs a ~2,000 users/hour load plus
> Instagram bursts on the free tiers, the one-time setup (env vars, Render
> keep-warm), a pre-launch load-test recipe, and the concrete signals for when
> to upgrade each service.

## Notes / next steps

- Marketing/content pages (homepage, our-story, support, shipping, wishlist) keep
  the faithful Voltage Drift design copy; wishlist can be wired to the
  `wishlist_items` table next.
- Product galleries beyond the seeded Volt S1 Pro can be expanded via the admin
  (additional `product_images`).
