-- ═══════════════════════════════════════════════════════════════════════════
-- 0014 · THE SUCCESSOR INHERITS THE DEPARTING RANK — SCRUM-84, answered
--        by the PM 2026-10-08 (the follow-up to 0013)
--
-- ── THE RULE, VERBATIM ─────────────────────────────────────────────────────
--   "hand over to a new head if no co-head, co-head if co-head already exists."
--
-- ── WHAT THAT MEANS, AND WHY IT IS A NEW MIGRATION ─────────────────────────
-- 0013 promoted EVERY successor to `co_head`. That is wrong for one branch: a
-- departing HEAD with no co-head must hand over to a new **HEAD**, because there
-- would otherwise be no head row left at all. 0013 is applied, so never edited.
--
-- The rule reduces to one line: **the successor takes the rank of the person they
-- succeed.** `v_role` IS the departing member's role, so `set role = v_role`.
--
--   departing `head`,       no co-head → successor becomes `head`    (NEW)
--   departing `head`,       a co-head  → NOBODY promoted; the co-head carries on
--   departing sole `co_head`           → successor becomes `co_head` (unchanged)
--
-- ⚠️ THE THIRD CASE IS THE PM'S EARLIER CLARIFICATION, NOT A NEW RULE: "if there
-- is a cohead and another cohead leaves … the cohead becomes the only cohead."
-- A clan led only by co-heads is valid (doc 15 §3).
--
-- ⚠️ THE SECOND CASE IS WHERE "co-head if co-head already exists" LANDS: the
-- handover goes TO the existing co-head — it does not promote a second one. That
-- is `v_others > 0`, the branch 0013 already had; fixtures E/F/G prove it.
--
-- ── THIS REVERSES 0013's RATIONALE ON `head`, DELIBERATELY ──────────────────
-- 0013 argued the successor must never be `head` because `head` was "the
-- founder's immutable fact". The PM has now specified a LINE OF SUCCESSION
-- instead. What survives is the FOUNDING fact: `clans.created_by` still records
-- who founded the clan and is never rewritten. What changes is that headship no
-- longer dies with the founder — so a clan may have a `head` who did not found
-- it, which is the entire point of a succession rule.
--
-- ⚠️ `set_member_role` STILL REFUSES to assign `head`. The ladder appoints
-- co-heads; only SUCCESSION grants headship. This UPDATE is the single place
-- `head` changes hands.
--
-- ⚠️ TWO `head` ROWS EXIST MOMENTARILY: the promotion runs before the departing
-- head's row is deleted. That is safe and was proved empirically — there is no
-- uniqueness constraint on `head`, and the deferred ≥1-head trigger is a MINIMUM,
-- not a maximum.
-- ═══════════════════════════════════════════════════════════════════════════

-- ⚠️ NO DROP NEEDED, deliberately: this is the SAME signature
-- `(uuid, uuid default null)` that 0013 created, so `create or replace` is exact.
-- Dropping would risk re-creating the 1-argument ambiguity 0013's header warns
-- about (a `default` makes the 2-arg function callable with ONE argument, so a
-- stray `leave_clan(uuid)` would make every 1-arg call ambiguous).

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
  -- ⚠️ v_role is BOTH the caller's role AND the rank their successor inherits.
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

    -- ⚠️ THE "co-head already exists" BRANCH — and the ONLY reading under which a
    -- head can leave a co-head behind: the handover goes to them and NOTHING is
    -- promoted. Reached when the caller is a head with a co-head, or a co-head
    -- with another co-head (the PM's earlier clarification, fixtures F/G).
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

      -- ⚠️⚠️ THE HEART OF 0014: THE SUCCESSOR INHERITS THE DEPARTING RANK.
      --
      -- A departing `head` (there is no co-head — that is why we are here) hands
      -- over to a new `head`; a departing sole `co_head` hands over to a
      -- `co_head`. So this is `= v_role`, NOT a fixed literal — the client mirrors
      -- the RULE, not the value.
      --
      -- ⚠️ Asserted from the OUTSIDE on purpose, so it cannot drift:
      --   · `check:clanapi` §9b/§9c read the promoted successor's ACTUAL role back
      --     through PostgREST — the real function, not a duplicated literal;
      --   · `check:lib` pins the pure mirror's `planLeave(...).promoteTo`;
      --   · `clan_management.sql` C13 asserts the end state as the OWNER so RLS
      --     cannot flatter it, and fixture H is the SOLE-co_head branch that stops
      --     anyone "simplifying" this back to a hard-coded `co_head`.
      --
      -- `clan_members_update_head` permits it because the caller still holds head
      -- power at this moment — the delete is below. (`set_member_role`, by
      -- contrast, still refuses `head`: succession is the only way it changes.)
      update public.clan_members
         set role = v_role
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
  'SECURITY INVOKER. doc 15 §5.3 + §10.4, as ANSWERED on SCRUM-84 (2026-10-08): the successor INHERITS the departing rank. A sole head-power holder leaves by promoting — the successor they NAME, or failing that the OLDEST ELDER by joined_at (auto) — INTO THE RANK THE LEAVER HELD, so a departing head hands over to a new head and a departing sole co-head to a co-head. A head who leaves a co-head behind promotes NOBODY; that co-head carries on. No candidate (no co-head, no elder, nobody named) = refused, naming both exits. `clans.created_by` remains the founder; `set_member_role` still refuses `head`.';

