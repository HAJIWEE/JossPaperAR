-- ═══════════════════════════════════════════════════════════════════════════
-- 0001 · THE SLICE SCHEMA — the persist + award spine (SCRUM-54a)
--
-- Source of truth: AppDesignConceptBoard/07-system-architecture.md §5 (v2.9).
-- Scope = the slice subset agreed in doc 19 §6.1 (item E). League/campaign
-- tables are NOT here — they arrive with SCRUM-11.
--
-- ── THE FOUR RULES THIS FILE ENCODES ───────────────────────────────────────
--  1. RLS ON EVERY TABLE. A table with RLS enabled and NO policy denies
--     everything to client roles — which is exactly right for the tables only
--     the server writes (burns · ledger_events · quotas · rate_counters …).
--     RLS is therefore not an afterthought here; it is the access model.
--  2. THE LEDGER IS APPEND-ONLY. No UPDATE/DELETE grant to any client role
--     (doc 07 §5.1.1, ADR-005 §8). Corrections are compensating `adjustment`
--     rows.
--  3. LOCATION IS A COARSE CELL ONLY — no coordinates, no trail (doc 13 §2).
--     PostGIS is available on this project and is DELIBERATELY UNUSED.
--  4. ANCESTOR NAMES ARE THE MOST SENSITIVE COLUMN IN THE SYSTEM. They live
--     under RLS, visible only to clan members, and never reach analytics.
--
-- Applied to the hosted project yercgevebxvtzkgctfai (ap-southeast-1).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Enums — the closed sets the code already assumes ───────────────────────
-- Each mirrors a TypeScript union in src/domain/. If one changes, BOTH change.

create type public.currency_code as enum ('tribute', 'store', 'credit');
create type public.ledger_type   as enum ('award', 'purchase', 'accrual', 'grant', 'topup', 'refund', 'adjustment');
create type public.aim_band      as enum ('bullseye', 'devout', 'graze', 'miss');
create type public.clan_role     as enum ('head', 'co_head', 'elder', 'member');
create type public.capture_status as enum ('pending', 'styled', 'rejected');
create type public.job_status    as enum ('queued', 'running', 'styled', 'rejected', 'failed');
create type public.consent_kind  as enum ('first_run', 'ritual_data', 'analytics', 'ads');
create type public.acquired_via  as enum ('capture', 'purchase', 'grant');
create type public.tribute_visibility as enum ('clan', 'private');
create type public.slot_category as enum ('top', 'side', 'background');

-- ═══ IDENTITY & PROFILE ═══════════════════════════════════════════════════

-- Anonymous device first (ADR-004); an account upgrade links the SAME user_id,
-- so nothing migrates. display_label is the pseudonym the league shows —
-- NOT the ancestor name.
create table public.profiles (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  display_label text not null check (char_length(display_label) between 1 and 40),
  locale        text not null default 'en' check (locale in ('en', 'zh')),
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- Rate-limit / anomaly signals (doc 11 §5). Purged after 90 days idle (doc 13 §2).
create table public.devices (
  device_id    uuid primary key,
  user_id      uuid not null references public.profiles (user_id) on delete cascade,
  platform     text not null check (platform in ('android', 'ios', 'web')),
  last_seen_at timestamptz not null default now()
);
create index devices_user_idx on public.devices (user_id);

-- Append-style consent log (ADR-007 §5): withdrawal is a NEW row, never an edit.
create table public.consent_records (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  kind    public.consent_kind not null,
  granted boolean not null,
  at      timestamptz not null default now()
);
create index consent_records_user_kind_idx on public.consent_records (user_id, kind, at desc);

-- ═══ CLANS, MEMBERS & THE SHARED ALTAR ═════════════════════════════════════
-- There is NO non-clan altar (SCRUM-22): every ancestor belongs to a clan, so
-- a user cannot reach Home without creating or joining one.

create table public.clans (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 2 and 20),
  -- One active 8-char capability. Whoever holds it can join, so it is
  -- re-rollable by a head (doc 07 §4.6). Deliberately NOT a name suffix:
  -- names display PLAIN; two clans may share one (doc 15 §2.1).
  code         text not null unique check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$'),
  created_by   uuid not null references public.profiles (user_id),
  created_at   timestamptz not null default now(),
  archived_at  timestamptz,
  -- ⚠️ The cap is on the CLAN, default 10 — NOT "4 tablets per user".
  -- doc 07 §4.5 said 4 until v2.9; the 4 is the altar *display* cap, a
  -- different rule. Raising this is the future monetisation lever (SCRUM-47).
  ancestor_cap smallint not null default 10 check (ancestor_cap between 1 and 100)
);

