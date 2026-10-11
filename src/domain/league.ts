/**
 * THE LEAGUE LADDER — the tier vocabulary (SCRUM-111, answered 2026-10-11).
 *
 * doc 07 §7 Q6 asked the three things the schema could not answer, and the PM
 * answered all three: cohort ≈ 30 · the ladder climbs **wood → bronze → iron →
 * precious stones** · promotion is a **fuller animated moment**, not a quiet
 * line. This file is the vocabulary half of that answer.
 *
 * ⚠️ THE RUNGS ARE DATA, NOT SCHEMA, AND THAT WAS DELIBERATE.
 * `cohorts.tier` is a plain `integer` (migration `20261011120000_league_schema`)
 * *precisely* so this list could be decided later without touching a migration.
 * These words are read by a 40–50s Chinese-diaspora audience, so the register is
 * the product's voice — and the voice must be cheap to correct.
 *
 * ⚠️ LOWEST FIRST. `tier` 1 IS the bottom rung. The roll promotes by
 * incrementing the rung, so the ORDER of this array is load-bearing — it is not
 * presentational. `check:domain` asserts tier === index + 1 and that the list
 * is strictly ascending, because a reordered array would silently invert
 * promotion and demotion.
 */

export interface LeagueTier {
  /** 1-based rung. MUST equal the array index + 1 — asserted, never assumed. */
  readonly tier: number;
  readonly name_en: string;
  /** The audience's own language (doc 13 · EN/ZH parity is a gate). */
  readonly name_zh: string;
}

/**
 * ⚠️ 玉 (Jade) and 翡翠 (Jadeite) are both jade-family, so rungs 4 and 5 read
 * as neighbouring stones rather than a clear step. Flagged to the PM on
 * SCRUM-111; the one-word swap is 翡翠 → 金 (Gold). Nothing else would move.
 */
export const LEAGUE_TIERS: readonly LeagueTier[] = [
  { tier: 1, name_en: 'Wood',     name_zh: '木' },
  { tier: 2, name_en: 'Bronze',   name_zh: '銅' },
  { tier: 3, name_en: 'Iron',     name_zh: '鐵' },
  { tier: 4, name_en: 'Jade',     name_zh: '玉' },
  { tier: 5, name_en: 'Jadeite',  name_zh: '翡翠' },
  { tier: 6, name_en: 'Diamond',  name_zh: '鑽石' },
] as const;

/** The bottom rung. A demotion below this holds. */
export const BOTTOM_TIER = 1;

/** The top rung. A promotion above this holds. */
export const TOP_TIER = LEAGUE_TIERS.length;

/**
 * Cohort fill size — **SCRUM-111 answer A (≈30)**.
 * With top-3/bottom-3 this moves roughly 1 in 5 users each week: enough churn
 * to feel alive, not so much that the board reads as random.
 */
export const COHORT_SIZE = 30;

/** How many move each way per cohort per roll (doc 07 §4.4 — top 3 / bottom 3). */
export const PROMOTE_COUNT = 3;
export const DEMOTE_COUNT = 3;

/** Rung → name, for the board and the promotion moment. */
export function tierOf(tier: number): LeagueTier | undefined {
  return LEAGUE_TIERS[tier - 1];
}
