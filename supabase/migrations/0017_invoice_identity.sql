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
-- WHY THE ORDER CARRIES ITS OWN COPY (`seller_snapshot`): an invoice is a record
-- of a transaction that already happened, so it must state the identity that was
-- true THEN. Without a snapshot, editing the DBA would silently rewrite the
-- seller on every historical invoice — and two copies of "the same" invoice,
-- downloaded a month apart and naming different companies, is precisely what
-- makes a document set look fabricated to anyone checking it.
--
-- Orders placed before this migration have no snapshot and fall back to the
-- current settings, which is the best available answer for them.
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
  'Seller identity as it stood when this order was placed. Frozen on purpose: an invoice must name the entity that transacted, not whatever the settings say today. See lib/invoice.ts.';
