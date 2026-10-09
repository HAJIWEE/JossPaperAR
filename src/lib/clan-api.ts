/**
 * clan-api.ts — the DEVICE half of the clan API: the authenticated calls.
 *
 * The DECISIONS live in the pure modules (`clan-roles.ts` · `clan-flow.ts` ·
 * `invites.ts`) and the RULES live in the database (migration `0012`). This file
 * only fetches, normalises its inputs through those pure modules so the client
 * and the server agree, and hands back a parsed result.
 *
 * ⚠️ NO GENERATED DB TYPES. The project has no `supabase gen types` step, so
 * `data` is `unknown` and every field is parsed defensively — the same posture
 * `clan.ts` already takes. A cast here would turn a server change into a silent
 * `undefined` on a screen.
 *
 * ⚠️ The server is the authority. Every guard in `0012` is re-checked here only
 * to give a better message, never to replace it: a client that skips these still
 * cannot promote an elder or empty a ladder.
 */

import { normaliseClanCode } from './invites.ts';
import { isValidClanName } from './clan-rules.ts';
import { type ClanRole, isClanRole } from './clan-roles.ts';
import { supabase } from './supabase.ts';

/** Every call resolves — a thrown error on a clan screen is a dead end. */
export type ApiResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly reason: string };

/** The shape `create_clan` / `join_clan` return. */
export interface ClanSummary {
  readonly clanId: string;
  readonly name: string;
  readonly role: ClanRole;
  readonly ancestorCount: number;
  readonly memberCount: number;
  /**
   * The invite capability — returned by `create_clan` only, so the create
   * wizard's invite card (doc 15 §4.2 step 3) can show it without a second call.
   * `null` on a join, where the joiner already holds the code they used.
   */
  readonly code: string | null;
}

/** The shape `preview_clan` returns — counts, and never an ancestor name. */
export interface ClanPreview {
  readonly found: true;
  readonly clanId: string;
  readonly name: string;
  readonly ancestorCount: number;
  readonly memberCount: number;
  readonly isMember: boolean;
}

/** A member row, for the management surface. */
export interface ClanMember {
  readonly userId: string;
  readonly role: ClanRole;
  readonly joinedAt: string;
}