create table public.clan_members (
  clan_id   uuid not null references public.clans (id) on delete cascade,
  user_id   uuid not null references public.profiles (user_id) on delete cascade,
  role      public.clan_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (clan_id, user_id)
);
create index clan_members_user_idx on public.clan_members (user_id);

create table public.ancestors (
  id           uuid primary key default gen_random_uuid(),
  clan_id      uuid not null references public.clans (id) on delete cascade,
  surname      text not null check (char_length(surname) between 1 and 20),
  given_name   text check (given_name is null or char_length(given_name) <= 40),
  relationship text check (relationship is null or char_length(relationship) <= 20),
  slot         smallint not null check (slot between 0 and 9),
  archived_at  timestamptz,
  created_at   timestamptz not null default now()
);
-- ⚠️ A UNIQUE(clan_id, slot, archived_at) constraint does NOT enforce "one live
-- tablet per slot": in Postgres NULLs are distinct, so every row with
-- archived_at IS NULL would compare unequal and ALL be allowed. A partial
-- unique index is the correct tool.
create unique index ancestors_live_slot_uniq
  on public.ancestors (clan_id, slot) where archived_at is null;
create index ancestors_clan_idx on public.ancestors (clan_id) where archived_at is null;

-- The clan cap, enforced in the DATABASE rather than trusted to the RPC.
-- A CHECK cannot reference another table, so this is a trigger. It matters
-- because the cap is a monetisation lever (SCRUM-47) — a cap that silently
-- does not hold is a data bug, not a cosmetic one.
create or replace function public.enforce_ancestor_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  live_count int;
  cap        smallint;
begin
  if new.archived_at is not null then
    return new;                      -- archiving never trips the cap
  end if;

  select ancestor_cap into cap from public.clans where id = new.clan_id;
  if cap is null then
    raise exception 'clan % does not exist', new.clan_id;
  end if;

  select count(*) into live_count
  from public.ancestors
  where clan_id = new.clan_id
    and archived_at is null
    and id is distinct from new.id;   -- ignore the row being updated

  if live_count >= cap then
    raise exception 'clan % is at its ancestor cap (%)', new.clan_id, cap
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger ancestors_enforce_cap
  before insert or update on public.ancestors
  for each row execute function public.enforce_ancestor_cap();

-- ═══ CAPTURE & THE AI PIPELINE ═════════════════════════════════════════════

create table public.captures (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (user_id) on delete cascade,
  -- captures/{user_id}/{capture_id}.jpg — private bucket, signed URLs only
  storage_path text not null,
  status       public.capture_status not null default 'pending',
  moderation   text,
  created_at   timestamptz not null default now()
);
create index captures_user_created_idx on public.captures (user_id, created_at desc);
-- 7-day raw-photo retention is a scheduled purge (doc 13 §2), not a column.

