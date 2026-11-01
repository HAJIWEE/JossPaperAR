/**
 * account-api.ts — the account-level RPCs (SCRUM-151).
 *
 * ── ⚠️ `delete_my_data` HAS EXISTED SINCE PR-2 AND NOTHING CALLED IT ─────────
 * Measured 2026-11-01: the RPC is `SECURITY DEFINER`, cascades every personal table, tombstones the
 * pseudonymous `integrity_flags` rows and **verifies zero rows before returning** — and `src/` had no
 * reference to it. ADR-007's one-tap delete, the promise the privacy posture rests on, was unbuilt.
 *
 * ── ⚠️ WHAT THE RPC DOES *NOT* DO: REMOVE THE AUTH USER ──────────────────────
 * Its own payload says so — *"the auth.users row is not removed by SQL — that needs the Admin API"*.
 * So after a successful delete the session still exists with **no `profiles` row**, and
 * `ensureAnonymousSession()` would REUSE it (it only signs in when there is no session at all).
 * ⚠️ That is why `resetIdentity()` signs out first: without it, "back to first run" would leave the
 * device holding a profile-less identity, and the next write would fail on a missing row.
 */

import type { ApiResult } from './clan-api.ts';
import { ensureAnonymousSession } from './session.ts';
import { supabase } from './supabase.ts';

/** What `delete_my_data` reports back. ⚠️ `verifiedZeroRows` is the SERVER's own check, not ours. */
export interface DeleteReceipt {
  /** ⚠️ The RPC counts every personal table AFTER the delete; `false` means it left something. */
  readonly verifiedZeroRows: boolean;
  readonly rowsLeftBehind: number;
}

/**
 * Erase everything this device's identity owns.
 *
 * ⚠️ The rate limit is the SERVER's (1 attempt / 10 min / user, doc 13 §9.1) and it raises `P0001`
 * with its own message. The caller surfaces the reason rather than inventing copy for it — a second
 * attempt inside ten minutes is a different fact from a failed delete.
 */
export async function deleteMyData(): Promise<ApiResult<DeleteReceipt>> {
  const { data, error } = await supabase().rpc('delete_my_data');
  if (error) return { ok: false, reason: reasonOf(error) };

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    data: {
      /** ⚠️ Absent reads as `false`: an unverifiable delete must not be reported as verified. */
      verifiedZeroRows: row.verified_zero_rows === true,
      rowsLeftBehind: typeof row.rows_left_behind === 'number' ? row.rows_left_behind : -1,
    },
  };
}

/**
 * Sign out and mint a FRESH anonymous identity — what "back to first run" means.
 *
 * ⚠️ The order is the point: `signOut` THEN `ensureAnonymousSession`. Reusing the old session would
 * leave the device on an identity whose `profiles` row the delete just removed.
 */
export async function resetIdentity(): Promise<ApiResult<null>> {
  try {
    await supabase().auth.signOut();
  } catch {
    // A failed sign-out is not fatal — `ensureAnonymousSession` reuses whatever session remains,
    // and the caller reports the delete's own outcome rather than this one.
  }
  const next = await ensureAnonymousSession();
  return next.ok ? { ok: true, data: null } : { ok: false, reason: next.reason };
}

/** The same shape `clan-api.ts` uses — a stable reason, never a thrown error. */
function reasonOf(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return 'request_failed';
}

/**
 * One row of the caller's own offering history — `EN · 8c History`.
 *
 * ⚠️ The RPC returns the burn's **STORED** band and award, never a re-derivation: recomputing the
 * award from the band would silently rewrite history the moment a multiplier changes.
 * ⚠️ `itemCode` is a CATALOGUE code, not a name — the screen resolves it through `OFFERINGS`, so a
 * name or a glyph is never baked into a row.
 */
export interface OfferingRow {
  readonly burnId: string;
  /** `null` for a photo offering — `burns` holds exactly one of `item_code` / `capture_id`. */
  readonly itemCode: string | null;
  /** The `aim_band` enum as text: `bullseye` · `devout` · `graze` · `miss`. */
  readonly band: string;
  readonly points: number;
  readonly burnedAt: string;
}

/** The History screen's THIS WEEK block. ⚠️ A trailing 7 days — see the migration's note. */
export interface OfferingWeek {
  readonly burned: number;
  readonly tribute: number;
  readonly streakDays: number;
}

/**
 * The caller's own offerings, newest first.
 *
 * ⚠️ An EMPTY ARRAY here is a real answer ("you have burned nothing"), not a permission failure —
 * the RPC raises `42501` when there is no identity, so the two cannot be confused. That distinction
 * is the whole reason this is a `SECURITY DEFINER` read rather than a table select: `burns` has RLS
 * on with **no policy**, so a plain select would return `[]` with no error and the screen would
 * report "nothing here yet" to a user who has a hundred rows.
 */
export async function myOfferings(limit = 50): Promise<ApiResult<OfferingRow[]>> {
  const { data, error } = await supabase().rpc('my_offerings', { p_limit: limit });
  if (error) return { ok: false, reason: reasonOf(error) };

  const rows = Array.isArray(data) ? data : [];
  const out: OfferingRow[] = [];
  for (const value of rows) {
    const row = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
    if (row === null) continue;
    const burnId = typeof row.burn_id === 'string' ? row.burn_id : null;
    /** ⚠️ A row with no id or no band is one the server cannot have written — skip, do not render. */
    if (burnId === null || typeof row.band !== 'string') continue;
    out.push({
      burnId,
      itemCode: typeof row.item_code === 'string' && row.item_code.length > 0 ? row.item_code : null,
      band: row.band,
      points: typeof row.points === 'number' && Number.isFinite(row.points) ? row.points : 0,
      burnedAt: typeof row.burned_at === 'string' ? row.burned_at : '',
    });
  }
  return { ok: true, data: out };
}

