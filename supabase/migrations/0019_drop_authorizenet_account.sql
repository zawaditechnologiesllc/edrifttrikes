-- ---------------------------------------------------------------------------
-- 0019 — Remove site_settings.authorizenet_account
--
-- This number originally ADDED that column, for a build where several
-- Authorize.Net accounts were configured at once and an admin picked which one
-- was live. The store runs one gateway account at a time — Stripe, PayPal and
-- Authorize.Net, one set of credentials each — so the picker had nothing to
-- pick from, and which account is live is now simply which credentials are in
-- the environment (AUTHORIZENET_API_LOGIN_ID / _TRANSACTION_KEY / _ENV).
--
-- Rewritten rather than superseded by an 0020 so a database created from these
-- files never grows a column nothing reads. If you already ran the earlier
-- 0019, run this one and the column goes away; if you never ran it, this is a
-- no-op. Either way the end state is the same.
--
-- ⚠️ NOT A LOSS OF PAYMENT DATA. The column only ever held a short id, never
-- credentials and never anything about a payment. Which account took a given
-- order — what a refund has to go back through — lives on the ORDER, in
-- orders.gateway_account (migration 0018), and is untouched by this.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

alter table public.site_settings
  drop column if exists authorizenet_account;
