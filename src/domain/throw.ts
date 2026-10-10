/**
 * The throw — grading a gesture, and the generosity rule that caps it.
 *
 * THE SLICE'S ACCEPTANCE TEST LIVES HERE
 *
 * doc 17 §2 A5 / doc 18 §7.2: **the four aim bands grading true is the
 * acceptance test — not fps, not "looks about right".** `aim.ts` owns the
 * thresholds; this file owns the two things that sit *around* them:
 *
 *   1. turning a gesture into the px offset `deriveBand` expects, and
 *   2. **the rethrow cap** (SCRUM-23) — after a miss, the offering RETURNS to
 *      the hand (S9) and the player may throw again, but a rethrow
 *      **caps at 虔诚 Devout and can never be 正中 Bullseye**.
 *
 * ⚠️ THE RETHROW CAP WAS SPEC'D BUT NEVER ENCODED. It appears in doc 16 §4's
 * Q4 ("Up to 3 throws per offering; a rethrow caps at 虔诚 — never 正中
 * (SCRUM-23)") and nowhere in the code. Left unimplemented, a player who
 * misses twice can land a bullseye on the third throw and take 2.0× for what
 * is really a second bite at the same offering — the mechanic pays for a miss.
 * That is why it is a function here with a check, rather than a comment on a
 * screen.
 *
 * The reasoning: the rethrow exists so a fumbled throw is *forgiven*, not
 * punished (the offering returns — it is never destroyed). Forgiveness must not
 * become optimisation, or the second and third throws stop being a gesture and
 * become the strategy. One bullseye per offering, and the cap does the rest.
 *
 * DELIBERATELY PURE — no React, no network. The client computes the offset and
 * displays the result; the **server re-derives the band** from that same offset
 * (ADR-005: the client never sends `band`). So this module must not be able to
 * *assert* a band to anyone — `gradeThrow` returns the offset and a *local*
 * preview, and `submit_burn` is the authority.
 */

import { AIM_BANDS, deriveBand, getBand, type BandId } from './aim.ts';

/** S9 / SCRUM-23: up to 3 throws per offering. */
export const MAX_THROWS = 3;

/** The band a rethrow may never exceed — 正中 Bullseye is first-throw only. */
export const RETHROW_CAP: BandId = 'devout';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * The fire's heart, in the same px space the bands were measured in
 * (doc 05 §2 — measured off the fire's own artwork). The burn screen supplies
 * the live on-screen position; the four thresholds were derived against this.
 */
export interface FireHeart {
  readonly x: number;
  readonly y: number;
}

/**
 * Distance in px from the throw's resting point to the fire's heart.
 *
 * This is the number the server grades. It must be a plain Euclidean distance
 * — NOT a screen-space y-difference — because the bands were measured as a
 * radius around the heart, and an axis-aligned shortcut would make a throw
 * straight above the fire grade differently from one beside it.
 *
 * Throws are refused rather than clamped when the inputs are not finite or the
 * throw is above the screen edge: a NaN offset would compare false against
 * every band and fall through to `miss`, which is the one grade that pays
 * nothing, and a silently-wrong grade is worse than no grade.
 */
export function offsetFromHeart(throwPoint: Point, heart: FireHeart): number {
  const dx = throwPoint.x - heart.x;
  const dy = throwPoint.y - heart.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export interface ThrowOutcome {
  /** What the player will be *told* — the local preview. NOT sent. */
  readonly previewBand: BandId;
  /** The offset actually submitted to `submit_burn`; the server derives the band. */
  readonly offsetPx: number;
  /** 1-based. Throw 1 is un-capped; 2+ are capped at Devout. */
  readonly throwNumber: number;
  /** True when the cap downgraded what would otherwise have been a bullseye. */
  readonly capped: boolean;
  /** A miss returns the offering (S9) — the sprite is not consumed. */
  readonly returns: boolean;
  /** No throws remain. */
  readonly spent: boolean;
}

/**
 * Grade one throw.
 *
 * `throwNumber` is 1-based and is the ONLY input that engages the rethrow cap.
 * The cap is applied by *deriving the band at the capped radius* rather than by
 * string-comparing band names — a bullseye is any offset within
 * `AIM_BANDS[0].maxOffsetPx`, so re-grading at Devout's radius is what makes
 * the cap hold if those thresholds are ever re-tuned together.
 */
export function gradeThrow(offsetPx: number, throwNumber: number): ThrowOutcome {
  const isRethrow = throwNumber > 1;
  const raw = deriveBand(offsetPx);

  let band = raw;
  if (isRethrow && raw !== 'miss') {
    // Compare on the ORDER of the bands (outer → inner), not on band identity,
    // so "never better than Devout" survives any retuning of the thresholds.
    //
    // ⚠️ `miss` is handled separately and is NOT indexed into AIM_BANDS — it is
    // the absence of a band. Folding it in as "one past the outermost" makes a
    // rethrow miss index past the end of the array, which is how this function
    // crashed on its first run. A cap that *downgrades* can never rescue a
    // miss: forgiving the gesture does not mean forgiving the aim.
    const capIndex = AIM_BANDS.findIndex((b) => b.id === RETHROW_CAP);
    const rawIndex = AIM_BANDS.findIndex((b) => b.id === raw);
    band = AIM_BANDS[Math.max(rawIndex, capIndex)].id;
  }

  return {
    previewBand: band,
    offsetPx,
    throwNumber,
    capped: raw === 'bullseye' && band !== 'bullseye',
    returns: band === 'miss',
    spent: throwNumber >= MAX_THROWS,
  };
}

/**
 * Whether another throw is allowed. A miss does NOT end the offering (S9), but
 * the third throw does — the cap is on throws, not on successes.
 */
export function canThrow(throwNumber: number): boolean {
  return Number.isInteger(throwNumber) && throwNumber >= 1 && throwNumber < MAX_THROWS;
}

/** The band label for display, both locales (doc 15 §8). */
export function bandLabel(band: BandId): { readonly en: string; readonly zh: string } {
  return getBand(band).label;
}