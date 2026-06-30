-- E-Drift Trikes — seed data (real catalog matching the Voltage Drift designs).
-- Safe to re-run: uses upserts on slug.

-- Categories ----------------------------------------------------------------
insert into public.categories (slug, name, description, image_url, position) values
  ('trikes', 'Trikes', 'The ultimate drifting machines.', '/assets/trike-voltage-blue.jpg', 1),
  ('parts',  'Parts',  'Tune for performance.',          '/assets/parts-performance.jpg',  2),
  ('gear',   'Gear',   'Protection meets style.',         '/assets/action-mid-slide.jpg',   3)
on conflict (slug) do update set name=excluded.name, description=excluded.description, image_url=excluded.image_url, position=excluded.position;

-- Products ------------------------------------------------------------------
insert into public.products (slug, name, tagline, description, price_cents, compare_at_cents, category_id, power, skill_level, top_speed, range_miles, stock, status, is_new, badge, hero_image)
values
  ('volt-s1-pro', 'Volt S1 Pro', 'Precision torque meets lateral freedom.',
   'The flagship electric drift trike. A 72V custom-wound brushless motor delivers instant 150Nm of torque through an aircraft-grade 6061 aluminium frame with a 15° aggressive rake for razor-sharp counter-steer feedback.',
   349900, 379900, (select id from public.categories where slug='trikes'), 'electric', 'Intermediate', '48 MPH', '22 MILES', 8, 'active', true, 'NEW', '/assets/volt-s1-pro-hero.jpg'),
  ('interceptor-g', 'Interceptor-G', 'Raw lateral force, petrol-fed.',
   'A professional gas-powered drift trike built on a charcoal-black tube frame. 212cc of pure mechanical chaos for riders who want the smell of the track.',
   285000, null, (select id from public.categories where slug='trikes'), 'gas', 'Expert', '40 MPH', 'N/A', 5, 'active', false, null, '/assets/trike-gas-charcoal.jpg'),
  ('voltage-gt', 'Voltage GT', 'Premium electric, voltage-blue frame.',
   'Our showroom flagship. Hand-finished voltage-blue frame, dual battery bays and tuned regen braking for sustained slides.',
   420000, null, (select id from public.categories where slug='trikes'), 'electric', 'Expert', '52 MPH', '28 MILES', 3, 'active', true, 'NEW', '/assets/trike-voltage-blue.jpg'),
  ('gravity-rs', 'Gravity RS', 'Pure gravity. Zero noise.',
   'A lightweight gravity drift trike — the perfect entry into the slide. No motor, all skill.',
   120000, null, (select id from public.categories where slug='trikes'), 'gravity', 'Entry', 'Downhill', 'N/A', 12, 'active', false, null, '/assets/action-360-slide.jpg'),
  ('hub-motor-72v', '72V Brushless Hub Motor', 'Instant 150Nm break-loose torque.',
   'High-torque custom-wound 72V rear hub motor. The heart of every Volt build, sealed for rain and rated for sustained drift loads.',
   89900, null, (select id from public.categories where slug='parts'), 'electric', null, null, null, 2, 'active', false, 'LOW STOCK', '/assets/motor-72v-hub.jpg'),
  ('pvc-slide-sleeves', 'UHMWPE Slide Sleeves (Set)', 'Buttery-smooth, extreme durability.',
   'Ultra-high molecular weight polyethylene rear sleeves engineered for smooth transitions and long life. Set of two.',
   14900, 17900, (select id from public.categories where slug='parts'), 'na', null, null, null, 40, 'active', false, 'SALE', '/assets/mechanic-sleeve-install.jpg'),
  ('elite-drift-bundle', 'Elite Drift Bundle V4', 'Everything to upgrade your slide.',
   'Performance bundle: hub motor controller, slide sleeves, grip set and tuning harness. The fastest way to a pro-grade build.',
   59900, 74900, (select id from public.categories where slug='parts'), 'electric', null, null, null, 20, 'active', true, 'UPGRADE', '/assets/parts-performance.jpg'),
  ('apex-carbon-helmet', 'Apex Carbon Helmet', 'Street-motorsport protection.',
   'Carbon-shell full-face helmet with neon-green stitching. DOT + ECE rated for the rough side of the track.',
   32900, null, (select id from public.categories where slug='gear'), 'na', null, null, null, 15, 'active', false, null, '/assets/action-mid-slide.jpg'),
  ('hazard-drift-gloves', 'Hazard Drift Gloves', 'Grip when it gets loose.',
   'Reinforced leather drift gloves with hazard-lime accents and knuckle armour.',
   7900, null, (select id from public.categories where slug='gear'), 'na', null, null, null, 30, 'active', false, null, '/assets/garage-workshop-night.jpg')
