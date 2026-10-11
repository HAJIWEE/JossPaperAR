-- ═══════════════════════════════════════════════════════════════════════════
-- THE BOARD — get_league_board() becomes real (SCRUM-11 step 3 · doc 07 §4.4)
--
-- Since 2026-10-04 this returned the caller's own weekly tribute and `rows: []`,
-- with a `note` saying "league cohorts arrive with SCRUM-11" — and
-- pr3_verification.sql ASSERTS that, so the stub could never quietly start
-- pretending to rank. The league tables and the roll now exist, so it ranks.
--
-- doc 07 §4.4: "derived from SUM(ledger weekly) per cohort member (never a
-- stored mutable score); client subscribes to `league:{cohort_id}` Realtime
-- channel for live re-rank after each burn."
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ league_cohort_weekly_points — the ONE thing INVOKER cannot do ════════
-- ⚠️ WHY A SECURITY DEFINER HELPER EXISTS IN A FILE THAT OTHERWISE INSISTS ON
-- INVOKER. `get_league_board()` must stay SECURITY INVOKER (RULE B), but the
-- live board needs every member's weekly total — and `ledger_events` is guarded
-- by `ledger_select_own` (`using (user_id = auth.uid())`), so an INVOKER function
-- CANNOT read another user's rows. That policy is correct and must not be
-- weakened; the escape hatch is the repo's established one (`is_clan_member`,
-- `clan_role_of`), a narrowly-scoped DEFINER helper.
--
-- ⚠️ WHAT IT CAN LEAK, ANSWERED RATHER THAN IGNORED: per-member weekly TOTALS.
-- That is precisely what a leaderboard displays, and `cohort_members` is already
-- SELECT-able by any authenticated user (step 1's policy), so this grants no
-- new reach. It does NOT return identities beyond the pseudonymous
-- `display_label` the board already shows, and it takes a cohort id — not a
-- free-form query, so it cannot be pointed at the whole ledger.
create or replace function public.league_cohort_weekly_points(
  p_cohort_id uuid,
  p_from      timestamptz,
  p_to        timestamptz
) returns table (member_id uuid, points bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select cm.id, coalesce(sum(le.amount), 0)::bigint
    from public.cohort_members cm
    left join public.ledger_events le
      on le.user_id      = cm.user_id
     and le.currency     = 'tribute'
     and le.type         = 'award'
     and le.created_at  >= p_from
     and le.created_at  <  p_to
   where cm.cohort_id = p_cohort_id
     and cm.user_id is not null
   group by cm.id;
$$;

comment on function public.league_cohort_weekly_points(uuid, timestamptz, timestamptz) is
  'Per-member weekly tribute for ONE cohort, summed from the ledger. A SECURITY '
  'DEFINER helper because ledger_events RLS is own-rows-only and the board is '
  'INVOKER (doc 07 §4.4). Returns pseudonymous labels'' worth of data — a '
  'points total — which cohort_members already exposes to authenticated users.';

-- ═══ get_league_board — the real one ══════════════════════════════════════
create or replace function public.get_league_board()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_start date := date_trunc('week', now())::date;
  v_end   date := (date_trunc('week', now()) + interval '6 days')::date;
  v_week  public.league_weeks;
  v_co    public.cohorts;
  v_pts   bigint;
  v_rows  jsonb;
  v_rank  integer;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  -- The caller's OWN weekly tribute, straight from the ledger — readable under
  -- RLS because these are the caller's rows. INVOKER + RLS, per RULE B.
  select coalesce(sum(amount), 0)::bigint into v_pts
    from public.ledger_events
   where user_id = v_uid
     and currency = 'tribute'
     and type = 'award'
     and created_at >= (v_start::timestamp at time zone 'utc');

  select * into v_week from public.league_weeks w
   where w.status = 'active' order by w.start_date desc limit 1;

  -- Unplaced cases return the SAME key set with a `note`, so a client can render
  -- one shape and never has to branch on which keys are missing.
  if v_week.id is null then
    return jsonb_build_object(
      'week_start', v_start, 'week_end', v_end,
      'cohort_id', null, 'cohort_no', null, 'tier', null,
      'rows', '[]'::jsonb, 'members', 0,
      'my_weekly_points', v_pts, 'my_rank', null,
      'note', 'no league week is open yet — the first roll opens one');
  end if;

  select c.* into v_co
    from public.cohort_members cm
    join public.cohorts c on c.id = cm.cohort_id
   where c.week_id = v_week.id
     and cm.user_id = v_uid
   limit 1;

  if v_co.id is null then
    return jsonb_build_object(
      'week_start', v_week.start_date, 'week_end', v_week.end_date,
      'cohort_id', null, 'cohort_no', null, 'tier', null,
      'rows', '[]'::jsonb, 'members', 0,
      'my_weekly_points', v_pts, 'my_rank', null,
      'note', 'not placed in a cohort this week — the next roll places you');
  end if;

  -- The cohort's live table: every member's total from the LEDGER (via the
  -- DEFINER helper), ranked. `outcome` is from the last roll and is NULL for a
  -- week still in flight — that is honest, not missing data.
  with pts as (
    select * from public.league_cohort_weekly_points(
      v_co.id,
      (v_week.start_date::timestamp at time zone 'utc'),
      ((v_week.end_date + 1)::timestamp at time zone 'utc'))
  ),
  ranked as (
    select cm.user_id, cm.display_label, cm.outcome, p.points,
           row_number() over (order by p.points desc, cm.user_id) as rn
      from public.cohort_members cm
      join pts p on p.member_id = cm.id
  )
  select jsonb_agg(jsonb_build_object(
           'display_label', r.display_label,
           'weekly_points', r.points,
           'rank',          r.rn,
           'is_me',         r.user_id = v_uid,
           'outcome',       r.outcome)
         order by r.rn),
         max(case when r.user_id = v_uid then r.rn end),
         count(*)::integer
    into v_rows, v_rank, v_count
    from ranked r;

  return jsonb_build_object(
    'week_start',       v_week.start_date,
    'week_end',         v_week.end_date,
    'cohort_id',        v_co.id,
    'cohort_no',        v_co.cohort_no,
    'tier',             v_co.tier,
    'rows',             coalesce(v_rows, '[]'::jsonb),
    'members',          v_count,
    'my_weekly_points', v_pts,
    'my_rank',          v_rank,
    'note',             null);
end;
$$;

comment on function public.get_league_board() is
  'The caller''s cohort table for the ACTIVE week (doc 07 §4.4 · SCRUM-11). Ranks '
  'are derived from SUM(ledger weekly) via league_cohort_weekly_points, never '
  'from a stored score. SECURITY INVOKER (RULE B), so RLS applies to everything '
  'the caller reads directly. Always returns the SAME key set; `note` is '
  'non-null only when the caller has no cohort yet.';

-- ── EXECUTE: the app may read the board; `anon` may not ─────────────────────
revoke execute on function public.get_league_board() from public, anon;
revoke execute on function public.league_cohort_weekly_points(uuid, timestamptz, timestamptz) from public, anon;
grant  execute on function public.get_league_board() to authenticated;
grant  execute on function public.league_cohort_weekly_points(uuid, timestamptz, timestamptz) to authenticated;
