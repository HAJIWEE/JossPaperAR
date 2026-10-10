/**
 * Burn limits — which ARE the AI-cost control (doc 10 §1, doc 07 §6).
 *
 * Per USER (never per clan — a user's quotas are shared across every clan they
 * belong to, doc 15 §5.2). The server is authoritative; the client only displays
 * the last known state.
 */

export const DAILY_PHOTO_BURNS = 10;
export const DAILY_STORE_BURNS = 20;

/** Integrity caps (doc 11 §2) — the ceiling a tampered client cannot exceed. */
export const MAX_AWARD_PER_BURN = 1650;
export const MAX_AWARD_PER_DAY = 49500;
export const MAX_BURNS_PER_MINUTE = 6;

export type BurnKind = 'photo' | 'store';

export interface QuotaState {
  readonly day: string; // ISO date, UTC
  readonly photoBurnsUsed: number;
  readonly storeBurnsUsed: number;
  readonly aiSpendMicros: number;
}

export const EMPTY_QUOTA = (day: string): QuotaState => ({
  day,
  photoBurnsUsed: 0,
  storeBurnsUsed: 0,
  aiSpendMicros: 0,
});

export function dailyLimit(kind: BurnKind): number {
  return kind === 'photo' ? DAILY_PHOTO_BURNS : DAILY_STORE_BURNS;
}

export function burnsUsed(state: QuotaState, kind: BurnKind): number {
  return kind === 'photo' ? state.photoBurnsUsed : state.storeBurnsUsed;
}

/** Quota is per (user, day). A new day resets — so the caller must pass today. */
export function hasQuota(state: QuotaState, kind: BurnKind, today: string): boolean {
  if (state.day !== today) return true; // new day → fresh allowance
  return burnsUsed(state, kind) < dailyLimit(kind);
}

export function remaining(state: QuotaState, kind: BurnKind, today: string): number {
  if (state.day !== today) return dailyLimit(kind);
  return Math.max(0, dailyLimit(kind) - burnsUsed(state, kind));
}

/** The quota copy the UI shows once the allowance is spent (doc 10 §4, EN). */
export const QUOTA_SPENT_COPY = {
  en: "Today's offerings are complete. Return tomorrow.",
  zh: '今日的供奉已圆满，明日再续。',
} as const;