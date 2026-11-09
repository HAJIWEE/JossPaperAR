/**
 * THE DECORATION PICKER — `EN · 1f2` / `1f3` / `1f4` (SCRUM-205).
 *
 * ⚠️ **A SHEET INSIDE THE SHRINE CANVAS, NOT A ROUTE** — the same reasoning `ancestor-sheet.tsx` records: the
 * board draws the shrine behind the scrim (the tab bar included), and a pushed route cannot. So this is state
 * on `src/app/index.tsx`, painted last so it covers the footer.
 *
 * ── EVERY NUMBER IS THE BOARD'S ─────────────────────────────────────────────
 * | layer | value |
 * |---|---|
 * | `sheet · panel` | `surface.paper` `#F5F0E8`, **r24 top corners**, to the board's bottom |
 * | `sheet · top rule` | 390 × 3, ink |
 * | `sheet · grab` | 173,452 44 × 4 r2 |
 * | `sheet · title` / `· sub` | 21 / 12.5 · ink / `#4A463F` |
 * | `option · … (bg)` | 350 × 78 r14 — **chosen**: `#A8862A` 2.5 stroke; **other**: ink 2 |
 * | `option · … (check/radio)` | 26 × 26 r13 at the row's right — gold when chosen |
 * | `btn · Equip this set` | 350 × 52 r18, cinnabar, ink 2.5, cream label |
 *
 * ⚠️ The panel's HEIGHT is not a constant here — `sheetLayout(n)` derives it (324 at two options, 404 at three),
 * because the boards draw both and a frozen one is wrong on the other.
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DecorationArt } from '@/components/decoration-art';
import type { DecorationCode, DecorationSlot } from '@/domain/catalogue';
import {
  CATEGORY_COPY,
  categoryOf,
  optionsForSlot,
  sheetLayout,
  type DecorOption,
} from '@/lib/decorate';
import { localized, t } from '@/lib/i18n';
import { brand, onColorCream, surface, text } from '@/theme/tokens';

/** `#%{cash}` from integer cents — never a float on money. */
function cashOf(cents: number | null): string {
  return cents === null ? '0.00' : (cents / 100).toFixed(2);
}

function stateLine(o: DecorOption): string {
  if (o.state === 'equipped') return t('decor.stateEquipped');
  if (o.state === 'owned') return t('decor.stateOwned');
  /** ⚠️ ONE LINE, and shorthand keys — `check:copy` fails a `t()` split across lines, by design. */
  const cash = cashOf(o.decoration.cashPrice);
  const points = String(o.decoration.price ?? 0);
  return t('decor.stateNotOwned', { cash, points });
}

