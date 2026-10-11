-- ═══════════════════════════════════════════════════════════════════════════
-- THE ROLL ENGINE (SCRUM-11 step 2 · doc 07 §4.4 · doc 11 §4)
--
-- `weekly-roll` has been an honest stub since 2026-10-04, and it documented its
-- own remaining work in-file. This is that work, as ONE TRANSACTIONAL FUNCTION:
--
--   close the week → rank each cohort from the LEDGER → top 3 promote /
--   bottom 3 demote → write the `weekly_rolls` audit row → close the week →
--   open the next one and fill it at 30 → flag impossible scores, never pay them
--
-- ⚠️ WHY A FUNCTION AND NOT THE EDGE FUNCTION. The stub's own comment points at
-- the Edge Function, but a roll that ranks, promotes, audits and opens a week
-- must be ATOMIC: a crash halfway through would leave a half-rolled week that
-- no second tick can fix. Postgres gives us that in one transaction; a Deno
-- function doing five round-trips does not. So `weekly-roll` becomes a THIN
-- CALLER of this function (it keeps the secret-key gate and the schedule
-- surface), and pg_cron can call it too.
--
-- ⚠️ ADDITIVE ONLY. Step 1's migration is untouched; the one schema change here
-- is a new column on `cohorts` plus the unique key that makes `cohort_no` real.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ `cohort_no` — the discriminator the fill needs ════════════════════════
-- Step 1 allowed several cohorts per tier but gave them no way to be told
-- apart, so a set-based fill could not say "these 30 go to cohort 1, those 30
-- to cohort 2". Defaulted to 1 so any existing row stays coherent.
alter table public.cohorts
  add column cohort_no integer not null default 1 check (cohort_no >= 1);

-- The real invariant: ONE cohort per (week, tier, number). This is stronger
-- than step 1's silence on the question, and it is what lets the fill be an
-- idempotent `on conflict do nothing`.
alter table public.cohorts
  add constraint cohorts_week_tier_no_key unique (week_id, tier, cohort_no);

comment on column public.cohorts.cohort_no is
  'Which cohort of this tier, 1-based. A tier that overflows 30 members opens '
  'cohort_no 2. unique (week_id, tier, cohort_no) means the fill is idempotent, '
  'so re-running a roll cannot double-place anyone.';

