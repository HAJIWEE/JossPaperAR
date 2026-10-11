/**
 * league-api.ts — the DEVICE half of the league board (SCRUM-11 step 6).
 *
 * `get_league_board()` is the authority — `supabase/checks/clan-api-contract.mjs`
 * drives it over real PostgREST and asserts every field — so this file decides
 * nothing about the board. It FETCHES it, parses it defensively, and subscribes
 * to the change topic.
 *
 * ⚠️ NO GENERATED DB TYPES. The project has no `supabase gen types` step, so `data`
 * is `unknown` and every field is parsed by hand. A cast here would turn a server
 * change into a silently `undefined` row on a screen — the posture `clan-api.ts`
 * already takes, and the reason `clan-api-contract.mjs` exists at all.
 *
 * ⚠️⚠️ THE LIVE BOARD CANNOT BE A `postgres_changes` SUBSCRIPTION — and that is a
 * real constraint, not a preference. The points in each row come from
 * `ledger_events`, whose RLS is OWN-ROWS-ONLY (`ledger_select_own`), so subscribing
 * there would deliver only YOUR awards: the board would never move for anyone else.
 * That is the worst kind of live feature — one that looks live and is not.
 *
 * So the server BROADCASTS on the topic `league:{cohort_id}` from a trigger on the
 * ledger: a SECURITY DEFINER function may read every member's total, so it can
 * announce "this cohort changed" without the client ever seeing another member's
 * rows. The client's response is to RE-FETCH `get_league_board()`, which runs under
 * its own RLS. The board stays exactly as permissioned as it was, and the payload
 * carries no identity — only the cohort id the subscriber already holds.
 */

import { type ApiResult } from './clan-api.ts';
import {
  LEAGUE_OUTCOMES,
  tierOf,
  type LeagueOutcome,
  type LeagueTier,
} from '../domain/league.ts';
import { supabase } from './supabase.ts';

/**
 * ⚠️ Re-exported, NOT redefined. The vocabulary lives in `domain/league.ts` beside
 * the ladder because the roll engine's `outcome` column and this parser must agree —
 * two copies of a three-word list is precisely how "demoted" becomes "demote" on one
 * side and silently parses as `null` on the other.
 */
export type { LeagueOutcome };

/** One row of the board, in the order the server ranked it. */
export interface LeagueRow {
  /**
   * ⚠️ A DISPLAY LABEL, never a name (doc 13 · doc 15 §8): the board shows
   * `陳氏` / `Chen Family`, not a person. The server is what enforces that; this
   * file only refuses to invent a field it was not given.
   */
  readonly displayLabel: string;
  readonly weeklyPoints: number;
  /** 1-based, from the ledger — NOT the array index (they agree; do not rely on it). */
  readonly rank: number;
  readonly isMe: boolean;
  readonly outcome: LeagueOutcome | null;
}

/**
 * The board. ⚠️ **Every field is nullable-shaped on purpose**: `get_league_board()`
 * returns the SAME key set when there is nothing to show (no open week, or not yet
 * placed), with `cohort_id`/`tier`/`my_rank` as `null` and a `note` explaining why.
 * That is why this interface has no "empty" variant — an absent league is a board
 * with a note, and a screen that special-cased it would be a second code path.
 */
export interface LeagueBoard {
  readonly weekStart: string | null;
  readonly weekEnd: string | null;
  readonly cohortId: string | null;
  readonly cohortNo: number | null;
  /** The rung, 1-based. `null` when the viewer is not placed. */
  readonly tier: number | null;
  readonly rows: readonly LeagueRow[];
  readonly members: number;
  readonly myWeeklyPoints: number;
  /** `null` when the viewer is not placed — the board is still browsable. */
  readonly myRank: number | null;
  /** Server-authored, and already EN. `null` on a normal populated board. */
  readonly note: string | null;
}