export function DecorSheet({
  scale,
  bleed,
  slot,
  owned,
  equipped,
  busy,
  problem,
  onEquip,
  onClose,
}: {
  scale: number;
  /** Extra dp below the board so the panel reaches the physical bottom — the tab bar's own treatment. */
  bleed: number;
  slot: DecorationSlot;
  owned: readonly DecorationCode[];
  equipped: DecorationCode | null;
  busy: boolean;
  problem: string | null;
  onEquip: (code: DecorationCode) => void;
  onClose: () => void;
}) {
  const copy = CATEGORY_COPY[categoryOf(slot)];
  const options = optionsForSlot(slot, owned, equipped);
  const layout = sheetLayout(options.length);
  /**
   * ⚠️ Defaults to what is ALREADY equipped, so opening a slot shows its current piece selected — and to `null`
   * when nothing is, because pre-selecting somebody's other decoration would put a one-tap change in front of
   * them that they did not ask for.
   */
  const [selected, setSelected] = useState<DecorationCode | null>(equipped);
  useEffect(() => setSelected(equipped), [equipped, slot]);

  const chosen = options.find((o) => o.code === selected) ?? null;
  const canEquip = chosen !== null && chosen.selectable && !busy;

  return (
    <>
      {/* `scrim · sheet (tap = close)` — the whole board, ink at 42 %, painted under the panel. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
        testID="decor-scrim"
        onPress={onClose}
        style={[styles.abs, { left: 0, top: 0, width: 390 * scale, height: (844 + bleed) * scale }]}
      >
        <View style={styles.scrim} />
      </Pressable>

      <View
        testID="decor-sheet"
        style={[
          styles.abs,
          {
            left: 0,
            top: layout.panel.y * scale,
            width: 390 * scale,
            height: layout.panel.h * scale + bleed,
            borderTopLeftRadius: 24 * scale,
            borderTopRightRadius: 24 * scale,
          },
          styles.panel,
        ]}
      >
        <View style={{ height: 3 * scale, backgroundColor: brand.ink }} />
        <View style={[styles.grab, { marginTop: 9 * scale, width: 44 * scale, height: 4 * scale }]} />

        <Text
          numberOfLines={1}
          style={[styles.title, { fontSize: 21 * scale, marginTop: 10 * scale }]}
          testID="decor-sheet-title"
        >
          {t(copy.titleKey)}
        </Text>
        <Text numberOfLines={2} style={[styles.sub, { fontSize: 12.5 * scale, marginTop: 2 * scale }]}>
          {t(copy.subKey)}
        </Text>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 8 * scale }}>
          {options.map((o, i) => {
            const row = layout.rows[i];
            const isChosen = o.code === selected;
            return (
              <Pressable
                key={o.code}
                accessibilityRole="radio"
                accessibilityState={{ selected: isChosen, disabled: !o.selectable }}
                testID={`decor-option-${o.code}`}
                onPress={() => setSelected(o.code)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    marginTop: i === 0 ? 0 : (row.y - layout.rows[i - 1].y - layout.rows[i - 1].h) * scale,
                    height: row.h * scale,
                    borderRadius: 14 * scale,
                    borderWidth: (isChosen ? 2.5 : 2) * scale,
                    borderColor: isChosen ? brand.goldDeep : brand.ink,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <View style={{ width: 64 * scale, height: 54 * scale }}>
                  <DecorationArt code={o.code} size={54 * scale} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 * scale }}>
                  <Text numberOfLines={1} style={[styles.name, { fontSize: 14 * scale }]}>
                    {localized(o.decoration.name)}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.state,
                      { fontSize: 11.5 * scale, color: o.state === 'unowned' ? text.inkSoft : text.gold },
                    ]}
                  >
                    {stateLine(o)}
                  </Text>
                </View>
                <View
                  style={{
                    width: 26 * scale,
                    height: 26 * scale,
                    borderRadius: 13 * scale,
                    borderWidth: (isChosen ? 2.5 : 2) * scale,
                    borderColor: brand.ink,
                    backgroundColor: isChosen ? brand.gold : surface.paper,
                  }}
                />
              </Pressable>
            );
          })}
        </ScrollView>

        {problem === null ? null : (
          <Text testID="decor-problem" style={[styles.problem, { fontSize: 12 * scale }]}>
            {problem}
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canEquip }}
          disabled={!canEquip}
          testID="decor-equip"
          onPress={() => (chosen === null ? undefined : onEquip(chosen.code))}
          style={({ pressed }) => [
            styles.cta,
            { height: 52 * scale, borderRadius: 18 * scale, borderWidth: 2.5 * scale, marginBottom: 18 * scale },
            !canEquip && styles.ctaOff,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.ctaLabel, { fontSize: 16 * scale }]}>{t(copy.buttonKey)}</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  scrim: { flex: 1, backgroundColor: 'rgba(26, 26, 26, 0.42)' },
  panel: { backgroundColor: surface.paper, paddingHorizontal: 20 },
  grab: { alignSelf: 'center', borderRadius: 2, backgroundColor: 'rgba(26, 26, 26, 0.2)' },
  title: { color: text.ink, fontWeight: '700' },
  sub: { color: text.inkSoft },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: surface.row, paddingHorizontal: 12 },
  name: { color: text.ink, fontWeight: '600' },
  state: { marginTop: 2 },
  problem: { color: brand.cinnabar, marginBottom: 6 },
  cta: { backgroundColor: brand.cinnabar, alignItems: 'center', justifyContent: 'center', borderColor: brand.ink },
  ctaOff: { opacity: 0.45 },
  ctaLabel: { color: onColorCream, fontWeight: '600' },
  pressed: { opacity: 0.8 },
});

