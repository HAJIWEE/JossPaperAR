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

import { ACCOUNT_MODES, NO_ANONYMOUS_SESSION, type AccountMode } from './account-flow.ts';
import { markOnboarded } from './onboarded.ts';
import { reasonFromAuthError } from './session-map.ts';
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

  /**
   * ⚠️ **THE UPGRADE ROAD NEEDS A SESSION TO UPGRADE** (ADR-004 · Amendment 2). After a sign-out the device
   * holds **no** session, so `updateUser` would fail with the provider's *"not authenticated"* — a reason
   * about nothing the user can act on. ⚠️ It is refused here, by name, so the screen can turn it into
   * **sign in** (`meansSignInInstead`) instead of printing it.
   */
  if (mode === 'signUp' && !(await isAnonymousSession())) {
    return { ok: false, reason: NO_ANONYMOUS_SESSION };
  }

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
    /**
     * ⚠️ **THIS DEVICE NOW HAS AN IDENTITY OF ITS OWN** (ADR-004 · Amendment 2). From here on a missing
     * session means SIGNED OUT, and the bootstrap stops minting anonymous. ⚠️ Recorded only AFTER the server
     * confirmed — a failed code must not close the demo window.
     */
    await markOnboarded();
    return { ok: true };
  } catch {
    return { ok: false, reason: 'transport' };
  }
}

/**
 * ⚠️ **SIGN OUT — leave the ACCOUNT. The device is then SIGNED OUT, and this does NOT replace the
 * session with an anonymous one** (ADR-004 **Amendment 2**, 2026-11-08).
 *
 * ── ⚠️ WHAT CHANGED, AND WHY IT MATTERS ─────────────────────────────────────
 * The first version of this function ended by calling `ensureAnonymousSession()`, on the reading that a
 * session-less device was an unusable one. ⚠️ **That reading was the MVP's, not the product's:** it made a
 * sign-out quietly produce a *brand-new anonymous shrine*, so the account was never actually left and the
 * demo could be replayed at will. The owner's ruling:
 *
 * > *"the Demo should only be on first install of the App and signing out does not return us to anon
 * > status but require a sign in every time."*
 *
 * ⚠️ **So the two facts that used to be one are now two:** *"no session"* means **SIGNED OUT**, and the
 * app's answer to it is the **sign-in wall** (`src/app/_layout.tsx` routes to `/account`), not a new
 * anonymous identity. ⚠️ **And it is safe to leave the device session-less now** precisely because the
 * bootstrap no longer mints behind our back — see `session.ts` / `planBootstrap`.
 *
 * ⚠️ **SIGNING OUT ERASES NOTHING.** Unlike `resetIdentity()` (delete-then-fresh-identity, *"back to first
 * run"*, the only caller of `clearFirstRun()`), the account keeps its tributes, ancestors and streak **on
 * the server**: signing back in with the email returns them. ⚠️ And this must **not** clear the device
 * records — in fact it **writes** `onboarded`, which is what closes the anonymous window. Clearing either
 * one here would hand the user a fresh demo shrine, i.e. exactly the behaviour this amendment removes.
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
    /**
     * ⚠️ **A SIGN-OUT CLOSES THE ANONYMOUS WINDOW FOR GOOD** (ADR-004 · Amendment 2). Recorded here as well
     * as on sign-in, because an **anonymous** device can sign out too — and without this its next launch
     * would mint a replacement and hand the user a fresh demo shrine, which is the behaviour this whole
     * amendment removes.
     */
    await markOnboarded();
    return { ok: true };
  } catch {
    return { ok: false, reason: 'transport' };
  }
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
