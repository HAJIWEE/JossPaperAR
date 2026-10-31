/**
 * offerings-layout.ts — the PURE geometry of the altar's offerings (SCRUM-162).
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * ⚠️ **The owner reported the altar's decoration placement as wrong, and it was.**
 * `art · offerings (front)` is drawn inside an inner Penpot group that sits at `y 68`;
 * every path had that offset folded in, but the four offering dots kept the **group-space**
 * y (`76` / `78`). They floated **68 units above their trays** — detached, obvious on
 * glass, invisible to `tsc` and to every gate, because both `76` and `144` are perfectly
 * valid coordinates inside the viewBox.
 *
 * ⚠️ **A bounds check cannot catch a mixed coordinate space.** Nor can a snapshot. What
 * CAN catch it is the RELATIONSHIP the drawing depends on: *a dot rests on a tray.* So the
 * numbers live here, the component reads them, and `check:lib` §19 asserts the
 * relationship — no device, no RN.
 *
 * This is the same move as `bookView` (SCRUM-122) and `PREPARING_COPY` (SCRUM-127): a rule
 * that only lives in JSX can only be checked by eye.
 */

/** All coordinates are in the offerings viewBox — `0 0 330 170`. */
export const OFFERINGS_VIEWBOX = { w: 330, h: 170 } as const;

/** The two outer trays, in offerings space. */
export const OFFERING_TRAYS = [
  { x: 0, y: 150, w: 32, h: 8 },
  { x: 298, y: 150, w: 32, h: 8 },
] as const;

/** The four dots that rest in them — centres, radius 6. */
export const OFFERING_DOTS = [
  { cx: 10, cy: 144 },
  { cx: 22, cy: 146 },
  { cx: 308, cy: 144 },
  { cx: 320, cy: 146 },
] as const;

export const OFFERING_DOT_RADIUS = 6;

/**
 * How far a dot's underside may sit from its tray's lip, in offerings units.
 *
 * ⚠️ Tolerance, not a fudge: the board draws the two dots of a pair at slightly different
 * heights (144 and 146), so the bottom lands at 150 and 152 against a tray lip at 150. A
 * dot that had kept the group-space `y` would be **68** away, so anything within a few
 * units is the drawing and anything beyond it is the defect.
 */
export const DOT_ON_TRAY_TOLERANCE = 4;

/** Is this dot actually resting on one of the trays? */
export function dotSitsOnTray(dot: { cx: number; cy: number }): boolean {
  const bottom = dot.cy + OFFERING_DOT_RADIUS;
  return OFFERING_TRAYS.some((tray) => Math.abs(bottom - tray.y) <= DOT_ON_TRAY_TOLERANCE);
}
