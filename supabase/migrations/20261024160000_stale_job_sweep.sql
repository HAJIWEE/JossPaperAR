-- ═══════════════════════════════════════════════════════════════════════════
-- THE STALE-JOB SWEEP — SCRUM-126 (owner's answer: option C ONLY, pure detection)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ── THE DEFECT ─────────────────────────────────────────────────────────────
-- `cartoonize_jobs` has `unique (capture_id)`, and `request_cartoonize` answers
-- `already_requested` for a row that is not terminal. So a row left at `running`
-- — an Edge Function killed mid-pipeline writes no terminal status — makes its
-- offering **permanently un-preparable**, and no client action can advance it.
-- `SCRUM-125` gave the player an honest ~60 s failure and a retry button; this
-- sweep is what makes that retry able to SUCCEED.
--
-- ── ⚠️ THE OWNER'S ANSWER, AND WHAT IT EXCLUDES ────────────────────────────
-- The ticket offered four options and the owner chose **C only**, with
-- *"do not requeue"* stated explicitly. Read precisely, that means:
--
--   · **A (auto-requeue) is EXCLUDED.** No stale row is ever re-run, so the
--     ≈US$0.09-per-stale-run risk in option A is never taken.
--   · **B (fail the row) is EXCLUDED as an action.** Nothing is marked `failed`,
--     so a sprite that was actually paid for can never be discarded.
--   · **C is a DETECTOR, not a terminal action** — and its signal is the
--     styled-object existence check, which resolves the one ambiguity A and B
--     each guess at: *"did the run die, or did it finish and lose the write?"*
--
-- ── ⚠️ THE RESIDUAL, STATED PLAINLY ────────────────────────────────────────
-- A row that genuinely DIED is **left untouched** and stays `running` for ever,
-- so that one offering remains unusable and the player photographs again. What
-- this policy guarantees is that **no money is lost in either direction**:
-- nothing is re-spent, and nothing already paid for is thrown away.
--
-- ── ⚠️ WHY THE ANCHOR IS `created_at`, NOT `updated_at` ────────────────────
-- `cartoonize_jobs` has NO `updated_at` trigger (verified: no trigger sets it in
-- any migration), and the orchestrator's own `running` write does not set it
-- either — so `updated_at` on a `running` row is still the INSERT default.
-- `created_at` is therefore the only trustworthy timestamp, and it is a sound
-- anchor here: the orchestrator sets `running` within seconds of the request, so
-- the queue delay is negligible against a fifteen-minute threshold.
--
-- ⚠️ `cost_micros` IS DELIBERATELY LEFT ALONE on a recovered row. The run really
-- did spend, but the row that would have recorded the amount is the one that was
-- lost — so the sweep does not invent a figure. A NULL here means "spent, amount
-- unknown", and `project-costs.md` is where the reconciliation happens.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── the threshold, in one place ─────────────────────────────────────────────
-- ⚠️ "Well beyond the function timeout" is the ticket's own wording. The
-- orchestrator's measured wall is ≈13.7 s (p50) and its worst observed run is
-- ≈17.9 s, so fifteen minutes is roughly fifty times the longest real run — a
-- margin wide enough that no genuinely-live job can be mistaken for a stale one.
create or replace function public.stale_job_grace()
returns interval
language sql
immutable
as $$ select interval '15 minutes' $$;

comment on function public.stale_job_grace() is
  'SCRUM-126: how long a `running` cartoonize_jobs row must sit before the sweep '
  'will look at it. ≈50× the longest measured Path C run (≈17.9 s).';

-- ── the sweep ───────────────────────────────────────────────────────────────
create or replace function public.reconcile_stale_cartoonize_jobs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recovered integer := 0;
  v_job       record;
begin
  for v_job in
    select j.id as job_id, j.capture_id, c.user_id
      from public.cartoonize_jobs j
      join public.captures c on c.id = j.capture_id
     where j.status = 'running'
       and j.created_at < now() - public.stale_job_grace()
  loop
    /*
     * ⚠️ THE STYLED-OBJECT CHECK IS THE WHOLE FEATURE, so it is one query and not
     * a heuristic. The orchestrator writes `styled/<user_id>/<capture_id>.<ext>`
     * and the GENERATOR chooses the extension (webp since migration 0010), which
     * is why this matches `.%` rather than a fixed suffix — pinning `.webp` would
     * silently stop matching the day a second format is allowed.
     */
    if exists (
      select 1
        from storage.objects o
       where o.bucket_id = 'styled'
         and o.name like v_job.user_id::text || '/' || v_job.capture_id::text || '.%'
    ) then
      /*
       * ⚠️ `and status = 'running'` ON BOTH WRITES. The orchestrator may have
       * completed the job between the SELECT above and this UPDATE — the sweep
       * must never overwrite a terminal status with a recovered one, and the
       * predicate makes that impossible rather than merely unlikely.
       */
      update public.cartoonize_jobs
         set status = 'styled'
       where id = v_job.job_id
         and status = 'running';

      update public.captures
         set status = 'styled'
       where id = v_job.capture_id
         and status <> 'styled';

      v_recovered := v_recovered + 1;
    end if;

    /*
     * ⚠️ AND IF THE OBJECT IS ABSENT: **DO NOTHING.** Not a requeue (option A is
     * excluded, and it would spend again), and not a `failed` write (option B is
     * excluded, and it could discard a paid sprite). The row stays `running`, and
     * the residual above is the accepted cost of that choice.
     */
  end loop;

  return v_recovered;
end;
$$;

comment on function public.reconcile_stale_cartoonize_jobs() is
  'SCRUM-126 (option C only, owner 2026-10-24): reconciles cartoonize_jobs rows '
  'stuck at `running` by checking whether the styled object already exists. Marks '
  '`running -> styled` when it does; leaves the row untouched when it does not. '
  '⚠️ Never requeues (no spend) and never writes `failed` (never discards a paid '
  'sprite). Returns the number of rows recovered.';

-- ── ⚠️ PRIVILEGES: THIS FUNCTION IS NOT A CLIENT SURFACE ────────────────────
-- It is SECURITY DEFINER and writes to `cartoonize_jobs` and `captures` as its
-- owner, so an execute grant to `authenticated` would hand every player a
-- privileged write. Only the scheduler (which runs as the job owner) and the
-- service role may call it.
revoke all on function public.reconcile_stale_cartoonize_jobs() from public;
revoke all on function public.reconcile_stale_cartoonize_jobs() from anon, authenticated;
grant execute on function public.reconcile_stale_cartoonize_jobs() to service_role;

-- ── the schedule ────────────────────────────────────────────────────────────
-- ⚠️ `pg_cron` IS ALREADY ENABLED — by `20261011140000_pg_cron_weekly_roll.sql`,
-- which did it for the league roll. ⚠️ SCRUM-126's own text says *"`pg_cron` is
-- currently deliberately not enabled"*, and that line went STALE the day the
-- league roll shipped. `create extension if not exists` is kept anyway so this
-- file stands alone and does not depend on a migration ordering.
--
-- ⚠️ NAMED, so re-running this migration UPDATES the job rather than creating a
-- second one (pg_cron upserts by name) — the same property that makes
-- `weekly-roll` safely re-appliable.
--
-- Every 15 minutes, matching the grace period: a row becomes eligible exactly one
-- grace period after it was created, and is then looked at within 15 minutes.
create extension if not exists pg_cron;

select cron.schedule(
  'stale-cartoonize-sweep',
  '*/15 * * * *',
  $$select public.reconcile_stale_cartoonize_jobs()$$
);

comment on extension pg_cron is
  'Two jobs: the league roll (SCRUM-11) and the stale-job sweep (SCRUM-126). '
  'Enabled by the league roll; the sweep is the second job to use it.';


