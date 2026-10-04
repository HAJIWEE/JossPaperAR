-- ═══════════════════════════════════════════════════════════════════════════
-- SCRUM-59 VERIFICATION — the global AI-budget STOP-RULE, against a real database
--
-- Run it the same way as `pr3_verification.sql` (there is no local `psql` and the
-- CLI has no `query` subcommand, so the CLI's own migration path is the runner —
-- see that file's header for the three commands).
--
-- ── WHAT IT PROVES (each assertion RAISES, so the run is green or red) ──────
--   S1  the seeded alpha budget reads back ($5/day = 5,000,000 micros)
--   S2  a spend of zero is derived correctly, and a recorded cost raises it
--   S3  an EXHAUSTED budget leaves the job QUEUED and calls nothing — and
--       writing NO cost is what makes that verifiable
--   S4  a second request for the same capture re-checks and neither duplicates
--       the job nor re-spends (unique(capture_id) is doing its job)
--   S5  once the budget opens, the SAME capture proceeds — queue, never fail
--   S6  the daily allowance counts only jobs that RAN: a stop-rule-parked job
--       must not burn one of the user's ten attempts
--   S7  the allowance itself still bites at 10
--
-- ── ⚠️ IT IS ROBUST TO PRE-EXISTING DATA ───────────────────────────────────
-- The budget is global and the hosted project is live, so the test never
-- assumes today's spend is zero: it sets the budget RELATIVE to the current
-- spend (blocked = spend, open = spend + 1,000,000). The teardown RESTORES the
-- budget to the seeded $5/day — if it did not, a failed run would leave every
-- user locked out, which is exactly the kind of residue this file must not have.
--
-- ⚠️ FAULT-TEST IT: flip the stop-rule's `>` to `>=` in `request_cartoonize` and
-- confirm S5b goes RED — or set `c_min_remaining_micros := 0` and watch S5b fail
-- from the other side. A harness that cannot fail is not a check.
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

create or replace function pg_temp.count_where(p_sql text)
returns bigint language plpgsql as $$
declare v_n bigint;
begin
  execute p_sql into v_n;
  return v_n;
end;
$$;

-- Sets the daily budget, reporting nothing (the assertions read it back).
create or replace function pg_temp.set_budget(p_micros bigint)
returns void language plpgsql as $$
begin
  update public.app_config
     set value = to_jsonb(p_micros), updated_at = now()
   where key = 'daily_ai_budget_micros';
end;
$$;

-- Runs p_sql and returns the error it raised; FAILS if it did not raise.
create or replace function pg_temp.expect_error(p_sql text, p_name text)
returns text language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    return sqlstate || ' · ' || sqlerrm;
  end;
  raise exception '✗ FAIL: % — expected an error, but the statement succeeded', p_name;
end;
$$;

-- Calls the gate WITHOUT tripping the 3/min burst limit that guards it: this
-- file makes more requests in one transaction than a real user could in one
-- minute, so it clears the actor's window first. (The limiter has its own
-- coverage in pr3_verification.sql — it is not what is under test here.)
create or replace function pg_temp.call_cartoonize(p_actor uuid, p_capture uuid)
returns jsonb language plpgsql as $$
begin
  delete from public.rate_counters where user_id = p_actor;
  return public.request_cartoonize(p_actor, p_capture);
end;
$$;

-- ═══ FIXTURES ═════════════════════════════════════════════════════════════
do $setup$
declare
  v_u1 uuid := '33333333-3333-3333-3333-333333333333';
begin
  -- pre-clean, so a re-run after a failed attempt is safe
  delete from public.profiles where user_id = v_u1;   -- cascades captures → jobs
  delete from auth.users      where id      = v_u1;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'scrum59@example.invalid', '', now(),
    '{"provider":"anonymous","providers":["anonymous"]}', '{}', now(), now()
  );

  raise notice 'setup: one anonymous user (the profile bootstrap should fire)';
end
$setup$;

-- ═══ THE STOP-RULE, AS THE OWNER ══════════════════════════════════════════
do $svc$
declare
  v_u1     uuid := '33333333-3333-3333-3333-333333333333';
  v_cap1   uuid;
  v_cap2   uuid;
  v_cap3   uuid;
  v_before bigint;
  v_after  bigint;
  v_r      jsonb;
  v_err    text;
  i        integer;
