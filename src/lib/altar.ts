/**
 * altar.ts — which part of the altar renders (SCRUM-146).
 *
 * ── WHY PURE ────────────────────────────────────────────────────────────────
 * Same reason as `bookView` (SCRUM-122) and `homePanels` (SCRUM-161): the empty/filled choice
 * is a fact about *which thing is shown*, so it lives where `check:lib` can read it instead
 * of in JSX that only an eye can check.
 *
 * ── ⚠️ THE BAND IS SHARED, ON PURPOSE ──────────────────────────────────────
 * The board draws `slot · ＋ add a tablet` at **131,285 129×307** and the CENTRE TABLET at
 * **exactly the same band** (`EN · 1c Home / full (4 tablets)`). So the ＋ affordance and the
 * tablet occupy one slot and swap in place — the altar does not reflow when the first tablet
 * is added. ⚠️ Rendering them in different places would move everything below.
 *
 * ── ⚠️ A CAROUSEL, NOT A GRID ──────────────────────────────────────────────
 * The filled board shows the **centre** tablet (129×307) with the neighbour peeking at 93×221,
 * plus `nav · carousel prev` (26,412 24×40) and `nav · carousel next` (340,412 24×40). So any
 * number of tablets is reachable by paging — never a "+N more" that strands the rest, which is
 * what SCRUM-146's brief warned about at the cap of 10.
 */

/**
 * ⚠️ How many tablets the BOARD draws before it pages — **4**, and it is NOT the clan cap.
 *
 * `ancestors.sequence` keeps **10** live rows (`slot 0..9`, `ancestor_cap`), while the altar
 * DISPLAYS four and pages for the rest — `ancestor_cap`'s own comment in `slice_schema` says so
 * explicitly, and `EN · 1c Home / full (4 tablets)` is the board that draws it. Conflating the two
 * would either strand tablets or refuse the tenth for no reason.
 *
 * ⚠️ It is a **page size, not a width budget**: four 129-wide tablets do not fit across 390. The
 * centre slot plus the peeking neighbours are what "4" counts.
 */
export const ALTAR_DISPLAY_SLOTS = 4;

export type AltarView =
  | { readonly kind: 'empty' }
  | {
      readonly kind: 'tablet';
      /** Index into the owner's list, already clamped. */
      readonly index: number;
      readonly count: number;
      readonly hasPrev: boolean;
      readonly hasNext: boolean;
    };

/**
 * ⚠️ `index` is CLAMPED, not trusted: removing a tablet while the carousel sits on the last
 * page would otherwise point past the end of the list and render nothing.
 */
export function altarView(count: number, index: number): AltarView {
  if (count <= 0) return { kind: 'empty' };
  const safe = Math.min(Math.max(0, Math.trunc(index)), count - 1);
  return {
    kind: 'tablet',
    index: safe,
    count,
    hasPrev: safe > 0,
    hasNext: safe < count - 1,
  };
}

/** Where a page tap goes. ⚠️ Wraps nothing: the ends are ends. */
export function pageStep(index: number, count: number, delta: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(0, index + delta), count - 1);
}

/**
 * The altar-state caption — `caption · altar state`, one line above the halo.
 *
 * ── ⚠️ WHY THE KEY IS CHOSEN HERE AND NOT IN THE SCREEN ─────────────────────
 * `EN · 1 Home / Shrine` carries the EMPTY line and `EN · 1b Home / tablets (carousel)` the
 * filled one; the screen used to render the empty line unconditionally, so a shrine holding
 * three tablets still read *"Your altar is empty"* — the difference the owner saw against the
 * board. The choice is a fact about the count, so it lives here where `check:lib` reads it.
 *
 * ⚠️ **The singular is OURS.** The board draws only the 3-tablet case, and `%{count} ancestors`
 * would print *"1 ancestors"*. One key, one branch, asserted.
 *
 * ⚠️ `count <= 0` returns the EMPTY key rather than the plural: a negative count is not a
 * state the server can produce, and falling through to "−1 ancestors" would be worse than
 * the empty line.
 */
export function altarCaption(count: number): {
  readonly key: string;
  readonly options?: Record<string, unknown>;
} {
  if (count <= 0) return { key: 'home.altarEmpty' };
  if (count === 1) return { key: 'home.altarFilledOne' };
  return { key: 'home.altarFilled', options: { count: String(count) } };
}
