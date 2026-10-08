-- ═══════════════════════════════════════════════════════════════════════════
-- SCRUM-46 VERIFICATION — the clan management API, against a REAL database
--
-- Everything here is an ASSERTION THAT RAISES ON FAILURE, so the run is green
-- or it is red — never "looks about right".
--
-- ── HOW TO RUN IT ───────────────────────────────────────────────────────────
-- The local Docker stack needs no account and no link, and it applies the
-- migrations from the files:
--
--   npx supabase start
--   bash supabase/checks/run-sql-tests.sh "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
--
-- Against the linked project, use the throwaway-migration path documented in
-- `pr3_verification.sql` (no local `psql`, and the CLI has no `query`).
--
-- ── WHAT IT PROVES (each assertion RAISES, so the run is green or red) ──────
--   C1  create_clan — the founder is the head, and is the only head
--   C2  join_clan — the invite code is the only way in; a joiner is a member
--   C3  the sole head with NO candidate is refused (SCRUM-84: superseded by C13
--       for every other case)
--   C4  the ladder — promote member→elder, elder→co_head; an ELDER CANNOT
--       promote; `head` is not assignable; the founder's role is immutable
--   C5  removal — a head removes a member; an elder cannot; the founding head
--       cannot be removed; a head cannot remove themselves
--   C6  leaving — a member/elder leaves freely; the founder leaves once a
--       co-head exists
--   C7  ⚠️ the ≥1-head invariant holds in the DATABASE, not just the RPC —
--       forced with `set constraints … immediate` so the deferred trigger is
--       observable inside a transaction
--   C8  rename — head only; the 2..20 rule is a named error, not a CHECK blow-up
--   C9  the Book — a member sees WHO; a non-member gets the ANONYMISED
--       projection; the 1-month window HIDES (not purges); `private` is owner-only
--   C10 delete_clan — head only; members, ancestors and tributes cascade
--   C11 anti-abuse — the 11th clan is refused, and ⚠️ the joins-per-hour limb
--       is REACHABLE (it must sit below the clan cap or it is dead logic)
--   C12 an erasure is never blocked by the ≥1-head invariant
--   C13 ⚠️ THE HEAD-EXIT RAMP (SCRUM-84, PM-answered 2026-10-08): a sole head
--       leaves BY PROMOTING — the successor they NAME, or failing that the
--       OLDEST ELDER by joined_at; refused only when there is no candidate
--
-- ── ⚠️ FAULT-TEST IT ────────────────────────────────────────────────────────
-- Break one rule and confirm the matching letter goes red. The two that matter
-- most: drop the `v_heads <= 1` guard from `leave_clan` (C5 must fail), and set
-- `c_joins_per_hour := 10` (C10's join limb must fail — that is the bug this
-- file was written to catch, and it was real).
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

-- ═══ FIXTURES (as the database owner) ══════════════════════════════════════
do $setup$
declare
  v_u1 uuid := 'aaaa0001-0000-0000-0000-000000000001';   -- founder / head
  v_u2 uuid := 'aaaa0002-0000-0000-0000-000000000002';   -- member → elder
  v_u3 uuid := 'aaaa0003-0000-0000-0000-000000000003';   -- member → co_head
  v_u4 uuid := 'aaaa0004-0000-0000-0000-000000000004';   -- member
  v_u5 uuid := 'aaaa0005-0000-0000-0000-000000000005';   -- outsider, never joins
begin
  -- pre-clean, so a RE-RUN after a failed run is safe
  delete from public.clans       where created_by in (v_u1, v_u2, v_u3, v_u4, v_u5);
  delete from public.profiles    where user_id   in (v_u1, v_u2, v_u3, v_u4, v_u5);
  delete from auth.users         where id        in (v_u1, v_u2, v_u3, v_u4, v_u5);

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         u::text || '@example.invalid', '', now(),
         '{"provider":"anonymous","providers":["anonymous"]}', '{}', now(), now()
  from unnest(array[v_u1, v_u2, v_u3, v_u4, v_u5]) as u;

  raise notice 'setup: five anonymous users (the profile bootstrap should fire)';
end
$setup$;

-- ═══ THE SPINE — C1..C5, driven as real signed-in users ════════════════════
-- A pg_temp table carries the fixture ids between DO blocks (each block has its
-- own scope, and the ids must not be re-derived by guessing).
-- ⚠️ GRANT required: a temp table grants nothing to PUBLIC, and the blocks below
-- run as `authenticated`. (Proved the hard way — SELECT alone is not enough.)
create table pg_temp.fx (k text primary key, v uuid, s text);
grant select, insert, update, delete on pg_temp.fx to authenticated;

set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaa0001-0000-0000-0000-000000000001","role":"authenticated"}', false);

do $spine$
declare
  v_u1 uuid := 'aaaa0001-0000-0000-0000-000000000001';
  v_r  jsonb;
