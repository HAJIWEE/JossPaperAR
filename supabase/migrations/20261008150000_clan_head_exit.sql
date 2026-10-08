-- ═══════════════════════════════════════════════════════════════════════════
-- 0013 · THE HEAD-EXIT RAMP — SCRUM-84, answered by the PM 2026-10-08
--
-- ── WHAT CHANGED, AND WHY THIS IS A NEW MIGRATION ──────────────────────────
-- 0012 shipped `leave_clan` as pure promote-first: a sole head was REFUSED
-- outright. The PM has now specified a HYBRID, so that behaviour is wrong and is
-- re-declared here. 0012 is applied, so it is never edited.
--
-- ── THE RULE, VERBATIM ─────────────────────────────────────────────────────
--   "When a Clan head leaves, if there is no co-head, prompt leaving clan head
--    to name a successor, if none named, promote automatically the oldest elder
--    by time of joining the clan."
--
-- As implemented, a head-power holder leaving:
--   * another head-power holder exists  → leave. (unchanged)
--   * they NAMED a successor            → promote them to co_head, then leave.
--   * nobody named, an ELDER exists     → promote the OLDEST elder, then leave.
--   * nobody named, no elder            → REFUSED, naming both exits.
--
-- ⚠️ THE SUCCESSOR BECOMES `co_head`, NOT `head`. doc 15 §3 keeps `head` as the
-- founder's immutable fact and runs succession through co-head — `set_member_role`
-- already refuses to assign `head`, and the deferred ≥1-head trigger counts head
-- POWER (head OR co_head), so a clan led by a co-head is valid. Making the
-- successor literally `head` would make "who founded this clan" mutable.
--
-- ⚠️ THE FOURTH CASE IS MY READING, NOT THE PM'S WORDS. "Promote the oldest
-- elder" has no candidate when the clan has no elder. The alternative —
-- auto-promoting an arbitrary MEMBER — would invert the ladder in exactly the
-- case where the clan is least supervised, so it refuses instead, and the head
-- still has two exits: name a successor, or delete the clan. Flagged on SCRUM-84.
-- ═══════════════════════════════════════════════════════════════════════════

-- ⚠️ DROP FIRST. `leave_clan(uuid)` and `leave_clan(uuid, uuid default null)` are
-- DIFFERENT functions to Postgres, and `default` makes the 2-arg one callable
-- with ONE argument — so leaving both in place makes every 1-argument call
-- AMBIGUOUS and PostgREST answers "could not choose the best candidate
-- function". The old signature must go explicitly.
drop function if exists public.leave_clan(uuid);

create or replace function public.leave_clan(
  p_clan_id   uuid,
  p_successor uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_role      public.clan_role := public.clan_role_of(p_clan_id);
  v_others    integer;
  v_succ      uuid;
  v_succ_role public.clan_role;
  v_auto      boolean := false;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_clan_id is null then
    raise exception 'clan_id is required' using errcode = '22023';
  end if;
  if v_role is null then
    raise exception 'the caller is not a member of this clan' using errcode = '42501';
  end if;

  -- A member or an elder always leaves freely (doc 15 §5.3) — there is no head
  -- power to inherit, so none of the ramp below applies.
  if v_role in ('head', 'co_head') then
    select count(*) into v_others
      from public.clan_members
     where clan_id = p_clan_id
       and role in ('head', 'co_head')
       and user_id <> v_uid;

    if v_others = 0 then
      -- ── the sole head-power holder: the two-step ramp (SCRUM-84) ─────────
      if p_successor is not null then
        -- STEP 1 · the head NAMED a successor.
        if p_successor = v_uid then
          raise exception 'a head cannot name themselves as successor' using errcode = '22023';
        end if;

        select role into v_succ_role
          from public.clan_members
         where clan_id = p_clan_id and user_id = p_successor;
        if v_succ_role is null then
          raise exception 'the named successor is not a member of this clan' using errcode = '22023';
        end if;

        v_succ := p_successor;
      else
        -- STEP 2 · nobody named → the OLDEST ELDER by time of joining.
        -- ⚠️ `user_id` breaks ties so two elders who joined in the same second
        -- resolve DETERMINISTICALLY rather than by storage order — a rule that
        -- picks a different successor on a re-run is not a rule.
        select user_id into v_succ
          from public.clan_members
         where clan_id = p_clan_id
           and user_id <> v_uid
           and role = 'elder'
         order by joined_at asc, user_id asc
         limit 1;

        v_auto := v_succ is not null;

        if v_succ is null then
          -- ⚠️ No co-head, no elder, nobody named. `promote a co-head` stays in
          -- the message deliberately: it is the same way out 0012 offered, and
          -- the SQL test asserts on it.
          raise exception
            'there is nobody to succeed you — name a successor, promote a co-head, or delete the clan'
            using errcode = '42501';
        end if;
      end if;

      -- Promote to CO-HEAD, then leave. `clan_members_update_head` permits this
      -- because the caller is still the head at this moment — the delete is below.
      update public.clan_members
         set role = 'co_head'
       where clan_id = p_clan_id and user_id = v_succ;
    end if;
  end if;

  delete from public.clan_members where clan_id = p_clan_id and user_id = v_uid;

  return jsonb_build_object(
    'clan_id',       p_clan_id,
    'left',          true,
    'was',           v_role,
    'successor',     v_succ,
    'auto_promoted', v_auto
  );
end;
$$;

revoke execute on function public.leave_clan(uuid, uuid) from public, anon;
grant  execute on function public.leave_clan(uuid, uuid) to authenticated;

comment on function public.leave_clan(uuid, uuid) is
  'SECURITY INVOKER. doc 15 §5.3 + §10.4, as ANSWERED on SCRUM-84 (2026-10-08): a sole head-power holder leaves by promotion — the successor they NAME, or failing that the OLDEST ELDER by joined_at (auto). Co-head, not head: `head` is the founder''s immutable fact. No co-head AND no elder AND nobody named = refused, naming both exits.';

