/**
 * lasso.ts — the FREE-FORM outline's rules, as decisions a gate can read (S64).
 *
 * ── WHY THIS FILE EXISTS (2026-10-18) ────────────────────────────────────────
 * SCRUM-130 shipped the lasso as its bounding rectangle and the owner rejected it
 * outright: *"the Lasso tool currently is effecting a rectangle area which defeats
 * the purpose. A lasso tool should be free form, removing all outside of the shape
 * drawn."* — and then, immediately, the rule that keeps it honest:
 *
 *     "OF COURSE do check if free form shape drawn by the user is a closed water
 *      tight shape else error out to the user and reject it"
 *
 * So this module is that check. A free-form region is only well defined if the
 * outline CLOSES (or the fill is ambiguous), does not CROSS ITSELF (or "inside" has
 * two meanings at once), and actually ENCLOSES something (or the mask hides the
 * offering instead of the background). Each failure has a name and its own
 * sentence, so the player is told which one they made — see `lassoFaultMessageKey`.
 *
 * ⚠️ A SILENT FAILURE IS THE THING TO FEAR HERE, not an ugly one. An unclosed or
 * self-crossing outline still renders as SOMETHING (every rasterizer fills an open
 * path as if closed, and an even-odd fill of a figure-eight silently drops one
 * lobe), the mask is then applied to the wrong region, and the player finds out
 * after paying ≈US$0.09 to have the wrong region restyled. Refusing by name is
 * strictly better than a plausible wrong picture.
 *
 * Pure — no React, no SVG, no device — so `check:framing` can assert every fault
 * without glass. `lassoBounds` and `pathLength` come from `crop-frame.ts`, which
 * owns the view→pixel mapping; this file owns only the SHAPE rules.
 */

import {
  lassoBounds,
  MIN_LASSO_POINTS,
  MIN_LASSO_TRAVEL_PX,
  pathLength,
  type Point,
  type Rect,
} from './crop-frame.ts';

/**
 * How close the stroke's two ends must come for the outline to count as CLOSED.
 *
 * A freehand loop is never pixel-exact, so "the ends meet" has to mean "within a
 * finger's wobble". 28 view px is roughly a fingertip's width at this screen's
 * density: bigger than a slip, smaller than a deliberate gap. It is a UX number
 * with an arithmetic consequence — a path whose ends are 29 px apart is REFUSED
 * and told why, rather than filled as if closed.
 */
export const LASSO_CLOSE_TOLERANCE_PX = 28;

/**
 * How close a crossing may pass to an endpoint before it counts as "just touching".
 *
 * ⚠️ THIS IS A **SUB-PIXEL NUMERICAL** MARGIN, NOT A JITTER TOLERANCE — and getting that
 * wrong was a real defect, measured this session. It was `1` px, applied as a fraction of
 * each segment, which is harmless on a 100 px edge and catastrophic on a 2 px one: the
 * stroke is sampled every `PATH_MIN_STEP_PX` (2 view px), so `eps = 1 / 2 = 0.5` excluded
 * EVERY crossing anywhere on a short segment — i.e. most of a hand-drawn figure-eight
 * would not register as crossing itself at all. The parameter fraction is therefore CLAMPED
 * (`MAX_ENDPOINT_EPS`) so it can never swallow a short segment, whatever the constant is.
 *
 * The job of the closure's own self-contact belongs to `LASSO_JUNCTION_GUARD_PX`, which
 * knows the difference between "the ends met" and "the loop crossed itself" — so this
 * tolerance no longer has to be generous, and a generous one is actively harmful.
 */
export const LASSO_INTERSECT_TOLERANCE_PX = 0.25;

/**
 * The most of a segment the endpoint margin may ever exclude — a quarter from each end.
 *
 * ⚠️ Without this clamp the margin is `tolerance / segmentLength`, which on a 2 px segment
 * exceeds 1 and refuses every crossing there. A rule that silently stops working on exactly
 * the geometry the app produces is worse than no rule, because it reports the shape as fine.
 */
const MAX_ENDPOINT_EPS = 0.25;