begin
  -- ── C1 · create_clan: four taps to head ────────────────────────────────
  v_r := public.create_clan('Tan Family');
  perform pg_temp.assert_true((v_r->>'role') = 'head', 'C1  the founder is the head');
  perform pg_temp.assert_true((v_r->>'name') = 'Tan Family', 'C1  the name is stored plain');
  perform pg_temp.assert_true((v_r->>'member_count') = '1', 'C1  the new clan has one member');
  perform pg_temp.assert_true((v_r->>'ancestor_cap') = '10', 'C1  the ancestor cap defaults to 10');
  perform pg_temp.assert_true(length(v_r->>'code') = 8, 'C1  the invite code is 8 characters');
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from public.clan_members
      where user_id = 'aaaa0001-0000-0000-0000-000000000001' and role = 'head'$q$) = 1,
    'C1  exactly one head row exists, written by the RPC');
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from public.clans$q$) >= 1,
    'C1  the clan is visible to its own head under RLS');

  insert into pg_temp.fx values
    ('clan', (v_r->>'clan_id')::uuid, v_r->>'code');
end
$spine$;

-- ═══ C2..C6 · joining, promote-first, the ladder, removal, leaving ═════════
do $ladder$
declare
  v_u1   text := 'aaaa0001-0000-0000-0000-000000000001';
  v_u2   text := 'aaaa0002-0000-0000-0000-000000000002';
  v_u3   text := 'aaaa0003-0000-0000-0000-000000000003';
  v_u4   text := 'aaaa0004-0000-0000-0000-000000000004';
  v_u5   text := 'aaaa0005-0000-0000-0000-000000000005';
  v_clan uuid;
  v_code text;
  v_r    jsonb;
  v_err  text;
begin
  select v, s into v_clan, v_code from pg_temp.fx where k = 'clan';

  -- ── C2 · join_clan — the invite code is the only way in ────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, false);
  v_r := public.join_clan(v_code);
  perform pg_temp.assert_true((v_r->>'joined') = 'true', 'C2  a valid code joins INSTANTLY (no approval queue)');
  perform pg_temp.assert_true((v_r->>'role') = 'member', 'C2  a joiner is a member, never a head');
  perform pg_temp.assert_true((v_r->>'member_count') = '2', 'C2  the member count reflects the join');

  perform set_config('request.jwt.claims', json_build_object('sub', v_u3, 'role', 'authenticated')::text, false);
  perform public.join_clan(v_code);
  perform set_config('request.jwt.claims', json_build_object('sub', v_u4, 'role', 'authenticated')::text, false);
  perform public.join_clan(v_code);
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from public.clan_members$q$) = 4,
    'C2  four members: the founder and three joiners');

  -- ⚠️ a bad code fails LOUDLY (doc 15 §4.3)
  v_err := pg_temp.expect_error(format('select public.join_clan(%L)', 'ZZZZZZZZ'),
    'C2  an unknown invite code is refused');
  perform pg_temp.assert_true(v_err like '22023%', 'C2  …as invalid-parameter, not a silent no-op');
  v_err := pg_temp.expect_error(format('select public.join_clan(%L)', 'nope'),
    'C2  a malformed code is refused');
  perform set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, false);
  v_err := pg_temp.expect_error(format('select public.join_clan(%L)', v_code),
    'C2  joining a clan you are already in is refused');
  perform pg_temp.assert_true(v_err like '23505%', 'C2  …as a duplicate (23505), not a second row');

  -- ── C3 · ⚠️ PROMOTE-FIRST: the sole head may not leave ─────────────────
  -- ⚠️ RE-SPECIFIED at SCRUM-84 (2026-10-08). This used to read "promote-first:
  -- the sole head may not leave". The rule is now a RAMP (see C13), and this
  -- fixture lands on the one case it still refuses: u2/u3/u4 are all plain
  -- MEMBERS, so there is no co-head and no ELDER to inherit, and nobody is named.
  -- A member is never auto-promoted — C13 asserts that too.
  perform set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, false);
  v_err := pg_temp.expect_error(format('select public.leave_clan(%L)', v_clan),
    'C3  a sole head with NO successor to promote is REFUSED');
  perform pg_temp.assert_true(v_err like '%promote a co-head%',
    'C3  …and the refusal names a way out');
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from public.clan_members$q$) = 4,
    'C3  the refused head is still a member — nothing was changed');
end
$ladder$;

-- ═══ C4..C6 · the ladder, removal, leaving ═════════════════════════════════
do $manage$
declare
  v_u1   text := 'aaaa0001-0000-0000-0000-000000000001';
  v_u2   text := 'aaaa0002-0000-0000-0000-000000000002';
  v_u3   text := 'aaaa0003-0000-0000-0000-000000000003';
  v_u4   text := 'aaaa0004-0000-0000-0000-000000000004';
  v_u5   text := 'aaaa0005-0000-0000-0000-000000000005';
  v_clan uuid;
  v_r    jsonb;
  v_err  text;
