/**
 * home-api.ts — the shrine's data read (SCRUM-161).
 *
 * ⚠️ `home_summary()` exists because `tributes` and `streaks` are **server-written with no
 * client policy** (the RLS header calls that the correct posture for server-written
 * tables). The function is SECURITY DEFINER and returns the caller's own aggregate only.
 *
 * ⚠️ Follows `clan-api.ts`'s contract exactly: **every call resolves** — a thrown error on
 * the shrine is a dead end — and a failure carries a reason rather than a zero.
 */

import { type ApiResult } from './clan-api.ts';
import { type HomeSummary } from './home-panels.ts';
import { supabase } from './supabase.ts';

export async function fetchHomeSummary(): Promise<ApiResult<HomeSummary>> {
  try {
    const { data, error } = await supabase().rpc('home_summary');
    if (error) return { ok: false, reason: error.message ?? 'home_summary_failed' };

    // `returns table(...)` arrives as an array; tolerate a single object too.
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null | undefined;
    if (!row) return { ok: false, reason: 'home_summary_empty' };

    const tribute = Number(row.tribute_total);
    const streakDays = Number(row.streak_days);
    if (!Number.isFinite(tribute) || !Number.isFinite(streakDays)) {
      return { ok: false, reason: 'home_summary_bad_payload' };
    }
    return { ok: true, data: { tribute, streakDays } };
  } catch {
    return { ok: false, reason: 'network_error' };
  }
}
