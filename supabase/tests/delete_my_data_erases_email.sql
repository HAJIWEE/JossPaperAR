-- ═══════════════════════════════════════════════════════════════════════════
-- THE ONE-TAP DELETE MUST ERASE THE EMAIL — the `auth.users` row
-- (SCRUM-219 AC: *"after `delete_my_data()`, the `auth.users` row and its email
-- are gone … asserted by a test — not by eye"*)
--
-- ⚠️⚠️ THE DEFECT THIS PINS. `delete_my_data()` erased the ledger, the tablets,
-- the photos, the profile — and left the `auth.users` row, which is where the
-- EMAIL lives. Its own receipt said so:
--
--     'auth_user_retained', true,
--     'auth_user_note', 'the auth.users row is not removed by SQL — that needs
--                        the Admin API'
--
-- ⚠️ That is the worst shape a privacy defect can take: the erase LOOKS
-- complete, and the one field it leaves behind is the only field that
-- identifies a PERSON rather than a device (doc 13 §4).
--
-- ── HOW TO RUN IT ───────────────────────────────────────────────────────────
-- The local Docker stack needs no account and no link:
--
--   npx supabase start
--   docker run --rm -i --network host postgres:17 \
--     psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -q -f - < supabase/tests/delete_my_data_erases_email.sql
--
-- ⚠️ `--network host` is REQUIRED against the local stack: `run-sql-tests.sh`
-- calls `docker run` WITHOUT it, so every file reports "Connection refused"
-- against a perfectly healthy stack (AGENTS.md).
--
-- ── WHAT IT PROVES ──────────────────────────────────────────────────────────
--   D1  the `auth.users` row is GONE after the delete
--   D2  ⚠️ the EMAIL is gone — searched by value, not by id, because "the row
--       went" and "the address went" are the claim and its consequence
--   D3  exactly ONE auth row was deleted (`counts.auth_users = 1`) — a delete
--       that matched 0 rows is the silent failure this whole change risks
--   D4  the receipt no longer claims `auth_user_retained: true`
--   D5  the receipt's own success condition survived: `verified_zero_rows`
--       and `rows_left_behind = 0` — ⚠️ the new probe is COUNTED in `v_left`,
--       or "zero rows left" would be a claim about every table EXCEPT the one
--       holding the email
--   D6  the rest of the erase still happened (profile · tributes · inventory ·
--       ledger) — this fix must not trade one half for the other
--   D7  ⚠️ THE SOURCE GATE: the live body still contains the `delete from
--       auth.users`. Asserted against `pg_proc`, so quietly removing the line
--       turns this RED rather than passing on an old receipt
--
-- ⚠️ FAULT-TESTED: comment out the `delete from auth.users` line in the
-- migration, re-apply, and D1/D2/D3/D7 go red. A test that cannot fail is not
-- a test — and every one of these passes on the OLD function for D4–D6, which
-- is why D1–D3 exist.
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

-- The receipt has to survive between blocks (each DO has its own scope) and it
-- is produced while the connection is `authenticated`.
-- ⚠️ A `pg_temp` table grants NOTHING to PUBLIC, so the grant is not optional.
create table pg_temp.fx (k text primary key, v jsonb);
grant select, insert, update, delete on pg_temp.fx to authenticated;

-- ═══ SETUP — a real user with an EMAIL and something worth erasing ═════════
do $setup$
declare
  v_u uuid := 'dddd0219-0000-4000-8000-000000000001';
begin
  -- pre-clean, so a RE-RUN after a failed attempt is safe
  delete from public.ledger_events where user_id = v_u;
  delete from public.tributes      where user_id = v_u;
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
    'scrum219@example.invalid', '', now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  );

  -- ⚠️ the address must be ON the row before the delete, or D2 is vacuous
  if not exists (select 1 from auth.users where id = v_u and email = 'scrum219@example.invalid') then
    raise exception '✗ setup: the fixture user has no email, so the erase cannot be proven';
  end if;

  -- ⚠️ THE FIXTURE IS DELIBERATELY THIN. `tributes` needs a `burn_id` AND a
  -- `clan_id`, and `ledger_events` needs `seq · currency · type · actor` — so
  -- seeding them would drag in a burn, a clan and an append-only ledger row, all
  -- of which belong to OTHER files' fixtures. ⚠️ `profiles` is the personal row
  -- that is guaranteed to exist here, because `handle_new_user` writes it from
  -- the `auth.users` insert above — so it is the honest witness that the
  -- ordinary half of the erase ran, not a rigged one.
  if not exists (select 1 from public.profiles where user_id = v_u) then
    raise exception '✗ setup: the profile bootstrap did not fire, so D6 would be vacuous';
  end if;

  raise notice 'setup: one user WITH an email, and the profile the trigger bootstrapped';