begin
  select v into v_clan from pg_temp.fx where k = 'clan';

  -- ── C4 · the ladder (doc 15 §3) ────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, false);
  v_r := public.set_member_role(v_clan, v_u2::uuid, 'elder');
  perform pg_temp.assert_true((v_r->>'role') = 'elder', 'C4  a head promotes a member to elder');
  perform pg_temp.assert_true((v_r->>'from') = 'member', 'C4  …and the response names the role they had');

  v_r := public.set_member_role(v_clan, v_u3::uuid, 'co_head');
  perform pg_temp.assert_true((v_r->>'role') = 'co_head', 'C4  a head lifts a member to co-head');

  perform set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, false);
  v_err := pg_temp.expect_error(format('select public.set_member_role(%L, %L, %L)', v_clan, v_u4, 'elder'),
    'C4  ⚠️ an ELDER may NOT promote');
  perform pg_temp.assert_true(v_err like '42501%', 'C4  …as a permission error (42501)');

  perform set_config('request.jwt.claims', json_build_object('sub', v_u4, 'role', 'authenticated')::text, false);
  v_err := pg_temp.expect_error(format('select public.set_member_role(%L, %L, %L)', v_clan, v_u4, 'elder'),
    'C4  a plain MEMBER may NOT promote');
  perform pg_temp.assert_true(v_err like '42501%', 'C4  …as a permission error (42501)');

  perform set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, false);
  v_err := pg_temp.expect_error(format('select public.set_member_role(%L, %L, %L)', v_clan, v_u2, 'head'),
    'C4  ⚠️ head is NOT an assignable role');
  v_err := pg_temp.expect_error(format('select public.set_member_role(%L, %L, %L)', v_clan, v_u1, 'member'),
    'C4  the founding head’s own role cannot be changed');
  v_err := pg_temp.expect_error(format('select public.set_member_role(%L, %L, %L)', v_clan, v_u5, 'elder'),
    'C4  a non-member cannot be promoted');

  -- ── C5 · removal (doc 15 §5.3) ─────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, false);
  v_err := pg_temp.expect_error(format('select public.remove_member(%L, %L)', v_clan, v_u4),
    'C5  ⚠️ an ELDER may NOT remove a member');

  perform set_config('request.jwt.claims', json_build_object('sub', v_u3, 'role', 'authenticated')::text, false);
  v_err := pg_temp.expect_error(format('select public.remove_member(%L, %L)', v_clan, v_u1),
    'C5  ⚠️ the FOUNDING HEAD cannot be removed, even by a co-head');
  perform pg_temp.assert_true(v_err like '%founding head%', 'C5  …and the refusal says why');
  v_r := public.remove_member(v_clan, v_u4::uuid);
  perform pg_temp.assert_true((v_r->>'removed') = 'true', 'C5  a co-head removes a member (full Head column)');
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from public.clan_members$q$) = 3,
    'C5  three members remain');

  perform set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, false);
  v_err := pg_temp.expect_error(format('select public.remove_member(%L, %L)', v_clan, v_u1),
    'C5  a head cannot remove THEMSELVES — that is leave_clan');
  perform pg_temp.assert_true(v_err like '22023%', 'C5  …and it points at leave_clan instead');

  -- ── C6 · leaving, now that a co-head exists ────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, false);
  v_r := public.leave_clan(v_clan);
  perform pg_temp.assert_true((v_r->>'left') = 'true', 'C6  an ELDER leaves freely');
  perform pg_temp.assert_true((v_r->>'was') = 'elder', 'C6  …and the response names the role they held');

  perform set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, false);
  v_r := public.leave_clan(v_clan);
  perform pg_temp.assert_true((v_r->>'left') = 'true', 'C6  the founder MAY leave once a co-head exists');

  -- ⚠️ Assert as the member who REMAINS. The founder has just left, so under RLS
  -- `is_clan_member(clan_id)` is now false for them and they can see nothing —
  -- counting as them would read 0 and look like a bug in the code, not the test.
  perform set_config('request.jwt.claims', json_build_object('sub', v_u3, 'role', 'authenticated')::text, false);
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from public.clan_members
      where role in ('head','co_head')$q$) = 1,
    'C6  …and exactly one holder of head power remains');
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from public.clan_members$q$) = 1,
    'C6  one member remains — the co-head');
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from public.clan_members
      where user_id = 'aaaa0001-0000-0000-0000-000000000001'$q$) = 0,
    'C6  …and the founder is really gone');
end
$manage$;

-- ═══ C7 · ⚠️ THE ≥1-HEAD INVARIANT LIVES IN THE DATABASE (doc 15 §3) ═══════
-- The RPCs refuse politely (C3), but a direct write must ALSO be refused or the
-- invariant is only a convention. The trigger is DEFERRED, so it normally fires
-- at COMMIT — and a deferred error at COMMIT is NOT catchable by an exception
-- handler inside the same block, which would make this untestable.
-- `set constraints … immediate` forces it to fire on the statement instead, and
-- that must happen INSIDE a transaction (so: inside this block, not at top
-- level, where SET CONSTRAINTS only warns and does nothing).
-- As the OWNER, so this bypasses RLS and tests the trigger alone.
reset role;

do $inv$
declare
  v_clan uuid;
  v_err  text;
begin
  select v into v_clan from pg_temp.fx where k = 'clan';

  set constraints clan_members_keep_a_head immediate;

  v_err := pg_temp.expect_error(
    format('delete from public.clan_members where clan_id = %L and user_id = %L',
           v_clan, 'aaaa0003-0000-0000-0000-000000000003'),
    'C7  the DATABASE refuses a delete that would empty the ladder');

  set constraints all deferred;

  perform pg_temp.assert_true(left(v_err, 5) = '23514',
    'C7  ⚠️ the deferred constraint trigger raises check_violation (23514)');
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from public.clan_members$q$) = 1,
    'C7  …and the refused delete changed nothing');
end
$inv$;

-- back to a signed-in client for the rest
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaa0003-0000-0000-0000-000000000003","role":"authenticated"}', false);

