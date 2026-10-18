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
 */

import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BandId } from '@/domain/aim';
import {
  MAX_THROWS,
  bandLabel,
  canThrow,
  fireBoxTop,
  gradeThrow,
  heartPoint,
  offsetFromHeart,
  restingPoint,
} from '@/domain/throw';
import { localized, t } from '@/lib/i18n';
import { nativeLoaderUriFromDecoded } from '@/lib/native-path';
import { readBurnParams, toRewardParams } from '@/lib/route-params';
import { supabase, supabaseConfig } from '@/lib/supabase';
import { TOUCH_TARGET, fontSize, onColorCream, radius, space, surface, text } from '@/theme/tokens';

/**
 * ⚠️ `HEART_AT` / `REST_AT` / `heartPoint` / `restingPoint` / `fireBoxTop` live in
 * `src/domain/throw.ts`, NOT here — deliberately.
 *
 * They used to be local constants, and that is precisely how the artwork drifted
 * from the grader: this screen positioned the fire by its TOP EDGE while
 * `gradeThrow` graded against the heart's CENTRE, so the flame was drawn 60 px
 * below the point the throw was scored against. Keeping both halves of that
 * coupling in one pure module is what lets `check:throw` assert they agree
 * without a device. Do not re-localise them.
 */

/** The fire's drawn diameter. `fireBoxTop` centres a box of this size on the heart. */
const FIRE_SIZE = 120;

/** The held offering's drawn size (doc 17 §3: the sprite is an overlay layer). */
const SPRITE_SIZE = 140;

/**
 * How long a signed sprite URL is good for. The burn screen is the last hop of
 * a ritual that takes seconds, so five minutes is generous; a short life is the
 * point, because the sprite is private (`styled_read_own`).
 */
