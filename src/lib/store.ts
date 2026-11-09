/**
 * The Store's rules — `EN · 7 Store` (SCRUM-150).
 *
 * ⚠️ **Pure, so a gate can hold it** — the same reason `collection.ts` and `PREPARING_COPY` are
 * modules rather than JSX: which items are FEATURED, which sit under "More bundles", and what a
 * price renders as are facts about a MAPPING.
 */

import { DECORATIONS, OFFERINGS, type Offering, type OfferingCode } from '../domain/catalogue.ts';

/**
 * Geometry, in **board px** (`EN · 7 Store`, 390×844).
 *
 * ⚠️ **The item grid is NOT the Collection grid.** Here the cards are 165 wide at x **20 · 197**
 * with 72-tall art, name at +75, meta at +93 and the price row at +113 — a shorter card than
 * `EN · 8`'s 170, because it carries prices instead of a count.
 */
export const STORE = {
  /** `text · intro` — 20,86. */
  intro: { y: 86 },
  /**
   * `chip · points balance (bg)` — 250,82 122×28, fill **gold**, stroke **gold** 1.5, r14.
   * ⚠️ There is NO cash chip: see `CASH_IS_READABLE`.
   */
  chip: { y: 82, w: 122, h: 28, radius: 14, stroke: 1.5 },
  /**
   * `switcher · Offerings` 23,115 171×33 and `… Decorations` 197,115 171×33, inside a
   * `switcher · category (bg)` at **20,112 350×38** — fill `paperDeep`, stroke ink 2.5, **r19**,
   * i.e. a PILL. ⚠️ Without the outer pill the two segments read as two loose buttons.
   *
   * ⚠️ The board's `switcher · active segment` is **r16.5** — read back off the Penpot file, not
   * inferred: 33 tall, so its caps are half-circles and it is a pill too. (This line said `radius: 10`
   * until 2026-11-09; that figure was never on the board.) ⚠️ It is the BOARD's number, not the number
   * this app draws — see `STORE_SWITCHER` for the one that must align with the track.
   */
  switcher: { y: 115, w: 171, h: 33, radius: 16.5, xs: [23, 197] as const },
  switcherBg: { w: 350, h: 38, radius: 19, stroke: 2.5 },
  /** `tag · FEATURED (bg)` — 30,174 86×22, fill **gold**, stroke ink 2, r8. */
  tag: { y: 174, w: 86, h: 22, radius: 8, stroke: 2 },
  /**
   * ⚠️⚠️ **THE CARD FRAMES — WHICH THE FIRST BUILD OMITTED ENTIRELY.** The board draws
   * `card · <name> (bg)` at **165×150**, fill `surface.row`, stroke **ink 2.5**, **r14**, and
   * `card · featured` at **354×190**, stroke **ink 3**, **r18**. Without them the art and the
   * prices float on the page with nothing holding them — the defect the owner caught on glass.
   */
  cardFrame: { w: 165, h: 150, radius: 14, stroke: 2.5 },
  featuredFrame: { w: 354, h: 190, radius: 18, stroke: 3 },
  /** `card · <name> points (bg)` — 68×24, fill **gold**, stroke ink 2, r12. */
  pricePill: { w: 68, h: 24, radius: 12, stroke: 2 },
  /** `art · wealth bundle (ingots)` — 85,195 220×106. */
  featuredArt: { y: 195, w: 220, h: 106 },
  /** `card · featured name` 30,308 · `… value` 30,330. */
  featuredName: { y: 308 },
  featuredValue: { y: 330 },
  /** `heading · more bundles` — 20,368. */
  moreHead: { y: 368 },
  /**
   * The item cards — frames at **y 396 / 558**, 165×150. ⚠️ The inner offsets are from the
   * FRAME's top (396), not from the art: art at **+9** (`art · Cash Bundle` is at 405), name at
   * **+84** (480), meta at **+102** (498), the price row at **+122** (518).
   */
  card: { w: 165, xs: [20, 197] as const, ys: [396, 558] as const, artH: 72, name: 84, meta: 102, price: 122, pad: 12 },
  /** `note · store` — 24,806 342×34. */
  note: { y: 806 },
} as const;

