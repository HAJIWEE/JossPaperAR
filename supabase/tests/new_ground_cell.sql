-- ═══════════════════════════════════════════════════════════════════════════
-- THE NEW-GROUND ×2.0 FIRES ONLY WHEN A CELL ARRIVES (SCRUM-12 · SCRUM-233 A)
--
-- ⚠️⚠️ **THE DEFECT THIS PINS.** `submit_burn` has computed `new_ground` inside
-- `if v_cell is not null` since it was written, and the client never sent a
-- `cell_hash` — so the ×2.0 bounty had **never fired once** (measured 2026-11-15:
-- `grep -rn 'cell_hash' src/` → nothing). The client now sends one.
--
-- ⚠️ This is the SERVER half of that proof. The client half is on glass:
-- a real fix produced a 15-char token (HN615L005386, 2026-11-15).
--
-- ── HOW TO RUN IT ───────────────────────────────────────────────────────────
--   npx supabase start
--   docker run --rm -i --network host postgres:17 \
--     psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -q -f - < supabase/tests/new_ground_cell.sql
--
-- ⚠️ `--network host` is REQUIRED against the local stack (AGENTS.md).
--
-- ── WHAT IT PROVES ──────────────────────────────────────────────────────────
--   N1  a burn with NO cell_hash reports `new_ground: false`  ← today's shipped behaviour
--   N2  the SAME burn WITH a cell_hash reports `new_ground: true`
--   N3  ⚠️ the award is actually ×2 — not merely a flag that flipped
--   N4  `cell_burns` gains a row, so the NEXT day can decay it
--   N5  `grid_cells` gains the aggregate — the aggregate keeps NO identity
--
-- ⚠️ FAULT-TESTED: strip `cell_hash` from the second payload and N2/N3 go red.
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
  v_u    uuid := 'dddd0012-0000-4000-8000-000000000012';
  v_clan uuid := 'eeee0012-0000-4000-8000-000000000012';
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
  delete from public.grid_cells     where cell_id = 'scr12cell0000001';
  delete from auth.users            where id = v_u;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'scrum12@example.invalid', '', now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  );

  insert into public.clans (id, name, code, created_by)
  values (v_clan, 'SCRUM-12 cell test', 'SCRUMTST', v_u);
  insert into public.clan_members (clan_id, user_id, role, joined_at)
  values (v_clan, v_u, 'head', now());

  -- ⚠️ The item must be IN the inventory: `submit_burn` raises 22023 otherwise.
  -- ⚠️ Inserted as the SUPERUSER — no client role may write `inventory` directly.
  insert into public.inventory (user_id, item_code, qty, acquired_via)
  values (v_u, 'joss_paper_stack', 5, 'grant');

  raise notice 'setup: one head of one clan, holding 5 joss stacks';
end
$setup$;

-- ═══ THE TWO BURNS — identical except for the cell ═════════════════════════
do $run$
declare
  v_u    uuid := 'dddd0012-0000-4000-8000-000000000012';
  v_clan uuid := 'eeee0012-0000-4000-8000-000000000012';
  v_cell text := 'scr12cell0000001';   -- 16 chars: submit_burn's exact ceiling
  r_no   jsonb;
  r_cell jsonb;
  v_n    integer;
begin
  -- ⚠️ Belt and braces: the finisher runs twice, and this is what proves it.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_u::text, 'role', 'authenticated')::text, false);

  -- N1 · the shipped behaviour: no cell in the payload
  r_no := public.submit_burn(
    v_u,
    jsonb_build_object('item_code', 'joss_paper_stack', 'accuracy', 0, 'clan_id', v_clan),
    'scr12:no-cell'
  );

  -- N2 · the same burn, with the cell the client now sends
  r_cell := public.submit_burn(
    v_u,
    jsonb_build_object('item_code', 'joss_paper_stack', 'accuracy', 0,
                       'clan_id', v_clan, 'cell_hash', v_cell),
    'scr12:with-cell'
  );

  perform pg_temp.assert_true(
    (r_no->>'new_ground')::boolean is false,
    'N1 a burn WITHOUT cell_hash reports new_ground: false');

  perform pg_temp.assert_true(
    (r_cell->>'new_ground')::boolean is true,
    'N2 ⚠️ the same burn WITH cell_hash reports new_ground: true');

  perform pg_temp.assert_true(
    (r_cell->>'award')::int > (r_no->>'award')::int,
    'N3 ⚠️ …and the award is actually LARGER — the flag alone would prove nothing');

  select count(*) into v_n from public.cell_burns
   where user_id = v_u and cell_id = v_cell;
  perform pg_temp.assert_true(v_n = 1, 'N4 cell_burns gained exactly one row (so tomorrow can decay it)');

  select count(*) into v_n from public.grid_cells where cell_id = v_cell;
  perform pg_temp.assert_true(v_n = 1, 'N5 ⚠️ grid_cells gained the aggregate — and holds NO user id');

  raise notice 'awards: without cell % → with cell %  (new_ground % → %)',
    r_no->>'award', r_cell->>'award', r_no->>'new_ground', r_cell->>'new_ground';
end
$run$;
