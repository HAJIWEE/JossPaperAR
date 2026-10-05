/**
 * The slice's state machine — the ONE piece of the slice that must be right.
 *
 * WHY THIS FILE IS PURE AND SEPARATE
 *
 * The slice (SCRUM-53 / PR-4) is `capture → cartoonize → burn → award →
 * persist`. Almost all of that is a screen, a camera and a network call. But
 * three rules from doc 19 §12 / §12.5 govern it, and all three arrived as
 * *warnings* — the kind that get violated by a well-meaning refactor six weeks
 * later, because nothing in the type system objects to violating them:
 *
 *   ①  The capture id is generated BEFORE the upload. `captures` deliberately
 *       has NO UPDATE policy, so a row created server-side cannot be adopted.
 *   ②  A FAILED generation means a NEW capture. `unique(capture_id)` on
 *       `cartoonize_jobs` is the cost guarantee (one job per capture), and
 *       `request_cartoonize` treats any non-`queued` job as a paid replay. So
 *       retrying the same offering is not "retry" — it is a second charge for
 *       one photo, or a silent failure.
 *   ③  `200 { code: 'shrine_busy', queued: true }` is a QUEUE, not an error.
 *       The AI-budget stop-rule (ADR-006 / SCRUM-59) answers 200 *on purpose*
 *       rather than 429, because "queue, never fail" is the product decision.
 *       Treating it as a failure would show the player an error for a system
 *       that is working exactly as designed.
 *
 * Encoding them as prose has already failed once (they were discovered by the
 * live project, not by reading the docs). So they live here as an explicit
 * state machine with the transitions *typed*, and this module is checked by
 * `npm run check:slice` with the boundaries fault-tested.
 *
 * DELIBERATELY FREE OF REACT AND OF THE NETWORK, so it loads under plain Node
 * and can be asserted without a device or a server — the same property that
 * makes `src/domain/*` testable.
 */

import type { BandId } from './aim.ts';

/**
 * The offering's lifecycle. Note the throw states are NOT a linear
 * progression: a miss RETURNS the offering to `styled` (S9 — never destroyed).
 */
export const SLICE_STATES = [
  'idle', // no offering yet — Home
  'ready', // a capture exists on the server, awaiting cartoonize
  'preparing', // cartoonize in flight
  'queued', // parked by the budget stop-rule — NOT an error (rule ③)
  'styled', // a sprite exists; the fire is ready
  'thrown', // in flight toward the fire
  'rewarded', // award persisted and shown
] as const;

export type SliceState = (typeof SLICE_STATES)[number];

/** The states from which the player may start a NEW capture. */
export const CAPTURABLE_STATES: readonly SliceState[] = ['idle', 'ready'];

/** The states in which the shrine is doing something the player waits for. */
export const WAITING_STATES: readonly SliceState[] = ['preparing', 'queued'];

export type SliceEvent =
  | { readonly type: 'CAPTURE_TAKEN'; readonly captureId: string }
  /** A queued job was created — status `queued`, not `failed` (ADR-006). */
  | { readonly type: 'CART_DRAFT' }
  /** The stop-rule answered `shrine_busy`: park, do NOT error (rule ③). */
  | { readonly type: 'BUDGET_PARKED' }
  /** The generation failed. Rule ②: this forces a NEW capture. */
  | { readonly type: 'GENERATION_FAILED' }
  | { readonly type: 'STYLED'; readonly spritePath: string }
  | { readonly type: 'THROWN'; readonly offsetPx: number }
  | { readonly type: 'RETHROWN' }
  | { readonly type: 'AWARD_PERSISTED'; readonly band: BandId; readonly award: number };

export interface Offering {
  readonly state: SliceState;
  /**
   * Rule ①: minted CLIENT-side, before the upload, and immutable thereafter.
   * A new capture means a new id — which is exactly what makes rule ②
   * satisfiable.
   */
  readonly captureId: string | null;
  readonly spritePath: string | null;
  readonly band: BandId | null;
  readonly award: number | null;
  /** How many times this offering has been thrown (a miss does not destroy it). */
  readonly throws: number;
  /** True when the last attempt ended in failure — the UI must offer a re-capture. */
  readonly needsRecapture: boolean;
}

/** S9: up to 3 throws per offering; a rethrow caps at Devout — never Bullseye. */
export const MAX_THROWS = 3;
export const RETHROW_CAP_BAND: BandId = 'devout';

