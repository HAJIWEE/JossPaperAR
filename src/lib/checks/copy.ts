/**
 * COPY CHECKS — `node src/lib/checks/copy.ts`
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * A reviewer opened a screen marked 中文 and found **English labels on its buttons and
 * titles**. The cause was not a bad translation; it was copy that never went through
 * `t()` at all:
 *
 *   1. **Bilingual-by-construction.** Four sites rendered `{value.zh} {value.en}` — BOTH
 *      languages, in EVERY locale — so a 中文 panel showed English and an EN panel showed
 *      Chinese. `burn.tsx`, `reward.tsx` (twice) and `index.tsx`.
 *   2. **Hardcoded literals.** `burn.tsx` and `capture.tsx` did not import `t` at all:
 *      `开始 · Begin`, `上滑对准火心抛入 · Swipe up & aim…`, `确认 · Confirm`,
 *      `The camera is needed`, `Try again`, `Balance …` — 18 strings across four screens.
 *   3. **A silent English fallback.** A bilingual value with no `zh` degrades to English
 *      (`localized`), so `check:lib` section 15 asserts every domain value carries both.
 *
 * ⚠️ A SCREENSHOT CAUGHT THIS, NOT A GATE — which is why this file exists. The lesson is
 * the project's own: a check that cannot see the defect is not a check. `tsc` cannot see
 * copy, and `check:lib` only sees the message table, never the screens.
 *
 * ── WHAT IT ASSERTS ────────────────────────────────────────────────────────
 *   1. no `{x.zh} {x.en}` — the both-languages bug, matched exactly
 *   2. no user-visible literal in a JSX text node or a `label`/`title`/
 *      `accessibilityLabel` prop, unless it is routed through `t()` / `localized()`
 *
 * ⚠️ Deliberately NOT flagged: `testID`/`style` values (not user-visible), `placeholder`
 * example text (`ABCDEFGH` is a code example, not copy), `accessibilityRole="button"`
 * (a role, not copy), and EM DASHES / numerals (no ASCII letters).
 *
 * ⚠️ ONE EXEMPTION, PRINTED RATHER THAN SILENT: `src/app/index.tsx` is the SCRUM-53
 * scaffold, and its prose ("The shell is alive", "doc 10 §1 · S13d …") documents the
 * NUMBERS for a reviewer. Localising developer documentation is wasted work; the real
 * shrine replaces it. Its user-visible CONTROLS are localised, and are asserted by rule 2
 * the moment the file leaves the exemption list.
 *
 * ⚠️ FAULT-TEST IT: put a literal back into `burn.tsx` and confirm it goes RED.
 */
import fs from 'node:fs';
import path from 'node:path';

const PROJ = path.join(import.meta.dirname, '..', '..', '..');
const ROOTS = ['src/app', 'src/components'];

/** The only exemption, and the reason is printed so it cannot pass unnoticed. */
const EXEMPT = new Map([
  ['src/app/index.tsx', 'the SCRUM-53 scaffold — its prose documents the numbers for a reviewer'],
]);

