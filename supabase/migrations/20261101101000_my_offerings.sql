-- ═══════════════════════════════════════════════════════════════════════════
-- MY OFFERINGS — the History screen's read (SCRUM-151)
--
-- ⚠️ THE GAP THIS CLOSES. `EN · 8c History` draws the user's own burn history, and until
-- now **nothing in the RPC surface could return it**: `home_summary` returns two aggregates
-- and `clan_book` returns the CLAN's entries. So this is a `SECURITY DEFINER` read scoped to
-- `auth.uid()` in the WHERE clause — not by a policy the caller could widen.
--
-- ⚠️⚠️ CORRECTION 2026-11-01 (S73) — a claim originally written here was WRONG and is
-- corrected by measurement. It said `public.burns` and `public.tributes` "have RLS enabled
-- with **no policy** … so a plain client read returns zero rows and no error". The live
-- database says otherwise: **both carry a SELECT policy** (`burns_select_own` ·
-- `tributes_select_member`) **and `authenticated` holds the SELECT grant**
-- (`has_table_privilege('authenticated','public.burns','SELECT')` is true). A client CAN read
-- its own rows. ⚠️ The RPC is still the right shape — one round trip, an aggregate the screen
-- actually draws, no ids it does not need — but NOT because the tables were unreadable.
--
-- ⚠️ SO IT IS A `SECURITY DEFINER` READ, and it is scoped to `auth.uid()` in the WHERE
-- clause — not by a policy the caller could widen. It returns the caller's OWN burns only,
-- which is what the board's own footnote promises: *"Only your offerings — nothing about
-- others."*
--
-- ⚠️ IT DOES NOT RE-DERIVE ANYTHING. The band, the award and the time are returned AS
-- STORED (`burns.band` · `burns.award_snapshot` · `burns.created_at`). The award in
-- particular is the burn's own snapshot: recomputing it from the band and the streak would
-- give a DIFFERENT number the moment the multipliers change, which would silently rewrite
-- history.
--
-- ⚠️ `p_limit` is clamped, not trusted. A caller asking for 10,000 rows would pull their
-- whole ledger through PostgREST; the clamp is the server's, so a future client cannot
-- widen it by mistake.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.my_offerings(p_limit integer default 50)
returns table (
  burn_id     uuid,
  item_code   text,
  band        text,
  points      integer,
  burned_at   timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  -- ⚠️ 1..200. The floor stops a `0` from reading as "no history"; the ceiling stops a
  -- client from asking for the ledger.
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  -- ⚠️ NOT an empty set. "You have burned nothing" and "you are not signed in" must not
  -- render identically — the same rule `home_summary` follows.
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  return query
    select b.id,
           b.item_code,
           b.band::text,
           b.award_snapshot,
           b.created_at
      from public.burns b
     where b.user_id = v_uid
     -- ⚠️ `created_at desc` matches `burns_user_created_idx`, so this is an index scan.
     order by b.created_at desc
     limit v_limit;
end;
$$;

comment on function public.my_offerings(integer) is
  'The History screen (SCRUM-151): the CALLER''S OWN burns, newest first. SECURITY DEFINER because burns/tributes are server-written with no client policy; scoped to auth.uid() in the WHERE clause, so it cannot be widened by a policy change. Returns the burn''s STORED band/award, never a re-derivation. p_limit is clamped to 1..200.';

revoke all on function public.my_offerings(integer) from public;
revoke all on function public.my_offerings(integer) from anon;
grant execute on function public.my_offerings(integer) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- MY OFFERINGS — the "THIS WEEK" block (SCRUM-151)
--
-- ⚠️ A SECOND FUNCTION, NOT A SECOND QUERY IN THE SCREEN. `hist · week` shows *9 burned ·
-- +1,350 tribute · 🔥 12 days*, and computing that in the client from `my_offerings()` would
-- be **wrong the moment a week holds more rows than `p_limit`** — a heavy week would silently
-- report a smaller total than the list beneath it. The server has the whole week; the client
-- has a page.
--
-- ⚠️ "WEEK" IS A TRAILING 7 DAYS, and that is a choice, not an oversight. The app has no
-- single agreed week: the LEAGUE week is Mon–Sun (`open_league_week`) and the STREAK period
-- is a local-day window (`streak_period_end`). Picking either here would invent a third
-- meaning for a word already carrying two. A rolling 7 days is unambiguous, and the copy
-- (`hist.weekHead`) is the only thing that would have to change if the PM rules otherwise.
--
-- ⚠️ The streak is returned AS STORED, for the reason `home_summary` records: the day maths
-- lives in `submit_burn` and has been rebuilt twice.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.my_offerings_week()
returns table (burned integer, tribute bigint, streak_days integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  return query
    select
      count(*)::integer,
      coalesce(sum(b.award_snapshot), 0)::bigint,
      coalesce((select s.current_days from public.streaks s where s.user_id = v_uid), 0)::integer
    from public.burns b
   where b.user_id = v_uid
     and b.created_at >= now() - interval '7 days';
end;
$$;

comment on function public.my_offerings_week() is
  'The History screen''s THIS WEEK block (SCRUM-151): the caller''s burns and award in the TRAILING 7 DAYS, plus the stored streak. SECURITY DEFINER, scoped to auth.uid(). "Week" is a rolling 7 days because the league week (Mon–Sun) and the streak period (local day) already disagree.';

revoke all on function public.my_offerings_week() from public;
revoke all on function public.my_offerings_week() from anon;
grant execute on function public.my_offerings_week() to authenticated;
