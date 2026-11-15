-- ═══════════════════════════════════════════════════════════════════════════
-- THE GROUND BONUS DECAYS PER BURN (SCRUM-237 · SCRUM-12 · SCRUM-235)
--
-- ⚠️ WHAT THIS REPLACES. The ground bonus was BINARY: `submit_burn` computed
-- `new_ground = not exists (… cell_burns … day < v_day)` and paid ×2.0 the first
-- time a user burned in a coarse cell, then ×1.0 forever. SCRUM-235 (answered
-- 2026-11-15) makes it a DECAY:
--
--   the first burn is ×2.0, and each later burn in the same cell decays the
--   bonus above ×1.0 exponentially and FRONT-LOADED — the first drop is 0.25,
--   then the rate of dropping shrinks — so as to encourage exploration.
--
--     multiplier(n) = 1 + min(×2.0 − 1, 0.75^(n−1))      n = lifetime burn no.
--                     2.000 · 1.750 · 1.563 · 1.422 · 1.316 · 1.237 … → 1.000
--
-- ⚠️ THE COUNTER IS LIFETIME, PER (user, cell). `cell_burns` is keyed per DAY,
-- so the lifetime total is `sum(burn_count)` — NO new table. A DAILY reset would
-- let a user re-earn ×2.0 in one spot every day and defeat the incentive.
--
-- ⚠️ `burns.new_ground` STAYS TRUTHFUL: it is now exactly "n = 1" — the first
-- burn in that cell — not "a bonus was paid".
--
-- ⚠️ `c_max_award` (1,650) is UNCHANGED: the first burn is still ×2.0, so the
-- ceiling does not move.
--
-- ⚠️ `v_clamped` IS NOW COMPUTED BEFORE ROUNDING. It used to be `v_award < v_raw`
-- AFTER `::integer`, which mis-reports once the multiplier makes fractions
-- (853.125 → 853 would read as "clamped" though nothing was clamped).
--
-- APPLIED MIGRATIONS ARE IMMUTABLE — this REPLACES the function from
-- 20261011170000_streak_local_day.sql rather than editing it.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.submit_burn(p_actor uuid, p_payload jsonb, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  -- caps + constants — the SQL twin of src/domain/award.ts & quota.ts
  c_base          constant integer := 400;
  c_new_ground    constant numeric := 2.0;    -- ⚠️ the n = 1 ceiling (SCRUM-237)
  c_ground_decay  constant numeric := 0.75;   -- the bonus above 1x × this each burn
  c_ground_eps    constant numeric := 0.005;  -- below this the bonus IS 0 → fixed at 1x
  c_streak_bonus  constant integer := 50;
  c_max_award     constant integer := 1650;
  c_max_day_award constant integer := 49500;   -- 30 burns × 1,650
  c_photo_day     constant integer := 10;
  c_store_day     constant integer := 20;
  c_burn_per_min  constant integer := 6;

  v_key         text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_tz            text := public.streak_tz(p_actor);
  -- ⚠️ SCRUM-113: the USER'S LOCAL DAY, not the server UTC day. It keys
  -- the quota, the new-ground decay tick and the derived ceiling.
  v_day           date := (now() at time zone public.streak_tz(p_actor))::date;
  v_capture_id  uuid;
  v_item_code   text;
  v_clan_id     uuid;
  v_ancestor_id uuid;
  v_accuracy    numeric;
  v_cell        text;
  v_client_time timestamptz;
  v_kind        text;
  v_band        public.aim_band;
  v_mult        numeric;
  v_new_ground  boolean := false;
  -- ⚠️ SCRUM-237 — the LIFETIME burn count in v_cell, INCLUDING this burn, and
  -- the multiplier derived from it. 1.0 when no cell was sent.
  v_cell_burns   integer := 0;
  v_ground_bonus numeric := 0;
  v_ground_mult  numeric := 1.0;
  v_streak_day  smallint := 0;
  v_streak_active boolean := false;
  v_cur_days    integer;
  v_prev_end      timestamptz;
  v_period_start  timestamptz;
  v_period_end    timestamptz;
  v_fresh         boolean := false;
  v_same_window   boolean := false;
  v_base        numeric;
  v_raw         numeric;
  v_award       integer := 0;
  v_clamped     boolean := false;
  v_day_award   bigint;
  v_room        integer;
  v_burn_id     uuid;
  v_seq         bigint;
  v_balance     bigint;
  v_photo_used  integer;
  v_store_used  integer;
  v_existing    public.burns;
  v_consumed    integer;
begin
  -- ── 0 · identity ──────────────────────────────────────────────────────────
  if p_actor is null then
    raise exception 'submit_burn requires an authenticated actor' using errcode = '42501';
  end if;
  -- Every table below FKs to profiles, so a missing bootstrap row is a real
  -- error, not a silent no-op (the auth trigger creates it — migration 0006).
  if not exists (select 1 from public.profiles where user_id = p_actor) then
    raise exception 'no profile for actor % — sign-in bootstrap has not run', p_actor
      using errcode = '23503';
  end if;

  -- ── 1 · the key must be present, or replay-safety is impossible ───────────
  if v_key is null or char_length(v_key) < 8 or char_length(v_key) > 200 then
    raise exception 'idempotency_key must be 8..200 characters' using errcode = '22023';
  end if;

  -- ── 2 · REPLAY FIRST (before the rate limit, doc 11 §5) ───────────────────
  -- One key → one burn → one award, forever. The same key from another account,
  -- or the same key with a materially different payload, is an abuse signal,
  -- not a replay (doc 11 §6.7): reject and flag, never silently re-award.
  select * into v_existing from public.burns where idempotency_key = v_key;
  if found then
    if v_existing.user_id <> p_actor then
      insert into public.integrity_flags (user_id, signal, severity, evidence)
      values (p_actor, 'idempotency_key_reuse', 3,
              jsonb_build_object('key', v_key, 'owner', v_existing.user_id));
      raise exception 'idempotency key already used by another account' using errcode = '23505';
    end if;

    if v_existing.capture_id is distinct from nullif(p_payload->>'capture_id', '')::uuid
       or v_existing.item_code is distinct from nullif(btrim(coalesce(p_payload->>'item_code', '')), '')
       or v_existing.clan_id   is distinct from nullif(p_payload->>'clan_id', '')::uuid
       or (p_payload->>'accuracy') is null
       or v_existing.accuracy  is distinct from least(round((p_payload->>'accuracy')::numeric, 2), 99999.99)
    then
      insert into public.integrity_flags (user_id, signal, severity, evidence)
      values (p_actor, 'idempotency_key_payload_mismatch', 3,
              jsonb_build_object('key', v_key, 'burn_id', v_existing.id));
      raise exception 'idempotency key replayed with a different payload' using errcode = '22000';
    end if;

    select balance into v_balance from public.balances
      where user_id = p_actor and currency = 'tribute';
    return jsonb_build_object(
      'band',              v_existing.band,
      'award',             v_existing.award_snapshot,
      'new_ground',        v_existing.new_ground,
      'streak_day',        coalesce(v_existing.streak_day, 0),
      'tribute_balance',   coalesce(v_balance, 0),
      'idempotent_replay', true,
      'burn_id',           v_existing.id
    );
  end if;

  -- ── 3 · parse + shape the payload ────────────────────────────────────────
  v_capture_id  := nullif(p_payload->>'capture_id', '')::uuid;
  v_item_code   := nullif(btrim(coalesce(p_payload->>'item_code', '')), '');
  v_clan_id     := nullif(p_payload->>'clan_id', '')::uuid;
  v_ancestor_id := nullif(p_payload->>'ancestor_id', '')::uuid;
  v_cell        := nullif(btrim(coalesce(p_payload->>'cell_hash', '')), '');
  v_client_time := nullif(p_payload->>'client_time', '')::timestamptz;

  if (p_payload->>'accuracy') is not null then
    v_accuracy := (p_payload->>'accuracy')::numeric;
  else
    raise exception 'accuracy is required — the client asserts the offset, never the band'
      using errcode = '22023';
  end if;
  -- Clip the STORED value to what numeric(8,2) can hold. The band is derived
  -- from the real value first, so a huge offset still grades as a miss.
  v_accuracy := least(v_accuracy, 99999.99);

  if v_clan_id is null then
    raise exception 'clan_id is required — a burn is clan-scoped (doc 15 §6)'
      using errcode = '22023';
  end if;
  if (v_capture_id is not null) = (v_item_code is not null) then
    raise exception 'exactly one of capture_id / item_code is required' using errcode = '22023';
  end if;
  if char_length(coalesce(v_cell, '')) > 16 then
    raise exception 'cell_hash is too long (max 16 — a coarse ~4-block cell)' using errcode = '22023';
  end if;

  v_kind := case when v_capture_id is not null then 'photo' else 'store' end;

  -- ── 4 · one writer per user at a time, then the 6/min window ──────────────
  -- The advisory lock makes the quota count, the seq assignment and the streak
  -- update race-free without serialisable isolation (cheap at alpha scale).
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text, 0));

  if not public.rate_limit_allow(p_actor, 'submit_burn', c_burn_per_min) then
    insert into public.integrity_flags (user_id, signal, severity, evidence)
    values (p_actor, 'rate_limit_submit_burn', 1,
            jsonb_build_object('limit_per_min', c_burn_per_min));
    -- The client maps this to the "shrine is busy" copy, never a raw 429 (doc 11 §5).
    raise exception 'the shrine is busy — try again in a moment' using errcode = 'P0001';
  end if;

  -- ── 5 · clan membership (the burn is clan-scoped) ────────────────────────
  if not exists (
    select 1 from public.clan_members where clan_id = v_clan_id and user_id = p_actor
  ) then
    raise exception 'actor is not a member of clan %', v_clan_id using errcode = '42501';
  end if;

  -- ── 6 · the offering must be real, owned and burnable ────────────────────
  -- NOTHING here is trusted from the client: existence, ownership and the store
  -- price all come from the server's own tables (doc 07 §5.1.6).
  if v_capture_id is not null then
    if not exists (
      select 1 from public.captures
      where id = v_capture_id and user_id = p_actor and status = 'styled'
    ) then
      raise exception 'capture % is not a styled capture owned by the actor', v_capture_id
        using errcode = '42501';
    end if;
  else
    if not exists (
      select 1 from public.offerings_catalog where code = v_item_code and burnable
    ) then
      raise exception 'unknown or non-burnable offering: %', v_item_code using errcode = '22023';
    end if;
    -- ⚠️ S9 — CHECK ownership only. The offering is NOT consumed here: it is
    -- consumed in the transaction section below, and only when the throw
    -- actually burned something. A MISS RETURNS IT (S9).
    if not exists (
      select 1 from public.inventory
      where user_id = p_actor and item_code = v_item_code and qty >= 1
    ) then
      raise exception 'offering % is not in the actor''s inventory', v_item_code
        using errcode = '42501';
    end if;
  end if;

  if v_ancestor_id is not null and not exists (
    select 1 from public.ancestors
    where id = v_ancestor_id and clan_id = v_clan_id and archived_at is null
  ) then
    raise exception 'ancestor % does not belong to clan %', v_ancestor_id, v_clan_id
      using errcode = '42501';
  end if;

  -- ── 6b · THE LOCAL PERIOD (SCRUM-113) ────────────────
  -- Resolved ONCE, BEFORE the quota read, because the quota, the ceiling and
  -- the streak all key off the same window. `v_day` stays the local DATE for
  -- the display rollups; the window is an INSTANT pair, stored in UTC.
  select current_days, period_end, period_start
    into v_cur_days, v_prev_end, v_period_start
    from public.streaks where user_id = p_actor;

  if not found then
    v_fresh := true;
    v_period_start := (v_day::timestamp at time zone v_tz);  -- their local midnight
    v_period_end   := public.first_streak_period_end(v_tz, now());
  elsif now() < v_prev_end then
    v_same_window := true;                 -- already burned inside this window
    v_period_end := v_prev_end;
  else
    v_period_end := public.streak_period_end(v_tz, v_prev_end);
    while v_period_end <= now() loop
      v_cur_days := 0;                     -- a whole window or more was missed
      v_period_end := public.streak_period_end(v_tz, v_period_end);
    end loop;
    -- CONTIGUOUS: the window starts where the last one ended, so the travel
    -- gap belongs to the NEXT period (doc 22 §4.3, option (ii)).
    v_period_start := v_prev_end;
  end if;

  -- ── 7 · daily quota, PER USER (shared across every clan — doc 15 §5.2) ────
  -- The slice's `quotas` table carries ONE counter (doc 10 §7 promised per-kind
  -- columns that were never applied), so the per-kind counts are derived from
  -- `burns` — which is the authoritative record anyway. See the PR findings.
  select count(*) filter (where capture_id is not null),
         count(*) filter (where item_code  is not null)
    into v_photo_used, v_store_used
    from public.burns
   where user_id = p_actor
     and created_at >= v_period_start;

  if v_kind = 'photo' and v_photo_used >= c_photo_day then
    raise exception 'daily photo allowance is complete' using errcode = 'P0001';
  end if;
  if v_kind = 'store' and v_store_used >= c_store_day then
    raise exception 'daily store allowance is complete' using errcode = 'P0001';
  end if;

  -- ── 8 · band · new ground · streak — all SERVER-derived ───────────────────
  v_band := public.aim_band_for(v_accuracy);

  -- ── THE RETHROW CAP, ENFORCED HERE (SCRUM-79 · doc 16 Q4 · ADR-005) ──────
  -- ⚠️ DERIVED, never accepted from the caller. A MISS still writes a `burns`
  -- row (S9 — see the note on the miss branch below), so "a prior burn exists
  -- for this capture by this actor" IS "this is a rethrow". That is why the
  -- attempt count is counted HERE rather than passed in: an attempt count from
  -- the client would be bypassable by construction, which is the whole defect.
  -- ⚠️ Capped BEFORE the multiplier is read, so the award, the streak and the
  -- Book all see the capped band — the cap cannot be half-applied.
  -- ⚠️ Scoped to (p_actor, v_capture_id): another member burning the same
  -- capture in the clan must not cap YOUR first throw. v_capture_id is NULL for
  -- a store burn, and the guard skips it — store burns have no capture to
  -- rethrow against.
  if v_capture_id is not null and v_band = 'bullseye' then
    if exists (
      select 1 from public.burns
      where user_id = p_actor
        and capture_id = v_capture_id
    ) then
      v_band := 'devout';             -- 虔誠 ×1.5 — 正中 is first-throw only
    end if;
  end if;

  v_mult := public.aim_band_multiplier(v_band);

  if v_mult = 0 then
    -- A miss returns the offering (S9). It still writes a `burns` row so the
    -- rethrow is a NEW burn, never an edit (doc 07 §6) — but it mints nothing,
    -- advances no streak and creates no Book entry.
    v_new_ground := false;
    v_streak_day := 0;
    v_award      := 0;
  else
    if v_cell is not null then
      -- ⚠️ SCRUM-237 — THE LIFETIME BURN COUNT, *INCLUDING THIS ONE*.
      -- `cell_burns` is keyed (user, cell, DAY), so the lifetime total is the SUM
      -- of the per-day counts — no new table. ⚠️ A DAILY reset is not acceptable:
      -- it would let a user re-earn ×2.0 in one spot every day (see the header).
      -- ⚠️ `grid_cells` is aggregate-only and holds NO identity; it is NOT read
      -- here, and it still receives the aggregate below (doc 11 §1).
      select coalesce(sum(burn_count), 0) into v_cell_burns
        from public.cell_burns
       where user_id = p_actor and cell_id = v_cell;

      v_cell_burns := v_cell_burns + 1;         -- this burn IS the nth
      v_new_ground := (v_cell_burns = 1);       -- ⚠️ truthful: n = 1, not "paid"

      -- The bonus ABOVE ×1.0 decays per burn: 2.000 · 1.750 · 1.563 · 1.422 …
      -- ⚠️ `least(c_new_ground - 1, …)` keeps the ×2.0 ceiling LOAD-BEARING
      -- rather than a comment; `c_ground_eps` is what "fixed at ×1.0" means.
      v_ground_bonus := least(c_new_ground - 1,
                              power(c_ground_decay, v_cell_burns - 1));
      if v_ground_bonus < c_ground_eps then
        v_ground_bonus := 0;                    -- fixed at ×1.0
      end if;
      v_ground_mult := 1.0 + v_ground_bonus;
    end if;

    -- The bounds were resolved in 6b; this only reads the streak COUNTER.
    if v_fresh then
      v_streak_day := 1;
      v_streak_active := false;          -- day 1 of a chain is not yet a streak
    elsif v_same_window then
      v_streak_day := greatest(1, v_cur_days);
      v_streak_active := v_streak_day >= 2;
    else
      v_streak_day := v_cur_days + 1;    -- the NEXT window (0 + 1 after a gap)
      v_streak_active := v_cur_days >= 1;  -- needs a live PREVIOUS window
    end if;

    if v_streak_day < 1 then v_streak_day := 1; end if;   -- 0 is reserved for a miss

    v_base := c_base * v_mult;
    -- ⚠️ SCRUM-237: the GROUND MULTIPLIER scales the band base, so n = 1 is
    -- ×2.0 and later burns decay toward ×1.0 (never below). When no cell was
    -- sent, `v_ground_mult` is 1.0 and this is exactly the old maths.
    v_raw  := v_base * v_ground_mult
            + (case when v_streak_active then c_streak_bonus else 0 end);
    -- ⚠️ clamped is decided BEFORE rounding — a fraction must not read as a clamp.
    v_clamped := least(c_max_award, v_raw) < v_raw;
    v_award   := least(c_max_award, v_raw)::integer;      -- 0 … 1,650 / burn
  end if;

  -- ── 9 · the DERIVED daily ceiling (49,500) — the second belt ─────────────
  -- Impossible by construction once the caps above hold; if it ever binds, a
  -- code path has broken, so CLAMP and LOG rather than trust it (doc 11 §4/§6.1).
  select coalesce(sum(amount), 0) into v_day_award
    from public.ledger_events
   where user_id = p_actor and currency = 'tribute' and type = 'award'
     and created_at >= v_period_start;
  v_room := greatest(0, c_max_day_award - v_day_award::integer);
  if v_award > v_room then
    insert into public.integrity_flags (user_id, signal, severity, evidence)
    values (p_actor, 'daily_award_ceiling', 4,
            jsonb_build_object('day', v_day, 'tz', v_tz, 'period_start', v_period_start,
              'already', v_day_award, 'proposed', v_award));
    v_award   := v_room;
    v_clamped := true;
  end if;

  -- ── 10 · write, in ONE transaction ───────────────────────────────────────
  insert into public.burns (
    user_id, clan_id, ancestor_id, item_code, capture_id,
    band, accuracy, cell_id, new_ground, streak_day,
    award_snapshot, client_time, idempotency_key
  ) values (
    p_actor, v_clan_id, v_ancestor_id, v_item_code, v_capture_id,
    v_band, v_accuracy, v_cell, v_new_ground, nullif(v_streak_day, 0),
    v_award, v_client_time, v_key
  ) returning id into v_burn_id;

  if v_award > 0 then
    -- per-user monotonic sequence; the advisory lock above makes this safe
    select coalesce(max(seq), 0) + 1 into v_seq
      from public.ledger_events where user_id = p_actor;

    insert into public.ledger_events (
      user_id, seq, currency, type, amount, ref_type, ref_id, actor, idempotency_key
    ) values (
      p_actor, v_seq, 'tribute', 'award', v_award, 'burn', v_burn_id, 'award-service', v_key
    );

    -- The Book of Tributes records offerings that were actually MADE
    -- (doc 15 §7.1 — no image, and no per-ancestor attribution required).
    insert into public.tributes (burn_id, user_id, clan_id, ancestor_id, item_code, points)
    values (v_burn_id, p_actor, v_clan_id, v_ancestor_id, v_item_code, v_award);
  end if;

  -- ⚠️ S9 — the offering is consumed ONLY when it actually burned. A MISS
  -- RETURNS IT, so a miss must not decrement. That is the whole point of the
  -- 0007 migration; putting the decrement here (after the band is known) is
  -- the fix. `get diagnostics` makes a silent drift a loud failure.
  if v_item_code is not null and v_mult <> 0 then
    update public.inventory set qty = qty - 1
     where user_id = p_actor and item_code = v_item_code and qty >= 1;
    get diagnostics v_consumed = row_count;
    if v_consumed <> 1 then
      raise exception 'offering % could not be consumed', v_item_code using errcode = 'P0001';
    end if;
  end if;

  -- Quota rollup for display; the per-kind caps above are the authority.
  -- ⚠️ `v_day` is the USER'S LOCAL date (SCRUM-113): two users' rows can
  -- carry the same day for different real windows — fine, keyed by user.
  insert into public.quotas (user_id, day, burns_used)
  values (p_actor, v_day, 1)
  on conflict (user_id, day) do update set burns_used = public.quotas.burns_used + 1;

  -- The decay tick — a coarse cell only, NEVER a coordinate, NEVER a trail.
  if v_cell is not null then
    insert into public.cell_burns (user_id, cell_id, day, burn_count)
    values (p_actor, v_cell, v_day, 1)
    on conflict (user_id, cell_id, day)
      do update set burn_count = public.cell_burns.burn_count + 1;

    insert into public.grid_cells (cell_id, value, last_burn_at)
    values (v_cell, v_award, now())
    on conflict (cell_id)
      do update set value = public.grid_cells.value + v_award, last_burn_at = now();
  end if;

  if v_award > 0 then
    insert into public.streaks
      (user_id, current_days, last_burn_date, period_start, period_end)
    values (p_actor, v_streak_day, v_day, v_period_start, v_period_end)
    on conflict (user_id) do update
      set current_days   = excluded.current_days,
          last_burn_date = excluded.last_burn_date,
          period_start   = excluded.period_start,
          period_end     = excluded.period_end;
  end if;

  select balance into v_balance from public.balances
    where user_id = p_actor and currency = 'tribute';

  return jsonb_build_object(
    'band',              v_band,
    'multiplier',        v_mult,
    'award',             v_award,
    'new_ground',        v_new_ground,
    'streak_day',        v_streak_day,
    'clamped',           v_clamped,
    'kind',              v_kind,
    'tribute_balance',   coalesce(v_balance, 0),
    'idempotent_replay', false,
    'burn_id',           v_burn_id
  );
