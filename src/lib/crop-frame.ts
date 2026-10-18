/**
 * crop-frame.ts — the post-shot crop/lasso GEOMETRY, as arithmetic a gate can read.
 *
 * ── WHY THIS FILE EXISTS (SCRUM-131, 2026-10-18) ─────────────────────────────
 * After the shot, the player frames their offering and the app hands the pipeline
 * ONLY that region. Two things have to agree exactly or the crop lies:
 *
 *   ① WHAT THE PLAYER SAW — a selection drawn in VIEW coordinates, inside the box
 *      the photo actually occupies on screen. The photo is `contain`-fitted, so it
 *      is LETTERBOXED: a selection dragged out into the letterbox belongs to no
 *      pixel, and a naive `sel / view * image` mapping would crop a region the
 *      player never pointed at. So the fit is computed once (`containRect`) and
 *      every selection is clipped to it.
 *
 *   ② WHAT THE MANIPULATOR GETS — whole PIXELS, inside the image's own bounds.
 *      `expo-image-manipulator`'s `crop` is `{ originX, originY, width, height }`
 *      in image pixels, and it will happily accept a rectangle that runs off the
 *      edge or is one pixel wide — producing a smear at ≈US$0.09 a try. A crop
 *      that cannot be honoured must be REFUSED here, by name, not sent.
 *
 * Pure by construction — no React, no `expo-image-manipulator`, no `Image` — which
 * is what lets `check:framing` assert every edge case without a device. The screen
 * does the drawing; this file decides what the drawing MEANS.
 *
 * ── ⚠️ THE LASSO IS ITS BOUNDING BOX, AND THAT IS A KNOWN LIMIT ──────────────
 * `expo-image-manipulator` (SDK 57) can crop / resize / rotate / flip and nothing
 * else: `ActionCrop` is documented as *"fields specify top-left corner and
 * dimensions of a crop rectangle"*, with no polygon or alpha-mask support. So a
 * freehand outline is applied as its BOUNDING RECTANGLE — deliberately, and
 * visibly: the step draws that rectangle over the drawn path, so the player sees
 * exactly what will be sent before they confirm. Filed as **SCRUM-130** (ship
 * this / add a rasterizer for a true mask / drop lasso for a plain rectangle).
 *
 * It is not a cop-out: cropping to the selection's bounds still removes the
 * background AROUND the offering before the styler call, and stage ④ (the
 * server-side cutout, SCRUM-129) is what removes background INSIDE the box.
 */

/** A pixel size — the photo, or the box it is drawn into. */
export interface Size {
  readonly width: number;
  readonly height: number;
}

/** A point in VIEW coordinates (dp), as the pan responder reports them. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A rectangle. `x`/`y` are its top-left corner. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The two ways to frame the offering. */
export type CropMode = 'rect' | 'lasso';

/**
 * The smallest crop we will send, in image pixels.
 *
 * Not an aesthetic preference: the upload is then SHRUNK to fit a 300 KB bucket
 * (`capture-size.ts`), so a 40 × 30 crop is blown back up by the resize and
 * reaches the styler as a smear — the player would pay for an unreadable offering.
 * 64 px is the short edge below which even the emulator's 10 KB virtual photo
 * stops being legible.
 */
export const MIN_CROP_EDGE_PX = 64;

/**
 * The smallest lasso we will believe is intentional: a path shorter than this is
 * a TAP or a nervous twitch, not a selection. The path's own accumulated length is
 * the measure (not its bounding box), so a long thin diagonal stroke counts even
 * though one of its box's edges is short.
 */
export const MIN_LASSO_TRAVEL_PX = 24;
export const MIN_LASSO_POINTS = 3;

/**
 * The box the photo occupies inside a `contain`-fitted view.
 *
 * `contain` scales the photo down until it fits, keeping its aspect ratio, and
 * centres it — so the drawn photo is the largest size with the image's aspect
 * that fits the container. The remaining margin is the letterbox: real estate on
 * screen that belongs to NO pixel of the photo.
 *
 * Degenerate inputs (a zero-sized container, a zero-sized image, a NaN) return a
 * zero rect rather than a NaN one: everything downstream then refuses the crop by
 * the min-edge rule instead of computing `NaN` pixels and handing them to a native
 * decoder, which fails in a way no UI can explain.
 */
