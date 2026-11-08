/**
 * session.ts — the DEVICE half of the identity bootstrap (SCRUM-80 / ADR-004 · **its Amendment 2**).
 *
 * `ensureAnonymousSession()` is the ONE place the app creates a session. It is
 * idempotent and **single-flight**: the root layout calls it on mount AND the
 * preparing screen calls it before its first authenticated step, and those two
 * must not race into two anonymous users.
 *
 * ── ⚠️ AMENDMENT 2 (2026-11-08): IT NO LONGER ALWAYS MINTS ───────────────────
 * The owner's ruling: *"the Demo should only be on first install of the App, and signing out does not
 * return us to anon status but require a sign in every time."* ⚠️ So an **anonymous session is a
 * first-install artifact**, minted only while this device is **not past onboarding** (`readOnboarded()` — no
 * account has been linked, and none has been signed out of). Past that point a missing session means
 * **SIGNED OUT**, and this returns
 * `sign_in_required` — ⚠️ **it does NOT mint.** ⚠️ Before the amendment a session-less device always got an
 * anonymous session, so a sign-out silently produced a brand-new anonymous shrine and the account was
 * never actually left.
 *
 * ⚠️⚠️ **AND THE FIRST DESIGN OF THIS DOCBLOCK SAID `needsTutorial()`. THE DEVICE DISPROVED IT (2026-11-08):**
 * the demo flag is written by the demo's own reward screen, so a user whose first burn was a REAL one never
 * gets it — their device read "demo owed" forever, minted, and a signed-out user came back to a shrine.
 * ⚠️ **The gate suite was green.** `onboarded.ts` records the fact that actually matters.
 *
 * ⚠️ **Why this lives HERE and not in the callers:** four places ask for a session (the root layout, the
 * preparing screen, the invite entry, the old sign-out). Putting the rule in one function is what stops
 * one of them quietly minting an identity the product no longer allows.
 *
 * The DECISION (reuse / mint / require sign-in / unconfigured) lives in `session-map.ts` so it
 * can be asserted without a device; this file only reads state and calls the
 * client — the same split as `ritual-map.ts` (pure) and `ritual.ts` (device).
 */

import { readOnboarded } from './onboarded.ts';
import { planBootstrap, reasonFromAuthError } from './session-map.ts';
import { isConfigured, supabase } from './supabase.ts';

export type SessionResult =
  | { readonly ok: true; readonly userId: string }
  | { readonly ok: false; readonly reason: string };

/**
 * ⚠️ **The reason the gate keys on, and the only one that may send a user to `/account`.** A network
 * failure is NOT a sign-out — treating one as the other would bounce a signed-in user to a sign-in wall
 * every time the wifi blipped.
 */
export const SIGN_IN_REQUIRED = 'sign_in_required';

let inFlight: Promise<SessionResult> | null = null;

/**
 * Ensure the device has a session it is ALLOWED to have (ADR-004 · Amendment 2).
 * Safe to call from anywhere, any number of times.
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

  /**
   * ⚠️ **`onboarded` REPLACED `needsTutorial()` HERE, AND THE DEVICE IS WHY** (2026-11-08): the demo flag is
   * written by the demo's reward screen only, so a user whose first burn was real reads "demo owed" forever —
   * the bootstrap minted for them, and a signed-out device came back to a shrine. ⚠️ See `onboarded.ts`.
   */
  const onboarded = await readOnboarded();
  const plan = planBootstrap({ configured: true, hasSession, userId, onboarded });

  if (plan.action === 'reuse') return { ok: true, userId: plan.userId };
  if (plan.action === 'require_sign_in') return { ok: false, reason: SIGN_IN_REQUIRED };
  if (plan.action === 'skip') return { ok: false, reason: plan.reason };

  // `mint_anonymous`: the demo's identity. `signInAnonymously` issues a real `auth.users` row with
  // `is_anonymous: true`; migration 0006 adds its `profiles` row via trigger.
  try {
    const { data, error } = await supabase().auth.signInAnonymously();
    if (error || !data?.user?.id) return { ok: false, reason: reasonFromAuthError(error) };
    return { ok: true, userId: data.user.id };
  } catch (err) {
    return { ok: false, reason: reasonFromAuthError(err) };
  }
}
