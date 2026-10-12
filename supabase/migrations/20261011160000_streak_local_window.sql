-- ═══════════════════════════════════════════════════════════════════════════
-- THE STREAK WINDOW — the user's LOCAL midnight, FORWARD-ONLY  (SCRUM-113)
--
-- WHY THIS EXISTS
--   Until now the streak day was the global SERVER day (UTC) via `burn_day()`.
--   For a Singapore-first audience that boundary rolls at 08:00 SGT, so a real
--   user could live two days and see one streak day, or advance twice before
--   breakfast — the travel behaviour SCRUM-113 was opened about (doc 22 §4).
--
-- THE RULE (doc 22 §4.2, PM 2026-10-11)
--   period_end(n+1) = the earliest LOCAL midnight, in the user's CURRENT zone,
--                     that is >= period_end(n) + interval '23 hours'
--
--   ⚠️ THREE versions of this rule were needed, and the two floors failed in
--   OPPOSITE directions — which is why the number is 23 and not nothing or 24.
--
--   v1 — no floor ("the next local midnight after the previous end"): monotonic
--        but it TRUNCATES on travel. SGT->UTC-4 gives a 12h window, because
--        16:00Z is already 12:00 local. A window a user is REQUIRED to burn
--        inside is not a "grace gap" — it is the deadline, i.e. exactly the
--        shortening the decision forbids.
--   v2 — a 24h floor: fixed the truncation but DESTROYED THE SHORTER DAY. A
--        local day is 23h across DST spring-forward, so the 24h floor rejects
--        that midnight and skips to the next one, handing the user ~47h. The
--        PM's decision accepts that days are "longer and shorter".
--   v3 — a 23h floor (this file): the shortest a REAL local day can be, since
--        the largest DST shift in tzdata is 1h. Anything under 23h cannot be a
--        calendar day — it can only be a travel stub. So one number preserves
--        every genuine day (23/24/25h) AND refuses the 12h truncation.
--
--   supabase/tests/streak_window.sql asserts all of it: the 23h DST day, the
--   25h fall-back day, 36h west, 44h east, and the naive 12h rule as a trap.
--
-- ⚠️ AND THE GAP IS NOT DEAD TIME (doc 22 §4.3, option (ii)): a burn inside the
--   travel gap counts for the NEXT period and advances immediately. That is
--   what absorbs the gap into the window and makes the >= 24h floor the honest
--   reading rather than a refinement.
--
-- ⚠️ THE QUOTA AND THE DAILY AI CEILING ARE **NOT TOUCHED HERE** — but they are
--   DECIDED. PM, 2026-10-11: *"Yes it should be on the user's local day too."*
--   So `burn_day()` (UTC) must eventually stop keying them and the cost windows
--   become per-user, per zone. It is a separate change not because it is
--   undecided but because it RE-SHAPES AI-SPEND ACCOUNTING (doc 10) — two users'
--   ceilings stop coinciding — and that must not ride inside a streak commit
--   without review. Tracked on SCRUM-113.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · the two things the rule needs and the schema did not have ──────────
--     (doc 22 §4.4: "no column anywhere stores a timezone"; the rule compares
--      against an INSTANT, which a bare `date` cannot express)

-- The user's IANA zone, sent by the client and stored one-way (doc 22 §4.1).
-- NULL means "not known yet" — the functions below then fall back to the
-- audience default rather than guessing an offset.
alter table public.profiles add column if not exists iana_tz text;

-- The end of the period the last counted burn belonged to. This is the
-- forward-only anchor: every later boundary is derived from it, never from the
-- current clock.
alter table public.streaks add column if not exists period_end timestamptz;

-- ⚠️ RECORDED IN UTC, as the PM requires — and recording it is the point.
-- Every instant in this schema is a `timestamptz`, so the PERIOD START is stored
-- in UTC and merely *differs per zone* (00:00 SGT is 16:00Z, 00:00 UTC-4 is
-- 04:00Z). Storing a local date, or a wall-clock time without the zone, would
-- throw away the only thing that makes the boundary recoverable.
alter table public.streaks add column if not exists period_start timestamptz;

