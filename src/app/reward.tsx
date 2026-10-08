/**
 * REWARD - where the server's answer becomes the player's moment.
 *
 * This is the end of the slice: capture -> cartoonize -> burn -> award ->
 * persist. The award is persisted before this screen renders anything, because
 * only `award-service` writes money and it returns the receipt that says so.
 *
 * THE ONE RULE ON THIS SCREEN
 * It displays the RECEIPT, never the local preview. ADR-005 gives the server
 * sole authority over the band: the client graded the throw only to draw a
 * preview on the burn screen, and that grade is not evidence of anything. If the
 * two ever disagree, the receipt is what the player is shown AND what the ledger
 * contains - so a disagreement is visible rather than quietly papered over.
 *
 * IDEMPOTENCY IS THE POINT, NOT A DETAIL
 * The retry here carries the SAME idempotency_key as the attempt that failed in
 * transit, because the key is derived from (captureId, throwNumber) rather than
 * minted per attempt (see submitBurn). That is what makes a dropped connection
 * safe: the server recognises the replay and pays once. A fresh key per retry
 * would turn "the network blinked" into a second award for one throw.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { myClans } from '@/lib/clan-api';
import { markTutorialDone } from '@/lib/first-run';
import { t } from '@/lib/i18n';
import { submitBurn, type BurnReceipt } from '@/lib/ritual';
import { readRewardParams } from '@/lib/route-params';
import { AFTER_TUTORIAL_ROUTE, demoReceipt, type DemoReceipt } from '@/lib/tutorial';
import { TOUCH_TARGET, fontSize, onColorCream, radius, space, surface } from '@/theme/tokens';

type Phase =
  | { readonly kind: 'submitting' }
  | { readonly kind: 'shown'; readonly receipt: BurnReceipt }
  /**
   * SCRUM-85 — the first-run TUTORIAL's receipt. ⚠️ A structurally DIFFERENT
   * shape from `BurnReceipt`, so demo money can never be rendered by the code
   * that renders the server's. It carries `balanceDelta: 0`.
   */
  | { readonly kind: 'demo'; readonly receipt: DemoReceipt }
  /** Nothing was banked - the SAME key may be retried. */
  | { readonly kind: 'retryable'; readonly reason: string }
  /**
   * The ROUTE is broken (no capture id), which retrying cannot fix. Distinct from
   * `retryable` on purpose: a retry button here would fail identically forever.
   */
  | { readonly kind: 'lost' };

/** The band the SERVER returned, rendered in both locales. */
const BAND_LABELS: Record<string, { en: string; zh: string }> = {
  bullseye: { en: 'Bullseye', zh: '\u6b63\u4e2d' },
  devout: { en: 'Devout', zh: '\u8654\u8aa0' },
  graze: { en: 'Graze', zh: '\u64e6\u908a' },
  miss: { en: 'Miss', zh: '\u504f\u5931' },
};

