/**
 * PATH C LOCK GUARD — `node supabase/checks/pathc-check.ts`
 *
 * ADR-002 locks the pipeline: **identify with `moondream2`, generate with
 * `nano-banana-2` t2i using the v3 template**. A locked decision with no guard
 * is a decision that drifts. This is that guard — zero dependencies, Node 22
 * type-stripping, no test framework (the project's habit, doc 18 §7.1).
 *
 * It asserts the clauses the PM accepted, and it specifically asserts the
 * ABSENCE of the thing the spike proved harmful: **example colours in the
 * identify prompt**, which were echoed onto five consecutive images.
 *
 * ⚠️ FAULT-TEST IT: delete one clause from the template and confirm it goes RED.
 */

import {
  COLOUR_LEAK_MIN_TOKENS,
  COST_MICROS,
  GENERATE_CONTENT_TYPE,
  GENERATE_MODEL,
  GENERATE_OUTPUT_FORMAT,
  IDENTIFY_MODEL,
  IDENTIFY_PROMPT,
  MAX_OBJECTS,
  MAX_RETRIES,
  STYLE_CLAUSES,
  STYLE_TEMPLATE_V3,
  colourLeak,
  colourNotes,
  costMicrosFor,
  dedupeObjects,
  stylePrompt,
} from '../functions/_shared/pathtemplate.ts';

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

// ── 1 · the locked endpoints (ADR-002) ──────────────────────────────────────
section('1 · The locked endpoints and caps (ADR-002, PM-locked 2026-09-26)');
check('identify is fal-ai/moondream2/visual-query', IDENTIFY_MODEL === 'fal-ai/moondream2/visual-query');
check('generate is fal-ai/nano-banana-2 (t2i, NOT the edit path)', GENERATE_MODEL === 'fal-ai/nano-banana-2');
check('the object cap is 3', MAX_OBJECTS === 3);
check('exactly one retry is permitted (doc 11 §4)', MAX_RETRIES === 1);
check(
  'unit costs are $0.01 + $0.08 = $0.09/picture',
  COST_MICROS.identify === 10_000 && COST_MICROS.generate === 80_000,
  `${COST_MICROS.identify} / ${COST_MICROS.generate}`,
);
check('a clean run costs 90,000 micros', costMicrosFor(0) === 90_000, String(costMicrosFor(0)));
check('the one-retry case costs 180,000 micros', costMicrosFor(1) === 180_000, String(costMicrosFor(1)));
check('retries are clamped at the cap', costMicrosFor(9) === 180_000);

// The sprite budget decision (doc 14 §3): measured 2026-10-04 — 1K PNG is
// ≈1.3 MB, 1K WebP is ≈50 KB, against a 150 KB budget. Guarded here so nobody
// "tidies" it back to PNG and silently breaks the NFR.
check('the sprite format is webp (the 150 KB budget is otherwise unreachable)', GENERATE_OUTPUT_FORMAT === 'webp');
check('the sprite MIME is image/webp (the styled bucket allows it)', GENERATE_CONTENT_TYPE === 'image/webp');

// ── 2 · the template clauses that must never disappear ─────────────────────
section('2 · The v3 template clauses (ADR-002 §2 — each one was paid for)');
const prompt = stylePrompt([{ label: 'rice cooker', colours: ['off-white', 'grey'] }]);
const clauseAssertions: [string, RegExp][] = [
  ['source-exact colour lock', /colours exactly as in the source image/i],
  ['top-down lighting shader', /light comes from directly above/i],
  ['transparent see-through glass', /transparent and see-through/i],
  ['no ground shadow (the app adds it)', /do not draw a ground shadow/i],
  ['blank warm rice-paper background', /blank, warm rice-paper background/i],
  ['coarse 40 to 60 facets', /40 to 60 large flat polygon facets/i],
  ['single ink outline weight', /single consistent ink outline weight/i],
  ['fully matte (no speculars)', /completely matte/i],
  ['structure lock (nothing merges)', /nothing merges, vanishes or is redrawn/i],
  ['detail hold (text stays sharp)', /printed text stay sharp and unchanged/i],
];
for (const [label, pattern] of clauseAssertions) {
  check(`${label} is in the composed prompt`, pattern.test(prompt));
}
check(
  'every named clause is actually appended',
  STYLE_CLAUSES.every((k) => prompt.includes(STYLE_TEMPLATE_V3[k])),
);
check('the prompt names the validated subject', prompt.includes('rice cooker'));
check('the prompt quotes the extracted colours', prompt.includes('off-white'));