-- Backfill existing rows from the UTC day the old rule used, so no row is left
-- without an anchor. Not NOT NULL: a row may legitimately have no burn yet.
update public.streaks
   set period_end = ((last_burn_date + 1)::timestamp at time zone 'utc')
 where period_end is null
   and last_burn_date is not null;

comment on column public.profiles.iana_tz is
  'IANA zone (e.g. Asia/Singapore) for the user''s LOCAL streak day. Client-supplied, one-way. SCRUM-113 / doc 22 §4.1.';
comment on column public.streaks.period_end is
  'End of the streak period the last counted burn belonged to. The forward-only anchor: period_end(n+1) is derived from this, never from now(). SCRUM-113 / doc 22 §4.2.';

-- ── 2 · the default zone, and the fallback ────────────────────────────────
-- Singapore-first (doc 04/16). One place, so the client, the server and the
-- tests cannot disagree about what "not known yet" means.
create or replace function public.default_iana_tz()
returns text language sql immutable as $$ select 'Asia/Singapore' $$;

create or replace function public.streak_tz(p_user uuid)
returns text language sql stable as $$
  select coalesce(
    (select nullif(btrim(iana_tz), '') from public.profiles where user_id = p_user),
    public.default_iana_tz())
$$;

-- ── 3 · the two pure functions the rule is ────────────────────────────────

-- The earliest LOCAL midnight strictly after p_after, in p_tz.
-- ⚠️ `stable`, not `immutable`: the answer depends on the tz database, which
-- ships with Postgres and changes between releases. Labelling it immutable
-- would let the planner cache a boundary across a tzdata upgrade.
create or replace function public.next_local_midnight(p_tz text, p_after timestamptz)
returns timestamptz
language sql stable
as $$
  select ((p_after at time zone p_tz)::date + 1)::timestamp at time zone p_tz
$$;

-- THE RULE. Forward-only AND at least 24 hours.
-- ⚠️ Both properties are asserted in supabase/tests/streak_window.sql, in both
-- travel directions, because the second is the one a naive build drops.
create or replace function public.streak_period_end(p_tz text, p_prev_end timestamptz)
returns timestamptz
language plpgsql stable
as $$
declare
  v_end   timestamptz := public.next_local_midnight(p_tz, p_prev_end);
  v_floor timestamptz := p_prev_end + interval '23 hours';
begin
  while v_end < v_floor loop
    v_end := public.next_local_midnight(p_tz, v_end);
  end loop;
  return v_end;
end;
$$;

comment on function public.streak_period_end(text, timestamptz) is
  'The forward-only streak boundary: the earliest local midnight >= period_end(n) + 23h. 23h (not 24h) so a DST 23h day survives while a travel truncation is refused. SCRUM-113 / doc 22 §4.2.';

-- ── 4 · the first boundary for a user with no history ─────────────────────
-- A brand-new streak: for a first-ever burn the "previous end" is effectively
-- NOW, so the floor is measured from the burn instant.
-- ⚠️ The first version of this function anchored the floor to
-- `next_local_midnight(p_at) - interval '24 hours'` instead — which put the
-- floor 24h before the *next midnight* rather than 24h after the BURN, and so
-- still produced a 12h first window for a west-bound user. Caught by
-- supabase/tests/streak_window.sql §7, which is why that assertion exists.
create or replace function public.first_streak_period_end(p_tz text, p_at timestamptz)
returns timestamptz
language plpgsql stable
as $$
declare
  v_end   timestamptz := public.next_local_midnight(p_tz, p_at);
  v_floor timestamptz := p_at + interval '23 hours';
begin
  while v_end < v_floor loop
    v_end := public.next_local_midnight(p_tz, v_end);
  end loop;
  return v_end;
end;
$$;

comment on function public.first_streak_period_end(text, timestamptz) is
  'The first streak window: the earliest local midnight >= the burn + 24h. A first-ever window is never short either. SCRUM-113 / doc 22 §4.2.';