-- ═══ C8 · rename (doc 15 §3 — a Head column capability) ═══════════════════
do $rename$
declare
  v_u3   text := 'aaaa0003-0000-0000-0000-000000000003';
  v_clan uuid;
  v_r    jsonb;
  v_err  text;
begin
  select v into v_clan from pg_temp.fx where k = 'clan';
  perform set_config('request.jwt.claims', json_build_object('sub', v_u3, 'role', 'authenticated')::text, false);

  v_r := public.rename_clan(v_clan, '  Lim Family  ');
  perform pg_temp.assert_true((v_r->>'name') = 'Lim Family', 'C8  a co-head renames the clan (trimmed)');
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from public.clans where name = 'Lim Family'$q$) = 1,
    'C8  …and the new name is readable back through RLS');

  v_err := pg_temp.expect_error(format('select public.rename_clan(%L, %L)', v_clan, 'X'),
    'C8  a 1-character name is refused');
  perform pg_temp.assert_true(v_err like '22023%', 'C8  …as invalid-parameter, not a CHECK blow-up');
  v_err := pg_temp.expect_error(format('select public.rename_clan(%L, %L)', v_clan, repeat('x', 21)),
    'C8  a 21-character name is refused');
end
$rename$;

-- ═══ C9 · THE BOOK OF TRIBUTES — two projections, one window (doc 15 §7) ═══
-- Fixtures as the OWNER (the burn/tribute chain needs a capture first), then the
-- reads as real signed-in users so RLS and the projection both apply.
reset role;

do $bookfix$
declare
  v_clan uuid;
  v_u3   uuid := 'aaaa0003-0000-0000-0000-000000000003';
  v_cap  uuid := 'bbbb0001-0000-0000-0000-000000000001';
  v_b1   uuid := 'bbbb0002-0000-0000-0000-000000000002';
  v_b2   uuid := 'bbbb0003-0000-0000-0000-000000000003';
  v_b3   uuid := 'bbbb0004-0000-0000-0000-000000000004';
begin
  select v into v_clan from pg_temp.fx where k = 'clan';

  insert into public.captures (id, user_id, storage_path, status)
  values (v_cap, v_u3, 'captures/' || v_u3 || '/' || v_cap || '.jpg', 'styled');

  insert into public.burns
    (id, user_id, clan_id, capture_id, band, accuracy, award_snapshot, idempotency_key, created_at)
  values
    (v_b1, v_u3, v_clan, v_cap, 'devout',   20.0, 600, 'clan-t-1', now()),
    (v_b2, v_u3, v_clan, v_cap, 'graze',    50.0, 100, 'clan-t-2', now()),
    (v_b3, v_u3, v_clan, v_cap, 'bullseye',  5.0,  50, 'clan-t-3', now());

  insert into public.tributes (burn_id, user_id, clan_id, item_code, points, visibility, created_at) values
    (v_b1, v_u3, v_clan, 'photo',   600, 'clan',    now() - interval '5 days'),
    (v_b2, v_u3, v_clan, 'photo',   100, 'clan',    now() - interval '45 days'),
    (v_b3, v_u3, v_clan, 'incense',  50, 'private', now() - interval '4 days');
  raise notice '  · book fixtures: 3 tributes (5d clan · 45d clan · 4d private)';
end
$bookfix$;

-- ── as a MEMBER ────────────────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaa0003-0000-0000-0000-000000000003","role":"authenticated"}', false);

do $bookmember$
declare
  v_clan uuid;
  v_r    jsonb;
begin
  select v into v_clan from pg_temp.fx where k = 'clan';
  v_r := public.clan_book(v_clan);

  perform pg_temp.assert_true((v_r->>'found') = 'true', 'C9  the Book resolves for a member');
  perform pg_temp.assert_true((v_r->>'member') = 'true', 'C9  …and reports the caller as a member');
  perform pg_temp.assert_true((v_r->>'window_days') = '30', 'C9  …with the window declared as 30 days');
  perform pg_temp.assert_true(jsonb_array_length(v_r->'entries') = 2,
    'C9  ⚠️ the 45-day entry is HIDDEN from the member (2 of 3 remain)');
  perform pg_temp.assert_true((v_r->'entries'->0->>'member') is not null,
    'C9  a member sees WHO made each offering (§7.2)');
  perform pg_temp.assert_true((v_r->'entries'->0->>'anonymous') = 'false',
    'C9  …and the entry is not flagged anonymous');
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from public.tributes$q$) = 3,
    'C9  ⚠️ …while the hidden row still EXISTS — HIDE, not purge (§10.5)');
end
$bookmember$;

-- ── as a NON-MEMBER (the anonymised projection) ─────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"aaaa0005-0000-0000-0000-000000000005","role":"authenticated"}', false);

do $bookoutsider$
declare
  v_clan uuid;
  v_r    jsonb;
