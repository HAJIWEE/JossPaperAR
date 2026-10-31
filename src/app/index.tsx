import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClanPill } from '@/components/clan-pill';
import { ShrineBase } from '@/components/home/shrine-base';
import { myClans } from '@/lib/clan-api';
import { HEADER_SPEC, type PillClan } from '@/lib/clan-pill';
import { readFirstRun } from '@/lib/first-run';
import { HOME_BANDS, HOME_REGION_ORDER, homeScale, type HomeRegion } from '@/lib/home-layout';
import { t } from '@/lib/i18n';
import { DEMO_PARAM, DEMO_VALUE, needsTutorial } from '@/lib/tutorial';
import { TOUCH_TARGET, brand, fontSize, onColorCream, radius, space, surface, text } from '@/theme/tokens';

/**
 * HOME — the shrine's structure (SCRUM-148 · SCRUM-160).
 *
 * ── WHAT CHANGED, AND WHY ────────────────────────────────────────────────────
 * This file used to describe itself as *"a SCAFFOLD, not the shrine"* and render a
 * reviewer's diagnostic page: the four aim bands, the store catalogue and the burn
 * limits. That was right for SCRUM-57, whose job was proving the theme bridge and
 * the domain modules were live. ⚠️ **It is wrong for a product.** A player opening
 * the app should see an altar, not its calibration numbers.
 *
 * So the diagnostics are gone and the shrine's **regions** are here, in the order
 * `home-layout.ts` owns — `header · totals · altar · cta · footer`. Three of the
 * five are reserved for tickets already filed (`totals` → SCRUM-161, `altar` +
 * `cta` → SCRUM-162, `footer` entries → SCRUM-164). A reserved region is drawn as
 * a **visible dashed band**, not an invisible `View`: a structure PR has to be
 * reviewable on glass, and an empty `View` has no frame to look at.
 *
 * ⚠️ **No new copy and no new behaviour in this ticket.** Every string below is an
 * existing key (`home.begin`, `home.clanEntry`); the CTA, the pill's behaviour and
 * the tutorial hand-off are unchanged — they have been *moved* into their regions.
 *
 * ── TWO THINGS THAT MUST NOT BE "TIDIED AWAY" ───────────────────────────────
 * 1. ⚠️ **The `settingsSlot` is RESERVED, EMPTY, and 44 px wide.** The pill's x is
 *    board-relative: 390 − 20 − 44 − 10 − 236 = **80**, the only empty rectangle
 *    SCRUM-91 measured. Collapsing the slot slides the pill 54 px right of where
 *    the board signed it off, and `check:lib` §14 freezes that geometry.
 * 2. ⚠️ **The zero-clan entry stays** even though the pill replaced it. SCRUM-91
 *    drew only the 1-clan and 2+-clan pills, so **with zero clans the design has
 *    no clan control at all** — and the fork's Skip can land a user back here. It
 *    is an un-designed gap, labelled as one; deleting it would strand a clan-less
 *    user on Home with no route to the fork.
 */

/**
 * The regions rendered inside the scroll view.
 *
 * ⚠️ Derived from `HOME_REGION_ORDER`, not hand-listed — so the constant in
 * `home-layout.ts` is load-bearing rather than decorative, and a region removed
 * from the order cannot silently keep rendering.
 */
const BODY_REGIONS = HOME_REGION_ORDER.filter(
  (region): region is Exclude<HomeRegion, 'header'> => region !== 'header',
);