export const INITIAL_OFFERING: Offering = {
  state: 'idle',
  captureId: null,
  spritePath: null,
  band: null,
  award: null,
  throws: 0,
  needsRecapture: false,
};

export function isWaiting(state: SliceState): boolean {
  return WAITING_STATES.includes(state);
}

export function canCapture(state: SliceState): boolean {
  return CAPTURABLE_STATES.includes(state);
}

/**
 * Apply one event. Returns the SAME OBJECT when the event is illegal in the
 * current state, rather than throwing: an out-of-order network reply is a
 * *normal* thing on a phone, not a programming error, and a screen that
 * crashes on one is worse than a screen that ignores it.
 */
export function transition(offering: Offering, event: SliceEvent): Offering {
  switch (event.type) {
    case 'CAPTURE_TAKEN': {
      // A new capture always starts a fresh offering. If the player was asked to
      // re-capture (rule ②), the OLD captureId is dropped here — that IS the
      // mechanism, not a side effect of it.
      return {
        state: 'ready',
        captureId: event.captureId,
        spritePath: null,
        band: null,
        award: null,
        throws: 0,
        needsRecapture: false,
      };
    }

    case 'CART_DRAFT': {
      if (offering.captureId === null || isWaiting(offering.state)) return offering;
      return { ...offering, state: 'preparing', needsRecapture: false };
    }

    case 'BUDGET_PARKED': {
      // Rule ③. Valid only while preparing. Deliberately NOT an error and NOT
      // a failure: the job keeps its row and proceeds on a later request.
      if (offering.state !== 'preparing') return offering;
      return { ...offering, state: 'queued' };
    }

    case 'GENERATION_FAILED': {
      if (offering.state !== 'preparing' && offering.state !== 'queued') return offering;
      // Rule ②: the capture is SPENT. `unique(capture_id)` means this offering
      // can never be re-requested, so the only way forward is a NEW capture.
      // `needsRecapture` is what the UI reads to say exactly that.
      //
      // ⚠️ The sprite is cleared too. A failed generation can be reached after a
      // PREVIOUS styled offering existed, and leaving that path behind would
      // show the player a sprite for an offering that does not exist.
      return {
        ...offering,
        state: 'idle',
        captureId: null,
        spritePath: null,
        band: null,
        award: null,
        throws: 0,
        needsRecapture: true,
      };
    }

    case 'STYLED': {
      if (offering.state !== 'preparing' && offering.state !== 'queued') return offering;
      return { ...offering, state: 'styled', spritePath: event.spritePath };
    }

    case 'THROWN': {
      if (offering.state !== 'styled') return offering;
      if (!Number.isFinite(event.offsetPx) || event.offsetPx < 0) return offering;
      return { ...offering, state: 'thrown', throws: offering.throws + 1 };
    }

    case 'RETHROWN': {
      // A miss RETURNS the offering (S9) — never destroyed. Back to `styled`,
      // keeping the sprite, so a rethrow costs nothing.
      if (offering.state !== 'thrown') return offering;
      if (offering.throws >= MAX_THROWS) return offering;
      return { ...offering, state: 'styled', band: null, award: null };
    }

    case 'AWARD_PERSISTED': {
      if (offering.state !== 'thrown') return offering;
      return { ...offering, state: 'rewarded', band: event.band, award: event.award };
    }

    default:
      return offering;
  }
}

/** Apply a sequence — the convenient form for replaying a server timeline. */
export function applyAll(offering: Offering, events: readonly SliceEvent[]): Offering {
  return events.reduce(transition, offering);
}

/**
 * The retry affordance rule (②). Exposed so the UI cannot invent its own
 * policy: after a failure the ONLY legal next action is a new capture.
 */
export function nextAction(offering: Offering): 'capture' | 'throw' | 'wait' | 'done' | 'recapture' {
  if (offering.needsRecapture) return 'recapture';
  if (offering.state === 'idle') return 'capture';
  if (offering.state === 'styled') return offering.throws >= MAX_THROWS ? 'done' : 'throw';
  if (offering.state === 'rewarded') return 'done';
  // A spent offering mid-'thrown' (all MAX_THROWS missed) is FINISHED, not
  // waiting — otherwise the screen would spin forever after the third miss.
  if (offering.state === 'thrown') return offering.throws >= MAX_THROWS ? 'done' : 'wait';
  if (isWaiting(offering.state)) return 'wait';
  return 'wait';
}