/**
 * COLLECTION — `EN · 8 Collection` / `EN · 8d Collection / empty` (SCRUM-151).
 *
 * ── ⚠️ WHY THIS SCREEN NEEDED A MIGRATION ───────────────────────────────────
 * The Profile row rendered **disabled** because no RPC could return the per-item aggregate the cards
 * draw (`burned ×N`). `my_offerings` returns individual burns (a page, not a tally) and `clan_book`
 * returns the CLAN's entries; `public.burns` has RLS on with **no policy**, so a plain select answers
 * `[]` with no error. So it reads `my_collection()` / `my_collection_totals()`, both
 * `SECURITY DEFINER` and scoped to `auth.uid()`.
 *
 * ── ⚠️ THREE STATES, AND THEY ARE DIFFERENT FACTS ───────────────────────────
 * **loading** (nothing yet), **failed** (`collection.unreachable` — we could not reach the shrine) and
 * **empty** (`collection.emptyFirst…` — you have burned nothing). ⚠️ Rendering the empty copy on a
 * failure would state a fact about the user that the app does not know — the rule `history.tsx`
 * records.
 *
 * ── ⚠️ THE ART WELL IS EMPTY, DELIBERATELY ──────────────────────────────────
 * The board draws `art · Gold Bar`, `art · Cash Bundle` … inside each card. **Those illustrations do
 * not exist in the app** — the catalogue is code-owned names and prices, and there is no per-item art
 * anywhere in `src/`. The well is reserved at the board's exact geometry and rendered as a plain
 * surface. ⚠️ It is **not** filled with an invented glyph: a made-up icon would look real and be a
 * lie about what the item is. Filed as owed in `follow-up-items.md`.
 */

import { useCallback, useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenHud } from '@/components/screen-hud';
import { myCollection, myCollectionTotals, type CollectionItem, type CollectionTotals } from '@/lib/account-api';
import { COLLECTION, collectionGrid, collectedItemName, displayBurnCount } from '@/lib/collection';
import { t } from '@/lib/i18n';
import { HUD } from '@/lib/profile';
import { DESIGN_REFERENCE_WIDTH, brand, fontSize, radius, surface, text } from '@/theme/tokens';

/**
 * ⚠️ **WIDTH-ONLY, not `homeFitScale`.** The shrine contain-fits because its art must not be cropped
 * on a short phone; this is a scrolling grid, so its cards must track the WIDTH and let the page
 * scroll. Contain-fitting here would shrink the cards on a tall phone and leave a gutter.
 */
function gridScale(): number {
  return Dimensions.get('screen').width / DESIGN_REFERENCE_WIDTH;
}

