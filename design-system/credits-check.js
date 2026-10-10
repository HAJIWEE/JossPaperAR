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

  const ceiling = data.ceiling.centsPer1000;
  const base = data.pricing.baseCentsPer1000;
  const step = data.pricing.premiumStepCents;
  const floor = data.floor.centsPer1000;
  const bundles = data.bundles;
  const tieBreak = data.bestValueTieBreak === 'largest' ? 'largest' : 'smallest';

  // 1 · ⚠️ THE SHELF *IS* THE LADDER RULE, not five hand-typed numbers.
  //     Largest = base rate; every step DOWN adds one premium step per 1,000.
  //     Change base or step and the prices must follow — that is what "formulaic" means.
  const desc = [...bundles].sort((a, b) => b.credits - a.credits);   // largest first
  const expected = (credits, i) => Math.round(((base + step * i) * credits) / 1000);
  const offRule = desc.filter((b, i) => b.priceCents !== expected(b.credits, i));
  ok(offRule.length === 0,
    `every bundle follows the ladder rule ($${(base / 100).toFixed(2)} base, +$${(step / 100).toFixed(2)}/1,000 per step down)`,
    offRule.map((b) => `${b.credits}: ${money(b.priceCents)} should be ${money(expected(b.credits, desc.indexOf(b)))}`).join(' · '));

  // 2 · the APPRECIATING PREMIUM — the less you commit, the more each credit costs.
  //     ⚠️ This is the PM's intent in one line: a smaller bundle may never undercut a larger one.
  const brokenSteps = desc.slice(1).filter((b, i) => per1000(b) <= per1000(desc[i]));
  ok(brokenSteps.length === 0,
    'the ladder is an appreciating premium — every step down costs more per 1,000',
    brokenSteps.map((b) => `${b.credits} at $${(per1000(b) / 100).toFixed(2)}/1,000 does not beat ${desc[desc.indexOf(b) - 1].credits}`).join(' · '));

  // 3 · the ceiling still binds: no bundle may cost more per credit than doc 10's rate
  const overCeiling = bundles.filter((b) => b.priceCents > priceCentsFor(b.credits, ceiling) + 1);
  ok(overCeiling.length === 0,
    `no bundle is priced above the $${(ceiling / 100).toFixed(2)}/1,000 ceiling (doc 10)`,
    overCeiling.map((b) => `${b.credits}: ${money(b.priceCents)}`).join(' · '));

  // 2 · the floor binds, and the average must clear it (doc 10's own constraint on bundles)
  const belowFloor = bundles.filter((b) => per1000(b) < floor);
  ok(belowFloor.length === 0,
    `no bundle is under the $${(floor / 100).toFixed(2)}/1,000 floor`,
    belowFloor.map((b) => `${b.credits} at $${(per1000(b) / 100).toFixed(2)}`).join(' · '));

  // 2b · ⚠️ TWO different averages, and the difference is NOT cosmetic. The credit-WEIGHTED
  //      one is what the shelf actually collects per credit; the naive mean of the five rates
  //      gives a 500-credit bundle the same say as a 10,000-credit one, which no real basket
  //      resembles. ⚠️ My first version printed the NAIVE mean as "the ladder average" — $1.24
  //      where the weighted truth is $1.22 — and I copied that figure into five docs without
  //      re-deriving it. A check's own message is not evidence.
  const totalCents = bundles.reduce((a, b) => a + b.priceCents, 0);
  const totalCredits = bundles.reduce((a, b) => a + b.credits, 0);
  const weighted = (totalCents / totalCredits) * 1000;
  const naive = bundles.reduce((a, b) => a + per1000(b), 0) / bundles.length;
  // ⚠️ DISCLOSURE, NOT INDEPENDENT EVIDENCE: every bundle is already asserted ≥ floor above,
  //    and a weighted mean of values that are all ≥ floor cannot fall below it — so this line
  //    can only go red if the check above did. It is here to be VISIBLE, not to add proof.
  ok(weighted >= floor,
    `the shelf's credit-weighted average is $${(weighted / 100).toFixed(2)}/1,000 — at or above the floor`,
    `weighted $${(weighted / 100).toFixed(3)} · naive rate-mean $${(naive / 100).toFixed(3)} (both implied by the per-bundle floor)`);

  // 2c · …and prove the two averages really are different formulas, on FIXED inputs. ⚠️ Testing
  //      it on the live ladder would be a gate that cries wolf: a legal-but-nearly-flat shelf
  //      can bring the two within a fraction of a cent, and that is not a defect.
  const demo = [{ credits: 10000, priceCents: 1200 }, { credits: 500, priceCents: 64 }];
  const demoWeighted = (demo.reduce((a, b) => a + b.priceCents, 0) / demo.reduce((a, b) => a + b.credits, 0)) * 1000;
  const demoNaive = demo.reduce((a, b) => a + (b.priceCents / b.credits) * 1000, 0) / demo.length;
  ok(demoWeighted !== demoNaive,
    'control: the weighted and naive averages are different quantities',
    `weighted ${demoWeighted.toFixed(2)}¢ vs naive ${demoNaive.toFixed(2)}¢ on the same pair`);

  // 3 · ⚠️ THE ONE THAT MATTERS: the badge is where the formula puts it
  const { bestRate, tied, winner } = bestValue(bundles, tieBreak);
  ok(winner.credits === data.bestValueCredits,
    `BEST VALUE sits on ${winner.credits.toLocaleString('en-US')} credits \u2014 the formula's answer`,
    `formula says ${winner.credits} (${tied.map((b) => b.credits).join('/')} tie at $${(bestRate / 100).toFixed(2)}), the file says ${data.bestValueCredits}`);

  // 4 · the tie-break must actually resolve — otherwise two rows could both be "the" winner
  const winners = bundles.filter((b) => b.credits === data.bestValueCredits);
  ok(winners.length === 1, 'the winner is unique', `${winners.length} bundles claim ${data.bestValueCredits}`);

  // 6 · ⚠️ POSITIVE CONTROLS — prove the two rules above actually BITE.
  //     (a) undercut the SMALLEST bundle and the premium is broken…
  const undercut = [...bundles.map((b) => (b.credits === 500 ? { ...b, priceCents: 55 } : b))]
    .sort((a, b) => b.credits - a.credits);
  ok(!undercut.slice(1).every((b, i) => per1000(b) > per1000(undercut[i])),
    'control: undercutting the SMALLEST bundle breaks the premium — the check bites');
  //     (b) …and hand-tweak one price and it no longer follows the rule.
  const tweaked = [...bundles.map((b) => (b.credits === 6000 ? { ...b, priceCents: 700 } : b))]
    .sort((a, b) => b.credits - a.credits);
  ok(tweaked.filter((b, i) => b.priceCents !== expected(b.credits, i)).length > 0,
    'control: a hand-tweaked price no longer follows the ladder rule — the check bites');

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