/** Renders BOTH languages in every locale. Matched exactly, because it is unambiguous. */
const BILINGUAL = [/\.zh\s*\}\s*\{[^}]*\.en/, /\.en\s*\}\s*\{[^}]*\.zh/];
/** User-visible literals: a JSX text node, or a label/title/accessibilityLabel prop. */
const JSX_TEXT = />\s*([^<>{}\n]{2,})\s*</g;
const ATTR = /(?:label|title|accessibilityLabel)\s*=\s*(["'])([^"']{2,})\1/g;
/** Attribute VALUES that are code handles or example text, never copy. */
const NON_COPY_ATTR = /(testID|style)(\s*=\s*)(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|"[^"]*"|'[^']*')/g;
const PLACEHOLDER = /placeholder(\s*=\s*)("[^"]*"|'[^']*')/g;

/**
 * ⚠️⚠️ **Strip non-copy attribute VALUES — never skip the whole LINE.**
 *
 * The first version of this file did `if (/style=/.test(line)) return;`, which skips
 * **nearly every JSX line**, because `style={styles.x}` is on almost all of them. It then
 * reported a clean pass over a hardcoded literal — while a reviewer's screenshot had
 * already shown the defect. The positive control below is what stops that recurring.
 */
function stripNonCopy(line: string): string {
  return line.replace(NON_COPY_ATTR, ' ').replace(PLACEHOLDER, ' ');
}

/** The user-visible literals on one line, if any. */
export function literalsIn(line: string): string[] {
  const out: string[] = [];
  const bare = stripNonCopy(line);
  for (const m of bare.matchAll(JSX_TEXT)) if (/[A-Za-z]{2,}/.test(m[1])) out.push(m[1].trim());
  for (const m of bare.matchAll(ATTR)) if (/[A-Za-z]{2,}/.test(m[2])) out.push(m[0]);
  return out;
}

/** Does this line render BOTH languages at once? */
export function bilingualIn(line: string): boolean {
  return BILINGUAL.some((re) => re.test(stripNonCopy(line)));
}

let passed = 0;
let failed = 0;
const failures: string[] = [];
const check = (name: string, cond: boolean, detail?: string): void => {
  if (cond) { passed += 1; console.log(`  ✓ ${name}`); return; }
  failed += 1; failures.push(name);
  console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`);
};

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });

console.log('copy-check · every user-visible string is localised');
console.log('\n1 · no site renders BOTH languages at once');
console.log('2 · no user-visible literal outside t() / localized()\n');

const bilingualHits: string[] = [];
const literalHits: string[] = [];
let scanned = 0;
const exempted: string[] = [];

for (const root of ROOTS) {
  for (const file of walk(path.join(PROJ, root))) {
    if (!/\.tsx$/.test(file)) continue;
    const rel = path.relative(PROJ, file);
    scanned += 1;
    if (EXEMPT.has(rel)) { exempted.push(rel); continue; }
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;   // a comment, not copy
      const where = `${rel}:${i + 1}`;
      if (bilingualIn(line)) bilingualHits.push(`${where}  ${line.trim().slice(0, 76)}`);
      if (/\bt\(|localized\(/.test(line)) return;    // already localised
      for (const lit of literalsIn(line)) literalHits.push(`${where}  "${lit.slice(0, 60)}"`);
    });
  }
}

check(`the scanner actually reached the screens (${scanned} .tsx files)`, scanned > 10, `scanned ${scanned}`);

// ⚠️ POSITIVE CONTROLS — the detector must FIRE on a synthetic defect, and stay quiet on
// clean input. Without these the gate can be silently blind, and a blind gate is worse
// than none: it manufactures confidence. (It *was* blind — see `stripNonCopy`.)
check('the detector fires on a synthetic literal (positive control)',
  literalsIn('<Text style={styles.hint}>Swipe up and aim for the heart</Text>').length > 0,
  'the scanner is blind — check stripNonCopy');
check('…and on the both-languages pattern',
  bilingualIn('<Text>{label.zh} {label.en}</Text>'), 'the bilingual rule is blind');
check('…and stays quiet on a localised line',
  literalsIn("<Text style={styles.hint}>{t('burn.aimHint')}</Text>").length === 0);
check('…and quiet on a testID / style-only line',
  literalsIn('<Pressable testID={`clan-switch-${i}`} style={styles.row} />').length === 0);

check(`no site renders both languages at once (${bilingualHits.length})`,
  bilingualHits.length === 0, bilingualHits.slice(0, 6).join('\n      '));
check(`no user-visible literal outside t()/localized() (${literalHits.length})`,
  literalHits.length === 0, literalHits.slice(0, 8).join('\n      '));

for (const [file, reason] of EXEMPT) {
  if (exempted.includes(file)) {
    console.log(`  – EXEMPT: ${file} — ${reason}`);
  }
}

console.log(`\n${'─'.repeat(64)}`);
if (failed === 0) {
  console.log(`✓ all ${passed} copy checks passed`);
  process.exit(0);
}
console.log(`✗ ${failed} of ${passed + failed} copy checks FAILED:`);
for (const f of failures) console.log(`    · ${f}`);
process.exit(1);
