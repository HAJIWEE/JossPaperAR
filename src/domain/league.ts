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
/**
 * ⚠️ SIMPLIFIED, NOT TRADITIONAL — SCRUM-95, PM 2026-10-10: *"Simplified Chinese.
 * Has a significant larger market."* These three names shipped traditional (`銅` ·
 * `鐵` · `鑽石`) and **nothing failed**, because `check:lib` §15 scanned `MESSAGES.zh`,
 * the aim bands, the quota copy and the catalogue — but never this constant. A board
 * reading `铜 Bronze` beside a screen reading `族长` is exactly the mixed-script
 * screen SCRUM-95 exists to prevent. §15 now scans these too.
 */
export const LEAGUE_TIERS: readonly LeagueTier[] = [
  { tier: 1, name_en: 'Wood',     name_zh: '木' },
  { tier: 2, name_en: 'Bronze',   name_zh: '铜' },
  { tier: 3, name_en: 'Iron',     name_zh: '铁' },
  { tier: 4, name_en: 'Jade',     name_zh: '玉' },
  { tier: 5, name_en: 'Jadeite',  name_zh: '翡翠' },
  { tier: 6, name_en: 'Diamond',  name_zh: '钻石' },
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

/* ═══════════════════════════════════════════════════════════════════════════
 * THE PROMOTION MOMENT — SCRUM-111 answer C ("a fuller animated moment")
 *
 * doc 07 §7 Q6 asked what "promotion" should SHOW to a 40–50s Chinese-diaspora
 * audience, and the PM answered: not the quiet one-line delta the board could
 * render for free, but a **fuller moment**. This module is the half of that
 * answer a test can hold: WHICH outcomes get a moment, what it names, and
 * whether it moves. The animation itself and the copy live on the screen side.
 * ═══════════════════════════════════════════════════════════════════════════ */

export type MomentKind = 'promoted' | 'demoted' | 'held';

export interface PromotionMoment {
  readonly kind: MomentKind;
  /** The rung the user was on. `null` when there is no "from" (see `held`). */
  readonly fromTier: number | null;
  /** The rung the user is on now. */
  readonly toTier: number | null;
  /** i18n KEYS, never copy — the copy table owns both languages (doc 15 §8). */
  readonly titleKey: string;
  readonly bodyKey: string;
  /**
   * ⚠️ **ONLY A PROMOTION ANIMATES.** This is the load-bearing rule of answer C,
   * and it is the project's cultural posture rather than a taste call: doc 04 names
   * *"Guilt-tripping notifications, aggressive monetization"* as the patterns to
   * avoid, and doc 16 applies it to this audience. A demotion that celebrated or
   * played a sting would be that pattern in animation. A demotion is therefore
   * **stated plainly and quietly** — the user is told, not punished.
   */
  readonly animated: boolean;
}

/**
 * What, if anything, the roll's outcome should show the user.
 *
 * ⚠️ `outcome` is the row's grading and `tier` is the tier that row is in NOW, so
 * the "from" rung is DERIVED (`tier ∓ 1`) rather than stored — the roll engine
 * already carries the outcome forward (`league_roll_engine.sql`, the tier
 * expression), and a second stored "from" could disagree with it.
 *
 * ⚠️ `null` outcome is the honest state of a row in a week that has not rolled yet.
 * It is NOT `held`: "you stayed" and "we have not graded this week" are different
 * things to say to a user, and only one of them is true.
 */
export function promotionMoment(
  outcome: LeagueOutcome | null,
  tier: number | null,
): PromotionMoment | null {
  // No grading yet, or no placement — there is no moment to show.
  if (outcome === null || tier === null) return null;

  if (outcome === 'promoted') {
    return {
      kind: 'promoted',
      fromTier: Math.max(BOTTOM_TIER, tier - 1),
      toTier: tier,
      titleKey: 'league.momentPromotedTitle',
      bodyKey: 'league.momentPromotedBody',
      animated: true,
    };
  }

  if (outcome === 'demoted') {
    return {
      kind: 'demoted',
      fromTier: Math.min(TOP_TIER, tier + 1),
      toTier: tier,
      titleKey: 'league.momentDemotedTitle',
      bodyKey: 'league.momentDemotedBody',
      animated: false,          // ⚠️ a demotion is stated, never played
    };
  }

  return {
    kind: 'held',
    fromTier: tier,
    toTier: tier,
    titleKey: 'league.momentHeldTitle',
    bodyKey: 'league.momentHeldBody',
    animated: false,
  };
}

/** The outcome vocabulary, as a value — so a parser and a test share one list. */
export const LEAGUE_OUTCOMES = ['promoted', 'demoted', 'held'] as const;
export type LeagueOutcome = (typeof LEAGUE_OUTCOMES)[number];
