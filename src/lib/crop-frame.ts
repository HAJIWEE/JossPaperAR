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
 * ── ⚠️ THE LASSO IS NOW A TRUE FREE-FORM MASK (S64, 2026-10-18) ──────────────
 * SCRUM-130 shipped the lasso as its BOUNDING RECTANGLE, because
 * `expo-image-manipulator` (SDK 57) can only crop rectangles (`ActionCrop`:
 * *"fields specify top-left corner and dimensions of a crop rectangle"*) and the
 * app has no rasterizer. The owner rejected that in one sentence: *"the Lasso tool
 * currently is effecting a rectangle area which defeats the purpose."*
 *
 * So the mask is now real, and it is built where a rasterizer already exists — in
 * `react-native-svg`, which this project already depends on (15.15.4):
 *
 *   · the outline is validated as a CLOSED, SIMPLE, non-degenerate loop
 *     (`src/lib/lasso.ts` — the shape rules live there, with the copy that
 *     refuses each fault by name);
 *   · `dimPathPolygon` below emits the ONE path that draws everything outside the
 *     loop — an even-odd hole in the photo's box — and the crop screen draws that
 *     path over the photo, which is why the preview IS the sent image;
 *   · `Svg.toDataURL()` rasterizes that same view into a PNG, which
 *     `expo-image-manipulator` then re-encodes to the budget's JPEG.
 *
 * ⚠️ TWO HONEST LIMITS, both structural rather than lazy:
 *
 *  ① JPEG HAS NO ALPHA, so "removed" means FILLED — the mask is an opaque flat
 *     fill in the app's own dark (`surface.camera`), not transparency. The fill is
 *     what stage ④ (the server-side cutout, SCRUM-129) then throws away with the
 *     rest of the background. A true-alpha PNG is not a small change: the `captures`
 *     bucket allows 300 KB, `boundedJpegBlob` re-encodes everything as JPEG, and a
 *     photographic PNG is over budget even at 640 px — so it is a *decision*
 *     (bucket limit + a second upload format), not a bug to fix here.
 *
 *  ② ⚠️ THE RASTER WAS SCREEN-SIZED — a defect, MEASURED and fixed in S64. It used
 *     to be only as detailed as the phone's rendering of the photo (**280 × 280 px**
 *     for a 140 dp selection on a 2× screen), while the rect path cut the SAME
 *     selection from the photo's own **1313 × 1313** pixels — so the lasso reached
 *     the styler at a fifth of the linear detail. This header used to claim that was
 *     *"still at or above the upload budget's own 1080 px ceiling"*: it is BELOW it,
 *     and a false "honest limit" is what hid the defect. `maskRasterSize` below is
 *     the fix — the raster is asked for at the region's size in the PHOTO's pixels,
 *     capped at the budget's ceiling. The two modes still differ by nature (a crop
 *     discards, a mask replaces), but they are now equally sharp.
 */

import { CAPTURE_MAX_EDGE_PX } from './capture-size.ts';

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

/**
 * The RN view style for a rectangle — ⚠️ `left`/`top`, NOT `x`/`y`.
 *
 * ── THIS FUNCTION EXISTS BECAUSE OF A MEASURED BUG (S64, 2026-10-18) ─────────
 * The frame step's first version spread a bare `Rect` straight into a style —
 * `style={[styles.scrim, scrim]}`, i.e. `{x, y, width, height}`. React Native has
 * no `x`/`y` **style** property: `LayoutProps` declares `left`, `top`, `right`,
 * `bottom` and `inset*`, and `ReactNativeStyleAttributes` — the map that decides
 * which style keys actually reach the native view — contains **no `'x'` and no
 * `'y'` entry at all** (`node_modules/react-native/Libraries/Components/View/
 * ReactNativeStyleAttributes.js`: 0 matches). So `x` and `y` were dropped
 * silently, `width` and `height` were honoured, and all four scrims stacked at the
 * stage's top-left corner. The owner's report was exact:
 *
 *     "the animation is inverted where inside the crop rectangle selected area is
 *      actually getting darker than the outside unselected area."
 *
 * …which is precisely what four 55%-dark rects piled on the origin look like.
 *
 * ⚠️ Two things about the fix are load-bearing: it is a NAMED function, so a gate
 * can assert which keys it emits, and it is the ONLY place a `Rect` becomes a
 * style. Reverting it to `{x, y}` turns `check:framing` red — fault-tested, and
 * the measurement is recorded in `handover-prompt.md` §6.
 */
export function rectToViewStyle(rect: Rect): {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
} {
  return { left: rect.x, top: rect.y, width: rect.width, height: rect.height };
}

/** Path coordinates are rounded to a tenth of a pixel — the same as `polylinePoints`. */
function pathNumber(value: number): string {
  return value.toFixed(1);
}

/**
 * ⚠️ THE FILL RULE THE PATHS BELOW REQUIRE, exported so the screen cannot use a
 * different one by accident.
 *
 * An even-odd path of "box, then hole" paints everything inside the box OUTSIDE the
 * hole. Under the DEFAULT rule (`nonzero`) the hole is a hole only if the two
 * subpaths wind in opposite directions — which they do not, so the default fills
 * the whole box and the selection disappears. That is the entire bug class this
 * constant exists to prevent, and `check:framing` asserts the screen applies it.
 */
