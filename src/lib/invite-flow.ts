/**
 * invite-flow.ts — the PURE rules of the invite surfaces (SCRUM-50 · doc 07 §4.6).
 *
 * `invites.ts` owns the PAYLOAD (what the code is dressed as). This file owns the
 * DECISIONS around it: what a scan should do when the camera fires forty times a
 * second, which state the resolve screen is in, and — the one doc 07 §4.6 calls
 * out by name — whether an invite must be **HELD** because it arrived before the
 * device had an identity.
 *
 * PURE ON PURPOSE — no React, no native module, no network, no `supabase`. That
 * is what lets `check:lib` assert every branch without a device; the wiring
 * lives in `held-invite.ts` (AsyncStorage) and the screens.
 *
 * ⚠️ PRIVACY (doc 13 §4 · doc 15 §4.3): nothing here ever carries an ancestor
 * name, a member count or a `clan_id` — only the 8-character code, and only
 * through `invites.ts`'s own validator.
 */

import { CODE_LENGTH, normaliseClanCode, parseInviteUrl, qrPayload } from './invites.ts';

// ── 1 · the scan decision ──────────────────────────────────────────────────

/** Why a scanned payload was NOT accepted. */
export type ScanRefusal = 'duplicate' | 'busy' | 'unreadable';

export type ScanDecision =
  | { readonly accept: true; readonly code: string }
  | { readonly accept: false; readonly reason: ScanRefusal };

/**
 * What a scan should do, given what the camera just decoded.
 *
 * ⚠️ WHY THIS IS A FUNCTION AND NOT AN `if` IN THE SCREEN: `onBarcodeScanned`
 * fires CONTINUOUSLY while a code is in frame — on a busy frame, dozens of times
 * per second. A screen that acted on every event would fire `join_clan` in a
 * loop, which is both a UI bug and a way to trip the `3 joins/hour` anti-abuse
 * rule (doc 15 §5.2) by holding the phone still for two seconds. The rules:
 *
 *  - `busy` wins: while a join is in flight, nothing is accepted.
 *  - an exact repeat of the code we already took is a DUPLICATE, not a second
 *    scan — this is the case that fires most often.
 *  - anything we cannot read is `unreadable`, never a guess: the camera sees
 *    every QR in the room, including the one on the cereal box.
 */
export function scanDecision(input: {
  readonly payload: string | null | undefined;
  readonly lastAccepted: string | null;
  readonly busy: boolean;
}): ScanDecision {
  if (input.busy) return { accept: false, reason: 'busy' };

  const code = parseInviteCandidate(input.payload);
  if (!code) return { accept: false, reason: 'unreadable' };

  // ⚠️ Compare the PARSED code, not the raw payload. The same code arrives as a
  // LINK from the QR and as a BARE CODE from a paste box, so comparing raw
  // strings let the second one through — a real defect, caught by `check:lib` §13
  // because the intent was written down as a test rather than as a comment.
  if (input.lastAccepted !== null && parseInviteCandidate(input.lastAccepted) === code) {
    return { accept: false, reason: 'duplicate' };
  }
  return { accept: true, code };
}

/**
 * A scanned payload → a code, or null. Thin on purpose: it delegates to the one
 * parser, so the camera, the paste box and the deep link cannot disagree about
 * what an invite looks like.
 */
export function parseInviteCandidate(payload: string | null | undefined): string | null {
  return parseInviteUrl(payload);
}

// ── 2 · the resolve → preview → join state (doc 07 §4.6) ───────────────────

/** Where the resolve screen is, derived from the last lookup's outcome. */
export type ResolveState =
  /** no canonical code yet — nothing has been asked of the server */
  | 'empty'
  /** a request is in flight */
  | 'looking'
  /** `preview_clan` returned a clan (which may still say "already a member") */
  | 'found'
  /** `preview_clan` answered, and there is no such clan — revoked, or mistyped */
  | 'notFound'
  /** the request itself failed — offline, or the shrine is unreachable */
  | 'unreachable';

/**
 * ⚠️ `notFound` and `unreachable` are DIFFERENT states and must not be merged.
 * "That invite code is not valid" is a fact the user must act on (retype it, ask
 * for a new one); "we could not reach the shrine" is a fact they simply wait out.
 * Showing the first for the second tells a user their family's code is wrong
 * when it is perfectly fine — and the join is then never retried.
 */
export function resolveState(input: {
  readonly code: string | null;
  readonly looking: boolean;
  /** `null` = never looked up; `true`/`false` = the server's answer. */
  readonly found: boolean | null;
  readonly transportFailed: boolean;
}): ResolveState {
  if (!input.code) return 'empty';
  if (input.looking) return 'looking';
  if (input.transportFailed) return 'unreachable';
  if (input.found === true) return 'found';
  if (input.found === false) return 'notFound';
  return 'empty';
}

