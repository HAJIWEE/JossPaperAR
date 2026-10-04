-- ═══════════════════════════════════════════════════════════════════════════
-- 0011 · THE GLOBAL AI-BUDGET STOP-RULE — SCRUM-59, option B (PM, 2026-10-04)
--
-- ── WHAT THIS IS FOR ───────────────────────────────────────────────────────
-- Burn limits ARE the AI-cost control (doc 10 §1), and until now the slice had
-- only the per-user half of it: `request_cartoonize` enforced the 10/day photo
-- allowance and a 3/min burst, and looked at MONEY NOT AT ALL. Ten photos a day
-- × N testers is an unmetered bill — exactly the exposure doc 10 §6 put a
-- ceiling on (≤ $3.64/user/month).
--
-- ── THE DECISION (ratified) ────────────────────────────────────────────────
-- SCRUM-59 **option B**: enforce the daily cap AND a global daily AI-budget
-- stop-rule. The wallet half of doc 10 §4 — the 150-credit photo fee, the
-- 2,000-credit starter grant, the 15/month free cap and the `grant|credits|ad`
-- funding split — needs the cash shop and a `sign_in_grants` table that do not
-- exist, and stays deferred to beta (SCRUM-18 / ADR-006).
--
-- ── THE RULE, AS THE SPEC WRITES IT (doc 10 §4) ─────────────────────────────
--   assert global.ai_budget_today_usd >= 0.10   # STOP RULE — else queue job
--   "Exhausted → jobs **queue** (offline-queue machinery already exists),
--    never error."
-- and the copy is the loading ritual's: "The shrine is receiving many
-- offerings…" — already in the client as `ritual_busy` (src/lib/i18n.ts).
--
-- ── ⚠️ QUEUE, NEVER FAIL ───────────────────────────────────────────────────
-- An exhausted budget must not LOSE the offering: the job row stays `queued`,
-- the capture stays `pending`, and the very next request for the same capture
-- re-checks the budget and proceeds the moment it opens. `unique(capture_id)`
-- makes that retry free of new state — the same property that stops a retried
-- request paying twice (doc 07 §4.2).
--
-- ⚠️ A NEW MIGRATION, NOT AN EDIT TO 0005: `request_cartoonize` is already
-- applied to the hosted project. Same rule as 0002/0003/0007–0010.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ THE CONFIG HOME — one row per knob, server-only ═══════════════════════
-- A TABLE rather than a GUC: the value is reviewable, queryable and changeable
-- from the Dashboard without a deploy, and it is versioned with the schema.
-- RLS is enabled with NO policies — the same posture as `rate_counters`, i.e.
-- only a service path (and the definer functions below) can read it.
create table if not exists public.app_config (
  key        text primary key check (char_length(key) between 1 and 60),
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

comment on table public.app_config is
  'Server-only config knobs (RLS on, no policies). Read through definer functions, never from the client. First knob: daily_ai_budget_micros.';

-- The alpha budget: doc 10 §4 — "$5/day" (production ≈ 70% of trailing-7-day
-- cash-shop net, which needs the cash shop, so it stays $5 at alpha).
insert into public.app_config (key, value) values ('daily_ai_budget_micros', '5000000'::jsonb)
on conflict (key) do nothing;

-- ── The two readers, so the rule has ONE definition ───────────────────────
-- Today's AI spend, in micro-dollars, derived from the numbers the orchestrator
-- already records (`cartoonize_jobs.cost_micros` — doc 07 §5.3: "this is how we
-- learn cost/burn"). Spending is attributed to the day the JOB WAS CREATED,
-- which matches the daily allowance exactly for a same-day flow.
create or replace function public.ai_spend_today(p_day date default public.burn_day())
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(cost_micros), 0)
  from public.cartoonize_jobs
  where created_at >= (p_day::timestamp at time zone 'utc')
$$;

-- The configured budget. A missing or malformed row reads as 0, which FAILS
-- CLOSED: an unset budget must stop spending, not allow it.
create or replace function public.ai_budget_micros()
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
           (select (value #>> '{}')::bigint
              from public.app_config
             where key = 'daily_ai_budget_micros'),
           0)
$$;

-- ═══ request_cartoonize — the quota gate, now with the STOP-RULE ═══════════
create or replace function public.request_cartoonize(p_actor uuid, p_capture_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_photo_jobs_day constant integer := 10;   -- doc 10 §1 (photo burns / day)
  c_req_per_min    constant integer := 3;    -- doc 11 §5
  -- ⚠️ The SPEC'S FLOOR, not an accident: doc 10 §4 asserts
  -- `global.ai_budget_today_usd >= 0.10`, i.e. the question is "can the shrine
  -- still afford one more photo?" ($0.09 + headroom). Keeping the floor is what
  -- makes the budget a HARD ceiling — a job that starts can never push the day
  -- past it — and it fails closed when the knob is missing (0 budget → queue).
  c_min_remaining_micros constant bigint := 100000;   -- $0.10
  v_day    date := public.burn_day();
  v_job    public.cartoonize_jobs;
  v_exists boolean := false;
  v_used   integer;
  v_spend  bigint;
  v_budget bigint;
begin
  if p_actor is null then
    raise exception 'request_cartoonize requires an authenticated actor' using errcode = '42501';
  end if;
  perform public.ensure_profile(p_actor);

  perform pg_advisory_xact_lock(hashtextextended(p_actor::text, 0));

  -- ONE JOB PER CAPTURE (unique(capture_id)) — a retry cannot pay twice
  select * into v_job from public.cartoonize_jobs where capture_id = p_capture_id;
  v_exists := found;

  if v_exists then
    if not exists (
      select 1 from public.captures where id = p_capture_id and user_id = p_actor
    ) then
      raise exception 'capture % does not belong to the actor', p_capture_id
        using errcode = '42501';
    end if;

    -- A job that is no longer `queued` has RUN (or been refused): the request is
    -- a replay, and it must not spend again. ⚠️ The same rule is why a FAILED
    -- generation cannot be retried for THIS capture — one job per capture is the
    -- cost guarantee (doc 07 §4.2); a retry is a NEW capture.
    if v_job.status <> 'queued' then
      return jsonb_build_object(
        'job_id', v_job.id, 'status', v_job.status,
        'idempotent_replay', true, 'already_requested', true,
        'budget_exhausted', false
      );
    end if;
    -- …and a job that IS `queued` falls through: it is either brand new, or it
    -- was parked by the stop-rule, and the budget must be re-checked either way.
  end if;

  if not exists (
    select 1 from public.captures
    where id = p_capture_id and user_id = p_actor and status = 'pending'
  ) then
    raise exception 'capture % is not a pending capture owned by the actor', p_capture_id
      using errcode = '42501';
  end if;

  if not public.rate_limit_allow(p_actor, 'request_cartoonize', c_req_per_min) then
    raise exception 'the shrine is busy — try again in a moment' using errcode = 'P0001';
  end if;

  -- ── THE DAILY ALLOWANCE counts only jobs that actually RAN ───────────────
  -- A job parked by the stop-rule must not consume one of the user's ten
  -- attempts for work that never happened (SCRUM-59's refinement).
  select count(*) into v_used
    from public.cartoonize_jobs j
   where j.capture_id in (select c.id from public.captures c where c.user_id = p_actor)
     and j.created_at >= (v_day::timestamp at time zone 'utc')
     and j.status <> 'queued';

  if v_used >= c_photo_jobs_day then
    raise exception 'daily photo allowance is complete' using errcode = 'P0001';
  end if;

  -- ── THE STOP-RULE (doc 10 §4). Queue, never fail. ────────────────────────
  -- No integrity flag here on purpose: an exhausted budget is a DESIGNED state,
  -- not an anomaly (doc 11 §6's signals are for things that should not happen).
  -- The queued job row plus the returned numbers are the record.
  v_spend  := public.ai_spend_today(v_day);
  v_budget := public.ai_budget_micros();

  if v_spend + c_min_remaining_micros > v_budget then
    if not v_exists then
      insert into public.cartoonize_jobs (capture_id, provider, style, status)
      values (p_capture_id, 'fal', 'D', 'queued')
      returning * into v_job;
    end if;

    return jsonb_build_object(
      'job_id', v_job.id, 'status', 'queued',
      'idempotent_replay', false, 'already_requested', v_exists,
      'budget_exhausted', true, 'queued', true,
      'spend_micros_today', v_spend, 'budget_micros', v_budget
    );
  end if;

  if not v_exists then
    insert into public.cartoonize_jobs (capture_id, provider, style, status)
    values (p_capture_id, 'fal', 'D', 'queued')
    returning * into v_job;
  end if;

  return jsonb_build_object(
    'job_id', v_job.id, 'status', v_job.status,
    'idempotent_replay', false, 'already_requested', v_exists,
    'budget_exhausted', false, 'queued', false,
    'spend_micros_today', v_spend, 'budget_micros', v_budget
  );
end;
$$;

-- ═══ GRANTS — the same posture as 0005/0004 ═══════════════════════════════
-- The gate stays service_role-ONLY (it is called by cartoonize-orchestrator and
-- never by a client), and the two new readers stay unreachable from the Data
-- API. Trap already paid for: revoke PUBLIC *and* the explicit role grant.
revoke execute on function public.request_cartoonize(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.request_cartoonize(uuid, uuid) to service_role;

revoke execute on function public.ai_spend_today(date) from public, anon, authenticated, service_role;
revoke execute on function public.ai_budget_micros() from public, anon, authenticated, service_role;

comment on function public.request_cartoonize(uuid, uuid) is
  'The quota gate (doc 07 §4.2 step 3) WITH the global AI-budget stop-rule (SCRUM-59, doc 10 §4): the capture must be the caller''s own and pending; the 3/min burst limit applies; the daily allowance counts only jobs that RAN; and when the day''s spend reaches the budget the job is left QUEUED — queue, never fail, so the offering is not lost. SECURITY DEFINER, EXECUTE to service_role ONLY.';
comment on function public.ai_spend_today(date) is
  'Today''s AI spend in micro-dollars, derived from cartoonize_jobs.cost_micros (attributed to the day the job was CREATED, matching the daily allowance). Internal — no client grant.';
comment on function public.ai_budget_micros() is
  'The configured daily AI budget from app_config.daily_ai_budget_micros. A missing or malformed row reads as 0, which FAILS CLOSED: an unset budget stops spending rather than allowing it.';
