# E-Drift Trikes — Storefront

The **E-Drift Trikes** storefront, built from the *Voltage Drift* design system
exported from Google Stitch and implemented as a production **Next.js** app on
the project's stack:

| Layer | Service |
| --- | --- |
| Frontend / hosting | **Vercel** (Next.js App Router) |
| Auth + database | **Supabase** |
| Backend API | **Render** |
| Dev | **Claude Code** |
| Repo | **GitHub** |

> Design language: *Voltage Drift* — "Industrial Minimalism meets High-Contrast
> Boldness." Anton display type, Inter body, Voltage Blue (`#1e5bff`) actions,
> Hazard Lime (`#c4f731`) accents, Signal Orange (`#ff8c00`) urgency, on a
> charcoal (`#0e0e11`) / off-white (`#f6f6f3`) "Garage vs. Showroom" base.
> The full token set lives in [`tailwind.config.ts`](./tailwind.config.ts) and
> the brand spec in [`docs/DESIGN.md`](./docs/DESIGN.md).

## Tech stack

- [Next.js 14](https://nextjs.org/) (App Router, TypeScript, React 18)
- [Tailwind CSS 3](https://tailwindcss.com/) with `@tailwindcss/forms` and
  `@tailwindcss/container-queries`
- [`@supabase/ssr`](https://supabase.com/docs/guides/auth/server-side/nextjs)
  for auth/session handling
- Anton + Inter + Material Symbols (Google Fonts)

## Project structure

```
app/
  layout.tsx              # <html>, fonts, global chrome, Enhancements
  globals.css             # Tailwind + Voltage Drift custom effect classes
  page.tsx                # Homepage
  shop/                   # Shop all trikes
  electric-trikes/        # Electric drift trikes category
  product/volt-s1-pro/    # Product detail page (PDP)
  cart/                   # Cart ("Garage Manifest")
  checkout/               # Global checkout
  order-confirmation/     # Order confirmed
  search/                 # Search results (+ /search/no-results)
  login/                  # Rider authentication
  account/                # Rider dashboard
  tech-lab/               # Content hub (+ /tech-lab/sleeve-fitting article)
  our-story/  support/  shipping-warranty/  wishlist/
  not-found.tsx           # 404 "Off Track"
components/
  Enhancements.tsx        # Client-side progressive enhancement (see below)
lib/
  supabase/{client,server,middleware}.ts   # Supabase wiring
  api.ts                  # Render backend fetch helper
middleware.ts             # Refreshes the Supabase session per request
```

Each route is a faithful port of the corresponding Stitch screen. The exported
screens already carried responsive `md:`/`lg:` breakpoints, so the desktop
exports are used as the single responsive source for each page.

## Routes

| Path | Screen |
| --- | --- |
| `/` | Homepage |
| `/shop` | Shop all trikes |
| `/electric-trikes` | Electric drift trikes |
| `/product/volt-s1-pro` | Volt S1 Pro — technical PDP |
| `/cart` | Cart / Garage Manifest |
| `/checkout` | Global checkout |
| `/order-confirmation` | Order confirmation |
| `/search`, `/search/no-results` | Search results / empty state |
| `/login` | Rider authentication |
| `/account` | Rider dashboard |
| `/tech-lab`, `/tech-lab/sleeve-fitting` | Content hub + DIY article |
| `/our-story` | Our story |
| `/support` | Support hub |
| `/shipping-warranty` | Shipping & warranty |
| `/wishlist` | Parts bin / wishlist |
| `*` | 404 "Off Track" |

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase + Render values
npm run dev                  # http://localhost:3000
```

Build / production:

```bash
npm run build
npm start
```

## Environment variables

See [`.env.example`](./.env.example). Required for auth/data:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `NEXT_PUBLIC_API_BASE_URL` (Render backend base URL)

The app builds and renders without these set — auth/data calls simply no-op or
throw a clear error until configured, so the storefront previews cleanly.

## Deployment

- **Vercel** — import the GitHub repo; Vercel auto-detects Next.js. Add the env
  vars above in Project → Settings → Environment Variables.
- **Supabase** — create a project, then add the URL + anon key. The
  `middleware.ts` keeps the auth session fresh on every request.
- **Render** — deploy the backend API and set `NEXT_PUBLIC_API_BASE_URL` to its
  URL. Frontend data calls go through `lib/api.ts`.

## Interactivity

The Stitch export used inline `onclick` handlers and per-page scripts. Those were
converted into declarative `data-*` hooks driven by a single delegated client
component, [`components/Enhancements.tsx`](./components/Enhancements.tsx):

- accordions (`data-accordion`), overlays/drawers (`data-show` / `data-hide` /
  `data-toggle-hidden`), quantity steppers (`data-step`), line-item removal
  (`data-remove-closest`), back navigation (`data-history-back`)
- sticky-nav "tighten on scroll" effect

## Known limitations / next steps

- **Imagery** references Stitch's Google-hosted CDN (`lh3.googleusercontent.com`).
  Those `aida-public` URLs can expire — replace them with your own assets
  (e.g. Supabase Storage or `/public`) for production.
- **Navigation links** are the Stitch placeholders (`href="#"`). Wiring them to
  the routes above, plus connecting product/cart/auth flows to Supabase + the
  Render API, is the natural next iteration.
- A handful of bespoke per-page micro-interactions (e.g. auth login/register tab
  switch) render in their default state; they can be wired up as needed.
