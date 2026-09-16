-- ---------------------------------------------------------------------------
-- 0019 — Which Authorize.Net account is live
--
-- An Authorize.Net gateway account is bound to ONE merchant account, with one
-- acquirer, in one country. A store with several must pick one per order — and
-- that choice is a business decision (which entity settles this money), so it
-- belongs in admin rather than in a deploy.
--
-- ⚠️ THE CREDENTIALS ARE NOT HERE, AND MUST NOT BE. This column holds only a
-- short id ("us", "uk") naming one of the accounts defined in the
-- AUTHORIZENET_ACCOUNTS secret. A transaction key is a bearer credential for
-- moving money; keeping it in Cloudflare/Render secrets means a database read
-- — a leaked service-role key, a bad RLS policy, a stray backup — cannot reach
-- it. See lib/authorize-net.ts.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

alter table public.site_settings
  add column if not exists authorizenet_account text;

comment on column public.site_settings.authorizenet_account is
  'Id of the Authorize.Net account to charge against, matching an entry in the AUTHORIZENET_ACCOUNTS secret. Never holds credentials.';
