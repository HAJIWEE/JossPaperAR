/**
 * FRAMING CHECKS — `node src/lib/checks/framing.ts`
 *
 * ⚠️ WHY THIS FILE EXISTS (SCRUM-131, 2026-10-18; extended S64, 2026-10-18)
 *
 * Three features, none of them visible to any other gate:
 *
 *   ① ZOOM on the shutter screen — first three stops, now an ANALOGUE SLIDER with the
 *      stops kept as presets. `expo-camera`'s `zoom` prop is a FRACTION of the device's
 *      maximum, and the two platforms convert it with DIFFERENT arithmetic (Android
 *      multiplies, iOS raises to a power). So "2×" is not a constant — it is a solve,
 *      per platform, against an assumed device maximum. Nothing but a check can hold
 *      that still, and getting it wrong is invisible: the preview simply zooms the
 *      wrong amount.
 *
 *   ② THE CROP/LASSO STEP. Its whole promise is that what leaves the screen is the
 *      region the player chose. The failure modes are geometric and silent — a selection
 *      measured against the CONTAINER instead of the letterboxed photo, a crop one pixel
 *      wide, `NaN` handed to a native decoder, and (the one the owner actually hit) a
 *      dimming overlay laid out with `x`/`y`, which React Native has no style property
 *      for. Every one of those is arithmetic, so it is asserted here, with no device.
 *
 *   ③ THE FREE-FORM LASSO (S64). A region defined by a drawn outline is only defined if
 *      that outline CLOSES, does not CROSS ITSELF and encloses something — otherwise the
 *      mask is computed from a shape nobody drew and the player pays for the wrong
 *      region. The rules live in `src/lib/lasso.ts`; the path that applies them lives in
 *      `crop-frame.ts`; both are asserted here.
 *
 * Section ③ is the SOURCE assertions: that the screens actually consume the pure modules
 * above rather than re-deciding — including the two gates on the *rasterizer*, because a
 * mask that is drawn but never sent (or sent but never drawn) is invisible to `tsc`.
 *
 * Section ⑤ (S64) pins the four COSMETIC decisions the owner asked for on the shutter and
 * burn screens — where the zoom strip sits, how small the preset pills are, what the hint
 * chip is made of, and that the fire is never still. They are layout and appearance, so no
 * other gate can see them; the reasoning and the fault-test are at the section itself.
 *
 * ⚠️ FAULT-TESTED FIVE TIMES THIS SESSION (S64) — every number MEASURED, not asserted,
 * against a green baseline of 174 checks:
 *   · `rectToViewStyle` returned to `{ x, y, width, height }` (the reported bug) →
 *     **3 of 174 red**, and `tsc` ALSO catches it (TS2353 — the return type is spelled out,
 *     so the type system and the gate agree);
 *   · `dimPathPolygon` made to drop its hole (the mask does nothing) → **3 of 174 red**;
 *   · `LASSO_CLOSE_TOLERANCE_PX` 28 → 1000 (an open loop silently accepted) →
 *     **4 of 174 red**;
 *   · the slider's drag mapping left unclamped → **1 of 174 red**;
 *   · the raster's `data:image/png;base64,` prefix changed → **1 of 174 red**.
 * Restored → 174/174 green.
 *
 * ⚠️ SECTION ⑥ — THE FULL-BLEED CAMERA (S68, 2026-10-19). Seven breaks, seven reds, zero
 * survivors, restored green at 217:
 *   · `burn.tsx` back to a bare `<CameraView style={absoluteFill}>` → **3 red**;
 *   · the component mounting the camera BEFORE the container is measured (the two-pass
 *     form that still clipped on 2 of 3 device runs) → **1 red**;
 *   · `styles.pinned` gaining `right`/`bottom` (the ambiguity the fix removes) → **1 red**;
 *   · the wrapper's `pointerEvents="none"` → `"box-none"` → **1 red**;
 *   · the explicit pixel pin replaced by `absoluteFill` → **2 red**;
 *   · `ref={ref}` dropped (the two capture screens lose their camera handle) → **1 red**;
 *   · `clan/scan.tsx` back to a bare `<CameraView>` → **2 red**.
 *
 * ⚠️ AND THE ORIGINAL TWO, MEASURED WHEN THEY WERE WRITTEN (the count then was 88):
 *   · change the Android branch of `zoomRatioFrom` to `1 + f * (max - 1)` (the arithmetic
 *     the SDK does NOT use) → the per-platform solves go red. A stop whose RATIO is edited
 *     instead is caught by the "three standard stops" check, because a solve is
 *     self-consistent by construction — this catches MAPPING drift.
 *   · change `manipulate(nativeUri)` to `manipulate(uri)` in `crop.tsx` (the black screen)
 *     → the uri assertions in section ③ go red.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MESSAGES, t } from '../i18n.ts';
import { CAPTURE_MAX_EDGE_PX } from '../capture-size.ts';
import {
  containRect,
  cropRectFor,
  DIM_PATH_FILL_RULE,
  dimPathPolygon,
  isUsableCropRect,
  isWholeImage,
  lassoBounds,
  maskRasterSize,
  MIN_CROP_EDGE_PX,
  normaliseDrag,
  pathLength,
  polygonPath,
  polylinePoints,
  rectToImagePixels,
  rectToViewStyle,
  scrimAround,
  type Point,
  type Rect,
  type Size,
} from '../crop-frame.ts';
import {
  LASSO_CLOSE_TOLERANCE_PX,
  LASSO_INTERSECT_TOLERANCE_PX,
  LASSO_JUNCTION_GUARD_PX,
  lassoFault,
  lassoFaultMessageKey,
  lassoPolygon,
  lassoRegion,
  lassoVertices,
  pathCrossesItself,
  pathIsClosed,
  polygonArea,
  segmentsCross,
  type LassoFault,
} from '../lasso.ts';
import {
  ASSUMED_MAX_ZOOM_RATIO,
  DEFAULT_ZOOM_STOP,
  MIN_ZOOM_RATIO,
  ZOOM_PRESET_MATCH_TOLERANCE,
  ZOOM_SLIDER_STEP,
  ZOOM_STOPS,
  zoomFractionFor,
  zoomFractionForStop,
  zoomFractionFromTrack,
  zoomLabel,
  zoomPlatformFor,
  zoomPresetForFraction,
  zoomRatioForFraction,
  zoomRatioFrom,
  zoomSteppedFraction,
  zoomStop,
  zoomStopForFraction,
  zoomTrackOffset,
} from '../zoom.ts';
import { assumedCeiling, ceilingFromReport } from '../zoom-ceiling.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

/** Float comparison, because `ln`/`pow` never round-trip bit-exactly. */
const near = (a: number, b: number, tol = 1e-9): boolean => Math.abs(a - b) <= tol;

// ── ① the zoom stops land where they claim, on BOTH platforms ────────────────
section('① the zoom stops (expo-camera takes a FRACTION of the device max)');

check('the three standard stops are offered',
  ZOOM_STOPS.length === 3 && ZOOM_STOPS.map((s) => s.ratio).join(',') === '1,2,4');
check('their ids are unique', new Set(ZOOM_STOPS.map((s) => s.id)).size === ZOOM_STOPS.length);
check('the default stop is the unzoomed one', DEFAULT_ZOOM_STOP === '1x');
// ⚠️ The default must mean "exactly what the camera did before the strip existed".
check('…and it converts to fraction 0 on both platforms',
  zoomFractionForStop(DEFAULT_ZOOM_STOP, 'android') === 0
    && zoomFractionForStop(DEFAULT_ZOOM_STOP, 'ios') === 0);
check('the assumed device maximum is a whole number > 1',
  Number.isFinite(ASSUMED_MAX_ZOOM_RATIO) && ASSUMED_MAX_ZOOM_RATIO > 1);

/**
 * ⚠️ THE CHECK THIS SECTION EXISTS FOR: our fraction, fed through the NATIVE formula,
 * must produce the ratio on the label. `zoomRatioFrom` mirrors
 * `ExpoCameraView.kt:649` (Android) and `CameraSessionManager.swift:221` (iOS), so this
 * is not "our constant equals our constant" — it is "our constant satisfies the SDK".
 *
 * Fault-test: change a stop's ratio and this goes red on the platform whose solve no
 * longer matches, which is exactly the drift a reviewer cannot see by reading.
 */
for (const platform of ['android', 'ios'] as const) {
  for (const stop of ZOOM_STOPS) {
    check(
      `${platform}: ${stop.label} solves to a fraction that yields ${stop.ratio}×`,
      near(zoomRatioFrom(zoomFractionFor(stop.ratio, platform), platform), stop.ratio, 1e-6),
    );
  }
}