export function containRect(image: Size, container: Size): Rect {
  if (!isPositive(image.width) || !isPositive(image.height)) return ZERO_RECT;
  if (!isPositive(container.width) || !isPositive(container.height)) return ZERO_RECT;

  const scale = Math.min(container.width / image.width, container.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return { x: (container.width - width) / 2, y: (container.height - height) / 2, width, height };
}

const ZERO_RECT: Rect = { x: 0, y: 0, width: 0, height: 0 };

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/**
 * A rectangle from two drag points, in any direction.
 *
 * A drag up-and-left produces a negative width without this, which would then be
 * drawn as an invisible box and mapped to a negative origin.
 */
export function normaliseDrag(from: Point, to: Point): Rect {
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.abs(to.x - from.x),
    height: Math.abs(to.y - from.y),
  };
}

/**
 * Clip a selection to the box the photo occupies. `null` when nothing survives.
 *
 * ⚠️ THIS IS THE LETTERBOX GUARD, and it is load-bearing. A drag that starts on the
 * photo and ends in the black margin would otherwise be scaled by the IMAGE box's
 * width while being measured against the CONTAINER's — so the crop would be shifted
 * toward a corner and would include pixels the player never saw under their finger.
 * Clipping first means the reported region is always a subset of what was on screen.
 */
export function clampRectToBox(selection: Rect, box: Rect): Rect | null {
  if (!isPositive(box.width) || !isPositive(box.height)) return null;
  if (!Number.isFinite(selection.x) || !Number.isFinite(selection.y)) return null;
  if (!Number.isFinite(selection.width) || !Number.isFinite(selection.height)) return null;

  const left = Math.max(selection.x, box.x);
  const top = Math.max(selection.y, box.y);
  const right = Math.min(selection.x + selection.width, box.x + box.width);
  const bottom = Math.min(selection.y + selection.height, box.y + box.height);

  const width = right - left;
  const height = bottom - top;
  if (!(width > 0) || !(height > 0)) return null;
  return { x: left, y: top, width, height };
}

/**
 * The four rectangles that DIM everything inside the photo but outside the selection.
 *
 * Four views rather than one masked overlay, because React Native has no scrim: the
 * alternative is a single dark layer with a hole, which needs either a rasterizer or a
 * shadow trick. Four rects are exact, cheap, and — being pure arithmetic — assertable.
 *
 * Degenerate rects (zero or negative width/height) are DROPPED, so a selection flush
 * against an edge does not produce a zero-width view (which some platforms render as a
 * hairline and others as an error).
 */
export function scrimAround(selection: Rect, box: Rect): readonly Rect[] {
  const top: Rect = { x: box.x, y: box.y, width: box.width, height: selection.y - box.y };
  const bottom: Rect = {
    x: box.x,
    y: selection.y + selection.height,
    width: box.width,
    height: box.y + box.height - (selection.y + selection.height),
  };
  const left: Rect = {
    x: box.x,
    y: selection.y,
    width: selection.x - box.x,
    height: selection.height,
  };
  const right: Rect = {
    x: selection.x + selection.width,
    y: selection.y,
    width: box.x + box.width - (selection.x + selection.width),
    height: selection.height,
  };
  return [top, bottom, left, right].filter((r) => r.width > 0.5 && r.height > 0.5);
}

/** Keep an integer inside `[min, max]`, with the pair ordered if it was crossed. */
function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max)) return Math.min(min, max);
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.max(lo, Math.min(hi, Math.round(value)));
}

/**
 * Map a VIEW-space selection onto the image's own PIXEL grid.
 *
 * Rounded to whole pixels (a fractional origin is not a thing a bitmap has), and
 * clamped so the rectangle lies inside the image: the origin rounds past 0 and the
 * far edge is bounded by what is left of the image. The result is `null` when the
 * mapping degenerates (a zero-size box, or a crop under `MIN_CROP_EDGE_PX`) —
 * refusing here is what keeps a smear from being paid for.
 */
