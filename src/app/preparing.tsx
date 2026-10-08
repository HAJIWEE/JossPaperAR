/**
 * PREPARING — the screen the wait is UI (doc 10 §4).
 *
 * This is where the slice stops being four screens and starts being a pipeline:
 * the photo bytes go up under the id the capture screen already minted, the
 * orchestrator is asked for a sprite, and whatever it says becomes an event on
 * the offering state machine.
 *
 * ── WHY IT DOES NOT DECIDE ANYTHING ───────────────────────────────────────
 * Every branch below is a report of what the server said. What that MEANS is
 * decided by `transition(...)` in `src/domain/slice.ts`, and the copy is chosen
 * by `nextAction(...)`. This screen has no policy of its own to get wrong —
 * which is the reason the three rules can be asserted without a device.
 *
 * ── THE THREE OUTCOMES, AND WHY THEY LOOK DIFFERENT ON SCREEN ─────────────
 *   styled  → straight on to the burn. Nothing to say.
 *   parked  → `ritual_busy`, and a RETRY that costs nothing. The AI budget for
 *             the day is spent; the job keeps its row. ⚠️ This arrives as an
 *             HTTP **200**, so any code that branches on `res.ok` first will
 *             call it a success and lose the park (ADR-006 / SCRUM-59).
 *   failed  → the capture is SPENT (`unique(capture_id)`), so the only way on is
 *             a NEW capture. A "retry" button here would either double-charge
 *             or silently do nothing.
 *   transport → nothing reached the server, so nothing was spent and this is
 *             genuinely safe to retry — the one case that IS a retry.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/lib/i18n';
import { toBurnParams } from '@/lib/route-params';
import {
  registerCapture,
  requestCartoonize,
  uploadCapture,
} from '@/lib/ritual';
import { ensureAnonymousSession } from '@/lib/session';
import { TUTORIAL_WAIT_MS, isDemo } from '@/lib/tutorial';
import { TOUCH_TARGET, fontSize, onColorCream, radius, space, surface, text } from '@/theme/tokens';

type Phase =
  | { readonly kind: 'working' }
  /** Rule ③: parked by the AI-budget stop-rule. Safe, free, and worth retrying. */
  | { readonly kind: 'parked' }
  /** Rule ②: the capture is spent. The only way on is a new capture. */
  | { readonly kind: 'spent' }
  /** The request never reached the server — nothing was spent, so retry is free. */
  | { readonly kind: 'offline'; readonly reason: string }
  | { readonly kind: 'done' };

