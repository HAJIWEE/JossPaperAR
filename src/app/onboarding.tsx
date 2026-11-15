/**
 * onboarding.tsx — THE THREE INTRO PANELS (`EN · 0b Onboarding` ×3 · SCRUM-171)
 *
 * ⚠️⚠️ **EVERY STRING AND COORDINATE HERE COMES FROM A BOARD.** The copy is the signed-off EN/ZH
 * `0b` trio resolved through `lib/i18n.ts`; the geometry is the board's own, scaled from its 390 pt
 * width. Nothing is invented — where a value could not be measured (the CTA's corner radius) the
 * app's existing button token is used instead, and that is noted at the style.
 *
 * ⚠️ **BOTH EXITS GO TO THE CLAN FORK** (owner, 2026-11-15: option A). `Skip` sits on **all three**
 * panels — the ticket says *"skippable from the first panel"* — and `Get started` on the last.
 * Neither exits to the shrine: a burn is clan-scoped (`submit_burn` requires `clan_id`, SCRUM-82),
 * so a user landing there with no clan meets a `Begin an offering` that cannot finish.
 *
 * ⚠️⚠️ **THIS SCREEN DOES NOT DECIDE WHEN IT IS SHOWN.** It renders, records the fact on exit, and
 * leaves. ⚠️ **`SCRUM-169` owns the wiring** — reading `readIntroSeen()` in the boot flow and
 * routing here exactly once. Doing that here would put a second opinion about first-run beside the
 * identity gate and `onboarded.ts`, which is how a boot flow starts to lie.
 */

import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CLAN_FORK_ROUTE, INTRO_PANELS, clampPanel, isLastPanel, nextPanel } from '@/lib/intro';
import { markIntroSeen } from '@/lib/intro-seen';
import { t } from '@/lib/i18n';
import { TOUCH_TARGET, brand, onColorCream, radius, space, surface, text } from '@/theme/tokens';

/** The board is drawn at 390 pt; everything below is that coordinate space, scaled. */
const BOARD_W = 390;

export default function OnboardingScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const s = width / BOARD_W;
  const [index, setIndex] = useState(0);
  const at = clampPanel(index);
  const panel = INTRO_PANELS[at];
  const last = isLastPanel(at);

  /**
   * ⚠️ **RECORD, THEN LEAVE.** `markIntroSeen()` is awaited before navigating so a fast tap cannot
   * race the write — but it is best-effort by design (`intro-seen.ts` swallows a storage failure and
   * the panels simply replay), so it can never strand the user on this screen.
   */
  const leave = useCallback(() => {
    void (async () => {
      await markIntroSeen();
      router.replace(CLAN_FORK_ROUTE);
    })();
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: surface.paper }}>
      {/* ⚠️ Skip is on EVERY panel (the board draws it on all three), top-right at x306 y56. */}
      <Pressable
        accessibilityRole="button"
        testID="intro-skip"
        onPress={leave}
        style={{
          position: 'absolute',
          left: 306 * s,
          top: insets.top + 12 * s,
          width: 68 * s,
          minHeight: TOUCH_TARGET,
          justifyContent: 'center',
          alignItems: 'flex-end',
        }}
      >
        <Text style={{ color: text.inkSoft, fontSize: 13 * s }}>{t('intro.skip')}</Text>
      </Pressable>

      {/* ⚠️ Two or three labels — never padded to a fixed slot count (panel 1 has three). */}
      <View
        style={{ position: 'absolute', left: 50 * s, top: 310 * s, flexDirection: 'row', gap: 30 * s }}
      >
        {panel.eyebrows.map((key, i) => (
          <Text
            key={key}
            testID={`intro-eyebrow-${panel.id}-${i + 1}`}
            style={{ color: text.inkSoft, fontSize: 10 * s, letterSpacing: 1.6 * s }}
          >
            {t(key)}
          </Text>
        ))}
      </View>

      <Text
        testID={`intro-title-${panel.id}`}
        style={{
          position: 'absolute',
          left: 20 * s,
          top: 404 * s,
          width: 350 * s,
          color: text.ink,
          fontSize: 30 * s,
          lineHeight: 39 * s,
          fontWeight: '600',
        }}
      >
        {t(panel.titleKey)}
      </Text>

      <Text
        testID={`intro-body-${panel.id}`}
        style={{
          position: 'absolute',
          left: 20 * s,
          top: 500 * s,
          width: 350 * s,
          color: text.inkSoft,
          fontSize: 13 * s,
          lineHeight: 22 * s,
        }}
      >
        {t(panel.bodyKey)}
      </Text>

      {/*
        ⚠️ The CTA is the app's EXISTING primary button, not a new one: `brand.cinnabar` fill,
        `radius.pill`, `onColorCream` label at 17/600 — the same treatment `capture.tsx` uses. The
        board supplies the 350 × 56 box and the label colour (`#fff8e8`); it does NOT give a corner
        radius, so the house token is used rather than a guessed number.
      */}
      <Pressable
        accessibilityRole="button"
        testID="intro-cta"
        onPress={() => {
          if (last) {
            leave();
            return;
          }
          setIndex((i) => nextPanel(i));
        }}
        style={({ pressed }) => ({
          position: 'absolute',
          left: 20 * s,
          top: 690 * s,
          width: 350 * s,
          height: 56 * s,
          borderRadius: radius.pill,
          backgroundColor: brand.cinnabar,
          justifyContent: 'center',
          alignItems: 'center',
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={{ color: onColorCream, fontSize: 17 * s, fontWeight: '600' }}>
          {t(panel.ctaKey)}
        </Text>
      </Pressable>

      {/*
        ⚠️ A progress rail, and NOT from the board — it is the smallest honest affordance that says
        "three panels" without inventing copy. It is clamped above the home indicator so it cannot
        fall off a short screen.
      */}
      <View
        style={{
          position: 'absolute',
          left: 20 * s,
          top: Math.min(690 * s + 56 * s + space.md, height - insets.bottom - 24 * s),
          width: 350 * s,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 8 * s,
        }}
      >
        {INTRO_PANELS.map((p, i) => (
          <View
            key={p.id}
            style={{
              width: 8 * s,
              height: 8 * s,
              borderRadius: 4 * s,
              backgroundColor: i === at ? brand.cinnabar : surface.paperEdge,
            }}
          />
        ))}
      </View>
    </View>
  );
}
