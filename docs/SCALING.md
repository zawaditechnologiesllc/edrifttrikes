# Scaling & Capacity Runbook

Goal: survive **~2,000 users/hour** — and short Instagram-driven bursts on top
of that — on the **free tiers** of Vercel, Supabase, and Render, without the
site going down before you decide to pay for premium.

This document explains where the load actually lands, what has been hardened to
absorb it, the one-time setup you must do, and the concrete signals that tell
you it's time to upgrade each service.

---

## 1. The math

- 2,000 users/hour ≈ **33 users/min ≈ ~0.5 users/sec** on average.
- A browsing user loads ~5–10 pages → **~3–5 page views/sec** average.
- An Instagram post to a large following doesn't arrive evenly. Expect a
  **spike**: a few percent of viewers tapping the link in the first few minutes
  can briefly mean **50–200+ requests/sec**, then it decays.

The steady-state number is small. **The burst is the thing that breaks sites.**
The whole strategy below is: serve the burst from caches and a CDN so it never
becomes one database query (or one auth call) per visitor.

---

## 2. Where each request goes

| Request | Served by | Hits Supabase? | Hits Render? |
| --- | --- | --- | --- |
| Home, product, shop, tech-lab, our-story, etc. (logged out) | **Vercel CDN** (ISR/cached HTML) | Only on cache refresh | No |
| Catalog/content data behind those pages | **`unstable_cache`** data layer | Only on cache miss/refresh | No |
| Static assets (images, CSS, JS) | **Vercel CDN** | No | No |
| Login / account / orders / wishlist | Vercel function + Supabase (per user) | Yes | No |
| Checkout (create order + Stripe session) | Vercel function + Supabase | Yes | No |
| Stripe webhook, order/welcome/newsletter email, contact form | **Render** | Yes (service role) | Yes |

**Key point:** the browse path — which is 95%+ of an Instagram spike — is
CDN + in-memory cache. Supabase and Render are only in the *commerce/auth*
path, which is a tiny fraction of traffic.

---

## 3. What has been hardened (and why)

1. **Middleware skips Supabase Auth for anonymous visitors.**
   `middleware.ts` runs on every request, even cached ones. It used to call
   Supabase Auth (`getUser()`) on *every* request. It now returns immediately
   when the request has no Supabase auth cookie — i.e. for every logged-out
   visitor. A spike of anonymous traffic no longer touches Supabase Auth at all,
   and every cached page loses that network round-trip of latency.
   → `lib/supabase/middleware.ts`

2. **Shared cached data layer.**
   Public catalog/content reads (products, categories, articles, search) are
   wrapped in Next's `unstable_cache` with a TTL and cache tags. Even a
   dynamically rendered page (shop with filters, search results) reads from this
   cache instead of querying Supabase per request. Admin edits call
   `revalidateTag()` so changes still show up immediately.
   → `lib/db.ts`, `app/admin/actions.ts`

3. **ISR on all public pages.** Home, product, shop-linked, and tech-lab pages
   render to static HTML and refresh in the background, so the CDN serves them.
   → `export const revalidate` in the page files.

4. **Backend calls are time-bounded.** Calls to the Render backend now abort
   after 8s (`AbortController`). A cold Render instance can no longer hang a
   Vercel function until *its* timeout. Email is best-effort and degrades
   quietly.
   → `lib/email.ts`, `lib/api.ts`

5. **Render kept warm.** A GitHub Action pings `/health` every ~10 min so the
   free instance doesn't cold-start mid-campaign.
   → `.github/workflows/keep-render-warm.yml`

6. **Search input is sanitized** before hitting the PostgREST `or` filter, so a
   malformed query can't error-storm the database under load.
   → `searchProducts` in `lib/db.ts`

