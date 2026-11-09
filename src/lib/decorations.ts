/**
 * decorations.ts — the DEVICE half of shrine customisation (SCRUM-204).
 *
 * ── ⚠️ THE SERVER WAS ALREADY BUILT; NOTHING ON THE CLIENT WAS ───────────────
 * `equip_decoration(p_slot, p_item_code)` has existed since migration `20261004091500` and is thorough: it checks
 * the slot is one of the six, that the decoration's `slot_category` MATCHES the slot's, that the caller OWNS it in
 * `inventory`, then **clears the other slot in the same category** (one set per category, doc 07 §4.5 / S14j /
 * S14k) before upserting. ⚠️ So this file calls it and never re-implements one line of that rule — a client-side
 * copy of a server rule is a second opinion, and the server wins.
 *
 * ── ⚠️ READS ARE RLS, NOT AN RPC ────────────────────────────────────────────
 * `equipped_decorations` carries `equipped_select_own` (`user_id = auth.uid()`), so PostgREST can read the caller's
 * own rows directly. ⚠️ A `SECURITY DEFINER` reader here would add privilege where none is needed — the same
 * reasoning `user-profile.ts` records for `profiles`.
 *
 * ⚠️ No React, no storage — the rules live in `domain/catalogue.ts` and this only moves bytes.
 */

import type { ApiResult } from './clan-api.ts';
import {
  DECORATIONS,
  DECORATION_SLOTS,
  type DecorationCode,
  type DecorationSlot,
  type DecorationSlotCategory,
} from '@/domain/catalogue';
import { supabase } from './supabase.ts';

/**
 * ⚠️ **The catalogue is the authority on a decoration's CATEGORY, not the row.** `inventory` carries
 * `(user_id, item_code, qty)` and nothing else — selecting a `category` from it would fail at runtime with a
 * column that does not exist, and inventing one client-side would be a second opinion. Built ONCE.
 *
 * ⚠️ **A COMPOSED SKU IS EXCLUDED** (`festive_set`): it has a `category` in the catalogue because it is a SKU,
 * but it is never an altarpiece — `purchase_item` grants its four components and never a row for the set. So a
 * stray inventory row must not read as "you own a decoration you cannot place".
 */
const CATEGORY_BY_CODE: ReadonlyMap<string, DecorationSlotCategory> = new Map(
  DECORATIONS.filter((d) => d.composedOf === undefined).map((d) => [d.code as string, d.category]),
);

/** One owned decoration: the code, **how many**, and **which category** — the picker needs all three. */
export interface OwnedDecoration {
  readonly code: DecorationCode;
  /** ⚠️ From `inventory.qty`. Kept — it was selected and thrown away until 2026-11-09. */
  readonly qty: number;
  /** ⚠️ From the CATALOGUE (see `CATEGORY_BY_CODE`), never from the row. */
  readonly category: DecorationSlotCategory;
}

/** What the shrine needs: what the caller OWNS, and what is currently ON the altar. */
export interface MyDecorations {
  /** ⚠️ Only codes with `qty >= 1` — an item owned zero times cannot be equipped. Derived from `items`, so the
   * two can never disagree. */
  readonly owned: readonly DecorationCode[];
  /** ⚠️ **`code · qty · category` per owned item** — SCRUM-204's own acceptance criterion. */
  readonly items: readonly OwnedDecoration[];
  /** ⚠️ A slot with nothing in it is `null`, not absent: the screen draws six positions either way. */
  readonly equipped: Readonly<Record<DecorationSlot, DecorationCode | null>>;
}

const EMPTY_EQUIPPED: Record<DecorationSlot, DecorationCode | null> = {
  top_left: null,
  top_middle: null,
  top_right: null,
  side_left: null,
  side_right: null,
  background: null,
};

export async function readMyDecorations(): Promise<ApiResult<MyDecorations>> {
  const client = supabase();

  /**
   * ⚠️ TWO READS IN PARALLEL, and a failure of EITHER is a failure of the whole: a screen that knows what is
   * equipped but not what is owned would offer decorations the person cannot place.
   */
  const [owned, equipped] = await Promise.all([
    client.from('inventory').select('item_code, qty').gte('qty', 1),
    client.from('equipped_decorations').select('slot, item_code'),
  ]);
  const error = owned.error ?? equipped.error;
  if (error) return { ok: false, reason: reasonOf(error) };

  /**
   * ⚠️ **`items` IS BUILT FIRST AND `owned` IS DERIVED FROM IT** — two lists assembled side by side would
   * eventually disagree, and the screen would offer a decoration the picker thinks you do not have.
   *
   * ⚠️ A row is DROPPED, never cast in, when: the code is not a string, the code is not in the catalogue
   * (`CATEGORY_BY_CODE`), or the qty is not a positive finite number. ⚠️ `qty >= 1` repeats the query's own
   * `gte` on purpose — that is a sanity floor on data the client is about to draw, not a re-implementation of a
   * SERVER rule (which is the thing this file refuses to duplicate).
   */
  const items: OwnedDecoration[] = [];
  for (const row of owned.data ?? []) {
    const code = (row as { item_code?: unknown }).item_code;
    const qty = (row as { qty?: unknown }).qty;
    if (typeof code !== 'string') continue;
    const category = CATEGORY_BY_CODE.get(code);
    if (category === undefined) continue;
    if (typeof qty !== 'number' || !Number.isFinite(qty) || qty < 1) continue;
    items.push({ code: code as DecorationCode, qty, category });
  }
  const ownedCodes = items.map((i) => i.code);

  const equippedMap: Record<DecorationSlot, DecorationCode | null> = { ...EMPTY_EQUIPPED };
  for (const row of equipped.data ?? []) {
    const slot = (row as { slot?: unknown }).slot;
    const code = (row as { item_code?: unknown }).item_code;
    // ⚠️ Unknown slots/codes are DROPPED rather than cast in: the catalogue is the authority on both, and a row
    // the client cannot name is a row it must not draw.
    if (typeof slot === 'string' && (DECORATION_SLOTS as readonly string[]).includes(slot)) {
      if (typeof code === 'string') equippedMap[slot as DecorationSlot] = code as DecorationCode;
    }
  }

  return { ok: true, data: { owned: ownedCodes, items, equipped: equippedMap } };
}

/**
 * Place a decoration in a slot.
 *
 * ⚠️ **NO CLIENT-SIDE VALIDATION OF THE SLOT RULE, DELIBERATELY.** `equip_decoration` already refuses a
 * category mismatch, an unowned item and an unknown slot, with distinct messages. ⚠️ Re-checking here would mean
 * two implementations of one rule, and the day they disagree the screen refuses something the server allows — the
 * class of bug this project keeps deleting.
 */
export async function equipDecoration(
  slot: DecorationSlot,
  code: DecorationCode,
): Promise<ApiResult<readonly { slot: string; item_code: string }[]>> {
  const { data, error } = await supabase().rpc('equip_decoration', { p_slot: slot, p_item_code: code });
  if (error) return { ok: false, reason: reasonOf(error) };
  const equipped = (data as { equipped?: unknown } | null)?.equipped;
  return {
    ok: true,
    data: Array.isArray(equipped) ? (equipped as { slot: string; item_code: string }[]) : [],
  };
}

/** The same shape `clan-api.ts` uses — a stable reason, never a thrown error. */
function reasonOf(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return 'request_failed';
}
