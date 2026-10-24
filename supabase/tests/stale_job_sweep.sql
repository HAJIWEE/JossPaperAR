-- ═══════════════════════════════════════════════════════════════════════════
-- THE STALE-JOB SWEEP — SCRUM-126 (option C only, pure detection)
--
-- Everything here is an ASSERTION THAT RAISES ON FAILURE, so the run is green or
-- it is red — never "looks about right".
--
-- ── WHAT IT PROVES ─────────────────────────────────────────────────────────
-- The owner's answer was **C only**, with *"do not requeue"* stated explicitly.
-- So the sweep must do EXACTLY two things and neither of the two it must not:
--
--   · a stale `running` row whose styled object EXISTS  → `styled`  (RECOVERED)
--   · a stale `running` row whose styled object ABSENT  → UNTOUCHED
--
-- ⚠️ **R3 IS THE ONE THAT MATTERS MOST.** "Leave it alone" is the half a
-- reasonable-looking implementation gets wrong, because marking it `failed` is
-- the obvious tidy-up — and it would discard a sprite that was actually paid for.
-- ⚠️ **R7 IS THE SECOND.** No row may be re-run: a requeue spends ≈US$0.09 again,
-- which is the whole reason option A was excluded.
--
-- ⚠️ THE CONTROL IS R5/R6. Without a fresh row and a terminal row in the fixture,
-- "everything stale is recovered" and "everything is left alone" would BOTH pass
-- a test that only had one stale row — so the fixture carries four.
--
-- ⚠️ FAULT-TEST IT: change the `if exists (…)` to `if not exists (…)` and R2/R3
-- swap; delete the `and status = 'running'` predicate and R7 still passes but the
-- requeue check is the one to watch.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function pg_temp.assert_true(p_ok boolean, p_name text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then
    raise exception '✗ FAIL: %', p_name;
  end if;
  raise notice '  ✓ %', p_name;
end;
$$;

-- the fixture ids, so the assertion block can reach them
create table pg_temp.sweep_fixture (k text primary key, id uuid);

-- ⚠️ `storage.objects` CARRIES A `protect_delete` TRIGGER that refuses DIRECT deletes
-- (*"Use the Storage API instead"*), and this fixture has to clean up after itself or a
-- re-run is not safe. `session_replication_role = replica` suspends user triggers for
-- THIS SESSION — ⚠️ session-scoped, not `SET LOCAL`, because the harness runs each
-- statement in its own transaction and a LOCAL setting would be gone by the next one.
-- ⚠️ It is restored at the foot of this file, so the test cannot leave the guard
-- switched off for anything that runs after it.
set session_replication_role = replica;

-- ═══ FIXTURES (as the database owner) ══════════════════════════════════════
do $setup$
declare
  v_u uuid := '39393000-0000-4000-8000-0000000000aa';
  v_a uuid;  -- stale `running` + styled object EXISTS  → must be RECOVERED
  v_b uuid;  -- stale `running` + NO styled object      → must be UNTOUCHED
  v_c uuid;  -- FRESH `running` (inside the grace)      → must be UNTOUCHED
  v_d uuid;  -- terminal (`failed`)                     → must be UNTOUCHED
begin
  -- pre-clean, so a RE-RUN after a failed run is safe
  delete from public.captures where user_id = v_u;
  delete from public.profiles where user_id = v_u;
  delete from auth.users where id = v_u;
  delete from storage.objects where bucket_id = 'styled' and name like v_u::text || '/%';

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'sweep@example.invalid', '', now(),
    '{"provider":"anonymous","providers":["anonymous"]}', '{}', now(), now()
  );

  insert into public.captures (user_id, storage_path, status)
    values (v_u, v_u::text || '/a.jpg', 'pending') returning id into v_a;
  insert into public.captures (user_id, storage_path, status)
    values (v_u, v_u::text || '/b.jpg', 'pending') returning id into v_b;
  insert into public.captures (user_id, storage_path, status)
    values (v_u, v_u::text || '/c.jpg', 'pending') returning id into v_c;
  insert into public.captures (user_id, storage_path, status)
    values (v_u, v_u::text || '/d.jpg', 'pending') returning id into v_d;

  insert into pg_temp.sweep_fixture values ('a', v_a), ('b', v_b), ('c', v_c), ('d', v_d);

  -- ⚠️ `created_at` is set BACKWARDS by hand: `cartoonize_jobs` has no
  -- `updated_at` trigger and the sweep anchors on `created_at` (see the migration).
  insert into public.cartoonize_jobs (capture_id, provider, status, created_at)
    values (v_a, 'fal', 'running', now() - interval '30 minutes');
  insert into public.cartoonize_jobs (capture_id, provider, status, created_at)
    values (v_b, 'fal', 'running', now() - interval '30 minutes');
  insert into public.cartoonize_jobs (capture_id, provider, status, created_at)
    values (v_c, 'fal', 'running', now() - interval '1 minute');
  insert into public.cartoonize_jobs (capture_id, provider, status, created_at, error)
    values (v_d, 'fal', 'failed', now() - interval '30 minutes', 'boom');

  -- ⚠️ ONLY capture A gets a styled object — that single difference is the whole
  -- fixture. The extension is `.webp` because the generator chooses it, and the
  -- sweep matches `.%` rather than pinning the suffix.
  insert into storage.objects (id, bucket_id, name)
    values (gen_random_uuid(), 'styled', v_u::text || '/' || v_a::text || '.webp');
end
$setup$;

