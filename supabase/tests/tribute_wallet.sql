-- ═══════════════════════════════════════════════════════════════════════════
-- THE TRIBUTE WALLET — `home_summary()` reads the BALANCE, not the RECORD
-- (SCRUM-150 AC 1)
--
-- ⚠️⚠️ THE DEFECT THIS PINS. `home_summary().tribute_total` read
-- `sum(tributes.points)` — the Book of Tributes' record of offerings actually
-- MADE (doc 15 §7.1), which is **lifetime earned and can never fall**. The Store's
-- chip renders that value as *"Store Points"*, while `purchase_item` spends
-- **`public.balances`** (`sum(ledger_events.amount)`). Measured on glass 2026-11-01:
-- with **5000** tribute in the LEDGER and none in `tributes`, the chip read
-- **"Store Points 0"** and the purchase **succeeded anyway** — a player saw
-- *"0 points"* beside a working Buy button.
--
-- ── HOW TO RUN IT ───────────────────────────────────────────────────────────
-- The local Docker stack needs no account and no link, and applies the migrations
-- from the files:
--
--   npx supabase start
--   docker run --rm -i --network host postgres:17 \
--     psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -q -f - < supabase/tests/tribute_wallet.sql
--
-- ⚠️ `--network host` is REQUIRED for the local stack: `run-sql-tests.sh` calls
-- `docker run` WITHOUT it, so pointing that script at a local URL makes every file
-- report "Connection refused" against a perfectly healthy stack (AGENTS.md).
--
-- ── WHAT IT PROVES ─────────────────────────────────────────────────────────
--   W1  the panel follows the **LEDGER** — a 6000 wallet reads 6000
--   W2  ⚠️ it does NOT follow `tributes` — asserted on a fixture where the two
--       **deliberately disagree** (record 1000, wallet 6000). This is the
--       assertion that goes RED if anyone puts `sum(tributes.points)` back
--   W3  a purchase-shaped row DROPS it by exactly that amount — SCRUM-150 AC 1
--   W4  the live body reads the `balances` view — the SAME source
--       `purchase_item` spends — asserted against `pg_proc`, not a comment
--   W5  no identity RAISES — "you earned nothing" and "you are not signed in"
--       must not render identically
--
-- ⚠️ The fixtures are inserted as the SUPERUSER (the ledger is append-only and no
-- client role may write it). The assertions run as `authenticated`, which is the
-- whole point: the RPC must answer the role the app actually is.
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
  delete from public.ledger_events where user_id = v_u1;
  delete from public.clans         where created_by = v_u1;
  delete from public.profiles      where user_id = v_u1;
  delete from auth.users           where id = v_u1;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    v_u1::text || '@example.invalid', '', now(),
    '{"provider":"anonymous","providers":["anonymous"]}', '{}', now(), now()
  );

  raise notice 'setup: one anonymous user (the profile bootstrap should fire)';
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
  '{"sub":"cccc0001-0000-0000-0000-000000000001","role":"authenticated"}', false);

do $clan$
begin
  insert into pg_temp.fx (k, v)
  values ('clan', (public.create_clan('Wallet Test') ->> 'clan_id')::uuid);
end
$clan$;

reset role;

-- ── ⚠️ THE FIXTURE THAT MAKES THE DEFECT VISIBLE ───────────────────────────
-- The RECORD and the WALLET are made to DISAGREE on purpose:
--   tributes record = 1000  (one burn, one tribute row — the lifetime record)
--   ledger wallet   = 6000  (award 1000 + a 5000 `adjustment`, which writes NO
--                            tribute row — exactly the shape that produced the
--                            "Store Points 0" sighting on glass)
-- A fixture where the two agree proves nothing: both readings would pass.
do $fixture$
declare
  v_u1   uuid := 'cccc0001-0000-0000-0000-000000000001';
  v_clan uuid;
  v_burn uuid;
begin
  select v into v_clan from pg_temp.fx where k = 'clan';

  insert into public.burns (
    user_id, clan_id, item_code, band, accuracy, award_snapshot, idempotency_key
  ) values (
    v_u1, v_clan, 'joss_paper_stack', 'bullseye', 100, 1000, 'wallet-test-burn-1'
  ) returning id into v_burn;

  insert into public.tributes (burn_id, user_id, clan_id, item_code, points)
  values (v_burn, v_u1, v_clan, 'joss_paper_stack', 1000);

  -- the award the burn produced…
  insert into public.ledger_events (
    user_id, seq, currency, type, amount, ref_type, ref_id, actor, idempotency_key
  ) values (
    v_u1, 1, 'tribute', 'award', 1000, 'burn', v_burn, 'award-service', 'wallet-test-key-1'
  );

  -- …and a correction that moves the WALLET only. ⚠️ `adjustment` REQUIRES a
  -- `reason` (the `ledger_adjustment_needs_reason` CHECK), and the ledger is
  -- APPEND-ONLY: this is a new row, never an UPDATE.
  insert into public.ledger_events (
    user_id, seq, currency, type, amount, ref_type, actor, reason, idempotency_key
  ) values (
    v_u1, 2, 'tribute', 'adjustment', 5000, 'manual', 'admin',
    'test credit for the tribute-wallet pin', 'wallet-test-key-2'
  );

  raise notice 'fixture: tributes record = 1000 · ledger wallet = 6000';
