/**
 * THE T2 ACCEPTANCE TEST — `node src/domain/checks/run.ts`
 *
 * Zero dependencies, no test framework, no install: Node 22 strips the types.
 * This follows the retired prototype's habit (doc 05 §2, doc 18 §7.1):
 *
 *   • behaviour is checked by a MACHINE that can FAIL (not by an eyeball)
 *   • the verdict is READ BACK, not assumed
 *   • the harness is FAULT-TESTED — a dead harness must not read as a pass
 *     (the prototype used a blue "guard" square for exactly this reason)
 *
 * AND the most important property of all (doc 17 §2 A5 / doc 18 §7.2):
 *
 *   >> THE FOUR AIM BANDS GRADE TRUE. That is the slice's acceptance test —
 *   >> not fps, not "looks about right".
 */

import { AIM_BANDS, deriveBand, bandMultiplier, isRethrow } from '../aim.ts';
import { computeAward, MAX_AWARD } from '../award.ts';
import { OFFERINGS, BASE_VALUE_RATIO, baseValueOf } from '../catalogue.ts';
import { isLegalCreditMovement, accrualFor, PHOTO_FEE_CREDITS } from '../currency.ts';
import { hasQuota, remaining, dailyLimit, EMPTY_QUOTA, DAILY_PHOTO_BURNS } from '../quota.ts';

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

// ── 1 · THE ACCEPTANCE TEST: the four art-derived bands ──────────────────────
section('1 · Aim bands (THE ACCEPTANCE TEST — doc 17 §2 A5)');

check('bullseye threshold is ±14.55', AIM_BANDS[0].maxOffsetPx === 14.55);
check('devout threshold is ±39.40', AIM_BANDS[1].maxOffsetPx === 39.4);
check('graze threshold is ±96.97', AIM_BANDS[2].maxOffsetPx === 96.97);
check(
  'multipliers are 2.0 / 1.5 / 1.0',
  bandMultiplier('bullseye') === 2 && bandMultiplier('devout') === 1.5 && bandMultiplier('graze') === 1,
);

check('0 px → bullseye', deriveBand(0) === 'bullseye');
check('14.55 px → bullseye (inclusive edge)', deriveBand(14.55) === 'bullseye');
check('14.56 px → devout', deriveBand(14.56) === 'devout');
check('39.40 px → devout (inclusive edge)', deriveBand(39.4) === 'devout');
check('39.41 px → graze', deriveBand(39.41) === 'graze');
check('96.97 px → graze (inclusive edge)', deriveBand(96.97) === 'graze');
check('96.98 px → miss', deriveBand(96.98) === 'miss');
check('a miss is a RETHROW — the offering returns (S9)', isRethrow('miss') && !isRethrow('graze'));
check(
  'a negative offset is rejected, not silently graded',
  (() => {
    try {
      deriveBand(-1);
      return false;
    } catch {
      return true;
    }
  })(),
);

// ── 2 · The award formula ────────────────────────────────────────────────────
section('2 · Award formula (doc 05 §2 — the locked four)');

const bull = computeAward({ offsetPx: 0, newGround: true, streakActive: true });
const dev = computeAward({ offsetPx: 20, newGround: true, streakActive: true });
const gra = computeAward({ offsetPx: 60, newGround: true, streakActive: true });
const mis = computeAward({ offsetPx: 200, newGround: true, streakActive: true });

check('正中 + new ground + streak = 1,650', bull.award === 1650, `got ${bull.award}`);
check('虔誠 + new ground + streak = 1,250', dev.award === 1250, `got ${dev.award}`);
check('擦邊 + new ground + streak = 850', gra.award === 850, `got ${gra.award}`);
check('偏失 = 0', mis.award === 0, `got ${mis.award}`);
check('a miss earns nothing even on new ground + streak', mis.newGroundBonus === 0 && mis.streakBonus === 0);
check('the cap is 1,650 and cannot be exceeded', MAX_AWARD === 1650 && bull.award <= MAX_AWARD);
check('no new ground → no bonus (正中 = 850)', computeAward({ offsetPx: 0, streakActive: true }).award === 850);
check('no streak → no bonus (正中 = 1,600)', computeAward({ offsetPx: 0, newGround: true }).award === 1600);
// ── 3 · The wallet invariant ─────────────────────────────────────────────────
section('3 · Wallet invariant — burn awards NEVER mint photo credits (doc 10 §3)');

