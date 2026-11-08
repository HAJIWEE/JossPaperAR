/**
 * onboarded.ts — the DEVICE half of **"this device has an identity of its own"** (ADR-004 · Amendment 2).
 *
 * ── ⚠️ WHY THIS FILE EXISTS, AND WHY IT IS NOT `first-run.ts` ────────────────
 * Amendment 2 needs one fact: **is this device still allowed an anonymous session?** The first attempt
 * reused `needsTutorial()` (the demo flag) on the reasoning that a device owed its demo had never been
 * through onboarding. ⚠️⚠️ **THE DEVICE FALSIFIED THAT ON GLASS, 2026-11-08.** The flag is written by exactly
 * one screen — the demo branch of `reward.tsx` — so a user whose first burn was a **REAL** one never gets it.
 * Their device reads *"demo owed"*, the bootstrap minted an anonymous session, and a signed-out user came
 * back to a shrine. It looked right in the gate suite and was wrong on the phone.
 *
 * ⚠️ **So the fact is recorded directly, when it becomes true:** this device has **linked an account**
 * (`confirmAccountCode`) or has **signed out of one** (`signOutAccount`). Both mean *"past onboarding"* —
 * and from then on, a missing session means **SIGNED OUT**, not *"new"*.
 *
 * ⚠️ **And it is CLEARED in exactly one place:** the delete, which is *"back to first run"*. That is what
 * makes the demo reachable again — and it is why `runDelete` must clear this **before** `resetIdentity()`
 * re-mints.
 *
 * ⚠️ Same storage shape as `first-run.ts` — one boolean in AsyncStorage, best-effort, never throwing.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/** The one key this module owns. */
export const ONBOARDED_KEY = 'josspaper.account.onboarded';

/**
 * ⚠️ **A missing or unreadable record means NOT onboarded**, i.e. the demo stays reachable.
 *
 * ⚠️ That is the survivable direction, and it is a deliberate choice: if the store cannot be read, a fresh
 * install must still get its first run (ADR-004 rule 1 — nothing gates the first burn). The cost of being
 * wrong is a device that had signed out receiving an anonymous shrine again — **the pre-amendment
 * behaviour**, not a crash and not a locked-out user.
 */
export async function readOnboarded(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDED_KEY)) === 'true';
  } catch {
    return false;
  }
}

/**
 * Record that this device now has an identity of its own (an account was linked, or one was signed out of).
 * ⚠️ Best-effort: a failed write leaves the device able to mint anonymously again, which is the same
 * survivable direction `readOnboarded` takes on a failed read.
 */
export async function markOnboarded(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDED_KEY, 'true');
  } catch {
    // Leaving it unset keeps the demo reachable. Recoverable; logged nowhere by design.
  }
}

/**
 * Forget it — **only** the one-tap delete calls this, because only the delete is *"back to first run"*.
 * ⚠️ A failed clear leaves the record set, so the device stays past onboarding and keeps requiring a
 * sign-in. That is the safe direction: it demands a sign-in rather than handing out a fresh identity.
 */
export async function clearOnboarded(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ONBOARDED_KEY);
  } catch {
    // The record survives; the device keeps requiring a sign-in.
  }
}
