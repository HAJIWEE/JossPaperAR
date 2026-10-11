-- ═══════════════════════════════════════════════════════════════════════════
-- THE STREAK SPEC, ASSERTED (SCRUM-11 step 4 · doc 22)
--
--   docker exec -i supabase_db_<project> psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -q -f - < supabase/tests/streak_spec.sql
--
-- ⚠️ doc 22 §2 states FIVE rules. This drives EVERY ONE of them through the real
-- `submit_burn` against a real database, so the document and this file are two
-- statements of the same thing and a run fails if they part.
--
-- ⚠️ The day boundary is the SERVER's UTC day and a test cannot move it, so each
-- continuation case SEEDS `streaks.last_burn_date` relative to that day — which
-- is exactly how the code reads it.
-- ⚠️ FAULT-TEST IT: change an expected award and confirm the run goes RED.
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
  v_u     uuid := '00000000-0000-4000-8000-000000000901';
  v_day   date := (now() at time zone 'utc')::date;
  v_clan  uuid;
  v_cap   uuid;
  v_r     jsonb;
  v_days  integer;
  v_last  date;
  v_bs    smallint;
  i       integer;
begin
  -- ── fixture ─────────────────────────────────────────────────────────────
  delete from public.ledger_events where user_id = v_u;
  delete from public.cell_burns    where user_id = v_u;
  delete from public.burns         where user_id = v_u;
  delete from public.captures      where user_id = v_u;
  delete from public.clan_members  where user_id = v_u;
  delete from public.clans         where created_by = v_u;
  delete from public.streaks       where user_id = v_u;
  delete from public.profiles      where user_id = v_u;
  delete from auth.users           where id = v_u;

  insert into auth.users (id) values (v_u);
  update public.profiles set display_label = 'STREAK' where user_id = v_u;
  insert into public.clans (name, code, created_by)
    values ('Streak Test', 'STREAKTX', v_u) returning id into v_clan;
  insert into public.clan_members (clan_id, user_id, role) values (v_clan, v_u, 'head');

  for i in 1..6 loop
    insert into public.captures (user_id, storage_path, status)
    values (v_u, v_u::text || '/streak-' || i || '.jpg', 'styled');
  end loop;

  -- ── 1 · FIRST EVER BURN — day 1, and day 1 is NOT a streak ──────────────
  delete from public.streaks where user_id = v_u;
  select id into v_cap from public.captures
   where user_id = v_u and id not in (select capture_id from public.burns
                                       where user_id = v_u and capture_id is not null)
   order by id limit 1;
  v_r := public.submit_burn(v_u, jsonb_build_object(
           'capture_id', v_cap, 'clan_id', v_clan, 'accuracy', 0,
           'cell_hash', 'streakA', 'client_time', now()), 'streak-key-1');
  perform pg_temp.assert_true((v_r->>'streak_day')::int = 1,
    'doc 22 §2 · no row yet -> streak_day = 1');
  perform pg_temp.assert_true((v_r->>'award')::int = 1600,
    'doc 22 §2.2 · day 1 is NOT active, so NO +50 (got ' || (v_r->>'award') || ')');

  -- ── 2 · THE SAME SERVER DAY AGAIN — unchanged, still not a streak ───────
  select id into v_cap from public.captures
   where user_id = v_u and id not in (select capture_id from public.burns
                                       where user_id = v_u and capture_id is not null)
   order by id limit 1;
  v_r := public.submit_burn(v_u, jsonb_build_object(
           'capture_id', v_cap, 'clan_id', v_clan, 'accuracy', 0,
           'cell_hash', 'streakB', 'client_time', now()), 'streak-key-2');
  perform pg_temp.assert_true((v_r->>'streak_day')::int = 1,
    'doc 22 §2.1 · a second burn the same day does NOT advance the streak');
  perform pg_temp.assert_true((v_r->>'award')::int = 1600,
    'doc 22 §2.1 · and it does not reset it either (still no +50)');

  -- ── 3 · YESTERDAY → TODAY CONTINUES, and the bonus turns on ─────────────
  update public.streaks set current_days = 1, last_burn_date = v_day - 1
   where user_id = v_u;
  select id into v_cap from public.captures
   where user_id = v_u and id not in (select capture_id from public.burns
                                       where user_id = v_u and capture_id is not null)
   order by id limit 1;
  v_r := public.submit_burn(v_u, jsonb_build_object(
           'capture_id', v_cap, 'clan_id', v_clan, 'accuracy', 0,
           'cell_hash', 'streakC', 'client_time', now()), 'streak-key-3');
  perform pg_temp.assert_true((v_r->>'streak_day')::int = 2,
    'doc 22 §2 · yesterday -> today gives current_days + 1 = 2');
  perform pg_temp.assert_true((v_r->>'award')::int = 1650,
    'doc 22 §2 · day 2 IS active, so the +50 lands: 1,600 + 50 (got ' || (v_r->>'award') || ')');

  -- ── 4 · A GAP RESETS TO 1 — never to 0 ─────────────────────────────────
  update public.streaks set current_days = 5, last_burn_date = v_day - 2
   where user_id = v_u;
  select id into v_cap from public.captures
   where user_id = v_u and id not in (select capture_id from public.burns
                                       where user_id = v_u and capture_id is not null)
   order by id limit 1;
  v_r := public.submit_burn(v_u, jsonb_build_object(
           'capture_id', v_cap, 'clan_id', v_clan, 'accuracy', 0,
           'cell_hash', 'streakD', 'client_time', now()), 'streak-key-4');
  perform pg_temp.assert_true((v_r->>'streak_day')::int = 1,
    'doc 22 §3 · a 2-day gap RESETS to 1, not to 0');
  perform pg_temp.assert_true((v_r->>'award')::int = 1600,
    'doc 22 §3 · and a reset chain is not yet active, so no +50');

  -- ── 5 · A MISS LEAVES `streaks` COMPLETELY UNTOUCHED ────────────────────
  --    ⚠️ The property that was NOWHERE WRITTEN DOWN before doc 22 §2.3.
  update public.streaks set current_days = 9, last_burn_date = v_day - 1
   where user_id = v_u;
  select id into v_cap from public.captures
   where user_id = v_u and id not in (select capture_id from public.burns
                                       where user_id = v_u and capture_id is not null)
   order by id limit 1;
  v_r := public.submit_burn(v_u, jsonb_build_object(
           'capture_id', v_cap, 'clan_id', v_clan, 'accuracy', 500,
           'cell_hash', 'streakE', 'client_time', now()), 'streak-key-5');
  perform pg_temp.assert_true(v_r->>'band' = 'miss',
    'doc 22 §2.3 · accuracy 500 grades as a miss (the fixture is what a miss is)');
  perform pg_temp.assert_true((v_r->>'streak_day')::int = 0,
    'doc 22 §2.3 · a miss reports streak_day 0');
  perform pg_temp.assert_true((v_r->>'award')::int = 0, 'doc 22 §2.3 · and mints nothing');

  select streak_day into v_bs from public.burns
   where user_id = v_u and idempotency_key = 'streak-key-5';
  perform pg_temp.assert_true(v_bs is null,
    'doc 22 §1 · the burn row stores NULL, which is how a miss is recorded');

  select current_days, last_burn_date into v_days, v_last
    from public.streaks where user_id = v_u;
  perform pg_temp.assert_true(v_days = 9,
    '⚠️ doc 22 §2.3 · a miss does NOT advance the streak (still 9, got ' || v_days || ')');
  perform pg_temp.assert_true(v_last = v_day - 1,
    '⚠️ doc 22 §2.3 · and does NOT break it either — last_burn_date is untouched');

  -- ── teardown ────────────────────────────────────────────────────────────
  delete from public.ledger_events where user_id = v_u;
  delete from public.cell_burns    where user_id = v_u;
  delete from public.burns         where user_id = v_u;
  delete from public.captures      where user_id = v_u;
  delete from public.clan_members  where user_id = v_u;
  delete from public.clans         where created_by = v_u;
  delete from public.streaks       where user_id = v_u;
  delete from public.profiles      where user_id = v_u;
  delete from auth.users           where id = v_u;
  perform pg_temp.assert_true(
    (select count(*) from public.burns where user_id = v_u) = 0, 'fixtures removed');
end;
$t$;

select '✓ the streak spec: every doc 22 §2/§3 claim holds' as result;
