/**
 * CLIENT-LIBRARY CHECKS — `node src/lib/checks/run.ts`
 *
 * Zero dependencies, no framework: Node 22 strips the types (the project's
 * habit — doc 18 §7.1). It exercises ONLY the pure parts, which is why the
 * client libs are split the way they are: `queue.ts` takes an injected driver,
 * `split-storage.ts` takes injected stores, `invites.ts`/`idempotency.ts`/
 * `i18n.ts` import nothing native. The device wiring (`queue-sqlite.ts`,
 * `supabase.ts`) is covered by `tsc` and by the device run in PR-4.
 *
 * ⚠️ FAULT-TEST IT: change an expected string and confirm it goes RED.
 */

import { type UuidFactory, isValidIdempotencyKey, newIdempotencyKey } from '../idempotency.ts';
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  CODE_PATTERN,
  inviteDeepLink,
  inviteLink,
  normaliseClanCode,
  parseInviteUrl,
  qrPayload,
} from '../invites.ts';
import { LOCALES, MESSAGES, detectLocale, messageKeys, setLocale, t } from '../i18n.ts';
import { BULK_PREFIX, createSplitStorage, bulkKey } from '../split-storage.ts';
import {
  MAX_ATTEMPTS,
  type QueueDriver,
  type QueuedItem,
  ageInDays,
  createQueue,
  isExpired,
  isSendable,
  replayOrder,
} from '../queue.ts';
import { QUOTA_SPENT_COPY } from '../../domain/quota.ts';

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

const stubUuid: UuidFactory = () => '00000000-1111-2222-3333-444444444444';

// ── 1 · idempotency keys — the reason an offline replay is safe (doc 14 N6) ──
section('1 · Idempotency keys (doc 14 N6 · doc 11 §4)');

const burnKey = newIdempotencyKey('burn', stubUuid);
check('a burn key carries its prefix', burnKey.startsWith('burn-'), burnKey);
check('the same uuid gives the same key (deterministic)', burnKey === newIdempotencyKey('burn', stubUuid));
check('a fresh uuid gives a different key', burnKey !== newIdempotencyKey('burn', () => 'ffffffff-1111-2222-3333-444444444444'));
check('the key satisfies the server window (8..200)', isValidIdempotencyKey(burnKey));
check('a 7-character key is rejected (below the server floor)', !isValidIdempotencyKey('burn-12'));
check('a 201-character key is rejected', !isValidIdempotencyKey('x'.repeat(201)));
check('a non-string is rejected', !isValidIdempotencyKey(42));
check(
  'an exotic uuid cannot push the key over 200 characters',
  isValidIdempotencyKey(newIdempotencyKey('purchase', () => 'z'.repeat(400))),
);
check(
  'the key is lower-cased (stable in a log)',
  newIdempotencyKey('join', () => 'ABCDEF00-1111-2222-3333-444444444444').startsWith('join-abcdef00'),
);

// ── 2 · invites — one secret, three presentations (doc 07 §4.6) ─────────────
section('2 · Invite links, deep links and the QR payload (doc 07 §4.6)');

check('the code alphabet excludes 0/O and 1/I/L', CODE_ALPHABET === 'ABCDEFGHJKMNPQRSTUVWXYZ23456789');
check('the alphabet matches the DB CHECK regex', CODE_PATTERN.test('ABCDEFGH'));
check('a 7-character code is not a code', !CODE_PATTERN.test('ABCDEFG'));
check('an ambiguous character is not a code', !CODE_PATTERN.test('ABCDEFG0'));
check('lower case is normalised up', normaliseClanCode('abcdefgh') === 'ABCDEFGH');
check('spaces and hyphens are tolerated (people read these aloud)', normaliseClanCode('ABCD EF-GH') === 'ABCDEFGH');
check('a malformed length returns null', normaliseClanCode('ABCDEFG') === null);
check('a missing value returns null', normaliseClanCode(undefined) === null);

check('the link uses the universal-link host', inviteLink('abcdefgh') === 'https://josspaperar.app/join/ABCDEFGH');
check('the deep link uses the custom scheme', inviteDeepLink('ABCDEFGH') === 'josspaperar://join?code=ABCDEFGH');
check('⚠️ the QR payload IS the invite link (one payload, three presentations)', qrPayload('ABCDEFGH') === inviteLink('ABCDEFGH'));
check('an invalid code raises rather than building a broken link', (() => {
  try { inviteLink('nope'); return false; } catch { return true; }
})());

