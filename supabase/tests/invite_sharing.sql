-- ═══════════════════════════════════════════════════════════════════════════
-- SCRUM-86 VERIFICATION — the invite code is ELDER-AND-ABOVE, on a REAL database
--
-- ── WHAT IT PROVES ──────────────────────────────────────────────────────────
-- PM, 2026-10-09: *"limit link sharing to elder and above seniority."*
-- Migration `0015` makes that a DATABASE rule, not a client one:
--
--   S1  an ELDER gets the code through `clan_invite_code`
--   S2  …and it is the clan's REAL code, not a placeholder
--   S3  a CO-HEAD gets it   ·  S4  the HEAD gets it
--   S5  ⚠️ a plain MEMBER is REFUSED
--   S6  ⚠️ a NON-MEMBER is REFUSED
--   S7  ⚠️ a member CANNOT read `clans.code` directly — `permission denied` —
--       while the SAME query on other columns SUCCEEDS. The pair is the point:
--       on its own, a denied query could be a denied ROW.
--   S8  ⚠️ an ELDER cannot read the column directly either. The revoke is
--       UNILATERAL — the RPC is the only path for everyone, so a future change
--       to the ladder cannot be bypassed by a direct select.
--   S9  ⚠️ THE GRANT-LIST GUARD: `authenticated` holds SELECT on EVERY column of
--       `clans` except `code`. A column added later without being listed in
--       `0015` fails HERE instead of silently vanishing from the client.
--   S10 `reroll_clan_code` still WORKS for a head — the `RETURNING code` that
--       `0015` had to remove (it read a column the role no longer has)
--   S11 ⚠️ …and still REFUSES an elder: the asymmetry is real, not just prose
--   S12 `anon` cannot execute the RPC at all
--
-- ── WHY A SEPARATE FILE ─────────────────────────────────────────────────────
-- `clan_management.sql` mutates its fixtures as it goes (C1 → C13), so a section
-- appended to the end would inherit whatever the ramp left behind. This file
-- builds its OWN fixtures, is order-independent, and tears them down.
--
-- ── HOW TO RUN IT (locally — ⚠️ `--network host` or every file reads "refused")
--   npx supabase start && npx supabase db reset
--   docker run --rm -i --network host postgres:17 psql \
--     "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -q -f - < supabase/tests/invite_sharing.sql
--
-- ── ⚠️ FAULT-TEST IT ────────────────────────────────────────────────────────
-- Replace the `revoke select on table public.clans from authenticated;` in
-- `0015` with the column-only form `revoke select (code) on public.clans from
-- authenticated;` and re-run: **S7 and S8 must go RED.** That is the whole
-- point — a column revoke on top of a TABLE-wide grant is a **silent no-op**,
-- and this file is what turns that silence into a failure.
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

-- ═══ FIXTURES (as the database owner — the owner bypasses RLS, so the ladder
--     can be written directly instead of being built up through RPCs) ════════
do $setup$
declare
  v_head uuid := 'bbbb0001-0000-0000-0000-000000000001';
  v_co   uuid := 'bbbb0002-0000-0000-0000-000000000002';
  v_eld  uuid := 'bbbb0003-0000-0000-0000-000000000003';
  v_mem  uuid := 'bbbb0004-0000-0000-0000-000000000004';
  v_out  uuid := 'bbbb0005-0000-0000-0000-000000000005';
  v_clan uuid;
begin
  -- pre-clean, so a RE-RUN after a failed run is safe
  delete from public.clans    where created_by in (v_head, v_co, v_eld, v_mem, v_out);
  delete from public.profiles where user_id    in (v_head, v_co, v_eld, v_mem, v_out);
  delete from auth.users      where id         in (v_head, v_co, v_eld, v_mem, v_out);

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         u::text || '@example.invalid', '', now(),
         '{"provider":"anonymous","providers":["anonymous"]}', '{}', now(), now()
  from unnest(array[v_head, v_co, v_eld, v_mem, v_out]) as u;

  -- the profile bootstrap is a trigger on auth.users; make sure it fired, because
  -- `clans.created_by` and `clan_members.user_id` both reference `profiles`
  insert into public.profiles (user_id, display_label)
  select u, public.pseudonym_for(u)
  from unnest(array[v_head, v_co, v_eld, v_mem, v_out]) as u
  on conflict (user_id) do nothing;

  -- ⚠️ A REAL 8-char code from the CHECK alphabet — no I, L, O, 0 or 1
  insert into public.clans (name, code, created_by)
  values ('Invite Family', 'JVSHARE2', v_head)
  returning id into v_clan;

  -- the whole ladder in one clan, so every branch is one call away
  insert into public.clan_members (clan_id, user_id, role) values
    (v_clan, v_head, 'head'),
    (v_clan, v_co,   'co_head'),
    (v_clan, v_eld,  'elder'),
    (v_clan, v_mem,  'member');
  -- v_out is deliberately NOT a member

  raise notice 'setup: one clan (JVSHARE2) with head · co_head · elder · member, plus an outsider';
end
$setup$;