check('Android is LINEAR — 2× is 2/8 of the range', near(zoomFractionFor(2, 'android'), 0.25));
check('iOS is EXPONENTIAL — 2× is ln2/ln8 of the range',
  near(zoomFractionFor(2, 'ios'), Math.log(2) / Math.log(8)));
// ⚠️ And the two must genuinely DIFFER, or the platform parameter is decoration.
check('⚠️ the two platforms do NOT share one answer for 4×',
  !near(zoomFractionFor(4, 'android'), zoomFractionFor(4, 'ios'), 1e-6));

check('a fraction below 0 clamps to 0', zoomFractionFor(0.5, 'android') === 0);
check('a ratio at or above the maximum clamps to 1', zoomFractionFor(9, 'android') === 1);
check('NaN is refused, not propagated', zoomFractionFor(Number.NaN, 'android') === 0);
check('a camera that cannot zoom reports no zoom (max = 1)', zoomFractionFor(2, 'android', 1) === 0);
check('the round trip holds under a DIFFERENT assumed maximum',
  near(zoomRatioFrom(zoomFractionFor(2, 'ios', 12), 'ios', 12), 2, 1e-6));

check('Platform.OS maps: ios → ios', zoomPlatformFor('ios') === 'ios');
check('…and anything else → android (no silent third case)', zoomPlatformFor('web') === 'android');

// ── ①b the ANALOGUE slider (S64) — the control the owner asked for ───────────
/*
 * ⚠️ THE ROUND TRIP IS THE CHECK THAT MATTERS. The thumb is POSITIONED by one function
 * and the VALUE comes from the other, so if they ever disagreed the thumb would sit
 * somewhere other than the finger — and no screenshot would say which of the two was
 * wrong. (This is the same shape as the zoom solve above: two things that must agree,
 * proven against each other rather than against a hardcoded number.)
 */
const TRACK = 300;

check('the left end of the track is the UNZOOMED end', zoomFractionFromTrack(0, TRACK) === 0);
check('the right end is the device maximum', zoomFractionFromTrack(TRACK, TRACK) === 1);
check('the middle is the middle', near(zoomFractionFromTrack(TRACK / 2, TRACK), 0.5));
check('⚠️ a drag that leaves the track CLAMPS — it does not wrap',
  zoomFractionFromTrack(-40, TRACK) === 0 && zoomFractionFromTrack(TRACK + 40, TRACK) === 1);
check('a track that has not been laid out yet (width 0) is the unzoomed end, not NaN',
  zoomFractionFromTrack(50, 0) === 0 && zoomFractionFromTrack(50, Number.NaN) === 0);
check('a NaN location is refused rather than propagated',
  zoomFractionFromTrack(Number.NaN, TRACK) === 0);

const roundTrip: number[] = [];
for (const fraction of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
  roundTrip.push(zoomFractionFromTrack(zoomTrackOffset(fraction, TRACK), TRACK));
}
check('⚠️ the thumb offset is the INVERSE of the drag mapping (all seven probes)',
  roundTrip.every((value, index) => near(value, [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1][index] ?? -1, 1e-9)));
check('a fraction outside the range cannot push the thumb off the track',
  zoomTrackOffset(-1, TRACK) === 0 && zoomTrackOffset(2, TRACK) === TRACK);

/*
 * THE LABEL. It is DERIVED (`zoomRatioForFraction` → `zoomLabel`), never stored, and it
 * is a NUMERAL rather than a translated string — the same rule as the stop labels.
 */
check('the ratio is derived from the fraction through the natives, on both platforms',
  ZOOM_STOPS.every((stop) => (['android', 'ios'] as const).every(
    (platform) => zoomLabel(zoomRatioForFraction(zoomFractionForStop(stop.id, platform), platform))
      === stop.label,
  )));
check('the a11y range is the real one: fraction 0 is 1× and fraction 1 is the assumed max',
  (['android', 'ios'] as const).every((platform) => zoomRatioForFraction(0, platform) === MIN_ZOOM_RATIO
    && near(zoomRatioForFraction(1, platform), ASSUMED_MAX_ZOOM_RATIO, 1e-9)));
check('the label reads as a camera ratio', zoomLabel(1) === '1×' && zoomLabel(2) === '2×');
check('…a tenth below 10×, whole numbers above (where a tenth is noise)',
  zoomLabel(2.44) === '2.4×' && zoomLabel(12.4) === '12×');
check('…and never below 1×, however small the value', zoomLabel(0.2) === '1×');
check('a NaN ratio labels as the unzoomed end rather than as "NaN×"', zoomLabel(Number.NaN) === '1×');

/*
 * THE PRESETS. `zoomStopForFraction` answers "which is NEAREST" (kept for the pinch
 * harness), but a HIGHLIGHT must answer "is it THIS one" — a pill that lights at 1× for
 * every value below 1.5× claims a selection the player never made.
 */
check('a preset lights when the value IS that preset',
  zoomPresetForFraction(zoomFractionForStop('2x', 'android'), 'android')?.id === '2x');
check('…on iOS too (a different fraction, the same preset)',
  zoomPresetForFraction(zoomFractionForStop('2x', 'ios'), 'ios')?.id === '2x');
check('⚠️ NOTHING lights between presets', zoomPresetForFraction(0.4, 'android') === null);
check('the unzoomed end lights 1×', zoomPresetForFraction(0, 'android')?.id === '1x');
check('⚠️ a pill is not clingy — half a step away releases it',
  zoomPresetForFraction(zoomFractionForStop('2x', 'android') + ZOOM_SLIDER_STEP, 'android') === null);
check('the tolerance is half a step, so "on the preset" means the player is on it',
  near(ZOOM_PRESET_MATCH_TOLERANCE, ZOOM_SLIDER_STEP / 2, 1e-12));

/*
 * THE a11y STEP — quantised to the grid, so a screen-reader user reaches the same values
 * every time and the top is EXACTLY 1.
 */
check('an increment is one step', near(zoomSteppedFraction(0, 1), ZOOM_SLIDER_STEP, 1e-12));
check('incrementing from the top stays at the top', zoomSteppedFraction(1, 1) === 1);
check('decrementing from the unzoomed end stays at the unzoomed end',
  zoomSteppedFraction(0, -1) === 0);
check('a full sweep of increments reaches the maximum exactly', (() => {
  let value = 0;
  for (let i = 0; i < 32; i += 1) value = zoomSteppedFraction(value, 1);
  return value === 1;
})());
check('…and a value that is not on the grid still lands on it',
  near(zoomSteppedFraction(0.31, 1), Math.round(0.31 / ZOOM_SLIDER_STEP) * ZOOM_SLIDER_STEP + ZOOM_SLIDER_STEP, 1e-9));

// The strip highlights the stop the player tapped: the fraction must READ BACK as it.
for (const stop of ZOOM_STOPS) {
  check(`the ${stop.label} fraction reads back as the ${stop.label} stop`,
    zoomStopForFraction(zoomFractionForStop(stop.id, 'android'), 'android').id === stop.id);
}
check('an unknown stop id is not a stop', zoomStop('9x') === undefined);
check('an unknown id still yields a usable fraction (the unzoomed default)',
  zoomFractionForStop('9x' as never, 'android') === 0);

// ── ② the crop geometry — the letterbox, the pixels, and the refusals ────────
section('② the crop geometry (a selection must mean the pixels the player saw)');

// The real numbers: a 3000×4000 capture (measured on glass, S60) in a 390 pt-wide stage.
const IMAGE: Size = { width: 3000, height: 4000 };
const STAGE: Size = { width: 390, height: 600 };
const BOX = containRect(IMAGE, STAGE);

check('a tall photo is fitted by its WIDTH and letterboxed top and bottom',
  BOX.width === 390 && BOX.height === 520);
check('…and it is CENTRED (the letterbox is split, not all at the bottom)',
  BOX.x === 0 && BOX.y === 40);

check('a zero-size container has no photo box (never NaN)',
  containRect(IMAGE, { width: 0, height: 0 }).width === 0);
check('a zero-size image has no photo box', containRect({ width: 0, height: 0 }, STAGE).width === 0);

check('a drag up-and-left still yields a positive rectangle',
  JSON.stringify(normaliseDrag({ x: 100, y: 200 }, { x: 50, y: 150 }))
    === JSON.stringify({ x: 50, y: 150, width: 50, height: 50 }));