export default function Preparing(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { captureId, uri, demo: demoParam } = useLocalSearchParams<{
    captureId: string;
    uri: string;
    demo?: string;
  }>();
  /** SCRUM-85 — a demo skips the upload and the generation entirely. */
  const demo = isDemo(demoParam);

  const [phase, setPhase] = useState<Phase>({ kind: 'working' });
  const started = useRef(false);

  const run = useCallback(async () => {
    if (typeof captureId !== 'string' || typeof uri !== 'string') {
      setPhase({ kind: 'offline', reason: 'bad_params' });
      return;
    }
    setPhase({ kind: 'working' });

    // ── SCRUM-85 · THE TUTORIAL: no server, no AI, no spend ────────────────
    // ⚠️ This branch is the whole point of the demo. Letting it fall through to
    // the real pipeline would upload the photo and request a Path C generation
    // for EVERY new user — ≈ US$0.09 each, invisible, because it happens before
    // any quota, clan or `app_config` budget row exists to catch it.
    //
    // So the offering passes through untouched and the wait is a local timer.
    // The demo is honest because the SCREENS are real; only the network is not.
    if (demo) {
      await new Promise((resolve) => setTimeout(resolve, TUTORIAL_WAIT_MS));
      setPhase({ kind: 'done' });
      router.push({ pathname: '/burn', params: toBurnParams(captureId, uri, true) });
      return;
    }

    // ── 0 · a session the server will accept (ADR-004 / SCRUM-80) ───────────
    // Every step below is an authenticated call; with no session `registerCapture`
    // throws `not_authenticated` and RLS refuses the row (401 / 42501). Nothing is
    // spent if this fails, so it retries on the same road as a transport failure.
    const session = await ensureAnonymousSession();
    if (!session.ok) {
      setPhase({ kind: 'offline', reason: session.reason });
      return;
    }

    // ── 1 · the row, under the id minted before the photo (rule ①) ──────────
    let userId: string;
    try {
      ({ userId } = await registerCapture(captureId));
    } catch {
      setPhase({ kind: 'offline', reason: 'capture_insert_failed' });
      return;
    }

    // ── 2 · the bytes, to exactly the path the row records ─────────────────
    try {
      await uploadCapture(userId, captureId, uri);
    } catch {
      // ⚠️ The row exists but the object does not, so the offering can never be
      // generated. Treated as spent rather than "try again": retrying would
      // insert the same primary key again and fail on the constraint.
      setPhase({ kind: 'spent' });
      return;
    }

    // ── 3 · the ask. The mapping lives in ritual-map.ts and is gate-tested. ──
    const outcome = await requestCartoonize(captureId);

    if (outcome.kind === 'transient') {
      // Nothing was generated, so nothing was spent — a genuine retry.
      setPhase({ kind: 'offline', reason: outcome.reason });
      return;
    }

    const event = outcome.events[0];
    if (event?.type === 'BUDGET_PARKED') {
      setPhase({ kind: 'parked' });
      return;
    }
    if (event?.type === 'GENERATION_FAILED') {
      setPhase({ kind: 'spent' });
      return;
    }
    if (event?.type === 'STYLED') {
      setPhase({ kind: 'done' });
      // ⚠️ Built by the route contract, not inline: `preparing` was the one hop
      // that bypassed `toBurnParams`, which is how a param gets dropped silently.
      router.push({ pathname: '/burn', params: toBurnParams(captureId, uri) });
    }
  }, [captureId, uri, demo, router]);

  // `started` guards against React 18 StrictMode double-invoking effects, which
  // would upload twice and — because `unique(capture_id)` makes the job
  // idempotent — silently pay for the first one while showing the second.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.xl }]}>
      <Text style={styles.title}>{t('ritual_preparing')}</Text>

      {phase.kind === 'working' ? <ActivityIndicator color={onColorCream} style={styles.spinner} /> : null}

      {/*
        The park copy is `ritual_busy`, NOT an error string. The difference is
        the whole rule: the shrine is healthy and busy, the offering is intact,
        and pressing the button costs nothing. Showing `ritual.cannotPrepare`
        here would tell the player their offering is broken when it is queued.
      */}
      {phase.kind === 'parked' ? (
        <>
          <Text style={styles.body}>{t('ritual_busy')}</Text>
          <Pressable style={styles.button} onPress={() => void run()} accessibilityRole="button">
            <Text style={styles.buttonText}>{t('common.retry')}</Text>
          </Pressable>
        </>
      ) : null}

      {/* Rule ② — the capture is spent. Offering a retry would be a lie. */}
      {phase.kind === 'spent' ? (
        <>
          <Text style={styles.body}>{t('ritual.cannotPrepare')}</Text>
          <Pressable
            style={styles.button}
            onPress={() => router.replace('/capture')}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>{t('common.recapture')}</Text>
          </Pressable>
        </>
      ) : null}

      {phase.kind === 'offline' ? (
        <>
          <Text style={styles.body}>{t('ritual.cannotPrepare')}</Text>
          <Pressable style={styles.button} onPress={() => void run()} accessibilityRole="button">
            <Text style={styles.buttonText}>{t('common.retry')}</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // `surface.camera` — #screen-burn. This screen is the wait, and it sits
  // between the camera and the burn, both of which are dark; a cream surface
  // here would flash white between two dark screens.
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surface.camera,
    paddingHorizontal: space.xl,
  },
  title: { color: onColorCream, fontSize: fontSize.titleScreen.at390, fontWeight: '700', textAlign: 'center' },
  body: { color: onColorCream, fontSize: fontSize.bodyLg.at390, opacity: 0.85, textAlign: 'center', marginTop: space.md },
  spinner: { marginTop: space.lg },
  button: {
    marginTop: space.lg,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: onColorCream,
  },
  buttonText: { color: onColorCream, fontSize: fontSize.body.at390, fontWeight: '600', textAlign: 'center' },
});
