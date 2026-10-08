/**
 * clan-flow.ts — the PURE rules of the clan SCREENS (SCRUM-46, doc 15 §4 · §8).
 *
 * The SQL decides what is *allowed*; the screen decides what to *show*. This is
 * the second half of that sentence made executable, so `check:lib` can assert
 * the wizard order, the button states and the action list without a device — and
 * so a screen never invents a rule or re-derives the matrix.
 *
 * ⚠️ It delegates rather than restates: role powers come from `clan-roles.ts`,
 * the code rules from `invites.ts`, the name rule from `clan-rules.ts`. If you
 * find yourself writing `role === 'head'` here, that is the bug.
 *
 * ⚠️ SCOPE — what this session deliberately did NOT do: make the fork a
 * **required first-run gate**. doc 15 §4 says a user "cannot reach Home without
 * creating or joining a clan", but the shipped behaviour is the slice's
 * auto-create, and **which one stays is exactly `SCRUM-83`** — an open PM
 * decision. Building the gate now would answer it by accident, so the screens
 * are reachable and the *routing* decision stays with the PM.
 */

import type { ClanRole } from './clan-roles.ts';
import { canDeleteClan, canEditAncestors, canInvite, canOffer, canRemoveMember, canRenameClan } from './clan-roles.ts';
import { isValidClanName } from './clan-rules.ts';
import { normaliseClanCode } from './invites.ts';

/** doc 15 §4.1 — one screen, two cards. */
export const FORK = {
  join: { titleKey: 'clan.forkJoin', hintKey: 'clan.forkJoinHint' },
  create: { titleKey: 'clan.forkCreate', hintKey: 'clan.forkCreateHint' },
} as const;
export type ForkChoice = keyof typeof FORK;

/**
 * doc 15 §4.2 — "four taps to head", in the order the BUILT boards use: the
 * **invite card comes BEFORE the ancestor sheet** (amended 2026-10-02 so the
 * signed-off ancestor-sheet boards stay the terminal hand-off into Home).
 */
export const CREATE_STEPS = ['name', 'confirm', 'invite', 'ancestors'] as const;
export type CreateStep = (typeof CREATE_STEPS)[number];

export function createStepIndex(step: CreateStep): number {
  return CREATE_STEPS.indexOf(step);
}

/** The next tap, or `null` on the last step. */
export function nextCreateStep(step: CreateStep): CreateStep | null {
  const i = createStepIndex(step);
  return i >= 0 && i < CREATE_STEPS.length - 1 ? CREATE_STEPS[i + 1] : null;
}

/** The previous tap, or `null` on the first — the wizard must be walkable back. */
export function previousCreateStep(step: CreateStep): CreateStep | null {
  const i = createStepIndex(step);
  return i > 0 ? CREATE_STEPS[i - 1] : null;
}

/**
 * ⚠️ Steps 3 and 4 are SKIPPABLE (doc 15 §4.2: the invite card is skippable and
 * both Skip and Continue lead into the ancestor sheet). Skipping is not a
 * failure state, so the UI must never block on them.
 */
export function isSkippable(step: CreateStep): boolean {
  return step === 'invite' || step === 'ancestors';
}

/** Step 1's Create button is disabled until the name passes the server's rule. */
export function canSubmitName(name: string): boolean {
  return isValidClanName(name);
}

/** Join is enabled only once the code is CANONICAL — the same rule the RPC uses. */
export function canSubmitCode(code: string): boolean {
  return normaliseClanCode(code) !== null;
}

/**
 * doc 15 §8 C8 — the preview card's data. ⚠️ The COPY is not here: it is the
 * `clan_preview` message (doc 15 §8 owns the words, in both locales), so this
 * only sanitises the counts and hands back the interpolation arguments. A screen
 * that wrote its own English here would break 中文 parity silently.
 */
export const PREVIEW_MESSAGE_KEY = 'clan_preview';

export function previewArgs(
  name: string,
  ancestors: number,
  members: number,
): { name: string; ancestors: number; members: number } {
  const clean = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
  return { name, ancestors: clean(ancestors), members: clean(members) };
}

/** ⚠️ A preview shows COUNTS, never an ancestor name before joining (doc 13 §4). */
export const PREVIEW_SHOWS_ANCESTOR_NAMES = false;

/** doc 15 §8 C11 — the locked role labels (ZH terminology is frozen, §10 item 6). */
export const ROLE_LABEL_KEY: Readonly<Record<ClanRole, string>> = {
  head: 'role_head',
  co_head: 'role_co_head',
  elder: 'role_elder',
  member: 'role_member',
};

/**
 * doc 15 §8 C12 — the promote label for a target role, or `null` when there is
 * nothing to offer. `head` is absent because it is not assignable (the ladder
 * runs through co_head — see `roleChangeRefusal`).
 */
export function promoteLabelKey(target: ClanRole): string | null {
  if (target === 'co_head') return 'clan.makeCoHead';
  if (target === 'elder') return 'clan.makeElder';
  return null; // already a member, or the founder's immutable head row
}

/** The five things a clan card can offer, plus the Book and the clan's tablets. */
export type ClanAction = 'offer' | 'book' | 'ancestors' | 'invite' | 'manage' | 'rename' | 'delete' | 'leave';

/**
 * Which actions to RENDER for a viewer. Order is the display order on the card.
 * Every permission is delegated to `clan-roles.ts` — this only decides presence.
 */
export function actionsFor(viewerRole: ClanRole | null | undefined): ClanAction[] {
  // ⚠️ A NON-member sees the Book and NOTHING else (doc 15 §7.2). Without this
  // guard the list below appends `leave` unconditionally, which would render a
  // Leave button — and an "Offer" — on a clan the viewer is not in.
  if (!canOffer(viewerRole)) return actionsForOutsider();

  const actions: ClanAction[] = ['offer', 'book'];
  if (canEditAncestors(viewerRole)) actions.push('ancestors');
  if (canInvite(viewerRole)) actions.push('invite');
  if (canRenameClan(viewerRole)) actions.push('rename');
  if (canRemoveMember(viewerRole)) actions.push('manage');
  if (canDeleteClan(viewerRole)) actions.push('delete');
  actions.push('leave');
  return actions;
}

/**
 * A signed-in non-member holding a shared link: the Book, and only the Book.
 * ⚠️ Invite is **Head-only** (doc 15 §3), so an elder's list is narrower than a
 * head's — the difference is asserted in `check:lib`, not left to the screen.
 */
export function actionsForOutsider(): ClanAction[] {
  return ['book'];
}

/**
 * ⚠️ Leaving is OFFERED to everyone but REFUSED to a sole head (doc 15 §3 +
 * §10.4 promote-first). The screen must say why rather than hide the row — a
 * hidden control reads as a bug, a disabled one reads as a rule.
 */
export function leaveHintKey(): string {
  return 'clan.leavePromoteFirst';
}