begin
  select v into v_clan from pg_temp.fx where k = 'clan';
  v_r := public.clan_book(v_clan);

  perform pg_temp.assert_true((v_r->>'found') = 'true', 'C9  the Book resolves for a NON-member too');
  perform pg_temp.assert_true((v_r->>'member') = 'false', 'C9  …and reports them as a non-member');
  perform pg_temp.assert_true(jsonb_array_length(v_r->'entries') = 1,
    'C9  ⚠️ a non-member sees ONE entry — the private one is withheld too');
  perform pg_temp.assert_true((v_r->'entries'->0->>'member') is null,
    'C9  ⚠️ …and WHO is WITHHELD (§7.2 — the anonymised projection)');
  perform pg_temp.assert_true((v_r->'entries'->0->>'anonymous') = 'true',
    'C9  …with the entry explicitly flagged anonymous');
  perform pg_temp.assert_true((v_r->'entries'->0->>'points') is not null,
    'C9  …but the facts that remain (points) are still there');

  perform pg_temp.assert_true(
    (public.clan_book('00000000-0000-0000-0000-0000000000ff'::uuid)->>'found') = 'false',
    'C9  an unknown clan id returns found=false, not an error or an empty leak');
end
$bookoutsider$;

-- ═══ C10 · delete_clan — head only, and it takes everything with it ════════
do $del$
declare
  v_u3   text := 'aaaa0003-0000-0000-0000-000000000003';
  v_u5   text := 'aaaa0005-0000-0000-0000-000000000005';
  v_clan uuid;
  v_r    jsonb;
  v_err  text;
begin
  select v into v_clan from pg_temp.fx where k = 'clan';

  -- a signed-in NON-member cannot delete someone else's clan
  perform set_config('request.jwt.claims', json_build_object('sub', v_u5, 'role', 'authenticated')::text, false);
  v_err := pg_temp.expect_error(format('select public.delete_clan(%L)', v_clan),
    'C10 ⚠️ a NON-member may NOT delete the clan');
  perform pg_temp.assert_true(v_err like '42501%', 'C10 …as a permission error (42501)');

  -- the co-head can (doc 15 §3: the full Head column, delete included)
  perform set_config('request.jwt.claims', json_build_object('sub', v_u3, 'role', 'authenticated')::text, false);
  v_r := public.delete_clan(v_clan);
  perform pg_temp.assert_true((v_r->>'deleted') = 'true', 'C10 a co-head deletes the clan');
  perform pg_temp.assert_true((v_r->>'member_count') = '1', 'C10 …and the counts describe what was destroyed');
  perform pg_temp.assert_true((v_r->>'ancestor_count') = '0', 'C10 …ancestors included');

  -- ⚠️ the deferred ≥1-head trigger must NOT block this: at check time the clan
  -- row is already gone, so there is no clan left to be headless (that is why
  -- the trigger is DEFERRABLE — see 0012 section B).
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from public.clan_members$q$) = 0,
    'C10 …and the members went with it — the invariant did not block the delete');
end
$del$;

-- ═══ C13 · THE HEAD-EXIT RAMP — SCRUM-84 (PM-answered 2026-10-08) ══════════
-- The RULE CHANGED here, so the old promote-first assertions above (C3) now
-- cover only the no-candidate case. These are purpose-built fixtures: each clan
-- has an EXPLICIT `joined_at`, which makes "the oldest elder" deterministic AND
-- keeps the joins-per-hour limb clear (it only counts joins inside the hour).
--
-- u5 is the head in every fixture — u1 and u2 are erased later by C12, and u4 is
-- the subject of C11's anti-abuse counts, so neither may be borrowed here.
reset role;

do $rampfix$
declare
  v_u2  uuid := 'aaaa0002-0000-0000-0000-000000000002';
  v_u3  uuid := 'aaaa0003-0000-0000-0000-000000000003';
  v_u5  uuid := 'aaaa0005-0000-0000-0000-000000000005';
  v_c   uuid;
begin
  -- A · two elders, nobody named → the OLDEST (u2, Feb) must win over u3 (Jun)
  insert into public.clans (name, code, created_by) values ('Ramp Auto', 'RAMPAXYZ', v_u5)
    returning id into v_c;
  insert into pg_temp.fx values ('rampA', v_c, null);
  insert into public.clan_members (clan_id, user_id, role, joined_at) values
    (v_c, v_u5, 'head',  timestamptz '2026-01-01'),
    (v_c, v_u2, 'elder', timestamptz '2026-02-01'),
    (v_c, v_u3, 'elder', timestamptz '2026-06-01');

  -- B · no elder, but the head NAMES a plain member → that member is promoted
  insert into public.clans (name, code, created_by) values ('Ramp Named', 'RAMPBXYZ', v_u5)
    returning id into v_c;
  insert into pg_temp.fx values ('rampB', v_c, null);
  insert into public.clan_members (clan_id, user_id, role, joined_at) values
    (v_c, v_u5, 'head',   timestamptz '2026-01-01'),
    (v_c, v_u2, 'member', timestamptz '2026-02-01');

  -- C · two elders joined THE SAME SECOND → the uuid tiebreak must decide (u2 < u3)
  insert into public.clans (name, code, created_by) values ('Ramp Tie', 'RAMPCXYZ', v_u5)
    returning id into v_c;
  insert into pg_temp.fx values ('rampTie', v_c, null);
  insert into public.clan_members (clan_id, user_id, role, joined_at) values
    (v_c, v_u5, 'head',  timestamptz '2026-01-01'),
    (v_c, v_u3, 'elder', timestamptz '2026-03-01 09:00:00+00'),
    (v_c, v_u2, 'elder', timestamptz '2026-03-01 09:00:00+00');

  -- D · no co-head, no elder, nobody named → REFUSED (the case the PM did not cover)
  insert into public.clans (name, code, created_by) values ('Ramp None', 'RAMPDXYZ', v_u5)
    returning id into v_c;
  insert into pg_temp.fx values ('rampNone', v_c, null);
  insert into public.clan_members (clan_id, user_id, role, joined_at) values
    (v_c, v_u5, 'head',   timestamptz '2026-01-01'),
    (v_c, v_u3, 'member', timestamptz '2026-02-01');

  -- E · a co-head exists → the head simply leaves, nobody is promoted
  insert into public.clans (name, code, created_by) values ('Ramp CoHead', 'RAMPEXYZ', v_u5)
    returning id into v_c;
  insert into pg_temp.fx values ('rampCo', v_c, null);
  insert into public.clan_members (clan_id, user_id, role, joined_at) values
    (v_c, v_u5, 'head',    timestamptz '2026-01-01'),
    (v_c, v_u2, 'co_head', timestamptz '2026-02-01');

  raise notice '  · ramp fixtures: five clans with explicit join times';
