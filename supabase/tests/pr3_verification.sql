-- ═══════════════════════════════════════════════════════════════════════════
-- PR-3 VERIFICATION — `submit_burn` and the RPC surface, against a REAL database
--
-- Everything here is an ASSERTION THAT RAISES ON FAILURE, so the run is green
-- or it is red — never "looks about right".
--
-- ── HOW TO RUN IT ───────────────────────────────────────────────────────────
-- There is no local `psql` on this machine, `supabase` CLI v2.119 has no
-- `query` subcommand, and the CLI's pooler URL carries no password (it
-- authenticates through the keyring). The working path is therefore to let the
-- CLI run it as a THROWAWAY MIGRATION, which is also how it was verified:
--
--   cp supabase/tests/pr3_verification.sql \
--      supabase/migrations/20261004094000_pr3_verification_run.sql
--   supabase db push --yes                 # green → the run passed; red → it failed
--   rm supabase/migrations/20261004094000_pr3_verification_run.sql
--   supabase migration repair --status reverted 20261004094000
--
-- It is written to be safe in ANY runner — inside a transaction or not:
--   · the fixtures are created idempotently (ON CONFLICT) after a pre-clean
--   · the teardown at the foot removes every trace, and it also runs from an
--     exception handler so a FAILED run cleans up too
-- so it can be run repeatedly against the same database.
--   · ⚠️ FAULT-TEST IT: change one expected number (1650 → 1601) and confirm the
--     run goes RED. A harness that cannot fail is not a check.
--
-- It is the executable form of the PR's "DONE MEANS" list:
--   R1 an authenticated INSERT into ledger_events is DENIED
--   R2 a replayed idempotency_key awards ONCE (returning the ORIGINAL receipt)
--   R3 an accuracy just inside/outside each band boundary grades correctly
--   R4 an anonymous (not signed-in) user reads 0 rows everywhere
-- plus the caps (1,650/burn · 49,500/day · 6/min · 10 photo/day), the S9
-- rethrow, the trust boundary (a client-sent `band` is IGNORED), the price
-- re-read, the ladder, and the one-tap delete's self-verification.
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

create or replace function pg_temp.count_where(p_sql text)
returns bigint language plpgsql as $$
declare v_n bigint;
begin
  execute p_sql into v_n;
  return v_n;
end;
$$;

-- ═══ TEARDOWN — the run leaves NO trace (and re-running stays safe) ════════
-- ⚠️ A SECURITY DEFINER helper, not a bare DO block: `RESET ROLE` inside a
-- plpgsql block does NOT restore the session role (verified), so a DO-block
-- teardown that follows the anon block still runs as `anon` and is refused.
-- Defining the teardown in pg_temp AS postgres sidesteps the role question
-- entirely — it always executes with the owner's rights.
--
-- ⚠️ SCRUM-87 · DEFINED ABOVE THE FIXTURES BECAUSE THE PRE-CLEAN *CALLS* IT.
-- "Undo a previous run" and "undo this run" are the same job, so they are now
-- the same function. The pre-clean used to re-implement 3 of these 4 deletes
-- and had already drifted — the integrity_flags sweep was missing — so a run
-- that succeeded through `$svc$` and then died at the auth trap below left a
-- flag behind, and the NEXT run's `count(… 'daily_award_ceiling') = 1` read 2.
-- ⚠️ That is the same shape as the bug this ticket was filed for: nobody saw
-- the drift, because the file was ALREADY red and aborts at its first failure.
create or replace function pg_temp.pr3_teardown()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_u1 uuid := '11111111-1111-1111-1111-111111111111';
  v_u2 uuid := '22222222-2222-2222-2222-222222222222';
begin
  -- clans first: clans.created_by has no ON DELETE cascade, so deleting the
  -- profile first would be refused
  delete from public.clans      where created_by in (v_u1, v_u2);
  delete from public.grid_cells where cell_id like 'pr3cell%';
  -- ⚠️ ORDER MATTERS HERE: deleting the profile NULLs integrity_flags.user_id
  -- via ON DELETE SET NULL, so the null-keyed sweep must run AFTER it. Sweeping
  -- both before (by uid) and after (by NULL) makes a re-run safe either way.
  delete from public.integrity_flags
   where user_id in (v_u1, v_u2)
     and signal in ('daily_award_ceiling', 'rate_limit_submit_burn',
                    'idempotency_key_reuse', 'idempotency_key_payload_mismatch');
  -- deleting the profile cascades every personal table (burns · ledger_events ·
  -- quotas · streaks · cell_burns · inventory · captures · cartoonize_jobs …)
  delete from public.profiles   where user_id in (v_u1, v_u2);
  delete from public.integrity_flags
   where user_id is null
     and signal in ('daily_award_ceiling', 'rate_limit_submit_burn',
                    'idempotency_key_reuse', 'idempotency_key_payload_mismatch');
  -- …and the auth row itself
  delete from auth.users        where id      in (v_u1, v_u2);