export const DIM_PATH_FILL_RULE = 'evenodd' as const;

const ORIGIN: Point = { x: 0, y: 0 };

/**
 * `M… L… Z` for a closed polygon, in `origin`-relative units.
 *
 * Non-finite points are DROPPED rather than emitted (a `NaN` in a path is what
 * makes a renderer draw a line through the origin), and fewer than three surviving
 * points is not a polygon at all — `''` says so, which the caller must treat as
 * "no mask" rather than as an empty one.
 *
 * ⚠️ `Z`, always. The mask is a CLOSED region; an open path would be filled as if
 * closed, so the drawn shape and the validated shape would be two different
 * things. `src/lib/lasso.ts` refuses an outline whose ends do not meet — this
 * function then closes it for real.
 */
export function polygonPath(points: readonly Point[], origin: Point = ORIGIN): string {
  const usable = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (usable.length < 3) return '';
  const commands = usable.map(
    (p, index) => `${index === 0 ? 'M' : 'L'}${pathNumber(p.x - origin.x)},${pathNumber(p.y - origin.y)}`,
  );
  return `${commands.join(' ')} Z`;
}

/**
 * The OUTER subpath: the region to paint, relative to the box it is drawn in.
 * `''` for a degenerate box — the callers treat that as "no mask", which is what
 * stops a zero-sized view from being rasterized.
 */
function boxOutlinePath(box: Rect): string {
  if (!isPositive(box.width) || !isPositive(box.height)) return '';
  return `M${pathNumber(0)},${pathNumber(0)} `
    + `H${pathNumber(box.width)} V${pathNumber(box.height)} H${pathNumber(0)} Z`;
}

/**
 * The even-odd path that masks everything in `box` EXCEPT a free-form `polygon` —
 * the lasso's mask (S64).
 *
 * ⚠️ The polygon is NOT clipped to the box here, on purpose: the SVG view is the
 * clip, and clipping the geometry first would change which points are inside
 * (a polygon that leaves the box and comes back encloses area the even-odd rule
 * must still count). Drawing and clipping are two different operations; the
 * renderer does the second one for free.
 *
 * Coordinates are relative to `box` — the view the path is drawn in — and the
 * polygon's own points may extend outside it.
 *
 * ⚠️ The rectangle mode does NOT use a path for its scrim: it keeps
 * `scrimAround`'s four dimmed rects (positioned by `rectToViewStyle`), because that
 * path is proven and the reported bug was in its POSITIONING, not its geometry. Two
 * modes, two mechanisms, each one assertable on its own terms.
 */
export function dimPathPolygon(box: Rect, polygon: readonly Point[]): string {
  const outer = boxOutlinePath(box);
  if (outer === '') return '';
  const inner = polygonPath(polygon, { x: box.x, y: box.y });
  return inner === '' ? '' : `${outer} ${inner}`;
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

/**
 * ⚠️ THE RASTER'S PIXEL SIZE — and the defect this function exists to fix (S64).
 *
 * `Svg.toDataURL()` with no size renders the view at its OWN bounds, and the view
 * is laid out in **dp**. So the masked file was only as detailed as the phone's
 * rendering of the photo: for a 140 dp selection on a 2× screen, **280 × 280 px**,
 * while the rect path cuts the SAME selection from the photo's own
 * **1313 × 1313** pixels. The lasso therefore reached the styler at a fifth of the
 * linear detail (≈22× fewer pixels) — the difference between a cartoon of the
 * offering and a smear. It was invisible because both paths "worked".
 *
 * ⚠️ THIS FILE USED TO CLAIM THE OPPOSITE. Its header said the screen-sized raster
 * was *"still at or above the upload budget's own 1080 px ceiling"*. MEASURED on
 * glass 2026-10-18 with a probe on the frame screen: `region 140 × 140 dp` →
 * `toDataURL()` → **280 × 280 px**, i.e. below the ceiling, not above it. A false
 * "honest limit" is worse than an unstated one: it is a defect with a permission
 * slip.
 *
 * So the raster is now asked for at the region's size IN THE PHOTO'S OWN PIXELS —
 * the same space `rectToImagePixels` crops in — capped at the upload budget's
 * longest edge. The cap is not arbitrary: `boundedJpegBlob` shrinks to exactly that
 * ceiling anyway, so anything above it is wasted work, and an uncapped request for
 * a selection that covers the whole photo would allocate 3000 × 4000 as
 * ARGB_8888 (48 MB).
 *
 * ⚠️ Integer, and at least 1: the Android bridge reads these with `getInt`.
 */
export function maskRasterSize(regionPx: Size): Size {
  const width = Math.max(1, Math.round(regionPx.width));
  const height = Math.max(1, Math.round(regionPx.height));
  const longest = Math.max(width, height);
  if (longest <= CAPTURE_MAX_EDGE_PX) return { width, height };
  // ONE scale for BOTH axes, or the mask would come out stretched.
  const scale = CAPTURE_MAX_EDGE_PX / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
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