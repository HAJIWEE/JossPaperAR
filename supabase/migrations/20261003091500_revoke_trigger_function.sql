-- ═══════════════════════════════════════════════════════════════════════════
-- 0003 · REVOKE THE TRIGGER FUNCTION FROM THE CLIENT ROLES
--
-- 0002 revoked the implicit PUBLIC grant, which cleared the advisory for the
-- three membership helpers. `enforce_ancestor_cap` remained anon-executable,
-- for a reason worth recording:
--
--   Supabase applies DEFAULT PRIVILEGES that grant EXECUTE on new functions in
--   `public` to `anon`, `authenticated` and `service_role` EXPLICITLY — not
--   only through PUBLIC. So there are two independent grants to remove:
--     (a) the PUBLIC grant        -> handled in 0002
--     (b) the explicit role grant -> handled here
--   Revoking only one leaves the other path open. That is why the advisory
--   survives a "correct-looking" revoke.
--
-- `enforce_ancestor_cap` is a TRIGGER function: triggers execute with the table
-- owner's privileges, so no client role needs EXECUTE. It must never be
-- reachable at /rest/v1/rpc/enforce_ancestor_cap — a user could otherwise call
-- it directly and trip the cap check for an arbitrary clan.
-- ═══════════════════════════════════════════════════════════════════════════

revoke execute on function public.enforce_ancestor_cap() from anon;
revoke execute on function public.enforce_ancestor_cap() from authenticated;
revoke execute on function public.enforce_ancestor_cap() from service_role;
revoke execute on function public.enforce_ancestor_cap() from public;

comment on function public.enforce_ancestor_cap() is
  'TRIGGER function — not callable by any role. Triggers fire as the table owner, so no EXECUTE grant is needed. Kept revoked so it cannot be invoked as an RPC endpoint.';
