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

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CARTOONIZED_OBJECTS,
  COLOUR_LEAK_MIN_TOKENS,
  COST_MICROS,
  CUTOUT_CONTENT_TYPE,
  CUTOUT_MODEL,
  CUTOUT_OPERATING_RESOLUTION,
  CUTOUT_OUTPUT_FORMAT,
  CUTOUT_VARIANT,
  GENERATE_CONTENT_TYPE,
  GENERATE_MODEL,
  GENERATE_OUTPUT_FORMAT,
  IDENTIFY_MODEL,
  IDENTIFY_PROMPT,
  MAX_OBJECTS,
  MAX_RETRIES,
  PROMINENCE_WEIGHTS,
  STATED_PROMINENCE_DEFAULT,
  STYLE_CLAUSES,
  STYLE_TEMPLATE_V3,
  colourLeak,
  colourNotes,
  costMicrosFor,
  dedupeObjects,
  prominenceOf,
  rankObjects,
  selectSubject,
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

/**
 * The repo root, so this check can assert what the PIPELINE *does*, not only
 * what its constants *say*.
 *
 * ⚠️ THAT DISTINCTION IS THE WHOLE POINT HERE. Deleting the stage-④ call from
 * `pathc.ts` would leave every constant intact and every other assertion green
 * — which is precisely how "clean background by construction" survived long
 * enough to ship an opaque cream card. The last checks in §1b read this file.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pipelineSource = readFileSync(join(ROOT, 'supabase/functions/_shared/pathc.ts'), 'utf8');

// ── 1 · the locked endpoints (ADR-002) ──────────────────────────────────────
section('1 · The locked endpoints and caps (ADR-002, PM-locked 2026-09-26)');
check('identify is fal-ai/moondream2/visual-query', IDENTIFY_MODEL === 'fal-ai/moondream2/visual-query');
check('generate is fal-ai/nano-banana-2 (t2i, NOT the edit path)', GENERATE_MODEL === 'fal-ai/nano-banana-2');
check('the object cap is 3', MAX_OBJECTS === 3);
check(
  '…and exactly ONE of them is cartoonized (ADR-002 Amendment 3)',
  CARTOONIZED_OBJECTS === 1,
  String(CARTOONIZED_OBJECTS),
);
check(
  'the prominence weights sum to 1 (a score is already in 0–1)',
  Math.abs(
    PROMINENCE_WEIGHTS.stated + PROMINENCE_WEIGHTS.order + PROMINENCE_WEIGHTS.count - 1,
  ) < 1e-9,
);
check(
  'the count term is a TIE-BREAK — it cannot overturn the SMALLEST step of order',
  // ⚠️ The real invariant, not a vibes-check. With `MAX_OBJECTS` objects the
  // narrowest order gap is `order / MAX_OBJECTS`; if `count` ever exceeds it, a
  // repeated object could out-rank a better-positioned one and the "tie-break"
  // label would be a lie.
  PROMINENCE_WEIGHTS.count < PROMINENCE_WEIGHTS.order / MAX_OBJECTS,
  `${PROMINENCE_WEIGHTS.count} vs ${PROMINENCE_WEIGHTS.order} / ${MAX_OBJECTS}`,
);
check('exactly one retry is permitted (doc 11 §4)', MAX_RETRIES === 1);
check(
  'unit costs are $0.01 + $0.08 + $0.001 = $0.091/picture',
  COST_MICROS.identify === 10_000
    && COST_MICROS.generate === 80_000
    && COST_MICROS.cutout === 1_000,
  `${COST_MICROS.identify} / ${COST_MICROS.generate} / ${COST_MICROS.cutout}`,
);
check('a clean run costs 91,000 micros', costMicrosFor(0) === 91_000, String(costMicrosFor(0)));
check('the one-retry case costs 182,000 micros', costMicrosFor(1) === 182_000, String(costMicrosFor(1)));
check('retries are clamped at the cap', costMicrosFor(9) === 182_000);

// The sprite budget decision (doc 14 §3): measured 2026-10-04 — 1K PNG is
// ≈1.3 MB, 1K WebP is ≈50 KB, against a 150 KB budget. Guarded here so nobody
// "tidies" it back to PNG and silently breaks the NFR.
check('the sprite format is webp (the 150 KB budget is otherwise unreachable)', GENERATE_OUTPUT_FORMAT === 'webp');
check('the sprite MIME is image/webp (the styled bucket allows it)', GENERATE_CONTENT_TYPE === 'image/webp');

// ── 1b · STAGE ④ — the cutout that makes the sprite TRANSPARENT ─────────────
//
// ⚠️ MEASURED ON GLASS 2026-10-18: without this stage the stored WebP is an
// OPAQUE CREAM CARD (#F3EDD8) floating over the live camera. "Clean background
// by construction" was true of the CONTENTS and false of the ALPHA CHANNEL —
// a t2i model paints the background and emits no transparency. ADR-002
// Amendment 2 adds the cut; these assertions stop it being dropped again.
section('1b · Stage ④ — the cutout (ADR-002 Amendment 2, measured 2026-10-18)');
check('the cutout is fal-ai/birefnet/v2', CUTOUT_MODEL === 'fal-ai/birefnet/v2');
check(
  'it runs the variant the measurement chose',
  CUTOUT_VARIANT === 'General Use (Light)',
  CUTOUT_VARIANT,
);
check(
  'it operates at the 1K point the generator used',
  CUTOUT_OPERATING_RESOLUTION === '1024x1024',
  CUTOUT_OPERATING_RESOLUTION,
);
check(
  'it ASKS for webp — PNG is the endpoint default and is 1.3 MB-class',
  CUTOUT_OUTPUT_FORMAT === 'webp' && CUTOUT_CONTENT_TYPE === 'image/webp',
  `${CUTOUT_OUTPUT_FORMAT} / ${CUTOUT_CONTENT_TYPE}`,
);
// The cutout produces the bytes that are stored, so ITS container is the
// sprite's container. If these ever disagree, the bucket MIME and the client's
// decoder both break — and the failure would look like a missing image.
check(
  'the cutout format IS the stored sprite format (nothing re-encodes in between)',
  CUTOUT_OUTPUT_FORMAT === GENERATE_OUTPUT_FORMAT && CUTOUT_CONTENT_TYPE === GENERATE_CONTENT_TYPE,
  `${CUTOUT_OUTPUT_FORMAT} vs ${GENERATE_OUTPUT_FORMAT}`,
);
check(
  'the paid cutout is inside the per-picture unit cost',
  costMicrosFor(0) === COST_MICROS.identify + COST_MICROS.generate + COST_MICROS.cutout,
  String(costMicrosFor(0)),
);

// ⚠️ THE ASSERTIONS THAT WOULD HAVE CAUGHT THE ORIGINAL BUG: constants alone
// prove nothing about the pipeline that uses them.
check(
  'the pipeline ACTUALLY runs the cutout',
  /falRun\(\s*CUTOUT_MODEL/.test(pipelineSource),
);
check(
  'the cutout is asked for webp explicitly',
  /output_format:\s*CUTOUT_OUTPUT_FORMAT/.test(pipelineSource),
);
check(
  'the URL it returns is the CUTOUT, not the generator frame',
  /const styledUrl = cut\?\.image\?\.url/.test(pipelineSource),
);
check(
  'guard: the source assertion is not vacuous (the file was really read)',
  pipelineSource.includes('export async function runPathC') && pipelineSource.length > 5_000,
  `${pipelineSource.length} chars`,
);

// ── 1c · THE SELECTION STAGE — detect ≤3, cartoonize 1 (Amendment 3) ────────
//
// ⚠️ WHY THIS SECTION IS BEHAVIOURAL, NOT JUST CONSTANT-READING. The owner's
// decision ("only 1 object cartoonized") is enforced by `stylePrompt` taking ONE
// object instead of an array — but a caller could still reintroduce a list by
// widening the signature, and every constant would stay green. The last three
// checks read `pathc.ts` and assert the pipeline really ranks and really passes
// the subject, the same way §1b asserts the cutout is really called.
section('1c · The selection stage — detect ≤3, cartoonize 1 (ADR-002 Amendment 3)');

const threeObjects = [
  { label: 'bicycle', colours: ['dark green'] },
  { label: 'teapot', colours: ['brown'] },
  { label: 'notebook', colours: ['grey'] },
];
const rankedThree = rankObjects(threeObjects);

check(
  'with nothing stated, the FIRST-named object wins (the prompt asks largest/most central first)',
  rankedThree[0].label === 'bicycle',
  rankedThree.map((o) => `${o.label}:${o.score.toFixed(3)}`).join(' '),
);
check(
  'the ranking is ordered, best first',
  rankedThree[0].score >= rankedThree[1].score && rankedThree[1].score >= rankedThree[2].score,
);
check(
  'every score is inside 0–1',
  rankedThree.every((o) => o.score >= 0 && o.score <= 1),
);
check(
  'the ranking is a PROBABILITY distribution (sums to 1)',
  Math.abs(rankedThree.reduce((sum, o) => sum + o.probability, 0) - 1) < 1e-9,
  String(rankedThree.reduce((sum, o) => sum + o.probability, 0)),
);
check(
  'a single object is a certainty (probability 1)',
  rankObjects([{ label: 'lone', colours: ['grey'] }])[0].probability === 1,
);

// The model's own hint must be able to OVERRIDE the naming order — otherwise it
// is not a hint, it is decoration. 0.95 vs 0.10 has to beat a full order step.
const stated = rankObjects([
  { label: 'the desk behind it', colours: ['grey'], prominence: 0.1 },
  { label: 'the offering', colours: ['cinnabar'] },
  { label: 'the offering again', colours: ['cinnabar'], prominence: 0.95 },
]);
check(
  'a stated prominence overrides the naming order',
  stated[0].label === 'the offering again',
  stated.map((o) => `${o.label}:${o.probability.toFixed(2)}`).join(' '),
);

// ⚠️ THE CASE THE FIRST WEIGHT SET GOT WRONG, AND WHY IT IS A CHECK. At
// `0.5 / 0.4 / 0.1` a second object the model had ranked **0.9** scored a DEAD
// TIE with the unstated first object (0.650 vs 0.650) and lost on array order —
// so the model's own ranking was worth nothing. `order` could out-shift `stated`.
// These two assertions pin both halves: a strong hint WINS, a weak one does not.
const strongHint = rankObjects([
  { label: 'the cluttered desk', colours: ['grey'] },
  { label: 'the offering', colours: ['cinnabar'], prominence: 0.9 },
]);
check(
  'a STRONG stated hint beats an unstated first object (the 0.9 tie the smoke test found)',
  strongHint[0].label === 'the offering',
  strongHint.map((o) => `${o.label}:${o.score.toFixed(3)}`).join(' '),
);
const weakHint = rankObjects([
  { label: 'the offering', colours: ['cinnabar'] },
  { label: 'the cluttered desk', colours: ['grey'], prominence: 0.55 },
]);
check(
  '…but a WEAK hint does NOT (the hint is evidence, not a trump)',
  weakHint[0].label === 'the offering',
  weakHint.map((o) => `${o.label}:${o.score.toFixed(3)}`).join(' '),
);

// …and the count term must NOT be able to. Order 1.0 vs 0.5 is a 0.4 step; the
// count boost is 0.1. If this ever flips, the weights were retuned carelessly.
const counted = rankObjects([
  { label: 'candle', colours: ['cream'] },
  { label: 'candles', colours: ['cream'], count: 4 },
]);
check(
  'a repeated object does NOT out-rank the first-named one (count is only a tie-break)',
  counted[0].label === 'candle',
  counted.map((o) => `${o.label}:${o.score.toFixed(3)}`).join(' '),
);

check(
  'the empty set ranks to nothing and selects nothing (no crash, no subject)',
  rankObjects([]).length === 0 && selectSubject([]) === null,
);

// ⚠️ AN UNUSABLE HINT MUST NOT COST A RETRY. `prominence` is optional, and the
// retry is ≈US$0.09 — so a malformed value is DROPPED and the analysis falls
// back to order, rather than failing the whole answer.
check(
  'a malformed prominence is DROPPED, never a validation failure',
  prominenceOf(undefined) === undefined
    && prominenceOf(null) === undefined
    && prominenceOf('') === undefined
    && prominenceOf('a lot') === undefined
    && prominenceOf(NaN) === undefined,
);
check(
  'a usable prominence is coerced and CLAMPED into 0–1',
  prominenceOf('0.8') === 0.8 && prominenceOf(1.5) === 1 && prominenceOf(-2) === 0,
);
check(
  'an unstated object falls back to the neutral default, not to zero',
  STATED_PROMINENCE_DEFAULT === 0.5
    && rankObjects([{ label: 'a', colours: ['grey'] }])[0].probability === 1,
);

// The prompt must actually ASK for the hint, or the analysis can never see one.
check(
  'the identify prompt asks for the prominence hint',
  /prominence/i.test(IDENTIFY_PROMPT),
);
check(
  '…and still asks for the objects in size/centrality order',
  /largest and most central first/i.test(IDENTIFY_PROMPT),
);

// ⚠️ THE ASSERTIONS THAT WOULD HAVE CAUGHT THE ORIGINAL BUG: constants alone
// prove nothing about the pipeline that uses them.
check(
  'the pipeline ACTUALLY ranks and selects one object',
  /selectSubject\(objects\)/.test(pipelineSource),
);
check(
  'the generator is handed the SUBJECT, not the list',
  /stylePrompt\(subject\)/.test(pipelineSource),
);
check(
  '…and never the array (the old defect: `stylePrompt(objects)`)',
  !/stylePrompt\(objects\)/.test(pipelineSource),
);
check(
  'the selection is LOGGED with its probabilities (a substitution must be visible)',
  /chosen from \$\{ranked\.length\} detected/.test(pipelineSource),
);
// ⚠️ THE LOOSE-SCHEMA DECISION IS GATED TOO. `prominence` must stay a union of
// number|string — a VQA model answers in prose, and a strict `z.number()` would
// turn a string hint into a whole-answer validation failure and buy a retry. The
// value must still pass through `prominenceOf` before the ranking sees it.
check(
  'the schema accepts a prominence as a number OR a string',
  /prominence: z\.union\(\[z\.number\(\), z\.string\(\)\]\)\.optional\(\)/.test(pipelineSource),
);
check(
  '…and it is normalised by prominenceOf, never used raw',
  /const prominence = prominenceOf\(o\.prominence\)/.test(pipelineSource),
);

// ── 2 · the template clauses that must never disappear ─────────────────────
section('2 · The v3 template clauses (ADR-002 §2 — each one was paid for)');
const prompt = stylePrompt({ label: 'rice cooker', colours: ['off-white', 'grey'] });
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
// ⚠️ THE MERGE BRANCH BUILDS A FRESH OBJECT, so `prominence` has to be carried
// by hand — otherwise a duplicate that stated its prominence would silently lose
// it and the ranking would fall back to order for an object the model ranked.
check(
  'a merge does NOT eat the prominence signal (the highest survives)',
  dedupeObjects([
    { label: 'glasses', colours: ['black'], prominence: 0.2 },
    { label: 'glasses', colours: ['black'], prominence: 0.9 },
  ])[0].prominence === 0.9,
);
check(
  'the object cap is applied',
  dedupeObjects(Array.from({ length: 9 }, (_, i) => ({ label: `thing ${i}`, colours: ['grey'] }))).length
    === MAX_OBJECTS,
);
check(
  'stylePrompt is deterministic (same attributes → same prompt)',
  stylePrompt({ label: 'a', colours: ['b'] }) === stylePrompt({ label: 'a', colours: ['b'] }),
);
// ⚠️ THE OTHER HALF OF AMENDMENT 3: a subject's `count` is recorded but NOT
// rendered. `STYLE_TEMPLATE_V3.output` demands one object, so a "3 × candle"
// subject would contradict the very clause the one-object decision rests on.
check(
  'the prompt never renders a count multiplier (one object means one)',
  !stylePrompt({ label: 'candle', colours: ['cream'], count: 3 }).includes('3 ×'),
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
