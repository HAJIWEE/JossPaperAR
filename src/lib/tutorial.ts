/**
 * tutorial.ts — the PURE rules of the first-run TUTORIAL (SCRUM-85).
 *
 * SCRUM-83's answer, verbatim: *"the first burn should be a tutorial, a demo to
 * the user. so no clan involved and no real points to contribute to any clan.
 * after the tutorial build the PATH C mentioned in the ticket."*
 *
 * So the first-run sequence is **tutorial → ACCOUNT → your family's altar**: the first burn demonstrates the
 * ritual, the account is created, and then the real create/join flow follows it.
 * ⚠️ **The account step is REQUIRED and is ADR-004 Amendment 1 (2026-11-01)** — it is a gate, not an offer.
 *
 * ── ⚠️ THE INVARIANT THAT MATTERS MOST ─────────────────────────────────────
 * **The tutorial must not spend AI money.** If the demo ran a real Path C
 * generation, every new user would cost ≈ US$0.09 — exactly the unmetered bill
 * doc 10 §6 put a ceiling on — and it would be INVISIBLE, because it happens
 * before any quota, clan or `app_config` budget row exists to catch it.
 * `TUTORIAL_CONSEQUENCES` states that as DATA so a gate asserts it rather than a
 * comment promising it.
 *
 * ── ⚠️⚠️ AND THE RULING THAT HARDENS IT: THE FIRST BURN IS **JUST A DEMO**, ON A **STANDARD OFFERING**
 * Owner, 2026-11-01: *"the FIRST BURN should be JUST A DEMO and use standard offerings to prevent cost
 * runoff from people just doing the demo and not signing up after."*
 *
 * ⚠️ **WHY "STANDARD OFFERING" IS A COST RULE AND NOT A STYLE CHOICE.** A demo that photographs the room
 * produces a real local file and pushes it through `/crop` → `/preparing` → `/burn`. Today that is free
 * because FOUR screens each branch on `demo` and skip the upload and the generation — ⚠️ **but that is a
 * CHAIN of four guards, not a wall.** One of them falling through is the ≈US$0.09-per-user bill this file
 * exists to prevent, and it would be spent on users who **never sign up** — the exact runoff named above.
 * ⚠️ **A demo that never takes a photo has NOTHING TO SEND**, so the guarantee stops depending on four
 * `if (demo)` branches agreeing with each other.
 *
 * ✅ **BUILT — SCRUM-216 (2026-11-07).** The camera is GONE from the demo: `capture.tsx` renders no
 * `<FullBleedCamera>` in demo mode and offers the catalogue's `DEMO_ITEM_CODE` instead, `/crop` is
 * skipped entirely (there is no photo to frame), `preparing.tsx` keeps its `TUTORIAL_WAIT_MS` beat on the
 * item hop, and `burn.tsx` draws the catalogue art (its `demoOffering` / photo block is deleted).
 * ⚠️ **`capturesPhoto: false` now rides `TUTORIAL_CONSEQUENCES`** — the flag and the behaviour landed
 * TOGETHER, so the gate can no longer pass while the code does the opposite.
 *
 * PURE on purpose: no React, no storage, no network — so `check:lib` can hold
 * the rule without a device.
 */

import { computeAward } from '../domain/award.ts';
import type { BandId } from '../domain/aim.ts';
import type { OfferingCode } from '../domain/catalogue.ts';

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

/**
 * ⚠️ **Where the TUTORIAL hands off — the ACCOUNT, not the fork** (SCRUM-215 · ADR-004 Amendment 1).
 * The first-run chain is **demo → account → clan fork**: the amendment made an account REQUIRED to
 * create or join a clan, so the demo's last beat is the account screen, which then hands off to the
 * fork (`AFTER_ACCOUNT_ROUTE` in `account-flow.ts`).
 */
export const AFTER_TUTORIAL_ROUTE = '/account';

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
 * ⚠️⚠️ **THE ONE OFFERING THE DEMO USES (owner's ruling, 2026-11-01; SCRUM-216).**
 *
 * *"the FIRST BURN should be JUST A DEMO and use standard offerings to prevent cost runoff from people
 * just doing the demo and not signing up after."*
 *
 * ⚠️ **WHY A STANDARD OFFERING, AND WHY THE CAMERA GOES.** A demo that photographs the room makes a real
 * local file and pushes it through `/capture` → `/crop` → `/preparing` → `/burn`. That was free only
 * because FOUR screens each ALSO branched on `demo` — ⚠️ **a CHAIN of guards, not a wall**, and one
 * falling through is the ≈US$0.09-per-user Path C bill, spent on users who **never sign up**. A demo that
 * never takes a photo **has nothing to send**, so the guarantee stops depending on four branches agreeing.
 *
 * ⚠️ **THE DEMO'S COPY MUST NAME THIS SAME ITEM.** The screen renders the catalogue's own name through
 * `collectedItemName(DEMO_ITEM_CODE)`, so there is no invented item and no second source of truth.
 */
export const DEMO_ITEM_CODE: OfferingCode = 'joss_paper_stack';

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
  /**
   * ⚠️ **SCRUM-216 — THE DEMO NEVER OPENS THE CAMERA, so it can never make a local photo file.** This is
   * the flag the ticket says must land WITH the behaviour, never before it: a `capturesPhoto: false`
   * asserted while the camera still opens would be a gate that passes while the code does the opposite.
   * ⚠️ Fault-tested — putting a camera back on the demo's path turns the assertion red.
   */
  capturesPhoto: false,
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