create table pg_temp.fx (k text primary key, v uuid, s text);
grant select, insert, update, delete on pg_temp.fx to authenticated;
insert into pg_temp.fx
  select 'clan', id, code from public.clans where code = 'JVSHARE2';

set role authenticated;

-- ═══ S1..S8, S10, S11 · the ladder, driven as real signed-in users ══════════
do $ladder$
declare
  v_head text := 'bbbb0001-0000-0000-0000-000000000001';
  v_co   text := 'bbbb0002-0000-0000-0000-000000000002';
  v_eld  text := 'bbbb0003-0000-0000-0000-000000000003';
  v_mem  text := 'bbbb0004-0000-0000-0000-000000000004';
  v_out  text := 'bbbb0005-0000-0000-0000-000000000005';
  v_clan uuid;
  v_code text;
  v_r    jsonb;
  v_err  text;
begin
  select v, s into v_clan, v_code from pg_temp.fx where k = 'clan';

  -- ── S1 · an ELDER — the new floor of the rule ──────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_eld, 'role','authenticated')::text, false);
  v_r := public.clan_invite_code(v_clan);
  perform pg_temp.assert_true((v_r->>'code') = v_code, 'S1  an ELDER gets the invite code — SCRUM-86: elder and above');
  perform pg_temp.assert_true((v_r->>'role') = 'elder', 'S1  …and is told their OWN role');
  perform pg_temp.assert_true((v_r->>'clan_id') = v_clan::text, 'S1  …scoped to the clan asked for');
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from public.clan_members$q$) = 4,
    'S1  (control) the roster IS readable, so the refusals below are not vacuous');

  -- ── S2 · it is the clan's REAL code, not a placeholder ─────────────────
  perform pg_temp.assert_true(length(v_r->>'code') = 8, 'S2  the code is the real 8-character capability');

  -- ── S3 / S4 · the roles ABOVE the elder keep their access ──────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_co, 'role','authenticated')::text, false);
  perform pg_temp.assert_true(
    (public.clan_invite_code(v_clan)->>'code') = v_code, 'S3  a CO-HEAD gets the invite code');
  perform set_config('request.jwt.claims', json_build_object('sub', v_head, 'role','authenticated')::text, false);
  perform pg_temp.assert_true(
    (public.clan_invite_code(v_clan)->>'code') = v_code, 'S4  the HEAD gets the invite code');

  -- ── S5 · ⚠️ a plain MEMBER is the boundary the PM drew ─────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_mem, 'role','authenticated')::text, false);
  v_err := pg_temp.expect_error(
    format($q$select public.clan_invite_code(%L::uuid)$q$, v_clan),
    'S5  ⚠️ a plain MEMBER is REFUSED the invite code');
  perform pg_temp.assert_true(starts_with(v_err, '42501'),
    'S5  …with 42501 (insufficient_privilege), not a generic failure');
  perform pg_temp.assert_true(position('elder' in v_err) > 0,
    'S5  …and the message names the rule, so the refusal is actionable');

  -- ── S6 · a non-member is refused too ──────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_out, 'role','authenticated')::text, false);
  v_err := pg_temp.expect_error(
    format($q$select public.clan_invite_code(%L::uuid)$q$, v_clan),
    'S6  a NON-MEMBER is refused');
  perform pg_temp.assert_true(starts_with(v_err, '42501'), 'S6  …with 42501');

  -- ── S7 · ⚠️ the COLUMN is deniable, and the PAIR proves it is the column ─
  perform set_config('request.jwt.claims', json_build_object('sub', v_mem, 'role','authenticated')::text, false);
  perform pg_temp.assert_true(
    pg_temp.count_where(format($q$select count(*) from public.clans where id = %L::uuid$q$, v_clan)) = 1,
    'S7  (control) a member CAN still read the ROW — id and name stay granted');
  v_err := pg_temp.expect_error(
    format($q$select code from public.clans where id = %L::uuid$q$, v_clan),
    'S7  ⚠️ …but selecting `code` directly is DENIED');
  perform pg_temp.assert_true(starts_with(v_err, '42501'),
    'S7  …so the row is readable and the COLUMN is what is protected');

  -- ── S8 · ⚠️ the revoke is UNILATERAL — an elder may not read it either ─
  perform set_config('request.jwt.claims', json_build_object('sub', v_eld, 'role','authenticated')::text, false);
  v_err := pg_temp.expect_error(
    format($q$select code from public.clans where id = %L::uuid$q$, v_clan),
    'S8  ⚠️ an ELDER is denied the column too — the RPC is the ONLY path for everyone');
  perform pg_temp.assert_true(starts_with(v_err, '42501'),
    'S8  …so no future ladder change can be bypassed by a direct select');

  -- ── S10 · reroll still WORKS for a head (the `RETURNING code` fix) ─────
  perform set_config('request.jwt.claims', json_build_object('sub', v_head, 'role','authenticated')::text, false);
  v_r := public.reroll_clan_code(v_clan);
  perform pg_temp.assert_true(length(v_r->>'code') = 8,
    'S10 a head CAN re-roll — the old body read a column it no longer has, and 0015 fixed that');
  perform pg_temp.assert_true((v_r->>'code') <> v_code, 'S10 …the re-rolled code is genuinely new');
  v_code := v_r->>'code';

  -- …and the elder reads the NEW code, so the rotation really reached them
  perform set_config('request.jwt.claims', json_build_object('sub', v_eld, 'role','authenticated')::text, false);
  perform pg_temp.assert_true((public.clan_invite_code(v_clan)->>'code') = v_code,
    'S10 …and an elder now reads the NEW code');

  -- ── S11 · ⚠️ an elder still may NOT re-roll (sharing ≠ retiring) ───────
  v_err := pg_temp.expect_error(
    format($q$select public.reroll_clan_code(%L::uuid)$q$, v_clan),
    'S11 ⚠️ an ELDER is refused a RE-ROLL — sharing is elder+, retiring is head-only');
  perform pg_temp.assert_true(starts_with(v_err, '42501'), 'S11 …with 42501');
