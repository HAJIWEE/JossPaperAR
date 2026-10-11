-- ═══════════════════════════════════════════════════════════════════════════
-- THE ROLL ENGINE — asserted against a REAL database (SCRUM-11 step 2)
--
--   docker exec -i supabase_db_<project> psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -q -f - < supabase/tests/league_roll.sql
--
-- ⚠️ EVERY ASSERTION RAISES ON FAILURE.
-- ⚠️ FAULT-TEST IT: change an expected number and confirm the run goes RED.
--
-- The fixture is THREE cohorts in one week, chosen so every branch of the roll's
-- CASE is exercised:
--   A · tier 3, 8 members  -> 3 promoted, 3 demoted, 2 held   (the happy path)
--   B · tier 2, 4 members  -> 4 held  (a SPARSE cohort moves nobody)
--   C · tier 4, 8 members, one with > 346,500  -> flagged AND held, never paid
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function pg_temp.assert_true(p_ok boolean, p_name text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception '✗ FAIL: %', p_name; end if;
  raise notice '  ✓ %', p_name;
end;
$$;

create or replace function pg_temp.expect_error(p_sql text, p_name text)
returns text language plpgsql as $$
begin
  begin execute p_sql; exception when others then return sqlstate; end;
  raise exception '✗ FAIL: % — expected an error, but the statement SUCCEEDED', p_name;
end;
$$;

do $t$
declare
  v_week  uuid;
  v_res   jsonb;
  v_n     bigint;
  v_tier  integer;
  v_out   text;
  v_pts   bigint;
  v_rolls bigint;
  v_err   text;
  u       uuid;
begin
  -- ── fixture ─────────────────────────────────────────────────────────────
  delete from public.ledger_events where user_id::text like '00000000-0000-4000-8000-%';
  delete from public.weekly_rolls  where week_id in (select id from public.league_weeks where start_date >= '2032-03-01' and start_date < '2032-04-01');
  delete from public.cohort_members where cohort_id in (select id from public.cohorts where week_id in (select id from public.league_weeks where start_date >= '2032-03-01' and start_date < '2032-04-01'));
  delete from public.cohorts       where week_id in (select id from public.league_weeks where start_date >= '2032-03-01' and start_date < '2032-04-01');
  delete from public.league_weeks  where start_date >= '2032-03-01' and start_date < '2032-04-01';
  delete from public.integrity_flags where user_id::text like '00000000-0000-4000-8000-%';
  delete from public.profiles      where user_id::text like '00000000-0000-4000-8000-%';
  delete from auth.users            where id::text like '00000000-0000-4000-8000-%';

  -- ⚠️ `profiles.user_id` FKs to `auth.users`, and the `handle_new_user`
  -- trigger creates the profile — so the fixture creates the AUTH USER and lets
  -- the real trigger bootstrap the profile, exactly as a real anonymous
  -- sign-up does. Inserting into `profiles` directly is impossible, which is
  -- the foreign key doing its job rather than an obstacle to work around.
  insert into auth.users (id)
  select ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid
    from generate_series(1, 20) i;

  update public.profiles
     set display_label = 'T' || (right(user_id::text, 12)::bigint)::text
   where user_id::text like '00000000-0000-4000-8000-%';

  -- one ledger row each: points == amount, so ranks are deterministic
  insert into public.ledger_events (user_id, seq, currency, type, amount, actor, created_at, idempotency_key)
  select ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, i, 'tribute', 'award',
         case when i = 20 then 400000 else i * 100 end, 'test',
         '2032-03-03T12:00:00Z'::timestamptz, 'league-test-' || i
    from generate_series(1, 20) i;

  insert into public.league_weeks (start_date, end_date, status)
  values ('2032-03-01', '2032-03-07', 'active') returning id into v_week;

  insert into public.cohorts (week_id, tier, cohort_no) values (v_week, 3, 1);
  insert into public.cohorts (week_id, tier, cohort_no) values (v_week, 2, 1);
  insert into public.cohorts (week_id, tier, cohort_no) values (v_week, 4, 1);

  insert into public.cohort_members (cohort_id, user_id, display_label, weekly_points)
  select c.id, ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'T' || i, 7
    from generate_series(1, 8) i, public.cohorts c
   where c.week_id = v_week and c.tier = 3;
  insert into public.cohort_members (cohort_id, user_id, display_label, weekly_points)
  select c.id, ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'T' || i, 7
    from generate_series(9, 12) i, public.cohorts c
   where c.week_id = v_week and c.tier = 2;
  insert into public.cohort_members (cohort_id, user_id, display_label, weekly_points)
  select c.id, ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'T' || i, 7
    from generate_series(13, 20) i, public.cohorts c
   where c.week_id = v_week and c.tier = 4;

  -- ⚠️ the cache is seeded WRONG (7 for everyone) on purpose: the roll must
  -- recompute from the LEDGER, so if it trusted the cache every assertion below
  -- would fail. This is what proves doc 07 §4.4's "never a stored mutable score".

  raise notice '── the roll ────────────────────────────────────────────────';
  select public.roll_league_week('2032-03-01') into v_res;
  perform pg_temp.assert_true((v_res->>'rolled')::boolean, 'the roll reports rolled=true');
  perform pg_temp.assert_true((v_res->>'members_ranked')::int = 20, 'it ranked all 20 members');
  perform pg_temp.assert_true((v_res->>'cohorts_ranked')::int = 3, 'across all 3 cohorts');

  raise notice '── the points cache is recomputed FROM THE LEDGER ─────────';
  select weekly_points into v_pts from public.cohort_members cm
    join public.cohorts c on c.id = cm.cohort_id
   where c.week_id = v_week and cm.display_label = 'T1';
  perform pg_temp.assert_true(v_pts = 100, 'T1 recomputed to its ledger sum (100), NOT the seeded 7');

  raise notice '── cohort A (tier 3, n=8): 3 up, 3 down, 2 held ───────────';
  select cm.rank, cm.outcome into v_n, v_out from public.cohort_members cm
    join public.cohorts c on c.id = cm.cohort_id
   where c.week_id = v_week and cm.display_label = 'T8';
  perform pg_temp.assert_true(v_n = 1 and v_out = 'promoted', 'the top scorer is rank 1 and promoted');
  select cm.outcome into v_out from public.cohort_members cm
    join public.cohorts c on c.id = cm.cohort_id
   where c.week_id = v_week and cm.display_label = 'T1';
  perform pg_temp.assert_true(v_out = 'demoted', 'the bottom scorer is demoted');
  select count(*) into v_n from public.cohort_members cm
    join public.cohorts c on c.id = cm.cohort_id
   where c.week_id = v_week and c.tier = 3 and cm.outcome = 'promoted';
  perform pg_temp.assert_true(v_n = 3, 'exactly THREE promoted in cohort A');
  select count(*) into v_n from public.cohort_members cm
    join public.cohorts c on c.id = cm.cohort_id
   where c.week_id = v_week and c.tier = 3 and cm.outcome = 'held';
  perform pg_temp.assert_true(v_n = 2, 'and exactly TWO held');

  raise notice '── cohort B (tier 2, n=4): a SPARSE cohort moves NOBODY ───';
  select count(*) into v_n from public.cohort_members cm
    join public.cohorts c on c.id = cm.cohort_id
   where c.week_id = v_week and c.tier = 2 and cm.outcome <> 'held';
  perform pg_temp.assert_true(v_n = 0, 'n=4 <= promote+demote, so nobody is promoted or demoted');

  raise notice '── cohort C: the impossible score is FLAGGED, never paid ──';
  select cm.outcome into v_out from public.cohort_members cm
    join public.cohorts c on c.id = cm.cohort_id
   where c.week_id = v_week and cm.display_label = 'T20';
  perform pg_temp.assert_true(v_out = 'held', 'a 400,000-point week is HELD, not promoted');
  perform pg_temp.assert_true((v_res->>'impossible_scores')::int = 1, 'and counted in the receipt');
  select count(*) into v_n from public.integrity_flags
   where signal = 'impossible_weekly_tribute' and user_id::text like '00000000-0000-4000-8000-%';
  perform pg_temp.assert_true(v_n = 1, 'and written to integrity_flags (doc 11 §6.1)');
  select count(*) into v_n from public.cohort_members cm
    join public.cohorts c on c.id = cm.cohort_id
   where c.week_id = v_week and c.tier = 4 and cm.outcome = 'promoted';
  perform pg_temp.assert_true(v_n = 3, 'and three others still promote (ranks 2-4)');

  raise notice '── the audit row + the closed week ────────────────────────';
  select count(*) into v_rolls from public.weekly_rolls where week_id = v_week;
  perform pg_temp.assert_true(v_rolls = 1, 'one weekly_rolls audit row');
  select array_length(promoted, 1), array_length(demoted, 1) into v_n, v_pts
    from public.weekly_rolls where week_id = v_week;
  perform pg_temp.assert_true(v_n = 6 and v_pts = 6, '6 promoted and 6 demoted across the week');
  perform pg_temp.assert_true(
    (select status from public.league_weeks where id = v_week) = 'closed', 'the week is closed');

  raise notice '── the next week is opened and FILLED at 30 ───────────────';
  perform pg_temp.assert_true(
    (select status from public.league_weeks where start_date = '2032-03-08') = 'active',
    'the next week exists and is active');
  perform pg_temp.assert_true((v_res->>'members_placed_next')::int = 20, 'and all 20 members carried forward');

  raise notice '── the tier is CARRIED and moved by the outcome ───────────';
  select c.tier into v_tier from public.cohort_members cm
    join public.cohorts c on c.id = cm.cohort_id
    join public.league_weeks w on w.id = c.week_id
   where w.start_date = '2032-03-08' and cm.display_label = 'T8';
  perform pg_temp.assert_true(v_tier = 4, 'promoted T8 (tier 3) is now tier 4');
  select c.tier into v_tier from public.cohort_members cm
    join public.cohorts c on c.id = cm.cohort_id
    join public.league_weeks w on w.id = c.week_id
   where w.start_date = '2032-03-08' and cm.display_label = 'T1';
  perform pg_temp.assert_true(v_tier = 2, 'demoted T1 (tier 3) is now tier 2');
  select c.tier into v_tier from public.cohort_members cm
    join public.cohorts c on c.id = cm.cohort_id
    join public.league_weeks w on w.id = c.week_id
   where w.start_date = '2032-03-08' and cm.display_label = 'T4';
  perform pg_temp.assert_true(v_tier = 3, 'held T4 stays at tier 3');

  raise notice '── idempotence: a second roll cannot move anyone again ───';
  select public.roll_league_week('2032-03-01') into v_res;
  perform pg_temp.assert_true(v_res->>'status' = 'already_closed', 'a second roll reports already_closed');
  perform pg_temp.assert_true(
    (select count(*) from public.weekly_rolls where week_id = v_week) = 1,
    'and writes NO second audit row');

  raise notice '── a client cannot trigger a roll ─────────────────────────';
  perform pg_temp.assert_true(
    not has_function_privilege('authenticated', 'public.roll_league_week(date, timestamptz)', 'execute'),
    'authenticated has NO execute on roll_league_week');
  perform pg_temp.assert_true(
    has_function_privilege('service_role', 'public.roll_league_week(date, timestamptz)', 'execute'),
    'service_role DOES');

  raise notice '── teardown ───────────────────────────────────────────────';
  delete from public.ledger_events where user_id::text like '00000000-0000-4000-8000-%';
  delete from public.weekly_rolls where week_id in (select id from public.league_weeks where start_date >= '2032-03-01' and start_date < '2032-04-01');
  delete from public.cohort_members where cohort_id in (select id from public.cohorts where week_id in (select id from public.league_weeks where start_date >= '2032-03-01' and start_date < '2032-04-01'));
  delete from public.cohorts where week_id in (select id from public.league_weeks where start_date >= '2032-03-01' and start_date < '2032-04-01');
  delete from public.league_weeks where start_date >= '2032-03-01' and start_date < '2032-04-01';
  delete from public.integrity_flags where user_id::text like '00000000-0000-4000-8000-%';
  delete from public.profiles where user_id::text like '00000000-0000-4000-8000-%';
  delete from auth.users where id::text like '00000000-0000-4000-8000-%';
  perform pg_temp.assert_true(
    (select count(*) from public.profiles where user_id::text like '00000000-0000-4000-8000-%') = 0,
    'fixtures removed');
end;
$t$;

select '✓ league roll engine: all assertions passed' as result;