/** The copy each state shows. `null` = the state shows no message of its own. */
export const RESOLVE_MESSAGE_KEY: Readonly<Record<ResolveState, string | null>> = {
  empty: null,
  looking: null,
  found: null,
  notFound: 'clan.invalidCode',
  unreachable: 'clan.unreachableCode',
};

/**
 * May the Join button act? Only on a real preview, and never for a clan the
 * caller is already in — a repeated tap would otherwise be a second join.
 */
export function canJoin(input: {
  readonly state: ResolveState;
  readonly isMember: boolean;
  readonly joining: boolean;
}): boolean {
  return input.state === 'found' && !input.isMember && !input.joining;
}

/**
 * ⚠️ The QR payload is NOT the bare code (doc 07 §4.6 · doc 13 §4). A bare-code
 * QR would put a capability on screen with no way to open the app from it, and
 * would let any scanning app in the room lift the code without a share action by
 * the user. Asserted in `check:lib` so a "simplification" cannot quietly land.
 */
export function isInvitePayloadSafe(code: string): boolean {
  const canonical = normaliseClanCode(code);
  if (!canonical || canonical.length !== CODE_LENGTH) return false;
  // ⚠️ The payload must be the LINK, not the bare code — and must carry nothing
  // about the clan beyond it. Both halves are asserted in `check:lib`.
  return qrPayload(canonical) !== canonical && !/(ancestor|member|clan_id)/i.test(code);
}

// ── 3 · the HELD invite — an invite that arrived before the identity did ────

/**
 * ⚠️ doc 07 §4.6: "an invite opened **before first-run completes is held**, then
 * applied once the user has an identity". A family link must not dead-end a
 * brand-new user, and it must not be thrown away either — the recipient gets
 * exactly one chance to tap it before it scrolls out of the chat.
 */
export type HoldReason =
  /** the device has no session yet (the ADR-004 bootstrap has not succeeded) */
  | 'no_identity'
  /** the session is fine, but the shrine could not be reached */
  | 'offline';

/** Where the held invite is parked. One slot: the newest invite wins. */
export const HELD_INVITE_KEY = 'josspaperar.heldInvite.v1';

/**
 * How long a hold is worth honouring. An invite is a **capability whose code a
 * head can re-roll** (doc 07 §4.6), so a hold older than this is more likely a
 * dead code than a pending intention — and a dead code fails loudly at preview,
 * which is the good outcome. A week is deliberately generous: expiring too early
 * (a user re-taps a working link and is told nothing was saved) is a worse
 * failure than trying one dead code.
 */
export const HELD_INVITE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface HeldInvite {
  readonly code: string;
  readonly reason: HoldReason;
  /** epoch ms — when it was parked, for the age check below */
  readonly heldAt: number;
}

/**
 * Hold, or carry on? Returns the reason to hold, or `null` to proceed.
 *
 * ⚠️ `sessionOk === false` HOLDS — it does not show an error. The user did the
 * right thing; the device is simply not ready yet. That asymmetry is the whole
 * point of the deferred path, and it is why this returns a reason rather than a
 * boolean.
 */
export function shouldHoldInvite(input: {
  readonly sessionOk: boolean;
  readonly reached: boolean;
  readonly code: string | null;
}): HoldReason | null {
  if (!input.code) return null;
  if (!input.sessionOk) return 'no_identity';
  if (!input.reached) return 'offline';
  return null;
}

/** Build the record to park, or `null` if the code is not canonical. */
export function makeHeldInvite(code: string, reason: HoldReason, heldAt: number): HeldInvite | null {
  const canonical = normaliseClanCode(code);
  if (!canonical) return null;
  return { code: canonical, reason, heldAt };
}

/**
 * Read a parked record back out, TOLERANTLY.
 *
 * AsyncStorage returns whatever a previous build wrote, so every field is
 * re-validated rather than trusted. Junk reads as "nothing held" — the
 * survivable direction, since the user can always re-open their link, whereas a
 * half-parsed record could send them to a screen with no code on it.
 */
export function parseHeldInvite(raw: unknown, now: number): HeldInvite | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const code = normaliseClanCode(record.code);
  if (!code) return null;

  const reason: HoldReason | null =
    record.reason === 'no_identity' || record.reason === 'offline' ? record.reason : null;
  if (!reason) return null;

  const heldAt =
    typeof record.heldAt === 'number' && Number.isFinite(record.heldAt) ? record.heldAt : 0;
  const held: HeldInvite = { code, reason, heldAt };

  return isHeldInviteStale(held, now) ? null : held;
}

/** Has this hold outlived `HELD_INVITE_MAX_AGE_MS`? A future `heldAt` is not stale. */
export function isHeldInviteStale(held: HeldInvite, now: number): boolean {
  return now - held.heldAt > HELD_INVITE_MAX_AGE_MS;
}

/** The one-line "you have an invite waiting" copy, keyed by why it was held. */
export const HELD_INVITE_KEY_BY_REASON: Readonly<Record<HoldReason, string>> = {
  no_identity: 'invite.heldNoIdentity',
  offline: 'invite.heldOffline',
};


