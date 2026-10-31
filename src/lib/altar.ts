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