end;
$$;


-- ═══ FIXTURES (as the database owner) ══════════════════════════════════════
do $setup$
declare
  v_u1 uuid := '11111111-1111-1111-1111-111111111111';
  v_u2 uuid := '22222222-2222-2222-2222-222222222222';
begin
  -- ── pre-clean: make a RE-RUN safe after a failed run ─────────────────────
  -- ⚠️ SCRUM-87 · THE SAME FUNCTION THE FOOT CALLS. A previous run really can
  -- die before its teardown — one did: `$svc$` succeeded (committing its rows)
  -- and the auth trap below failed, so the foot never ran at all. Re-implementing
  -- the clean-up here had already drifted (no integrity_flags sweep), which is
  -- why the flag survived to be counted twice by the next run.
  perform pg_temp.pr3_teardown();

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    (v_u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'pr3-a@example.invalid', '', now(),
     '{"provider":"anonymous","providers":["anonymous"]}', '{}', now(), now()),
    (v_u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'pr3-b@example.invalid', '', now(),
     '{"provider":"anonymous","providers":["anonymous"]}', '{}', now(), now());

  -- two decorations owned, for the equip test (a PURCHASE cannot mint them:
  -- their catalogue price is NULL until the economy pass prices them — a
  -- documented finding, not an accident)
  insert into public.inventory (user_id, item_code, qty, acquired_via) values
    (v_u1, 'spring_couplets', 1, 'grant'),
    (v_u1, 'door_gods',       1, 'grant');

  raise notice 'setup: two anonymous users (the profile bootstrap should fire)';
end
$setup$;

-- ═══ AS THE OWNER: the spine ══════════════════════════════════════════════
do $svc$
declare
  v_u1  uuid := '11111111-1111-1111-1111-111111111111';
  v_clan uuid;
  v_cap  uuid;
  v_cap_c uuid;   -- ⚠️ SCRUM-79: a SECOND capture — the 1,650 case needs a FIRST throw
  v_r    jsonb;
  v_err  text;
  v_key  text := 'pr3-burn-key-0001';
  v_fill bigint;
  v_n_photo integer;
  i integer;
