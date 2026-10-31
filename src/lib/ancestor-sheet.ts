/**
 * ancestor-sheet.ts — the tablet sheet's RULES, pure (SCRUM-146 · SCRUM-168).
 *
 * ── WHY THIS IS NOT IN THE SCREEN ────────────────────────────────────────────
 * Same reason as `bookView`, `homePanels` and `altarView`: "may this person edit the altar" and
 * "is this surname acceptable" are facts, not pixels. Kept here they can be asserted without a
 * device — and the alternative is finding out on glass that a Member was offered a Save button.
 *
 * ── ⚠️ THESE NUMBERS ARE MIRRORS, NOT AUTHORITIES ────────────────────────────
 * Every constant below is copied from the database, and the database still decides:
 *
 * | here | source of truth |
 * |---|---|
 * | `EDIT_ROLES` | `save_ancestor`'s ladder **and** `ancestors_insert_elder` / `_update_elder` |
 * | `ANCESTOR_CAP` | `clans.ancestor_cap` default 10, enforced by `ancestors_enforce_cap` |
 * | `SURNAME_MAX` etc. | the `CHECK` constraints on `public.ancestors` |
 *
 * ⚠️ A mirror that drifts is worse than no mirror: the client would *offer* a save the server
 * then refuses with a raw Postgres message. `check:lib` §23 pins each one to its source.
 */

/**
 * ⚠️ **The CLAN cap, not the altar's display cap.** `ancestors.sequence` keeps 10 live rows
 * (`slot 0..9`), while the board draws **4** tablets and then pages — `ancestor_cap`'s own
 * comment in `slice_schema` says so explicitly. Conflating them would either strand tablets or
 * refuse the tenth one for no reason.
 */
export const ANCESTOR_CAP = 10;

/** `CHECK (char_length(surname) between 1 and 20)`. */
export const SURNAME_MAX = 20;
/** `CHECK (given_name is null or char_length(given_name) <= 40)`. */
export const GIVEN_NAME_MAX = 40;
/** `CHECK (relationship is null or char_length(relationship) <= 20)`. */
export const RELATIONSHIP_MAX = 20;

/**
 * ⚠️ The SAME three roles the RPC and both RLS policies name. A member may read the altar and
 * must not be offered a way to change it — `save_ancestor` would raise `42501`, and the policies
 * would filter the write silently, which is the worse of the two failures.
 */
export const EDIT_ROLES = ['head', 'co_head', 'elder'] as const;

export function canEditTablets(role: string | null | undefined): boolean {
  return role != null && (EDIT_ROLES as readonly string[]).includes(role);
}

/** Why a save cannot proceed. `null` = it can. */
export type SheetProblem =
  | 'surname_required'
  | 'surname_too_long'
  | 'given_name_too_long'
  | 'relationship_too_long'
  | null;

export interface AncestorForm {
  readonly surname: string;
  readonly givenName: string;
  readonly relationship: string;
}

/**
 * ⚠️ `btrim` first, THEN measure — the server does `char_length(btrim(coalesce(p_surname,'')))`,
 * so a surname of three spaces is `surname_required` on the server and must be here too. Measuring
 * the raw string would accept it and hand the user a Postgres error.
 */
export function sheetProblem(form: AncestorForm): SheetProblem {
  const surname = form.surname.trim();
  if (surname.length === 0) return 'surname_required';
  if (surname.length > SURNAME_MAX) return 'surname_too_long';
  if (form.givenName.trim().length > GIVEN_NAME_MAX) return 'given_name_too_long';
  if (form.relationship.trim().length > RELATIONSHIP_MAX) return 'relationship_too_long';
  return null;
}

/**
 * Trim, and turn a blank into `null` — mirroring `nullif(btrim(coalesce(x,'')), '')`.
 * ⚠️ A `''` sent instead of `null` would be stored as an empty string, and the tablet would then
 * render an empty second line where the board draws none.
 */
export function normaliseAncestorForm(form: AncestorForm): {
  surname: string;
  givenName: string | null;
  relationship: string | null;
} {
  const surname = form.surname.trim();
  const givenName = form.givenName.trim();
  const relationship = form.relationship.trim();
  return {
    surname,
    givenName: givenName.length === 0 ? null : givenName,
    relationship: relationship.length === 0 ? null : relationship,
  };
}

/**
 * Whether the clan has room for one more tablet.
 * ⚠️ `>=` not `>`: at exactly 10 live tablets the altar is full, and the 11th insert is what
 * `ancestors_enforce_cap` refuses.
 */
export function capReached(liveCount: number): boolean {
  return liveCount >= ANCESTOR_CAP;
}

/** How many more this clan may add. Never negative — a legacy clan over cap must not underflow. */
export function slotsRemaining(liveCount: number): number {
  return Math.max(0, ANCESTOR_CAP - liveCount);
}
