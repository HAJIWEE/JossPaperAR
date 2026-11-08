/**
 * account.ts — the DEVICE half of the account screens (SCRUM-215 · ADR-004).
 *
 * ── ⚠️ THE ONE THING THIS FILE MUST GET RIGHT ───────────────────────────────
 * ADR-004 rule 4: an anonymous device that adds an email must **KEEP its `auth.users` id**, so its
 * tribute wallet, streak, ancestors and league standing come with it. ⚠️ **That is why the sign-up road
 * calls `updateUser({ email })` and NOT `signInWithOtp`** — the difference between those two is the
 * difference between an UPGRADE and a SECOND USER, and ⚠️ **a second user is a failure of the ticket,
 * not a shortcut.** The distinction lives in `account-flow.ts` as data (`ACCOUNT_MODES[mode].keepsUserId`)
 * and this file only makes the calls that table names.
 *
 * ⚠️ The DECISION (which method, which verify type) is in `account-flow.ts` so `check:lib` can hold it
 * without a device — the same split as `session-map.ts` (pure) and `session.ts` (device).
 *
 * ⚠️ **NOT `account-api.ts`.** That file holds the account's SERVER RPCs (`delete_my_data`,
 * `my_offerings`, `my_collection`) — the data. THIS file holds the AUTH calls that create the identity
 * that data belongs to.
 */

import { ACCOUNT_MODES, type AccountMode } from './account-flow.ts';
import { reasonFromAuthError } from './session-map.ts';
import { ensureAnonymousSession } from './session.ts';
import { isConfigured, supabase } from './supabase.ts';

export type AccountResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/**
 * Send the six-digit code for `email`, on the flow `mode` names.
 *
 * ⚠️ **The two roads are DIFFERENT Supabase calls, and the whole ticket turns on that:**
 *   · `signUp` → **`updateUser({ email })`** — ATTACHES the email to the ANONYMOUS user already in this
 *     session, so `profiles.user_id` (and the ledger, ancestors and streak) do **not** move. ⚠️ It FAILS
 *     when the email already belongs to an existing user — see `EMAIL_TAKEN_MEANS_SIGN_IN` in
 *     `account-flow.ts`: the screen turns that into *"sign in instead"* and does **NOT** reassign the
 *     anonymous rows (that reassignment is the second user ADR-004 forbids).
 *   · `signIn` → **`signInWithOtp({ email })`** — a code to a RETURNING user's address.
 *
 * ⚠️ A failure is returned AS a reason, never swallowed: *"we could not send it"* and *"we sent it"*
 * must not render the same — the rule every read in this project follows.
 */
export async function sendAccountCode(mode: AccountMode, email: string): Promise<AccountResult> {
  if (!isConfigured()) return { ok: false, reason: 'not_configured' };
  try {
    const auth = supabase().auth;
    const { error } =
      mode === 'signUp' ? await auth.updateUser({ email }) : await auth.signInWithOtp({ email });
    if (error) return { ok: false, reason: reasonFromAuthError(error) };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'transport' };
  }
}

/**
 * Confirm the code; on success the session is the user's.
 *
 * ⚠️ **The `type` comes from the TABLE, never chosen here** — `email_change` for the in-place upgrade,
 * `email` for the sign-in. ⚠️ Getting it wrong is not a small mistake: `email_change` is what confirms an
 * ATTACHED email, so `email` on the sign-up road would leave the upgrade unconfirmed (the user would
 * "sign in" and not be upgraded).
 */
export async function confirmAccountCode(
  mode: AccountMode,
  email: string,
  token: string,
): Promise<AccountResult> {
  if (!isConfigured()) return { ok: false, reason: 'not_configured' };
  try {
    const { data, error } = await supabase().auth.verifyOtp({
      email,
      token,
      type: ACCOUNT_MODES[mode].verifyType,
    });
    if (error || !data?.user?.id) return { ok: false, reason: reasonFromAuthError(error) };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'transport' };
  }
}

/**
 * ⚠️ **SIGN OUT — leave the ACCOUNT, not the app.**
 *
 * ⚠️ **A BARE `signOut()` WOULD LEAVE THE DEVICE DEAD, and that is the whole reason this is two steps.**
 * ADR-004 gives every install an anonymous session, and `ensureAnonymousSession()` only calls
 * `signInAnonymously` when there is **no** session at all (`planSession` → `sign_in`). So:
 *   1. `auth.signOut()` — drop the account's session, and (`scope: 'global'`) revoke its refresh tokens;
 *   2. `ensureAnonymousSession()` — mint the fresh ANONYMOUS identity the rest of the app assumes.
 * ⚠️ **Skipping (2)** leaves the next authenticated read with `42501` while the user looks at an empty
 * shrine — the same defect `account-api.ts` records for the delete path, one step further on.
 *
 * ⚠️ **SIGNING OUT ERASES NOTHING — unlike `resetIdentity()`.** That one is delete-then-fresh-identity,
 * *"back to first run"*, and it is the only caller of `clearFirstRun()`. This one leaves the account's
 * tributes, ancestors and streak **on the server**: signing back in with the email returns them. ⚠️ So the
 * SCREEN must not clear the tutorial record either — nothing about this device's first run changed, and
 * replaying the walkthrough on a sign-out would be a lie about what happened.
 *
 * ⚠️ **A FAILURE IS REPORTED, never swallowed.** *"You are still signed in"* and *"you are signed out"*
 * must not render the same — the rule `sendAccountCode` above states.
 *
 * ⚠️ **`scope: 'global'` IS EXPLICIT ON PURPOSE.** The SDK's default is global, but this account's posture
 * (ADR-007) prefers revoking the refresh tokens over leaving one alive on a device someone may have picked
 * up. ⚠️ If a multi-device story ever lands, revisit it: `'local'` signs out only this device, and global
 * would kick the user off their other one.
 */
export async function signOutAccount(): Promise<AccountResult> {
  if (!isConfigured()) return { ok: false, reason: 'not_configured' };

  try {
    const { error } = await supabase().auth.signOut({ scope: 'global' });
    if (error) return { ok: false, reason: reasonFromAuthError(error) };
  } catch {
    return { ok: false, reason: 'transport' };
  }

  /**
   * ⚠️ Step 2 is NOT cleanup — it is the operation. The sign-out above leaves the device with no session,
   * and this app has no anonymous-less state it can render.
   */
  const next = await ensureAnonymousSession();
  return next.ok ? { ok: true } : { ok: false, reason: next.reason };
}

/**
 * ⚠️ **Is this device currently ANONYMOUS?** The sign-up road only makes sense for one — an upgrade needs
 * something to upgrade. ⚠️ It answers `false` when the state cannot be read, so a failure never routes a
 * real account holder down the upgrade road by accident.
 */
export async function isAnonymousSession(): Promise<boolean> {
  if (!isConfigured()) return false;
  try {
    const { data } = await supabase().auth.getSession();
    return data.session?.user?.is_anonymous === true;
  } catch {
    return false;
  }
}
