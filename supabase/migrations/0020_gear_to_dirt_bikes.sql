-- ---------------------------------------------------------------------------
-- 0020 — "Gear" becomes "Dirt Bikes"
--
-- The storefront nav, the footer and the homepage category grid now link to
-- /shop?category=dirt-bikes. Those links are hard-coded in the app, so this
-- migration is what makes them resolve: without it the slug does not exist,
-- and /shop falls back to showing every product rather than the category.
--
-- ⚠️ PRODUCTS ARE NOT MOVED, AND THAT NEEDS A HUMAN.
--
-- Products belong to a category by `category_id`, not by slug, so anything
-- currently filed under Gear stays attached to this row — and will therefore
-- appear under "Dirt Bikes". A helmet does not become a dirt bike because the
-- category was renamed. Reassign or deactivate those products in
-- Admin -> Products; this migration deliberately does not guess, because
-- silently re-filing or hiding real catalogue rows is not a migration's
-- decision to make.
--
-- Handles all three starting states and is safe to re-run.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from public.categories where slug = 'dirt-bikes') then
    -- Already done, or created by hand in Admin -> Categories. Leave whatever
    -- is there alone: overwriting a name or image someone chose deliberately
    -- is worse than doing nothing.
    raise notice '0020: dirt-bikes already exists — leaving it untouched';

  elsif exists (select 1 from public.categories where slug = 'gear') then
    -- The normal path: rename in place, so every product keeps its category_id
    -- and nothing is orphaned.
    update public.categories
       set slug        = 'dirt-bikes',
           name        = 'Dirt Bikes',
           description = 'Electric dirt bikes built for dirt, jumps and trails.',
           -- A placeholder: there is no dirt-bike photograph in the asset set
           -- yet, and a broken image on the homepage grid looks worse than a
           -- stand-in. Replace it in Admin -> Categories.
           image_url   = '/assets/action-360-slide.jpg'
     where slug = 'gear';
    raise notice '0020: renamed gear -> dirt-bikes (products kept their category)';

  else
    -- Neither slug present. Create the category so the nav link resolves and
    -- the homepage tile appears.
    insert into public.categories (slug, name, description, image_url, position)
    values ('dirt-bikes', 'Dirt Bikes',
            'Electric dirt bikes built for dirt, jumps and trails.',
            '/assets/action-360-slide.jpg', 3);
    raise notice '0020: created dirt-bikes (no gear category was present)';
  end if;
end $$;
