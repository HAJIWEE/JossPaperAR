/**
 * CROP — the FRAME step: the player shows the app what the offering IS (SCRUM-131).
 *
 * `capture → CROP → preparing → burn → award`. This screen sits between the shutter
 * and the upload, and its whole job is a single promise:
 *
 *     what leaves this screen is the region the player chose, and nothing else.
 *
 * ── WHY IT EXISTS AT ALL ─────────────────────────────────────────────────────
 * Before this screen the slice pushed the WHOLE FRAME at `/preparing`, which uploads
 * it into the 300 KB `captures` bucket and hands it to the styler. So the player paid
 * (≈US$0.09 a run) to have the AI restyle their table, their hand and their wall
 * along with the offering — and the photo had to be shrunk hard to fit the bucket at
 * all (`src/lib/capture-size.ts`). Framing the offering first removes the background
 * AROUND it; the server-side stage ④ cutout (SCRUM-129) removes what is left INSIDE.
 *
 * ── ⚠️ THE BLACK SCREEN THIS SCREEN MUST NOT REPEAT ──────────────────────────
 * The owner's report was that the frame step "showed a black screen" instead of the
 * photo just taken. That is a MEASURED failure with a known cause: a route param
 * arrives DECODED (`…/ExperienceData/@scope/slug/Camera/a.jpg`) while the sandbox
 * directory on disk is literally `%40scope%2Fslug`, and every native loader decodes a
 * URI exactly ONCE — so the loader looks for a path that does not exist and draws
 * nothing. `Image.getSize` answers `ENOENT`; `<Image>` paints the background.
 *
 * So the display URI and the manipulator input BOTH go through
 * `nativeLoaderUriFromDecoded` — the same fix `/burn` needed for the tutorial
 * offering (`src/lib/native-path.ts` measures all three encodings). ⚠️ Do not
 * "simplify" that away: the raw param renders a black rectangle, and it does so
 * silently.
 *
 * ── THE TWO MODES, AND THE HONEST LIMIT OF THE SECOND ────────────────────────
 *   RECTANGLE — a true pixel crop. Drag a box; `rectToImagePixels` maps it to whole
 *               image pixels and refuses anything under `MIN_CROP_EDGE_PX`.
 *   LASSO     — a freehand outline, APPLIED AS ITS BOUNDING BOX. `expo-image-manipulator`
 *               can only crop rectangles (`ActionCrop`: "fields specify top-left
 *               corner and dimensions of a crop rectangle"), so a masked selection
 *               would need a rasterizer this app does not depend on. The box is
 *               therefore DRAWN over the outline before the player confirms, and
 *               `crop.lassoNote` says so in words — the one thing a lasso must not do
 *               here is quietly send something the player did not see. Filed as
 *               **SCRUM-130**.
 *
 * ── IT CANNOT BLOCK THE RITUAL ───────────────────────────────────────────────
 * Every failure path below — unreadable photo, a crop the manipulator refuses, bad
 * route params — still offers a way forward that costs nothing: use the whole photo,
 * or retake. A screen between the player and their offering must never be the reason
 * nothing can be burned (the same rule as `/burn`'s missing sprite).
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';

import {
  containRect,
  cropRectFor,
  isUsableLasso,
  isWholeImage,
  lassoBounds,
  normaliseDrag,
  polylinePoints,
  scrimAround,
  type CropMode,
  type Point,
  type Rect,
  type Size,
} from '@/lib/crop-frame';
import { CAPTURE_COMPRESS } from '@/lib/capture-size';
import { t } from '@/lib/i18n';
import { nativeLoaderUriFromDecoded, uploadableUri } from '@/lib/native-path';
import { readCropParams, toPreparingParams } from '@/lib/route-params';
import { TOUCH_TARGET, brand, fontSize, onColorCream, radius, space, surface } from '@/theme/tokens';

type Phase =
  | { readonly kind: 'framing' }
  /** The manipulator is running — the shutter-equivalent of "shooting". */
  | { readonly kind: 'working' }
  /** The crop could not be applied. Recoverable: skip, or try again. */
  | { readonly kind: 'failed' };