/**
 * The stretch of the loop around its CLOSURE in which self-contact is NOT a crossing.
 *
 * ── WHY THIS EXISTS: THE RULE WAS TOO STRICT, AND THE OWNER SAID SO (S64) ────
 * A closed hand-drawn loop's two ends overlap — a finger lays the last few millimetres
 * back over the first, and the overlap is a real, visible little spur (the owner drew one
 * and the screen answered *"Your outline crosses itself"* about a loop that is obviously
 * a loop). Under the even-odd fill that overlap cancels out into a sub-fingertip notch,
 * which is invisible; but a naive "do any two edges cross?" test calls it a crossing and
 * refuses a perfectly ordinary gesture.
 *
 * So the crossing test ignores self-contact between parts of the outline that are within
 * this distance of each other ALONG THE PATH — measured around the closure (the shorter
 * arc of the loop), not in a straight line.
 *
 * ⚠️ WHY "ALONG THE PATH" IS THE RIGHT MEASURE, and a radius around the start point is not:
 * a genuine crossing between two parts of the outline that happen to meet NEAR the start is
 * still a crossing — a spatial radius would quietly accept it. Path distance asks the
 * question we actually mean: *"are these two stretches the same end-meets-beginning
 * overlap, or is the loop really crossing itself?"*. A figure-eight's arms are hundreds of
 * pixels apart along the path, so it is still refused — `check:framing` asserts both.
 *
 * `2 × LASSO_CLOSE_TOLERANCE_PX` because the overlap is two-sided: the stroke runs that far
 * back along its own start AND that far forward from its own end, so the two stretches are
 * up to twice the tolerance apart along the path. The honest limit, stated rather than
 * hidden: a closure that overshoots its start by more than a fingertip's travel (≈56 px) is
 * reported as a crossing. That is deliberate — an overshoot that long has gone past the
 * junction and into the loop — and it is a rare way to end a stroke.
 */
export const LASSO_JUNCTION_GUARD_PX = 2 * LASSO_CLOSE_TOLERANCE_PX;

/**
 * Vertices closer than this are the SAME vertex.
 *
 * A finger resting for a few frames emits a cluster of nearly identical locations;
 * without collapsing them, a single touch would look like a many-sided polygon and
 * every edge between the cluster members would be a zero-length edge the
 * intersection test has to skip anyway.
 */
export const LASSO_MIN_VERTEX_GAP_PX = 4;

/**
 * Why an outline was refused. The names are the API: the screen maps each one to a
 * sentence, and `check:framing` asserts every one of them HAS a sentence in both
 * locales (an unrefusable fault would strand the player on a disabled button).
 */
export type LassoFault = 'too_short' | 'not_closed' | 'crosses_itself' | 'degenerate';

/** The vertex list of an outline: consecutive points closer than the gap collapsed. */
export function lassoVertices(points: readonly Point[]): readonly Point[] {
  const out: Point[] = [];
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const last = out[out.length - 1];
    if (last !== undefined
      && Math.hypot(point.x - last.x, point.y - last.y) < LASSO_MIN_VERTEX_GAP_PX) {
      continue;
    }
    out.push(point);
  }
  return out;
}

/**
 * The area the outline encloses, in square view units — the shoelace formula, with
 * the LAST vertex joined back to the first because the loop is closed.
 *
 * `0` for anything that encloses nothing (all points collinear, or fewer than three
 * distinct vertices). ⚠️ Not a tolerance question: a shoelace area of exactly zero
 * means the outline is a line, and no amount of care makes a line contain an area.
 */
export function polygonArea(points: readonly Point[]): number {
  if (points.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (a === undefined || b === undefined) continue;
    total += a.x * b.y - b.x * a.y;
  }
  return Math.abs(total) / 2;
}

/** Are the outline's two ends within `tolerance` of each other? */
export function pathIsClosed(
  points: readonly Point[],
  tolerance: number = LASSO_CLOSE_TOLERANCE_PX,
): boolean {
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return false;
  return Math.hypot(last.x - first.x, last.y - first.y) <= tolerance;
}

/**
 * Do two segments properly cross? `false` for segments that merely TOUCH (within
 * `tolerance` of an endpoint) — a closed loop's neighbours always share a point.
 *
 * The test is the parametric solve, so `tolerance` is in the same units as the
 * coordinates (pixels of travel along the segment) rather than an area-like
 * cross-product threshold whose meaning depends on the segment's length.
 *
 * ⚠️ Collinear overlap IS a crossing — a stroke that doubles back along itself
 * encloses two regions that cancel, which is exactly the ambiguity this rule exists
 * to refuse. Parallel-but-offset segments are not.
 */
