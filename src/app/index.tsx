import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClanPill } from '@/components/clan-pill';
import { AIM_BANDS } from '@/domain/aim';
import { OFFERINGS, baseValueOf } from '@/domain/catalogue';
import { DAILY_PHOTO_BURNS, DAILY_STORE_BURNS } from '@/domain/quota';
import { myClans } from '@/lib/clan-api';
import { HEADER_SPEC, type PillClan } from '@/lib/clan-pill';
import { readFirstRun } from '@/lib/first-run';
import { DEMO_PARAM, DEMO_VALUE, needsTutorial } from '@/lib/tutorial';
import { TOUCH_GAP, TOUCH_TARGET, brand, fontSize, fluidSize, onColorCream, radius, space, surface, text } from '@/theme/tokens';

/**
 * HOME — a SCAFFOLD, not the shrine.
 *
 * This exists to prove three things are actually wired (SCRUM-57 §Definition of
 * done) and to give the build a place to start from:
 *
 *   1. Expo Router + the `src/app/` tree renders on a device
 *   2. the RN theme bridge carries the real design tokens (not hard-coded hexes)
 *   3. the DOMAIN modules are importable and tell the truth about the numbers
 *
 * It deliberately renders the aim bands and the catalogue, because those are the
 * values a reviewer should be able to eyeball against docs 05/10 without opening
 * a test file. The real Home (altar, tablets, terrain) is designed and lands with
 * the slice.
 *
 * ✅ SCRUM-92 (2026-10-10): the **clan pill** has landed in the header — the one
 * element that makes *"Home is clan-scoped"* true, and SCRUM-46's last unmet scope
 * item. It is a real component (`src/components/clan-pill.tsx`) on real
 * `myClans()` data, at the geometry SCRUM-91 measured. Its rules live in
 * `src/lib/clan-pill.ts` so `check:lib` asserts them without a device.
 */

