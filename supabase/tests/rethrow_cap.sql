-- ═══════════════════════════════════════════════════════════════════════════
-- THE RETHROW CAP, ENFORCED SERVER-SIDE — SCRUM-79 (migration 0016)
--
-- Everything here is an ASSERTION THAT RAISES ON FAILURE, so the run is green or
-- it is red — never "looks about right".
--
-- ── WHY THIS FILE EXISTS SEPARATELY ────────────────────────────────────────
-- ⚠️ `pr3_verification.sql` is the natural home for this, and it is the WRONG
-- home today: it is RED on a pre-existing, unrelated defect (SCRUM-87 — `set
-- local role` is a no-op under the harness), and because `assert_true` RAISES,
-- a red run ABORTS before any later assertion. A test that cannot run is not a
-- test. This file is self-contained so it is green or red on its own.
--
-- ── WHAT IT PROVES ─────────────────────────────────────────────────────────
-- SCRUM-23's cap — "a rethrow caps at 虔诚 Devout, never 正中 Bullseye" — used to be
-- CLIENT ONLY (`src/domain/throw.ts` `gradeThrow`), so a tampered client could
-- send `accuracy: 0` on a second throw and be graded Bullseye ×2.0. 0016 derives
-- the attempt count SERVER-side from `burns`.
--
-- ⚠️ The case that matters most is a rethrow after a **MISS**, because a miss
-- still writes a `burns` row (S9) — so "prior burn exists" is what makes it fire.
-- If the cap were written on "prior BULLSEYE exists" instead, it would never fire
-- for the miss-and-retry the mechanic actually creates.
--
-- ⚠️ FAULT-TESTED — and the fault is what proves the file: re-applying 0007 (the
-- pre-cap `submit_burn`) and re-running this file turns **R2 RED** with
-- `got bullseye` while **R1 stays GREEN**. So the test is not "always devout",
-- and it fails for the right reason. A harness that cannot fail is not a check.
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

-- ═══ FIXTURES (as the database owner) ══════════════════════════════════════
do $setup$
declare
  v_u1 uuid := '39393000-0000-4000-8000-000000000001';
  v_u2 uuid := '39393000-0000-4000-8000-000000000002';
begin
  -- pre-clean, so a RE-RUN after a failed run is safe
  delete from public.clans    where created_by in (v_u1, v_u2);
  delete from public.profiles where user_id    in (v_u1, v_u2);
  delete from auth.users      where id         in (v_u1, v_u2);

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    (v_u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'cap-a@example.invalid', '', now(),
     '{"provider":"anonymous","providers":["anonymous"]}', '{}', now(), now()),
    (v_u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'cap-b@example.invalid', '', now(),
     '{"provider":"anonymous","providers":["anonymous"]}', '{}', now(), now());
end
$setup$;

-- ═══ THE CAP, AS THE OWNER (submit_burn is service_role-only) ══════════════
do $svc$
declare
  v_u1  uuid := '39393000-0000-4000-8000-000000000001';
  v_u2  uuid := '39393000-0000-4000-8000-000000000002';
  v_clan uuid;
  v_a   uuid;   -- capture A — throws 1, 2, 3 all land here
  v_b   uuid;   -- capture B — a MISS first, then a bullseye attempt
  v_c   uuid;   -- capture C — fresh, for the per-capture control
  v_r   jsonb;
