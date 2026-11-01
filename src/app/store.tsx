/**
 * STORE — `EN · 7 Store` (SCRUM-150).
 *
 * ⚠️ **WHAT IS HERE, AND WHAT IS DELIBERATELY NOT.**
 *
 * The board draws **two payment rails**: *Store Points* and **cash** (`$0.99` … with the footnote
 * *"Google Play will ask you to verify."*). ⚠️ The cash rail is **Google Play Billing** — a native
 * module this build does not have — and there is **no read for a cash balance anywhere** in the RPC
 * surface. So the cash chip and the cash prices are **omitted rather than faked**: a number nothing
 * can produce or spend is the class of defect this project treats as worse than an absent control.
 *
 * ⚠️ The points rail is real: `EN · 7`'s *400 pts* for the Joss Paper Stack is exactly
 * `offerings_catalog.price`, which `purchase_item` checks against the **tribute** balance — so the
 * chip reads `home_summary()`'s `tribute` and needs no second currency.
 *
 * ⚠️ **Decorations is disabled**, and honestly so: `decorations_catalog.price` is **NULL until the
 * economy pass prices them** (*"inventing a store price is a product decision, not a build one"*).
 */

import { useCallback, useEffect, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { OfferingArt } from '@/components/offering-art';
import { TabBarBand } from '@/components/home/tab-bar-band';
import { ScreenHud } from '@/components/screen-hud';
import { t } from '@/lib/i18n';
import { fetchHomeSummary } from '@/lib/home-api';
import { collectedItemName } from '@/lib/collection';
import { HUD } from '@/lib/profile';
import { STORE, STORE_TABS, baseMetaValue, pointsPrice, storeList } from '@/lib/store';
import { DESIGN_REFERENCE_WIDTH, brand, fontSize, surface, text } from '@/theme/tokens';

function scale(): number {
  return Dimensions.get('screen').width / DESIGN_REFERENCE_WIDTH;
}

export default function StoreScreen() {
  const s = scale();
  const [points, setPoints] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const res = await fetchHomeSummary();
    if (!res.ok) {
      /** ⚠️ A failure is kept AS a failure — never folded into a zero balance. */
      setFailed(true);
      setPoints(null);
      return;
    }
    setPoints(res.data.tribute);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { featured, more } = storeList();

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: HUD.touch.y + HUD.touch.size + 15 }]}
        keyboardShouldPersistTaps="handled"
      >
        {failed ? (
          <Text style={styles.problem} testID="store-problem">
            {t('store.unreachable')}
          </Text>
        ) : points === null ? null : (
          <>
            <Text style={[styles.intro, { fontSize: 13 * s }]}>{t('store.intro')}</Text>

            {/* ── the points chip ⚠️ and NO cash chip — see the header ─────── */}
            <View
              style={[styles.chip, { height: STORE.chip.h * s, borderRadius: STORE.chip.radius * s }]}
              testID="store-points-chip"
            >
              <Text style={[styles.chipText, { fontSize: 12 * s }]} numberOfLines={1}>
                {t('store.pointsChip', { points: String(points) })}
              </Text>
            </View>

            {/* ── the switcher ⚠️ Decorations is disabled, not dead ────────── */}
            <View style={[styles.switcher, { gap: (STORE.switcher.xs[1] - STORE.switcher.xs[0] - STORE.switcher.w) * s }]}>
              {STORE_TABS.map((tab) => (
                <View
                  key={tab.id}
                  testID={`store-tab-${tab.id}`}
                  accessibilityState={{ disabled: !tab.enabled }}
                  style={[
                    styles.tab,
                    {
                      width: STORE.switcher.w * s,
                      height: STORE.switcher.h * s,
                      borderRadius: STORE.switcher.radius * s,
                    },
                    tab.enabled && styles.tabOn,
                    !tab.enabled && styles.tabOff,
                  ]}
                >
                  <Text
                    style={[styles.tabText, { fontSize: 13.5 * s }, tab.enabled && styles.tabTextOn]}
                    numberOfLines={1}
                  >
                    {t(tab.labelKey)}
                  </Text>
                </View>
              ))}
            </View>

            {/* ── the FEATURED card ─────────────────────────────────────────── */}
            <View style={styles.featured} testID="store-featured">
              <View style={[styles.tag, { width: STORE.tag.w * s, height: STORE.tag.h * s }]}>
                <Text style={[styles.tagText, { fontSize: 10 * s }]}>{t('store.featured')}</Text>
              </View>
              <View style={{ height: STORE.featuredArt.h * s, alignItems: 'center', justifyContent: 'center' }}>
                <OfferingArt code={featured.code} boxW={STORE.featuredArt.w * s} boxH={STORE.featuredArt.h * s} />
              </View>
              <Text style={[styles.featuredName, { fontSize: 16 * s }]} numberOfLines={1}>
                {collectedItemName(featured.code)}
              </Text>
              <Text style={[styles.featuredValue, { fontSize: 12 * s }]} numberOfLines={1}>
                {t('store.featuredValue', { value: String(baseMetaValue(featured)) })}
              </Text>
            </View>

            {/* ── More bundles ──────────────────────────────────────────────── */}
            <Text style={[styles.moreHead, { fontSize: 15 * s }]}>{t('store.more')}</Text>
            <View style={[styles.grid, { gap: (STORE.card.xs[1] - STORE.card.xs[0] - STORE.card.w) * s }]}>
              {more.map((item) => (
                <View key={item.code} style={[styles.card, { width: STORE.card.w * s }]} testID={`store-item-${item.code}`}>
                  <View style={{ height: STORE.card.artH * s, alignItems: 'center', justifyContent: 'center' }}>
                    <OfferingArt code={item.code} boxW={STORE.card.w * s} boxH={STORE.card.artH * s} />
                  </View>
                  <Text style={[styles.name, { fontSize: 13 * s }]} numberOfLines={1}>
                    {collectedItemName(item.code)}
                  </Text>
                  <Text style={[styles.meta, { fontSize: 11 * s }]} numberOfLines={1}>
                    {t('store.base', { value: String(baseMetaValue(item)) })}
                  </Text>
                  <Text style={[styles.price, { fontSize: 11 * s }]} numberOfLines={1}>
                    {pointsPrice(item) === null ? '' : t('store.price', { points: pointsPrice(item) as string })}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={[styles.note, { fontSize: 11.5 * s }]} testID="store-note">
              {t('store.note')}
            </Text>
          </>
        )}
      </ScrollView>

      {/** ⚠️ **THE STORE IS A TAB DESTINATION, so it carries the bar** (SCRUM-211). */}
      <TabBarBand />

      {/** ⚠️ AFTER the ScrollView — see the Settings defect recorded in `history.tsx`. */}
      <ScreenHud titleKey="store.title" backTestID="store-back" titleTestID="store-title" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.paper },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  problem: { color: text.inkSoft, fontSize: fontSize.body.at390 },
  intro: { color: text.inkSoft },
  chip: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    justifyContent: 'center',
    backgroundColor: surface.row,
    borderWidth: 2,
    borderColor: brand.ink,
    marginTop: 8,
  },
  chipText: { color: text.ink, fontWeight: '700' },
  switcher: { flexDirection: 'row', marginTop: 12 },
  tab: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: brand.ink },
  tabOn: { backgroundColor: brand.cinnabar },
  tabOff: { backgroundColor: 'transparent', opacity: 0.45 },
  tabText: { color: text.ink, fontWeight: '700' },
  tabTextOn: { color: surface.paper },
  featured: { marginTop: 16 },
  tag: { backgroundColor: surface.paperDeep, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  tagText: { color: text.inkSoft, fontWeight: '700', letterSpacing: 0.8 },
  featuredName: { color: text.ink, fontWeight: '700' },
  featuredValue: { color: text.inkSoft },
  moreHead: { color: text.ink, fontWeight: '700', marginTop: 20, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { marginBottom: 16 },
  name: { color: text.ink, fontWeight: '700' },
  meta: { color: text.inkSoft },
  price: { color: text.ink, fontWeight: '700', marginTop: 4 },
  note: { color: text.inkSoft, marginTop: 16 },
});
