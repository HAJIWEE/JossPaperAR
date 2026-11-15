/**
 * THE SEED GUARD'S OWN TEST (SCRUM-199) — `node supabase/checks/seed-guard.check.ts`
 *
 * ⚠️ **THE ROW THAT MATTERS IS THE HOSTED REFUSAL.** SCRUM-155 writes demo data
 * into the hosted project, where there is no undo, so "the guard says no" is the
 * behaviour this ticket exists for — and it is asserted here rather than
 * described in a comment.
 */

import { classifySeedTarget, parseAllowList } from './seed-guard.ts';

/** The linked project ref (supabase/.temp/project-ref) — the hosted project. */
const HOSTED = 'yercgevebxvtzkgctfai';
const LOCAL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('SEED GUARD — the allow-list that gates SCRUM-155');

// ── 1 · the local stack is the free case ────────────────────────────────────
check('the LOCAL stack is allowed', classifySeedTarget(LOCAL, HOSTED).allowed === true);
check('…as is localhost:54322',
  classifySeedTarget('postgresql://postgres@localhost:54322/postgres', HOSTED).allowed === true);

// ── 2 · ⚠️ THE POINT OF THE TICKET ──────────────────────────────────────────
const hosted = classifySeedTarget(HOSTED, HOSTED);
check('⚠️⚠️ the HOSTED project is REFUSED by default',
  hosted.allowed === false && hosted.kind === 'hosted', hosted.reason);
check('⚠️ the hosted POOLER url is refused too',
  classifySeedTarget(
    'postgresql://postgres.x@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres',
    HOSTED,
  ).allowed === false);

// ── 3 · …and ONLY an explicit allow-list changes that ───────────────────────
check('the hosted ref is allowed when it is named in the allow-list',
  classifySeedTarget(HOSTED, HOSTED, [HOSTED]).allowed === true);
check('…and the allow-list tolerates case and spaces',
  classifySeedTarget(HOSTED, HOSTED, parseAllowList(` ${HOSTED.toUpperCase()} `)).allowed === true);

// ── 4 · ⚠️ default-REFUSAL for everything unidentified ──────────────────────
check('⚠️ no target is REFUSED, never assumed local',
  classifySeedTarget('', HOSTED).allowed === false);
check('⚠️ an unrecognised target is refused',
  classifySeedTarget('postgresql://u@example.com:5432/db', HOSTED).allowed === false);
// ⚠️ Port 5432 is NOT the CLI's stack: a Docker-internal `db:5432` is a real
// Postgres that is not necessarily the local stack, so it must not pass.
check('⚠️ a bare :5432 host is NOT treated as the local stack',
  classifySeedTarget('postgresql://postgres@db:5432/postgres', HOSTED).allowed === false);

console.log(`\n${'─'.repeat(64)}`);
if (failed === 0) {
  console.log(`✓ all ${passed} seed-guard checks passed`);
  process.exit(0);
}
console.log(`✗ ${failed} of ${passed + failed} seed-guard checks FAILED:`);
for (const f of failures) console.log(`    · ${f}`);
process.exit(1);
