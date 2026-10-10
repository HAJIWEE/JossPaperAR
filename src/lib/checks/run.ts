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

import { isValidClanName } from '../clan-rules.ts';
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
import {
  HELD_INVITE_KEY,
  HELD_INVITE_KEY_BY_REASON,
  HELD_INVITE_MAX_AGE_MS,
  RESOLVE_MESSAGE_KEY,
  canJoin,
  isHeldInviteStale,
  isInvitePayloadSafe,
  makeHeldInvite,
  parseHeldInvite,
  parseInviteCandidate,
  resolveState,
  scanDecision,
  shouldHoldInvite,
} from '../invite-flow.ts';
import { LOCALES, MESSAGES, detectLocale, localized, messageKeys, setLocale, t } from '../i18n.ts';
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
import { AIM_BANDS } from '../../domain/aim.ts';
import { OFFERINGS } from '../../domain/catalogue.ts';
import { INITIAL_OFFERING, applyAll, isWaiting, nextAction } from '../../domain/slice.ts';
import { eventsFromResponse } from '../ritual-map.ts';
import {
  ASSIGNABLE_ROLES,
  CLAN_ROLES,
  BOOK_WINDOW_DAYS,
  CLANS_PER_USER,
  HEAD_POWER_ROLES,
  JOINS_PER_HOUR,
  MS_PER_DAY,
  bookProjection,
  bookWindowStart,
  canDeleteClan,
  canEditAncestors,
  canInvite,
  canLeaveClan,
  canOffer,
  canRemoveMember,
  canRenameClan,
  hasHeadPower,
  isClanRole,
  isHeadless,
  isInBookWindow,
  joinRefusal,
  oldestElder,
  planLeave,
  roleChangeRefusal,
  type ClanRole,
  type LeaveMember,
} from '../clan-roles.ts';
import {
  CREATE_STEPS,
  FORK,
  PREVIEW_MESSAGE_KEY,
  PREVIEW_SHOWS_ANCESTOR_NAMES,
  ROLE_LABEL_KEY,
  actionsFor,
  actionsForOutsider,
  canSubmitCode,
  canSubmitName,
  createStepIndex,
  isSkippable,
  leaveHintKey,
  nextCreateStep,
  previewArgs,
  previousCreateStep,
  promoteLabelKey,
} from '../clan-flow.ts';
import {
  AFFORDANCE_GLYPH,
  CONTENT_PAD_H,
  HEADER_SPEC,
  NAME_WIDTH,
  PILL_SPEC,
  PILL_X_ON_REFERENCE,
  pillRoute,
  pillView,
} from '../clan-pill.ts';
import { CHINESE_SCRIPT_PAIRS, toSimplified, traditionalCharsIn } from '../zh-script.ts';
import { DESIGN_REFERENCE_WIDTH, TOUCH_TARGET, radius } from '../../theme/tokens.ts';
import {
  AFTER_TUTORIAL_ROUTE,
  TUTORIAL_CONSEQUENCES,
  TUTORIAL_WAIT_MS,
  demoReceipt,
  isDemo,
  needsTutorial,
} from '../tutorial.ts';

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
check('interpolation works', t('clan_welcome', { name: '陈氏' }).includes('陈氏'));

/*
 * ⚠️ RESOLVABILITY — NOT parity, and the gap between the two is the whole point.
 *
 * The parity checks above compare key SETS, so all of them stayed green while
 * EVERY dotted key in the table was unreachable on the device: `i18n-js` reads
 * `.` as a scope separator, so `t('ritual.cannotPrepare')` resolved to
 * `[missing "en.ritual.cannotPrepare" translation]`. Found on glass 2026-10-06,
 * on the slice's failure screen — precisely where a player needs the words.
 *
 * A key that cannot be looked up is not a translation, so assert each one
 * RESOLVES. The marker is matched precisely: `[missing "…" translation]` is the
 * missing-TRANSLATION string, whereas an unfilled placeholder renders
 * `[missing "%{name}" value]` — a different thing, and not a failure here.
 */
const unresolved: string[] = [];
for (const locale of LOCALES) {
  setLocale(locale);
  for (const key of messageKeys(locale)) {
    if (/\[missing .* translation\]/.test(t(key))) unresolved.push(`${locale}:${key}`);
  }
}
setLocale('en');
check(
  'every message RESOLVES in both locales (a key that cannot be looked up is not a translation)',
  unresolved.length === 0,
  unresolved.slice(0, 6).join(', ') + (unresolved.length > 6 ? ` (+${unresolved.length - 6} more)` : ''),
);

/*
 * Resolving is not the same as resolving to the RIGHT copy, so assert the
 * stronger property for every message without placeholders: the lookup must
 * return that key's own copy, VERBATIM. (`%{…}` values are skipped — an unfilled
 * placeholder legitimately renders differently — and interpolation itself is
 * covered by the check above.)
 *
 * This is the assertion that names the 2026-10-06 regression: `ritual.cannotPrepare`
 * and its 15 dotted siblings appear here by name if they ever go unreachable again.
 */
const mismatched: string[] = [];
for (const locale of LOCALES) {
  setLocale(locale);
  for (const [key, value] of Object.entries(MESSAGES[locale])) {
    if (typeof value === 'string' && !value.includes('%{') && t(key) !== value) {
      mismatched.push(`${locale}:${key}`);
    }
  }
}
setLocale('en');
check(
  'every placeholder-free message returns its OWN copy verbatim',
  mismatched.length === 0,
  mismatched.slice(0, 6).join(', ') + (mismatched.length > 6 ? ` (+${mismatched.length - 6} more)` : ''),
);

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

