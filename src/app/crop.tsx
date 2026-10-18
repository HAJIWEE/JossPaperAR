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
 * `nativeLoaderUriFromAnyForm` — the same fix `/burn` needed for the tutorial
 * offering (`src/lib/native-path.ts` measures all three encodings). ⚠️ Do not
 * "simplify" that away: the raw param renders a black rectangle, and it does so
 * silently. ⚠️ And it is the FORM-AGNOSTIC one on purpose — S64 measured a real capture
 * arriving as the RAW form on this very hop, which `nativeLoaderUriFromDecoded` (the S60
 * answer, right for the decoded form) passes through untouched.
 *
 * ── THE TWO MODES, AND WHAT EACH ONE ACTUALLY SENDS (rewritten in S64) ───────
 *   RECTANGLE — a true pixel crop. Drag a box; `rectToImagePixels` maps it to whole
 *               image pixels and refuses anything under `MIN_CROP_EDGE_PX`. The
 *               manipulator cuts it from the PHOTO'S OWN pixels.
 *   LASSO     — a FREE-FORM mask (S64). The outline must be a closed, simple,
 *               non-degenerate loop (`src/lib/lasso.ts` refuses it by name
 *               otherwise), and everything outside it is painted out of the picture
 *               before the file is written. ⚠️ SCRUM-130 shipped this as its
 *               BOUNDING BOX and the owner rejected it — "the Lasso tool currently
 *               is effecting a rectangle area which defeats the purpose" — so the
 *               mask is now the drawn shape, rasterized from the very view the
 *               player is looking at (`Svg.toDataURL`, see `crop-frame.ts`).
 *
 * ⚠️ THE TWO MODES SEND DIFFERENTLY-SHAPED FILES, because the tools differ:
 * a rectangle DISCARDS the outside, a mask REPLACES it with flat dark (JPEG has no
 * alpha — the long version is in `crop-frame.ts`'s header). Both are honest about
 * it on screen: the rectangle draws a frame around what it will cut, and the lasso
 * shows the masked picture itself.
 *
 * ── IT CANNOT BLOCK THE RITUAL ───────────────────────────────────────────────
 * Every failure path below — unreadable photo, a frame the manipulator refuses, an
 * outline that does not close, bad route params — still offers a way forward that
 * costs nothing: use the whole photo, or retake. A screen between the player and
 * their offering must never be the reason nothing can be burned (the same rule as
 * `/burn`'s missing sprite).
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
import Svg, { Image as SvgImage, Path, Polyline } from 'react-native-svg';

import {
  clampRectToBox,
  containRect,
  cropRectFor,
  DIM_PATH_FILL_RULE,
  dimPathPolygon,
  isWholeImage,
  normaliseDrag,
  polylinePoints,
  rectToViewStyle,
  scrimAround,
  type CropMode,
  type Point,
  type Rect,
  type Size,
} from '@/lib/crop-frame';
import { CAPTURE_COMPRESS } from '@/lib/capture-size';
import { t } from '@/lib/i18n';
import { lassoFault, lassoFaultMessageKey, lassoPolygon, lassoRegion } from '@/lib/lasso';
import { nativeLoaderUriFromAnyForm, uploadableUri } from '@/lib/native-path';
import { readCropParams, toPreparingParams } from '@/lib/route-params';
import { TOUCH_TARGET, brand, fontSize, onColorCream, radius, space, surface } from '@/theme/tokens';

/**
 * How long we wait for the mask to rasterize before saying it could not be done.
 *
 * ⚠️ A guard, not a policy. `toDataURL`'s callback is deferred by the native module
 * until the view has been rendered, and a promise that never settles would leave the
 * confirm button reading "Framing your offering…" for ever, with no way out but
 * the back gesture. Eight seconds is far longer than a raster that works takes
 * (tens of milliseconds) and far shorter than a player's patience.
 */
const MASK_RASTER_TIMEOUT_MS = 8000;

/**
 * The smallest PNG base64 we will believe is a real mask.
 *
 * ⚠️ THIS FLOOR IS LOAD-BEARING — the same lesson as `CAPTURE_MIN_BYTES`. If the
 * mask view's photo never loads, the raster is still *produced*: it is the opaque
 * flat fill and nothing else, which PNG compresses to a couple of hundred bytes.
 * Handed to the manipulator, that becomes a perfectly valid black JPEG — a silent
 * wrong offering bought for ≈US$0.09. A real mask is a photographic region at
 * view resolution, so it is tens of thousands of base64 characters; 12,000
 * (~9 KB of PNG) is an order of magnitude above an empty raster and an order of
 * magnitude below a real one. Measured: an empty 512×512 raster is ≈440 chars.
 */
const MASK_RASTER_MIN_BASE64_CHARS = 12_000;

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
   *
   * ⚠️ S64 ADDENDUM — THIS WAS THE BLACK SCREEN, AND THE `getSize` FALLBACK HID IT. A probe
   * run this session caught a REAL capture arriving as form 1 (`%40scope%2Fslug…`), on which
   * `nativeLoaderUriFromDecoded` is a no-op and every native decoder answers ENOENT — while
   * the declared-size fallback below kept the screen laying out its overlays, so it looked
   * like a working screen whose photo happened to be dark. The uri now goes through
   * `nativeLoaderUriFromAnyForm`, which is right for all three encodings.
   *
   * ⚠️ Four things about the fix are load-bearing, because each was a way this broke before:
   *
   *  ① The DISPLAY and the MANIPULATOR get the SAME string, derived once — they are the same
   *     kind of consumer (a native decoder that decodes once), so two derivations would only
   *     let them drift into "the preview loads but the crop fails".
   *  ② The SVG mask's `<SvgImage href={nativeUri}>` is that same string — a third consumer,
   *     same encoding, no separate rule.
   *  ③ `uploadableUri` is the OTHER side of the same fact: it wants form 1, and — unlike a
   *     naive pass-through — it is correct for all three forms too, so the skip path and the
   *     framed path hand the uploader the same shape.
   *  ④ So nothing on this screen may call `nativeLoaderUriFromDecoded` or
   *     `escapeForNativeLoader` directly. `check:framing` asserts the form-agnostic helper is
   *     the one used.
   */
  const nativeUri = useMemo(() => (uri.length > 0 ? nativeLoaderUriFromAnyForm(uri) : ''), [uri]);

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
  /**
   * Is a finger DOWN on the drawing surface right now?
   *
   * ⚠️ The outline's verdict is held back until the finger comes up (S64). Judging a
   * half-drawn loop would flash "join the two ends" under the player's own hand while
   * they are still drawing, which reads as the screen arguing with a gesture that has
   * not finished. One boolean, set on grant and cleared on release.
   */
  const [strokeOpen, setStrokeOpen] = useState(false);
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

  /**
   * SOMETHING HAS BEEN DRAWN, AND THE GESTURE IS OVER — the moment a verdict is welcome.
   *
   * ⚠️ `path.length > 1`, not `isUsableLasso(path)`: a stroke that is too flat or too short
   * to be a selection is still SOMETHING the player drew, and it needs a sentence (a
   * disabled button with no explanation is the failure this avoids). `rect !== null` is the
   * rectangle's own answer to the same question.
   */
  const strokeEnded = mode === 'lasso' ? path.length > 1 && !strokeOpen : rect !== null;

  /**
   * THE OUTLINE, VALIDATED — `null` until the drawn loop is a closed, simple,
   * non-degenerate shape (see `src/lib/lasso.ts` for the rules and why each one
   * exists). This is what the confirm button is gated on, so an outline that would
   * mask the wrong region can never be sent.
   */
  const polygon = useMemo(
    () => (mode === 'lasso' ? lassoPolygon(path) : null),
    [mode, path],
  );

  /**
   * WHICH fault the outline has, for the sentence shown to the player.
   *
   * ⚠️ Only asked once a stroke has ENDED (`strokeEnded`): a half-drawn loop is not
   * "not closed", it is *not finished*, and a refusal that appears under the player's own
   * finger reads as the screen arguing with them. Nothing has been drawn at all → no
   * verdict either; the instruction above the stage is what they need then.
   */
  const fault = useMemo(
    () => (mode === 'lasso' && strokeEnded ? lassoFault(path) : null),
    [mode, path, strokeEnded],
  );

  /**
   * THE REGION — the area this frame will send, in whole view coordinates.
   *
   *   · rectangle — the dragged box, clipped to the photo.
   *   · lasso     — the outline's bounding box, clipped the same way. The MASK is
   *                 free-form; the REGION is still a box, because the file has to be
   *                 a rectangle and the outline is drawn inside it.
   *
   * Both go through `clampRectToBox`/`lassoRegion`, so neither mode can select the
   * letterbox — the arithmetic the gate holds still with a selection dragged off the
   * photo's edge.
   */
  const region = useMemo((): Rect | null => {
    if (box === null) return null;
    if (mode === 'lasso') return polygon === null ? null : lassoRegion(polygon, box);
    return rect === null ? null : clampRectToBox(rect, box);
  }, [box, mode, polygon, rect]);

  /**
   * THE PIXEL CROP — rectangle mode only, and the sharper of the two paths: the
   * manipulator cuts it from the PHOTO'S OWN pixels, not from the screen.
   */
  const pixelCrop = useMemo(
    () => (mode !== 'rect' || box === null || measured === null || rect === null
      ? null
      : cropRectFor('rect', { rect }, box, measured)),
    [box, measured, mode, rect],
  );

  /**
   * THE MASK'S PIXEL SIZE — lasso mode's equivalent of the pixel crop, and it exists
   * for ONE reason: the minimum-size rule.
   *
   * ⚠️ It runs the RAW path through the same mode-aware entry point the rectangle uses
   * (`cropRectFor`, whose lasso branch is `lassoBounds` → clip → `rectToImagePixels` →
   * `isUsableCropRect`), so both modes are held to ONE minimum. The rect it returns cuts
   * nothing — the renderer produces the mask from the view — which is why this looks like
   * an unused result. It is the rule, not the crop.
   */
  const maskPixels = useMemo(
    () => (mode !== 'lasso' || box === null || measured === null
      ? null
      : cropRectFor('lasso', { path }, box, measured)),
    [box, measured, mode, path],
  );

  /**
   * Drawn, but not sendable — too small, off the photo, or (lasso) not watertight.
   *
   * ⚠️ A fault takes precedence: "your outline crosses itself" is a more useful sentence
   * than "choose a larger area" when both happen to be true.
   */
  const canSend = mode === 'rect' ? pixelCrop !== null : polygon !== null && maskPixels !== null;
  const tooSmall = strokeEnded && fault === null && !canSend;

  /**
   * The gesture's start point — TRANSIENT, so it lives in a ref.
   *
   * ⚠️ Not state: writing it during a gesture must not re-render, and nothing outside
   * the gesture callbacks ever reads it.
   */
  const dragStart = useRef<Point | null>(null);

  /**
   * The MASK VIEW — the raster source, and the reason the lasso's preview and its file
   * cannot drift: they are the same view.
   *
   * ⚠️ A ref, not state: assigning it must not re-render, and `toDataURL` needs the
   * native handle rather than anything React renders.
   */
  const svgRef = useRef<Svg | null>(null);

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
        setStrokeOpen(true);
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
        // The finger is up: from here the outline can be judged (S64).
        setStrokeOpen(false);
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
        setStrokeOpen(false);
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
   * Rasterize the mask view into PNG base64 — `Svg.toDataURL`, the only rasterizer
   * this app has (see `crop-frame.ts`'s header for why the mask lives in SVG).
   *
   * ⚠️ THE RESULT IS MEASURED, NOT TRUSTED. Two things can go wrong silently here and
   * both produce a *valid file*: the native module can call back with nothing (it does,
   * on iOS, when the view has not rendered yet), and a mask whose photo never loaded
   * rasterizes as flat fill — a black offering nobody would notice until the styler
   * returned. So both an empty callback and a raster below
   * `MASK_RASTER_MIN_BASE64_CHARS` are REJECTED, and the screen says the frame could
   * not be applied instead of sending the wrong one.
   *
   * ⚠️ No `options` argument: on Android the raster is `Bitmap.createBitmap(getWidth(),
   * getHeight())` — the view in PIXELS — while on iOS the same `{width, height}` is
   * interpreted in POINTS and multiplied by the device scale, so an explicit size would
   * mean two different resolutions per platform. The view's own bounds have one
   * meaning on both: "as big as the photo is drawn".
   */
  const rasterizeMask = useCallback((): Promise<string> => new Promise((resolve, reject) => {
    const view = svgRef.current;
    if (view === null) {
      reject(new Error('mask_view_missing'));
      return;
    }
    let settled = false;
    const finish = (base64: string | undefined): void => {
      if (settled) return;
      settled = true;
      if (typeof base64 === 'string' && base64.length >= MASK_RASTER_MIN_BASE64_CHARS) {
        resolve(base64);
      } else {
        reject(new Error('mask_raster_empty'));
      }
    };
    // The guard, so a callback that never arrives cannot strand the screen.
    setTimeout(() => finish(undefined), MASK_RASTER_TIMEOUT_MS);
    view.toDataURL(finish, undefined);
  }), []);

  /**
   * Apply the frame, then hand on ONLY the framed file.
   *
   * ⚠️ The order is the point: the file is written and SAVED before anything is handed
   * onward, so what `/preparing` uploads is the frame — never the original carrying an
   * intent to frame it later. A failure here falls back to nothing worse than the whole
   * photo, which is free and cannot cost the player a spent capture.
   *
   * ⚠️ TWO PATHS, and they are not two spellings of one idea:
   *
   *   · RECTANGLE — the manipulator crops the photo's own pixels. Exact, and the
   *     sharpest thing we can send.
   *   · LASSO — the mask view is rasterized (`toDataURL` → PNG base64), then fed to the
   *     manipulator as a `data:` URI purely to WRITE IT AS A FILE at the upload budget's
   *     compression. The SDK documents base64 data URIs as a valid source ("Should be on
   *     the local file system or a base64 data URI"), and iOS reads `url.scheme == "data"`
   *     in `ImageManipulatorUtils.swift`; on Android the loader is Glide, which resolves
   *     `data:` through its own `DataUrlLoader`.
   */
  const confirm = useCallback(async () => {
    if (measured === null || nativeUri.length === 0) return;
    if (mode === 'rect' && pixelCrop === null) return;
    if (mode === 'lasso' && polygon === null) return;

    // A rectangle that covers the whole photo needs no file: do not pay a re-encode for
    // an image identical to the one we already have. ⚠️ A MASK never skips — the player
    // drew a shape, and the shape changes the picture.
    if (mode === 'rect' && pixelCrop !== null && isWholeImage(pixelCrop, measured)) {
      skip();
      return;
    }

    setPhase({ kind: 'working' });
    try {
      const saved = mode === 'lasso'
        ? await (async () => {
          const base64 = await rasterizeMask();
          const rendered = await ImageManipulator
            .manipulate(`data:image/png;base64,${base64}`)
            .renderAsync();
          return rendered.saveAsync({ compress: CAPTURE_COMPRESS, format: CROP_FORMAT });
        })()
        : await (async () => {
          const rendered = await ImageManipulator.manipulate(nativeUri)
            .crop({
              // `pixelCrop` is non-null on this branch (guarded above); the fallbacks are
              // here because a nested closure cannot narrow it for the type checker.
              originX: pixelCrop?.x ?? 0,
              originY: pixelCrop?.y ?? 0,
              width: pixelCrop?.width ?? 0,
              height: pixelCrop?.height ?? 0,
            })
            .renderAsync();
          return rendered.saveAsync({ compress: CAPTURE_COMPRESS, format: CROP_FORMAT });
        })();

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
  }, [goOn, measured, mode, nativeUri, pixelCrop, polygon, rasterizeMask, skip]);

  /**
   * The dimming rects, from the pure helper — the screen draws, `crop-frame` decides.
   *
   * ⚠️ `rectToViewStyle` is what turns them into a style, because React Native has no
   * `x`/`y` style property. Spreading the `Rect` straight into `style` — which is what
   * this screen first did — silently drops its position and piles all four rects onto
   * the stage's top-left corner. That was the owner's inverted-dimming bug; see
   * `rectToViewStyle`'s header for the measurement.
   */
  const scrims = useMemo(
    () => (box === null || region === null ? [] : scrimAround(region, box)),
    [box, region],
  );

  /**
   * The mask path — the ONE path that paints everything outside the outline (S64). An
   * empty string means "no mask to draw"; `canSend` has already refused in that case.
   */
  const maskPath = useMemo(
    () => (region === null || polygon === null ? '' : dimPathPolygon(region, polygon)),
    [polygon, region],
  );

  const busy = phase.kind === 'working';
  const canConfirm = canSend && !busy;

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
                style={[styles.scrim, rectToViewStyle(scrim)]}
              />
            ))}

            {/*
              THE FREE-FORM MASK (S64) — the lasso's picture AND the file's source.

              ⚠️ Everything about this view is load-bearing:

              · it is sized to the REGION and `viewBox`ed to the same box, so the same
                content scales to any raster size — the preview and the sent file are
                one view at two resolutions, which is why "what you see is what is
                sent" is true rather than aspirational;
              · the photo is drawn INSIDE it (`SvgImage`), offset so it lands exactly
                where the plain `<Image>` above drew it — and the plain image stays
                mounted so the rest of the screen is still the photo, softly dimmed;
              · the mask is ONE even-odd path (`dimPathPolygon`): the region's box with
                the outline as a hole, so everything outside the drawn shape is painted
                out. `DIM_PATH_FILL_RULE` is `evenodd` or the hole would not exist.
            */}
            {mode === 'lasso' && region !== null && maskPath !== '' ? (
              <Svg
                ref={svgRef}
                testID="crop-mask"
                style={{
                  position: 'absolute',
                  left: region.x,
                  top: region.y,
                  width: region.width,
                  height: region.height,
                }}
                viewBox={`0 0 ${region.width} ${region.height}`}
                preserveAspectRatio="none"
              >
                <SvgImage
                  href={nativeUri}
                  x={box.x - region.x}
                  y={box.y - region.y}
                  width={box.width}
                  height={box.height}
                  // The image's box already has the photo's aspect ratio, so `none`
                  // cannot distort it — and it removes one scaling rule from a chain we
                  // cannot see.
                  preserveAspectRatio="none"
                />
                <Path
                  d={maskPath}
                  fill={surface.camera}
                  fillRule={DIM_PATH_FILL_RULE}
                />
              </Svg>
            ) : null}

            {/*
              The freehand stroke, drawn where it was drawn — ON TOP of the mask, so the
              player can still see the line they are drawing over their offering.

              ⚠️ The dashed "this outline becomes a box" frame that used to sit here is
              GONE: it disclosed a limit that no longer exists. With the mask in place the
              picture shows the truth directly, which is better than a frame around it.
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

            {/*
              ⚠️ RECTANGLE MODE ONLY: the frame that WILL be cut. In lasso mode the mask
              above already shows what is sent, and a second rectangle around it would
              suggest a box crop the lasso is not doing.
            */}
            {mode === 'rect' && region !== null ? (
              <View
                pointerEvents="none"
                testID="crop-selection"
                style={[styles.selection, rectToViewStyle(region)]}
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
        ⚠️ What the lasso DOES, in words — rewritten in S64. SCRUM-130's sentence said
        the outline would be used as a box, which is now false, and a screen that keeps
        explaining a limit it no longer has is worse than one that says nothing.
      */}
      {mode === 'lasso' ? <Text style={styles.note}>{t('crop.lassoNote')}</Text> : null}

      {/*
        A FAULT IN THE OUTLINE, named (S64). ⚠️ Each fault gets its OWN sentence rather
        than one generic refusal: "your outline is not closed" and "your outline crosses
        itself" are two different things to do about it, and the owner asked for exactly
        this — *"else error out to the user and reject it"*.
      */}
      {fault !== null ? (
        <Text testID="crop-lasso-fault" style={styles.warn}>
          {t(lassoFaultMessageKey(fault))}
        </Text>
      ) : null}

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
  /** The frame that WILL be sent — rectangle mode only (see the stage). */
  selection: { position: 'absolute', borderWidth: 2, borderColor: onColorCream },
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