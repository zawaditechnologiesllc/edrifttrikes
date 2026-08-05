# Scaling & Capacity Runbook

Goal: survive **~2,000 users/hour** — and short Instagram-driven bursts on top
of that — on the **free tiers** of Cloudflare, Supabase, and Render, without the
site going down before you decide to pay for premium.

> Platform note: the app runs on **Cloudflare** (Next.js on Workers via the
> OpenNext adapter). The winning move on Cloudflare is that **static page serving
> is unlimited and free**, and **Workers include 100,000 requests/day free** —
> so the strategy is to keep browsing on static/cached responses and spend Worker
> requests only on the small commerce/auth slice.

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

| Request | Served by | Worker request? | Hits Supabase? | Hits Render? |
| --- | --- | --- | --- | --- |
| Home, product, tech-lab, our-story, legal, etc. (logged out) | **Cloudflare static assets / ISR** | No (or cache-hit) | Only on cache refresh | No |
| Static assets (images, CSS, JS) | **Cloudflare assets** (unlimited) | No | No | No |
| Catalog/content data behind pages | **`unstable_cache`** data layer | — | Only on cache miss/refresh | No |
| Shop filters / search (dynamic) | Worker + Supabase (cached reads) | Yes | Cache miss only | No |
| Login / account / wishlist / checkout | Worker + Supabase (per user) | Yes | Yes | No |
| Stripe webhook, order/welcome/newsletter email, contact | **Render** | No | Yes (service role) | Yes |
| PayPal capture (on return from PayPal) | Worker + Supabase | Yes | Yes | via email call |

**Key point:** the browse path — which is 95%+ of an Instagram spike — is
CDN + in-memory cache. Supabase and Render are only in the *commerce/auth*
path, which is a tiny fraction of traffic.

---

## 3. What has been hardened (and why)

1. **Middleware only runs on logged-in routes.** The Supabase session refresh in
   `middleware.ts` is scoped (via its `matcher`) to `/account`, `/admin`,
   `/wishlist`, and `/api/wishlist`. Public catalog/marketing pages don't invoke
   the Worker at all — Cloudflare serves them as static assets (unlimited, free),
   which is what keeps an Instagram-scale spike inside the free tier. On the
   routes it does run, it still skips the Supabase Auth network call for requests
   with no auth cookie.
   → `middleware.ts`, `lib/supabase/middleware.ts`

2. **Shared cached data layer.**
   Public catalog/content reads (products, categories, articles, search) are
   wrapped in Next's `unstable_cache` with a TTL and cache tags. Even a
   dynamically rendered page (shop with filters, search results) reads from this
   cache instead of querying Supabase per request. Admin edits call
   `revalidateTag()` so changes still show up immediately.
   → `lib/db.ts`, `app/admin/actions.ts`

3. **ISR / static on public pages.** Home, product, electric-trikes, tech-lab,
   and the marketing/legal pages render to static HTML and refresh in the
   background, so Cloudflare's asset layer serves them without a Worker.
   → `export const revalidate` in the page files.

4. **Backend calls are time-bounded.** Calls to the Render backend now abort
   after 8s (`AbortController`). A cold Render instance can no longer hang a
   Worker until *its* timeout. Email is best-effort and degrades quietly.
   → `lib/email.ts`, `lib/api.ts`

5. **Render kept warm.** A GitHub Action pings `/health` every ~10 min so the
   free instance doesn't cold-start mid-campaign.
   → `.github/workflows/keep-render-warm.yml`

6. **Search input is sanitized** before hitting the PostgREST `or` filter, so a
   malformed query can't error-storm the database under load.
   → `searchProducts` in `lib/db.ts`

