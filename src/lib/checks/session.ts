/**
 * SESSION BOOTSTRAP CHECKS — `node src/lib/checks/session.ts`  (SCRUM-80)
 *
 * Zero dependencies, no framework, Node 22 strips the types — so this runs on a
 * bare checkout AND in CI's dependency-free job, beside `ritual-wire.ts`.
 *
 * WHAT IT GUARDS — the client half of ADR-004, which did not exist before
 * SCRUM-80: `signInAnonymously` appeared ZERO times in `src/`, so `getSession()`
 * was always empty and the slice's first write was refused by RLS (401 / 42501).
 * The decision it pins is small, but every branch is load-bearing:
 *
 *   · a session WITH a user id is REUSED (never sign in twice on one device);
 *   · a session WITHOUT a user id is NOT reused (reusing it reproduces the very
 *     `not_authenticated` failure this bootstrap exists to prevent);
 *   · an UNCONFIGURED app SKIPS the client entirely (calling it would throw);
 *   · an auth error maps to a STABLE reason, and never throws on junk input.
 *
 * ⚠️ FAULT-TEST IT: make `planSession` return `reuse` for a session with no user
 * id, or `sign_in` when unconfigured, and confirm exactly those checks go RED.
 */

import { planSession, reasonFromAuthError } from '../session-map.ts';

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

// ── 1 · the decision (ADR-004) ───────────────────────────────────────────────
section('1 · The decision — reuse, sign in, or skip');

const reused = planSession({ configured: true, hasSession: true, userId: 'user-1' });
check('an existing session is REUSED', reused.action === 'reuse');
check('…and the reused id is the one observed', reused.action === 'reuse' && reused.userId === 'user-1');

check('no session means SIGN IN', planSession({ configured: true, hasSession: false, userId: null }).action === 'sign_in');
check(
  '⚠️ a session with NO user id is NOT reused — it signs in (the exact SCRUM-80 failure)',
  planSession({ configured: true, hasSession: true, userId: null }).action === 'sign_in',
);
check(
  'an empty-string user id is NOT reused either',
  planSession({ configured: true, hasSession: true, userId: '' }).action === 'sign_in',
);

const skip = planSession({ configured: false, hasSession: false, userId: null });
check('an unconfigured app SKIPS', skip.action === 'skip');
check('…and names why (`not_configured`)', skip.action === 'skip' && skip.reason === 'not_configured');
check(
  'unconfigured WINS over a session (never call a client with no key)',
  planSession({ configured: false, hasSession: true, userId: 'user-1' }).action === 'skip',
);

// ── 2 · the error mapping ────────────────────────────────────────────────────
section('2 · Auth errors — a stable reason, never a throw');

check('anonymous sign-ins disabled is named', reasonFromAuthError({ code: 'anonymous_provider_disabled' }) === 'anonymous_disabled');
check('…and caught from the message too', reasonFromAuthError({ message: 'Anonymous sign-ins are disabled' }) === 'anonymous_disabled');
check('a 429 is rate_limited', reasonFromAuthError({ status: 429 }) === 'rate_limited');
check('a timeout is named', reasonFromAuthError({ message: 'request timed out' }) === 'timeout');
check('a network failure is named', reasonFromAuthError({ message: 'Failed to fetch' }) === 'network_error');
check('an unknown error still yields a reason', reasonFromAuthError({ code: 'weird' }) === 'sign_in_failed');
check('a null error yields a reason (never throws)', reasonFromAuthError(null) === 'sign_in_failed');
check('a thrown primitive yields a reason (never throws)', reasonFromAuthError('boom') === 'sign_in_failed');

// ── 3 · guard — the harness is alive ─────────────────────────────────────────
section('3 · Guard — the harness is alive');

check(
  'guard: an unconfigured app is never REUSED (a dead harness would pass §1)',
  planSession({ configured: false, hasSession: true, userId: 'user-1' }).action !== 'reuse',
);

console.log(`\n${'─'.repeat(64)}`);
if (failed === 0) {
  console.log(`✓ all ${passed} session-bootstrap checks passed`);
  process.exit(0);
}
console.log(`✗ ${failed} of ${passed + failed} session-bootstrap checks FAILED:`);
for (const f of failures) console.log(`    · ${f}`);
process.exit(1);
