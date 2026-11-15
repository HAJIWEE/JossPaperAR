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
import { CELL_MAX_LEN, cellFor, isValidCell } from '../cell.ts';
import { computeAward, groundMultiplier, MAX_AWARD } from '../award.ts';
import { OFFERINGS, BASE_VALUE_RATIO, baseValueOf } from '../catalogue.ts';
import { isLegalCreditMovement, accrualFor, PHOTO_FEE_CREDITS } from '../currency.ts';
import { hasQuota, remaining, dailyLimit, EMPTY_QUOTA, DAILY_PHOTO_BURNS } from '../quota.ts';
import {
  LEAGUE_TIERS, COHORT_SIZE, PROMOTE_COUNT, DEMOTE_COUNT, BOTTOM_TIER, TOP_TIER, tierOf,
  pointsBandOf, isNearbyBand,
} from '../league.ts';
import { readFileSync } from 'node:fs';

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
check('虔诚 + new ground + streak = 1,250', dev.award === 1250, `got ${dev.award}`);
check('擦边 + new ground + streak = 850', gra.award === 850, `got ${gra.award}`);
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

// ── 6 · THE LEAGUE LADDER (SCRUM-111 · doc 07 §7 Q6) ─────────────────────────
// ⚠️ THE ORDER OF `LEAGUE_TIERS` IS LOAD-BEARING. The roll promotes by
// incrementing `tier`, so a reordered array would silently INVERT promotion and
// demotion — a user would be demoted for winning, and nothing else would look
// wrong. These assertions exist because that failure is invisible until a human
// notices they were punished for coming first.
section('6 · The league ladder — the tier vocabulary (SCRUM-111)');

check(
  "every rung's tier equals its index + 1 (lowest first, no gaps)",
  LEAGUE_TIERS.every((t, i) => t.tier === i + 1),
);

check(
  'the rungs ascend strictly',
  LEAGUE_TIERS.every((t, i) => i === 0 || t.tier > LEAGUE_TIERS[i - 1].tier),
);

check(
  `${LEAGUE_TIERS.length} rungs, and TOP_TIER/BOTTOM_TIER agree with them`,
  TOP_TIER === LEAGUE_TIERS.length && BOTTOM_TIER === 1,
);

// The PM's own words on SCRUM-111: "start with wood - bronze - iron - and go up
// into valuable gems". Pinning the ENDS means a later edit cannot quietly drop
// the bottom of the ladder the answer specified.
check(
  "the bottom rung is the PM's wood (木) and the top is a precious stone (钻石)",
  LEAGUE_TIERS[0].name_zh === '木' && LEAGUE_TIERS[TOP_TIER - 1].name_zh === '钻石',
);

check(
  'every rung carries BOTH languages — these words are the product’s voice',
  LEAGUE_TIERS.every((t) => t.name_en.length > 0 && t.name_zh.length > 0),
);

check(
  'no two rungs share a name in either language (a duplicate rung is not a rung)',
  new Set(LEAGUE_TIERS.map((t) => t.name_en)).size === LEAGUE_TIERS.length &&
    new Set(LEAGUE_TIERS.map((t) => t.name_zh)).size === LEAGUE_TIERS.length,
);

// ⚠️ A promotion at the top must HOLD, and a demotion at the bottom must HOLD.
// If a rung existed beyond either end, the roll would write a tier with no name
// and the board would render a blank band.
check(
  'there is NO rung above the top or below the bottom',
  tierOf(TOP_TIER + 1) === undefined && tierOf(BOTTOM_TIER - 1) === undefined,
);

// SCRUM-111 answer A, and doc 07 §4.4's promote/demote counts.
check(
  'SCRUM-111 answer A is pinned: cohort ≈ 30, top 3 up / bottom 3 down',
  COHORT_SIZE === 30 && PROMOTE_COUNT === 3 && DEMOTE_COUNT === 3,
);

// ── 7 · FAULT-TEST THE HARNESS ITSELF ────────────────────────────────────────
// The prototype's guard square: if the harness is dead, this MUST fail.
section('7 · Guard — the harness is alive');

const GUARD_MUST_BE_FALSE = deriveBand(1000) === 'bullseye';
check(
  'guard: a 1000 px throw is NOT a bullseye (a dead harness would wrongly pass this)',
  GUARD_MUST_BE_FALSE === false,
);

