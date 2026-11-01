/**
 * account-api.ts — the account-level RPCs (SCRUM-151).
 *
 * ── ⚠️ `delete_my_data` HAS EXISTED SINCE PR-2 AND NOTHING CALLED IT ─────────
 * Measured 2026-11-01: the RPC is `SECURITY DEFINER`, cascades every personal table, tombstones the
 * pseudonymous `integrity_flags` rows and **verifies zero rows before returning** — and `src/` had no
 * reference to it. ADR-007's one-tap delete, the promise the privacy posture rests on, was unbuilt.
 *
 * ── ⚠️ WHAT THE RPC DOES *NOT* DO: REMOVE THE AUTH USER ──────────────────────
 * Its own payload says so — *"the auth.users row is not removed by SQL — that needs the Admin API"*.
 * So after a successful delete the session still exists with **no `profiles` row**, and
 * `ensureAnonymousSession()` would REUSE it (it only signs in when there is no session at all).
 * ⚠️ That is why `resetIdentity()` signs out first: without it, "back to first run" would leave the
 * device holding a profile-less identity, and the next write would fail on a missing row.
 */

import type { ApiResult } from './clan-api.ts';
import { ensureAnonymousSession } from './session.ts';
import { supabase } from './supabase.ts';

/** What `delete_my_data` reports back. ⚠️ `verifiedZeroRows` is the SERVER's own check, not ours. */
export interface DeleteReceipt {
  /** ⚠️ The RPC counts every personal table AFTER the delete; `false` means it left something. */
  readonly verifiedZeroRows: boolean;
  readonly rowsLeftBehind: number;
}

/**
 * Erase everything this device's identity owns.
 *
 * ⚠️ The rate limit is the SERVER's (1 attempt / 10 min / user, doc 13 §9.1) and it raises `P0001`
 * with its own message. The caller surfaces the reason rather than inventing copy for it — a second
 * attempt inside ten minutes is a different fact from a failed delete.
 */
export async function deleteMyData(): Promise<ApiResult<DeleteReceipt>> {
  const { data, error } = await supabase().rpc('delete_my_data');
  if (error) return { ok: false, reason: reasonOf(error) };

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    data: {
      /** ⚠️ Absent reads as `false`: an unverifiable delete must not be reported as verified. */
      verifiedZeroRows: row.verified_zero_rows === true,
      rowsLeftBehind: typeof row.rows_left_behind === 'number' ? row.rows_left_behind : -1,
    },
  };
}

/**
 * Sign out and mint a FRESH anonymous identity — what "back to first run" means.
 *
 * ⚠️ The order is the point: `signOut` THEN `ensureAnonymousSession`. Reusing the old session would
 * leave the device on an identity whose `profiles` row the delete just removed.
 */
export async function resetIdentity(): Promise<ApiResult<null>> {
  try {
    await supabase().auth.signOut();
  } catch {
    // A failed sign-out is not fatal — `ensureAnonymousSession` reuses whatever session remains,
    // and the caller reports the delete's own outcome rather than this one.
  }
  const next = await ensureAnonymousSession();
  return next.ok ? { ok: true, data: null } : { ok: false, reason: next.reason };
}

/** The same shape `clan-api.ts` uses — a stable reason, never a thrown error. */
function reasonOf(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return 'request_failed';
}