begin
  insert into public.clans (name, code, created_by)
    values ('Cap Test Clan', 'CAPTESTX', v_u1) returning id into v_clan;
  insert into public.clan_members (clan_id, user_id, role)
    values (v_clan, v_u1, 'head'), (v_clan, v_u2, 'member');

  insert into public.captures (user_id, storage_path, status)
    values (v_u1, v_u1::text || '/cap-a.jpg', 'styled') returning id into v_a;
  insert into public.captures (user_id, storage_path, status)
    values (v_u1, v_u1::text || '/cap-b.jpg', 'styled') returning id into v_b;
  insert into public.captures (user_id, storage_path, status)
    values (v_u1, v_u1::text || '/cap-c.jpg', 'styled') returning id into v_c;

  -- ── R1 · THE CONTROL: the FIRST throw on a capture is NOT capped ────────
  -- ⚠️ Without this, "everything is devout" would look like the cap working.
  v_r := public.submit_burn(v_u1, jsonb_build_object(
           'capture_id', v_a, 'clan_id', v_clan, 'accuracy', 0), 'cap-key-a1');
  perform pg_temp.assert_true(v_r->>'band' = 'bullseye',
    'R1  the FIRST throw on a capture grades bullseye — the cap does not fire (got ' || (v_r->>'band') || ')');

  -- ── R2 · THE DEFECT: a rethrow is capped at devout ─────────────────────
  v_r := public.submit_burn(v_u1, jsonb_build_object(
           'capture_id', v_a, 'clan_id', v_clan, 'accuracy', 0), 'cap-key-a2');
  perform pg_temp.assert_true(v_r->>'band' = 'devout',
    'R2  a RETHROW sending accuracy 0 is CAPPED at devout — never bullseye (got ' || (v_r->>'band') || ')');
  perform pg_temp.assert_true((v_r->>'award')::int < 1600,
    'R2  …and the AWARD follows the capped band, so it is not 1,600 (got ' || (v_r->>'award') || ')');

  -- ── R3/R4 · ⚠️ THE CASE THE MECHANIC ACTUALLY CREATES: a MISS, then a retry ──
  v_r := public.submit_burn(v_u1, jsonb_build_object(
           'capture_id', v_b, 'clan_id', v_clan, 'accuracy', 200), 'cap-key-b1');
  perform pg_temp.assert_true(v_r->>'band' = 'miss',
    'R3  a 200 px throw on a fresh capture is a miss (got ' || (v_r->>'band') || ')');

  v_r := public.submit_burn(v_u1, jsonb_build_object(
           'capture_id', v_b, 'clan_id', v_clan, 'accuracy', 0), 'cap-key-b2');
  perform pg_temp.assert_true(v_r->>'band' = 'devout',
    'R4  a rethrow AFTER A MISS is still capped — the miss wrote a burns row, so it counts (got ' || (v_r->>'band') || ')');

  -- ── R5 · PER-CAPTURE: a fresh capture is not capped by another's history ──
  v_r := public.submit_burn(v_u1, jsonb_build_object(
           'capture_id', v_c, 'clan_id', v_clan, 'accuracy', 0), 'cap-key-c1');
  perform pg_temp.assert_true(v_r->>'band' = 'bullseye',
    'R5  a DIFFERENT capture is a first throw — the cap is per-capture, not per-day (got ' || (v_r->>'band') || ')');

  -- ── R6 · the cap never RESCUES a miss (forgiving the gesture is not forgiving the aim) ──
  v_r := public.submit_burn(v_u1, jsonb_build_object(
           'capture_id', v_a, 'clan_id', v_clan, 'accuracy', 200), 'cap-key-a3');
  perform pg_temp.assert_true(v_r->>'band' = 'miss' and (v_r->>'award')::int = 0,
    'R6  a rethrow that misses is still a miss and still mints nothing (got ' || (v_r->>'band') || ')');

  -- ── R7 · ⚠️ MY FIRST VERSION OF THIS ROW WAS WRONG, and the failure is the
  --        finding: u2 CANNOT burn u1's capture at all — `submit_burn` checks
  --        "is not a styled capture owned by the actor". So a capture belongs to
  --        ONE actor, and the per-actor scoping in the cap is belt-and-braces.
  --        Asserting the OWNERSHIP here is what actually holds.
  begin
    v_r := public.submit_burn(v_u2, jsonb_build_object(
             'capture_id', v_a, 'clan_id', v_clan, 'accuracy', 0), 'cap-key-u2a1');
    perform pg_temp.assert_true(false,
      'R7  another actor burning my capture should have been REFUSED');
  exception when others then
    perform pg_temp.assert_true(sqlerrm like '%is not a styled capture owned by the actor%',
      'R7  a capture belongs to ONE actor — another member cannot burn it (got ' || sqlerrm || ')');
  end;

  raise notice 'rethrow cap: all assertions passed';
end
$svc$;

-- ═══ TEARDOWN ══════════════════════════════════════════════════════════════
do $teardown$
declare
  v_u1 uuid := '39393000-0000-4000-8000-000000000001';
  v_u2 uuid := '39393000-0000-4000-8000-000000000002';
begin
  delete from public.clans    where created_by in (v_u1, v_u2);
  delete from public.profiles where user_id    in (v_u1, v_u2);
  delete from auth.users      where id         in (v_u1, v_u2);
  raise notice 'teardown: fixtures removed';
exception when others then
  raise notice 'teardown skipped: %', sqlerrm;   -- never mask the real failure
end
$teardown$;

