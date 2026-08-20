-- ---------------------------------------------------------------------------
-- 0010 — Guest orders follow the buyer into their account
--
-- Buyers check out without an account, so those orders are stored with
-- user_id = NULL. When the same person later registers, nothing connected the
-- two: orders_owner_read only matched `auth.uid() = user_id`, so their own
-- purchase history was invisible on their dashboard forever.
--
-- This links them by EMAIL, and does so in two complementary ways:
--   1. RLS lets a signed-in user read an unclaimed order placed with their
--      email — so the dashboard is correct even if step 2 hasn't run.
--   2. The app claims those rows (sets user_id) on sign-in, making the link
--      permanent. See claimGuestOrders() in lib/orders.ts.
--
-- ⚠️ SECURITY — READ THIS BEFORE DEPLOYING.
-- The match is gated on the account's email being CONFIRMED. Without that
-- gate, anyone could register using a stranger's email address and immediately
-- read that person's orders: their name, full shipping address, phone number
-- and what they bought.
--
-- That gate is only as strong as your Supabase setting. If "Confirm email" is
-- DISABLED in Authentication → Providers → Email, Supabase stamps
-- email_confirmed_at at signup and the check below passes for anybody. Keep
-- email confirmation ON.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

-- --- Who is asking, and have they proved they own that address? -------------
-- SECURITY DEFINER because RLS policies cannot read auth.users directly.
-- Returns NULL for an unconfirmed (or absent) user, which makes every policy
-- comparison below fail closed.
create or replace function public.current_user_email()
returns text
language sql
security definer
stable
set search_path = public, auth
as $$
  select lower(u.email)
    from auth.users u
   where u.id = auth.uid()
     and u.email_confirmed_at is not null
$$;

comment on function public.current_user_email() is
  'Lower-cased email of the signed-in user, ONLY when confirmed. NULL otherwise — guest-order matching depends on this returning NULL for unverified accounts.';

-- The email lookup needs indexes; orders were only indexed by user and status.
-- Two, because the two readers spell the comparison differently: RLS uses
-- lower(email) so it also matches any legacy mixed-case row, while the claim
-- query in lib/orders.ts compares plain equality (checkout stores addresses
-- lower-cased, so that is exact and cannot use an expression index).
create index if not exists orders_email_lower_idx on public.orders(lower(email));
create index if not exists orders_email_idx on public.orders(email);

-- --- Policies ---------------------------------------------------------------
-- An unclaimed order (user_id IS NULL) is readable by the confirmed owner of
-- the email it was placed with. Claimed orders keep the original rule, so one
-- account can never read another's orders by changing its email later.

drop policy if exists orders_owner_read on public.orders;
create policy orders_owner_read on public.orders
  for select using (
    auth.uid() = user_id
    or (user_id is null and lower(email) = public.current_user_email())
    or public.is_admin()
  );

drop policy if exists order_items_read on public.order_items;
create policy order_items_read on public.order_items
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
       where o.id = order_id
         and (
           o.user_id = auth.uid()
           or (o.user_id is null and lower(o.email) = public.current_user_email())
         )
    )
  );

drop policy if exists order_events_owner_read on public.order_events;
create policy order_events_owner_read on public.order_events
  for select using (
    exists (
      select 1 from public.orders o
       where o.id = order_events.order_id
         and (
           o.user_id = auth.uid()
           or (o.user_id is null and lower(o.email) = public.current_user_email())
           or public.is_admin()
         )
    )
  );

-- --- Backfill ---------------------------------------------------------------
-- Link guest orders already in the table to accounts that exist and are
-- confirmed. Anyone who bought as a guest and registered before this migration
-- sees their history on their next visit, without waiting to sign in again.
update public.orders o
   set user_id = u.id
  from auth.users u
 where o.user_id is null
   and u.email_confirmed_at is not null
   and lower(o.email) = lower(u.email);
