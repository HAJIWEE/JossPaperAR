/**
 * clan-roles.ts — the PURE rules of the clan ladder (SCRUM-46, doc 15).
 *
 * The SQL in `0012_clan_management_api.sql` is the authority; this is its
 * executable mirror, so `check:lib` can assert the ROLE MATRIX and the
 * invariants without a database, and so a screen can ask "may I show this
 * button?" without inventing a rule. The project's usual pure/device split —
 * the same shape as `clan-rules.ts` (SCRUM-82) and `session-map.ts`.
 *
 * ⚠️ If a rule changes, it changes in BOTH places. The `check:lib` group exists
 * to make that visible, not to be a second source of truth.
 *
 * Sources: doc 15 §3 (the matrix) · §5.2 (anti-abuse) · §5.3 (leaving) ·
 * §10.4 (head exit — promote-first) · §10.5 (the Book window, hide-not-purge).
 */

/** The ladder, highest first — doc 15 §3. */
export type ClanRole = 'head' | 'co_head' | 'elder' | 'member';

export const CLAN_ROLES: readonly ClanRole[] = ['head', 'co_head', 'elder', 'member'];

/**
 * `head` and `co_head` both carry the **full Head column** (doc 15 §3): a
 * co-head may rename, promote, remove and — importantly — delete the clan.
 * Only the founding history differs. Every "is this a head?" test must use
 * this set, never `role === 'head'`.
 */
export const HEAD_POWER_ROLES: readonly ClanRole[] = ['head', 'co_head'];

/** Roles `set_member_role` will write. `head` is absent by design. */
export const ASSIGNABLE_ROLES: readonly ClanRole[] = ['co_head', 'elder', 'member'];

export function isClanRole(value: unknown): value is ClanRole {
  return typeof value === 'string' && (CLAN_ROLES as readonly string[]).includes(value);
}

export function hasHeadPower(role: ClanRole | null | undefined): boolean {
  return role !== null && role !== undefined && (HEAD_POWER_ROLES as readonly string[]).includes(role);
}

// ── the permission matrix (doc 15 §3), row by row ──────────────────────────

/** ✅ head · co_head · elder · member — everyone tributes (clan-scoped, §6). */
export function canOffer(role: ClanRole | null | undefined): boolean {
  return isClanRole(role);
}

/** ✅ head · co_head · elder · member — members see the full Book (§7.2). */
export function canReadFullBook(role: ClanRole | null | undefined): boolean {
  return isClanRole(role);
}

/** Add / remove ancestors: ❌ member. Mirrors `ancestors_insert_elder`. */
export function canEditAncestors(role: ClanRole | null | undefined): boolean {
  return role === 'head' || role === 'co_head' || role === 'elder';
}

/**
 * ⚠️ Invite new members is **Head only** — NOT elder. doc 15 §3's matrix is
 * explicit (Head ✅ · Elder ❌), and it is why `reroll_clan_code` asserts
 * `is_clan_head`. An elder can add tablets but cannot widen the family.
 */
export function canInvite(role: ClanRole | null | undefined): boolean {
  return hasHeadPower(role);
}

/** Promote / rename / remove / delete — the rest of the Head column. */
export function canChangeRoles(role: ClanRole | null | undefined): boolean {
  return hasHeadPower(role);
}
export function canRenameClan(role: ClanRole | null | undefined): boolean {
  return hasHeadPower(role);
}
export function canRemoveMember(role: ClanRole | null | undefined): boolean {
  return hasHeadPower(role);
}
export function canDeleteClan(role: ClanRole | null | undefined): boolean {
  return hasHeadPower(role);
}

// ── the role-change rules (mirrors `set_member_role`) ──────────────────────

export type RoleChangeRefusal =
  | 'actor_lacks_head_power'
  | 'role_not_assignable'
  | 'target_is_founder'
  | null;

/**
 * Returns the refusal reason, or `null` when the change is allowed.
 * `targetRole` is the member's CURRENT role; `newRole` is what they'd become.
 */
export function roleChangeRefusal(
  actorRole: ClanRole | null | undefined,
  targetRole: ClanRole | null | undefined,
  newRole: ClanRole,
): RoleChangeRefusal {
  if (!hasHeadPower(actorRole)) return 'actor_lacks_head_power';
  if (!(ASSIGNABLE_ROLES as readonly string[]).includes(newRole)) return 'role_not_assignable';
  if (targetRole === 'head') return 'target_is_founder';
  return null;
}

// ── leaving, and the ≥1-head invariant (doc 15 §3 · §5.3 · §10.4) ──────────

/**
 * A clan is headless when NO member carries head power. `roles` is every
 * member's role in the clan.
 */
export function isHeadless(roles: readonly ClanRole[]): boolean {
  return !roles.some((r) => hasHeadPower(r));
}

/**
 * May this member leave? Members and elders always may. A head-power holder may
 * only once someone ELSE still holds head power — **promote-first**, doc 15
 * §10.4. `roles` must include the departing member.
 */
export function canLeaveClan(roles: readonly ClanRole[], actorRole: ClanRole | null | undefined): boolean {
  if (!isClanRole(actorRole)) return false;
  if (!hasHeadPower(actorRole)) return true;
  // remaining = every OTHER holder of head power
  const remaining = roles.filter((r) => hasHeadPower(r)).length - 1;
  return remaining >= 1;
}

// ── anti-abuse (doc 15 §5.2) — the numbers this ticket owns ────────────────

/** Total memberships per user, across all clans. §5.2: a user may hold many. */
export const CLANS_PER_USER = 10;
/**
 * Joins in any rolling hour. §5.2 + doc 11 §5's "≈3× the fastest honest play".
 *
 * ⚠️ MUST stay **below** `CLANS_PER_USER`. A membership IS a clan, so an hourly
 * limit equal to the clan cap can never fire — the clan limb always binds first
 * and the join limb is dead logic. Writing the C10 SQL test is what caught that
 * when both were 10.
 */
export const JOINS_PER_HOUR = 3;

export type JoinRefusal = 'too_many_clans' | 'too_many_joins' | null;

/** Mirrors `enforce_clan_member_limits`. `memberships` counts head rows too. */
export function joinRefusal(memberships: number, joinsThisHour: number): JoinRefusal {
  if (memberships >= CLANS_PER_USER) return 'too_many_clans';
  if (joinsThisHour >= JOINS_PER_HOUR) return 'too_many_joins';
  return null;
}

// ── the Book of Tributes (doc 15 §7 · §10.5) ───────────────────────────────

/** §7: "the Book shows and QUERIES the last month only" — a read window. */
export const BOOK_WINDOW_DAYS = 30;
export const MS_PER_DAY = 86_400_000;

/** The oldest instant still inside the rolling window. */
export function bookWindowStart(nowMs: number): number {
  return nowMs - BOOK_WINDOW_DAYS * MS_PER_DAY;
}

/** §10.5 — HIDE, not purge: older entries are retained but not shown. */
export function isInBookWindow(createdAtMs: number, nowMs: number): boolean {
  return createdAtMs > bookWindowStart(nowMs);
}

export type BookProjection = 'full' | 'anonymous';

/**
 * §7.2 — a member sees who made each offering; anyone else gets the same facts
 * with the member withheld ("A member made this offering").
 */
export function bookProjection(isMember: boolean): BookProjection {
  return isMember ? 'full' : 'anonymous';
}

