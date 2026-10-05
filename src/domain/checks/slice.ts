/**
 * THE SLICE RULES — `node src/domain/checks/slice.ts`
 *
 * Zero dependencies, no framework. Same conventions as the T2 test next door
 * (`run.ts`): behaviour checked by a machine that can FAIL, the verdict read
 * back, and the harness itself FAULT-TESTED.
 *
 * WHAT THIS GUARDS
 *
 * The three client rules of doc 19 §12 / §12.5 (SCRUM-53 / PR-4):
 *   ①  capture id minted BEFORE the upload
 *   ②  a FAILED generation forces a NEW capture (never a retry of the row)
 *   ③  `200 shrine_busy` is a QUEUE, not an error
 *
 * These are the rules that were discovered by the live project *after* being
 * assumed, so they get a machine check rather than a code comment.
 */

import {
  INITIAL_OFFERING,
  MAX_THROWS,
  applyAll,
  canCapture,
  isWaiting,
  nextAction,
  transition,
  type Offering,
  type SliceEvent,
} from '../slice.ts';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

const A = (o: Offering, events: readonly SliceEvent[]): Offering => applyAll(o, events);

/**
 * A happy-path offering, built from real events rather than hand-set state.
 *
 * ⚠️ These are FUNCTIONS on purpose. Several checks below assert that an illegal
 * event returns THE SAME OBJECT (`transition(x, e) === x`) — that identity is
 * what proves the event was ignored rather than silently applied. Building the
 * fixture inline at each call site would create a second object and make those
 * assertions fail for the wrong reason, so each check binds its own fixture to
 * a local first.
 */
const captured = (): Offering => A(INITIAL_OFFERING, [{ type: 'CAPTURE_TAKEN', captureId: 'cap_1' }]);
const styled = (): Offering =>
  A(captured(), [{ type: 'CART_DRAFT' }, { type: 'STYLED', spritePath: 'styled/1.webp' }]);

console.log('\nThe three slice rules (doc 19 §12 / §12.5) — SCRUM-53\n');

/* ── RULE ① ─ the capture id exists before anything else happens ──────────── */
section('① The capture id is minted before the upload');

check('a fresh offering has NO capture id', INITIAL_OFFERING.captureId === null);
check(
  'taking a capture assigns the id the client already minted',
  captured().captureId === 'cap_1',
);
check(
  'the offering is capturable-again only from idle/ready, and `ready` already HAS an id',
  canCapture(captured().state) === true && captured().captureId !== null,
);
check(
  'CART_DRAFT without a capture id is refused (the id is never minted implicitly)',
  A(INITIAL_OFFERING, [{ type: 'CART_DRAFT' }]).state === 'idle',
);

/* ── RULE ② ─ a failed generation means a NEW capture ────────────────────── */
section('② A failed generation means a NEW capture, never a retry of the row');

const failedGen = A(styled(), [{ type: 'CART_DRAFT' }, { type: 'GENERATION_FAILED' }]);

check('a failure from `preparing` is handled', failedGen.needsRecapture === true);
check(
  'the SPENT capture id is discarded — it can never be re-requested',
  failedGen.captureId === null,
  `captureId was ${failedGen.captureId}`,
);
check('the offering returns to idle', failedGen.state === 'idle');
/* ── RULE ③ ─ 200 shrine_busy is a queue, not an error ───────────────────── */
section('③ `200 shrine_busy` is a QUEUE, not an error');

const parked = A(styled(), [{ type: 'CART_DRAFT' }, { type: 'BUDGET_PARKED' }]);

check('the budget stop-rule parks the offering', parked.state === 'queued');
check('parking is NOT a failure', parked.needsRecapture === false);
check('parking does NOT discard the capture id (it resumes)', parked.captureId === 'cap_1');
check('a parked offering is still WAITING', isWaiting(parked.state) === true);
check('the UI waits rather than erroring', nextAction(parked) === 'wait');
check(
  'a parked job resumes straight to `styled` — no re-request, no re-upload',
  transition(parked, { type: 'STYLED', spritePath: 'styled/1.webp' }).state === 'styled',
);
check('parking is only legal while preparing', (() => {
  const s = styled();
  return transition(s, { type: 'BUDGET_PARKED' }) === s;
})());
check(
  'a parked offering cannot be thrown before it is styled',
  (() => {
    const p = parked;
    return transition(p, { type: 'THROWN', offsetPx: 10 }) === p;
  })(),
);

/* ── the throw (S9 — the offering RETURNS, never destroyed) ─────────────── */
section('The throw returns on a miss (S9) — up to 3, then done');

const thrown = (offsetPx: number): Offering => A(styled(), [{ type: 'THROWN', offsetPx }]);
const rethrown = (o: Offering): Offering => applyAll(o, [{ type: 'RETHROWN' }]);

check('a throw lands in `thrown`', thrown(10).state === 'thrown');
check('the throw is counted', thrown(10).throws === 1);
check(
  'a RETHROWN keeps the sprite (nothing was destroyed)',
  rethrown(thrown(999)).spritePath === 'styled/1.webp',
);
check('a RETHROWN returns to `styled` for another throw', rethrown(thrown(999)).state === 'styled');
check('a RETHROWN clears the previous band/award', rethrown(thrown(999)).award === null);

