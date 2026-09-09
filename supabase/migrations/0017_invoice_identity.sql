-- ---------------------------------------------------------------------------
-- 0017 — Invoice identity
--
-- Who the seller is, as an invoice has to state it: the registered legal
-- entity, the trading (DBA) name customers actually see, and the tax or
-- business registration number.
--
-- WHY THESE ARE SETTINGS AND NOT CONSTANTS: a trading name changes, and when it
-- does every document has to follow — including the ones a payment processor
-- asks for when it wants to confirm the business is real.
--
-- WHY THE ORDER ALSO CARRIES A COPY (`seller_snapshot`): a record of what the
-- shop was called when the order was placed. Invoices PRINT the current
-- settings — the store trades under one name at a time and every document
-- follows it — so this is an audit trail and a fallback for a field the
-- settings do not have, not what the document says.
--
-- Orders placed before this migration have no snapshot; nothing depends on one.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

alter table public.site_settings
  add column if not exists legal_name text,
  add column if not exists dba_name text,
  add column if not exists tax_id text,
  add column if not exists invoice_footer text;

comment on column public.site_settings.legal_name is
  'Registered legal entity name, as it appears on the company registration.';
comment on column public.site_settings.dba_name is
  'Trading / "doing business as" name shown on invoices and to customers.';
comment on column public.site_settings.tax_id is
  'Tax or business registration number (EIN, VAT, company number) printed on invoices.';
comment on column public.site_settings.invoice_footer is
  'Optional note printed at the foot of every invoice — payment terms, bank details.';

alter table public.orders
  add column if not exists seller_snapshot jsonb;

comment on column public.orders.seller_snapshot is
  'What the shop was called when this order was placed. An audit trail and a fallback; invoices print the current site_settings values. See lib/invoice.ts.';
