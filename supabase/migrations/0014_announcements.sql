-- ---------------------------------------------------------------------------
-- 0014 — Announcements
--
-- Short notices the admin writes in /admin/announcements. They scroll across a
-- stripe at the very top of every storefront page: a sale, a shipping delay, a
-- restock, a holiday cut-off.
--
-- WHY A TABLE AND NOT A SITE SETTING: there is more than one at a time, they
-- have their own order, and each carries its own schedule. site_settings is a
-- single row of scalars and would have to grow an array column plus its own
-- ordering convention to hold this.
--
-- SCHEDULING: starts_at/ends_at are both optional. Null start means "already
-- running", null end means "until I turn it off". That way an admin can queue a
-- Black Friday banner weeks ahead and let it expire on its own, without having
-- to remember to come back and delete it.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  -- What scrolls past. Bounded because the stripe is one line of text, and a
  -- pasted essay would make the ticker unreadable rather than informative.
  message text not null check (char_length(trim(message)) between 1 and 200),
  -- Optional destination. Validated in the app (lib/announcements.ts) to an
  -- internal path or an http(s) URL — never a javascript: URL.
  href text,
  -- The admin's on/off switch, independent of the schedule.
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  -- Display order within the stripe. Lower first.
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.announcements is
  'Scrolling notices shown in the storefront top stripe. See lib/announcements.ts.';

-- Every page load reads the live set, so index the columns that decide it.
create index if not exists announcements_live_idx
  on public.announcements (active, position, created_at);

alter table public.announcements enable row level security;

-- Public read: the stripe is rendered for anonymous visitors. Reading a
-- scheduled-but-not-yet-live row is harmless (it is a marketing line, not a
-- secret) and letting the app do the time filtering keeps one implementation of
-- "live" — the one in lib/announcements.ts that the admin list also uses.
drop policy if exists announcements_public_read on public.announcements;
create policy announcements_public_read on public.announcements
  for select using (true);

drop policy if exists announcements_admin_write on public.announcements;
create policy announcements_admin_write on public.announcements
  for all using (public.is_admin()) with check (public.is_admin());