check('parse: the universal link', parseInviteUrl('https://josspaperar.app/join/ABCDEFGH') === 'ABCDEFGH');
check('parse: the custom scheme', parseInviteUrl('josspaperar://join?code=ABCDEFGH') === 'ABCDEFGH');
check('parse: a bare code, lower case', parseInviteUrl('abcdefgh') === 'ABCDEFGH');
check('parse: a percent-encoded link', parseInviteUrl('https%3A%2F%2Fjosspaperar.app%2Fjoin%2FABCDEFGH') === 'ABCDEFGH');
check('parse: junk is refused, not guessed', parseInviteUrl('https://example.com/hello') === null);
check('parse: a non-string is refused', parseInviteUrl(7) === null);
check('the payload carries the code and nothing else', !inviteLink('ABCDEFGH').includes('name'));

// ── 3 · i18n — EN / 中文, complete in both ──────────────────────────────────
section('3 · i18n (doc 15 §8 — both locales are signed off, so both are complete)');

const en = messageKeys('en');
const zh = messageKeys('zh');
check('the two locales have the SAME key count', en.length === zh.length, `${en.length} vs ${zh.length}`);
check('no key exists in EN but not 中文', en.every((k) => zh.includes(k)), en.filter((k) => !zh.includes(k)).join(','));
check('no key exists in 中文 but not EN', zh.every((k) => en.includes(k)), zh.filter((k) => !en.includes(k)).join(','));
check('there are at least 35 messages', en.length >= 35, String(en.length));

const blanks: string[] = [];
for (const locale of LOCALES) {
  for (const [key, value] of Object.entries(MESSAGES[locale])) {
    if (typeof value !== 'string' || value.trim().length === 0) blanks.push(`${locale}:${key}`);
  }
}
check('no message is empty', blanks.length === 0, blanks.join(', '));

setLocale('zh');
check('the Chinese quota copy is the domain module\u2019s copy (one source of truth)', t('quota_spent') === QUOTA_SPENT_COPY.zh);
setLocale('en');
check('the English quota copy matches the domain module', t('quota_spent') === QUOTA_SPENT_COPY.en);
check('interpolation works', t('clan_welcome', { name: '陳氏' }).includes('陳氏'));

check('a zh-Hans device tag detects 中文', detectLocale(['zh-Hans-SG', 'en-SG']) === 'zh');
check('an en device tag detects English', detectLocale(['en-GB']) === 'en');
check('an unknown tag falls back to English', detectLocale(['fr-FR']) === 'en');
check('an empty tag list falls back to English', detectLocale([]) === 'en');

// ── 4 · the split-storage adapter — the ~2 KB SecureStore trap (doc 19 T2) ──
section('4 · Split storage (doc 19 §5.4 T2 — SecureStore caps a value at ~2 KB)');

interface MemoryStore {
  readonly store: Map<string, string>;
  readonly kv: {
    getItem(k: string): Promise<string | null>;
    setItem(k: string, v: string): Promise<void>;
    removeItem(k: string): Promise<void>;
  };
}

function memoryStore(): MemoryStore {
  const store = new Map<string, string>();
  return {
    store,
    kv: {
      getItem: async (k) => store.get(k) ?? null,
      setItem: async (k, v) => { store.set(k, v); },
      removeItem: async (k) => { store.delete(k); },
    },
  };
}

async function storageChecks(): Promise<void> {
  const secure = memoryStore();
  const bulk = memoryStore();
  const adapter = createSplitStorage(secure.kv, bulk.kv);

  // a small value stays encrypted in place
  await adapter.setItem('sb-session', 'small');
  check('a small value lands in the SECURE store', secure.store.get('sb-session') === 'small');
  check('…and NOT in the bulk store', bulk.store.size === 0);
  check('a small value reads back', await adapter.getItem('sb-session') === 'small');

  // an oversized value (a session past the cap) moves to the bulk store
  const big = 'j'.repeat(2500);
  await adapter.setItem('sb-session', big);
  check('an oversized value lands in the BULK store', bulk.store.get(bulkKey('sb-session')) === big);
  check('…and the stale SECURE copy is GONE (they can never disagree)', !secure.store.has('sb-session'));
  check('an oversized value reads back', await adapter.getItem('sb-session') === big);

  // …and back again
  await adapter.setItem('sb-session', 'small-again');
  check('shrinking back clears the bulk copy', bulk.store.size === 0);
  check('the secure copy is authoritative again', secure.store.get('sb-session') === 'small-again');

  check('an absent key reads as null', await adapter.getItem('never-written') === null);
  await adapter.removeItem('sb-session');
  check('removeItem clears the secure side', !secure.store.has('sb-session'));
  check('removeItem clears the bulk side too', !bulk.store.has(bulkKey('sb-session')));
  check('the bulk namespace is prefixed', BULK_PREFIX.length > 0 && bulkKey('k') !== 'k');
}

// ── 5 · the offline queue's POLICY ─────────────────────────────────────────
section('5 · The offline queue — cross-day durability (doc 14 N6)');

const DAY = 86_400_000;
const item = (id: number, createdAt: number, attempts = 0): QueuedItem => ({
  id,
  kind: 'burn',
  idempotencyKey: `burn-${id}`,
  payload: '{}',
  createdAt,
  attempts,
  lastError: null,
});

