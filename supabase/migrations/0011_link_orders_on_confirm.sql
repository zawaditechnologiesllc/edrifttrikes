-- ---------------------------------------------------------------------------
-- 0011 — Orders attach to an account the moment its email is confirmed
--
-- Migration 0010 made guest orders VISIBLE to their buyer and had the app claim
-- them. But the claim only ran when the customer happened to open their
-- dashboard: confirm your email, get redirected somewhere else, and the link
-- simply hadn't happened yet.
--
-- This moves the guarantee into the database. The instant Supabase stamps
-- email_confirmed_at, every guest order placed with that address becomes theirs
-- — no app code involved, so it cannot be missed by a route that forgot to ask.
--
-- ⚠️ SAME SECURITY GATE AS 0010. Linking happens only on a CONFIRMED address.
-- Without that, registering with a stranger's email would hand over their name,
-- shipping address, phone number and purchases. If "Confirm email" is disabled
-- in Authentication → Providers → Email, Supabase stamps email_confirmed_at at
-- signup and this fires for anybody. Keep email confirmation ON.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

create or replace function public.link_orders_to_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Only ever act on a proven address.
  if new.email_confirmed_at is not null and new.email is not null then
    update public.orders
       set user_id = new.id
     where user_id is null
       and lower(email) = lower(new.email);
  end if;
  return new;
end
$$;

comment on function public.link_orders_to_user() is
  'Claims guest orders for a user the moment their email is confirmed. Gated on email_confirmed_at — see migration 0011.';

-- Fires on insert (accounts that arrive already confirmed, e.g. an accepted
-- invite) and on the two column changes that can newly prove an address:
-- confirming it, and changing it to another confirmed one.
drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after insert or update of email_confirmed_at, email on auth.users
  for each row execute function public.link_orders_to_user();

-- Catch anything that slipped through between 0010 and now.
update public.orders o
   set user_id = u.id
  from auth.users u
 where o.user_id is null
   and u.email_confirmed_at is not null
   and lower(o.email) = lower(u.email);
