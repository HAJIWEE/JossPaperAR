-- ═══════════════════════════════════════════════════════════════════════════
-- A REFUSED PURCHASE MUST SAY **WHY**, IN A FORM A PROGRAM CAN READ — SCRUM-242
--
-- ⚠️⚠️ THE DEFECT THIS PINS. `purchase_item` raised human sentences and the client
-- had nothing else to read, so the store PRINTED the database's words: a 中文
-- player buying with too few points saw, in red English,
--
--     not enough tribute: 2000 needed, 0 available
--
-- — below the item grid, so the confirm closed and nothing visible happened.
--
-- The fix is option B: the *reason* moves into Postgres `DETAIL` as JSON, which
-- PostgREST returns as `error.details`, and the client maps THAT — never the
-- sentence. ⚠️ The prose is deliberately left byte-identical, because logs and
-- SQLERRM are read by humans and existing assertions read them too.
--
-- ── HOW TO RUN IT ───────────────────────────────────────────────────────────
--   npx supabase start
--   docker run --rm -i --network host postgres:17 \
--     psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -q -f - < supabase/tests/purchase_item_refusal.sql
--
-- ⚠️ `--network host` is REQUIRED against the local stack (AGENTS.md: the shared
-- runner omits it and every file then reports "Connection refused").
--
-- ── WHAT IT PROVES ──────────────────────────────────────────────────────────
--   R1  insufficient funds raises `P0001` **and** carries DETAIL JSON
--   R2  the detail names the refusal: `insufficient_funds`
--   R3  ⚠️ the NUMBERS are in the detail — `needed` · `available` · `short_by` —
--       so the UI never has to parse the sentence to say "you need 400 more"
--   R4  ⚠️ the MESSAGE is unchanged — still the `not enough tribute:` sentence.
--       If a later edit "tidies" it, this stays green on purpose: the message is
--       not the contract, and the contract must not depend on its wording.
--   R5  an UNKNOWN item raises `22023` with `refusal: unknown_item`
--   R6  ⚠️ THE SOURCE GATE: the live body still builds the detail — asserted
--       against `pg_proc`, so a migration that drops the `json_build_object`
--       turns this RED even if the behaviour is tested only by eye
--
-- ⚠️ FAULT-TESTED: delete the `detail = json_build_object(...)` clause from the
-- insufficient-funds raise, re-apply, and R1–R3 go red. A test that cannot fail
-- is not a test.
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

-- ═══ SETUP — a real user with an EMPTY wallet ══════════════════════════════
-- ⚠️ Zero tribute is the whole point: a user with no `ledger_events` cannot afford
-- anything, so the insufficient-funds raise is reachable without seeding money.
do $setup$
declare
  v_u uuid := 'dddd0242-0000-4000-8000-000000000001';
begin
  -- pre-clean, so a RE-RUN after a failed attempt is safe
  delete from public.ledger_events where user_id = v_u;
  delete from public.inventory     where user_id = v_u;
  delete from public.rate_counters where user_id = v_u;
  delete from public.clans         where created_by = v_u;
  delete from public.profiles      where user_id = v_u;
  delete from auth.users           where id = v_u;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'scrum242@example.invalid', '', now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  );

  raise notice 'setup: one user, no ledger rows — a wallet of zero';
end
$setup$;

-- ⚠️ `set role` at TOP LEVEL and `set_config(..., false)` is SESSION-scoped: under
-- the shared runner psql runs each statement in its own transaction, so `SET LOCAL`
-- would not survive to the next statement (AGENTS.md).
set role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"dddd0242-0000-4000-8000-000000000001","role":"authenticated"}',
  false
);

-- ═══ R1–R4 · INSUFFICIENT FUNDS, THE HEADLINE CASE ═════════════════════════
do $r1$
declare
  v_refused boolean := false;
  v_state   text;
  v_detail  text;
  v_msg     text;
  v_json    jsonb;