end
$fixture$;

-- ── W1 · W2 · the wallet, and NOT the record ───────────────────────────────
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cccc0001-0000-0000-0000-000000000001","role":"authenticated"}', false);

do $spine$
declare
  v_u1     uuid := 'cccc0001-0000-0000-0000-000000000001';
  v_wallet bigint;
  v_record bigint;
  v_n      integer;
begin
  select count(*) into v_n from public.home_summary();
  perform pg_temp.assert_true(v_n = 1, 'W1  home_summary() returns exactly one row');

  select coalesce(sum(t.points), 0) into v_record
    from public.tributes t where t.user_id = v_u1;
  select h.tribute_total into v_wallet from public.home_summary() h;

  -- ⚠️ Assert the RECORD is really non-zero FIRST, so the divergence below cannot
  -- pass vacuously on an empty fixture.
  perform pg_temp.assert_true(v_record = 1000,
    'W2  the tributes RECORD reads 1000 — the fixture is not vacuous');

  perform pg_temp.assert_true(v_wallet = 6000,
    '⚠️ W1  home_summary() follows the LEDGER — the wallet is 6000 (award 1000 + adjustment 5000)');

  perform pg_temp.assert_true(v_wallet <> v_record,
    '⚠️⚠️ W2  …and NOT sum(tributes.points): the record (1000) and the wallet (6000) DISAGREE, and the wallet is what is returned');
end
$spine$;

reset role;

do $purchase$
declare
  v_u1 uuid := 'cccc0001-0000-0000-0000-000000000001';
begin
  insert into public.ledger_events (
    user_id, seq, currency, type, amount, ref_type, ref_id, actor, idempotency_key
  ) values (
    v_u1, 3, 'tribute', 'purchase', -400, 'item', null, 'store', 'wallet-test-key-3'
  );
  raise notice 'fixture: a 400-point purchase landed on the ledger';
end
$purchase$;

set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cccc0001-0000-0000-0000-000000000001","role":"authenticated"}', false);

do $after$
declare
  v_wallet bigint;
begin
  select h.tribute_total into v_wallet from public.home_summary() h;
  perform pg_temp.assert_true(v_wallet = 5600,
    '⚠️ W3  a 400-point purchase DROPS the shown balance to 5600 — AC 1 (was 6000)');
end
$after$;

reset role;

-- ── W4 · the live body reads the `balances` view ───────────────────────────
-- ⚠️ A META-assertion, deliberately: the behavioural checks above would still pass
-- if someone re-derived the same number from `ledger_events` directly, and that is
-- the drift this pins — the function must read the SAME view `purchase_item` spends.
do $source$
declare
  v_src text;
begin
  select p.prosrc into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'home_summary';

  perform pg_temp.assert_true(v_src is not null, 'W4  home_summary() exists');
  perform pg_temp.assert_true(v_src like '%public.balances%',
    '⚠️ W4  its body reads the `balances` view — the SAME source `purchase_item` spends');
  perform pg_temp.assert_true(v_src not like '%from public.tributes%',
    '⚠️ W4  …and NOT `tributes` — the record reading that caused the defect');
end
$source$;

-- ── W5 · no identity RAISES ───────────────────────────────────────────────
-- ⚠️ "you have earned nothing" and "you are not signed in" must not render the same.
do $anon$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', false);
  begin
    perform * from public.home_summary();
    raise exception '✗ FAIL: W5  home_summary() did NOT raise without an identity';
  exception
    when insufficient_privilege then
      raise notice '  ✓ W5  home_summary() raises 42501 with no identity';
  end;
end
$anon$;

-- ── clean up, so the next test run's counts are not polluted ───────────────
reset role;
do $teardown$
declare
  v_u1 uuid := 'cccc0001-0000-0000-0000-000000000001';
begin
  delete from public.ledger_events where user_id = v_u1;
  delete from public.clans         where created_by = v_u1;  -- cascades burns + tributes
  delete from public.profiles      where user_id = v_u1;
  delete from auth.users           where id = v_u1;
  raise notice 'teardown: fixtures removed';
end
$teardown$;