begin
  -- ── S1 · the seeded alpha budget ────────────────────────────────────────
  perform pg_temp.assert_true(public.ai_budget_micros() = 5_000_000,
    'S1  the seeded alpha budget reads back as $5/day (5,000,000 micros)');

  -- ── S2 · the spend derivation ───────────────────────────────────────────
  v_before := public.ai_spend_today();
  insert into public.captures (id, user_id, storage_path, status)
  values (gen_random_uuid(), v_u1, v_u1 || '/probe.jpg', 'pending')
  returning id into v_cap1;
  insert into public.cartoonize_jobs (capture_id, provider, style, status, cost_micros)
  values (v_cap1, 'fal', 'D', 'styled', 1_234_567);
  v_after := public.ai_spend_today();
  perform pg_temp.assert_true(v_after - v_before = 1_234_567,
    'S2  a recorded cost raises the day''s spend by exactly that amount');
  delete from public.cartoonize_jobs where capture_id = v_cap1;
  delete from public.captures where id = v_cap1;

  -- ── S3 · an exhausted budget QUEUES and spends nothing ──────────────────
  insert into public.captures (id, user_id, storage_path, status)
  values (gen_random_uuid(), v_u1, v_u1 || '/a.jpg', 'pending')
  returning id into v_cap1;

  perform pg_temp.set_budget(public.ai_spend_today());   -- blocked, whatever the spend is
  v_r := pg_temp.call_cartoonize(v_u1, v_cap1);
  perform pg_temp.assert_true((v_r->>'budget_exhausted')::boolean = true,
    'S3  an exhausted budget reports budget_exhausted');
  perform pg_temp.assert_true(v_r->>'status' = 'queued',
    'S3  the job is left QUEUED — queue, never fail');
  perform pg_temp.assert_true(
    (select count(*) from public.cartoonize_jobs where capture_id = v_cap1 and status = 'queued') = 1,
    'S3  the queued job row exists, so the offering is not lost');
  perform pg_temp.assert_true(
    (select cost_micros from public.cartoonize_jobs where capture_id = v_cap1) is null,
    'S3  NO cost was recorded — nothing was called (this is what a stop-rule must prove)');

  -- ── S4 · a second request neither duplicates nor re-spends ──────────────
  v_r := pg_temp.call_cartoonize(v_u1, v_cap1);
  perform pg_temp.assert_true((v_r->>'budget_exhausted')::boolean = true,
    'S4  a second request while exhausted is still blocked');
  perform pg_temp.assert_true(
    (select count(*) from public.cartoonize_jobs where capture_id = v_cap1) = 1,
    'S4  …and there is still exactly ONE job row (unique(capture_id) holds)');

  -- ── S5 · QUEUE, NEVER FAIL: open the budget → the SAME capture proceeds ─
  perform pg_temp.set_budget(public.ai_spend_today() + 1_000_000);
  v_r := pg_temp.call_cartoonize(v_u1, v_cap1);
  perform pg_temp.assert_true((v_r->>'budget_exhausted')::boolean = false,
    'S5  once the budget opens, the same capture PROCEEDS (queue, never fail)');
  perform pg_temp.assert_true((v_r->>'already_requested')::boolean = true,
    'S5  the parked job is REUSED — the retry created no new state');
  perform pg_temp.assert_true(
    (select count(*) from public.cartoonize_jobs where capture_id = v_cap1) = 1,
    'S5  …and still exactly one job row');
  perform pg_temp.assert_true(v_r ? 'spend_micros_today' and v_r ? 'budget_micros',
    'S5  the receipt carries the numbers an operator needs to explain the state');

  -- ── S5b · doc 10 §4's $0.10 FLOOR — the budget is a HARD ceiling ────────
  -- The spec's rule is `assert global.ai_budget_today_usd >= 0.10`: the question
  -- is "can the shrine still afford one more photo?", so $0.099999 of headroom
  -- must QUEUE and exactly $0.10 must proceed. This is also the boundary a
  -- "tidy-up" of the comparison would silently break.
  insert into public.captures (id, user_id, storage_path, status)
  values (gen_random_uuid(), v_u1, v_u1 || '/floor.jpg', 'pending')
  returning id into v_cap2;

  perform pg_temp.set_budget(public.ai_spend_today() + 99_999);
  v_r := pg_temp.call_cartoonize(v_u1, v_cap2);
  perform pg_temp.assert_true((v_r->>'budget_exhausted')::boolean = true,
    'S5b $0.099999 of headroom is NOT enough for a $0.09 photo — queued, not started');

  perform pg_temp.set_budget(public.ai_spend_today() + 100_000);
  v_r := pg_temp.call_cartoonize(v_u1, v_cap2);
  perform pg_temp.assert_true((v_r->>'budget_exhausted')::boolean = false,
    'S5b the floor is INCLUSIVE — exactly $0.10 of headroom proceeds (spec: `>= 0.10`)');

  -- ── S6 · the allowance counts only jobs that RAN ────────────────────────
  -- Nine jobs that actually ran, PLUS the jobs parked by the stop-rule (S3, S5b).
  -- If the parked jobs were counted, the ten slots would be gone and the next
  -- request would be refused — which is precisely what this asserts does NOT
  -- happen (with the parked ones counted the user sits on 11 jobs, not 9).
  for i in 1..9 loop
    insert into public.captures (id, user_id, storage_path, status)
    values (gen_random_uuid(), v_u1, v_u1 || '/ran' || i || '.jpg', 'pending')
    returning id into v_cap2;

    insert into public.cartoonize_jobs (capture_id, provider, style, status, cost_micros)
    values (v_cap2, 'fal', 'D', 'styled', 90_000);
  end loop;

  perform pg_temp.set_budget(public.ai_spend_today() + 1_000_000);
  insert into public.captures (id, user_id, storage_path, status)
  values (gen_random_uuid(), v_u1, v_u1 || '/tenth.jpg', 'pending')
  returning id into v_cap3;

  v_r := pg_temp.call_cartoonize(v_u1, v_cap3);
  perform pg_temp.assert_true((v_r->>'budget_exhausted')::boolean = false,
    'S6  nine jobs that RAN plus the PARKED ones still leaves an allowance — a parked job does not burn an attempt');

  -- ── S7 · the allowance itself still bites at ten ────────────────────────
  -- ⚠️ The RPC already created v_cap3's job in S6, so this MARKS IT RAN (which is
  -- what the orchestrator does after a successful generation) — it must not
  -- insert a second row: unique(capture_id) would refuse it, and that refusal is
  -- the cost guarantee, not a test inconvenience.
  update public.cartoonize_jobs
     set status = 'styled', cost_micros = 90_000
   where capture_id = v_cap3;

  insert into public.captures (id, user_id, storage_path, status)
  values (gen_random_uuid(), v_u1, v_u1 || '/eleventh.jpg', 'pending')
  returning id into v_cap2;

  v_err := pg_temp.expect_error(
    format('select pg_temp.call_cartoonize(%L::uuid, %L::uuid)', v_u1, v_cap2),
    'the eleventh photo job of the day');
  perform pg_temp.assert_true(v_err like '%allowance is complete%',
    'S7  the 11th RUN job of the day is refused by the daily allowance (got ' || v_err || ')');

  -- ── guard · the spend reader must be ALIVE ──────────────────────────────
  -- If `ai_spend_today()` were dead (always 0) the budget would be set to 0 too,
  -- and 0 + $0.10 > 0 would STILL block — so S3 cannot catch a broken reader.
  -- This is the assertion that does.
  perform pg_temp.assert_true(public.ai_spend_today() > 0,
    'guard: the spend reader is alive — the recorded costs are visible to it');

  raise notice 'stop-rule: all assertions passed';
end
$svc$;

-- ═══ TEARDOWN — and it MUST restore the budget FIRST ══════════════════════
-- The budget is GLOBAL: a run that left it at zero would lock every user out of
-- the app, so the restore is unconditional and comes before anything else. The
-- rest of the fixtures cascade away with the profile.
create or replace function pg_temp.scrum59_teardown()
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_u1 uuid := '33333333-3333-3333-3333-333333333333';
begin
  update public.app_config
     set value = '5000000'::jsonb, updated_at = now()
   where key = 'daily_ai_budget_micros';

  delete from public.rate_counters   where user_id = v_u1;
  delete from public.integrity_flags where user_id = v_u1;
  delete from public.profiles        where user_id = v_u1;   -- cascades captures → jobs
  delete from auth.users             where id      = v_u1;
end;
$$;

select pg_temp.scrum59_teardown();

-- …and PROVE the restore, because the alternative is an outage.
do $restored$
begin
  if public.ai_budget_micros() <> 5_000_000 then
    raise exception '✗ FAIL: teardown left the global budget at % — restore it by hand',
      public.ai_budget_micros();
  end if;
  raise notice 'teardown: the global budget is back at $5/day, fixtures gone';
end
$restored$;
