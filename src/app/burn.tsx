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
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BandId } from '@/domain/aim';
import { MAX_THROWS, bandLabel, canThrow, gradeThrow, offsetFromHeart } from '@/domain/throw';
import { readBurnParams, toRewardParams } from '@/lib/route-params';
import { TOUCH_TARGET, fontSize, onColorCream, radius, space, surface, text } from '@/theme/tokens';

/**
 * Where the fire's heart sits, as a fraction of the screen (doc 05 §2: the best
 * grade is the centre of the flame). Fixed — the fire does not move.
 */
const HEART_AT = { x: 0.5, y: 0.56 } as const;

/** The resting height of the throw — where the finger lifts off. */
const REST_AT = { x: 0.5, y: 0.86 } as const;

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
    useLocalSearchParams<{ captureId: string; uri: string; demo?: string }>(),
  );
  const captureId = burnParams.ok ? burnParams.captureId : null;
  /** SCRUM-85 — carried through to `/reward`, which branches on it. */
  const demo = burnParams.ok ? burnParams.demo : false;
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [throwNumber, setThrowNumber] = useState(1);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  /** Grade the resting point of a drag, in screen px. */
  const gradeRest = useCallback(
    (dx: number, dy: number, n: number): Preview | null => {
      if (size.width === 0 || size.height === 0) return null;
      const heart = { x: size.width * HEART_AT.x, y: size.height * HEART_AT.y };
      const resting = { x: size.width * REST_AT.x + dx, y: size.height * REST_AT.y + dy };
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
  }, [preview, router, throwNumber, captureId]);

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
        <Text style={styles.caption}>This offering lost its place — begin again.</Text>
        <Text style={styles.caption}>供品已失去記錄，請重新開始。</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/capture')} style={styles.button}>
          <Text style={styles.buttonLabel}>開始 · Begin</Text>
        </Pressable>
      </View>
    );
  }

  const exhausted = preview !== null && (preview.spent || preview.returns) && !canThrow(throwNumber);

  return (
    <View style={styles.screen} onLayout={onLayout} {...responder.panHandlers}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {/* The fire: fixed, screen-relative (ADR-003 — non-AR AR). */}
      <View style={[styles.fire, { top: size.height * HEART_AT.y }]} pointerEvents="none">
        <View style={styles.heart} />
        <Text style={styles.fireLabel}>火</Text>
      </View>

      <View style={[styles.hud, { paddingTop: insets.top + space.md }]} pointerEvents="none">
        <Text style={styles.hint}>上滑對準火心拋入 · Swipe up &amp; aim for the heart</Text>
        <Text style={styles.throws}>
          {throwNumber} / {MAX_THROWS}
        </Text>
      </View>

      <View style={[styles.result, { paddingBottom: insets.bottom + space.lg }]} pointerEvents="box-none">
        {preview === null ? (
          <Text style={styles.caption}>Drag up from here, and release over the fire.</Text>
        ) : (
          <>
            <Text style={styles.bandText}>
              {bandLabel(preview.band).zh} {bandLabel(preview.band).en}
            </Text>
            <Text style={styles.offsetText}>±{preview.offsetPx.toFixed(2)} px</Text>

            {preview.returns ? (
              <Text style={styles.caption}>
                未中火心 · 供品回到您手中 — nothing is lost, nothing is earned.
              </Text>
            ) : (
              <Text style={styles.caption}>
                {/* SCRUM-23: a rethrow is capped at Devout — say so rather than
                    silently grading it lower than the player aimed. */}
                {preview.capped ? 'A rethrow reaches at most 虔誠 Devout.' : ' '}
              </Text>
            )}

            {exhausted ? (
              <Text style={styles.caption}>The offering rests. 三次已盡。</Text>
            ) : (
              <View style={styles.row}>
                {preview.returns && (
                  <Pressable accessibilityRole="button" onPress={rethrow} style={styles.button}>
                    <Text style={styles.buttonLabel}>再試 · Try again</Text>
                  </Pressable>
                )}
                {!preview.returns && (
                  <Pressable accessibilityRole="button" onPress={confirm} style={styles.button}>
                    <Text style={styles.buttonLabel}>確認 · Confirm</Text>
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
  fire: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  heart: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(212,175,55,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(212,175,55,0.55)',
  },
  fireLabel: {
    color: onColorCream,
    fontSize: fontSize.display.at390,
    marginTop: -72,
    opacity: 0.9,
  },
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