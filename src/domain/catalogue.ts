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
 *   2. ✅ **ANSWERED 2026-11-09 (SCRUM-230) — WHICH item takes the 600 and which the 800.** The docs give the
 *      SET of prices, not the pairing, and the pairing here was originally assigned by *list position* — which
 *      had **Gold Bar and Phone transposed**. ⚠️ The boards settle it in their own layer NAMES
 *      (`card · Gold Bar points` = 800 · `card · Phone points` = 600), so the catalogue now follows them:
 *      **Gold Bar 800 · Phone 600**. ⚠️ The House stays pinned to 1,200 by the *"House 1,440"* note.
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
   * ⚠️ `null` is a real answer, never a placeholder — but as of 2026-11-09 **no offering is `null`**: the four
   * the board prices are transcribed, and the House's (which the board never drew) is derived on the owner's
   * instruction, which is why `cashSource` sits beside this field.
   */
  readonly cashPrice: number | null;
  /**
   * WHERE the cash price came from — `board` = transcribed from a layer that names the item, `derived` =
   * calculated from the other items' points-per-dollar because no board draws one.
   *
   * ⚠️ **This exists so a derived number can never pass for a transcription.** It is the cash rail's twin of
   * `priceSource`, and `check:lib` reads it: exactly ONE offering may be `derived`, and the rate it implies
   * must land within 1% of the board-priced singles' mean.
   */
  readonly cashSource: 'board' | 'derived';
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
 * (`金银纸 · 金条 · 手机 · 楼房 · 财富套装`), matched BY NAME — **not** by base value. ⚠️ At the time the
 * board's metas (`Cash Bundle 基础 480 · Gold Bar 基础 960 · House 基础 1,440`) did not line up with the
 * catalogue; ✅ **they do now** — SCRUM-230 swapped Gold Bar and Phone, and 960 / 720 are the board's own bases.
 * ⚠️ Two further design inconsistencies seen while doing this, recorded not fixed:
 * the board calls this item **"Cash Bundle"** in EN where the catalogue says *"Joss Paper
 * Stack"*, and the House is **楼房** in the store but **祖屋** in the collection board.
 */
/**
 * ⚠️⚠️ **THE OFFERINGS' CASH RAIL WAS UNREAD UNTIL 2026-11-09, AND IT WAS DESIGNED ALL ALONG.**
 *
 * The store drew a points pill and no cash pill, because a note here said the cash prices *"are the next
 * read"* — the same mistake the decoration price pass made (a transposition, fixed under SCRUM-204): an unread
 * price is not an absent design.
 * `EN · 7 Store` and `ZH · 7 商店` both draw **two pills on every card**, and the layer NAMES state the
 * pairing outright, which is what makes it trustworthy:
 *   `card · Joss Paper Stack cash = $0.99` · `card · Gold Bar cash = $1.99` · `card · Phone cash = $1.49`
 *   `card · featured cash = $2.99`         (`ZH` agrees: `$0.99 / $1.99 / $1.49 / $2.99`)
 * ⚠️ **The House is the ONE price on this rail that is DERIVED, not read** — the board draws its card OWNED
 * with no cash layer, so the owner ruled (2026-11-09): *"Use the rest of the objects cash price vs their
 * points and calculate an appropriate value."* The three singles sit at **404.04 · 402.68 · 402.01 points per
 * dollar** (a spread of 0.5%), i.e. ≈**403 points per $1**; 1,200 points ÷ 402.91 (their mean) = **$2.9783**,
 * and the median gives **$2.9800** — so the House is **$2.98**. ⚠️ It carries `cashSource: 'derived'` so this
 * is visible in code and machine-checked, instead of looking like a transcription. ⚠️ `$2.99` would also sit
 * inside the band (401.34 pts/$) and matches the store's other `.99`/`.49` price points; `$2.98` is shipped
 * because it is the arithmetic, and the difference is one number if the PM prefers the price point.
 * ⚠️ The **featured bundle is excluded** from the derivation on purpose: at 2,000 pts for $2.99 it is
 * **668.9 pts/$** — a deliberate bundle discount, and including it would drag the House down.
 *
 * ⚠️⚠️ **THE TRANSPOSITION THIS READ EXPOSED IS NOW FIXED (2026-11-09, SCRUM-230).** The boards pair
 * **Gold Bar = 800 pts (base 960)** and **Phone = 600 pts (base 720)**; this catalogue had them the OTHER WAY
 * ROUND — `gold_bar` 600/base 720, `smartphone` 800/base 960 — so the app charged 600 for the gold bar and 800
 * for the phone, 200 points each way in the wrong direction.
 *
 * ⚠️ It is the **same class as the decoration price transposition** (Door Gods ↔ Lanterns, fixed under
 * SCRUM-204) and came from the same shape of mistake: the pairing was assigned by *list position* under a
 * `priceSource: 'derived'` that admits it *"still needs a PM confirmation"*.
 * ✅ **The fix is the board's pairing, and it had to be made in FOUR places at once** — here, `seed.sql`, a NEW
 * migration for the hosted `offerings_catalog` mirror (an applied one is never edited), and the Store's own
 * gates — because points are what `purchase_item` actually charges, and a client/server disagreement would mean
 * the card says 800 while the server charges 600.
 * ⚠️ `cashPrice` did **NOT** move: the cash rail is a separate pairing and it was already right.
 */
