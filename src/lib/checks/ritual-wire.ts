/**
 * RITUAL WIRE CHECKS — `node src/lib/checks/ritual-wire.ts`  (SCRUM-53)
 *
 * Zero dependencies, no framework, Node 22 strips the types — so this one runs on
 * a bare checkout AND in CI's dependency-free job. That is why it is separate from
 * `check:lib` (which imports `i18n-js` and therefore needs `npm ci`): the two
 * defects it guards both shipped to `main` precisely because nothing could fail.
 *
 * WHAT IT GUARDS — two real defects, found 2026-10-06 while continuing the slice:
 *
 *   ① **The capture id was dropped between screens.** `burn.tsx` read no route
 *      params at all, so `confirm` pushed to `/reward` without `captureId`;
 *      `reward.tsx` refused with a generic `bad_params`, and the **last screen of
 *      the slice could never show a receipt**. Nothing in the type system
 *      objected, because expo-router params are an untyped string bag.
 *
 *   ② **A non-2xx answer was reported as a FAILED GENERATION.**
 *      `requestCartoonize` returned `{ kind: 'ok', jobId: 'x',
 *      events: [{ type: 'GENERATION_FAILED' }] }` for every `!res.ok` — a fake
 *      job id, and rule ②'s event, contradicting its own comment that the capture
 *      was NOT spent. A 500 or an exhausted daily quota would have told the player
 *      to photograph a *new* offering. `isTransportCode` existed for this and was
 *      never called.
 *
 * ⚠️ FAULT-TEST IT: delete the `captureId` from a `toRewardParams` call, or make
 * `outcomeFromHttpFailure` return GENERATION_FAILED, and confirm it goes RED.
 */

import { readBurnParams, readRewardParams, toBurnParams, toRewardParams } from '../route-params.ts';
import {
  eventsFromResponse,
  httpFailureReason,
  isTransportCode,
  outcomeFromHttpFailure,
} from '../ritual-map.ts';

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

// ── 1 · The route contract — the id is not optional (defect ①) ───────────────
section('1 · The ritual route contract — captureId survives every hop');

const pushed = toRewardParams('cap-1', 12.5, 2);
check('toRewardParams carries the capture id', pushed.captureId === 'cap-1');
check('toRewardParams stringifies the offset', pushed.offsetPx === '12.5');
check('toRewardParams stringifies the throw number', pushed.throwNumber === '2');

const readBack = readRewardParams(pushed);
check('a pushed reward route reads back ok', readBack.ok);
check('…and the id round-trips unchanged', readBack.ok && readBack.captureId === 'cap-1');
check('…and the offset comes back as a number', readBack.ok && readBack.accuracyPx === 12.5);
check('…and the throw number comes back as a number', readBack.ok && readBack.throwNumber === 2);

/**
 * THE REGRESSION ITSELF. This is the exact shape `burn.tsx` used to send:
 * an offset and a throw number, and no capture id. Before the fix it produced a
 * screen that refused with `bad_params`; it must now be refused BY NAME, so the
 * failure is legible instead of generic.
 */
const theBug = readRewardParams({ offsetPx: '12.5', throwNumber: '1' });
check('⚠️ a reward route with NO capture id is refused', theBug.ok === false);
check('…and the refusal is named `missing_capture_id`', theBug.ok === false && theBug.reason === 'missing_capture_id');
check('…and it is NEVER silently coerced to a usable id', !(theBug.ok && theBug.captureId === 'undefined'));

check('a blank capture id is refused', readRewardParams({ captureId: '   ', offsetPx: '1' }).ok === false);
check(
  'a negative offset is refused (aim.ts refuses one too, so the client must not send it)',
  readRewardParams({ captureId: 'c', offsetPx: '-4' }).ok === false,
);
check('a non-numeric offset is refused', readRewardParams({ captureId: 'c', offsetPx: 'abc' }).ok === false);
check(
  'an ABSENT offset is refused rather than treated as 0 (0 px is a bullseye — too kind a default)',
  readRewardParams({ captureId: 'c' }).ok === false,
);
check(
  'an empty-string offset is refused (Number("") is 0)',
  readRewardParams({ captureId: 'c', offsetPx: '' }).ok === false,
);
check(
  'an absent throw number defaults to 1, the only safe direction',
  (() => {
    const r = readRewardParams({ captureId: 'c', offsetPx: '40' });
    return r.ok && r.throwNumber === 1;
  })(),
);
check('a throw number of 0 is refused', readRewardParams({ captureId: 'c', offsetPx: '1', throwNumber: '0' }).ok === false);
check(
  'expo-router array params take the first value',
  (() => {
    const r = readRewardParams({ captureId: ['cap-9', 'cap-other'], offsetPx: ['3'] });
    return r.ok && r.captureId === 'cap-9';
  })(),
);

