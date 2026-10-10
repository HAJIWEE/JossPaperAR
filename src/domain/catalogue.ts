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

export const OFFERINGS: readonly Offering[] = [
  {
    code: 'joss_paper_stack',
    tier: 1,
    price: 400,
    name: { en: 'Joss Paper Stack' },
    priceSource: 'documented',
  },
  {
    code: 'gold_bar',
    tier: 2,
    price: 600,
    name: { en: 'Gold Bar' },
    priceSource: 'documented',
  },
  {
    code: 'smartphone',
    tier: 3,
    price: 800,
    name: { en: 'Smartphone' },
    priceSource: 'documented',
  },
  {
    code: 'house',
    tier: 4,
    price: 1200,
    name: { en: 'House' },
    priceSource: 'derived',
  },
  {
    code: 'wealth_bundle',
    tier: 5,
    price: 2000,
    name: { en: 'Wealth Bundle' },
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
// TODO(economy): decoration PRICES are not in any doc I can cite — they need the
// economy/design pass before this becomes purchasable. Left `null` deliberately:
// inventing a store price is a product decision, not a build decision.

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
  /** `null` = not yet priced (see TODO above). Never burn. */
  readonly price: number | null;
}

export const DECORATIONS: readonly Decoration[] = [
  { code: 'spring_couplets', name: { en: 'Spring Couplets', zh: '春联' }, category: 'side', price: null },
  { code: 'zhong_kui', name: { en: 'Zhong Kui Print', zh: '钟馗像' }, category: 'background', price: null },
  { code: 'door_gods', name: { en: 'Door Gods', zh: '门神' }, category: 'side', price: null },
  { code: 'lanterns', name: { en: 'Lanterns', zh: '灯笼' }, category: 'top', price: null },
  { code: 'festive_set', name: { en: 'Festive Set', zh: '新春套装' }, category: 'side', price: null },
] as const;