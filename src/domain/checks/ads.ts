/**
 * THE AD-DENYLIST GATE — `node src/domain/checks/ads.ts`  (SCRUM-63 · ADR-008 D)
 *
 * Zero dependencies, no test framework — the same habit as `checks/run.ts` (doc 05 §2):
 * behaviour is checked by a MACHINE that can fail, the verdict is read back, and the
 * harness is **fault-tested** so a dead harness cannot read as a pass.
 *
 * What this gate is FOR — and what it is not:
 *   ✅ It guards the **policy of record**: the five classes, their legal basis, the
 *      placement rule and the volume caps cannot drift without turning this red.
 *   ✅ It guards the **false-positive alibi**: our own ritual vocabulary must never be
 *      classified as a blocked ad category.
 *   ❌ It is NOT the runtime ad filter. Nothing can be filtered at runtime until an SDK
 *      exists (doc 19 §6.2 item 11 is deferred) — and the SDK's own category blocks plus
 *      the Ad review center remain the primary controls. This is the *secondary* net.
 */

import {
  AD_CLASSES,
  DENY_KEYWORDS,
  HEADLINE_NO_CLASSES,
  AD_CAPS,
  PROTECTED_MOMENTS,
  RITUAL_FLOW_STEPS,
  adClassById,
  classifyAdText,
  isAdPlacementAllowed,
  type AdBasis,
  type AdClassId,
} from '../adCategories.ts';

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

const VALID_BASIS: readonly AdBasis[] = ['statutory', 'regulatory_direction', 'policy'];

// ── 1 · Every class is complete and unambiguous ──────────────────────────────
section('1 · Taxonomy shape (SCRUM-63 Q1)');

const EXPECTED: readonly AdClassId[] = ['gambling', 'loans', 'alcohol', 'nicotine', 'unhealthy_food'];
check(
  'all five classes exist, once each',
  AD_CLASSES.length === 5 && EXPECTED.every((id) => AD_CLASSES.filter((c) => c.id === id).length === 1),
);

for (const cls of AD_CLASSES) {
  check(
    `${cls.id}: label · basis · instrument · regulator · ≥3 includes · ≥1 excludes · note`,
    Boolean(cls.label) &&
      VALID_BASIS.includes(cls.basis) &&
      Boolean(cls.instrument) &&
      Boolean(cls.regulator) &&
      cls.includes.length >= 3 &&
      cls.excludes.length >= 1 &&
      cls.note.length > 40,
  );
}

check('every class has deny keywords', EXPECTED.every((id) => DENY_KEYWORDS[id].length >= 3));

// ── 2 · THE BASIS ASSERTIONS — mandated vs our own policy ────────────────────
// The heart of the research: a class may only claim to be compelled by law if an
// instrument actually compels it.
section('2 · Legal basis — mandated vs our own stricter policy (SCRUM-63 Q2)');

check('gambling is STATUTORY (Gambling Control Act 2022)', adClassById('gambling').basis === 'statutory');
check(
  'loans is a REGULATORY DIRECTION (Moneylenders Act s.29(3) r/w s.45(1))',
  adClassById('loans').basis === 'regulatory_direction',
);
check(
  'alcohol is OUR POLICY, not law — Singapore has no statutory alcohol ad ban',
  adClassById('alcohol').basis === 'policy',
);
check('nicotine is STATUTORY (Tobacco and Vaporisers Control Act)', adClassById('nicotine').basis === 'statutory');
check('unhealthy_food is STATUTORY (Food Regulations reg. 184E–184F)', adClassById('unhealthy_food').basis === 'statutory');
check(
  'the policy-basis classes claim NO instrument (the honest default)',
  AD_CLASSES.filter((c) => c.basis === 'policy').every((c) => c.instrument.startsWith('—')),
);
check(
  'the statute/direction-basis classes each name an instrument',
  AD_CLASSES.filter((c) => c.basis !== 'policy').every((c) => c.instrument.length > 20),
);

// ── 3 · The taxonomy is precise enough to implement ──────────────────────────
// SCRUM-63 Q1's own examples: "loans" must not be one vague blob, and the vape
// question is answered in the nicotine class rather than left inside alcohol.
section('3 · The under-specification trap (SCRUM-63 Q1)');

const loans = adClassById('loans');
const gambling = adClassById('gambling');
check('loans names PAYDAY separately', loans.includes.some((i) => i.includes('payday')));
check('loans names BNPL separately', loans.includes.some((i) => i.toLowerCase().includes('bnpl')));
check('loans spans credit cards through pawnbroking', loans.includes.length >= 6);
check('gambling names SOCIAL CASINO (the gateway inventory)', gambling.includes.some((i) => i.includes('social casino')));
check('gambling names esports betting', gambling.includes.some((i) => i.includes('esports')));
check(
  'vaping lives in the NICOTINE class, not under alcohol',
  adClassById('nicotine').includes.some((i) => i.includes('vape')) &&
    !adClassById('alcohol').includes.some((i) => i.toLowerCase().includes('vape')),
);
check(
  'unhealthy_food names Nutri-Grade "D" explicitly',
  adClassById('unhealthy_food').includes.some((i) => i.includes('Nutri-Grade "D"')),
);

