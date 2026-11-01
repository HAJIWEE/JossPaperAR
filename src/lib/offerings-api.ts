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
 * Buy one of a catalogue offering with **tribute points**.
 *
 * ⚠️ The idempotency key is required by the RPC, so a retry after a dropped response cannot charge
 * twice — the same reason `submitBurn` mints one per attempt.
 *
 * ⚠️ The server's own failure messages are surfaced as the reason rather than replaced with copy: an
 * insufficient balance and an unknown item are different facts, and the RPC already distinguishes
 * them (`P0001` for the balance, `22023` for the code).
 */
export async function purchaseItem(
  itemCode: string,
  idempotencyKey: string,
): Promise<ApiResult<PurchaseReceipt>> {
  const { data, error } = await supabase().rpc('purchase_item', {
    p_item_code: itemCode,
    p_idempotency_key: idempotencyKey,
  });
  if (error) return { ok: false, reason: error.message ?? 'purchase_failed' };

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
      balanceAfter: num('balance_after'),
    },
  };
}