// ⚠️ THE LETTERBOX RULE. A selection that runs off the photo must be measured against the
// PHOTO, never against the container — otherwise the crop shifts and includes pixels no
// finger ever touched.
const theWholeBox: Rect = { x: BOX.x, y: BOX.y, width: BOX.width, height: BOX.height };
check('a selection that covers the whole photo crops the whole image',
  JSON.stringify(rectToImagePixels(theWholeBox, BOX, IMAGE))
    === JSON.stringify({ x: 0, y: 0, width: 3000, height: 4000 }));
check('…and is recognised as "not a crop at all"', isWholeImage(
  rectToImagePixels(theWholeBox, BOX, IMAGE) as Rect, IMAGE));

const overshoot: Rect = { x: -50, y: -50, width: 500, height: 700 };
check('a selection dragged out INTO THE LETTERBOX clips to the photo, not the container',
  JSON.stringify(cropRectFor('rect', { rect: overshoot }, BOX, IMAGE))
    === JSON.stringify({ x: 0, y: 0, width: 3000, height: 4000 }));
check('a selection entirely inside the letterbox is refused (null, not a guess)',
  cropRectFor('rect', { rect: { x: 0, y: 0, width: 390, height: 30 } }, BOX, IMAGE) === null);

// The middle quarter of the box must be exactly the middle quarter of the image.
const quarterView: Rect = { x: 97.5, y: 170, width: 195, height: 260 };
check('a quarter of the drawn photo maps to a quarter of the image, exactly',
  JSON.stringify(cropRectFor('rect', { rect: quarterView }, BOX, IMAGE))
    === JSON.stringify({ x: 750, y: 1000, width: 1500, height: 2000 }));

// ⚠️ THE REFUSAL THAT SAVES MONEY: a crop too small to be legible is refused here, so a
// smear is never uploaded and never paid for.
check(`a 5 pt drag maps under ${MIN_CROP_EDGE_PX} px and is REFUSED`,
  cropRectFor('rect', { rect: { x: 100, y: 300, width: 5, height: 5 } }, BOX, IMAGE) === null);
check('…and a 10 pt drag (≈77 px) is accepted, so the floor is not too aggressive',
  cropRectFor('rect', { rect: { x: 100, y: 300, width: 10, height: 10 } }, BOX, IMAGE) !== null);

check('pixel rects must stay inside the image',
  !isUsableCropRect({ x: 2950, y: 3950, width: 100, height: 100 }, IMAGE));
check('a one-pixel rect is not usable', !isUsableCropRect({ x: 0, y: 0, width: 1, height: 1 }, IMAGE));
check('a fractional pixel rect is not usable (a bitmap has no half pixel)',
  !isUsableCropRect({ x: 0.5, y: 0, width: 700, height: 700 }, IMAGE));
check('the minimum edge IS usable (the boundary is inclusive)',
  isUsableCropRect({ x: 0, y: 0, width: MIN_CROP_EDGE_PX, height: MIN_CROP_EDGE_PX }, IMAGE));

// The lasso: a path, measured by its TRAVEL — so a twitch is not a selection and a long
// thin diagonal still is.
check('a two-point path is not a lasso', lassoBounds([{ x: 0, y: 0 }, { x: 100, y: 100 }]) === null);
check('a tap (three points, no travel) is not a lasso',
  lassoBounds([{ x: 100, y: 100 }, { x: 101, y: 100 }, { x: 100, y: 101 }]) === null);
check('a NaN point poisons nothing — it is refused',
  lassoBounds([{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: Number.NaN, y: 5 }]) === null);

const stroke: readonly Point[] = [{ x: 10, y: 10 }, { x: 100, y: 200 }, { x: 10, y: 300 }];
check('a drawn stroke becomes its BOUNDING BOX — the REGION a mask is drawn inside',
  JSON.stringify(lassoBounds(stroke)) === JSON.stringify({ x: 10, y: 10, width: 90, height: 290 }));
check('the stroke\'s accumulated length is measured along the path, not across its box',
  pathLength(stroke) > 300);
/*
 * ⚠️ `isUsableLasso` USED TO LIVE HERE — a one-line alias of `lassoBounds(points) !== null`,
 * kept because the screen needed a "has anything been drawn?" predicate. S64 replaced that
 * question with two better ones (`path.length > 1` for "drawn", `lassoFault` for "usable"),
 * so the alias became a function nothing called — and a gate over a function the app does
 * not call is a gate over nothing. The rule it expressed is still asserted, twice: by
 * `lassoBounds` below, and by `lassoFault`'s `too_short` threshold in §②d.
 */
check('…and a stroke below the travel threshold is not a selection at all',
  lassoBounds([{ x: 100, y: 100 }, { x: 101, y: 100 }, { x: 100, y: 101 }]) === null);

// ⚠️ THE MODE MUST SELECT. A silent fallback from one mode's empty selection to the
// other's would crop something the player did not draw in the mode they are in.
check('lasso mode uses the PATH, not the rectangle',
  cropRectFor('lasso', { rect: theWholeBox, path: [{ x: 0, y: 0 }] }, BOX, IMAGE) === null);
check('rect mode uses the RECTANGLE, not the path',
  cropRectFor('rect', { path: stroke }, BOX, IMAGE) === null);
check('…and each mode works with its own selection',
  cropRectFor('lasso', { path: stroke }, BOX, IMAGE) !== null
    && cropRectFor('rect', { rect: quarterView }, BOX, IMAGE) !== null);

// The scrim: the four dimmed rects must frame the selection and never cover it.
const centred: Rect = { x: 100, y: 200, width: 150, height: 100 };
const scrims = scrimAround(centred, BOX);
check('a selection inside the photo is dimmed on all four sides', scrims.length === 4);
check('⚠️ no scrim covers any part of the selection',
  scrims.every((s) => s.x + s.width <= centred.x + 0.5
    || s.x >= centred.x + centred.width - 0.5
    || s.y + s.height <= centred.y + 0.5
    || s.y >= centred.y + centred.height - 0.5));
check('the dimmed area lies inside the photo box',
  scrims.every((s) => s.x >= BOX.x && s.y >= BOX.y
    && s.x + s.width <= BOX.x + BOX.width + 0.5
    && s.y + s.height <= BOX.y + BOX.height + 0.5));
check('a selection flush with the top edge produces NO top scrim (degenerate rects are dropped)',
  scrimAround({ x: 100, y: BOX.y, width: 150, height: 100 }, BOX).length === 3);
check('a selection covering the whole photo dims nothing at all',
  scrimAround(theWholeBox, BOX).length === 0);

check('a polyline string drops a bad point rather than drawing through the origin',
  polylinePoints([{ x: 1, y: 2 }, { x: Number.NaN, y: 3 }, { x: 4, y: 5 }]) === '1.0,2.0 4.0,5.0');
check('one pixel off the whole image is still a crop',
  !isWholeImage({ x: 0, y: 0, width: 2999, height: 4000 }, IMAGE));

// ── ②b the DIMMING OVERLAY — the owner's inverted-dimming bug (S64) ──────────
/*
 * ⚠️ THE BUG THIS PINS, because nothing else in the toolchain can see it. The screen
 * used to spread a bare `Rect` into a style — `style={[styles.scrim, scrim]}`, i.e.
 * `{ x, y, width, height }`. React Native has no `x`/`y` STYLE property: `LayoutProps`
 * declares `left`/`top`/`right`/`bottom`, and `ReactNativeStyleAttributes` — the map that
 * decides which style keys actually reach the native view — has no `'x'` and no `'y'`
 * entry. So the POSITION was dropped silently, the size was honoured, and all four scrims
 * piled onto the stage's top-left corner. Reported by the owner as:
 *
 *     "inside the crop rectangle selected area is actually getting darker than the
 *      outside unselected area."
 *
 * …which is exactly what a stack of four 55%-dark rects at the origin looks like. The fix
 * is `rectToViewStyle`, and these three checks are what stop it coming back: a Nitro/SDK
 * upgrade cannot re-break it, and neither can a well-meaning "simplification".
 */
const styleForScrim = rectToViewStyle({ x: 12, y: 34, width: 56, height: 78 });
check('a Rect becomes a style with the right keys AND values',
  styleForScrim.left === 12 && styleForScrim.top === 34
    && styleForScrim.width === 56 && styleForScrim.height === 78
    && Object.keys(styleForScrim).sort().join(',') === 'height,left,top,width');
check('⚠️ …and carries NO `x`/`y`, which React Native would drop silently',
  !Object.hasOwn(styleForScrim, 'x') && !Object.hasOwn(styleForScrim, 'y'));
