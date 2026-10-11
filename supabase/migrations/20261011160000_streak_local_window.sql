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
--                     that is >= period_end(n) + interval '24 hours'
--
--   ⚠️ TWO clauses, and the second was found by ARITHMETIC, not read off the
--   prose. "The next local midnight after the previous end" is monotonic but
--   NOT >= 24h: SGT->UTC-4 turns a 24h window into a 12h one, because 16:00Z is
--   already 12:00 local. A window a user is REQUIRED to burn inside is not a
--   "grace gap" — it is the deadline, i.e. exactly the shortening the decision
--   forbids. The >= 24h floor is what makes it safe; see supabase/tests/
--   streak_window.sql, which asserts both travel cases (36h west, 44h east).
--
-- ⚠️ AND THE GAP IS NOT DEAD TIME (doc 22 §4.3, option (ii)): a burn inside the
--   travel gap counts for the NEXT period and advances immediately. That is
--   what absorbs the gap into the window and makes the >= 24h floor the honest
--   reading rather than a refinement.
--
-- ⚠️ THE QUOTA AND THE DAILY AI CEILING ARE **NOT** TOUCHED HERE. `burn_day()`
--   is unchanged and still drives them; only the STREAK moves to the local day.
--   Moving the two cost keys is the other half of SCRUM-113's option B and is
--   deliberately a separate change — see the ticket.
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
  v_floor timestamptz := p_prev_end + interval '24 hours';
begin
  while v_end < v_floor loop
    v_end := public.next_local_midnight(p_tz, v_end);
  end loop;
  return v_end;
end;
$$;

comment on function public.streak_period_end(text, timestamptz) is
  'The forward-only, >= 24h streak boundary. period_end(n+1) = earliest local midnight >= period_end(n) + 24h. SCRUM-113 / doc 22 §4.2.';

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
  v_floor timestamptz := p_at + interval '24 hours';
begin
  while v_end < v_floor loop
    v_end := public.next_local_midnight(p_tz, v_end);
  end loop;
  return v_end;
end;
$$;

comment on function public.first_streak_period_end(text, timestamptz) is
  'The first streak window: the earliest local midnight >= the burn + 24h. A first-ever window is never short either. SCRUM-113 / doc 22 §4.2.';