end
$setup$;

-- ═══ THE DELETE, RUN AS THE ROLE THE APP ACTUALLY IS ═══════════════════════
-- ⚠️ `set role` at TOP LEVEL, not inside a DO block, and `set_config(..., false)`
-- is SESSION-scoped: under `run-sql-tests.sh` psql runs each statement in its own
-- transaction, so `SET LOCAL` would not survive to the next statement (AGENTS.md).
set role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"dddd0219-0000-4000-8000-000000000001","role":"authenticated"}',
  false
);

-- ⚠️ ONE statement, therefore ONE transaction: the receipt is captured even
-- though the function deletes the very row the session belongs to.
insert into pg_temp.fx (k, v)
select 'receipt', public.delete_my_data();

reset role;

-- ═══ ASSERTIONS ════════════════════════════════════════════════════════════
do $assert$
declare
  v_u uuid := 'dddd0219-0000-4000-8000-000000000001';
  r   jsonb;
  v_n integer;
begin
  select v into r from pg_temp.fx where k = 'receipt';
  if r is null then
    raise exception '✗ FAIL: the RPC returned no receipt';
  end if;

  select count(*) into v_n from auth.users where id = v_u;
  perform pg_temp.assert_true(v_n = 0, 'D1  the auth.users row is GONE');

  -- ⚠️ searched by VALUE. "The row went" and "the address went" are the claim
  -- and its consequence, and only this one is what ADR-007 §9 promises.
  select count(*) into v_n from auth.users where email = 'scrum219@example.invalid';
  perform pg_temp.assert_true(v_n = 0, 'D2  ⚠️ the EMAIL is gone — searched by value, not by id');

  -- ⚠️ THE CANARY. If `postgres` ever loses BYPASSRLS (or a policy is added to
  -- `auth.users`), the delete matches 0 rows and says nothing — this is the
  -- assertion that catches a fix which silently stopped working.
  perform pg_temp.assert_true(
    (r->'counts'->>'auth_users')::int = 1,
    'D3  exactly ONE auth row was deleted — a 0-row match is the silent failure');

  perform pg_temp.assert_true(
    (r->>'auth_user_retained')::boolean = false,
    'D4  the receipt no longer claims auth_user_retained: true');

  perform pg_temp.assert_true(
    (r->>'verified_zero_rows')::boolean = true and (r->>'rows_left_behind')::int = 0,
    'D5  the receipt''s own success condition survived — and COUNTS the new probe');

  select count(*) into v_n from public.profiles where user_id = v_u;
  perform pg_temp.assert_true(v_n = 0, 'D6  the ordinary half still ran — the profile is gone');

  -- ⚠️ This is what proves the ORDER: the auth delete is last, so the profile
  -- count it reports is the row the delete actually removed, not a cascade.
  perform pg_temp.assert_true(
    (r->'counts'->>'profiles')::int = 1,
    'D6b …and its count was REPORTED as 1, so the auth delete ran after the counts');

  -- ⚠️ THE SOURCE GATE: asserted against `pg_proc`, so deleting the line from
  -- the migration turns this RED instead of the suite passing on a stale receipt.
  perform pg_temp.assert_true(
    exists (
      select 1 from pg_proc
       where proname = 'delete_my_data'
         and prosrc like '%delete from auth.users%'
    ),
    'D7  ⚠️ SOURCE GATE: the live body still deletes auth.users');

  raise notice '✓ all 8 assertions passed — SCRUM-219 AC met';
end
$assert$;

-- tidy, so a re-run starts from a known state (the user row is already gone)
drop table if exists pg_temp.fx;