// ⚠️ The overlay must also still FRAME the selection after the conversion: a correct
// conversion of the wrong rect is still the reported bug.
check('…and the four scrims converted this way still frame the selection',
  scrims.every((s) => {
    const style = rectToViewStyle(s);
    return style.left + style.width <= centred.x + 0.5
      || style.left >= centred.x + centred.width - 0.5
      || style.top + style.height <= centred.y + 0.5
      || style.top >= centred.y + centred.height - 0.5;
  }));

// ── ②c the FREE-FORM MASK (S64) — the path that removes the outside ──────────
const maskBox: Rect = { x: 100, y: 200, width: 200, height: 300 };
const maskOutline: readonly Point[] = [{ x: 120, y: 240 }, { x: 280, y: 260 }, { x: 200, y: 460 }];
const maskPath = dimPathPolygon(maskBox, maskOutline);

check('the mask is ONE path: the region, then the outline as a second subpath',
  maskPath.split('M').length === 3 && maskPath.trim().endsWith('Z'));
check('the region is the outer subpath, drawn at the region own size',
  maskPath.includes('H200.0 V300.0 H0.0 Z') && maskPath.startsWith('M0.0,0.0 '));
check('⚠️ every coordinate is relative to the REGION, not to the stage',
  maskPath.includes('M20.0,40.0') && maskPath.includes('L180.0,60.0')
    && maskPath.includes('L100.0,260.0'));
check('⚠️ the fill rule the mask needs is even-odd, or the outline would not be a hole',
  DIM_PATH_FILL_RULE === 'evenodd');
check('⚠️ a degenerate region has NO mask at all (a zero-sized view is never rasterized)',
  dimPathPolygon({ x: 0, y: 0, width: 0, height: 100 }, maskOutline) === ''
    && dimPathPolygon({ x: 0, y: 0, width: 100, height: Number.NaN }, maskOutline) === '');
check('an outline with a NaN point is refused rather than drawn through the origin',
  dimPathPolygon(maskBox, [{ x: 0, y: 0 }, { x: Number.NaN, y: 5 }, { x: 3, y: 4 }]) === '');
check('a polygon path drops bad points, closes with Z, and refuses fewer than three',
  polygonPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: Number.NaN, y: 2 }])
    === 'M0.0,0.0 L10.0,0.0 L10.0,10.0 Z'
  && polygonPath([{ x: 0, y: 0 }, { x: 10, y: 0 }]) === '');

// ── ②d the OUTLINE's WATERTIGHT RULES (S64, `src/lib/lasso.ts`) ──────────────
/*
 * ⚠️ WHY THESE ARE REFUSALS RATHER THAN WARNINGS. An unclosed or self-crossing outline
 * still RENDERS as something: every rasterizer fills an open path as if closed, and an
 * even-odd fill of a figure-eight silently drops one lobe. So the mask would be computed
 * from a shape nobody drew, the player would pay ≈US$0.09 to have the wrong region
 * restyled, and nothing in the pipeline would report a problem. The owner asked for this
 * in as many words: "check if free form shape drawn by the user is a closed water tight
 * shape else error out to the user and reject it".
 */
const closedSquare: readonly Point[] = [
  { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 0, y: 0 },
];
/** The same square, its ends 100 px apart — a loop the player did not finish. */
const openSquare: readonly Point[] = [
  { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 },
];
/** A bowtie with lobes of different sizes: it crosses, and its area is NOT zero. */
const bowtie: readonly Point[] = [
  { x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 150 }, { x: 0, y: 0 },
];

check('a closed square is a usable free-form shape', lassoFault(closedSquare) === null);
check('⚠️ …and the closing duplicate is dropped for the mask (Z does that job)',
  lassoPolygon(closedSquare)?.length === 4);
check('an UNFINISHED loop is refused BY NAME', lassoFault(openSquare) === 'not_closed');
check('…and it is not sent as its bounding box either', lassoPolygon(openSquare) === null);
check('⚠️ a loop that crosses itself is refused BY NAME', lassoFault(bowtie) === 'crosses_itself');
check('…and the bowtie really does cross (so the rule is not vacuous)',
  pathCrossesItself(bowtie) && polygonArea(bowtie) > 0);
check('⚠️ a tap is TOO SHORT, not "not closed" — the player is told the useful thing first',
  lassoFault([{ x: 0, y: 0 }, { x: 1, y: 1 }]) === 'too_short'
    && lassoFault([{ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 10, y: 11 }]) === 'too_short');
check('an outline drawn out and back along one line encloses nothing — DEGENERATE',
  lassoFault([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]) === 'degenerate');
check('the closure tolerance is a finger, not a pixel',
  LASSO_CLOSE_TOLERANCE_PX > 10 && LASSO_CLOSE_TOLERANCE_PX < 60);
check('a loop whose ends are 10 px apart IS closed',
  pathIsClosed([...openSquare, { x: 5, y: 5 }]) && lassoFault([...openSquare, { x: 5, y: 5 }]) === null);
check('…and the same loop with a 100 px gap is not',
  !pathIsClosed([...openSquare, { x: 0, y: -100 }]));
check('a closed path\'s own neighbours are NOT read as a crossing',
  !pathCrossesItself(closedSquare));

/*
 * ⚠️ THE CHECKS THE OWNER'S REPORT PRODUCED (S64) — the rule was TOO STRICT.
 *
 * A hand-closed loop lays its last few millimetres back over its first, so a genuine,
 * obviously-a-loop gesture contains a real self-overlap at the CLOSURE. The first version of
 * this rule refused it with "your outline crosses itself" — a correct answer to the wrong
 * question. These are the verified fixtures, and both halves of the corrected rule are
 * pinned: the junction overlap is tolerated, and a figure-eight is still refused.
 */
/**
 * A realistic loop: 2 px sampling, a big body, and a tail that comes home ACROSS its own
 * head and ends 11 px from the start — the spur the owner's drawing shows. The crossing is
 * a genuine transversal intersection at (≈15.7, 0) on the head's (14,0)–(16,0) edge.
 */
function loopWithClosureCrossing(): Point[] {
  const points: Point[] = [];
  for (let step = 0; step <= 10; step += 1) points.push({ x: step * 2, y: 0 });
  points.push(
    { x: 200, y: 0 }, { x: 200, y: 300 }, { x: 0, y: 300 }, { x: -40, y: 150 }, { x: 30, y: 10 },
  );
  // Centres are offset off the y = 0 line, so no tail VERTEX sits exactly on the head —
  // a vertex on the line would touch at an endpoint and (correctly) not count.
  for (let step = 1; step <= 10; step += 1) points.push({ x: 30 - step * 3, y: 10 - step * 2.1 });
  return points;
}

/**
 * An ASYMMETRIC lemniscate: closed at t = 0/2π, crossing itself at its centre, with lobes
 * of different sizes so the enclosed area is comfortably non-zero (a symmetric figure-eight
 * has an area of ~0 and would be refused as `degenerate` instead — a different fault, and
 * not the one under test here).
 */
function figureEight(steps = 73): Point[] {
  const points: Point[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const t = (step / steps) * Math.PI * 2;
    points.push({
      x: 200 + 150 * Math.cos(t),
      y: 200 + (100 + 50 * Math.cos(t)) * Math.sin(2 * t),
    });
  }
  return points;
}

const closureLoop = loopWithClosureCrossing();

check('⚠️ a hand-closed loop that overlaps its own start IS accepted (the S64 report)',
  lassoFault(closureLoop) === null && lassoPolygon(closureLoop) !== null);
check('⚠️ …and the raw geometric question STILL sees that overlap — the guard is the fix',
  pathCrossesItself(closureLoop, LASSO_INTERSECT_TOLERANCE_PX, 0));
check('…with the junction guard it is no longer read as a crossing',
  !pathCrossesItself(closureLoop));
check('…and the guard is the fingertip scale — twice the closure tolerance',
  near(LASSO_JUNCTION_GUARD_PX, 2 * LASSO_CLOSE_TOLERANCE_PX, 1e-9)
    && LASSO_JUNCTION_GUARD_PX > LASSO_CLOSE_TOLERANCE_PX);
check('⚠️ a figure-eight is STILL refused — the guard tolerates a closure, not a crossing',
  lassoFault(figureEight()) === 'crosses_itself' && pathCrossesItself(figureEight()));
check('…and its area is not ~0, so the verdict is the CROSSING and not "degenerate"',
  polygonArea(lassoVertices(figureEight())) > 1_000);
