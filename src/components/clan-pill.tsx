/**
 * clan-pill.tsx — the DEVICE half of the Home clan pill (SCRUM-92).
 *
 * The rules, the signed-off geometry and the token ROLES live in
 * `src/lib/clan-pill.ts`, where `check:lib` can assert them without a device. This
 * file only renders them — the project's usual pure/device split.
 *
 * ⚠️ Presentational on purpose: it takes `clans` rather than fetching them, so the
 * screen owns the network and the component stays reusable. `clan/manage.tsx` is
 * the *switcher*; this pill only has to SAY that it opens it — **do not build a
 * second switcher here.**
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  CONTENT_PAD_H,
  NAME_WIDTH,
  PILL_SPEC,
  type PillClan,
  pillRoute,
  pillView,
} from '@/lib/clan-pill';
import { t } from '@/lib/i18n';
import { brand, surface, text } from '@/theme/tokens';

export function ClanPill({ clans }: { clans: readonly PillClan[] }) {
  const router = useRouter();
  const view = pillView(clans);

  /* ⚠️ The design has NO clan-less pill (SCRUM-91 drew only the 1-clan and 2+-clan
     states), so Home renders nothing here rather than inventing a third state. */
  if (!view.show || !view.name || !view.roleLabelKey) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('clan.pillA11y', { name: view.name })}
      testID="home-clan-pill"
      onPress={() => router.push(pillRoute(view.target))}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      {/* The name flexes and ellipsises — the board fixed it at 92 px for a sample
          that inks 84.2, but real names run 2..20 characters (`isValidClanName`). */}
      <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
        {view.name}
      </Text>

      <View style={styles.chip}>
        <Text style={styles.chipLabel} numberOfLines={1}>
          {`\u{1F451} ${t(view.roleLabelKey)}`}
        </Text>
      </View>

      {/* ⚠️ ONE glyph, TWO states: the 2+ state is the same U+203A ROTATED, never a
          second character — a mixed-family glyph reads as inconsistent weight. */}
      <Text style={[styles.affordance, view.glyphRotated && styles.affordanceOpen]}>
        {view.glyph}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: PILL_SPEC.width,
    height: PILL_SPEC.height,
    flexDirection: 'row',
    alignItems: 'center',
    /* ⚠️ 11.5, not 14 — see CONTENT_PAD_H: RN draws the border INSIDE the box. */
    paddingHorizontal: CONTENT_PAD_H,
    borderRadius: PILL_SPEC.radius,
    borderWidth: PILL_SPEC.borderWidth,
    borderColor: brand.ink,
    backgroundColor: surface.paperDeep,
  },
  pressed: { opacity: 0.8 },
  name: {
    /* 92 from the board; it must give rather than clip on a real 20-char name. */
    width: NAME_WIDTH,
    flexShrink: 1,
    color: text.ink,
    fontSize: PILL_SPEC.name.fontSize,
    fontWeight: PILL_SPEC.name.fontWeight,
    /* Noto Serif SC on the board; RN falls back to the system serif. */
    fontFamily: 'serif',
  },
  chip: {
    height: PILL_SPEC.chip.height,
    borderRadius: PILL_SPEC.chip.radius,
    /* ⚠️ brand.gold is a FILL token — correct here. The label must be text.ink:
       text.gold on this gold fill is 2.77:1, the defect SCRUM-93 fixed. */
    backgroundColor: brand.gold,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chipLabel: {
    color: text.ink,
    fontSize: PILL_SPEC.chip.fontSize,
    fontWeight: PILL_SPEC.chip.fontWeight,
  },
  affordance: {
    /* pinned to the pill's inner-right edge, which the board puts at x 204 */
    marginLeft: 'auto',
    width: PILL_SPEC.affordance.size,
    color: text.inkSoft,
    fontSize: PILL_SPEC.affordance.fontSize,
    fontWeight: '700',
    textAlign: 'center',
  },
  affordanceOpen: { transform: [{ rotate: `${PILL_SPEC.affordance.rotationOpenDeg}deg` }] },
});
