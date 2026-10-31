/**
 * THE THROW — `node src/domain/checks/throw.ts`
 *
 * The slice's ACCEPTANCE TEST (doc 17 §2 A5): **the four aim bands grade true.**
 * Plus the generosity rule that was spec'd and never encoded — the rethrow cap
 * (SCRUM-23), which keeps a forgiven throw from becoming a strategy.
 *
 * Same conventions as the neighbouring suites: zero dependencies, the verdict
 * read back, and the harness FAULT-TESTED so a dead one cannot pass.
 */

import { AIM_BANDS, deriveBand, getBand } from '../aim.ts';
import {
  MAX_THROWS,
  RETHROW_CAP,
  canThrow,
  fireBoxTop,
  gradeThrow,
  heartPoint,
  landedAction,
  offsetFromHeart,
  restingPoint,
  type ThrowOutcome,
} from '../throw.ts';

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

const grade = (offsetPx: number, n = 1): ThrowOutcome => gradeThrow(offsetPx, n);
/** Band ordering, outer → inner, with miss last. */
const rank = (b: string): number => (b === 'miss' ? AIM_BANDS.length : AIM_BANDS.findIndex((x) => x.id === b));

console.log('\nThe throw — the slice\'s acceptance test (doc 17 §2 A5)\n');

/* ── the four bands grade true ───────────────────────────────────────────── */
section('① The four aim bands grade true — first throw, uncapped');

for (const band of AIM_BANDS) {
  const index = AIM_BANDS.findIndex((b) => b.id === band.id);
  const next = AIM_BANDS[index + 1];
  const inside = grade(band.maxOffsetPx);
  // A hair past the threshold must fall to the NEXT band, or to miss. This is
  // the real test: the boundary is inclusive at the threshold, exclusive past it.
  const outside = grade((next ?? band).maxOffsetPx + 0.001);

  check(`±${band.maxOffsetPx} grades ${band.id} (inclusive boundary)`, inside.previewBand === band.id);
  check(
    `just past ±${band.maxOffsetPx} grades ${outside.previewBand}, not ${band.id}`,
    outside.previewBand !== band.id,
  );
}
/* ── the rethrow cap — SCRUM-23 ───────────────────────────────────────────── */
section('② A rethrow caps at 虔诚 Devout — never 正中 Bullseye (SCRUM-23)');

check('throw 1 may be a bullseye', grade(0, 1).previewBand === 'bullseye');
check('throw 2 bullseye attempt → capped to devout', grade(0, 2).previewBand === RETHROW_CAP);
check('throw 3 bullseye attempt → capped to devout', grade(0, 3).previewBand === RETHROW_CAP);
check('the cap is REPORTED so the UI can say so', grade(0, 2).capped === true);
check('throw 1 is never reported as capped', grade(0, 1).capped === false);
check('a throw that already missed the cap is not reported as capped', grade(500, 2).capped === false);
check(
  'the cap only downgrades — it never upgrades a worse throw',
  [0, 10, 30, 60, 120, 500].every((o) => rank(grade(o, 2).previewBand) >= rank(grade(o, 1).previewBand)),
);
check(
  'a rethrow can still miss (the cap does not rescue a bad throw)',
  grade(500, 2).previewBand === 'miss' && grade(500, 2).returns === true,
);
check(
  'the cap is by ORDER, not by name — a tighter bullseye is still capped',
  grade(0.1, 2).previewBand === RETHROW_CAP,
);
check(
  'a capped throw pays Devout\'s ×1.5, never Bullseye\'s ×2.0',
  getBand(grade(0, 2).previewBand).multiplier === getBand(RETHROW_CAP).multiplier,
);

/* ── how many throws ─────────────────────────────────────────────────────── */
section(`③ ${MAX_THROWS} throws per offering (S9)`);