end
$rampfix$;

do $rampcall$
declare
  v_u1   text := 'aaaa0001-0000-0000-0000-000000000001';
  v_u2   text := 'aaaa0002-0000-0000-0000-000000000002';
  v_u3   text := 'aaaa0003-0000-0000-0000-000000000003';
  v_u5   text := 'aaaa0005-0000-0000-0000-000000000005';
  v_clan uuid;
  v_r    jsonb;
  v_err  text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_u5, 'role', 'authenticated')::text, false);

  -- ── A · NOBODY NAMED → the oldest elder (u2, Feb) is auto-promoted ──────
  select v into v_clan from pg_temp.fx where k = 'rampA';
  v_r := public.leave_clan(v_clan);
  perform pg_temp.assert_true((v_r->>'left') = 'true', 'C13 the sole head DOES leave now (SCRUM-84)');
  perform pg_temp.assert_true((v_r->>'auto_promoted') = 'true', 'C13 ⚠️ …and it reports the SERVER chose');
  perform pg_temp.assert_true((v_r->>'successor') = v_u2, 'C13 ⚠️ …the OLDEST elder (Feb), not u3 (Jun)');
  perform pg_temp.assert_true((v_r->>'was') = 'head', 'C13 …and it names the role they left with');

  -- ── B · NAMED → the named member is promoted, no auto choice ───────────
  select v into v_clan from pg_temp.fx where k = 'rampB';
  v_r := public.leave_clan(v_clan, v_u2::uuid);
  perform pg_temp.assert_true((v_r->>'successor') = v_u2, 'C13 a NAMED successor is the one promoted');
  perform pg_temp.assert_true((v_r->>'auto_promoted') = 'false', 'C13 …and it is NOT reported as an auto choice');
  perform pg_temp.assert_true((v_r->>'left') = 'true', 'C13 …and the head still leaves');

  -- ── C · a TIE on joined_at → the uuid tiebreak decides ─────────────────
  select v into v_clan from pg_temp.fx where k = 'rampTie';
  v_r := public.leave_clan(v_clan);
  perform pg_temp.assert_true((v_r->>'successor') = v_u2,
    'C13 ⚠️ a tie on joined_at breaks on user_id — deterministic, not storage order');

  -- ── D · no co-head, no elder, nobody named → REFUSED ───────────────────
  select v into v_clan from pg_temp.fx where k = 'rampNone';
  v_err := pg_temp.expect_error(format('select public.leave_clan(%L)', v_clan),
    'C13 ⚠️ with no candidate at all the leave is REFUSED');
  perform pg_temp.assert_true(v_err like '%promote a co-head%',
    'C13 …and the refusal still names that way out');

  -- the two validation refusals, which never reach the candidate search
  v_err := pg_temp.expect_error(format('select public.leave_clan(%L, %L)', v_clan, v_u5),
    'C13 naming YOURSELF as successor is refused');
  perform pg_temp.assert_true(v_err like '22023%', 'C13 …as invalid-parameter (22023)');
  v_err := pg_temp.expect_error(format('select public.leave_clan(%L, %L)', v_clan, v_u1),
    'C13 naming a NON-member as successor is refused');
  perform pg_temp.assert_true(v_err like '22023%', 'C13 …as invalid-parameter too');

  -- ── E · a co-head exists → simply leave, nobody is promoted ────────────
  select v into v_clan from pg_temp.fx where k = 'rampCo';
  v_r := public.leave_clan(v_clan);
  perform pg_temp.assert_true((v_r->>'left') = 'true', 'C13 a head with a co-head simply leaves');
  perform pg_temp.assert_true((v_r->>'successor') is null, 'C13 …and NOBODY is promoted — none was needed');
  perform pg_temp.assert_true((v_r->>'auto_promoted') = 'false', 'C13 …and nothing was auto-chosen');
end
$rampcall$;

-- ── the end state, read as the OWNER so RLS cannot flatter it ──────────────
reset role;

select pg_temp.assert_true(
  pg_temp.count_where(format($q$select count(*) from public.clan_members
    where user_id = 'aaaa0005-0000-0000-0000-000000000005' and clan_id in
      (select v from pg_temp.fx where k in ('rampA','rampB','rampTie','rampCo'))$q$)) = 0,
  'C13 the departing head is gone from all four clans that accepted the leave');
