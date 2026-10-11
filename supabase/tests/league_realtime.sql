-- ═══════════════════════════════════════════════════════════════════════════
-- THE LIVE BOARD'S PUBLISHER, ASSERTED  (SCRUM-11 step 6 · doc 18 E7)
--
--   docker run --rm -i --network host postgres:17 psql "<url>" \
--     -v ON_ERROR_STOP=1 -q -f - < supabase/tests/league_realtime.sql
--
-- ⚠️ THIS IS THE HALF THAT MAKES THE CLIENT'S SUBSCRIPTION MEAN SOMETHING.
-- `src/lib/league-api.ts` subscribes to the topic `league:{cohort_id}`. A
-- subscription to a topic nothing publishes to is the worst kind of live feature —
-- one that looks live and is not — so the publisher is asserted rather than assumed
-- to work because it compiles.
--
-- ⚠️ FAULT-TEST IT: `drop trigger league_broadcast_award on public.ledger_events`
-- and the first assertion below goes RED.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function pg_temp.assert_true(p_ok boolean, p_name text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception '✗ FAIL: %', p_name; end if;
  raise notice '  ✓ %', p_name;
end;
$$;

do $t$
declare
  v_u      uuid := '00000000-0000-4000-8000-000000000921';
  v_other  uuid := '00000000-0000-4000-8000-000000000922';
  v_week   uuid;
  v_cohort uuid;
  v_topic  text;
  v_before integer;
  v_after  integer;
  v_msg    record;
  v_keys   text[];
begin
  -- ── fixture: an ACTIVE week, a cohort, and one member ────────────────────
  delete from public.ledger_events where user_id in (v_u, v_other);
  delete from public.profiles      where user_id in (v_u, v_other);
  delete from auth.users           where id      in (v_u, v_other);
  delete from public.league_weeks  where start_date = '2031-01-06';   -- a far-future week

  insert into auth.users (id) values (v_u), (v_other);
  update public.profiles set display_label = 'LEAGUE RT' where user_id in (v_u, v_other);

  insert into public.league_weeks (start_date, end_date, status)
    values ('2031-01-06', '2031-01-12', 'active') returning id into v_week;
  insert into public.cohorts (week_id, tier) values (v_week, 2) returning id into v_cohort;
  insert into public.cohort_members (cohort_id, user_id, display_label)
    values (v_cohort, v_u, '陳氏 · Chen Family');
  v_topic := 'league:' || v_cohort::text;

  -- ── 1 · an AWARD by a placed member FIRES the topic ─────────────────────
  select count(*) into v_before from realtime.messages where topic = v_topic;

  insert into public.ledger_events
    (user_id, seq, currency, type, amount, ref_type, actor, idempotency_key)
  values (v_u, 1, 'tribute', 'award', 400, 'burn', 'test', 'league-rt-key-1');

  select count(*) into v_after from realtime.messages where topic = v_topic;
  perform pg_temp.assert_true(v_after = v_before + 1,
    'doc 18 E7 · an award by a PLACED member broadcasts on league:{cohort_id} (was ' || v_before || ', now ' || v_after || ')');

  select topic, event, payload, private into v_msg
    from realtime.messages where topic = v_topic order by inserted_at desc limit 1;
  perform pg_temp.assert_true(v_msg.event = 'board_changed',
    'doc 18 E7 · the event is board_changed — it must equal LEAGUE_CHANGED_EVENT on the client');
  perform pg_temp.assert_true(v_msg.private is not true,
    '⚠️ doc 18 E7 · the topic is PUBLIC — realtime.send defaults private to TRUE, which would reach the client as silence');

  -- ⚠️ THE PAYLOAD CARRIES NO CONTENT: a cohort id the subscriber already holds, a
  --    timestamp, and `id` — which realtime.send ADDS ITSELF (it is the message id,
  --    not something this trigger wrote). Nothing about who, how much, or which
  --    family — so a public topic discloses nothing, and the board itself is still
  --    fetched under RLS.
  select array(select jsonb_object_keys(v_msg.payload) order by 1) into v_keys;
  perform pg_temp.assert_true(v_keys = array['at', 'cohort_id', 'id'],
    '⚠️ doc 18 E7 · the payload is ONLY the cohort id, a timestamp and realtime''s own message id — got ' || v_keys::text);
  perform pg_temp.assert_true(
    not (v_msg.payload ?| array['user_id', 'amount', 'display_label', 'points', 'weekly_points']),
    '⚠️ doc 18 E7 · and NOTHING identifying — no user, no amount, no family name');

  -- ── 2 · a NON-AWARD moves no board ──────────────────────────────────────
  --    ⚠️ `refund`, not `spend` — the vocabulary is
  --    'award · purchase · accrual · grant · topup · refund · adjustment' and a
  --    made-up value is an enum error, not a test failure.
  select count(*) into v_before from realtime.messages where topic = v_topic;
  insert into public.ledger_events
    (user_id, seq, currency, type, amount, ref_type, actor, idempotency_key)
  values (v_u, 2, 'tribute', 'refund', 400, 'burn', 'test', 'league-rt-key-2');
  select count(*) into v_after from realtime.messages where topic = v_topic;
  perform pg_temp.assert_true(v_after = v_before,
    'doc 18 E7 · a REFUND is a movement but not points — no broadcast');

  -- ── 3 · an award by someone NOT PLACED is silent, not an error ──────────
  select count(*) into v_before from realtime.messages;
  insert into public.ledger_events
    (user_id, seq, currency, type, amount, ref_type, actor, idempotency_key)
  values (v_other, 1, 'tribute', 'award', 400, 'burn', 'test', 'league-rt-key-3');
  select count(*) into v_after from realtime.messages;
  perform pg_temp.assert_true(v_after = v_before,
    '⚠️ doc 18 E7 · an unplaced member''s award broadcasts nothing AND does not RAISE — most awards land there on a fresh install');

  -- ── 4 · a CLOSED week is not a board anyone is looking at ───────────────
  update public.league_weeks set status = 'closed' where id = v_week;
  select count(*) into v_before from realtime.messages where topic = v_topic;
  insert into public.ledger_events
    (user_id, seq, currency, type, amount, ref_type, actor, idempotency_key)
  values (v_u, 3, 'tribute', 'award', 400, 'burn', 'test', 'league-rt-key-4');
  select count(*) into v_after from realtime.messages where topic = v_topic;
  perform pg_temp.assert_true(v_after = v_before,
    'doc 18 E7 · once the week is CLOSED the board stops announcing');

  -- ── 5 · the SECURITY DEFINER trigger is not client-callable ─────────────
  perform pg_temp.assert_true(
    not has_function_privilege('anon', 'public.league_broadcast_award()', 'execute')
    and not has_function_privilege('authenticated', 'public.league_broadcast_award()', 'execute'),
    '⚠️ the definer trigger function is EXECUTE to nobody — a grant would be a privilege escalation');

  -- ── teardown ────────────────────────────────────────────────────────────
  delete from realtime.messages      where topic = v_topic;
  delete from public.ledger_events   where user_id in (v_u, v_other);
  delete from public.cohort_members  where cohort_id = v_cohort;
  delete from public.cohorts         where id = v_cohort;
  delete from public.league_weeks    where id = v_week;
  delete from public.profiles        where user_id in (v_u, v_other);
  delete from auth.users             where id      in (v_u, v_other);
  perform pg_temp.assert_true(
    (select count(*) from public.ledger_events where user_id in (v_u, v_other)) = 0,
    'fixtures removed');
end;
$t$;

select '✓ the live league board: the publisher fires, and leaks nothing' as result;
