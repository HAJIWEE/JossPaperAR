-- ═══════════════════════════════════════════════════════════════════════════
-- 0015 · the invite code becomes a PRIVILEGED READ — elder and above (SCRUM-86)
--
-- ── THE DECISION ────────────────────────────────────────────────────────────
-- PM, 2026-10-09, answering SCRUM-86:
--
--     "limit link sharing to elder and above seniority"
--
-- So `elder` · `co_head` · `head` may see and share the invite code / link / QR.
-- A plain `member` may not.
--
-- ⚠️ **THE PM'S ANSWER *CONFIRMED* doc 15 §3 — THE SPEC DID NOT CHANGE.** The
-- matrix has always read `| Invite new members (link · code · QR) | ✅ | ✅ | ❌ |`
-- (Head ✅ · **Elder ✅** · Member ❌). TWO things had drifted from it:
--   1. `src/lib/clan-roles.ts`'s `canInvite` returned `hasHeadPower` — and the
--      comment above it MISQUOTED doc 15 §3 as saying "Elder ❌". The doc was
--      right; the code was wrong.
--   2. **This database never enforced it at all** — see the next section.
-- So there is no spec edit in this migration, and the "spec was superseded"
-- framing is wrong. Corrected here because a comment that misquotes its own
-- source is how the same drift happens twice.
--
-- ⚠️ RE-ROLLING STAYS HEAD-ONLY, and that is also the spec: doc 07 §4.6 says the
-- code is "re-rollable by a head", and §5.1 says "One active code per clan (Head
-- can re-roll it)". Sharing and retiring are different acts — retiring
-- invalidates the link every member is holding. So an elder may share a link but
-- may not retire it.
--
-- ── WHY THIS NEEDS A MIGRATION AND NOT JUST A CLIENT CHECK ──────────────────
-- `clans_select_member` is
--
--     for select to authenticated using (public.is_clan_member(id) or created_by = auth.uid())
--
-- a TABLE-level policy, so **any member can `select code from clans`**. A
-- row-level policy CANNOT hide one column — RLS decides which ROWS, never which
-- COLUMNS. So the only mechanism is the column privilege, and the value has to
-- move behind an RPC. A client-only gate would be **security theatre**: the
-- earlier draft of SCRUM-86 rejected exactly that (option C).
--
-- ── ⚠️ THE PRIVILEGE GOTCHA THIS MIGRATION EXISTS TO GET RIGHT ──────────────
-- Supabase grants `authenticated` **table-wide** SELECT on every public table.
-- **Revoking a COLUMN privilege does NOT revoke a table-wide one** — column
-- ACLs are additive, so `revoke select (code)` would have been a silent no-op
-- while looking correct. The table-wide grant must be dropped and then every
-- OTHER column re-granted by name.
--
-- ⚠️ CONSEQUENCE, and it is deliberate: **the column list below must be kept in
-- sync with the table.** A column added later is NOT readable by clients until
-- it is added here — a fail-CLOSED default, which is the right direction for a
-- table holding a capability. `supabase/tests/clan_management.sql` asserts the
-- grant list covers every column EXCEPT `code`, so a new column cannot silently
-- become unreadable.
--
-- ⚠️ A NEW MIGRATION, NOT AN EDIT. 0001 and 0005 are applied to the hosted
-- project (and 0012–0014 were pushed on 2026-10-09). `reroll_clan_code` is
-- REPLACED below, which is the documented way to change an applied function —
-- the old file is never touched.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · the code becomes unreadable to clients ──────────────────────────────
-- Drop the TABLE-wide grant first — see the gotcha above. Re-granting columns
-- while a table-wide grant stands would change nothing at all.

revoke select on table public.clans from authenticated;
revoke select on table public.clans from anon;

-- Every column EXCEPT `code`. If a column is ever added to `clans`, add it here
-- too or it will be unreadable (fail closed) — the SQL suite asserts this list.
grant select (id, name, created_by, created_at, archived_at, ancestor_cap)
  on table public.clans to authenticated;

comment on column public.clans.code is
  'The invite capability. ⚠️ NOT readable by clients (SCRUM-86, 2026-10-09): a member could select it and widen the family, so it is granted only through clan_invite_code(), which requires ELDER or above.';

