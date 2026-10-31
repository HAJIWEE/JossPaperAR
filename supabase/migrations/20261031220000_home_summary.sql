-- ═══════════════════════════════════════════════════════════════════════════
-- HOME SUMMARY — the shrine's two panels (SCRUM-161)
--
-- The shrine shows a cumulative tribute total and the current streak. ⚠️ Neither is
-- readable by the client today: `tributes` has **no policy** (it is server-written, by
-- design — 0001's RLS header calls that "the correct posture for server-written tables"),
-- and `streaks` is the same. So this is a SECURITY DEFINER read that returns ONLY the
-- caller's own aggregate — the narrowest possible exposure: no rows, no ids, no names.
--
-- ⚠️ IT DOES NOT RE-DERIVE THE STREAK. `streaks.current_days` is returned as stored.
-- The streak's day maths lives inside `submit_burn` (SCRUM-113's local-day period window)
-- and has already been rebuilt twice; a second implementation here would be a third source
-- of truth. ⚠️ The model re-evaluates the streak on the NEXT BURN, so between a missed day
-- and that burn the stored value is the pre-miss one — whether the panel should decay it is
-- SCRUM-153's decision, not this function's.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.home_summary()
returns table (tribute_total bigint, streak_days integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- ⚠️ NOT a zero. An unauthenticated caller gets an error, because "you have earned
  -- nothing" and "you are not signed in" must not render identically.
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  return query
    select
      coalesce((select sum(t.points) from public.tributes t where t.user_id = v_uid), 0)::bigint,
      coalesce((select s.current_days from public.streaks s where s.user_id = v_uid), 0)::integer;
end;
$$;

comment on function public.home_summary() is
  'The shrine panels (SCRUM-161): the caller''s own cumulative tribute total and stored streak. SECURITY DEFINER because tributes/streaks are server-written with no client policy; returns aggregates only — no rows, no ids, no names.';

revoke all on function public.home_summary() from public;
revoke all on function public.home_summary() from anon;
grant execute on function public.home_summary() to authenticated;
