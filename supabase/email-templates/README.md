# Supabase Auth email templates — E-Drift Trikes

Branded HTML for the emails **Supabase itself sends** during auth
(confirm signup, password reset, etc.). Copy‑paste each file into the Supabase
dashboard.

> These are **separate** from the transactional emails the app sends through
> Resend (welcome, order confirmation, newsletter, contact) — those live in
> [`server/src/email.js`](../../server/src/email.js) and need no dashboard setup.

## Where to paste

**Supabase dashboard → Authentication → Emails → Templates.** Pick each template
from the dropdown, set its **Subject**, and paste the file's HTML into the
message body. (Older dashboards: **Authentication → Email Templates**.)

| Supabase template | File | Subject to use |
| --- | --- | --- |
| Confirm signup | [`confirm-signup.html`](./confirm-signup.html) | `Confirm your E-Drift account` |
| Reset Password | [`reset-password.html`](./reset-password.html) | `Reset your E-Drift access key` |
| Magic Link | [`magic-link.html`](./magic-link.html) | `Your E-Drift sign-in link` |
| Change Email Address | [`change-email.html`](./change-email.html) | `Confirm your new E-Drift email` |
| Invite user | [`invite.html`](./invite.html) | `You're invited to E-Drift` |
| Reauthentication | [`reauthentication.html`](./reauthentication.html) | `Your E-Drift verification code` |

The two that matter for the current app are **Confirm signup** and
**Reset Password** — the others are safe to set up now for completeness.

## The two you must not skip

- **Confirm signup** — new riders click this to activate their account. The link
  (`{{ .ConfirmationURL }}`) sends them to `https://edrifttrikes.shop/auth/callback`,
  which exchanges the code for a session and drops them on `/account`.
- **Reset Password** — powers the app's "Forgot access key?" flow. The link sends
  them to `https://edrifttrikes.shop/auth/callback?next=/account/update-password`
  (the redirect the app requests), where they set a new password.

Both only work if the redirect URLs are allow‑listed — see
[`docs/SUPABASE_SETUP.md`](../../docs/SUPABASE_SETUP.md).

## Template variables (filled by Supabase)

- `{{ .ConfirmationURL }}` — the full action link (token **and** redirect baked in). Use this, not a hand‑built URL.
- `{{ .Token }}` — 6‑digit one‑time code (used by *Reauthentication*).
- `{{ .Email }}` / `{{ .NewEmail }}` — current / new address (used by *Change Email*).
- `{{ .SiteURL }}` — your configured Site URL.

## Deliverability note (important for a real store)

Supabase's built‑in email sender is **rate‑limited and meant for testing** — it
is not reliable for production signups. For a live store on `edrifttrikes.shop`,
turn on **custom SMTP** in *Authentication → Emails → SMTP Settings* and point it
at a real provider. You already use **Resend** for order emails, so the simplest
path is to reuse it here: create an SMTP credential in Resend and enter it in
Supabase, with the sender set to an address on your verified domain
(e.g. `no-reply@edrifttrikes.shop`). The templates above are unaffected — they
work the same whichever sender delivers them.
