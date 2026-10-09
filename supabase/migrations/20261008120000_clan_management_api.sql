-- ═══════════════════════════════════════════════════════════════════════════
-- 0012 · THE CLAN MANAGEMENT API — SCRUM-46 (doc 15 §3/§5/§7 · RLS = §9)
--
-- ── WHAT THIS IS FOR ───────────────────────────────────────────────────────
-- SCRUM-82 gave the slice a clan it could not do without, but as a noted
-- SHORTCUT: it stands one up on first use and never looks at it again. This is
-- the real thing — the role ladder, leaving and removal, rename and delete,
-- the Book of Tributes read path, and the anti-abuse limits that doc 15 §5.2
-- assigns to this ticket.
--
-- ── WHAT ALREADY EXISTED (do not rebuild) ──────────────────────────────────
--   tables  clans · clan_members · ancestors · tributes
--   RPCs    create_clan · preview_clan · join_clan · reroll_clan_code ·
--           save_ancestor · purchase_item
--   helpers is_clan_member · clan_role_of · is_clan_head · rate_limit_allow ·
--           enforce_ancestor_cap
--   The invite payload (code · link · QR) is already built and pure in
--   `src/lib/invites.ts` — SCRUM-50 owns the camera/board half, not the code.
--
-- ── THE THREE DECISIONS THIS TICKET OWNS (doc 15 §10) ──────────────────────
--   §10.5  Book window  → **HIDE, NOT PURGE.** The spec's own wording is a read
--          rule — *"the Book shows and QUERIES the last month only"* — and §5.3
--          says a leaver's *"past Book entries stay (the record is the clan's)"*.
--          Purging would contradict both and needs a scheduler (`pg_cron` is
--          deliberately off). Hide → purge stays open as a later value change;
--          purge → hide does not. Implemented as a predicate in `clan_book`.
--   §5.2   anti-abuse → **10 clans per user · 3 joins per hour.** doc 11 §5
--          sizes a limit at ≈3× the fastest honest play, and an honest user
--          joins one or two family clans in an hour (a link from a relative) —
--          so 3/hour is generous for real use and tight enough to blunt a
--          code-scraping sweep. ⚠️ It must stay BELOW the clan cap or it is
--          dead logic: every membership IS a clan, so a joins-per-hour limit of
--          10 can never fire before the 10-clan cap does. Both are named
--          constants in ONE place, so changing them is a value change.
--   §10.4  head exit → **promote-first**, the spec's own proposal (a head must
--          promote a co-head before leaving). ⚠️ The PM confirmation is filed
--          as **SCRUM-84**; this is the documented reading, not a decision.
--
-- ── ⚠️ A NEW MIGRATION, NOT AN EDIT ────────────────────────────────────────
-- 0001 and 0004 are applied to the hosted project. Same rule as 0002/0003/
-- 0007–0011. Nothing above is re-declared except where noted.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ A · THE MISSING RLS POLICIES (doc 15 §9: "exact policies = SCRUM-46") ══
-- `clan_members` had SELECT ONLY. That was survivable while the only writer was
-- `create_clan` (covered by `clan_members_insert_head_of_own_clan`) — but it
-- meant role changes, leaving and removal had NO path at all, and the tempting
-- fix is to reach for SECURITY DEFINER. Policies are the better fix: they keep
-- every RPC below SECURITY INVOKER (RULE B) and they close the hole for a
-- client that talks to the table directly, not just for this API.

