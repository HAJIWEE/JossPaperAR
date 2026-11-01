-- ═══════════════════════════════════════════════════════════════════════════
-- MY OFFERINGS — the History read (SCRUM-151)
--
-- Everything here is an ASSERTION THAT RAISES ON FAILURE, so the run is green or it
-- is red — never "looks about right".
--
-- ── HOW TO RUN IT ───────────────────────────────────────────────────────────
-- The local Docker stack needs no account and no link, and it applies the migrations
-- from the files:
--
--   npx supabase start
--   bash supabase/checks/run-sql-tests.sh "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
--
-- ── WHAT IT PROVES ─────────────────────────────────────────────────────────
--   O1  the caller sees their OWN burns, newest first — and nobody else's
--   O2  the fields `account-api.ts` parses are the fields the RPC returns
--   O3  the band and the award come back AS STORED (never re-derived)
--   O4  ⚠️ p_limit is CLAMPED — 0 reads one row, not none
--   O5  the THIS WEEK block counts the trailing 7 days, and only the caller's
--   O6  ⚠️ no identity RAISES — "you burned nothing" and "you are not signed in"
--       must not render identically
--
-- ⚠️ The fixtures are inserted as the SUPERUSER, because `burns` has RLS enabled with
-- no policy (server-written by design). The assertions then run as `authenticated`,
-- which is the whole point: the RPC must be readable by the role the app actually is.
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

do $setup$
declare
  v_u1 uuid := 'bbbb0001-0000-0000-0000-000000000001';
  v_u2 uuid := 'bbbb0002-0000-0000-0000-000000000002';
begin
  -- pre-clean, so a RE-RUN after a failed run is safe
  delete from public.burns    where user_id in (v_u1, v_u2);
  delete from public.clans    where created_by in (v_u1, v_u2);
  delete from public.profiles where user_id in (v_u1, v_u2);
  delete from auth.users      where id in (v_u1, v_u2);

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         u::text || '@example.invalid', '', now(),
         '{"provider":"anonymous","providers":["anonymous"]}', '{}', now(), now()
  from unnest(array[v_u1, v_u2]) as u;

  raise notice 'setup: two anonymous users (the profile bootstrap should fire)';
end
$setup$;

-- A pg_temp table carries the fixture id between DO blocks (each block has its own
-- scope). ⚠️ GRANT required: a temp table grants nothing to PUBLIC, and the blocks
-- below run as `authenticated`.
create table pg_temp.fx (k text primary key, v uuid);
grant select, insert, update, delete on pg_temp.fx to authenticated;

-- ── the clan, created AS u1 so the membership and the profile are real ──────
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbb0001-0000-0000-0000-000000000001","role":"authenticated"}', false);

do $clan$
begin
  insert into pg_temp.fx (k, v)
  values ('clan', (public.create_clan('History Test') ->> 'clan_id')::uuid);
end
$clan$;

reset role;

-- ── the burns, as the SUPERUSER (burns has no client policy) ───────────────
-- ⚠️ Three for u1 (one OUTSIDE the trailing 7 days) and one for u2, so "only yours"
-- and "only the window" are both falsifiable.
-- ⚠️ `award_snapshot` is CHECK-constrained to 0..1650, so the fixtures stay inside it.
-- (⚠️ `EN · 8c History` draws a "+1,920" bullseye, which the schema would REFUSE — the
-- board is illustrative and the constraint is the authority. Noted, not fixed here.)
do $fixtures$
declare
  v_clan uuid := (select v from pg_temp.fx where k = 'clan');
begin
  insert into public.burns
    (user_id, clan_id, item_code, band, accuracy, award_snapshot, idempotency_key, created_at)
  values
    ('bbbb0001-0000-0000-0000-000000000001', v_clan, 'gold_bar',         'bullseye',   1.20, 1650, 'hist-k1', now() - interval '1 hour'),
    ('bbbb0001-0000-0000-0000-000000000001', v_clan, 'joss_paper_stack', 'devout',    12.50,  300, 'hist-k2', now() - interval '2 days'),
    ('bbbb0001-0000-0000-0000-000000000001', v_clan, 'house',            'miss',     400.00,    0, 'hist-k3', now() - interval '30 days'),
    ('bbbb0002-0000-0000-0000-000000000002', v_clan, 'smartphone',       'graze',     50.00,  480, 'hist-k4', now() - interval '1 hour');
  raise notice 'fixtures: 4 burns (3 for u1, 1 for u2, 1 outside the window)';
end
$fixtures$;

-- ═══ THE SPINE — driven as a real signed-in user ════════════════════════════
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbb0001-0000-0000-0000-000000000001","role":"authenticated"}', false);

