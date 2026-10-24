/**
 * CAPTURE — the first screen of the slice (SCRUM-53 / PR-4).
 *
 * `capture → FRAME (crop/lasso) → cartoonize → burn → award → persist`. This screen
 * owns step one and nothing else: it mints a capture id, takes the photo, and hands
 * the capture onward — to `/crop`, which is where the player decides what the
 * offering IS (SCRUM-131).
 *
 * ── WHY THE ID IS MINTED HERE, NOT ON THE SERVER ────────────────────────────
 * Rule ① of doc 19 §12: **generate the capture id BEFORE the upload.**
 * `captures` deliberately has NO UPDATE policy, so a row created server-side
 * cannot be adopted afterwards — the upload must know which id it writes to
 * before it starts. That makes this line the load-bearing one in this file:
 *
 *     const captureId = Crypto.randomUUID();   // ← BEFORE takePictureAsync()
 *
 * `takePictureAsync` can fail (camera denied, disk full, user backing out). If
 * the id were minted afterwards, a failure would leave a dangling id with no
 * image — and rule ② would then treat that id as spent for nothing. Minting
 * first costs nothing when the photo fails: the id is never used and no row was
 * ever created.
 *
 * ── WHAT THIS SCREEN DELIBERATELY DOES NOT DO ───────────────────────────────
 * It does NOT upload, call `request_cartoonize`, or touch the network — that is
 * the service layer's job. Keeping the screen to "produce a (captureId, uri)
 * pair" is what makes it testable without a device, and it means the three rules
 * stay enforced in `src/domain/slice.ts` rather than re-decided by UI code. This
 * screen calls `transition(...)` and renders what comes back.
 */

import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FullBleedCamera } from '@/components/full-bleed-camera';
import { INITIAL_OFFERING, transition, type Offering } from '@/domain/slice';
import { t } from '@/lib/i18n';
import { toCropParams } from '@/lib/route-params';
import { isDemo } from '@/lib/tutorial';
import {
  ASSUMED_MAX_ZOOM_RATIO,
  DEFAULT_ZOOM_STOP,
  MIN_ZOOM_RATIO,
  ZOOM_STOPS,
  type ZoomStopId,
  zoomFractionForStop,
  zoomFractionFromTrack,
  zoomLabel,
  zoomPlatformFor,
  zoomPresetForFraction,
  zoomRatioForFraction,
  zoomSteppedFraction,
  zoomTrackOffset,
} from '@/lib/zoom';
import {
  assumedCeiling,
  readMaxZoomCeiling,
  type MaxZoomCeiling,
} from '@/lib/zoom-range';
import { TOUCH_TARGET, brand, fontSize, onColorCream, radius, space, surface, text } from '@/theme/tokens';

type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'shooting' }
  /** The photo never happened — nothing was spent, so this is NOT rule ②. */
  | { readonly kind: 'failed' };

/**
 * The thumb's radius (dp). It is a LAYOUT number, not a style detail: the thumb is
 * placed by offsetting its centre from the track's left edge, so the two must agree
 * with the style below or the thumb sits half its width off the finger.
 */
const ZOOM_THUMB_RADIUS = 14;

/**
 * The VISIBLE preset pill's box (dp) — half the touch target.
 *
 * ⚠️ TWO BOXES, ONE CONTROL (S64). The owner asked for the 1×/2×/4× pills at half
 * their size. The pill they see is now this; the box their finger gets is still
 * `TOUCH_TARGET` (44 dp), because that floor exists for this app's 40–50s audience
 * (doc 15 §8 · `responsive.css`) and a control that is smaller *and* harder to hit
 * would trade one complaint for a worse one. The relationship is derived, not
 * typed twice, so the pill can never outgrow the target it sits in.
 */
const ZOOM_PILL_SIZE = TOUCH_TARGET / 2;

