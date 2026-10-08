/**
 * clan-rules.ts — the PURE rules for the slice's clan bootstrap (SCRUM-82).
 *
 * `submit_burn` is **clan-scoped**: it REQUIRES a `clan_id` and refuses unless
 * the caller has a `clan_members` row in that clan (migration 0004, §226/§252).
 * A fresh anonymous user is in **no** clan, so the slice must give them one —
 * doc 19 §8's "hard-coded clan", implemented the least-invented way.
 *
 * PURE on purpose (imports nothing), so `check:lib` can assert these rules
 * without the native Supabase client — the project's usual pure/device split.
 *
 * ⚠️ The auto-create is a slice SHORTCUT for the real "four taps to head" flow
 * (doc 15 §4.2 / SCRUM-46). The slice builds no clan UI, so it stands one up on
 * first use and reuses it thereafter; the real create/join/invite flow is
 * SCRUM-46/50 and replaces this.
 */

/** The slice's default altar name. `create_clan` requires 2..20 characters. */
export const SLICE_CLAN_NAME = 'My Altar';

/** `create_clan` rejects a name outside 2..20 chars (measured after trim). */
export function isValidClanName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 20;
}

/** What the bootstrap should do: keep the clan the caller already has, or make one. */
export type ClanPlan =
  | { readonly action: 'reuse'; readonly clanId: string }
  | { readonly action: 'create' };

export function planClan(existingClanId: string | null | undefined): ClanPlan {
  return typeof existingClanId === 'string' && existingClanId.length > 0
    ? { action: 'reuse', clanId: existingClanId }
    : { action: 'create' };
}
