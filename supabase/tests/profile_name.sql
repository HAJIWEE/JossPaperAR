-- ═══════════════════════════════════════════════════════════════════════════════
-- SCRUM-223 VERIFICATION — the derived profile name and the once-a-week limit
--
-- Run it like the other files: the CLI's migration path is the runner (there is no local
-- `psql` and no `supabase query`). Against the LOCAL stack:
--   docker run --rm -i --network host postgres:17 psql \
--     'postgresql://postgres:postgres@127.0.0.1:54322/postgres' -v ON_ERROR_STOP=1 -q \
--     -f - < supabase/tests/profile_name.sql
-- ⚠️ `--network host` is REQUIRED, or every assertion reports "connection refused".
--
-- ── WHAT IT PROVES (each assertion RAISES, so the run is green or red) ─────────
--   S1  the derivation: +tag, dot/digit tails, CJK, punctuation, no '@'
--   S2  a sign-up WITH an email gets the name, and the clock does NOT start
--   S3  a change records the time, and a second change inside 7 days is REFUSED
--   S4  a client cannot reset its own cooldown (the timestamp is server-owned)
--   S5  ⚠️ the anonymous→email UPGRADE derives the name and starts no clock —
--       the path `handle_new_user` cannot see, because it is an UPDATE
--   S6  the upgrade never overwrites a name the person chose
--   S7  an anonymous user (no email) stays nameless
--
-- ⚠️ FAULT-TEST IT: comment out the `joss.name_defaulted` branch in
-- `enforce_name_change_limit` and S5 goes RED — which is the point, because that
-- branch is the only thing stopping a DEFAULT from costing the user their first change.
-- ═══════════════════════════════════════════════════════════════════════════════

create or replace function pg_temp.assert_true(p_ok boolean, p_name text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception '✗ FAIL: %', p_name; end if;
end;
$$;

do $t$
declare
  u_mail   uuid := gen_random_uuid();
  u_anon   uuid := gen_random_uuid();
  u_pick   uuid := gen_random_uuid();
  v_name   text;
  v_at     timestamptz;
  v_pairs  text[][];
  i        int;
begin
  -- ── S1 · the derivation ────────────────────────────────────────────────────
  v_pairs := array[
    ['hajiwee94.11@example.com', 'Hajiwee94'],   -- dot + digit tail
    ['gwee+work@example.com',    'Gwee'],        -- +tag
    ['john.smith99@example.com', 'John'],        -- first segment with a letter
    ['_gwee_@example.com',       'Gwee'],        -- punctuation at both ends
    ['张.伟@example.com',         '张伟'],        -- CJK: the dot is stripped, not split on
    ['94.11@example.com',        '94'],          -- nothing had a letter — first segment
    ['@example.com',             null],          -- empty local part
    ['noatsign',                 'Noatsign']     -- no '@' at all still yields the local part
  ];
  for i in 1 .. array_length(v_pairs, 1) loop
    declare
      got text := public.simplified_name_from_email(v_pairs[i][1]);
    begin
      perform pg_temp.assert_true(
        got is not distinct from v_pairs[i][2],
        format('S1 · %s -> %s (got %s)', v_pairs[i][1], coalesce(v_pairs[i][2], 'NULL'), coalesce(got, 'NULL')));
    end;
  end loop;

  -- ── S2 · a sign-up WITH an email gets the name, and NO clock ──────────────
  insert into auth.users (id, email) values (u_mail, 'hajiwee94.11@example.com');
  select chosen_name, name_changed_at into v_name, v_at
    from public.profiles where user_id = u_mail;
  perform pg_temp.assert_true(v_name = 'Hajiwee94', 'S2 · the sign-up default is applied');
  perform pg_temp.assert_true(v_at is null, 'S2 · a DERIVED name starts no cooldown — it was not a choice');

  -- ── S3 · a change records the time; an early second change is REFUSED ─────
  update public.profiles set chosen_name = 'Ah Gwee' where user_id = u_mail;
  select name_changed_at into v_at from public.profiles where user_id = u_mail;
  perform pg_temp.assert_true(v_at is not null, 'S3 · a real change records the time');
  begin
    update public.profiles set chosen_name = 'Gwee Two' where user_id = u_mail;
    perform pg_temp.assert_true(false, 'S3 · an early second change must be REFUSED');
  exception when others then
    perform pg_temp.assert_true(sqlerrm like '%name_change_too_soon%',
      'S3 · refused with the stable key the client translates (got: ' || sqlerrm || ')');
  end;
  perform pg_temp.assert_true(
    (select chosen_name from public.profiles where user_id = u_mail) = 'Ah Gwee',
    'S3 · the refused write changed nothing');

  -- ── S4 · the client cannot reset its own cooldown ─────────────────────────
  -- ⚠️ `profiles_update_own` is column-agnostic: without the trigger this PATCH would
  -- hand the caller a fresh week. Setting the SAME name must not touch the timestamp.
  update public.profiles set chosen_name = 'Ah Gwee', name_changed_at = null where user_id = u_mail;
  perform pg_temp.assert_true(
    (select name_changed_at from public.profiles where user_id = u_mail) is not null,
    'S4 · name_changed_at is SERVER-OWNED — a client PATCH cannot clear it');


  -- ── S5 · ⚠️ THE ANONYMOUS → EMAIL UPGRADE (the path that actually runs) ────
  -- ⚠️ Insert with NO email: `handle_new_user` runs, derives NULL, and the person is nameless.
  insert into auth.users (id) values (u_anon);
  perform pg_temp.assert_true(
    (select chosen_name from public.profiles where user_id = u_anon) is null,
    'S5 · an anonymous account starts nameless (nothing to derive)');

  -- ⚠️ Now the address arrives — an UPDATE on auth.users, which `handle_new_user` never sees.
  update auth.users set email = 'gwee.jiahan+shrine@example.com' where id = u_anon;
  select chosen_name, name_changed_at into v_name, v_at
    from public.profiles where user_id = u_anon;
  perform pg_temp.assert_true(v_name = 'Gwee', 'S5 · the upgrade path DERIVES the name (this is the main journey)');
  perform pg_temp.assert_true(v_at is null,
    'S5 · ⚠️ …and starts NO clock — a default must not spend the user''s first change');

  -- ── S6 · the upgrade never overwrites a chosen name ───────────────────────
  insert into auth.users (id, email) values (u_pick, 'someone@example.com');
  update public.profiles set chosen_name = 'Ah Ma' where user_id = u_pick;
  update auth.users set email = 'renamed@example.com' where id = u_pick;
  perform pg_temp.assert_true(
    (select chosen_name from public.profiles where user_id = u_pick) = 'Ah Ma',
    'S6 · a name the person CHOSE is never replaced by a derived one');

  -- ── S7 · an anonymous account stays nameless ──────────────────────────────
  perform pg_temp.assert_true(
    public.simplified_name_from_email(null) is null,
    'S7 · no email means no derived name — the screen keeps its call to action');

  -- ── teardown ──────────────────────────────────────────────────────────────
  delete from public.profiles where user_id in (u_mail, u_anon, u_pick);
  delete from auth.users where id in (u_mail, u_anon, u_pick);
  perform pg_temp.assert_true(
    (select count(*) from public.profiles where user_id in (u_mail, u_anon, u_pick)) = 0,
    'fixtures removed');
end;
$t$;

select '✓ the derived profile name and the once-a-week limit: every SCRUM-223 claim holds' as result;