export default function CollectionScreen() {
  const s = gridScale();
  const [items, setItems] = useState<readonly CollectionItem[] | null>(null);
  const [totals, setTotals] = useState<CollectionTotals | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const [list, summary] = await Promise.all([myCollection(), myCollectionTotals()]);
    if (!list.ok) {
      /** ⚠️ A failure is kept AS a failure — never folded into an empty grid. */
      setFailed(true);
      setItems(null);
      setTotals(null);
      return;
    }
    setItems(list.data);
    setTotals(summary.ok ? summary.data : null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cells = items === null ? [] : collectionGrid(items);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: HUD.touch.y + HUD.touch.size + 15 }]}
        keyboardShouldPersistTaps="handled"
      >
        {failed ? (
          <Text style={styles.problem} testID="collection-problem">
            {t('collection.unreachable')}
          </Text>
        ) : items === null ? null : (
          <>
            {/* ── the two stat cards ───────────────────────────────────────── */}
            <View
              style={[
                styles.stats,
                { gap: (COLLECTION.stat.xs[1] - COLLECTION.stat.xs[0] - COLLECTION.stat.w) * s },
              ]}
            >
              <StatCard
                testID="collection-stat-burned"
                value={totals?.offeringsBurned ?? 0}
                labelKey="collection.burnedLabel"
                s={s}
              />
              <StatCard
                testID="collection-stat-collected"
                value={totals?.itemsCollected ?? 0}
                labelKey="collection.collectedLabel"
                s={s}
              />
            </View>

            {/* ── the grid ─────────────────────────────────────────────────── */}
            <View
              style={[
                styles.grid,
                {
                  marginTop: (COLLECTION.card.ys[0] - COLLECTION.stat.y - COLLECTION.stat.h) * s,
                  gap: (COLLECTION.card.xs[1] - COLLECTION.card.xs[0] - COLLECTION.card.w) * s,
                },
              ]}
              testID="collection-grid"
            >
              {cells.map((cell, i) => (
                <CollectionCard key={cell.itemCode ?? `empty-${i}`} cell={cell} s={s} index={i} />
              ))}
            </View>

            <Text style={styles.note} testID="collection-note">
              {t('collection.note')}
            </Text>
          </>
        )}
      </ScrollView>

      {/*
        ⚠️ AFTER the ScrollView, and that is load-bearing: the scroll view fills the viewport and is
        painted last, so a HUD rendered BEFORE it draws (through the transparent background) and never
        receives a tap. That was the Settings defect, 2026-11-01.
      */}
      <ScreenHud
        titleKey="collection.title"
        backTestID="collection-back"
        titleTestID="collection-title"
      />
    </View>
  );
}

/** ⚠️ `stat · offerings burned` — the number at 20 px, the label at 11 px beside it. */
function StatCard({
  testID,
  value,
  labelKey,
  s,
}: {
  testID: string;
  value: number;
  labelKey: string;
  s: number;
}) {
  return (
    <View
      style={[
        styles.stat,
        {
          width: COLLECTION.stat.w * s,
          height: COLLECTION.stat.h * s,
          borderRadius: COLLECTION.stat.radius * s,
        },
      ]}
      testID={testID}
    >
      <Text style={[styles.statValue, { fontSize: 20 * s }]} allowFontScaling={false}>
        {String(value)}
      </Text>
      <Text style={[styles.statLabel, { fontSize: 11 * s }]} numberOfLines={2}>
        {t(labelKey)}
      </Text>
    </View>
  );
}

/**
 * ⚠️ **A cell is an ITEM or an EMPTY SLOT, and which words an empty slot carries is decided by
 * `collectionGrid`, not here** — that mapping is asserted by `check:lib` §28.
 */
