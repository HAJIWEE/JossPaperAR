/**
 * The aim bands — the number this whole MVP is graded on.
 *
 * THE ACCEPTANCE TEST OF THE SLICE IS THESE FOUR BANDS, NOT FPS.
 * (doc 17 §2 A5 / doc 18 §7.2 — the prototype's `aim-check.js` is the pattern.)
 *
 * The thresholds are NOT invented: they were MEASURED OFF THE FIRE'S OWN ARTWORK
 * in the prototype (doc 05 §2), in the same pixel space the throw is graded in.
 * Offset = the distance in px between the throw's resting point and the fire's
 * heart. A smaller offset is a better throw.
 *
 *   正中 Bullseye  ±14.55  → ×2.0
 *   虔誠 Devout    ±39.40  → ×1.5
 *   擦邊 Graze     ±96.97  → ×1.0
 *   偏失 Miss      beyond  → ×0     (the offering RETURNS — S9; never destroyed)
 *
 * ⚠️ THE CLIENT MUST NOT SEND `band`. It sends `accuracy` (the offset); the
 * server derives the band with THIS function (ADR-005, doc 07 §4.3). This module
 * is intentionally free of React and of the network so both sides can import it.
 */

export const BAND_IDS = ['bullseye', 'devout', 'graze', 'miss'] as const;
export type BandId = (typeof BAND_IDS)[number];

export interface AimBand {
  readonly id: BandId;
  /** Maximum offset (px from the fire's heart) that still earns this band. */
  readonly maxOffsetPx: number;
  /** The award multiplier. 0 for a miss. */
  readonly multiplier: number;
  readonly label: { readonly en: string; readonly zh: string };
}

/** Outer bands first is the natural reading order; `deriveBand` walks inward. */
export const AIM_BANDS: readonly AimBand[] = [
  {
    id: 'bullseye',
    maxOffsetPx: 14.55,
    multiplier: 2.0,
    label: { en: 'Bullseye', zh: '正中' },
  },
  {
    id: 'devout',
    maxOffsetPx: 39.4,
    multiplier: 1.5,
    label: { en: 'Devout', zh: '虔誠' },
  },
  {
    id: 'graze',
    maxOffsetPx: 96.97,
    multiplier: 1.0,
    label: { en: 'Graze', zh: '擦邊' },
  },
] as const;

export const MISS_BAND: AimBand = {
  id: 'miss',
  maxOffsetPx: Number.POSITIVE_INFINITY,
  multiplier: 0,
  label: { en: 'Miss', zh: '偏失' },
} as const;

export function getBand(id: BandId): AimBand {
  return id === 'miss' ? MISS_BAND : AIM_BANDS.find((b) => b.id === id)!;
}

/**
 * Grade a throw. `offsetPx` must be a finite, non-negative distance.
 * Bands are inclusive at the boundary (±14.55 is a bullseye).
 */
export function deriveBand(offsetPx: number): BandId {
  if (!Number.isFinite(offsetPx) || offsetPx < 0) {
    throw new RangeError(`offsetPx must be a finite, non-negative number (got ${offsetPx})`);
  }
  for (const band of AIM_BANDS) {
    if (offsetPx <= band.maxOffsetPx) return band.id;
  }
  return 'miss';
}

export function bandMultiplier(id: BandId): number {
  return getBand(id).multiplier;
}

/** True when the offering returns to the player rather than burning (S9). */
export function isRethrow(id: BandId): boolean {
  return id === 'miss';
}