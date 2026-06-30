-- Contact / support messages
create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  email       text not null,
  subject     text,
  message     text not null,
  handled     boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

-- Inserts come from the backend service (service role) which bypasses RLS.
drop policy if exists contact_admin_read on public.contact_messages;
create policy contact_admin_read on public.contact_messages
  for select using (public.is_admin());
drop policy if exists contact_admin_update on public.contact_messages;
create policy contact_admin_update on public.contact_messages
  for update using (public.is_admin()) with check (public.is_admin());
