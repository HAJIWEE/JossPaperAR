/**
 * zoom.ts — the shutter screen's zoom, as a decision a gate can read.
 *
 * ── WHY THIS FILE EXISTS (SCRUM-131, 2026-10-18) ─────────────────────────────
 * The owner pinched the camera preview, saw it zoom, and could not tell whether
 * the pinch had taken — because the shutter screen drew nothing. An indicator
 * needs a *value* to show, and the value `expo-camera` takes is not the value a
 * player reads, so the conversion lives here, pure, where `check:framing` can
 * hold it still without a device.
 *
 * ── THE TWO FACTS THAT MAKE THIS NON-OBVIOUS ─────────────────────────────────
 *
 *  ① `zoom` is a FRACTION OF THE DEVICE'S MAXIMUM, not a multiplier.
 *     expo-camera SDK 57 documents it as *"a value between `0` and `1` being a
 *     percentage of device's max zoom, where `0` means not zoomed and `1` means
 *     maximum zoom"*. There is **no API that exposes that maximum** —
 *     `getSupportedFeatures()` returns only two booleans, and
 *     `getAvailablePictureSizesAsync` is about resolution. So a stop labelled
 *     "2×" is a claim we cannot verify against the hardware.
 *
 *  ② THE TWO PLATFORMS CONVERT IT DIFFERENTLY. Transcribed from the installed
 *     package (not from memory), because the difference is NOT cosmetic:
 *
 *       Android — `node_modules/expo-camera/android/.../ExpoCameraView.kt:649`
 *           val maxZoomRatio = camera?.cameraInfo?.zoomState?.value?.maxZoomRatio ?: 1f
 *           val targetZoomRatio = max(1f, min(maxZoomRatio, value.coerceIn(0f, 1f) * maxZoomRatio))
 *         ⇒ ratio = fraction × max            (LINEAR)
 *
 *       iOS — `node_modules/expo-camera/ios/Current/CameraSessionManager.swift:221`
 *           let minZoom = 1.0
 *           device.videoZoomFactor = minZoom * pow(device.activeFormat.videoMaxZoomFactor / minZoom, delegate.zoom)
 *         ⇒ ratio = max ** fraction           (EXPONENTIAL)
 *
 *     A single fraction sent to both would land on two different zoom factors —
 *     so the platform is an INPUT to the conversion, and `zoomRatioFrom` is the
 *     honest inverse the gate uses to prove each stop lands where it claims.
 *
 * ── ⚠️ THE HONEST LIMIT: `ASSUMED_MAX_ZOOM_RATIO` ────────────────────────────
 * `max` must come from somewhere and expo-camera does not give it to us, so the
 * stops are SOLVED against an assumed maximum. Consequence, stated plainly: on a
 * device whose real maximum is 8× the labels are exact; on a 4×-maximum device
 * "2×" lands nearer 1×; on a 12×-maximum device nearer 3×. Zoom itself is
 * correct and bounded at every stop on every device — it is the NUMBER ON THE
 * PILL that is approximate. That trade is a PM decision, filed as **SCRUM-132**
 * (accept the assumption / drop the ratio labels / read the real range natively).
 * If it is answered, THIS CONSTANT is the only thing that changes.
 *
 * ── THE CONTROL IS ANALOGUE; THE PILLS ARE PRESETS (S64, 2026-10-18) ─────────
 * SCRUM-131 shipped three pills and nothing else, so the owner's report was
 * exactly *"the zoom now only does 1× 2× 4× — it should still retain a slider
 * for analogue zooming"*. The fix is a change of SUBJECT, not an extra control:
 *
 *   · the screen stores the **FRACTION** — the one value `<CameraView zoom>` takes
 *     — and the slider is a direct 1:1 view of it;
 *   · the ratio on the label is DERIVED from that fraction through the natives'
 *     own arithmetic (`zoomRatioFrom`), so the number can only ever say what the
 *     hardware is doing rather than what we asked for;
 *   · the three pills became PRESETS: tapping one writes that preset's fraction
 *     (the same solve the gate already verifies), and a pill lights only while
 *     the value IS that preset (`zoomPresetForFraction`).
 *
 * ⚠️ So the old "store the stop, derive the fraction" note is now INVERTED, and
 * deliberately: with an analogue input there is no stop to store. What must not
 * come back is the third possibility — storing the *ratio* the label shows, which
 * would make the label a second opinion on the camera's state instead of a
 * read-out of it. The ratio is never state; it is a rendering of the fraction.
 *
 * ⚠️ The track is linear in the FRACTION, not in the ratio. A ratio-linear track
 * would need the per-platform inverse solve on every drag pixel and would still
 * disagree with what iOS actually does (its mapping is exponential) — so the
 * track would be a straight lie on one of the two platforms.
 */