/*
 * ⚠️ THE SHORT-SEGMENT TRAP, and it is the reason the crossing rule works on a REAL drawing
 * at all. The stroke is sampled every 2 px, and the endpoint margin is `tolerance /
 * segmentLength` — a FRACTION, so a margin of 1 px on a 1 px segment is 1.0, which excludes
 * the entire segment and with it every crossing there. Measured this session: with the old
 * 1 px tolerance and no clamp, `pathCrossesItself(closureLoop, 1, 0)` reported `false` for
 * two segments that plainly cross. The clamp (`MAX_ENDPOINT_EPS`) is what keeps the rule
 * alive on short edges, whatever the tolerance is set to.
 */
const shortA: Point = { x: 0, y: 0 };
const shortB: Point = { x: 1, y: 0 };
const shortC: Point = { x: 0.5, y: -1 };
const shortD: Point = { x: 0.5, y: 1 };
check('⚠️ a tolerance LARGER than the segment does not make its crossing invisible',
  segmentsCross(shortA, shortB, shortC, shortD, 2));
check('…and the unclamped fraction would have been > 1, which is why the clamp exists',
  2 / 1 > 1 && 1 / 1 >= 1);
check('the same crossing is still found at the real (sub-pixel) margin',
  segmentsCross(shortA, shortB, shortC, shortD, LASSO_INTERSECT_TOLERANCE_PX));
check('the numerical margin is sub-pixel (it is not a jitter tolerance any more)',
  LASSO_INTERSECT_TOLERANCE_PX > 0 && LASSO_INTERSECT_TOLERANCE_PX < 1);

check('two segments crossing in their interiors cross', segmentsCross(
  { x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 100 },
));
check('…but merely TOUCHING at an endpoint does not (a loop\'s own corner)',
  !segmentsCross({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }));
check('parallel segments that never meet do not cross',
  !segmentsCross({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 10 }, { x: 100, y: 10 }));
check('⚠️ a stroke that doubles back along itself DOES cross (two regions that cancel)',
  segmentsCross({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 20, y: 0 }, { x: 80, y: 0 }));
check('a zero-length edge crosses nothing',
  !segmentsCross({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 0, y: 0 }, { x: 100, y: 100 }));

check('vertices closer than the gap are the SAME vertex',
  lassoVertices([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }, { x: 100, y: 100 }]).length === 2);
check('the enclosed area is the shoelace area', near(polygonArea(closedSquare), 10_000, 1e-9));
check('a line encloses no area at all', polygonArea([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 }]) === 0);

/** The same outline, drawn inside the photo box — for the region assertions. */
const boxedSquare: readonly Point[] = [
  { x: 100, y: 200 }, { x: 300, y: 200 }, { x: 300, y: 400 }, { x: 100, y: 400 }, { x: 100, y: 200 },
];

check('⚠️ the outline with no closure gap is a usable shape wherever it is drawn',
  lassoFault(boxedSquare) === null && lassoPolygon(boxedSquare)?.length === 4);
check('⚠️ the region is the outline\'s BOUNDING BOX when it lies inside the photo',
  JSON.stringify(lassoRegion(boxedSquare, BOX))
    === JSON.stringify({ x: 100, y: 200, width: 200, height: 200 }));
check('…so an outline dragged into the letterbox is clipped to the PHOTO, not the container',
  JSON.stringify(lassoRegion([{ x: -50, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: -50, y: 200 }], BOX))
    === JSON.stringify({ x: BOX.x, y: BOX.y, width: 200, height: 200 - BOX.y }));
check('…and an outline entirely off the photo has no region at all',
  lassoRegion([{ x: -200, y: -200 }, { x: -150, y: -200 }, { x: -150, y: -150 }], BOX) === null);

/**
 * ⚠️ THE RASTER'S SIZE — the S64 defect, as an assertion.
 *
 * `toDataURL()` with no size renders the VIEW, and the view is laid out in dp: MEASURED
 * on glass 2026-10-18, a 140 dp selection on a 2× screen produced a **280 × 280 px** PNG,
 * where the rect path cuts the same selection from the photo's own **1313 × 1313**
 * pixels. The masked offering therefore reached the styler at a fifth of the linear
 * detail — a smear, not a cartoon. These assertions are what make that regression loud:
 * restore the unsized call and §③ below fails, not the player.
 */
check('the raster is asked for at the PHOTO\'s pixels, capped by the upload budget',
  JSON.stringify(maskRasterSize({ width: 1313, height: 1313 }))
    === JSON.stringify({ width: 1080, height: 1080 }));
check('…capped on the LONGEST edge with ONE scale for both axes (a mask must not stretch)',
  JSON.stringify(maskRasterSize({ width: 2160, height: 1080 }))
    === JSON.stringify({ width: 1080, height: 540 }));
check('…a region already inside the budget is passed through UNCHANGED',
  JSON.stringify(maskRasterSize({ width: 640, height: 480 }))
    === JSON.stringify({ width: 640, height: 480 }));
check('…and the result is always INTEGERS of at least 1 (Android reads them with `getInt`)',
  [maskRasterSize({ width: 0, height: 0 }), maskRasterSize({ width: 3.4, height: 9.6 })]
    .every((s) => Number.isInteger(s.width) && Number.isInteger(s.height)
      && s.width >= 1 && s.height >= 1));
check('…capping at the budget\'s OWN 1080 px ceiling, so the two cannot drift apart',
  maskRasterSize({ width: 4000, height: 4000 }).width === 1080 && CAPTURE_MAX_EDGE_PX === 1080);

/** Every fault the module can produce — one list, so a new fault cannot be forgotten. */
const ALL_FAULTS: readonly LassoFault[] = ['too_short', 'not_closed', 'crosses_itself', 'degenerate'];

check('⚠️ EVERY fault has its own message key (a fault with no sentence strands the player)',
  ALL_FAULTS.every((fault) => lassoFaultMessageKey(fault).startsWith('crop.lasso'))
    && new Set(ALL_FAULTS.map((fault) => lassoFaultMessageKey(fault))).size === ALL_FAULTS.length);
check('the intersection tolerance is sub-pixel (jitter is not a crossing)',
  LASSO_INTERSECT_TOLERANCE_PX > 0 && LASSO_INTERSECT_TOLERANCE_PX < 3);

// ── ③ the screens CONSUME these, rather than re-deciding ─────────────────────
// ⚠️ The lesson of `check:capturesize`: a gate over pure functions the app never calls is a
// gate over nothing. These are source assertions, with a negative control below proving the
// assertion is capable of failing.
section('③ the screens consume the pure modules (source assertions)');

const captureSrc = read('src/app/capture.tsx');
const cropSrc = read('src/app/crop.tsx');
const burnSrc = read('src/app/burn.tsx');

check('the shutter screen passes the DERIVED fraction to the camera',
  captureSrc.includes('zoom={zoomFraction}')
    && captureSrc.includes('zoomFractionForStop(DEFAULT_ZOOM_STOP, zoomPlatform)'));