/**
 * ── THE SWITCHER'S INNER GEOMETRY — DERIVED FROM ONE PADDING VALUE ───────────
 *
 * ⚠️⚠️ **A SEGMENT'S CORNER RADIUS IS NOT AN INDEPENDENT NUMBER.** `switcher · category (bg)` is **r19**
 * with a **2.5 ink stroke**, and its segments sit an `inset` inside that edge. For the two curves to run
 * PARALLEL — so each segment's cap nests inside the track's cap instead of pinching against it — the
 * inner radius must be the outer radius MINUS that whole inset:
 *
 *     inset        = stroke + pad            (RN draws the border AND the padding inside the box)
 *     segmentRadius = radius − inset
 *
 * ⚠️ **The defect this replaces, found on glass** (owner, 2026-11-09: *"the corner radius of the border
 * and the buttons do not align well, please use the padding value to properly adjust the corner radius
 * of the inner buttons"*). The screen hard-coded the segments at **r16.5** — i.e. `19 − stroke`, nested
 * for a **2.5** inset — while the row carried its own `paddingHorizontal: 2.5`, so they were *drawn* at a
 * **5** px inset and each cap left a crescent of track between itself and the stroke.
 * ⚠️ **And it overflowed**: `171 + 171 = 342` in a **340** content box, so the right segment ran 2 px
 * over the track's own stroke.
 *
 * ⚠️ **So every number below is COMPUTED.** Change `pad` and the segments resize and re-round together;
 * `check:lib` §29 asserts the rule (`segmentRadius === radius − inset`) and that the two widths plus the
 * gap fill the content box exactly — so neither defect can come back by a single edited literal.
 */
const SWITCHER_PAD = 2.5;
/** ⚠️ OUTER edge → a segment's outer edge. Border and padding both live inside the box. */
const SWITCHER_INSET = STORE.switcherBg.stroke + SWITCHER_PAD;
/** ⚠️ The board's own gap: `… Decorations` starts 3 px after `… Offerings` ends (197 − (23 + 171)). */
const SWITCHER_GAP = STORE.switcher.xs[1] - (STORE.switcher.xs[0] + STORE.switcher.w);

export const STORE_SWITCHER = {
  /** The track, at the board's 350×38. */
  w: STORE.switcherBg.w,
  h: STORE.switcherBg.h,
  radius: STORE.switcherBg.radius,
  stroke: STORE.switcherBg.stroke,
  /** ⚠️ The ONLY value to tune: the breathing room between a segment and the track's stroke. */
  pad: SWITCHER_PAD,
  /** ⚠️ Border + padding — what the radius and the widths are measured against. */
  inset: SWITCHER_INSET,
  gap: SWITCHER_GAP,
  /** ⚠️ `radius − inset`: the caps are then concentric, which is the whole point. */
  segmentRadius: STORE.switcherBg.radius - SWITCHER_INSET,
  /** ⚠️ The track's content box, top to bottom — a segment may not stand proud of it. */
  segmentH: STORE.switcherBg.h - SWITCHER_INSET * 2,
  /** ⚠️ Two of these plus `gap` fill the track's content box EXACTLY — the old 171s did not. */
  segmentW: (STORE.switcherBg.w - SWITCHER_INSET * 2 - SWITCHER_GAP) / 2,
} as const;

/**
 * ⚠️⚠️ **THERE IS NO CASH RAIL, SO THERE IS NO CASH CHIP.**
 *
 * `EN · 7` draws `Cash $12.50` beside `Store Points 1,480`, and `7d`/`7e` draw `$1.29`/`$2.99` and a
 * footnote reading *"Google Play will ask you to verify."* — a **cash** purchase means **Google Play
 * Billing**, a native module this build does not have. ⚠️ **There is also no read for a cash
 * balance anywhere in the RPC surface.** Drawing the chip would put a number on screen that nothing
 * can produce or spend — the class of defect this project treats as worse than an absent control.
 * ⚠️ So the chip is OMITTED, not faked, and filed.
 */
export const CASH_IS_READABLE = false;