// Three consecutive misses, each returning the offering (S9).
const threeMisses = A(styled(), [
  { type: 'THROWN', offsetPx: 999 },
  { type: 'RETHROWN' },
  { type: 'THROWN', offsetPx: 999 },
  { type: 'RETHROWN' },
  { type: 'THROWN', offsetPx: 999 },
]);
check(`after ${MAX_THROWS} throws the offering is spent`, threeMisses.throws === MAX_THROWS);
check(
  'and the UI stops offering a throw (reports done, not an endless wait)',
  nextAction(threeMisses) === 'done',
);
check(
  'a 4th RETHROWN is refused — the offering is finished, not returned again',
  (() => {
    const spent = rethrown(threeMisses);
    return spent === threeMisses && spent.throws === MAX_THROWS;
  })(),
);
check(
  'a throw is refused unless a sprite exists',
  (() => {
    const c = captured();
    return transition(c, { type: 'THROWN', offsetPx: 5 }) === c;
  })(),
);
check(
  'a negative, NaN or infinite offset is refused (it would grade as a bullseye)',
  (() => {
    const s = styled();
    return (
      transition(s, { type: 'THROWN', offsetPx: -1 }) === s &&
      transition(s, { type: 'THROWN', offsetPx: Number.NaN }) === s &&
      transition(s, { type: 'THROWN', offsetPx: Number.POSITIVE_INFINITY }) === s
    );
  })(),
);

/* ── the award is persisted once ────────────────────────────────────────── */
section('The award is persisted — server-derived, shown once');

const rewarded = A(styled(), [
  { type: 'THROWN', offsetPx: 10 },
  { type: 'AWARD_PERSISTED', band: 'bullseye', award: 800 },
]);

check('a persisted award reaches `rewarded`', rewarded.state === 'rewarded');
check('the band is kept for display', rewarded.band === 'bullseye');
check('the award is kept for display', rewarded.award === 800);
check('the UI is done', nextAction(rewarded) === 'done');
check(
  'an award cannot be persisted without a throw (the client cannot mint money)',
  A(styled(), [{ type: 'AWARD_PERSISTED', band: 'bullseye', award: 800 }]).state === 'styled',
);

/* ── out-of-order network replies are normal, not crashes ───────────────── */
section('Out-of-order replies are ignored, not thrown');

check(
  'a late STYLED after an award does not clobber it',
  A(styled(), [
    { type: 'THROWN', offsetPx: 10 },
    { type: 'AWARD_PERSISTED', band: 'graze', award: 400 },
    { type: 'STYLED', spritePath: 'late.webp' },
  ]).award === 400,
);
check(
  'an award cannot be re-persisted over an existing one',
  transition(rewarded, { type: 'AWARD_PERSISTED', band: 'bullseye', award: 1600 }) === rewarded,
);
check(
  'a rewarded offering cannot be thrown again (the award is already banked)',
  transition(rewarded, { type: 'THROWN', offsetPx: 5 }) === rewarded,
);

/* ── GUARD: the harness must be able to FAIL ─────────────────────────────── */
section('Guard — a dead harness must not read as a pass (the prototype habit)');

check('the module actually loads (a missing export would throw, not pass)', typeof transition === 'function');

/**
 * The harness's own aliveness (the prototype's "guard square", doc 05 §2).
 *
 * `check()` records a FAILURE when the condition is false. So a deliberately
 * WRONG belief must show up as a failure — if it cannot, the harness would
 * print an unbroken column of ticks while asserting nothing. The wrong belief
 * is asserted, its failure is detected, and then the counters are restored so
 * the run's verdict reflects only the real checks.
 */
const failuresBeforeGuard = failures.length;
check('DELIBERATE WRONG BELIEF — this line must FAIL', false);
const guardCaughtIt = failures.length === failuresBeforeGuard + 1;
console.log(
  `  ${guardCaughtIt ? '✓' : '✗'} guard: the wrong belief above WAS reported as a failure`,
);
if (guardCaughtIt) {
  passed += 1; // the guard passed
  failed -= 1; // and undo the intentional failure
  failures.pop();
} else {
  failed += 1;
  failures.push('guard: check() never reported a failure — the harness is NOT alive');
}
check('…and the real assertion above still holds', nextAction(failedGen) === 'recapture');

/* ── verdict ─────────────────────────────────────────────────────────────── */
console.log('');
if (failed > 0) {
  console.error(`✗ ${failed} slice checks FAILED:\n${failures.map((f) => `  · ${f}`).join('\n')}\n`);
  process.exit(1);
}
console.log(`✓ all ${passed} slice checks passed\n`);
check(
  'the UI is told to offer a re-capture, not a retry',
  nextAction(failedGen) === 'recapture',
);
check(
  'a failure while PARKED (queued) is equally a new capture',
  A(styled(), [{ type: 'CART_DRAFT' }, { type: 'BUDGET_PARKED' }, { type: 'GENERATION_FAILED' }])
    .needsRecapture === true,
);
check(
  'a NEW capture mints a NEW id (this is what makes the rule satisfiable)',
  A(failedGen, [{ type: 'CAPTURE_TAKEN', captureId: 'cap_2' }]).captureId === 'cap_2',
);
check(
  'and the re-capture clears the recapture flag',
  A(failedGen, [{ type: 'CAPTURE_TAKEN', captureId: 'cap_2' }]).needsRecapture === false,
);
check(
  'a failure does NOT preserve the old sprite (it would be a stale offering)',
  failedGen.spritePath === null,
);