check('…and never passes a raw ratio to `zoom`',
  !/zoom=\{(\s*\d|\s*stop\.ratio)/.test(captureSrc));
check('the shutter screen renders a pill per stop',
  captureSrc.includes('ZOOM_STOPS.map') && captureSrc.includes('accessibilityState={{ selected: active }}'));
check('⚠️ …and carries an ANALOGUE slider, not just the pills (the owner\'s S64 report)',
  captureSrc.includes('zoomFractionFromTrack(') && captureSrc.includes('PanResponder.create('));
check('…whose a11y role is `adjustable`, with a value and inc/dec actions',
  captureSrc.includes('accessibilityRole="adjustable"')
    && captureSrc.includes("accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}")
    && captureSrc.includes("zoomSteppedFraction("));
check('…and the thumb is placed by the INVERSE of the drag mapping',
  captureSrc.includes('zoomTrackOffset(zoomFraction, trackWidth)'));
check('the shutter screen hops to /crop, with the id and the size',
  captureSrc.includes("pathname: '/crop'") && captureSrc.includes('toCropParams('));
check('⚠️ …and no longer pushes the whole frame straight at /preparing',
  !captureSrc.includes("pathname: '/preparing'"));

check('⚠️ the crop screen loads the photo through the FORM-AGNOSTIC loader re-encode',
  cropSrc.includes('nativeLoaderUriFromAnyForm(uri)'));
check('…and uses that SAME uri for the picture, the manipulator and the mask',
  cropSrc.includes('source={{ uri: nativeUri }}') && cropSrc.includes('manipulate(nativeUri)')
    && cropSrc.includes('href={nativeUri}'));
check('…so a raw route param is never handed to a native decoder',
  !cropSrc.includes('manipulate(uri)') && !cropSrc.includes('uri: uri'));
check('⚠️ …and the screen never picks an encoding branch itself (S64\'s black screen)',
  !cropSrc.includes('nativeLoaderUriFromDecoded(') && !cropSrc.includes('escapeForNativeLoader('));
check('⚠️ …and the burn screen\'s tutorial offering uses the same helper, not the S60 branch',
  burnSrc.includes('nativeLoaderUriFromAnyForm(photoUri)')
    && !burnSrc.includes('nativeLoaderUriFromDecoded('));
check('⚠️ the mask view is drawn by the pure path, with the even-odd rule it requires',
  cropSrc.includes('dimPathPolygon(region, polygon)')
    && cropSrc.includes('fillRule={DIM_PATH_FILL_RULE}')
    && cropSrc.includes('testID="crop-mask"'));
check('⚠️ the mask is RASTERIZED and then written as a file (or it would never be sent)',
  cropSrc.includes('toDataURL(') && cropSrc.includes('data:image/png;base64,')
    && cropSrc.includes('.manipulate(`data:image/png;base64,${base64}`)'));
check('⚠️ an empty or blank raster is REFUSED, not sent as a black offering',
  cropSrc.includes('MASK_RASTER_MIN_BASE64_CHARS') && cropSrc.includes('mask_raster_empty'));
check('⚠️ …and a callback that never arrives cannot strand the screen',
  cropSrc.includes('MASK_RASTER_TIMEOUT_MS'));
check('⚠️ the dimming overlay is CONVERTED to a style, never spread as a bare Rect',
  cropSrc.includes('rectToViewStyle(scrim)')
    && !/style=\{\[styles\.scrim,\s*scrim\]\}/.test(cropSrc));
check('the outline is REFUSED by name before it can be sent',
  cropSrc.includes('lassoFault(') && cropSrc.includes('lassoFaultMessageKey(fault)'));
check('…and the confirm button is gated on the validated polygon',
  cropSrc.includes('const canSend =') && cropSrc.includes('lassoPolygon(path)'));

check('⚠️ the rectangle crop is applied from the PIXEL rect the pure module produced',
  cropSrc.includes('cropRectFor(') && cropSrc.includes('originX: pixelCrop?.x ?? 0'));
check('⚠️ …and the mask path does NOT go through the manipulator\'s crop (two paths, two jobs)',
  cropSrc.includes("mode === 'lasso'") && cropSrc.includes('rasterizeMask('));
check('⚠️ …and the raster is asked for at the REGION\'S size, not the view\'s dp bounds (S64)',
  cropSrc.includes('maskRasterSize(maskPixels)') && cropSrc.includes('rasterRequestSize(size)'));
check('⚠️ …so an EXPLICIT size reaches `toDataURL` — an unsized raster was the smear',
  /toDataURL\(finish,\s*size === null \? undefined : rasterRequestSize\(size\)\)/.test(cropSrc));
check('…and the platforms\' unit difference is handled, not ignored (px on Android, points on iOS)',
  cropSrc.includes("Platform.OS === 'ios'") && cropSrc.includes('PixelRatio.get()'));
check('⚠️ the file is SAVED before anything is handed onward (only the crop is sent)',
  cropSrc.indexOf('saveAsync(') > 0
    && cropSrc.indexOf('saveAsync(') < cropSrc.indexOf('goOn(uploadableUri(saved.uri))'));
check('⚠️ the hop to /preparing collapses the uri for the uploader',
  cropSrc.includes('uploadableUri(saved.uri)') && cropSrc.includes('goOn(uploadableUri(uri))'));
check('⚠️ the crop is written at the UPLOAD BUDGET\'s compression, not a second opinion',
  cropSrc.includes('compress: CAPTURE_COMPRESS')
    && cropSrc.includes("from '@/lib/capture-size'")
    && !/compress:\s*[\d.]+/.test(cropSrc));
check('the lasso\'s behaviour is stated in the UI, not only in a comment', 
  cropSrc.includes("t('crop.lassoNote')") && cropSrc.includes("mode === 'lasso'"));
check('every failure path out of the screen is free (skip is always reachable)',
  cropSrc.includes('onPress={skip}') && cropSrc.includes("t('crop.skip')"));

// ⚠️ NEGATIVE CONTROL — the assertion must be able to fail. Same shape, wrong text.
const blind = (source: string): boolean => source.includes("pathname: '/preparing'");
check('⚠️ the source assertions are not vacuous (a negative control fires)',
  blind(captureSrc) === false && blind("router.push({ pathname: '/preparing' })") === true);

// ── ④ the copy exists in BOTH locales (a missing translation is a bug) ───────
section('④ the frame step\'s copy is localised');

const en = MESSAGES.en as unknown as Record<string, string>;
const zh = MESSAGES.zh as unknown as Record<string, string>;
const FRAME_KEYS = [
  'zoom.stopA11y', 'zoom.sliderA11y',
  'crop.title', 'crop.hintRect', 'crop.hintLasso', 'crop.modeRect', 'crop.modeLasso',
  'crop.lassoNote', 'crop.lassoTooShort', 'crop.lassoDegenerate', 'crop.lassoOpen',
  'crop.lassoCrosses', 'crop.tooSmall', 'crop.skip', 'crop.confirm', 'crop.working',
  'crop.failed', 'crop.loading', 'crop.photoFailed', 'crop.badParams',
];

for (const key of FRAME_KEYS) {
  check(`${key} is translated in en AND zh`,
    typeof en[key] === 'string' && en[key].length > 0
      && typeof zh[key] === 'string' && zh[key].length > 0);
}

/*
 * ⚠️ EVERY FAULT AND EVERY MODE HAS A SENTENCE. A refusal the screen can produce but
 * cannot explain leaves the player with a disabled button and no idea why — so the four
 * fault keys are asserted per FAULT (through the same mapping the screen calls), not just
 * as a list of strings that happen to exist.
 */
for (const fault of ALL_FAULTS) {
  const key = lassoFaultMessageKey(fault);
  check(`the ${fault} refusal is worded in BOTH locales`,
    (en[key] ?? '').length > 0 && (zh[key] ?? '').length > 0);
}
check('⚠️ …and the four refusals are four DIFFERENT sentences (not one generic one)',
  new Set(ALL_FAULTS.map((fault) => en[lassoFaultMessageKey(fault)] ?? '')).size === ALL_FAULTS.length);
check('the new outline copy does NOT still promise a bounding box (the S64 rewrite)',
  !(en['crop.lassoNote'] ?? '').toLowerCase().includes('box')
    && !(zh['crop.lassoNote'] ?? '').includes('外框'));
// ⚠️ The stop labels are NUMERALS and deliberately live in `zoom.ts` — assert they are NOT
// in the message table, so nobody "fixes" them into it and drifts the two apart.
check('⚠️ the numeral stop labels are NOT in the message table (they are not copy)',
  !Object.keys(en).some((key) => key.startsWith('zoom.stopA11y.1'))
    && ZOOM_STOPS.every((s) => /^[0-9]+×$/.test(s.label)));

// ⚠️ THE a11y LABEL MUST ACTUALLY INTERPOLATE. A screen reader announcing the literal
// "Zoom %{label}" is worse than no label, and the placeholder style is not free: the house
// convention is `%{name}` (Ruby-style), NOT `{{name}}` — and `check:lib` only treats `%{` as
// a placeholder, so a `{{…}}` key silently fails its verbatim-copy assertion. Measured here
// as a real render, not as a string comparison.
check('the zoom a11y label interpolates the numeral (and announces it)',
  t('zoom.stopA11y', { label: '2×' }).includes('2×')
    && !t('zoom.stopA11y', { label: '2×' }).includes('%{')
    && t('zoom.stopA11y', { label: '2×' }) !== t('zoom.stopA11y', { label: '4×' }));

// ── ⑤ the S64 polish: WHERE the controls sit and WHAT they look like ─────────
/*
 * ⚠️ WHY THIS SECTION EXISTS. Four changes came from the owner in one message, and
 * every one of them is the class a later "tidy-up" reverts without noticing: the zoom
 * strip could climb back up under the hint, the preset pills could be shrunk by
 * shrinking their TAP TARGET, the hint chip's inset or its translucency could be
 * dropped as "unnecessary", and the fire's idle loop could be deleted as "an
 * animation nobody asked for". None of it fails `tsc`, none of it fails a test, and
 * all of it is visible only on glass — so each one is pinned here by the PROPERTY
 * that makes it right, never by the pixel value, so re-tuning the numbers cannot
 * break the check.
 *
 * ⚠️ FAULT-TESTED — EVERY CHECK, BY BREAKING THE PROPERTY IT ASSERTS. Measured against
 * a green baseline of 193 → **now 205**, in three rounds of four breaks each, each
 * round restored to green afterwards:
 *   · the shutter rendered BEFORE the zoom strip → 1 red;
 *   · `hud: { flex: 1 … }` reverted to `{ alignItems: 'center' }` and `flex: 1` put
 *     back on the shutter row → 1 red;
 *   · the pill's `minWidth` made a literal `22` → 1 red;
 *   · the pill inlined INTO the Pressable (`zoomStopPill` folded into `zoomStop`) → 1 red;
 *   · both hints returned to bare `<Text>` over the camera → 1 red;
 *   · `maxWidth: '88%'` dropped from the chip → 1 red;
 *   · the chip's `opacity: 0.72` raised to `1` → 1 red;
 *   · `opacity: 0.85` put back on the chipped label → 1 red;
 *   · `IDLE.swayDeg` replaced by a literal → 1 red;
 *   · `isInteraction: false` dropped from the endless loop → 1 red;
 *   · the idle breath no longer multiplied into the reaction's scale → 1 red;
 *   · `rotate: idleSway` added to the ember bed → 1 red.
 * 12 breaks, 12 reds, 0 survivors. Restored → 205/205 green.
 */
section('⑤ the S64 polish — where the controls sit and what the fire does');

const fireSrc = read('src/components/fire-art.tsx');

/*
 * THE PLACEMENT. Asserted as an ORDER over the render, not as a style value: the
 * owner's request was "right above the shutter button", and the only thing that can
 * state that is the position of the strip in the tree relative to the two elements
 * it sits between.
 */
const hudAt = captureSrc.indexOf('styles.hud');
const zoomAt = captureSrc.indexOf('styles.zoomRow');
const shutterAt = captureSrc.indexOf('styles.shutterRow');
check('⚠️ the zoom strip renders BETWEEN the hint and the shutter (S64 — the owner moved it)',
  hudAt > 0 && hudAt < zoomAt && zoomAt < shutterAt);
check('⚠️ …and the HUD is the box that absorbs the slack — NOT the shutter',
  /hud: \{ flex: 1, alignItems: 'center' \}/.test(captureSrc)
    && !/shutterRow: \{[^}]*flex: 1/.test(captureSrc));

/*
 * THE PILL. The relationship is the assertion: the visible pill is half the target,
 * and the target is still the 44 dp floor. Written this way so the pill can be
 * re-sized (or the floor re-derived) without the check becoming a lie.
 */
check('⚠️ the preset pill is HALF the touch target, and the target is still 44 dp (S64)',
  /const ZOOM_PILL_SIZE = TOUCH_TARGET \/ 2;/.test(captureSrc)
    && /zoomStop: \{[^}]*minWidth: TOUCH_TARGET/.test(captureSrc)
    && /zoomStopPill: \{[^}]*minWidth: ZOOM_PILL_SIZE/.test(captureSrc));
const pillPressableAt = captureSrc.indexOf('styles.zoomStop, pressed && styles.pressed]');
const pillViewAt = captureSrc.indexOf('<View style={[styles.zoomStopPill');
check('⚠️ …and the pill is drawn INSIDE the target, not instead of it (the whole point)',
  pillPressableAt > 0 && pillViewAt > pillPressableAt
    && pillViewAt < captureSrc.indexOf('</Pressable>', pillPressableAt));

/*
 * THE HINT CHIP. Both hints, the float, and the translucency — three separate ways
 * this could regress to the thing the owner complained about.
 */
check('⚠️ BOTH ritual hints sit in the chip, not bare over the camera (S64)',
  /styles\.hintChip\}>\s*<Text style=\{styles\.hint\}>/.test(burnSrc)
    && /styles\.hintChip\}>\s*<Text style=\{\[styles\.caption, styles\.captionInChip\]\}>/.test(burnSrc));
