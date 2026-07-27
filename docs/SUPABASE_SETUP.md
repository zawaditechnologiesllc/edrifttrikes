# Supabase wiring, environments & auth URLs — E-Drift Trikes

Everything you need to point the app at Supabase correctly for the live domain
**`https://edrifttrikes.shop`**: how the connection works (and why there's no
pooler to configure), which environment variable goes where, the exact URLs to
add in Supabase, and the auth pages/redirects that are already wired.

---

## 1. How the app talks to Supabase (connection & "pooling")

Both deployables talk to Supabase over its **HTTPS API**, not a raw Postgres
socket:

- The **Cloudflare app** uses `@supabase/ssr` + `@supabase/supabase-js`
  (`lib/supabase/*`) → Supabase **Auth (GoTrue)** and **PostgREST**.
- The **Render backend** (`/server`) uses `@supabase/supabase-js` with the
  service-role key → the same HTTPS API.

**There is no direct Postgres connection anywhere in this codebase** — no `pg`
client, no `DATABASE_URL`, no port 5432/6543. So:

> ✅ **You do NOT need to set a connection string or a pooler port.** Supabase
> pools the database behind its REST/Auth API for you. The "use the pooler"
> advice only applies if you later add direct-DB tooling.

**When the pooler *does* matter (optional, later):** if you ever connect a tool
directly to Postgres — the Supabase CLI (`supabase db push`), a BI tool, a
migration runner, Prisma/Drizzle, etc. — use the **Session/Transaction pooler**
connection string from *Supabase → Project Settings → Database → Connection
string → "Transaction" (Supavisor, port `6543`)*, not the direct `5432` one. The
free tier has very few direct connections; the pooler is what survives
concurrency. **None of that is required to run this store today** — you apply the
schema by pasting the SQL migrations into the SQL Editor (see
[`DEPLOYMENT.md`](./DEPLOYMENT.md)).

---

## 2. Environment variables — what goes where

