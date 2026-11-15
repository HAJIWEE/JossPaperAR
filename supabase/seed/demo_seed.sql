-- ═══════════════════════════════════════════════════════════════════════════
-- THE DEMO FAMILY (SCRUM-198 · parent SCRUM-155 · guard SCRUM-199)
--
-- ⚠️⚠️ **EVERY NAME IN THIS FILE IS FICTIONAL, ON PURPOSE.** Names are the most
-- sensitive data in this system (doc 13 §4): a demo dataset that reads like real
-- people is a privacy problem waiting to be screenshotted. The surname is 陈
-- because it is the most common Chinese surname and reads as a placeholder, and
-- every given name below is invented. The clans carry `(demo)` and the users are
-- @example.invalid addresses so nothing here can be mistaken for a person.
--
-- ⚠️ **IDEMPOTENT BY CONSTRUCTION:** the first thing it does is run the teardown
-- for its OWN scope, so a second run rebuilds the same eight rows instead of
-- adding eight more. There is one definition of "the demo scope" — this file
-- includes the teardown rather than repeating its predicates.
--
-- ⚠️ **EVERY VALUE COMES FROM REAL CODE:** tablets via `save_ancestor`, purchases
-- via `purchase_item`, burns via `submit_burn` — the RPCs the app calls. The ONLY
-- raw writes are the two a demo cannot obtain through an RPC:
--   · `auth.users` rows (the Admin API's job; forged here exactly as the SQL
--     test harness does, so the profiles trigger still runs),
--   · the STARTER INVENTORY `grant` — `acquired_via` has a `grant` value for
--     precisely this, and a new account has no other way to hold an offering.
-- ⚠️ Nothing inserts into `ledger_events`; the append-only rule is not suspended
-- for demos. The one exception to immutability is the BACKDATE at the end, which
-- moves timestamps (never amounts) so the Book spans a month — labelled below.
--
-- ── HOW TO RUN IT ───────────────────────────────────────────────────────────
--   bash supabase/checks/run-demo-seed.sh
--   bash supabase/checks/run-demo-seed.sh "postgresql://…"   # explicit target
-- ⚠️ The runner calls the seed guard FIRST (SCRUM-199) and exits 2 on a target
-- that is not the local stack and not allow-listed.
-- ═══════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\ir demo_teardown.sql

