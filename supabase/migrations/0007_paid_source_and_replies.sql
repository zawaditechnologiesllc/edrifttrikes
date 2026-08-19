-- ---------------------------------------------------------------------------
-- 0007 — Payment source on orders + admin replies to contact messages
--
-- Two additions:
--   1. orders.paid_via  — HOW an order came to be paid (stripe / paypal /
--      manual), so the admin Paid Orders view can show it at a glance.
--   2. contact_messages reply columns — so an admin reply sent from the
--      dashboard is recorded next to the message it answers.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

-- --- How the order was paid --------------------------------------------------
alter table public.orders
  add column if not exists paid_via text;

comment on column public.orders.paid_via is
  'stripe | paypal | manual — set by markOrderPaid() (lib/orders.ts).';

create index if not exists orders_paid_via_idx
  on public.orders(paid_via)
  where paid_via is not null;

-- Backfill from what we already stored. stripe_session_id holds a Stripe
-- Checkout session id ("cs_...") for card orders and the PayPal order id for
-- PayPal ones, so the prefix tells them apart. Anything paid with neither was
-- flipped by hand in the admin panel.
update public.orders
   set paid_via = case
         when stripe_session_id like 'cs_%' then 'stripe'
         when stripe_session_id is not null and stripe_session_id <> '' then 'paypal'
         else 'manual'
       end
 where paid_via is null
   and status in ('paid', 'fulfilled');

-- --- Admin replies to contact messages ---------------------------------------
alter table public.contact_messages
  add column if not exists replied_at  timestamptz,
  add column if not exists reply_body  text,
  add column if not exists replied_by  uuid references auth.users(id) on delete set null;

-- The inbox is always read newest-first.
create index if not exists contact_messages_created_idx
  on public.contact_messages(created_at desc);

-- Unhandled messages are the ones the badge counts, so index that subset.
create index if not exists contact_messages_unhandled_idx
  on public.contact_messages(created_at desc)
  where handled = false;