-- A head/co-head may change a role (the ladder check is the RPC's job; this is
-- the gate). `is_clan_head` is SECURITY DEFINER, so it reads `clan_members`
-- inside a policy on `clan_members` without recursing (0001's design note).
create policy clan_members_update_head on public.clan_members
  for update to authenticated
  using (public.is_clan_head(clan_id))
  with check (public.is_clan_head(clan_id));

-- A member may delete only THEMSELVES — that is `leave_clan`. A head may delete
-- anyone — that is `remove_member`.
-- ⚠️ The "≥ 1 head" rule is NOT expressible here: a sole head deleting their own
-- row satisfies this predicate. That rule is section B's, and it holds at a
-- level a policy cannot reach.
create policy clan_members_delete_head_or_self on public.clan_members
  for delete to authenticated
  using (public.is_clan_head(clan_id) or user_id = auth.uid());

-- `clans` had INSERT/SELECT/UPDATE but no DELETE, so `delete_clan` had no path
-- either. doc 15 §3: only head or co-head may delete the clan.
create policy clans_delete_head on public.clans
  for delete to authenticated
  using (public.is_clan_head(id));


-- ═══ B · THE INVARIANT — A CLAN IS NEVER HEADLESS (doc 15 §3) ══════════════
-- *"A clan always has ≥ 1 Head — the ladder cannot be emptied."*
--
-- doc 15 §9 says this is "enforced by RPC, not a constraint". A CHECK genuinely
-- cannot express it (it spans rows). But an RPC-only rule is bypassable: the
-- delete policy above lets a sole head remove their own row, and a direct
-- PostgREST call never runs our code. So this follows the house pattern set by
-- `enforce_ancestor_cap` — the rule lives in the DATABASE, and the RPCs give a
-- friendly refusal in front of it. A headless altar is a data bug, and a family
-- losing its altar to one tap is not a cosmetic one.
--
-- ⚠️ DEFERRABLE INITIALLY DEFERRED, deliberately. A constraint trigger fires at
-- COMMIT, which buys two things an immediate trigger cannot:
--   1. `delete_clan` works. Its cascade removes `clan_members` rows too, so an
--      immediate trigger would see "no heads left" mid-cascade and refuse the
--      delete. Deferred, the clan row is already gone at the check, so the
--      delete is correctly allowed — there is no clan left to be headless.
--   2. promote-then-leave in ONE transaction is allowed, which is exactly the
--      promote-first flow (§10.4) and what a confident UI emits.
create or replace function public.enforce_clan_has_head()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- (1) The clan itself is gone (cascade from `delete_clan`): nothing to keep.
  if not exists (select 1 from public.clans where id = old.clan_id) then
    return null;
  end if;

  -- (2) The MEMBER is being erased entirely — `delete_my_data()` (doc 13) or a
  -- profile removal. A privacy deletion must never be blocked by a clan rule,
  -- and it can legitimately orphan a clan (a co-head who is not the founder
  -- erasing their data leaves one behind). Checked on the PROFILE, not on the
  -- membership, so it is the erasure that exempts — not merely a row going away.
  -- ⚠️ This works because the trigger is DEFERRED: at COMMIT the profile is
  -- already gone, so `delete_my_data`'s "memberships, then profile" order is
  -- fine and needs no change. It was a REAL bug in the first cut of 0012 —
  -- caught by running this file, and it would have blocked a GDPR deletion.
  if not exists (select 1 from public.profiles where user_id = old.user_id) then
    return null;
  end if;

  -- (3) head AND co_head both carry the full Head column (doc 15 §3), so the
  -- invariant is "≥ 1 row with head POWER", not "≥ 1 row spelled 'head'".
  if not exists (
    select 1 from public.clan_members
    where clan_id = old.clan_id and role in ('head', 'co_head')
  ) then
    raise exception 'a clan must keep at least one head — promote a co-head first'
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

create constraint trigger clan_members_keep_a_head
  after delete or update on public.clan_members
  deferrable initially deferred
  for each row execute function public.enforce_clan_has_head();

-- ═══ C · ANTI-ABUSE: CLANS PER USER · JOINS PER HOUR (doc 15 §5.2) ═════════
-- §5.2 hands the numbers to this ticket and names the pattern: the
-- `rate_counters` one (doc 11 §5). Two deliberate departures from that pattern:
--
--   1. It is a TRIGGER on the membership row, not a check inside the RPC. It
--      has to cover BOTH doors — `create_clan` (SECURITY INVOKER) and
--      `join_clan` (SECURITY DEFINER) — and neither can be amended without
--      RE-DECLARING a long applied body. One trigger covers both, and closes
--      the direct-table path at the same time.
--   2. `rate_limit_allow` buckets by the MINUTE (`date_trunc('minute', …)`), so
--      it cannot express "per hour". `clan_members.joined_at` already records
--      exactly what an hourly join limit needs, so no new table is required.
--
-- ⚠️ The clans-per-user count is the user's TOTAL membership, not clans they
-- created — a founder's head row is a membership, and §5.2 says a user may hold
-- a different role in each clan, so membership is the honest unit.
create or replace function public.enforce_clan_member_limits()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- doc 15 §5.2 — the two numbers this ticket owns. ONE place to change.
  -- ⚠️ c_joins_per_hour MUST stay < c_clans_per_user: a membership IS a clan,
  -- so at 10/10 the clan limb always binds first and the join limb is dead
  -- logic. Asserted in supabase/tests/clan_management.sql (C10).
  c_clans_per_user constant integer := 10;
  c_joins_per_hour constant integer := 3;
  v_clans    integer;
  v_recent   integer;
begin
  select count(*) into v_clans
  from public.clan_members where user_id = new.user_id;

  if v_clans >= c_clans_per_user then
    raise exception 'a devotee may belong to at most % clans', c_clans_per_user
      using errcode = 'check_violation';
  end if;

  select count(*) into v_recent
  from public.clan_members
  where user_id = new.user_id and joined_at > now() - interval '1 hour';

  if v_recent >= c_joins_per_hour then
    raise exception 'too many clan joins in the last hour — try again later'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger clan_members_enforce_limits
  before insert on public.clan_members
  for each row execute function public.enforce_clan_member_limits();

-- ═══ D · THE MANAGEMENT RPCs (doc 15 §3 ladder · §5.3 leaving) ═════════════
-- All five are SECURITY INVOKER: section A's policies grant exactly what they
-- need and nothing more (RULE B). Each asserts the ladder FIRST so a refusal is
-- a clean, named error rather than a silently-empty UPDATE — the same shape
-- `reroll_clan_code` already uses.

-- ── set_member_role — promote member → elder, elder → co-head ──────────────
-- doc 15 §3's matrix, as one function. `head` is deliberately NOT assignable:
-- the founder holds it and succession runs through CO-HEAD (§10.4 promote-first),
-- so "who founded this clan" stays a fact rather than a mutable field.
create or replace function public.set_member_role(
  p_clan_id uuid,
  p_user_id uuid,
  p_role    public.clan_role
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_actor  public.clan_role := public.clan_role_of(p_clan_id);
  v_target public.clan_role;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_clan_id is null or p_user_id is null then
    raise exception 'clan_id and user_id are required' using errcode = '22023';
  end if;

  if v_actor is null or v_actor not in ('head', 'co_head') then
    raise exception 'only a clan head may change a role' using errcode = '42501';
  end if;

  select role into v_target from public.clan_members
   where clan_id = p_clan_id and user_id = p_user_id;
  if v_target is null then
    raise exception 'that user is not a member of this clan' using errcode = '22023';
  end if;

  if p_role = 'head' then
    raise exception 'head is not assignable — promote an elder to co_head instead'
      using errcode = '42501';
  end if;
  if v_target = 'head' then
    raise exception 'the founding head''s role cannot be changed' using errcode = '42501';
  end if;

  update public.clan_members set role = p_role
   where clan_id = p_clan_id and user_id = p_user_id;

  return jsonb_build_object(
    'clan_id', p_clan_id, 'user_id', p_user_id,
    'from', v_target, 'role', p_role
  );
end;
$$;

-- ── remove_member — the head removes a member or an elder ─────────────────
-- §5.3: allowed, and their past Book entries stay (the entries are the clan's,
-- and nothing here touches `tributes`).
create or replace function public.remove_member(p_clan_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_actor  public.clan_role := public.clan_role_of(p_clan_id);
  v_target public.clan_role;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_clan_id is null or p_user_id is null then
    raise exception 'clan_id and user_id are required' using errcode = '22023';
  end if;

  if v_actor is null or v_actor not in ('head', 'co_head') then
    raise exception 'only a clan head may remove a member' using errcode = '42501';
  end if;
  if p_user_id = v_uid then
    raise exception 'a head cannot remove themselves — use leave_clan' using errcode = '22023';
  end if;

  select role into v_target from public.clan_members
   where clan_id = p_clan_id and user_id = p_user_id;
  if v_target is null then
    raise exception 'that user is not a member of this clan' using errcode = '22023';
  end if;
  -- Removing the founding head would empty the ladder. The deferred trigger
  -- would refuse it at commit; failing here names the reason instead.
  if v_target = 'head' then
    raise exception 'the founding head cannot be removed' using errcode = '42501';
  end if;

  delete from public.clan_members
   where clan_id = p_clan_id and user_id = p_user_id;

  return jsonb_build_object('clan_id', p_clan_id, 'user_id', p_user_id, 'removed', true);
end;
$$;

-- ── leave_clan — §5.3, with the promote-first ramp (§10.4) ────────────────
-- A member or elder leaves instantly and free. A head-power holder may leave
-- ONLY once someone else still carries head power — *"A Head who wants out must
-- promote a co-head first, or delete the clan"* (doc 15 §3). That check lives
-- here for the message; the deferred trigger in section B is what actually
-- holds the line.
-- ⚠️ AUTO-PROMOTE IS NOT IMPLEMENTED. It is the other option on **SCRUM-84**;
-- this is the spec's own proposal, not a decision taken here.
create or replace function public.leave_clan(p_clan_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_role  public.clan_role := public.clan_role_of(p_clan_id);
  v_heads integer;
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

  if v_role in ('head', 'co_head') then
    select count(*) into v_heads from public.clan_members
     where clan_id = p_clan_id and role in ('head', 'co_head');
    if v_heads <= 1 then
      raise exception 'promote a co-head before you leave — a clan must keep a head'
        using errcode = '42501';
    end if;
  end if;

  delete from public.clan_members where clan_id = p_clan_id and user_id = v_uid;

  return jsonb_build_object('clan_id', p_clan_id, 'left', true, 'was', v_role);
end;
$$;

-- ── rename_clan — a Head column capability (doc 15 §3) ────────────────────
-- `clans_update_head` already allows the write; this adds the same 2..20 rule
-- the table CHECK enforces, so a bad name is a named error rather than a
-- constraint violation, and asserts the ladder before touching anything.
create or replace function public.rename_clan(p_clan_id uuid, p_name text)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_actor public.clan_role := public.clan_role_of(p_clan_id);
  v_name  text := btrim(coalesce(p_name, ''));
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_clan_id is null then
    raise exception 'clan_id is required' using errcode = '22023';
  end if;
  if v_actor is null or v_actor not in ('head', 'co_head') then
    raise exception 'only a clan head may rename the clan' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 20 then
    raise exception 'clan name must be 2..20 characters' using errcode = '22023';
  end if;

  update public.clans set name = v_name where id = p_clan_id;

  -- The count is confirmation the UPDATE actually landed — RLS can make an
  -- UPDATE silently match zero rows, which is the failure this avoids.
  if not found then
    raise exception 'the clan could not be renamed' using errcode = '42501';
  end if;

  return jsonb_build_object('clan_id', p_clan_id, 'name', v_name);
end;
$$;

-- ── delete_clan — head or co-head, and it takes everything with it ─────────
-- Uses the `clans_delete_head` policy from section A; `clan_members`,
-- `ancestors`, `burns` and `tributes` all cascade. The counts are returned
-- because doc 15 §8's confirmation copy tells the family what is about to be
-- destroyed — the UI should be able to show real numbers, not a guess.
-- The section-B trigger sees the clan row gone and correctly allows this.
create or replace function public.delete_clan(p_clan_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_actor public.clan_role := public.clan_role_of(p_clan_id);
  v_mem   integer := 0;
  v_anc   integer := 0;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_clan_id is null then
    raise exception 'clan_id is required' using errcode = '22023';
  end if;
  if v_actor is null or v_actor not in ('head', 'co_head') then
    raise exception 'only a clan head may delete the clan' using errcode = '42501';
  end if;

  select count(*) into v_mem from public.clan_members where clan_id = p_clan_id;
  select count(*) into v_anc from public.ancestors
   where clan_id = p_clan_id and archived_at is null;

  delete from public.clans where id = p_clan_id;
  if not found then
    raise exception 'the clan could not be deleted' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'clan_id', p_clan_id, 'deleted', true,
    'member_count', v_mem, 'ancestor_count', v_anc
  );
end;
$$;


-- ═══ E · THE BOOK OF TRIBUTES, READ (doc 15 §7) ════════════════════════════
-- Entry = offering · clan · user · points · date · festival(optional); **no
-- image** (§7.1). Two projections, one function:
--   MEMBER     → the full entry, `member` = the display label (§7.2)
--   NON-MEMBER → the anonymised projection — same facts, no identity, and only
--                `visibility = 'clan'` rows.
-- SECURITY DEFINER, because RLS cannot be the access model when a NON-member
-- must read a row `tributes_select_member` will not grant — the same named
-- exception as `preview_clan`, and it is the structure §9's sketch describes
-- ("the non-member read path returns the anonymised projection only").
--
-- ⚠️ The window is a PREDICATE, not a delete (§10.5). Older rows are retained
-- and simply not returned; §5.3 promises a leaver their past entries stay, and
-- purging would need a scheduler this project has deliberately not enabled.
create or replace function public.clan_book(p_clan_id uuid, p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_per_min constant integer := 20;   -- provisional, matching preview_clan
  v_uid     uuid := auth.uid();
  v_limit   integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_member  boolean;
  v_clan    text;
  v_rows    jsonb;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_clan_id is null then
    raise exception 'clan_id is required' using errcode = '22023';
  end if;

  if not public.rate_limit_allow(v_uid, 'clan_book', c_per_min) then
    raise exception 'the shrine is busy — try again in a moment' using errcode = 'P0001';
  end if;

  select c.name into v_clan from public.clans c where c.id = p_clan_id;
  if v_clan is null then
    return jsonb_build_object('found', false, 'reason', 'unknown_clan');
  end if;

  v_member := public.is_clan_member(p_clan_id);

  select coalesce(jsonb_agg(x order by created_at desc), '[]'::jsonb)
    into v_rows
  from (
    select t.created_at,
           jsonb_build_object(
             'created_at', t.created_at,
             'offering',   t.item_code,
             'points',     t.points,
             'festival',   t.festival,
             -- §7.2: the "who" is the social heart IN the clan and is withheld
             -- OUTSIDE it. `anonymous` is explicit so the UI never has to infer
             -- a rule from a null.
             'member',     case when v_member then p.display_label else null end,
             'anonymous',  not v_member
           ) as x
    from public.tributes t
    left join public.profiles p on p.user_id = t.user_id
    where t.clan_id = p_clan_id
      and t.created_at > now() - interval '1 month'
      and (v_member or t.visibility = 'clan')
    order by t.created_at desc
    limit v_limit
  ) s;

  return jsonb_build_object(
    'found',       true,
    'clan_id',     p_clan_id,
    'name',        v_clan,
    'member',      v_member,
    'window_days', 30,
    'entries',     v_rows
  );
end;
$$;

-- ═══ F · EXECUTE GRANTS — RULE B, and its named exceptions ═════════════════
-- The five management RPCs are SECURITY INVOKER: callable by `authenticated`,
-- unreachable by `anon`/`public`. They need no elevation because section A's
-- policies grant exactly what they use and nothing more.
revoke execute on function public.set_member_role(uuid, uuid, public.clan_role) from public, anon;
grant  execute on function public.set_member_role(uuid, uuid, public.clan_role) to authenticated;

revoke execute on function public.remove_member(uuid, uuid) from public, anon;
grant  execute on function public.remove_member(uuid, uuid) to authenticated;

revoke execute on function public.leave_clan(uuid) from public, anon;
grant  execute on function public.leave_clan(uuid) to authenticated;

revoke execute on function public.rename_clan(uuid, text) from public, anon;
grant  execute on function public.rename_clan(uuid, text) to authenticated;

revoke execute on function public.delete_clan(uuid) from public, anon;
grant  execute on function public.delete_clan(uuid) to authenticated;

-- RULE B's FIFTH NAMED EXCEPTION: client-callable AND elevated, because a
-- NON-member must read the anonymised projection and RLS will not grant it.
-- It adds ONE finding to the `authenticated_security_definer_function_executable`
-- lint — the same finding the 0001 helpers and preview_clan/join_clan already
-- carry. Reported in the PR, not hidden.
revoke execute on function public.clan_book(uuid, integer) from public, anon;
grant  execute on function public.clan_book(uuid, integer) to authenticated;

-- ── TRIGGER FUNCTIONS: never reachable from the Data API ───────────────────
-- Triggers execute with the TABLE owner's rights, so EXECUTE is not needed —
-- and 0003 exists precisely because leaving it granted exposed
-- `enforce_ancestor_cap` at /rest/v1/rpc/, where anon could call it and probe
-- clan ids. Same four revokes, same reason.
revoke execute on function public.enforce_clan_has_head()     from public, anon, authenticated, service_role;
revoke execute on function public.enforce_clan_member_limits() from public, anon, authenticated, service_role;

comment on function public.enforce_clan_has_head() is
  'TRIGGER: holds doc 15 §3''s "≥ 1 head" invariant at COMMIT (deferred so a clan delete and a promote-then-leave both work). Reached by no client role.';
comment on function public.enforce_clan_member_limits() is
  'TRIGGER: doc 15 §5.2''s anti-abuse limits — 10 clans per user, 10 joins per hour. Covers create_clan AND join_clan in one place. Reached by no client role.';
comment on function public.set_member_role(uuid, uuid, public.clan_role) is
  'SECURITY INVOKER. doc 15 §3: promote member→elder, elder→co_head. head is NOT assignable — succession is via co_head (§10.4 promote-first, SCRUM-84).';
comment on function public.remove_member(uuid, uuid) is
  'SECURITY INVOKER. doc 15 §5.3: a head removes a member or elder; their past Book entries stay. The founding head cannot be removed.';
comment on function public.leave_clan(uuid) is
  'SECURITY INVOKER. doc 15 §5.3 + §10.4 promote-first: a head may leave only once another head-power holder remains. Auto-promote is SCRUM-84 and is NOT implemented.';
comment on function public.rename_clan(uuid, text) is
  'SECURITY INVOKER. doc 15 §3: a Head column capability. Enforces the same 2..20 name rule as the table CHECK, and raises when RLS makes the UPDATE match nothing.';
comment on function public.delete_clan(uuid) is
  'SECURITY INVOKER. doc 15 §3: head or co-head. Cascades to clan_members, ancestors, burns and tributes; returns the counts so the confirmation copy can be truthful.';
comment on function public.clan_book(uuid, integer) is
  'SECURITY DEFINER because a NON-member must read the ANONYMISED projection (doc 15 §7.2), which tributes_select_member will not grant. The rolling 1-month window is a predicate, not a purge (§10.5). No image in an entry (§7.1).';

