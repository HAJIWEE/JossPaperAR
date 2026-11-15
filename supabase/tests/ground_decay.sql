-- ═══════════════════════════════════════════════════════════════════════════
-- THE GROUND BONUS DECAYS PER BURN (SCRUM-237 · SCRUM-12 · SCRUM-235)
--
-- ⚠️ WHAT THIS PINS. `submit_burn` used to pay a BINARY ×2.0: `new_ground` was
-- "no `cell_burns` row before today", so the bonus was 2.0 once and 1.0 forever.
-- The PM's decision (SCRUM-235, 2026-11-15) is a DECAY of the bonus above ×1.0:
--
--     multiplier(n) = 1 + min(2.0 − 1, 0.75^(n−1))      n = LIFETIME burn no.
--                     2.000 · 1.750 · 1.563 · 1.422 · 1.316 … → 1.000
--
-- ⚠️ `cell_burns` is keyed (user, cell, DAY), so the lifetime count is
-- `sum(burn_count)`. Each case below seeds the PRIOR days with `n − 1` and then
-- burns ONCE — that is the real code path, without waiting seven days or
-- fighting the daily quota.
--
-- ── HOW TO RUN IT ───────────────────────────────────────────────────────────
--   npx supabase start
--   docker run --rm -i --network host postgres:17 \
--     psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -q -f - < supabase/tests/ground_decay.sql
--
-- ⚠️ `--network host` is REQUIRED against the local stack (AGENTS.md).
--
-- ── WHAT IT PROVES ──────────────────────────────────────────────────────────
--   D1–D5  n = 1…5 pays 1,600 · 1,400 · 1,250 · 1,138 · 1,053 (bullseye base 800)
--   D6     n = 20 is FIXED at ×1.0 → 800, and `new_ground` is false
--   D7     a burn with NO cell still pays 800 (the multiplier stays ×1.0)
--   D8     `burns.new_ground` is TRUE only for n = 1 — the column stays truthful
--
-- ⚠️ FAULT-TESTED: set `c_ground_decay` to 1.0 (the old binary cliff) and
-- D2–D5 go red; set it to 0.5 and D3 goes red.
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
  v_u    uuid := 'dddd0237-0000-4000-8000-000000000237';
  v_clan uuid := 'eeee0237-0000-4000-8000-000000000237';
begin
  -- pre-clean, so a re-run after a failed attempt is safe
  delete from public.cell_burns     where user_id = v_u;
  delete from public.ledger_events  where user_id = v_u;
  delete from public.tributes       where user_id = v_u;
  delete from public.burns          where user_id = v_u;
  delete from public.inventory      where user_id = v_u;
  delete from public.streaks        where user_id = v_u;
  delete from public.quotas         where user_id = v_u;
  delete from public.clan_members   where user_id = v_u;
  delete from public.clans          where created_by = v_u;
  delete from public.profiles       where user_id = v_u;
  delete from public.grid_cells     where cell_id like 'gd237%';
  delete from auth.users            where id = v_u;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'scrum237@example.invalid', '', now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  );

  insert into public.clans (id, name, code, created_by)
  values (v_clan, 'SCRUM-237 decay test', 'SCRUMGDY', v_u);
  insert into public.clan_members (clan_id, user_id, role, joined_at)
  values (v_clan, v_u, 'head', now());

  -- 20 offerings: this test makes 7 burns.
  insert into public.inventory (user_id, item_code, qty, acquired_via)
  values (v_u, 'joss_paper_stack', 20, 'grant');

  raise notice 'setup: one head of one clan, holding 20 joss stacks';
end
$setup$;