export default function Reward(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  /**
   * The route contract (src/lib/route-params.ts). The old code read the raw
   * params and coerced them with `Number(...)`, so a missing `captureId` was a
   * generic `bad_params` and a missing `offsetPx` became `NaN` — an award
   * submitted with a `NaN` offset. Both are now refused BY NAME.
   */
  const parsed = readRewardParams(
    useLocalSearchParams<{ captureId: string; offsetPx: string; throwNumber: string }>(),
  );
  const captureId = parsed.ok ? parsed.captureId : null;
  const accuracy = parsed.ok ? parsed.accuracyPx : 0;
  const throwNo = parsed.ok ? parsed.throwNumber : 1;
  /** SCRUM-85 — true for the first-run tutorial. */
  const demo = parsed.ok ? parsed.demo : false;
  /** Non-null only when the route itself is unusable. */
  const problem = parsed.ok ? null : parsed.reason;

  const [phase, setPhase] = useState<Phase>({ kind: 'submitting' });
  const started = useRef(false);

  const submit = useCallback(async () => {
    if (captureId === null) {
      // A broken ROUTE cannot be retried into working — send them back honestly.
      setPhase(
        problem === 'missing_capture_id'
          ? { kind: 'lost' }
          : { kind: 'retryable', reason: String(problem) },
      );
      return;
    }
    // ── SCRUM-85 · THE TUTORIAL: no clan, no server, no points ──────────────
    // ⚠️ This IS the SCRUM-83 answer. A demo must NOT call `ensureClan` (which
    // WROTE a clan — the shortcut SCRUM-83 retired) and must NOT submit a burn:
    // the demo awards nothing to anyone, and there is no clan to award it to.
    // The receipt is computed locally and carries `balanceDelta: 0`.
    if (demo) {
      setPhase({ kind: 'demo', receipt: demoReceipt(accuracy) });
      // The tutorial has been seen. Best-effort — a failed write replays it,
      // which is the recoverable direction.
      void markTutorialDone();
      return;
    }

    setPhase({ kind: 'submitting' });

    // ⚠️ THE CLAN IS NOW GUARANTEED BY THE FORK (option C) — no longer
    // auto-created here. If there is none, the right move is the fork, NOT a
    // retry: a retry would fail identically forever, which is how the old
    // `ensureClan` failure presented.
    const mine = await myClans();
    if (!mine.ok) {
      setPhase({ kind: 'retryable', reason: mine.reason });
      return;
    }
    const clan = mine.data[0];
    if (!clan) {
      router.replace(AFTER_TUTORIAL_ROUTE);
      return;
    }

    // Same arguments -> the same derived key. That is the whole safety story.
    const result = await submitBurn(captureId, accuracy, throwNo, clan.clanId);
    setPhase(
      result.kind === 'ok'
        ? { kind: 'shown', receipt: result.receipt }
        : { kind: 'retryable', reason: result.reason },
    );
  }, [captureId, accuracy, throwNo, problem, demo, router]);

  // `started` mirrors preparing.tsx: a double-invoked effect would submit the
  // same throw twice, which is safe ONLY because the key is derived rather than
  // generated. The guard keeps it from happening at all.
  if (!started.current) {
    started.current = true;
    void submit();
  }

  if (phase.kind === 'lost') {
    return (
      <View style={[styles.root, { paddingTop: insets.top + space.xl }]}>
        <Text style={styles.title}>{t('ritual.cannotPrepare')}</Text>
        <Text style={styles.body}>Your offering lost its place - begin again.</Text>
        <Pressable
          style={styles.button}
          onPress={() => router.replace('/capture')}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{t('common.recapture')}</Text>
        </Pressable>
      </View>
    );
  }

  if (phase.kind === 'submitting') {
    return (
      <View style={[styles.root, { paddingTop: insets.top + space.xl }]}>
        <Text style={styles.title}>{t('ritual_preparing')}</Text>
        <ActivityIndicator color={onColorCream} style={styles.spinner} />
      </View>
    );
  }

  if (phase.kind === 'retryable') {
    return (
      <View style={[styles.root, { paddingTop: insets.top + space.xl }]}>
        <Text style={styles.title}>{t('ritual.cannotPrepare')}</Text>
        <Text style={styles.body}>Your offering is safe - nothing has been recorded.</Text>
        <Pressable style={styles.button} onPress={() => void submit()} accessibilityRole="button">
          <Text style={styles.buttonText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  // ── SCRUM-85 · the TUTORIAL receipt ───────────────────────────────────────
  // ⚠️ Rendered by DIFFERENT code from the server's receipt, on a different type,
  // so demo money cannot reach the ledger's rendering path. And it says out loud
  // that nothing was banked — a demo mistaken for an award is worse than no demo.
  if (phase.kind === 'demo') {
    const demoLabel =
      BAND_LABELS[phase.receipt.band] ?? { en: phase.receipt.band, zh: phase.receipt.band };
    return (
      <View style={[styles.root, { paddingTop: insets.top + space.xl }]}>
        <Text style={styles.tag}>{t('tutorial.badge')}</Text>
        <Text style={styles.title}>
          {demoLabel.zh} {demoLabel.en}
        </Text>
        <Text style={styles.award}>{phase.receipt.award}</Text>
        <Text style={styles.caption}>tribute</Text>
        <Text style={styles.body}>{t('tutorial.receiptNote')}</Text>
        <Text style={styles.body}>{t('tutorial.noClanNote')}</Text>
        <Pressable
          testID="tutorial-finish"
          style={styles.button}
          accessibilityRole="button"
          onPress={() => router.replace(AFTER_TUTORIAL_ROUTE)}
        >
          <Text style={styles.buttonText}>{t('tutorial.finish')}</Text>
        </Pressable>
      </View>
    );
  }

  const { receipt } = phase;
  const label = BAND_LABELS[receipt.band] ?? { en: receipt.band, zh: receipt.band };
  // A miss earns nothing and the offering RETURNS (S9) - never destroyed.
  const missed = receipt.band === 'miss' || receipt.award === 0;
  const canRethrow = missed && throwNo < 3;

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.xl }]}>
      <Text style={styles.title}>
        {label.zh} {label.en}
      </Text>

      {/* The award is the RECEIPT's number, not the client's own arithmetic. */}
      <Text style={styles.award}>{receipt.award}</Text>
      <Text style={styles.caption}>tribute</Text>

      {receipt.new_ground ? <Text style={styles.tag}>{t('reward.newGround')}</Text> : null}
      {receipt.idempotent_replay ? (
        // Worth saying out loud: the player pressed retry and the server paid
        // once. Silence here would make correct idempotency look like a bug.
        <Text style={styles.tag}>Already recorded</Text>
      ) : null}
      {receipt.clamped ? <Text style={styles.tag}>Capped</Text> : null}

      <Text style={styles.body}>Balance {receipt.tribute_balance}</Text>

      <Pressable
        style={styles.button}
        accessibilityRole="button"
        onPress={() => {
          // A miss returns to the BURN screen (the offering still exists); a
          // burn is finished, so the shrine is next - not the fire.
          if (canRethrow) router.replace('/burn');
          else router.replace('/');
        }}
      >
        <Text style={styles.buttonText}>{canRethrow ? t('common.retry') : t('common.done')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surface.camera,
    paddingHorizontal: space.xl,
  },
  title: { color: onColorCream, fontSize: fontSize.titleScreen.at390, fontWeight: '700' },
  award: { color: onColorCream, fontSize: fontSize.hero.at390, fontWeight: '700', marginTop: space.md },
  caption: { color: onColorCream, fontSize: fontSize.caption.at390, opacity: 0.7 },
  tag: { color: onColorCream, fontSize: fontSize.body.at390, marginTop: space.sm, opacity: 0.9 },
  body: {
    color: onColorCream,
    fontSize: fontSize.bodyLg.at390,
    opacity: 0.85,
    textAlign: 'center',
    marginTop: space.lg,
  },
  spinner: { marginTop: space.lg },
  button: {
    marginTop: space.xl,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: onColorCream,
  },
  buttonText: { color: onColorCream, fontSize: fontSize.body.at390, fontWeight: '600' },
});