/** One Book entry (doc 15 §7.1 — offering · points · date · festival; no image). */
export interface BookEntry {
  readonly createdAt: string;
  readonly offering: string | null;
  readonly points: number;
  readonly festival: string | null;
  /** `null` when the viewer is outside the clan (the anonymised projection). */
  readonly member: string | null;
  readonly anonymous: boolean;
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

/** Normalise the caller's error into something a screen can show. */
function reasonOf(error: unknown): string {
  const record = asRecord(error);
  return str(record?.message) ?? 'clan_request_failed';
}

function summaryOf(payload: unknown): ClanSummary | null {
  const r = asRecord(payload);
  const clanId = str(r?.clan_id);
  const name = str(r?.name);
  if (!clanId || !name) return null;
  const rawRole = r?.role;
  return {
    clanId,
    name,
    role: isClanRole(rawRole) ? rawRole : 'member',
    ancestorCount: num(r?.ancestor_count),
    memberCount: num(r?.member_count),
    code: str(r?.code),
  };
}

// ── the create / join flow (doc 15 §4) ────────────────────────────────────

/**
 * doc 15 §4.2 — create takes the name; the founder is the head.
 * ⚠️ Validated with the SAME rule `create_clan` uses (`isValidClanName`), so a
 * too-long name is a disabled button rather than a server error.
 */
export async function createClan(name: string): Promise<ApiResult<ClanSummary>> {
  const trimmed = name.trim();
  if (!isValidClanName(trimmed)) return { ok: false, reason: 'clan_name_invalid' };

  const { data, error } = await supabase().rpc('create_clan', { p_name: trimmed });
  if (error) return { ok: false, reason: reasonOf(error) };

  const summary = summaryOf(data);
  return summary ? { ok: true, data: summary } : { ok: false, reason: 'clan_create_unreadable' };
}

/**
 * doc 15 §4.3 — resolve a code WITHOUT joining, for the preview card. Returns
 * `found: false` for a bad/revoked code rather than throwing: a mistyped code is
 * an expected outcome, and the screen shows `clan.invalidCode` for it.
 */
export async function previewClan(code: string): Promise<ApiResult<ClanPreview | null>> {
  const canonical = normaliseClanCode(code);
  if (!canonical) return { ok: false, reason: 'clan_code_malformed' };

  const { data, error } = await supabase().rpc('preview_clan', { p_code: canonical });
  if (error) return { ok: false, reason: reasonOf(error) };

  const r = asRecord(data);
  if (r?.found !== true) return { ok: true, data: null };
  const clanId = str(r.clan_id);
  const name = str(r.name);
  if (!clanId || !name) return { ok: true, data: null };

  return {
    ok: true,
    data: {
      found: true,
      clanId,
      name,
      ancestorCount: num(r.ancestor_count),
      memberCount: num(r.member_count),
      isMember: r.is_member === true,
    },
  };
}

/**
 * doc 15 §4.3 — no approval queue: a valid code joins instantly. The code is
 * normalised first so a pasted `https://…/join/ABCDEFGH` and a typed `abcdefgh`
 * reach the same RPC argument.
 */
export async function joinClan(code: string): Promise<ApiResult<ClanSummary>> {
  const canonical = normaliseClanCode(code);
  if (!canonical) return { ok: false, reason: 'clan_code_malformed' };

  const { data, error } = await supabase().rpc('join_clan', { p_code: canonical });
  if (error) return { ok: false, reason: reasonOf(error) };

  const summary = summaryOf(data);
  return summary ? { ok: true, data: summary } : { ok: false, reason: 'clan_join_unreadable' };
}

/** doc 07 §4.6 — one active code per clan; a head may re-roll it (retires the old). */
export async function rerollClanCode(clanId: string): Promise<ApiResult<string>> {
  const { data, error } = await supabase().rpc('reroll_clan_code', { p_clan_id: clanId });
  if (error) return { ok: false, reason: reasonOf(error) };

  const code = str(asRecord(data)?.code);
  return code ? { ok: true, data: code } : { ok: false, reason: 'clan_reroll_unreadable' };
}

// ── reads the Home card and the management surface need ───────────────────

/**
 * The caller's own clans, with counts — what Home and a switcher render.
 *
 * ⚠️ THREE plain reads rather than one embedded select, deliberately: an embed
 * (`clans(name)`) depends on how supabase-js shapes a many-to-one relation, and
 * with no generated types that shape is a guess. Three predictable queries over
 * a handful of clans is cheaper than a silent `undefined` in a clan name.
 */
export async function myClans(): Promise<ApiResult<ClanSummary[]>> {
  const { data: userData, error: userError } = await supabase().auth.getUser();
  const userId = userData?.user?.id;
  if (userError || !userId) return { ok: false, reason: 'not_authenticated' };

  // my own membership rows are visible under `clan_members_select_member`
  const { data: mine, error } = await supabase()
    .from('clan_members')
    .select('clan_id, role')
    .eq('user_id', userId);
  if (error) return { ok: false, reason: reasonOf(error) };

  const rows = (Array.isArray(mine) ? mine : []).map(asRecord).filter((r): r is Record<string, unknown> => r !== null);
  const ids = rows.map((r) => str(r.clan_id)).filter((v): v is string => v !== null);
  if (ids.length === 0) return { ok: true, data: [] };

  // names — `clans_select_member` lets a member read their own clan's row
  const { data: clans, error: clanError } = await supabase().from('clans').select('id, name').in('id', ids);
  if (clanError) return { ok: false, reason: reasonOf(clanError) };
  const nameById = new Map<string, string>();
  for (const c of (Array.isArray(clans) ? clans : []).map(asRecord)) {
    const id = str(c?.id);
    const name = str(c?.name);
    if (id && name) nameById.set(id, name);
  }

  // counts — two grouped reads, not one per clan
  const memberCount = new Map<string, number>();
  const ancestorCount = new Map<string, number>();
  const { data: members } = await supabase().from('clan_members').select('clan_id').in('clan_id', ids);
  for (const m of (Array.isArray(members) ? members : []).map(asRecord)) {
    const id = str(m?.clan_id);
    if (id) memberCount.set(id, (memberCount.get(id) ?? 0) + 1);
  }
  const { data: ancestors } = await supabase()
    .from('ancestors')
    .select('clan_id')
    .in('clan_id', ids)
    .is('archived_at', null);
  for (const a of (Array.isArray(ancestors) ? ancestors : []).map(asRecord)) {
    const id = str(a?.clan_id);
    if (id) ancestorCount.set(id, (ancestorCount.get(id) ?? 0) + 1);
  }

  const out: ClanSummary[] = [];
  for (const r of rows) {
    const clanId = str(r.clan_id);
    const name = clanId ? nameById.get(clanId) : undefined;
    // a clan whose row we cannot read is one we cannot render — skip, don't guess
    if (!clanId || !name) continue;
    out.push({
      clanId,
      name,
      role: isClanRole(r.role) ? r.role : 'member',
      ancestorCount: ancestorCount.get(clanId) ?? 0,
      memberCount: memberCount.get(clanId) ?? 0,
      // ⚠️ `clans.code` is not selected here on purpose: a member who is not a
      // head should not have the invite capability handed to them by a list
      // read. The invite surface asks for it explicitly.
      code: null,
    });
  }
  return { ok: true, data: out };
}

/**
 * The invite code, fetched EXPLICITLY (SCRUM-50 · doc 07 §4.6).
 *
 * ⚠️ WHY NOT FROM `myClans()`: that read deliberately returns `code: null`, so a
 * list read cannot hand the invite capability to a member who is not a head. The
 * invite surface has to ASK for it — and asks only when the pure `canInvite(role)`
 * says the viewer may invite (head / co-head, doc 15 §3).
 *
 * ⚠️ THE SERVER'S REAL POSTURE, measured — not assumed: `clans_select_member` is
 * `using (is_clan_member(id) or created_by = auth.uid())`, a TABLE-level policy,
 * so any member can already read `code` by selecting it. The gate here is
 * therefore a UI gate, and it is honest to say so rather than to imply the code
 * is hidden from plain members. Tightening that is a server-side (RLS) change —
 * a security-posture decision, not a client one. Recorded on SCRUM-50.
 */
export async function fetchClanCode(clanId: string): Promise<ApiResult<string>> {
  const { data, error } = await supabase()
    .from('clans')
    .select('code')
    .eq('id', clanId)
    .maybeSingle();
  if (error) return { ok: false, reason: reasonOf(error) };

  const code = str(asRecord(data)?.code);
  return code ? { ok: true, data: code } : { ok: false, reason: 'clan_code_unreadable' };
}

/**
 * The roster for the management surface (doc 15 §3). Reads `clan_members`,
 * which members can see — the same policy that makes the role ladder visible.
 */
export async function clanMembers(clanId: string): Promise<ApiResult<ClanMember[]>> {
  const { data, error } = await supabase()
    .from('clan_members')
    .select('user_id, role, joined_at')
    .eq('clan_id', clanId);
  if (error) return { ok: false, reason: reasonOf(error) };

  const out: ClanMember[] = [];
  for (const row of (Array.isArray(data) ? data : []).map(asRecord)) {
    const userId = str(row?.user_id);
    if (!userId) continue;
    out.push({
      userId,
      role: isClanRole(row?.role) ? row.role : 'member',
      joinedAt: str(row?.joined_at) ?? '',
    });
  }
  return { ok: true, data: out };
}

// ── the management RPCs (migration 0012 · doc 15 §3 · §5.3) ────────────────
// ⚠️ These reproduce the SERVER's guards only to give a better message. The
// ladder, the ≥1-head invariant and the anti-abuse caps are all enforced in the
// database — deleting every check here would still be safe, just less friendly.

/**
 * Promote (or step down) a member. `head` is not assignable: succession runs
 * through `co_head` (doc 15 §3 / §10.4 promote-first), and the founder's own row
 * is immutable — both refused here so the UI never offers them.
 */
export async function setMemberRole(
  clanId: string,
  userId: string,
  role: ClanRole,
): Promise<ApiResult<{ userId: string; role: ClanRole; from: ClanRole | null }>> {
  if (role === 'head') return { ok: false, reason: 'clan_head_not_assignable' };

  const { data, error } = await supabase().rpc('set_member_role', {
    p_clan_id: clanId,
    p_user_id: userId,
    p_role: role,
  });
  if (error) return { ok: false, reason: reasonOf(error) };

  const r = asRecord(data);
  return { ok: true, data: { userId, role, from: isClanRole(r?.from) ? r.from : null } };
}

/** Remove a member or elder (head/co-head). Their past Book entries stay (§5.3). */
export async function removeMember(clanId: string, userId: string): Promise<ApiResult<true>> {
  const { error } = await supabase().rpc('remove_member', { p_clan_id: clanId, p_user_id: userId });
  return error ? { ok: false, reason: reasonOf(error) } : { ok: true, data: true };
}

/**
 * Leave a clan — the SCRUM-84 ramp (PM-answered 2026-10-08).
 *
 * A member or elder just leaves. A **sole head-power holder** leaves *by
 * promoting*: name who should lead next (`successorId`), or pass nothing and the
 * server promotes the **oldest elder by `joined_at`**. The only refusal left is
 * "no co-head, no elder, nobody named" — there is no candidate.
 *
 * ⚠️ Returns WHAT HAPPENED, not just success: the screen has to tell the family
 * who leads now, and whether the server chose for them.
 */
export async function leaveClan(
  clanId: string,
  successorId?: string | null,
): Promise<ApiResult<{ was: ClanRole | null; successor: string | null; autoPromoted: boolean }>> {
  const { data, error } = await supabase().rpc('leave_clan', {
    p_clan_id: clanId,
    // sent explicitly, `null` meaning "nobody named" — the branch the ramp reads
    p_successor: successorId ?? null,
  });
  if (error) return { ok: false, reason: reasonOf(error) };

  const r = asRecord(data);
  const was = r?.was;
  return {
    ok: true,
    data: {
      was: isClanRole(was) ? was : null,
      successor: str(r?.successor),
      autoPromoted: r?.auto_promoted === true,
    },
  };
}

/** Rename the clan (head/co-head). Validated with the server's own 2..20 rule. */
export async function renameClan(clanId: string, name: string): Promise<ApiResult<string>> {
  const trimmed = name.trim();
  if (!isValidClanName(trimmed)) return { ok: false, reason: 'clan_name_invalid' };

  const { data, error } = await supabase().rpc('rename_clan', { p_clan_id: clanId, p_name: trimmed });
  if (error) return { ok: false, reason: reasonOf(error) };

  return { ok: true, data: str(asRecord(data)?.name) ?? trimmed };
}

/**
 * Delete the clan (head/co-head). ⚠️ Irreversible: every member loses the altar
 * and the Book (doc 15 §8 C17). The server returns the counts so the confirmation
 * can be truthful rather than vague.
 */
export async function deleteClan(
  clanId: string,
): Promise<ApiResult<{ memberCount: number; ancestorCount: number }>> {
  const { data, error } = await supabase().rpc('delete_clan', { p_clan_id: clanId });
  if (error) return { ok: false, reason: reasonOf(error) };

  const r = asRecord(data);
  return { ok: true, data: { memberCount: num(r?.member_count), ancestorCount: num(r?.ancestor_count) } };
}

/**
 * The Book of Tributes (doc 15 §7). One function, two projections: a member gets
 * `member` filled, anyone else gets it `null` and `anonymous: true` — the server
 * decides, so the client cannot leak a name by asking nicely.
 */
export async function clanBook(clanId: string, limit = 50): Promise<ApiResult<BookEntry[]>> {
  const { data, error } = await supabase().rpc('clan_book', { p_clan_id: clanId, p_limit: limit });
  if (error) return { ok: false, reason: reasonOf(error) };

  const r = asRecord(data);
  if (r?.found === false) return { ok: false, reason: 'clan_book_unknown_clan' };

  const rows = Array.isArray(r?.entries) ? (r?.entries as unknown[]) : [];
  const out: BookEntry[] = [];
  for (const row of rows.map(asRecord)) {
    if (!row) continue;
    out.push({
      createdAt: str(row.created_at) ?? '',
      offering: str(row.offering),
      points: num(row.points),
      festival: str(row.festival),
      // ⚠️ `member` is null for a non-member BY DESIGN — do not default it to
      // something readable, which would undo the anonymised projection (§7.2).
      member: str(row.member),
      anonymous: row.anonymous === true,
    });
  }
  return { ok: true, data: out };
}