// ── SCRUM-12 · the COARSE CELL (SCRUM-233 option A) ──────────────────────────
/**
 * ⚠️⚠️ **THE ×2.0 HAD NEVER FIRED.** `submit_burn` computes `new_ground` inside
 * `if v_cell is not null`, and `grep -rn 'cell_hash' src/` matched nothing — so the reward, the
 * `cell_burns` table and the reward screen's `newGround` tag were all unreachable.
 *
 * These assert the properties that make switching it on safe. ⚠️ **COARSENESS IS THE FIRST ONE
 * THAT MATTERS**: a fine grid would be a location pin wearing a hash — technically not raw
 * coordinates, and still singling out a building.
 */
const SG_LAT = 1.3521;
const SG_LNG = 103.8198; // Singapore
const cellBase = cellFor(SG_LAT, SG_LNG);

check('cell: deterministic — the same fix always yields the same token',
  cellBase !== null && cellBase === cellFor(SG_LAT, SG_LNG));
check("cell: fits submit_burn's 16-char ceiling", cellBase !== null && cellBase.length <= CELL_MAX_LEN,
  `length ${cellBase?.length}`);
check('cell: version-prefixed and base36 only', isValidCell(cellBase));

// ⚠️ THE COARSENESS PROOF: ~10 m apart must be the SAME cell, or this is a pin.
check('⚠️ cell: ~10 m apart is the SAME cell — coarse, not a location pin',
  cellFor(SG_LAT + 0.00009, SG_LNG + 0.00009) === cellBase);

// ⚠️ …and the opposite, or "new ground" could never trigger for anyone.
const cellFar = cellFor(SG_LAT + 0.02, SG_LNG); // ~2.2 km away
check('cell: ~2 km apart is a DIFFERENT cell', cellFar !== null && cellFar !== cellBase);

// ⚠️ NEVER A COORDINATE — no decimal point, no punctuation, nothing that reads as lat/lng.
check('⚠️ cell: carries no coordinate text', cellBase !== null
  && !cellBase.includes('.') && /^[0-9a-z]+$/.test(cellBase));

// ⚠️ Each of these is a REFUSAL — a `null`, never a throw.
check('cell: refuses NaN', cellFor(Number.NaN, SG_LNG) === null);
check('cell: refuses an out-of-range latitude', cellFor(91, SG_LNG) === null);
check('cell: refuses an out-of-range longitude', cellFor(SG_LAT, 181) === null);
// ⚠️ The Gulf of Guinea is what an UNFIXED GPS reports. Paying ×2.0 for it would be free money
// for every device that simply failed to fix.
check('⚠️ cell: refuses the null island (an unset GPS fix)', cellFor(0, 0) === null);

// ⚠️ THE GUARD THAT PROTECTS THE BURN ITSELF: `submit_burn` rejects a malformed `cell_hash` by
// raising `22023`, which kills the WHOLE burn — so a bad token must be unsendable by construction.
check('isValidCell rejects junk, so it can never reach the server',
  !isValidCell('') && !isValidCell('ABC') && !isValidCell(null) && !isValidCell(undefined)
  && !isValidCell('1'.padEnd(17, 'a')));

// ── SCRUM-237 · THE GROUND BONUS DECAYS PER BURN (SCRUM-235) ─────────────────
/**
 * ⚠️ THE PM'S CURVE: the first burn in a cell is ×2.0, then the bonus ABOVE ×1.0
 * decays exponentially and FRONT-LOADED — the first drop is 0.25, and the rate
 * of dropping shrinks — until it is FIXED at ×1.0. The server (`submit_burn`) is
 * authoritative; these assert the same table so the two cannot drift.
 */
const GROUND_TABLE: ReadonlyArray<readonly [number, number]> = [
  [1, 2.0], [2, 1.75], [3, 1.5625], [4, 1.421875], [5, 1.31640625],
];
for (const [n, expected] of GROUND_TABLE) {
  check(`ground: burn ${n} is × ${expected}`,
    Math.abs(groundMultiplier(n) - expected) < 1e-9, `got ${groundMultiplier(n)}`);
}

check('⚠️ ground: the FIRST drop is exactly 0.25 — the number the PM gave',
  Math.abs(groundMultiplier(1) - groundMultiplier(2) - 0.25) < 1e-9);