// ── 4 · ADR-008's headline answer survives ───────────────────────────────────
section('4 · ADR-008 clause D — the PM’s strong NO');

check(
  'the headline NO classes are exactly gambling · loans · alcohol',
  HEADLINE_NO_CLASSES.length === 3 &&
    ['gambling', 'loans', 'alcohol'].every((id) => HEADLINE_NO_CLASSES.includes(id as AdClassId)),
);

// ── 5 · The placement rule — post-ritual only ───────────────────────────────
section('5 · Placement (ADR-008 — no ad may intersect the ritual)');

for (const step of RITUAL_FLOW_STEPS) {
  check(`ritual step "${step}" has NO ad slot`, !isAdPlacementAllowed(`ritual_${step}`));
}
check(
  'the ~15 s generation wait is ad-free (ADR-008’s first failure mode)',
  !isAdPlacementAllowed('generation_wait'),
);
check('no ad while ancestor names are on screen', !isAdPlacementAllowed('ancestor_names_visible'));
check(
  'the tablets / ancestor sheet / Book of Tributes are ad-free',
  !isAdPlacementAllowed('tablets') &&
    !isAdPlacementAllowed('ancestor_sheet') &&
    !isAdPlacementAllowed('book_of_tributes'),
);
for (const surface of ['home', 'league', 'screen_transition', 'post_ritual']) {
  check(`surface "${surface}" may carry an ad`, isAdPlacementAllowed(surface));
}
check(
  'DENY BY DEFAULT — an unknown surface is refused, not allowed',
  !isAdPlacementAllowed('some_screen_added_later') && !isAdPlacementAllowed('ritual'),
);
check(
  'caps are 2 on app start / 3 in a row post-ritual (clause B)',
  AD_CAPS.appStartInterstitials === 2 && AD_CAPS.consecutivePostRitual === 3,
);
check(
  'Qingming and Hungry Ghost are protected moments (clause C)',
  PROTECTED_MOMENTS.includes('qingming') && PROTECTED_MOMENTS.includes('hungry_ghost'),
);

// ── 6 · The review-time heuristic works, and does not misfire on us ─────────
section('6 · Heuristic classification + the false-positive alibi');

check('"Free spins at our casino" → gambling', classifyAdText('Free spins at our casino').includes('gambling'));
check('"Instant payday loan, fast cash" → loans', classifyAdText('Instant payday loan, fast cash').includes('loans'));
check('"Buy now, pay later — 0% interest" → loans', classifyAdText('Buy now, pay later — 0% interest').includes('loans'));
check('"Ice-cold beer, happy hour" → alcohol', classifyAdText('Ice-cold beer, happy hour').includes('alcohol'));
check('"Try our vape pod system" → nicotine', classifyAdText('Try our vape pod system').includes('nicotine'));
check('a clean creative matches nothing', classifyAdText('Handmade ceramic teacups, free shipping').length === 0);

// The guard that matters most: our OWN copy must never trip the filter.
const RITUAL_VOCABULARY: readonly string[] = [
  "Today's offerings are complete — the shrine rests until dawn.",
  'Watch to prepare one more offering.',
  'The shrine is receiving many offerings — yours will be prepared shortly.',
  'The offering could not be prepared — your points have returned.',
  'Tribute points earned · 正中 · 虔诚 · 擦边',
  'Ancestor altar · tablets · Book of Tributes',
  'Burn joss paper for your ancestors',
];
for (const copy of RITUAL_VOCABULARY) {
  check(`our own copy is never blocked: "${copy.slice(0, 34)}…"`, classifyAdText(copy).length === 0);
}

// ── 7 · FAULT-TEST THE HARNESS ITSELF ───────────────────────────────────────
section('7 · Guard — the harness is alive');

check(
  'guard: alcohol is NOT statutory (a dead harness would wrongly pass the §2 block)',
  (adClassById('alcohol').basis === 'statutory') === false,
);
check('guard: a ritual slot is NOT ad-eligible', isAdPlacementAllowed('ritual_burn') === false);

// ── verdict ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(64)}`);
if (failed === 0) {
  console.log(`✓ all ${passed} ad-denylist checks passed`);
  process.exit(0);
} else {
  console.log(`✗ ${failed} of ${passed + failed} ad-denylist checks FAILED:`);
  for (const f of failures) console.log(`    · ${f}`);
  process.exit(1);
}
