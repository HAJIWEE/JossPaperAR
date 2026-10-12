-- ═══════════════════════════════════════════════════════════════════════════
-- LEAGUE SCHEMA — the four tables the ranking needs (SCRUM-11 · doc 07 §4.4/§5.3)
--
-- WHY THIS MIGRATION EXISTS: the slice deliberately left the league out, and
-- both consumers have said so in their own comments since 2026-10-04 —
--   · `get_league_board()`  (20261004091500_rpc_app_surface.sql:161-200) — an
--     honest stub returning the caller's weekly tribute and `rows: []`
--   · `weekly-roll`         (supabase/functions/weekly-roll/index.ts) — an
--     honest stub reporting `status: 'stub'`
-- and `pr3_verification.sql` ASSERTS that stub (the points AND the `note`), so
-- it cannot silently start pretending to rank. This is what makes both real.
--
-- ⚠️ ADDITIVE ONLY — no applied migration is edited (project rule). Four new
-- tables; nothing existing is touched.
--
-- ⚠️ WHAT IS DELIBERATELY NOT HERE:
--   · `pg_cron` and the schedule — they arrive with the roll engine (the next
--     migration), because enabling a scheduler with no job is noise (doc 19 §4.3).
--   · The tier VOCABULARY and the promotion surface — those are doc 07 §7 Q6,
--     an OPEN PM decision filed as **SCRUM-111**. `cohorts.tier` is therefore a
--     plain integer rung, not a named band, so the answer can land as data and
--     copy without a second migration.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ THE WEEK, THE COHORTS, THE MEMBERS, THE AUDIT ═════════════════════════

-- One row per ISO week. UNIQUE(start_date) is what makes "the week" a single
-- object rather than a convention the engine has to hope for.
create table public.league_weeks (
  id         uuid primary key default gen_random_uuid(),
  start_date date not null unique,
  end_date   date not null,
  status     text not null default 'active'
               check (status in ('active', 'rolling', 'closed')),
  created_at timestamptz not null default now(),
  check (end_date > start_date)
);

comment on table public.league_weeks is
  'One ISO week of the league (doc 07 §4.4/§5.3). Cron-driven: opened by a '
  'roll, closed by the next. status `rolling` is the in-flight window, so a '
  'second cron tick cannot rank the same week twice.';

-- Fixed-size cohorts. `tier` is the RUNG (lowest = 1). Several cohorts may
-- share a tier once it fills, which is why (week_id, tier) is NOT unique.
create table public.cohorts (
  id         uuid primary key default gen_random_uuid(),
  week_id    uuid not null references public.league_weeks (id) on delete cascade,
  tier       integer not null check (tier >= 1),
  created_at timestamptz not null default now()
);

comment on table public.cohorts is
  'A Duolingo-style cohort within one week (doc 07 §4.4). Cohort SIZE is a '
  'constant of the roll, not a column: the roll fills to N and opens another '
  'when a tier overflows. `tier` is a numeric rung — the band NAMES are '
  'SCRUM-111 (doc 07 §7 Q6) and are deliberately not encoded here.';

create index cohorts_week_idx on public.cohorts (week_id, tier);

-- The board's rows.
--
-- ⚠️ NO foreign key to `profiles` — that is the entire point of the tombstone
-- rule: audit tables hold LABELS, not profile FKs (ADR-007 §8). Account
-- deletion sets `user_id` to NULL and rewrites `display_label` to
-- '已注销 · deleted', and the row survives with no dangling reference.
--
-- The surrogate PK is REQUIRED: `user_id` is nullable, so it cannot be part of
-- a primary key. `unique (cohort_id, user_id)` still gives one row per member
-- per cohort, and Postgres treats NULLs as distinct in a unique index — which
-- is exactly what tombstoning needs (many NULL members must be legal).
create table public.cohort_members (
  id            uuid primary key default gen_random_uuid(),
  cohort_id     uuid not null references public.cohorts (id) on delete cascade,
  user_id       uuid,
  display_label text not null,
  weekly_points bigint not null default 0 check (weekly_points >= 0),
  rank          integer check (rank >= 1),
  outcome       text check (outcome in ('promoted', 'demoted', 'held')),
  joined_at     timestamptz not null default now(),
  unique (cohort_id, user_id)
);

comment on table public.cohort_members is
  'One row per user per cohort-week. `weekly_points` is a DENORM CACHE ONLY — '
  'the authoritative figure is SUM over `ledger_events`, recomputed on every '
  'roll (doc 07 §4.4: never a stored mutable score). `user_id` is nullable by '
  'design and there is NO FK to profiles: deletion tombstones the row so the '
  'audit trail survives without holding a profile reference (ADR-007 §8). '
  '`rank` and `outcome` are written by the roll, never by a client.';

create index cohort_members_cohort_idx on public.cohort_members (cohort_id, rank);
create index cohort_members_user_idx   on public.cohort_members (user_id)
  where user_id is not null;

-- The audit trail: what a roll actually did. `promoted`/`demoted` hold DISPLAY
-- LABELS, not user ids, for the same ADR-007 §8 reason as above.
create table public.weekly_rolls (
  id                uuid primary key default gen_random_uuid(),
  week_id           uuid not null references public.league_weeks (id) on delete cascade,
  ran_at            timestamptz not null default now(),
  cohorts_ranked    integer not null default 0 check (cohorts_ranked >= 0),
  members_ranked    integer not null default 0 check (members_ranked >= 0),
  promoted          text[] not null default '{}',
  demoted           text[] not null default '{}',
  impossible_scores integer not null default 0 check (impossible_scores >= 0)
);

comment on table public.weekly_rolls is
  'One audit row per roll (doc 07 §4.4). `promoted`/`demoted` are display '
  'LABELS (ADR-007 §8). `impossible_scores` counts members whose weekly total '
  'exceeded 346,500 — impossible by construction (7 x 49,500), so it means a '
  'code path broke and must be FLAGGED, not paid (doc 11 §4/§6.1).';

create index weekly_rolls_week_idx on public.weekly_rolls (week_id, ran_at desc);

-- ── Enable RLS on every new table (doc 07 §5.1.2) ──────────────────────────
alter table public.league_weeks   enable row level security;
alter table public.cohorts        enable row level security;
alter table public.cohort_members enable row level security;
alter table public.weekly_rolls   enable row level security;

-- ── Policies: read-only to the app; the roll is the only writer ────────────
-- ⚠️ There is deliberately NO insert/update/delete policy on any of the four.
-- Every write belongs to the roll, which runs with the secret key (service
-- role) and bypasses RLS. A client can read the league and cannot alter a
-- rank, a points cache or an outcome — the same shape as `ledger_events`.
--
-- ⚠️ DECISION RECORDED RATHER THAN ASSUMED: select is granted to every
-- authenticated user, not only to members of the caller's own cohort. The
-- exposure is pseudonymous by construction — `display_label` IS the pseudonym
-- the league exists to show (doc 07 §5.3 `profiles.display_label`) — and the
-- other columns are a points cache and a rank. The narrower alternative (a
-- SECURITY DEFINER helper returning the caller's cohort ids, with a policy
-- keyed on it) is available if the ADR-007 review wants it; it was NOT taken
-- here because it adds a function to every read without reducing what a
-- leaderboard already shows. Flagged on SCRUM-11 for that review.
create policy league_weeks_read on public.league_weeks
  for select to authenticated using (true);

create policy cohorts_read on public.cohorts
  for select to authenticated using (true);

create policy cohort_members_read on public.cohort_members
  for select to authenticated using (true);

create policy weekly_rolls_read on public.weekly_rolls
  for select to authenticated using (true);