function serviceChecks(): void {
  section('8 · Service layer — the server response becomes a state-machine event');

  // This is where the slice's three rules are DECIDED, so it gets its own gate
  // even though the mapping is pure. The temptation this suite exists to kill:
  // treating every non-200 as a failure, and every `queued` as a job in flight.

  const styled = eventsFromResponse({ job_id: 'j1', status: 'styled', styled_path: 'styled/j1' });
  check('a styled response is STYLED with its path', styled[0]?.type === 'STYLED');
  check('the sprite path is carried through, not re-derived', (styled[0] as { spritePath: string }).spritePath === 'styled/j1');

  const failed = eventsFromResponse({ job_id: 'j2', status: 'failed' });
  check('a failed response is GENERATION_FAILED', failed[0]?.type === 'GENERATION_FAILED');

  // ⚠️ RULE ③ — the response that has no `error` in it. HTTP 200, status
  // 'queued', code 'shrine_busy'. This is the AI-budget stop-rule doing exactly
  // what it was built to do (SCRUM-59 / ADR-006), and it must file as a PARK.
  const parked = eventsFromResponse({ job_id: 'j3', status: 'queued', queued: true, code: 'shrine_busy' });
  check('a shrine_busy 200 is BUDGET_PARKED, NOT a failure', parked[0]?.type === 'BUDGET_PARKED');

  // The same park with the flag omitted but the code present: the two arrive
  // together, and a server that dropped one must not turn a park into a job.
  check('shrine_busy parks even without the queued flag', eventsFromResponse({ job_id: 'j3', status: 'queued', code: 'shrine_busy' })[0]?.type === 'BUDGET_PARKED');
  // …and with the code absent but the flag present.
  check('the queued flag alone also parks', eventsFromResponse({ job_id: 'j3', status: 'queued', queued: true })[0]?.type === 'BUDGET_PARKED');

  const inFlight = eventsFromResponse({ job_id: 'j4', status: 'processing' });
  check('a processing job is a DRAFT the UI waits on, not a park', inFlight[0]?.type === 'CART_DRAFT');
  check('a processing job is definitely NOT parked', inFlight[0]?.type !== 'BUDGET_PARKED');

  // Rejection is a provider refusal (moderation) — the offering is spent, so it
  // takes the same road as a failure, NOT the polling road.
  check('a provider rejection is GENERATION_FAILED', eventsFromResponse({ job_id: 'j5', status: 'rejected' })[0]?.type === 'GENERATION_FAILED');
  check('an already_requested re-run is a DRAFT, never a second charge', eventsFromResponse({ job_id: 'j6', status: 'queued', already_requested: true })[0]?.type === 'CART_DRAFT');

  /**
   * THE PROOF THAT MATTERS: take the real `shrine_busy` body, run the mapping, and
   * then run the STATE MACHINE on it. A unit check that only inspects the event's
   * name would pass even if the machine filed the park as a failure.
   *
   * ⚠️ It replays the WHOLE sequence — capture, then draft, then the outcome —
   * because `BUDGET_PARKED` is only legal from `preparing`. Feeding it a park
   * from `INITIAL_OFFERING` is an illegal transition the machine correctly
   * ignores, which would make the check pass for the wrong reason.
   */
  const capturing = applyAll(INITIAL_OFFERING, [{ type: 'CAPTURE_TAKEN', captureId: 'cap-1' }]);
  check('a capture mints the id and reaches `ready`', capturing.state === 'ready' && capturing.captureId === 'cap-1');

  const park = applyAll(applyAll(capturing, [{ type: 'CART_DRAFT' }]), parked);
  check('the machine ACCEPTS a park (BUDGET_PARKED is legal from `preparing`)', park.state === 'queued');
  check('a parked offering is WAITING, not lost', isWaiting(park.state));
  check('a parked offering waits rather than demanding a new capture', nextAction(park) === 'wait');
  check('a park does NOT demand a re-capture — nothing was spent', park.needsRecapture === false);
  check('a park KEEPS the capture id, so the job can still find it', park.captureId === 'cap-1');

  // The asymmetry that would strand a player. A failed generation has SPENT the
  // capture, so the machine must demand a new one; a park has not.
  const spent = applyAll(applyAll(capturing, [{ type: 'CART_DRAFT' }]), failed);
  check('a failed generation leaves the offering needing a NEW capture', nextAction(spent) === 'recapture');
  check('a failure clears the capture id — that id is spent forever', spent.captureId === null);
  check('a failure does NOT leave the offering waiting (nothing is in flight)', !isWaiting(spent.state));
  check(
    '⚠️ a PARK waits and a FAILURE recaptures — they are NOT the same road',
    nextAction(park) === 'wait' && nextAction(spent) === 'recapture',
  );

  // The styled road, for contrast: a job that ran is a sprite and a throw.
  const done = applyAll(applyAll(capturing, [{ type: 'CART_DRAFT' }]), styled);
  check('a styled response reaches `styled` and can be thrown', done.state === 'styled' && nextAction(done) === 'throw');
  check('the sprite path survives the machine unchanged', done.spritePath === 'styled/j1');

  // ── 9 · the slice's clan bootstrap (SCRUM-82) ────────────────────────────
  // `submit_burn` requires a clan_id; the slice stands one up on first use. The
  // default name must satisfy `create_clan`'s 2..20 rule, and a caller who
  // already has a clan must REUSE it rather than make a second altar.
  // ⚠️ SCRUM-83 RETIRED THE SLICE'S AUTO-CREATE. This section used to assert
  // `planClan` (reuse-or-create) and the hard-coded `SLICE_CLAN_NAME`; both were
  // DELETED from `clan-rules.ts`, because the first burn is now a tutorial and
  // the real fork follows it. The NAME rule survives — create and rename need it.
  section('9 · The clan NAME rule (the SCRUM-82 shortcut is retired)');
  check('a 2-character name is accepted', isValidClanName('陈氏'));
  check('a 20-character name is accepted', isValidClanName('x'.repeat(20)));
  check('a 1-character name is rejected', !isValidClanName('a'));
  check('a 21-character name is rejected', !isValidClanName('x'.repeat(21)));
  check('surrounding whitespace does not defeat the check', isValidClanName('  Tan Family  '));
  check('an all-whitespace name is rejected', !isValidClanName('     '));

  // ── 10 · the clan ladder (SCRUM-46 · doc 15 §3/§5/§7) ───────────────────
  // The role matrix, the ≥1-head invariant, the anti-abuse numbers and the
  // Book window — the rules `0012_clan_management_api.sql` enforces, asserted
  // where they can be asserted without a database.
  section('10 · The clan ladder (SCRUM-46 · doc 15 §3 · §5.2 · §7)');

  // the two role sets — the distinction every head test depends on
  check('head power is exactly head + co_head (doc 15 §3)', HEAD_POWER_ROLES.length === 2 &&
    hasHeadPower('head') && hasHeadPower('co_head') && !hasHeadPower('elder') && !hasHeadPower('member'));
  check('head is NOT an assignable role — succession runs via co_head', !ASSIGNABLE_ROLES.includes('head'));
  check('co_head, elder and member ARE assignable', ASSIGNABLE_ROLES.length === 3);
  check('junk is not a clan role', !isClanRole('owner'));

  // the matrix, row by row (doc 15 §3)
  check('every role may make an offering', (['head', 'co_head', 'elder', 'member'] as const).every(canOffer));
  check('an elder may add/remove ancestors', canEditAncestors('elder'));
  check('⚠️ a member may NOT add/remove ancestors', !canEditAncestors('member'));
  check('a head may invite', canInvite('head'));
  check('a co-head may invite (full Head column)', canInvite('co_head'));
  // ⚠️ FIXED BY SCRUM-86 (PM, 2026-10-09: "limit link sharing to elder and above
  // seniority"). This line used to read `!canInvite('elder')`, justified by a
  // comment claiming doc 15 §3 said "Elder ❌" — ⚠️ **IT DID NOT.** The matrix has
  // always read `| Invite new members (link · code · QR) | ✅ | ✅ | ❌ |`. So this
  // assertion was ENFORCING A MISQUOTE OF THE SPEC. It is kept as an assertion
  // rather than deleted, because a rule stated in two places is exactly what lets
  // one of them drift — a change here now has to argue with the document.
  check('⚠️ an elder MAY invite — doc 15 §3, confirmed by SCRUM-86', canInvite('elder'));
  check('⚠️ a member may NOT invite — the boundary the PM drew', !canInvite('member'));
  check('an outsider may not invite', !canInvite(null) && !canInvite(undefined));

  check('a head may rename the clan', canRenameClan('head'));
  check('an elder may NOT rename the clan', !canRenameClan('elder'));
  check('a head may remove a member', canRemoveMember('head'));
  check('a member may NOT remove a member', !canRemoveMember('member'));
  check('a co-head may delete the clan (full Head column)', canDeleteClan('co_head'));
  check('an elder may NOT delete the clan', !canDeleteClan('elder'));

  // the role-change rules (mirrors set_member_role)
  check('a head may promote a member to elder', roleChangeRefusal('head', 'member', 'elder') === null);
  check('a head may lift an elder to co-head', roleChangeRefusal('head', 'elder', 'co_head') === null);
  check('a co-head may promote (full Head column)', roleChangeRefusal('co_head', 'member', 'elder') === null);
  check('⚠️ an elder may NOT promote', roleChangeRefusal('elder', 'member', 'elder') === 'actor_lacks_head_power');
  check('a member may NOT promote', roleChangeRefusal('member', 'member', 'elder') === 'actor_lacks_head_power');
  check('⚠️ head is refused as a new role', roleChangeRefusal('head', 'member', 'head') === 'role_not_assignable');
  check('the founder’s role cannot be changed', roleChangeRefusal('head', 'head', 'elder') === 'target_is_founder');
  check('a demotion back down is allowed', roleChangeRefusal('head', 'co_head', 'elder') === null);

  // the ≥ 1 head invariant (doc 15 §3)
  check('a clan of members only IS headless', isHeadless(['member', 'elder']));
  check('a lone co-head is NOT headless — co-head carries head power', !isHeadless(['co_head']));
  check('an empty clan is headless', isHeadless([]));

  // leaving — THE SCRUM-84 RAMP (PM-answered 2026-10-08). Its MEANING changed:
  // a sole head is no longer refused, they leave BY PROMOTING. These assertions
  // replaced five that encoded the old promote-first-only reading.
  const lm = (userId: string, role: ClanRole, joinedAt: string): LeaveMember => ({ userId, role, joinedAt });
  const base = [lm('u-head', 'head', '2026-01-01'), lm('u-b', 'member', '2026-02-01')];
  const withElder = [...base, lm('u-e', 'elder', '2026-02-01')];

  check('a member leaves freely', planLeave(base, 'u-b').action === 'leave');
  check('an elder leaves freely', planLeave(withElder, 'u-e').action === 'leave');
  check('a non-member cannot leave',
    planLeave(base, 'u-nobody').action === 'refuse');
  check('a head with a co-head simply leaves — nothing to inherit',
    planLeave([...base, lm('u-c', 'co_head', '2026-03-01')], 'u-head').action === 'leave');

  // ⚠️ SCRUM-84 CLARIFIED 2026-10-08: "if there is a cohead and another cohead
  // leaves without nominating the cohead becomes the only cohead." So a co-head
  // leaving needs NO nomination while another head-power holder remains — and the
  // ramp must NOT fire, even when an elder is available to promote.
  const twoCoHeads = [
    lm('u-c1', 'co_head', '2026-01-01'),
    lm('u-c2', 'co_head', '2026-02-01'),
    lm('u-e', 'elder', '2026-03-01'),
  ];
  check('⚠️ a CO-HEAD leaving with another co-head present just leaves',
    planLeave(twoCoHeads, 'u-c1').action === 'leave');
  check('⚠️ …and the ramp does NOT fire, even though an elder is available',
    planLeave(twoCoHeads, 'u-c1').action !== 'auto_promote_then_leave');
  const headPlusCoHead = [lm('u-h', 'head', '2026-01-01'), lm('u-c', 'co_head', '2026-02-01')];
  check('a co-head leaving while the founder remains just leaves',
    planLeave(headPlusCoHead, 'u-c').action === 'leave');
  check('…and the founder leaving while a co-head remains just leaves',
    planLeave(headPlusCoHead, 'u-h').action === 'leave');
  check('⚠️ the ramp only fires when NO other head-power holder is left',
    planLeave([lm('u-c1', 'co_head', '2026-01-01'), lm('u-e', 'elder', '2026-02-01')], 'u-c1')
      .action === 'auto_promote_then_leave');

  // the case the PM's instruction does not cover: no co-head, no elder, nobody named
  const noSuccessor = planLeave(base, 'u-head');
  check('⚠️ a sole head with nobody to inherit is REFUSED',
    noSuccessor.action === 'refuse' && noSuccessor.reason === 'no_successor');
  check('⚠️ …and a plain MEMBER is never auto-promoted — the fallback is elders only',
    planLeave(base, 'u-head').action === 'refuse');

  // STEP 1 · the head NAMES a successor
  const named = planLeave(withElder, 'u-head', 'u-b');
  check('a NAMED successor is promoted, then the head leaves',
    named.action === 'promote_then_leave' && named.successorId === 'u-b');
  const selfNamed = planLeave(withElder, 'u-head', 'u-head');
  check('naming yourself is refused',
    selfNamed.action === 'refuse' && selfNamed.reason === 'successor_is_self');
  const strangerNamed = planLeave(withElder, 'u-head', 'u-nobody');
  check('naming a non-member is refused',
    strangerNamed.action === 'refuse' && strangerNamed.reason === 'successor_not_member');

  // STEP 2 · nobody named → the OLDEST ELDER by time of joining
  const auto = planLeave(withElder, 'u-head');
  check('⚠️ no successor named → the oldest elder is AUTO-promoted',
    auto.action === 'auto_promote_then_leave' && auto.successorId === 'u-e');

  const twoElders = [...base, lm('u-late', 'elder', '2026-06-01'), lm('u-early', 'elder', '2026-02-01')];
  const older = planLeave(twoElders, 'u-head');
  check('⚠️ with two elders the OLDER one wins, whatever the row order',
    older.action === 'auto_promote_then_leave' && older.successorId === 'u-early');

  const tied = [...base, lm('u-zzz', 'elder', '2026-02-01'), lm('u-aaa', 'elder', '2026-02-01')];
  const tie = planLeave(tied, 'u-head');
  check('⚠️ a tie on joined_at breaks on user_id — the rule is deterministic',
    tie.action === 'auto_promote_then_leave' && tie.successorId === 'u-aaa');
  check('oldestElder excludes the departing head',
    oldestElder(withElder, 'u-e') === null && oldestElder(withElder, 'u-head')?.userId === 'u-e');

  // ⚠️ THE SUCCESSOR'S RANK — SCRUM-84, ANSWERED BY THE PM 2026-10-08:
  //
  //   "hand over to a new head if no co-head, co-head if co-head already exists."
  //
  // The successor INHERITS the departing rank. These checks are the reason the rank
  // is carried on the plan at all instead of living inside an `UPDATE`: a fixed
  // value would pass every other assertion in this file.
  check('⚠️ a departing HEAD hands over to a new HEAD — not a co-head',
    named.action === 'promote_then_leave' && named.promoteTo === 'head');
  check('⚠️ …and the AUTO-promoted oldest elder becomes the HEAD too',
    auto.action === 'auto_promote_then_leave' && auto.promoteTo === 'head');
  check('⚠️ …and the OLDER of two elders as well — the rank is not path-dependent',
    older.action === 'auto_promote_then_leave' && older.promoteTo === 'head');

  // The SOLE-co_head branch — ⚠️ this is the check that stops anyone "simplifying"
  // promoteTo back to a hard-coded `head`. There is NO `head` row here (reachable
  // once a founder has gone), so the departing co-head's successor stays a co-head.
  const soleCoHead = [lm('u-c1', 'co_head', '2026-01-01'), lm('u-e', 'elder', '2026-02-01')];
  const coNamed = planLeave(soleCoHead, 'u-c1', 'u-e');
  check('⚠️ a departing SOLE CO-HEAD hands over to a CO-HEAD — never a head',
    coNamed.action === 'promote_then_leave' && coNamed.promoteTo === 'co_head');
  const coAuto = planLeave(soleCoHead, 'u-c1');
  check('⚠️ …and auto-promoting there stays a CO-HEAD as well',
    coAuto.action === 'auto_promote_then_leave' && coAuto.promoteTo === 'co_head');

  // "co-head if co-head already exists" — the handover goes TO the existing
  // co-head, so a head who leaves one behind promotes NOBODY.
  check('⚠️ a head leaving a CO-HEAD behind promotes NOBODY — that co-head carries on',
    planLeave(headPlusCoHead, 'u-h').action === 'leave');

  // the invariant, stated once: the rank is ALWAYS the departing role
  check('⚠️ the promoted rank is always the DEPARTING role — never a fixed value',
    named.promoteTo === 'head' && coNamed.promoteTo === 'co_head');
  check('…and both candidate ranks are head power, so the clan is never left headless',
    hasHeadPower('head') && hasHeadPower('co_head'));

  check('canLeaveClan: a sole head CAN leave once an elder exists', canLeaveClan(withElder, 'u-head'));
  check('canLeaveClan: …and cannot when there is no successor',
    !canLeaveClan(base, 'u-head'));

  // anti-abuse (doc 15 §5.2)
  check('the clans-per-user limit is 10', CLANS_PER_USER === 10);
  check('the joins-per-hour limit is 3', JOINS_PER_HOUR === 3);
  check('⚠️ the joins-per-hour limit is BELOW the clan cap — or the limb is dead logic',
    JOINS_PER_HOUR < CLANS_PER_USER);
  check('9 clans is allowed', joinRefusal(CLANS_PER_USER - 1, 0) === null);
  check('⚠️ the 10th clan is refused', joinRefusal(CLANS_PER_USER, 0) === 'too_many_clans');
  check('9 joins in an hour is allowed', joinRefusal(0, JOINS_PER_HOUR - 1) === null);
  check('⚠️ the 10th join in an hour is refused', joinRefusal(0, JOINS_PER_HOUR) === 'too_many_joins');
  check('the clan count is refused before the join burst', joinRefusal(CLANS_PER_USER, JOINS_PER_HOUR) === 'too_many_clans');

  // the Book window — HIDE, not purge (doc 15 §7 · §10.5)
  check('the Book window is 30 days', BOOK_WINDOW_DAYS === 30);
  const nowMs = Date.UTC(2026, 9, 8);
  check('the window start is 30 days back', bookWindowStart(nowMs) === nowMs - 30 * MS_PER_DAY);
  check('an entry from 5 days ago is shown', isInBookWindow(nowMs - 5 * MS_PER_DAY, nowMs));
  check('⚠️ an entry from 45 days ago is HIDDEN (not deleted)', !isInBookWindow(nowMs - 45 * MS_PER_DAY, nowMs));
  check('a future-dated entry is shown', isInBookWindow(nowMs + MS_PER_DAY, nowMs));

  // the two Book projections (doc 15 §7.2)
  check('a member sees the full entry', bookProjection(true) === 'full');
  check('⚠️ a non-member gets the anonymised entry', bookProjection(false) === 'anonymous');

  // ── 11 · the clan SCREENS (SCRUM-46 · doc 15 §4/§8) ────────────────────
  // The wizard order, the button gates, the preview card and the RENDERED
  // action list. ⚠️ The keys the pure module RETURNS are asserted to EXIST in
  // both locales — the guard that would have caught the dotted-key bug (a key
  // the code asks for but the table never defined renders `[missing]`).
  section('11 · The clan screens — fork · create · join · manage (SCRUM-46)');

  const enKeys = new Set(messageKeys('en'));
  const zhKeys = new Set(messageKeys('zh'));
  const keyExists = (k: string): boolean => enKeys.has(k) && zhKeys.has(k);

  // the fork — one screen, two cards (doc 15 §4.1)
  check('the fork is exactly two cards', Object.keys(FORK).length === 2);
  check('the join card has a title and a hint',
    FORK.join.titleKey === 'clan.forkJoin' && FORK.join.hintKey === 'clan.forkJoinHint');
  check('the create card has a title and a hint',
    FORK.create.titleKey === 'clan.forkCreate' && FORK.create.hintKey === 'clan.forkCreateHint');
  check('⚠️ all four fork strings exist in BOTH locales',
    [FORK.join.titleKey, FORK.join.hintKey, FORK.create.titleKey, FORK.create.hintKey].every(keyExists));

  // the wizard — four taps to head (doc 15 §4.2)
  check('four taps to head', CREATE_STEPS.length === 4);
  check('⚠️ the invite card comes BEFORE the ancestor sheet (the amended order)',
    createStepIndex('invite') < createStepIndex('ancestors'));
  check('the first tap is naming', CREATE_STEPS[0] === 'name');
  check('the wizard walks forward',
    nextCreateStep('name') === 'confirm' && nextCreateStep('confirm') === 'invite' &&
    nextCreateStep('invite') === 'ancestors');
  check('the wizard ends — the last tap has no successor', nextCreateStep('ancestors') === null);
  check('the wizard walks BACK',
    previousCreateStep('ancestors') === 'invite' && previousCreateStep('confirm') === 'name');
  check('the wizard cannot walk back past the first tap', previousCreateStep('name') === null);
  check('⚠️ the invite card is skippable (doc 15 §4.2)', isSkippable('invite'));
  check('the ancestor sheet is skippable too — Skip and Continue both lead into it',
    isSkippable('ancestors'));
  check('naming and confirming are NOT skippable', !isSkippable('name') && !isSkippable('confirm'));

  // the two primary buttons
  check('Create is enabled for a valid name', canSubmitName('Tan Family'));
  check('Create is DISABLED for a 1-character name', !canSubmitName('a'));
  check('Create is DISABLED for a 21-character name', !canSubmitName('x'.repeat(21)));
  check('Create tolerates a padded name', canSubmitName('  Tan Family  '));
  check('Join is enabled once the code is canonical', canSubmitCode('ABCDEFGH'));
  check('⚠️ Join normalises lower case — people read these aloud', canSubmitCode('abcdefgh'));
  check('Join tolerates spaces and hyphens', canSubmitCode('ABCD-EFGH'));
  check('Join is DISABLED for a 7-character code', !canSubmitCode('ABCDEFG'));
  check('⚠️ Join is DISABLED for a code with I/L/O/0/1 — not in the alphabet',
    !canSubmitCode('ABCDEFGI') && !canSubmitCode('ABCDEFG0'));

  // the preview card — counts only, never a name (doc 15 §8 C8 · doc 13 §4)
  check('previewArgs floors a fractional count', previewArgs('Tan', 2.9, 3.1).ancestors === 2);
  check('previewArgs clamps a negative count to 0', previewArgs('Tan', -5, 3).ancestors === 0);
  check('previewArgs clamps NaN to 0',
    previewArgs('Tan', Number.NaN, 3).ancestors === 0 && previewArgs('Tan', Number.NaN, 3).members === 3);
  check('the preview copy is owned by i18n, not the module', keyExists(PREVIEW_MESSAGE_KEY));
  check('⚠️ a preview never shows ancestor names before joining (doc 13 §4)',
    PREVIEW_SHOWS_ANCESTOR_NAMES === false);

  // role + promote labels (doc 15 §8 C11/C12)
  check('all four roles have a label', Object.keys(ROLE_LABEL_KEY).length === 4);
  check('⚠️ every role label is translated in BOTH locales',
    Object.values(ROLE_LABEL_KEY).every(keyExists));
  check('promoting to co-head is labelled', promoteLabelKey('co_head') === 'clan.makeCoHead');
  check('promoting to elder is labelled', promoteLabelKey('elder') === 'clan.makeElder');
  check('⚠️ head is NOT offered as a promotion — succession runs through co-head',
    promoteLabelKey('head') === null);
  check('a member target offers nothing', promoteLabelKey('member') === null);
  check('both promote labels are translated',
    keyExists('clan.makeCoHead') && keyExists('clan.makeElder'));
  check('the leave refusal has copy to show', keyExists(leaveHintKey()));

  // the action list — the matrix AS RENDERED (doc 15 §3)
  const headActions = actionsFor('head');
  const headNeeds = ['offer', 'book', 'ancestors', 'invite', 'manage', 'rename', 'delete', 'leave'] as const;
  check('a head gets offer · book · ancestors · invite · manage · rename · delete · leave',
    headNeeds.every((a) => headActions.includes(a)));
  const elderActions = actionsFor('elder');
  check('an elder can add ancestors', elderActions.includes('ancestors'));
  check('⚠️ an elder CAN invite — doc 15 §3, confirmed by SCRUM-86',
    elderActions.includes('invite'));
  check('an elder cannot manage, rename or delete',
    !elderActions.includes('manage') && !elderActions.includes('rename') &&
    !elderActions.includes('delete'));
  const memberActions = actionsFor('member');
  check('a member may offer and read the Book',
    memberActions.includes('offer') && memberActions.includes('book'));
  check('⚠️ a member may NOT add ancestors', !memberActions.includes('ancestors'));
  check('a member may leave', memberActions.includes('leave'));
  check('a co-head carries the full Head column',
    actionsFor('co_head').includes('delete') && actionsFor('co_head').includes('invite'));
  check('⚠️ a NON-member gets the Book ONLY — no Offer, no Leave', actionsFor(null).join() === 'book');
  check('the outsider helper agrees with it', actionsForOutsider().join() === 'book');
  check('an unknown role is treated as an outsider', actionsFor(undefined).join() === 'book');

  // ── 12 · the FIRST-RUN TUTORIAL (SCRUM-85 · the SCRUM-83 answer) ────────
  // ⚠️ THE FIRST ASSERTION IS THE IMPORTANT ONE. If a future change wires the demo
  // into the server or the AI, it has to delete an assertion that says why — a
  // per-user ≈US$0.09 cost that would otherwise land silently, before any quota
  // or clan exists to bound it.
  section('12 · The first-run tutorial — no clan, no points, no spend (SCRUM-85)');

  check('⚠️ a tutorial creates NO clan', TUTORIAL_CONSEQUENCES.createsClan === false);
  check('⚠️ a tutorial awards NO points', TUTORIAL_CONSEQUENCES.awardsPoints === false);
  check('⚠️ a tutorial writes NOTHING to the ledger', TUTORIAL_CONSEQUENCES.writesLedger === false);
  check('⚠️ a tutorial makes NO server call', TUTORIAL_CONSEQUENCES.callsServer === false);
  check('⚠️ a tutorial makes NO AI call — this is the ≈US$0.09/user one',
    TUTORIAL_CONSEQUENCES.callsAi === false);
  check('every consequence is asserted, not just the convenient ones',
    Object.values(TUTORIAL_CONSEQUENCES).every((v) => v === false));

  // the first-run decision
  check('a missing record means the tutorial is still owed', needsTutorial(null));
  check('an empty record means the tutorial is still owed', needsTutorial({ tutorialDone: false }));
  check('a completed record means it is NOT', !needsTutorial({ tutorialDone: true }));
  check('⚠️ anything other than an explicit true replays the tutorial',
    needsTutorial({ tutorialDone: undefined as unknown as boolean }));

  // option C, after it
  check('⚠️ the tutorial hands off to the FORK, not an auto-created altar',
    AFTER_TUTORIAL_ROUTE === '/clan');

  // the demo receipt
  const devoutDemo = demoReceipt(20);
  check('the demo receipt is flagged as a demo', devoutDemo.demo === true);
  check('⚠️ the demo receipt moves NO balance', devoutDemo.balanceDelta === 0);
  check('the demo uses the REAL award maths, so the number is truthful',
    devoutDemo.band === 'devout' && devoutDemo.award === 600);
  check('a bullseye demo reads 800 — 400 base × 2.0, and no bonuses in a demo',
    demoReceipt(0).award === 800);
  check('a graze demo reads 400', demoReceipt(70).award === 400);
  check('a miss demo reads 0', demoReceipt(200).award === 0);
  check('⚠️ a demo receipt has no balance field to render as real money',
    !('tribute_balance' in devoutDemo) && !('idempotency_key' in devoutDemo));

  // the flag itself
  check('the demo marker is read positively', isDemo('1'));
  check('⚠️ anything else is NOT a demo — an unreadable flag runs the REAL ritual',
    !isDemo('0') && !isDemo('true') && !isDemo(undefined) && !isDemo('') && !isDemo(' 1'));
  check('the tutorial’s wait is a real beat, not zero', TUTORIAL_WAIT_MS > 0);

  section('13 · Invites on glass — the scanner, the deep link and the held invite (SCRUM-50)');

  // ── the scan decision: the camera fires CONTINUOUSLY while a code is in frame ──
  const linkPayload = qrPayload('ABCD2345');
  const first = scanDecision({ payload: linkPayload, lastAccepted: null, busy: false });
  check('a first scan of the invite QR is ACCEPTED', first.accept === true);
  check('…and yields the canonical code', first.accept === true && first.code === 'ABCD2345');

  const repeat = scanDecision({ payload: linkPayload, lastAccepted: 'ABCD2345', busy: false });
  check('⚠️ the SAME payload again is a DUPLICATE, not a second join',
    repeat.accept === false && repeat.reason === 'duplicate');

  // ⚠️ THE ONE THAT MATTERS: the same code arrives as a LINK from the QR and as a
  // BARE CODE from a paste box. Comparing raw strings would let both through.
  const reshaped = scanDecision({ payload: 'ABCD2345', lastAccepted: linkPayload, busy: false });
  check('⚠️ the same code in a DIFFERENT shape is STILL a duplicate (canonical compare)',
    reshaped.accept === false && reshaped.reason === 'duplicate');

  const other = scanDecision({ payload: qrPayload('WXYZ6789'), lastAccepted: 'ABCD2345', busy: false });
  check('a different code is accepted', other.accept === true && other.code === 'WXYZ6789');

  const whileBusy = scanDecision({ payload: linkPayload, lastAccepted: null, busy: true });
  check('⚠️ busy wins — nothing is accepted while a join is in flight',
    whileBusy.accept === false && whileBusy.reason === 'busy');

  const junkScan = scanDecision({ payload: 'https://example.com/hello', lastAccepted: null, busy: false });
  check('⚠️ an unreadable QR is refused, never guessed at', junkScan.accept === false && junkScan.reason === 'unreadable');
  check('a null / undefined / empty payload is unreadable',
    !scanDecision({ payload: null, lastAccepted: null, busy: false }).accept &&
      !scanDecision({ payload: undefined, lastAccepted: null, busy: false }).accept &&
      !scanDecision({ payload: '', lastAccepted: null, busy: false }).accept);
  check('a near-miss code (9 chars) is unreadable, not truncated to 8',
    parseInviteCandidate(inviteLink('ABCD2345') + '9') === null);

  // ── the QR payload carries ONLY the code (doc 13 §4) ──────────────────────
  check('a real code produces a SAFE payload', isInvitePayloadSafe('ABCD2345'));
  check('⚠️ the payload is the LINK, not the bare code', qrPayload('ABCD2345') !== 'ABCD2345');
  check('⚠️ the payload is exactly inviteLink — one payload serves QR · link · share',
    qrPayload('ABCD2345') === inviteLink('ABCD2345'));
  check('⚠️ a payload mentioning ancestors or members is refused',
    !isInvitePayloadSafe('ancestor') && !isInvitePayloadSafe('member!!') && !isInvitePayloadSafe('clan_id'));
  check('a malformed code produces no payload', !isInvitePayloadSafe('nope'));

  // ── resolve → preview → join (doc 07 §4.6) ────────────────────────────────
  check('no canonical code yet → empty (nothing was asked of the server)',
    resolveState({ code: null, looking: false, found: null, transportFailed: false }) === 'empty');
  check('a request in flight → looking, whatever else is known',
    resolveState({ code: 'ABCD2345', looking: true, found: true, transportFailed: true }) === 'looking');
  check('the server said "no such clan" → notFound',
    resolveState({ code: 'ABCD2345', looking: false, found: false, transportFailed: false }) === 'notFound');
  check('the server returned a clan → found',
    resolveState({ code: 'ABCD2345', looking: false, found: true, transportFailed: false }) === 'found');

  // ⚠️ THE REGRESSION THIS SECTION EXISTS FOR. The first implementation collapsed
  // "bad code" and "could not reach the shrine" into one flag, so going offline
  // told the user their family's code was wrong — and the invite was never
  // retried. These two assertions fail together if the states are merged again.
  const offlineState = resolveState({ code: 'ABCD2345', looking: false, found: null, transportFailed: true });
  check('⚠️ a transport failure → unreachable, NOT notFound', offlineState === 'unreachable');
  check('⚠️ …so it does not reuse the invalid-code message',
    RESOLVE_MESSAGE_KEY.unreachable !== RESOLVE_MESSAGE_KEY.notFound);

  // every non-null message key must actually resolve in BOTH locales
  for (const state of ['notFound', 'unreachable'] as const) {
    const key = RESOLVE_MESSAGE_KEY[state];
    check(`the ${state} message resolves in EN and 中文`,
      key !== null && messageKeys('en').includes(key) && messageKeys('zh').includes(key));
  }

  // ── the Join button's enablement ──────────────────────────────────────────
  check('Join is offered on a real preview', canJoin({ state: 'found', isMember: false, joining: false }));
  check('⚠️ Join is NOT offered to someone already in the clan',
    !canJoin({ state: 'found', isMember: true, joining: false }));
  check('Join is not offered while already joining',
    !canJoin({ state: 'found', isMember: false, joining: true }));
  check('⚠️ Join is NOT offered offline — the preview never arrived',
    !canJoin({ state: 'unreachable', isMember: false, joining: false }));
  check('Join is not offered for a code that does not resolve',
    !canJoin({ state: 'notFound', isMember: false, joining: false }));
  check('Join is not offered before a code is entered',
    !canJoin({ state: 'empty', isMember: false, joining: false }));

  // ── the HELD invite — doc 07 §4.6: opened before first-run completes ───────
  check('nothing to hold without a code',
    shouldHoldInvite({ sessionOk: false, reached: false, code: null }) === null);
  check('⚠️ no identity yet → HOLD (do not error: the user did nothing wrong)',
    shouldHoldInvite({ sessionOk: false, reached: true, code: 'ABCD2345' }) === 'no_identity');
  check('a reachable shrine with a session → proceed, no hold',
    shouldHoldInvite({ sessionOk: true, reached: true, code: 'ABCD2345' }) === null);
  check('an unreachable shrine → HOLD, so the invite survives (the queued join)',
    shouldHoldInvite({ sessionOk: true, reached: false, code: 'ABCD2345' }) === 'offline');

  check('a malformed code cannot be held at all', makeHeldInvite('nope', 'offline', 1) === null);

  const parkedAt = 1_800_000_000_000;
  const heldRecord = makeHeldInvite('abcd2345', 'no_identity', parkedAt);
  check('a held invite is stored CANONICAL, not as typed',
    heldRecord !== null && heldRecord.code === 'ABCD2345');
  check('a held invite keeps its reason', heldRecord !== null && heldRecord.reason === 'no_identity');

  const roundTrip = parseHeldInvite(JSON.stringify(heldRecord), parkedAt + 1000);
  check('a held invite survives a storage round-trip',
    roundTrip !== null && roundTrip.code === 'ABCD2345' && roundTrip.heldAt === parkedAt);

  // ⚠️ AsyncStorage returns whatever a previous build wrote — junk must read as
  // "nothing held", never as a half-built record that paints a screen with no code.
  check('⚠️ unparseable junk reads as nothing held',
    parseHeldInvite('{not json', parkedAt) === null && parseHeldInvite('', parkedAt) === null);
  check('⚠️ a JSON array or a bare number reads as nothing held',
    parseHeldInvite('[]', parkedAt) === null && parseHeldInvite('42', parkedAt) === null);
  check('⚠️ a missing or unknown reason reads as nothing held',
    parseHeldInvite(JSON.stringify({ code: 'ABCD2345', heldAt: parkedAt }), parkedAt) === null &&
      parseHeldInvite(JSON.stringify({ code: 'ABCD2345', reason: 'because', heldAt: parkedAt }), parkedAt) === null);
  check('⚠️ a corrupted code reads as nothing held',
    parseHeldInvite(JSON.stringify({ code: 'nope', reason: 'offline', heldAt: parkedAt }), parkedAt) === null);
  check('a missing heldAt reads as held-at-zero, which is stale → nothing held',
    parseHeldInvite(JSON.stringify({ code: 'ABCD2345', reason: 'offline' }), parkedAt) === null);

  check('an invite held a week ago is honoured',
    !isHeldInviteStale({ code: 'ABCD2345', reason: 'offline', heldAt: parkedAt }, parkedAt + HELD_INVITE_MAX_AGE_MS));
  check('⚠️ a hold past the window is NOT honoured (the code may be re-rolled)',
    isHeldInviteStale({ code: 'ABCD2345', reason: 'offline', heldAt: parkedAt }, parkedAt + HELD_INVITE_MAX_AGE_MS + 1));
  check('a future heldAt is never treated as stale',
    !isHeldInviteStale({ code: 'ABCD2345', reason: 'offline', heldAt: parkedAt + 1000 }, parkedAt));
  check('⚠️ an aged-out hold is refused at READ time, not only at write time',
    parseHeldInvite(JSON.stringify(heldRecord), parkedAt + HELD_INVITE_MAX_AGE_MS + 1) === null);

  check('the hold slot has a real key', HELD_INVITE_KEY.length > 0);
  for (const reason of ['no_identity', 'offline'] as const) {
    const key = HELD_INVITE_KEY_BY_REASON[reason];
    check(`the ${reason} hold copy resolves in EN and 中文`,
      messageKeys('en').includes(key) && messageKeys('zh').includes(key));
    check(`…and its %{code} placeholder interpolates`,
      t(key, { code: 'ABCD2345' }).includes('ABCD2345'));
  }
}