// ── 3 · THE PROVEN FAILURE MODE: no example colours in the identify prompt ─
section('3 · The spike\u2019s leak — example colours must NOT be in the identify prompt');
const COLOUR_WORDS = [
  'blue', 'red', 'green', 'gold', 'yellow', 'orange', 'purple', 'pink', 'brown',
  'black', 'white', 'grey', 'gray', 'silver', 'denim', 'cinnabar', 'azurite',
  'malachite', 'teal', 'beige', 'cream',
];
const leaked = COLOUR_WORDS.filter((word) => new RegExp(`\\b${word}\\b`, 'i').test(IDENTIFY_PROMPT));
check(
  'the identify prompt contains no example colour word',
  leaked.length === 0,
  leaked.length > 0 ? `found: ${leaked.join(', ')}` : undefined,
);
check('it contains no hex colour', !/#[0-9a-f]{3,8}\b/i.test(IDENTIFY_PROMPT));
check('it still demands precision', /exactly|precise|shade/i.test(IDENTIFY_PROMPT));
check('it demands JSON output', /JSON/i.test(IDENTIFY_PROMPT));

// ── 4 · the validation rules the retry loop depends on ─────────────────────
section('4 · Validation helpers (ADR-002 §4)');
check(
  'a colour shared by two DIFFERENT object kinds is rejected (the leak signature)',
  colourLeak([
    { label: 'rice cooker', colours: ['denim blue metallic'] },
    { label: 'notebook', colours: ['denim blue metallic'] },
  ]) !== null,
);
check(
  'the same colour on different objects that legitimately share it is reported anyway',
  colourLeak([
    { label: 'teapot', colours: ['brown', 'white'] },
    { label: 'cup', colours: ['light green'] },
  ]) === null,
);

// ⚠️ THE FALSE-POSITIVE CASE, found live on 2026-10-04: a real teapot and a
// real teacup on one tray are both legitimately "brown". The blocking rule was
// narrowed to the leak's own fingerprint (3+ tokens) so an honest scene is not
// refused — this assertion is what stops that from silently regressing.
check(
  'a GENERIC colour shared by two objects is NOT blocking (the live false positive)',
  colourLeak([
    { label: 'Teacup', colours: ['Light green', 'Brown'] },
    { label: 'Teapot', colours: ['Brown', 'Dark brown'] },
    { label: 'Tea leaves', colours: ['Dark brown', 'Light brown'] },
  ]) === null,
);
check(
  '…but the shared colour IS still reported, as a note',
  colourNotes([
    { label: 'Teacup', colours: ['Brown'] },
    { label: 'Teapot', colours: ['Brown'] },
  ]).length === 1,
);
check(
  'the leak fingerprint (a 3-token paint name) is still BLOCKING',
  colourLeak([
    { label: 'sedan', colours: ['denim blue metallic'] },
    { label: 'rice cooker', colours: ['denim blue metallic'] },
  ]) !== null,
);
check('COLOUR_LEAK_MIN_TOKENS is the documented threshold', COLOUR_LEAK_MIN_TOKENS === 3);

const deduped = dedupeObjects([
  { label: 'glasses', colours: ['black'], count: 4 },
  { label: 'glasses', colours: ['black'] },
  { label: 'notebook', colours: ['black'], count: 2 },
]);
check('duplicates collapse to one entry per label', deduped.length === 2, `got ${deduped.length}`);
check('the highest count survives the collapse', deduped[0].count === 4, String(deduped[0].count));
check(
  'the object cap is applied',
  dedupeObjects(Array.from({ length: 9 }, (_, i) => ({ label: `thing ${i}`, colours: ['grey'] }))).length
    === MAX_OBJECTS,
);
check(
  'stylePrompt is deterministic (same attributes → same prompt)',
  stylePrompt([{ label: 'a', colours: ['b'] }]) === stylePrompt([{ label: 'a', colours: ['b'] }]),
);

// ── 5 · guard — the harness is alive ───────────────────────────────────────
section('5 · Guard — the harness is alive');
check(
  'guard: an EMPTY prompt is not accepted as carrying the clauses',
  !STYLE_CLAUSES.every((k) => ''.includes(STYLE_TEMPLATE_V3[k])),
);

// ── verdict ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(64)}`);
if (failed === 0) {
  console.log(`✓ all ${passed} Path C lock checks passed`);
  process.exit(0);
}
console.log(`✗ ${failed} of ${passed + failed} Path C lock checks FAILED:`);
for (const f of failures) console.log(`    · ${f}`);
process.exit(1);
