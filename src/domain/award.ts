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
export const NEW_GROUND_MULTIPLIER = 2.0;
export const STREAK_BONUS = 50;
export const MAX_AWARD = 1650;

export interface BurnInputs {
  /** Distance in px from the fire's heart — CLIENT-ASSERTED, accepted with caps. */
  readonly offsetPx: number;
  /** Server-decided: has this user burned in this coarse cell before today? */
  readonly newGround?: boolean;
  /** Server-decided: does today continue a streak? */
  readonly streakActive?: boolean;
}

export interface AwardResult {
  readonly band: BandId;
  readonly multiplier: number;
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
      base: 0,
      newGroundBonus: 0,
      streakBonus: 0,
      award: 0,
      clamped: false,
      rethrow: true,
    };
  }

  const base = BASE_AWARD * multiplier;
  const newGroundBonus = inputs.newGround ? base * (NEW_GROUND_MULTIPLIER - 1) : 0;
  const streakBonus = inputs.streakActive ? STREAK_BONUS : 0;

  const raw = base + newGroundBonus + streakBonus;
  const award = Math.min(raw, MAX_AWARD);

  return {
    band,
    multiplier,
    base,
    newGroundBonus,
    streakBonus,
    award,
    clamped: award < raw,
    rethrow: false,
  };
}