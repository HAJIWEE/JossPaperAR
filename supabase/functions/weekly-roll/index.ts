/**
 * ═══ weekly-roll — a THIN CALLER of public.roll_league_week() (SCRUM-11) ════
 *
 * This was an honest stub from 2026-10-04 until the roll engine landed
 * (migration 20261011130000). It now does what its own comment said it would —
 * but by calling ONE function, not by doing the ranking here.
 *
 * ⚠️ WHY THE WORK IS NOT IN THIS FILE. A roll ranks, promotes, demotes, audits
 * AND opens the next week, and it must be ATOMIC: a crash halfway through leaves
 * a half-rolled week that no second tick can repair. This handler has no
 * transaction spanning the calls it would need, so one Postgres function is the
 * correct home. `pg_cron` calls that function directly on Monday 00:00 UTC;
 * this endpoint exists for a MANUAL or TARGETED run — what an operator needs
 * when the cron did not fire, or to rehearse a specific week.
 *
 * ⚠️ THE GATE IS STILL THE SECRET KEY. `verify_jwt` is OFF for this function
 * (config.toml) precisely so the check below IS the gate: a modern `sb_secret_…`
 * key is not a JWT, so the gateway could not have validated it anyway.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { secretKey, supabaseUrl } from '../_shared/env.ts';
import { bearerToken, fail, json, preflight } from '../_shared/http.ts';

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') return fail('method_not_allowed', 405);

  // ── 1 · the gate: the secret key, or nothing ─────────────────────────────
  const presented = bearerToken(request);
  if (!presented || presented !== secretKey()) {
    return fail('forbidden', 403);
  }

  // ── 2 · an optional explicit week ────────────────────────────────────────
  // Omitting it rolls the ACTIVE week, which is exactly what the cron does. An
  // explicit `YYYY-MM-DD` rehearses or repairs one specific week.
  // A bodyless POST is the normal case, so a parse failure is not an error.
  let weekStart: string | null = null;
  try {
    const body = await request.json();
    if (body && typeof body.week_start === 'string') weekStart = body.week_start;
  } catch (_e) {
    // no body — the cron's shape
  }

  // ── 3 · the roll, in ONE transaction, in the database ────────────────────
  // The secret key is the service role, which is the ONLY role with EXECUTE on
  // roll_league_week — the same shape as submit_burn.
  const admin = createClient(supabaseUrl(), secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc('roll_league_week', {
    p_week_start: weekStart,
  });

  if (error) return fail('roll_failed', 500, error.message);

  // The receipt is the function's own — `rolled`, the counts, the promoted and
  // demoted labels, and `already_closed` when a second tick arrived.
  return json(data ?? { rolled: false, status: 'no_data' });
});
