-- ═══════════════════════════════════════════════════════════════════════════
-- 0027 · `delete_my_data()` MUST ERASE THE EMAIL — the `auth.users` row
-- (SCRUM-219 · ADR-004 Amendment 1 · ADR-007 §9 · doc 13)
--
-- ⚠️⚠️ THE FAILURE THIS CLOSES, IN THE FUNCTION'S OWN WORDS. Until Amendment 1
-- there WAS no email, so a delete never had to consider `auth.users` — and the
-- function said so, in its own receipt:
--
--     'auth_user_retained', true,
--     'auth_user_note', 'the auth.users row is not removed by SQL — that needs
--                        the Admin API'
--
-- ⚠️ A delete that removes the ledger, the ancestors and the photos but LEAVES
-- THE EMAIL is the worst possible shape of defect: it looks complete and is
-- not, and the one field it leaves is the only one that identifies a PERSON
-- rather than a device (doc 13 §4, PII row 13).
--
-- ── WHY THIS IS SQL AND NOT THE ADMIN API ────────────────────────────────
-- The old note ASSUMED the Admin API was required. It is not. Four facts were
-- measured against the local stack before a line was written (2026-11-15):
--
--   1. every FK referencing `auth.users` is ON DELETE CASCADE —
--      `auth.identities` · `sessions` · `mfa_*` · `oauth_*` · `one_time_tokens`
--      · `webauthn_*` · `public.profiles` — and the single exception,
--      `auth.scim_users`, is ON DELETE SET NULL.
--      ⚠️ So a reference cannot block the delete. That matters: a non-cascade FK
--      is the one way this could fail *at runtime* and roll the whole erase back.
--   2. `postgres` holds DELETE on `auth.users` (explicit grant), even though the
--      table is OWNED by `supabase_auth_admin`.
--   3. `auth.users` has RLS ENABLED and `postgres` is NOT its owner — but
--      `postgres` has BYPASSRLS, and the table has ZERO policies.
--      ⚠️ Without BYPASSRLS this `delete` would have matched nothing and
--      returned 0 rows: a fix that "succeeds" and erases nothing.
--   4. this function is SECURITY DEFINER and owned by `postgres`, so it runs as
--      the role in (2) and (3) — not as the caller.
--
-- ✅ So the erase is ATOMIC with the rest of the delete: every row goes or none
-- does. No edge function, no service key, no client change — and no window in
-- which the data is gone but the identifier survives.
--
-- ⚠️ THE TOMBSTONE WAS DECLINED, DELIBERATELY. The AC allows *"gone, or
-- tombstoned to the same standard the rest of the delete uses."* The rest of
-- this function is a HARD delete, so `email = null` would be a weaker standard
-- than every line beside it — and it would survive a re-verification, which is
-- precisely what a delete exists to prevent. Gone is the honest reading.
--
-- ⚠️ ORDER IS LOAD-BEARING: the row is deleted AFTER the verification loop, so
-- the per-table `get diagnostics` counts in the receipt stay TRUE. A delete
-- placed first would cascade `public.profiles` away and then report
-- `profiles: 0` for a delete that did remove one.
--
-- ⚠️ THE RECEIPT CHANGES, and that is part of the fix: `auth_user_retained`
-- flips to `false` and the client's `DeleteReceipt` type is asserted against
-- this migration by `supabase/tests/delete_my_data_erases_email.sql`.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.delete_my_data()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_counts jsonb := '{}'::jsonb;
  v_n      integer;
  v_flags  integer;
  v_left   integer := 0;
  v_t      text;
  -- ⚠️ 0009: capture ids pinned BEFORE the harvest, so the cartoonize_jobs
  -- verification is a real check rather than a vacuous one.
  v_caps   uuid[];
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  -- doc 13 §9.1 — 1 attempt / 10 min / user
  if exists (
    select 1 from public.rate_counters
     where user_id = v_uid and endpoint = 'delete_my_data'
       and window_start >= date_trunc('minute', now() - interval '10 minutes')
  ) then
    raise exception 'a delete was already attempted recently — try again in ten minutes'
      using errcode = 'P0001';
  end if;
  insert into public.rate_counters (user_id, endpoint, window_start, n)
  values (v_uid, 'delete_my_data', date_trunc('minute', now()), 1);

  -- ── children first (doc 13 §9.4) ─────────────────────────────────────────
  -- ⚠️ 0009: PIN the capture ids first. The verification at the foot counts
  -- cartoonize_jobs against THIS set — which is only a real check because the
  -- ids are captured before the cascade deletes them.
  select coalesce(array_agg(id), '{}') into v_caps
    from public.captures where user_id = v_uid;

  delete from public.equipped_decorations where user_id = v_uid;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('equipped_decorations', v_n);

  delete from public.inventory where user_id = v_uid;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('inventory', v_n);

  delete from public.cartoonize_jobs where capture_id = any(v_caps);
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('cartoonize_jobs', v_n);

  delete from public.tributes where user_id = v_uid;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('tributes', v_n);

  delete from public.burns where user_id = v_uid;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('burns', v_n);

  delete from public.ledger_events where user_id = v_uid;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('ledger_events', v_n);

  delete from public.captures where user_id = v_uid;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('captures', v_n);

  -- tablets of the clans this user founded
  delete from public.ancestors
   where clan_id in (select id from public.clans where created_by = v_uid);
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('ancestors', v_n);
  delete from public.streaks    where user_id = v_uid;
  delete from public.quotas     where user_id = v_uid;
  delete from public.cell_burns where user_id = v_uid;
  delete from public.devices    where user_id = v_uid;
  delete from public.consent_records where user_id = v_uid;

  -- the clans the user FOUNDED go with them: a clan with no members is not a clan
  delete from public.clan_members where user_id = v_uid;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('clan_memberships', v_n);

  delete from public.clans where created_by = v_uid;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('clans_founded', v_n);

  -- `integrity_flags` survives as a PSEUDONYMOUS row (fraud evidence, 90 days)
  update public.integrity_flags set user_id = null where user_id = v_uid;
  get diagnostics v_flags = row_count;

  -- `grid_cells` is an aggregate with NO identity — nothing to delete.

  delete from public.rate_counters where user_id = v_uid;

  delete from public.profiles where user_id = v_uid;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('profiles', v_n);

  -- ── VERIFY: 0 rows across every personal table, or it is a bug ───────────
  foreach v_t in array array[
    'profiles', 'captures', 'burns', 'ledger_events',
    'streaks', 'quotas', 'cell_burns', 'inventory', 'equipped_decorations',
    'tributes', 'consent_records', 'devices', 'clan_members'
  ] loop
    execute format('select count(*) from public.%I where user_id = $1', v_t)
      into v_n using v_uid;
    v_left := v_left + coalesce(v_n, 0);
  end loop;

  select count(*) into v_n from public.clans where created_by = v_uid;
  v_left := v_left + coalesce(v_n, 0);
  select count(*) into v_n from public.ancestors
   where clan_id in (select id from public.clans where created_by = v_uid);
  v_left := v_left + coalesce(v_n, 0);

  -- ⚠️ 0009: the cartoonize_jobs probe, done correctly — against the capture
  -- ids pinned before the harvest (the table has no `user_id` of its own).
  select count(*) into v_n from public.cartoonize_jobs where capture_id = any(v_caps);
  v_left := v_left + coalesce(v_n, 0);

  -- ═══ ERASE THE IDENTIFIER — the `auth.users` row, and the email with it ═══
  -- ⚠️⚠️ SCRUM-219. This is the line the function spent two months documenting
  -- as impossible ("that needs the Admin API"). It is not: `postgres` owns the
  -- DELETE grant, bypasses RLS, and every referencing FK cascades — all measured
  -- (see the migration header). ⚠️ It runs LAST so the counts above stay true;
  -- `public.profiles` cascades from here too, but that row is already gone and
  -- its reported count is the one the delete actually removed.
  --
  -- ⚠️ `auth.scim_users` is the ONE reference that is not a cascade — it is
  -- ON DELETE SET NULL, so it leaves a row with a null `user_id`. That is
  -- correct (an enterprise SCIM mapping outlives no user) and this product has
  -- no SCIM, so nothing reads it.
  --
  -- ⚠️ This also removes `auth.sessions` and `auth.refresh_tokens` by cascade,
  -- so the caller's OWN session stops being valid the moment this commits. The
  -- client expects that: `settings.tsx` calls `resetIdentity()` next, which
  -- signs out (a failure there is swallowed by design) and mints a fresh
  -- anonymous identity. Nothing half-erased is reachable.
  delete from auth.users where id = v_uid;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('auth_users', v_n);

  -- ⚠️ VERIFY THE ERASE ITSELF. `v_left` is the receipt's own success condition,
  -- so the identifier is counted in it — otherwise "0 rows left" would be a
  -- claim about every table EXCEPT the one that holds the email.
  select count(*) into v_n from auth.users where id = v_uid;
  v_left := v_left + coalesce(v_n, 0);

  return jsonb_build_object(
    'deleted_at',                    now(),
    'counts',                        v_counts,
    'verified_zero_rows',            v_left = 0,
    'rows_left_behind',              v_left,
    'pseudonymised_integrity_flags', v_flags,
    'grid_cells_kept',               true,
    'storage_prefixes',              jsonb_build_array(
                                       'captures/' || v_uid::text,
                                       'styled/'   || v_uid::text),
    'storage_note',                  'NOT purged here — the Storage API (service key) must remove these objects; a SQL row delete would orphan the bytes',
    -- ⚠️ SCRUM-219: this used to be `true`, with a note saying SQL could not do
    -- it. Both are now wrong, and a receipt that still said `true` would be a
    -- lie a test could not catch — so the flag is asserted too.
    'auth_user_retained',            false,
    'auth_user_note',                'the auth.users row — and its email — are DELETED here (SCRUM-219)'
  );
end;
$$;

-- ⚠️ `create or replace` PRESERVES the existing grants, so the REVOKE/GRANT
-- from 0015 is deliberately not repeated here: re-stating it could only make the
-- surface WIDER if it were ever mistyped. The function stays executable by
-- `authenticated` alone.
comment on function public.delete_my_data() is
  'ADR-007 §9 one-tap erasure. ⚠️ SCRUM-219: deletes the auth.users row too, so the EMAIL goes with the rest of the data — the receipt''s auth_user_retained is now false.';