export default function HomeScaffold() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
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

  return (
    <View style={styles.screen}>
      {/* ── the header (SCRUM-92) ────────────────────────────────────────────
          The pill's x is board-relative, so the row reserves `btn · settings`
          (44×44) to its right: 390 − 20 − 44 − 10 − 236 puts the pill at **x 80 … 316**,
          the ONLY empty rectangle on the signed-off Home (SCRUM-91 measured it).
          ⚠️ Neither neighbour is built yet — the app mark is art and the settings
          screen does not exist (both belong to the shrine, SCRUM-53) — so the slot
          is left EMPTY but reserved, which is what keeps the pill from having to
          move when they land. */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
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
      <Text style={styles.eyebrow}>Joss Paper AR · scaffold</Text>
      <Text style={styles.title}>The shell is alive</Text>
      <Text style={styles.body}>
        Expo Router renders this from <Text style={styles.code}>src/app/index.tsx</Text>. The theme
        bridge, the domain modules and the CI checks are wired. The ritual screens land with the
        slice (SCRUM-53).
      </Text>

      <Text style={styles.sectionTitle}>The four bands — the acceptance test</Text>
      <Text style={styles.caption}>
        Measured off the fire's own artwork (doc 05 §2). These grade the throw; fps does not.
      </Text>
      {AIM_BANDS.map((band) => (
        <View key={band.id} style={styles.row}>
          <View style={[styles.swatch, { backgroundColor: brand.gold }]} />
          <Text style={styles.rowLabel}>
            {band.label.zh} {band.label.en}
          </Text>
          <Text style={styles.rowValue}>
            ±{band.maxOffsetPx} ×{band.multiplier.toFixed(1)}
          </Text>
        </View>
      ))}
      <View style={styles.row}>
        <View style={[styles.swatch, { backgroundColor: text.muted }]} />
        <Text style={styles.rowLabel}>偏失 Miss</Text>
        <Text style={styles.rowValue}>— ×0 · returns</Text>
      </View>

      <Text style={styles.sectionTitle}>Store catalogue — base = 1.2 × price</Text>
      <Text style={styles.caption}>doc 10 §1 · S13d. The 20% accrual keeps the store a sink.</Text>
      {OFFERINGS.map((o) => (
        <View key={o.code} style={styles.row}>
          <Text style={styles.rowLabel}>{o.name.en}</Text>
          <Text style={styles.rowValue}>
            {o.price} / {baseValueOf(o.price)}
            {o.priceSource === 'derived' ? ' *' : ''}
          </Text>
        </View>
      ))}
      <Text style={styles.caption}>* the House price is DERIVED from its base — PM to confirm.</Text>

      <Text style={styles.sectionTitle}>Burn limits — the AI-cost control</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Photo burns / day</Text>
        <Text style={styles.rowValue}>{DAILY_PHOTO_BURNS}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Store burns / day</Text>
        <Text style={styles.rowValue}>{DAILY_STORE_BURNS}</Text>
      </View>

      <Text style={styles.caption}>
        Touch targets are {TOUCH_TARGET} px; type scales fluidly (hero renders at{' '}
        {Math.round(fluidSize(fontSize.hero, 390))} px on the 390 px reference).
      </Text>

      {/* ── the slice begins here (SCRUM-53 / PR-4) ────────────────────────── */}
      <Pressable
        accessibilityRole="button"
        testID="home-begin"
        onPress={() => {
          // ── SCRUM-85 · the FIRST burn is a TUTORIAL ────────────────────────
          // ⚠️ Read the first-run record HERE, at the tap, rather than in an
          // effect: the flag must reflect the device's state at the moment of
          // the decision, and a stale render must not send an already-tutored
          // user back through a demo.
          void (async () => {
            const firstRun = await readFirstRun();
            const params = needsTutorial(firstRun)
              ? { [DEMO_PARAM]: DEMO_VALUE }
              : {};
            router.push({ pathname: '/capture', params });
          })();
        }}
        style={({ pressed }) => [styles.begin, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.beginLabel}>Begin an offering · 开始供奉</Text>
      </Pressable>

      {/* ── the clan surface, for a user with NO clan (SCRUM-92) ─────────────
          ⚠️ The header PILL above replaced this always-on scaffold entry. This
          fallback survives for the one state the design does NOT cover: SCRUM-91
          drew only the 1-clan and 2+-clan pills, so with zero clans Home has no
          designed clan control — and while `AFTER_TUTORIAL_ROUTE` sends a new user
          to the fork, the fork's Skip can return them here. Deleting this would
          leave a clan-less user with no route from Home, so it stays, un-designed
          and explicitly labelled as a GAP rather than dressed up as the pill. */}
      {clans.length === 0 ? (
        <Pressable
          accessibilityRole="button"
          testID="home-clan-entry"
          onPress={() => {
            router.push('/clan');
          }}
          style={({ pressed }) => [styles.clanEntry, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.clanEntryLabel}>Clan · 宗族</Text>
        </Pressable>
      ) : null}
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
  eyebrow: {
    color: text.muted,
    fontSize: fontSize.caption.at390,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: space.xs,
  },
  title: {
    color: text.ink,
    fontSize: fontSize.titlePage.at390,
    fontWeight: '700',
    marginBottom: space.sm,
  },
  body: { color: text.inkSoft, fontSize: fontSize.body.at390, lineHeight: 22, marginBottom: space.lg },
  code: { color: text.azurite, fontFamily: 'monospace' },
  sectionTitle: {
    color: text.cinnabar,
    fontSize: fontSize.titleRow.at390,
    fontWeight: '700',
    marginTop: space.lg,
    marginBottom: space.xs,
  },
  caption: { color: text.muted, fontSize: fontSize.caption.at390, marginBottom: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET,
    backgroundColor: surface.row,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    marginBottom: TOUCH_GAP,
  },
  rowLabel: { flex: 1, color: text.ink, fontSize: fontSize.body.at390 },
  rowValue: { color: text.gold, fontSize: fontSize.body.at390, fontWeight: '600' },
  swatch: { width: 12, height: 12, borderRadius: 3, marginRight: space.sm },
  begin: {
    marginTop: space.xl,
    minHeight: TOUCH_TARGET,
    backgroundColor: brand.cinnabar,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beginLabel: { color: onColorCream, fontSize: fontSize.bodyLg.at390, fontWeight: '600' },
  clanEntry: {
    marginTop: space.md,
    minHeight: TOUCH_TARGET,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: surface.paperEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clanEntryLabel: { color: text.ink, fontSize: fontSize.body.at390, fontWeight: '600' },
});