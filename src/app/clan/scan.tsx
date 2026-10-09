/**
 * SCAN — the camera half of the QR invite (SCRUM-50 · doc 07 §4.6).
 *
 * ⚠️ NO NEW NATIVE MODULE. `expo-camera` is already the app's camera path
 * (`capture.tsx`) and its permission is already declared in `app.json`, so the
 * scanner reuses both — which is the whole reason doc 07 §4.6 chose
 * `barcodeScannerSettings` over a dedicated scanning library. It also keeps the
 * device run on **Expo Go** (no `expo-dev-client` in this project — trap 4).
 *
 * ⚠️ DECODING IS LOCAL. The code is read on the device; nothing is sent until
 * the user reaches `preview_clan`. A scan therefore works with the radio off —
 * only the resolve needs the network (doc 07 §4.6, "Offline").
 *
 * ⚠️ THE CAMERA FIRES CONTINUOUSLY. `onBarcodeScanned` re-fires many times a
 * second while a code is in frame, so the accept/ignore decision is the pure
 * `scanDecision()` in `invite-flow.ts` — not an `if` here. A screen that acted
 * on every event would call `join_clan` in a loop and trip the `3 joins/hour`
 * anti-abuse rule by holding the phone still (doc 15 §5.2).
 */

import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GhostButton } from '@/components/clan-ui';
import { scanDecision } from '@/lib/invite-flow';
import { t } from '@/lib/i18n';
import { fontSize, onColorCream, space, surface, text } from '@/theme/tokens';

export default function ClanScanScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  /**
   * ⚠️ A REF, NOT STATE. The decision must read the value the *previous* scan
   * event set, synchronously — a state update would still be stale inside the
   * handler, and the duplicate would slip through on exactly the fast frames
   * this guard exists for.
   */
  const lastAccepted = useRef<string | null>(null);
  const handling = useRef(false);
  const [problem, setProblem] = useState<string | null>(null);

  const onScanned = useCallback((result: { data?: string }) => {
    const decision = scanDecision({
      payload: result.data,
      lastAccepted: lastAccepted.current,
      busy: handling.current,
    });
    if (!decision.accept) return; // duplicate · busy · unreadable — all silent

    handling.current = true;
    lastAccepted.current = decision.code;
    // Hand the code to the ONE join body, so a scanned invite resolves by the
    // same rules as a typed one.
    router.replace({ pathname: '/clan/join', params: { code: decision.code } });
  }, []);

  // Permission not yet answered — the OS dialog owns the moment.
  if (!permission) return <View style={styles.screen} />;

  if (!permission.granted) {
    return (
      <View style={[styles.gate, { paddingTop: insets.top + space.xl }]}>
        <Text style={styles.gateTitle}>{t('invite.scanNeedsCamera')}</Text>
        <Text style={styles.gateBody}>{t('invite.scanNeedsCameraBody')}</Text>
        <GhostButton
          testID="clan-scan-grant"
          label={t('invite.grantCamera')}
          onPress={() => {
            void requestPermission();
          }}
        />
        <GhostButton
          testID="clan-scan-manual"
          label={t('invite.typeCode')}
          onPress={() => {
            router.replace('/clan/join');
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        // ⚠️ QR only. Left open, the scanner would also try to read the app's
        // own packaging barcodes and report them as unreadable invites.
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={onScanned}
        onMountError={(e) => setProblem(e.message)}
      />

      <View style={[styles.hud, { paddingTop: insets.top + space.lg }]} pointerEvents="box-none">
        <Text accessibilityRole="alert" style={styles.hint}>
          {t('invite.scanHint')}
        </Text>
        {problem ? <Text style={styles.problem}>{problem}</Text> : null}
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + space.xl }]}>
        <GhostButton
          testID="clan-scan-manual"
          label={t('invite.typeCode')}
          onPress={() => {
            router.replace('/clan/join');
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.camera },
  hud: { alignItems: 'center', paddingHorizontal: space.lg },
  hint: {
    color: onColorCream,
    fontSize: fontSize.body.at390,
    textAlign: 'center',
  },
  problem: { color: onColorCream, fontSize: fontSize.caption.at390, marginTop: space.sm },
  actions: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: space.lg },
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
    marginBottom: space.lg,
  },
});
