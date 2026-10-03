/**
 * The three currencies and the one invariant that must never break (doc 10 §3).
 *
 *   photo_credits  in : cash shop · starter grant · sign-in (150/day, 15/mo cap)
 *                  out: the photo fee (150) at CAPTURE time — refunded on failure
 *   tribute        in : burn awards · sign-in store points
 *                  out: store redemption · leaderboard = SUM(weekly tribute)
 *   store          in : the 20% Store-Point accrual (S13d)
 *                  out: store purchases
 *
 * ⚠️ THE WALLET INVARIANT: **burn awards never mint photo credits.**
 * Awards live in `tribute`. Credits come from money + deliberate grants ONLY.
 * This is what keeps the AI-cost model honest: award size has ZERO cost impact,
 * so a generous award cannot bankrupt the pipeline (doc 10 §2).
 */

export const CURRENCIES = ['tribute', 'store', 'credit'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** The Postgres `currency` enum uses `credit`; the UI/spec says `photo_credits`. */
export const CURRENCY_DB_NAME: Record<Currency, string> = {
  tribute: 'tribute',
  store: 'store',
  credit: 'credit',
};

export const PHOTO_FEE_CREDITS = 150;
export const STARTER_GRANT_CREDITS = 2000;
export const DAILY_SIGNIN_STORE_POINTS = 100;
export const DAILY_SIGNIN_CREDITS = 150;
export const FREE_PHOTO_CAP_PER_MONTH = 15;
export const STORE_POINT_ACCRUAL_RATE = 0.2;

/** Ledger event types (`ledger_events.type`, doc 07 §5.3). */
export const LEDGER_TYPES = [
  'award',
  'purchase',
  'accrual',
  'grant',
  'topup',
  'refund',
  'adjustment',
] as const;
export type LedgerType = (typeof LEDGER_TYPES)[number];

/** Ledger events that may legitimately INCREASE photo credits. */
const CREDIT_MINTING_TYPES: readonly LedgerType[] = ['grant', 'topup'];

/**
 * The invariant, as an executable rule the server (and a test) can call.
 * Returns true when a movement is legal.
 *
 * `refund` is allowed to credit: it returns a fee already charged. `adjustment`
 * is allowed because a compensating correction must be able to restore credits —
 * but it requires a `reason` (doc 11 §8), which is enforced at the DB layer.
 */
export function isLegalCreditMovement(type: LedgerType, amount: number): boolean {
  if (amount <= 0) return true; // spending or no-op is always fine
  if (CREDIT_MINTING_TYPES.includes(type)) return true;
  if (type === 'refund') return true;
  if (type === 'adjustment') return true;
  // `award`, `purchase`, `accrual` may NEVER mint credits.
  return false;
}

/** Store-Point accrual on a store purchase (S13d): 20%, floored. */
export function accrualFor(pricePaid: number): number {
  return Math.floor(pricePaid * STORE_POINT_ACCRUAL_RATE);
}

/** Photo credits a capture costs, and whether the fee is refundable on failure. */
export const PHOTO_FEE_REFUNDABLE_ON_FAILURE = true;