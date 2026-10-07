/**
 * session.ts — the DEVICE half of the identity bootstrap (SCRUM-80 / ADR-004).
 *
 * `ensureAnonymousSession()` is the ONE place the app creates a session. It is
 * idempotent and **single-flight**: the root layout calls it on mount AND the
 * preparing screen calls it before its first authenticated step, and those two
 * must not race into two anonymous users.
 *
 * The DECISION (reuse / sign in / unconfigured) lives in `session-map.ts` so it
 * can be asserted without a device; this file only reads state and calls the
 * client — the same split as `ritual-map.ts` (pure) and `ritual.ts` (device).
 */

import { planSession, reasonFromAuthError } from './session-map.ts';
import { isConfigured, supabase } from './supabase.ts';

export type SessionResult =
  | { readonly ok: true; readonly userId: string }
  | { readonly ok: false; readonly reason: string };

let inFlight: Promise<SessionResult> | null = null;

/**
 * Ensure the device has an anonymous session (ADR-004). Safe to call from
 * anywhere, any number of times.
 *
 * ⚠️ Single-flight: concurrent callers share one attempt, and the slot is cleared
 * when it settles so a FAILED attempt can be retried — the preparing screen's
 * "Check again" depends on that.
 */
export function ensureAnonymousSession(): Promise<SessionResult> {
  inFlight ??= resolveSession().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function resolveSession(): Promise<SessionResult> {
  // Never call the client unconfigured — `supabase()` throws without a URL/key.
  if (!isConfigured()) return { ok: false, reason: 'not_configured' };

  let hasSession = false;
  let userId: string | null = null;
  try {
    const { data } = await supabase().auth.getSession();
    hasSession = Boolean(data.session);
    userId = data.session?.user?.id ?? null;
  } catch {
    return { ok: false, reason: 'session_read_failed' };
  }

  const plan = planSession({ configured: true, hasSession, userId });
  if (plan.action === 'reuse') return { ok: true, userId: plan.userId };

  // `skip` is unreachable here (we already checked `isConfigured`), so this is the
  // sign-in road. `signInAnonymously` issues a real `auth.users` row with
  // `is_anonymous: true`; migration 0006 adds its `profiles` row via trigger.
  try {
    const { data, error } = await supabase().auth.signInAnonymously();
    if (error || !data?.user?.id) return { ok: false, reason: reasonFromAuthError(error) };
    return { ok: true, userId: data.user.id };
  } catch (err) {
    return { ok: false, reason: reasonFromAuthError(err) };
  }
}
