-- ---------------------------------------------------------------------------
-- Letting someone stop the marketing mail, permanently.
--
-- The unpaid-order reminders now run three times a week for eight weeks and
-- carry a product offer, which makes them commercial email rather than
-- transactional. Commercial email needs a working opt-out — under CAN-SPAM in
-- the US, under the EU/UK rules this shop already documents, and under Gmail's
-- and Yahoo's bulk-sender requirements, which treat a missing one-click
-- unsubscribe as a spam signal.
--
-- That last one is why this table matters more than it looks: spam complaints
-- are scored against the whole sending domain, and that is the same domain the
-- ORDER CONFIRMATIONS leave on. An opt-out that does not work does not merely
-- annoy someone — it can stop paying customers hearing that their money
-- arrived.
--
-- Keyed on the email address, not on a user or an order: somebody who asks to
-- stop hearing from us means all of it, including the pending order they have
-- under a different row.
-- ---------------------------------------------------------------------------

create table if not exists public.email_opt_outs (
  -- Stored lower-cased and trimmed by the application (lib/email-optout.ts),
  -- so "A@B.com " and "a@b.com" cannot opt out separately.
  email       text primary key,
  -- Which mail they stopped. One kind today; a column so adding a second does
  -- not mean unsubscribing people from the first.
  kind        text not null default 'order_reminders',
  -- Free text, from the one-question form on the confirmation page.
  reason      text,
  created_at  timestamptz not null default now()
);

create index if not exists email_opt_outs_created_idx
  on public.email_opt_outs(created_at desc);

alter table public.email_opt_outs enable row level security;

-- No policies on purpose. Nothing with the anon or authenticated key may read
-- this table: it is a list of customer email addresses, and the only things
-- that touch it are the unsubscribe route and the scheduler, both of which run
-- with the service-role key and bypass RLS.
--
-- An opt-out is never deleted here. Re-subscribing is a deliberate act that
-- belongs in the admin, not a side effect of the customer ordering again —
-- otherwise "stop emailing me" lasts exactly until their next purchase.
