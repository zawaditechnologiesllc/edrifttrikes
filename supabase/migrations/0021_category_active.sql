-- ---------------------------------------------------------------------------
-- 0021 — Categories can be switched off
--
-- A category you are not ready to sell (products still being uploaded, a line
-- discontinued, a seasonal range) previously had to be DELETED to get it off
-- the storefront — which orphans every product attached to it. This is the
-- reversible version: switch it off, put it back later, products untouched.
--
-- Defaults to true so every existing category keeps working the moment this
-- runs. Nothing disappears on migration.
--
-- WHAT "OFF" MEANS: the category stops being OFFERED. It leaves the /shop
-- category filter and the homepage category tiles, and /shop?category=<slug>
-- returns nothing instead of the whole catalogue.
--
-- WHAT IT DOES NOT MEAN: it does not hide its products. Product visibility
-- stays where it already is — products.status — because conflating the two
-- would mean switching a category off silently unpublished real catalogue
-- rows, and switching it back on silently republished them.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

alter table public.categories
  add column if not exists active boolean not null default true;

comment on column public.categories.active is
  'False hides the category from the storefront (filters and homepage tiles) without deleting it or touching its products. Product visibility is products.status.';
