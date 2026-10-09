/**
 * tutorial.ts — the PURE rules of the first-run TUTORIAL (SCRUM-85).
 *
 * SCRUM-83's answer, verbatim: *"the first burn should be a tutorial, a demo to
 * the user. so no clan involved and no real points to contribute to any clan.
 * after the tutorial build the PATH C mentioned in the ticket."*
 *
 * So the first-run sequence is **tutorial → your family's altar**: the first
 * burn demonstrates the ritual, and the real create/join flow follows it.
 *
 * ── ⚠️ THE INVARIANT THAT MATTERS MOST ─────────────────────────────────────
 * **The tutorial must not spend AI money.** If the demo ran a real Path C
 * generation, every new user would cost ≈ US$0.09 — exactly the unmetered bill
 * doc 10 §6 put a ceiling on — and it would be INVISIBLE, because it happens
 * before any quota, clan or `app_config` budget row exists to catch it.
 * `TUTORIAL_CONSEQUENCES` states that as DATA so a gate asserts it rather than a
 * comment promising it.
 *
 * PURE on purpose: no React, no storage, no network — so `check:lib` can hold
 * the rule without a device.
 */

import { computeAward } from '../domain/award.ts';
import type { BandId } from '../domain/aim.ts';

/** The device-local first-run record. */
export interface FirstRunState {
  readonly tutorialDone: boolean;
}

/** The one key the tutorial needs persisted. */
export const FIRST_RUN_KEY = 'josspaper.firstRun.tutorialDone';

/**
 * Is the first burn still owed a tutorial?
 * ⚠️ Anything other than an explicit `true` means YES — an unreadable or missing
 * record replays the tutorial rather than skipping it. Replaying is recoverable;
 * skipping is a user who never saw the ritual explained.
 */
export function needsTutorial(state: FirstRunState | null | undefined): boolean {
  return state?.tutorialDone !== true;
}

/** Option C, after the tutorial: the fork, not an auto-created altar. */
export const AFTER_TUTORIAL_ROUTE = '/clan';

/**
 * How long the tutorial's "preparing" beat lasts.
 *
 * ⚠️ It exists so the demo FEELS like the ritual — the real screen waits on a
 * network round trip (~16 s in the SCRUM-53 run), and a demo that returned
 * instantly would teach the wrong rhythm. It is a local timer, so it costs
 * nothing but the wait.
 */
export const TUTORIAL_WAIT_MS = 1500;

/**
 * The route marker that puts the ritual screens in demo mode.
 * ⚠️ It must survive EVERY hop — capture → preparing → burn → reward. A flag that
 * is dropped at one hop would turn a tutorial into a real, paying ritual, which
 * is the exact failure `route-params.ts` exists to prevent.
 */
export const DEMO_PARAM = 'demo';
export const DEMO_VALUE = '1';

export function isDemo(value: unknown): boolean {
  return value === DEMO_VALUE;
}

/**
 * What a tutorial run must NOT do, as data.
 *
 * ⚠️ A gate asserts every one of these is `false`, so a future change that wires
 * the tutorial into the server or the AI has to delete an assertion that says
 * why — rather than silently reintroducing a per-user cost.
 */
export const TUTORIAL_CONSEQUENCES = {
  createsClan: false,
  awardsPoints: false,
  writesLedger: false,
  callsServer: false,
  callsAi: false,
} as const;

/** The demo receipt. Deliberately NOT the server's shape. */
export interface DemoReceipt {
  /** ⚠️ Always true, and structurally distinct from `BurnReceipt`. */
  readonly demo: true;
  readonly band: BandId;
  /** The real formula's number, so the demo is TRUTHFUL — but it banks nothing. */
  readonly award: number;
  /** ⚠️ A demo moves no balance. This is the field that says so. */
  readonly balanceDelta: 0;
}

/**
 * Compute the demo receipt for a throw.
 *
 * It uses the SAME award maths as the real ritual (`computeAward`, the client's
 * mirror of doc 07 §6) with **no new-ground and no streak bonus** — those are
 * server-decided, and a demo has no server. So a Devout throw demos **600**, the
 * real single-burn number, which is honest; what the demo does NOT do is bank it.
 */
export function demoReceipt(offsetPx: number): DemoReceipt {
  const result = computeAward({ offsetPx, newGround: false, streakActive: false });
  return { demo: true, band: result.band, award: result.award, balanceDelta: 0 };
}
