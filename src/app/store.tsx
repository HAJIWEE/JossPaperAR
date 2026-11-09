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
 * `offerings_catalog.price`, which `purchase_item` checks against the **`tribute`** balance — so the
 * chip reads `home_summary()`'s `tribute` and needs no second currency. ⚠️ **That figure is the
 * WALLET, the same `balances` read the purchase makes**, so the chip falls by the price charged
 * (SCRUM-150 AC 1). ⚠️ The chip is re-read after every successful buy (`load()` in `confirmBuy`) —
 * the server is the authority, and a client-side subtraction would drift the moment a price changed.
 *
 * ⚠️ **Both store tabs are live** since 2026-11-08: `decorations_catalog.price` carries the prices the boards
 * `EN · 7b` / `ZH · 7b` already drew (the tab was dark only because I had never read them).
 */

import { useCallback, useEffect, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { ConfirmCard } from '@/components/confirm-card';
import { OfferingArt } from '@/components/offering-art';
import { TabBarBand } from '@/components/home/tab-bar-band';
import { ScreenHud } from '@/components/screen-hud';
import { localized, t } from '@/lib/i18n';
import { DecorationArt } from '@/components/decoration-art';
import { fetchHomeSummary } from '@/lib/home-api';
import { getOffering, type OfferingCode } from '@/domain/catalogue';
import { collectedItemName } from '@/lib/collection';
import { purchaseItem } from '@/lib/offerings-api';
import { HUD } from '@/lib/profile';
import { STORE, STORE_SWITCHER, STORE_TABS, baseMetaValue, cashText, decorationList, pointsPrice, storeList, type StoreTabId } from '@/lib/store';
import { DESIGN_REFERENCE_WIDTH, brand, fontSize, onColorCream, surface, text } from '@/theme/tokens';

function scale(): number {
  return Dimensions.get('screen').width / DESIGN_REFERENCE_WIDTH;
}

/**
 * THE DECORATIONS HALF OF THE STORE — `EN · 7b Store · Decorations`.
 *
 * ⚠️ **Every price here is the board's own** (`EN · 7b`): Festive Set $3.99/3,000 · Couplets $0.99/800 ·
 * Zhong Kui Print $1.29/1,000 · Door Gods $1.49/1,200 · Lanterns $1.99/1,600. They live in `domain/catalogue.ts`
 * and are formatted here, never hand-typed into copy.
 *
 * ⚠️⚠️ **DOOR GODS AND LANTERNS WERE TRANSPOSED UNTIL 2026-11-09** — the first read of the board paired the
 * four cards by their POSITION in the 2 × 2 grid instead of by their layer names, so the lanterns read
 * 1,200/$1.49 and the door gods 1,600/$1.99. ⚠️ The board states the pairing outright (`card · Door Gods cash`,
 * `card · Lanterns points`), in EN and ZH, and the cards on this screen now follow it.
 *
 * ⚠️⚠️ **BOTH RAILS ARE DRAWN AND NEITHER PURCHASE IS WIRED.** The prices are real — the points price is
 * `decorations_catalog.price`, which `purchase_item` charges — but the CASH rail needs Google Play Billing
 * (SCRUM-212) and these cards are still a layout: tapping one does nothing rather than pretending to sell.
 * ⚠️ That is the owner's line, verbatim: *"build out all of it to the point of the actual payments portion."*
 */
/**
 * ONE PRICE PILL, for both rails and both card sizes.
 *
 * ⚠️⚠️ **WHY THIS EXISTS AT ALL** (owner on glass, 2026-11-09: *"In the decorations store, the options to buy
 * buttons are missing their borders and backgrounds"*). The decorations' small cards drew `$0.99` and
 * `800 pts` as **bare `<Text>`** while the offerings' cards drew them as gold pills — the same numbers, two
 * different treatments, because each block had hand-rolled its own row. ⚠️ Repeating a pill four times is
 * how one of them ends up without a background; there is now one component and no block owns a pill.
 *
 * ⚠️ `featured` switches BOTH the box and the type size: the board draws the featured pair at **72/74 × 30
 * r15** and the small cards' at **68 × 24 r12** — the card the board draws largest must not carry the
 * smallest readout (which is what happened when the featured card borrowed `pricePill`).
 */
function PricePill({
  label,
  w,
  s,
  featured = false,
  testID,
}: {
  readonly label: string;
  readonly w: number;
  readonly s: number;
  readonly featured?: boolean;
  readonly testID?: string;
}) {
  const spec = featured ? STORE.featuredPill : STORE.pricePill;
  return (
    <View
      style={[
        styles.pricePill,
        { width: w * s, height: spec.h * s, borderRadius: spec.radius * s, borderWidth: STORE.pricePill.stroke * s },
      ]}
      testID={testID}
    >
      <Text style={[styles.priceText, { fontSize: (featured ? 12 : 11) * s }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}


function DecorationsBlock() {
  const { width } = useWindowDimensions();
  const s = width / DESIGN_REFERENCE_WIDTH;
  const { featured, more } = decorationList();
  const featuredCash = cashText(featured.cashPrice);
  return (
    <>
      <Text style={[styles.intro, { fontSize: 13 * s }]} testID="store-decor-intro">
        {t('store.decorIntro')}
      </Text>

      {/* ── the FEATURED decoration ─────────────────────────────────────── */}
      <Pressable
        accessibilityRole="button"
        testID="store-decor-featured"
        onPress={() => undefined}
        style={({ pressed }) => [
          styles.featured,
          {
            borderRadius: STORE.featuredFrame.radius * s,
            borderWidth: STORE.featuredFrame.stroke * s,
            paddingHorizontal: 12 * s,
            paddingTop: 12 * s,
            /** ⚠️ The pill row is the LAST child — see `featuredFrame.padBottom`. */
            paddingBottom: STORE.featuredFrame.padBottom * s,
          },
        ]}
      >
        <View style={[styles.tag, { width: STORE.tag.w * s, height: STORE.tag.h * s, borderRadius: STORE.tag.radius * s, borderWidth: STORE.tag.stroke * s }]}>
          <Text style={[styles.tagText, { fontSize: 10 * s }]}>{t('store.featured')}</Text>
        </View>
        <View style={{ height: STORE.featuredArt.h * s, alignItems: 'center', justifyContent: 'center' }}>
          <DecorationArt code={featured.code} size={STORE.featuredArt.h * s} />
        </View>
        <Text style={[styles.featuredName, { fontSize: 16 * s }]} numberOfLines={1}>{localized(featured.name)}</Text>
        <Text style={[styles.featuredValue, { fontSize: 12 * s }]} numberOfLines={1}>{t('store.decorFeaturedValue')}</Text>
        {/* ⚠️ BOTH rails, as the board draws them — cash first, then points, right-aligned at the board's gap. */}
        <View style={[styles.pillRow, { marginTop: 6 * s, justifyContent: 'flex-end', gap: STORE.featuredPill.gap * s }]}>
          {featuredCash === null ? null : (
            <PricePill label={t('store.cashPrice', { cash: featuredCash })} w={STORE.featuredPill.cashW} s={s} featured testID="store-decor-featured-cash" />
          )}
          <PricePill label={t('store.price', { points: String(featured.price) })} w={STORE.featuredPill.pointsW} s={s} featured testID="store-decor-featured-points" />
        </View>
      </Pressable>

      {/* ── the rest ─────────────────────────────────────────────────────── */}
      <Text style={[styles.moreHead, { fontSize: 15 * s }]}>{t('store.moreDecorations')}</Text>
      <View style={[styles.grid, { gap: (STORE.card.xs[1] - STORE.card.xs[0] - STORE.card.w) * s }]}>
        {more.map((item) => {
          const cash = cashText(item.cashPrice);
          return (
          <Pressable
            key={item.code}
            accessibilityRole="button"
            testID={`store-decor-${item.code}`}
            onPress={() => undefined}
            style={({ pressed }) => [
              styles.card,
              /**
               * ⚠️⚠️ **BORDER FROM THE BOARD** (owner, 2026-11-08: *"the decorations page individual items is also
               * missing their borders"*). `card · X (bg)` on `EN · 7b` is **165 × 150 with r14 and a 2.5 ink
               * stroke** — and this screen had dropped the stroke entirely, so the cards floated as bare paper
               * with nothing separating them from the page.
               * ⚠️ **AND `paddingHorizontal` SINCE 2026-11-09** — the board sets the name and both pills at
               * **dx 12** inside the 165-wide card, and without it the pills physically cannot fit:
               * `12 + 68 + 5 + 68 + 12 = 165` exactly. The text was flush against the border before.
               */
              { width: 165 * s, minHeight: 150 * s, borderRadius: 14 * s, borderWidth: 2.5 * s, borderColor: brand.ink, paddingHorizontal: STORE.card.padH * s },
            ]}
          >
            <View style={{ height: STORE.card.artH * s, alignItems: 'center', justifyContent: 'center' }}>
              <DecorationArt code={item.code} size={STORE.card.artH * s} />
            </View>
            <Text style={[styles.name, { fontSize: 13 * s }]} numberOfLines={1}>{localized(item.name)}</Text>
            <Text style={[styles.meta, { fontSize: 10.5 * s }]} numberOfLines={1}>{t('store.decorPermanent')}</Text>
            {/* ⚠️ REAL PILLS — this row was bare `<Text>`, which is the defect the owner saw. */}
            <View style={[styles.pillRow, { marginTop: 6 * s, gap: STORE.pricePill.gap * s }]}>
              {cash === null ? null : (
                <PricePill label={t('store.cashPrice', { cash })} w={STORE.pricePill.w} s={s} testID={`store-decor-${item.code}-cash`} />
              )}
              <PricePill label={t('store.price', { points: String(item.price) })} w={STORE.pricePill.w} s={s} testID={`store-decor-${item.code}-points`} />
            </View>
          </Pressable>
          );
        })}
      </View>
    </>
  );
}


export default function StoreScreen() {
  const s = scale();
  const [points, setPoints] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  /** ⚠️ The code awaiting confirmation, or `null`. One card, not one per item. */
  const [buying, setBuying] = useState<{ readonly code: OfferingCode; readonly price: number } | null>(null);
  /** ⚠️ Which half of the store is showing. The switcher is the board's, and both tabs are live. */
  const [tabId, setTabId] = useState<StoreTabId>('offerings');
  const [buyIssue, setBuyIssue] = useState<string | null>(null);
  /**
   * ⚠️ **ONE KEY PER CONFIRM, not per attempt.** It is minted when the card OPENS and reused until
   * it closes, so a retry after a dropped response cannot charge twice — the reason
   * `purchase_item` takes a key at all. A fresh key per attempt would defeat it entirely.
   */
  const [buyKey, setBuyKey] = useState('');

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

  /**
   * Buy the confirmed item, then RELOAD the balance — the server is the authority on what is left, and
   * a client-side subtraction would drift the moment a price changed.
   */
  const confirmBuy = useCallback(async () => {
    if (buying === null) return;
    const res = await purchaseItem(buying.code, buyKey);
    setBuying(null);
    if (!res.ok) {
      /** ⚠️ The SERVER's reason, not invented copy: an empty balance and an unknown code differ. */
      setBuyIssue(res.reason);
      return;
    }
    setBuyIssue(null);
    await load();
  }, [buying, buyKey, load]);

  /**
   * ⚠️ **A COMPOSED item gets its OWN body.** The generic one would promise the WRONG thing: buying
   * the Wealth Bundle grants **one of each of the other four**, never a "Wealth Bundle" object
   * (owner, 2026-11-07). ⚠️ Each `t()` call is on ONE LINE — `check:copy` fails a call split across
   * lines, because the extractor that hunts untranslated copy cannot follow one.
   */
  const buyingOffering = buying === null ? null : getOffering(buying.code);
  /**
   * ⚠️ **NO CASH AMOUNT YET, DELIBERATELY.** The offering cash prices are drawn on `EN · 7` and I have not read
   * them — a made-up `$0.00` beside a real item would be an invented price, which is worse than an absent one.
   * ⚠️ The DECORATIONS board (`EN · 7b`) gave its five prices and those ARE in `catalogue.ts`; the offerings'
   * cash prices are the next read.
   */
  const buyCashLabel = t('store.buyCash');

  const buyBody =
    buying === null ? '' : (buyingOffering?.composedOf?.length ?? 0) > 0
      ? t('store.buyBodyBundle', { name: String(collectedItemName(buying.code)), points: String(buying.price) })
      : t('store.buyBody', { name: String(collectedItemName(buying.code)), points: String(buying.price) });

  const { featured, more } = storeList();
  /** ⚠️ The decorations now have PRICES (from `EN · 7b`) and PORTED ART, so the tab is live rather than dark. */
  const decor = decorationList();

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

            {/* ── the two balance chips: CASH and POINTS ─────────────────────
                ⚠️⚠️ **THE CASH CHIP IS RENDERED AND THE PAYMENT IS NOT WIRED** (owner, 2026-11-08:
                *"i still don't see the Cash portions of the store ... build out all of it to the point of the
                actual payments portion"*). ⚠️ So this is LAYOUT: the chip is drawn to the board's geometry
                (`EN · 7b` / `EN · 7`) and shows the balance the RPC surface can actually give us — which is
                ⚠️ **nothing**: there is no cash-balance read anywhere in the RPC surface, so it renders `$0.00`
                rather than the board's sample `$12.50`. ⚠️ Printing a sample balance would be the one lie this
                screen could tell that a user would believe.
            */}
            <View style={styles.chips}>
              <View
                style={[styles.chip, { height: STORE.chip.h * s, borderRadius: STORE.chip.radius * s }]}
                testID="store-cash-chip"
              >
                <Text style={[styles.chipText, { fontSize: 12 * s }]} numberOfLines={1}>
                  {t('store.cashChip', { cash: (0).toFixed(2) })}
                </Text>
              </View>
              <View
                style={[styles.chip, { height: STORE.chip.h * s, borderRadius: STORE.chip.radius * s }]}
                testID="store-points-chip"
              >
                <Text style={[styles.chipText, { fontSize: 12 * s }]} numberOfLines={1}>
                  {t('store.pointsChip', { points: String(points) })}
                </Text>
              </View>
            </View>

            {/* ── the switcher ⚠️ Decorations is disabled, not dead ────────── */}
            {/* The pill BACKGROUND first — `switcher · category (bg)`, r19, ink 2.5. */}
            <View
              /**
               * ⚠️⚠️ **THE RADIUS IS DERIVED FROM THE PADDING, NOT TYPED** (owner on glass, 2026-11-09:
               * *"the corner radius of the border and the buttons do not align well, please use the padding
               * value to properly adjust the corner radius of the inner buttons"*).
               *
               * ⚠️ The track is r19 with a 2.5 ink stroke, and RN draws that stroke INSIDE the box — so a
               * segment inset by `stroke + pad` from the OUTER edge must be `19 − (stroke + pad)` to nest.
               * ⚠️ The previous build hard-coded `r16.5` (nested for the stroke alone) beside a 2.5
               * `paddingHorizontal`, so the caps were drawn at a 5 px inset and each one left a crescent of
               * track — and `171 + 171` overflowed the 340 content box by 2 px into the stroke.
               * ⚠️ `STORE_SWITCHER` computes the inset, the radius, both segment dimensions and the gap from
               * that one padding; `check:lib` §29 holds the rule.
               */
              style={[
                styles.switcherBg,
                {
                  width: STORE_SWITCHER.w * s,
                  height: STORE_SWITCHER.h * s,
                  borderRadius: STORE_SWITCHER.radius * s,
                  borderWidth: STORE_SWITCHER.stroke * s,
                  padding: STORE_SWITCHER.pad * s,
                },
              ]}
              testID="store-switcher"
            >
            <View style={[styles.switcher, { gap: STORE_SWITCHER.gap * s }]}>
              {STORE_TABS.map((tab) => (
                <Pressable
                  key={tab.id}
                  onPress={() => setTabId(tab.id)}
                  testID={`store-tab-${tab.id}`}
                  accessibilityState={{ disabled: !tab.enabled }}
                  /**
                   * ⚠️⚠️ **SELECTION, NOT ENABLEDNESS.** The pills used to be styled by `tab.enabled` — so the
                   * day Decorations was enabled, BOTH drew as the active cinnabar segment. ⚠️ Two identical red
                   * pills is not a switcher; the state has to be `tab.id === tabId`.
                   * ⚠️ And no per-pill border: the board's only stroke is the container's.
                   * ⚠️ The radius/height/width come from `STORE_SWITCHER` — see the track above.
                   */
                  style={[
                    styles.tab,
                    {
                      width: STORE_SWITCHER.segmentW * s,
                      height: STORE_SWITCHER.segmentH * s,
                      borderRadius: STORE_SWITCHER.segmentRadius * s,
                    },
                    tabId === tab.id ? styles.tabOn : styles.tabOff,
                  ]}
                >
                  <Text
                    style={[styles.tabText, { fontSize: 13.5 * s }, tabId === tab.id ? styles.tabTextOn : styles.tabTextOff]}
                    numberOfLines={1}
                  >
                    {t(tab.labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
            </View>

            {/* ── the FEATURED card — ⚠️ PURCHASABLE (owner, 2026-11-07) ────────
                 ⚠️ It WAS a plain `<View>`, so the Wealth Bundle could not be bought AT ALL —
                 only the four "More bundles" cards were `Pressable` (found on the SCRUM-220
                 device run). ⚠️ The owner settled SCRUM-221: **the bundle IS buyable** (points
                 now; the cash rail needs Play Billing — SCRUM-212), and buying it grants **one of
                 each of the other four** — **never a "Wealth Bundle" object**. ⚠️ The GRANT is the
                 SERVER's (`purchase_item` reads `offerings_catalog.composed_of`); this card only
                 has to reach it.
                 ⚠️ The points-price pill is ADDED here: the board's `card · featured` draws a
                 name + a value and NO pill, but a card you can buy must show what it costs.
                 ⚠️ No CASH price is drawn: there is no cash rail and **no read for a cash balance**
                 (`CASH_IS_READABLE`), and inventing a price is a product decision. */}
            {tabId === 'offerings' ? (<>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                /** ⚠️ Mint the key HERE — opening the card is the intent, not the tap on Confirm. */
                setBuyKey(`buy:${featured.code}:${Date.now()}`);
                setBuyIssue(null);
                setBuying({ code: featured.code, price: featured.price });
              }}
              /**
               * ⚠️ **`paddingBottom` IS THE FIX FOR THE PILL SITTING ON THE BORDER** (owner, 2026-11-09: *"the
               * wealth Bundle's points value button is also too close to the bottom border"*). The card had
               * horizontal and top padding only, so its last child was flush against the card's own 3 px
               * stroke; `card · featured` on `EN · 7 Store` leaves **14 px** under the pill row.
               */
              style={[
                styles.featured,
                {
                  borderRadius: STORE.featuredFrame.radius * s,
                  borderWidth: STORE.featuredFrame.stroke * s,
                  paddingHorizontal: 12 * s,
                  paddingTop: 12 * s,
                  paddingBottom: STORE.featuredFrame.padBottom * s,
                },
              ]}
              testID="store-featured"
            >
              <View style={[styles.tag, { width: STORE.tag.w * s, height: STORE.tag.h * s, borderRadius: STORE.tag.radius * s, borderWidth: STORE.tag.stroke * s }]}>
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
              {/*
                ⚠️⚠️ **BOTH RAILS, AND BOTH AT THE FEATURED SIZE.** `card · featured cash (bg)` is 72×30 r15
                and `card · featured points (bg)` 74×30 r15, right-aligned at a 6 px gap — so the bundle now
                shows **$2.99** beside its 2,000 pts, exactly as the board draws it. ⚠️ It used to render a
                single 68×24 pill (the small cards' size) with no cash rail at all.
              */}
              <View style={[styles.pillRow, { marginTop: 6 * s, justifyContent: 'flex-end', gap: STORE.featuredPill.gap * s }]}>
                {cashText(featured.cashPrice) === null ? null : (
                  <PricePill label={t('store.cashPrice', { cash: cashText(featured.cashPrice) as string })} w={STORE.featuredPill.cashW} s={s} featured testID="store-featured-cash" />
                )}
                <PricePill label={t('store.price', { points: pointsPrice(featured) as string })} w={STORE.featuredPill.pointsW} s={s} featured testID="store-featured-points" />
              </View>
            </Pressable>

            {/* ── More bundles ──────────────────────────────────────────────── */}
            <Text style={[styles.moreHead, { fontSize: 15 * s }]}>{t('store.more')}</Text>
            <View style={[styles.grid, { gap: (STORE.card.xs[1] - STORE.card.xs[0] - STORE.card.w) * s }]}>
              {more.map((item) => {
                const cash = cashText(item.cashPrice);
                const points = pointsPrice(item);
                return (
                <Pressable
                  key={item.code}
                  accessibilityRole="button"
                  onPress={() => {
                    /** ⚠️ Mint the key HERE — opening the card is the intent, not the tap on Confirm. */
                    setBuyKey(`buy:${item.code}:${Date.now()}`);
                    setBuyIssue(null);
                    setBuying({ code: item.code, price: item.price });
                  }}
                  style={[styles.card, { width: STORE.cardFrame.w * s, height: STORE.cardFrame.h * s, borderRadius: STORE.cardFrame.radius * s, borderWidth: STORE.cardFrame.stroke * s, paddingHorizontal: STORE.card.padH * s }]}
                  testID={`store-item-${item.code}`}
                >
                  <View style={{ height: STORE.card.artH * s, alignItems: 'center', justifyContent: 'center' }}>
                    <OfferingArt code={item.code} boxW={STORE.card.w * s} boxH={STORE.card.artH * s} />
                  </View>
                  <Text style={[styles.name, { fontSize: 13 * s }]} numberOfLines={1}>
                    {collectedItemName(item.code)}
                  </Text>
                  <Text style={[styles.meta, { fontSize: 11 * s }]} numberOfLines={1}>
                    {t('store.base', { value: String(baseMetaValue(item)) })}
                  </Text>
                  {/*
                    ⚠️⚠️ **BOTH RAILS — THE CASH PILL WAS MISSING ENTIRELY.** `card · <name> cash (bg)` and
                    `… points (bg)` are **68×24 r12** at **dx 12** and **dx 85**, so the pair plus the gaps
                    fills the card's content box exactly (`12 + 68 + 5 + 68 + 12 = 165`). ⚠️ The offerings'
                    cash prices had never been read off the board, so this row drew the points rail only —
                    which is what the owner saw as *"the Cash option is missing"*.
                    ⚠️ **The House renders ONE pill on purpose**: the board draws its card in the OWNED state
                    with no cash layer, so `cashPrice` is `null` rather than a made-up number.
                  */}
                  <View style={[styles.pillRow, { marginTop: 6 * s, gap: STORE.pricePill.gap * s }]}>
                    {cash === null ? null : (
                      <PricePill label={t('store.cashPrice', { cash })} w={STORE.pricePill.w} s={s} testID={`store-item-${item.code}-cash`} />
                    )}
                    {points === null ? null : (
                      <PricePill label={t('store.price', { points })} w={STORE.pricePill.w} s={s} testID={`store-item-${item.code}-points`} />
                    )}
                  </View>
                </Pressable>
                );
              })}
            </View>

            <Text style={[styles.note, { fontSize: 11.5 * s }]} testID="store-note">
              {t('store.note')}
            </Text>
            </>) : (
              <DecorationsBlock />
            )}

            {/** ⚠️ The SERVER's own refusal, shown as it came — not reworded into copy. */}
            {buyIssue === null ? null : (
              <Text style={styles.issue} testID="store-issue">
                {buyIssue}
              </Text>
            )}
            <ConfirmCard
              visible={buying !== null}
              title={t('store.buyTitle')}
              body={buyBody}
              confirmLabel={t('store.buyConfirm')}
              cancelLabel={t('common.cancel')}
              onConfirm={() => void confirmBuy()}
              onCancel={() => setBuying(null)}
              /**
               * ⚠️⚠️ **THE CASH RAIL, INSIDE THE MODAL** (owner, 2026-11-08). It was first rendered on the page
               * BEHIND this modal, which made it invisible on glass — a gate that greps for the testID passes on a
               * control nobody can see. `ConfirmCard` now takes a second action, so the layout is honest AND reachable.
               * ⚠️ It stays enabled and answers the truth on press: Play Billing is not in this build.
               */
              secondaryLabel={buyCashLabel}
              secondaryTestID="store-buy-cash"
              onSecondary={() => setBuyIssue(t('store.cashNotOpen'))}
              secondaryNote={t('store.cashNotOpen')}
            />
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
  /** ⚠️ The cash button beside the points confirm — outlined, not filled: it is the secondary rail. */
  cashBtn: {
    marginTop: 10,
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: brand.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  cashBtnLabel: { color: brand.ink, fontSize: 14, fontWeight: '700' },
  /** ⚠️ The two-chip row (cash + points) — the board draws them side by side, not stacked. */
  /**
   * ⚠️⚠️ **THE BALANCE ROW IS RIGHT-ALIGNED** (owner, 2026-11-08: *"the UI Layout for the cash and points display is
   * not right aligned like the penpot design"*).
   *
   * ⚠️ The board settles it: `chip · points balance (bg)` on `EN · 7b` sits at **x 250 of 390** — **18 dp from the
   * right edge** — at 122 × 28. It answers "how much do I have?", so the group hugs that edge while the reading
   * column above it stays left-flush.
   * ⚠️ `alignSelf: stretch` is what makes `flex-end` mean anything: without it the row shrink-wraps its content and
   * both alignments look identical.
   */
  chips: { flexDirection: 'row', gap: 8, marginBottom: 8, alignSelf: 'stretch', justifyContent: 'flex-end' },

  chip: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    justifyContent: 'center',
    backgroundColor: brand.gold,
    borderWidth: 1.5,
    borderColor: brand.gold,
    marginTop: 8,
  },
  chipText: { color: text.ink, fontWeight: '700' },
  switcherBg: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    backgroundColor: surface.paperDeep,
    borderColor: brand.ink,
    marginTop: 12,
  },
  switcher: { flexDirection: 'row' },
  /** ⚠️ NO border, NO opacity — the board's segment is a flat fill and the container carries the only stroke. */
  tab: { alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: brand.cinnabar },
  // ⚠️ Unselected is the CONTAINER's own ground showing through, so it reads as a well, not a dimmed button.
  tabOff: { backgroundColor: 'transparent' },
  tabText: { color: text.ink, fontWeight: '700' },
  /** ⚠️ Both colours are the board's: `#fff8e8` on the active segment, `#4a463f` off it. */
  tabTextOn: { color: onColorCream },
  tabTextOff: { color: text.inkSoft },
  featured: {
    marginTop: 16,
    backgroundColor: surface.row,
    borderColor: brand.ink,
  },
  tag: {
    backgroundColor: brand.gold,
    borderColor: brand.ink,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  tagText: { color: text.ink, fontWeight: '700', letterSpacing: 0.8 },
  featuredName: { color: text.ink, fontWeight: '700' },
  featuredValue: { color: text.inkSoft },
  moreHead: { color: text.ink, fontWeight: '700', marginTop: 20, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    marginBottom: 16,
    backgroundColor: surface.row,
    borderColor: brand.ink,
  },
  name: { color: text.ink, fontWeight: '700' },
  meta: { color: text.inkSoft },
  /**
   * ⚠️ **No `marginTop` any more** — the ROW carries it (`pillRow`), because the same pill is now both a
   * small card's last child and the featured card's last child, and those two need different margins. A
   * margin baked in here was what made the featured row unable to clear its own border.
   */
  pricePill: {
    backgroundColor: brand.gold,
    borderColor: brand.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** ⚠️ The price-pill ROW — the pills are `pricePill`/`featuredPill`; this only lines them up. */
  pillRow: { flexDirection: 'row', alignItems: 'center' },
  priceText: { color: text.ink, fontWeight: '700' },
  note: { color: text.inkSoft, marginTop: 16 },
  issue: { color: brand.cinnabar, fontWeight: '700', marginTop: 8 },
});