// ⚠️ The whole point of "front-loaded": every later drop must be SMALLER. A
// curve that dropped by a constant 0.25 would pass the table above and fail here.
check('⚠️ ground: each later drop is SMALLER — the decay is front-loaded',
  (() => {
    let prev = groundMultiplier(1) - groundMultiplier(2);
    for (let n = 2; n < 12; n++) {
      const drop = groundMultiplier(n) - groundMultiplier(n + 1);
      if (!(drop < prev)) return false;
      prev = drop;
    }
    return true;
  })());

check('⚠️ ground: strictly decreasing while it decays, and never below ×1.0',
  Array.from({ length: 20 }, (_, i) => groundMultiplier(i + 1))
    .every((m, i, all) => m >= 1 && (i === 0 || m < all[i - 1])));

check('⚠️ ground: FIXED at ×1.0 once the bonus rounds away (burn 20 onwards)',
  groundMultiplier(20) === 1 && groundMultiplier(200) === 1);

check('ground: nonsense input (0, negative, NaN) is ×1.0, never a bonus',
  groundMultiplier(0) === 1 && groundMultiplier(-3) === 1 && groundMultiplier(Number.NaN) === 1);

// ⚠️ The AWARD numbers, from the bullseye base (800), so the client can show what
// the server actually paid: 1,600 · 1,400 · 1,250 · 1,138.
const groundAward = (n: number) => computeAward({ offsetPx: 0, cellBurns: n }).award;
check('⚠️ award: 1,600 → 1,400 → 1,250 → 1,138 as one cell is re-burned',
  groundAward(1) === 1600 && groundAward(2) === 1400 && groundAward(3) === 1250 && groundAward(4) === 1138,
  `${groundAward(1)}/${groundAward(2)}/${groundAward(3)}/${groundAward(4)}`);
check('⚠️ award: at the floor a bullseye pays 800 — the bonus is gone, not negative',
  groundAward(20) === 800 && groundAward(999) === 800);
check('⚠️ award: the CEILING does not move — burn 1 + streak is still 1,650',
  computeAward({ offsetPx: 0, cellBurns: 1, streakActive: true }).award === 1650);
check('⚠️ award: the older `newGround: true` shape is burn 1',
  computeAward({ offsetPx: 0, newGround: true }).award === 1600);
// ⚠️ 600 × 1.421875 = 853.125 → 853. The OLD `clamped = award < raw` would have
// said "clamped" here, which is a receipt that lies about why the award is 853.
check('⚠️ award: a fractional raw is NOT reported as clamped (853.125 → 853)',
  (() => {
    const r = computeAward({ offsetPx: 20, cellBurns: 4 });
    return r.award === 853 && r.clamped === false;
  })());

// ── SCRUM-236 · "NEARBY" IS A POINTS BAND, NOT A GEOGRAPHIC RADIUS ───────────
/**
 * ⚠️ The PM's meaning (2026-11-15): competitors are "nearby" in the dimension of
 * their ACCUMULATED POINTS, not of place. The band of record is the cohort
 * (one league week, one tier) — `get_league_board()` already scopes to it, and
 * `supabase/tests/league_nearby_band.sql` proves a tier-2 rival never leaves the
 * database.
 */
check('band: the same league week + tier IS nearby',
  isNearbyBand(pointsBandOf('w-2031-01-06', 2), pointsBandOf('w-2031-01-06', 2)));
check('⚠️ band: a DIFFERENT tier is NOT nearby — the band is points, not place',
  isNearbyBand(pointsBandOf('w-2031-01-06', 2), pointsBandOf('w-2031-01-06', 3)) === false);
check('band: a different league WEEK is not the same band',
  isNearbyBand(pointsBandOf('w-2031-01-06', 2), pointsBandOf('w-2031-01-13', 2)) === false);

// ⚠️ The gate that keeps it that way. A future "nearby = a map" change must fail
// HERE rather than be caught by a reviewer. An unreadable source is a RED, never
// a silent skip — a check that cannot fail is not a check.
check('⚠️ band: the league path reads NO location identifier',
  (() => {
    const LOCATION =
      /\b(latitude|longitude|geolocation|expo-location|cell_hash|coordinates?|gps)\b/i;
    for (const path of ['src/domain/league.ts', 'src/lib/league-api.ts']) {
      let src: string;
      try {
        src = readFileSync(path, 'utf8');
      } catch {
        return false;
      }
      if (LOCATION.test(src)) return false;
    }
    return true;
  })());

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