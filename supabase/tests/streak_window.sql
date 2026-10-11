-- ═══════════════════════════════════════════════════════════════════════════
-- THE FORWARD-ONLY STREAK WINDOW, ASSERTED  (SCRUM-113 · doc 22 §4.2/§4.3)
--
--   docker run --rm -i --network host postgres:17 psql "<url>" \
--     -v ON_ERROR_STOP=1 -q -f - < supabase/tests/streak_window.sql
--
-- ⚠️ THE POINT OF THIS FILE IS ASSERTION GROUP 2. "The next local midnight
-- after the previous end" is monotonically forward but NOT >= 24h, and the
-- west-bound flight is where that shows up as a 12h window — a window the user
-- is REQUIRED to burn inside, i.e. a shortened deadline rather than a "grace
-- gap". Both halves of the rule are asserted, in both directions.
-- ⚠️ FAULT-TEST IT: remove the `interval '24 hours'` floor from
-- `streak_period_end` and confirm the 36h / 44h assertions go RED.
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
  -- A boundary the OLD (UTC) rule would have produced: 24:00 SGT.
  v_base  timestamptz := '2026-10-12 16:00:00+00'::timestamptz;   -- = 2026-10-13 00:00 SGT
  v_sgt   timestamptz;
  v_west  timestamptz;
  v_east  timestamptz;
  v_naive timestamptz;
  v_dst   timestamptz;
  v_hours numeric;
  v_prev  timestamptz;
  v_raised boolean;
  z       text;
  b       timestamptz;
  v_u     uuid := '00000000-0000-4000-8000-000000000911';
