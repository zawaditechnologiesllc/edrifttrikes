-- ---------------------------------------------------------------------------
-- 0006 — Order fulfillment tracking + configurable tax rate
--
-- Adds the machinery behind the automated post-purchase journey:
--   day 0   order paid      → "Order confirmed" (shipping confirmation email)
--   day 3   → "Shipped"           (shipping update email)
--   day 25  → "Shipping complete" (arrival window email)
--   day 28  → "Ready for collection" (final email)
--
-- The schedule itself lives in lib/fulfillment.ts — this migration only stores
-- where each order currently is and which stage emails have already gone out.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

-- --- Configurable sales tax -------------------------------------------------
-- Stored in basis points (800 = 8.00%) so the rate is exact integer math and
-- never picks up floating-point drift on the way to a charged amount.
alter table public.site_settings
  add column if not exists tax_rate_bps int not null default 800;

alter table public.site_settings
  drop constraint if exists site_settings_tax_rate_bps_check;
alter table public.site_settings
  add constraint site_settings_tax_rate_bps_check
  check (tax_rate_bps >= 0 and tax_rate_bps <= 5000);

-- --- Fulfillment columns on orders ------------------------------------------
alter table public.orders
  -- When payment actually cleared. The whole delivery schedule counts from
  -- here, NOT from created_at — an order that sits unpaid for a week must not
  -- jump straight to "shipped" the moment it's paid.
  add column if not exists paid_at timestamptz,
  add column if not exists fulfillment_stage text not null default 'awaiting_payment',
  add column if not exists stage_updated_at timestamptz,
  -- The date shown to the customer as "you'll receive it by".
  add column if not exists estimated_delivery_at timestamptz,
  add column if not exists tracking_number text,
  add column if not exists courier text;

create index if not exists orders_stage_idx on public.orders(fulfillment_stage);
-- Partial index: the cron only ever scans paid orders that are still moving.
create index if not exists orders_paid_at_idx
  on public.orders(paid_at)
  where paid_at is not null;

-- Backfill: orders already paid before this migration get a paid_at (so the
-- scheduler has an anchor) and land on the stage their age implies. Without
-- this they would sit at 'awaiting_payment' forever.
update public.orders
   set paid_at = coalesce(paid_at, updated_at, created_at)
 where status in ('paid', 'fulfilled')
   and paid_at is null;

update public.orders
   set fulfillment_stage = case
         when status in ('cancelled', 'refunded') then 'cancelled'
         when status = 'fulfilled' then 'delivered'
         when paid_at is null then 'awaiting_payment'
         when paid_at <= now() - interval '28 days' then 'ready_for_collection'
         when paid_at <= now() - interval '25 days' then 'arriving'
         when paid_at <= now() - interval '3 days'  then 'shipped'
         else 'confirmed'
       end,
       stage_updated_at = coalesce(stage_updated_at, updated_at, created_at),
       estimated_delivery_at = coalesce(estimated_delivery_at, paid_at + interval '28 days')
 where fulfillment_stage = 'awaiting_payment'
   and status <> 'pending';

-- --- Order event timeline ----------------------------------------------------
-- One row per stage an order has reached. This is both the customer-facing
-- timeline AND the idempotency ledger for the scheduler: the unique constraint
-- on (order_id, stage) means a stage email can only ever be sent once, however
-- many times the cron fires or retries.
create table if not exists public.order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  stage      text not null,
  title      text not null,
  detail     text,
  email_sent boolean not null default false,
  created_at timestamptz not null default now(),
  unique (order_id, stage)
);

create index if not exists order_events_order_idx
  on public.order_events(order_id, created_at);

alter table public.order_events enable row level security;

-- A rider can read the timeline of their own orders; admins read everything.
drop policy if exists order_events_owner_read on public.order_events;
create policy order_events_owner_read on public.order_events
  for select using (
    exists (
      select 1 from public.orders o
       where o.id = order_events.order_id
         and (o.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists order_events_admin_all on public.order_events;
create policy order_events_admin_all on public.order_events
  for all using (public.is_admin()) with check (public.is_admin());

-- Seed events for every stage an already-paid order has ALREADY passed, so
-- existing customers see a filled-in timeline. email_sent = true is the point:
-- it tells the scheduler these stages are done, so switching the cron on does
-- not blast months-old orders with a burst of catch-up emails.
insert into public.order_events (order_id, stage, title, detail, email_sent, created_at)
select o.id, s.stage, s.title, s.detail, true, o.paid_at + (s.days || ' days')::interval
  from public.orders o
 cross join (values
     (0,  'confirmed',            'Order confirmed',     'Payment received and your order was confirmed.'),
     (3,  'shipped',              'Shipped',             'Your order left the garage and is with our shipping partner.'),
     (25, 'arriving',             'Shipping complete',   'Your package reached its destination hub.'),
     (28, 'ready_for_collection', 'Ready for collection','Your package is ready for collection.')
   ) as s(days, stage, title, detail)
 where o.paid_at is not null
   and o.paid_at + (s.days || ' days')::interval <= now()
on conflict (order_id, stage) do nothing;