end
$ladder$;

reset role;


-- ═══ S9 / S12 · THE GRANTS THEMSELVES, read as the owner so nothing is filtered
--     by the caller's own visibility of information_schema ═══════════════════
do $grants$
declare
  v_missing integer;
begin
  -- S9 · every column EXCEPT code must be readable, or a column added later
  --      silently disappears from the client the moment it is added.
  select count(*) into v_missing
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'clans' and c.column_name <> 'code'
    and not exists (
      select 1 from information_schema.column_privileges p
      where p.table_schema = 'public' and p.table_name = 'clans'
        and p.column_name = c.column_name
        and p.grantee = 'authenticated' and p.privilege_type = 'SELECT');
  perform pg_temp.assert_true(v_missing = 0,
    'S9  ⚠️ authenticated holds SELECT on EVERY clans column except code');

  -- …and code is the single exception
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from information_schema.column_privileges
      where table_schema='public' and table_name='clans' and column_name='code'
        and grantee='authenticated' and privilege_type='SELECT'$q$) = 0,
    'S9  ⚠️ …and on `code` itself: ZERO SELECT grants');

  -- S12 · the RPC's own existence and grants, by CATALOG rather than by role
  --       switching — exactly what 0015 granted, so the two cannot drift
  perform pg_temp.assert_true(
    pg_temp.count_where($q$select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname='clan_invite_code'$q$) = 1,
    'S12 clan_invite_code exists in public');

  perform pg_temp.assert_true(
    not has_function_privilege('anon', 'public.clan_invite_code(uuid)', 'execute'),
    'S12 anon may NOT execute it');

  perform pg_temp.assert_true(
    has_function_privilege('authenticated', 'public.clan_invite_code(uuid)', 'execute'),
    'S12 authenticated MAY — the ladder INSIDE the function is the real gate');

  -- S13 · ⚠️ `anon` loses the WHOLE table, not just the column — a deliberate
  -- side effect of dropping the table-wide grant, and worth pinning because it is
  -- the kind of thing that looks like a mistake later. It is the TIGHTER posture
  -- and the PR-3 harness accepts it: `pr3_verification.sql`'s R4 loop treats a
  -- table anon cannot read at all as *"also 'reads nothing'"*, alongside the 0-row
  -- case. Nothing in the client reads `clans` before a session exists — every
  -- read happens as `authenticated`.
  perform pg_temp.assert_true(
    not has_table_privilege('anon', 'public.clans', 'select'),
    'S13 anon cannot select `clans` at all — tighter than 0 rows, and R4-safe');
end
$grants$;

-- ═══ TEARDOWN ══════════════════════════════════════════════════════════════
-- Leaves no residue: a re-run must start from the same place. SECURITY DEFINER
-- so it runs with the owner's rights whatever role the file left set.
create or replace function pg_temp.invite_teardown()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_users uuid[] := array[
    'bbbb0001-0000-0000-0000-000000000001',
    'bbbb0002-0000-0000-0000-000000000002',
    'bbbb0003-0000-0000-0000-000000000003',
    'bbbb0004-0000-0000-0000-000000000004',
    'bbbb0005-0000-0000-0000-000000000005'];
begin
  -- clans FIRST: clans.created_by has no ON DELETE cascade, so deleting the
  -- profile first would be refused (the same ordering note as the other files)
  delete from public.clans where created_by = any(v_users);
  delete from public.profiles where user_id = any(v_users);
  delete from auth.users where id = any(v_users);
end;
$$;

select pg_temp.invite_teardown();

select pg_temp.assert_true(
  pg_temp.count_where($q$select count(*) from auth.users where id in (
    'bbbb0001-0000-0000-0000-000000000001','bbbb0002-0000-0000-0000-000000000002',
    'bbbb0003-0000-0000-0000-000000000003','bbbb0004-0000-0000-0000-000000000004',
    'bbbb0005-0000-0000-0000-000000000005')$q$) = 0,
  'TEARDOWN the fixture users are gone — the file is re-run safe');
select pg_temp.assert_true(
  pg_temp.count_where($q$select count(*) from public.clans where name = 'Invite Family'$q$) = 0,
  'TEARDOWN the fixture clan is gone');