/**
 * The device maximum the 2× and 4× stops are solved against. See the header —
 * this is an assumption, and SCRUM-132 is the ticket that may remove it.
 *
 * 8 is chosen because it is the common digital-zoom ceiling of the phone class
 * this build targets, and because it makes both stops land on whole numbers
 * (2× → 0.25 · 4× → 0.5 on Android). It is NOT measured, and must not be read
 * as if it were.
 */
export const ASSUMED_MAX_ZOOM_RATIO = 8;

/** Which native arithmetic to mirror. `web` is not supported by this screen. */
export type ZoomPlatform = 'android' | 'ios';

/**
 * The stops the shutter screen offers.
 *
 * ⚠️ `label` is a NUMERAL and is deliberately NOT in the i18n table: "1×" is the
 * camera idiom in both of this app's locales (the design boards use the same
 * glyphs), so there is nothing to translate and a translation would be the drift.
 * Prose that happens to sit beside the stops (`zoom.hint`, `zoom.selected`) IS in
 * the table — see `MESSAGES` in `src/lib/i18n.ts`.
 */
export const ZOOM_STOPS = [
  { id: '1x', ratio: 1, label: '1×' },
  { id: '2x', ratio: 2, label: '2×' },
  { id: '4x', ratio: 4, label: '4×' },
] as const;

export type ZoomStop = (typeof ZOOM_STOPS)[number];
export type ZoomStopId = ZoomStop['id'];

/** The stop the screen starts on: no zoom, exactly what the player sees today. */
export const DEFAULT_ZOOM_STOP: ZoomStopId = '1x';

/**
 * The stop for `id`, or `undefined` for anything else.
 *
 * ⚠️ Used to read a value that crossed a boundary the type system cannot guard —
 * a route param or persisted state — rather than trusting it.
 */
export function zoomStop(id: string | undefined): ZoomStop | undefined {
  if (id === undefined) return undefined;
  return ZOOM_STOPS.find((stop) => stop.id === id);
}

/**
 * The `zoom` fraction that reaches `ratio` on `platform`.
 *
 * The exact inverse of the native arithmetic quoted in the header:
 *   android — fraction = ratio / max
 *   ios     — fraction = ln(ratio) / ln(max)
 *
 * Clamped to `[0, 1]` because both natives clamp, and a fraction outside the unit
 * interval would otherwise be silently reinterpreted rather than refused. A `max`
 * of 1 (or less) has no zoom to give, so it degrades to `0` — the unzoomed state
 * — instead of dividing by zero or returning `Infinity`.
 */
export function zoomFractionFor(
  ratio: number,
  platform: ZoomPlatform,
  max: number = ASSUMED_MAX_ZOOM_RATIO,
): number {
  if (!Number.isFinite(ratio) || ratio <= 1) return 0;
  // `max <= 1` is a camera that cannot zoom; `ratio >= max` cannot be reached.
  if (!Number.isFinite(max) || max <= 1) return 0;
  if (ratio >= max) return 1;

  const fraction = platform === 'ios' ? Math.log(ratio) / Math.log(max) : ratio / max;
  return clampFraction(fraction);
}

/**
 * The zoom factor `fraction` produces on `platform` — the natives' own formula.
 *
 * This exists to be the inverse of `zoomFractionFor` and to be ASSERTED against
 * it: a gate that only checked `zoomFractionFor`'s output against a hardcoded
 * number would keep passing while the mapping drifted from the SDK. Mirroring the
 * natives here means a change to their arithmetic shows up as a red check.
 */
