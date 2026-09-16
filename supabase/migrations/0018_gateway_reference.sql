-- ---------------------------------------------------------------------------
-- 0018 — Gateway reference and account
--
-- WHY: `orders.stripe_session_id` has been holding two different things for a
-- while — Stripe Checkout session ids (`cs_…`) AND PayPal order ids — with
-- isStripeSessionId() in lib/stripe-fulfillment.ts existing only to tell them
-- apart by prefix. Authorize.Net's transaction id is a bare number with no
-- prefix to detect, so a third tenant would turn a misleading column into an
-- unusable one.
--
-- `gateway_reference` is the honest name: whatever the gateway calls this
-- payment. `gateway_account` records WHICH account took it, because an
-- Authorize.Net gateway account is bound to one merchant account in one
-- country — a store with several has to know which one holds the money when a
-- refund is due.
--
-- stripe_session_id is LEFT IN PLACE and still written by the existing paths.
-- Dropping a column that live code reads is how a deploy takes checkout down;
-- it can be retired once nothing references it.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

alter table public.orders
  add column if not exists gateway_reference text,
  add column if not exists gateway_account text;

comment on column public.orders.gateway_reference is
  'The payment gateway''s own id for this payment: a Stripe cs_… session, a PayPal order id, or an Authorize.Net transId. Supersedes the overloaded stripe_session_id.';
comment on column public.orders.gateway_account is
  'Which configured gateway account took the payment (Authorize.Net account id). Null for single-account providers.';

-- Backfill from the column that has been carrying it, so existing orders are
-- not left blank on the invoice and in the admin.
update public.orders
   set gateway_reference = stripe_session_id
 where gateway_reference is null
   and stripe_session_id is not null;

create index if not exists orders_gateway_reference_idx
  on public.orders(gateway_reference)
  where gateway_reference is not null;
