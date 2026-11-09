/**
 * The catalogue — **code-owned**, not rows (doc 07 §5.1.6).
 *
 * Prices and values ship IN THE APP BUNDLE as constants; the server *re-reads
 * them* on every purchase and award so a tampered client cannot set its own
 * price. `offerings_catalog` in Postgres is a **mirror**, kept for SQL joins —
 * this module is the source.
 *
 * ── THE RULE (S13d) ──────────────────────────────────────────────────────────
 *   baseValue = 1.2 × price
 * A store item is worth 20% MORE than it costs to redeem, and the 20%
 * Store-Point accrual on the purchase is INTENDED — together they keep the store
 * a *sink*, so photo capture stays the cheap path (doc 07 §6).
 *
 * ── PROVENANCE (why some fields are marked) ──────────────────────────────────
 * `documented` = the number appears in a locked doc. `derived` = reconstructed
 * from doc 07 §5.3's list (`400/480 · 600/720 · 800/960 · House 1,440 ·
 * bundle 2,000/2,400`) and arithmetic, and **still needs a PM confirmation**:
 *   1. The House's PRICE (doc 07 wrote only its base, 1,440 → 1,440 ÷ 1.2 = 1,200).
 *   2. WHICH item takes the 800 and which the 1,200 — the docs give the set of
 *      prices, not the pairing. Assigned here in ascending order of the S13 icon
 *      list (stack · gold bar · house · smartphone), except the House, which the
 *      "House 1,440" note pins to 1,200.
 */

export type OfferingCode = 'joss_paper_stack' | 'gold_bar' | 'smartphone' | 'house' | 'wealth_bundle';

export interface Offering {
  readonly code: OfferingCode;
  readonly tier: number;
  readonly price: number;
  /**
   * The CASH price in **whole cents**, or `null` where the board draws none.
   *
   * ⚠️ **Read off the board 2026-11-09** — the store drew no cash price for any offering for months because
   * a note here said *"I have not read them"*, and an unread price is not the same as an absent design.
   * `EN · 7 Store` and `ZH · 7 商店` both draw TWO pills per card and **name the item in the layer**
   * (`card · Gold Bar cash` = `$1.99`), which is the pairing to trust — see the block comment below.
   * ⚠️ `null` is a real answer, never a placeholder: the House's card is drawn in its **owned** state
   * (`card · House owned` = `Owned` / `已拥有`) and carries no cash or points layer, so its cash price has
   * never been designed. Inventing one would be a product decision, not a transcription.
   */
  readonly cashPrice: number | null;
  readonly name: { readonly en: string; readonly zh?: string };
  readonly priceSource: 'documented' | 'derived';
  /** The wealth bundle is the four composed into one (S13). */
  readonly composedOf?: readonly OfferingCode[];
}

export const BASE_VALUE_RATIO = 1.2;

/** The single source of the rule. Use this — never hard-code a base value. */
export function baseValueOf(price: number): number {
  return Math.round(price * BASE_VALUE_RATIO);
}

/**
 * ⚠️ **The `zh` names were ADDED 2026-10-10 (SCRUM-97), because they did not exist** — so
 * `localized(o.name)` rendered English on a 中文 panel, which is the same defect as the
 * hardcoded screen copy. They are taken from the design's `ZH · 7 Store / 商店` board
 * (`金银纸 · 金条 · 手机 · 楼房 · 财富套装`), matched BY NAME — **not** by base value, because
 * the board's metas (`Cash Bundle 基础 480 · Gold Bar 基础 960 · House 基础 1,440`) do not
 * line up with doc 10's prices, which is a pre-existing drift worth its own look.
 * ⚠️ Two further design inconsistencies seen while doing this, recorded not fixed:
 * the board calls this item **"Cash Bundle"** in EN where the catalogue says *"Joss Paper
 * Stack"*, and the House is **楼房** in the store but **祖屋** in the collection board.
 */
