-- ═══════════════════════════════════════════════════════════════════════════
-- THE DEMO TEARDOWN (SCRUM-197 · parent SCRUM-155)
--
-- ⚠️⚠️ **A SEED WITHOUT A TEARDOWN IS A PERMANENT TEST CLAN** in whatever
-- database it was pointed at — the residue that stopped SCRUM-122's empty state
-- being tested for a fortnight.
--
-- ── SCOPE, AND NOTHING OUTSIDE IT ───────────────────────────────────────────
-- Four markers, all put there by `demo_seed.sql`:
--   · clans.code                LIKE 'DEMZ%'
--   · cohort_members.display_label LIKE 'DEMO ·%'
--   · cohorts.cohort_no         = 99
--   · auth.users.email          LIKE 'demo-%@example.invalid'
-- ⚠️ A real family's clan cannot match any of them, so a mistyped run refuses to
-- harm it. There is deliberately no name-based match: a real clan may be called
-- anything, including something with "demo" in it.
--
-- ── ORDER IS LOAD-BEARING ──────────────────────────────────────────────────
-- `clans.created_by → profiles` is **NO ACTION** (every other FK to profiles is
-- CASCADE). Deleting the identities first would FAIL on the clans they created,
-- so the clans go first and the identities last.
--
-- ⚠️ **Storage is the RUNNER's job**, not SQL: a capture is an OBJECT, not a row,
-- and emptying `storage.objects` leaves the file in the bucket. The runner sweeps
-- by PATH (`{"prefixes":[…]}` answers 200 and deletes nothing).
-- ⚠️ The seed guard (SCRUM-199) is called by the runner for BOTH scripts, so
-- there is one target check and it cannot drift between them.
--
-- ⚠️ IDEMPOTENT: every statement is a no-op when nothing matches, and a second
-- run says so.
-- ═══════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

do $demo_teardown$
declare
  v_members integer := 0;
  v_cohorts integer := 0;
  v_weeks   integer := 0;
  v_clans   integer := 0;
  v_flags   integer := 0;
  v_users   integer := 0;
  v_before_clans integer;
  v_before_users integer;
begin
  -- quoted in the comment, so the numbers are evidence rather than memory
  select count(*) into v_before_clans from public.clans where code like 'DEMZ%';
  select count(*) into v_before_users from auth.users where email like 'demo-%@example.invalid';

  -- 1 · the cohort rows (they have NO profile FK, so deleting users would strand them)
  delete from public.cohort_members where display_label like 'DEMO ·%';
  get diagnostics v_members = row_count;

  -- 2 · the demo cohort, once it is empty
  delete from public.cohorts c
   where c.cohort_no = 99
     and not exists (select 1 from public.cohort_members m where m.cohort_id = c.id);
  get diagnostics v_cohorts = row_count;

  -- 3 · a demo week left with NO cohorts. ⚠️ A real week has cohorts, so it is
  -- never matched; an empty one is residue from this seed.
  delete from public.league_weeks w
   where w.start_date = date_trunc('week', now())::date
     and not exists (select 1 from public.cohorts c where c.week_id = w.id);
  get diagnostics v_weeks = row_count;

  -- 4 · clans FIRST (created_by is NO ACTION) — cascades ancestors, burns,
  -- tributes and clan_members
  delete from public.clans where code like 'DEMZ%';
  get diagnostics v_clans = row_count;

  -- 5 · integrity_flags survive as NULL-owner rows (their FK is SET NULL), so
  -- they are removed explicitly while the identities still exist
  delete from public.integrity_flags
   where user_id in (select id from auth.users where email like 'demo-%@example.invalid');
  get diagnostics v_flags = row_count;

  -- 6 · identities LAST — inventory, ledger, quotas, streaks, devices, captures
  -- and consent_records all cascade from `profiles`
  delete from auth.users where email like 'demo-%@example.invalid';
  get diagnostics v_users = row_count;

  if v_before_clans = 0 and v_before_users = 0 and v_members = 0 and v_flags = 0 then
    raise notice 'teardown: nothing to remove — no demo clan, cohort row or identity is present';
  else
    raise notice 'teardown: removed % clan(s) · % cohort member(s) · % cohort(s) · % week(s) · % flag(s) · % identity(ies)',
      v_clans, v_members, v_cohorts, v_weeks, v_flags, v_users;
  end if;
end
$demo_teardown$;
