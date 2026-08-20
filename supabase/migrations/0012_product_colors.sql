-- ---------------------------------------------------------------------------
-- 0012 — Product colours
--
-- Colours come from the admin's plain-text product sheet (the `Colors:` line),
-- are offered to the buyer on the product page, and are recorded on the order
-- line so the packing slip says which one to ship.
--
-- Stored as jsonb rather than a child table: a colour is a name and an optional
-- swatch, with no ordering, ids or relationships of its own. product_images and
-- product_specs are tables because they need those; this doesn't, and a join
-- per product page would be cost without benefit.
--
-- Shape: [{"name": "Voltage Blue", "hex": "#1e5bff"}, {"name": "Gunmetal", "hex": null}]
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

alter table public.products
  add column if not exists colors jsonb not null default '[]'::jsonb;

comment on column public.products.colors is
  'Selectable colours, parsed from the admin product sheet. See lib/colors.ts.';

-- The colour the buyer chose. Nullable: products without colours have none, and
-- every order placed before this migration has none either.
alter table public.order_items
  add column if not exists color text;

comment on column public.order_items.color is
  'Colour chosen at checkout, validated against products.colors. NULL when the product has no colours.';
