/**
 * The offerings API — the INVENTORY read and the purchase (SCRUM-149 · SCRUM-150).
 *
 * ⚠️⚠️ **`inventory` IS THE ONE ECONOMY TABLE THE CLIENT MAY SELECT DIRECTLY.** Unlike `burns`,
 * `tributes` and `ledger_events` — all RLS-on with **no policy**, hence the `SECURITY DEFINER` reads
 * this project keeps having to add — `inventory` carries `inventory_select_own`
 * (`20261003085500_slice_schema.sql:490`). So the picker needs **no migration**, and a plain select
 * returns the caller's own rows and nothing else.
 *
 * ⚠️ **A purchase is NOT a client-writable table.** `purchase_item` is `SECURITY DEFINER` and
 * re-reads the price from the catalogue server-side, so a tampered client cannot set its own price
 * (`domain/catalogue.ts` records that rule). The client only names the CODE.
 */

import type { ApiResult } from './clan-api.ts';
import { supabase } from './supabase.ts';

/** How many of each catalogue item the caller owns. ⚠️ Absent = zero, never a fabricated 1. */
export type Inventory = Readonly<Record<string, number>>;

/**
 * The caller's own inventory, as `code → qty`.
 *
 * ⚠️ An EMPTY object is a real answer ("you own nothing"), and it is distinguishable from a failure
 * because a failure is reported as one — the rule every read in this project follows.
 * ⚠️ Rows with a non-positive or non-finite `qty` are dropped: a zero row is not an owned item, and
 * the picker must not offer a burn it cannot afford.
 */
export async function myInventory(): Promise<ApiResult<Inventory>> {
  const { data, error } = await supabase().from('inventory').select('item_code, qty');
  if (error) return { ok: false, reason: error.message ?? 'inventory_failed' };

  const out: Record<string, number> = {};
  const rows = Array.isArray(data) ? data : [];
  for (const value of rows) {
    const row = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
    if (row === null) continue;
    const code = typeof row.item_code === 'string' ? row.item_code : null;
    const qty = typeof row.qty === 'number' && Number.isFinite(row.qty) ? Math.floor(row.qty) : 0;
    if (code === null || code.length === 0 || qty <= 0) continue;
    out[code] = qty;
  }
  return { ok: true, data: out };
}

/** What `purchase_item` reports back. ⚠️ The server's own numbers, never recomputed here. */
export interface PurchaseReceipt {
  readonly itemCode: string;
  readonly price: number;
  readonly balanceAfter: number;
}

/**
 * ⚠️⚠️ **A REFUSAL THE SERVER TYPED** (SCRUM-242). `purchase_item` puts a machine-readable reason in
 * Postgres `DETAIL` as JSON, which PostgREST returns as `error.details`:
 *
 *   {"refusal":"insufficient_funds","needed":400,"available":0,"short_by":400}
 *
 * ⚠️ **The client maps THIS, never the message sentence.** That is the whole point of the migration: a
 * reworded `raise` must not silently degrade the copy, which is exactly what string-matching the prose
 * would do. ⚠️ The prose is still carried in `reason` for logs — it is simply never rendered.
 */
/**
 * ⚠️ **`PurchaseRefusal` and `parseRefusal` MOVED to `purchase-refusal.ts`** (SCRUM-242) — a module that
 * imports nothing, because `checks/run.ts` runs under plain Node and importing THIS file drags in the
 * Supabase client (`react-native-url-polyfill`) and **crashes the suite**. Re-exported so callers keep one
 * import site.
 */
import { parseRefusal, type PurchaseRefusal } from './purchase-refusal.ts';
export { parseRefusal, type PurchaseRefusal };

/** `PurchaseResult` — the shared `ApiResult` plus the typed refusal, which `ApiResult` has no room for. */
export type PurchaseResult =
  | { readonly ok: true; readonly data: PurchaseReceipt }
  | { readonly ok: false; readonly reason: string; readonly refusal: PurchaseRefusal | null };

/**
 * ⚠️ The parser, its kind list and the `PurchaseRefusal` union all live in `purchase-refusal.ts` now — the
 * re-export above is the only copy. Nothing here may re-implement them: two parsers is how one of them ends
 * up not knowing a kind the server sends.
 */

/**
 * Buy one of a catalogue offering with **tribute points**.
 *
 * ⚠️ The idempotency key is required by the RPC, so a retry after a dropped response cannot charge
 * twice — the same reason `submitBurn` mints one per attempt.
 *
 * ⚠️⚠️ **THE SERVER'S PROSE IS NEVER RENDERED** (SCRUM-242). Until 2026-11-21 this returned
 * `error.message` and the screen printed it, so a 中文 player buying with too few points read
 * *"not enough tribute: 2000 needed, 0 available"* in red English. Now the RPC puts a typed reason in
 * `DETAIL`, this parses it into `refusal`, and the caller renders LOCALISED copy — falling back to its
 * own generic line when the refusal is `null`, because an unexplained database message is not copy.
 */
export async function purchaseItem(
  itemCode: string,
  idempotencyKey: string,
): Promise<PurchaseResult> {
  const { data, error } = await supabase().rpc('purchase_item', {
    p_item_code: itemCode,
    p_idempotency_key: idempotencyKey,
  });
  if (error) {
    return {
      ok: false,
      /** ⚠️ Carried for logs and diagnostics ONLY — no screen renders this string. */
      reason: error.message ?? 'purchase_failed',
      refusal: parseRefusal((error as { details?: unknown }).details),
    };
  }

  const row = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  const num = (key: string): number => {
    const v = row[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  };
  return {
    ok: true,
    data: {
      itemCode: typeof row.item_code === 'string' ? row.item_code : itemCode,
      price: num('price'),
      /**
       * ⚠️ **`balance`, not `balance_after`.** `purchase_item` returns the key
       * **`balance`** (`20261004094000_purchase_item_balances_fix.sql:124`) — this read
       * used to ask for `balance_after`, a key the RPC has never sent, so
       * `balanceAfter` was **always 0**. Nothing renders it yet, which is why it went
       * unnoticed; it would have read as *"you have nothing left"* the moment something did.
       */
      balanceAfter: num('balance'),
    },
  };
}
