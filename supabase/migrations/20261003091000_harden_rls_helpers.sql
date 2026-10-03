-- ═══════════════════════════════════════════════════════════════════════════
-- 0002 · HARDEN THE RLS HELPER FUNCTIONS
--
-- Found by `get_advisors` immediately after 0001 applied — the security linter
-- reported that `anon` could execute all four SECURITY DEFINER functions via
-- /rest/v1/rpc/.
--
-- WHY 0001's REVOKE DID NOT WORK:
--   `create function` grants EXECUTE to PUBLIC by default, and `anon` and
--   `authenticated` are both MEMBERS of PUBLIC. `revoke ... from anon` removes
--   only an explicit anon grant — the inherited PUBLIC grant survives, so the
--   function stayed reachable.
--   The fix is to revoke from PUBLIC, then grant back narrowly.
--
-- This is a NEW migration rather than an edit to 0001: 0001 is already applied
-- to the hosted project, and rewriting an applied migration causes drift.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Remove the implicit PUBLIC grant from every helper.
revoke execute on function public.is_clan_member(uuid) from public;
revoke execute on function public.clan_role_of(uuid)   from public;
revoke execute on function public.is_clan_head(uuid)   from public;
revoke execute on function public.enforce_ancestor_cap() from public;

-- 2. Grant back ONLY what is genuinely needed.
--
-- The three membership helpers are called INSIDE RLS policies. Policies are
-- evaluated as the INVOKER, so a signed-in user must hold EXECUTE on them or
-- every clan-scoped query fails. They are granted to `authenticated` only —
-- `anon` never matches a policy in this schema (all policies are
-- `to authenticated`), so it has no business calling them.
grant execute on function public.is_clan_member(uuid) to authenticated;
grant execute on function public.clan_role_of(uuid)   to authenticated;
grant execute on function public.is_clan_head(uuid)   to authenticated;

-- 3. `enforce_ancestor_cap` is a TRIGGER function. Triggers fire with the table
--    owner's privileges, so NO client role needs EXECUTE on it. It stays
--    revoked from everyone — it must never be callable as an RPC endpoint.

comment on function public.is_clan_member(uuid) is
  'RLS helper. SECURITY DEFINER so it can read clan_members inside a policy without recursing. EXECUTE is restricted to `authenticated`; it is not a public RPC.';