create or replace function pg_temp.demo_assert(p_ok boolean, p_name text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then
    raise exception '✗ DEMO SEED FAILED: %', p_name;
  end if;
  raise notice '  ✓ %', p_name;
end;
$$;

-- ── 0 · identities (the Admin API's job, forged as the test harness does) ───
do $demo_users$
declare
  v_ids uuid[] := array[
    'de000000-0000-4000-8000-000000000001',  -- head
    'de000000-0000-4000-8000-000000000002',  -- rival 1
    'de000000-0000-4000-8000-000000000003',
    'de000000-0000-4000-8000-000000000004',
    'de000000-0000-4000-8000-000000000005'];
  v_emails text[] := array[
    'demo-head@example.invalid',
    'demo-rival1@example.invalid',
    'demo-rival2@example.invalid',
    'demo-rival3@example.invalid',
    'demo-rival4@example.invalid'];
  i integer;
begin
  for i in 1..array_length(v_ids, 1) loop
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      v_ids[i], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      v_emails[i], '', now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now()
    ) on conflict (id) do nothing;
  end loop;
  raise notice 'users: % demo identities (profiles created by the auth trigger)', array_length(v_ids, 1);
end
$demo_users$;

-- ── 1 · two clans: the populated one, and the EMPTY-BOOK one (SCRUM-122) ────
do $demo_clans$
declare
  v_head uuid := 'de000000-0000-4000-8000-000000000001';
begin
  insert into public.clans (id, name, code, created_by, ancestor_cap)
  values ('ce000000-0000-4000-8000-000000000001', '陈氏家祠 (demo)', 'DEMZFAM2', v_head, 10)
  on conflict (id) do nothing;

  insert into public.clans (id, name, code, created_by, ancestor_cap)
  values ('ce000000-0000-4000-8000-000000000002', '空祠 (demo)', 'DEMZEMPT', v_head, 10)
  on conflict (id) do nothing;

  insert into public.clan_members (clan_id, user_id, role, joined_at)
  values ('ce000000-0000-4000-8000-000000000001', v_head, 'head', now())
  on conflict (clan_id, user_id) do nothing;

  insert into public.clan_members (clan_id, user_id, role, joined_at)
  values ('ce000000-0000-4000-8000-000000000002', v_head, 'head', now())
  on conflict (clan_id, user_id) do nothing;

  raise notice 'clans: 1 populated (cap 10) + 1 EMPTY-BOOK clan';
end
$demo_clans$;

-- ── 2 · the four rivals are members, so they can burn in the same clan ──────
do $demo_members$
declare
  v_rivals uuid[] := array[
    'de000000-0000-4000-8000-000000000002',
    'de000000-0000-4000-8000-000000000003',
    'de000000-0000-4000-8000-000000000004',
    'de000000-0000-4000-8000-000000000005'];
  i integer;
begin
  for i in 1..array_length(v_rivals, 1) loop
    insert into public.clan_members (clan_id, user_id, role, joined_at)
    values ('ce000000-0000-4000-8000-000000000001', v_rivals[i], 'member', now())
    on conflict (clan_id, user_id) do nothing;
  end loop;
  raise notice 'members: head + 4 rivals (4 total cohort rivals) ';
end
$demo_members$;

-- ── 3 · STARTER INVENTORY — a grant, which is what `acquired_via` is for ───
-- ⚠️ A brand-new account has no tribute and no offering, so it cannot burn and
-- therefore cannot earn. The grant breaks that circle without touching the
-- ledger; every later offering is BOUGHT through `purchase_item`.
do $demo_inventory$
declare
  v_head   uuid := 'de000000-0000-4000-8000-000000000001';
  v_rivals uuid[] := array[
    'de000000-0000-4000-8000-000000000002',
    'de000000-0000-4000-8000-000000000003',
    'de000000-0000-4000-8000-000000000004',
    'de000000-0000-4000-8000-000000000005'];
  i integer;
begin
  insert into public.inventory (user_id, item_code, qty, acquired_via)
  values (v_head, 'joss_paper_stack', 12, 'grant')
  on conflict (user_id, item_code) do update set qty = 12;

  for i in 1..array_length(v_rivals, 1) loop
    insert into public.inventory (user_id, item_code, qty, acquired_via)
    values (v_rivals[i], 'joss_paper_stack', 4, 'grant')
    on conflict (user_id, item_code) do update set qty = 4;
  end loop;
  raise notice 'inventory: granted 12 + 4×4 joss stacks (the seed to burn, not the demo state)';
end
$demo_inventory$;

-- ── 4 · TEN TABLETS AT THE CAP — through `save_ancestor`, as the app does ──
do $demo_tablets$
declare
  v_head  uuid := 'de000000-0000-4000-8000-000000000001';
  v_clan  uuid := 'ce000000-0000-4000-8000-000000000001';
  v_names text[] := array['德明','秀兰','志强','美玲','建国','丽华','文轩','雅婷','浩然','静怡'];
  v_rel   text[] := array['祖父','祖母','父亲','母亲','伯父','姑母','兄长','姐姐','弟弟','妹妹'];
  i integer;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_head::text, 'role', 'authenticated')::text, false);

  for i in 0..9 loop
    perform public.save_ancestor(v_clan, '陈', v_names[i+1], v_rel[i+1], i::smallint, null);
  end loop;

  raise notice 'tablets: % (cap 10 — the overflow is deliberately exercised)',
    (select count(*) from public.ancestors
      where clan_id = v_clan and archived_at is null);
