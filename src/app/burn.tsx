/**
 * BURN — *non-AR AR* (ADR-003): live camera behind a fixed fire overlay.
 *
 * THE ACCEPTANCE TEST IS ON THIS SCREEN (doc 17 §2 A5)
 *
 * The four aim bands grade the throw, not fps. This screen does the one thing
 * that matters: turn a drag-and-release into the **px offset from the fire's
 * heart**, and hand that offset to `gradeThrow`.
 *
 * Two deliberate decisions:
 *
 *   1. **The fire is screen-fixed, not world-locked** (ADR-003, the Pokémon GO
 *      catch pattern). So the heart is a *fraction* of the screen measured on
 *      layout — not a world coordinate — and the px it yields are the same px
 *      space the bands were measured in (doc 05 §2). That is why thresholds
 *      measured once, off the fire's own artwork, survive being applied here.
 *   2. **The client never asserts a band** (ADR-005). It grades locally only to
 *      show a preview and submits the *offset*; `submit_burn` re-derives the
 *      band server-side. `gradeThrow` returning `previewBand` is a display
 *      concern, not an authority — the field is named for it.
 *   3. **The throw is DRAWN, not merely graded.** The offering lags the finger
 *      and the release sends it along a Bézier that LANDS on the release point —
 *      which is the very point `gradeThrow` measures from. So "where it visibly
 *      lands" and "what it scored" are one number, and a graze cannot look like
 *      a bullseye. The fire only answers once the offering has arrived.
 */

import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ART_SCALE, FLAME_TOP_ABOVE_HEART, FireArt, type FireReaction } from '@/components/fire-art';
import type { BandId } from '@/domain/aim';
import {
  MAX_THROWS,
  bandLabel,
  canThrow,
  gradeThrow,
  heartPoint,
  offsetFromHeart,
  restingPoint,
} from '@/domain/throw';
import { localized, t } from '@/lib/i18n';
import { nativeLoaderUriFromAnyForm } from '@/lib/native-path';
import { readBurnParams, toRewardParams } from '@/lib/route-params';
import { supabase, supabaseConfig } from '@/lib/supabase';
import {
  TOUCH_TARGET,
  fontSize,
  onColorCream,
  radius,
  space,
  surface,
  text,
} from '@/theme/tokens';

/**
 * ⚠️ `HEART_AT` / `REST_AT` / `heartPoint` / `restingPoint` live in
 * `src/domain/throw.ts`, NOT here — deliberately.
 *
 * They used to be local constants, and that is precisely how the artwork drifted
 * from the grader. Keeping both halves of that coupling in one pure module is
 * what lets `check:throw` assert they agree without a device. Do not re-localise
 * them.
 *
 * Both were raised 12 % on 2026-10-18 (`HEART_AT.y` 0.56 → 0.44,
 * `REST_AT.y` 0.86 → 0.74). Raising the heart is GRADING-SAFE: every band is a
 * RADIUS from that point, so moving the point moves the whole target and changes
 * no offset. `FireArt` draws AROUND the heart, never beside it.
 */

/**
 * How long a signed sprite URL is good for. The burn screen is the last hop of
 * a ritual that takes seconds, so five minutes is generous; a short life is the
 * point, because the sprite is private (`styled_read_own`).
 */
const SPRITE_URL_TTL_S = 300;

