/**
 * zoom-range.ts — WHERE THE ZOOM CEILING COMES FROM (SCRUM-132, option C).
 *
 * ── THE DECISION THIS FILE IMPLEMENTS ────────────────────────────────────────
 * `expo-camera` takes `zoom` as a FRACTION OF THE DEVICE'S MAXIMUM and exposes **no
 * way to read that maximum**, so the ratio on the shutter's pill was solved against
 * an assumed 8× ceiling (`ASSUMED_MAX_ZOOM_RATIO`) — a claim about hardware nobody had
 * asked. Option C reads the real range from the platform and labels honestly per
 * device. This file is the single place that decision is resolved.
 *
 * ── ⚠️ THE ASSUMED CONSTANT DOES NOT GO AWAY, AND THAT IS THE POINT ──────────
 * The native module is a LOCAL module, so it is **absent in Expo Go** — the build
 * every glass run in this project's history has used — and it can also legitimately
 * fail (no back camera reported, a characteristics read that throws). In every one of
 * those cases this file returns the assumed constant **and reports that it did**, so
 * the screen can distinguish an estimate from a measurement. ⚠️ A silent fallback
 * would be the exact defect the ticket exists to fix: a number that looks measured
 * and is not.
 *
 * ── ⚠️ READ IT AFTER THE CAMERA IS READY ─────────────────────────────────────
 * On iOS `videoMaxZoomFactor` belongs to the device's ACTIVE FORMAT, which is only
 * committed once a session exists — so a read taken before `onCameraReady` can return
 * the default format's ceiling rather than the one `expo-camera` is using. The screen
 * calls this from its camera-ready path for that reason; see the iOS module's header.
 */

import ZoomRange from '../../modules/zoom-range/src/ZoomRangeModule';
import { assumedCeiling, ceilingFromReport, type MaxZoomCeiling } from './zoom-ceiling';

export { assumedCeiling, ceilingFromReport };
export type { MaxZoomCeiling, MaxZoomSource } from './zoom-ceiling';

/**
 * The ceiling to label against: the device's when it can be read, the assumed constant
 * otherwise. ⚠️ Never throws — a camera that cannot be queried must not take the
 * shutter screen down with it, and this runs from the camera-ready callback.
 *
 * ⚠️ `ZoomRange` is `null` in any build without the native module — **Expo Go
 * included** — and `?.` is what turns that into the documented fallback rather than a
 * crash. See the module's header for why that matters.
 */
export async function readMaxZoomCeiling(): Promise<MaxZoomCeiling> {
  try {
    const reported = await ZoomRange?.maxZoomRatio('back');
    return ceilingFromReport(reported);
  } catch {
    return assumedCeiling();
  }
}