function CollectionCard({
  cell,
  s,
  index,
}: {
  cell: ReturnType<typeof collectionGrid>[number];
  s: number;
  index: number;
}) {
  const isEmpty = cell.kind === 'empty';
  const cardW = COLLECTION.card.w * s;

  return (
    <View
      style={[
        styles.card,
        {
          width: cardW,
          height: COLLECTION.card.h * s,
          borderRadius: COLLECTION.card.radius * s,
        },
        isEmpty && styles.cardEmpty,
      ]}
      testID={isEmpty ? `collection-slot-${index}` : `collection-item-${cell.itemCode}`}
    >
      {/*
        ⚠️ **ABSOLUTELY POSITIONED AT THE BOARD'S OFFSETS, not flowed.** A flex column put the copy
        outside the 170 px card on glass. ⚠️ And the art well is drawn ONLY on an item card: the board's
        empty slot (`8d`) carries a `＋` and copy and **no** well.
      */}
      {isEmpty ? null : (
        <View
          style={[
            styles.artWell,
            {
              position: 'absolute',
              top: COLLECTION.art.top * s,
              left: ((COLLECTION.card.w - COLLECTION.art.w) / 2) * s,
              width: COLLECTION.art.w * s,
              height: COLLECTION.art.h * s,
              borderRadius: radius.md * s,
            },
          ]}
        />
      )}

      {isEmpty ? (
        <>
          <Text
            style={[
              styles.plus,
              { position: 'absolute', top: COLLECTION.emptyPlus.dy * s, fontSize: COLLECTION.emptyPlus.size * s },
            ]}
            allowFontScaling={false}
          >
            {'＋'}
          </Text>
          {/*
            ⚠️ ONLY the first empty slot speaks, and WHICH words it says depends on whether the grid
            is entirely empty — `8d` versus `8`. `collectionGrid` decides; this only renders it.
            ⚠️ **TWO LINES ALLOWED, where the board draws one.** The board's box is 145 board px at
            11 px and its copy fits; Roboto is wider, and on glass *"your first burn lands here"*
            truncated to *"lands h…"*. ⚠️ The card has room (the line sits at +122 of 170), so the
            wrap is taken rather than shrinking the type below the board's size — a font-metric
            deviation, recorded rather than hidden.
          */}
          {cell.emptyCopy === 'none' ? null : (
            <>
              <Text
                style={[styles.name, textBox(s), { top: COLLECTION.emptyLine1.dy * s }]}
                numberOfLines={2}
              >
                {t(cell.emptyCopy === 'firstEver' ? 'collection.emptyFirst1' : 'collection.emptyNext1')}
              </Text>
              <Text
                style={[styles.meta, textBox(s), { top: COLLECTION.emptyLine2.dy * s }]}
                numberOfLines={2}
              >
                {t(cell.emptyCopy === 'firstEver' ? 'collection.emptyFirst2' : 'collection.emptyNext2')}
              </Text>
            </>
          )}
        </>
      ) : (
        <>
          <Text
            style={[
              styles.name,
              textBox(s),
              { top: COLLECTION.name.dy * s, fontSize: COLLECTION.name.size * s },
            ]}
            numberOfLines={1}
          >
            {collectedItemName(cell.itemCode)}
          </Text>
          <Text
            style={[
              styles.meta,
              textBox(s),
              { top: COLLECTION.meta.dy * s, fontSize: COLLECTION.meta.size * s },
            ]}
            numberOfLines={1}
          >
            {t('collection.meta', { count: String(displayBurnCount(cell.burned)) })}
          </Text>
        </>
      )}
    </View>
  );
}

/**
 * ⚠️ **The name and the meta are LEFT-aligned at +10, 145 wide** — the board's `card · Gold Bar
 * name` is `207,268 145×18` inside a card at `197,168`. ⚠️ A bare `textAlign: 'center'` would put
 * them where the board does not.
 */
function textBox(s: number) {
  return { left: COLLECTION.text.dx * s, width: COLLECTION.text.w * s };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.paper },
  scroll: { flex: 1 },
  content: { paddingHorizontal: COLLECTION.card.xs[0], paddingBottom: 40 },
  problem: { color: text.inkSoft, fontSize: fontSize.body.at390 },
  stats: { flexDirection: 'row' },
  stat: {
    backgroundColor: surface.row,
    borderWidth: 2,
    borderColor: brand.ink,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  statValue: { color: text.ink, fontWeight: '400' },
  statLabel: { color: text.inkSoft, flex: 1, marginLeft: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    backgroundColor: surface.row,
    borderWidth: 2.5,
    borderColor: brand.ink,
    alignItems: 'center',
  },
  /** ⚠️ The empty slot is DASHED, not solid — the board's own distinction between the two states. */
  cardEmpty: { backgroundColor: 'transparent', borderStyle: 'dashed', borderColor: text.inkSoft },
  /** ⚠️ A plain surface, NOT an invented glyph — the illustration is owed. */
  artWell: { backgroundColor: surface.paperDeep, alignSelf: 'center' },
  /** ⚠️ The `＋` is CENTRED in the slot; the copy lines are not — see `textBox` below. */
  plus: { color: '#77632F', alignSelf: 'center' },
  name: { position: 'absolute', color: text.ink, fontWeight: '700' },
  meta: { position: 'absolute', color: text.inkSoft },
  note: { color: text.inkSoft, fontSize: 11.5, marginTop: 24 },
});