export default function HomeShrine() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  /** ⚠️ Board px → device dp. See `homeScale` — measured on glass, 360 dp here. */
  const scale = homeScale(windowWidth);
  const [clans, setClans] = useState<readonly PillClan[]>([]);

  // The header pill must reflect a clan created or joined *after* Home first
  // mounted, so this re-reads on every focus (the `clan/index.tsx` pattern).
  // ⚠️ A failed read hides the pill rather than showing a stale clan.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const mine = await myClans();
        if (!cancelled) {
          setClans(mine.ok ? mine.data.map((c) => ({ name: c.name, role: c.role })) : []);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  /**
   * One region's contents.
   *
   * ⚠️ `null` is correct for a region whose ticket has not landed — the parent
   * `View` still renders its reserved band, which is what makes the structure
   * visible. Do not fill these with placeholder prose: that would need fresh copy,
   * and the shrine's copy is doc 15 §8's.
   */
  const regionContent = (region: Exclude<HomeRegion, 'header'>) => {
    switch (region) {
      // SCRUM-161 — the tribute total and the streak slot.
      case 'totals':
        return null;

      // SCRUM-162 — the altar art. ⚠️ The shrine base has landed; the halo, the
      // offerings and the ＋ slot (`HOME_BANDS.addSlot`) are the rest of the ticket,
      // and the tablet slots themselves are SCRUM-146's.
      case 'altar':
        return (
          <View
            style={[styles.altar, { paddingLeft: HOME_BANDS.shrineBase.x * scale }]}
            testID="home-altar-art"
          >
            <ShrineBase />
          </View>
        );

      // ✅ The offer is taken AT the altar, never from the chrome (S36 measured it).
      case 'cta':
        return (
          <Pressable
            accessibilityRole="button"
            testID="home-begin"
            onPress={() => {
              // ── SCRUM-85 · the FIRST burn is a TUTORIAL ────────────────────
              // ⚠️ Read the first-run record HERE, at the tap, rather than in an
              // effect: the flag must reflect the device's state at the moment of
              // the decision, and a stale render must not send an already-tutored
              // user back through a demo.
              void (async () => {
                const firstRun = await readFirstRun();
                const params = needsTutorial(firstRun) ? { [DEMO_PARAM]: DEMO_VALUE } : {};
                router.push({ pathname: '/capture', params });
              })();
            }}
            style={({ pressed }) => [styles.begin, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.beginLabel}>{t('home.begin')}</Text>
          </Pressable>
        );

      // SCRUM-164 — the Book and League entries (and Settings, once it exists).
      case 'footer':
        return clans.length === 0 ? (
          <Pressable
            accessibilityRole="button"
            testID="home-clan-entry"
            onPress={() => {
              router.push('/clan');
            }}
            style={({ pressed }) => [styles.clanEntry, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.clanEntryLabel}>{t('home.clanEntry')}</Text>
          </Pressable>
        ) : null;
    }
  };

  return (
    <View style={styles.screen}>
      {/* ── header · NOT scrolled (its x is measured; scrolling would break it) ── */}
      <View style={[styles.header, { paddingTop: insets.top }]} testID="home-region-header">
        <View style={styles.headerSpacer} />
        <ClanPill clans={clans} />
        <View style={styles.settingsSlot} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          // safe-area, stacked (design-system/responsive.css pattern)
          { paddingBottom: insets.bottom + space.lg },
        ]}
      >
        {BODY_REGIONS.map((region) => {
          const content = regionContent(region);
          return (
            <View
              key={region}
              testID={`home-region-${region}`}
              style={[styles.region, content === null ? styles.reserved : null]}
            >
              {content}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.paper },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    /* 20 = the board's outer margin (HEADER_SPEC.rightPad). */
    paddingHorizontal: HEADER_SPEC.rightPad,
    paddingBottom: space.sm,
  },
  headerSpacer: { flex: 1 },
  /* ⚠️ RESERVED but EMPTY: `btn · settings` (44×44) is not built yet, and its SPACE
     is what puts the pill at x 80 of the 390 px reference. Do not collapse it — the
     pill would slide 54 px right of where the board signed it off. */
  settingsSlot: {
    width: HEADER_SPEC.settingsSlot,
    height: HEADER_SPEC.settingsSlot,
    marginLeft: HEADER_SPEC.settingsGap,
  },
  content: { paddingHorizontal: space.lg },
  /**
   * ⚠️ The art escapes the content padding ON PURPOSE. `HOME_BANDS.shrineBase` is
   * `x 16` on a 390 px board and **358 wide**, so inside `content` (which pads 20)
   * it would be clipped to 350 and shifted 4 px left. Negative margin, then the
   * band's own x — the drawing then lands exactly where the board put it.
   */
  altar: { marginHorizontal: -space.lg },
  /**
   * A region's box. ⚠️ The heights below are **placeholders**, not board geometry —
   * `home-layout.ts` deliberately carries no y-ranges until the art lands
   * (SCRUM-162), and SCRUM-163 will replace them with the measured bands and a
   * gate. They exist so a structure-only shrine is visible on glass.
   */
  region: { marginBottom: space.lg },
  reserved: {
    minHeight: 96,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: surface.paperEdge,
    borderRadius: radius.md,
  },
  begin: {
    minHeight: TOUCH_TARGET,
    backgroundColor: brand.cinnabar,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beginLabel: { color: onColorCream, fontSize: fontSize.bodyLg.at390, fontWeight: '600' },
  clanEntry: {
    minHeight: TOUCH_TARGET,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: surface.paperEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clanEntryLabel: { color: text.ink, fontSize: fontSize.body.at390, fontWeight: '600' },
});