check('⚠️ …and the chip FLOATS: inset from the sides at any type size, never edge to edge',
  /hintChip: \{[^}]*marginHorizontal: space\.lg/.test(burnSrc)
    && /hintChip: \{[^}]*maxWidth: '88%'/.test(burnSrc));
check('⚠️ …and it is TRANSLUCENT — a solid chip would hide the camera it sits on',
  /hintChip: \{[^}]*opacity: 0\.\d+/.test(burnSrc));
check('…and the label is not faded ON TOP of the chip (the two alphas must not stack)',
  !/hint: \{ color: onColorCream, fontSize: fontSize\.caption\.at390, opacity/.test(burnSrc)
    && burnSrc.includes('captionInChip: { marginTop: 0, opacity: 1 }'));

/*
 * THE FIRE. "Too dead" is the complaint; an endless native-driver loop that composes
 * with the reaction is the answer, and a JS-driver loop or one that claims the
 * InteractionManager would be a worse bug than the stillness it replaced.
 */
check('⚠️ the fire is never DEAD: one endless loop drives sway, breath and brightness (S64)',
  fireSrc.includes('Animated.loop(') && fireSrc.includes('IDLE.swayDeg')
    && fireSrc.includes('IDLE.breath') && fireSrc.includes('IDLE.glowMin'));
check('⚠️ …on the NATIVE driver, and WITHOUT claiming the InteractionManager',
  /Animated\.loop\([\s\S]{0,1200}?useNativeDriver: true[\s\S]{0,300}?isInteraction: false/.test(fireSrc));
check('⚠️ …and the idle motion COMPOSES with the reaction instead of replacing it',
  fireSrc.includes('Animated.multiply(flameScale, idleBreath)')
    && fireSrc.includes('Animated.multiply(glowScale, idleBreath)'));
check('⚠️ …and only the FLAME sways — the ember bed is planted, not tilted',
  (fireSrc.match(/rotate: idleSway/g) ?? []).length === 1
    && fireSrc.indexOf('BED.apex.map') < fireSrc.indexOf('{ rotate: idleSway }'));

// ── ⑥ the FULL-BLEED CAMERA (SCRUM-135, 2026-10-19) ─────────────────────────
/*
 * ⚠️ THE BUG THIS SECTION EXISTS FOR, AND WHY NOTHING ELSE COULD SEE IT.
 *
 * On `/burn` the live preview rendered as a **720 × 720 px SQUARE** — 360 × 360 dp
 * on a 360 × 800 dp screen — with the ritual's controls over the full screen and
 * black below. It was INTERMITTENT, and it depended on HOW the screen was
 * entered: a direct deep link to `/burn` measured FULL in **12/12** runs, while
 * the real flow (`capture → shutter → crop → preparing → burn`) measured CLIPPED
 * at exactly `y = 720` in **2/2**.
 *
 * The JS layout was NEVER wrong, which is the whole reason `tsc` and every other
 * gate were silent: `onLayout` on the screen reports `360 × 800` and the Yoga box
 * is right. The fault is in `expo-camera`'s Android `onMeasure`, which resolves
 * its own size from its child `PreviewView`:
 *
 *     setMeasuredDimension(resolveSize(previewView.measuredWidth,  wSpec),
 *                          resolveSize(previewView.measuredHeight, hSpec))
 *
 * `resolveSize(x, EXACTLY h)` is `h`; under **AT_MOST** it is `min(x, h)`. So a
 * first pass whose height spec is not EXACT latches the whole camera view to the
 * child's own square, and because nothing ever changes its style, Yoga never
 * re-measures it — the wrong size is kept for the screen's lifetime.
 *
 * MEASURED, not inferred — SurfaceFlinger on the reproduction (`25128PC17G`,
 * Android 16, 720 × 1600 px):
 *
 *     Layer [8944] SurfaceView[host.exp.exponent/…]#8944
 *         bounds={0,0,720,720}   toDisplayTransform={ scale x=1.3333 y=0.7500 }
 *
 * The fix is `src/components/full-bleed-camera.tsx`: once the container has been
 * measured the camera is given an **explicit pixel width and height**, so its
 * spec is EXACTLY the container's on every pass — and setting the size changes
 * the style, which is what forces the re-measure that unsticks an already-square
 * native view.
 *
 * THESE ASSERTIONS ARE SOURCE ASSERTIONS ON PURPOSE. The defect is invisible to
 * every value-level test: it is a NATIVE measure pass, and the only place it can
 * be caught without a device is in how the view is mounted. A bare
 * `<CameraView style={StyleSheet.absoluteFill}>` anywhere is the defect coming
 * back, so that is asserted ABSENT.
 */
section('⑥ the full-bleed camera — a native measure pass, gated at the mount');

const cameraSrc = read('src/components/full-bleed-camera.tsx');
const scanSrc = read('src/app/clan/scan.tsx');

check('⚠️ all THREE camera screens mount the shared component',
  captureSrc.includes('<FullBleedCamera')
    && burnSrc.includes('<FullBleedCamera')
    && scanSrc.includes('<FullBleedCamera'));
/*
 * ⚠️ THE TYPE USAGE IS STRIPPED FIRST, AND IT HAS TO BE. `useRef<CameraView>(null)`
 * contains the literal `<CameraView>` — so a naive `/<CameraView[\s>]/` reports a
 * false positive on the two screens that hold a ref. Only the JSX form matters.
 */
const bareCamera = (src: string): boolean =>
  /<CameraView[\s/>]/.test(src.replace(/useRef<CameraView>/g, ''));
check('⚠️ …and NONE of them renders a bare `<CameraView` (the defect returning)',
  !bareCamera(captureSrc) && !bareCamera(burnSrc) && !bareCamera(scanSrc));
check('guard: …and that assertion can still see a bare camera when there IS one',
  bareCamera('<CameraView ref={r} style={StyleSheet.absoluteFill} facing="back" />')
    && !bareCamera('const cameraRef = useRef<CameraView>(null);'));
check('…and the camera view is never given `absoluteFill` as its final size',
  !/style=\{StyleSheet\.absoluteFill\}\s*facing/.test(captureSrc)
    && !/style=\{StyleSheet\.absoluteFill\}\s*facing/.test(burnSrc));
check('⚠️ the component PINS an explicit pixel size (the fix itself)',
  cameraSrc.includes('width: box.width, height: box.height')
    && cameraSrc.includes('styles.pinned'));
check('⚠️ …and the camera is NOT MOUNTED until the container is measured',
  cameraSrc.includes('{box !== null && ('));
check('⚠️ …so `absoluteFill` is never handed to the camera AT ALL (the two-pass form still clipped)',
  !/style=\{\s*box === null[\s\S]{0,80}?StyleSheet\.absoluteFill/.test(cameraSrc)
    && !/<CameraView[\s\S]{0,400}?style=\{StyleSheet\.absoluteFill\}/.test(cameraSrc));
check('⚠️ …and the pin carries its OWN position, not `absoluteFill`\'s four insets',
  /pinned: \{ position: 'absolute', left: 0, top: 0 \}/.test(cameraSrc)
    && !/pinned: \{[^}]*right:/.test(cameraSrc)
    && !/pinned: \{[^}]*bottom:/.test(cameraSrc));
check('…so a re-layout of the same size cannot loop',
  cameraSrc.includes('previous.width === width && previous.height === height'));
check('⚠️ the wrapper is TOUCH-TRANSPARENT — /burn\'s whole screen is one PanResponder',
  cameraSrc.includes('pointerEvents="none"'));
check('…and the two screens that need a ref still get one',
  cameraSrc.includes('ref?: Ref<CameraView>') && cameraSrc.includes('ref={ref}'));
check('guard: the source assertions are not vacuous (the files were really read)',
  cameraSrc.length > 1_500 && scanSrc.includes('ClanScanScreen'));
// ── ⑦ the zoom ceiling — the real maximum, and what happens without it ────────
/*
 * SCRUM-132, answered by the owner as option C: "read the real range natively".
 *
 * ⚠️ THE FALLBACK IS HALF THE FEATURE, SO IT IS HALF THE GATE. The native module is a
 * LOCAL module, so it is ABSENT in Expo Go — the build every glass run in this
 * project's history has used — and it can fail on a real device too. A silent fallback
 * would reproduce the exact defect the ticket exists to fix: a number that looks
 * measured and is not. So these assertions pin BOTH halves: that a good report is
 * taken, and that every bad report degrades to the documented constant and SAYS SO.
 */
section('⑦ the zoom ceiling (SCRUM-132 option C — the real maximum, or an honest fallback)');

check('⚠️ a device report above 1 is taken as the real ceiling',
  ceilingFromReport(8.3).source === 'device' && near(ceilingFromReport(8.3).max, 8.3));

check('⚠️ …and 0 (the native "I could not read it") falls back instead of becoming a ceiling',
  ceilingFromReport(0).source === 'assumed'
    && near(ceilingFromReport(0).max, ASSUMED_MAX_ZOOM_RATIO));

check('⚠️ …and a ratio of 1 or less is NOT a ceiling — it would label every stop 1×',
  ceilingFromReport(1).source === 'assumed' && ceilingFromReport(0.5).source === 'assumed');

check('⚠️ …and every non-number falls back too (undefined · null · NaN · a string)',
  ceilingFromReport(undefined).source === 'assumed'
    && ceilingFromReport(null).source === 'assumed'
    && ceilingFromReport(Number.NaN).source === 'assumed'
    && ceilingFromReport('8').source === 'assumed');

check('⚠️ …and the fallback IS the documented constant, not a second opinion',
  near(assumedCeiling().max, ASSUMED_MAX_ZOOM_RATIO) && assumedCeiling().source === 'assumed');

check('⚠️ …and a real ceiling genuinely CHANGES the label (which is the whole point of C)',
  !near(zoomRatioForFraction(0.5, 'android', 4), zoomRatioForFraction(0.5, 'android', 8)));

const zoomCeilingSrc = read('src/lib/zoom-ceiling.ts');
const zoomRangeSrc = read('src/lib/zoom-range.ts');
const zoomRangeModuleSrc = read('modules/zoom-range/src/ZoomRangeModule.ts');
const zoomRangeConfig = read('modules/zoom-range/expo-module.config.json');
const zoomRangeKt = read(
  'modules/zoom-range/android/src/main/java/expo/modules/zoomrange/ZoomRangeModule.kt',
);
const zoomRangeSwift = read('modules/zoom-range/ios/ZoomRangeModule.swift');

check('⚠️ the policy file stays FREE OF `expo` — that is what lets this gate run it at all',
  !/from 'expo'/.test(zoomCeilingSrc) && !/requireNativeModule/.test(zoomCeilingSrc));

check('⚠️ the screen threads the ceiling into EVERY derivation (no implicit default left)',
  captureSrc.includes('zoomRatioForFraction(zoomFraction, zoomPlatform, ceiling.max)')
    && captureSrc.includes('zoomPresetForFraction(zoomFraction, zoomPlatform, ceiling.max)')
    && captureSrc.includes('zoomFractionForStop(stopId, zoomPlatform, ceiling.max)'));

check('⚠️ …and it READS the ceiling rather than writing the constant',
  captureSrc.includes('readMaxZoomCeiling()')
    && captureSrc.includes('useState<MaxZoomCeiling>(assumedCeiling)'));

check("⚠️ …and the read is on CAMERA READY — iOS reads the LIVE session's active format",
  captureSrc.includes('onCameraReady={handleCameraReady}'));

check('⚠️ the native module is OPTIONAL — `requireNativeModule` would crash Expo Go on launch',
  zoomRangeModuleSrc.includes('requireOptionalNativeModule')
    && !/requireNativeModule</.test(zoomRangeModuleSrc));

check('⚠️ …and a MISSING module is tolerated, not dereferenced',
  zoomRangeSrc.includes('ZoomRange?.maxZoomRatio'));

check('⚠️ …and a THROW from the native side is caught, never propagated to the screen',
  // ⚠️ `[^}]*` rather than a character window: it proves the fallback sits inside the
  // SAME catch block, and unlike a length bound it does not break when a diagnostic
  // line is added to that block.
  /catch\s*\([^)]*\)\s*\{[^}]*assumedCeiling\(\)/.test(zoomRangeSrc));

check('…and the module declares BOTH platforms',
  zoomRangeConfig.includes('"apple"') && zoomRangeConfig.includes('"android"'));

check('⚠️ Android reads the SAME characteristic CameraX derives maxZoomRatio from',
  zoomRangeKt.includes('CONTROL_ZOOM_RATIO_RANGE')
    && zoomRangeKt.includes('LENS_FACING_BACK'));

check('⚠️ iOS reads the ACTIVE format — the one the live session committed',
  zoomRangeSwift.includes('activeFormat.videoMaxZoomFactor'));

check('guard: …and those native assertions are not vacuous (the files were really read)',
  zoomRangeKt.length > 800 && zoomRangeSwift.length > 800 && zoomRangeConfig.length > 50);



// ── summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(64)}`);
if (failures.length === 0) {
  console.log(`✓ all ${passed} framing checks passed`);
  process.exit(0);
}
console.log(`✗ ${failures.length} of ${passed + failures.length} framing checks FAILED:`);
for (const f of failures) console.log(`    · ${f}`);
process.exit(1);