begin
  -- ── 1 · NO TRAVEL — a plain 24h local day ───────────────────────────────
  v_sgt := public.streak_period_end('Asia/Singapore', v_base);
  perform pg_temp.assert_true(v_sgt = '2026-10-13 16:00:00+00'::timestamptz,
    'doc 22 §4.2 · no travel: the next SGT midnight is +24h exactly (got ' || v_sgt || ')');
  perform pg_temp.assert_true(extract(epoch from (v_sgt - v_base)) / 3600 = 24,
    'doc 22 §4.2 · and the window is exactly 24h');

  -- ── 2 · ⚠️ THE TRAP — the naive rule gives a 12h window ─────────────────
  v_naive := public.next_local_midnight('America/New_York', v_base);
  perform pg_temp.assert_true(extract(epoch from (v_naive - v_base)) / 3600 = 12,
    '⚠️ doc 22 §4.2 · the NAIVE rule (next local midnight only) gives a 12h window west-bound — this is why the floor exists');
  perform pg_temp.assert_true(v_naive > v_base,
    '⚠️ doc 22 §4.2 · …and it is still MONOTONIC, which is why monotonicity alone is not enough');

  -- ── 3 · WEST — SGT -> UTC-4 (the "12 h away" case) ──────────────────────
  v_west := public.streak_period_end('America/New_York', v_base);
  perform pg_temp.assert_true(v_west = '2026-10-14 04:00:00+00'::timestamptz,
    'doc 22 §4.2 · west-bound the boundary lands on 2026-10-14 04:00Z (= 00:00 EDT) (got ' || v_west || ')');
  v_hours := extract(epoch from (v_west - v_base)) / 3600;
  perform pg_temp.assert_true(v_hours = 36,
    'doc 22 §4.2 · west-bound the window is 36h — never shortened (got ' || v_hours || 'h)');
  perform pg_temp.assert_true(v_west > v_naive,
    '⚠️ doc 22 §4.2 · the real rule is LATER than the naive one — it moves forward, not backward');

  -- ── 4 · EAST — SGT -> UTC+12 ────────────────────────────────────────────
  v_east := public.streak_period_end('Asia/Kamchatka', v_base);
  perform pg_temp.assert_true(v_east = '2026-10-14 12:00:00+00'::timestamptz,
    'doc 22 §4.2 · east-bound the boundary lands on 2026-10-14 12:00Z (got ' || v_east || ')');
  v_hours := extract(epoch from (v_east - v_base)) / 3600;
  perform pg_temp.assert_true(v_hours = 44,
    'doc 22 §4.2 · east-bound the window is 44h — never shortened (got ' || v_hours || 'h)');

  -- ── 5 · THE INVARIANTS, SWEPT over every zone we might realistically store
  for z in select unnest(array['Asia/Singapore','America/New_York','Asia/Kamchatka',
                               'Pacific/Auckland','Europe/London','America/Sao_Paulo',
                               'Australia/Sydney','Asia/Kolkata']) loop
    for b in select unnest(array[v_base,
                                 '2026-11-01 04:00:00+00'::timestamptz,   -- US DST end
                                 '2026-03-29 00:00:00+00'::timestamptz,   -- EU DST start
                                 '2026-06-15 09:30:00+00'::timestamptz]) loop
      v_prev := public.streak_period_end(z, b);
      perform pg_temp.assert_true(v_prev > b,
        'doc 22 §4.2 · ' || z || ' @ ' || b || ': forward-only (strictly after the previous end)');
      perform pg_temp.assert_true(extract(epoch from (v_prev - b)) >= 24 * 3600,
        'doc 22 §4.2 · ' || z || ' @ ' || b || ': the window is NEVER below 24h');
      perform pg_temp.assert_true((v_prev at time zone z)::time = time '00:00:00',
        'doc 22 §4.2 · ' || z || ' @ ' || b || ': and it IS a local midnight');
    end loop;
  end loop;

  -- ── 6 · DST — a 25h local day must not become a 23h window ──────────────
  v_dst := public.streak_period_end('America/New_York', '2026-11-01 04:00:00+00'::timestamptz);
  v_hours := extract(epoch from (v_dst - '2026-11-01 04:00:00+00'::timestamptz)) / 3600;
  perform pg_temp.assert_true(v_hours = 25,
    'doc 22 §4.2 · across the US DST end the window is 25h, not 23h (got ' || v_hours || 'h)');

  -- ── 7 · A NEW USER'S FIRST WINDOW IS NOT SHORT EITHER ───────────────────
  v_prev := public.first_streak_period_end('America/New_York', v_base);
  perform pg_temp.assert_true(extract(epoch from (v_prev - v_base)) >= 24 * 3600,
    'doc 22 §4.2 · a first-ever burn also gets >= 24h (got ' || v_prev || ')');

  -- ── 8 · AN INVALID ZONE MUST FAIL LOUDLY, NOT SILENTLY GUESS ────────────
  v_raised := false;
  begin
    perform public.next_local_midnight('Not/AZone', v_base);
  exception when others then v_raised := true;
  end;
  perform pg_temp.assert_true(v_raised,
    'doc 22 §4.4 · an unparseable IANA zone RAISES rather than falling back to a guessed offset');

  -- ── 9 · THE FALLBACK IS SINGAPORE, AND A STORED ZONE WINS ───────────────
  perform pg_temp.assert_true(public.streak_tz(v_u) = 'Asia/Singapore',
    'doc 22 §4.1 · an unknown user falls back to Asia/Singapore (Singapore-first)');
  perform pg_temp.assert_true(public.default_iana_tz() = 'Asia/Singapore',
    'doc 22 §4.1 · and the default lives in ONE function, so client and server cannot disagree');

  delete from public.profiles where user_id = v_u;
  insert into auth.users (id) values (v_u) on conflict do nothing;
  update public.profiles set iana_tz = 'America/New_York' where user_id = v_u;
  perform pg_temp.assert_true(public.streak_tz(v_u) = 'America/New_York',
    'doc 22 §4.1 · a stored zone is used verbatim — the client writes it, one-way');
  delete from public.profiles where user_id = v_u;
  delete from auth.users where id = v_u;

  perform pg_temp.assert_true(
    (select count(*) from public.profiles where user_id = v_u) = 0, 'fixtures removed');
end;
$t$;

select '✓ the forward-only streak window: every doc 22 §4.2/§4.3 claim holds' as result;