/**
 * ⚠️⚠️ **THE OFFERINGS' CASH RAIL WAS UNREAD UNTIL 2026-11-09, AND IT WAS DESIGNED ALL ALONG.**
 *
 * The store drew a points pill and no cash pill, because a note here said the cash prices *"are the next
 * read"* — the same mistake the decorations made (SCRUM-204): an unread price is not an absent design.
 * `EN · 7 Store` and `ZH · 7 商店` both draw **two pills on every card**, and the layer NAMES state the
 * pairing outright, which is what makes it trustworthy:
 *   `card · Joss Paper Stack cash = $0.99` · `card · Gold Bar cash = $1.99` · `card · Phone cash = $1.49`
 *   `card · featured cash = $2.99`         (`ZH` agrees: `$0.99 / $1.99 / $1.49 / $2.99`)
 * ⚠️ **The House is the exception and stays unpriced** — its card is drawn OWNED, with no cash layer.
 *
 * ⚠️⚠️ **AND THE READ EXPOSED A REAL DEFECT, WHICH IS RECORDED HERE RATHER THAN QUIETLY FIXED.** The boards
 * pair **Gold Bar = 800 pts (base 960)** and **Phone = 600 pts (base 720)**. This catalogue has them the
 * OTHER WAY ROUND — `gold_bar` 600/base 720, `smartphone` 800/base 960 — so the app charges 600 for the gold
 * bar and 800 for the phone. ⚠️ That is the **same class as SCRUM-204** (Door Gods ↔ Lanterns), and it came
 * from the same shape of mistake: the pairing was assigned by *list position* under a `priceSource: 'derived'`
 * that admits it *"still needs a PM confirmation"*. ⚠️ **NOT CHANGED HERE.** Points are what `purchase_item`
 * actually charges — fixing them means the catalogue, `seed.sql`, the `offerings_catalog` mirror, a NEW
 * migration (an applied one is never edited) and a re-push, plus a product call between doc 07 §5.3's derived
 * pairing and the board. It needs its own ticket, not a ride along a layout change — raised as **SCRUM-230**.
 */
export const OFFERINGS: readonly Offering[] = [
  {
    code: 'joss_paper_stack',
    tier: 1,
    price: 400,
    /** `card · Joss Paper Stack cash` = `$0.99`. */
    cashPrice: 99,
    name: { en: 'Joss Paper Stack', zh: '金银纸' },
    priceSource: 'documented',
  },
  {
    code: 'gold_bar',
    tier: 2,
    price: 600,
    /** `card · Gold Bar cash` = `$1.99`. */
    cashPrice: 199,
    name: { en: 'Gold Bar', zh: '金条' },
    priceSource: 'documented',
  },
  {
    code: 'smartphone',
    tier: 3,
    price: 800,
    /** `card · Phone cash` = `$1.49`. */
    cashPrice: 149,
    name: { en: 'Smartphone', zh: '手机' },
    priceSource: 'documented',
  },
  {
    code: 'house',
    tier: 4,
    price: 1200,
    /**
     * ⚠️ **`null` ON PURPOSE — the board prices no cash for the House.** `EN · 7 Store` draws its card in the
     * OWNED state (`card · House owned (bg)` 82×24 reading `Owned`, `已拥有` on `ZH · 7`) with no cash and no
     * points pill, and no other board prices it either. ⚠️ A cash price could be *inferred* from the three
     * singles (≈ $2.98 at the board's ~403 pts/$) and that is exactly what must not happen: a derived dollar
     * amount beside a real one is an invented price. It stays `null` until the PM gives it one — raised as
     * **SCRUM-229** (`🎯 Decide:`), because a dollar figure is a revenue decision, not a transcription.
     */
    cashPrice: null,
    name: { en: 'House', zh: '楼房' },
    priceSource: 'derived',
  },
  {
    code: 'wealth_bundle',
    tier: 5,
    price: 2000,
    /** `card · featured cash` = `$2.99` (the featured card carries the bundle's own cash price). */
    cashPrice: 299,
    name: { en: 'Wealth Bundle', zh: '财富套装' },
    priceSource: 'documented',
    composedOf: ['joss_paper_stack', 'gold_bar', 'smartphone', 'house'],
  },
] as const;

export function getOffering(code: OfferingCode): Offering {
  const found = OFFERINGS.find((o) => o.code === code);
  if (!found) throw new RangeError(`unknown offering code: ${code}`);
  return found;
}

/** What a burn of this item is worth, before band multipliers. */
export function redemptionBaseValue(code: OfferingCode): number {
  return baseValueOf(getOffering(code).price);
}