check('MAX_ATTEMPTS is a real cap', MAX_ATTEMPTS === 5);
check('an item queued 48h ago is still sendable (the cross-day requirement)', isSendable(item(1, 0, 3)));
check('age is measured in whole days', ageInDays(item(1, 0), 2 * DAY) === 2);
check('a 2-day-old item is inside the provisional replay window', !isExpired(item(1, 0), 2 * DAY));
check('a 31-day-old item IS past it (flagged, not dropped)', isExpired(item(1, 0), 31 * DAY));
check('an item at MAX_ATTEMPTS is no longer auto-retried', !isSendable(item(1, 0, MAX_ATTEMPTS)));
check(
  'replay is OLDEST FIRST (a ritual is in time order)',
  replayOrder([item(3, 300), item(1, 100), item(2, 200)]).map((i) => i.id).join(',') === '1,2,3',
);
check(
  'exhausted items are skipped by the replay order',
  replayOrder([item(1, 100), item(2, 200, MAX_ATTEMPTS)]).map((i) => i.id).join(',') === '1',
);
check(
  'equal timestamps are broken deterministically by id',
  replayOrder([item(9, 100), item(4, 100)]).map((i) => i.id).join(',') === '4,9',
);

// ── 6 · a full drain against an in-memory driver ───────────────────────────
section('6 · The queue drain — sent / dropped / retryable / stuck accounting');

async function drainChecks(): Promise<void> {
  const rows: QueuedItem[] = [];
  let nextId = 1;
  const driver: QueueDriver = {
    init: async () => {},
    insert: async (queued) => {
      if (rows.some((r) => r.idempotencyKey === queued.idempotencyKey)) return; // UNIQUE, as in SQLite
      nextId += 1;
      rows.push({ ...queued, id: nextId, attempts: 0 });
    },
    pending: async (limit) => [...rows].sort((a, b) => a.createdAt - b.createdAt).slice(0, limit),
    ack: async (id) => {
      const at = rows.findIndex((r) => r.id === id);
      if (at >= 0) rows.splice(at, 1);
    },
    fail: async (id, error) => {
      const row = rows.find((r) => r.id === id);
      if (row) {
        (row as { attempts: number }).attempts += 1;
        (row as { lastError: string | null }).lastError = error;
      }
    },
    size: async () => rows.length,
    clear: async () => { rows.length = 0; },
  };

  const queue = createQueue(driver);
  await queue.enqueue('burn', 'burn-aaa', '{"a":1}');
  await queue.enqueue('burn', 'burn-aaa', '{"a":1}'); // a double-tap
  check('a duplicate idempotency key is not queued twice', (await queue.size()) === 1);

  await queue.enqueue('burn', 'burn-bbb', '{"b":2}');
  check('a distinct key IS queued', (await queue.size()) === 2);

  const report = await queue.drain(async (queued) =>
    queued.idempotencyKey === 'burn-aaa' ? 'sent' : 'drop');
  check('a sent item is acknowledged and removed', report.sent === 1, JSON.stringify(report));
  check('a refused item is dropped, not retried forever', report.dropped === 1);
  check('the outbox is empty when the drain ends', report.remaining === 0);

  await queue.enqueue('burn', 'burn-ccc', '{}');
  const retryReport = await queue.drain(async () => {
    throw new Error('offline');
  });
  check('a THROWN error counts as transient, never as success', retryReport.sent === 0 && retryReport.retryable === 1);
  check('the failed item stays in the outbox', (await queue.size()) === 1);

  for (let i = 1; i < MAX_ATTEMPTS; i += 1) await queue.drain(async () => 'retry');
  const stuckReport = await queue.drain(async () => 'retry');
  check('an exhausted item is reported STUCK, never lost', stuckReport.stuck === 1, JSON.stringify(stuckReport));
  check('…and it is still in the outbox for the user', (await queue.size()) === 1);

  await queue.clear();
  check('clear() empties the outbox (the one-tap delete path)', (await queue.size()) === 0);
}

// ── 7 · guard — the harness is alive ───────────────────────────────────────
section('7 · Guard — the harness is alive');

async function main(): Promise<void> {
  await storageChecks();
  await drainChecks();

  check('guard: a 5-character key is NOT valid', !isValidIdempotencyKey('12345'));
  check('guard: junk is NOT a clan code', normaliseClanCode('not-a-code!!') === null);

  console.log(`\n${'─'.repeat(64)}`);
  if (failed === 0) {
    console.log(`✓ all ${passed} client-library checks passed`);
    process.exit(0);
  }
  console.log(`✗ ${failed} of ${passed + failed} client-library checks FAILED:`);
  for (const f of failures) console.log(`    · ${f}`);
  process.exit(1);
}

await main();