end
$demo_tablets$;

-- ── 5 · THE BOOK — eight burns for the head, three each for the rivals ─────
-- ⚠️ `submit_burn` is THE burn path: quota, streak, aim band, award, tribute
-- row and ledger entry all happen inside it. Nothing here writes the ledger.
-- ⚠️ `rate_counters` is cleared between burns because the 6/min limit is a real
-- gate (proven elsewhere) and a demo needs eleven burns, not one a minute.
do $demo_burns$
declare
  v_head   uuid := 'de000000-0000-4000-8000-000000000001';
  v_clan   uuid := 'ce000000-0000-4000-8000-000000000001';
  v_rivals uuid[] := array[
    'de000000-0000-4000-8000-000000000002',
    'de000000-0000-4000-8000-000000000003',
    'de000000-0000-4000-8000-000000000004',
    'de000000-0000-4000-8000-000000000005'];
  v_offsets integer[] := array[0, 20, 60, 0, 120, 20, 0, 60];
  u uuid;
  i integer;
begin
  -- the head: 8 offerings, mixed bands
  for i in 1..8 loop
    delete from public.rate_counters where user_id = v_head;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_head::text, 'role', 'authenticated')::text, false);
    perform public.submit_burn(
      v_head,
      jsonb_build_object('item_code', 'joss_paper_stack', 'accuracy', v_offsets[i],
                         'clan_id', v_clan),
      'demo:head:' || i);
  end loop;

  -- the rivals: 3 each, so the cohort has real points to rank
  foreach u in array v_rivals loop
    for i in 1..3 loop
      delete from public.rate_counters where user_id = u;
      perform set_config('request.jwt.claims',
        json_build_object('sub', u::text, 'role', 'authenticated')::text, false);
      perform public.submit_burn(
        u,
        jsonb_build_object('item_code', 'joss_paper_stack', 'accuracy', 20 * i,
                           'clan_id', v_clan),
        'demo:rival:' || u::text || ':' || i);
    end loop;
  end loop;

  raise notice 'burns: 8 (head) + 12 (rivals) through submit_burn';
end
$demo_burns$;

-- ── 6 · PURCHASES — through `purchase_item`, paid from EARNED tribute ──────
do $demo_purchases$
declare
  v_head uuid := 'de000000-0000-4000-8000-000000000001';
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_head::text, 'role', 'authenticated')::text, false);
  delete from public.rate_counters where user_id = v_head;

  perform public.purchase_item('joss_paper_stack', 'demo:buy:stacks:1');
  perform public.purchase_item('joss_paper_stack', 'demo:buy:stacks:2');
  perform public.purchase_item('lanterns',         'demo:buy:lanterns:1');

  raise notice 'purchases: 2 offerings + 1 decoration, debited from earned tribute';
end
$demo_purchases$;

-- ── 7 · A LEAGUE COHORT WITH RIVALS — so promotion has something to follow ─
do $demo_league$
declare
  v_head   uuid := 'de000000-0000-4000-8000-000000000001';
  v_rivals uuid[] := array[
    'de000000-0000-4000-8000-000000000002',
    'de000000-0000-4000-8000-000000000003',
    'de000000-0000-4000-8000-000000000004',
    'de000000-0000-4000-8000-000000000005'];
  v_labels text[] := array['DEMO · 陈家 head','DEMO · rival 1','DEMO · rival 2','DEMO · rival 3','DEMO · rival 4'];
  v_week   uuid;
  v_cohort uuid;
  i integer;
