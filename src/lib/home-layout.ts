/**
 * home-layout.ts — the PURE structure of the Home shrine (SCRUM-148 · SCRUM-160).
 *
 * ── WHY A MODULE AND NOT STYLE PROPS ────────────────────────────────────────
 * The same reason as `bookView` (SCRUM-122) and `PREPARING_COPY` (SCRUM-127):
 * **a structure nothing can read is a structure no gate can hold.** The team that
 * replaces the scaffold has to be able to assert *"the shrine is still a shrine"*
 * without a device, so the shape lives here as data and `src/app/index.tsx`
 * renders it.
 *
 * ── WHAT THIS FILE DELIBERATELY DOES *NOT* CONTAIN ──────────────────────────
 * ⚠️ **No absolute body bands — yet.** The signed-off Home's y-ranges (tribute ·
 * altar art · CTA) have to be read off the board before they can be frozen, and
 * the art itself does not exist in this repo (there is **no image asset at all** —
 * `assets/` holds icons only). Inventing numbers here and then asserting them
 * would freeze a guess, which is the exact failure `tokens.css`'s header records:
 * four of five hand-carried hexes were wrong and re-introduced the drift they were
 * meant to fix.
 *
 * ⚠️ So: `home-layout.ts` owns **the region list** (this ticket). The CTA/art band
 * numbers arrive with the art in **SCRUM-162**, and **SCRUM-163** freezes both and
 * adds the gate. A cross-reference to `clan-pill.ts`'s measured bands was
 * considered and rejected: that comment lists a tab bar at y **944–1024**, but the
 * canvas is **390 × 844** (`design-system/responsive.css`), so at least one of
 * those numbers is not a board y-range. Freezing it would have made the gate
 * assert a mistake.
 *
 * ── THE ONE RULE THE ORDER ENCODES ──────────────────────────────────────────
 * ⚠️ **`cta` sits AFTER `altar` and BEFORE `footer`** — the offer is taken *at*
 * the altar, not from the chrome. S36 settled this by measurement: the header row
 * was the only empty rectangle on the signed-off Home, so the clan pill took it and
 * the CTA stayed down among the art. Reordering these regions is a design change,
 * not a refactor.
 */

import { DESIGN_REFERENCE_WIDTH } from '../theme/tokens.ts';

/**
 * The shrine's regions, in render order.
 *
 * ⚠️ `header` is the only region that is **not** inside the scroll view: it carries
 * the clan pill at a measured x (`PILL_X_ON_REFERENCE`), and scrolling it would
 * break that measurement. Every other region scrolls.
 *
 * ⚠️ Each region maps to a ticket, so a half-built shrine is legible rather than
 * mysterious: `totals` → SCRUM-161, `altar` → SCRUM-162 (+ the tablet sheet,
 * SCRUM-146), `cta` → SCRUM-162, `footer` → the shrine's entries (SCRUM-164).
 */
export const HOME_REGION_ORDER = ['header', 'totals', 'altar', 'cta', 'footer'] as const;

export type HomeRegion = (typeof HOME_REGION_ORDER)[number];

/**
 * The design reference the shrine is drawn at — re-exported so a consumer cannot
 * import a different width and quietly compare against the wrong canvas.
 */
export const REFERENCE_WIDTH = DESIGN_REFERENCE_WIDTH;

/**
 * Is this the region list a shrine must have, in the right order?
 *
 * ⚠️ Exported as a FUNCTION rather than left to `check:lib` to inline, so the
 * assertion tests the same expression the screen uses. A gate that re-implements
 * the rule it checks can drift from the code it is guarding.
 */
export function isShrineOrder(regions: readonly string[]): boolean {
  return (
    regions.length === HOME_REGION_ORDER.length &&
    regions.every((region, i) => region === HOME_REGION_ORDER[i])
  );
}
