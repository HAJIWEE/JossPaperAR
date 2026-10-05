import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AIM_BANDS } from '@/domain/aim';
import { OFFERINGS, baseValueOf } from '@/domain/catalogue';
import { DAILY_PHOTO_BURNS, DAILY_STORE_BURNS } from '@/domain/quota';
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
 * a test file. The real Home (altar, tablets, clan card) is designed and lands
 * with the slice.
 */

export default function HomeScaffold() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        // safe-area, stacked (design-system/responsive.css pattern)
        { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg },
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
        onPress={() => {
          router.push('/capture');
        }}
        style={({ pressed }) => [styles.begin, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.beginLabel}>Begin an offering · 開始供奉</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.paper },
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
});