check('throw 1 is allowed', canThrow(1) === true);
check(`throw ${MAX_THROWS - 1} is allowed`, canThrow(MAX_THROWS - 1) === true);
check(`throw ${MAX_THROWS} is NOT`, canThrow(MAX_THROWS) === false);
check('throw 0 is not', canThrow(0) === false);
check('a negative throw number is not', canThrow(-1) === false);
check('a fractional throw number is not', canThrow(1.5) === false);
check('the third throw is marked spent', grade(10, MAX_THROWS).spent === true);
check('the second throw is not spent', grade(10, 2).spent === false);
check(
  'spending counts throws, not misses — a miss on the last throw is still spent',
  grade(500, MAX_THROWS).spent === true && grade(500, MAX_THROWS).returns === true,
);

/* ── geometry: Euclidean, not an axis shortcut ────────────────────────────── */
section("The offset is a true distance from the fire's heart");

const heart = { x: 100, y: 200 };
check('directly on the heart is 0', offsetFromHeart({ x: 100, y: 200 }, heart) === 0);
check(
  'a throw straight above equals one beside it (a symmetric radius)',
  offsetFromHeart({ x: 100, y: 100 }, heart) === offsetFromHeart({ x: 0, y: 200 }, heart),
);
check(
  'a diagonal throw is Pythagorean, NOT the larger axis',
  Math.abs(offsetFromHeart({ x: 110, y: 210 }, heart) - Math.sqrt(200)) < 1e-9,
);
check(
  'a throw below the heart measures the same as one above',
  offsetFromHeart({ x: 100, y: 300 }, heart) === offsetFromHeart({ x: 100, y: 100 }, heart),
);
check('a 3-4-5 triangle gives exactly 5', Math.abs(offsetFromHeart({ x: 103, y: 204 }, heart) - 5) < 1e-9);

/* ── SCRUM-145: what the landed offering offers ───────────────────────────── */
section('⑥ The landed offering always has an action (SCRUM-145)');

// ⚠️ THE REPORTED DEFECT, AS AN ASSERTION. On glass, after a SECOND miss, "Throw again"
// rendered but did nothing: the render gate asked `canThrow(throwNumber)` while the handler
// required `canThrow(throwNumber + 1)`. The first rethrow worked; the second was inert.
check('a first miss offers a rethrow', landedAction(grade(500, 1)) === 'rethrow');
check(
  '⚠️ …and a SECOND miss ALSO offers one — the inert-button defect',
  landedAction(grade(500, 2)) === 'rethrow',
);
check(
  `a miss on the LAST throw (${MAX_THROWS}) rests — there is no throw left`,
  landedAction(grade(500, MAX_THROWS)) === 'rest',
);
check(
  '⚠️ a HIT on the LAST throw is CONFIRMABLE — the award must never be unreachable',
  landedAction(grade(0, MAX_THROWS)) === 'confirm' && landedAction(grade(10, MAX_THROWS)) === 'confirm',
);
check(
  'a hit on any throw is confirmable, and only a hit is',
  [1, 2, MAX_THROWS].every(
    (n) =>
      landedAction(grade(0, n)) === 'confirm' &&
      landedAction(grade(500, n)) !== 'confirm',
  ),
);
// ⚠️ THE COUPLING, asserted — the thing that was wrong. A `rethrow` action must always be
// permitted by the SAME predicate its handler uses, at every throw number.
check(
  '⚠️ a rethrow action IMPLIES canThrow(throwNumber) — the coupling that was wrong',
  [1, 2, MAX_THROWS].every((n) => {
    const a = landedAction(grade(500, n));
    return a !== 'rethrow' || canThrow(n) === true;
  }),
);
check(
  '…and the positive control: at the last throw that predicate is FALSE, so it must rest',
  canThrow(MAX_THROWS) === false && landedAction(grade(500, MAX_THROWS)) === 'rest',
);
check(
  '⚠️ `spent` alone must never decide the action — it is true on a last-throw HIT',
  grade(0, MAX_THROWS).spent === true && landedAction(grade(0, MAX_THROWS)) === 'confirm',
);

/* ── GUARD ────────────────────────────────────────────────────────────────── */
section('Guard — a dead harness must not read as a pass');

check(
  'a deliberately WRONG belief is detected',
  (() => {
    const before = failures.length;
    check('DELIBERATE WRONG BELIEF — must FAIL', false);
    const caught = failures.length === before + 1;
    if (caught) {
      passed += 1;
      failed -= 1;
      failures.pop();
    }
    return caught;
  })(),
);
check('…and the real assertion above still holds', grade(0, 2).previewBand === RETHROW_CAP);

