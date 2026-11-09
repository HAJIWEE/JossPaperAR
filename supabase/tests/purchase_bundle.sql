-- ═══════════════════════════════════════════════════════════════════════════
-- THE WEALTH BUNDLE IS A BUNDLE, NOT AN ITEM (device report, 2026-11-07)
--
-- ⚠️ THE DEFECT THIS FILE PINS. `purchase_item` minted the PURCHASED code, so buying
-- `wealth_bundle` wrote a `wealth_bundle` row into `inventory` — an item the player could
-- neither want nor spend. The fix (migration 20261107120000) makes the bundle grant **one
-- of each of the other four** and never itself.
--
-- ── WHAT IT PROVES ─────────────────────────────────────────────────────────
--   B1  buying `wealth_bundle` grants ONE of each of the other four — and NOT itself
--   B2  the bundle's own price (2,000) is charged, and 1,200 store points accrue (20 %)
--   B3  a PLAIN item still grants itself (the regression guard: both paths share one write)
--   B4  the grant is REPLAY-SAFE — a repeated key mints nothing a second time
--   B5  the MIRROR states it: `offerings_catalog.composed_of` is the other four, and the
--       bundle is `burnable = false` (it is not an item you can hold, so not one you burn)
--
-- ── HOW TO RUN IT ──────────────────────────────────────────────────────────
-- The local Docker stack needs no account and no link, and it applies the migrations
-- from the files:
--
--   npx supabase start
--   docker run --rm -i --network host postgres:17 \
--     psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -q -f - < supabase/tests/purchase_bundle.sql
--
-- ⚠️ The fixtures are inserted as the SUPERUSER (a ledger CREDIT is server-written: inserting
-- into `ledger_events` is revoked from authenticated). The purchases then run AS `authenticated`
-- with a JWT claim, which is the whole point — the RPC must work for the role the app actually is.
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
  v_u1 uuid := 'cccc0001-0000-0000-0000-000000000001';