begin
  begin
    perform public.purchase_item('joss_paper_stack', 'scrum242-refusal-0001');
  exception when others then
    -- ⚠️ A flag, not a `raise` inside the handler's own block: raising here would be
    -- caught by this same handler and read as a successful refusal.
    v_refused := true;
    get stacked diagnostics v_state = returned_sqlstate,
                            v_msg = message_text,
                            v_detail = pg_exception_detail;
  end;

  perform pg_temp.assert_true(v_refused, 'R1 the purchase is REFUSED on an empty wallet');
  perform pg_temp.assert_true(v_state = 'P0001', 'R1 …with P0001 (got ' || coalesce(v_state, 'null') || ')');
  perform pg_temp.assert_true(v_detail is not null and length(v_detail) > 0, 'R2 …and a DETAIL at all');

  begin
    v_json := v_detail::jsonb;
  exception when others then
    raise exception '✗ R2 the detail is not JSON: %', coalesce(v_detail, 'null');
  end;

  perform pg_temp.assert_true(v_json ->> 'refusal' = 'insufficient_funds',
    'R2 the detail names the refusal (got ' || coalesce(v_json ->> 'refusal', 'null') || ')');
  perform pg_temp.assert_true((v_json ->> 'needed')::int > 0, 'R3 needed is a positive number');
  perform pg_temp.assert_true((v_json ->> 'available')::int = 0, 'R3 available is the wallet — zero here');
  perform pg_temp.assert_true((v_json ->> 'short_by')::int = (v_json ->> 'needed')::int,
    'R3 short_by = needed − available');
  perform pg_temp.assert_true(v_msg like 'not enough tribute:%',
    'R4 the MESSAGE is unchanged for humans (got: ' || coalesce(v_msg, 'null') || ')');
end
$r1$;

-- ═══ R5 · AN UNKNOWN CODE IS ITS OWN REFUSAL, NOT A BALANCE PROBLEM ════════
do $r5$
declare
  v_refused boolean := false;
  v_state   text;
  v_detail  text;
begin
  begin
    perform public.purchase_item('no_such_offering_xyz', 'scrum242-refusal-0002');
  exception when others then
    v_refused := true;
    get stacked diagnostics v_state = returned_sqlstate, v_detail = pg_exception_detail;
  end;

  perform pg_temp.assert_true(v_refused, 'R5 an unknown item is REFUSED');
  perform pg_temp.assert_true(v_state = '22023', 'R5 …with 22023 (got ' || coalesce(v_state, 'null') || ')');
  perform pg_temp.assert_true(v_detail::jsonb ->> 'refusal' = 'unknown_item',
    'R5 …and refusal: unknown_item');
end
$r5$;

-- ═══ R6 · THE SOURCE GATE — the live body still builds the detail ══════════
-- ⚠️ Read from `pg_proc`, so a future migration that re-emits the function WITHOUT the
-- json_build_object turns this RED instead of passing on stale behaviour.
reset role;
do $r6$
declare
  v_body text;
begin
  select prosrc into v_body
    from pg_proc
   where proname = 'purchase_item' and pronamespace = 'public'::regnamespace;

  perform pg_temp.assert_true(v_body is not null, 'R6 purchase_item is present');
  perform pg_temp.assert_true(v_body like '%insufficient_funds%', 'R6 the live body builds a typed refusal');
  perform pg_temp.assert_true(v_body like '%short_by%', 'R6 …and sends short_by so the UI need not subtract');
end
$r6$;

-- ═══ TEARDOWN — leave nothing behind for the next file ═════════════════════
do $clean$
declare
  v_u uuid := 'dddd0242-0000-4000-8000-000000000001';
begin
  delete from public.ledger_events where user_id = v_u;
  delete from public.inventory     where user_id = v_u;
  delete from public.rate_counters where user_id = v_u;
  delete from public.profiles      where user_id = v_u;
  delete from auth.users           where id = v_u;
  raise notice 'teardown: fixture removed';
end
$clean$;