-- ── 2 · reroll_clan_code — the RETURNING clause had to change ───────────────
-- ⚠️ WHY THIS FUNCTION IS REPLACED AT ALL: it ended with
--
--       update public.clans set code = v_code
--        where id = p_clan_id
--        returning code, name into v_out, v_name;
--
-- `RETURNING code` requires SELECT on `code` — the privilege step 1 just took
-- away — so the old body would now fail with `permission denied for column code`
-- for EVERY caller. ⚠️ That is the kind of break a column revoke causes
-- SILENTLY: the migration applies cleanly, and the feature only dies when a head
-- taps Re-roll.
--
-- The fix is to stop reading the column back: the new code is already in
-- `v_code`, so the function returns the local variable. `SET code = v_code` only
-- needs UPDATE on `code`, which is untouched, and `WHERE id = ...` only needs
-- SELECT on `id`, which is re-granted above.
--
-- ⚠️ UNCHANGED ON PURPOSE (SCRUM-86): re-rolling is still **head power only**.
-- The PM's decision was about **sharing** the link; re-rolling is a different
-- act — it is DESTRUCTIVE, because it instantly invalidates the link every
-- family member is holding. So an elder may share a link but may not retire it.
-- That asymmetry is deliberate and is flagged on SCRUM-86 for the PM to
-- contradict if they meant otherwise.
create or replace function public.reroll_clan_code(p_clan_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  c_tries constant integer := 5;
  v_uid   uuid := auth.uid();
  v_code  text;
  v_name  text;
  v_done  boolean := false;
  i       integer;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_clan_id is null then
    raise exception 'clan_id is required' using errcode = '22023';
  end if;
  if not public.is_clan_head(p_clan_id) then
    raise exception 'only a clan head may re-roll the invite code' using errcode = '42501';
  end if;

  for i in 1..c_tries loop
    v_code := public.new_clan_code();
    begin
      -- ⚠️ `returning name` only. Do NOT re-add `code`: it is no longer a
      -- column this role may read, and the value is already in `v_code`.
      update public.clans set code = v_code
       where id = p_clan_id
       returning name into v_name;
      v_done := true;
      exit;
    exception when unique_violation then
      null;                                  -- collision: roll another
    end;
  end loop;

  if not v_done then
    raise exception 'could not allocate an invite code — try again' using errcode = 'P0001';
  end if;

  return jsonb_build_object('clan_id', p_clan_id, 'name', v_name, 'code', v_code);
end;
$$;


-- ── 3 · clan_invite_code — the ONE way a client learns the code ─────────────
-- The code column is unreadable now, so this function is the only path to it.
-- It is **SECURITY DEFINER**, which makes the role check inside it the actual
-- gate — there is no RLS behind a DEFINER function to catch a mistake, so the
-- ladder test below is load-bearing, not decorative.
--
-- ⚠️ WHAT IT RETURNS, AND WHAT IT DELIBERATELY DOES NOT: the code, the clan's
-- name and the CALLER'S OWN role — nothing about anyone else. It is not a
-- member list and not a preview; `preview_clan` owns the non-member view.
--
-- ⚠️ NO RATE LIMIT, on purpose. `preview_clan` and `join_clan` are throttled
-- because they are GUESSING surfaces (a code is 8 chars over a 31-char
-- alphabet). This one is not: it only ever answers about a clan the caller is
-- already in, and the answer is the same every time. A limit here would throttle
-- a head refreshing their own invite card.
create or replace function public.clan_invite_code(p_clan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_role public.clan_role;
  v_code text;
  v_name text;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_clan_id is null then
    raise exception 'clan_id is required' using errcode = '22023';
  end if;

  -- reads the CALLER's own membership row (`auth.uid()` is inside clan_role_of)
  v_role := public.clan_role_of(p_clan_id);
  if v_role is null then
    raise exception 'the caller is not a member of this clan' using errcode = '42501';
  end if;

  -- ⚠️ THE SCRUM-86 RULE, IN ONE LINE. Elder and above may share the invite;
  -- a plain member may not. `head`/`co_head` exist only in the ladder, so they
  -- pass by falling through — and a NEW role added later would need a decision
  -- here rather than silently inheriting access.
  if v_role = 'member' then
    raise exception 'only an elder or above may share the invite code'
      using errcode = '42501';
  end if;

  select c.code, c.name into v_code, v_name
    from public.clans c
   where c.id = p_clan_id
     and c.archived_at is null;

  if v_code is null then
    raise exception 'no such clan' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'clan_id', p_clan_id,
    'name',    v_name,
    'code',    v_code,
    'role',    v_role
  );
end;
$$;

revoke execute on function public.clan_invite_code(uuid) from public, anon;
grant  execute on function public.clan_invite_code(uuid) to authenticated;

comment on function public.clan_invite_code(uuid) is
  'The invite capability, for the caller''s OWN clan. Requires ELDER or above (SCRUM-86, 2026-10-09: the PM limited link sharing to elder and above). The ONLY client-readable path to clans.code, which is otherwise not granted to authenticated.';

-- ═══════════════════════════════════════════════════════════════════════════
-- WHAT THIS MIGRATION DOES NOT CHANGE
--   * `preview_clan` / `join_clan` — already SECURITY DEFINER (they must resolve
--     a code for a NON-member), so the column revoke does not touch them. This
--     was verified by reading them, not assumed: `create_clan` returns only
--     id/ancestor_cap and builds the code from a local variable, so it is safe
--     for the same reason.
--   * `reroll_clan_code`'s AUTHORITY — still head power only (see §2).
--   * `clans_select_member` — the row rule is unchanged; this migration narrows
--     a COLUMN, and the two rules compose.
-- ═══════════════════════════════════════════════════════════════════════════

