/**
 * zoom-ceiling.ts — WHAT COUNTS AS A USABLE ZOOM CEILING, AND THE FALLBACK.
 *
 * ⚠️ PURE ON PURPOSE, AND SEPARATE FROM `zoom-range.ts` FOR ONE CONCRETE REASON.
 * `zoom-range.ts` imports the native module, which imports `expo` — so nothing that
 * imports it can run under plain `node`. The gate (`check:framing`) runs in node and
 * has to prove this policy, so the POLICY lives here — no `expo`, no native, no I/O —
 * and only the read lives next door.
 *
 * ── WHY THE POLICY IS NOT JUST "use the number" ──────────────────────────────
 * The native modules answer `0` for "I could not read it", but `0` is not the only
 * unusable answer a platform can hand back. A ratio of **`1` or less is not a
 * maximum** — it means "unzoomed only", and treating it as a ceiling would label
 * every stop `1×` on a device that zooms perfectly well. Anything that is not a finite
 * number greater than 1 falls back, so a bad read degrades to the documented estimate
 * instead of to a wrong measurement.
 */

import { ASSUMED_MAX_ZOOM_RATIO } from './zoom.ts';

/** Where the ceiling came from. ⚠️ Not decoration — see `MaxZoomCeiling`. */
export type MaxZoomSource = 'device' | 'assumed';

/**
 * The ceiling the shutter's labels are solved against, and its provenance.
 *
 * ⚠️ `source` IS THE POINT. A ratio solved against the device's real maximum is a
 * fact; one solved against the assumed constant is an estimate. Keeping them apart is
 * what stops the screen presenting an estimate as a measurement.
 */
export interface MaxZoomCeiling {
  /** The ratio the labels are solved against — always a usable number. */
  readonly max: number;
  /** `'device'` when the platform reported it; `'assumed'` when it did not. */
  readonly source: MaxZoomSource;
}

/**
 * The documented fallback, in one place so the gate can assert the screen never
 * reaches for the constant directly.
 */
export function assumedCeiling(): MaxZoomCeiling {
  return { max: ASSUMED_MAX_ZOOM_RATIO, source: 'assumed' };
}

/**
 * Turn whatever the native side reported into a ceiling, **or say it could not**.
 * See the header for why `<= 1` is a fallback rather than a maximum.
 */
export function ceilingFromReport(reported: unknown): MaxZoomCeiling {
  if (typeof reported !== 'number' || !Number.isFinite(reported) || reported <= 1) {
    return assumedCeiling();
  }
  return { max: reported, source: 'device' };
}