/**
 * The caller's burns and award over the TRAILING 7 DAYS, plus the stored streak.
 *
 * ⚠️ A SEPARATE CALL, not a fold of `myOfferings()`: the client only holds a page, so a week with
 * more rows than `p_limit` would report a total smaller than the list beneath it.
 */
export async function myOfferingsWeek(): Promise<ApiResult<OfferingWeek>> {
  const { data, error } = await supabase().rpc('my_offerings_week');
  if (error) return { ok: false, reason: reasonOf(error) };

  /**
   * ⚠️⚠️ **A `returns table (…)` FUNCTION COMES BACK AS AN ARRAY OF ROWS** — even though this one
   * always returns exactly one. Reading it as an object yields `undefined` for every field, and the
   * `?? 0` below then renders **"0 burned · 0 tribute"** over a real week. ⚠️ `tsc` cannot see it
   * (there are no generated types) — **`check:clanapi` §12 caught it**, which is what that file is
   * for. `my_offerings` was already an array and was fine; this one was not.
   */
  const rows = Array.isArray(data) ? data : [];
  const first = rows.length > 0 ? rows[0] : null;
  const row = typeof first === 'object' && first !== null ? (first as Record<string, unknown>) : null;

  const at = (key: string): number => {
    const value = row?.[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  };
  return { ok: true, data: { burned: at('burned'), tribute: at('tribute'), streakDays: at('streak_days') } };
}

/**
 * One row of the Collection grid — `EN · 8 Collection`.
 *
 * ⚠️ `itemCode` is a CATALOGUE code, not a name: the screen resolves it through `OFFERINGS`, so a
 * name or a glyph is never baked into a row (the rule `OfferingRow` records).
 */
export interface CollectionItem {
  readonly itemCode: string;
  /** ⚠️ A live `count(*)` from the server — never a tally the client keeps. */
  readonly burned: number;
  readonly lastBurnedAt: string;
}

/** The two stat cards above the grid. ⚠️ `itemsCollected` counts CATALOGUE items only. */
export interface CollectionTotals {
  readonly offeringsBurned: number;
  readonly itemsCollected: number;
}

/**
 * The caller's own burns, grouped by catalogue item, most-burned first.
 *
 * ⚠️ **CATALOGUE ITEMS ONLY.** A burn is either a catalogue item or a photo (`burns` XOR-enforces
 * it); the board draws item art, not thumbnails, so the server excludes the photo burns. A caller
 * who only burns photos therefore gets `[]` and `itemsCollected: 0` — which is TRUE, not a failure.
 * ⚠️ That is also why the RPC raises `42501` when there is no identity: an empty grid and "you are
 * not signed in" must not render identically.
 */
export async function myCollection(): Promise<ApiResult<CollectionItem[]>> {
  const { data, error } = await supabase().rpc('my_collection');
  if (error) return { ok: false, reason: reasonOf(error) };

  /** ⚠️ A `returns table (…)` RPC arrives as an ARRAY — see `myOfferingsWeek`'s note. */
  const rows = Array.isArray(data) ? data : [];
  const out: CollectionItem[] = [];
  for (const value of rows) {
    const row = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
    if (row === null) continue;
    const itemCode = typeof row.item_code === 'string' ? row.item_code : null;
    /** ⚠️ A row with no code is one the server cannot have written — skip, do not render. */
    if (itemCode === null || itemCode.length === 0) continue;
    const burned = typeof row.burned === 'number' && Number.isFinite(row.burned) ? row.burned : 0;
    /** ⚠️ A zero count is not a collected item — the grid's own rule, so it cannot show "×0". */
    if (burned <= 0) continue;
    out.push({
      itemCode,
      burned,
      lastBurnedAt: typeof row.last_burned_at === 'string' ? row.last_burned_at : '',
    });
  }
  return { ok: true, data: out };
}

/**
 * The two stat cards above the Collection grid.
 *
 * ⚠️ A SEPARATE CALL, not a fold of `myCollection()`: `itemsCollected` happens to equal the grid's
 * row count, but `offeringsBurned` counts **every** burn — including the photo burns the grid
 * deliberately omits. Deriving one from the other would silently equate them.
 */
export async function myCollectionTotals(): Promise<ApiResult<CollectionTotals>> {
  const { data, error } = await supabase().rpc('my_collection_totals');
  if (error) return { ok: false, reason: reasonOf(error) };

  /** ⚠️ The same array-vs-object trap `myOfferingsWeek` documents. */
  const rows = Array.isArray(data) ? data : [];
  const first = rows.length > 0 ? rows[0] : null;
  const row = typeof first === 'object' && first !== null ? (first as Record<string, unknown>) : null;

  const at = (key: string): number => {
    const value = row?.[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  };
  return {
    ok: true,
    data: { offeringsBurned: at('offerings_burned'), itemsCollected: at('items_collected') },
  };
}


