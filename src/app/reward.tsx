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

import { t } from '@/lib/i18n';
import { submitBurn, type BurnReceipt } from '@/lib/ritual';
import { TOUCH_TARGET, fontSize, onColorCream, radius, space, surface } from '@/theme/tokens';

type Phase =
  | { readonly kind: 'submitting' }
  | { readonly kind: 'shown'; readonly receipt: BurnReceipt }
  /** Nothing was banked - the SAME key may be retried. */
  | { readonly kind: 'retryable'; readonly reason: string };

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
  const { captureId, offsetPx, throwNumber } = useLocalSearchParams<{
    captureId: string;
    offsetPx: string;
    throwNumber: string;
  }>();

  const [phase, setPhase] = useState<Phase>({ kind: 'submitting' });
  const started = useRef(false);

  const accuracy = Number(offsetPx);
  const throwNo = Number(throwNumber);

  const submit = useCallback(async () => {
    if (typeof captureId !== 'string') {
      setPhase({ kind: 'retryable', reason: 'bad_params' });
      return;
    }
    setPhase({ kind: 'submitting' });
    // Same arguments -> the same derived key. That is the whole safety story.
    const result = await submitBurn(captureId, accuracy, throwNo);
    setPhase(
      result.kind === 'ok'
        ? { kind: 'shown', receipt: result.receipt }
        : { kind: 'retryable', reason: result.reason },
    );
  }, [captureId, accuracy, throwNo]);

  // `started` mirrors preparing.tsx: a double-invoked effect would submit the
  // same throw twice, which is safe ONLY because the key is derived rather than
  // generated. The guard keeps it from happening at all.
  if (!started.current) {
    started.current = true;
    void submit();
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
