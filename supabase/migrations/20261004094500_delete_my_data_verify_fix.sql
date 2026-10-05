-- ═══════════════════════════════════════════════════════════════════════════
-- 0009 · `delete_my_data` — its own VERIFY probe asked for a column that
--        does not exist (`cartoonize_jobs.user_id`)
--
-- FOUND BY supabase/tests/pr3_verification.sql. 0005's self-verification loop
-- walked a fixed list of tables and counted `where user_id = $1` in each — but
-- `cartoonize_jobs` is keyed by `capture_id` and has NO `user_id` column, so
-- the probe raised 42703 exactly when it was supposed to be proving 0 rows.
-- (The probe's own failure is why the delete looked broken; the DELETEs
-- themselves were correct.)
--
-- THE FIX: capture the user's capture ids BEFORE the harvest, delete the jobs
-- by that set, and verify against the SAME set — which is a genuine check
-- rather than a vacuous one, because the ids are pinned before the cascade.
--
-- ⚠️ A new migration rather than an edit to 0005: 0005 is applied.
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
    'auth_user_retained',            true,
    'auth_user_note',                'the auth.users row is not removed by SQL — that needs the Admin API'
  );
end;
$$;

-- CREATE OR REPLACE preserves grants; restated so the file stands alone.
revoke execute on function public.delete_my_data() from public, anon;
grant  execute on function public.delete_my_data() to authenticated;