const SPRITE_URL_TTL_S = 300;

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
   * ⚠️ THE URI NEEDS `nativeLoaderUriFromDecoded`, AND THAT IS MEASURED. The route
   * param arrives DECODED (`…/ExperienceData/@scope/slug/Camera/a.jpg`) while the
   * sandbox directory on disk is literally `%40scope%2Fslug`, and every native
   * loader decodes a URI exactly once. Handing `<Image>` the param as-is draws
   * nothing (a magenta test background showed through the whole 140 dp box), and
   * `Image.getSize` answers ENOENT; encoding it once (`%40…`) also ENOENTs, because
   * the loader decodes it straight back. The double-encoded form is the one that
   * resolves — `Image.getSize` returned **3000 × 4000**. Note this is NOT
   * `escapeForNativeLoader`, which assumes the URI still carries its escapes (see
   * that function's header, and `nativeLoaderUriFromDecoded`'s).
   *
   * ⚠️ Deliberately demo-only. If signing fails on a REAL hop, drawing the original
   * photo would present the *unstyled* image as the thing the player paid to have
   * transformed — a worse lie than no picture. A real failure stays "no offering",
   * logged as `sprite_sign_failed`.
   */
  const demoOffering =
    spritePath === null && demo && photoUri.length > 0
      ? nativeLoaderUriFromDecoded(photoUri)
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

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  /** Grade the resting point of a drag, in screen px. */
  const gradeRest = useCallback(
    (dx: number, dy: number, n: number): Preview | null => {
      if (size.width === 0 || size.height === 0) return null;
      const heart = heartPoint(size.width, size.height);
      const base = restingPoint(size.width, size.height);
      const resting = { x: base.x + dx, y: base.y + dy };
      const outcome = gradeThrow(offsetFromHeart(resting, heart), n);
      return {
        offsetPx: outcome.offsetPx,
        band: outcome.previewBand,
        capped: outcome.capped,
        returns: outcome.returns,
        spent: outcome.spent,
      };
    },
    [size.width, size.height],
  );

  // The responder needs the measured layout, so it is rebuilt when the layout or
  // the throw number changes rather than captured once on the first render.
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > TOUCH_TARGET,
        onPanResponderRelease: (_e, g) => {
          const graded = gradeRest(g.dx, g.dy, throwNumber);
          if (graded) setPreview(graded);
        },
      }),
    [gradeRest, throwNumber],
  );

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

  /** The offering RETURNS on a miss (S9) — the sprite is not consumed. */
  const rethrow = useCallback(() => {
    if (preview?.returns === true && canThrow(throwNumber + 1)) {
      setThrowNumber((n) => n + 1);
      setPreview(null);
    }
  }, [preview, throwNumber]);

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

      {/*
        THE OFFERING — the cartoonized sprite, held at the throw's resting point
        (doc 17 §3: "offering (the styled sprite being held)").

        ⚠️ THE BUG THIS FIXES (2026-10-18). The ritual generated a sprite, stored
        it, and then showed the player a live camera feed — the thing they paid to
        see was never on screen. Two independent faults, both needed: the key was
        never passed from `/preparing` (`toBurnParams` had no field for it), and
        this screen had no `<Image>` to receive it. `uri` is the ORIGINAL photo,
        which is why passing it would have *looked* like a fix.

        ⚠️ AND THE TUTORIAL HAD NO OFFERING AT ALL (fixed 2026-10-18, same day).
        The demo hop carries no `spritePath` on purpose — it must not spend — so
        this block drew nothing at all and the player never saw the photo they had
        just taken. `offeringUri` falls back to that photo for the demo only; see
        its definition for why a real hop must NOT fall back.

        It is drawn ABOVE the camera and BELOW the fire, at the resting point's
        baseline (`top` is offset by its own height so it sits *above* "here" in
        the drag hint rather than covering it). Rendered only once the layout is
        measured, for the same reason as the fire below.
      */}
      {offeringUri !== null && size.height > 0 ? (
        <View
          style={[styles.spriteLayer, { top: restingPoint(size.width, size.height).y - SPRITE_SIZE }]}
          pointerEvents="none"
        >
          <Image
            testID="burn-offering"
            source={{ uri: offeringUri }}
            style={styles.sprite}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </View>
      ) : null}

      {/*
        The fire: fixed, screen-relative (ADR-003 — non-AR AR).

        ⚠️ TWO THINGS THAT WERE WRONG HERE.
          1. `top` took `height × HEART_AT.y` — which is the heart's CENTRE — and
             used it as the box's TOP EDGE, so the drawn flame sat `FIRE_SIZE / 2`
             below the point `gradeThrow` grades against. The player aimed at the
             fire they could see and was scored against one 60 px higher.
             `fireBoxTop` now owns that centring, and `check:throw` asserts it.
          2. `size.height` is 0 until `onLayout` fires, so on the first frame the
             flame snapped to the very top of the screen and then jumped. It is
             now not drawn until there is a measurement to place it with.
      */}
      {size.height > 0 ? (
        <View
          style={[styles.fire, { top: fireBoxTop(size.height, FIRE_SIZE) }]}
          pointerEvents="none"
        >
          <View style={styles.heart} />
          <Text style={styles.fireLabel}>火</Text>
        </View>
      ) : null}

      <View style={[styles.hud, { paddingTop: insets.top + space.md }]} pointerEvents="none">
        <Text style={styles.hint}>{t('burn.aimHint')}</Text>
        <Text style={styles.throws}>
          {throwNumber} / {MAX_THROWS}
        </Text>
      </View>

      <View style={[styles.result, { paddingBottom: insets.bottom + space.lg }]} pointerEvents="box-none">
        {preview === null ? (
          <Text style={styles.caption}>{t('burn.dragHint')}</Text>
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

            {exhausted ? (
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
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.camera },
  lost: { alignItems: 'center', justifyContent: 'center' },
  /**
   * ⚠️ `height: FIRE_SIZE` + `justifyContent: 'center'` are load-bearing, and the
   * `FIRE_SIZE` passed to `fireBoxTop(...)` must be the SAME number: the offset it
   * applies is `boxSize / 2`, so a box of a different height would put the flame's
   * centre off the graded heart again — silently, and only on a device.
   */
  fire: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: FIRE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heart: {
    width: FIRE_SIZE,
    height: FIRE_SIZE,
    borderRadius: FIRE_SIZE / 2,
    backgroundColor: 'rgba(212,175,55,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(212,175,55,0.55)',
  },
  /**
   * Absolutely positioned (not a flex sibling with negative margin): it must sit
   * squarely ON the heart's centre, and `marginTop: -72` only faked that by
   * guessing at the glyph's line height. With no `top`/`left` given, Yoga aligns
   * an absolute child by the parent's `justifyContent`/`alignItems` — which above
   * are both `'center'`, so the glyph lands on the heart without a magic number.
   */
  fireLabel: {
    position: 'absolute',
    color: onColorCream,
    fontSize: fontSize.display.at390,
    opacity: 0.9,
  },
  /** The held offering: full width so `alignItems` can centre it at REST_AT.x. */
  spriteLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  sprite: { width: SPRITE_SIZE, height: SPRITE_SIZE },
  hud: { alignItems: 'center' },
  hint: { color: onColorCream, fontSize: fontSize.caption.at390, opacity: 0.85 },
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