begin
  -- ── R11 · the sign-in profile bootstrap (migration 0006) ────────────────
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from public.profiles where user_id = '11111111-1111-1111-1111-111111111111'$q$) = 1,
    'a new sign-in gets a profiles row automatically (handle_new_user trigger)');
  perform pg_temp.assert_true(
    (select display_label from public.profiles where user_id = v_u1) = 'devotee-111111',
    'the bootstrap label is the deterministic pseudonym, not an ancestor name');

  -- ── R3 · the band boundaries — the SQL twin of src/domain/aim.ts ────────
  perform pg_temp.assert_true(public.aim_band_for(0)      = 'bullseye', 'R3  0 px → bullseye');
  perform pg_temp.assert_true(public.aim_band_for(14.55)  = 'bullseye', 'R3  ±14.55 px → bullseye (inclusive edge)');
  perform pg_temp.assert_true(public.aim_band_for(14.56)  = 'devout',   'R3  14.56 px → devout (just outside)');
  perform pg_temp.assert_true(public.aim_band_for(39.40)  = 'devout',   'R3  ±39.40 px → devout (inclusive edge)');
  perform pg_temp.assert_true(public.aim_band_for(39.41)  = 'graze',    'R3  39.41 px → graze (just outside)');
  perform pg_temp.assert_true(public.aim_band_for(96.97)  = 'graze',    'R3  ±96.97 px → graze (inclusive edge)');
  perform pg_temp.assert_true(public.aim_band_for(96.98)  = 'miss',     'R3  96.98 px → miss (just outside)');
  perform pg_temp.assert_true(public.aim_band_for(100000) = 'miss',     'R3  a huge offset → miss, never a graze');
  v_err := pg_temp.expect_error($q$select public.aim_band_for(-1)$q$, 'a negative offset');
  perform pg_temp.assert_true(v_err like '22023%',
    'R3  a negative offset RAISES rather than grading (got ' || v_err || ')');

  -- ── the fixture clan + a styled capture ────────────────────────────────
  insert into public.clans (name, code, created_by)
  values ('Pr3 Test Clan', 'PR3TESTX', v_u1) returning id into v_clan;
  insert into public.clan_members (clan_id, user_id, role) values (v_clan, v_u1, 'head');
  insert into public.captures (user_id, storage_path, status)
  values (v_u1, v_u1::text || '/pr3-capture-1.jpg', 'styled') returning id into v_cap;

  -- ── the burn: bullseye + NEW ground, no streak → 400 × 2.0 × 2.0 = 1,600 ─
  v_r := public.submit_burn(v_u1, jsonb_build_object(
           'capture_id', v_cap, 'clan_id', v_clan, 'accuracy', 0,
           'cell_hash', 'pr3cellA', 'client_time', now()), v_key);
  perform pg_temp.assert_true(v_r->>'band' = 'bullseye',
    'the band is DERIVED server-side from accuracy (the client never sent it)');
  perform pg_temp.assert_true((v_r->>'award')::int = 1600,
    '正中 + new ground = 1,600 (got ' || (v_r->>'award') || ')');
  perform pg_temp.assert_true((v_r->>'new_ground')::boolean = true,
    'new-ground is decided server-side from cell_burns');
  perform pg_temp.assert_true((v_r->>'idempotent_replay')::boolean = false,
    'the first call is not a replay');
  perform pg_temp.assert_true((v_r->>'tribute_balance')::bigint = 1600,
    'the ledger balance reflects the new award');

  -- ── R2 · THE REPLAY: the same key awards ONCE ──────────────────────────
  v_r := public.submit_burn(v_u1, jsonb_build_object(
           'capture_id', v_cap, 'clan_id', v_clan, 'accuracy', 0,
           'cell_hash', 'pr3cellA'), v_key);
  perform pg_temp.assert_true((v_r->>'idempotent_replay')::boolean = true,
    'R2  a replayed idempotency_key reports idempotent_replay');
  perform pg_temp.assert_true((v_r->>'award')::int = 1600,
    'R2  the replay returns the ORIGINAL receipt, not a new award');
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from public.ledger_events where idempotency_key = 'pr3-burn-key-0001'$q$) = 1,
    'R2  exactly ONE ledger row exists for that key');
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from public.burns where idempotency_key = 'pr3-burn-key-0001'$q$) = 1,
    'R2  exactly ONE burns row exists for that key');
  perform pg_temp.assert_true(
    (select balance from public.balances where user_id = v_u1 and currency = 'tribute') = 1600,
    'R2  the balance did NOT double (1,600, not 3,200)');

  -- the same key with a DIFFERENT payload is abuse, not a replay (doc 11 §6.7)
  v_err := pg_temp.expect_error(
    format('select public.submit_burn(%L::uuid, %L::jsonb, %L)', v_u1,
           jsonb_build_object('capture_id', v_cap, 'clan_id', v_clan, 'accuracy', 0.5), v_key),
    'a replayed key with a different payload');
  perform pg_temp.assert_true(v_err like '22000%',
    'a replayed key with a different payload is REFUSED (got ' || v_err || ')');

  -- ── the trust boundary: a client-sent `band` is IGNORED ────────────────
  v_r := public.submit_burn(v_u1, jsonb_build_object(
           'capture_id', v_cap, 'clan_id', v_clan, 'accuracy', 200,
           'band', 'bullseye', 'cell_hash', 'pr3cellB'), 'pr3-burn-key-0002');
  perform pg_temp.assert_true(v_r->>'band' = 'miss',
    'a client-sent `band` is IGNORED — accuracy 200 grades as miss');
  perform pg_temp.assert_true((v_r->>'award')::int = 0, 'a miss mints nothing');
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from public.ledger_events where idempotency_key = 'pr3-burn-key-0002'$q$) = 0,
    'a 0-award burn writes NO ledger row (amount <> 0 is a CHECK)');
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from public.burns where idempotency_key = 'pr3-burn-key-0002'$q$) = 1,
    'a miss still writes the burns row — the rethrow is a NEW burn (doc 07 §6)');

  -- ── the 1,650 cap: bullseye + new ground + streak ──────────────────────
  insert into public.streaks (user_id, current_days, last_burn_date)
  values (v_u1, 1, public.burn_day() - 1)
  on conflict (user_id) do update
    set current_days = 1, last_burn_date = public.burn_day() - 1;

  -- ⚠️ SCRUM-79 — this needs a FRESH capture. 1,650 requires a 正中 Bullseye, and the
  -- server-side rethrow cap makes every SECOND+ throw on a capture 虔诚 Devout.
  -- `v_cap` already carries two burns by here, so re-using it graded **1,250** and
  -- this assertion became unreachable — the file's FIRST failure moved from line 483
  -- to here the moment the cap shipped, and ⚠️ nothing noticed, because a
  -- pre-existing red masks a new red.
  insert into public.captures (user_id, storage_path, status)
  values (v_u1, v_u1::text || '/pr3-capture-cap.jpg', 'styled') returning id into v_cap_c;
  v_r := public.submit_burn(v_u1, jsonb_build_object(
           'capture_id', v_cap_c, 'clan_id', v_clan, 'accuracy', 0,
           'cell_hash', 'pr3cellC'), 'pr3-burn-key-0003');
  perform pg_temp.assert_true(v_r->>'band' = 'bullseye',
    'the FIRST throw on a fresh capture is 正中 — not capped (got ' || (v_r->>'band') || ')');
  perform pg_temp.assert_true((v_r->>'award')::int = 1650,
    '正中 + new ground + streak = 1,650 — THE CAP (got ' || (v_r->>'award') || ')');
  perform pg_temp.assert_true((v_r->>'streak_day')::int = 2, 'the streak advanced to day 2');
  perform pg_temp.assert_true((v_r->>'award')::int <= 1650, 'no burn can exceed 1,650');

  -- ── ⚠️ SCRUM-79 · THE SAME THROW ON A SHARED CAPTURE IS A RETHROW, AND CAPPED ──
  -- Kept deliberately rather than deleted: this asserts the rule the cap introduced,
  -- on the very capture the case above can no longer use.
  v_r := public.submit_burn(v_u1, jsonb_build_object(
           'capture_id', v_cap, 'clan_id', v_clan, 'accuracy', 0,
           'cell_hash', 'pr3cellE'), 'pr3-burn-key-0003b');
  perform pg_temp.assert_true(v_r->>'band' = 'devout',
    'a RETHROW sending accuracy 0 is CAPPED at 虔诚 Devout — never 正中 (got ' || (v_r->>'band') || ')');
  perform pg_temp.assert_true((v_r->>'award')::int < 1650,
    '…and the award follows the capped band, so 1,650 is unreachable on a rethrow (got ' || (v_r->>'award') || ')');

  -- ── S9 · THE RETHROW — a miss RETURNS the offering (the 0007 regression) ─
  insert into public.inventory (user_id, item_code, qty, acquired_via)
  values (v_u1, 'joss_paper_stack', 3, 'purchase')
  on conflict (user_id, item_code) do update set qty = 3;

  v_r := public.submit_burn(v_u1, jsonb_build_object(
           'item_code', 'joss_paper_stack', 'clan_id', v_clan, 'accuracy', 500),
         'pr3-burn-key-0005');
  perform pg_temp.assert_true(v_r->>'band' = 'miss', 'S9  a store throw at 500 px grades as a miss');
  perform pg_temp.assert_true(
    (select qty from public.inventory where user_id = v_u1 and item_code = 'joss_paper_stack') = 3,
    'S9  A MISS RETURNS THE OFFERING — inventory untouched (the 0007 fix)');

  v_r := public.submit_burn(v_u1, jsonb_build_object(
           'item_code', 'joss_paper_stack', 'clan_id', v_clan, 'accuracy', 5),
         'pr3-burn-key-0006');
  perform pg_temp.assert_true(v_r->>'band' = 'bullseye', 'S9  the same offering thrown well grades bullseye');
  perform pg_temp.assert_true(
    (select qty from public.inventory where user_id = v_u1 and item_code = 'joss_paper_stack') = 2,
    'S9  a scoring throw CONSUMES exactly one offering from inventory');

  -- ── the 49,500/day second belt: fill the day, then a burn MUST clamp ────
  -- ⚠️ SCRUM-79 — clear the per-MINUTE counters first. This section tests the DAILY
  -- ceiling, not the 6/min limiter (which is asserted on its own below and clears
  -- them for exactly this reason). The rethrow-cap assertions added above spend
  -- tokens, so without this the clamp burn is refused as "shrine is busy" instead
  -- — a second-order effect of the cap, and one the per-minute rule made invisible.
  delete from public.rate_counters where user_id = v_u1 and endpoint = 'submit_burn';
  select 49500 - 100 - coalesce(sum(amount), 0) into v_fill
    from public.ledger_events
   where user_id = v_u1 and currency = 'tribute' and type = 'award';
  insert into public.ledger_events (user_id, seq, currency, type, amount, ref_type, actor, idempotency_key)
  values (v_u1, 900, 'tribute', 'award', v_fill::int, 'test-fill', 'pr3-test', 'pr3-fill-key-0001');
  v_r := public.submit_burn(v_u1, jsonb_build_object(
           'capture_id', v_cap, 'clan_id', v_clan, 'accuracy', 0,
           'cell_hash', 'pr3cellD'), 'pr3-burn-key-0004');
  perform pg_temp.assert_true((v_r->>'award')::int = 100,
    'the derived 49,500/day ceiling CLAMPS the award to the remaining room (got '
      || (v_r->>'award') || ')');
  perform pg_temp.assert_true((v_r->>'clamped')::boolean = true, 'the clamp is reported on the receipt');
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from public.integrity_flags where signal = 'daily_award_ceiling'$q$) = 1,
    'the ceiling breach is LOGGED to integrity_flags (log-only at alpha, ADR-005 §5)');
  perform pg_temp.assert_true(
    (select coalesce(sum(amount), 0) from public.ledger_events
      where user_id = v_u1 and currency = 'tribute' and type = 'award') = 49500,
    'the day''s tribute total lands EXACTLY on 49,500 — never above');

  -- ── the 6/min burst limit (doc 11 §5) ──────────────────────────────────
  delete from public.rate_counters where user_id = v_u1 and endpoint = 'submit_burn';
  for i in 1..6 loop
    perform public.submit_burn(v_u1, jsonb_build_object(
              'item_code', 'joss_paper_stack', 'clan_id', v_clan, 'accuracy', 500),
            'pr3-rl-key-000' || i);
  end loop;
  v_err := pg_temp.expect_error(
    format('select public.submit_burn(%L::uuid, %L::jsonb, %L)', v_u1,
           jsonb_build_object('item_code', 'joss_paper_stack', 'clan_id', v_clan, 'accuracy', 500),
           'pr3-rl-key-0007'),
    'the 7th burn inside one minute');
  perform pg_temp.assert_true(v_err like '%busy%',
    '6 burns are allowed in a minute and the 7th is REFUSED with shrine-busy copy (got ' || v_err || ')');
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from public.burns where idempotency_key = 'pr3-rl-key-0007'$q$) = 0,
    'the rate-limited call wrote NO burn');

  -- ── the 10 photo burns/day cap (doc 10 §1) ─────────────────────────────
  delete from public.rate_counters where user_id = v_u1 and endpoint = 'submit_burn';
  select count(*) into v_n_photo from public.burns
   where user_id = v_u1 and capture_id is not null
     and (created_at at time zone 'utc')::date = public.burn_day();
  for i in 1..(10 - v_n_photo::int) loop
    insert into public.burns (user_id, clan_id, capture_id, band, accuracy, idempotency_key)
    values (v_u1, v_clan, v_cap, 'miss', 1, 'pr3-quota-fill-' || i);
  end loop;
  v_err := pg_temp.expect_error(
    format('select public.submit_burn(%L::uuid, %L::jsonb, %L)', v_u1,
           jsonb_build_object('capture_id', v_cap, 'clan_id', v_clan, 'accuracy', 0),
           'pr3-burn-key-0010'),
    'the 11th photo burn of the day');
  perform pg_temp.assert_true(v_err like '%allowance is complete%',
    'the 11th photo burn of the day is REFUSED — the 10/day cap holds (got ' || v_err || ')');

  raise notice 'spine: all submit_burn assertions passed';
