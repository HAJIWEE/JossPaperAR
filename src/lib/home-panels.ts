/**
 * home-panels.ts — the tribute and streak panels' PURE rules (SCRUM-161).
 *
 * ── THE ONE RULE THAT MATTERS ───────────────────────────────────────────────
 * ⚠️ **A failed read must NEVER render as `0`.** "0 tribute points" is a claim about the
 * user's history; a failed read is a claim about the network. Rendering the second as the
 * first is a lie the user has no way to detect — and it is the same class as `bookView`
 * (SCRUM-122) showing an empty Book when the server had a problem.
 *
 * ⚠️ So the panel state is three-valued (`loading` · `ready` · `failed`), and `homePanels`
 * is the ONLY place that decides. The screen renders from it; `check:lib` §20 asserts it.
 *
 * ── WHY THE STREAK IS TAKEN AS GIVEN ────────────────────────────────────────
 * ⚠️ The value comes from `streaks.current_days`, which is **server-derived**, and this
 * module does **not** re-derive or decay it. The streak's day maths lives inside
 * `submit_burn` (`streak_local_day`, SCRUM-113) and has bitten twice; a second
 * implementation here would be a third source of truth.
 *
 * ⚠️ **Known behaviour, stated rather than hidden:** the streak is re-evaluated on the
 * **next burn**, not at midnight — so between a missed day and the next burn the stored
 * `current_days` still holds the pre-miss value. Whether the panel should decay it is
 * **SCRUM-153**'s call ("display, never compute"), not this module's.
 */

/** What the server returns. Raw integers — no formatting, no UI decisions. */
export interface HomeSummary {
  /** `sum(tributes.points)` for this user. */
  readonly tribute: number;
  /** `streaks.current_days`, as the server has it. */
  readonly streakDays: number;
}

/**
 * Structurally identical to `ApiResult`, declared locally so this module stays
 * **dependency-free** — importing `clan-api.ts` would drag the Supabase client into
 * `check:lib`, which runs under bare Node.
 */
export type SummaryResult =
  | { readonly ok: true; readonly data: HomeSummary }
  | { readonly ok: false; readonly reason: string };

export type HomePanels =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly tribute: string; readonly streakDays: number }
  | { readonly kind: 'failed'; readonly reason: string };

/**
 * Thousands-separated, exactly as the board inks it (`12,480`).
 *
 * ⚠️ Done by hand, not `toLocaleString`: the grouping is the same in every locale this
 * app ships, and a device with an unusual locale must not change the number's shape.
 */
export function formatPoints(n: number): string {
  const whole = Math.max(0, Math.trunc(n));
  return whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * `null` = not asked yet (loading). A `fail` is a failure, **never** a zero.
 */
export function homePanels(result: SummaryResult | null): HomePanels {
  if (result === null) return { kind: 'loading' };
  if (!result.ok) return { kind: 'failed', reason: result.reason };

  const { tribute, streakDays } = result.data;
  // ⚠️ A non-finite value is a broken payload, not a zero.
  if (!Number.isFinite(tribute) || !Number.isFinite(streakDays)) {
    return { kind: 'failed', reason: 'home_summary_bad_payload' };
  }
  return {
    kind: 'ready',
    tribute: formatPoints(tribute),
    streakDays: Math.max(0, Math.trunc(streakDays)),
  };
}