check('award may not mint credits', !isLegalCreditMovement('award', PHOTO_FEE_CREDITS));
check('accrual may not mint credits', !isLegalCreditMovement('accrual', 100));
check('purchase may not mint credits', !isLegalCreditMovement('purchase', 100));
check('topup MAY mint credits', isLegalCreditMovement('topup', 100));
check('grant MAY mint credits', isLegalCreditMovement('grant', 100));
check('a refund MAY restore credits', isLegalCreditMovement('refund', PHOTO_FEE_CREDITS));
check('spending credits is always legal', isLegalCreditMovement('award', -150));
check('Store-Point accrual is 20% (S13d): 400 → 80, 2,000 → 400', accrualFor(400) === 80 && accrualFor(2000) === 400);

// ── 4 · The catalogue rule ───────────────────────────────────────────────────
section('4 · Catalogue invariant — baseValue = 1.2 × price (S13d)');

check('the ratio is 1.2', BASE_VALUE_RATIO === 1.2);
for (const o of OFFERINGS) {
  check(
    `${o.code}: base ${baseValueOf(o.price)} = 1.2 × ${o.price}`,
    baseValueOf(o.price) === Math.round(o.price * 1.2),
  );
}
check(
  'the documented pairs reproduce (400/480 · 600/720 · 800/960 · 2,000/2,400)',
  baseValueOf(400) === 480 && baseValueOf(600) === 720 && baseValueOf(800) === 960 && baseValueOf(2000) === 2400,
);
check(
  'the House derives to 1,200/1,440 (doc 07 §5.3 — a DERIVED number, PM to confirm)',
  baseValueOf(1200) === 1440,
);

// ── 5 · Quotas ───────────────────────────────────────────────────────────────
section('5 · Burn limits — the AI-cost control (doc 10 §1)');

const TODAY = '2026-10-03';
check('photo limit is 10/day', dailyLimit('photo') === 10 && DAILY_PHOTO_BURNS === 10);
check('store limit is 20/day', dailyLimit('store') === 20);
check('a fresh day has full allowance', remaining(EMPTY_QUOTA(TODAY), 'photo', TODAY) === 10);
check(
  'a stale day resets (per user, per day)',
  hasQuota({ ...EMPTY_QUOTA('2026-10-02'), photoBurnsUsed: 10 }, 'photo', TODAY),
);
check('10/10 used → no quota', !hasQuota({ ...EMPTY_QUOTA(TODAY), photoBurnsUsed: 10 }, 'photo', TODAY));
check('9/10 used → quota remains', hasQuota({ ...EMPTY_QUOTA(TODAY), photoBurnsUsed: 9 }, 'photo', TODAY));
check(
  'photo and store allowances are independent',
  hasQuota({ ...EMPTY_QUOTA(TODAY), photoBurnsUsed: 10 }, 'store', TODAY),
);

// ── 6 · FAULT-TEST THE HARNESS ITSELF ────────────────────────────────────────
// The prototype's guard square: if the harness is dead, this MUST fail.
section('6 · Guard — the harness is alive');

const GUARD_MUST_BE_FALSE = deriveBand(1000) === 'bullseye';
check(
  'guard: a 1000 px throw is NOT a bullseye (a dead harness would wrongly pass this)',
  GUARD_MUST_BE_FALSE === false,
);

// ── verdict ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(64)}`);
if (failed === 0) {
  console.log(`✓ all ${passed} domain checks passed`);
  process.exit(0);
} else {
  console.log(`✗ ${failed} of ${passed + failed} domain checks FAILED:`);
  for (const f of failures) console.log(`    · ${f}`);
  process.exit(1);
}