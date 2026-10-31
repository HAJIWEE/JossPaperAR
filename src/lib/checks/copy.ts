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
 *   3. **SCRUM-121** — no `t(key)` call leaves a placeholder its message declares
 *      unsubstituted. ⚠️ **Rule 2 is structurally blind to this**: the string IS inside
 *      `t()`, which is exactly how `t('clan_preview')` shipped `[MISSING "%{NAME}" VALUE]`
 *      to a real player on glass while every gate stayed green.
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

/**
 * ⚠️ **The message table is IMPORTED, and that is why this gate runs in CI's `app-checks`
 * job (after `npm ci`) rather than the dependency-free one.** It needs `i18n-js` to load
 * `i18n.ts`. The alternative — parsing the table out of the file as text — would have kept
 * the gate dependency-free and made it *wrong* the first time the table's formatting moved.
 */
import { MESSAGES } from '../i18n.ts';

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
console.log('2 · no user-visible literal outside t() / localized()');
console.log('3 · no t(key) call leaves a declared placeholder unsubstituted');
console.log('4 · the Book\'s copy IS doc 15 §8\'s — the table of record\n');

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

// ── 3 · a t(key) call must supply the placeholders its message declares ─────
//
// ⚠️ SCRUM-121 — FOUND ON GLASS, NOT BY A GATE. `clan-join.tsx` rendered
// `<Label>{t('clan_preview')}</Label>`: a message carrying three placeholders, called
// with NO args, so a player read `[MISSING "%{NAME}" VALUE] · …` directly above the
// correct interpolated line. ⚠️ Rule 2 cannot see it — the string IS inside `t()`.
//
// WHAT IT CANNOT SEE, stated rather than implied:
//   · a DYNAMIC key (`t(messageKey)`, `t(KEYS[i])`) — not resolvable statically, and the
//     count is PRINTED below so the blind spot is visible rather than silent;
//   · an arg object it cannot read (a helper call, an identifier, a spread) — for those
//     only the PRESENCE of a second argument is provable;
//   · a call split across lines — there are none in this tree today (asserted below).
const en = MESSAGES.en as unknown as Record<string, string>;
const zh = MESSAGES.zh as unknown as Record<string, string>;

