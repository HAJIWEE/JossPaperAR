-- ═══════════════════════════════════════════════════════════════════════════
-- THE ROLL BOOTSTRAPS ITSELF — the league can start from a COLD database
-- (SCRUM-115 · Sprint 2)
--
-- ⚠️ THE DEFECT. `open_league_week()` is the ONLY thing that creates a
-- `league_weeks` row, and NOTHING called it. `pg_cron` schedules
-- `roll_league_week()`, which returned {"status":"no_week"} when no week existed
-- — so the Monday tick no-opped forever and the league could never start. Worse,
-- `get_league_board()`'s note told the CLIENT the opposite ("the first roll
-- opens one"). Found 2026-10-12 while verifying that the SCRUM-11 push was
-- really live; filed as SCRUM-115.
--
-- ✅ THE FIX, and why it lives HERE rather than in a second cron entry. A
-- bootstrap cron would have to run BEFORE the Monday roll to be useful, and its
-- ordering against that job is a promise nothing enforces. The roll already
-- owns the question "which week is current", so it opens one when there is none.
--
-- ⚠️ WHAT IT DELIBERATELY DOES NOT DO: RANK. A week that has just been opened
-- has no points, so ranking and closing it would promote nobody and consume the
-- week. The bootstrap opens + fills and returns `status = "bootstrapped"`; the
-- NEXT Monday's tick rolls it normally.
--
-- ⚠️ AN EXPLICIT p_week_start IS NEVER BOOTSTRAPPED — an operator who asks for
-- one week must not be handed a different one. That path still returns
-- `no_week`, with a note that no longer sends the caller to a function nothing
-- runs.
--
-- ⚠️ `p_now` IS NOW READ. It was in the signature and never used — the whole
-- function ran on the DEFAULT. The bootstrap derives the week from it, which is
-- what lets a test drive an arbitrary instant and assert the boundary.
--
-- An applied migration is permanent, so this is a NEW version: the body below is
-- the 20261011130000 text re-emitted VERBATIM with exactly one branch inserted
-- (the patch anchor was asserted to match exactly once, so the diff is only what
-- was intended).
-- ═══════════════════════════════════════════════════════════════════════════

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

  -- ── 0 · SELF-BOOTSTRAP (SCRUM-115) ────────────────────────────────────────
  -- The cron calls THIS function, and `open_league_week()` had no caller — so a
  -- cold database stayed cold forever (`no_week` every Monday) while the board
  -- told the client the opposite. Open the week containing the roll's OWN clock
  -- and fill it. ⚠️ Nothing is RANKED: a week that has just opened has no
  -- points, so closing it would promote nobody and destroy the week.
  if not found and p_week_start is null then
    perform public.open_league_week((p_now at time zone 'utc')::date);
    select * into v_week
      from public.league_weeks w
     where w.status = 'active'
     order by w.start_date desc
     limit 1
       for update;
    if found then
      select count(*) into v_members
        from public.cohort_members cm
        join public.cohorts co on co.id = cm.cohort_id
       where co.week_id = v_week.id;
      return jsonb_build_object(
        'rolled',         false,
        'status',         'bootstrapped',
        'week_start',     v_week.start_date,
        'members_placed', v_members,
        'note',           'no league week existed — opened and filled the current one; nothing is ranked until the next roll');
    end if;
  end if;

  -- ⚠️ An EXPLICIT p_week_start is NEVER bootstrapped: an operator who names a
  -- week must not be handed a different one. This branch is also what catches the
  -- case where a week exists but is already CLOSED (nothing to bootstrap), and it
  -- keeps the early return the original 20261011130000 block had — without it the
  -- function would fall through with a NULL v_week and try to open a NULL week.
  if not found then
    return jsonb_build_object('rolled', false, 'status', 'no_week',
      'note', 'no active league week — call open_league_week() first');
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

-- ── ACLs restated ──────────────────────────────────────────────────────────
-- `create or replace` PRESERVES the existing grants, so this changes nothing;
-- it is restated because the default-PUBLIC-grant trap (SCRUM-11: five
-- world-executable functions) is exactly the kind of thing a later re-emit
-- silently reintroduces. `league_bootstrap.sql` asserts it from three sides.
revoke execute on function public.roll_league_week(date, timestamptz) from public, anon, authenticated;
grant  execute on function public.roll_league_week(date, timestamptz) to service_role;
