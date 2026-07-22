-- Featured products + admin-editable site settings (footer contact info).
-- Run after 0001 and 0002 (Supabase SQL Editor, paste + Run). Safe to re-run.

-- ---------------------------------------------------------------------------
-- Featured products: admin picks what shows on the homepage. When no product
-- is flagged, the storefront falls back to the newest active products.
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists featured boolean not null default false;

create index if not exists products_featured_idx
  on public.products (featured) where featured;

-- ---------------------------------------------------------------------------
-- Site settings: single-row table (id always 1) with the company contact info
-- shown in the footer. Public read (it's on every page), admin-only writes.
-- ---------------------------------------------------------------------------
create table if not exists public.site_settings (
  id             int primary key default 1 check (id = 1),
  company_email  text,
  company_phone  text,
  address_line1  text,
  address_line2  text,
  updated_at     timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists site_settings_public_read on public.site_settings;
create policy site_settings_public_read on public.site_settings
  for select using (true);

drop policy if exists site_settings_admin_write on public.site_settings;
create policy site_settings_admin_write on public.site_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- Placeholder contact info — edit in /admin/settings once deployed.
insert into public.site_settings (id, company_email, company_phone, address_line1, address_line2)
values (1, 'hello@edrifttrikes.com', '+1 (555) 010-0000', '100 Drift Lane', 'Los Angeles, CA 90001, USA')
on conflict (id) do nothing;
