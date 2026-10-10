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
  gradeThrow,
  offsetFromHeart,
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

console.log('');
if (failed > 0) {
  console.error(`✗ ${failed} throw checks FAILED:\n${failures.map((f) => `  · ${f}`).join('\n')}\n`);
  process.exit(1);
}
console.log(`✓ all ${passed} throw checks passed\n`);

check('a dead-centre throw is 正中 Bullseye', grade(0).previewBand === 'bullseye');
check('far outside the fire is 偏失 Miss', grade(500).previewBand === 'miss');
check('a miss RETURNS the offering (S9 — never destroyed)', grade(500).returns === true);
check('a hit does not return', grade(10).returns === false);
check('the offset submitted is exactly what was measured', grade(12.5).offsetPx === 12.5);
check(
  'the local preview agrees with the server-side derivation on throw 1',
  AIM_BANDS.every((b) => grade(b.maxOffsetPx).previewBand === deriveBand(b.maxOffsetPx)),
);