end
$svc$;

-- ═══ AS A SIGNED-IN USER (RLS is on; auth.uid() is real) ══════════════════
-- ⚠️ SCRUM-87 · `SET ROLE`, NOT `SET LOCAL ROLE`, AND `is_local := FALSE`.
-- `SET LOCAL` is a no-op outside a transaction block, and `run-sql-tests.sh` runs
-- each statement in AUTOCOMMIT — so `set local role` warned and did nothing, the
-- `$auth$` block below ran as the session OWNER (postgres), and the INSERT this
-- section expects to be DENIED simply succeeded (R1 failed). The same trap
-- applies to `set_config(…, is_local := true)`: it is transaction-scoped, so on
-- its own statement it evaporated before the DO block ran. Both are now the
-- SESSION-scoped form, which works in both runners (run-sql-tests.sh AND a
-- hand-run `psql -f`). ⚠️ The `perform set_config(…, true)` calls INSIDE the DO
-- blocks below are fine and are left alone: they are in the same statement.
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);

do $auth$
declare
  v_u1   uuid := '11111111-1111-1111-1111-111111111111';
  v_u2   uuid := '22222222-2222-2222-2222-222222222222';
  v_err  text;
  v_r    jsonb;
  v_code text;
  v_clan_id uuid;   -- ⚠️ SCRUM-87: the id must come from the RPC, never a table read
  v_n    bigint;