/** The viewer's tier, resolved to the vocabulary in `domain/league.ts`. */
export function boardTier(board: LeagueBoard): LeagueTier | undefined {
  return board.tier === null ? undefined : tierOf(board.tier);
}

// ── defensive parsing (no generated types) ────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function numOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function strOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function outcomeOf(value: unknown): LeagueOutcome | null {
  return typeof value === 'string' && (LEAGUE_OUTCOMES as readonly string[]).includes(value)
    ? (value as LeagueOutcome)
    : null;
}

/** One row, or `null` when the payload is not a row at all. */
function rowOf(value: unknown): LeagueRow | null {
  const r = asRecord(value);
  if (!r) return null;
  const displayLabel = str(r.display_label);
  const rank = numOrNull(r.rank);
  if (!displayLabel || rank === null) return null;
  return {
    displayLabel,
    weeklyPoints: num(r.weekly_points),
    rank,
    isMe: r.is_me === true,
    outcome: outcomeOf(r.outcome),
  };
}

/** Normalise the caller's error into something a screen can show. */
function reasonOf(error: unknown): string {
  const record = asRecord(error);
  return str(record?.message) ?? 'league_request_failed';
}

function boardOf(payload: unknown): LeagueBoard | null {
  const r = asRecord(payload);
  if (!r) return null;
  const rows = Array.isArray(r.rows)
    ? r.rows.map(rowOf).filter((x): x is LeagueRow => x !== null)
    : [];
  return {
    weekStart: strOrNull(r.week_start),
    weekEnd: strOrNull(r.week_end),
    cohortId: strOrNull(r.cohort_id),
    cohortNo: numOrNull(r.cohort_no),
    tier: numOrNull(r.tier),
    rows,
    members: num(r.members),
    myWeeklyPoints: num(r.my_weekly_points),
    myRank: numOrNull(r.my_rank),
    note: strOrNull(r.note),
  };
}

// ── the fetch ─────────────────────────────────────────────────────────────

/**
 * The board, as the SERVER ranks it.
 *
 * ⚠️ "You are not placed" is NOT an error. An open week with no placement (or no
 * open week at all) returns a board with an empty `rows` and a `note` saying why —
 * so this resolves `ok: true` and the screen renders the note. Treating it as a
 * failure would make a brand-new user's first look at the league read as broken.
 */
export async function fetchLeagueBoard(): Promise<ApiResult<LeagueBoard>> {
  const { data, error } = await supabase().rpc('get_league_board');
  if (error) return { ok: false, reason: reasonOf(error) };
  const board = boardOf(data);
  return board ? { ok: true, data: board } : { ok: false, reason: 'league_unreadable' };
}

// ── the change topic ──────────────────────────────────────────────────────

/** `league:{cohort_id}` — the topic SCRUM-11 step 6 names, in ONE place. */
export function leagueTopic(cohortId: string): string {
  return `league:${cohortId}`;
}

/** The broadcast event the server trigger emits. */
export const LEAGUE_CHANGED_EVENT = 'board_changed';

/**
 * Subscribe to a cohort's changes. **Returns the unsubscribe.**
 *
 * ⚠️ A screen that forgets to call it leaks a socket per focus, and a board the user
 * returns to every week is exactly where that turns into "Realtime stopped working"
 * — which is really "too many channels". The caller owns the lifetime.
 *
 * ⚠️ Broadcast, not `postgres_changes` — see the file header. The client learns only
 * that the cohort moved and then re-fetches under its own RLS, so this subscription
 * can never show a row the user is not entitled to.
 */
export function subscribeToLeagueBoard(
  cohortId: string,
  onBoardChanged: () => void,
): () => void {
  const channel = supabase()
    .channel(leagueTopic(cohortId))
    .on('broadcast', { event: LEAGUE_CHANGED_EVENT }, () => {
      onBoardChanged();
    })
    .subscribe();

  return () => {
    void supabase().removeChannel(channel);
  };
}
