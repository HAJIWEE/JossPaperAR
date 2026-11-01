/**
 * first-run.ts — the DEVICE half of the tutorial's first-run record (SCRUM-85).
 *
 * The DECISION lives in the pure `tutorial.ts` (`needsTutorial`); this file only
 * reads and writes the one flag.
 *
 * ⚠️ WHY AsyncStorage AND NOT `split-storage`: that split exists because
 * SecureStore caps a value at ~2 KB and the session is a JWT. This is one
 * boolean — the split would be ceremony. `supabase.ts` already uses AsyncStorage
 * directly for the same reason.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { FIRST_RUN_KEY, type FirstRunState } from './tutorial.ts';

/**
 * Read the first-run record.
 *
 * ⚠️ A FAILURE MEANS "NOT DONE", deliberately. An unreadable store replays the
 * tutorial rather than skipping it: replaying costs a few taps and is
 * recoverable, whereas skipping means a user who never saw the ritual explained
 * — and whose first burn would run with no clan. When the two failure modes are
 * this asymmetric, default to the survivable one.
 */
export async function readFirstRun(): Promise<FirstRunState> {
  try {
    return { tutorialDone: (await AsyncStorage.getItem(FIRST_RUN_KEY)) === 'true' };
  } catch {
    return { tutorialDone: false };
  }
}

/** Record that the tutorial has been seen. Best-effort: never block the ritual. */
export async function markTutorialDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(FIRST_RUN_KEY, 'true');
  } catch {
    // Leaving it unset replays the tutorial next launch — the safe direction.
  }
}

/**
 * Forget the tutorial record — **"back to first run"** (SCRUM-151).
 *
 * ⚠️ Called by the one-tap delete, and only there. The delete's acceptance is *"lands back at first
 * run"*, and a device that has already seen the tutorial is not at first run: the first burn would
 * skip the walkthrough while the user is looking at an empty shrine with no clan. ⚠️ A failed clear
 * leaves the record set, which skips the tutorial — the same survivable direction `readFirstRun`
 * chooses when a READ fails.
 */
export async function clearFirstRun(): Promise<void> {
  try {
    await AsyncStorage.removeItem(FIRST_RUN_KEY);
  } catch {
    // The record survives; the user keeps the tutorial they already saw.
  }
}