select pg_temp.assert_true(
  pg_temp.count_where(format($q$select count(*) from public.clan_members
    where user_id = 'aaaa0005-0000-0000-0000-000000000005'
      and clan_id = (select v from pg_temp.fx where k = 'rampNone')$q$)) = 1,
  'C13 ⚠️ …and is STILL in the one that refused — a refusal changes nothing');
select pg_temp.assert_true(
  pg_temp.count_where(format($q$select count(*) from public.clan_members
    where clan_id = (select v from pg_temp.fx where k = 'rampA') and role = 'co_head'$q$)) = 1,
  'C13 ⚠️ the auto-promoted elder now holds HEAD POWER (co_head), so the clan is not headless');
select pg_temp.assert_true(
  pg_temp.count_where(format($q$select count(*) from public.clan_members
    where clan_id = (select v from pg_temp.fx where k = 'rampA')
      and user_id = 'aaaa0002-0000-0000-0000-000000000002' and role = 'co_head'$q$)) = 1,
  'C13 …and it is the eldest elder who holds it');
select pg_temp.assert_true(
  pg_temp.count_where(format($q$select count(*) from public.clan_members
    where clan_id = (select v from pg_temp.fx where k = 'rampA')
      and user_id = 'aaaa0003-0000-0000-0000-000000000003' and role = 'elder'$q$)) = 1,
  'C13 …while the younger elder is left exactly as they were');
select pg_temp.assert_true(
  pg_temp.count_where(format($q$select count(*) from public.clan_members
    where clan_id = (select v from pg_temp.fx where k = 'rampCo')
      and role in ('head','co_head')$q$)) = 1,
  'C13 the co-head clan kept exactly one holder of head power');

-- verify the rest of the cascade as the OWNER, so RLS cannot flatter the count
reset role;

select pg_temp.assert_true(
  pg_temp.count_where(format($q$select count(*) from public.clans where id = %L$q$,
    (select v from pg_temp.fx where k = 'clan'))) = 0,
  'C10 the clan row is gone');
select pg_temp.assert_true(
  pg_temp.count_where(format($q$select count(*) from public.tributes where clan_id = %L$q$,
    (select v from pg_temp.fx where k = 'clan'))) = 0,
  'C10 ⚠️ the Book entries cascaded too');
select pg_temp.assert_true(
  pg_temp.count_where(format($q$select count(*) from public.burns where clan_id = %L$q$,
    (select v from pg_temp.fx where k = 'clan'))) = 0,
  'C10 …and the burns');

-- ═══ C11 · ANTI-ABUSE (doc 15 §5.2) ════════════════════════════════════════
-- Both limbs, and specifically that the JOINS-PER-HOUR limb is REACHABLE.
-- It was NOT when this ticket first wrote it (`c_joins_per_hour` was also 10):
-- a membership IS a clan, so an hourly limit equal to the clan cap can never
-- fire — the clan limb always binds first and the join limb is dead logic.
-- This block is what caught that, and it is why it is a gate and not a comment.
do $abuse$
declare
  v_u1   uuid := 'aaaa0001-0000-0000-0000-000000000001';
  v_u2   uuid := 'aaaa0002-0000-0000-0000-000000000002';
  v_u4   uuid := 'aaaa0004-0000-0000-0000-000000000004';
  v_keeper uuid;
  v_clan uuid;
  v_err  text;
  i      integer;
begin
  -- 11 spare clans — one more than the cap, so the cap is provable.
  -- ⚠️ Every spare clan gets a HEAD. A clan with no head is not a valid clan
  -- (doc 15 §3), and the invariant trigger says so loudly — which is exactly
  -- what this fixture discovered when they were first inserted headless. Two
  -- keepers, so neither burns its own clan cap: u1 heads 1..6, u2 heads 7..11.
  for i in 1..11 loop
    v_keeper := case when i <= 6 then v_u1 else v_u2 end;
    insert into public.clans (name, code, created_by)
    values ('Spare ' || i,
            'SPARE' || substr('ABCDEFGHJKMNPQRSTUVWXYZ', i, 1) || 'XY',
            v_keeper)
    returning id into v_clan;
    insert into public.clan_members (clan_id, user_id, role, joined_at)
    values (v_clan, v_keeper, 'head', now() - interval '3 hours');
    insert into pg_temp.fx values ('spare' || i, v_clan, null);
  end loop;

  -- ── limb 1 · joins per hour (3) ────────────────────────────────────────
  for i in 1..3 loop
    select v into v_clan from pg_temp.fx where k = 'spare' || i;
    insert into public.clan_members (clan_id, user_id) values (v_clan, v_u4);
  end loop;
  perform pg_temp.assert_true(
    pg_temp.count_where(format($q$select count(*) from public.clan_members where user_id = %L$q$, v_u4)) = 3,
    'C11 three joins inside the hour are allowed');

  select v into v_clan from pg_temp.fx where k = 'spare4';
  v_err := pg_temp.expect_error(
    format('insert into public.clan_members (clan_id, user_id) values (%L, %L)', v_clan, v_u4),
    'C11 the 4th join in one hour is refused');
  perform pg_temp.assert_true(v_err like '%too many clan joins%',
    'C11 ⚠️ …by the JOINS-PER-HOUR limb (below the cap) — the limb is REACHABLE');

  -- ── limb 2 · clans per user (10) ───────────────────────────────────────
  -- Back-date every join so the hourly limb is clear and the clan cap is the
  -- only thing left that can bind.
  update public.clan_members set joined_at = now() - interval '3 hours' where user_id = v_u4;
  for i in 4..10 loop
    select v into v_clan from pg_temp.fx where k = 'spare' || i;
    insert into public.clan_members (clan_id, user_id, joined_at)
    values (v_clan, v_u4, now() - interval '3 hours');
  end loop;
  perform pg_temp.assert_true(
    pg_temp.count_where(format($q$select count(*) from public.clan_members where user_id = %L$q$, v_u4)) = 10,
    'C11 ten clans are allowed');

  select v into v_clan from pg_temp.fx where k = 'spare11';
  v_err := pg_temp.expect_error(
    format('insert into public.clan_members (clan_id, user_id) values (%L, %L)', v_clan, v_u4),
    'C11 the 11th clan is refused');
  perform pg_temp.assert_true(v_err like '%at most 10 clans%',
    'C11 ⚠️ …by the CLANS-PER-USER cap');
