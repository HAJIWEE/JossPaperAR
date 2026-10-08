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

/** A membership row, as the leave rule needs it. */
export interface LeaveMember {
  readonly userId: string;
  readonly role: ClanRole;
  /** ISO timestamp — the "time of joining" the SCRUM-84 rule ranks by. */
  readonly joinedAt: string;
}

export type LeaveRefusal =
  | 'not_a_member'
  | 'successor_is_self'
  | 'successor_not_member'
  | 'no_successor';

/**
 * What leaving THIS clan, as THIS member, should do (SCRUM-84, answered
 * 2026-10-08). The server (`0013`) is the authority; this mirrors it so the
 * screen can prompt BEFORE the user taps, and so the rule is asserted without a
 * database.
 *
 *   * not head power            → leave
 *   * head power, but another   → leave (someone else still carries it)
 *   * SOLE head power + a named successor → promote them, then leave
 *   * SOLE head power, nobody named, an elder exists → the OLDEST elder, then leave
 *   * SOLE head power, nobody named, no elder → refuse
 */
export type LeavePlan =
  | { readonly action: 'leave' }
  | {
      readonly action: 'promote_then_leave';
      readonly successorId: string;
      /**
       * ⚠️ The RANK the successor is promoted INTO — carried explicitly so it is
       * reviewable and assertable rather than buried in an `UPDATE`. Its value
       * mirrors `c_successor_role` in migration `0013`; SCRUM-84's outstanding
       * question is whether that should be `head` in some cases, and this field is
       * the one place the answer lands.
       */
      readonly promoteTo: ClanRole;
    }
  | {
      readonly action: 'auto_promote_then_leave';
      readonly successorId: string;
      readonly promoteTo: ClanRole;
    }
  | { readonly action: 'refuse'; readonly reason: LeaveRefusal };

/**
 * The rank a successor is promoted into — mirrors `c_successor_role` in `0013`.
 * `co_head`, not `head`: the original SCRUM-84 answer promotes the nominee into the
 * head-POWER tier, and `head` is otherwise the founder's immutable fact.
 */
export const SUCCESSOR_RANK: ClanRole = 'co_head';

/**
 * The OLDEST ELDER by time of joining, excluding `actorId`.
 *
 * ⚠️ Ties break on `userId` so two elders who joined in the same second resolve
 * DETERMINISTICALLY — the SQL does `order by joined_at asc, user_id asc`. A rule
 * that picks a different successor on a second run is not a rule.
 */
export function oldestElder(
  members: readonly LeaveMember[],
  actorId: string,
): LeaveMember | null {
  const elders = members
    .filter((m) => m.userId !== actorId && m.role === 'elder')
    .slice()
    .sort((a, b) => {
      if (a.joinedAt !== b.joinedAt) return a.joinedAt < b.joinedAt ? -1 : 1;
      if (a.userId === b.userId) return 0;
      return a.userId < b.userId ? -1 : 1;
    });
  return elders[0] ?? null;
}

export function planLeave(
  members: readonly LeaveMember[],
  actorId: string,
  namedSuccessorId?: string | null,
): LeavePlan {
  const actor = members.find((m) => m.userId === actorId);
  if (!actor) return { action: 'refuse', reason: 'not_a_member' };

  // a member or an elder: nothing to inherit
  if (!hasHeadPower(actor.role)) return { action: 'leave' };

  // another head-power holder remains — head power survives without help
  const others = members.filter((m) => m.userId !== actorId && hasHeadPower(m.role));
  if (others.length > 0) return { action: 'leave' };

  // ── the SOLE head-power holder: the two-step ramp (SCRUM-84) ─────────────
  if (namedSuccessorId) {
    if (namedSuccessorId === actorId) return { action: 'refuse', reason: 'successor_is_self' };
    if (!members.some((m) => m.userId === namedSuccessorId)) {
      return { action: 'refuse', reason: 'successor_not_member' };
    }
    return { action: 'promote_then_leave', successorId: namedSuccessorId, promoteTo: SUCCESSOR_RANK };
  }

  const heir = oldestElder(members, actorId);
  if (heir) return { action: 'auto_promote_then_leave', successorId: heir.userId, promoteTo: SUCCESSOR_RANK };

  // ⚠️ No co-head, no elder, nobody named — the case the PM's instruction does
  // not cover. Refuse rather than invert the ladder (see 0013's header).
  return { action: 'refuse', reason: 'no_successor' };
}

/**
 * May this member leave AT ALL? ⚠️ Its MEANING CHANGED at SCRUM-84: a sole head
 * is no longer refused — they leave *by promoting*, so this is now true for
 * them. `planLeave(...).action !== 'refuse'` is the precise question; this
 * remains for callers that only need "is there a way out".
 */
export function canLeaveClan(members: readonly LeaveMember[], actorId: string): boolean {
  return planLeave(members, actorId).action !== 'refuse';
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