/**
 * ⚠️ **"Store Points" IS THE TRIBUTE WALLET.** The board's chip says *Store Points 1,480*, and
 * `EN · 7`'s prices — *400 pts* for the Joss Paper Stack — are exactly `offerings_catalog.price`,
 * which `purchase_item` checks against the **`tribute`** balance. So the chip reads `home_summary()`'s
 * `tribute_total`; there is no second currency to fetch, and inventing one would be a fiction.
 *
 * ⚠️⚠️ **WALLET — and that word is the whole point.** `home_summary()` reads the `balances` view
 * (`sum(ledger_events.amount)`), the **same source `purchase_item` spends**, so the chip falls by
 * exactly the price a purchase charges. ⚠️ It used to read `sum(tributes.points)` — the Book of
 * Tributes' lifetime-earned record, which never falls — and a player with 5000 tribute in the ledger
 * saw *"Store Points 0"* beside a working Buy button (**SCRUM-150 AC 1**).
 */
export const POINTS_CURRENCY = 'tribute';

/** The item the board FEATURES — `card · featured name` reads *Wealth Bundle*. */
export const FEATURED_CODE: OfferingCode = 'wealth_bundle';

/**
 * The two switcher tabs. ⚠️ **BOTH ARE LIVE** since 2026-11-08. `decorations` used to be DISABLED because
 * `decorations_catalog.price` was NULL (*"inventing a store price is a product decision"*) — and that was
 * wrong twice over: the board `EN · 7b` HAD the prices all along, so the tab hid a finished design behind a
 * TODO of mine. The prices are in `catalogue.ts` and in the database now.
 */
export const STORE_TABS = [
  { id: 'offerings', labelKey: 'store.tabOfferings', enabled: true },
  // ✅ ENABLED 2026-11-08 — the tab was dark only because `decorations_catalog.price` was NULL. The board
  // `EN · 7b` HAD the prices all along (owner: *"there is already pricing for the decorations in En-7b"*), so
  // they are in `catalogue.ts` now and the tab has something honest to draw.
  { id: 'decorations', labelKey: 'store.tabDecorations', enabled: true },
] as const;

/** ⚠️ The board's `FEATURED` card on `EN · 7b` is the **Festive Set** ("four pieces · permanent"). */
export const FEATURED_DECORATION = 'festive_set' as const;

/** The decorations, featured first then the rest — the same split the offerings use. */
export function decorationList(): {
  readonly featured: (typeof DECORATIONS)[number];
  readonly more: readonly (typeof DECORATIONS)[number][];
} {
  const featured = DECORATIONS.find((d) => d.code === FEATURED_DECORATION);
  if (featured === undefined) throw new RangeError(`featured decoration is not in the catalogue: ${FEATURED_DECORATION}`);
  return { featured, more: DECORATIONS.filter((d) => d.code !== FEATURED_DECORATION) };
}

export type StoreTabId = (typeof STORE_TABS)[number]['id'];

/** The featured item, then everything else — the board's "More bundles". */
export function storeList(): {
  readonly featured: Offering;
  readonly more: readonly Offering[];
} {
  const featured = OFFERINGS.find((o) => o.code === FEATURED_CODE);
  if (featured === undefined) throw new RangeError(`featured code is not in the catalogue: ${FEATURED_CODE}`);
  return { featured, more: OFFERINGS.filter((o) => o.code !== FEATURED_CODE) };
}

/**
 * What a card's meta line says: `base 480` — the item's **redemption base value**, not its price.
 *
 * ⚠️ `baseValueOf(price)` is `round(price × 1.2)`, so the Joss Paper Stack's 400 reads **480**,
 * which is exactly the board's `card · Joss Paper Stack meta`. ⚠️ Rendering the PRICE here would be
 * off by 20% on every card and would look plausible.
 */
export function baseMetaValue(offering: Offering): number {
  return Math.round(offering.price * 1.2);
}

/**
 * ⚠️ **A price is never rendered without its unit, and never with a `NaN`.** `price` is the
 * catalogue's own field; a card whose price the economy pass has not set must not read *0 pts* as
 * though it were free.
 */
export function pointsPrice(offering: Offering): string | null {
  return Number.isFinite(offering.price) && offering.price > 0 ? `${offering.price}` : null;
}
