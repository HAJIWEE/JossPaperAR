/**
 * user-name.ts — the PURE rules for the user's own name (SCRUM-214(A) option B).
 *
 * ⚠️⚠️ **THIS FILE EXISTS BECAUSE THE SPLIT IS LOAD-BEARING, NOT CEREMONY.** The first version of this feature
 * put the rules and the Supabase calls in ONE file — and `check:lib` **crashed instantly**:
 * `ERR_MODULE_NOT_FOUND: react-native-url-polyfill/auto`, because the check runs under plain **Node** and the
 * device half imports `supabase.ts`. ⚠️ The project's pure-beside-device pattern (`session-map.ts` beside
 * `session.ts`) is what lets a rule be asserted with no device, no key and no native module — and the gate
 * suite enforces it by failing.
 *
 * ⚠️ No React, no storage, no network.
 */

/**
 * ⚠️ **24, and the database says 24 too** (`profiles.chosen_name` CHECK). Two sources agreeing on a limit is
 * deliberate: the client stops a too-long name before a round trip, and the server refuses one that gets past it.
 */
export const CHOSEN_NAME_MAX = 24;

/** ⚠️ A problem is a KEY, never a sentence — the screen renders `t()`, the rule stays data. */
export const CHOSEN_NAME_PROBLEMS = ['empty', 'too_long'] as const;
export type ChosenNameProblem = (typeof CHOSEN_NAME_PROBLEMS)[number];

/**
 * ⚠️ Trimmed before measuring, because a name is what is LEFT after trimming — four spaces is not a name, and
 * `"  Gwee  "` must not fail the length rule because of its padding.
 */
export function chosenNameProblem(raw: string): ChosenNameProblem | null {
  const v = raw.trim();
  if (v.length === 0) return 'empty';
  if (v.length > CHOSEN_NAME_MAX) return 'too_long';
  return null;
}

/** The stored form. ⚠️ One place trims, so the write and the check cannot disagree. */
export function normaliseChosenName(raw: string): string {
  return raw.trim();
}
