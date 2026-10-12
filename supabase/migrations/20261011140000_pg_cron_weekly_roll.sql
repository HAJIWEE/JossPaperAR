-- ═══════════════════════════════════════════════════════════════════════════
-- pg_cron: THE WEEKLY ROLL, SCHEDULED (SCRUM-11 · doc 19 §4.3)
--
-- doc 19 §4.3 has said since the build plan was written: *"pg_cron available
-- (1.6.4) → weekly-roll has its scheduler (doc 07 §4.4). Enable it in a
-- migration."* ⚠️ It was deliberately NOT enabled until now, because a scheduler
-- with no job is noise — the roll engine did not exist (20261011130000).
--
-- ⚠️ THE ROLL IS INVOKED AS A FUNCTION, NOT OVER HTTP. pg_cron could POST to the
-- `weekly-roll` Edge Function instead, but that would put the project's SECRET
-- KEY in the job's command text — secret material sitting in a table, for the
-- privilege of adding a network hop that can fail. The function IS the code path
-- the Edge Function calls, so the cron and the manual path cannot diverge.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;

-- ⚠️ SCHEDULE: Monday 00:00 UTC — the moment the ISO week turns over, which is
-- the boundary `weekStart()` in weekly-roll and `date_trunc('week', …)` in
-- roll_league_week() already share. pg_cron runs in UTC, so no zone conversion
-- and no DST shift is involved.
--
-- ⚠️ The job is NAMED `weekly-roll`, so re-running this migration UPDATES it
-- rather than creating a second one (pg_cron upserts by name). That is what
-- makes this file safely re-appliable.
--
-- At Monday 00:00 the ACTIVE week is the one that just ended — the next week is
-- opened BY the roll — so the default (no explicit week) is the correct call.
select cron.schedule(
  'weekly-roll',
  '0 0 * * 1',
  $$select public.roll_league_week()$$
);

comment on extension pg_cron is
  'The league roll (SCRUM-11). Enabled here rather than as soon as the extension '
  'was available, because the build plan''s "enable it in a migration" is '
  'honestly read as "when there is a job to schedule".';