export function segmentsCross(
  a: Point,
  b: Point,
  c: Point,
  d: Point,
  tolerance: number = LASSO_INTERSECT_TOLERANCE_PX,
): boolean {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const lengthR = Math.hypot(r.x, r.y);
  const lengthS = Math.hypot(s.x, s.y);
  // A zero-length edge is not an edge: two identical points cannot cross anything.
  if (lengthR === 0 || lengthS === 0) return false;

  const denominator = r.x * s.y - r.y * s.x;
  const qp = { x: c.x - a.x, y: c.y - a.y };

  if (Math.abs(denominator) < 1e-9) {
    // Parallel. If they are also COLLINEAR and overlap along the line, that is a
    // retraced stroke; if they are merely parallel, they never meet.
    if (Math.abs(qp.x * r.y - qp.y * r.x) / lengthR > tolerance) return false;
    const t0 = (qp.x * r.x + qp.y * r.y) / (lengthR * lengthR);
    const t1 = t0 + (s.x * r.x + s.y * r.y) / (lengthR * lengthR);
    const lo = Math.min(t0, t1);
    const hi = Math.max(t0, t1);
    const gap = tolerance / lengthR;
    return lo < 1 - gap && hi > gap;
  }

  const t = (qp.x * s.y - qp.y * s.x) / denominator;
  const u = (qp.x * r.y - qp.y * r.x) / denominator;
  // ⚠️ Clamped: see `MAX_ENDPOINT_EPS` — an unclamped fraction can exceed 1 on a short
  // segment and make every crossing there invisible.
  const epsT = Math.min(tolerance / lengthR, MAX_ENDPOINT_EPS);
  const epsU = Math.min(tolerance / lengthS, MAX_ENDPOINT_EPS);
  return t > epsT && t < 1 - epsT && u > epsU && u < 1 - epsU;
}

/**
 * Does the outline cross itself?
 *
 * Every pair of edges is tested, skipping two kinds of pair:
 *
 *  ① pairs that SHARE a vertex — adjacent edges, and the pair that closes the loop;
 *  ② pairs whose stretches of the loop are within `LASSO_JUNCTION_GUARD_PX` of each other
 *     **along the path** — the end-meets-beginning overlap every hand-closed loop has (see
 *     that constant; this is the fix for the rule being too strict).
 *
 * The arc lengths come from a prefix sum of travel, so the guard costs O(1) per pair.
 * `O(n²)` overall on purpose: the stroke is sampled every 2 view px and the array is a few
 * hundred points at worst, so the whole test is tens of thousands of float comparisons —
 * cheaper than the frame it runs in, and far cheaper than the correctness of a
 * polygon-clipping library this app would otherwise have to adopt.
 *
 * ⚠️ `guard = 0` is supported and means "no junction tolerance at all" — the raw geometric
 * question, which is what the gate's unit cases want to ask.
 */
export function pathCrossesItself(
  points: readonly Point[],
  tolerance: number = LASSO_INTERSECT_TOLERANCE_PX,
  guard: number = LASSO_JUNCTION_GUARD_PX,
): boolean {
  const vertices = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const count = vertices.length;
  if (count < 4) return false;

  // Travel from vertex 0 to each vertex, and the loop's total — so the distance between
  // any two stretches of the loop is a subtraction plus a wrap comparison.
  const along: number[] = [0];
  for (let i = 1; i < count; i += 1) {
    const previous = vertices[i - 1];
    const current = vertices[i];
    along.push(previous === undefined || current === undefined
      ? (along[i - 1] ?? 0)
      : (along[i - 1] ?? 0) + Math.hypot(current.x - previous.x, current.y - previous.y));
  }
  // The loop is closed, so the last vertex's arc back to vertex 0 counts too.
  const firstVertex = vertices[0];
  const lastVertex = vertices[count - 1];
  const total = (along[count - 1] ?? 0)
    + (firstVertex === undefined || lastVertex === undefined
      ? 0
      : Math.hypot(firstVertex.x - lastVertex.x, firstVertex.y - lastVertex.y));

  /** How far apart two vertices are ALONG THE LOOP — the shorter way round. */
  const arcBetween = (i: number, j: number): number => {
    const delta = Math.abs((along[i] ?? 0) - (along[j] ?? 0));
    return Math.min(delta, Math.max(0, total - delta));
  };

  for (let i = 0; i < count; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % count];
    if (a === undefined || b === undefined) continue;
    for (let j = i + 1; j < count; j += 1) {
      // Skip edges that share a vertex: (i, i+1) and (j, j+1) share `b` when
      // j === i+1, and the closing pair (i = 0, j = count-1) shares `a`.
      if (j === i + 1) continue;
      if (i === 0 && j === count - 1) continue;
      // ⚠️ The junction guard is measured edge-to-edge: the shortest way round the loop
      // between any endpoint of this edge and any endpoint of that one.
      if (guard > 0) {
        const next = (i + 1) % count;
        const after = (j + 1) % count;
        const separation = Math.min(
          arcBetween(i, j), arcBetween(i, after),
          arcBetween(next, j), arcBetween(next, after),
        );
        if (separation <= guard) continue;
      }
      const c = vertices[j];
      const d = vertices[(j + 1) % count];
      if (c === undefined || d === undefined) continue;
      if (segmentsCross(a, b, c, d, tolerance)) return true;
    }
  }
  return false;
}