begin
  -- ── R1 · THE LEDGER IS CLOSED TO A SIGNED-IN CLIENT ────────────────────
  v_err := pg_temp.expect_error(
    $q$insert into public.ledger_events (user_id, seq, currency, type, amount, actor)
       values ('11111111-1111-1111-1111-111111111111', 77, 'tribute', 'award', 10, 'client')$q$,
    'authenticated INSERT into ledger_events');
  perform pg_temp.assert_true(
    v_err like '42501%' or v_err like '%permission denied%' or v_err like '%row-level security%',
    'R1  an authenticated INSERT into ledger_events is DENIED (got ' || v_err || ')');

  v_err := pg_temp.expect_error(
    $q$update public.ledger_events set amount = 999999$q$, 'authenticated UPDATE of ledger_events');
  perform pg_temp.assert_true(
    v_err like '42501%' or v_err like '%permission denied%' or v_err like '%row-level security%',
    'R1  an authenticated UPDATE of ledger_events is DENIED (append-only, ADR-005 §8)');

  v_err := pg_temp.expect_error(
    $q$delete from public.ledger_events$q$, 'authenticated DELETE from ledger_events');
  perform pg_temp.assert_true(
    v_err like '42501%' or v_err like '%permission denied%' or v_err like '%row-level security%',
    'R1  an authenticated DELETE from ledger_events is DENIED');

  v_err := pg_temp.expect_error(
    $q$insert into public.burns (user_id, clan_id, capture_id, band, accuracy, idempotency_key)
       values ('11111111-1111-1111-1111-111111111111',
               (select id from public.clans limit 1), null, 'miss', 1, 'client-forged-burn')$q$,
    'authenticated INSERT into burns');
  perform pg_temp.assert_true(v_err is not null,
    'R1  a client cannot write `burns` directly either (got ' || v_err || ')');

  -- ── the money path is service_role ONLY (the grant IS the boundary) ────
  perform pg_temp.assert_true(
    not has_function_privilege('authenticated', 'public.submit_burn(uuid,jsonb,text)', 'EXECUTE'),
    'submit_burn is NOT executable by authenticated — the money path is closed');
  perform pg_temp.assert_true(
    not has_function_privilege('anon', 'public.submit_burn(uuid,jsonb,text)', 'EXECUTE'),
    'submit_burn is NOT executable by anon');
  perform pg_temp.assert_true(
    has_function_privilege('service_role', 'public.submit_burn(uuid,jsonb,text)', 'EXECUTE'),
    'submit_burn IS executable by service_role — award-service is the only writer of money');
  perform pg_temp.assert_true(
    not has_function_privilege('authenticated', 'public.request_cartoonize(uuid,uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.request_cartoonize(uuid,uuid)', 'EXECUTE'),
    'request_cartoonize is service_role-only as well');
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prokind = 'f'
         and has_function_privilege('anon', p.oid, 'EXECUTE')$q$) = 0,
    'NOTHING in public is executable by anon (trap #1: revoke PUBLIC *and* the explicit grant)');

  -- ── create_clan: SECURITY INVOKER, gated by RLS ────────────────────────
  v_r := public.create_clan('Pr3 Second Clan');
  v_code := v_r->>'code';
  perform pg_temp.assert_true(v_r->>'role' = 'head',
    'create_clan makes the founder a head (INVOKER + two RLS policies)');
  perform pg_temp.assert_true(v_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$',
    'the generated invite code matches the DB CHECK alphabet (no 0/O/1/I/L)');
  perform pg_temp.assert_true(
    (select role from public.clan_members
      where user_id = v_u1 and clan_id = (v_r->>'clan_id')::uuid) = 'head',
    'the founder''s head row was written through the new INSERT policy');

  -- ── preview as a NON-member (u2 has not joined yet) ───────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  v_r := public.preview_clan('PR3TESTX');
  perform pg_temp.assert_true((v_r->>'found')::boolean,
    'preview_clan resolves an invite code for a NON-member');
  perform pg_temp.assert_true(v_r->>'name' = 'Pr3 Test Clan', 'the preview carries the clan name');
  perform pg_temp.assert_true((v_r->>'is_member')::boolean = false,
    'the preview reports is_member = false');
  perform pg_temp.assert_true(
    position('surname' in v_r::text) = 0 and position('given_name' in v_r::text) = 0,
    'the preview leaks NO ancestor names before joining (doc 13 §4)');
  v_r := public.preview_clan('BADCODE1');
  perform pg_temp.assert_true((v_r->>'found')::boolean = false,
    'a malformed code returns found = false rather than raising');

  -- ── join_clan: instant, loud on failure (doc 15 §4.3) ────────────────
  v_r := public.join_clan('PR3TESTX');
  perform pg_temp.assert_true((v_r->>'joined')::boolean,
    'join_clan joins instantly — no approval queue');
  perform pg_temp.assert_true(v_r->>'role' = 'member', 'a joiner is a member, not a head');
  v_err := pg_temp.expect_error($q$select public.join_clan('PR3TESTX')$q$, 'joining twice');
  perform pg_temp.assert_true(v_err like '23505%', 'a second join fails loudly (got ' || v_err || ')');
  v_err := pg_temp.expect_error($q$select public.join_clan('ZZZZZZZZ')$q$, 'an unknown code');
  perform pg_temp.assert_true(v_err like '22023%', 'an unknown/revoked code fails loudly (got ' || v_err || ')');

  -- ── save_ancestor: the role ladder (doc 15 §3) ────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  -- ⚠️ SCRUM-87 · resolve the code through the RPC — the ONLY path a client has.
  -- `select id from public.clans where code = '…'` is DENIED, because migration
  -- 0015 grants SELECT COLUMN-BY-COLUMN and `code` is deliberately not among the
  -- granted columns (SCRUM-86) — so the *filter* is refused, not just the column.
  -- `preview_clan` returns `clan_id` for a code, which is exactly why the app
  -- resolves a clan through an RPC and never by reading the table.
  -- ⚠️ This line only ever "worked" because the role switch above was a no-op, so
  -- the whole block ran as the database OWNER — fix the role, and the shortcut dies.
  v_clan_id := (public.preview_clan('PR3TESTX')->>'clan_id')::uuid;
  v_r := public.save_ancestor(v_clan_id, '陳', '大文', '祖父');
  perform pg_temp.assert_true((v_r->>'slot')::int = 0, 'save_ancestor allocates the first free altar slot');
  perform pg_temp.assert_true(v_r->>'surname' = '陳', 'the tablet records the surname');

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  v_err := pg_temp.expect_error(
    format('select public.save_ancestor(%L::uuid, %L)', v_clan_id, '林'),
    'a MEMBER adding a tablet');
  perform pg_temp.assert_true(v_err like '42501%',
    'a plain member may not add tablets — the ladder holds (got ' || v_err || ')');

  -- ── purchase_item: the price is re-read, and replays are safe ──────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  v_r := public.purchase_item('gold_bar', 'pr3-purchase-key-0001');
  perform pg_temp.assert_true((v_r->>'price')::int = 600,
    'purchase_item re-reads the price from the catalogue (600, not a client number)');
  perform pg_temp.assert_true((v_r->>'accrual')::int = 120,
    'the S13d 20% Store-Point accrual is 120');
  perform pg_temp.assert_true((v_r->>'balance')::bigint = 48900,
    'the tribute balance dropped by exactly the catalogue price (49,500 → 48,900)');
  perform pg_temp.assert_true(
    (select qty from public.inventory where user_id = v_u1 and item_code = 'gold_bar') = 1,
    'the purchased offering landed in inventory');

  v_r := public.purchase_item('gold_bar', 'pr3-purchase-key-0001');
  perform pg_temp.assert_true((v_r->>'idempotent_replay')::boolean = true,
    'a replayed purchase reports idempotent_replay');
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from public.ledger_events where idempotency_key = 'pr3-purchase-key-0001'$q$) = 1,
    'the replay wrote no second debit');
  perform pg_temp.assert_true(
    (select qty from public.inventory where user_id = v_u1 and item_code = 'gold_bar') = 1,
    'the replay did not mint a second item');

  v_err := pg_temp.expect_error(
    $q$select public.purchase_item('lanterns', 'pr3-purchase-key-0002')$q$,
    'buying an unpriced decoration');
  perform pg_temp.assert_true(v_err like '%no price yet%',
    'an unpriced decoration fails LOUDLY rather than inventing a price (a PR finding)');

  -- ── equip_decoration: S14k, enforced twice ────────────────────────────
  v_r := public.equip_decoration('side_left', 'spring_couplets');
  perform pg_temp.assert_true(v_r->>'category' = 'side', 'equip_decoration places a side piece');
  v_r := public.equip_decoration('side_right', 'door_gods');
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from public.equipped_decorations
       where user_id = '11111111-1111-1111-1111-111111111111' and slot like 'side%'$q$) = 1,
    'S14k — equipping a second SIDE set REPLACES the first (one set per category)');

  v_err := pg_temp.expect_error(
    $q$insert into public.equipped_decorations (user_id, slot, item_code)
       values ('11111111-1111-1111-1111-111111111111', 'side_left', 'spring_couplets')$q$,
    'a direct insert of a second side set');
  perform pg_temp.assert_true(v_err like '23514%',
    'the trigger blocks a direct second set — S14k cannot be bypassed (got ' || v_err || ')');
  v_err := pg_temp.expect_error(
    $q$insert into public.equipped_decorations (user_id, slot, item_code)
       values ('11111111-1111-1111-1111-111111111111', 'top_left', 'spring_couplets')$q$,
    'a side piece in a top slot');
  perform pg_temp.assert_true(v_err like '23514%', 'the trigger blocks a side piece in a top slot');

  -- ── get_league_board: INVOKER, read straight from the ledger ──────────
  v_r := public.get_league_board();
  perform pg_temp.assert_true((v_r->>'my_weekly_points')::bigint = 49500,
    'get_league_board reads the caller''s weekly tribute from the ledger (INVOKER + RLS)');
  perform pg_temp.assert_true(v_r ? 'note', 'the board is an honest stub — cohorts arrive with SCRUM-11');

  -- ── delete_my_data: the one-tap delete verifies itself ────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  v_r := public.delete_my_data();
  perform pg_temp.assert_true((v_r->>'verified_zero_rows')::boolean = true,
    'delete_my_data probes every personal table and reports 0 rows left');
  perform pg_temp.assert_true((v_r->>'rows_left_behind')::int = 0, 'the receipt reports 0 rows behind');
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from public.profiles where user_id = '22222222-2222-2222-2222-222222222222'$q$) = 0,
    'the deleted account''s profile is gone (checked from the client''s own view)');
  perform pg_temp.assert_true(
    jsonb_array_length((v_r->>'storage_prefixes')::jsonb) = 2,
    'the receipt names the two Storage prefixes that still need purging (an honest gap)');

  raise notice 'rcps: all authenticated-role assertions passed';
