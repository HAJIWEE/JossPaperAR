/**
 * held-invite.ts — the DEVICE half of the deferred invite (SCRUM-50 · doc 07 §4.6).
 *
 * The DECISION lives in the pure `invite-flow.ts` (`shouldHoldInvite`,
 * `makeHeldInvite`, `parseHeldInvite`); this file only parks and clears the one
 * record. Same split as `first-run.ts` (pure `tutorial.ts`) and `session.ts`
 * (pure `session-map.ts`).
 *
 * ⚠️ WHY AsyncStorage AND NOT SecureStore: this is an 8-character capability and
 * a reason code, not a JWT — and the invite code is not a secret we can lose the
 * device over. `first-run.ts` uses AsyncStorage for the same reason.
 *
 * ⚠️ A failure to WRITE is swallowed, a failure to READ reads as "nothing held".
 * Both are recoverable by the user (they can re-open their link); the opposite
 * choices would paint a screen with a code that is not there.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  HELD_INVITE_KEY,
  type HeldInvite,
  type HoldReason,
  makeHeldInvite,
  parseHeldInvite,
} from './invite-flow.ts';

/** Park an invite so the fork can offer it once the device is ready. */
export async function holdInvite(code: string, reason: HoldReason): Promise<void> {
  const held = makeHeldInvite(code, reason, Date.now());
  if (!held) return; // not a real code — nothing worth parking
  try {
    await AsyncStorage.setItem(HELD_INVITE_KEY, JSON.stringify(held));
  } catch {
    // The invite is still in the user's chat; losing the hold is survivable.
  }
}

/**
 * Read the parked invite, or `null`.
 *
 * ⚠️ Age is applied HERE, at read time, not at write time — a record parked on
 * Friday must not be honoured a fortnight later just because it was valid when
 * it was written.
 */
export async function readHeldInvite(): Promise<HeldInvite | null> {
  try {
    return parseHeldInvite(await AsyncStorage.getItem(HELD_INVITE_KEY), Date.now());
  } catch {
    return null;
  }
}

/**
 * Clear the hold. Called once the invite has been APPLIED — either because the
 * join succeeded, or because the code turned out to be dead (a re-rolled code is
 * not a reason to keep offering it on every launch).
 */
export async function clearHeldInvite(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HELD_INVITE_KEY);
  } catch {
    // A stale hold ages out on its own (`HELD_INVITE_MAX_AGE_MS`).
  }
}