do $spine$
declare
  v_rows record;
  v_n    integer;
begin
  -- ── O1 · the caller's OWN burns, newest first ───────────────────────────
  select count(*) into v_n from public.my_offerings();
  perform pg_temp.assert_true(v_n = 3, 'O1  the caller sees their own 3 burns');
  perform pg_temp.assert_true(
    (select count(*) from public.my_offerings() m where m.item_code = 'smartphone') = 0,
    '⚠️ O1  …and NOT another user''s burn (u2''s smartphone is absent)');

  select m.item_code, m.points, m.band into v_rows from public.my_offerings() m limit 1;
  perform pg_temp.assert_true(v_rows.item_code = 'gold_bar',
    'O1  the newest burn comes first (gold_bar, 1 hour ago)');

  -- ── O2 · the fields `account-api.ts` parses ─────────────────────────────
  perform pg_temp.assert_true(v_rows.points = 1650, 'O2  `points` is the stored award');
  perform pg_temp.assert_true(v_rows.band = 'bullseye', 'O2  `band` is the enum as text');
  perform pg_temp.assert_true(
    (select m.burned_at is not null and m.burn_id is not null from public.my_offerings() m limit 1),
    'O2  `burned_at` and `burn_id` come back');

  -- ── O3 · AS STORED, never re-derived ────────────────────────────────────
  -- ⚠️ The miss row carries award 0 AND band 'miss'. If the function ever recomputed the
  -- award from the band, this is the row where it would show.
  select m.points, m.band into v_rows from public.my_offerings() m where m.item_code = 'house';
  perform pg_temp.assert_true(v_rows.points = 0 and v_rows.band = 'miss',
    '⚠️ O3  a MISS returns its stored 0 and its stored band — not a recomputation');

  -- ── O4 · p_limit is CLAMPED, not trusted ────────────────────────────────
  select count(*) into v_n from public.my_offerings(1);
  perform pg_temp.assert_true(v_n = 1, 'O4  p_limit = 1 returns one row');
  select count(*) into v_n from public.my_offerings(0);
  perform pg_temp.assert_true(v_n = 1, '⚠️ O4  p_limit = 0 is CLAMPED UP to one — never zero rows');
  select count(*) into v_n from public.my_offerings(-5);
  perform pg_temp.assert_true(v_n = 1, '⚠️ O4  a negative limit is clamped too');
  select count(*) into v_n from public.my_offerings(5000);
  perform pg_temp.assert_true(v_n = 3, 'O4  an absurd limit is clamped down (and returns what exists)');

  -- ── O5 · the THIS WEEK block ────────────────────────────────────────────
  select w.burned, w.tribute, w.streak_days into v_rows from public.my_offerings_week() w;
  perform pg_temp.assert_true(v_rows.burned = 2, 'O5  THIS WEEK counts only the trailing 7 days (2 of 3)');
  perform pg_temp.assert_true(v_rows.tribute = 1950,
    'O5  …and sums only that window''s award (1650 + 300)');
  perform pg_temp.assert_true(v_rows.streak_days >= 0,
    'O5  the streak comes back as a number (stored, not re-derived)');
end
$spine$;

-- ── O6 · no identity RAISES ───────────────────────────────────────────────
-- ⚠️ The trap this guards: `burns` has RLS with no policy, so a plain select returns
-- `[]` with NO error — and "you burned nothing" would render over a hundred rows.
reset role;
do $anon$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', false);
  begin
    perform * from public.my_offerings();
    raise exception '✗ FAIL: O6  my_offerings() did NOT raise without an identity';
  exception
    when insufficient_privilege then
      raise notice '  ✓ O6  my_offerings() raises 42501 with no identity';
  end;
  begin
    perform * from public.my_offerings_week();
    raise exception '✗ FAIL: O6  my_offerings_week() did NOT raise without an identity';
  exception
    when insufficient_privilege then
      raise notice '  ✓ O6  my_offerings_week() raises 42501 with no identity';
  end;
end
$anon$;

-- ── clean up, so the next test run's counts are not polluted ───────────────
reset role;
do $teardown$
declare
  v_u1 uuid := 'bbbb0001-0000-0000-0000-000000000001';
  v_u2 uuid := 'bbbb0002-0000-0000-0000-000000000002';
begin
  delete from public.burns    where user_id in (v_u1, v_u2);
  delete from public.clans    where created_by in (v_u1, v_u2);
  delete from public.profiles where user_id in (v_u1, v_u2);
  delete from auth.users      where id in (v_u1, v_u2);
  raise notice 'teardown: fixtures removed';
end
$teardown$;

