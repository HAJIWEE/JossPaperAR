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

/**
 * ⚠️ **THE NAME CAN BE CHANGED ONCE EVERY SEVEN DAYS** (owner, 2026-11-08 · SCRUM-223).
 *
 * ⚠️⚠️ The DATABASE is the authority — `enforce_name_change_limit` raises `name_change_too_soon` on a write
 * inside the window, and `profiles_update_own` cannot get around it because the trigger owns the timestamp.
 * ⚠️ **So this constant is the DISPLAY half only**: it decides whether the row reads as editable *before* the
 * user types a name and loses it to a refusal. If the two ever disagreed the database would win, and the screen
 * would have offered a control that then failed — which is the thing this project keeps deleting.
 */
export const NAME_CHANGE_INTERVAL_DAYS = 7;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const NAME_CHANGE_INTERVAL_MS = NAME_CHANGE_INTERVAL_DAYS * DAY_MS;

/** What the Profile screen needs to draw the name row. */
export interface NameCooldown {
  /** Whether a change would be accepted right now. */
  readonly allowed: boolean;
  /** Whole days still to wait — `0` when allowed. ⚠️ Rounded UP: "in 0 days" would read as allowed. */
  readonly daysRemaining: number;
  /** ⚠️ When the next change becomes possible, or `null` if it is possible now / never changed. */
  readonly nextChangeAtMs: number | null;
}

/**
 * ⚠️ **A MALFORMED TIMESTAMP FAILS OPEN, ON PURPOSE.** The alternative — treating an unparseable date as "locked"
 * — would strand a person permanently on a display bug, and the database still refuses a real early write. ⚠️ So
 * the rule is: `null` or nonsense means allowed; a real timestamp in the future means wait.
 */
export function nameChangeCooldown(lastChangedAtIso: string | null, nowMs: number): NameCooldown {
  if (lastChangedAtIso === null) return { allowed: true, daysRemaining: 0, nextChangeAtMs: null };

  const last = Date.parse(lastChangedAtIso);
  if (!Number.isFinite(last)) return { allowed: true, daysRemaining: 0, nextChangeAtMs: null };

  const next = last + NAME_CHANGE_INTERVAL_MS;
  if (nowMs >= next) return { allowed: true, daysRemaining: 0, nextChangeAtMs: null };

  return {
    allowed: false,
    daysRemaining: Math.ceil((next - nowMs) / DAY_MS),
    nextChangeAtMs: next,
  };
}
