-- Per-product shipping: each product can carry its own flat shipping fee and
-- a free-shipping flag (shown on the product page with the fee crossed out).
-- A product with no fee set uses the store-wide flat fee from site_settings.
-- Run after 0004. Safe to re-run.

alter table public.products
  add column if not exists shipping_cents int,
  add column if not exists free_shipping boolean not null default false;