/**
 * The outline's fault, or `null` when it is a usable free-form shape.
 *
 * ⚠️ THE ORDER IS THE MESSAGE'S ORDER. Each check is answered in the order a player
 * would want to be told: "that is a scratch" before "it encloses nothing", and
 * "it encloses nothing" before "it is not closed" — a flat stroke is not an unfinished
 * loop, and telling someone to join the ends of a line they never meant as a loop is a
 * worse sentence than "draw around your offering".
 *
 * ① `too_short` — the gesture is not a selection at all: fewer than three vertices after
 *    dedupe, or less travel than `MIN_LASSO_TRAVEL_PX` (the same threshold
 *    `lassoBounds` uses — one rule, two readers).
 * ② `degenerate` — it encloses no area (a line drawn out and back, a vertical stroke, a
 *    zigzag). ⚠️ Checked BEFORE the closure, so a flat line is not reported as an
 *    unfinished loop.
 * ③ `not_closed` — the ends do not meet.
 * ④ `crosses_itself` — a figure-eight: "inside" has two meanings.
 *
 * ⚠️ `lassoBounds` is deliberately NOT consulted here beyond those two thresholds. Its
 * other refusal — a zero width or height — is exactly `polygonArea === 0`, so checking it
 * again would be an unreachable branch posing as a rule.
 */
export function lassoFault(points: readonly Point[]): LassoFault | null {
  const vertices = lassoVertices(points);
  if (vertices.length < MIN_LASSO_POINTS) return 'too_short';
  if (pathLength(vertices) < MIN_LASSO_TRAVEL_PX) return 'too_short';
  if (polygonArea(vertices) <= 0) return 'degenerate';
  if (!pathIsClosed(vertices)) return 'not_closed';
  if (pathCrossesItself(vertices)) return 'crosses_itself';
  return null;
}

/**
 * The message key for a fault — a LITERAL union, so a typo is a compile error and a
 * new fault cannot be added without a sentence to go with it.
 *
 * The copy itself lives in `src/lib/i18n.ts` with the rest of the frame step's
 * words, and `check:framing` asserts all four keys exist in BOTH locales.
 */
export function lassoFaultMessageKey(
  fault: LassoFault,
): 'crop.lassoTooShort' | 'crop.lassoDegenerate' | 'crop.lassoOpen' | 'crop.lassoCrosses' {
  switch (fault) {
    case 'too_short':
      return 'crop.lassoTooShort';
    case 'degenerate':
      return 'crop.lassoDegenerate';
    case 'not_closed':
      return 'crop.lassoOpen';
    case 'crosses_itself':
      return 'crop.lassoCrosses';
  }
}

/**
 * The outline as a CLOSED polygon ready to be masked — the validated vertex list, or
 * `null` when it would be refused.
 *
 * ⚠️ The trailing duplicate is DROPPED when the stroke ended back on its start: the
 * fill is closed by the path itself (`polygonPath` emits `Z`), so carrying the start
 * point twice would only add a zero-length edge for every consumer to skip. Refusing
 * here rather than in four callers is what keeps "validated" and "drawable" the same
 * set of outlines.
 */
export function lassoPolygon(points: readonly Point[]): readonly Point[] | null {
  if (lassoFault(points) !== null) return null;
  const vertices = [...lassoVertices(points)];
  const first = vertices[0];
  const last = vertices[vertices.length - 1];
  if (first !== undefined && last !== undefined
    && Math.hypot(last.x - first.x, last.y - first.y) < LASSO_MIN_VERTEX_GAP_PX) {
    vertices.pop();
  }
  return vertices.length >= MIN_LASSO_POINTS ? vertices : null;
}

/**
 * The region the mask will be drawn in: the outline's bounding box, CLIPPED to the
 * photo — the same clip every other selection gets (`clampRectToBox`'s arithmetic),
 * so a loop drawn half into the letterbox cannot put the mask somewhere the player
 * never saw.
 *
 * Returned in VIEW coordinates; the caller maps it to pixels with the same helpers
 * the rectangle mode uses.
 */
export function lassoRegion(polygon: readonly Point[], box: Rect): Rect | null {
  const bounds = lassoBounds(polygon);
  if (bounds === null) return null;
  const left = Math.max(bounds.x, box.x);
  const top = Math.max(bounds.y, box.y);
  const right = Math.min(bounds.x + bounds.width, box.x + box.width);
  const bottom = Math.min(bounds.y + bounds.height, box.y + box.height);
  if (!(right > left) || !(bottom > top)) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}