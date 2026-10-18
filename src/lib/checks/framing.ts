/**
 * FRAMING CHECKS — `node src/lib/checks/framing.ts`
 *
 * ⚠️ WHY THIS FILE EXISTS (SCRUM-131, 2026-10-18)
 *
 * Two features landed together and neither is visible to any existing gate:
 *
 *   ① ZOOM STOPS on the shutter screen. `expo-camera`'s `zoom` prop is a FRACTION of
 *      the device's maximum, and the two platforms convert it with DIFFERENT arithmetic
 *      (Android multiplies, iOS raises to a power). So "2×" is not a constant — it is a
 *      solve, per platform, against an assumed device maximum. Nothing but a check can
 *      hold that still, and getting it wrong is invisible: the preview simply zooms the
 *      wrong amount.
 *
 *   ② THE CROP/LASSO STEP. Its whole promise is that what leaves the screen is the
 *      region the player chose. The failure modes are geometric and silent — a selection
 *      measured against the CONTAINER instead of the letterboxed photo, a crop one pixel
 *      wide, a lasso applied as something other than its box, `NaN` handed to a native
 *      decoder. Every one of those produces a plausible-looking screen and a wrong
 *      offering, and every one is arithmetic — so it is asserted here, with no device.
 *
 * Section ③ is the SOURCE assertions: that the two screens actually consume the pure
 * modules above rather than re-deciding. A gate over pure functions that the app does not
 * call is a gate over nothing — the mistake `check:capturesize` was written to fix.
 *
 * ⚠️ FAULT-TEST IT, TWICE (one per feature) — both MEASURED, not asserted:
 *   · change the Android branch of `zoomRatioFrom` to `1 + f * (max - 1)` (the arithmetic
 *     the SDK does NOT use) → **2 of 88 go red**, the two per-platform solves. A stop whose
 *     RATIO is edited instead is caught by the "three standard stops" check, because a
 *     solve is self-consistent by construction — this check catches MAPPING drift.
 *   · change `manipulate(nativeUri)` to `manipulate(uri)` in `crop.tsx` (the black screen)
 *     → **2 of 88 go red**, the uri assertions in section ③.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MESSAGES, t } from '../i18n.ts';
import {
  containRect,
  cropRectFor,
  isUsableCropRect,
  isUsableLasso,
  isWholeImage,
  lassoBounds,
  MIN_CROP_EDGE_PX,
  normaliseDrag,
  pathLength,
  polylinePoints,
  rectToImagePixels,
  scrimAround,
  type Point,
  type Rect,
  type Size,
} from '../crop-frame.ts';
import {
  ASSUMED_MAX_ZOOM_RATIO,
  DEFAULT_ZOOM_STOP,
  ZOOM_STOPS,
  zoomFractionFor,
  zoomFractionForStop,
  zoomPlatformFor,
  zoomRatioFrom,
  zoomStop,
  zoomStopForFraction,
} from '../zoom.ts';

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
check('a drawn stroke becomes its BOUNDING BOX (what a lasso is applied as here)',
  JSON.stringify(lassoBounds(stroke)) === JSON.stringify({ x: 10, y: 10, width: 90, height: 290 }));
check('the stroke\'s accumulated length is measured along the path, not across its box',
  pathLength(stroke) > 300);
check('isUsableLasso agrees with lassoBounds (one rule, two readers)',
  isUsableLasso(stroke) && !isUsableLasso([{ x: 0, y: 0 }]));

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

// ── ③ the screens CONSUME these, rather than re-deciding ─────────────────────
// ⚠️ The lesson of `check:capturesize`: a gate over pure functions the app never calls is a
// gate over nothing. These are source assertions, with a negative control below proving the
// assertion is capable of failing.
section('③ the screens consume the pure modules (source assertions)');

const captureSrc = read('src/app/capture.tsx');
const cropSrc = read('src/app/crop.tsx');

check('the shutter screen passes the DERIVED fraction to the camera',
  captureSrc.includes('zoom={zoomFraction}')
    && captureSrc.includes('zoomFractionForStop(zoomStopId, zoomPlatform)'));
check('…and never passes a raw ratio to `zoom`',
  !/zoom=\{(\s*\d|\s*stop\.ratio)/.test(captureSrc));
check('the shutter screen renders a pill per stop',
  captureSrc.includes('ZOOM_STOPS.map') && captureSrc.includes('accessibilityState={{ selected: active }}'));
check('the shutter screen hops to /crop, with the id and the size',
  captureSrc.includes("pathname: '/crop'") && captureSrc.includes('toCropParams('));
check('⚠️ …and no longer pushes the whole frame straight at /preparing',
  !captureSrc.includes("pathname: '/preparing'"));

check('⚠️ the crop screen loads the photo through the native-loader re-encode',
  cropSrc.includes('nativeLoaderUriFromDecoded(uri)'));
check('…and uses that SAME uri for the picture and the manipulator',
  cropSrc.includes('source={{ uri: nativeUri }}') && cropSrc.includes('manipulate(nativeUri)'));
check('…so a raw route param is never handed to a native decoder',
  !cropSrc.includes('manipulate(uri)') && !cropSrc.includes('uri: uri'));

check('⚠️ the crop is applied from the PIXEL rect the pure module produced',
  cropSrc.includes('cropRectFor(') && cropSrc.includes('originX: preview.x'));
check('⚠️ the file is SAVED before anything is handed onward (only the crop is sent)',
  cropSrc.indexOf('saveAsync(') > 0
    && cropSrc.indexOf('saveAsync(') < cropSrc.indexOf('goOn(uploadableUri(saved.uri))'));
check('⚠️ the hop to /preparing collapses the uri for the uploader',
  cropSrc.includes('uploadableUri(saved.uri)') && cropSrc.includes('goOn(uploadableUri(uri))'));
check('⚠️ the crop is written at the UPLOAD BUDGET\'s compression, not a second opinion',
  cropSrc.includes('compress: CAPTURE_COMPRESS')
    && cropSrc.includes("from '@/lib/capture-size'")
    && !/compress:\s*[\d.]+/.test(cropSrc));
check('the lasso\'s limit is disclosed in the UI, not only in a comment',
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
  'zoom.stopA11y',
  'crop.title', 'crop.hintRect', 'crop.hintLasso', 'crop.modeRect', 'crop.modeLasso',
  'crop.lassoNote', 'crop.tooSmall', 'crop.skip', 'crop.confirm', 'crop.working',
  'crop.failed', 'crop.loading', 'crop.photoFailed', 'crop.badParams',
];

for (const key of FRAME_KEYS) {
  check(`${key} is translated in en AND zh`,
    typeof en[key] === 'string' && en[key].length > 0
      && typeof zh[key] === 'string' && zh[key].length > 0);
}
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

// ── summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(64)}`);
if (failures.length === 0) {
  console.log(`✓ all ${passed} framing checks passed`);
  process.exit(0);
}
console.log(`✗ ${failures.length} of ${passed + failures.length} framing checks FAILED:`);
for (const f of failures) console.log(`    · ${f}`);
process.exit(1);