7. **Plain `<img>` with lazy loading, not `next/image`.** Deliberate: hosted
   image optimization has hard free-tier limits and would itself become the
   bottleneck. Images are served directly (from Supabase Storage's CDN) and lazy
   loaded.

8. **Uploaded images are cached for 1 year** (`cache-control: max-age=31536000`).
   Filenames are random UUIDs, so every object is immutable — a changed image is
   always a new URL. This is the single biggest lever on **Supabase Storage
   egress**: the default TTL is only 1 hour, which makes the CDN and browsers
   re-download every image hourly. With the long TTL, repeat views come from the
   browser/CDN cache and never touch Storage.
   → `IMAGE_CACHE_CONTROL` in `app/admin/actions.ts` + `ProductForm.tsx`

---

### Reducing Supabase Storage egress (if "Cached Egress" is high)

Cached egress = bytes the CDN serves to visitors for your product/article images
(marketing/hero images live in `public/assets`, served free by Cloudflare — they
don't count). To cut it:

1. **Long cache-control (done, #8 above).** New uploads cache for a year. For
   images uploaded *before* this change, re-stamp them once:
   ```bash
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run storage:cache
   ```
   (`scripts/reset-storage-cache.mjs` — downloads + re-uploads each object with
   the 1-year TTL; same URLs, no DB changes, safe to re-run.)
2. **Upload smaller source images.** A product hero doesn't need to be 3000px /
   several MB. Resize to ~1600px and prefer **WebP** before uploading — this cuts
   bytes-per-request for both cached and uncached egress.
3. **Stable URLs (already the case).** The app stores each image's `getPublicUrl`
   once and renders it as-is — no per-request signed URLs, no `?t=Date.now()`
   cache-busting, no `next/image` loader hammering `/object/info`. Don't add those.
4. **Find the top offenders:** Supabase → Logs Explorer → "Storage egress"
   template, or sort by `cf_cache_status = 'HIT'`, then resize those specific
   files.

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

> **Good news:** Cloudflare's free tier **allows commercial use**, so you can
> launch a paid store on it at $0. The main free-tier
> ceiling to watch is the **Workers 100,000 requests/day** cap — but because
> browsing is served as static assets (which don't count), you only spend Worker
> requests on dynamic/commerce routes, so 2,000 users/hour stays well under it.

Approximate free-tier ceilings (verify current numbers — providers change
them):

| Service | Free tier gives you | Upgrade when you see… | First paid tier |
| --- | --- | --- | --- |
| **Cloudflare** | Unlimited static requests & bandwidth; Workers **100k requests/day**; free deploys | Sustained Worker traffic approaching 100k/day (dynamic routes), or you need higher limits/observability | Workers Paid, ~$5/mo (10M requests/mo included) |
| **Supabase** | 500 MB DB, ~5 GB egress/mo, shared (Nano) compute, ~50K MAU, project pauses after 7 days idle | Egress warnings, slow queries under load, connection errors, or you need it to never pause | Pro, ~$25/mo |
| **Render** | 512 MB RAM, spins down after 15 min idle, 750 hrs/mo | Cold starts still hurting despite keep-warm, OOM/restarts, or webhook/email latency complaints | Starter, ~$7/mo |

At the traffic you're describing, you can likely launch entirely free. The first
dollars, when you need them, are best spent on **Render Starter** (~$7/mo — kills
cold starts on the checkout/email path), then **Cloudflare Workers Paid** (~$5/mo
— only if dynamic Worker requests approach 100k/day), then **Supabase Pro**
(removes the idle pause + gives real compute) as catalog size, media egress, or
user count grows.

> **To stay static-and-free longer:** the more of the catalog that's served as
> ISR/static (vs. dynamic Worker rendering), the fewer Worker requests you spend.
> If dynamic routes ever push you toward the daily cap, enabling the R2
> incremental cache (see `open-next.config.ts` / `docs/DEPLOYMENT.md`) lets more
> responses be cache-served.

---

## 6. Load-test before the campaign

Don't guess — hit it. From a machine (not the target's own network):

```bash
# ~50 concurrent users hammering the homepage for 30s.
# Install: https://github.com/rakyll/hey  (or use k6, artillery, oha)
hey -z 30s -c 50 https://YOUR-SITE/

# Then a product page and the shop page:
hey -z 30s -c 50 https://YOUR-SITE/product/SOME-SLUG
hey -z 30s -c 50 "https://YOUR-SITE/shop?category=trikes"
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