// ── Decorations ──────────────────────────────────────────────────────────────
// Permanent, NEVER burn → they are a points SINK, so they carry no baseValue.
// Names are locked (S14); the SIX slots and THREE categories are locked (S14j).
//
// ✅ PRICED 2026-11-08 — **the board already had them and I was wrong to say it didn't.** The owner: *"I
// checked the penpot and there is already pricing for the decorations in En-7b"*. Read off
// `EN · 7b Store · Decorations`, which draws BOTH rails for all four items and the featured set.
//
// ⚠️ So the old note ("inventing a store price is a product decision") was right in principle and wrong in
// fact: the prices were designed and I never read the board. ⚠️ Every number below is the board's own:
//   Festive Set $3.99 / 3,000 pts   Spring Couplets $0.99 / 800   Zhong Kui Print $1.29 / 1,000
//   Door Gods $1.49 / 1,200         Lanterns $1.99 / 1,600
// ⚠️ `cashPrice` is in CENTS, an integer, so no float ever touches money.
//
// ⚠️⚠️ **DOOR GODS AND LANTERNS WERE THE OTHER WAY ROUND UNTIL 2026-11-09** — the first pass paired them
// by their POSITION on the board instead of by its layer NAMES. `EN · 7b` says it outright:
//   `card · Door Gods cash  = $1.49`   `card · Door Gods points  = 1,200 pts`
//   `card · Lanterns cash   = $1.99`   `card · Lanterns points   = 1,600 pts`
// and `ZH · 7b` agrees (门神 $1.49 / 1,200 · 灯笼 $1.99 / 1,600). ⚠️ **Both are SIDE-vs-TOP so nothing
// structural distinguished them** — the swap charged 400 points too much for the lanterns and 400 too
// little for the door gods, and it is invisible to a reader who does not have the board open.
// ⚠️ **The gate in `lib/checks/run.ts` was transcribed from the same wrong pass, so it AGREED with the
// defect** — a table that restates its own input cannot catch a transposition. It is corrected there too,
// and the DB follows in migration `20261109100000_decoration_price_swap`.

export type DecorationSlotCategory = 'top' | 'side' | 'background';

export const DECORATION_SLOTS = [
  'top_left',
  'top_middle',
  'top_right',
  'side_left',
  'side_right',
  'background',
] as const;
export type DecorationSlot = (typeof DECORATION_SLOTS)[number];

export const SLOT_CATEGORY: Record<DecorationSlot, DecorationSlotCategory> = {
  top_left: 'top',
  top_middle: 'top',
  top_right: 'top',
  side_left: 'side',
  side_right: 'side',
  background: 'background',
};

/** One set per category may be DISPLAYED, even when both are owned (S14k). */
export const SETS_PER_CATEGORY_MAX = 1;

export type DecorationCode =
  | 'spring_couplets'
  | 'zhong_kui'
  | 'door_gods'
  | 'lanterns'
  | 'festive_set';

export interface Decoration {
  readonly code: DecorationCode;
  readonly name: { readonly en: string; readonly zh: string };
  readonly category: DecorationSlotCategory;
  /** Store Points. ⚠️ Never burn — a decoration is a sink. */
  readonly price: number | null;
  /** ⚠️ CASH, in CENTS (the board's `$3.99` = 399). Integer, so no float touches money. */
  readonly cashPrice: number | null;
  /**
   * ⚠️⚠️ **A SET, NOT A PIECE** (owner, 2026-11-09): *"Festive Set is just the rest of the decorations being sold
   * together as a set, it should not be a selectable item for the decorations. when a user buys the Festive set he is
   * getting all the other decorations in one shot."*
   *
   * ⚠️ So a composed decoration is **never offered in a slot picker and never drawn on the altar** — it is a SKU. Its
   * mirror is `decorations_catalog.composed_of`, and `purchase_item` grants one of each component and **never a row
   * for the set itself**, exactly as `wealth_bundle` does on the offerings side.
   */
  readonly composedOf?: readonly DecorationCode[];
}

export const DECORATIONS: readonly Decoration[] = [
  { code: 'spring_couplets', name: { en: 'Spring Couplets', zh: '春联' }, category: 'side', price: 800, cashPrice: 99 },
  { code: 'zhong_kui', name: { en: 'Zhong Kui Print', zh: '钟馗像' }, category: 'background', price: 1000, cashPrice: 129 },
  { code: 'door_gods', name: { en: 'Door Gods', zh: '门神' }, category: 'side', price: 1200, cashPrice: 149 },
  { code: 'lanterns', name: { en: 'Lanterns', zh: '灯笼' }, category: 'top', price: 1600, cashPrice: 199 },
  { code: 'festive_set', name: { en: 'Festive Set', zh: '新春套装' }, category: 'side', price: 3000, cashPrice: 399,
    // ⚠️ A BUNDLE, not an altarpiece (owner, 2026-11-09) — buying it grants these four, and it is never offered in a
    // slot picker nor drawn on the shrine. `decorations_catalog.composed_of` is the SQL mirror.
    composedOf: ['lanterns', 'spring_couplets', 'zhong_kui', 'door_gods'] },
] as const;