-- ═══ league_fill_week — place members into a week's cohorts ═══════════════
-- Shared by the roll (carrying last week's outcome) and by the first-ever week
-- (everyone enters at the bottom rung).
--
-- ⚠️ ENTRY RULE, RECORDED RATHER THAN ASSUMED: a user with no cohort to carry
-- forward enters at **tier 1 (木)**. doc 07 §4.4 fixes the ladder's direction but
-- not the entry point; entering at the bottom is the only reading of an
-- ascending ladder that does not invent a placement, and it matches the
-- Duolingo model the spec names.
create or replace function public.league_fill_week(
  p_week_id     uuid,
  p_from_week   uuid default null
) returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_cohort_size constant integer := 30;   -- SCRUM-111 answer A
  c_top_tier    constant integer := 6;    -- src/domain/league.ts TOP_TIER
  v_placed      integer;
begin
  -- 1 · ensure the cohorts this week needs exist (idempotent)
  if p_from_week is null then
    insert into public.cohorts (week_id, tier, cohort_no)
    select p_week_id, 1, (s.rn - 1) / c_cohort_size + 1
      from (select row_number() over (order by p.created_at, p.user_id) as rn
              from public.profiles p where p.deleted_at is null) s
     group by (s.rn - 1) / c_cohort_size + 1
    on conflict (week_id, tier, cohort_no) do nothing;

    insert into public.cohort_members (cohort_id, user_id, display_label)
    select c.id, s.user_id, s.display_label
      from (select p.user_id, p.display_label,
                   row_number() over (order by p.created_at, p.user_id) as rn
              from public.profiles p where p.deleted_at is null) s
      join public.cohorts c on c.week_id = p_week_id
                           and c.tier = 1
                           and c.cohort_no = (s.rn - 1) / c_cohort_size + 1
    on conflict (cohort_id, user_id) do nothing;
  else
    insert into public.cohorts (week_id, tier, cohort_no)
    select p_week_id, s.tier, (s.rn - 1) / c_cohort_size + 1
      from (select least(c_top_tier, greatest(1, co.tier
                     + case cm.outcome when 'promoted' then 1 when 'demoted' then -1 else 0 end)) as tier,
                   row_number() over (partition by least(c_top_tier, greatest(1, co.tier
                     + case cm.outcome when 'promoted' then 1 when 'demoted' then -1 else 0 end))
                                      order by cm.rank nulls last, cm.user_id) as rn
              from public.cohort_members cm
              join public.cohorts co on co.id = cm.cohort_id
             where co.week_id = p_from_week and cm.user_id is not null) s
     group by s.tier, (s.rn - 1) / c_cohort_size + 1
    on conflict (week_id, tier, cohort_no) do nothing;

    insert into public.cohort_members (cohort_id, user_id, display_label)
    select c.id, s.user_id, s.display_label
      from (select cm.user_id, cm.display_label,
                   least(c_top_tier, greatest(1, co.tier
                     + case cm.outcome when 'promoted' then 1 when 'demoted' then -1 else 0 end)) as tier,
                   row_number() over (partition by least(c_top_tier, greatest(1, co.tier
                     + case cm.outcome when 'promoted' then 1 when 'demoted' then -1 else 0 end))
                                      order by cm.rank nulls last, cm.user_id) as rn
              from public.cohort_members cm
              join public.cohorts co on co.id = cm.cohort_id
             where co.week_id = p_from_week and cm.user_id is not null) s
      join public.cohorts c on c.week_id = p_week_id
                           and c.tier = s.tier
                           and c.cohort_no = (s.rn - 1) / c_cohort_size + 1
    on conflict (cohort_id, user_id) do nothing;
  end if;

  select count(*) into v_placed
    from public.cohort_members cm
    join public.cohorts c on c.id = cm.cohort_id
   where c.week_id = p_week_id;

  return v_placed;
end;
$$;

comment on function public.league_fill_week(uuid, uuid) is
  'Places members into a league week''s cohorts, 30 to a cohort (SCRUM-111 '
  'answer A). p_from_week = the rolled week whose outcomes carry forward; NULL '
  'means a first-ever week, where everyone enters at tier 1. Idempotent by '
  'construction: both inserts are `on conflict do nothing`.';

-- ═══ roll_league_week — close, rank, move, audit, reopen ══════════════════
-- SECURITY DEFINER, EXECUTE to service_role ONLY (the same shape as
-- `submit_burn`): a client must never be able to trigger a roll.
create or replace function public.roll_league_week(
  p_week_start date default null,
  p_now        timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_promote    constant integer := 3;        -- doc 07 §4.4: top three
  c_demote     constant integer := 3;        -- doc 07 §4.4: bottom three
  c_top_tier   constant integer := 6;        -- src/domain/league.ts TOP_TIER
  c_max_weekly constant bigint  := 346500;   -- doc 11 §4: 7 x 49,500
  v_week       public.league_weeks;
  v_next       uuid;
  v_cohorts    integer := 0;
  v_members    integer := 0;
  v_impossible integer := 0;
  v_promoted   text[] := '{}';
  v_demoted    text[] := '{}';
  v_placed     integer := 0;
begin
  -- ── pick the week ───────────────────────────────────────────────────────
  select * into v_week
    from public.league_weeks w
   where (p_week_start is null and w.status = 'active')
      or (p_week_start is not null and w.start_date = p_week_start)
   order by w.start_date desc
   limit 1
     for update;

  if not found then
    return jsonb_build_object('rolled', false, 'status', 'no_week',
      'note', 'no league week exists — call open_league_week() first');
  end if;

  -- Idempotence: a closed week is never re-ranked. Without this a second cron
  -- tick would promote the same people again.
  if v_week.status = 'closed' then
    return jsonb_build_object('rolled', false, 'status', 'already_closed',
      'week_start', v_week.start_date);
  end if;

  -- ⚠️ CLAIM IT. `rolling` is the in-flight window (doc 07 §4.4), so a second
  -- tick arriving mid-roll sees a week that is neither active nor closed and
  -- cannot rank it a second time.
  update public.league_weeks set status = 'rolling' where id = v_week.id;

  -- ── 1 · recompute the points cache FROM THE LEDGER ──────────────────────
  -- doc 07 §4.4: the ranking is DERIVED, never a stored mutable score. This is
  -- what makes `cohort_members.weekly_points` a cache and not a source of truth.
  with pts as (
    select cm.id as member_id, coalesce(sum(le.amount), 0)::bigint as pts
      from public.cohort_members cm
      join public.cohorts co on co.id = cm.cohort_id
      left join public.ledger_events le
        on le.user_id = cm.user_id
       and le.currency  = 'tribute'
       and le.type      = 'award'
       and le.created_at >= (v_week.start_date::timestamp at time zone 'utc')
       and le.created_at <  ((v_week.end_date + 1)::timestamp at time zone 'utc')
     where co.week_id = v_week.id
       and cm.user_id is not null
     group by cm.id
  )
  update public.cohort_members cm
     set weekly_points = pts.pts
    from pts
   where cm.id = pts.member_id;

  -- ── 2 · the impossible-score line (doc 11 §4 / §6.1) ────────────────────
  -- More than 346,500 in one week is impossible BY CONSTRUCTION (7 x 49,500),
  -- so it means a code path broke. FLAG it — never promote on it. Recorded in
  -- the receipt as a count so a silently-flagged week is still visible.
  insert into public.integrity_flags (user_id, signal, severity, evidence)
  select cm.user_id, 'impossible_weekly_tribute', 3,
         jsonb_build_object('week_start', v_week.start_date,
                            'points', cm.weekly_points, 'line', c_max_weekly)
    from public.cohort_members cm
    join public.cohorts co on co.id = cm.cohort_id
   where co.week_id = v_week.id
     and cm.user_id is not null
     and cm.weekly_points > c_max_weekly;
  get diagnostics v_impossible = row_count;

  -- ── 3 · rank inside each cohort, then decide who moves ──────────────────
  with ranked as (
    select cm.id, co.tier, cm.weekly_points,
           -- the position shown on the board (everyone who is ranked)
           row_number() over (partition by cm.cohort_id
                              order by cm.weekly_points desc, cm.user_id) as raw_rank,
           -- ⚠️ THE PROMOTION WINDOW IS RANKED OVER UNFLAGGED MEMBERS ONLY.
           -- A flagged member keeps their board position but CANNOT TAKE A SLOT:
           -- if they could, an impossible score would consume one of the cohort's
           -- three promotions and silently shortchange an honest member for
           -- someone else's broken code path. Excluding them from the window is
           -- exactly "flag it, do not pay it" (doc 11 §4) with no collateral.
           case when cm.weekly_points > c_max_weekly then null
                else row_number() over (
                       partition by cm.cohort_id, (cm.weekly_points > c_max_weekly)
                       order by cm.weekly_points desc, cm.user_id) end as rn,
           -- n counts the UNFLAGGED members, so the promote/demote windows below
           -- are sized against the cohort that can actually move.
           count(*) filter (where cm.weekly_points <= c_max_weekly)
                  over (partition by cm.cohort_id) as n
      from public.cohort_members cm
      join public.cohorts co on co.id = cm.cohort_id
     where co.week_id = v_week.id
       and cm.user_id is not null
  ),
  decided as (
    select r.id, r.raw_rank as rank,
           case
             -- flagged above: held, never paid, and never demoted either
             -- (ADR-005 is log-only at alpha — no auto-punishment)
             when r.rn is null                                  then 'held'
             -- ⚠️ A SPARSE COHORT MOVES NOBODY. With n <= promote+demote the
             -- top-3 and bottom-3 sets overlap, and splitting them would mean
             -- demoting most of a three-person cohort. At alpha scale a cohort
             -- of six or fewer is the NORMAL case, not an edge case.
             when r.n <= c_promote + c_demote                   then 'held'
             -- the ladder ends: a promotion at the top HOLDS and a demotion at
             -- the bottom HOLDS (both ends asserted by check:league)
             when r.rn <= c_promote and r.tier >= c_top_tier    then 'held'
             when r.rn > r.n - c_demote and r.tier <= 1         then 'held'
             when r.rn <= c_promote                             then 'promoted'
             when r.rn > r.n - c_demote                         then 'demoted'
             else 'held'
           end as outcome
      from ranked r
  )
  update public.cohort_members cm
     set rank = d.rank, outcome = d.outcome
    from decided d
   where cm.id = d.id;

  -- ── 4 · the audit row ───────────────────────────────────────────────────
  select count(*) into v_cohorts from public.cohorts where week_id = v_week.id;
  select count(*) into v_members
    from public.cohort_members cm
    join public.cohorts co on co.id = cm.cohort_id
   where co.week_id = v_week.id;

  select coalesce(array_agg(cm.display_label order by cm.rank)
                    filter (where cm.outcome = 'promoted'), '{}'),
         coalesce(array_agg(cm.display_label order by cm.rank)
                    filter (where cm.outcome = 'demoted'), '{}')
    into v_promoted, v_demoted
    from public.cohort_members cm
    join public.cohorts co on co.id = cm.cohort_id
   where co.week_id = v_week.id;

  insert into public.weekly_rolls
    (week_id, cohorts_ranked, members_ranked, promoted, demoted, impossible_scores)
  values (v_week.id, v_cohorts, v_members, v_promoted, v_demoted, v_impossible);

  -- ── 5 · close it, open the next, fill it ────────────────────────────────
  update public.league_weeks set status = 'closed' where id = v_week.id;

  insert into public.league_weeks (start_date, end_date, status)
  values (v_week.start_date + 7, v_week.start_date + 13, 'active')
  on conflict (start_date) do nothing;

  select id into v_next from public.league_weeks where start_date = v_week.start_date + 7;
  v_placed := public.league_fill_week(v_next, v_week.id);

  return jsonb_build_object(
    'rolled',               true,
    'status',               'rolled',
    'week_start',           v_week.start_date,
    'cohorts_ranked',       v_cohorts,
    'members_ranked',       v_members,
    'promoted',             v_promoted,
    'demoted',              v_demoted,
    'impossible_scores',    v_impossible,
    'next_week_start',      v_week.start_date + 7,
    'members_placed_next',  v_placed,
    'impossible_score_line', c_max_weekly
  );
end;
$$;

-- ═══ open_league_week — the bootstrap the first roll needs ════════════════
create or replace function public.open_league_week(p_start date default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_start  date;
  v_id     uuid;
  v_status text;
  v_placed integer := 0;
begin
  v_start := date_trunc('week', coalesce(p_start, (now() at time zone 'utc')::date))::date;

  insert into public.league_weeks (start_date, end_date, status)
  values (v_start, v_start + 6, 'active')
  on conflict (start_date) do nothing;

  select id, status into v_id, v_status
    from public.league_weeks where start_date = v_start;

  -- a closed week must not silently gain members
  if v_status = 'active' then
    v_placed := public.league_fill_week(v_id, null);
  end if;

  return jsonb_build_object('week_start', v_start, 'status', v_status,
                            'members_placed', v_placed);
end;
$$;

-- ── EXECUTE to service_role ONLY (the `submit_burn` shape) ─────────────────
revoke execute on function public.roll_league_week(date, timestamptz) from public, anon, authenticated;
revoke execute on function public.open_league_week(date)              from public, anon, authenticated;
revoke execute on function public.league_fill_week(uuid, uuid)        from public, anon, authenticated;
grant  execute on function public.roll_league_week(date, timestamptz) to service_role;
grant  execute on function public.open_league_week(date)              to service_role;
grant  execute on function public.league_fill_week(uuid, uuid)        to service_role;