/**
 * ⚠️ The save options are THE UPLOAD BUDGET'S OWN, imported rather than re-typed.
 *
 * This file is about to become that budget's input, and a crop written at 0.9 would
 * hand `boundedJpegBlob` a bigger blob to shrink — wasting a resize pass to get back to
 * where `CAPTURE_COMPRESS` would have started. A local `0.6` here would be a second
 * opinion on a number the bucket enforces; `check:framing` asserts the import.
 */
const CROP_FORMAT = SaveFormat.JPEG;

/** A stroke shorter than this (view px) is a stray tap, not a path point. */
const PATH_MIN_STEP_PX = 2;

/** A drag smaller than this (view px) is a tap; it does not leave a box behind. */
const RECT_MIN_DRAG_PX = 4;

export default function CropScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const raw = useLocalSearchParams<{
    captureId?: string;
    uri?: string;
    width?: string;
    height?: string;
    demo?: string;
  }>();
  const parsed = readCropParams(raw);

  // ── the hop's contract, flattened ─────────────────────────────────────────
  // ⚠️ Read through `readCropParams` and never off `raw` directly: the id and the
  // uri are what `/preparing` uploads under, and a blank one must be refused BY NAME
  // rather than coerced (the lesson `route-params.ts` itself exists for).
  const captureId = parsed.ok ? parsed.captureId : '';
  const uri = parsed.ok ? parsed.uri : '';
  const demo = parsed.ok ? parsed.demo : false;
  /** The shutter's own numbers — a FALLBACK if the photo cannot be measured. */
  const declaredW = parsed.ok ? (parsed.declaredSize?.width ?? 0) : 0;
  const declaredH = parsed.ok ? (parsed.declaredSize?.height ?? 0) : 0;

  /**
   * ⚠️ THE BLACK-SCREEN FIX, IN ONE LINE — see the file header.
   *
   * This uri is used for BOTH the `<Image>` and the manipulator, on purpose: they are
   * the same kind of consumer (a native decoder that decodes once), so they must be
   * given the same encoding. Deriving it once is also what stops the two drifting
   * apart into "the preview loads but the crop fails".
   */
  const nativeUri = useMemo(() => (uri.length > 0 ? nativeLoaderUriFromDecoded(uri) : ''), [uri]);

  /** The photo's true pixel size, measured — never assumed. See the effect below. */
  const [measured, setMeasured] = useState<Size | null>(null);
  /** The photo itself could not be read. The frame step degrades to skip/retake. */
  const [photoUnreadable, setPhotoUnreadable] = useState(false);
  /** The stage's own size, from `onLayout`. The letterbox is derived from it. */
  const [stage, setStage] = useState<Size | null>(null);

  const [mode, setMode] = useState<CropMode>('rect');
  /** The rectangle drag, in VIEW coordinates. */
  const [rect, setRect] = useState<Rect | null>(null);
  /** The lasso stroke, in VIEW coordinates. */
  const [path, setPath] = useState<readonly Point[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: 'framing' });

  /**
   * MEASURE THE PHOTO — with `Image.getSize`, i.e. with a native decoder.
   *
   * ⚠️ Why not simply trust `takePictureAsync`'s `width`/`height` (which arrive as
   * route params)? Because those describe what the CAPTURE thought it produced, while
   * the crop is measured against the bitmap the MANIPULATOR will actually read. If the
   * two ever disagreed — an orientation fix, a re-encode — the crop would be offset by
   * exactly that disagreement, and nothing would say so. Measuring the real image
   * removes the question.
   *
   * The declared numbers stay as the FALLBACK, so a device that cannot answer still
   * gets a working frame step; only when BOTH are unavailable does the screen admit
   * the photo is unreadable.
   */
  useEffect(() => {
    if (nativeUri.length === 0) {
      setPhotoUnreadable(true);
      return;
    }
    let alive = true;
    Image.getSize(
      nativeUri,
      (width, height) => {
        if (alive) setMeasured({ width, height });
      },
      () => {
        // ⚠️ `getSize` failing is EXACTLY the black-screen condition (it answers
        // ENOENT when the path was not re-encoded). Fall back; and if there is nothing
        // to fall back to, SAY SO, rather than drawing a dark box and letting the
        // player frame a photo they cannot see.
        if (!alive) return;
        if (declaredW > 0 && declaredH > 0) setMeasured({ width: declaredW, height: declaredH });
        else setPhotoUnreadable(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [nativeUri, declaredW, declaredH]);

  /**
   * The photo's drawn box inside the stage — `contain`-fitted and centred.
   *
   * ⚠️ Every overlay below is positioned from THIS rect, and the image itself is drawn
   * at exactly this rect (`resizeMode="stretch"` into an aspect-correct box), so what
   * the player points at is what gets mapped. A `contain` image plus independently
   * positioned overlays would be two implementations of one piece of geometry.
   */
  const box = useMemo(
    () => (measured === null || stage === null ? null : containRect(measured, stage)),
    [measured, stage],
  );

  const onStageLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    // Guard against an identical re-layout: a bare `setStage` on every layout pass
    // re-renders forever on some devices.
    setStage((prev) => (prev !== null && prev.width === width && prev.height === height
      ? prev
      : { width, height }));
  }, []);

  /** The selection as DRAWN — clipped to the photo, so it never outlines the letterbox. */
  const drawnSelection = useMemo((): Rect | null => {
    if (box === null) return null;
    const proposed = mode === 'rect' ? rect : lassoBounds(path);
    if (proposed === null) return null;
    const left = Math.max(proposed.x, box.x);
    const top = Math.max(proposed.y, box.y);
    const right = Math.min(proposed.x + proposed.width, box.x + box.width);
    const bottom = Math.min(proposed.y + proposed.height, box.y + box.height);
    if (!(right > left) || !(bottom > top)) return null;
    return { x: left, y: top, width: right - left, height: bottom - top };
  }, [box, mode, rect, path]);

  /** `null` when the selection cannot be honoured — the screen says so, never sends it. */
  const preview = useMemo(
    () => (box === null || measured === null
      ? null
      : cropRectFor(mode, { ...(rect !== null ? { rect } : {}), path }, box, measured)),
    [box, measured, mode, rect, path],
  );

  const hasSelection = mode === 'rect' ? rect !== null : isUsableLasso(path);
  /** Drawn, but too small (or off the photo) to become a crop. */
  const tooSmall = hasSelection && preview === null;

  /**
   * The gesture's start point — TRANSIENT, so it lives in a ref.
   *
   * ⚠️ Not state: writing it during a gesture must not re-render, and nothing outside
   * the gesture callbacks ever reads it.
   */
  const dragStart = useRef<Point | null>(null);

  /**
   * The drawing surface.
   *
   * ⚠️ `locationX`/`locationY` are used, NOT `moveX`/`moveY`, because the responder view
   * is an absolutely-filled, TOPMOST child of the stage: the touch target IS the stage,
   * so a location is already a stage coordinate and no window offset has to be measured
   * and kept in sync. (The well-known Android caveat applies when the touch target is a
   * *different* view — here it cannot be.)
   *
   * ⚠️ Recreated when `mode` changes, and only then: the handlers must close over the
   * CURRENT mode (a stale mode would draw a rectangle while the lasso pill is lit), and
   * rebuilding a responder cannot interrupt anything — the mode changes by tapping a
   * pill, never mid-stroke.
   */
  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Keep the gesture. A stolen pan mid-stroke would leave a half-drawn selection
      // that the player never released, which is worse than a missed frame.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const point = locationOf(event);
        dragStart.current = point;
        if (mode === 'rect') {
          // A new drag REPLACES the box — that is how the selection is adjusted, so
          // there is no separate "clear" affordance to explain.
          setRect({ x: point.x, y: point.y, width: 0, height: 0 });
          return;
        }
        // A new stroke restarts the path, for the same reason.
        setPath([point]);
      },
      onPanResponderMove: (event) => {
        const point = locationOf(event);
        if (mode === 'rect') {
          const start = dragStart.current;
          if (start !== null) setRect(normaliseDrag(start, point));
          return;
        }
        setPath((prev) => {
          const last = prev[prev.length - 1];
          // Sample-throttle: a moving finger emits far more events than a path needs,
          // and an unbounded array would re-render the whole overlay per pixel.
          if (last !== undefined
            && Math.hypot(point.x - last.x, point.y - last.y) < PATH_MIN_STEP_PX) {
            return prev;
          }
          return [...prev, point];
        });
      },
      onPanResponderRelease: () => {
        dragStart.current = null;
        if (mode !== 'rect') return;
        // A TAP must not leave a degenerate box behind — it would then read as "choose a
        // larger area" for a gesture the player never meant as a selection.
        setRect((prev) => (prev !== null
          && (prev.width < RECT_MIN_DRAG_PX || prev.height < RECT_MIN_DRAG_PX)
          ? null
          : prev));
      },
      onPanResponderTerminate: () => {
        dragStart.current = null;
      },
    }),
    [mode],
  );

  /**
   * Hand the capture on to `/preparing` — the one exit from this screen.
   *
   * ⚠️ `router.replace`, not `push`: this step is a detour, and leaving it on the stack
   * would let the Android back gesture return to a framing screen showing a photo whose
   * upload is already in flight. `replace` keeps the stack exactly as it was before this
   * screen existed (shrine → capture → preparing).
   *
   * ⚠️ `uploadableUri` — NOT `nativeUri`. They are deliberately different consumers:
   * `nativeUri` is for a native DECODER (it must survive one decode), while this is for
   * `uploadCapture`, which escapes the native-loader form itself and hands `fetch` the
   * collapsed one. Passing the loader form here would escape the path a second time and
   * the upload would read a 404 body as the offering (`src/lib/native-path.ts`).
   */
  const goOn = useCallback(
    (chosenUri: string) => {
      router.replace({
        pathname: '/preparing',
        params: toPreparingParams(captureId, chosenUri, demo),
      });
    },
    [captureId, demo, router],
  );

  /** Frame nothing — the whole photo, untouched. Always available, never costs anything. */
  const skip = useCallback(() => {
    goOn(uploadableUri(uri));
  }, [goOn, uri]);

  /**
   * Apply the frame, then hand on ONLY the cropped file.
   *
   * ⚠️ The order is the point: the crop is written and SAVED before anything is handed
   * onward, so what `/preparing` uploads is the crop — never the original frame carrying
   * an intent to crop it later. A failure here falls back to nothing worse than the whole
   * photo, which is free and cannot cost the player a spent capture.
   */
  const confirm = useCallback(async () => {
    if (preview === null || measured === null || nativeUri.length === 0) return;

    // A "crop" that covers the whole photo needs no file: do not pay a re-encode for an
    // image identical to the one we already have.
    if (isWholeImage(preview, measured)) {
      skip();
      return;
    }

    setPhase({ kind: 'working' });
    try {
      const rendered = await ImageManipulator.manipulate(nativeUri)
        .crop({
          originX: preview.x,
          originY: preview.y,
          width: preview.width,
          height: preview.height,
        })
        .renderAsync();
      const saved = await rendered.saveAsync({ compress: CAPTURE_COMPRESS, format: CROP_FORMAT });

      // ⚠️ `saved.uri` was written for a NATIVE LOADER, so it is escaped one level
      // further than the disk path; `uploadableUri` collapses it to the form
      // `uploadCapture` expects. The same function the skip path uses, on purpose: one
      // rule for "what does the upload get", whichever way the player left this screen.
      goOn(uploadableUri(saved.uri));
    } catch {
      // Not fatal by design — the player can try the frame again, or send the whole
      // photo. An image that cannot be written must not be the reason an offering cannot
      // be burned (the same rule as `/burn`'s missing sprite).
      setPhase({ kind: 'failed' });
    }
  }, [goOn, measured, nativeUri, preview, skip]);

  /** The dimming rects, from the pure helper — the screen draws, `crop-frame` decides. */
  const scrims = useMemo(
    () => (box === null || drawnSelection === null ? [] : scrimAround(drawnSelection, box)),
    [box, drawnSelection],
  );

  const busy = phase.kind === 'working';
  const canConfirm = preview !== null && !busy;

  // ── the two ways in that cost nothing ──────────────────────────────────────
  // ⚠️ Both are rendered BEFORE any hook-dependent UI below, but AFTER every hook
  // above — an early return that skipped a hook would break the rules of hooks.
  if (!parsed.ok) {
    return (
      <View style={[styles.screen, styles.centred, { paddingTop: insets.top + space.xl }]}>
        <Text style={styles.body}>{t('crop.badParams')}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/capture')}
          style={[styles.primary, styles.standalone]}
        >
          <Text style={styles.primaryLabel}>{t('common.recapture')}</Text>
        </Pressable>
      </View>
    );
  }

  if (photoUnreadable) {
    return (
      <View style={[styles.screen, styles.centred, { paddingTop: insets.top + space.xl }]}>
        <Text style={styles.body}>{t('crop.photoFailed')}</Text>
        {/*
          ⚠️ The whole photo is still offered. `uploadCapture` reads the bytes with
          `fetch`, which does NOT decode the uri — so a photo a native decoder cannot
          draw may still upload perfectly. Refusing to continue here would be refusing a
          working path because a PREVIEW failed.
        */}
        <Pressable accessibilityRole="button" onPress={skip} style={[styles.primary, styles.standalone]}>
          <Text style={styles.primaryLabel}>{t('crop.skip')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/capture')}
          style={[styles.secondary, styles.standalone]}
        >
          <Text style={styles.secondaryLabel}>{t('common.recapture')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.md },
      ]}
    >
      <Text style={styles.title}>{t('crop.title')}</Text>
      <Text style={styles.hint}>
        {mode === 'rect' ? t('crop.hintRect') : t('crop.hintLasso')}
      </Text>

      {/*
        The stage: measured here, and the photo is drawn at the EXACT rect `containRect`
        computes — so the overlays and the picture cannot disagree about where the photo
        is. See `containRect`'s note on the letterbox.
      */}
      <View style={styles.stage} onLayout={onStageLayout}>
        {box === null || measured === null ? (
          <Text style={styles.stageNote}>{t('crop.loading')}</Text>
        ) : (
          <>
            <Image
              testID="crop-photo"
              // ⚠️ `stretch` INTO AN ASPECT-CORRECT BOX is not a distortion: `box` has
              // the photo's own aspect ratio by construction, so stretching it there is
              // the same picture `contain` would draw — just positioned by us rather than
              // by the layout engine, which is what makes the overlays line up exactly.
              resizeMode="stretch"
              source={{ uri: nativeUri }}
              style={{ position: 'absolute', left: box.x, top: box.y, width: box.width, height: box.height }}
            />

            {scrims.map((scrim, index) => (
              <View
                key={`scrim-${index}`}
                pointerEvents="none"
                style={[styles.scrim, scrim]}
              />
            ))}

            {/*
              The freehand stroke, drawn where it was drawn. The BOX below is what will
              actually be sent — showing both is the honesty requirement (SCRUM-130).
            */}
            {mode === 'lasso' && path.length > 1 ? (
              <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
                <Polyline
                  points={polylinePoints(path)}
                  fill="none"
                  stroke={onColorCream}
                  strokeWidth={2}
                />
              </Svg>
            ) : null}

            {drawnSelection !== null ? (
              <View
                pointerEvents="none"
                testID="crop-selection"
                style={[
                  styles.selection,
                  drawnSelection,
                  // The lasso's frame is DASHED — a visual cue that it is a derived box
                  // around the outline, not the outline itself.
                  mode === 'lasso' && styles.selectionApplied,
                ]}
              />
            ) : null}

            {/*
              The drawing surface — LAST on purpose, so it is the topmost view and the
              touch target, which is what makes `locationX/Y` stage coordinates.
            */}
            <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />
          </>
        )}
      </View>

      {/* ── the controls: mode, the honest note, and the two exits ─────────── */}
      <View style={styles.modeRow}>
        {CROP_MODES.map((option) => {
          const active = option === mode;
          return (
            <Pressable
              key={option}
              testID={`crop-mode-${option}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(option === 'rect' ? 'crop.modeRect' : 'crop.modeLasso')}
              onPress={() => setMode(option)}
              style={({ pressed }) => [
                styles.modePill,
                active && styles.modePillActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>
                {t(option === 'rect' ? 'crop.modeRect' : 'crop.modeLasso')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/*
        ⚠️ The lasso's limit, in words, whenever the lasso is the active mode. The pill
        and the dashed frame say it visually; this says it in a sentence, because "I drew
        a circle and got a square" must not be a surprise after the player pays for a run.
      */}
      {mode === 'lasso' ? <Text style={styles.note}>{t('crop.lassoNote')}</Text> : null}

      {/* A drawn-but-unusable selection, and a failed apply — both are the SAME kind of
          message to the player: nothing is wrong with the photo, choose again. */}
      {tooSmall ? <Text style={styles.warn}>{t('crop.tooSmall')}</Text> : null}
      {phase.kind === 'failed' ? <Text style={styles.warn}>{t('crop.failed')}</Text> : null}

      <View style={styles.actionRow}>
        <Pressable
          testID="crop-skip"
          accessibilityRole="button"
          disabled={busy}
          onPress={skip}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed, busy && styles.off]}
        >
          <Text style={styles.secondaryLabel}>{t('crop.skip')}</Text>
        </Pressable>

        <Pressable
          testID="crop-confirm"
          accessibilityRole="button"
          // ⚠️ Disabled, not hidden: a control that vanishes is a control the player
          // hunts for. `tooSmall`/`crop.hintRect` above say what to do about it.
          disabled={!canConfirm}
          onPress={() => {
            void confirm();
          }}
          style={({ pressed }) => [
            styles.primary,
            pressed && styles.pressed,
            !canConfirm && styles.off,
          ]}
        >
          <Text style={styles.primaryLabel}>
            {busy ? t('crop.working') : t('crop.confirm')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * The two modes, as a list — so the control renders from the same source the pure
 * module validates against, instead of two hand-written pills drifting apart.
 */
const CROP_MODES = ['rect', 'lasso'] as const satisfies readonly CropMode[];

/**
 * A touch's position in STAGE coordinates.
 *
 * ⚠️ `locationX`/`locationY`, not `pageX`/`pageY`: the responder view absolutely fills
 * the stage and is its topmost child, so the touch target IS the stage and no window
 * origin has to be measured and kept in sync (see the responder's note).
 */
function locationOf(event: GestureResponderEvent): Point {
  return { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
}

const styles = StyleSheet.create({
  // ⚠️ `surface.camera` (#screen-burn) — the same dark as the shutter and the wait. This
  // screen sits between them, and a cream surface here would flash white between two dark
  // screens (the same reasoning `/preparing` records).
  screen: { flex: 1, backgroundColor: surface.camera, paddingHorizontal: space.lg },
  centred: { alignItems: 'center', justifyContent: 'center' },
  title: {
    color: onColorCream,
    fontSize: fontSize.titleScreen.at390,
    fontWeight: '700',
    textAlign: 'center',
  },
  hint: {
    color: onColorCream,
    fontSize: fontSize.caption.at390,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: space.sm,
    marginBottom: space.md,
    opacity: 0.85,
  },
  body: {
    color: onColorCream,
    fontSize: fontSize.bodyLg.at390,
    textAlign: 'center',
    marginBottom: space.lg,
  },
  /** The photo's frame. `flex: 1` so it takes whatever the controls leave. */
  stage: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  stageNote: { color: onColorCream, fontSize: fontSize.body.at390, opacity: 0.75 },
  /** Everything outside the selection — dark enough to read as "not included". */
  scrim: { position: 'absolute', backgroundColor: surface.camera, opacity: 0.55 },
  /** The frame that WILL be sent. */
  selection: { position: 'absolute', borderWidth: 2, borderColor: onColorCream },
  /**
   * The lasso's derived box: dashed and gold, so it cannot be confused with the
   * freehand stroke the player drew (which is solid cream, in the Svg above it).
   */
  selectionApplied: { borderWidth: 1, borderStyle: 'dashed', borderColor: brand.gold },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
  },
  modePill: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: onColorCream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modePillActive: { backgroundColor: onColorCream },
  modeLabel: { color: onColorCream, fontSize: fontSize.body.at390, fontWeight: '600' },
  modeLabelActive: { color: surface.camera },
  note: {
    color: onColorCream,
    fontSize: fontSize.caption.at390,
    textAlign: 'center',
    marginTop: space.sm,
    opacity: 0.75,
  },
  warn: {
    color: onColorCream,
    fontSize: fontSize.body.at390,
    textAlign: 'center',
    marginTop: space.sm,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
  },
  primary: {
    backgroundColor: brand.cinnabar,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryLabel: { color: onColorCream, fontSize: fontSize.body.at390, fontWeight: '600' },
  secondary: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: onColorCream,
    paddingHorizontal: space.lg,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryLabel: { color: onColorCream, fontSize: fontSize.body.at390, fontWeight: '600' },
  /** A full-width button in the centred refusal states. */
  standalone: { alignSelf: 'stretch', marginBottom: space.sm },
  pressed: { opacity: 0.75 },
  off: { opacity: 0.4 },
});