on conflict (slug) do update set
  name=excluded.name, tagline=excluded.tagline, description=excluded.description,
  price_cents=excluded.price_cents, compare_at_cents=excluded.compare_at_cents,
  category_id=excluded.category_id, power=excluded.power, skill_level=excluded.skill_level,
  top_speed=excluded.top_speed, range_miles=excluded.range_miles, stock=excluded.stock,
  status=excluded.status, is_new=excluded.is_new, badge=excluded.badge, hero_image=excluded.hero_image;

-- Product images (gallery) --------------------------------------------------
delete from public.product_images where product_id in (select id from public.products where slug='volt-s1-pro');
insert into public.product_images (product_id, url, alt, position)
select id, x.url, x.alt, x.pos from public.products, (values
  ('/assets/volt-s1-pro-hero.jpg', 'Volt S1 Pro hero', 0),
  ('/assets/volt-s1-pro-cockpit.jpg', 'Volt S1 Pro cockpit', 1),
  ('/assets/motor-72v-hub.jpg', '72V hub motor detail', 2)
) as x(url, alt, pos) where slug='volt-s1-pro';

-- Product specs -------------------------------------------------------------
delete from public.product_specs where product_id in (select id from public.products where slug='volt-s1-pro');
insert into public.product_specs (product_id, label, value, position)
select id, s.label, s.value, s.pos from public.products, (values
  ('Motor', '72V custom-wound brushless', 0),
  ('Peak Torque', '150 Nm', 1),
  ('Top Speed', '48 MPH', 2),
  ('Range', '22 miles', 3),
  ('Frame', '6061 aircraft-grade aluminium', 4),
  ('Rake', '15° aggressive', 5)
) as s(label, value, pos) where slug='volt-s1-pro';

-- Articles (Tech Lab) -------------------------------------------------------
insert into public.articles (slug, title, excerpt, body, cover_url, category, author, read_minutes, published)
values
  ('sleeve-fitting', 'DIY Guide: PVC Slide Sleeve Fitting',
   'Swap your rear sleeves in under 20 minutes with basic tools.',
   'A full walkthrough on removing worn sleeves and fitting a fresh UHMWPE set for buttery transitions...',
   '/assets/mechanic-sleeve-install.jpg', 'DIY Guide', 'The Garage', 8, true),
  ('choosing-your-hub-motor', 'Choosing Your 72V Hub Motor',
   'Torque, winding and thermal limits — how to pick the right motor for your build.',
   'Not all hub motors are equal. Here is how winding count and KV rating change your break-loose behaviour...',
   '/assets/motor-72v-hub.jpg', 'Tech', 'Lead Engineering', 6, true),
  ('first-drift-garage', 'Building Your First Drift Garage',
   'The bench, the tools and the workflow behind a pro home garage.',
   'From soldering station to a clean parts wall — the essentials for maintaining an electric drift fleet...',
   '/assets/garage-workshop-night.jpg', 'Community', 'The Garage', 5, true)
on conflict (slug) do update set
  title=excluded.title, excerpt=excluded.excerpt, body=excluded.body,
  cover_url=excluded.cover_url, category=excluded.category, author=excluded.author,
  read_minutes=excluded.read_minutes, published=excluded.published;
