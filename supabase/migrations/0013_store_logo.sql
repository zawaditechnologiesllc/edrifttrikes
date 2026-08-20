-- ---------------------------------------------------------------------------
-- 0013 — Store logo
--
-- The admin uploads a logo once in /admin/settings. It is drawn at the top of
-- every downloadable product information sheet and, at low opacity, as the
-- watermark behind it.
--
-- Stored as a URL, exactly like every other image in this schema
-- (products.hero_image, product_images.url, categories.image_url): the bytes
-- live in the `product-images` Supabase Storage bucket and the row holds the
-- public URL. Keeping it on site_settings means one logo for the whole store,
-- which is what a logo is.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

alter table public.site_settings
  add column if not exists logo_url text;

comment on column public.site_settings.logo_url is
  'Public URL of the store logo. Used on the PDF product sheets — see lib/product-sheet.ts.';