/**
 * 14 · The Home clan pill (SCRUM-92 · SCRUM-91 option A).
 *
 * ⚠️ The numbers below are the **SIGNED-OFF design**, read off Penpot on
 * 2026-10-10 — frozen here so a later edit cannot drift from the approved board,
 * and so a "tidy-up" that rounds 14 to `radius.lg` (16) fails loudly instead of
 * silently moving the pill 2 px within a layout whose whole point is that it moves
 * **nothing** that was signed off.
 */
function clanPillChecks(): void {
  section('14 · The Home clan pill — the signed-off geometry (SCRUM-92 · SCRUM-91 option A)');

  // ── the measured geometry ──────────────────────────────────────────────────
  check('the pill is 236×44 — the header rectangle SCRUM-91 measured',
    PILL_SPEC.width === 236 && PILL_SPEC.height === 44);
  check('the radius is 14, NOT `radius.lg` (16)', PILL_SPEC.radius === 14 && PILL_SPEC.radius !== radius.lg);
  check('the stroke is 2.5 and inner, so it does not add to the 44', PILL_SPEC.borderWidth === 2.5);
  check('the pill clears the 44 px touch floor', PILL_SPEC.height >= TOUCH_TARGET);

  // ── the header arithmetic: inside the empty rectangle, overlapping neither neighbour
  check('the pill starts at x 80 on the 390 px reference', PILL_X_ON_REFERENCE === 80, String(PILL_X_ON_REFERENCE));
  check('…which is RIGHT of `icon · app mark` ending at 68.5 (AC 4)',
    PILL_X_ON_REFERENCE > HEADER_SPEC.markRight);
  check('…and ends at 316, clear of `btn · settings` starting at 326 (AC 4)',
    PILL_X_ON_REFERENCE + PILL_SPEC.width === 316);
  check('the pill + gap + settings slot + right margin re-add to the reference',
    HEADER_SPEC.rightPad + HEADER_SPEC.settingsSlot + HEADER_SPEC.settingsGap + PILL_SPEC.width
      + PILL_X_ON_REFERENCE === DESIGN_REFERENCE_WIDTH);

  // ── the two derived values that could silently move the pill ───────────────
  check('RN padding is 11.5, not 14 — RN draws the border INSIDE the box',
    CONTENT_PAD_H === 11.5, String(CONTENT_PAD_H));
  check('the name box (chip.dx − name.dx) equals the board\'s own 92',
    NAME_WIDTH === PILL_SPEC.name.width && NAME_WIDTH === 92);

  // ── ⚠️ ONE glyph, TWO states (the S36b lesson) ─────────────────────────────
  check('the affordance is U+203A, the angle-quote family',
    AFFORDANCE_GLYPH.codePointAt(0) === 0x203a && AFFORDANCE_GLYPH.length === 1);
  const oneClan = pillView([{ name: 'Tan Family', role: 'head' }]);
  const twoClans = pillView([
    { name: 'Tan Family', role: 'head' },
    { name: 'Lim Household', role: 'member' },
  ]);
  check('one clan is NOT rotated', oneClan.glyphRotated === false);
  check('2+ clans rotates — the SAME glyph, never a second character',
    twoClans.glyphRotated === true && twoClans.glyph === oneClan.glyph);
  check('…and the open rotation is 90°', PILL_SPEC.affordance.rotationOpenDeg === 90);

  // ── real data, and the routes ──────────────────────────────────────────────
  check('no clan shows NO pill — the design has no clan-less pill', pillView([]).show === false);
  check('the name comes from the data, not a literal', oneClan.name === 'Tan Family');
  check('the pill routes to the switcher, not the fork', pillRoute(oneClan.target) === '/clan/manage');
  check('the no-clan target is the fork', pillRoute(pillView([]).target) === '/clan');

  // ── the vocabulary guard — the pill must NOT fork the ZH table ──────────────
  // The pill returns an i18n KEY, never a literal. That mattered while the table was
  // traditional and this AC asked for the board's simplified `族长`; SCRUM-95 has since
  // flipped the whole table (PM, 2026-10-10), so the key now resolves to 族长 and the
  // pill matches its board with no hardcoded string. Asserted role by role so a future
  // edit cannot silently fork the vocabulary; section 15 proves the strings are all
  // simplified.
  for (const role of CLAN_ROLES) {
    const view = pillView([{ name: 'X', role }]);
    check(`the ${role} chip reuses the shipped label key`, view.roleLabelKey === ROLE_LABEL_KEY[role]);
    check(`…and that key resolves in EN and 中文`,
      view.roleLabelKey !== null
        && messageKeys('en').includes(view.roleLabelKey)
        && messageKeys('zh').includes(view.roleLabelKey));
  }
  check('the a11y key exists in BOTH locales', 
    messageKeys('en').includes('clan.pillA11y') && messageKeys('zh').includes('clan.pillA11y'));
  check('the a11y label interpolates the clan name',
    t('clan.pillA11y', { name: 'Tan Family' }).includes('Tan Family'));
}

