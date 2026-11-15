/**
 * The award formula — server-authoritative (ADR-005, doc 07 §4.3/§6).
 *
 *   award = 400 × bandMultiplier × (new ground ? 2.0 : 1) + (streak ? 50 : 0)
 *   clamped to 0 … 1,650
 *
 * Which reproduces the locked numbers exactly (doc 05 §2 / doc 07 §6):
 *   正中 + new ground + streak = 400×2.0×2.0 + 50 = 1,650
 *   虔诚 + new ground + streak = 400×1.5×2.0 + 50 = 1,250
 *   擦边 + new ground + streak = 400×1.0×2.0 + 50 =   850
 *   偏失                        =                       0
 *
 * `MAX_AWARD` is the integrity cap (doc 11 §2): 1,650/burn. The clamp is not
 * decoration — it is the ceiling a tampered client cannot exceed.
 *
 * ⚠️ Only `award-service` may persist the result. This module computes; it
 * never writes.
 */

import { bandMultiplier, deriveBand, type BandId } from './aim.ts';

export const BASE_AWARD = 400;
/**
 * ⚠️ SCRUM-237 — the **n = 1 ceiling**. A cell's first burn is ×2.0; each later
 * burn decays the bonus ABOVE ×1.0 (see `groundMultiplier`).
 */
export const NEW_GROUND_MULTIPLIER = 2.0;
/**
 * The bonus above ×1.0 multiplies by this each burn — the PM's *"0.25 for the
 * first drop then slowly reduce the rate of dropping"* (SCRUM-235).
 */
export const GROUND_DECAY_RATIO = 0.75;
/** Below this the bonus IS zero: the multiplier is fixed at ×1.0. */
export const GROUND_DECAY_EPSILON = 0.005;
export const STREAK_BONUS = 50;
export const MAX_AWARD = 1650;

/**
 * `multiplier(n) = 1 + min(2.0 − 1, 0.75^(n−1))`, where `n` is the LIFETIME burn
 * number in that cell (1 = the first).
 *
 *   2.000 · 1.750 · 1.563 · 1.422 · 1.316 · 1.237 … → 1.000
 *
 * ⚠️ This is the SQL twin of `submit_burn`'s `c_ground_decay` / `c_ground_eps`.
 * The server is authoritative; `check:domain` asserts the table so the two
 * cannot drift silently.
 */
export function groundMultiplier(burnNumber: number): number {
  if (!Number.isFinite(burnNumber) || burnNumber < 1) return 1;
  const bonus = Math.min(
    NEW_GROUND_MULTIPLIER - 1,
    Math.pow(GROUND_DECAY_RATIO, burnNumber - 1),
  );
  return 1 + (bonus < GROUND_DECAY_EPSILON ? 0 : bonus);
}

export interface BurnInputs {
  /** Distance in px from the fire's heart — CLIENT-ASSERTED, accepted with caps. */
  readonly offsetPx: number;
  /**
   * ⚠️ Server-decided: the LIFETIME burn number in this coarse cell, INCLUDING
   * this one (1 = the first). Takes precedence over `newGround`, and is NEVER
   * client-asserted (ADR-005).
   */
  readonly cellBurns?: number;
  /**
   * Server-decided: is this the FIRST burn in the cell? Kept for callers that
   * only know the flag; `cellBurns` supersedes it (SCRUM-237).
   */
  readonly newGround?: boolean;
  /** Server-decided: does today continue a streak? */
  readonly streakActive?: boolean;
}

export interface AwardResult {
  readonly band: BandId;
  readonly multiplier: number;
  /** The cell's ground multiplier — ×2.0 on the first burn, decaying to ×1.0. */
  readonly groundMultiplier: number;
  readonly base: number;
  readonly newGroundBonus: number;
  readonly streakBonus: number;
  /** Final, clamped award. This is what the ledger records. */
  readonly award: number;
  readonly clamped: boolean;
  /** A miss returns the offering — never destroyed (S9). */
  readonly rethrow: boolean;
}

export function computeAward(inputs: BurnInputs): AwardResult {
  const band = deriveBand(inputs.offsetPx);
  const multiplier = bandMultiplier(band);

  // A miss earns nothing and mints nothing, even with new ground or a streak.
  if (multiplier === 0) {
    return {
      band,
      multiplier,
      groundMultiplier: 1,
      base: 0,
      newGroundBonus: 0,
      streakBonus: 0,
      award: 0,
      clamped: false,
      rethrow: true,
    };
  }

  // ⚠️ `cellBurns` (1-based, INCLUDES this burn) is authoritative; the boolean
  // is the older shape, where `true` means "the first burn".
  const burnNumber = inputs.cellBurns ?? (inputs.newGround ? 1 : 0);
  const groundMult = burnNumber >= 1 ? groundMultiplier(burnNumber) : 1;

  const base = BASE_AWARD * multiplier;
  const newGroundBonus = base * (groundMult - 1);
  const streakBonus = inputs.streakActive ? STREAK_BONUS : 0;

  const raw = base + newGroundBonus + streakBonus;
  const capped = Math.min(raw, MAX_AWARD);
  // ⚠️ Round the AWARD, but decide `clamped` from the UNROUNDED value — else a
  // fraction reads as a clamp (the same bug the SQL had; SCRUM-237).
  const award = Math.round(capped);

  return {
    band,
    multiplier,
    groundMultiplier: groundMult,
    base,
    newGroundBonus,
    streakBonus,
    award,
    clamped: capped < raw,
    rethrow: false,
  };
}