begin
  -- pre-clean, so a RE-RUN after a failed run is safe
  delete from public.inventory    where user_id = v_u1;
  delete from public.ledger_events where user_id = v_u1;
  delete from public.profiles     where user_id = v_u1;
  delete from auth.users          where id = v_u1;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'bundle@example.invalid', '', now(),
    '{"provider":"anonymous","providers":["anonymous"]}', '{}', now(), now()
  );

  -- ⚠️ PRE-CLEAN — make a RE-RUN safe after a FAILED run. Under `run-sql-tests.sh` psql
  -- autocommits every statement, so a run that aborts at assertion N leaves the rows of steps
  -- 1..N-1 COMMITTED and its teardown never executes. ⚠️ That is exactly what happened on
  -- 2026-11-09: the Festive Set purchase had committed, so a key it had already used (`bundle-key-0003` collided with B3's plain-item key on the first attempt)
  -- hit the REPLAY branch (which returns no `kind`) and the assertion failed for a reason that
  -- had nothing to do with the code. Same lesson as `pr3_verification.sql`'s pre-clean.
  delete from public.inventory     where user_id = v_u1;
  delete from public.ledger_events where user_id = v_u1;

  -- ⚠️ the profile must exist before the funding row (FK) — the bootstrap trigger should have
  -- made it, but `ensure_profile` is the same call `purchase_item` makes, so this is exact.
  perform public.ensure_profile(v_u1);

  -- fund the wallet: a ledger CREDIT, as the superuser (the ONLY way to make a balance —
  -- `balances` is SUM(amount), and authenticated may not insert here)
  insert into public.ledger_events (user_id, seq, currency, type, amount, ref_type, actor)
  values (v_u1, 1, 'tribute', 'award', 50000, 'test-fund', 'purchase-bundle-test');

  raise notice 'setup: one funded anonymous user (50,000 tribute)';
end
$setup$;
-- ── the purchases ──────────────────────────────────────────────────────────
-- ⚠️ A SESSION-scoped claim (is_local := false), because under `run-sql-tests.sh` psql runs
-- each statement in its own transaction and a LOCAL setting does not survive. This is the
-- same harness trap `my_offerings.sql` records, and the same pattern pr3_verification.sql uses.
select set_config('request.jwt.claims',
  '{"sub":"cccc0001-0000-0000-0000-000000000001","role":"authenticated"}', false);

do $body$
declare
  v_u1 uuid := 'cccc0001-0000-0000-0000-000000000001';
  v_r  jsonb;
begin
  -- ── B1/B2 · the bundle grants the four, and charges the bundle's own price ─
  v_r := public.purchase_item('wealth_bundle', 'bundle-key-0001');

  perform pg_temp.assert_true((v_r->>'price')::int = 2000,
    'B2  the bundle is charged its own catalogue price (2,000), re-read server-side');
  perform pg_temp.assert_true((v_r->>'accrual')::int = 400,
    'B2  the S13d 20 % accrual on 2,000 is 400 store points');
  perform pg_temp.assert_true((v_r->>'balance')::bigint = 48000,
    'B2  the tribute balance dropped by exactly 2,000 (50,000 → 48,000)');

  perform pg_temp.assert_true(
    (select array_agg(x order by x) from jsonb_array_elements_text(v_r->'granted') x)
      = array['gold_bar', 'house', 'joss_paper_stack', 'smartphone'],
    'B1  the receipt reports the four components as `granted` (got ' || (v_r->'granted')::text || ')');

  perform pg_temp.assert_true(
    (select count(*) from public.inventory where user_id = v_u1) = 4,
    'B1  exactly FOUR inventory rows exist — one per component');
  perform pg_temp.assert_true(
    (select bool_and(qty = 1) from public.inventory where user_id = v_u1),
    'B1  each component is owned exactly once');
  perform pg_temp.assert_true(
    (select count(*) from public.inventory
      where user_id = v_u1
        and item_code in ('joss_paper_stack', 'gold_bar', 'smartphone', 'house')) = 4,
    'B1  …and they are the four other store items');
  perform pg_temp.assert_true(
    (select count(*) from public.inventory where user_id = v_u1 and item_code = 'wealth_bundle') = 0,
    'B1  ⚠️ the bundle itself is NEVER an inventory row (the whole point of the fix)');

  -- ── B3 · a PLAIN item still grants ITSELF (the shared write did not break) ──
  v_r := public.purchase_item('gold_bar', 'bundle-key-0002');
  perform pg_temp.assert_true(
    (select qty from public.inventory where user_id = v_u1 and item_code = 'gold_bar') = 2,
    'B3  a plain item grants itself — gold_bar is now 2 (1 from the bundle + 1 bought)');
  perform pg_temp.assert_true(
    (select count(*) from public.inventory where user_id = v_u1) = 4,
    'B3  ⚠️ and it created NO new code — the plain path still writes exactly the item bought');

  -- ── B4 · REPLAY-SAFE — the same key mints nothing twice ────────────────────
  v_r := public.purchase_item('wealth_bundle', 'bundle-key-0001');
  perform pg_temp.assert_true((v_r->>'idempotent_replay')::boolean = true,
    'B4  a replayed bundle purchase reports idempotent_replay');
  perform pg_temp.assert_true(
    (select qty from public.inventory where user_id = v_u1 and item_code = 'joss_paper_stack') = 1,
    'B4  …and granted nothing a second time (joss_paper_stack is still 1, not 2)');
  perform pg_temp.assert_true(
    (select count(*) from public.ledger_events
      where user_id = v_u1 and idempotency_key = 'bundle-key-0001') = 1,
    'B4  …and wrote no second debit');


  -- ── B6/B7 · THE FESTIVE SET IS A BUNDLE TOO (owner, 2026-11-09) ──────────
  /**
   * ⚠️⚠️ *"Festive Set is just the rest of the decorations being sold together as a set, it should not be a selectable
   * item for the decorations. when a user buys the Festive set he is getting all the other decorations in one shot."*
   *
   * ⚠️ Before `20261109110000` this purchase took the DECORATION branch and wrote a **`festive_set` inventory row** — an
   * item no slot can hold — because the composition was only ever read from `offerings_catalog`. Same defect as the
   * wealth bundle, on the other catalogue.
   */
  v_r := public.purchase_item('festive_set', 'bundle-key-0003');
  perform pg_temp.assert_true(v_r->>'kind' = 'decoration',
    'B6  the Festive Set is still a DECORATION (got ' || coalesce(v_r::text, 'NULL') || ')');
  perform pg_temp.assert_true((v_r->>'price')::int = 3000,
    'B6  charged its own price (3,000), re-read server-side');
  perform pg_temp.assert_true(
    (select array_agg(x order by x) from jsonb_array_elements_text(v_r->'granted') x)
      = array['door_gods', 'lanterns', 'spring_couplets', 'zhong_kui'],
    'B6  the receipt reports the four decorations as `granted` (got ' || (v_r->'granted')::text || ')');
  perform pg_temp.assert_true(
    (select count(*) from public.inventory where user_id = v_u1 and item_code = 'festive_set') = 0,
    'B6  ⚠️⚠️ and NEVER a `festive_set` row — it is not placeable, so it must not be holdable');
  perform pg_temp.assert_true(
    (select count(*) from public.inventory
      where user_id = v_u1
        and item_code in ('door_gods', 'lanterns', 'spring_couplets', 'zhong_kui')) = 4,
    'B6  all four decorations landed in the inventory (which is what `equip_decoration` checks)');

end
$body$;

-- ── B5 · the MIRROR states it ──────────────────────────────────────────────
do $mirror$
declare
  v_comp text[];
  v_burn boolean;
begin
  select composed_of, burnable into v_comp, v_burn
    from public.offerings_catalog where code = 'wealth_bundle';
  perform pg_temp.assert_true(
    (select array_agg(x order by x) from unnest(v_comp) x)
      = array['gold_bar', 'house', 'joss_paper_stack', 'smartphone'],
    'B5  the SQL mirror carries the composition — the bundle composes the other four');
  perform pg_temp.assert_true(v_burn = false,
    'B5  ⚠️ and the bundle is NOT burnable — it is not an item you can hold');
  perform pg_temp.assert_true(
    (select count(*) from public.offerings_catalog where composed_of is not null) = 1,
    'B5  …and it is the ONLY composed item — the other four are plain');

  select composed_of into v_comp from public.decorations_catalog where code = 'festive_set';
  perform pg_temp.assert_true(
    (select array_agg(x order by x) from unnest(v_comp) x)
      = array['door_gods', 'lanterns', 'spring_couplets', 'zhong_kui'],
    'B7  the SQL mirror carries it — `decorations_catalog.composed_of` names the four');
  perform pg_temp.assert_true(
    (select count(*) from public.decorations_catalog where composed_of is not null) = 1,
    'B7  …and it is the ONLY composed decoration — the other four are plain pieces');
end
$mirror$;

-- ── clean up, so the next test run's counts are not polluted ───────────────
do $teardown$
declare
  v_u1 uuid := 'cccc0001-0000-0000-0000-000000000001';
begin
  delete from public.inventory     where user_id = v_u1;
  delete from public.ledger_events where user_id = v_u1;
  delete from public.profiles      where user_id = v_u1;
  delete from auth.users           where id = v_u1;
  raise notice 'teardown: fixtures removed';
end
$teardown$;