export const OFFERINGS: readonly Offering[] = [
  {
    code: 'joss_paper_stack',
    tier: 1,
    price: 400,
    /** `card · Joss Paper Stack cash` = `$0.99`. */
    cashPrice: 99,
    cashSource: 'board',
    name: { en: 'Joss Paper Stack', zh: '金银纸' },
    priceSource: 'documented',
  },
  {
    code: 'gold_bar',
    tier: 2,
    /** ✅ **800, not 600** — `card · Gold Bar points` on both store boards (SCRUM-230). */
    price: 800,
    /** `card · Gold Bar cash` = `$1.99`. */
    cashPrice: 199,
    cashSource: 'board',
    name: { en: 'Gold Bar', zh: '金条' },
    priceSource: 'documented',
  },
  {
    code: 'smartphone',
    tier: 3,
    /** ✅ **600, not 800** — `card · Phone points` on both store boards (SCRUM-230). */
    price: 600,
    /** `card · Phone cash` = `$1.49`. */
    cashPrice: 149,
    cashSource: 'board',
    name: { en: 'Smartphone', zh: '手机' },
    priceSource: 'documented',
  },
  {
    code: 'house',
    tier: 4,
    price: 1200,
    /**
     * ⚠️ **$2.98 — DERIVED, NOT READ, on the owner's instruction** (2026-11-09: *"Use the rest of the objects
     * cash price vs their points and calculate an appropriate value"*). The board draws this card OWNED, with
     * no cash layer, so there was nothing to transcribe.
     *
     * ⚠️ The arithmetic: the three single offerings sit at **404.04 · 402.68 · 402.01 points per dollar**
     * (0.5% apart, i.e. ≈403 pts/$1). `1200 ÷ 402.9117 (mean) = **$2.9783**` · `1200 ÷ 402.6846 (median) =
     * **$2.9800**` · the most adverse single rate gives $2.9850, the most generous $2.9700 — so **$2.98** is
     * the centre of a band that stays inside the observed spread. The bundle is excluded (668.9 pts/$ is its
     * deliberate discount).
     * ⚠️ `cashSource: 'derived'` exists so this can never pass for a transcription; `check:lib` asserts the
     * rate it implies is within 1% of the singles' mean.
     */
    cashPrice: 298,
    cashSource: 'derived',
    name: { en: 'House', zh: '楼房' },
    priceSource: 'derived',
  },
  {
    code: 'wealth_bundle',
    tier: 5,
    price: 2000,
    /** `card · featured cash` = `$2.99` (the featured card carries the bundle's own cash price). */
    cashPrice: 299,
    cashSource: 'board',
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