begin
  -- the CURRENT week (Monday-based), created once and reused
  insert into public.league_weeks (start_date, end_date, status)
  values (date_trunc('week', now())::date,
          (date_trunc('week', now()) + interval '6 days')::date, 'active')
  on conflict (start_date) do nothing;

  select id into v_week from public.league_weeks
   where start_date = date_trunc('week', now())::date;

  -- ⚠️ cohort_no 99 is the DEMO MARKER: the teardown can find this cohort
  -- without guessing, and a real cohort 1 is never touched.
  insert into public.cohorts (week_id, tier, cohort_no) values (v_week, 1, 99)
  on conflict (week_id, tier, cohort_no) do nothing;

  select id into v_cohort from public.cohorts
   where week_id = v_week and tier = 1 and cohort_no = 99;

  insert into public.cohort_members (cohort_id, user_id, display_label)
  values (v_cohort, v_head, v_labels[1]) on conflict (cohort_id, user_id) do nothing;

  for i in 1..array_length(v_rivals, 1) loop
    insert into public.cohort_members (cohort_id, user_id, display_label)
    values (v_cohort, v_rivals[i], v_labels[i + 1])
    on conflict (cohort_id, user_id) do nothing;
  end loop;

  raise notice 'league: cohort tier 1 (demo) with % members',
    (select count(*) from public.cohort_members where cohort_id = v_cohort);
end
$demo_league$;

-- ── 8 · A MONTH-LONG BOOK — the ONE demo-only timestamp move ───────────────
-- ⚠️ This UPDATEs timestamps so the Book spans four weeks instead of one day.
-- It never touches an amount, and it is scoped to the demo head. The two newest
-- burns stay in the current week so the cohort still has live points to rank.
do $demo_backdate$
declare
  v_head uuid := 'de000000-0000-4000-8000-000000000001';
  v_clan uuid := 'ce000000-0000-4000-8000-000000000001';
begin
  with ranked as (
    select id, row_number() over (order by created_at, id) as rn
      from public.burns where user_id = v_head and clan_id = v_clan
  )
  update public.burns b
     set created_at = now() - ((30 - r.rn * 4) || ' days')::interval
    from ranked r
   where b.id = r.id and r.rn <= 6;

  update public.tributes t set created_at = b.created_at
    from public.burns b where t.burn_id = b.id and b.user_id = v_head;

  update public.ledger_events le set created_at = b.created_at
    from public.burns b
   where le.ref_type = 'burn' and le.ref_id = b.id and b.user_id = v_head;

  raise notice 'Book: 6 entries spread over the last month, 2 kept in the current week';
end
$demo_backdate$;

-- ── 9 · THE SEED VERIFIES ITSELF — a partial build must not report success ──
do $demo_verify$
declare
  v_head  uuid := 'de000000-0000-4000-8000-000000000001';
  v_clan  uuid := 'ce000000-0000-4000-8000-000000000001';
  v_empty uuid := 'ce000000-0000-4000-8000-000000000002';
  v_tablets integer; v_book integer; v_cohort integer; v_inv integer; v_empty_book integer;
begin
  select count(*) into v_tablets from public.ancestors
   where clan_id = v_clan and archived_at is null;
  select count(*) into v_book from public.tributes where clan_id = v_clan;
  select count(*) into v_cohort from public.cohort_members where display_label like 'DEMO ·%';
  select coalesce(sum(qty), 0) into v_inv from public.inventory
   where user_id = v_head and item_code = 'joss_paper_stack';
  select count(*) into v_empty_book from public.tributes where clan_id = v_empty;

  perform pg_temp.demo_assert(v_tablets = 10, 'tablets = 10 (at the cap)');
  perform pg_temp.demo_assert(v_book >= 6,   'Book entries >= 6');
  perform pg_temp.demo_assert(v_cohort >= 5, 'cohort members >= 5');
  perform pg_temp.demo_assert(v_inv >= 2,    'inventory >= 2 joss stacks');
  perform pg_temp.demo_assert(v_empty_book = 0, 'the second clan has an EMPTY Book');

  raise notice 'DEMO READY — tablets % · Book % · cohort % · inventory %',
    v_tablets, v_book, v_cohort, v_inv;
end
$demo_verify$;
