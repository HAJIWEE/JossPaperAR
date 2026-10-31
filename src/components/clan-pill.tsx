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

import { useMemo } from 'react';
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

/**
 * ⚠️ `scale` exists because the shrine is a **390×844 canvas** rendered at whatever
 * width the device has (SCRUM-162). Without it the pill kept its 236 while everything
 * around it scaled, so on a 360 dp phone it sat at **x 50 dp instead of the signed-off
 * 74** — measured on glass, not caught by any gate.
 *
 * ⚠️ `PILL_SPEC` stays the signed-off number and `check:lib` §14 keeps asserting it;
 * this prop only multiplies it at render time. Do not bake a scale into the constants.
 */
export function ClanPill({ clans, scale = 1 }: { clans: readonly PillClan[]; scale?: number }) {
  const router = useRouter();
  const view = pillView(clans);

  /** The board's numbers × the canvas scale. At `scale = 1` this is a no-op. */
  const dyn = useMemo(
    () => ({
      pill: {
        width: PILL_SPEC.width * scale,
        height: PILL_SPEC.height * scale,
        paddingHorizontal: CONTENT_PAD_H * scale,
        borderRadius: PILL_SPEC.radius * scale,
        borderWidth: PILL_SPEC.borderWidth * scale,
      },
      name: { width: NAME_WIDTH * scale, fontSize: PILL_SPEC.name.fontSize * scale },
      chip: {
        height: PILL_SPEC.chip.height * scale,
        borderRadius: PILL_SPEC.chip.radius * scale,
        paddingHorizontal: 8 * scale,
      },
      chipLabel: { fontSize: PILL_SPEC.chip.fontSize * scale },
      affordance: {
        width: PILL_SPEC.affordance.size * scale,
        fontSize: PILL_SPEC.affordance.fontSize * scale,
      },
    }),
    [scale],
  );

  /* ⚠️ The design has NO clan-less pill (SCRUM-91 drew only the 1-clan and 2+-clan
     states), so Home renders nothing here rather than inventing a third state. */
  if (!view.show || !view.name || !view.roleLabelKey) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('clan.pillA11y', { name: view.name })}
      testID="home-clan-pill"
      onPress={() => router.push(pillRoute(view.target))}
      style={({ pressed }) => [styles.pill, dyn.pill, pressed && styles.pressed]}
    >
      {/* The name flexes and ellipsises — the board fixed it at 92 px for a sample
          that inks 84.2, but real names run 2..20 characters (`isValidClanName`). */}
      <Text style={[styles.name, dyn.name]} numberOfLines={1} ellipsizeMode="tail">
        {view.name}
      </Text>

      {/* ⚠️ A FIXED slot, with the chip CENTRED in it. The board gives the chip 94 in EN and
          58 in ZH, both at dx 106 — left-anchored, a 2-character 中文 role leaves a 40 px hole
          before the `›` and the chip looks shoved left. The slot is the widest locale's width,
          so EN is unchanged and 中文 centres. */}
      <View style={[styles.chipSlot, { width: PILL_SPEC.chip.slotWidth * scale }]}>
        <View style={[styles.chip, dyn.chip]}>
          <Text style={[styles.chipLabel, dyn.chipLabel]} numberOfLines={1}>
            {`\u{1F451} ${t(view.roleLabelKey)}`}
          </Text>
        </View>
      </View>

      {/* ⚠️ ONE glyph, TWO states: the 2+ state is the same U+203A ROTATED, never a
          second character — a mixed-family glyph reads as inconsistent weight. */}
      <Text style={[styles.affordance, dyn.affordance, view.glyphRotated && styles.affordanceOpen]}>
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
  chipSlot: {
    /* ⚠️ Never shrinks: the slot is what keeps the pill's balance locale-independent. */
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    maxWidth: '100%',
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