export function rectToImagePixels(selection: Rect, box: Rect, image: Size): Rect | null {
  if (!isPositive(box.width) || !isPositive(box.height)) return null;
  if (!isPositive(image.width) || !isPositive(image.height)) return null;

  const sx = image.width / box.width;
  const sy = image.height / box.height;

  const originX = clampInt(Math.round((selection.x - box.x) * sx), 0, Math.floor(image.width) - 1);
  const originY = clampInt(Math.round((selection.y - box.y) * sy), 0, Math.floor(image.height) - 1);
  const width = clampInt(Math.round(selection.width * sx), 1, Math.floor(image.width) - originX);
  const height = clampInt(Math.round(selection.height * sy), 1, Math.floor(image.height) - originY);

  const rect: Rect = { x: originX, y: originY, width, height };
  return isUsableCropRect(rect, image) ? rect : null;
}

/** `true` when a PIXEL-space rect is big enough on both edges and inside the image. */
export function isUsableCropRect(rect: Rect, image: Size): boolean {
  if (!isPositive(image.width) || !isPositive(image.height)) return false;
  if (!Number.isInteger(rect.x) || !Number.isInteger(rect.y)) return false;
  if (!Number.isInteger(rect.width) || !Number.isInteger(rect.height)) return false;
  if (rect.x < 0 || rect.y < 0) return false;
  if (rect.width < MIN_CROP_EDGE_PX || rect.height < MIN_CROP_EDGE_PX) return false;
  return rect.x + rect.width <= image.width && rect.y + rect.height <= image.height;
}

/** Accumulated straight-line length of a path, in the path's own units. */
export function pathLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (a === undefined || b === undefined) continue;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/**
 * The bounding box of a freehand path — the rectangle a lasso is applied as.
 *
 * `null` when the path is not a selection at all: fewer than `MIN_LASSO_POINTS`
 * points, non-finite coordinates, or less than `MIN_LASSO_TRAVEL_PX` of accumulated
 * travel (a tap, or a twitch). Travel is measured ALONG the path, not across its
 * box, so a long thin diagonal stroke qualifies even though one edge of its box is
 * short.
 */
export function lassoBounds(points: readonly Point[]): Rect | null {
  if (points.length < MIN_LASSO_POINTS) return null;
  if (points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  if (pathLength(points) < MIN_LASSO_TRAVEL_PX) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const width = maxX - minX;
  const height = maxY - minY;
  if (!(width > 0) || !(height > 0)) return null;
  return { x: minX, y: minY, width, height };
}

/**
 * The ONE entry point the crop screen uses: selection(s) in → pixel crop out.
 *
 * `null` means "this cannot be honoured", and the screen says so instead of sending
 * something. The mode picks WHICH selection is authoritative — a rect drag or a
 * lasso path — and both go through the same letterbox clip and the same min-edge
 * refusal, so neither mode can produce a crop the other mode would have refused.
 */
export function cropRectFor(
  mode: CropMode,
  selection: { readonly rect?: Rect; readonly path?: readonly Point[] },
  box: Rect,
  image: Size,
): Rect | null {
  const proposed = mode === 'rect'
    ? (selection.rect ?? null)
    : (selection.path === undefined ? null : lassoBounds(selection.path));
  if (proposed === null) return null;

  const clipped = clampRectToBox(proposed, box);
  if (clipped === null) return null;
  return rectToImagePixels(clipped, box, image);
}

/**
 * The path as the `points` string `react-native-svg`'s `<Polyline>` wants
 * (`"x,y x,y …"`). Presentation only, but pure — so the gate can prove a path with a
 * bad point does not silently render as a line through the origin.
 */
export function polylinePoints(points: readonly Point[]): string {
  return points
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
}

/**
 * `true` when the lasso has drawn enough to be applied as its bounding box.
 *
 * The screen shows its instruction/refusal copy off this, and it is deliberately
 * the SAME predicate `lassoBounds` enforces — two implementations of "is this a
 * selection?" is how a button becomes enabled while the crop is refused.
 */
export function isUsableLasso(points: readonly Point[]): boolean {
  return lassoBounds(points) !== null;
}

/**
 * Is this rectangle PIXEL-space crop the whole photo?
 *
 * A "crop" that covers everything is not a crop — it is the skip path, and saying so
 * lets the screen label the button honestly instead of implying a change was made.
 */
export function isWholeImage(rect: Rect, image: Size): boolean {
  return rect.x === 0
    && rect.y === 0
    && rect.width === Math.floor(image.width)
    && rect.height === Math.floor(image.height);
}