Three places hold config. **Keys with the same name must hold the same value**
across places (e.g. `INTERNAL_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`STRIPE_SECRET_KEY`).

### 2a. Cloudflare (Workers & Pages → your project → Settings → Variables)

Set these as **runtime** variables (and, for the `NEXT_PUBLIC_*` ones, also as
**build** variables so they're inlined into the client bundle — the app has a
runtime fallback via `PublicEnvScript`, but setting both is cleanest).

| Variable | Value for edrifttrikes.shop | Required |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://edrifttrikes.shop` | ✅ (auth/redirect/return URLs depend on it) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → **anon public** | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → **service_role** (secret) | ✅ (orders/admin) |
| `RENDER_API_URL` | `https://<your-render-service>.onrender.com` | ✅ (email/contact/webhook) |
| `INTERNAL_API_KEY` | the shared random secret (same as Render) | ✅ |
| `STRIPE_SECRET_KEY` | `sk_live_…` | optional |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_…` | optional |
| `PAYPAL_ENV` | `live` | optional |
| `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET` | PayPal live app creds | optional |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile | optional (bot protection) |

> `SUPABASE_URL` / `SUPABASE_ANON_KEY` (non‑`NEXT_PUBLIC_` names) also work — the
> `lib/env.ts` reader accepts either. Use whichever you prefer; the table above
> is the recommended set.

### 2b. Render (your backend service → Environment)

| Variable | Value | Required |
| --- | --- | --- |
| `SITE_URL` | `https://edrifttrikes.shop` | ✅ (email links + CORS origin) |
| `INTERNAL_API_KEY` | same shared secret as Cloudflare | ✅ |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role secret | ✅ |
| `RESEND_API_KEY` | `re_…` from Resend | ✅ (email) |
| `EMAIL_FROM` | `E-Drift Trikes <no-reply@edrifttrikes.shop>` (verified domain) | ✅ |
| `ORDERS_NOTIFICATION_EMAIL` | where new-order + contact alerts go | ✅ |
| `STRIPE_SECRET_KEY` | `sk_live_…` (same as Cloudflare) | if using Stripe |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the Stripe webhook | if using Stripe |

### 2c. Supabase (dashboard settings, not env vars)

- **Authentication → URL Configuration** — see §3.
- **Authentication → Emails → Templates** — paste the branded templates from
  [`supabase/email-templates/`](../supabase/email-templates/) (§4).
- **Authentication → Emails → SMTP** — turn on custom SMTP for production
  deliverability (§4).

---

## 3. Supabase URL configuration (the URLs to add)

**Supabase dashboard → Authentication → URL Configuration.**

**Site URL**

```
https://edrifttrikes.shop
```

**Redirect URLs** (allow-list — add each line):

```
https://edrifttrikes.shop/**
http://localhost:3000/**
```

- `https://edrifttrikes.shop/**` covers `/auth/callback` and the reset flow's
  `/auth/callback?next=/account/update-password` in one wildcard.
- Keep the `localhost` line so local `npm run dev` auth still works. Remove it
  later if you want to lock production down.

> If you also serve the apex without `www`/with `www`, add whichever hostnames
> you actually use (e.g. `https://www.edrifttrikes.shop/**`). Match exactly what
> `NEXT_PUBLIC_SITE_URL` is set to.

**Stripe (if used):** point the Stripe webhook at the **Render** service —
`https://<your-render-service>.onrender.com/stripe/webhook`, event
`checkout.session.completed`. That's a Stripe setting, not a Supabase one.

---

## 4. Email templates & deliverability

1. Paste each template from [`supabase/email-templates/`](../supabase/email-templates/)
   into **Authentication → Emails → Templates** (mapping + subjects in that
   folder's [`README.md`](../supabase/email-templates/README.md)).
2. **Turn on custom SMTP** (*Authentication → Emails → SMTP Settings*). Supabase's
   built-in sender is rate-limited and for testing only — a real store needs its
   own SMTP or signups will silently fail to send. Reuse **Resend**: create an
   SMTP credential there and set the sender to an address on your verified
   `edrifttrikes.shop` domain.

---

## 5. Auth pages & redirects (already wired in the app)

Nothing to build here — this is the map so you can verify the flow end-to-end.

| Page / route | File | Role |
| --- | --- | --- |
| `/login` | `app/login/` | Sign in, register, and "forgot access key?" (all with show/hide password) |
| `/auth/callback` | `app/auth/callback/route.ts` | Exchanges the email link's code for a session, then redirects to a **validated** same-site path |
| `/account/update-password` | `app/account/update-password/` | Where the reset link lands; sets a new password |
| `/account` | `app/account/` | Rider dashboard (redirects to `/login` if signed out) |

**Signup flow:** register → Supabase sends *Confirm signup* → rider clicks →
`/auth/callback` → session created → `/account`. A `profiles` row is created
automatically by the `on_auth_user_created` trigger (migration `0001`).

**Password reset flow:** "Forgot access key?" → app calls
`resetPasswordForEmail(redirectTo=…/auth/callback?next=/account/update-password)`
→ Supabase sends *Reset Password* → rider clicks → `/auth/callback` signs them in
→ `/account/update-password` → new password → `/account`.

**Make yourself an admin** (after registering once), in the SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'you@edrifttrikes.shop';
```

Then `/admin` is reachable.

---

## 6. Quick verification checklist

- [ ] `NEXT_PUBLIC_SITE_URL = https://edrifttrikes.shop` on Cloudflare, `SITE_URL` the same on Render.
- [ ] Supabase **Site URL** = `https://edrifttrikes.shop`; **Redirect URLs** include `https://edrifttrikes.shop/**`.
- [ ] Migrations `0001`–`0005` run in the SQL Editor.
- [ ] *Confirm signup* + *Reset Password* templates pasted; custom SMTP enabled.
- [ ] Register a test account → confirm email → land on `/account`.
- [ ] "Forgot access key?" → reset email → set new password → land on `/account`.
- [ ] Promote your account to `admin` and open `/admin`.