/**
 * The offered object: the cut-out sprite, drawn at its own alpha.
 *
 * ⚠️ The box is a MAXIMUM, not a crop. The sprite comes back from stage ④ with
 * transparent pixels and a bounding box that is not square, so it is FITTED
 * inside this box (`resizeMode="contain"`) rather than filled into it — `cover`
 * scales the image up until it covers the box, which cuts the offering off.
 *
 * ⚠️ AND NOTHING MAY BE PAINTED BEHIND IT. #60 mounted the sprite on a
 * `surface.paper` card (#F5F0E8, the same cream stage ④ had just cut away), which
 * put the opaque rectangle straight back and made the cut invisible. The sprite
 * carries its own ink outline, so it stays legible over the camera without a
 * card — adding a background here silently undoes the paid cutout.
 * ⚠️ AND ITS SIZE IS THE BOARD'S, MEASURED (S64) — THEN DOUBLED ON THE OWNER'S CALL.
 * `EN · 4 Burn` (390 × 844) draws `art · held offering · car D` at **132 × 96 px**,
 * centred **(133, 686)** — with the swipe hint at y 790–810. So the offering is
 * **132 wide, not 72**: at 72 a real offering read as a token rather than as the
 * thing the player photographed. The box is square and `contain`-fitted, so a sprite
 * with the board's own 1.375 aspect renders exactly 132 × 96; a squarer one renders
 * up to 132 × 132, which is still within the room the board leaves above the hint.
 *
 * ⚠️ 132 → 264 (S64 follow-up, owner): *"the offering size on the ritual page is
 * still too small — make it twice as big as it is now."* The board's own number is
 * the FLOOR, not the ceiling, and the glass run is the authority on how it reads at
 * arm's length. The box is still square and `contain`-fitted, so the doubled box
 * holds a 264 × 192 sprite on the board's aspect — and because every flight
 * transform is relative to this box's centre, the drag, the arc and the return
 * needed no change at all. One number moved.
 */
const OFFERING_SIZE = 264;

/**
 * How far the held object trails the finger. This is the PROTOTYPE's authored
 * feel (`dx * .35, dy * .55`, `public/demo/app.js`): the finger's real travel is
 * the aim and the sprite lags it — which is also what gives the release
 * something to fly across, since the arc starts where the sprite is.
 */
const DRAG_LAG = { x: 0.35, y: 0.55 } as const;

/** Flight time per band. A miss hangs longest — it has the farthest to fall. */
const FLIGHT_MS = { bullseye: 620, devout: 620, graze: 700, miss: 780 } as const;

/** The missed offering's glide back to the hand (S9: it is never destroyed). */
const RETURN_MS = 520;

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * One throw's arc, pre-sampled into the arrays `Animated.interpolate` needs.
 * All offsets are relative to the resting point, because that is where the
 * offering's box is anchored.
 */
interface FlightPlan {
  /** Interpolation stops, 0 → 1. */
  at: number[];
  x: number[];
  y: number[];
  /** Absolute screen points — kept so a return can start from where it landed. */
  from: Point;
  to: Point;
}

/** Before the first throw: the object is home and not moving. */
const HOME_PLAN: FlightPlan = {
  at: [0, 1],
  x: [0, 0],
  y: [0, 0],
  from: { x: 0, y: 0 },
  to: { x: 0, y: 0 },
};

/**
 * The throw's arc.
 *
 * A quadratic Bézier through the two ends whose control point sits halfway
 * across — which makes x LINEAR in time and y a parabola: exactly the shape the
 * prototype flew (`controlPoint` in `public/demo/app.js`). `apexY` is the height
 * the curve actually peaks at, not a control point, so the caller can say "clear
 * the flame by half the offering" and get it.
 *
 * ⚠️ SAMPLED, not eased: `Easing` maps progress to a single NUMBER, but the path
 * needs a different curve for x and y. Twelve chords put the error well under a
 * pixel at this size, and the whole flight is drawn on the JS driver anyway.
 */
function arcPlan(from: Point, to: Point, apexY: number, origin: Point): FlightPlan {
  const cx = (from.x + to.x) / 2;
  const cy = 2 * apexY - (from.y + to.y) / 2;
  const steps = 12;
  const at: number[] = [];
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const q = 1 - t;
    at.push(t);
    x.push(q * q * from.x + 2 * q * t * cx + t * t * to.x - origin.x);
    y.push(q * q * from.y + 2 * q * t * cy + t * t * to.y - origin.y);
  }
  return { at, x, y, from, to };
}

interface Preview {
  readonly offsetPx: number;
  readonly band: BandId;
  readonly capped: boolean;
  readonly returns: boolean;
  readonly spent: boolean;
}

