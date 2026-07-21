# E-Drift Trikes — Storefront + Admin

A dynamic, sellable storefront for **E-Drift Trikes**, built from the *Voltage
Drift* design system (exported from Google Stitch) as a production **Next.js**
app with a full **admin dashboard**, **Supabase** auth/data/storage, **Resend**
email, and **Stripe** checkout.

| Layer | Service |
| --- | --- |
| Frontend + commerce server | **Vercel** (Next.js App Router — Route Handlers & Server Actions) |
| Backend service (email · webhooks · contact) | **Render** (`/server`) |
| Auth · DB · Storage | **Supabase** |
| Transactional email | **Resend** (sent from the Render service) |
| Payments | **Stripe** |
| Repo | **GitHub** |

The system is split into two deployables:

- **Vercel (Next.js)** — the storefront + admin, all synchronous commerce
  (catalog, cart, checkout session creation, orders).
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
- Products CRUD with **image upload to Supabase Storage**.
- Orders list + detail with status updates.
- Categories and Tech Lab article management.

**Backend / data**
- Full Postgres schema with Row-Level Security (`supabase/migrations/0001_init.sql`).
- Seed of real catalog + articles (`supabase/seed.sql`).
- Resend emails: welcome, order confirmation, newsletter.
- Stripe Checkout + webhook (`/api/stripe/webhook`) to mark orders paid.

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
  admin/                     # dashboard, products, orders, categories, articles
  api/checkout/  api/stripe/webhook/  auth/callback/
  not-found.tsx
components/
  cart/{CartProvider,CartDrawer,AddToCartButton}.tsx
  storefront/{SiteHeader,SiteFooter,ProductCard,NewsletterForm}.tsx
  Enhancements.tsx
lib/
  db.ts types.ts format.ts totals.ts email.ts stripe.ts api.ts
  actions/newsletter.ts
  supabase/{client,server,admin,middleware}.ts
supabase/
  migrations/0001_init.sql   # schema + RLS + storage bucket
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
2. Run **`supabase/migrations/0001_init.sql`** then **`supabase/seed.sql`** in the
   Supabase SQL editor (or `supabase db push`). This creates all tables, RLS
   policies, the `product-images` storage bucket, and seeds the catalog.
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
on Vercel set `RENDER_API_URL` to the Render URL and `INTERNAL_API_KEY` to the
same shared value. Run locally with `cd server && npm install && npm start`.

### 3. Resend (email) — on Render
Add `RESEND_API_KEY` + verified `EMAIL_FROM` to the **Render** service. It sends
welcome, order-confirmation, newsletter and contact emails.

### 4. Stripe (payments)
Add `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` on Vercel (the app
creates checkout sessions). Point the Stripe **webhook** at the Render service
`https://<render-url>/stripe/webhook` (event `checkout.session.completed`) and
set `STRIPE_WEBHOOK_SECRET` on Render — it marks orders paid and emails the
confirmation.

> The app builds and previews **without any keys** — data calls degrade to empty
> states so you can see the design before wiring services.

## Environment variables

See [`.env.example`](./.env.example): `NEXT_PUBLIC_SITE_URL`, Supabase
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`), Resend (`RESEND_API_KEY`, `EMAIL_FROM`),
Stripe (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
`STRIPE_WEBHOOK_SECRET`).

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Homepage |
| `/shop` · `/product/[slug]` · `/search` | Catalog, product, search |
| `/cart` · `/checkout` · `/order-confirmation` | Buying funnel |
| `/login` · `/account` | Email auth + rider dashboard |
| `/tech-lab` · `/tech-lab/[slug]` | Content hub + articles |
| `/our-story` · `/support` · `/shipping-warranty` · `/wishlist` | Content pages |
| `/admin` (+ products, orders, categories, articles) | Admin dashboard |
| `/api/checkout` · `/auth/callback` | Vercel server endpoints |
| Render: `/health` `/email/*` `/contact` `/stripe/webhook` | Backend service |

## Deployment

- **Vercel** — import the repo; add all env vars in Project Settings. Next.js is
  auto-detected.
- **Supabase** — run the migration + seed; set Auth → URL config redirect to
  `https://yourdomain.com/auth/callback`.
- **Stripe** — add the live keys + webhook endpoint.
- **Render** — optional; `lib/api.ts` is ready if you offload heavy/async jobs to
  a separate Render service.

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