export function zoomRatioFrom(
  fraction: number,
  platform: ZoomPlatform,
  max: number = ASSUMED_MAX_ZOOM_RATIO,
): number {
  const f = clampFraction(fraction);
  if (!Number.isFinite(max) || max <= 1) return 1;
  // android: max(1, min(max, f * max)) — the `max(1, …)` is the native's own.
  if (platform === 'android') return Math.max(1, Math.min(max, f * max));
  // ios: minZoom * pow(videoMaxZoomFactor / minZoom, zoom), with minZoom = 1.
  return Math.max(1, Math.min(max, Math.pow(max, f)));
}

/** Keep a fraction inside the unit interval the native prop accepts. */
export function clampFraction(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  if (fraction <= 0) return 0;
  if (fraction >= 1) return 1;
  return fraction;
}

/**
 * Map React Native's `Platform.OS` onto the two arithmetics we model.
 *
 * ⚠️ Anything that is not `ios` is treated as the LINEAR (Android) form. A third
 * value is not a case this screen can honour, and the alternative — picking one
 * silently — is what this function exists to make explicit. Web is out of scope:
 * the shutter screen is a device screen (`expo-camera` lists Android and iOS as
 * "device only").
 */
export function zoomPlatformFor(os: string): ZoomPlatform {
  return os === 'ios' ? 'ios' : 'android';
}

/** The fraction to hand `<CameraView zoom={…}>` for a stop, on a platform. */
export function zoomFractionForStop(
  stopId: ZoomStopId,
  platform: ZoomPlatform,
  max: number = ASSUMED_MAX_ZOOM_RATIO,
): number {
  const stop = zoomStop(stopId);
  // An unknown id is not an error worth a screen: it is the unzoomed default.
  if (stop === undefined) return 0;
  return zoomFractionFor(stop.ratio, platform, max);
}

/**
 * Which stop an arbitrary fraction corresponds to, for display only.
 *
 * ⚠️ NOT used to drive the camera — the screen stores the CHOSEN stop and derives
 * the fraction from it (one source of truth). This exists so a gate can assert
 * that the fraction the screen sends reads back as the stop the player tapped,
 * which is the round-trip that makes the indicator truthful rather than decorative.
 */
export function zoomStopForFraction(
  fraction: number,
  platform: ZoomPlatform,
  max: number = ASSUMED_MAX_ZOOM_RATIO,
): ZoomStop {
  const f = clampFraction(fraction);
  const last = ZOOM_STOPS[ZOOM_STOPS.length - 1];
  // `last` cannot be undefined (ZOOM_STOPS is a non-empty literal), but tsc's
  // noUncheckedIndexedAccess would say it can; fall back rather than assert.
  if (last === undefined) throw new Error('ZOOM_STOPS is empty');
  return ZOOM_STOPS.reduce<ZoomStop>((nearest, stop) => {
    const here = Math.abs(zoomFractionFor(stop.ratio, platform, max) - f);
    const there = Math.abs(zoomFractionFor(nearest.ratio, platform, max) - f);
    return here < there ? stop : nearest;
  }, ZOOM_STOPS[0] ?? last);
}

// ── the ANALOGUE control (S64): the fraction is the subject ───────────────────

/** The ratio at fraction `0` — the floor of the a11y range and of the label. */
export const MIN_ZOOM_RATIO = 1;

/**
 * One a11y step on the track, as a fraction of the whole range: 1/16.
 *
 * Deliberately coarse. A screen-reader user swipes to move; sixteen steps across
 * a range whose top is an ASSUMED 8× means each step is a visible change, while a
 * finer step would make reaching the top an endurance test.
 */
export const ZOOM_SLIDER_STEP = 1 / 16;

/**
 * How close to a preset the value must be for its pill to light: half a step.
 *
 * ⚠️ This is a UX rule, not a floating-point guard, and the difference matters.
 * Tapping a pill writes the preset's own fraction, so an exact compare would do
 * — but a player who *slides* onto 2× would then see no pill lit, and one who
 * slides a hair off would see it stay lit for ever. Half a step makes the
 * highlight mean "you are on this preset", and extinguishes it as they leave.
 */
