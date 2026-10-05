/**
 * CAPTURE — the first screen of the slice (SCRUM-53 / PR-4).
 *
 * `capture → cartoonize → burn → award → persist`. This screen owns step one and
 * nothing else: it mints a capture id, takes the photo, and hands both onward.
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
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { INITIAL_OFFERING, transition, type Offering } from '@/domain/slice';
import { TOUCH_TARGET, brand, fontSize, onColorCream, radius, space, surface, text } from '@/theme/tokens';

type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'shooting' }
  /** The photo never happened — nothing was spent, so this is NOT rule ②. */
  | { readonly kind: 'failed' };

export default function CaptureScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  /** The offering — owned by the state machine, never by this screen. */
  const [offering, setOffering] = useState<Offering>(INITIAL_OFFERING);

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
      router.push({ pathname: '/preparing', params: { captureId, uri: photo.uri } });
    } catch {
      // No photo ⇒ no row ⇒ no id consumed. Not rule ②: nothing was spent.
      setPhase({ kind: 'failed' });
    }
  }, [phase.kind, router]);

  // ── permission gate ──────────────────────────────────────────────────────
  if (permission && !permission.granted) {
    return (
      <View style={[styles.gate, { paddingTop: insets.top + space.xl }]}>
        <Text style={styles.gateTitle}>The camera is needed</Text>
        <Text style={styles.gateBody}>
          The offering is the object you would like to burn. Nothing leaves this phone without
          your permission to photograph it.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void requestPermission();
          }}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonLabel}>Allow the camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {/* The camera is the whole screen — the ritual is not a form. */}
      <View style={[styles.hud, { paddingTop: insets.top + space.md }]} pointerEvents="none">
        <Text style={styles.hint}>Photograph the offering</Text>
      </View>

      <View
        style={[styles.shutterRow, { paddingBottom: insets.bottom + space.xl }]}
        pointerEvents="box-none"
      >
        {phase.kind === 'failed' ? (
          <View style={styles.failRow}>
            <Text style={styles.failText}>The photo was not taken — nothing has been used.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setPhase({ kind: 'idle' });
                setOffering(INITIAL_OFFERING);
              }}
              style={styles.smallButton}
            >
              <Text style={styles.smallButtonLabel}>Try again</Text>
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
  hud: { alignItems: 'center' },
  hint: {
    color: onColorCream,
    fontSize: fontSize.caption.at390,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  shutterRow: { alignItems: 'center', justifyContent: 'flex-end', flex: 1 },
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