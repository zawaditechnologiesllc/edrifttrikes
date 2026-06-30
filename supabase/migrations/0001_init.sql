-- E-Drift Trikes — initial schema
-- Voltage Drift storefront: catalog, orders, content, profiles, RLS, storage.
-- Run via the Supabase SQL editor or `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('customer', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type product_status as enum ('draft', 'active', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type power_source as enum ('electric', 'gas', 'gravity', 'na');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('pending', 'paid', 'fulfilled', 'cancelled', 'refunded');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------------------------------------------------------------------------
-- profiles  (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        user_role not null default 'customer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- auto-create a profile whenever a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- admin check (security definer avoids RLS recursion on profiles)
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  image_url   text,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  name            text not null,
  tagline         text,
  description     text,
  price_cents     int not null default 0,
  compare_at_cents int,
  category_id     uuid references public.categories(id) on delete set null,
  power           power_source not null default 'electric',
  skill_level     text,
  top_speed       text,
  range_miles     text,
  stock           int not null default 0,
  status          product_status not null default 'active',
  is_new          boolean not null default false,
  badge           text,
  hero_image      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_status_idx on public.products(status);
drop trigger if exists products_updated on public.products;
create trigger products_updated before update on public.products
  for each row execute function public.set_updated_at();

create table if not exists public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  url         text not null,
  alt         text,
  position    int not null default 0
);
create index if not exists product_images_product_idx on public.product_images(product_id);

create table if not exists public.product_specs (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  label       text not null,
  value       text not null,
  position    int not null default 0
);
create index if not exists product_specs_product_idx on public.product_specs(product_id);

-- ---------------------------------------------------------------------------
-- orders + items
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text unique not null default ('EDT-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  user_id          uuid references auth.users(id) on delete set null,
  email            text not null,
  status           order_status not null default 'pending',
  subtotal_cents   int not null default 0,
  shipping_cents   int not null default 0,
  tax_cents        int not null default 0,
  total_cents      int not null default 0,
  currency         text not null default 'usd',
  shipping_address jsonb,
  stripe_session_id text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders(user_id);
create index if not exists orders_status_idx on public.orders(status);
drop trigger if exists orders_updated on public.orders;
create trigger orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

create table if not exists public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  product_id  uuid references public.products(id) on delete set null,
  name        text not null,
  slug        text,
  price_cents int not null,
  qty         int not null default 1,
  image_url   text
);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- ---------------------------------------------------------------------------
-- wishlist
-- ---------------------------------------------------------------------------
create table if not exists public.wishlist_items (
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ---------------------------------------------------------------------------
-- content (Tech Lab articles)
-- ---------------------------------------------------------------------------
create table if not exists public.articles (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  excerpt      text,
  body         text,
  cover_url    text,
  category     text,
  author       text,
  read_minutes int default 5,
  published    boolean not null default true,
  published_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- newsletter
-- ---------------------------------------------------------------------------
create table if not exists public.newsletter_subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles               enable row level security;
alter table public.categories             enable row level security;
alter table public.products               enable row level security;
alter table public.product_images         enable row level security;
alter table public.product_specs          enable row level security;
alter table public.orders                 enable row level security;
alter table public.order_items            enable row level security;
alter table public.wishlist_items         enable row level security;
alter table public.articles               enable row level security;
alter table public.newsletter_subscribers enable row level security;

-- profiles: self read/update; admins all
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select using (auth.uid() = id or public.is_admin());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- catalog: public read of active rows; admins manage
drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories for select using (true);
drop policy if exists categories_admin_all on public.categories;
create policy categories_admin_all on public.categories for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select using (status = 'active' or public.is_admin());
drop policy if exists products_admin_all on public.products;
create policy products_admin_all on public.products for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists product_images_public_read on public.product_images;
create policy product_images_public_read on public.product_images for select using (true);
drop policy if exists product_images_admin_all on public.product_images;
create policy product_images_admin_all on public.product_images for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists product_specs_public_read on public.product_specs;
create policy product_specs_public_read on public.product_specs for select using (true);
drop policy if exists product_specs_admin_all on public.product_specs;
create policy product_specs_admin_all on public.product_specs for all using (public.is_admin()) with check (public.is_admin());

-- orders: owner read; admins all; inserts handled server-side (service role)
drop policy if exists orders_owner_read on public.orders;
create policy orders_owner_read on public.orders for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists orders_admin_all on public.orders;
create policy orders_admin_all on public.orders for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists order_items_read on public.order_items;
create policy order_items_read on public.order_items for select using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
);
drop policy if exists order_items_admin_all on public.order_items;
create policy order_items_admin_all on public.order_items for all using (public.is_admin()) with check (public.is_admin());

-- wishlist: owner only
drop policy if exists wishlist_owner_all on public.wishlist_items;
create policy wishlist_owner_all on public.wishlist_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- articles: public read published; admins manage
drop policy if exists articles_public_read on public.articles;
create policy articles_public_read on public.articles for select using (published or public.is_admin());
drop policy if exists articles_admin_all on public.articles;
create policy articles_admin_all on public.articles for all using (public.is_admin()) with check (public.is_admin());

-- newsletter: anyone can subscribe; admins read
drop policy if exists newsletter_insert on public.newsletter_subscribers;
create policy newsletter_insert on public.newsletter_subscribers for insert with check (true);
drop policy if exists newsletter_admin_read on public.newsletter_subscribers;
create policy newsletter_admin_read on public.newsletter_subscribers for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: product image bucket (public read, admin write)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists product_images_storage_read on storage.objects;
create policy product_images_storage_read on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists product_images_storage_write on storage.objects;
create policy product_images_storage_write on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists product_images_storage_update on storage.objects;
create policy product_images_storage_update on storage.objects for update
  using (bucket_id = 'product-images' and public.is_admin());

drop policy if exists product_images_storage_delete on storage.objects;
create policy product_images_storage_delete on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_admin());