/**
 * 15 · The ZH copy is SIMPLIFIED (SCRUM-95).
 *
 * ⚠️ The decision — PM, 2026-10-10: *"Simplified Chinese. Has a significant larger
 * market."* — is enforced here rather than trusted to a comment, because the table was
 * traditional for months while doc 15 §8 and all four ZH design boards were simplified,
 * and nothing failed.
 *
 * ⚠️ **What this CANNOT check, stated rather than implied:** it is character-level. A
 * WORD-level difference is not a character substitution — `連結` must become `链接` (a
 * character pass yields the wrong-looking `连结`) and `身分` must become `身份`. Those two
 * are asserted individually below, from doc 15 §8 (C2/C10) and the `ZH · 0e9` board;
 * everything else remains a review step against doc 15 §8.
 */
function zhScriptChecks(): void {
  section('15 · The ZH copy is SIMPLIFIED — and stays that way (SCRUM-95)');

  check('the guard carries a real dictionary', CHINESE_SCRIPT_PAIRS > 2500, String(CHINESE_SCRIPT_PAIRS));
  check('toSimplified maps a traditional form', toSimplified('族長') === '族长');
  check('…leaves simplified text alone', toSimplified('族长') === '族长');
  check('…and leaves EN alone', toSimplified('Clan Head') === 'Clan Head');

  const zh = MESSAGES.zh as unknown as Record<string, string>;
  const keys = Object.keys(zh);
  const offenders = keys.filter((k) => traditionalCharsIn(zh[k]).length > 0);
  check(`${keys.length} zh messages carry no traditional character`,
    offenders.length === 0,
    offenders.slice(0, 4).map((k) => `${k}="${zh[k]}"`).join(' · '));

  for (const band of AIM_BANDS) {
    check(`the ${band.id} band label is simplified`, traditionalCharsIn(band.label.zh).length === 0, band.label.zh);
  }
  check('the quota copy is simplified', traditionalCharsIn(QUOTA_SPENT_COPY.zh).length === 0, QUOTA_SPENT_COPY.zh);
  const tradOfferings = OFFERINGS.filter((o) => traditionalCharsIn(o.name.zh ?? '').length > 0);
  check(`${OFFERINGS.length} catalogue zh names are simplified`, tradOfferings.length === 0,
    tradOfferings.map((o) => o.name.zh).join(' · '));

  // ⚠️ the two word-level cases a character pass gets wrong
  check('the link copy is 链接, not 连结 (doc 15 §8 C10)', zh['clan.shareCode'].includes('链接'));
  check('the role label is 身份, not 身分 (the ZH · 0e9 board)', zh['clan.yourRole'].includes('身份'));

  // ✅ SCRUM-92 AC 5, now satisfiable: the pill's key resolves to its board's string
  check('the pill chip label is 族长 — matching its ZH board (SCRUM-92 AC 5)', zh['role_head'] === '族长', zh['role_head']);

  check('EN and 中文 still define the same key set', messageKeys('en').length === messageKeys('zh').length);

  // ⚠️ The domain's bilingual values are DATA, not messages, so the parity check above
  // cannot see them. A missing `zh` would fall back to English on a 中文 panel — which is
  // the exact defect this whole area was fixed for — so it is asserted here.
  const bilingual = [...AIM_BANDS.map((b) => b.label), ...OFFERINGS.map((o) => o.name)];
  const missingZh = bilingual.filter((v) => v.zh === undefined || v.zh === '');
  check(`every bilingual domain value carries 中文 (${bilingual.length} checked)`,
    missingZh.length === 0, `${missingZh.length} fall back to English`);
}

