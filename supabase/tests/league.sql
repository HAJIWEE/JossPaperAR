-- ═══════════════════════════════════════════════════════════════════════════
-- LEAGUE SCHEMA — asserted against a REAL database (SCRUM-11, step 1)
--
-- The executable form of what `20261011120000_league_schema.sql` CLAIMS, so the
-- claims are green or red rather than reviewed.
--
-- ── HOW TO RUN IT ───────────────────────────────────────────────────────────
-- No local `psql` on the host and no `supabase query` subcommand, so:
--   docker exec -i supabase_db_<project> psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -q -f - < supabase/tests/league.sql
-- (or as a throwaway migration: db push → rm → migration repair --status reverted)
--
-- ⚠️ EVERY ASSERTION RAISES ON FAILURE.
-- ⚠️ FAULT-TEST IT: change a CHECK below and confirm the run goes RED. A check
--    that cannot fail is not a check.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function pg_temp.assert_true(p_ok boolean, p_name text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then
    raise exception '✗ FAIL: %', p_name;
  end if;
  raise notice '  ✓ %', p_name;
end;
$$;

-- Runs p_sql and returns the SQLSTATE it raised; FAILS if it did NOT raise.
create or replace function pg_temp.expect_error(p_sql text, p_name text)
returns text language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    return sqlstate;
  end;
  raise exception '✗ FAIL: % — expected an error, but the statement SUCCEEDED', p_name;
end;
$$;

-- $t$ tag, not $$: the body contains $$ strings and would terminate early.
do $t$
declare
  v_week uuid; v_co uuid; v_co2 uuid; v_u uuid; v_err text; v_n bigint;
begin
  delete from public.league_weeks where start_date = '2031-01-06';

  raise notice '── league_weeks ─────────────────────────────────────────────';

  insert into public.league_weeks (start_date, end_date)
  values ('2031-01-06', '2031-01-12') returning id into v_week;

  perform pg_temp.assert_true(
    (select status from public.league_weeks where id = v_week) = 'active',
    'a week opens and status defaults to active');

  v_err := pg_temp.expect_error(
    $$insert into public.league_weeks (start_date, end_date)
      values ('2031-01-06', '2031-01-12')$$,
    'a SECOND week with the same start_date is rejected');
  perform pg_temp.assert_true(v_err = '23505', '  ... UNIQUE violation 23505 (got ' || v_err || ')');

  v_err := pg_temp.expect_error(
    $$insert into public.league_weeks (start_date, end_date, status)
      values ('2031-01-13', '2031-01-19', 'finished')$$,
    'an unknown status is rejected');
  perform pg_temp.assert_true(v_err = '23514', '  ... CHECK violation 23514 (got ' || v_err || ')');

  v_err := pg_temp.expect_error(
    $$insert into public.league_weeks (start_date, end_date)
      values ('2031-01-20', '2031-01-20')$$,
    'end_date must be strictly after start_date');

  raise notice '── cohorts ─────────────────────────────────────────────────';

  insert into public.cohorts (week_id, tier) values (v_week, 1) returning id into v_co;

  v_err := pg_temp.expect_error(
    format('insert into public.cohorts (week_id, tier) values (%L, 0)', v_week),
    'tier is a rung, and 0 is not a rung');

  insert into public.cohorts (week_id, tier) values (v_week, 1) returning id into v_co2;
  perform pg_temp.assert_true(v_co <> v_co2,
    'a tier MAY hold several cohorts — (week_id, tier) is not unique');

  raise notice '── cohort_members: the tombstone rule ──────────────────────';

  v_u := gen_random_uuid();
  insert into public.cohort_members (cohort_id, user_id, display_label, weekly_points, rank)
  values (v_co, v_u, 'living member', 1234, 1);

  -- ⚠️ THE SUBTLE ONE. `unique (cohort_id, user_id)` must NOT block many NULL
  -- user_ids, because deleting an account tombstones the row to NULL. Postgres
  -- treats NULLs as distinct in a unique index — asserted here rather than
  -- assumed, because if it were false the delete path would break the league.
  insert into public.cohort_members (cohort_id, user_id, display_label)
  values (v_co, null, '已注销 · deleted'), (v_co, null, '已注销 · deleted');
  select count(*) into v_n from public.cohort_members
   where cohort_id = v_co and user_id is null;
  perform pg_temp.assert_true(v_n = 2,
    'TWO tombstoned members with NULL user_id coexist (the tombstone rule works)');

  v_err := pg_temp.expect_error(
    format('insert into public.cohort_members (cohort_id, user_id, display_label) values (%L, %L, ''twice'')', v_co, v_u),
    'the same LIVE user cannot appear twice in one cohort');

  v_err := pg_temp.expect_error(
    format('insert into public.cohort_members (cohort_id, display_label, weekly_points) values (%L, ''neg'', -1)', v_co),
    'negative weekly_points are rejected');

  v_err := pg_temp.expect_error(
    format('insert into public.cohort_members (cohort_id, display_label, rank) values (%L, ''zeroth'', 0)', v_co),
    'rank 0 is rejected (rank starts at 1)');

  v_err := pg_temp.expect_error(
    format('insert into public.cohort_members (cohort_id, display_label, outcome) values (%L, ''winner'', ''won'')', v_co),
    'an unknown outcome is rejected');

  v_err := pg_temp.expect_error(
    $$insert into public.cohort_members (cohort_id, display_label) values (gen_random_uuid(), 'orphan')$$,
    'a member cannot belong to a cohort that does not exist');

  raise notice '── RLS: the app is READ-ONLY; the roll is the only writer ──';

  set local role authenticated;
  select count(*) into v_n from public.cohort_members where cohort_id = v_co;
  perform pg_temp.assert_true(v_n = 3, 'an authenticated client CAN read the board');

  begin
    insert into public.cohort_members (cohort_id, display_label) values (v_co, 'client write');
    raise exception '✗ FAIL: an authenticated client INSERTED into cohort_members';
  exception
    when insufficient_privilege then raise notice '  ✓ ... but CANNOT insert (42501)';
    when others then
      if sqlerrm like '✗ FAIL%' then raise; end if;
      raise notice '  ✓ ... but CANNOT insert (%)', sqlstate;
  end;
  reset role;

  raise notice '── teardown ────────────────────────────────────────────────';
  delete from public.league_weeks where start_date = '2031-01-06';
  perform pg_temp.assert_true(
    (select count(*) from public.cohort_members where cohort_id = v_co) = 0,
    'deleting the week CASCADED through cohorts to cohort_members');
end;
$t$;

select '✓ league schema: all assertions passed' as result;