end;
$function$

;

-- ═══ GRANTS — re-asserted so this file can be applied on its own ═══════════
revoke execute on function public.submit_burn(uuid, jsonb, text) from public;
revoke execute on function public.submit_burn(uuid, jsonb, text) from anon;
revoke execute on function public.submit_burn(uuid, jsonb, text) from authenticated;
grant  execute on function public.submit_burn(uuid, jsonb, text) to service_role;

comment on function public.submit_burn(uuid, jsonb, text) is
  'THE SPINE (body current as of 20261115130000 — the SCRUM-79 server-side rethrow cap, the SCRUM-113 LOCAL-DAY key, PLUS the SCRUM-237 ground-bonus decay). One transaction = one burn (+ one award ledger row when it earns). The client asserts `accuracy`; the server derives `band`, recomputes quota/streak/ground, clamps the award to 0..1,650 and enforces the derived 49,500 per LOCAL period ceiling. GROUND BONUS (SCRUM-237): multiplier(n) = 1 + min(2.0 - 1, 0.75^(n-1)) where n is the LIFETIME burn number for this user in this coarse cell (cell_burns is keyed per day, so the total is sum(burn_count)); first burn 2.000, then 1.750, 1.563 ... fixed at 1.000. WARNING: the quota, the decay tick, the derived ceiling and the STREAK all key off the USER''S LOCAL DAY (profiles.iana_tz, else Asia/Singapore); the streak window is forward-only and >= 23h (doc 22 4.2). The GLOBAL AI budget deliberately stays on UTC. A RETHROW — any prior `burns` row for the SAME actor and capture (a miss still writes one) — is capped at `devout`: Bullseye is first-throw only (doc 16 Q4, ADR-005). The attempt count is DERIVED from `burns`, NEVER accepted from the caller. A MISS RETURNS THE OFFERING (no inventory decrement). Replay-safe on idempotency_key (checked BEFORE the rate limit). SECURITY DEFINER, EXECUTE to service_role ONLY.';