-- ═══ THE SWEEP, RUN ONCE ═══════════════════════════════════════════════════
do $test$
declare
  v_recovered integer;
  v_job       public.job_status;
  v_capture   public.capture_status;
  v_a uuid := (select id from pg_temp.sweep_fixture where k = 'a');
  v_b uuid := (select id from pg_temp.sweep_fixture where k = 'b');
  v_c uuid := (select id from pg_temp.sweep_fixture where k = 'c');
  v_d uuid := (select id from pg_temp.sweep_fixture where k = 'd');
begin
  v_recovered := public.reconcile_stale_cartoonize_jobs();

  -- ── R1 · EXACTLY the one eligible row ────────────────────────────────────
  -- ⚠️ An exact count, not "> 0": a sweep that recovered everything stale would
  -- pass a weaker assertion while doing the wrong thing to B.
  perform pg_temp.assert_true(v_recovered = 1,
    'R1  exactly ONE row is recovered — the stale one whose object exists (got ' || v_recovered || ')');

  -- ── R2 · THE RECOVERY ───────────────────────────────────────────────────
  select status into v_job from public.cartoonize_jobs where capture_id = v_a;
  perform pg_temp.assert_true(v_job = 'styled',
    'R2  the stale job whose styled object EXISTS is recovered to styled (got ' || v_job || ')');

  select status into v_capture from public.captures where id = v_a;
  perform pg_temp.assert_true(v_capture = 'styled',
    'R2  …and its capture follows it to styled (got ' || v_capture || ')');

  -- ── R3 · ⚠️ THE ONE THAT MATTERS MOST: LEAVE IT ALONE ───────────────────
  select status into v_job from public.cartoonize_jobs where capture_id = v_b;
  perform pg_temp.assert_true(v_job = 'running',
    'R3  ⚠️ the stale job whose object is ABSENT is left RUNNING — never failed (got ' || v_job || ')');

  select status into v_capture from public.captures where id = v_b;
  perform pg_temp.assert_true(v_capture = 'pending',
    'R3  …and its capture is untouched (got ' || v_capture || ')');

  -- ── R4 · the grace period is real ───────────────────────────────────────
  select status into v_job from public.cartoonize_jobs where capture_id = v_c;
  perform pg_temp.assert_true(v_job = 'running',
    'R4  a FRESH running row (1 min old) is untouched — the grace is 15 min (got ' || v_job || ')');

  -- ── R5 · a TERMINAL row is never revisited ──────────────────────────────
  select status into v_job from public.cartoonize_jobs where capture_id = v_d;
  perform pg_temp.assert_true(v_job = 'failed',
    'R5  a FAILED row is untouched — the sweep only reads `running` (got ' || v_job || ')');

  -- ── R6 · ⚠️ NOTHING WAS REQUEUED (option A is excluded) ─────────────────
  -- ⚠️ The count is the assertion that matters: a requeue would either INSERT a
  -- row (impossible — one job per capture) or move the status back to `queued`.
  -- So both are checked, because "no requeue" has two ways to be violated.
  perform pg_temp.assert_true(
    (select count(*) from public.cartoonize_jobs
      where capture_id in (v_a, v_b, v_c, v_d)) = 4,
    'R6  ⚠️ NO row was added — still exactly four jobs (a requeue would spend again)');

  perform pg_temp.assert_true(
    (select count(*) from public.cartoonize_jobs
      where capture_id in (v_a, v_b, v_c, v_d) and status = 'queued') = 0,
    'R6  ⚠️ …and NOTHING is queued — the sweep never puts a row back in flight');

  -- ── R7 · the sweep is IDEMPOTENT ────────────────────────────────────────
  -- ⚠️ A second run must recover nothing: A is terminal now, so it is no longer
  -- eligible. A sweep that kept "recovering" the same row would be reporting work
  -- it is not doing, and the cron runs this every fifteen minutes for ever.
  perform pg_temp.assert_true(public.reconcile_stale_cartoonize_jobs() = 0,
    'R7  a SECOND run recovers nothing — the sweep is idempotent');
end
$test$;

-- ═══ PRIVILEGES — IT IS NOT A CLIENT SURFACE ═══════════════════════════════
do $priv$
begin
  perform pg_temp.assert_true(
    not has_function_privilege('authenticated',
      'public.reconcile_stale_cartoonize_jobs()', 'execute'),
    'R8  ⚠️ `authenticated` CANNOT execute the sweep — it writes as its owner');

  perform pg_temp.assert_true(
    not has_function_privilege('anon',
      'public.reconcile_stale_cartoonize_jobs()', 'execute'),
    'R8  ⚠️ …nor can `anon`');

  perform pg_temp.assert_true(
    has_function_privilege('service_role',
      'public.reconcile_stale_cartoonize_jobs()', 'execute'),
    'R8  …but `service_role` can, so it can be run by hand when needed');
end
$priv$;

-- ═══ TEARDOWN — leave the database as it was found ═════════════════════════
do $cleanup$
declare
  v_u uuid := '39393000-0000-4000-8000-0000000000aa';
begin
  delete from storage.objects where bucket_id = 'styled' and name like v_u::text || '/%';
  delete from public.captures where user_id = v_u;
  delete from public.profiles where user_id = v_u;
  delete from auth.users where id = v_u;
end
$cleanup$;

-- ⚠️ PUT THE STORAGE GUARD BACK. Everything above ran with user triggers suspended;
-- leaving it that way would be a test that quietly weakens the database it tested.
set session_replication_role = origin;