end
$abuse$;

-- ═══ C12 · AN ERRASURE IS NEVER BLOCKED (doc 13 · doc 15 §3) ═══════════════
-- The invariant must not outrank a privacy deletion. `delete_my_data()` removes
-- a user's memberships, then the clans they founded, then their profile — and a
-- co-head who is NOT the founder can erase their data and legitimately orphan a
-- clan. The trigger exempts that case by checking the PROFILE.
-- ⚠️ FAULT-TEST IT: delete the profile exemption from `enforce_clan_has_head`
-- (0012 section B) and this block goes RED. It is the reason the exemption is
-- in the trigger at all — the first cut of 0012 would have blocked a GDPR
-- deletion, and running this file is what found it.
do $erase$
declare
  v_u1   uuid := 'aaaa0001-0000-0000-0000-000000000001';
  v_u2   uuid := 'aaaa0002-0000-0000-0000-000000000002';
  v_clan uuid := 'cccc0001-0000-0000-0000-000000000001';
  v_blocked text;
begin
  -- a clan FOUNDED by u2 whose only holder of head power is u1 — reachable in
  -- real life via the §10.4 promote-then-leave ramp
  insert into public.clans (id, name, code, created_by)
  values (v_clan, 'Orphan Test', 'RPHAN234', v_u2);
  insert into public.clan_members (clan_id, user_id, role, joined_at)
  values (v_clan, v_u1, 'head', now() - interval '3 hours');
  insert into pg_temp.fx values ('orphan', v_clan, null);

  -- the exact shape of delete_my_data(): memberships → founded clans → profile.
  -- `set constraints … immediate` forces the queued check to run HERE, inside
  -- the block, so a blocker is catchable instead of surfacing at COMMIT.
  begin
    delete from public.clan_members where user_id = v_u1;
    delete from public.clans        where created_by = v_u1;
    delete from public.profiles     where user_id = v_u1;
    set constraints clan_members_keep_a_head immediate;
    set constraints all deferred;
  exception when others then
    v_blocked := sqlerrm;
  end;

  perform pg_temp.assert_true(v_blocked is null,
    format('C12 ⚠️ an erasure is never blocked by the invariant (%s)',
           coalesce(v_blocked, 'not blocked')));
  perform pg_temp.assert_true(
    pg_temp.count_where(format($q$select count(*) from public.clans where id = %L$q$, v_clan)) = 1,
    'C12 …and the orphaned clan survives — the erasure wins, as it must');
end
$erase$;

-- ═══ TEARDOWN ══════════════════════════════════════════════════════════════
-- Leaves no residue: a re-run must start from the same place. Owned by the
-- session user and SECURITY DEFINER, so it runs with the owner's rights even if
-- the file left the role switched.
create or replace function pg_temp.clan_teardown()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_users uuid[] := array[
    'aaaa0001-0000-0000-0000-000000000001',
    'aaaa0002-0000-0000-0000-000000000002',
    'aaaa0003-0000-0000-0000-000000000003',
    'aaaa0004-0000-0000-0000-000000000004',
    'aaaa0005-0000-0000-0000-000000000005'];
begin
  -- clans FIRST: clans.created_by has no ON DELETE cascade, so deleting the
  -- profile first would be refused (the same ordering note as pr3_verification)
  delete from public.clans where created_by = any(v_users);
  -- deleting the profile cascades every personal table (captures · burns ·
  -- ledger_events · quotas · …) and the membership rows
  delete from public.profiles where user_id = any(v_users);
  delete from auth.users where id = any(v_users);
end;
$$;

select pg_temp.clan_teardown();

select pg_temp.assert_true(
  pg_temp.count_where($q$select count(*) from auth.users where id in (
    'aaaa0001-0000-0000-0000-000000000001','aaaa0002-0000-0000-0000-000000000002',
    'aaaa0003-0000-0000-0000-000000000003','aaaa0004-0000-0000-0000-000000000004',
    'aaaa0005-0000-0000-0000-000000000005')$q$) = 0,
  'TEARDOWN the fixture users are gone — the file is re-run safe');
select pg_temp.assert_true(
  pg_temp.count_where($q$select count(*) from public.clans where name like 'Spare %'$q$) = 0,
  'TEARDOWN the spare clans are gone');
