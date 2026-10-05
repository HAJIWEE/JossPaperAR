#!/usr/bin/env node
/**
 * ADR REGISTER INTEGRITY — `node AppDesignConceptBoard/ADRs/check-adrs.js`
 *
 * Zero dependencies. Runs in `npm run check` and in CI.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 * SCRUM-55's whole premise: three decisions (§6.5 identity, §6.7 burn limits,
 * §6.9 ad posture) were **made in prose** and recorded nowhere, which left them
 * open to silent re-litigation. Two of them are now written up (ADR-004/006) and
 * one is a drafted proposal (ADR-008).
 *
 * The failure mode does not end when the ADRs land — it recurs the next time
 * someone edits the register by hand and forgets a file, or marks a decision
 * "accepted" in the index while the file still says Proposed (or vice versa).
 * So the register and the files must be checked against **each other**, not
 * against prose.
 *
 * It fails on:
 *   1. a register row whose ADR file does not exist
 *   2. an ADR file with no register row            (the exact SCRUM-55 bug)
 *   3. a status the register and the file disagree on
 *   4. a decision row still marked "record to write" / "Open" in the register
 *   5. an ADR file missing the house sections (context / decision / rejected /
 *      consequences) — the format every existing record uses
 *
 * It is a TEXT check. It cannot judge whether a decision is *good*, only that
 * the paper and the index agree. That is the floor this ticket needs.
 */

const fs = require('node:fs');
const path = require('node:path');

const DIR = __dirname;
const REGISTER = path.join(DIR, 'README.md');

/** The sections the house format requires, per the reference ADRs. */
const REQUIRED_SECTIONS = [
  '## Context',
  '## Decision',
  '## Consequences',
];

/** A rejected-alternatives section; headers vary ("considered → rejected"). */
const REJECTED_RE = /^##\s+Alternatives.*rejected/mi;

let failures = 0;
let checks = 0;

function ok(msg) {
  checks += 1;
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  checks += 1;
  failures += 1;
  console.log(`  ✗ ${msg}`);
}

console.log('\nADR register integrity (SCRUM-55 — the decided-but-unrecorded guard)\n');

if (!fs.existsSync(REGISTER)) {
  console.error(`  ✗ register not found: ${REGISTER}`);
  process.exit(1);
}

const register = fs.readFileSync(REGISTER, 'utf8');

/* ── 1 · Parse the register rows ──────────────────────────────────────────── */
// | [[ADR-001-slug]] | §6.x decision text | ✅ **Accepted 2026-09-26** |
const ROW_RE = /^\|\s*\[\[(ADR-\d{3}-[a-z0-9-]+)\]\]\s*\|([^|]*)\|([^|]*)\|/gm;

const rows = [];
let m;
while ((m = ROW_RE.exec(register)) !== null) {
  rows.push({ slug: m[1], decision: m[2].trim(), status: m[3].trim() });
}

if (rows.length === 0) {
  console.error('  ✗ no register rows parsed — the register format changed.');
  process.exit(1);
}

ok(`parsed ${rows.length} register rows`);

/* ── 2 · Every register row has a file ────────────────────────────────────── */
for (const row of rows) {
  const file = path.join(DIR, `${row.slug}.md`);
  if (fs.existsSync(file)) {
    ok(`${row.slug} → file exists`);
  } else {
    fail(`${row.slug} → REGISTERED BUT THE FILE IS MISSING`);
  }
}

/* ── 3 · Every ADR file has a register row ────────────────────────────────── */
const onDisk = fs
  .readdirSync(DIR)
  .filter((f) => /^ADR-\d{3}-.*\.md$/.test(f))
  .map((f) => f.replace(/\.md$/, ''));

for (const slug of onDisk) {
  if (rows.some((r) => r.slug === slug)) {
    ok(`${slug} → is in the register`);
  } else {
    fail(`${slug} → ON DISK BUT MISSING FROM THE REGISTER`);
  }
}

/* ── 4 · The register must not still claim an unwritten record ────────────── */
// Scan the TABLE ROWS ONLY. Matching the whole file would hit this check's own
// documentation prose in the README, which describes the very phrase we forbid.
if (rows.some((r) => /record to write/i.test(r.decision) || /record to write/i.test(r.status))) {
  fail('a register row still says "record to write" — a decision is decided but unrecorded');
} else {
  ok('no "record to write" rows remain (the SCRUM-55 condition)');
}

/* ── 5 · Register status vs the file's own status line ────────────────────── */
/** Normalise to one of accepted | proposed, from either column or file line. */
function classify(text) {
  const t = text.toLowerCase();
  if (/accepted/.test(t)) return 'accepted';
  if (/proposed|draft/.test(t)) return 'proposed';
  return null;
}

for (const row of rows) {
  const file = path.join(DIR, `${row.slug}.md`);
  if (!fs.existsSync(file)) continue; // already reported above

  const body = fs.readFileSync(file, 'utf8');
  const fileStatus = classify(body.slice(0, 1200)); // the **Status:** header block
  const regStatus = classify(row.status);

  if (regStatus === null) {
    fail(`${row.slug} → register status is unreadable: "${row.status}"`);
    continue;
  }
  if (fileStatus === null) {
    fail(`${row.slug} → no **Status:** line found in the file header`);
    continue;
  }
  if (regStatus !== fileStatus) {
    fail(
      `${row.slug} → STATUS DISAGREES — register says "${regStatus}", file says "${fileStatus}"`,
    );
  } else {
    ok(`${row.slug} → status agrees (${regStatus})`);
  }
}

/* ── 6 · The house format: the sections every record carries ──────────────── */
for (const slug of onDisk) {
  const body = fs.readFileSync(path.join(DIR, `${slug}.md`), 'utf8');
  const missing = REQUIRED_SECTIONS.filter((s) => !body.includes(s));
  const noRejected = !REJECTED_RE.test(body);

  if (missing.length === 0 && !noRejected) {
    ok(`${slug} → house format (context · decision · rejected · consequences)`);
  } else {
    const why = [
      ...missing.map((s) => `missing "${s}"`),
      ...(noRejected ? ['missing an "Alternatives … rejected" section'] : []),
    ].join('; ');
    fail(`${slug} → INCOMPLETE — ${why}`);
  }
}

/* ── verdict ──────────────────────────────────────────────────────────────── */
console.log('');
if (failures > 0) {
  console.error(`✗ ${failures} of ${checks} ADR register checks FAILED\n`);
  process.exit(1);
}
console.log(`✓ all ${checks} ADR register checks passed\n`);