export default function CaptureScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);

  /**
   * SCRUM-85 — the tutorial flag arrives from Home and must be carried ONWARD.
   * ⚠️ Dropping it here would send a demo into the real pipeline, which uploads
   * and cartoonizes: a ≈US$0.09 AI call for a brand-new user, before any clan or
   * quota row exists to bound it.
   */
  const demo = isDemo(useLocalSearchParams<{ demo?: string }>().demo);

  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  /** The offering — owned by the state machine, never by this screen. */
  const [offering, setOffering] = useState<Offering>(INITIAL_OFFERING);

  /**
   * THE ZOOM — ANALOGUE, WITH PRESETS (S64; SCRUM-131 shipped stops only).
   *
   * ⚠️ The state is the FRACTION, because that is the one value `expo-camera`
   * takes and the one a slider can write. The ratio on the label is DERIVED from
   * it through the natives' own arithmetic (`zoomRatioForFraction` → `zoomLabel`),
   * so the number can only ever report what the camera is doing. Storing the ratio
   * instead — or the stop, as this screen first did — would make the label a
   * second opinion on the camera's state, which is how the two end up disagreeing.
   *
   * The conversion's two non-obvious facts (the prop is a fraction of the device
   * maximum, and iOS/Android convert it differently) are documented once, in
   * `src/lib/zoom.ts`, and deliberately not restated here.
   */
  const zoomPlatform = zoomPlatformFor(Platform.OS);

  /**
   * THE CEILING THE LABELS ARE SOLVED AGAINST (SCRUM-132, option C).
   *
   * ⚠️ It STARTS as the assumed constant and is replaced by the device's real maximum
   * once the camera is ready — the read must happen after the session exists, because
   * on iOS the value belongs to the device's ACTIVE format. Until it arrives — and in
   * any build without the native module, **Expo Go included** — `source` stays
   * `'assumed'` and the labels are the old estimate rather than a measurement.
   * ⚠️ `source` is carried rather than discarded so the two can never be confused:
   * see `src/lib/zoom-ceiling.ts`.
   */
  const [ceiling, setCeiling] = useState<MaxZoomCeiling>(assumedCeiling);
  const [zoomFraction, setZoomFraction] = useState<number>(
    // The default is the UNZOOMED end — exactly what the camera did before any of
    // this existed. Derived from the default preset rather than written as `0`, so
    // the default and the lit pill cannot drift apart.
    () => zoomFractionForStop(DEFAULT_ZOOM_STOP, zoomPlatform),
  );
  /** The label's value: what the hardware is at, not what we asked for. */
  const zoomRatio = useMemo(
    () => zoomRatioForFraction(zoomFraction, zoomPlatform, ceiling.max),
    [zoomFraction, zoomPlatform, ceiling.max],
  );
  /** Which preset (if any) the value is sitting on — see `zoomPresetForFraction`. */
  const zoomPreset = zoomPresetForFraction(zoomFraction, zoomPlatform, ceiling.max);
  /** The track's own width, from `onLayout`: the slider cannot be pure without it. */
  const [trackWidth, setTrackWidth] = useState(0);

  /**
   * The track's geometry, in one place.
   *
   * ⚠️ `locationX` — not `moveX`. The responder view IS the track (it is the whole
   * 44 dp row), so a location is already a track coordinate and no window origin
   * has to be measured and kept in sync. `moveX` would need that offset, and it
   * would be wrong the moment the screen scrolled or rotated.
   *
   * ⚠️ The responder is rebuilt when `trackWidth` changes and on nothing else: the
   * width arrives once, from the first layout pass, and a responder rebuilt on
   * every render would drop whatever drag it was in the middle of.
   */
  const zoomFromTouch = useCallback(
    (event: GestureResponderEvent): number => zoomFractionFromTrack(
      event.nativeEvent.locationX,
      trackWidth,
    ),
    [trackWidth],
  );

  const sliderResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Keep the gesture: a stolen pan mid-drag would leave the zoom wherever the
      // finger happened to be when the scroll view won, which reads as a jump.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => setZoomFraction(zoomFromTouch(event)),
      onPanResponderMove: (event) => setZoomFraction(zoomFromTouch(event)),
    }),
    [zoomFromTouch],
  );

  const onTrackLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    // Guard the identical re-layout: a bare setState per layout pass re-renders
    // forever on some devices (the same guard the crop screen's stage uses).
    setTrackWidth((prev) => (prev === width ? prev : width));
  }, []);

  /**
   * A preset writes its own solve — the SAME function the gate checks against the
   * natives' arithmetic, so a pill can never promise a ratio the track cannot hold.
   */
  const applyPreset = useCallback(
    (stopId: ZoomStopId) => setZoomFraction(
      zoomFractionForStop(stopId, zoomPlatform, ceiling.max),
    ),
    [zoomPlatform, ceiling.max],
  );

  /**
   * ⚠️ READ THE REAL CEILING ONCE THE CAMERA IS READY — and re-solve the default stop
   * against it. Order matters twice over: on iOS the value is only meaningful once the
   * session has committed its format, and the fraction for a stop DEPENDS on the
   * ceiling (2× is a different fraction against a 4× ceiling than against an 8× one),
   * so a preset solved before the read would write the wrong fraction for the ratio it
   * names. ⚠️ The default stop is 1×, whose fraction is `0` on BOTH platforms for any
   * ceiling — so today this re-solve is a no-op, and it exists so that changing
   * `DEFAULT_ZOOM_STOP` cannot silently break the screen.
   */
  const handleCameraReady = useCallback(() => {
    void readMaxZoomCeiling().then((resolved) => {
      setCeiling(resolved);
      setZoomFraction(zoomFractionForStop(DEFAULT_ZOOM_STOP, zoomPlatform, resolved.max));
    });
  }, [zoomPlatform]);

  const shoot = useCallback(async () => {
    const camera = cameraRef.current;
    if (camera === null || phase.kind === 'shooting') return;

    setPhase({ kind: 'shooting' });

    // ⚠️ RULE ① — the id is minted BEFORE the photo is taken. Do not reorder.
    const captureId = Crypto.randomUUID();

    try {
      const photo = await camera.takePictureAsync({
        // A compressed capture keeps the upload inside the 300 KB bucket budget
        // (doc 14 §3). The raw photo is retained only 7 days (ADR-007).
        quality: 0.7,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        setPhase({ kind: 'failed' });
        return;
      }

      // The machine takes over: it is the only thing that decides the next state,
      // which is how rules ①/②/③ stay true no matter what this file does.
      setOffering((current) => transition(current, { type: 'CAPTURE_TAKEN', captureId }));

      // The service layer uploads under THIS id, then requests the cartoonize.
      // ⚠️ The tutorial flag rides along (SCRUM-85): `preparing` branches on it and
      // skips the upload entirely for a demo.
      //
      // ⚠️ AND THE HOP NOW GOES TO `/crop`, NOT `/preparing` (SCRUM-131). The player
      // frames their offering there, and what reaches `/preparing` is the CROPPED
      // file — so the ≈US$0.09 styler call sees the offering rather than the room
      // around it. `/crop` re-uses this same `captureId` and pushes onward itself;
      // skipping the frame is one tap and sends this `photo.uri` untouched.
      router.push({
        pathname: '/crop',
        params: toCropParams(captureId, photo.uri, photo.width ?? 0, photo.height ?? 0, demo),
      });
    } catch {
      // No photo ⇒ no row ⇒ no id consumed. Not rule ②: nothing was spent.
      setPhase({ kind: 'failed' });
    }
  }, [phase.kind, router]);

  // ── permission gate ──────────────────────────────────────────────────────
  if (permission && !permission.granted) {
    return (
      <View style={[styles.gate, { paddingTop: insets.top + space.xl }]}>
        <Text style={styles.gateTitle}>{t('capture.cameraNeeded')}</Text>
        <Text style={styles.gateBody}>{t('capture.cameraWhy')}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void requestPermission();
          }}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonLabel}>{t('invite.grantCamera')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/*
        ⚠️ `zoom` is the DERIVED fraction, never the stop's ratio — `expo-camera`
        takes `0…1` of the device's maximum, and the platform decides how that
        becomes a factor. See `src/lib/zoom.ts`.

        ⚠️ AND IT IS `FullBleedCamera`, NOT A BARE `CameraView` (SCRUM-135). A bare
        one can measure itself as a SQUARE and stay one — see that component.

        ⚠️ `onCameraReady` IS WHERE THE REAL ZOOM CEILING IS READ (SCRUM-132). It
        cannot be read earlier: the ceiling is only knowable once the session exists.
      */}
      <FullBleedCamera
        ref={cameraRef}
        facing="back"
        zoom={zoomFraction}
        onCameraReady={handleCameraReady}
      />

      {/*
        The camera is the whole screen — the ritual is not a form.

        ⚠️ `styles.hud` carries `flex: 1` (S64), and THAT is what puts the controls
        at the bottom. The HUD absorbs every dp the screen has left over, so the
        zoom strip and the shutter are pushed down to the thumb while the hint stays
        on the HUD's own top edge. One flexible box does both jobs — no absolute
        positioning, so nothing can drift when the safe area changes.
      */}
      <View style={[styles.hud, { paddingTop: insets.top + space.md }]} pointerEvents="none">
        <Text style={styles.hint}>{t('capture.photoHint')}</Text>
      </View>

      {/*
        THE ZOOM — the read-out, the analogue track, and the presets (S64).

        ⚠️ IT SITS DIRECTLY ABOVE THE SHUTTER (S64, owner). It used to stack under
        the hint at the top of the window — the far corner from the thumb, on a
        screen whose whole gesture is one-handed. It is now the last thing before
        the shutter, so the strip and the button it serves are one cluster.

        ⚠️ OUTSIDE the `pointerEvents="none"` HUD and AFTER the preview, or the
        touches would land on the camera view. Every control here is still a real
        44 dp target: the audience this is built for (40–50s, doc 15 §8) is the
        reason `TOUCH_TARGET` exists, and a zoom you cannot reliably hit is worse
        than no zoom — which is why the presets shrank visually but NOT in their
        touch boxes (see `zoomStop` in the styles below).

        ⚠️ THE READ-OUT IS THE POINT OF THE WHOLE STRIP. The owner's original
        report (SCRUM-131) was that a pinch had no visible answer; the number shows
        the value the camera is at (`zoomRatioForFraction` → `zoomLabel`), so it
        updates mid-drag rather than only when a finger lifts.
      */}
      <View style={styles.zoomReadoutRow} pointerEvents="none">
        <Text testID="zoom-readout" style={styles.zoomReadout}>{zoomLabel(zoomRatio)}</Text>
      </View>

      {/*
        THE ANALOGUE TRACK.
        ⚠️ Its a11y role is `adjustable`, not `button`: a screen reader announces a
        value it can change, and the increment/decrement actions are what makes the
        track usable without sight of it. The value announced is the RATIO (what a
        player reads), while the state moved is the fraction.
      */}
      <View style={styles.zoomSliderRow}>
        <View
          testID="zoom-slider"
          onLayout={onTrackLayout}
          style={styles.zoomTrack}
          accessibilityRole="adjustable"
          accessibilityLabel={t('zoom.sliderA11y')}
          accessibilityValue={{
            min: MIN_ZOOM_RATIO,
            max: ASSUMED_MAX_ZOOM_RATIO,
            now: Math.round(zoomRatio * 10) / 10,
          }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => {
            const { actionName } = event.nativeEvent;
            if (actionName !== 'increment' && actionName !== 'decrement') return;
            setZoomFraction((current) => zoomSteppedFraction(
              current,
              actionName === 'increment' ? 1 : -1,
            ));
          }}
          {...sliderResponder.panHandlers}
        >
          <View style={styles.zoomTrackLine} pointerEvents="none" />
          {/*
            The thumb is placed by `zoomTrackOffset` — the INVERSE of the function
            the drag uses — so the picture and the value cannot drift: `check:framing`
            asserts the round trip.
          */}
          <View
            pointerEvents="none"
            style={[styles.zoomThumb, { marginLeft: zoomTrackOffset(zoomFraction, trackWidth) - ZOOM_THUMB_RADIUS }]}
          />
        </View>
      </View>

      {/*
        THE PRESETS (SCRUM-131's pills, kept — they are the fast path for the values
        players actually use). ⚠️ A pill lights only while the value IS that preset
        (`zoomPresetForFraction`), so a value between presets lights nothing rather
        than the nearest one.
      */}
      <View style={styles.zoomRow}>
        {ZOOM_STOPS.map((stop) => {
          const active = zoomPreset?.id === stop.id;
          return (
            <Pressable
              key={stop.id}
              testID={`zoom-stop-${stop.id}`}
              accessibilityRole="button"
              accessibilityLabel={t('zoom.stopA11y', { label: stop.label })}
              // The active preset must be readable WITHOUT seeing the fill — a
              // selected state, not just a colour (doc 19 §4.4).
              accessibilityState={{ selected: active }}
              onPress={() => applyPreset(stop.id)}
              // ⚠️ The Pressable IS the 44 dp target; the pill the player sees is
              // the child below it. Splitting them is the only way to honour both
              // the owner's "half the size" and this project's touch floor.
              style={({ pressed }) => [styles.zoomStop, pressed && styles.pressed]}
            >
              <View style={[styles.zoomStopPill, active && styles.zoomStopPillActive]}>
                <Text style={[styles.zoomLabel, active && styles.zoomLabelActive]}>{stop.label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View
        style={[styles.shutterRow, { paddingBottom: insets.bottom + space.xl }]}
        pointerEvents="box-none"
      >
        {phase.kind === 'failed' ? (
          <View style={styles.failRow}>
            <Text style={styles.failText}>{t('capture.failed')}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setPhase({ kind: 'idle' });
                setOffering(INITIAL_OFFERING);
              }}
              style={styles.smallButton}
            >
              <Text style={styles.smallButtonLabel}>{t('capture.tryAgain')}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take the offering's photo"
            disabled={phase.kind === 'shooting'}
            onPress={() => {
              void shoot();
            }}
            style={({ pressed }) => [
              styles.shutter,
              pressed && styles.pressed,
              phase.kind === 'shooting' && styles.shutterBusy,
            ]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
        )}
      </View>

      {/* Status for screen readers; the shutter carries the action. */}
      <Text accessibilityRole="alert" style={styles.srOnly}>
        {offering.state === 'idle' ? 'Ready to photograph' : 'Offering captured'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.camera },
  /**
   * ⚠️ `flex: 1` IS THE LAYOUT, not decoration. The HUD takes every dp the screen
   * has left over, which is what pushes the zoom strip and the shutter to the
   * bottom (S64) while the hint stays on the HUD's own top edge. Remove it and the
   * controls climb back up under the hint — the exact placement the owner asked to
   * move away from.
   */
  hud: { flex: 1, alignItems: 'center' },
  hint: {
    color: onColorCream,
    fontSize: fontSize.caption.at390,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  /**
   * The shutter — now the LAST child, under the zoom strip (S64). It no longer
   * needs `flex: 1` to reach the bottom (the HUD's flex does that), so it is only
   * as tall as the button plus the safe-area padding, and `marginTop` keeps it from
   * touching the presets above it.
   */
  shutterRow: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: space.md,
  },
  /**
   * The zoom strip, directly above the shutter (SCRUM-131 · S64).
   * `row` + centred so the stops read as one control; the gap keeps two adjacent
   * 44 dp targets from sharing an edge, which is how a fat-finger picks 4× while
   * aiming at 2×.
   */
  zoomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    /**
     * ⚠️ THE GAP IS BETWEEN THE TARGETS, NOT THE PILLS THE EYE SEES. The pills
     * shrank by half (S64) but their 44 dp boxes did not, so a gap of `md` would
     * read as a wide, scattered strip. `xs` is a quarter of the old value and keeps
     * the boxes from sharing an edge — the reason the gap exists at all.
     */
    gap: space.xs,
    marginTop: space.md,
  },
  /**
   * The live read-out, directly above the track it describes (doc 19 §4.4: a value
   * and its control are one unit, not two).
   */
  zoomReadoutRow: { alignItems: 'center', marginTop: space.md },
  zoomReadout: {
    color: onColorCream,
    fontSize: fontSize.bodyLg.at390,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  /**
   * ⚠️ The horizontal padding is the THUMB RADIUS, so the thumb's centre can reach
   * both ends of the track without the thumb itself leaving the screen. The track's
   * measured width is therefore the usable travel — which is exactly what
   * `zoomFractionFromTrack` expects, because the responder view IS this inner view.
   */
  zoomSliderRow: {
    justifyContent: 'center',
    paddingHorizontal: space.lg + ZOOM_THUMB_RADIUS,
  },
  /**
   * The whole 44 dp row is the touch target (a 2 dp line is not tappable), and it is
   * `row`-flexed with `alignItems: 'center'` so the thumb is a flex child placed by
   * `marginLeft` — no absolute positioning, so the thumb and the track cannot
   * disagree about the origin.
   */
  zoomTrack: {
    minHeight: TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
  },
  /** The rail. Absolute so it does not take part in the thumb's placement. */
  zoomTrackLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: onColorCream,
    opacity: 0.45,
  },
  zoomThumb: {
    width: ZOOM_THUMB_RADIUS * 2,
    height: ZOOM_THUMB_RADIUS * 2,
    borderRadius: ZOOM_THUMB_RADIUS,
    backgroundColor: onColorCream,
    borderWidth: 2,
    borderColor: surface.camera,
  },
  /**
   * ⚠️ THE TAP TARGET AND THE PILL ARE TWO BOXES, AND THE SPLIT IS THE POINT (S64).
   *
   * The owner asked for the 1×/2×/4× pills at HALF their size. Halving the
   * Pressable itself would have halved the touch area too — and this project holds
   * 44 dp for a 40–50s audience (doc 15 §8 · `responsive.css`), on a screen where
   * the control is used one-handed while aiming. So the target keeps its 44 dp box
   * and the VISIBLE pill is the child below it: the picture halves, the hit area
   * does not. `hitSlop` could not do this — RN clips it to the parent's bounds, so
   * a slop that crossed this row's own height would silently do nothing.
   */
  zoomStop: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * The pill the player sees — `ZOOM_PILL_SIZE` (22 dp), centred in the 44 dp
   * target above.
   *
   * ⚠️ `minWidth`/`minHeight`, never a fixed `width`/`height`: N11 honours system
   * font scaling to ×1.5, and a hard 22 would clip the numeral at large type. The
   * label at `caption` fits inside 22 dp with room to spare, so the box is round
   * at default type and simply grows when the reader asks for bigger text.
   */
  zoomStopPill: {
    minWidth: ZOOM_PILL_SIZE,
    minHeight: ZOOM_PILL_SIZE,
    paddingHorizontal: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: onColorCream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * ⚠️ The active stop INVERTS (cream fill, dark label) rather than merely
   * brightening. On a live camera feed a subtle tint is invisible against a bright
   * or busy scene, and the whole point of the strip is to answer "which zoom am I
   * on?" at a glance. The label uses `surface.camera` — the same dark token the
   * screen's background uses — so the pair is the inverse of the idle state rather
   * than a new colour.
   */
  zoomStopPillActive: { backgroundColor: onColorCream, borderColor: onColorCream },
  /** `caption`, not `body`: the label shrank with the pill it sits in. */
  zoomLabel: { color: onColorCream, fontSize: fontSize.caption.at390, fontWeight: '600' },
  zoomLabelActive: { color: surface.camera },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: onColorCream,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH_TARGET,
  },
  pressed: { opacity: 0.75 },
  shutterBusy: { opacity: 0.4 },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: onColorCream },
  failRow: { alignItems: 'center', paddingHorizontal: space.lg },
  failText: {
    color: onColorCream,
    fontSize: fontSize.caption.at390,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  smallButton: {
    backgroundColor: onColorCream,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
  },
  smallButtonLabel: { color: surface.camera, fontSize: fontSize.body.at390, fontWeight: '600' },
  gate: { flex: 1, backgroundColor: surface.paper, paddingHorizontal: space.lg },
  gateTitle: {
    color: text.ink,
    fontSize: fontSize.titlePage.at390,
    fontWeight: '700',
    marginBottom: space.sm,
  },
  gateBody: {
    color: text.inkSoft,
    fontSize: fontSize.body.at390,
    lineHeight: 22,
    marginBottom: space.xl,
  },
  button: {
    backgroundColor: brand.cinnabar,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonLabel: { color: onColorCream, fontSize: fontSize.body.at390, fontWeight: '600' },
  srOnly: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});