// The burn hop has the same rule: preparing → burn must carry both.
check('the burn hop carries the id and the uri', toBurnParams('cap-1', 'file://a.jpg').uri === 'file://a.jpg');
check('a burn route without a uri is refused', readBurnParams({ captureId: 'cap-1' }).ok === false);
check('a burn route without a capture id is refused', readBurnParams({ uri: 'file://a.jpg' }).ok === false);
check('a complete burn route reads back ok', readBurnParams({ captureId: 'cap-1', uri: 'file://a.jpg' }).ok === true);

// ── 2 · A refusal is never a failed generation (defect ②) ────────────────────
section('2 · HTTP failures — a refusal must not masquerade as rule ②');

check('the server’s own code is surfaced', httpFailureReason(500, { code: 'internal' }) === 'internal');
check('a bare status still names its reason', httpFailureReason(404, {}) === 'http_404');
check('a null body does not throw', httpFailureReason(502, null) === 'http_502');
check('a blank code falls through to the status', httpFailureReason(400, { code: '   ' }) === 'http_400');

const serverError = outcomeFromHttpFailure(500, {});
const quota = outcomeFromHttpFailure(400, { code: 'quota_complete' });
const notFound = outcomeFromHttpFailure(404, { code: 'capture_not_found' });

check('a 5xx is TRANSIENT', serverError.kind === 'transient');
check('an exhausted quota is TRANSIENT, not a spent capture', quota.kind === 'transient');
check('a not-found capture is TRANSIENT too (no job was created, so nothing was spent)', notFound.kind === 'transient');
check('the quota reason carries the server code', quota.kind === 'transient' && quota.reason === 'quota_complete');
check(
  '⚠️ a non-2xx NEVER carries events — it cannot emit rule ② by accident',
  !('events' in serverError) && !('events' in quota) && !('events' in notFound),
);
check(
  '⚠️ and it never invents a job id (the old branch returned the literal "x")',
  !('jobId' in serverError),
);

// The counter-assertion: the fix must NOT have blunted rule ②. A generation that
// actually RAN and failed still arrives on the 2xx path and still spends the capture.
check(
  'a 2xx `failed` STILL emits GENERATION_FAILED (rule ② intact)',
  eventsFromResponse({ job_id: 'j1', status: 'failed' })[0]?.type === 'GENERATION_FAILED',
);
check(
  'a 2xx `rejected` STILL emits GENERATION_FAILED (moderation refusal)',
  eventsFromResponse({ job_id: 'j2', status: 'rejected' })[0]?.type === 'GENERATION_FAILED',
);
check(
  'a 2xx shrine_busy STILL parks rather than failing (rule ③ intact)',
  eventsFromResponse({ job_id: 'j3', status: 'queued', queued: true, code: 'shrine_busy' })[0]?.type === 'BUDGET_PARKED',
);
check(
  'a 2xx styled STILL yields a sprite',
  eventsFromResponse({ job_id: 'j4', status: 'styled', styled_path: 'styled/j4' })[0]?.type === 'STYLED',
);

// `isTransportCode` existed unused; it now has a named consumer, and the
// distinction it draws is the one the queue uses to decide retry vs drop.
check('a transport code is classified as transport', isTransportCode('network_error'));
check('…and a server refusal is NOT', !isTransportCode('quota_complete'));

// ── 3 · FAULT-TEST THE HARNESS ITSELF ────────────────────────────────────────
section('3 · Guard — the harness is alive');

check(
  'guard: a 500 is NOT a success (a dead harness would wrongly pass §2)',
  (outcomeFromHttpFailure(500, {}).kind === 'ok') === false,
);
check(
  'guard: a reward route with no capture id is NOT acceptable',
  (readRewardParams({ offsetPx: '1' }).ok === true) === false,
);

// ── verdict ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(64)}`);
if (failed === 0) {
  console.log(`✓ all ${passed} ritual-wire checks passed`);
  process.exit(0);
}
console.log(`✗ ${failed} of ${passed + failed} ritual-wire checks FAILED:`);
for (const f of failures) console.log(`    · ${f}`);
process.exit(1);