export default function BurnScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);

  const [permission] = useCameraPermissions();
  /**
   * The route contract, read as a CONTRACT (src/lib/route-params.ts).
   *
   * ⚠️ THE FIX (2026-10-06). This screen previously read no route params at all,
   * so `captureId` — the id the whole award is keyed to — was never in scope, and
   * `confirm` pushed to `/reward` without it. `/reward` then refused with a
   * generic `bad_params`, which meant the slice could never show a receipt.
   * A missing id is now refused by name, at the screen that would have dropped it.
   */
  const burnParams = readBurnParams(
    useLocalSearchParams<{ captureId: string; uri: string; spritePath?: string; demo?: string }>(),
  );
  const captureId = burnParams.ok ? burnParams.captureId : null;
  /** SCRUM-85 — carried through to `/reward`, which branches on it. */
  const demo = burnParams.ok ? burnParams.demo : false;
  /**
   * The cartoonized sprite's key in the private `styled` bucket, or `null` when
   * this hop has none (the tutorial). The URI param is the ORIGINAL photo — it is
   * not, and never was, the sprite.
   */
  const spritePath = burnParams.ok ? burnParams.spritePath : null;
  /** The photograph the player took — the TUTORIAL's offering (see `offeringUri`). */
  const photoUri = burnParams.ok ? burnParams.uri : '';
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [throwNumber, setThrowNumber] = useState(1);
  /**
   * The signed sprite URL, TAGGED WITH THE KEY IT WAS MINTED FOR.
   *
   * ⚠️ Tagged rather than a bare `string | null` so the "no sprite" case needs no
   * state at all: a URL whose `path` no longer matches the route's `spritePath` is
   * simply not used (see `spriteUrl` below). That keeps this effect free of a
   * synchronous `setState`, which `react-hooks/set-state-in-effect` (rightly)
   * rejects — and it means a re-render can never show the previous offering's
   * artwork for a frame while the new key is being signed.
   */
  const [signed, setSigned] = useState<{ readonly path: string; readonly url: string } | null>(null);
  /** The URL to draw, or `null` — derived, never stored, so it cannot go stale. */
  const spriteUrl = spritePath !== null && signed?.path === spritePath ? signed.url : null;
  /** The arc this throw is flying. `HOME_PLAN` = nothing in the air. */
  const [plan, setPlan] = useState<FlightPlan>(HOME_PLAN);
  /** The fire's answer, once the offering has actually arrived. */
  const [reaction, setReaction] = useState<FireReaction | null>(null);
  const [reactionNonce, setReactionNonce] = useState(0);
  /**
   * Has the offering finished flying? The GRADE is shown at release, but the
   * buttons only appear once it has landed — so the throw is watchable, and so a
   * rethrow cannot be pressed into the middle of a flight (`rethrow` re-plans the
   * arc, which from mid-air would be a teleport).
   */
  const [arrived, setArrived] = useState(false);
  /** True while a missed offering is gliding home, when no new throw may start. */
  const [returning, setReturning] = useState(false);

  /**
   * THE TUTORIAL'S OFFERING — the photo the player just took.
   *
   * A **real** hop draws the signed cartoonized sprite. The **tutorial** never
   * contacts the orchestrator on purpose (`TUTORIAL_CONSEQUENCES`: a first run must
   * not spend AI money), so it reaches this screen with no `spritePath` — and that
   * left an EMPTY place where the offering belongs: the player photographed
   * something and never saw it again. The demo now draws that photograph, which is
   * already on the device as the `uri` param and costs nothing.
   *
   * ⚠️ THE URI NEEDS A NATIVE-LOADER ENCODING, AND WHICH ONE IS NOT FIXED — MEASURED TWICE.
   * The route param arrives DECODED (`…/ExperienceData/@scope/slug/Camera/a.jpg`) while the
   * sandbox directory on disk is literally `%40scope%2Fslug`, and every native loader decodes
   * a URI exactly once. Handing `<Image>` the param as-is draws nothing (a magenta test
   * background showed through the whole box), and `Image.getSize` answers ENOENT; encoding it
   * once (`%40…`) also ENOENTs, because the loader decodes it straight back. The
   * double-encoded form is the one that resolves — `Image.getSize` returned **3000 × 4000**.
   *
   * ⚠️ S64: *"the param arrives decoded"* is a property of the ROUTE, not of the photo — a
   * hop that goes through a URL decodes it, and a sibling screen's `router.push` does not.
   * The frame step measured the RAW form arriving on exactly this kind of hop this session
   * and drew a black stage. So the encoding is now `nativeLoaderUriFromAnyForm`, which is
   * correct whichever of the three forms turns up. ⚠️ Do NOT go back to
   * `nativeLoaderUriFromDecoded` here: it is a no-op on the raw form, and the failure is
   * silent — a missing picture, not an error.
   *
   * ⚠️ Deliberately demo-only. If signing fails on a REAL hop, drawing the original
   * photo would present the *unstyled* image as the thing the player paid to have
   * transformed — a worse lie than no picture. A real failure stays "no offering",
   * logged as `sprite_sign_failed`.
   */
  const demoOffering =
    spritePath === null && demo && photoUri.length > 0
      ? nativeLoaderUriFromAnyForm(photoUri)
      : null;

  /** The image to draw, or `null` — derived, never stored, so it cannot go stale. */
  const offeringUri = spriteUrl ?? demoOffering;

  /**
   * Sign the sprite so `<Image>` can load it.
   *
   * ⚠️ WHY A SIGNED URL: the `styled` bucket is **private** (migration `0006`;
   * read is scoped by `styled_read_own` on `foldername(name)[1] = auth.uid()`), so
   * there is no public URL to hand an `<Image>`. The key itself is what the
   * orchestrator recorded — `{userId}/{captureId}.{ext}` — and its extension is
   * chosen by the generator (webp since migration `0010`), which is exactly why
   * the screen must be TOLD the key rather than rebuild it.
   *
   * ⚠️ AND THE SIGNER CAN ANSWER WITH A **RELATIVE** PATH (`/object/sign/...`),
   * which React Native's image loader cannot fetch. The orchestrator hit the same
   * thing against fal and documents it at
   * `supabase/functions/cartoonize-orchestrator/index.ts:119` — the same
   * normalisation is applied here rather than rediscovered on a device.
   *
   * A failure is NON-FATAL on purpose: the throw is still gradeable and still
   * awardable without the artwork, so a missing sprite must degrade to "no
   * picture", never to a blocked ritual. It is logged, not shown as an error.
   */
  useEffect(() => {
    if (spritePath === null) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase()
          .storage.from('styled')
          .createSignedUrl(spritePath, SPRITE_URL_TTL_S);
        if (cancelled) return;
        if (error || !data?.signedUrl) {
          console.warn('sprite_sign_failed:', error?.message ?? 'no signed url');
          return;
        }
        const url = data.signedUrl.startsWith('http')
          ? data.signedUrl
          : `${supabaseConfig().url}/storage/v1${data.signedUrl}`;
        setSigned({ path: spritePath, url });
      } catch (error) {
        if (cancelled) return;
        console.warn(
          'sprite_sign_threw:',
          error instanceof Error ? error.message : String(error),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spritePath]);

  /**
   * The offering's three transform sources.
   *
   * ⚠️ ALL THREE RUN ON THE JS DRIVER (`useNativeDriver: false`). The flight's
   * interpolation range is re-planned for every throw — a different arc, a
   * different landing point, a return from wherever the last one came to rest —
   * and a native animated node does not reliably pick up a changed range. The
   * fire's reaction stays on the UI thread (a fixed range, in `fire-art.tsx`).
   * The screen does nothing else while an offering is in the air, so there is no
   * JS work for the flight to contend with.
   */
  const [drag] = useState(() => new Animated.ValueXY());
  const [flight] = useState(() => new Animated.Value(0));
  const [landed] = useState(() => new Animated.Value(1));
  /** The band whose flight is waiting for its arc to render. */
  const pendingBand = useRef<BandId | null>(null);
  /** Bumped per throw, so a stale completion cannot land or reset a live one. */
  const flightToken = useRef(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  /** The graded point, and the hand. Both derived from the ONE measured layout. */
  const heart = useMemo(() => heartPoint(size.width, size.height), [size.width, size.height]);
  const rest = useMemo(() => restingPoint(size.width, size.height), [size.width, size.height]);

  /** Grade the resting point of a drag, in screen px. */
  const gradeRest = useCallback(
    (dx: number, dy: number, n: number): Preview | null => {
      if (size.width === 0 || size.height === 0) return null;
      const release = { x: rest.x + dx, y: rest.y + dy };
      // ⚠️ DIVIDE BY THE ART SCALE. The thresholds are the fire's own
      // proportions in PENPOT units, but the artwork is drawn at `ART_SCALE`.
      // Grading the raw screen distance would let 虔诚's boundary (±39.40) fall
      // outside a flame whose visible half-width is now 33.7 dp — a throw that
      // visibly misses the fire would still pay ×1.5.
      const outcome = gradeThrow(offsetFromHeart(release, heart) / ART_SCALE, n);
      return {
        offsetPx: outcome.offsetPx,
        band: outcome.previewBand,
        capped: outcome.capped,
        returns: outcome.returns,
        spent: outcome.spent,
      };
    },
    [heart, rest, size.width, size.height],
  );

  /**
   * What the fire does when the offering arrives. The GRADE is already on screen
   * — it was decided at release — so this is the visual half only.
   */
  const land = useCallback(
    (band: BandId) => {
      setArrived(true);
      if (band === 'miss') {
        // Not burned, so not dimmed out of existence: it lies where it fell,
        // outside the pit, until the player decides to throw it again.
        Animated.timing(landed, { toValue: 0.6, duration: 240, useNativeDriver: false }).start();
        return;
      }
      const takes = band === 'bullseye' || band === 'devout';
      setReaction(takes ? 'flare' : 'smoulder');
      setReactionNonce((n) => n + 1);
      Animated.timing(landed, {
        // A hit is CONSUMED in the flame core; a graze is left charring on the coals.
        toValue: takes ? 0 : 0.28,
        duration: takes ? 240 : 320,
        delay: takes ? 80 : 0,
        useNativeDriver: false,
      }).start();
    },
    [landed],
  );

  /**
   * Kick the flight once its arc has rendered.
   *
   * ⚠️ NOT IN THE RELEASE HANDLER. `setPlan` is committed on the next render but
   * `Animated.Value.setValue` takes effect immediately, so resetting the values
   * there would apply them against the OLD arc for a frame — snapping the
   * offering back to the hand before the new arc exists. After the commit the two
   * agree (the new arc's t=0 IS the lagged position), so the handover is seamless.
   */
  useEffect(() => {
    const band = pendingBand.current;
    if (band === null) return;
    pendingBand.current = null;
    flightToken.current += 1;
    const token = flightToken.current;
    drag.setValue({ x: 0, y: 0 });
    flight.setValue(0);
    landed.stopAnimation();
    landed.setValue(1);
    Animated.timing(flight, {
      toValue: 1,
      duration: FLIGHT_MS[band],
      // ⚠️ LINEAR. The Bézier IS the easing; a second easing would bend the
      // parabola into something that no longer lands where it was aimed.
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && token === flightToken.current) land(band);
    });
  }, [plan, drag, flight, landed, land]);

  /**
   * Release = one throw.
   *
   * The finger's real travel is still the AIM — exactly as before this screen
   * drew anything, so the four bands are untouched. What is new is that the
   * sprite lags the finger (`DRAG_LAG`), so the arc has a real distance to cover:
   * it starts where the sprite is and lands where the finger let go. Because the
   * grade is a RADIUS from the heart, landing at the release point puts the
   * offering in the flame, on the coals or in the dirt for free — the same
   * geometry that graded it.
   */
  const releaseThrow = useCallback(
    (dx: number, dy: number) => {
      const graded = gradeRest(dx, dy, throwNumber);
      if (graded === null) return;
      setPreview(graded);
      setArrived(false);
      setReaction(null);

      const from = { x: rest.x + dx * DRAG_LAG.x, y: rest.y + dy * DRAG_LAG.y };
      const to = { x: rest.x + dx, y: rest.y + dy };
      // Clear the flame by half the offering, and never fly under the HUD.
      const apexY = Math.max(
        heart.y - FLAME_TOP_ABOVE_HEART - OFFERING_SIZE / 2,
        insets.top + OFFERING_SIZE,
      );
      // Hand off to the effect above: the arc has to render before the flight
      // can be started against it (see the note there).
      pendingBand.current = graded.band;
      setPlan(arcPlan(from, to, apexY, rest));
    },
    [gradeRest, throwNumber, rest, heart.y, insets.top],
  );

  /**
   * Nothing may call setState after the screen is gone. A stopped animation
   * reports `finished: false`, which every callback above already ignores.
   */
  useEffect(
    () => () => {
      drag.stopAnimation();
      flight.stopAnimation();
      landed.stopAnimation();
    },
    [drag, flight, landed],
  );

  // The responder needs the measured layout, so it is rebuilt when the layout or
  // the throw number changes rather than captured once on the first render.
  const responder = useMemo(
    () =>
      PanResponder.create({
        // ONE throw at a time: once a grade is on screen the buttons drive
        // (Confirm / Throw again), so a second swipe cannot re-grade underneath
        // an offering that is still in the air. Nor while a missed offering is
        // still gliding home — that would cut its arc short.
        onMoveShouldSetPanResponder: (_e, g) =>
          preview === null && !returning && Math.abs(g.dy) > TOUCH_TARGET,
        onPanResponderMove: (_e, g) => {
          drag.setValue({ x: g.dx * DRAG_LAG.x, y: g.dy * DRAG_LAG.y });
        },
        onPanResponderRelease: (_e, g) => releaseThrow(g.dx, g.dy),
        onPanResponderTerminate: () => drag.setValue({ x: 0, y: 0 }),
      }),
    [preview, returning, releaseThrow, drag],
  );

  // The offering's flight, read off the current plan. `flight` is the throw's
  // progress: 0 = in the hand, 1 = where it was aimed (or, after a re-plan, the
  // same 0..1 walked backwards to bring it home).
  const flyX = flight.interpolate({ inputRange: plan.at, outputRange: plan.x });
  const flyY = flight.interpolate({ inputRange: plan.at, outputRange: plan.y });
  const flyScale = flight.interpolate({ inputRange: [0, 1], outputRange: [1, 0.58] });
  // It is further from the hand, so it shrinks; and it tumbles late, then rights
  // itself just before it lands. 0 at rest — a tilted offering in the hand is a
  // different object, and the return path passes through this same curve.
  const flyTilt = flight.interpolate({
    inputRange: [0, 0.82, 1],
    outputRange: ['0deg', '-16.4deg', '3.4deg'],
  });

/**
   * Confirm the graded throw. The client sends the **offset**; the server
   * derives the band (ADR-005) and is the only writer of the award.
   */
  const confirm = useCallback(() => {
    if (preview === null || !canThrow(throwNumber)) return;
    // ⚠️ THE FIX (2026-10-06): the capture id used to be dropped right here, so
    // `/reward` refused with `bad_params` and the slice could never show a
    // receipt. It is now a REQUIRED argument of `toRewardParams`, so a future
    // edit cannot forget it — the compiler objects instead of the player finding out.
    if (captureId === null) return;
    router.push({
      pathname: '/reward',
      params: toRewardParams(captureId, preview.offsetPx, throwNumber, demo),
    });
  }, [preview, router, throwNumber, captureId, demo]);

  /**
   * The offering RETURNS on a miss (S9) — the sprite is not consumed. It glides
   * home along a fresh arc that STOPS where it lay, then the throw re-arms.
   *
   * ⚠️ The handover is a RE-PLAN, not a jump. The return is built with the hand
   * at t=0 and the ditch at t=1, so `flight` is already 1 and its position is the
   * landing point — the first frame of the return is the last frame of the
   * throw. Animating to 0 then walks the same parameter backwards, home.
   */
  const rethrow = useCallback(() => {
    if (preview?.returns !== true || !canThrow(throwNumber + 1)) return;
    const token = flightToken.current;
    setReturning(true);
    setPlan(arcPlan(rest, plan.to, Math.min(rest.y, plan.to.y) - 30, rest));
    Animated.timing(landed, { toValue: 1, duration: RETURN_MS, useNativeDriver: false }).start();
    Animated.timing(flight, {
      toValue: 0,
      duration: RETURN_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      setReturning(false);
      // A new throw may have claimed the token while the offering was gliding
      // home; its arc must not be reset out from under it.
      if (!finished || token !== flightToken.current) return;
      // Only now is it safe to forget the arc: at 0 the home plan is the same
      // place. Resetting it mid-flight would teleport the sprite to the hand.
      setPlan(HOME_PLAN);
      drag.setValue({ x: 0, y: 0 });
    });
    setReaction(null);
    setThrowNumber((n) => n + 1);
    setPreview(null);
  }, [preview, throwNumber, plan.to, rest, flight, drag, landed]);

  if (permission && !permission.granted) {
    return <View style={styles.screen} />;
  }

  /**
   * No capture id ⇒ this screen cannot complete the ritual. That is a routing
   * fault, never something the player did — so it says so plainly and offers the
   * only honest way on (begin again), rather than grading a throw that could
   * never be awarded. Reachable only if a future hop forgets the id, which is
   * exactly what `check:wire` now guards.
   */
  if (captureId === null) {
    return (
      <View
        style={[
          styles.screen,
          styles.lost,
          { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl },
        ]}
      >
        <Text style={styles.caption}>{t('burn.lostPlace')}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/capture')} style={styles.button}>
          <Text style={styles.buttonLabel}>{t('common.begin')}</Text>
        </Pressable>
      </View>
    );
  }

  const exhausted = preview !== null && (preview.spent || preview.returns) && !canThrow(throwNumber);

  return (
    <View style={styles.screen} onLayout={onLayout} {...responder.panHandlers}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {/* The fire: fixed, screen-relative (ADR-003 — non-AR AR). Its heart is the
          exact point `HEART_AT` grades against, so the artwork is anchored TO it
          rather than laid out around it — the bands cannot drift off the flame. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <FireArt
          width={size.width}
          heartX={heart.x}
          heartY={heart.y}
          reaction={reaction}
          reactionNonce={reactionNonce}
        />
      </View>

      {/* The offering: held at the hand, then thrown at it.
          ⚠️ `pointerEvents="none"` — the whole screen is the PanResponder, and an
          overlay that swallowed the touch would make the throw undemonstrable.
          The box is anchored at the HAND and every transform is relative to it,
          so the drag, the flight and the return share one coordinate space.
          Rendered only once there is BOTH an image and a measured layout: `rest`
          is (0,0) before `onLayout`, so drawing earlier would flash it top-left. */}
      {offeringUri !== null && size.height > 0 ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Animated.View
            testID="burn-offering"
            style={[
              styles.offering,
              {
                left: rest.x - OFFERING_SIZE / 2,
                top: rest.y - OFFERING_SIZE / 2,
                opacity: landed,
                transform: [
                  { translateX: Animated.add(drag.x, flyX) },
                  { translateY: Animated.add(drag.y, flyY) },
                  { scale: flyScale },
                  { rotate: flyTilt },
                ],
              },
            ]}
          >
            {/* ⚠️ `contain`, never `cover`: the cut-out is not square, and
                `cover` fills the box by cropping the offering. `contain` fits
                the whole sprite inside it and keeps the aspect ratio. */}
            <Image
              source={{ uri: offeringUri }}
              style={styles.offeringImage}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </Animated.View>
        </View>
      ) : null}

      {/*
        THE HINT — a floating chip, not bare text (S64, owner).

        ⚠️ WHY IT EXISTS: this screen runs over a LIVE CAMERA, and the hint was cream
        text with no background — against a pale wall, or in daylight, the words
        vanished. The chip gives them a surface of their own. It is inset from the
        sides and translucent, so it reads as a label over the scene rather than a
        header bar — see `hintChip` in the styles for the arithmetic.
      */}
      <View style={[styles.hud, { paddingTop: insets.top + space.md }]} pointerEvents="none">
        <View style={styles.hintChip}>
          <Text style={styles.hint}>{t('burn.aimHint')}</Text>
        </View>
        <Text style={styles.throws}>
          {throwNumber} / {MAX_THROWS}
        </Text>
      </View>

      <View style={[styles.result, { paddingBottom: insets.bottom + space.lg }]} pointerEvents="box-none">
        {preview === null ? (
          /* ⚠️ The SECOND hint wears the same chip as the first (S64, owner). It is
             the line the thumb sits on, and it had the same defect: cream text with
             no background, over a camera, at the brightest part of the scene. One
             chip style, two hints — the screen would look half-fixed otherwise. */
          <View style={styles.hintChip}>
            <Text style={[styles.caption, styles.captionInChip]}>{t('burn.dragHint')}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.bandText}>{localized(bandLabel(preview.band))}</Text>
            <Text style={styles.offsetText}>±{preview.offsetPx.toFixed(2)} px</Text>

            {preview.returns ? (
              <Text style={styles.caption}>{t('burn.returns')}</Text>
            ) : (
              <Text style={styles.caption}>
                {/* SCRUM-23: a rethrow is capped at Devout — say so rather than
                    silently grading it lower than the player aimed. */}
                {preview.capped ? t('burn.capped') : ' '}
              </Text>
            )}

            {/* ⚠️ The action waits for the offering to LAND. The grade is honest
                the moment it leaves the hand, but a rethrow pressed mid-flight
                would re-plan the arc underneath a sprite that is still in the
                air — and the throw is worth watching anyway. */}
            {arrived &&
              (exhausted ? (
                <Text style={styles.caption}>{t('burn.exhausted')}</Text>
              ) : (
                <View style={styles.row}>
                  {preview.returns && (
                    <Pressable accessibilityRole="button" onPress={rethrow} style={styles.button}>
                      <Text style={styles.buttonLabel}>{t('burn.rethrow')}</Text>
                    </Pressable>
                  )}
                  {!preview.returns && (
                    <Pressable accessibilityRole="button" onPress={confirm} style={styles.button}>
                      <Text style={styles.buttonLabel}>{t('common.confirm')}</Text>
                    </Pressable>
                  )}
                </View>
              ))}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.camera },
  /**
   * The offered object itself — NO card.
   *
   * ⚠️ This style is the whole transparency contract: a `backgroundColor`, a
   * `borderWidth` or `overflow: 'hidden'` here draws a frame around a cut-out
   * that stage ④ paid to make transparent. Keep it bare; the sprite's own ink
   * outline is what makes it legible over the camera.
   */
  offering: {
    position: 'absolute',
    width: OFFERING_SIZE,
    height: OFFERING_SIZE,
  },
  offeringImage: { width: '100%', height: '100%' },
  lost: { alignItems: 'center', justifyContent: 'center' },
  hud: { alignItems: 'center' },
  /**
   * ⚠️ THE HINT'S CHIP — floating, rounded, TRANSLUCENT (S64, owner).
   *
   * WHY IT EXISTS: this screen runs over a live camera and the hint was cream text
   * with NO background, so against a pale wall — or in daylight — the words vanished.
   * The chip gives the words a surface of their own without hiding the scene.
   *
   * ⚠️ AND WHY IT FLOATS RATHER THAN SPANS: `maxWidth` + `marginHorizontal` keep it
   * off the left and right glass at ANY type size (a long line wraps inside the chip
   * instead of reaching the edge), and its parents centre it, so it never reaches the
   * bottom either. A chip that touched the edges would read as a header bar rather
   * than as a label floating over the scene — which is the whole request.
   *
   * ⚠️ THE OPACITY IS PARTIAL ON PURPOSE (0.72), and it is a WHOLE-GROUP opacity, so
   * the words are softened with the fill — that is the trade the owner chose ("do not
   * use full opacity"), and it is why the label is no longer faded ON TOP of it: the
   * two alphas used to stack (0.85 over 0.72) and the text would have gone grey.
   * Measured: composited over a blown-out white scene the cream words still land at
   * ≈7:1 against their own chip, so the fill darkens what is behind the text without
   * dimming the text itself below AA.
   */
  hintChip: {
    backgroundColor: surface.camera,
    opacity: 0.72,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    marginHorizontal: space.lg,
    maxWidth: '88%',
  },
  /** Full opacity now: the chip above supplies the contrast the fade was standing in for. */
  hint: { color: onColorCream, fontSize: fontSize.caption.at390 },
  throws: { color: onColorCream, fontSize: fontSize.caption.at390, opacity: 0.6, marginTop: space.xs },
  result: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: space.lg },
  bandText: { color: onColorCream, fontSize: fontSize.titleScreen.at390, fontWeight: '700' },
  offsetText: { color: onColorCream, fontSize: fontSize.caption.at390, opacity: 0.7 },
  caption: {
    color: onColorCream,
    fontSize: fontSize.caption.at390,
    textAlign: 'center',
    marginTop: space.sm,
    opacity: 0.85,
  },
  /**
   * A caption INSIDE a chip. Two overrides, both mechanical: the chip already
   * supplies the spacing (`marginTop` would offset the words inside it), and the
   * chip's own translucency is the fade — a second one on the text would dim it twice.
   */
  captionInChip: { marginTop: 0, opacity: 1 },
  row: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  button: {
    backgroundColor: surface.camera,
    borderWidth: 1,
    borderColor: onColorCream,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
  },
  buttonLabel: { color: text.gold, fontSize: fontSize.body.at390, fontWeight: '600' },
});