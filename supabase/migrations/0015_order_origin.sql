-- ---------------------------------------------------------------------------
-- 0015 — Where an order came from
--
-- Records what the Cloudflare edge already knew about a checkout: the country
-- the connection resolved to, the network it belongs to, and the timezone that
-- IP sits in — plus the timezone the BROWSER reported for itself. The pair is
-- the point: a VPN changes the IP but not the computer's clock.
--
-- WHY: stolen-card attempts arrive from somewhere, and an order used to carry
-- no record of where. This gives the owner the same view a payment processor
-- has, at review time, without a third-party lookup or any added latency.
--
-- ⚠️ ADVISORY ONLY. Nothing in the app refuses an order on these columns and
-- nothing should. A corporate VPN, a privacy-minded customer, an expat and a
-- business traveller all trip these signals, and every one of them is a real
-- sale. The control that actually stops a stolen card is at the payment layer
-- (Stripe Radar) — see docs/PAYMENTS.md.
--
-- NO IP ADDRESS IS STORED. It is the most sensitive field available and the
-- least useful for review: country, city and network answer "does this add up?"
-- without the store holding an identifier it would then have to protect,
-- disclose and delete on request.
--
-- Every column is nullable and the app writes them best-effort, so an order
-- placed before this migration ran — or one where the edge knew nothing — is a
-- perfectly valid row.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

alter table public.orders
  -- ISO alpha-2 the edge resolved the IP to. 'T1' means a Tor exit rather than
  -- a country, and is kept deliberately: it is a fact worth recording.
  add column if not exists origin_country text,
  add column if not exists origin_region text,
  add column if not exists origin_city text,
  -- IANA zone for the IP ("America/New_York").
  add column if not exists origin_timezone text,
  -- Autonomous system: who announces the IP range, by number and by name.
  add column if not exists origin_asn integer,
  add column if not exists origin_network text,
  -- What the browser said ITS timezone was. Compared against origin_timezone.
  add column if not exists client_timezone text,
  -- Computed at checkout by lib/risk.ts. Stored rather than recomputed so the
  -- admin list can sort and filter on it without re-deriving 500 rows, and so
  -- the assessment reflects what was known AT THE TIME.
  add column if not exists risk_level text,
  add column if not exists risk_score integer,
  add column if not exists risk_flags text[];

comment on column public.orders.origin_country is
  'ISO alpha-2 from the Cloudflare edge; T1 = Tor exit. Advisory only.';
comment on column public.orders.client_timezone is
  'Timezone the browser reported. Disagreeing with origin_timezone is the strongest VPN hint available.';
comment on column public.orders.risk_level is
  'clear | review | high — computed by lib/risk.ts. Never used to refuse an order.';

-- The admin list sorts newest-first and the owner wants the flagged ones
-- findable; without this that is a full scan once the table is large.
create index if not exists orders_risk_level_idx
  on public.orders (risk_level)
  where risk_level in ('review', 'high');
