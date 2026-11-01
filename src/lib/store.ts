/**
 * The Store's rules — `EN · 7 Store` (SCRUM-150).
 *
 * ⚠️ **Pure, so a gate can hold it** — the same reason `collection.ts` and `PREPARING_COPY` are
 * modules rather than JSX: which items are FEATURED, which sit under "More bundles", and what a
 * price renders as are facts about a MAPPING.
 */

import { OFFERINGS, type Offering, type OfferingCode } from '../domain/catalogue.ts';

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
   */
  switcher: { y: 115, w: 171, h: 33, radius: 10, xs: [23, 197] as const },
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
 * The two switcher tabs. ⚠️ **`decorations` is DISABLED**, and that is the honest state: the
 * catalogue's decoration prices are **NULL until the economy pass prices them**
 * (`decorations_catalog.price` — *"inventing a store price is a product decision, not a build
 * one"*), so a decoration card could show no price at all.
 */
export const STORE_TABS = [
  { id: 'offerings', labelKey: 'store.tabOfferings', enabled: true },
  { id: 'decorations', labelKey: 'store.tabDecorations', enabled: false },
] as const;

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
