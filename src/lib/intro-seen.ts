/**
 * intro-seen.ts — the DEVICE half of "shown exactly once" (SCRUM-171)
 *
 * ⚠️ **THE DECISION IS IN `intro.ts`; THIS FILE ONLY WRITES ONE FLAG** — the same split as
 * `tutorial.ts` (pure) and `first-run.ts` (device), and for the same reason: a `.ts` that imports
 * `AsyncStorage` cannot be exercised by `check:lib` under plain Node.
 *
 * ⚠️ AsyncStorage, not SecureStore: the cap there is ~2 KB for a JWT, and this is one boolean.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const INTRO_SEEN_KEY = 'joss.introSeen';

/**
 * Has this device already been shown the three panels?
 *
 * ⚠️ **A FAILURE MEANS "NOT SEEN", and the asymmetry is the reason.** Replaying three panels costs
 * three taps and is recoverable. Skipping them means a first-run user arrives at the clan fork with
 * no idea what the app is, why it asks for a camera, or what a burn does — and never gets that back.
 * ⚠️ Same direction `readFirstRun()` chooses, for the same reason.
 */
export async function readIntroSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(INTRO_SEEN_KEY)) === 'true';
  } catch {
    return false;
  }
}

/** Record that the panels were shown. Best-effort: never block the flow. */
export async function markIntroSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(INTRO_SEEN_KEY, 'true');
  } catch {
    // Leaving it unset replays the panels next launch — the survivable direction.
  }
}

/**
 * Forget the record — **"back to first run"** (SCRUM-151 / SCRUM-219).
 *
 * ⚠️ Called by the one-tap delete, exactly as `clearFirstRun()` and `clearOnboarded()` are. A
 * device that has seen the intro is not at first run, and the delete's acceptance is that it
 * *lands* back there.
 */
export async function clearIntroSeen(): Promise<void> {
  try {
    await AsyncStorage.removeItem(INTRO_SEEN_KEY);
  } catch {
    // The record survives; the user keeps the panels they already saw.
  }
}
