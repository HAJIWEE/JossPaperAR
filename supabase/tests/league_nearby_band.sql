-- ═══════════════════════════════════════════════════════════════════════════
-- "NEARBY COMPETITORS" IS A POINTS BAND, NOT A GEOGRAPHIC RADIUS (SCRUM-236)
--
-- ⚠️ WHAT THIS PINS. SCRUM-12's bullet read *"4-Block Radius Privacy — users can
-- only see nearby competitors"*, which sounds like a map. The PM settled it on
-- 2026-11-15: *"in the dimension of their accumulated points range not in terms
-- of geographic location"*. The band of record is the COHORT — one league week,
-- one tier, ~30 players ranked by weekly points.
--
-- ⚠️ This is the SERVER half: it calls the real `get_league_board()` and proves
-- that a rival in a DIFFERENT TIER never leaves the database. The domain half
-- (`pointsBandOf` / `isNearbyBand`) is asserted by `check:domain`.
--
-- ── HOW TO RUN IT ───────────────────────────────────────────────────────────
--   npx supabase start
--   docker run --rm -i --network host postgres:17 \
--     psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -q -f - supabase/tests/league_nearby_band.sql
--
-- ⚠️ FAULT-TESTED: widen the band in `get_league_board` (drop the `cohort_id`
-- predicate) and N2/N3 go red — a tier-2 rival appears on the board.
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

do $nb$
declare
  v_week uuid;
  v_near uuid;      -- tier 1: my band
  v_far  uuid;      -- tier 2: NOT my band
  v_me   uuid := gen_random_uuid();
  v_board jsonb;
  v_n    integer;
begin
  -- pre-clean (cascades to cohorts + members)
  delete from public.league_weeks where start_date = '2031-01-06';

  -- ⚠️ 2031 so it sorts ABOVE any real week: `get_league_board` takes the most
  -- recent ACTIVE week, and a test must not depend on what else is open.
  insert into public.league_weeks (start_date, end_date, status)
  values ('2031-01-06', '2031-01-12', 'active')
  returning id into v_week;

  insert into public.cohorts (week_id, tier) values (v_week, 1) returning id into v_near;
  insert into public.cohorts (week_id, tier) values (v_week, 2) returning id into v_far;

  insert into public.cohort_members (cohort_id, user_id, display_label)
  values (v_near, v_me,             'me'),
         (v_near, gen_random_uuid(), 'nearby rival'),
         (v_far,  gen_random_uuid(), 'far rival');

  -- the caller
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_me::text, 'role', 'authenticated')::text, false);

  v_board := public.get_league_board();

  -- ── N1 · the caller IS in a band, and it is tier 1 ───────────────────────
  perform pg_temp.assert_true((v_board->>'tier')::int = 1,
    'N1 · the caller''s band is tier 1');
  perform pg_temp.assert_true((v_board->>'cohort_id')::uuid = v_near,
    'N1 · …and the board is the caller''s own cohort');

  -- ── N2 · only the band's members are returned (2, not 3) ─────────────────
  perform pg_temp.assert_true((v_board->>'members')::int = 2,
    'N2 · ⚠️ the board holds 2 members — the tier-2 rival is NOT one of them');
  perform pg_temp.assert_true(jsonb_array_length(v_board->'rows') = 2,
    'N2 · …and `rows` agrees (2)');

  -- ── N3 · the out-of-band rival is NOWHERE in the payload ────────────────
  select count(*) into v_n
    from jsonb_array_elements(v_board->'rows') e
   where e->>'display_label' = 'far rival';
  perform pg_temp.assert_true(v_n = 0,
    'N3 · ⚠️ "far rival" never leaves the database — the filter is SERVER-side');

  select count(*) into v_n
    from jsonb_array_elements(v_board->'rows') e
   where (e->>'is_me')::boolean is true;
  perform pg_temp.assert_true(v_n = 1,
    'N3 · exactly one row is `is_me`');

  -- ── N4 · the RPC reads NO location column or identifier ─────────────────
  perform pg_temp.assert_true(
    pg_get_functiondef('public.get_league_board()'::regprocedure)
      !~* '(latitude|longitude|cell_hash|geolocation|coordinates)',
    'N4 · ⚠️ the board RPC reads NO location identifier');

  raise notice 'board: % members · tier % · my rank %',
    v_board->>'members', v_board->>'tier', coalesce(v_board->>'my_rank', 'null');

  delete from public.league_weeks where id = v_week;
end
$nb$;