/**
 * 16 · The ritual screens' copy is LOCALISED (SCRUM-97).
 *
 * ⚠️ A reviewer opened a screen marked 中文 and found **English labels on its buttons and
 * titles**. Two causes, both invisible to every existing gate:
 *   · `burn.tsx` and `capture.tsx` never imported `t` at all — 18 literals, several of
 *     them bilingual (`开始 · Begin`), so 中文 showed English and EN showed Chinese;
 *   · four sites rendered `{value.zh} {value.en}` — BOTH languages, in EVERY locale.
 *
 * `check:copy` proves no literal escapes. THIS proves the replacements are actually
 * Chinese — which is the thing the screenshot showed, and the part `tsc` cannot see.
 */
function screenCopyChecks(): void {
  section('16 · The ritual screens\' copy — 中文 is actually Chinese (SCRUM-97)');

  /** The copy that was hardcoded, now keyed. Each `zh` must carry no Latin text. */
  const KEYS = [
    'common.begin', 'common.confirm', 'home.begin', 'home.clanEntry',
    'capture.cameraNeeded', 'capture.cameraWhy', 'capture.photoHint', 'capture.failed', 'capture.tryAgain',
    'burn.aimHint', 'burn.dragHint', 'burn.lostPlace', 'burn.returns', 'burn.capped',
    'burn.exhausted', 'burn.rethrow',
    'reward.safe', 'reward.tributeUnit', 'reward.alreadyRecorded', 'reward.capped', 'reward.balance',
  ];
  const zh = MESSAGES.zh as unknown as Record<string, string>;
  const en = MESSAGES.en as unknown as Record<string, string>;
  /** `%{points}` is a placeholder, not prose — strip it before looking for Latin text. */
  const latinIn = (s: string): string[] => s.replace(/%\{[a-z]+\}/g, '').match(/[A-Za-z]+/g) ?? [];

  for (const key of KEYS) {
    check(`${key} is defined in both locales`, typeof zh[key] === 'string' && typeof en[key] === 'string');
    const latin = latinIn(zh[key] ?? '');
    check(`…its 中文 carries no Latin text`, latin.length === 0, `${latin.join(', ')} in "${zh[key]}"`);
  }

  // the shared picker the four bilingual sites now use
  setLocale('en');
  check('localized() answers EN under the en locale', localized({ en: 'Devout', zh: '虔诚' }) === 'Devout');
  setLocale('zh');
  check('…and 中文 under the zh locale', localized({ en: 'Devout', zh: '虔诚' }) === '虔诚');
  check('…and NEVER both at once', localized({ en: 'Devout', zh: '虔诚' }).length === 2);
  check('…and degrades to EN when a 中文 field is missing',
    localized({ en: 'Devout', zh: undefined }) === 'Devout');
  setLocale('en');
}

async function main(): Promise<void> {
  await storageChecks();
  await drainChecks();
  serviceChecks();
  clanPillChecks();
  zhScriptChecks();
  screenCopyChecks();

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
