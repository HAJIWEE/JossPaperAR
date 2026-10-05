/**
 * ═══ weekly-roll — AN HONEST STUB (doc 19 §3.1 F3, SCRUM-11) ════════════════
 *
 * The brief allows a stub here, and a stub is what the schema supports: the
 * league tables (`league_weeks` · `cohorts` · `cohort_members` · `weekly_rolls`)
 * are deliberately NOT in the slice schema — they arrive with **SCRUM-11**,
 * which has no spec yet.
 *
 * So this function does the three things that are genuinely true today:
 *
 *   1. GATES ITSELF. It is invocable ONLY by a caller holding the project's
 *      secret key, because a cron must not be a public endpoint. `verify_jwt`
 *      is OFF for this function (config.toml) precisely so the check below is
 *      the gate: modern `sb_secret_…` keys are not JWTs, so the gateway could
 *      not have validated them anyway.
 *   2. COMPUTES THE WEEK, so the cron wiring is already exercised.
 *   3. REPORTS PLAINLY what it did NOT do, rather than pretending to rank.
 *
 * ── WHAT IT MUST DO WHEN SCRUM-11 LANDS (kept here so it is not re-derived) ─
 *   · close the week → rank each cohort by SUM(weekly tribute) from the LEDGER
 *     (never a stored mutable score — doc 07 §4.4)
 *   · top 3 promote / bottom 3 demote (Duolingo-style, doc 07 §4.4)
 *   · write the `weekly_rolls` audit row; open the next `league_weeks`
 *   · apply the impossible-score sanity line: > 346,500 weekly (7 × 49,500)
 *     is impossible by construction, so it means a code path broke and must be
 *     flagged, not paid (doc 11 §4 / §6.1)
 *   · tombstone deleted members (`cohort_members.user_id → NULL`) per ADR-007 §8
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { secretKey, supabaseUrl } from '../_shared/env.ts';
import { bearerToken, fail, json, preflight } from '../_shared/http.ts';

/** doc 11 §4 — 7 × 49,500; the impossible-score line for the league. */
const MAX_WEEKLY_TRIBUTE = 346_500;

/** Monday 00:00 UTC of the week containing `at` (the ISO week the league uses). */
function weekStart(at: Date): Date {
  const day = at.getUTCDay();              // 0 = Sunday
  const offset = day === 0 ? 6 : day - 1;  // days since Monday
  const start = new Date(at);
  start.setUTCDate(at.getUTCDate() - offset);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') return fail('method_not_allowed', 405);

  // ── 1 · the gate: the secret key, or nothing ─────────────────────────────
  const presented = bearerToken(request);
  if (!presented || presented !== secretKey()) {
    return fail('forbidden', 403);
  }

  // ── 2 · the week ─────────────────────────────────────────────────────────
  const now = new Date();
  const start = weekStart(now);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  // A live client is created (not used yet) so that when SCRUM-11 lands the
  // ranking query has somewhere to go — and so this file proves the injected
  // secret key reaches the function.
  const admin = createClient(supabaseUrl(), secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: probeError } = await admin.from('ledger_events').select('id').limit(1);
  if (probeError) return fail('db_unreachable', 503, probeError.message);

  // ── 3 · the honest report ────────────────────────────────────────────────
  return json({
    week_start: start.toISOString().slice(0, 10),
    week_end: end.toISOString().slice(0, 10),
    status: 'stub',
    wrote_weekly_rolls: false,
    ranked_cohorts: 0,
    note:
      'league cohorts are not in the slice schema — SCRUM-11 owns promotion, '
      + 'demotion, the weekly_rolls audit row and the 346,500 sanity line',
    impossible_score_line: MAX_WEEKLY_TRIBUTE,
  });
});
