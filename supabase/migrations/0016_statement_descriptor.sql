-- ---------------------------------------------------------------------------
-- 0016 — Statement descriptor
--
-- The line a buyer sees on their bank statement next to the charge.
--
-- WHY IT IS A SETTING AND NOT A CONSTANT: it has to match the trading name the
-- cardholder actually remembers, and that is a business decision, not a code
-- one. Get it wrong and the cardholder does not recognise the charge, so they
-- dispute it as fraud — the expensive kind of dispute, which counts against the
-- account's fraud rate whether or not it is won, and which is entirely
-- preventable.
--
-- Stripe prepends the account's own prefix and caps the whole thing at 22
-- characters, so the value stored here is clamped short (lib/stripe-fulfillment.ts
-- does the sanitising) and left NULL when unset, in which case the Stripe
-- account's own default is used.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

alter table public.site_settings
  add column if not exists statement_descriptor text;

comment on column public.site_settings.statement_descriptor is
  'Trading name shown on the buyer''s bank statement. Sanitised and clamped by lib/stripe-fulfillment.ts; NULL uses the Stripe account default.';
