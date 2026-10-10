#!/usr/bin/env node
/**
 * credits-check.js — the BEST VALUE rule, as a gate (SCRUM-100).
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * `BEST VALUE` on the 1,000-credit row was a hand-placed label. On a price change it
 * would still say the same thing — and become a LIE, silently. ⚠️ That is the same
 * failure class this repo keeps catching: a claim that cannot fail the right way.
 *
 * So the badge is a FORMULA, and this file is the proof that it has not drifted:
 *
 *     perCredit(b) = priceCents(b) / credits(b)
 *     bestRate     = min(perCredit)                       ← "best value" = cheapest credit
 *     winner       = bestRate, then SMALLEST credits      ← the documented tie-break
 *
 * ⚠️ CI cannot reach Penpot, so `credits-ladder.json` freezes the shelf as DRAWN
 * (the same shape as `penpot-pairs.json` for contrast). Refresh it with
 * `penpot-sweeps/credits-best-value.js`. This check then asserts the design against
 * the economy rule, so a price edit cannot land without the badge moving too.
 *
 * Run: npm run check:credits   (also part of `npm run check`)
 */

'use strict';

const fs = require('fs');
const path = require('path');

let passed = 0;
const failures = [];

function ok(condition, name, detail) {
  if (condition) {
    passed += 1;
    console.log(`  \u2713 ${name}`);
  } else {
    failures.push(name);
    console.log(`  \u2717 ${name}${detail ? ` \u2014 ${detail}` : ''}`);
  }
}

const FILE = path.join(__dirname, 'credits-ladder.json');

/** The whole rule. Nothing below hard-codes which bundle wins. */
function per1000(bundle) {
  return bundle.priceCents / (bundle.credits / 1000);
}
function bestValue(bundles, tieBreak) {
  const best = Math.min(...bundles.map(per1000));
  const tied = bundles.filter((b) => per1000(b) === best);
  const sorted = [...tied].sort((a, b) =>
    tieBreak === 'largest' ? b.credits - a.credits : a.credits - b.credits);
  return { bestRate: best, tied, winner: sorted[0] };
}
/** What the locked rate says a bundle SHOULD cost — integer cents, never floats. */
function priceCentsFor(credits, centsPer1000) {
  return Math.round((centsPer1000 * credits) / 1000);
}
const money = (cents) => `$${(cents / 100).toFixed(2)}`;

function main() {
  console.log('\nCredits ladder \u2014 the BEST VALUE rule (SCRUM-100)');
  console.log('\u2500'.repeat(64));

  let data;
  try {
    data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    ok(false, 'credits-ladder.json is missing or is not valid JSON', e.message);
    return report();
  }

  const rate = data.lockedRate.centsPer1000;
  const floor = data.floor.centsPer1000;
  const bundles = data.bundles;
  const tieBreak = data.bestValueTieBreak === 'largest' ? 'largest' : 'smallest';

  // 1 · ⚠️ the shelf may never exceed the locked rate. It may go BELOW it — a volume
  //     discount is explicitly permitted — but only down to the floor, asserted next.
  //     (±1 cent tolerance: 155¢ × 500 = 77.5¢, and rounding UP puts the 500 at $1.56/1,000.)
  const overRate = bundles.filter((b) => b.priceCents > priceCentsFor(b.credits, rate) + 1);
  ok(overRate.length === 0,
    `no bundle is priced above the locked $${(rate / 100).toFixed(2)}/1,000`,
    overRate.map((b) => `${b.credits}: ${money(b.priceCents)} vs rate ${money(priceCentsFor(b.credits, rate))}`).join(' · '));

  // 2 · the floor binds, and the average must clear it (doc 10's own constraint on bundles)
  const belowFloor = bundles.filter((b) => per1000(b) < floor);
  ok(belowFloor.length === 0,
    `no bundle is under the $${(floor / 100).toFixed(2)}/1,000 floor`,
    belowFloor.map((b) => `${b.credits} at $${(per1000(b) / 100).toFixed(2)}`).join(' · '));

  const average = bundles.reduce((a, b) => a + per1000(b), 0) / bundles.length;
  ok(average >= floor,
    `the ladder averages $${(average / 100).toFixed(2)}/1,000, at or above the floor`,
    `average $${(average / 100).toFixed(4)}`);

  // 3 · ⚠️ THE ONE THAT MATTERS: the badge is where the formula puts it
  const { bestRate, tied, winner } = bestValue(bundles, tieBreak);
  ok(winner.credits === data.bestValueCredits,
    `BEST VALUE sits on ${winner.credits.toLocaleString('en-US')} credits \u2014 the formula's answer`,
    `formula says ${winner.credits} (${tied.map((b) => b.credits).join('/')} tie at $${(bestRate / 100).toFixed(2)}), the file says ${data.bestValueCredits}`);

  // 4 · the tie-break must actually resolve — otherwise two rows could both be "the" winner
  const winners = bundles.filter((b) => b.credits === data.bestValueCredits);
  ok(winners.length === 1, 'the winner is unique', `${winners.length} bundles claim ${data.bestValueCredits}`);

  // 5 · ⚠️ POSITIVE CONTROL — prove the rule is LIVE, not a hard-coded 1,000.
  //     Discount the largest bundle to $13.00 (a permitted $1.30/1,000, above the floor)
  //     and the winner MUST move. If this stops moving, the gate is decorative.
  const discounted = bundles.map((b) =>
    b.credits === 10000 ? { ...b, priceCents: 1300 } : b);
  const ctrl = bestValue(discounted, tieBreak);
  ok(ctrl.winner.credits === 10000,
    'control: discounting 10,000 to $13.00 moves BEST VALUE to 10,000',
    `the rule still picked ${ctrl.winner.credits}`);

  // 6 · …and the control must itself respect the floor, or the test proves nothing
  ok(per1000({ credits: 10000, priceCents: 1300 }) >= floor,
    'control: that discount is still above the floor, so it is a legal price');

  report();
}

function report() {
  console.log('\u2500'.repeat(64));
  if (failures.length === 0) {
    console.log(`\u2713 all ${passed} credits-ladder checks passed\n`);
    process.exit(0);
  }
  console.log(`\u2717 ${failures.length} of ${passed + failures.length} credits-ladder checks FAILED:`);
  for (const f of failures) console.log(`    \u00b7 ${f}`);
  console.log('');
  process.exit(1);
}

main();