/** `t('key'` / `t("key"` — a LITERAL key, plus whether a second argument follows. */
const T_CALL = /(?:^|[^\w.])t\(\s*(['"])([A-Za-z0-9_.]+)\1\s*(,|\))/g;
/** `%{name}` — the interpolation form this table actually uses. ⚠️ NOT `PLACEHOLDER`,
 *  which this file already uses for the `placeholder=` JSX prop. */
const INTERP = /%\{([A-Za-z0-9_]+)\}/g;

const placeholdersIn = (message: string | undefined): string[] =>
  message === undefined ? [] : [...message.matchAll(INTERP)].map((m) => m[1]);

/** The keys of an inline object-literal argument, or `null` when it is not readable. */
function literalArgKeys(rest: string): string[] | null {
  const m = /^\s*\{\s*([^}]*)\}\s*\)/.exec(rest);
  if (m === null || m[1].includes('...')) return null; // not an object literal / a spread
  return [...m[1].matchAll(/(?:^|,)\s*([A-Za-z0-9_]+)\s*:/g)].map((k) => k[1]);
}

/**
 * The `t(literalKey)` calls on ONE line that leave a declared placeholder unsubstituted.
 * Exported so the controls can fire it at synthetic lines — the same shape as `literalsIn`
 * / `bilingualIn`, so the detector itself is testable.
 */
export function unsubstitutedIn(line: string): string[] {
  const out: string[] = [];
  for (const m of line.matchAll(T_CALL)) {
    const key = m[2];
    // ⚠️ Not every `t(` is THIS module's `t` — a local helper may share the name. Only a key
    // the table actually defines is a message, and only a message can have a gap.
    if (en[key] === undefined && zh[key] === undefined) continue;
    // ⚠️ BOTH locales: the ZH message carries the same placeholders, so a guard reading only
    // `en` would pass a key that leaks in 中文.
    const declared = [...new Set([...placeholdersIn(en[key]), ...placeholdersIn(zh[key])])];
    if (declared.length === 0) continue;
    const shown = declared.map((n) => `%{${n}}`).join(' · ');
    if (m[3] === ')') {
      out.push(`t('${key}') declares ${shown} but passes NO args`);
      continue;
    }
    const supplied = literalArgKeys(line.slice(m.index + m[0].length));
    if (supplied === null) continue; // a helper/identifier: only presence is provable
    const missing = declared.filter((n) => !supplied.includes(n));
    if (missing.length > 0) {
      out.push(`t('${key}') is missing ${missing.map((n) => `%{${n}}`).join(' · ')}`);
    }
  }
  return out;
}

let literalCallSites = 0;
let dynamicKeys = 0;
let splitCalls = 0;
const placeholderHits: string[] = [];

for (const file of walk(path.join(PROJ, 'src'))) {
  if (!/\.tsx?$/.test(file)) continue;
  const rel = path.relative(PROJ, file);
  // ⚠️ The gates' own sources quote `t('…')` inside controls and comments — not call sites.
  if (rel.includes('/checks/')) continue;
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // a comment, not copy
    // a `t(` whose key is not a literal — counted, never guessed at
    if (/\bt\(\s*[^'"]/.test(line)) dynamicKeys += 1;
    // a `t(` that opens on this line and does not close on it — the stated blind spot
    if (/\bt\(\s*['"]/.test(line) && !/\)/.test(line)) splitCalls += 1;
    for (const m of line.matchAll(T_CALL)) {
      if (en[m[2]] !== undefined || zh[m[2]] !== undefined) literalCallSites += 1;
    }
    for (const hit of unsubstitutedIn(line)) placeholderHits.push(`${rel}:${i + 1}  ${hit}`);
  });
}

check(`the placeholder scanner reached the call sites (${literalCallSites} literal-key calls · ${Object.keys(en).length} messages)`,
  literalCallSites > 100 && Object.keys(en).length > 100 && Object.keys(zh).length > 100,
  'the scan or the message table did not load — this gate is blind');
check('no t() call is split across lines (the stated blind spot is empty)',
  splitCalls === 0, `${splitCalls} line(s) open a t() call without closing it on the same line`);

// ⚠️ POSITIVE CONTROLS — the same discipline as rules 1–2: a detector that cannot fire is
// not a detector. `clan_preview` MUST declare placeholders for the first control to bite.
check('the detector fires on a no-arg call whose message HAS placeholders (positive control)',
  unsubstitutedIn("const x = t('clan_preview');").length > 0,
  'the placeholder rule is blind — check T_CALL');
check('…and on an inline object that omits one',
  unsubstitutedIn("const x = t('clan_preview', { name: 'Tan', ancestors: 0 });").length > 0,
  'the object-key reader is blind');
check('…and stays quiet on a fully-supplied inline object',
  unsubstitutedIn("const x = t('clan_preview', { name: 'Tan', ancestors: 0, members: 1 });").length === 0);
check('…and quiet on a no-arg call whose message declares NOTHING',
  unsubstitutedIn("const x = t('clan.back');").length === 0);
check('…and quiet on a dynamic key it cannot resolve',
  unsubstitutedIn('const x = t(messageKey);').length === 0);

check(`no t(key) call leaves a declared placeholder unsubstituted (${placeholderHits.length})`,
  placeholderHits.length === 0, placeholderHits.slice(0, 8).join('\n      '));
if (dynamicKeys > 0) {
  console.log(`  – ${dynamicKeys} call site(s) use a dynamic key — NOT statically checkable`);
}

// ── 4 · the Book's copy IS doc 15 §8's — the table of record (SCRUM-144) ────
//
// ⚠️ WHY THIS EXISTS. `SCRUM-122` needed an empty-state string, and its AC said the copy is
// **doc 15 §8's** — *"do not invent the ZH string"*. ⚠️ But §8 had **no empty-state row**, so
// there was nothing to take: the key shipped as a marked **PROPOSAL** and `SCRUM-144` asked
// the PM. The answer (option A) signed the wording off **and added it to the table** (row
// **C18**) — which is the only version of "signed off" that survives the next session.
//
// ⚠️ A PROPOSAL NO GATE CAN SEE IS ONE EDIT AWAY FROM ROT. This asserts the direction that
// was missing: every Book key must HAVE a §8 row, and the two must agree character for
// character in **both** locales. ⚠️ **Before C18 existed this was RED** — it is a regression
// guard for exactly this decision, not decoration.
//
// ⚠️ STATED SCOPE, not implied: this maps **four** keys to **four** rows. It is NOT a
// whole-table parity check — §8's rows carry no key column, so a row→key map for all 18 would
// be a guess dressed up as a gate. The Book is where the gap actually happened, so the Book
// is where the assertion is. ⚠️ Add a fifth `book_*` key and it needs a row, or this goes red.
const DOC15 = path.join(PROJ, 'AppDesignConceptBoard', '15-clan-model-and-book-of-tributes.md');

/** `| C14 | Book · header | *Book of Tributes* | *供奉簿* |` → id, moment, EN cell, ZH cell. */
const ROW = /^\|\s*(C\d+)\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/;

/** `*…*` is markdown emphasis in the table, never part of the shipped string. */
const cellText = (cell: string): string => {
  const italic = /^\*([^*]+)\*$/.exec(cell);
  return italic === null ? cell.replace(/\*/g, '').trim() : italic[1];
};

function copyTable(): Map<string, { moment: string; en: string; zh: string }> {
  const rows = new Map<string, { moment: string; en: string; zh: string }>();
  for (const line of fs.readFileSync(DOC15, 'utf8').split('\n')) {
    const m = ROW.exec(line);
    if (m === null) continue;
    rows.set(m[1], { moment: m[2], en: cellText(m[3]), zh: cellText(m[4]) });
  }
  return rows;
}

/** The Book's keys and the §8 row each one IS. ⚠️ A new Book key means a new row in §8. */
const BOOK_COPY: ReadonlyArray<readonly [key: string, row: string]> = [
  ['book_header', 'C14'],
  ['book_outside', 'C15'],
  ['book_window', 'C16'],
  ['book_empty', 'C18'],
];

const table = copyTable();

check(`the copy table of record was reached (${table.size} §8 rows read)`, table.size >= 15,
  `parsed ${table.size} rows from ${path.relative(PROJ, DOC15)} — the gate is blind`);

// ⚠️ POSITIVE CONTROL — a parser that reads nothing passes every row assertion below silently,
// which is the failure mode `stripNonCopy` already taught this file.
check('the §8 row parser fires on a real row (positive control)',
  ROW.test('| C18 | Book · empty state | *No offerings yet. The first one will appear here.* | *尚无供奉。第一笔将显示在这里。* |'),
  'the row regex is blind — check ROW');
check('…and strips the table\'s markdown emphasis, not the string',
  cellText('*Book of Tributes*') === 'Book of Tributes',
  'cellText kept the asterisks — the comparison would fail on real rows');

for (const [key, row] of BOOK_COPY) {
  const cells = table.get(row);
  check(`${key} IS doc 15 §8's row ${row} — a shipped key has a row in the table of record`,
    cells !== undefined, `§8 carries no ${row} — the table of record has a gap again`);
  if (cells === undefined) continue;
  check(`…its EN is ${row}'s, character for character`, en[key] === cells.en,
    `i18n "${en[key]}" ≠ §8 "${cells.en}"`);
  check(`…its 中文 is ${row}'s, character for character`, zh[key] === cells.zh,
    `i18n "${zh[key]}" ≠ §8 "${cells.zh}"`);
}

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