create table public.cartoonize_jobs (
  id           uuid primary key default gen_random_uuid(),
  capture_id   uuid not null references public.captures (id) on delete cascade,
  -- ⚠️ ONE JOB PER CAPTURE. This is what makes the orchestrator idempotent:
  -- a retried request cannot pay for a second generation (doc 07 §4.2).
  unique (capture_id),
  provider     text not null,
  style        text not null default 'D',
  status       public.job_status not null default 'queued',
  -- The spike's numbers live here — this is how cost/latency is learned
  -- in production (doc 07 §5.3, ADR-002 §5).
  cost_micros  bigint,
  latency_ms   integer,
  retries      smallint not null default 0,
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index cartoonize_jobs_status_idx on public.cartoonize_jobs (status);

-- ═══ CATALOGUE & INVENTORY ═════════════════════════════════════════════════
-- The catalogue is CODE-OWNED (src/domain/catalogue.ts). These tables are a
-- MIRROR, kept so SQL joins and inserts can resolve a code — never the source
-- of a price. The server re-reads the code constants on every purchase/award,
-- so a tampered client cannot set its own price (doc 07 §5.1.6).

create table public.offerings_catalog (
  code       text primary key,
  name_en    text not null,
  name_zh    text,
  tier       smallint not null,
  price      integer not null check (price > 0),
  -- base_value = 1.2 x price (S13d). A GENERATED column so the rule cannot be
  -- violated by a hand-written insert. The cast is required: round() returns
  -- numeric, and a generated column's expression must land on the column type.
  base_value integer generated always as (round(price * 1.2)::integer) stored,
  burnable   boolean not null default true
);

create table public.decorations_catalog (
  code          text primary key,
  slot_category public.slot_category not null,
  name_en       text not null,
  name_zh       text not null,
  -- permanent, NEVER burn -> a points SINK. NULL until the economy pass prices
  -- them; inventing a store price is a product decision, not a build one.
  price         integer check (price is null or price > 0)
);

create table public.inventory (
  user_id      uuid not null references public.profiles (user_id) on delete cascade,
  item_code    text not null,
  qty          integer not null default 1 check (qty >= 0),
  acquired_via public.acquired_via not null,
  acquired_at  timestamptz not null default now(),
  primary key (user_id, item_code)
);

create table public.equipped_decorations (
  user_id     uuid not null references public.profiles (user_id) on delete cascade,
  slot        text not null check (slot in ('top_left','top_middle','top_right','side_left','side_right','background')),
  item_code   text not null,
  equipped_at timestamptz not null default now(),
  primary key (user_id, slot)   -- one decoration per slot
);

-- ═══ BURN & ECONOMY ════════════════════════════════════════════════════════

-- The audit record of a throw. `award_snapshot` is INFORMATIONAL — the ledger
-- is authoritative. The client asserts `accuracy`; the server derives `band`
-- (ADR-005), which is why `band` is NOT accepted from the client.
create table public.burns (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (user_id) on delete cascade,
  clan_id         uuid not null references public.clans (id) on delete cascade,
  ancestor_id     uuid references public.ancestors (id) on delete set null,
  item_code       text references public.offerings_catalog (code),
  capture_id      uuid references public.captures (id) on delete set null,
  -- exactly one of item_code / capture_id (<> on booleans is XOR)
  constraint burns_exactly_one_offering check ((item_code is not null) <> (capture_id is not null)),
  band            public.aim_band not null,
  accuracy        numeric(8, 2) not null check (accuracy >= 0),
  -- coarse ~4-block cell. NEVER raw coordinates, NEVER a trail (doc 13 §2).
  cell_id         text check (cell_id is null or char_length(cell_id) <= 16),
  new_ground      boolean not null default false,
  streak_day      smallint,
  award_snapshot  integer not null default 0 check (award_snapshot between 0 and 1650),
  client_time     timestamptz,
  -- ⚠️ THE REPLAY-SAFETY KEY. The offline queue can replay a burn across days;
  -- this UNIQUE is what guarantees one award (doc 14 N6).
  idempotency_key text not null unique,
  created_at      timestamptz not null default now()
);
create index burns_user_created_idx on public.burns (user_id, created_at desc);
create index burns_clan_created_idx on public.burns (clan_id, created_at desc);

-- ═══ THE LEDGER — APPEND-ONLY, THE ONLY SOURCE OF MONEY TRUTH ══════════════
-- Every balance is SUM(amount). No role gets UPDATE or DELETE (ADR-005 §8);
-- a correction is a compensating `adjustment` row carrying a `reason`.
create table public.ledger_events (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profiles (user_id) on delete cascade,
  seq             bigint not null,               -- per-user monotonic, assigned by award-service
  currency        public.currency_code not null,
  type            public.ledger_type not null,
  amount          integer not null check (amount <> 0),   -- signed
  ref_type        text,
  ref_id          uuid,
  actor           text not null,                 -- who wrote it (a service name)
  reason          text,                          -- REQUIRED on `adjustment`
  idempotency_key text unique,                   -- NULL when not a client-triggered movement
  created_at      timestamptz not null default now(),
  unique (user_id, seq),
  -- an adjustment without a reason is an unauditable correction — refuse it
  constraint ledger_adjustment_needs_reason
    check (type <> 'adjustment' or (reason is not null and char_length(reason) >= 4))
);
create index ledger_events_user_created_idx on public.ledger_events (user_id, created_at desc);
create index ledger_events_user_currency_idx on public.ledger_events (user_id, currency);

-- The ONLY thing a "balance" is. NOTE the two security details:
--  · security_invoker = true is REQUIRED — otherwise the view executes with the
--    owner's rights and would leak every user's balance past RLS.
--  · `credit` balances MUST NOT be mintable by an award — that invariant is
--    enforced in code (src/domain/currency.ts) and asserted by check:domain.
create view public.balances
with (security_invoker = true) as
select user_id,
       currency,
       sum(amount)::bigint as balance
from public.ledger_events
group by user_id, currency;

-- ═══ PROGRESSION, QUOTA & THE COARSE GEO GRID ══════════════════════════════

create table public.streaks (
  user_id        uuid primary key references public.profiles (user_id) on delete cascade,
  current_days   integer not null default 0 check (current_days >= 0),
  last_burn_date date
);

-- Burn limits ARE the AI-cost control (doc 10 §1). Per USER, never per clan:
-- every quota is shared across all of a user's clans (doc 15 §5.2).
create table public.quotas (
  user_id         uuid not null references public.profiles (user_id) on delete cascade,
  day             date not null,
  burns_used      smallint not null default 0 check (burns_used >= 0),
  ai_spend_micros bigint not null default 0 check (ai_spend_micros >= 0),
  primary key (user_id, day)
);

-- AGGREGATE ONLY — no user identity in this table.
create table public.grid_cells (
  cell_id      text primary key check (char_length(cell_id) <= 16),
  value        integer not null default 0,
  last_burn_at timestamptz
);

-- Deliberately coarse: enough for decay, useless as a trail (doc 07 §5.3).
create table public.cell_burns (
  user_id    uuid not null references public.profiles (user_id) on delete cascade,
  cell_id    text not null,
  day        date not null,
  burn_count smallint not null default 0 check (burn_count >= 0),
  primary key (user_id, cell_id, day)
);

-- 60s-window RPC rate limits (doc 11 §5). Idempotent queue replays are exempt.
create table public.rate_counters (
  user_id      uuid not null references public.profiles (user_id) on delete cascade,
  endpoint     text not null,
  window_start timestamptz not null,
  n            integer not null default 0 check (n >= 0),
  primary key (user_id, endpoint, window_start)
);

-- Anomaly log — LOG-ONLY at alpha. No photos, no names, no raw coordinates.
create table public.integrity_flags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles (user_id) on delete set null,
  signal      text not null,
  severity    smallint not null default 1 check (severity between 1 and 5),
  evidence    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  outcome     text
);

