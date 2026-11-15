/**
 * THE SEED GUARD (SCRUM-199) — nothing seeds a database until this says yes.
 *
 * ⚠️⚠️ **WHY THIS EXISTS BEFORE THE SEED ITSELF.** `SCRUM-155` writes demo data —
 * a clan, ancestors, a Book, league rivals — and it is meant to run against the
 * **HOSTED** project, where there is no undo and the rows look exactly like real
 * ones. `supabase/seed.sql` is applied automatically only by `db reset` (local);
 * a hosted seed is a hand-run command, which is precisely the kind of command
 * that gets run against the wrong target at 1 a.m.
 *
 * So the target is decided by a **pure function** and the run is REFUSED unless
 * it is one of:
 *   · the **local stack** (`127.0.0.1:54322`, `localhost:54322`, `::1:54322`), or
 *   · an explicit entry in `SEED_ALLOW_TARGETS` (comma-separated) that names the
 *     target verbatim or the linked project ref.
 *
 * ⚠️ **THE DEFAULT IS REFUSAL, including for an unknown target** — a guard that
 * allows anything it does not recognise is decoration. Using this guard is the
 * point of the ticket: *"fault-tested against the hosted project"*.
 *
 * ── USAGE ───────────────────────────────────────────────────────────────────
 *   node supabase/checks/seed-guard.ts --target "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
 *   node supabase/checks/seed-guard.ts --target yercgevebxvtzkgctfai      # refused
 *   SEED_ALLOW_TARGETS=yercgevebxvtzkgctfai node supabase/checks/seed-guard.ts \
 *     --target yercgevebxvtzkgctfai                                      # allowed
 *
 * Exit 0 = allowed · exit 2 = REFUSED · exit 64 = bad usage.
 * ⚠️ The refusal message names the target and the way to allow it, because a
 * red gate has to say what to DO (SCRUM-120).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The local stack's own host names. ⚠️ Port 54322 is the CLI's, not Postgres's. */
export const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '::1', '[::1]'] as const;
/** The local stack's database port (`supabase start`). */
export const LOCAL_PORT = '54322';
/** Env var holding the explicit allow-list, comma-separated. */
export const ALLOW_ENV = 'SEED_ALLOW_TARGETS';

export type TargetKind = 'local' | 'hosted' | 'unknown';

export interface SeedDecision {
  readonly allowed: boolean;
  readonly kind: TargetKind;
  readonly reason: string;
}

/** Split + normalise the allow-list. Empty entries vanish; matching is case-insensitive. */
export function parseAllowList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

/**
 * ⚠️ THE DECISION, AS A VALUE. Pure on purpose: `seed-guard.check.ts` asserts
 * every row of the table below, including the HOSTED refusal that is the whole
 * point of the ticket.
 */
export function classifySeedTarget(
  target: string,
  linkedRef: string,
  allowList: readonly string[] = [],
): SeedDecision {
  const t = target.trim().toLowerCase();
  const ref = linkedRef.trim().toLowerCase();
  const allow = allowList.map((s) => s.trim().toLowerCase());

  // ⚠️ No target is NOT "local by default" — it is "we do not know where this
  // would land", and the guard refuses what it cannot identify.
  if (t === '') {
    return { allowed: false, kind: 'unknown', reason: 'no target given — refusing to guess' };
  }

  // ── the local stack ──────────────────────────────────────────────────────
  const isLocal = LOCAL_HOSTS.some((h) => t.includes(`${h}:${LOCAL_PORT}`));
  if (isLocal) {
    return { allowed: true, kind: 'local', reason: 'the LOCAL stack (port 54322) — free to re-run' };
  }

  // ── the linked (hosted) project, by ref or by its connection strings ─────
  const looksHosted =
    (ref !== '' && (t === ref || t.includes(ref))) ||
    t.includes('supabase.co') ||
    t.includes('pooler.supabase.com') ||
    /^[a-z]{20}$/.test(t); // a bare project ref

  if (looksHosted) {
    const named = allow.length > 0
      && (allow.includes(t) || (ref !== '' && allow.includes(ref)));
    return named
      ? { allowed: true, kind: 'hosted', reason: 'HOSTED, explicitly allow-listed via SEED_ALLOW_TARGETS' }
      : {
          allowed: false,
          kind: 'hosted',
          reason: `HOSTED project ${ref || t} is NOT allow-listed — set ${ALLOW_ENV}=${ref || t} if this is intended`,
        };
  }

  // ── anything else is unknown, and unknown is refused ─────────────────────
  return {
    allowed: false,
    kind: 'unknown',
    reason: 'unrecognised target — only the local stack or an allow-listed hosted project may be seeded',
  };
}

/** The linked project ref, or `''` when this checkout is not linked. */
export function readLinkedRef(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  try {
    return readFileSync(join(here, '..', '.temp', 'project-ref'), 'utf8').trim();
  } catch {
    return '';
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────
// ⚠️ Guarded, so importing this module from the check file never runs the CLI.
const invokedDirectly = process.argv[1]?.endsWith('seed-guard.ts') === true;

if (invokedDirectly) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--target');
  const target = at >= 0 ? (args[at + 1] ?? '') : '';

  if (target.trim() === '') {
    console.error('usage: node supabase/checks/seed-guard.ts --target <url-or-project-ref>');
    process.exit(64);
  }

  const decision = classifySeedTarget(target, readLinkedRef(), parseAllowList(process.env[ALLOW_ENV]));
  if (decision.allowed) {
    console.log(`✓ seed target ALLOWED (${decision.kind}): ${decision.reason}`);
    process.exit(0);
  }
  console.error(`✗ seed target REFUSED (${decision.kind}): ${decision.reason}`);
  process.exit(2);
}