end
$auth$;
reset role;

-- ═══ AS AN ANONYMOUS USER (no JWT at all) ═════════════════════════════════
-- ⚠️ SCRUM-87 — session-scoped, same reason as above (`reset role;` at the foot
-- of the `$auth$` block restores the owner first).
set role anon;

do $anon$
declare
  v_bad   text := '';
  v_n     bigint;
  v_t     text;
  v_read  boolean;
begin
  for v_t in
    select table_name from information_schema.tables where table_schema = 'public'
  loop
    v_read := true;
    begin
      execute format('select count(*) from public.%I', v_t) into v_n;
    exception when insufficient_privilege then
      v_read := false;
    end;
    if not v_read then
      raise notice '  · % — not readable at all by anon (also "reads nothing")', v_t;
    elsif v_n <> 0 then
      v_bad := v_bad || v_t || '(' || v_n || ') ';
    end if;
  end loop;

  perform pg_temp.assert_true(v_bad = '',
    'R4  an anonymous (not signed-in) user reads 0 rows everywhere'
      || case when v_bad <> '' then ' — LEAKS: ' || v_bad else '' end);

  -- …and the catalogue is NOT anonymously readable: the policy is
  -- `to authenticated` on purpose (a signed-in but anonymous DEVICE reads it)
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from public.offerings_catalog$q$) = 0,
    'R4  even the catalogue is 0 rows for the `anon` role');

  raise notice 'anon: nothing is readable without a session';
end
$anon$;

reset role;

-- ═══ TEARDOWN — the run leaves NO trace (and re-running stays safe) ════════
-- ⚠️ SCRUM-87 · `pg_temp.pr3_teardown()` is defined ABOVE THE FIXTURES, so the
-- pre-clean and this call are *literally the same function* and cannot drift.
select pg_temp.pr3_teardown();
