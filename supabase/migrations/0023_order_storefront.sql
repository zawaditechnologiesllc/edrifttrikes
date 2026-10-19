-- ---------------------------------------------------------------------------
-- 0023 — Which storefront an order came from
--
-- The shop now answers on five hostnames: usa., canada., uae., europe. and
-- global., plus the apex. Each regional team hands their own link out, so the
-- hostname an order arrived on is the closest thing the shop has to "which
-- team's marketing produced this sale" — and until now it was thrown away the
-- moment the request ended.
--
-- THE HOST IS STORED, NOT THE REGION. The host is the fact; the region is an
-- interpretation of it that lives in lib/regions.ts and can change. Storing
-- "europe.edrifttrikes.shop" means an order placed today still reads correctly
-- after a region is renamed, retired or split — storing "europe" would not.
-- The admin resolves one to the other at display time.
--
-- Null is expected and means exactly one of three things, all of them fine:
-- an order placed before this column existed, one typed in by an admin (which
-- has no storefront), or one whose Host header was missing.
-- ---------------------------------------------------------------------------

alter table public.orders
  add column if not exists origin_host text;

comment on column public.orders.origin_host is
  'The hostname the checkout was submitted on, e.g. europe.edrifttrikes.shop. Null for admin-created orders and for orders placed before this column existed. Resolved to a storefront name at display time by lib/regions.ts.';

-- Reporting reads this grouped by host ("how much did the UAE link bring in"),
-- and that is a sequential scan over every order without an index.
create index if not exists orders_origin_host_idx
  on public.orders(origin_host);
