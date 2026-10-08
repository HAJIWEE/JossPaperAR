/**
 * clan.ts — the slice's clan bootstrap, the DEVICE half (SCRUM-82).
 *
 * `submit_burn` is clan-scoped, so before the award the app must ensure the
 * caller is in a clan. `ensureClan()` reuses the caller's clan if they have one
 * (visible under `clan_members_select_member`) and otherwise creates their altar
 * with the existing `create_clan` RPC (SECURITY INVOKER, granted to
 * `authenticated`). The DECISION lives in the pure `clan-rules.ts`.
 *
 * ⚠️ NOT memoised: a retry after a transient failure must be able to run again.
 * ⚠️ A slice shortcut — see `clan-rules.ts`; the real flow is SCRUM-46/50.
 */

import { SLICE_CLAN_NAME, planClan } from './clan-rules.ts';
import { supabase } from './supabase.ts';

export type ClanResult =
  | { readonly ok: true; readonly clanId: string; readonly created: boolean }
  | { readonly ok: false; readonly reason: string };

/** Ensure the caller has a clan; return its id. */
export async function ensureClan(): Promise<ClanResult> {
  const { data: userData, error: userError } = await supabase().auth.getUser();
  const userId = userData.user?.id;
  if (userError || !userId) return { ok: false, reason: 'not_authenticated' };

  // 1 · reuse — the caller's own membership is visible under RLS.
  const { data: mine, error: readError } = await supabase()
    .from('clan_members')
    .select('clan_id')
    .eq('user_id', userId)
    .limit(1);
  if (readError) return { ok: false, reason: 'clan_read_failed' };

  const plan = planClan(mine?.[0]?.clan_id ?? null);
  if (plan.action === 'reuse') return { ok: true, clanId: plan.clanId, created: false };

  // 2 · create the caller's altar (`create_clan` adds the head row itself).
  const { data, error } = await supabase().rpc('create_clan', { p_name: SLICE_CLAN_NAME });
  const clanId = (data as { clan_id?: unknown } | null)?.clan_id;
  if (error || typeof clanId !== 'string' || clanId.length === 0) {
    return { ok: false, reason: error?.message ?? 'clan_create_failed' };
  }
  return { ok: true, clanId, created: true };
}
