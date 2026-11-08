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
import { DECORATION_SLOTS, type DecorationCode, type DecorationSlot } from '@/domain/catalogue';
import { supabase } from './supabase.ts';

/** What the shrine needs: what the caller OWNS, and what is currently ON the altar. */
export interface MyDecorations {
  /** ⚠️ Only codes with `qty >= 1` — an item owned zero times cannot be equipped. */
  readonly owned: readonly DecorationCode[];
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

  const ownedCodes = (owned.data ?? [])
    .map((r) => (r as { item_code?: unknown }).item_code)
    .filter((c): c is DecorationCode => typeof c === 'string');

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

  return { ok: true, data: { owned: ownedCodes, equipped: equippedMap } };
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
