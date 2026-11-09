/**
 * THE OFFERINGS PICKER — `EN · 2e Offerings picker` (SCRUM-149).
 *
 * ⚠️ **THE HALF THAT DID NOT EXIST.** `burns` XOR-enforces *either* a `capture_id` *or* an
 * `item_code`, and `submit_burn` has accepted `item_code` since it was written — but the CLIENT only
 * ever sent a capture (`reward.tsx` calls `submitBurn(captureId, …)`). So `item_code` was a field the
 * client *rendered* and never *produced*: an item burn was reachable by no screen at all.
 *
 * ⚠️ **An unowned ITEM is DRAWN, and drawn as unavailable.** ⚠️ The board's own example of that state
 * was `card · Wealth Bundle (bg)` — but the bundle **is not an item**, and the owner's rule
 * (2026-11-07) is that it must **not appear at all**, not even disabled. So it is **excluded** from
 * the grid (see `lib/picker.ts`); the unavailable state now applies to the unowned **standard items**
 * — which is exactly what a new player sees, all of them. A picker built from the inventory alone
 * would show a NEW player an empty grid and say nothing about what exists; this shows what exists and
 * what is missing.
 *
 * ⚠️ **The list is the CATALOGUE's items, not the board's six.** See `lib/picker.ts`: the board's
 * bases are the catalogue's shifted by one and it carries a *Joss Stack* no catalogue entry has. The
 * catalogue is code-owned and the SERVER re-reads it on every burn.
 */

import { useCallback, useEffect, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { OfferingArt } from '@/components/offering-art';
import { ScreenHud } from '@/components/screen-hud';
import { collectedItemName } from '@/lib/collection';
import { t } from '@/lib/i18n';
import { myInventory, type Inventory } from '@/lib/offerings-api';
import { PICKER, ownsNothing, pickerBase, pickerGrid } from '@/lib/picker';
import { HUD } from '@/lib/profile';
import { DESIGN_REFERENCE_WIDTH, brand, fontSize, surface, text } from '@/theme/tokens';

function scale(): number {
  return Dimensions.get('screen').width / DESIGN_REFERENCE_WIDTH;
}

export default function OfferingsScreen() {
  const s = scale();
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const res = await myInventory();
    if (!res.ok) {
      /** ⚠️ A failure is kept AS a failure — never folded into "you own nothing". */
      setFailed(true);
      setInventory(null);
      return;
    }
    setInventory(res.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cells = inventory === null ? [] : pickerGrid(inventory);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: HUD.touch.y + HUD.touch.size + 15 }]}
        keyboardShouldPersistTaps="handled"
      >
        {failed ? (
          <Text style={styles.problem} testID="picker-problem">
            {t('picker.unreachable')}
          </Text>
        ) : inventory === null ? null : (
          <>
            <Text style={styles.note} testID="picker-note">
              {t('picker.note')}
            </Text>

            {ownsNothing(inventory) ? (
              <Text style={styles.none} testID="picker-none">
                {t('picker.noneOwned')}
              </Text>
            ) : null}

            <View
              style={[
                styles.grid,
                {
                  marginTop: (PICKER.card.ys[0] - PICKER.note.y - 34) * s,
                  gap: (PICKER.card.xs[1] - PICKER.card.xs[0] - PICKER.card.w) * s,
                },
              ]}
              testID="picker-grid"
            >
              {cells.map((cell) => (
                <Pressable
                  key={cell.code}
                  testID={`picker-item-${cell.code}`}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !cell.owned }}
                  disabled={!cell.owned}
                  onPress={() => {
                    /**
                     * \u26a0\ufe0f **THE ITEM BURN ENTRY POINT.** It carries the CODE, not a capture \u2014 the
                     * half the client never had. `/burn` takes it from here and `submitBurn` sends it.
                     */
                    router.push({ pathname: '/burn', params: { itemCode: cell.code } });
                  }}
                  style={[
                    styles.card,
                    {
                      width: PICKER.card.w * s,
                      height: PICKER.card.h * s,
                      borderRadius: PICKER.card.radius * s,
                    },
                    !cell.owned && styles.cardOff,
                  ]}
                >
                  <View
                    style={[
                      styles.art,
                      {
                        width: PICKER.art.w * s,
                        height: PICKER.art.h * s,
                        marginTop: PICKER.art.top * s,
                      },
                    ]}
                  >
                    <OfferingArt code={cell.code} boxW={PICKER.art.w * s} boxH={PICKER.art.h * s} />
                  </View>
                  <Text style={[styles.name, { fontSize: 13 * s }]} numberOfLines={1}>
                    {collectedItemName(cell.code)}
                  </Text>
                  <Text style={[styles.meta, { fontSize: 11 * s }]} numberOfLines={1}>
                    {cell.owned
                      ? `${t('picker.base', { value: String(pickerBase(cell.offering)) })}  ${t('picker.owned', { qty: String(cell.qty) })}`
                      : t('picker.notOwned')}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/** \u26a0\ufe0f AFTER the ScrollView \u2014 see the Settings defect recorded in `history.tsx`. */}
      <ScreenHud titleKey="picker.title" backTestID="picker-back" titleTestID="picker-title" band />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.paper },
  scroll: { flex: 1 },
  content: { paddingHorizontal: PICKER.card.xs[0], paddingBottom: 40 },
  problem: { color: text.inkSoft, fontSize: fontSize.body.at390 },
  note: { color: text.inkSoft, fontSize: 11.5 },
  none: { color: text.inkSoft, fontSize: 12, marginTop: 10, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    backgroundColor: surface.row,
    borderWidth: 2.5,
    borderColor: brand.ink,
    alignItems: 'center',
  },
  /**
   * \u26a0\ufe0f **THE UNAVAILABLE STATE, WHICH THE BOARD DRAWS** \u2014 `fill=none` and an outline where an
   * owned card is filled and inked. \u26a0\ufe0f Dimmed AND unfilled: opacity alone would still read as
   * tappable at a glance, which is the `SCRUM-145` class.
   */
  cardOff: { backgroundColor: 'transparent', borderColor: text.inkSoft, borderStyle: 'dashed', opacity: 0.6 },
  art: { alignItems: 'center', justifyContent: 'center' },
  name: { color: text.ink, fontWeight: '700', marginTop: 'auto', marginBottom: 2 },
  meta: { color: text.inkSoft, marginBottom: 10 },
});