do $run$
declare
  v_u      uuid := 'dddd0237-0000-4000-8000-000000000237';
  v_clan   uuid := 'eeee0237-0000-4000-8000-000000000237';
  v_day    date := (now() at time zone public.streak_tz(
                      'dddd0237-0000-4000-8000-000000000237'))::date;
  v_cell   text;
  v_n      integer;
  r        jsonb;
  v_award  integer;
  v_expect integer;
  v_flag   boolean;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_u::text, 'role', 'authenticated')::text, false);

  -- ⚠️ `c_burn_per_min` (6) is a SEPARATE real gate — proved elsewhere. This
  -- test needs SEVEN burns inside one minute to walk the curve, so the window
  -- counter is cleared before each burn rather than the check being dropped.
  delete from public.rate_counters where user_id = v_u;

  -- ── D1–D5 · the curve, one lifetime burn number at a time ────────────────
  for v_n in 1..5 loop
    v_cell := 'gd237c' || lpad(v_n::text, 3, '0');

    -- the lifetime count BEFORE this burn is n − 1, seeded on an earlier day
    if v_n > 1 then
      insert into public.cell_burns (user_id, cell_id, day, burn_count)
      values (v_u, v_cell, v_day - 1, v_n - 1);
    end if;

    delete from public.rate_counters where user_id = v_u;
    r := public.submit_burn(
      v_u,
      jsonb_build_object('item_code', 'joss_paper_stack', 'accuracy', 0,
                         'clan_id', v_clan, 'cell_hash', v_cell),
      'gd237:curve:' || v_n
    );

    v_award  := (r->>'award')::int;
    v_expect := round(800 * (1 + power(0.75, v_n - 1)))::int;
    v_flag   := (r->>'new_ground')::boolean;

    perform pg_temp.assert_true(
      v_award = v_expect,
      format('D%s · n = %s pays %s (got %s)', v_n, v_n, v_expect, v_award));

    perform pg_temp.assert_true(
      v_flag = (v_n = 1),
      format('D%s · new_ground is %s at n = %s', v_n, v_n = 1, v_n));
  end loop;

  -- ── D6 · the floor: the bonus is GONE at n = 20, not negative ────────────
  v_cell := 'gd237floor';
  insert into public.cell_burns (user_id, cell_id, day, burn_count)
  values (v_u, v_cell, v_day - 3, 19);

  delete from public.rate_counters where user_id = v_u;
  r := public.submit_burn(
    v_u,
    jsonb_build_object('item_code', 'joss_paper_stack', 'accuracy', 0,
                       'clan_id', v_clan, 'cell_hash', v_cell),
    'gd237:floor'
  );
  perform pg_temp.assert_true((r->>'award')::int = 800,
    'D6 · at n = 20 the multiplier is FIXED at ×1.0 → 800');
  perform pg_temp.assert_true((r->>'new_ground')::boolean is false,
    'D6 · new_ground is false at n = 20');

  -- ── D7 · NO cell → no ground bonus at all (the ×1.0 regression) ──────────
  delete from public.rate_counters where user_id = v_u;
  r := public.submit_burn(
    v_u,
    jsonb_build_object('item_code', 'joss_paper_stack', 'accuracy', 0,
                       'clan_id', v_clan),
    'gd237:no-cell'
  );
  perform pg_temp.assert_true((r->>'award')::int = 800,
    'D7 · a burn with NO cell still pays 800 — the ground multiplier is ×1.0');
  perform pg_temp.assert_true((r->>'new_ground')::boolean is false,
    'D7 · …and reports new_ground: false, because no cell was supplied');

  -- ── D8 · the ledger column is TRUE only for the first burn ───────────────
  perform pg_temp.assert_true(
    (select count(*) from public.burns
      where user_id = v_u and new_ground is true) = 1,
    'D8 · exactly ONE burns row carries new_ground = true (n = 1), not four');

  raise notice 'curve: % / % / % / % / %  ·  floor %',
    (select award_snapshot from public.burns
      where user_id = v_u and cell_id = 'gd237c001'),
    (select award_snapshot from public.burns
      where user_id = v_u and cell_id = 'gd237c002'),
    (select award_snapshot from public.burns
      where user_id = v_u and cell_id = 'gd237c003'),
    (select award_snapshot from public.burns
      where user_id = v_u and cell_id = 'gd237c004'),
    (select award_snapshot from public.burns
      where user_id = v_u and cell_id = 'gd237c005'),
    (select award_snapshot from public.burns
      where user_id = v_u and cell_id = 'gd237floor');
end
$run$;