-- ═══ THE BOOK OF TRIBUTES ══════════════════════════════════════════════════
-- Clan-scoped, NO image (doc 15 §7 — the `tributes` storage bucket was removed
-- in doc 07 v2.9 for exactly this reason).
create table public.tributes (
  id          uuid primary key default gen_random_uuid(),
  burn_id     uuid not null references public.burns (id) on delete cascade,
  user_id     uuid not null references public.profiles (user_id) on delete cascade,
  clan_id     uuid not null references public.clans (id) on delete cascade,
  ancestor_id uuid references public.ancestors (id) on delete set null,
  item_code   text,
  points      integer not null check (points >= 0),
  festival    text,
  visibility  public.tribute_visibility not null default 'clan',
  created_at  timestamptz not null default now()
);
create index tributes_clan_created_idx on public.tributes (clan_id, created_at desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — this IS the access model, not a layer on top of one
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Two rules of construction:
--   · A table with RLS enabled and NO policy denies every client role. That is
--     the correct posture for server-written tables (burns · ledger_events ·
--     quotas · rate_counters · cartoonize_jobs · tributes · grid_cells …).
--     Only the service role — i.e. the Edge Functions — can write them.
--   · A policy that queries the table it protects recurses infinitely. Clan
--     membership is therefore resolved by SECURITY DEFINER helpers below.

-- Membership / role lookups, bypassing RLS internally so they can be used
-- INSIDE policies. `stable` + fixed search_path (a definer function without a
-- pinned search_path is a privilege-escalation vector).
create or replace function public.is_clan_member(p_clan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.clan_members m
    where m.clan_id = p_clan_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.clan_role_of(p_clan_id uuid)
returns public.clan_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role from public.clan_members m
  where m.clan_id = p_clan_id and m.user_id = auth.uid()
  limit 1;
$$;

-- Only heads (and co-heads) may change clan structure (doc 15 §3).
create or replace function public.is_clan_head(p_clan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.clan_role_of(p_clan_id) in ('head', 'co_head');
$$;

-- These must never be callable as public RPC endpoints — they take a clan id
-- and answer "is this caller a member", which is fine, but they should not be
-- exposed over the Data API as anonymous-invocable functions.
revoke execute on function public.is_clan_member(uuid) from anon;
revoke execute on function public.clan_role_of(uuid) from anon;
revoke execute on function public.is_clan_head(uuid) from anon;

-- ── Enable RLS on EVERY table (doc 07 §5.1.2) ──────────────────────────────
alter table public.profiles             enable row level security;
alter table public.devices              enable row level security;
alter table public.consent_records      enable row level security;
alter table public.clans                enable row level security;
alter table public.clan_members         enable row level security;
alter table public.ancestors            enable row level security;
alter table public.captures             enable row level security;
alter table public.cartoonize_jobs      enable row level security;
alter table public.offerings_catalog    enable row level security;
alter table public.decorations_catalog  enable row level security;
alter table public.inventory            enable row level security;
alter table public.equipped_decorations enable row level security;
alter table public.burns                enable row level security;

-- ── Policies: the client's own rows ────────────────────────────────────────

create policy profiles_select_own on public.profiles
  for select to authenticated using (user_id = auth.uid());
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (user_id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- no DELETE policy: deletion is the one-tap delete runbook (ADR-007 §7), not a
-- client-side row delete, so that cascade + tombstone stay in one transaction.

create policy devices_select_own on public.devices
  for select to authenticated using (user_id = auth.uid());
create policy devices_insert_own on public.devices
  for insert to authenticated with check (user_id = auth.uid());
create policy devices_update_own on public.devices
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Consent is APPEND-style: withdraw = insert a new row, never edit the old one.
-- No UPDATE/DELETE policy exists, so the history cannot be rewritten (ADR-007 §5).
create policy consent_select_own on public.consent_records
  for select to authenticated using (user_id = auth.uid());
create policy consent_insert_own on public.consent_records
  for insert to authenticated with check (user_id = auth.uid());

create policy captures_select_own on public.captures
  for select to authenticated using (user_id = auth.uid());
create policy captures_insert_own on public.captures
  for insert to authenticated with check (user_id = auth.uid());
-- status/moderation are the orchestrator's to set, so there is no client UPDATE.

create policy cartoonize_jobs_select_own on public.cartoonize_jobs
  for select to authenticated
  using (exists (
    select 1 from public.captures c
    where c.id = cartoonize_jobs.capture_id and c.user_id = auth.uid()
  ));

create policy inventory_select_own on public.inventory
  for select to authenticated using (user_id = auth.uid());
create policy equipped_select_own on public.equipped_decorations
  for select to authenticated using (user_id = auth.uid());

-- Readable so the UI can show progress; writes belong to award-service only.
create policy burns_select_own on public.burns
  for select to authenticated using (user_id = auth.uid());
create policy ledger_select_own on public.ledger_events
  for select to authenticated using (user_id = auth.uid());
create policy streaks_select_own on public.streaks
  for select to authenticated using (user_id = auth.uid());
create policy quotas_select_own on public.quotas
  for select to authenticated using (user_id = auth.uid());

-- The catalogue is a public mirror of code constants; read-only to clients.
create policy offerings_catalog_read on public.offerings_catalog
  for select to authenticated using (true);
create policy decorations_catalog_read on public.decorations_catalog
  for select to authenticated using (true);

-- ── Policies: the clan boundary — where the most sensitive data lives ──────

create policy clans_select_member on public.clans
  for select to authenticated using (public.is_clan_member(id) or created_by = auth.uid());
create policy clans_insert_self on public.clans
  for insert to authenticated with check (created_by = auth.uid());
create policy clans_update_head on public.clans
  for update to authenticated using (public.is_clan_head(id)) with check (public.is_clan_head(id));

-- Membership is visible to fellow members; joining/leaving/promoting all go
-- through RPCs, which enforce the role ladder and rate limits (doc 15 §3).
create policy clan_members_select_member on public.clan_members
  for select to authenticated using (public.is_clan_member(clan_id));

-- ⚠️ ANCESTOR NAMES. Visible only to members of the owning clan, and to nobody
-- else — not to other clans, not to analytics, not to a share surface
-- (doc 13 §4). There is no anonymous or cross-clan policy, by design.
create policy ancestors_select_member on public.ancestors
  for select to authenticated using (public.is_clan_member(clan_id));

-- The Book of Tributes: members read their clan's entries; a user always reads
-- their own. Non-members get an ANONYMISED projection through a separate RPC,
-- never this policy (doc 15 §7).
create policy tributes_select_member on public.tributes
  for select to authenticated
  using (
    (visibility = 'clan' and public.is_clan_member(clan_id))
    or user_id = auth.uid()
  );
alter table public.ledger_events        enable row level security;
alter table public.streaks              enable row level security;
alter table public.quotas               enable row level security;
alter table public.grid_cells           enable row level security;
alter table public.cell_burns           enable row level security;
alter table public.rate_counters        enable row level security;
alter table public.integrity_flags      enable row level security;
alter table public.tributes             enable row level security;

-- ── The append-only guarantee, as a GRANT and not just a convention ────────
-- doc 07 §5.1.1 / ADR-005 §8 require that NO role can UPDATE or DELETE the
-- ledger. RLS alone would already deny it (there is no write policy), but the
-- grant is revoked too, so the property survives a future careless policy.
-- Writes happen as the `service_role` — i.e. from award-service — which is not
-- revoked here.
revoke insert, update, delete on public.ledger_events from anon, authenticated;
revoke update, delete          on public.burns         from anon, authenticated;

-- Server-only tables: RLS is on and no policy exists, so client roles are
-- denied. Spelled out because "no policy" is easy to mistake for an oversight:
--   cartoonize_jobs  quotas   grid_cells   cell_burns   rate_counters
--   integrity_flags  tributes
-- Every one of those is written by an Edge Function acting as service_role.

-- ── Column-level protection for the pseudonym ─────────────────────────────
-- display_label is what the league shows. It must never be the ancestor name
-- (doc 13 §4) — that is a product rule the UI and the clan flow enforce, not
-- something SQL can infer. Flagged here so it is not lost.

comment on table public.ancestors is
  'Clan-owned ancestral tablets. Names are the most sensitive data in the system: RLS scopes them to clan members only; they must never reach analytics, logs, crash reports or any share surface (doc 13 §4).';
comment on column public.clans.ancestor_cap is
  'Max live tablets for this clan. Default 10. NOT the altar display cap (4) — see doc 07 v2.9 and the save_ancestor correction.';
comment on column public.burns.cell_id is
  'Coarse ~4-block cell id. Deliberately NOT a coordinate and NOT a trail (doc 13 §2). PostGIS is available on this project and deliberately unused.';
comment on column public.ledger_events.amount is
  'Signed. The ledger is append-only: corrections are compensating `adjustment` rows carrying a `reason`.';
comment on view public.balances is
  'The only balance that exists: SUM(amount) per currency. security_invoker=true so RLS on ledger_events still applies to the caller.';