/* ── GEOMETRY: the drawn fire must BE the graded heart ───────────────────── */
section('④ The drawn fire IS the graded heart — the coupling that broke');

// ⚠️ THE DEFECT THIS PINS (2026-10-18). `/burn` positioned the fire box by its
// TOP EDGE at `height × HEART_AT.y`, while the grader measured against a heart at
// exactly `height × HEART_AT.y`. The flame was therefore drawn `FIRE_SIZE / 2`
// (60 px) BELOW the point the throw was scored against — two individually correct
// numbers whose COUPLING was wrong. Nothing caught it: the types agreed, and a
// screenshot looks plausible either way.
//
// `/burn` now draws `FireArt` anchored on `heartPoint(...)` directly, so the
// coupling is structural on that screen. `fireBoxTop` is kept as the pure rule
// for any box centred on the heart — and pinned here, so the old `top = heart`
// form cannot return through a future refactor.
const VIEW_H = 800;
/** A representative fire-box diameter. The arithmetic is size-independent. */
const FIRE_SIZE_CHECK = 120;
const fireTop = fireBoxTop(VIEW_H, FIRE_SIZE_CHECK);
const gradedHeart = heartPoint(390, VIEW_H);

check("the fire box's CENTRE lands on the graded heart", fireTop + FIRE_SIZE_CHECK / 2 === gradedHeart.y);
check('⚠️ …and the offset is NOT zero — `top = heart` is the bug, not the fix', fireTop !== gradedHeart.y);
check(
  '⚠️ the drift was exactly half the box — 60 px, enough to cost TWO bands',
  gradedHeart.y - fireTop === FIRE_SIZE_CHECK / 2,
);
check(
  '⚠️ a dead-centre throw scored 60 px low grades graze, not bullseye',
  grade(0, 1).previewBand === 'bullseye' && grade(60, 1).previewBand === 'graze',
);
check(
  'the heart scales with the view (ADR-003: screen-fixed, not world-locked)',
  heartPoint(390, VIEW_H * 2).y === gradedHeart.y * 2,
);
check(
  'the offering rests BELOW the fire, so an upward drag is the gesture',
  restingPoint(390, VIEW_H).y > gradedHeart.y,
);
check('…and fire and hand share a column — the drag is vertical', restingPoint(390, VIEW_H).x === gradedHeart.x);
check(
  'the offset to the heart is 0, and the old drift scored 60 px',
  offsetFromHeart(gradedHeart, gradedHeart) === 0
    && offsetFromHeart({ x: gradedHeart.x, y: gradedHeart.y + 60 }, gradedHeart) === 60,
);

/* ── the outcome fields the burn screen actually renders ──────────────────── */
section('⑤ Grading fields the burn screen renders');

// ⚠️ These six used to live BELOW the pass/fail summary, so they printed a ✓ and
// then incremented counters nobody read — they could never fail the build. They
// are real assertions; the verdict block is now last.
check('a dead-centre throw is 正中 Bullseye', grade(0).previewBand === 'bullseye');
check('far outside the fire is 偏失 Miss', grade(500).previewBand === 'miss');
check('a miss RETURNS the offering (S9 — never destroyed)', grade(500).returns === true);
check('a hit does not return', grade(10).returns === false);
check('the offset submitted is exactly what was measured', grade(12.5).offsetPx === 12.5);
check(
  'the local preview agrees with the server-side derivation on throw 1',
  AIM_BANDS.every((b) => grade(b.maxOffsetPx).previewBand === deriveBand(b.maxOffsetPx)),
);

/* ── verdict ──────────────────────────────────────────────────────────────── */
// ⚠️ LAST — and that IS part of the fix. This block used to sit above §⑤, so
// those checks ran after `passed`/`failed` had been tallied and could not change
// the exit code. A check that cannot fail is not a check.
console.log('');
if (failed > 0) {
  console.error(`✗ ${failed} throw checks FAILED:\n${failures.map((f) => `  · ${f}`).join('\n')}\n`);
  process.exit(1);
}
console.log(`✓ all ${passed} throw checks passed\n`);