7. **Plain `<img>` with lazy loading, not `next/image`.** Deliberate: Vercel's
   image optimization has hard free-tier limits and would itself become the
   bottleneck. Images are served directly (from Supabase Storage's CDN) and lazy
   loaded.

---

## 4. One-time setup you MUST do

1. **Set environment variables** on all three services (see `.env.example` and
   `render.yaml`). Missing keys make features degrade to no-ops, not crash — but
   the store won't sell until they're set.

2. **Use the Supabase connection *pooler*, not a direct connection**, anywhere
   you use a Postgres connection string (the app uses the REST API, which is
   already pooled — this matters if you add any direct-DB tooling). Free tier
   has very few direct connections; the pooler (Supavisor, port 6543,
   transaction mode) is what handles concurrency.

3. **Enable keep-warm.** Add a repository **variable** `RENDER_BACKEND_URL`
   (e.g. `https://edrift-backend.onrender.com`) under
   *Settings → Secrets and variables → Actions → Variables*. For extra
   reliability also point a free uptime monitor (cron-job.org or UptimeRobot) at
   `<backend>/health` every 5–10 min — GitHub's scheduler is best-effort.

4. **Confirm ISR is live** after deploy: load a product page, note it's fast,
   change a product in `/admin`, and confirm it updates within a few seconds.

---

## 5. When to upgrade (concrete triggers)

> **Read this first — Vercel Hobby is for non-commercial use.** A storefront
> that takes payments is commercial use, which Vercel's Hobby (free) plan does
> **not** permit. Technically you should be on **Vercel Pro ($20/mo)** the day
> you start selling, independent of traffic. The hardening here keeps you from
> *also* needing bigger Supabase/Render tiers, but budget for Vercel Pro as the
> real floor.

Approximate free-tier ceilings (verify current numbers — providers change
them):

| Service | Free tier gives you | Upgrade when you see… | First paid tier |
| --- | --- | --- | --- |
| **Vercel** | ~100 GB bandwidth/mo, generous function invocations, CDN | Commercial use (day one), bandwidth warnings, or function/concurrency throttling in the dashboard | Pro, ~$20/mo |
| **Supabase** | 500 MB DB, ~5 GB egress/mo, shared (Nano) compute, ~50K MAU, project pauses after 7 days idle | Egress warnings, slow queries under load, connection errors, or you need it to never pause | Pro, ~$25/mo |
| **Render** | 512 MB RAM, spins down after 15 min idle, 750 hrs/mo | Cold starts still hurting despite keep-warm, OOM/restarts, or webhook/email latency complaints | Starter, ~$7/mo |

At the traffic you're describing, the sequence that gives the most headroom per
dollar is usually: **Vercel Pro first** (it's required for commerce anyway and
removes the biggest single point of throttling), then **Render Starter** (kills
cold starts on the checkout/email path — cheap), then **Supabase Pro** (removes
pausing + gives real compute) once catalog size, media egress, or user count
grows.

---

## 6. Load-test before the campaign

Don't guess — hit it. From a machine (not the target's own network):

```bash
# ~50 concurrent users hammering the homepage for 30s.
# Install: https://github.com/rakyll/hey  (or use k6, artillery, oha)
hey -z 30s -c 50 https://YOUR-VERCEL-APP.vercel.app/

# Then a product page and the shop page:
hey -z 30s -c 50 https://YOUR-VERCEL-APP.vercel.app/product/SOME-SLUG
hey -z 30s -c 50 "https://YOUR-VERCEL-APP.vercel.app/shop?category=trikes"
```

What good looks like:
- **p95 latency stays low and flat** as concurrency rises (CDN/cache is working).
- **No 5xx / 429s.**
- Supabase dashboard shows **few queries** during the run (cache is absorbing
  reads) — if you see a query per request, a page isn't cached; check its
  `revalidate` and that it uses the cached `lib/db.ts` functions.

Run this a day or two before you post, so there's time to react.

---

## 7. Quick failure playbook

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Site slow/500s only for logged-in users | Supabase Auth pressure or DB compute | Fine for the spike (few users); upgrade Supabase if it persists |
| Every page slow during spike | A page went dynamic / lost its cache | Check `revalidate` exports; confirm reads go through `lib/db.ts` |
| Order confirmation emails delayed | Render cold start | Keep-warm not active, or Stripe retrying — verify workflow + `RENDER_BACKEND_URL` |
| Contact/newsletter “could not send” | Render cold or down | Expected to degrade quietly; the newsletter signup itself still records |
| Supabase project “paused” | 7-day idle pause (pre-launch only) | Open the dashboard to resume; won't happen once you have steady traffic |