export const ZOOM_PRESET_MATCH_TOLERANCE = ZOOM_SLIDER_STEP / 2;

/**
 * The ratio the camera is actually at, for a fraction — THE label's source.
 *
 * ⚠️ A named re-export of `zoomRatioFrom`, not a second implementation: the label
 * must be the natives' arithmetic applied to the value we send, or the number and
 * the picture can disagree.
 */
export function zoomRatioForFraction(
  fraction: number,
  platform: ZoomPlatform,
  max: number = ASSUMED_MAX_ZOOM_RATIO,
): number {
  return zoomRatioFrom(fraction, platform, max);
}

/**
 * A ratio as the numeral the label shows — `1×`, `2×`, `2.4×`.
 *
 * ⚠️ A NUMERAL, and therefore NOT in the i18n table, for the same reason the
 * preset labels are not (see `ZOOM_STOPS`): "2.4×" is the camera idiom in both of
 * this app's locales. `check:framing` asserts the table stays free of it.
 *
 * One decimal below 10×, whole numbers above (where a tenth is noise), and never
 * below `1×` however small the fraction.
 */
export function zoomLabel(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= MIN_ZOOM_RATIO) return `${MIN_ZOOM_RATIO}×`;
  const rounded = ratio >= 10 ? Math.round(ratio) : Math.round(ratio * 10) / 10;
  // A 1.04 ratio rounds to 1, and "1×" is what it is; never print "1.0×".
  return `${rounded}×`;
}

/**
 * The fraction for a touch at `offsetX` along a track `trackWidth` wide.
 *
 * Pure, so the geometry is assertable: the left edge is the UNZOOMED end (`0`),
 * the right edge is the device maximum (`1`), and anything off either end clamps
 * rather than wrapping — a drag that leaves the track must not flip the zoom.
 * A degenerate track (0 or NaN wide) is the unzoomed end, not a division by zero.
 */
export function zoomFractionFromTrack(offsetX: number, trackWidth: number): number {
  if (!Number.isFinite(trackWidth) || trackWidth <= 0) return 0;
  if (!Number.isFinite(offsetX)) return 0;
  return clampFraction(offsetX / trackWidth);
}

/**
 * The thumb's offset along that track — the inverse of `zoomFractionFromTrack`.
 *
 * ⚠️ Both directions exist on purpose: the screen positions the thumb with this
 * while the drag sets the fraction with the other, so a gate can prove the two
 * agree. One-direction-only geometry is how a thumb ends up not under the finger.
 */
export function zoomTrackOffset(
  fraction: number,
  trackWidth: number,
): number {
  if (!Number.isFinite(trackWidth) || trackWidth <= 0) return 0;
  return clampFraction(fraction) * trackWidth;
}

/**
 * The fraction one a11y step away from `fraction`. `direction` is -1 or +1.
 *
 * ⚠️ It quantises to the step grid rather than adding a step to an arbitrary
 * value, so repeated increments always reach the same places and the top is
 * exactly `1` — the same reasoning as the pill solve, applied to the keyboard.
 */
export function zoomSteppedFraction(
  fraction: number,
  direction: -1 | 1,
): number {
  const current = clampFraction(fraction);
  const steps = Math.round(current / ZOOM_SLIDER_STEP) + direction;
  return clampFraction(steps * ZOOM_SLIDER_STEP);
}

/**
 * The PRESET the value is sitting on, or `null` when it is between presets.
 *
 * ⚠️ `zoomStopForFraction` (above) answers a different question — "which preset
 * is NEAREST" — and it is deliberately kept for the relative-pinch harness. Using
 * it for the pill highlight would light 1× at every value below 1.5×, which reads
 * as a selected stop the player never chose. This one lights nothing until the
 * value really is the preset.
 */
export function zoomPresetForFraction(
  fraction: number,
  platform: ZoomPlatform,
  max: number = ASSUMED_MAX_ZOOM_RATIO,
): ZoomStop | null {
  const f = clampFraction(fraction);
  return ZOOM_STOPS.find(
    (stop) => Math.abs(zoomFractionFor(stop.ratio, platform, max) - f)
      <= ZOOM_PRESET_MATCH_TOLERANCE,
  ) ?? null;
}