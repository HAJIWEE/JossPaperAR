-- ═══════════════════════════════════════════════════════════════════════════
-- THE ROLL BOOTSTRAPS ITSELF — the league can start from a COLD database
-- (SCRUM-115 · Sprint 2)
--
--   docker run --rm -i --network host postgres:17 psql "<url>" \
--     -v ON_ERROR_STOP=1 -q -f - < supabase/tests/league_bootstrap.sql
--
-- ⚠️ EVERY ASSERTION RAISES ON FAILURE.
-- ⚠️ FAULT-TEST IT: flip an expected status and confirm the run goes RED.
--
-- WHY THIS FILE EXISTS. `open_league_week()` is the only thing that creates a
-- `league_weeks` row, and NOTHING called it: `pg_cron` schedules
-- `roll_league_week()`, which returned `no_week` when no week existed — so the
-- Monday tick no-opped forever and the league could never start, while
-- `get_league_board()`'s note told the client the opposite ("the first roll
-- opens one"). These assertions are what make that note true, and they pin the
-- two things the fix must NOT do: rank a week it has just opened, and hand a
-- caller who named a week a DIFFERENT one.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function pg_temp.assert_true(p_ok boolean, p_name text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception '✗ FAIL: %', p_name; end if;
  raise notice '  ✓ %', p_name;
end;
$$;

do $t$
declare
  v_res    jsonb;
  v_n      bigint;
  v_before bigint;
  v_week   uuid;
begin
  -- ── fixture ─────────────────────────────────────────────────────────────
  -- ⚠️ The fixture creates AUTH USERS, not profiles: `profiles.user_id` FKs to
  -- `auth.users` and `handle_new_user` bootstraps the profile, exactly as a real
  -- anonymous sign-up does (the same shape league_roll.sql uses).
  delete from public.ledger_events where user_id::text like '00000000-0000-4000-8000-%';
  delete from public.weekly_rolls  where week_id in (select id from public.league_weeks where start_date >= '2033-05-01' and start_date < '2033-08-01');
  delete from public.cohort_members where cohort_id in (select id from public.cohorts where week_id in (select id from public.league_weeks where start_date >= '2033-05-01' and start_date < '2033-08-01'));
  delete from public.cohorts       where week_id in (select id from public.league_weeks where start_date >= '2033-05-01' and start_date < '2033-08-01');
  delete from public.league_weeks  where start_date >= '2033-05-01' and start_date < '2033-08-01';
  delete from public.integrity_flags where user_id::text like '00000000-0000-4000-8000-%';
  delete from public.profiles      where user_id::text like '00000000-0000-4000-8000-%';
  delete from auth.users           where id::text like '00000000-0000-4000-8000-%';

  insert into auth.users (id)
  select ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid
    from generate_series(1, 3) i;

  update public.profiles
     set display_label = 'B' || (right(user_id::text, 12)::bigint)::text
   where user_id::text like '00000000-0000-4000-8000-%';

  -- ── the precondition, ASSERTED rather than assumed ──────────────────────
  raise notice '── precondition: a COLD database ──────────────────────────';
  select count(*) into v_n from public.league_weeks where status = 'active';
  perform pg_temp.assert_true(v_n = 0,
    'no ACTIVE league week exists — the bootstrap branch''s condition (a leftover would hide the fix)');
  select count(*) into v_before from public.league_weeks;

  -- ── 1 · the bootstrap: the cron''s shape, with a controlled clock ────────
  -- ⚠️ `p_now` is passed explicitly so the week boundary is deterministic: Wed
  -- 2033-05-04 belongs to the ISO week that starts Mon 2033-05-02. Before this
  -- fix the parameter was declared and never read.
  raise notice '── the bootstrap: no arguments, a controlled clock ───────';
  select public.roll_league_week(null, '2033-05-04T12:00:00Z'::timestamptz) into v_res;
  perform pg_temp.assert_true(v_res->>'status' = 'bootstrapped',
    'the roll BOOTSTRAPS when no week exists (was: no_week, forever)');
  perform pg_temp.assert_true((v_res->>'rolled')::boolean is false,
    'and RANKS NOTHING — a week that has just opened has no points');
  perform pg_temp.assert_true(v_res->>'week_start' = '2033-05-02',
    'it opened the ISO week containing the roll''s own p_now (Wed 2033-05-04 → Mon 2033-05-02)');
  perform pg_temp.assert_true((select count(*) from public.league_weeks) = v_before + 1,
    'exactly ONE week was created');

  select id into v_week from public.league_weeks where start_date = '2033-05-02';
  perform pg_temp.assert_true(
    v_week is not null and (select status from public.league_weeks where id = v_week) = 'active',
    'and the opened week is ACTIVE');
  perform pg_temp.assert_true(
    (v_res->>'members_placed')::int = (select count(*) from public.cohort_members cm
                                         join public.cohorts c on c.id = cm.cohort_id
                                        where c.week_id = v_week),
    'the receipt''s members_placed matches what was really placed');

  raise notice '── the opened week is FILLED at tier 1, and nothing ranked ─';
  perform pg_temp.assert_true(
    (select count(*) from public.cohort_members cm
       join public.cohorts c on c.id = cm.cohort_id
      where c.week_id = v_week and cm.user_id::text like '00000000-0000-4000-8000-%') = 3,
    'all three fixture members are placed');
  perform pg_temp.assert_true(
    (select min(c.tier) from public.cohorts c where c.week_id = v_week) = 1,
    'the first-ever week places everyone at tier 1');
  perform pg_temp.assert_true(
    not exists (select 1 from public.cohort_members cm
                  join public.cohorts c on c.id = cm.cohort_id
                 where c.week_id = v_week and cm.outcome is not null),
    'NOTHING carries an outcome (the bootstrap does not rank)');
  perform pg_temp.assert_true(
    not exists (select 1 from public.weekly_rolls where week_id = v_week),
    'and it writes NO weekly_rolls audit row (nothing was rolled)');

  -- ── 2 · ⚠️ an EXPLICIT week is NEVER bootstrapped ────────────────────────
  -- This runs while an ACTIVE week exists on purpose: the refusal must be about
  -- the caller naming a week, not about the table happening to be empty.
  raise notice '── ⚠️ an EXPLICIT week is NEVER bootstrapped ─────────────';
  select public.roll_league_week('2033-06-01', '2033-05-04T12:00:00Z'::timestamptz) into v_res;
  perform pg_temp.assert_true(v_res->>'status' = 'no_week',
    'naming a week that does not exist still reports no_week');
  perform pg_temp.assert_true(
    (select count(*) from public.league_weeks where start_date = '2033-06-01') = 0,
    'and NO week is invented for it');
  perform pg_temp.assert_true((select count(*) from public.league_weeks) = v_before + 1,
    'and nothing else was opened either');

  -- ── 3 · once a week exists the roll ROLLS it (the bootstrap fires once) ──
  raise notice '── a real roll follows, and does NOT bootstrap again ──────';
  select public.roll_league_week(null, '2033-05-11T00:00:00Z'::timestamptz) into v_res;
  perform pg_temp.assert_true((v_res->>'rolled')::boolean,
    'with a week present the roll ROLLS (rolled=true)');
  perform pg_temp.assert_true(v_res->>'status' = 'rolled',
    'status is `rolled`, NOT `bootstrapped` a second time');
  perform pg_temp.assert_true(v_res->>'week_start' = '2033-05-02',
    'and the week it rolled is the one the bootstrap opened');
  perform pg_temp.assert_true((v_res->>'members_ranked')::int = 3, 'ranking all three members');
  perform pg_temp.assert_true((v_res->>'promoted')::jsonb = '[]'::jsonb
                          and (v_res->>'demoted')::jsonb = '[]'::jsonb,
    'nobody moves: 3 members is a SPARSE cohort (n <= promote+demote)');
  perform pg_temp.assert_true((select count(*) from public.weekly_rolls where week_id = v_week) = 1,
    'a real roll DOES write the weekly_rolls audit row');
  perform pg_temp.assert_true((select status from public.league_weeks where id = v_week) = 'closed',
    'and it closes the week it rolled');
  perform pg_temp.assert_true(
    (select status from public.league_weeks where start_date = '2033-05-09') = 'active',
    'with the next week opened and active');

  raise notice '── idempotence, unchanged by this fix ─────────────────────';
  select public.roll_league_week('2033-05-02', '2033-05-11T00:00:00Z'::timestamptz) into v_res;
  perform pg_temp.assert_true(v_res->>'status' = 'already_closed',
    'a second roll of the same week reports already_closed');

  -- ── 4 · ⚠️ the ACLs survive a `create or replace` ────────────────────────
  -- `create or replace` PRESERVES grants — which is exactly why the
  -- default-PUBLIC-grant trap (SCRUM-11: five world-executable functions) is
  -- worth asserting from the outside rather than assuming.
  raise notice '── ⚠️ the ACLs after the re-emit ──────────────────────────';
  perform pg_temp.assert_true(
    not has_function_privilege('anon', 'public.roll_league_week(date, timestamptz)', 'execute'),
    'anon has NO execute on roll_league_week');
  perform pg_temp.assert_true(
    not has_function_privilege('authenticated', 'public.roll_league_week(date, timestamptz)', 'execute'),
    'authenticated has NO execute on roll_league_week');
  perform pg_temp.assert_true(
    has_function_privilege('service_role', 'public.roll_league_week(date, timestamptz)', 'execute'),
    'service_role DOES');
  perform pg_temp.assert_true(
    not has_function_privilege('authenticated', 'public.open_league_week(date)', 'execute'),
    'and the function the bootstrap CALLS keeps its own posture');

  -- ── teardown ────────────────────────────────────────────────────────────
  raise notice '── teardown ───────────────────────────────────────────────';
  delete from public.ledger_events where user_id::text like '00000000-0000-4000-8000-%';
  delete from public.weekly_rolls where week_id in (select id from public.league_weeks where start_date >= '2033-05-01' and start_date < '2033-08-01');
  delete from public.cohort_members where cohort_id in (select id from public.cohorts where week_id in (select id from public.league_weeks where start_date >= '2033-05-01' and start_date < '2033-08-01'));
  delete from public.cohorts where week_id in (select id from public.league_weeks where start_date >= '2033-05-01' and start_date < '2033-08-01');
  delete from public.league_weeks where start_date >= '2033-05-01' and start_date < '2033-08-01';
  delete from public.integrity_flags where user_id::text like '00000000-0000-4000-8000-%';
  delete from public.profiles where user_id::text like '00000000-0000-4000-8000-%';
  delete from auth.users where id::text like '00000000-0000-4000-8000-%';
  perform pg_temp.assert_true(
    (select count(*) from public.league_weeks where start_date >= '2033-05-01' and start_date < '2033-08-01') = 0
    and (select count(*) from public.profiles where user_id::text like '00000000-0000-4000-8000-%') = 0,
    'fixtures removed');
end;
$t$;

select '✓ league bootstrap: all assertions passed' as result;
