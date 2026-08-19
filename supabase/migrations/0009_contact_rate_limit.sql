-- ---------------------------------------------------------------------------
-- 0009 — Rate limiting for the contact form
--
-- Stores a SALTED HASH of the sender's IP, never the address itself, so the
-- form can be rate limited without keeping personal data. The hash is only ever
-- compared against a freshly computed one; it is not reversible and is useless
-- on its own.
--
-- Rate limiting by email alone is trivially defeated by typing a different
-- address, which is exactly what a spammer does.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

alter table public.contact_messages
  add column if not exists sender_ip_hash text;

comment on column public.contact_messages.sender_ip_hash is
  'SHA-256 of (sender IP + server salt). Used only to rate limit submissions.';

-- The rate-limit lookup is "most recent message from this sender", so both
-- lookup columns are indexed with created_at.
create index if not exists contact_messages_ip_recent_idx
  on public.contact_messages(sender_ip_hash, created_at desc)
  where sender_ip_hash is not null;

create index if not exists contact_messages_email_recent_idx
  on public.contact_messages(email, created_at desc);
