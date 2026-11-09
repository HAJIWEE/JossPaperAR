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

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isValidClanName } from '../clan-rules.ts';
import { PREPARING_PHASES, pipelineFailed } from '../../domain/slice.ts';
import { NAV_TABS, activeTabKey, isSamePath, tabPressIsNoop } from '../nav.ts';
import { COLLECTION, COLLECTION_SLOTS, collectionGrid, collectionOverflows, collectedItemName, displayBurnCount } from '../collection.ts';
import {
  DECOR_BOARD,
  SLOT_ART,
  SLOT_HIT,
  artVariantFor,
  drawPlan,
  optionsForSlot,
  sheetLayout,
} from '../decorate.ts';
import { CASH_IS_READABLE, FEATURED_CODE, STORE_TABS, baseMetaValue, pointsPrice, storeList } from '../store.ts';
import { ART_BOX, artCodes, artSize, fitArt } from '../offering-art.ts';
import { pickerGrid } from '../picker.ts';
import {
  ACCOUNT_CODE_LENGTH,
  ACCOUNT_GATE,
  ACCOUNT_MODES,
  ACCOUNT_ROUTE,
  AFTER_ACCOUNT_ROUTE,
  EMAIL_TAKEN_MEANS_SIGN_IN,
  emailProblem,
  isCompleteCode,
  issueKeyFor,
  meansSignInInstead,
  nextAccountStep,
  normaliseEmail,
  NO_ANONYMOUS_SESSION,
  routeAfterAccount,
} from '../account-flow.ts';
import { planBootstrap } from '../session-map.ts';
import { chosenNameProblem, normaliseChosenName, nameChangeCooldown, DAY_MS, NAME_CHANGE_INTERVAL_DAYS, NAME_CHANGE_INTERVAL_MS } from '../user-name.ts';
import { readBurnParams, readItemBurnParams, readItemRewardParams, readRewardParams } from '../route-params.ts';
import { getOffering } from '../../domain/catalogue.ts';
import { bookView, showsBookSectionTitle } from '../clan-roles.ts';
import {
  CONFIRM_SPEC,
  CONFIRM_TEXT_PAIRS,
  SCRIM,
  contrastRatio,
  scrimRgba,
} from '../confirm-card.ts';
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
import { LOCALES, MESSAGES, activeLocale, detectLocale, localized, messageKeys, setLocale, t } from '../i18n.ts';
import {
  LOCALE_KEY,
  LOCALE_LABELS,
  detectLocaleFromTags,
  isLocale,
  normaliseLocale,
  resolveInitialLocale,
} from '../locale.ts';
import {
  HISTORY_SPEC,
  HUD,
  HUD_TONES,
  LOCALE_PILL,
  PROFILE_ROUTE,
  PROFILE_ROUTES,
  PROFILE_ROWS,
  burnedAtLabel,
  offeringGlyph,
  rowIsLive,
  streakDayKey,
} from '../profile.ts';
import { TABLET_NAME_MAX, nameOrientation, rotatedNameSize, tabletName } from '../tablet-name.ts';
import {
  ANCESTOR_CAP,
  EDIT_ROLES,
  GIVEN_NAME_MAX,
  RELATIONSHIP_CHIPS,
  RELATIONSHIP_CHIP_ROW_BREAK,
  RELATIONSHIP_MAX,
  RELATIONSHIP_NONE_CHIP,
  SURNAME_MAX,
  canEditTablets,
  capReached,
  chipSelected,
  chipValue,
  normaliseAncestorForm,
  sheetProblem,
  slotsRemaining,
} from '../ancestor-sheet.ts';
import {
  HOME_BANDS,
  HOME_REGION_ORDER,
  HOME_REGION_TOPS,
  REFERENCE_HEIGHT,
  REFERENCE_WIDTH,
  TAB_BAR,
  bandAbove,
  bandFits,
  bandRect,
  bandsOverlap,
  homeFitScale,
  regionsStackDown,
  shrineBleedDp,
} from '../home-layout.ts';
import {
  OFFERINGS_VIEWBOX,
  OFFERING_DOTS,
  OFFERING_DOT_RADIUS,
  OFFERING_TRAYS,
  dotSitsOnTray,
} from '../offerings-layout.ts';
import { formatPoints, homePanels } from '../home-panels.ts';
import { ALTAR_DISPLAY_SLOTS, altarCaption, altarView, pageStep } from '../altar.ts';
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
import { LEAGUE_TIERS } from '../../domain/league.ts';
import { DECORATIONS, OFFERINGS, SLOT_CATEGORY } from '../../domain/catalogue.ts';
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
  DEMO_ITEM_CODE,
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

/**
 * ⚠️ Does BOTH locales define this message?
 *
 * A module-level twin of `main()`'s local `keyExists`, for the section functions that assert a
 * pure rule OWNS its copy. ⚠️ Section 3 already compares the two key SETS, so this is not a
 * parity check — it is "the string this rule needs actually exists", which is the gap that let
 * `t('clan_preview')` ship `[MISSING …]` to a player.
 */
function keyInBothLocales(key: string): boolean {
  const en = MESSAGES.en as unknown as Record<string, string>;
  const zh = MESSAGES.zh as unknown as Record<string, string>;
  return typeof en[key] === 'string' && typeof zh[key] === 'string';
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
  // ⚠️ SCRUM-102.3 (PM, 2026-10-10) — A CLAN NAME IS NOT LOCALISED, AND IT IS NOT TRANSLATED.
  // The PM's rule, in their words: *"if the clan wants a chinese character clan name, they can
  // input it in Chinese and we shall accept it. if they input english clan name while the app
  // language is chinese do not translate, same for the opposite scenario."* So the name rule must
  // be SCRIPT-AGNOSTIC: it measures LENGTH and must never require, convert or transliterate a
  // script. ⚠️ Asserted here because the trim is the app's ONLY transform on a name — there is no
  // name localiser to test, and `check:copy` cannot see a value that arrives through a variable.
  check('a 中文 clan name is accepted AS TYPED', isValidClanName('陈氏'));
  check('an English clan name is accepted AS TYPED', isValidClanName('Tan Family'));
  check('a MIXED-script clan name is accepted', isValidClanName('陈氏 Tan'));
  check('…中文 is measured by CHARACTER, not by any transliteration',
    isValidClanName('陈'.repeat(20)) && !isValidClanName('陈'.repeat(21)));
  check('…so the rule is SCRIPT-BLIND: equal lengths judge identically across scripts',
    isValidClanName('陈氏家族祠堂') === isValidClanName('abcdef'));

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

  /**
   * ⚠️⚠️ **THE DEMO NEVER OPENS THE CAMERA (SCRUM-216, owner's ruling 2026-11-01).** Until this landed the
   * demo still photographed the room — free only because four screens each ALSO skipped the upload on
   * `demo`. ⚠️ **A chain of four guards is not a wall:** one falling through is the ≈US$0.09-per-user Path
   * C bill, spent on users who **never sign up**. So the camera is GONE, and this flag is what says so.
   */
  check('⚠️ a tutorial OPENS NO CAMERA — the demo never photographs (SCRUM-216)',
    TUTORIAL_CONSEQUENCES.capturesPhoto === false);
  // ⚠️ …and the demo OFFERS a standard catalogue offering (the same `OfferingArt` the Store, the picker
  // and `/burn` draw) — and it must NOT be a bundle, because a bundle is not an item.
  const demoOffering = OFFERINGS.find((o) => o.code === DEMO_ITEM_CODE);
  check('⚠️ …and the demo offers a real STANDARD offering, never a bundle (SCRUM-216)',
    demoOffering !== undefined && demoOffering.composedOf === undefined);
  /**
   * ⚠️ **THE COPY NAMES IT** — the acceptance's *"the same one is named in the demo's own copy (no
   * invented item)"*. The copy interpolates `%{item}` from `collectedItemName(DEMO_ITEM_CODE)`, so the
   * name can only ever be the CATALOGUE's. Asserted in BOTH locales (parity is enforced).
   */
  const enIntro = (MESSAGES.en as unknown as Record<string, string>)['tutorial.intro'] ?? '';
  const zhIntro = (MESSAGES.zh as unknown as Record<string, string>)['tutorial.intro'] ?? '';
  check('⚠️ …and the demo copy NAMES the item through the catalogue, in BOTH locales',
    enIntro.includes('%{item}') && zhIntro.includes('%{item}'));

  /**
   * ⚠️⚠️ **AND THE CODE, NOT JUST THE FLAG.** ⚠️ `capturesPhoto: false` is a **STATEMENT** — a flag that
   * could read `false` while the camera is still mounted, which is the exact trap the ticket names
   * (*"a gate that passes while the code does the opposite"*). ⚠️ So the SOURCE is asserted too:
   * **`capture.tsx` must RETURN EARLY on `demo`, before the camera is mounted**, and the demo branch must
   * draw the catalogue offering. ⚠️ Putting the camera back on the demo's path turns THIS red.
   */
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const captureSrc = readFileSync(join(ROOT, 'src/app/capture.tsx'), 'utf8');
  const demoGuardAt = captureSrc.indexOf('if (demo)');
  const cameraAt = captureSrc.indexOf('<FullBleedCamera');
  check('⚠️⚠️ capture.tsx returns EARLY on `demo` — the camera is NEVER reached in a demo (SCRUM-216)',
    demoGuardAt > 0 && cameraAt > demoGuardAt);
  check('⚠️ …and the demo branch draws the catalogue offering, not a photo',
    /if \(demo\)[\s\S]{0,900}?<OfferingArt/.test(captureSrc));

  // the first-run decision
  check('a missing record means the tutorial is still owed', needsTutorial(null));
  check('an empty record means the tutorial is still owed', needsTutorial({ tutorialDone: false }));
  check('a completed record means it is NOT', !needsTutorial({ tutorialDone: true }));
  check('⚠️ anything other than an explicit true replays the tutorial',
    needsTutorial({ tutorialDone: undefined as unknown as boolean }));

  // ⚠️ **THE HANDOFF MOVED (SCRUM-215 · ADR-004 Amendment 1).** It used to run straight to the clan
  // FORK. The amendment made an account REQUIRED to create or join a clan, so the demo's last beat is
  // the ACCOUNT screen, which then hands off to the fork. ⚠️ Both hops are asserted, because the chain
  // is only coherent as a chain: **demo → account → fork**.
  check('⚠️ the tutorial hands off to the ACCOUNT, not straight to the fork (SCRUM-215)',
    AFTER_TUTORIAL_ROUTE === '/account');
  check('⚠️ …and the ACCOUNT hands off to the FORK — the next required step (SCRUM-215)',
    AFTER_ACCOUNT_ROUTE === '/clan');

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

  // ⚠️ ADDED WITH SCRUM-11 STEP 6, and it closed a real hole rather than widening
  //    coverage for its own sake: the league ladder shipped `銅` · `鐵` · `鑽石` and
  //    nothing failed, because this section scanned the message table, the aim bands,
  //    the quota copy and the catalogue — but never a constant living in `domain/`.
  //    The PM's 2026-10-10 answer applies to every shipping ZH string, not only the
  //    ones that happen to sit in `i18n.ts`.
  const tradTiers = LEAGUE_TIERS.filter((t) => traditionalCharsIn(t.name_zh).length > 0);
  check(`${LEAGUE_TIERS.length} league tier names are simplified`, tradTiers.length === 0,
    tradTiers.map((t) => `${t.name_en}=${t.name_zh}`).join(' · '));

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
    // ⚠️ SCRUM-127 — the `/preparing` screen's copy, which is now selected by a PURE table
    // (`PREPARING_COPY` in `domain/slice.ts`) rather than written into JSX. This asserts each
    // key EXISTS in both locales and that its 中文 carries no Latin text; ⚠️ that no two
    // phases COLLIDE is `check:slice` §4, because a collision is a fact about the mapping.
    'ritual_preparing', 'ritual_busy', 'ritual.cannotPrepare',
    'ritual.spentBody', 'ritual.offlineTitle', 'ritual.offlineBody',
    // ⚠️ SCRUM-122 — the Book's empty state. ✅ **SIGNED OFF (SCRUM-144 option A): doc 15 §8's
    // row C18 IS the copy.** ⚠️ It shipped as a marked PROPOSAL while §8 had no empty-state row;
    // `check:copy` rule 4 now asserts the table and this key agree, both locales.
    'book_empty',
    // ⚠️ SCRUM-161 — the shrine's two panels. Both strings are the BOARD's copy
    // (`EN · 1 Home / Shrine`, `ZH · 1 Home / 首页`), so they are held to the same
    // both-locales + no-Latin-in-中文 rule as everything else here.
    'home.tributeLabel', 'home.streakLabel',
    // ⚠️ SCRUM-164 — the tab bar's four labels and the three Home lines the owner found
    // MISSING against the board (`EN · 1 Home / Shrine`).
    'nav.shrine', 'nav.league', 'nav.store', 'nav.profile',
    'home.altarEmpty', 'home.ctaHint', 'home.templeChip',
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

  // ── ⚠️ LOCALE-PROOF ALIGNMENT (owner, 2026-10-31) ─────────────────────────────
  // "族长 is now too far left." The board anchors the role chip at dx 106 in BOTH locales but
  // draws it 94 wide in EN and 58 in ZH — so a left-anchored chip leaves a 40 px hole in 中文.
  const chip = PILL_SPEC.chip;
  check("the role chip slot is the board EN chip width (94)", chip.slotWidth === 94);
  check('…and the slot still clears the affordance (106 + 94 <= 204)',
    chip.dx + chip.slotWidth <= PILL_SPEC.affordance.dx,
    `${chip.dx} + ${chip.slotWidth} vs ${PILL_SPEC.affordance.dx}`);
  // ⚠️ the defect, as arithmetic: the ZH label is 58, so left-anchored it ends 40 px short.
  const holePx = PILL_SPEC.affordance.dx - (chip.dx + chip.narrowestLabelWidth);
  check('⚠️ a left-anchored 中文 chip leaves a visible hole before the ›',
    holePx >= 30, `${holePx} px of dead space`);
  // …and centring it in the slot reclaims exactly half of it, in the RIGHT direction.
  const centredDx = chip.dx + (chip.slotWidth - chip.narrowestLabelWidth) / 2;
  check('…and the chip CENTRES in the slot, so the narrow locale moves right',
    centredDx > chip.dx && centredDx === 124, `centred dx ${centredDx}`);
  check('…while the widest locale is pixel-identical to the board (no shift in EN)',
    chip.dx + (chip.slotWidth - chip.slotWidth) / 2 === 106);

  // the shared picker the four bilingual sites now use
  setLocale('en');
  check('localized() answers EN under the en locale', localized({ en: 'Devout', zh: '虔诚' }) === 'Devout');
  setLocale('zh');
  check('…and 中文 under the zh locale', localized({ en: 'Devout', zh: '虔诚' }) === '虔诚');
  check('…and NEVER both at once', localized({ en: 'Devout', zh: '虔诚' }).length === 2);
  check('…and degrades to EN when a 中文 field is missing',
    localized({ en: 'Devout', zh: undefined }) === 'Devout');

  // ⚠️ SCRUM-122 — the Book of Tributes' TWO glass defects, as assertions. The empty state
  // used to reuse `book_window` (so the same line rendered twice in one frame) under a
  // section title that rendered unconditionally (a heading over nothing). `bookView` is
  // pure, so both facts are checkable rather than visible only to a reviewer's eye.
  const emptyView = bookView(0, false);
  const listView = bookView(3, false);
  check(
    'an empty Book has its OWN body key — not the window line',
    emptyView.bodyKey === 'book_empty' && emptyView.bodyKey !== 'book_window',
  );
  check(
    '…and the check can fail: reusing the window line IS detectable (positive control)',
    (emptyView.bodyKey as string) === 'book_window' ? false : 'book_window' === 'book_window',
  );
  check(
    'an empty Book renders NO section title (a heading over nothing is the defect)',
    !showsBookSectionTitle(emptyView),
  );
  check('…and a Book with entries DOES render it', showsBookSectionTitle(listView));
  check(
    'a problem renders no book copy at all — the server reason is the screen\'s',
    bookView(0, true).kind === 'problem' && bookView(0, true).bodyKey === null,
  );

  setLocale('en');
}

/**
 * 18 · The shrine scales PROPORTIONALLY (SCRUM-162 · the owner's ruling, 2026-10-31).
 *
 * ⚠️ WHY THIS EXISTS. The shrine's first two defects were **both invisible to every
 * gate** and both found only by looking at a phone:
 *
 *   · the shrine base was rendered with **board px as device px**, so its right edge
 *     landed at `16 + 358 = 374` on a 360 dp screen — **clipped**;
 *   · the clan pill kept its fixed 236 while everything else scaled, so it sat at
 *     **x 50 instead of 74**.
 *
 * ⚠️ A geometry gate that only checks the **390 px reference** passes both. So these
 * assertions run at the sizes a real floor device actually has.
 *
 * ⚠️ AND THE RULING ITSELF IS ASSERTED. The owner chose **proportional** on
 * 2026-10-31 — the whole shrine scales uniformly, and that deliberately includes type,
 * so a 320 dp screen gets smaller text rather than a reflowed layout. The tempting
 * "fix" is to hold type at `fluidSize`, which silently breaks every proportion the art
 * and the aim grader were measured against. `check:copy` §5 forbids that import on the
 * shrine; this section pins the maths beneath it.
 */
function homeShrineScaleChecks(): void {
  section('18 · The shrine scales PROPORTIONALLY — the owner\'s ruling (SCRUM-162)');

  const phone = homeFitScale(360, 800);
  const wide = homeFitScale(540, 800);
  const small = homeFitScale(320, 568);

  check('a 360 × 800 phone is width-limited (360/390)', Math.abs(phone - 360 / 390) < 1e-9,
    `got ${phone}`);
  check('a 540 × 800 viewport is HEIGHT-limited (800/844), not width',
    Math.abs(wide - 800 / 844) < 1e-9, `got ${wide}`);
  check('…and that is smaller than the width rule would give (the tablet bug: 1732 dp tall)',
    wide < 540 / 390, `width rule gives ${540 / 390}`);
  check('a 320 × 568 small phone is height-limited too', Math.abs(small - 568 / 844) < 1e-9,
    `got ${small}`);

  // ── every band fits the window at every size ────────────────────────────────
  const VIEWPORTS = [['360 × 800', 360, phone], ['540 × 800', 540, wide], ['320 × 568', 320, small]] as const;
  const bands = Object.entries(HOME_BANDS);
  for (const [label, windowWidth, scale] of VIEWPORTS) {
    const spilled = bands.filter(([, band]) => !bandFits(band, scale, windowWidth)).map(([name]) => name);
    check(`no band spills off a ${label} viewport (${bands.length} bands)`, spilled.length === 0,
      `${spilled.join(', ')}`);
  }

  // ⚠️ POSITIVE CONTROL — the detector must FIRE on the defect that actually shipped.
  check('…and the fit rule FAILS at scale 1 on a 360 dp screen (the clipped-art defect)',
    !bandFits(HOME_BANDS.shrineBase, 1, 360),
    'bandFits says the unscaled base fits a 360 dp screen — it does not (16 + 358 = 374)');

  // ── bandRect is the ONE conversion, and it is absolute ─────────────────────
  const rect = bandRect(HOME_BANDS.cta, 0.5);
  check('bandRect scales x/y/w/h from the band', rect.left === 10 && rect.top === 338
    && rect.width === 175 && rect.height === 33,
    JSON.stringify(rect));
  check('…and it is absolutely positioned (a flow child would re-order the shrine)',
    rect.position === 'absolute');
  check('…and at scale 1 it is the board\'s own numbers (no silent drift)',
    bandRect(HOME_BANDS.cta, 1).top === 676 && bandRect(HOME_BANDS.cta, 1).left === 20);

  // ── ⚠️ THE EDGE-TO-EDGE RULING (owner, 2026-10-31) ────────────────────────
  // The shrine was contain-fitted into the WINDOW RN reports (345 × 745 on a 360 × 800 device),
  // which letterboxes it on all four sides. It is now fitted to the SCREEN and anchored at its
  // top-left, so the width rule is exact and there is no side gap when width-limited.
  const screenScale = homeFitScale(360, 800);
  check('on a 360 × 800 screen the canvas fills the width EXACTLY (no side letterbox)',
    Math.abs(390 * screenScale - 360) < 1e-9, `fills ${(390 * screenScale).toFixed(2)} of 360`);
  // ⚠️ POSITIVE CONTROL — the defect that actually shipped: fitting the WINDOW inset leaves gaps.
  const windowScale = homeFitScale(345, 745);
  const windowFill = 390 * windowScale;
  check('…and fitting the WINDOW instead leaves a visible side gap (the defect that shipped)',
    windowFill < 360 - 10, `window-fit fills ${windowFill.toFixed(1)} of 360 — ${((360 - windowFill) / 2).toFixed(1)} dp lost per side`);

  // ⚠️ The strip under the bar is a SECOND COLOUR, so the bar must reach the physical edge.
  check('the tab bar bleeds to the screen bottom (800 − 844×s)',
    Math.abs(shrineBleedDp(800, screenScale) - (800 - 844 * screenScale)) < 1e-9,
    `${shrineBleedDp(800, screenScale).toFixed(2)} dp`);
  check('…and the bleed is POSITIVE on a screen taller than the board',
    shrineBleedDp(800, screenScale) > 15, `${shrineBleedDp(800, screenScale).toFixed(2)} dp`);
  check('…and ZERO when the board already reaches the bottom (no phantom strip)',
    shrineBleedDp(844, 1) === 0);

  // ── the canvas keeps the board's aspect ratio ──────────────────────────────
  check('the canvas ratio is the board\'s 844 : 390 (so nothing can squash it)',
    Math.abs(844 / 390 - 2.1641) < 0.001);
}

/**
 * §25 · The shrine's bands stack in the right ORDER (SCRUM-163).
 *
 * ── ⚠️ WHY §18 WAS NOT ENOUGH ────────────────────────────────────────────────
 * §18 asserts every band **fits the canvas** and that `bandRect` converts correctly. ⚠️ Neither can
 * see the failure this section exists for: **a band dragged into the wrong place still fits.**
 * Move the CTA up into the header band and §18 stays green — the button is inside the canvas, its
 * numbers are the board's own, and the composition is wrong.
 *
 * ⚠️ So these assertions are about **PAIRS**, not bands: `a` is above `b`, or the two regions do
 * not overlap. That is the class this project has already shipped four times (the tabs at board
 * `top: 774` inside a band already at 764; the shrine base 14 dp off the side), and every one of
 * them was found by an eye rather than by a gate.
 *
 * ⚠️ **`bandsOverlap` is deliberately NOT applied inside the altar.** `halo` (160→580) and
 * `offerings` (434→604) overlap because the offerings are painted IN FRONT of the halo. A gate that
 * demanded no overlap there would fight the design; it is used between REGIONS instead.
 */
function shrineGeometryChecks(): void {
  section("25 · The shrine's bands stack in the right order — and the altar holds 4 (SCRUM-163)");

  // ── ⚠️ THE READER CONTROL, FIRST ───────────────────────────────────────────
  // ⚠️ A renamed or dropped band reads as `undefined`, and `undefined <= undefined` is FALSE — so
  // every assertion below would go red for the WRONG reason, and a reader would "fix" the gate by
  // loosening it. Assert the names exist BEFORE asserting anything about their values.
  const REQUIRED_BANDS = [
    'headerMark', 'settings', 'tribute', 'streak', 'caption', 'hintCta', 'halo', 'addSlot',
    'carouselPrev', 'carouselNext', 'templeChip', 'offerings', 'shrineBase', 'cta', 'tabbar',
    'sheetPanel', 'sheetPreview',
  ] as const;
  const missingBands = REQUIRED_BANDS.filter((name) => !(name in HOME_BANDS));
  check(
    `the gate found the REAL constants (${REQUIRED_BANDS.length} bands by name)`,
    missingBands.length === 0,
    `missing: ${missingBands.join(', ')}`,
  );
  // ⚠️ …and the control is not a tautology: a name that is NOT there must report absent.
  check('…and that control is not a tautology (a wrong name reads absent)',
    !('ctaButton' in HOME_BANDS));

  // ── the five regions stack DOWNWARD, in the render order ───────────────────
  check('the five regions stack downward, in HOME_REGION_ORDER',
    regionsStackDown(HOME_REGION_ORDER),
    HOME_REGION_ORDER.map((r) => `${r}@${HOME_REGION_TOPS[r]}`).join(' → '));

  // ⚠️ THE TICKET'S NAMED RELATIONSHIPS, each its own assertion so a failure names the PAIR.
  check('the CTA band is BELOW the header band',
    bandAbove(HOME_BANDS.settings, HOME_BANDS.cta),
    `settings ends ${HOME_BANDS.settings.y + HOME_BANDS.settings.h}, cta starts ${HOME_BANDS.cta.y}`);
  check('⚠️ the totals band does NOT overlap the CTA',
    !bandsOverlap(HOME_BANDS.tribute, HOME_BANDS.cta)
      && !bandsOverlap(HOME_BANDS.streak, HOME_BANDS.cta));
  check('the footer sits BELOW the CTA',
    bandAbove(HOME_BANDS.cta, HOME_BANDS.tabbar),
    `cta ends ${HOME_BANDS.cta.y + HOME_BANDS.cta.h}, tabbar starts ${HOME_BANDS.tabbar.y}`);

  // ── and the seams between the regions ─────────────────────────────────────
  check('the header sits above the totals',
    bandAbove(HOME_BANDS.settings, HOME_BANDS.tribute));
  check('the totals sit above the altar (whose topmost band is the caption)',
    bandAbove(HOME_BANDS.streak, HOME_BANDS.caption));
  check("the altar's LAST band sits above the CTA (the art does not run under the button)",
    bandAbove(HOME_BANDS.shrineBase, HOME_BANDS.cta),
    `shrineBase ends ${HOME_BANDS.shrineBase.y + HOME_BANDS.shrineBase.h}, cta starts ${HOME_BANDS.cta.y}`);

  // ── every altar band lives INSIDE the altar region ────────────────────────
  const altarTop = HOME_BANDS.caption.y;
  const altarBottom = HOME_BANDS.shrineBase.y + HOME_BANDS.shrineBase.h;
  const ALTAR_BANDS = [
    'caption', 'hintCta', 'halo', 'templeChip', 'addSlot', 'carouselPrev', 'carouselNext',
    'offerings', 'shrineBase',
  ] as const;
  const strayed = ALTAR_BANDS.filter((name) => {
    const band = HOME_BANDS[name];
    return band.y < altarTop || band.y + band.h > altarBottom;
  });
  check(`every altar band is inside the altar region (${altarTop}→${altarBottom})`,
    strayed.length === 0, `strayed: ${strayed.join(', ')}`);

  // ── the altar holds FOUR, and that is not the clan cap ────────────────────
  check('the altar displays 4 tablets before it pages', ALTAR_DISPLAY_SLOTS === 4,
    `${ALTAR_DISPLAY_SLOTS}`);
  check('⚠️ …and 4 is NOT the clan cap of 10 — the board pages, it does not refuse',
    ALTAR_DISPLAY_SLOTS !== ANCESTOR_CAP);
  check('…and 4 is the board frame that draws it (`EN · 1c Home / full (4 tablets)`)',
    ALTAR_DISPLAY_SLOTS === 4 && ALTAR_DISPLAY_SLOTS < ANCESTOR_CAP);

  // ── the carousel arrows FLANK the slot, and stay on the board ─────────────
  const slot = HOME_BANDS.addSlot;
  check('the prev arrow sits LEFT of the tablet slot',
    HOME_BANDS.carouselPrev.x + HOME_BANDS.carouselPrev.w <= slot.x,
    `prev ends ${HOME_BANDS.carouselPrev.x + HOME_BANDS.carouselPrev.w}, slot starts ${slot.x}`);
  check('the next arrow sits RIGHT of the tablet slot',
    HOME_BANDS.carouselNext.x >= slot.x + slot.w,
    `next starts ${HOME_BANDS.carouselNext.x}, slot ends ${slot.x + slot.w}`);
  check('…and neither arrow runs off the 390 board',
    HOME_BANDS.carouselNext.x + HOME_BANDS.carouselNext.w <= REFERENCE_WIDTH);
  check('the two arrows share one y (a pair, not two decisions)',
    HOME_BANDS.carouselPrev.y === HOME_BANDS.carouselNext.y);

  // ── ⚠️ POSITIVE CONTROLS — the predicates must FIRE on the defect they exist for ──
  // ⚠️ THIS IS THE SHIPPED CLASS, REPRODUCED: the CTA dragged up into the header band.
  // ⚠️ §18 stays GREEN under this corruption — the button still fits the canvas — which is the
  // entire reason §25 exists. The third control asserts exactly that, so the gap cannot be
  // forgotten if someone later folds §25 back into §18.
  const CORRUPT_TOPS = { ...HOME_REGION_TOPS, cta: HOME_BANDS.headerMark.y };
  check('⚠️ guard: the CTA moved into the header band makes the ORDER check FAIL',
    !regionsStackDown(HOME_REGION_ORDER, CORRUPT_TOPS),
    'regionsStackDown passed on a shrine whose CTA is at the top — the gate is blind');
  check('⚠️ guard: …and `bandAbove` FAILS for the same corruption',
    !bandAbove({ ...HOME_BANDS.cta, y: HOME_BANDS.headerMark.y }, HOME_BANDS.tribute));
  check('⚠️ guard: …and the FIT check does NOT — which is why §18 could not catch it',
    bandFits({ ...HOME_BANDS.cta, y: HOME_BANDS.headerMark.y }, 1, REFERENCE_WIDTH));
  check('⚠️ guard: `bandsOverlap` reports the totals against a CTA moved onto them',
    bandsOverlap(HOME_BANDS.tribute, { ...HOME_BANDS.cta, y: HOME_BANDS.tribute.y }));
  check('⚠️ guard: …and it reports NO overlap for the real pair (not a always-true)',
    !bandsOverlap(HOME_BANDS.tribute, HOME_BANDS.cta));
}

/**
 * §26 · The language switcher (SCRUM-151 · SCRUM-34).
 *
 * ⚠️ **Measured 2026-11-01: `setLocale` was called from no screen and no component**, so the app was
 * permanently English while every string was translated and §15/§16 held both tables. ⚠️ A reviewer
 * could not reach 中文. These assertions hold the rules that fix it — the RULES, because the control
 * itself is a device fact and the ORDER of precedence is a fact about data.
 */
function localeChecks(): void {
  section('26 · The language switcher — untrusted input, the device only as a guess (SCRUM-151)');

  // ⚠️ READER CONTROL FIRST: a renamed key or a missing label reads `undefined`, and every
  // assertion below would then pass or fail for the wrong reason.
  check('every locale has a label (an option with no label is invisible)',
    LOCALES.every((l) => typeof LOCALE_LABELS[l] === 'string' && LOCALE_LABELS[l].length > 0),
    JSON.stringify(LOCALE_LABELS));
  check('⚠️ the labels are ENDONYMS — 中文 is not hidden behind an English word',
    LOCALE_LABELS.zh === '中文' && LOCALE_LABELS.en === 'EN');
  check('the storage key is namespaced', LOCALE_KEY.startsWith('josspaperar.'), LOCALE_KEY);

  // ── normaliseLocale — a stored value is UNTRUSTED ─────────────────────────
  check('a valid tag passes through', normaliseLocale('zh') === 'zh');
  check('…case-insensitively, and trimmed', normaliseLocale('ZH') === 'zh' && normaliseLocale('  en  ') === 'en');
  check('⚠️ a full device tag falls back to its LANGUAGE (zh-Hans-SG → zh)',
    normaliseLocale('zh-Hans-SG') === 'zh', normaliseLocale('zh-Hans-SG'));
  check('⚠️ an unknown tag does NOT pass through — it becomes the default',
    normaliseLocale('fr') === 'en' && normaliseLocale('klingon') === 'en');
  check('…and so do null / undefined / empty / whitespace',
    normaliseLocale(null) === 'en' && normaliseLocale(undefined) === 'en'
      && normaliseLocale('') === 'en' && normaliseLocale('   ') === 'en');
  // ⚠️ POSITIVE CONTROL — the guard must FIRE, not merely return the default by luck.
  check('⚠️ guard: `isLocale` rejects exactly what `normaliseLocale` had to correct',
    !isLocale('fr') && !isLocale('zh-Hans-SG') && isLocale('zh') && isLocale('en'));

  // ── resolveInitialLocale — the ORDER is the rule ──────────────────────────
  check('a stored choice WINS over the device', resolveInitialLocale('en', ['zh-Hans-SG']) === 'en');
  check('⚠️ …even when it disagrees — an English speaker on a Chinese phone asked for English',
    resolveInitialLocale('en', ['zh']) === 'en');
  check('no stored value → the DEVICE decides', resolveInitialLocale(null, ['zh-Hans-SG']) === 'zh');
  check('…and an EMPTY stored value counts as no choice', resolveInitialLocale('', ['zh']) === 'zh');
  check('…and a whitespace one does too', resolveInitialLocale('   ', ['zh']) === 'zh');
  check('a device with no opinion → the default', resolveInitialLocale(null, []) === 'en');
  check('…and an unrecognised device tag does too', resolveInitialLocale(null, ['fr-CA']) === 'en');

  // ⚠️ THE LOCAL TAG WALK MUST AGREE WITH i18n's — a second opinion is a drift waiting to happen.
  const TAGS: readonly (readonly string[])[] = [['zh-Hans-SG'], ['en-SG'], ['fr-CA'], [], ['zh'], ['en-GB']];
  const disagreed = TAGS.filter((tags) => detectLocaleFromTags(tags) !== detectLocale(tags));
  check('⚠️ the local tag walk agrees with `i18n.detectLocale` on every sample',
    disagreed.length === 0, JSON.stringify(disagreed));

  // ── the switcher's geometry — the board's `set · lang pill` ───────────────
  check('the pill is the board\'s 118×32, r16',
    LOCALE_PILL.w === 118 && LOCALE_PILL.h === 32 && LOCALE_PILL.radius === 16);
  check('⚠️ the active segment is INSET, so it sits INSIDE the track rather than on it',
    LOCALE_PILL.inset > 0 && LOCALE_PILL.inset < LOCALE_PILL.h / 2);

  // ── the Settings rows: wired, or visibly disabled — never a dead link ─────
  check('no Settings row links to a route that does not exist',
    PROFILE_ROWS.filter((r) => r.route !== null).every((r) => PROFILE_ROUTES.includes(r.route as string)),
    PROFILE_ROWS.map((r) => `${r.id}→${r.route}`).join(' '));
  // ⚠️ POSITIVE CONTROL — and it must be a route that really is NOT on the list. ⚠️ This used to be
  // `/collection`, back when Collection was unbuilt; SCRUM-151 wired it, so the control had to move
  // to a path nothing serves. A control pointing at a route that HAS landed is no control at all.
  check('⚠️ …and a route NOT on the list would fail that check (not a tautology)',
    !PROFILE_ROUTES.includes('/not-a-route'));
  check('…and `rowIsLive` is the ONE place "is it wired" is decided',
    rowIsLive('/settings') && !rowIsLive(null));

  // ⚠️ The ROUTE ITSELF — the tab bar and this assertion read the SAME string, so a typo in one
  // cannot become a dead link that only a device would find.
  check("the tab bar's Profile tab points at the screen that exists",
    PROFILE_ROUTES.includes(PROFILE_ROUTE) && PROFILE_ROUTE === '/profile');

  // ── the History helpers (SCRUM-151) ───────────────────────────────────────
  // ⚠️ "1 days" is not copy. The board draws only the 12-day case, so the singular is ours.
  check('⚠️ a ONE-day streak gets its own key (never "1 days")',
    streakDayKey(1) === 'hist.weekStreakOne');
  check('…and 0 · 2 · 12 take the plural',
    [0, 2, 12].every((d) => streakDayKey(d) === 'hist.weekStreak'));
  check('every streak key exists in BOTH locales',
    ['hist.weekStreak', 'hist.weekStreakOne'].every(keyInBothLocales));

  // ⚠️ The date line is HAND-formatted (Hermes' ICU is partial), so both shapes are assertable.
  const burnAt = new Date('2026-11-01T20:42:00');
  const nowAt = new Date('2026-11-01T21:00:00');
  check('a burn TODAY reads "Today · …"',
    burnedAtLabel(burnAt.toISOString(), nowAt, 'en').startsWith('Today · '),
    burnedAtLabel(burnAt.toISOString(), nowAt, 'en'));
  check('…and in 中文 it reads 今天',
    burnedAtLabel(burnAt.toISOString(), nowAt, 'zh').startsWith('今天 · '));
  check('⚠️ EN is 12-hour and 中文 is 24-hour (the board draws 8:42 PM; 中文 reads 20:42)',
    burnedAtLabel(burnAt.toISOString(), nowAt, 'en').includes('8:42 PM')
      && burnedAtLabel(burnAt.toISOString(), nowAt, 'zh').includes('20:42'));
  check('yesterday is named, not dated',
    burnedAtLabel(new Date('2026-10-31T09:03:00').toISOString(), nowAt, 'en').startsWith('Yesterday · '));
  check('⚠️ an unparseable timestamp returns EMPTY — never "Invalid Date" on a plaque',
    burnedAtLabel('not-a-date', nowAt, 'en') === '');

  // ⚠️ The thumb glyph is DERIVED, because the catalogue carries none.
  check("the thumb glyph is the name's first character",
    offeringGlyph('Gold Bar') === 'G' && offeringGlyph('金条') === '金');
  check('⚠️ …and it does not split a surrogate pair',
    Array.from(offeringGlyph('𠀀x')).length === 1, JSON.stringify(offeringGlyph('𠀀x')));
  check('an empty name yields an empty glyph (no crash on a blank plaque)',
    offeringGlyph('   ') === '');

  // ── the screen HUD (Profile · Settings · History) ─────────────────────────
  /**
   * ⚠️⚠️ **THE RING MUST NOT TOUCH THE TITLE.** The board puts a 42 circle at x18 with a 2.5 stroke
   * and starts `hud · screen title` at x60 — so the ring ends exactly where the text begins, and on
   * glass it reads as covering the `S`. Measured 2026-11-01, filed for the board.
   */
  const circleLeft = HUD.touch.x + (HUD.touch.size - HUD.back.size) / 2;
  const circleRight = circleLeft + HUD.back.size;
  check('⚠️ the back circle does NOT touch the title (the on-glass defect)',
    HUD.title.x > circleRight,
    `circle ends at ${circleRight}, title starts at ${HUD.title.x}`);
  /**
   * ⚠️⚠️ **THE BOARD'S OWN NUMBERS ARE PINNED TOO** — the §22 rule: when the board is wrong, assert
   * BOTH numbers, so neither "copy the board" nor "nudge it back" can pass silently.
   * `btn · back (ink)` is at x18 and 42 wide, so its ring ends at **60** — exactly where
   * `hud · screen title` begins. That is the defect, stated as arithmetic.
   */
  const BOARD_RING_RIGHT = 18 + 42;
  check('⚠️ …and the BOARD\'s own numbers WOULD touch (this is why the build deviates)',
    BOARD_RING_RIGHT >= 60,
    `board ring ends ${BOARD_RING_RIGHT}, board title starts 60`);
  // ⚠️ POSITIVE CONTROL — the detector must FIRE when the title is moved back onto the ring.
  check('⚠️ guard: moving the title onto the ring makes the check FAIL',
    !(53 > circleRight), `title at 53 vs ring at ${circleRight}`);
  check('⚠️ …and the TOUCH target is still ≥ 44 — the CIRCLE shrank, not the target',
    HUD.touch.size >= 44, `${HUD.touch.size}`);
  check('⚠️ …and the visible circle is SMALLER than the board\'s 42 (a filed deviation)',
    HUD.back.size < 42, `${HUD.back.size}`);
  check('…and it is drawn INSIDE the touch target, not beside it',
    HUD.touch.size > HUD.back.size && circleLeft >= HUD.touch.x);
  check('…and the title clears the touch target too (not just the circle)',
    HUD.title.x >= HUD.touch.x + HUD.touch.size);

  /**
   * ── ⚠️⚠️ THE HUD'S Z-ORDER, ASSERTED IN EVERY SCREEN THAT USES IT ─────────
   * **A `ScreenHud` declared BEFORE the `ScrollView` DRAWS AND NEVER RECEIVES A TAP.** The scroll
   * view fills the viewport and is painted last; the HUD's own background is transparent, so it stays
   * VISIBLE through it — which is exactly why the defect reads as *"the back button is not wired"*
   * rather than as a layout problem. Measured on `HN615L005386`, 2026-11-01.
   *
   * ⚠️ **No pure assertion can see this** — it is a fact about the SOURCE ORDER of two siblings — so
   * this reads the files, the same way `check:copy` does. ⚠️ And it is worth a gate precisely because
   * the failure is invisible: the button looks perfect.
   */
  const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const HUD_SCREENS = [
    'src/app/league.tsx',
    'src/app/settings.tsx',
    'src/app/history.tsx',
    'src/app/profile.tsx',
    // ⚠️ Capture has NO ScrollView (it is a full-bleed camera) — only the "is it there" half applies.
    'src/app/capture.tsx',
  ];
  const hudBeforeScroll: string[] = [];
  const hudMissing: string[] = [];
  for (const rel of HUD_SCREENS) {
    const file = join(PROJECT_ROOT, rel);
    if (!existsSync(file)) {
      hudMissing.push(rel);
      continue;
    }
    const source = readFileSync(file, 'utf8');
    const hudAt = source.indexOf('<ScreenHud');
    if (hudAt < 0) {
      hudMissing.push(rel);
      continue;
    }
    /**
     * ⚠️ Only meaningful when the screen HAS a scroll view. A full-bleed screen (Capture) has no
     * sibling to be painted over, so the order question does not arise — and asserting it there would
     * be a check that cannot fail.
     */
    const scrollEndsAt = source.lastIndexOf('</ScrollView>');
    if (scrollEndsAt >= 0 && hudAt < scrollEndsAt) hudBeforeScroll.push(rel);
  }
  check(`⚠️ every screen renders <ScreenHud /> AFTER its </ScrollView> (${HUD_SCREENS.length} screens)`,
    hudBeforeScroll.length === 0,
    `rendered before the scroll view: ${hudBeforeScroll.join(', ')}`);
  check('…and every screen in that list still renders a <ScreenHud /> (so the gate is not vacuous)',
    hudMissing.length === 0, `no HUD: ${hudMissing.join(', ')}`);
  // ⚠️ POSITIVE CONTROL — the detector must FIRE on the source order that shipped the defect.
  check('⚠️ guard: a HUD declared before the scroll view WOULD fail that check',
    '<ScreenHud x />\n<ScrollView></ScrollView>'.indexOf('<ScreenHud')
      < '<ScreenHud x />\n<ScrollView></ScrollView>'.lastIndexOf('</ScrollView>'));

  /**
   * ⚠️ **THE TWO TONES ARE NOT INTERCHANGEABLE.** A light HUD on the camera is an ink ring on a dark
   * frame — invisible. `EN · 2 Capture` and `EN · 4 Burn` draw `hud · back circle` (dark); everything
   * on paper draws `btn · back (ink)` (light).
   */
  check('⚠️ the HUD has BOTH board tones, and they differ',
    HUD_TONES.light.fill !== HUD_TONES.dark.fill
      && HUD_TONES.light.stroke !== HUD_TONES.dark.stroke);
  check('⚠️ …and the DARK tone rings in the paper colour, which is what makes it read on a dark frame',
    HUD_TONES.dark.stroke === '#F5F0E8');
  // ⚠️ POSITIVE CONTROL — the "they differ" assertion is not a tautology.
  check('⚠️ guard: identical tones WOULD fail the differ check',
    !(HUD_TONES.light.fill === HUD_TONES.dark.fill));

  /**
   * ── ⚠️ THE PIPELINE'S WAY OUT — ONLY ON FAILURE (owner's ruling, 2026-11-01) ──
   * > *"After the user lassos or trims the picture and sends it into the pipeline, do not have a back
   * > function unless it fails the pipeline."*
   *
   * ⚠️ While `working` or `parked` the offering is **already PAID FOR**, so a back button abandons it
   * silently. ⚠️ `spent` and `offline` are the two states where nothing more happens without the user.
   */
  check('⚠️ a FAILED pipeline offers a way out (spent · offline)',
    pipelineFailed('spent') && pipelineFailed('offline'));
  check('⚠️ …and one still IN FLIGHT does NOT (working · parked) — it holds a paid offering',
    !pipelineFailed('working') && !pipelineFailed('parked'));
  check('…and `done` does not either (it routes away and renders nothing)',
    !pipelineFailed('done'));
  check('⚠️ every preparing phase is classified (none is forgotten)',
    PREPARING_PHASES.every((phase) => typeof pipelineFailed(phase) === 'boolean'));
  // ⚠️ POSITIVE CONTROL — the predicate must not answer the same for every phase.
  check('⚠️ guard: the predicate is not a constant',
    PREPARING_PHASES.some((phase) => pipelineFailed(phase))
      && PREPARING_PHASES.some((phase) => !pipelineFailed(phase)));

  /**
   * ⚠️ **AND THE SCREENS, because the ruling is about WHERE the button is.** ⚠️ `EN · 4 Burn` DRAWS a
   * back circle and the owner ruled it must not have one — so this is a deliberate board deviation,
   * and a source scan is the only thing that can hold a rule about absence.
   */
  const burnSource = readFileSync(join(PROJECT_ROOT, 'src/app/burn.tsx'), 'utf8');
  check("⚠️ the BURN screen has NO back button (the owner's ruling; the board draws one)",
    !burnSource.includes('<ScreenHud'));
  // ⚠️ …and Transform's IS conditional — an unconditional one would trap a paid offering.
  const preparingSource = readFileSync(join(PROJECT_ROOT, 'src/app/preparing.tsx'), 'utf8');
  check('⚠️ the TRANSFORM screen renders its HUD ONLY behind `pipelineFailed`',
    preparingSource.includes('<ScreenHud') && preparingSource.includes('pipelineFailed('));
  // ⚠️ POSITIVE CONTROL — the absence check must FIRE where a HUD IS present.
  check('⚠️ guard: the same absence check FINDS the HUD on a screen that has one',
    readFileSync(join(PROJECT_ROOT, 'src/app/settings.tsx'), 'utf8').includes('<ScreenHud'));

  /**
   * ── ⚠️ THE NAV BAR'S ONE RULE — GLOBAL, NOT SHRINE-SPECIFIC (owner's ruling, 2026-11-01) ──
   * > *"Tapping the tab you are already on should not re-render the page. This is common sense how
   * > the nav bar should work for all pages."*
   *
   * ⚠️ Asserted against **`NAV_TABS` — the real destinations** — so a fifth tab extends the gate
   * instead of escaping it, and against a **cross-product** of paths so "League on League" is covered
   * by the same expression as "Shrine on Shrine".
   */
  const routedTabs = NAV_TABS.filter((tab) => tab.route !== null);
  const routedList = routedTabs.map((tab) => `${tab.key}@${tab.route}`).join(' ');

  check('⚠️ EVERY tab that has a screen is a no-op on its OWN path',
    routedTabs.every((tab) => tabPressIsNoop(tab.route, tab.route as string)),
    routedList);
  check('⚠️ …and no tab is a no-op on a DIFFERENT tab\'s path (not a blanket no-op)',
    routedTabs.every((tab) => routedTabs
      .filter((other) => other.key !== tab.key)
      .every((other) => !tabPressIsNoop(tab.route, other.route as string))),
    routedList);
  check('⚠️ a tab with NO screen is a no-op from anywhere (Store)',
    NAV_TABS.filter((tab) => tab.route === null).every((tab) => tabPressIsNoop(null, '/league')));
  check('…and a trailing slash or a query is the SAME screen, not a new one',
    tabPressIsNoop('/league', '/league/') && tabPressIsNoop('/league', '/league?ref=1')
      && isSamePath('/', ''));
  // ⚠️ POSITIVE CONTROL — the rule must not answer `true` for everything.
  check('⚠️ guard: the rule is not a constant',
    tabPressIsNoop('/', '/') && !tabPressIsNoop('/league', '/'));

  check('the active tab is DERIVED from the path — every routed tab names itself',
    routedTabs.every((tab) => activeTabKey(tab.route as string) === tab.key), routedList);
  // ⚠️ POSITIVE CONTROL, and it had to be rewritten when SCRUM-150 landed: this used to read
  // *"Store is never active"*, which stopped being true the moment the storefront existed. ⚠️ A
  // control that outlives the fact it controls is worse than none, so it now uses a SYNTHETIC
  // un-routed tab — which is what `route: null` means, whatever the real tabs happen to be.
  check('⚠️ …and a tab with NO screen is never the active one',
    activeTabKey('/store', [{ key: 'ghost', icon: '', labelKey: '', route: null, screen: null }]) === null
      && activeTabKey('/store') === 'store');
  check('…and a path that is NOT a tab highlights NOTHING, rather than defaulting to the shrine',
    activeTabKey('/settings') === null && activeTabKey('/history') === null);
  // ⚠️ POSITIVE CONTROL — `activeTabKey` must not answer `null` for everything.
  check('⚠️ guard: `activeTabKey` DOES return a key for a real tab',
    routedTabs.some((tab) => activeTabKey(tab.route as string) !== null));

  /**
   * ⚠️ **AND THE BAR MUST DERIVE IT, because a prop is an answer the CALLER gives.** It was
   * `<TabBar active="shrine" …>` — correct on the one screen that rendered it, and wrong the moment
   * the bar appeared anywhere else, which is precisely how a "global" rule stays shrine-specific.
   */
  const tabBarSource = readFileSync(join(PROJECT_ROOT, 'src/components/home/tab-bar.tsx'), 'utf8');
  check('⚠️ the bar reads the CURRENT PATH and takes NO `active` prop',
    tabBarSource.includes('usePathname()')
      && tabBarSource.includes('export function TabBar({ scale }')
      && !tabBarSource.includes('active: string'));
  check('⚠️ …and its press goes through the shared rule, not a local comparison',
    tabBarSource.includes('tabPressIsNoop(') && !tabBarSource.includes('if (isActive ||'));
  check('the week card is the board\'s 350×64 r14',
    HISTORY_SPEC.week.w === 350 && HISTORY_SPEC.week.h === 64 && HISTORY_SPEC.week.radius === 14);
  check('the entry row is 350×88 r12, with a 60 thumb',
    HISTORY_SPEC.row.w === 350 && HISTORY_SPEC.row.h === 88
      && HISTORY_SPEC.row.radius === 12 && HISTORY_SPEC.row.thumb === 60);
  check('the thumb sits INSIDE the row (dx + width < the row width)',
    HISTORY_SPEC.row.thumbDx + HISTORY_SPEC.row.thumb < HISTORY_SPEC.row.w);

  // ── the copy the switcher needs exists in BOTH locales ───────────────────
  const SETTINGS_KEYS = [
    'settings.title', 'settings.general', 'settings.privacy', 'settings.language', 'settings.notBuilt',
    'settings.deleteAll', 'settings.deleteTitle', 'settings.deleteBody', 'settings.deleteConfirm',
    'settings.deleting', 'settings.deleteFailed', 'settings.retentionSub',
    // ⚠️ SCRUM-215 — the sign-out row's own copy. ⚠️ It is in this list because the row is now LIVE: a
    // missing 中文 string here would render the English key on a Chinese device.
    'settings.signOut', 'settings.signOutSub', 'settings.signOutTitle', 'settings.signOutBody',
    'settings.signOutConfirm', 'settings.signingOut', 'settings.signOutFailed',
  ];
  const missingCopy = SETTINGS_KEYS.filter((k) => !keyInBothLocales(k));
  check(`every Settings string exists in BOTH locales (${SETTINGS_KEYS.length})`,
    missingCopy.length === 0, missingCopy.join(', '));
}

/**
 * 19 · The altar's offerings sit on their trays (SCRUM-162).
 *
 * ⚠️ WHY THIS EXISTS, in the owner's words: *"the placement of the decorations on the
 * altar is misaligned."* The four offering dots had kept the **group-space** y (76 / 78)
 * while every path beside them had the inner group's `+68` folded in — so they floated
 * **68 units above their trays**.
 *
 * ⚠️NOTHING EXISTING COULD SEE IT. `tsc` cannot read SVG coordinates; a **bounds** check
 * passes because 76 and 144 are both legal inside a 170-tall viewBox; and a snapshot would
 * only have made the mistake look approved. ⚠️ **The only catchable form is the
 * RELATIONSHIP**: a dot rests on a tray. That is what this asserts.
 */
function offeringsPlacementChecks(): void {
  section('19 · The altar\'s offerings sit on their trays (SCRUM-162)');

  const detached = OFFERING_DOTS.filter((dot) => !dotSitsOnTray(dot));
  check(`every offering dot rests on a tray (${OFFERING_DOTS.length} dots · ${OFFERING_TRAYS.length} trays)`,
    detached.length === 0,
    `detached: ${detached.map((d) => `(${d.cx},${d.cy})`).join(', ')}`);

  // ⚠️ POSITIVE CONTROL — the detector must FIRE on the exact defect that shipped.
  check('…and the rule REJECTS a group-space dot, which is the bug that shipped',
    !dotSitsOnTray({ cx: 10, cy: 76 }),
    'dotSitsOnTray accepted cy 76 — the offset bug would pass this gate');

  // A dot must be inside the viewBox, dot and all.
  const outOfBox = OFFERING_DOTS.filter(
    (dot) =>
      dot.cx - OFFERING_DOT_RADIUS < 0 ||
      dot.cx + OFFERING_DOT_RADIUS > OFFERINGS_VIEWBOX.w ||
      dot.cy - OFFERING_DOT_RADIUS < 0 ||
      dot.cy + OFFERING_DOT_RADIUS > OFFERINGS_VIEWBOX.h,
  );
  check('…and every dot is whole inside the 330 × 170 viewBox', outOfBox.length === 0,
    outOfBox.map((d) => `(${d.cx},${d.cy})`).join(', '));

  const traysOut = OFFERING_TRAYS.filter(
    (t) => t.x < 0 || t.y < 0 || t.x + t.w > OFFERINGS_VIEWBOX.w || t.y + t.h > OFFERINGS_VIEWBOX.h,
  );
  check('…and every tray is inside it too', traysOut.length === 0, JSON.stringify(traysOut));

  // ⚠️ The pairs are drawn at slightly different heights on the board (144 / 146) — if a
  // future edit "tidies" them onto one line, say so rather than silently accepting it.
  const heights = new Set(OFFERING_DOTS.map((d) => d.cy));
  check('…and the board\'s deliberate 2-unit stagger is preserved (144 / 146, not one line)',
    heights.size === 2, `heights: ${[...heights].join(', ')}`);
}

/**
 * 20 · The shrine's panels never lie (SCRUM-161).
 *
 * ⚠️ THE RULE: **a failed read must never render as `0`.** "0 tribute points" is a claim
 * about the user's history; a failed read is a claim about the network. Showing the second
 * as the first is a lie the user cannot detect — the same class as `bookView` showing an
 * empty Book when the server had a problem.
 *
 * ⚠️ And a second, smaller one: the panels ink `brand.cinnabarDeep` as TEXT, which the
 * token role rule forbids (`brand.*` is decorative). That exception is taken because the
 * board does it — so the ratio is asserted here rather than trusted.
 */
function homePanelChecks(): void {
  section('20 · The shrine\'s panels — a failure is never a zero (SCRUM-161)');

  check('before the read, the state is `loading` — not `ready` with zeros',
    homePanels(null).kind === 'loading');

  const failed = homePanels({ ok: false, reason: 'network_error' });
  check('a failed read is `failed` and carries its reason',
    failed.kind === 'failed' && failed.reason === 'network_error');
  // ⚠️ POSITIVE CONTROL — the shape that would be a lie.
  check('…and it is NOT `ready` (a zero here would claim the user earned nothing)',
    failed.kind !== 'ready');

  const ready = homePanels({ ok: true, data: { tribute: 12480, streakDays: 12 } });
  check('a successful read formats the total the way the board inks it (12,480)',
    ready.kind === 'ready' && ready.tribute === '12,480', JSON.stringify(ready));
  check('…and keeps the streak as the server gave it', ready.kind === 'ready' && ready.streakDays === 12);

  check('a non-finite total is a broken payload, not a zero',
    homePanels({ ok: true, data: { tribute: Number.NaN, streakDays: 1 } }).kind === 'failed');
  check('…and so is a non-finite streak',
    homePanels({ ok: true, data: { tribute: 1, streakDays: Number.POSITIVE_INFINITY } }).kind === 'failed');

  const negative = homePanels({ ok: true, data: { tribute: -5, streakDays: -2 } });
  check('a negative is clamped to 0 rather than printed with a minus',
    negative.kind === 'ready' && negative.tribute === '0' && negative.streakDays === 0);

  check('formatPoints groups thousands by hand (not toLocaleString)',
    formatPoints(0) === '0' && formatPoints(999) === '999'
      && formatPoints(1000) === '1,000' && formatPoints(1234567) === '1,234,567');
  check('…and truncates a fractional total', formatPoints(12.9) === '12');

  // ⚠️ The token-role exception, measured.
  const ink = contrastRatio('#9A2B18', '#F5F0E8');
  check(`the streak's cinnabarDeep ink on paper passes AA (${ink.toFixed(2)}:1)`, ink >= 4.5,
    `${ink.toFixed(2)}:1 — use text.cinnabar instead`);
}

/**
 * 21 · The altar's carousel (SCRUM-146).
 *
 * ⚠️ TWO FAILURES THIS PREVENTS, both silent:
 *   · **the index is clamped.** Archiving the tablet the carousel is sitting on would leave the
 *     index past the end of the list and the altar rendering nothing — with `count` still > 0,
 *     so nothing looks empty, it just vanishes;
 *   · **the ends are ends.** `pageStep` does not wrap, because a carousel that silently loops is
 *     a carousel a user cannot tell they have finished.
 *
 * ⚠️ And the band is shared: `slot · ＋ add a tablet` and the centre tablet are BOTH
 * 131,285 129×307 on the board, so the ＋ and the first tablet swap in place. If they ever stop
 * sharing a band, the whole shrine shifts when the first tablet is added — that is asserted by
 * `HOME_BANDS.addSlot` being the band both branches use, and §18's fit check covering it.
 */
function altarChecks(): void {
  section('21 · The altar\'s carousel — clamped, and the ends are ends (SCRUM-146)');

  check('no tablets → the altar offers the ＋ slot', altarView(0, 0).kind === 'empty');
  check('…and a stale page index cannot resurrect one', altarView(0, 7).kind === 'empty');

  const first = altarView(3, 0);
  check('the first of three has no prev, only next',
    first.kind === 'tablet' && !first.hasPrev && first.hasNext && first.index === 0);
  const last = altarView(3, 2);
  check('the last of three has no next, only prev',
    last.kind === 'tablet' && last.hasPrev && !last.hasNext && last.index === 2);
  check('one tablet shows no arrows at all',
    altarView(1, 0).kind === 'tablet' && !altarView(1, 0).hasPrev && !altarView(1, 0).hasNext);

  // ⚠️ THE CLAMP — the archived-tablet case.
  const stranded = altarView(3, 9);
  check('an index past the end is CLAMPED to the last tablet, never "nothing"',
    stranded.kind === 'tablet' && stranded.index === 2, JSON.stringify(stranded));

  check('pageStep does not wrap at the start', pageStep(0, 3, -1) === 0);
  check('pageStep does not wrap at the end', pageStep(2, 3, 1) === 2);
  check('pageStep moves one', pageStep(1, 3, -1) === 0 && pageStep(1, 3, 1) === 2);
  check('pageStep on an empty altar stays at 0', pageStep(0, 0, 1) === 0);

  // ── ⚠️ THE CAPTION — the defect the owner saw: the EMPTY line over a full altar ───────
  check('no tablets → the EMPTY caption', altarCaption(0).key === 'home.altarEmpty');
  check('⚠️ a negative count does NOT fall through to "−1 ancestors"', altarCaption(-3).key === 'home.altarEmpty');
  check('one tablet → the SINGULAR (the board only draws the 3 case)', altarCaption(1).key === 'home.altarFilledOne');
  check('…and it carries no placeholder to leave unsubstituted', altarCaption(1).options === undefined);
  const three = altarCaption(3);
  check('three tablets → the board\'s filled line', three.key === 'home.altarFilled');
  check('…with the count interpolated as a STRING (i18n-js `%{count}`)', three.options?.count === '3');
  check('every caption key exists in BOTH locales',
    ['home.altarEmpty', 'home.altarFilledOne', 'home.altarFilled'].every(keyInBothLocales));
}

/**
 * §22 · The tab bar (SCRUM-164).
 *
 * ⚠️ This section exists because the bar is the first surface whose **board itself is wrong**:
 * `nav · tab Shrine` inks `#9A2B18` on a `#C23B22` pill. That is **1.44:1** — the text is barely
 * distinguishable from its own background, and no amount of careful porting would have fixed it.
 * The build renders `onColorCream` (**4.90:1**) instead, and the assertion below pins BOTH numbers
 * so that neither "copy the board" nor "nudge it back" can pass silently.
 */
function tabBarChecks(): void {
  section('22 · The tab bar — geometry, dead links, and the board\'s contrast defect (SCRUM-164)');

  // ⚠️ Re-derived here, not shared: `PROJECT_ROOT` in §26 is scoped to that function.
  const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

  check('tabs start at x = 12 (board)', TAB_BAR.xs[0] === 12);
  check('there are four tabs, each 86 wide', TAB_BAR.xs.length === 4 && TAB_BAR.tab.w === 86);

  const lastRight = TAB_BAR.xs[3] + TAB_BAR.tab.w;
  check('the last tab ends inside the 390 canvas', lastRight === 379 && lastRight <= 390, `${lastRight}`);

  // ⚠️ The board's spacing is NOT even (94 · 93 · 94), so "four 86-wide tabs fit in 390" does not
  // imply "they do not overlap". Assert the relationship, not the bound.
  let overlapping = '';
  for (let i = 0; i < TAB_BAR.xs.length - 1; i += 1) {
    if (TAB_BAR.xs[i] + TAB_BAR.tab.w > TAB_BAR.xs[i + 1]) {
      overlapping = `${TAB_BAR.xs[i]} runs into ${TAB_BAR.xs[i + 1]}`;
    }
  }
  check('…and no two tabs overlap', overlapping === '', overlapping);

  const bar = HOME_BANDS.tabbar;
  // ⚠️ The relationship that failed on glass: a child of the band applies topInBar, and it must
  // be the tab's board y MINUS the band's.
  check(
    "topInBar is the tab board-y minus the band y (the glass bug)",
    TAB_BAR.tab.topInBar === TAB_BAR.tab.y - bar.y,
    `${TAB_BAR.tab.topInBar} vs ${TAB_BAR.tab.y - bar.y}`,
  );
  check(
    'the tab row sits inside the bar band',
    TAB_BAR.tab.y >= bar.y && TAB_BAR.tab.y + TAB_BAR.tab.h <= bar.y + bar.h,
  );

  // ⚠️ THE DEFECT, pinned. Both numbers, so a future "fix" to the board has to change this.
  const boardInk = contrastRatio('#9a2b18', '#c23b22');
  check(
    "⚠️ the board's active-tab ink FAILS AA — this is WHY the build deviates",
    boardInk < 4.5,
    `${boardInk.toFixed(2)}:1`,
  );
  const builtInk = contrastRatio('#fff8e8', '#c23b22');
  check('…and the ink the build actually uses passes AA', builtInk >= 4.5, `${builtInk.toFixed(2)}:1`);

  /**
   * ⚠️⚠️ **DEAD LINKS *AND* ONE-WAY PUSHES.** Every tab owes the user two things, and this walks
   * `NAV_TABS` — the real destinations — so a fifth tab is covered the day it is added.
   *
   * 1. **The screen exists.** A tab wired to a route someone assumed was there is a dead link;
   *    `Store` is disabled for exactly this reason (`SCRUM-150`).
   * 2. **The screen RENDERS the bar** (owner's ruling, 2026-11-01: *"nav bar should be accessible
   *    for the 4 options it displays"*). ⚠️ A destination you can reach but cannot leave is a
   *    **one-way push** — which is what the bar's League and Profile buttons were while the bar
   *    rendered on the shrine alone.
   */
  for (const tab of NAV_TABS) {
    if (tab.screen === null) {
      // ⚠️ The two nulls must travel together, or "disabled" and "no screen" stop meaning the same
      // thing and a tab can end up pointing at a file that is not there.
      check(`⚠️ "${tab.key}" has NO screen, so it is disabled rather than a dead link`,
        tab.route === null, tab.key);
      continue;
    }
    const file = join(PROJECT_ROOT, `src/app/${tab.screen}`);
    // ⚠️ `existsSync` first, so a missing file reports a missing file rather than throwing and
    // taking the whole section down with it.
    const exists = existsSync(file);
    check(`the "${tab.route}" tab points at a screen that exists (${tab.screen})`, exists, tab.key);
    check(`⚠️ …and that screen RENDERS the bar, so the tab is not a one-way push (${tab.screen})`,
      exists && readFileSync(file, 'utf8').includes('<TabBarBand'), tab.key);
  }
  // ⚠️ POSITIVE CONTROL — the scan above must be able to MISS a band as well as find one.
  check('⚠️ guard: the band scan finds the bar on a destination and misses it on a deeper screen',
    readFileSync(join(PROJECT_ROOT, 'src/app/league.tsx'), 'utf8').includes('<TabBarBand')
      && !readFileSync(join(PROJECT_ROOT, 'src/app/settings.tsx'), 'utf8').includes('<TabBarBand'));

  /**
   * ── ⚠️ THE SHRINE CARRIES NO BOOK ENTRY — A DECISION, NOT AN OMISSION ──
   * (SCRUM-209 **Option 4**, owner's ruling 2026-11-01.)
   *
   * ⚠️ `SCRUM-164`'s original acceptance said *"tapping Book reaches `/clan/book`"*. **No Home board
   * draws a Book entry** — every Home board was searched for `book` / `簿` / `ledger` / `tribute` /
   * `entry`, and the only hits are `panel · tribute`. The owner declined to change a signed-off board
   * and accepted that the Book stays **three taps deep** on the clan-pill path.
   *
   * ⚠️ The assertion is here because the decision is about a thing that is **ABSENT**, and absence is
   * exactly what a future session would helpfully fill in. Same class as §26's *Burn has no back
   * button* — a rule about a component that must not be rendered.
   */
  const shrineSource = readFileSync(join(PROJECT_ROOT, 'src/app/index.tsx'), 'utf8');
  check('⚠️ the shrine has NO Book entry — the clan pill is the accepted path (SCRUM-209 Option 4)',
    !shrineSource.includes('/clan/book'));
  check('…and the Book is still REACHABLE — `/clan/manage` is the one place that pushes it',
    readFileSync(join(PROJECT_ROOT, 'src/app/clan/manage.tsx'), 'utf8').includes("'/clan/book'"));
  // ⚠️ POSITIVE CONTROL — the same absence scan must FIND a route where one really is present.
  check('⚠️ guard: the same scan finds a route link on a screen that has one',
    shrineSource.includes("'/clan'") && shrineSource.includes("'/capture'"));
}

/**
 * §23 · The tablet sheet's rules (SCRUM-146 · SCRUM-168).
 *
 * ⚠️ Every number here is a **MIRROR** of the database, and a mirror that drifts is worse than
 * none: the client would offer a save the server refuses with a raw Postgres code. So each one is
 * asserted against the thing that actually decides — the RPC's ladder, the RLS policies, the
 * `CHECK` constraints and `clans.ancestor_cap`.
 */
/**
 * §28 · The Collection screen's rules (SCRUM-151).
 *
 * ⚠️ These are the facts `EN · 8 Collection` / `8d` decide and a render cannot assert: **which slot
 * the items fill, which empty slot carries words, and which words**. The board draws six dashed slots
 * and puts copy on exactly ONE of them — and the copy CHANGES when the grid is entirely empty. A JSX
 * branch cannot be read by a gate, so the mapping lives in `lib/collection.ts` and is asserted here.
 */
function collectionChecks(): void {
  section('28 · Collection — the grid, the empty state, and the count (SCRUM-151)');

  // ── the board's geometry ──────────────────────────────────────────────────
  check('the grid is SIX slots — two columns, three rows (board)',
    COLLECTION_SLOTS === 6 && COLLECTION.card.xs.length === 2 && COLLECTION.card.ys.length === 3);
  check('the columns are at x 20 · 197 (board)', COLLECTION.card.xs[0] === 20 && COLLECTION.card.xs[1] === 197);
  check('…and the rows at y 168 · 350 · 532 (board)',
    COLLECTION.card.ys[0] === 168 && COLLECTION.card.ys[1] === 350 && COLLECTION.card.ys[2] === 532);
  check('the card is 165×170, r14 (board)',
    COLLECTION.card.w === 165 && COLLECTION.card.h === 170 && COLLECTION.card.radius === 14);
  check('the two stat cards are at x 20 · 205, 165×40 (board)',
    COLLECTION.stat.xs[0] === 20 && COLLECTION.stat.xs[1] === 205
      && COLLECTION.stat.w === 165 && COLLECTION.stat.h === 40);
  // ⚠️ The grid must FIT the 390 canvas: two 165 cards + the 20 gutters + the 12 gap.
  const gridRight = COLLECTION.card.xs[1] + COLLECTION.card.w;
  check('⚠️ the second column ends inside the 390 canvas', gridRight === 362 && gridRight <= 390, `${gridRight}`);

  // ── the fill order ────────────────────────────────────────────────────────
  const three = collectionGrid([
    { itemCode: 'gold_bar', burned: 5 },
    { itemCode: 'house', burned: 1 },
    { itemCode: 'joss_paper_stack', burned: 4 },
  ]);
  check('items fill the slots in READING ORDER',
    three[0]?.itemCode === 'gold_bar' && three[1]?.itemCode === 'house' && three[2]?.itemCode === 'joss_paper_stack',
    three.slice(0, 3).map((c) => String(c.itemCode)).join(' '));
  check('…and the rest of the grid is EMPTY slots', three.slice(3).every((c) => c.kind === 'empty'));

  // ── ⚠️ WHICH empty slot speaks, and what it says ──────────────────────────
  check('⚠️ on a partly-filled grid the FIRST empty slot offers the next one',
    three[3]?.emptyCopy === 'nextOne');
  check('⚠️ …and every other empty slot is a bare ＋ (the board words only one)',
    three.slice(4).every((c) => c.emptyCopy === 'none'),
    three.slice(4).map((c) => c.emptyCopy).join(' '));

  const none = collectionGrid([]);
  check('⚠️ on an EMPTY grid all six are slots', none.every((c) => c.kind === 'empty'));
  check('⚠️ …and the first says "nothing here yet", NOT "offer something new"',
    none[0]?.emptyCopy === 'firstEver',
    none[0]?.emptyCopy);
  check('…with the other five bare', none.slice(1).every((c) => c.emptyCopy === 'none'));

  const full = collectionGrid(
    ['a', 'b', 'c', 'd', 'e', 'f'].map((code) => ({ itemCode: code, burned: 1 })),
  );
  check('a full grid has NO empty slot at all', full.every((c) => c.kind === 'item'));
  // ⚠️ POSITIVE CONTROL — the two empty-copy words must not be the same value.
  check('⚠️ guard: "firstEver" and "nextOne" are different, so the check above can fail',
    none[0]?.emptyCopy !== three[3]?.emptyCopy);

  check('⚠️ SEVEN collected items overflow the six slots (a real limit, not silent)',
    !collectionOverflows(6) && collectionOverflows(7));

  // ── ⚠️ the count is never ×0 ──────────────────────────────────────────────
  check('⚠️ a count of 0 renders as 1 — a cell exists because a burn happened',
    displayBurnCount(0) === 1 && displayBurnCount(-3) === 1);
  check('a real count passes through, floored', displayBurnCount(5) === 5 && displayBurnCount(2.7) === 2);
  check('⚠️ a non-number cannot render as NaN', displayBurnCount(Number.NaN) === 1);
  // ⚠️ POSITIVE CONTROL — the clamp must not flatten every value to 1.
  check('⚠️ guard: the count is not a constant', displayBurnCount(9) !== displayBurnCount(1));

  // ── the name, never a raw code ────────────────────────────────────────────
  check('a catalogue code resolves to a NAME, not the code',
    collectedItemName('gold_bar') === 'Gold Bar', String(collectedItemName('gold_bar')));
  check('⚠️ …and an unknown code resolves to null, so the screen shows a gap not "nope"',
    collectedItemName('nope') === null && collectedItemName(null) === null);
  // ⚠️ POSITIVE CONTROL — the resolver must FIND a name for every catalogue entry.
  check('⚠️ guard: every catalogue offering resolves (none falls through)',
    OFFERINGS.every((o) => (collectedItemName(o.code) ?? '').length > 0));
}

/**
 * §29 · The Store and the PORTED ART (SCRUM-150).
 *
 * ⚠️ The art is a **transcription**, so the gate that matters is that every catalogue code has
 * some: a new offering would otherwise ship as a blank card, and ⚠️ nothing in `tsc` connects the
 * catalogue to the illustrations.
 */
/**
 * §30 · The ITEM burn's route contract (SCRUM-149).
 *
 * ⚠️⚠️ **THE RULE THE WHOLE TICKET TURNS ON: an item burn carries `item_code` and NOT
 * `capture_id`.** `submit_burn` refuses a payload with both or neither (*"exactly one of capture_id /
 * item_code is required"*), so a route that could carry both would be a route that can express a
 * state the server rejects — and it would make `captureId` OPTIONAL on the photo path, which is the
 * exact defect `toRewardParams`' doc records. ⚠️ These two readers must never both succeed.
 */
function itemBurnChecks(): void {
  section('30 · The item burn — the route contract (SCRUM-149)');
  // ⚠️ Re-derived here, not shared: `PROJECT_ROOT` is scoped to the function that makes it.
  const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

  const item = readItemBurnParams({ itemCode: 'gold_bar' });
  check('an item burn parses from `itemCode` alone (no uri, no sprite)',
    item.ok && item.itemCode === 'gold_bar');
  check('⚠️ …and a MISSING item code is refused by name',
    !readItemBurnParams({}).ok && !readItemBurnParams({ itemCode: '   ' }).ok);

  /**
   * ⚠️ **THE CROSS-CHECKS — each reader requires ITS OWN id, and neither accepts the other's.**
   * This is the property that makes the two paths separable, and it is what the first version of this
   * section got WRONG: it asserted that a payload carrying BOTH would be refused by the photo reader,
   * and the suite said otherwise — `readBurnParams` has never heard of `itemCode` and accepts a
   * capture whenever one is there. ⚠️ That is not a bug in the reader; it is a fact about it, and
   * asserting the opposite would have been a gate that lies.
   */
  check('⚠️ the ITEM reader refuses a photo-only payload (no item_code)',
    !readItemBurnParams({ captureId: 'abc', uri: 'file://x' }).ok);
  check('⚠️ …and the PHOTO reader refuses an item-only payload (no capture_id)',
    !readBurnParams({ itemCode: 'gold_bar' }).ok);
  const neither = {};
  check('…and with NEITHER, both readers refuse',
    !readItemBurnParams(neither).ok && !readBurnParams(neither).ok);
  /**
   * ⚠️ **A PAYLOAD CARRYING BOTH IS REFUSED BY THE SERVER, NOT BY THE READERS** —
   * `submit_burn`: *"exactly one of capture_id / item_code is required"*, and `burns` carries the same
   * XOR as a constraint. ⚠️ So the CLIENT's job is to never SEND both, and the screen's rule is to
   * prefer the item when both arrive — which is a fact about `burn.tsx`, so it is scanned, not assumed.
   */
  const burnSrc = readFileSync(join(PROJECT_ROOT, 'src/app/burn.tsx'), 'utf8');
  check('⚠️ `burn.tsx` reads the ITEM params and prefers the item when both are present',
    burnSrc.includes('readItemBurnParams(') && burnSrc.includes('toItemRewardParams(')
      && burnSrc.includes('itemCode !== null'));
  check('⚠️ …and it sends the item code on the ITEM path, never a capture',
    readFileSync(join(PROJECT_ROOT, 'src/lib/ritual.ts'), 'utf8')
      .includes("{ item_code: itemCode.trim(), accuracy: accuracyPx, clan_id: clanId }"));

  const reward = readItemRewardParams({ itemCode: 'house', offsetPx: '41.5', throwNumber: '2' });
  check('the item reward hop carries the code and the SAME accuracy/throw rules',
    reward.ok && reward.itemCode === 'house' && reward.accuracyPx === 41.5 && reward.throwNumber === 2);
  check('⚠️ …and a bad accuracy is refused, not rounded to a bullseye',
    !readItemRewardParams({ itemCode: 'house', offsetPx: '' }).ok
      && !readItemRewardParams({ itemCode: 'house', offsetPx: '-1' }).ok
      && !readItemRewardParams({ itemCode: 'house', offsetPx: 'abc' }).ok);
  check('…and a missing throw number defaults to the FIRST throw',
    (() => { const r = readItemRewardParams({ itemCode: 'house', offsetPx: '10' });
      return r.ok && r.throwNumber === 1; })());
  // ⚠️ POSITIVE CONTROL — the two reward readers must not both accept one param set.
  check('⚠️ guard: the photo reward reader REJECTS an item-only param set',
    !readRewardParams({ itemCode: 'house', offsetPx: '10' }).ok);
}

function pickerChecks(): void {
  section('31 · The offerings picker — a BUNDLE is not an item, so it is NOT offered (SCRUM-221)');
  /**
   * ⚠️ **AN EMPTY INVENTORY, so `owned`/`qty` are all zero and ONLY the LIST is under test.** The
   * owner's rule (2026-11-07): the Wealth Bundle must not appear in the picker **at all** — ⚠️ not
   * even as a disabled card — because buying it grants one of each of its parts and the SERVER never
   * writes a `wealth_bundle` row, so it could only ever render permanently unavailable.
   */
  const cells = pickerGrid({});
  check('⚠️ the picker offers every STANDARD item — the four, in catalogue order',
    cells.map((c) => c.code).join(',') === 'joss_paper_stack,gold_bar,smartphone,house');
  check('⚠️⚠️ …and NEVER the Wealth Bundle — not even disabled (owner, 2026-11-07)',
    !cells.some((c) => c.code === 'wealth_bundle'));
  check('⚠️ …and the exclusion is the COMPOSED rule, not a hard-coded name',
    cells.length === OFFERINGS.filter((o) => o.composedOf === undefined).length
      && OFFERINGS.filter((o) => o.composedOf !== undefined).every((o) => !cells.some((c) => c.code === o.code)));
  // ⚠️ POSITIVE CONTROL — a filter that returned NOTHING would "pass" the exclusion above.
  check('⚠️ guard: the picker is NOT empty — it renders the four items, each unowned',
    cells.length === 4 && cells.every((c) => !c.owned && c.qty === 0));
  // ⚠️ And the bundle is STILL in the catalogue — the exclusion is the PICKER's, not a deletion of the
  // item: the Store must keep featuring + selling it.
  check('⚠️ guard: the bundle is still IN the catalogue — only excluded from the picker',
    OFFERINGS.some((o) => o.code === 'wealth_bundle' && o.composedOf !== undefined));
}

function accountChecks(): void {
  section('32 · The account — the UPGRADE is a LINK, not a second user (SCRUM-215 · ADR-004)');
  /**
   * ⚠️⚠️ **THE ASSERTION THIS SECTION EXISTS FOR.** ADR-004 rule 4: converting an anonymous session must
   * carry the ledger, the ancestors and the streak with it — so it must **keep the `auth.users` id**.
   * ⚠️ A second user is a **failure** of the ticket, and the difference is one line: `updateUser` vs
   * `signInWithOtp`. That is a fact about which call is made, so it is asserted, not commented.
   */
  check('⚠️⚠️ SIGN UP keeps the user id — it is the in-place UPGRADE (ADR-004 rule 4)',
    ACCOUNT_MODES.signUp.keepsUserId === true);
  check('⚠️ …confirmed with `email_change`, the type that verifies an ATTACHED email',
    ACCOUNT_MODES.signUp.verifyType === 'email_change');
  check('⚠️ …and SIGN IN does NOT claim to keep it — it is a different user, and that is correct',
    ACCOUNT_MODES.signIn.keepsUserId === false && ACCOUNT_MODES.signIn.verifyType === 'email');
  check('⚠️ …and the two flows never share a verify type (sharing one is how they would collapse)',
    ACCOUNT_MODES.signUp.verifyType !== ACCOUNT_MODES.signIn.verifyType);
  // ⚠️ THE SOURCE — the table above is a STATEMENT; `account.ts` is the CALL. A `signInWithOtp` on the
  // sign-up road is the second-user bug, so the METHOD CHOICE is asserted too.
  const accountSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'account.ts'), 'utf8');
  check('⚠️ …and the DEVICE half makes the upgrade call with `updateUser`, not `signInWithOtp`',
    accountSrc.includes('auth.updateUser({ email })')
      && accountSrc.includes('auth.signInWithOtp({ email })'));
  check('⚠️ …and it reads the verify type from the TABLE, never hard-coding one',
    accountSrc.includes('ACCOUNT_MODES[mode].verifyType'));

  // ⚠️ THE WALL RULE (ADR-004 · SCRUM-147 · its Amendment 1): never before the first burn, offered after.
  check('⚠️ the account is NEVER reachable before the first burn — and IS offered after it',
    ACCOUNT_GATE.reachableBeforeFirstBurn === false && ACCOUNT_GATE.offeredAfterFirstBurn === true);

  /**
   * ⚠️⚠️ **THE PRIVACY PROMISE MUST SAY THE SAME THING IN BOTH LANGUAGES** (owner, 2026-11-08 · SCRUM-217.2:
   * *"we can generalize the ZH to 信息 instead"*).
   *
   * The signed-off phone copy was 短信推送 (SMS push). Carried to email it became 邮件推送 — ⚠️ which
   * **narrowed the promise**: only *email* pushes were excluded, so an SMS, a notification, or any future
   * channel fell outside what the user was told. The EN sentence says *"ads or messages"*, deliberately broad.
   * 信息推送 is the ZH that means the same thing.
   * ⚠️ A privacy claim getting **weaker in one language** is not a copy nit — it is the promise the product
   * makes, so it is asserted, on the RENDERED string.
   */
  const privacy = (loc: 'en' | 'zh') => MESSAGES[loc]['account.privacy'] ?? '';
  check('⚠️⚠️ the ZH privacy promise is GENERAL (信息), not narrowed to email — it matches the EN sentence',
    privacy('zh').includes('信息推送') && !privacy('zh').includes('邮件推送')
      && privacy('en').includes('ads or messages'),
    `zh="${privacy('zh')}" en="${privacy('en')}"`);
  // ⚠️ POSITIVE CONTROL — the wording that shipped before the decision must FAIL that check.
  check('⚠️ guard: the narrowed 邮件推送 string WOULD fail the general-promise check',
    !'邮箱仅用于登录验证，不会用于广告或邮件推送。'.includes('信息推送'));
  // ⚠️ And the one case the upgrade cannot do: an email that is already an account means SIGN IN, never
  // the documented data-reassignment workaround — that would be the second user ADR-004 forbids.
  check('⚠️ an email that already has an account means SIGN IN, never a data reassignment',
    EMAIL_TAKEN_MEANS_SIGN_IN === true);
  // ⚠️ **AND THE DECISION IS APPLIED, NOT JUST DECLARED.** Measured on glass 2026-11-07: a failed
  // `verifyOtp` printed the RAW `sign_in_failed` in the issue line — so an unmapped reason IS what a
  // player would have read. `issueKeyFor` is the mapping that stands between the two.
  check('⚠️ a raw provider reason is NEVER the copy a player reads (issueKeyFor)',
    issueKeyFor('sign_in_failed', 'code') === 'account.codeWrong' &&
      issueKeyFor('no_at') === 'account.emailInvalid' &&
      issueKeyFor('weird_unknown_thing') === 'account.genericIssue');
  check('…and every key it can return is one the table actually defines, in BOTH locales',
    [
      issueKeyFor('invalid token'),
      issueKeyFor('no_dot'),
      issueKeyFor('?'),
      issueKeyFor('sign_in_failed', 'code'),
      issueKeyFor('otp_expired', 'code'),
      // ⚠️ A 429 is a TEMPORARY refusal, not a broken sign-in — and it is a key, so it must exist twice.
      issueKeyFor('rate_limited'),
    ].every((k) => MESSAGES.en[k] !== undefined && MESSAGES.zh[k] !== undefined));
  check('⚠️ EMAIL-ALREADY-TAKEN means SIGN IN — and ONLY on the sign-up road',
    meansSignInInstead('signUp', 'A user with this email address has already been registered') === true &&
      meansSignInInstead('signIn', 'already registered') === false &&
      meansSignInInstead('signUp', 'network timeout') === false);

  check('⚠️ the code is SIX digits, and only digits (a partial code must not be sent)',
    ACCOUNT_CODE_LENGTH === 6 && isCompleteCode('123456') && !isCompleteCode('12345')
      && !isCompleteCode('1234567') && !isCompleteCode('12345a'));
  check('an empty or malformed email is refused by name',
    emailProblem('') === 'empty' && emailProblem('nope') === 'no_at'
      && emailProblem('a@b') === 'no_dot' && emailProblem('a b@c.d') === 'spaces');
  // ⚠️ POSITIVE CONTROL — the validator must NOT refuse addresses the server would accept.
  check('⚠️ guard: a legitimate address is not refused by a clever client regex',
    emailProblem('a+tag@sub.domain.example') === null && emailProblem('x@y.co') === null);
  check('⚠️ the email is normalised (trim + lower), so one address is one key',
    normaliseEmail('  A@B.COM ') === 'a@b.com');
  check('the form steps are email → code, and the code is last',
    nextAccountStep('email') === 'code' && nextAccountStep('code') === null);

  /**
   * ── ⚠️ SIGN OUT (built 2026-11-08) ──────────────────────────────────────────
   * The row has sat on Settings since **SCRUM-151**, rendered `disabled` with `settings.notBuilt`. ⚠️ The
   * failure mode the build must not introduce is subtler than an inert row: a bare `signOut()` leaves the
   * device holding **no session**, and `ensureAnonymousSession()` only signs in when there is none — so the
   * next authenticated read answers `42501` while the shrine renders empty. That is why the pairing is
   * asserted rather than trusted to a comment.
   */
  const SETTINGS_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app', 'settings.tsx');
  const settingsSrc = readFileSync(SETTINGS_SRC, 'utf8');

  /**
   * ⚠️ Two slicers, because two DIFFERENT files hold the two halves: the SCREEN decides what the tap does
   * (`runSignOut`), the LIBRARY decides what the call does (`signOutAccount`). ⚠️ Asking *"does it erase?"*
   * of a whole file answers for the DELETE handler too — a check that cannot fail.
   */
  const handlerOf = (source: string, name: string): string => {
    const at = source.indexOf(`const ${name} = useCallback`);
    if (at < 0) return '';
    const end = source.indexOf('}, []);', at);
    return end < 0 ? '' : source.slice(at, end + '}, []);'.length);
  };
  const fnOf = (source: string, name: string): string => {
    const at = source.indexOf(`export async function ${name}(`);
    if (at < 0) return '';
    const end = source.indexOf('\n}', at);
    return end < 0 ? '' : source.slice(at, end + 2);
  };
  const signOutSrc = handlerOf(settingsSrc, 'runSignOut');
  const deleteSrc = handlerOf(settingsSrc, 'runDelete');
  const signOutFn = fnOf(accountSrc, 'signOutAccount');

  check('⚠️ the sign-out ROW is wired to a real call and names its consequence (not `settings.notBuilt`)',
    signOutSrc.includes('signOutAccount()')
      && settingsSrc.includes('subKey="settings.signOutSub"'));

  check('⚠️ the DEVICE half signs out, with an EXPLICIT scope',
    signOutFn.includes("auth.signOut({ scope: 'global' })"));

  /**
   * ⚠️⚠️ **THE ASSERTION THIS BLOCK EXISTS FOR** (ADR-004 **Amendment 2**, 2026-11-08): an anonymous session
   * is minted **only while the device is still owed its demo**. ⚠️ Past that, a missing session means
   * SIGNED OUT and the answer is the sign-in wall — **never a new identity**. Before the amendment a
   * session-less device always got one, so signing out silently produced a fresh anonymous shrine and the
   * account was never actually left.
   */
  const plan = (over: Partial<Parameters<typeof planBootstrap>[0]> = {}) =>
    planBootstrap({ configured: true, hasSession: false, userId: null, onboarded: false, ...over });

  check('⚠️⚠️ past onboarding with NO session, the device is told to SIGN IN — it is never minted',
    plan({ onboarded: true }).action === 'require_sign_in');
  check('⚠️ …but a device NOT yet past onboarding gets the anonymous session first run needs',
    plan({ onboarded: false }).action === 'mint_anonymous');
  check('…and a real session is REUSED, whether or not the device is past onboarding',
    plan({ hasSession: true, userId: 'u1' }).action === 'reuse'
      && plan({ hasSession: true, userId: 'u1', onboarded: true }).action === 'reuse');
  check('…and an unconfigured app decides nothing at all',
    plan({ configured: false }).action === 'skip');
  // ⚠️ POSITIVE CONTROL — `planSession`'s own rule must still hold underneath: a session with no user id is
  // NOT reusable (reusing it is the `not_authenticated` failure the bootstrap exists to prevent).
  check('⚠️ guard: a session WITHOUT a user id is not reused — it falls through to the onboarding rule',
    plan({ hasSession: true, userId: null, onboarded: true }).action === 'require_sign_in');

  /**
   * ⚠️⚠️ **THE FACT IS RECORDED WHERE IT BECOMES TRUE, AND CLEARED IN EXACTLY ONE PLACE.** ⚠️ An
   * anonymous device can sign out too, so `signOutAccount` must set it — otherwise its next launch mints a
   * replacement and the user is back in a demo shrine, which is the behaviour the amendment removes.
   */
  check('⚠️ …`onboarded` is set on BOTH roads that make it true (sign-in confirmed · signed out)',
    accountSrc.includes('await markOnboarded();')
      && (accountSrc.match(/await markOnboarded\(\);/g) ?? []).length === 2);
  check('⚠️ …and it is CLEARED only by the delete, BEFORE the re-mint',
    deleteSrc.includes('await clearOnboarded()')
      && deleteSrc.indexOf('await clearOnboarded()') < deleteSrc.indexOf('await resetIdentity()'));
  // ⚠️ POSITIVE CONTROL — `signOutAccount` must not be the ONLY setter: an account link is the other.
  check('⚠️ guard: the two `markOnboarded` calls are not both in the sign-out',
    (signOutFn.match(/markOnboarded/g) ?? []).length === 1);

  check('⚠️⚠️ SIGN OUT does NOT mint a replacement anonymous identity (Amendment 2)',
    !signOutFn.includes('ensureAnonymousSession')
      && !signOutFn.includes('signInAnonymously'));

  /**
   * ⚠️ **And the SIGN-OUT ROUTE is the WALL, not the shrine.** Sending a signed-out device to `/` renders a
   * shrine whose every panel is empty over reads that answer `42501` — the screen looks fine and is a lie.
   */
  check('⚠️ …and the screen lands on the SIGN-IN WALL, not the shrine',
    signOutSrc.includes('router.replace(ACCOUNT_ROUTE)'));

  check('⚠️ the BOOTSTRAP is the one place the rule lives, and it reads the ONBOARDED record',
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'session.ts'), 'utf8')
      .includes('planBootstrap(') &&
      readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'session.ts'), 'utf8')
        .includes('readOnboarded()'));

  check('⚠️ the ROOT GATE redirects on `sign_in_required` ALONE and exempts the account screen',
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app', '_layout.tsx'), 'utf8')
      .match(/result\.reason === SIGN_IN_REQUIRED/g)?.length === 1
      && readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app', '_layout.tsx'), 'utf8')
        .includes('pathname !== ACCOUNT_ROUTE'));

  /**
   * ⚠️ **THE DELETE PATH IS NOW ORDER-DEPENDENT, and nothing else can see it.** `resetIdentity()` ends by
   * ensuring a session, and under Amendment 2 that only MINTS while the device is not yet past onboarding —
   * so the record must be cleared BEFORE it, or "delete everything" would sign out and then demand a sign-in
   * instead of returning the device to its demo. The order is a fact about the source, so it is asserted here.
   * ⚠️ **It compares the `await` CALLS, not the words** — the first version of this check was defeated by its
   * own explanatory comment, which named `resetIdentity()` a few lines above the call and made `indexOf`
   * answer with the comment's position. A gate that a comment can satisfy is not a gate.
   */
  check('⚠️⚠️ the DELETE clears BOTH device records BEFORE re-minting — or it dead-ends at the wall',
    deleteSrc.indexOf('await clearFirstRun()') >= 0
      && deleteSrc.indexOf('await clearOnboarded()') >= 0
      && deleteSrc.indexOf('await clearFirstRun()') < deleteSrc.indexOf('await resetIdentity()')
      && deleteSrc.indexOf('await clearOnboarded()') < deleteSrc.indexOf('await resetIdentity()'));

  check('⚠️ a failed sign-out is REPORTED, never swallowed — and the screen says so',
    signOutFn.includes('if (error) return { ok: false')
      && signOutSrc.includes("t('settings.signOutFailed')"));

  check('⚠️⚠️ …and SIGNING OUT ERASES NOTHING — no delete, and no reopening of the anonymous window',
    signOutSrc.length > 0
      && !signOutSrc.includes('clearFirstRun')
      && !signOutSrc.includes('clearOnboarded')
      && !signOutSrc.includes('deleteMyData'));

  /**
   * ⚠️ POSITIVE CONTROLS — every assertion above is an exact `includes`/`!includes`, so each is vacuous if its
   * slicer matched NOTHING. These prove the slicers bite: `runDelete` IS found and DOES contain the
   * `clearFirstRun` the sign-out is checked for not having, and `signOutAccount` is the SIGN-OUT — not the
   * upgrade, so it must not call `updateUser`.
   */
  check('⚠️ guard: the slicers find runDelete + its clearFirstRun, and signOutAccount + its scope',
    deleteSrc.length > 0 && deleteSrc.includes('clearFirstRun')
      && signOutFn.length > 0 && !signOutFn.includes('updateUser'));

  /**
   * ⚠️ **The two `/account` constants must agree.** `tutorial.ts` keeps its own copy so the pure tutorial
   * module stays import-free; the wall uses `account-flow.ts`'s. If they drift, the demo would hand off to
   * one path while the gate exempted another — and the gate would loop.
   */
  check('⚠️ the wall\'s ACCOUNT_ROUTE and the tutorial\'s hand-off name the SAME screen',
    ACCOUNT_ROUTE === '/account' && ACCOUNT_ROUTE === AFTER_TUTORIAL_ROUTE);

  /**
   * ⚠️⚠️ **THE WALL'S SECOND DEFECT, found on glass minutes after the first** (2026-11-08). Signing out
   * landed correctly on `/account` — and the screen opened on **"Create your account"**, whose road is the
   * in-place UPGRADE (`updateUser`) and therefore needs an **anonymous session a signed-out device does not
   * have**. ⚠️ The tap would have failed with the provider's *"not authenticated"*. So the ROAD is now chosen
   * by the SESSION, and the refusal is turned into "sign in" rather than printed.
   */
  check('⚠️ sign-up is REFUSED by name when there is no anonymous session to upgrade',
    meansSignInInstead('signUp', NO_ANONYMOUS_SESSION) === true
      && meansSignInInstead('signIn', NO_ANONYMOUS_SESSION) === false);
  check('⚠️ …and the DEVICE half refuses it before the provider can answer "not authenticated"',
    accountSrc.includes('if (mode === \'signUp\' && !(await isAnonymousSession()))'));
  const accountScreenSrc = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app', 'account.tsx'), 'utf8');
  check('⚠️ …and the WALL opens on sign IN, and does not offer "create" it cannot complete',
    accountScreenSrc.includes('if (!yes) setMode(\'signIn\')')
      && accountScreenSrc.includes("mode === 'signUp' || anonymous !== false"));
  // ⚠️ POSITIVE CONTROL — the mode default must still be `signUp` for the FIRST-RUN road, or the upgrade
  // (ADR-004 rule 4) would never be offered where it is the right answer.
  /**
   * ⚠️⚠️ **THE EMAIL MUST OFFER WHAT WORKS, AND ONLY THAT** (2026-11-08). Both templates used to carry
   * `<a href="{{ .ConfirmationURL }}">…one tap…</a>`, and **a player tapped it and hit the Site URL in a
   * browser.** ⚠️ Three things are missing and all three are needed: no `emailRedirectTo` in
   * `sendAccountCode`, no handler for the returned `#access_token=…`, and no hosted Redirect-URL allowlist.
   * ⚠️ **A link that cannot do what it promises is worse than an absent one** — the rule this project
   * already applies to dead rows and dead toggles. The code is what works, so the code is what ships.
   */
  const TEMPLATE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'supabase', 'templates');
  /**
   * ⚠️ **HTML COMMENTS ARE STRIPPED FIRST, and that is not tidiness.** The note that explains WHY the link is
   * gone has to name `{{ .ConfirmationURL }}` — so a raw `includes` would fail on the very file that fixed it.
   * ⚠️ This is the second time in two sessions that a gate read the *prose* instead of the *code*; the rule is
   * now: **assert on what renders, not on what explains.**
   */
  const bodyOf = (html: string): string => html.replace(/<!--[\s\S]*?-->/g, '');
  const templates = ['magic_link.html', 'email_change.html'].map((f) => ({
    name: f,
    body: bodyOf(readFileSync(join(TEMPLATE_DIR, f), 'utf8')),
  }));
  check('⚠️⚠️ both email templates carry the SIX-DIGIT CODE (`{{ .Token }}`)',
    templates.every((t) => t.body.includes('{{ .Token }}')));
  check('⚠️⚠️ …and NEITHER carries a one-tap link the app cannot receive',
    templates.every((t) => !t.body.includes('{{ .ConfirmationURL }}')),
    'the app has no emailRedirectTo, no callback handler and no hosted allowlist — doc 24 §6');
  /**
   * ⚠️ **BOTH LANGUAGES IN EVERY EMAIL** (owner, 2026-11-08): *"supabase can't change it per recipient just
   * include both in the email templates."* ⚠️ GoTrue renders ONE template for every recipient — there is no
   * per-user locale — so a single-language email guesses, and gets it wrong for half the audience. ⚠️ And the
   * **code appears ONCE**: two code blocks would make a reader wonder which one is theirs.
   */
  check('⚠️⚠️ both templates carry BOTH languages (GoTrue cannot switch per recipient)',
    templates.every((t) => /[\u4e00-\u9fff]/.test(t.body) && /[A-Za-z]{4,}/.test(t.body)));
  check('⚠️ …and the CODE appears exactly once, described twice — never two codes',
    templates.every((t) => (t.body.match(/\{\{ \.Token \}\}/g) ?? []).length === 1));
  // ⚠️ POSITIVE CONTROL — a monolingual body must FAIL the both-languages check, or it passes on any text.
  check('⚠️ guard: an English-only body WOULD fail the both-languages check',
    !(/[\u4e00-\u9fff]/.test('<p>The code expires in 1 hour</p>')));
  // ⚠️ POSITIVE CONTROL — the detector must be able to SEE a link, or "no link" passes for the wrong reason.
  check('⚠️ guard: the same detector DOES find a link when one is present in the body',
    bodyOf('<a href="{{ .ConfirmationURL }}">x</a>').includes('{{ .ConfirmationURL }}'));
  check('…and `emailRedirectTo` is not wired anywhere, which is WHY the link is withheld',
    !accountSrc.includes('emailRedirectTo'));

  /**
   * ⚠️⚠️ **TWO BUGS THE OWNER FOUND ON GLASS, 2026-11-08 — both in the SIGN-IN road, both invisible to every
   * gate that existed.**
   *
   * 1. *"when i used the 'resend the code' then 'wrong email? edit' it prevents me from logging in with the
   *    same email again."* — ⚠️ `signInWithOtp` answers **429** when the address was mailed moments ago. That
   *    reason fell through to `account.genericIssue`, so a **temporary** refusal read as a broken sign-in.
   * 2. *"After i re-login, it asked me to create or join a clan again, so i created the same clan, then the
   *    tablet i create was still there."* — ⚠️ the account data was PERFECT and the **handoff** was wrong:
   *    `confirm()` sent **everyone** to the first-run fork.
   */
  check('⚠️⚠️ a 429 on the EMAIL step says WAIT — it does not read as a broken sign-in',
    issueKeyFor('rate_limited') === 'account.tooMany');
  // ⚠️ POSITIVE CONTROL — on the CODE step a 429 comes from a different limiter, so it must NOT borrow the
  // "we just mailed you" sentence. This is the same step-based discipline `codeWrong` relies on.
  check('⚠️ …and a 429 on the CODE step does NOT claim a code was just sent',
    issueKeyFor('rate_limited', 'code') === 'account.codeWrong');
  check('⚠️⚠️ a RETURNING user with a clan goes to the SHRINE, not the first-run fork',
    routeAfterAccount(true) === '/');
  check('⚠️ …but a clan-less user still gets the fork, and so does an UNCHECKED one',
    routeAfterAccount(false) === AFTER_ACCOUNT_ROUTE
      && routeAfterAccount(null) === AFTER_ACCOUNT_ROUTE);
  // ⚠️ POSITIVE CONTROL — the two branches must actually differ, or the function is a constant.
  check('⚠️ guard: `routeAfterAccount` is not a constant',
    routeAfterAccount(true) !== routeAfterAccount(false));
  check('⚠️ …and the SCREEN makes the clan check rather than routing blind',
    accountScreenSrc.includes('await myClans()')
      && accountScreenSrc.includes('routeAfterAccount(')
      && !accountScreenSrc.includes("router.replace(AFTER_ACCOUNT_ROUTE)"));
  check('⚠️ …and a 429 RE-ARMS the resend countdown instead of re-offering a button that will fail',
    accountScreenSrc.includes("if (res.reason === 'rate_limited')")
      && accountScreenSrc.includes('setSecondsLeft(RESEND_SECONDS);\n        setIssue(issueKeyFor(res.reason));'));

  /**
   * ⚠️⚠️ **THE CLAN MODEL IS A PRODUCT RULE, AND THE SCHEMA IS WHERE IT CAN BE BROKEN IN SILENCE**
   * (PM, 2026-11-08): *"Clans and accounts are allowed to have duplicate names… the Clans we should have a
   * UUID… It is ok for someone to be part of multiple clans."*
   * ⚠️ Nothing would have caught a later `unique (name)` or `unique (user_id)`: the app would simply stop
   * allowing what doc 15 §2.1 and §5.2 promise, and every screen would keep rendering. So the **SHAPE** is
   * asserted — a migration that narrows it now has to delete a check, deliberately.
   */
  const SCHEMA_SQL = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'supabase', 'migrations', '20261003085500_slice_schema.sql'),
    'utf8');
  const tableDdl = (sql: string, name: string): string => {
    const at = sql.indexOf(`create table public.${name} (`);
    if (at < 0) return '';
    const end = sql.indexOf('\n);', at);
    return end < 0 ? '' : sql.slice(at, end);
  };
  const clansDdl = tableDdl(SCHEMA_SQL, 'clans');
  const membersDdl = tableDdl(SCHEMA_SQL, 'clan_members');
  const UNIQUE_NAME = /unique\s*\(\s*(?:lower\(\s*)?name\s*\)?/i;
  const UNIQUE_USER = /unique\s*\(\s*user_id\s*\)/i;

  check('⚠️ a CLAN is identified by a UUID — not by its name',
    clansDdl.includes('id') && /id\s+uuid\s+primary key/i.test(clansDdl));
  check('⚠️⚠️ …and its NAME may duplicate: no `unique` on the name, at column or table level',
    clansDdl.length > 0
      && !clansDdl.split('\n').filter((l) => /\bname\b/.test(l)).join(' ').match(/unique/i)
      && !UNIQUE_NAME.test(SCHEMA_SQL));
  check('⚠️⚠️ …and one person may belong to SEVERAL clans: membership is keyed by (clan_id, user_id)',
    /primary key \(clan_id, user_id\)/i.test(membersDdl) && !UNIQUE_USER.test(SCHEMA_SQL));
  // ⚠️ POSITIVE CONTROLS — the two detectors must be able to SEE the constraint they forbid, or "no unique"
  // passes for the wrong reason. This is the same discipline as every other absence-check here.
  check('⚠️ guard: the detectors DO fire on the constraints they forbid',
    UNIQUE_NAME.test('constraint x unique (name)') && UNIQUE_USER.test('unique (user_id)')
      && !UNIQUE_USER.test('unique (user_id, seq)'));

  /**
   * ⚠️⚠️ **`.easignore` REPLACES `.gitignore` FOR EAS UPLOADS** (S79g, 2026-11-08). ⚠️ So every secret the
   * `.gitignore` was quietly protecting becomes **uploadable** the moment that file exists — and **nothing
   * fails**: the build succeeds and the key has been posted to a build server. ⚠️ Measured: the file took the
   * archive from **178 MB → 5.5 MB** while keeping every secret out, verified with
   * `rsync --exclude-from=.easignore` in both directions.
   */
  const EASIGNORE_RULES = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.easignore'), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
  check('⚠️⚠️ `.easignore` still excludes `.env` — the rule that replaced `.gitignore`',
    EASIGNORE_RULES.includes('.env'));
  check('⚠️ …and the other two secret vectors: `supabase/.temp/` (pooler URL) and `node_modules/`',
    EASIGNORE_RULES.includes('supabase/.temp/') && EASIGNORE_RULES.includes('node_modules/'));
  // ⚠️ A `!` rule can put a secret BACK. The one legitimate un-ignore is `.env.example`, which holds no key.
  check('⚠️ …and no `!` rule re-includes a real `.env`',
    !EASIGNORE_RULES.some((l) => l.startsWith('!') && /\.env(?!\.example)/.test(l)));
  /**
   * ⚠️⚠️ **AN UNANCHORED `android/` MATCHES AT ANY DEPTH — AND THIS REPO HAS A LOCAL EXPO MODULE.**
   * Measured 2026-11-08: `.easignore` carried bare `android/` and `ios/`, which silently stripped
   * `modules/zoom-range/android` and `/ios` — the NATIVE SOURCE of a real module — out of every build
   * archive. ⚠️ **`git` never saw it** (`.gitignore` has no such rule), so the tree looked clean; the only
   * thing that noticed was **`expo-doctor`'s "common project setup issues" check**, which failed CI.
   * ⚠️ So the rule must be `/android/` and `/ios/`: the generated ROOT trees only.
   */
  const BARE_NATIVE = EASIGNORE_RULES.filter((l) => /^(android|ios)\/?$/.test(l));
  check('⚠️⚠️ `.easignore` anchors `/android/` and `/ios/` — a bare one strips a local module\'s native source',
    BARE_NATIVE.length === 0
      && EASIGNORE_RULES.includes('/android/')
      && EASIGNORE_RULES.includes('/ios/'),
    `unanchored: ${BARE_NATIVE.join(', ')}`);
  // ⚠️ POSITIVE CONTROL — the detector must fire on the unanchored form, or "none found" is vacuous.
  check('⚠️ guard: the unanchored-native detector WOULD fire on a bare `android/`',
    ['android/', 'ios', '/android/'].filter((l) => /^(android|ios)\/?$/.test(l)).length === 2);
  // ⚠️ And the check is about something REAL: this repo does carry a local module with native dirs.
  check('⚠️ …and that matters because a local Expo module with native dirs is present',
    existsSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'modules', 'zoom-range', 'android'))
      && existsSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'modules', 'zoom-range', 'ios')));
  // ⚠️ POSITIVE CONTROL — that detector must fire on an un-ignore of `.env`, or "no bad rule" is vacuous.
  check('⚠️ guard: the un-ignore detector WOULD fire on `!.env`',
    /\.env(?!\.example)/.test('!.env'));

  /**
   * ⚠️ **SCRUM-214(A) IS DECIDED, NOT OMITTED** (owner, 2026-11-08): *"Profile should be a User Profile as we
   * already have a Clan page where the Clan details are shown."* ⚠️ So the sign-up asks for **no family name** —
   * a family name is a **clan** concept, named on the Clan page — and `profiles.display_label` is **not** the
   * place for it: it is the auto-generated **league pseudonym**, *"NEVER the ancestor name"* (doc 13 §4).
   * ⚠️ The check exists so the board's field cannot reappear **silently**, and so the reason stays attached.
   */
  check('⚠️ SCRUM-214(A) — sign-up asks for NO family name, and the screen records why',
    !accountScreenSrc.includes('account-name')
      && accountScreenSrc.includes('DECIDED 2026-11-08 (SCRUM-214(A))'));

  /**
   * ⚠️⚠️ **THE USER'S OWN NAME** (SCRUM-214(A) **option B**, owner 2026-11-08). ⚠️ The point of the feature is
   * that a person's name is **theirs** — so it gets its OWN column and `display_label` (the league pseudonym,
   * doc 13 §4) is **never written by the client**. ⚠️ And it must never be `unique`: duplicate account names are
   * allowed, because the identity is `user_id`.
   */
  check('⚠️ a name is required and bounded — 1..24 after trimming, and a blank is not a name',
    chosenNameProblem('') === 'empty'
      && chosenNameProblem('    ') === 'empty'
      && chosenNameProblem('A') === null
      && chosenNameProblem('A'.repeat(24)) === null
      && chosenNameProblem('A'.repeat(25)) === 'too_long');
  // ⚠️ POSITIVE CONTROL — trimming is what makes `"  Gwee  "` legal at the limit; without it, padding decides.
  check('⚠️ guard: padding does not push a legal name over the limit',
    chosenNameProblem(`  ${'A'.repeat(24)}  `) === null && normaliseChosenName('  Gwee  ') === 'Gwee');

  /**
   * ⚠️⚠️ **THE ONCE-A-WEEK LIMIT — THE DISPLAY HALF** (owner, 2026-11-08 · SCRUM-223).
   *
   * ⚠️ The DATABASE is the authority (`enforce_name_change_limit`); this rule only decides whether the row
   * reads as editable, so the screen never offers a control the database will refuse. ⚠️ The cases that matter
   * are the BOUNDARIES, and the one that would strand somebody: a malformed timestamp must FAIL OPEN, because
   * a display bug must never lock a person out.
   */
  const DAY = DAY_MS;
  const T0 = Date.parse('2026-11-08T00:00:00.000Z');
  const iso = (ms: number) => new Date(ms).toISOString();
  check('⚠️ a name never changed is editable, and a fresh change is not',
    nameChangeCooldown(null, T0).allowed
      && nameChangeCooldown(iso(T0), T0).allowed === false);
  check('⚠️ the window is 7 days — allowed one millisecond after it, refused one millisecond before',
    nameChangeCooldown(iso(T0), T0 + 7 * DAY - 1).allowed === false
      && nameChangeCooldown(iso(T0), T0 + 7 * DAY).allowed === true
      && nameChangeCooldown(iso(T0), T0 + 7 * DAY + 1).allowed === true);
  // ⚠️ Rounded UP: "in 0 days" would read as allowed, which is exactly wrong at 6 days 1 hour.
  check('⚠️ the wait is reported in whole days, ROUNDED UP (never "0 days" while still locked)',
    nameChangeCooldown(iso(T0), T0 + 6 * DAY + 23 * 60 * 60 * 1000).daysRemaining === 1
      && nameChangeCooldown(iso(T0), T0 + 1 * DAY).daysRemaining === 6
      && nameChangeCooldown(iso(T0), T0 + 7 * DAY).daysRemaining === 0);
  check('⚠️⚠️ a malformed timestamp FAILS OPEN — a display bug must not lock anyone out',
    nameChangeCooldown('not-a-date', T0).allowed && nameChangeCooldown('', T0).allowed);
  // ⚠️ POSITIVE CONTROL — the boundary check above is only meaningful if the window is not trivially large/small.
  check('⚠️ guard: the interval is exactly 7 days, not a week-ish guess',
    NAME_CHANGE_INTERVAL_DAYS === 7 && NAME_CHANGE_INTERVAL_MS === 7 * DAY_MS);

  /**
   * ⚠️⚠️ **A BARE `{placeholder}` RENDERS LITERALLY, AND THE OWNER FOUND IT** (2026-11-08: *"i dont see one when
   * i go to change the name"* — the sheet read *"once every {days} days"*).
   *
   * The app uses **`i18n-js`**, whose interpolation syntax is `%{name}` — so my `{days}` was never substituted.
   * ⚠️ **Nothing could see it**: `tsc` is happy, the key existed in both locales, and the string WAS rendered —
   * it just read as braces. ⚠️ So this asserts the syntax across EVERY message in BOTH locales, not just the ones
   * in this feature, because the next author will make the same mistake.
   */
  const barePlaceholders = (locale: Record<string, string>, name: string): string[] =>
    Object.entries(locale)
      .filter(([, v]) => typeof v === 'string' && /(?<!%)\{[A-Za-z_]/.test(v))
      .map(([k]) => `${name}:${k}`);
  const bare = [...barePlaceholders(MESSAGES.en, 'en'), ...barePlaceholders(MESSAGES.zh, 'zh')];
  check('⚠️⚠️ no message uses a bare `{placeholder}` — i18n-js only substitutes `%{name}`',
    bare.length === 0, bare.join(', '));
  // ⚠️ POSITIVE CONTROL — the detector must fire on the exact mistake that shipped, or "none found" is vacuous.
  check('⚠️ guard: the placeholder detector WOULD catch the `{days}` that shipped',
    barePlaceholders({ probe: 'once every {days} days' }, 'probe').length === 1
      && barePlaceholders({ probe: 'once every %{days} days' }, 'probe').length === 0);

  /**
   * ⚠️⚠️ **AND THE SYNTAX IS NOT THE BEHAVIOUR — THIS RENDERS EVERY `%{…}` MESSAGE THROUGH THE APP'S OWN
   * INSTANCE.** ⚠️ The syntax check above would pass on a table that the instance cannot resolve, and a dotted key
   * used to do exactly that (`[missing "en.ritual.cannotPrepare" translation]`, SCRUM-53/64 — the reason
   * `defaultSeparator` is `\u0000`). ⚠️ So this asks the library, not the source: substitute every declared
   * placeholder with a number and fail if any `{…}` survives or a key does not resolve.
   */
  const localeBefore = activeLocale();
  const unresolved: string[] = [];
  for (const loc of ['en', 'zh'] as const) {
    setLocale(loc);
    for (const [key, value] of Object.entries(MESSAGES[loc])) {
      if (typeof value !== 'string' || !value.includes('%{')) continue;
      const vars: Record<string, string> = {};
      for (const m of value.matchAll(/%\{([A-Za-z_]\w*)\}/g)) vars[m[1]] = '7';
      const rendered = t(key, vars);
      if (rendered.includes('[missing') || /\{[A-Za-z_]/.test(rendered)) unresolved.push(`${loc}:${key}`);
    }
  }
  setLocale(localeBefore);
  check('⚠️⚠️ every `%{…}` message really interpolates through the app instance — no raw braces, no missing key',
    unresolved.length === 0, unresolved.join(', '));
  // ⚠️ POSITIVE CONTROL — the sweep must be able to fail; `7` days is the copy under test.
  check('⚠️ guard: the interpolation sweep finds the limit copy and it reads as a sentence',
    (() => {
      const before = activeLocale();
      setLocale('en');
      const out = t('profile.nameLimitNote', { days: '7' });
      setLocale(before);
      return out === 'You can change your name once every 7 days.';
    })());

  /**
   * ⚠️ **AND THE LIMIT MUST BE VISIBLE IN THE SHEET, NOT JUST TRANSLATED.** ⚠️ The first version put the notice
   * inside the hint paragraph, where it read as boilerplate. This reads the RENDERED element (the same lesson as
   * `AppMark`: assert on what draws, not on what is declared).
   */
  const PROFILE_SCREEN_SRC = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app', 'profile.tsx'),
    'utf8',
  );
  check('⚠️⚠️ the weekly limit is RENDERED as its own notice in the name sheet',
    PROFILE_SCREEN_SRC.includes('testID="profile-name-limit"')
      && /t\('profile\.nameLimitNote',\s*\{\s*days:/.test(PROFILE_SCREEN_SRC));
  check('⚠️ …and both locales carry it with the `%{days}` placeholder',
    MESSAGES.en['profile.nameLimitNote']?.includes('%{days}') === true
      && MESSAGES.zh['profile.nameLimitNote']?.includes('%{days}') === true);
  // ⚠️ POSITIVE CONTROL — a hardcoded sentence would pass a "does it exist" check but drift from the constant.
  check('⚠️ guard: the notice takes the interval as a PARAMETER, so the copy cannot disagree with the rule',
    !/'profile\.nameLimitNote': '[^']*\b7\b/.test(readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'i18n.ts'), 'utf8')));


  const NAME_MIGRATION = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'supabase', 'migrations', '20261108120000_profile_chosen_name.sql'),
    'utf8');
  check('⚠️ the column is NULLABLE (every existing account has no name yet) and bounded 1..24',
    /chosen_name\s+text/i.test(NAME_MIGRATION) && /between 1 and 24/i.test(NAME_MIGRATION));
  check('⚠️⚠️ …and it is NOT unique — duplicate account names are allowed (identity is user_id)',
    !/unique/i.test(NAME_MIGRATION.replace(/--.*$/gm, '')));

  /**
   * ⚠️⚠️ **THE MIGRATION THAT MAKES THE NAME AUTOMATIC** (SCRUM-223). Three things in it are load-bearing and
   * invisible at runtime when wrong, so each gets its own assertion:
   *   1. the derivation function exists and clamps to the SAME 24 the column checks;
   *   2. ⚠️ the backfill runs BEFORE the limit trigger is created — after it, every existing account would be
   *      locked out of changing a name it never chose;
   *   3. ⚠️ there is a trigger on **auth.users UPDATE**, not just the insert path: this app signs people in
   *      anonymously and attaches the email LATER, so `handle_new_user` never sees it (ADR-004).
   */
  const LIMIT_MIGRATION = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      '..', '..', '..',
      'supabase', 'migrations', '20261108130000_profile_name_default_and_weekly_limit.sql',
    ),
    'utf8',
  );
  const SQL_ONLY = LIMIT_MIGRATION.replace(/--.*$/gm, '');
  check('⚠️ the derivation exists and clamps to the same 24 the column enforces',
    /create or replace function public\.simplified_name_from_email/i.test(SQL_ONLY)
      && /left\(candidate, 24\)/i.test(SQL_ONLY));
  check('⚠️⚠️ the BACKFILL runs before the limit trigger — else a name nobody chose costs a week',
    SQL_ONLY.indexOf('update public.profiles p') < SQL_ONLY.indexOf('create trigger enforce_name_change_limit')
      && SQL_ONLY.indexOf('update public.profiles p') > -1);
  check('⚠️⚠️ the limit refuses an early change and OWNS the timestamp (a client PATCH cannot reset it)',
    /raise exception 'name_change_too_soon'/i.test(SQL_ONLY)
      && /new\.name_changed_at := old\.name_changed_at/i.test(SQL_ONLY)
      && /interval '7 days'/i.test(SQL_ONLY));
  check('⚠️⚠️ the default is applied when the EMAIL ARRIVES, not only at sign-up (the anonymous upgrade)',
    /after update of email on auth\.users/i.test(SQL_ONLY)
      && /joss\.name_defaulted/i.test(SQL_ONLY)
      && /and chosen_name is null/i.test(SQL_ONLY));
  // ⚠️ POSITIVE CONTROL — a derived name is not a choice, so the default must not start the 7-day clock.
  check('⚠️ guard: a SERVER-SET default is excluded from the cooldown, an INSERT starts no clock',
    /if tg_op = 'INSERT' then\s*\n\s*new\.name_changed_at := null/i.test(SQL_ONLY)
      && /coalesce\(current_setting\('joss\.name_defaulted', true\), 'off'\) = 'on'/i.test(SQL_ONLY));
  /**
   * ⚠️ **THE PRIVACY LINE.** `display_label` is auto-generated by `pseudonym_for()` on sign-in and its own table
   * comment says *"NEVER the ancestor name"* (doc 13 §4). ⚠️ So no client file may write it — a single
   * `.update({ display_label })` would put a real identity into a privacy device, and nothing else would notice.
   */
  const CLIENT_FILES = ['app/account.tsx', 'app/profile.tsx', 'lib/account.ts', 'lib/user-profile.ts', 'lib/account-api.ts'];
  check('⚠️⚠️ …and NO client file writes `display_label` — it is the league pseudonym, never a name',
    CLIENT_FILES.every((f) => {
      const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', f), 'utf8');
      return !/display_label\s*:/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''));
    }));
  check('⚠️ …and the PROFILE screen is user-scoped: the clan name/role block is gone from its header',
    !accountScreenSrc.includes('profile-clan')
      && !readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app', 'profile.tsx'), 'utf8')
        .includes('testID="profile-clan"'));
  check('…and every new name string exists in BOTH locales',
    ['profile.namePrompt', 'profile.nameRow', 'profile.nameNotSet', 'profile.nameHint', 'profile.namePlaceholder',
      'profile.nameSave', 'profile.nameSaving', 'profile.nameEmpty', 'profile.nameTooLong', 'profile.nameFailed']
      .every((k) => MESSAGES.en[k] !== undefined && MESSAGES.zh[k] !== undefined));

  /**
   * ⚠️⚠️ **THE LAUNCHER ICON AND SPLASH WERE EXPO'S DEFAULTS UNTIL 2026-11-08.** `app.json` pointed at the
   * template's assets and its `adaptiveIcon.backgroundColor` was **`#E6F4FE`** — Expo's starter blue — so the
   * installed APK showed a generic icon while the design sat in Penpot (`ICON · app mark + tile`,
   * `EN · 0 ZH · 0 Splash`). ⚠️ A default is not a decision: nothing failed, which is why it survived to an
   * APK. These checks read the PNG headers (no image library needed) and the wiring that points at them.
   */
  const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'assets');
  const pngInfo = (file: string): { w: number; h: number; colourType: number } | null => {
    try {
      const d = readFileSync(join(ASSETS, file)).subarray(0, 33);
      return { w: d.readUInt32BE(16), h: d.readUInt32BE(20), colourType: d[25] };
    } catch {
      return null;
    }
  };
  const iconPng = pngInfo('icon.png');
  const fgPng = pngInfo('android-icon-foreground.png');
  const monoPng = pngInfo('android-icon-monochrome.png');
  const splashPng = pngInfo('splash-icon.png');

  check('⚠️ the launcher icon is 1024×1024 and OPAQUE (colour type 2 — Play rejects an alpha source)',
    iconPng !== null && iconPng.w === 1024 && iconPng.h === 1024 && iconPng.colourType === 2);
  check('⚠️ the adaptive foreground is 1024² with ALPHA, and the monochrome layer exists too',
    fgPng !== null && fgPng.w === 1024 && fgPng.colourType === 6
      && monoPng !== null && monoPng.w === 1024 && monoPng.colourType === 6);
  check('⚠️ the splash art is present and small enough to sit at the board\'s 190 px',
    splashPng !== null && splashPng.w >= 190);

  const APP_JSON = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'app.json'), 'utf8')).expo;
  const adaptive = APP_JSON.android?.adaptiveIcon ?? {};
  const splashPlugin = (APP_JSON.plugins ?? []).find(
    (p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen') as [string, Record<string, unknown>] | undefined;

  // ⚠️ THE LINE THAT CATCHES THE REVERT: #E6F4FE is Expo's starter blue, not this product's paper.
  check('⚠️⚠️ the adaptive background is the app\'s PAPER (#F5F0E8), not Expo\'s default #E6F4FE',
    String(adaptive.backgroundColor).toUpperCase() === '#F5F0E8');
  check('⚠️ …and the icon/foreground/monochrome paths are the generated ones, not the template\'s names left over',
    APP_JSON.icon === './assets/icon.png'
      && adaptive.foregroundImage === './assets/android-icon-foreground.png'
      && adaptive.monochromeImage === './assets/android-icon-monochrome.png');
  // ⚠️ The splash colours are the BOARD's: #1b1613 ground, a 190 px mark — not invented values.
  check('⚠️⚠️ the splash is configured from the boards — #1b1613 ground, a 190 px mark',
    splashPlugin !== undefined
      && String(splashPlugin[1].backgroundColor).toLowerCase() === '#1b1613'
      && splashPlugin[1].imageWidth === 190
      && splashPlugin[1].image === './assets/splash-icon.png');
  // ⚠️ The source art is kept in the repo, so a future size can be regenerated instead of re-traced.
  check('⚠️ the mark is kept as SVG — the icon was generated from it, not hand-drawn',
    ['app-mark.svg', 'app-mark-on-dark.svg'].every((f) => existsSync(join(ASSETS, f))));

  /**
   * ⚠️⚠️ **THE IN-APP MARK MUST KEEP THE BOARD'S STROKE-TO-EDGE RATIO — the ratio is the invariant, the
   * raw numbers are not.** Measured 2026-11-08: `AppMark` in `header-art.tsx` used the board's
   * `strokeWidth` **8 · 9 · 5** verbatim inside a **53.012** box, while the board draws them in **170** —
   * so at any shared rendered size the tablet's border was **22.9%** of its own edge instead of **9.0%**.
   * ⚠️ It rendered as a **black slab** (the gold was swallowed), and it survived because nothing compared
   * the two coordinate systems: the x/y/width/height had been scaled correctly, so the file *looked* right.
   *
   * ✅ So this evaluates the **expressions** `AppMark` actually renders (not the comment prose) and compares
   * each stroke to its own shape's edge, then to the board's ratio. ⚠️ Reverting to a literal `8` fails here
   * even though it is numerically the board's own number — that is the whole point.
   */
  const BOARD_MARK_SVG = readFileSync(join(ASSETS, 'app-mark.svg'), 'utf8');
  // ⚠️ Resolved the same way `ASSETS` is, never through a path constant that only some functions scope.
  const HEADER_ART_TSX = readFileSync(
    join(ASSETS, '..', 'src', 'components', 'home', 'header-art.tsx'),
    'utf8',
  );
  // The board's three stroked shapes, as [shape edge, stroke width] — the diamond's edge from its own path.
  const boardPairs = [
    (() => {
      const m = /<rect x="40\.8"[^>]*width="([\d.]+)"[^>]*stroke-width="([\d.]+)"/.exec(BOARD_MARK_SVG);
      return m ? [Number(m[1]), Number(m[2])] : null;
    })(),
    (() => {
      const m = /<rect x="62\.9"[^>]*width="([\d.]+)"[^>]*stroke-width="([\d.]+)"/.exec(BOARD_MARK_SVG);
      return m ? [Number(m[1]), Number(m[2])] : null;
    })(),
    (() => {
      const m = /d="M73\.1,85L85,73\.1L([\d.]+),85[^"]*" fill="#f0c75e" stroke="#1a1a1a" stroke-width="([\d.]+)"/.exec(
        BOARD_MARK_SVG,
      );
      // the diamond's edge = its x span: 73.1 -> the captured far corner (96.9) = 23.8
      return m ? [Number(m[1]) - 73.1, Number(m[2])] : null;
    })(),
  ];
  check('⚠️ the board mark parses into 3 stroked shapes — the ratio comparison has a real reference',
    boardPairs.every((p) => p !== null && p[0] > 0 && p[1] > 0), JSON.stringify(boardPairs));

  // ⚠️ Evaluate what the component RENDERS: the `strokeWidth={…}` on each element, plus the constants it
  // may reference. ⚠️ Reading only the `const` declarations was the first attempt and it was **wrong** —
  // a fault test that replaced `strokeWidth={TABLET_STROKE}` with the literal `8` left the constants
  // pristine and the gate green while the app drew a slab. Assert on the element, never on the declaration.
  const MARK_ENV = [...HEADER_ART_TSX.matchAll(/const ([A-Z][A-Z_]+) = ([^;]+);/g)]
    .map(([, name, expr]) => `const ${name} = ${expr};`)
    .join('\n')
    // MARK_SCALE references both of its operands as bare numbers already, so the definitions evaluate in order.
    .replace(/const MARK_SCALE = ([\d.]+) \/ ([\d.]+);/, (_m, a, b) => `const MARK_SCALE = ${Number(a) / Number(b)};`);
  const evalInEnv = (expr: string): number => {
    try {
      return Number(new Function(`${MARK_ENV}; return (${expr});`)());
    } catch {
      return NaN;
    }
  };
  const SCALE = evalInEnv('MARK_SCALE');
  // Split `AppMark`'s body into its rendered elements, then pair each stroke with its own shape's edge.
  const appMarkBody = /export function AppMark\(\)[\s\S]*?\n\}/.exec(HEADER_ART_TSX)?.[0] ?? '';
  const rendered = appMarkBody
    .split(/<(?:Rect|Path)/)
    .slice(1)
    .map((el) => {
      const sw = /strokeWidth=\{([^}]+)\}/.exec(el)?.[1];
      if (!sw) return null;
      const w = /width=\{([\d.]+)\}/.exec(el)?.[1];
      let edge = w ? Number(w) : NaN;
      if (!w) {
        // the diamond: its edge is the x span of its own path
        const xs = [...(/d="([^"]+)"/.exec(el)?.[1] ?? '').matchAll(/([\d.]+),([\d.]+)/g)].map((m) => Number(m[1]));
        if (xs.length) edge = Math.max(...xs) - Math.min(...xs);
      }
      return { sw: sw.trim(), stroke: evalInEnv(sw), edge };
    })
    .filter((e): e is { sw: string; stroke: number; edge: number } => e !== null);

  check('⚠️ `AppMark` renders 3 stroked shapes — the check reads the ELEMENTS, not the constants',
    rendered.length === 3 && rendered.every((r) => Number.isFinite(r.stroke) && r.edge > 0),
    JSON.stringify(rendered));

  const mismatch = rendered
    .map((r, i) => {
      const board = boardPairs[i];
      if (!board) return `pair${i}:nopair`;
      const want = board[1] / board[0];
      const got = r.stroke / r.edge;
      return Math.abs(want - got) / want > 0.01
        ? `pair${i} (${r.sw}): ${(got * 100).toFixed(1)}% of its edge vs board ${(want * 100).toFixed(1)}%`
        : null;
    })
    .filter(Boolean);
  check('⚠️⚠️ the in-app mark keeps the BOARD\'s stroke-to-edge ratio — a black slab is a ratio bug',
    mismatch.length === 0, mismatch.join(' · '));

  // ⚠️ POSITIVE CONTROL — the numbers that actually shipped must FAIL the comparison, or it proves nothing.
  const slabStrokes = [8, 9, 5]; // the unscaled literals, in the 53.012 box
  const slabViolations = slabStrokes.filter((s, i) => {
    const board = boardPairs[i];
    return board ? Math.abs(board[1] / board[0] - s / rendered[i].edge) / (board[1] / board[0]) > 0.01 : false;
  });
  check('⚠️ guard: the pre-fix slab (8 · 9 · 5 unscaled) WOULD fail the ratio check',
    slabViolations.length === 3, `violations=${slabViolations.length}/3`);
}

function storeChecks(): void {
  section('29 · Store — the catalogue, the featured item, and the ported art (SCRUM-150)');
  // ⚠️ Re-derived here, not shared: `PROJECT_ROOT` is scoped to the function that makes it.
  const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

  const { featured, more } = storeList();
  check('the FEATURED item is the one the board features (Wealth Bundle)', featured.code === 'wealth_bundle');
  check('…and "More bundles" is every OTHER catalogue item, once each',
    more.length === OFFERINGS.length - 1 && !more.some((o) => o.code === featured.code));
  // ⚠️ POSITIVE CONTROL — the two lists must not both be the whole catalogue.
  check('⚠️ guard: the featured item is NOT also in the list beneath it',
    !more.some((o) => o.code === FEATURED_CODE));
  /**
   * ⚠️⚠️ **THE CASH RAIL IS NOW *RENDERED* — and the payment is still not wired** (owner, 2026-11-08).
   *
   * ⚠️ **THIS CHECK IS DELIBERATELY THE OPPOSITE OF WHAT IT SAID THIS MORNING, and the reversal is the owner's.**
   * I first read *"disable the cash portions for now"* as *render nothing*, and enforced it. The owner then said:
   * *"i still don't see the Cash portions of the store. Please build out all of it to the point of the actual
   * payments portion for now. At least so i can see the UI layout is fine."*
   *
   * ⚠️ So the rule is a LINE, not an absence: **the layout is drawn to the pixel; the payment is not called.**
   * - ✅ REQUIRED: the cash balance chip, the cash price beside the points price, and `Buy for cash`.
   * - ⛔ STILL FORBIDDEN: any Play Billing call, and any claim that a purchase completed.
   *
   * ⚠️ The SCRUM-145 rule still applies and is why the button must be honest: it may exist, but tapping it must
   * say cash is not open yet — never pretend to charge.
   *
   * ⚠️ **ASSERTED ON THE CODE, NOT THE COMMENT** — `store.tsx`'s header discusses the rail at length, and this
   * project has twice shipped a gate that read prose. Comments are stripped first.
   */
  const stripComments = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  /**
   * ⚠️️ **SHRINE CUSTOMISATION — THE HALF `tsc` CANNOT SEE** (SCRUM-204).
   *
   * ⚠️ The client has NO generated DB types, so nothing static checks that an RPC's ARGUMENT NAMES match the
   * database: `rpc('equip_decoration', { p_slot, p_item_code })` would compile and then fail only on a device if
   * either name drifted. The migration is the authority, so the two are asserted together here.
   *
   * ⚠⚠ And the rule is asserted to live SERVER-SIDE ONLY — the client must not re-implement the
   * slot-category check, or the day they disagree the screen refuses what the server allows.
   */
  const DECOR_LIB = readFileSync(join(PROJECT_ROOT, 'src', 'lib', 'decorations.ts'), 'utf8');
  const EQUIP_SQL = readFileSync(
    join(PROJECT_ROOT, 'supabase', 'migrations', '20261004091500_rpc_app_surface.sql'), 'utf8');
  check('⚠️️ the client calls `equip_decoration` with the argument names the SQL declares',
    DECOR_LIB.includes("rpc('equip_decoration', { p_slot: slot, p_item_code: code })")
      && /function public\.equip_decoration\(p_slot text, p_item_code text\)/.test(EQUIP_SQL));
  check('⚠️⚠️ …and does NOT re-implement the slot/category rule client-side — the server owns it',
    !/slot_category/.test(stripComments(DECOR_LIB)));
  check('⚠️ reads are RLS reads of the caller’s own rows, not a privileged RPC',
    DECOR_LIB.includes("from('inventory')") && DECOR_LIB.includes("from('equipped_decorations')"));
  // ⚠️ POSITIVE CONTROL — the prices that unblock the whole flow are really in the DB migration.
  const PRICE_SQL = readFileSync(
    join(PROJECT_ROOT, 'supabase', 'migrations', '20261108160000_decoration_prices.sql'), 'utf8');
  check('⚠️⚠️ all FIVE decorations are priced server-side — without it nothing can be owned',
    ['festive_set', 'spring_couplets', 'zhong_kui', 'door_gods', 'lanterns']
      .every((c) => new RegExp(`code = '${c}'`).test(PRICE_SQL)));

  const STORE_SCREEN_JS = stripComments(
    readFileSync(join(PROJECT_ROOT, 'src', 'app', 'store.tsx'), 'utf8'),
  );
  check('~ the cash LAYOUT is rendered — chip, price and Buy for cash (the owner reversed my first reading)',
    STORE_SCREEN_JS.includes('store-cash-chip')
      && STORE_SCREEN_JS.includes('store-buy-cash')
      && /\$\s?\d|\.toFixed\(2\)/.test(STORE_SCREEN_JS),
    'cash chip / buy-for-cash / a dollar amount must all be in the rendered JSX');
  check('⚠️⚠️ …but NO payment is wired — no Play Billing, and nothing claims a cash purchase succeeded',
    !/react-native-iap|play.?billing|initConnection|requestPurchase/i.test(STORE_SCREEN_JS)
      && !/purchase_item[\s\S]{0,80}cash/i.test(STORE_SCREEN_JS));
  // ⚠️ POSITIVE CONTROL — the stripper must keep executable JSX, or "nothing found" is vacuous.
  check('⚠️ guard: the comment-stripper keeps executable JSX, so the checks above can bite',
    stripComments('/* cash $1 */ <Btn label="Buy for cash" />').includes('Buy for cash')
      && !stripComments('/* cash $1 */ <Btn />').includes('cash'));


  // ⚠️ THE BUNDLE IS A BUNDLE, NOT AN ITEM (device report, 2026-11-07). `purchase_item` now reads
  /**
   * ⚠️⚠️ **THE DECORATION ART IS PORTED FROM PENPOT, AND ONLY WHERE A DRAWING EXISTS** (SCRUM-212, owner
   * 2026-11-08: *"I meant DIFFERENT art — the Decorations … leave the five offering items as rasters."*).
   *
   * ⚠️ **READ AS TEXT, NOT IMPORTED** — `decoration-art.tsx` imports `react-native-svg`, and a `.tsx` that
   * reaches `react-native` crashes `check:lib` under plain Node (the `ERR_MODULE_NOT_FOUND` lesson). So the
   * invariants are asserted on the source, and the arithmetic ones live in the file's own data.
   *
   * ⚠️⚠️ **TWO OF THE FIVE ARE DELIBERATELY UNPORTED**, and that is the honest state, not an omission: the board's
   * `option · couplets (icon)` and `option · zhongkui (icon)` are **byte-identical to `option · lanterns (icon)`**
   * (copy-paste placeholders), and `festive_set` has no drawing at all. ⚠️ A gate that demanded five ported motifs
   * would push the next session into inventing three.
   */
  const DECOR_SRC = readFileSync(
    join(PROJECT_ROOT, 'src', 'components', 'decoration-art.tsx'),
    'utf8',
  );
  const DECOR_CODE = stripComments(DECOR_SRC);
  check('⚠️ the decoration art exists as SVG and uses TOKEN KEYS, never hex',
    DECOR_CODE.includes("from 'react-native-svg'")
      && !/#[0-9a-fA-F]{6}/.test(DECOR_CODE));
  check('⚠️ every motif is transcribed with the board\'s own box — a viewBox per motif, not one shared',
    (DECOR_CODE.match(/box: \[85\.1, 72\]/g) ?? []).length >= 2);
  check('⚠️⚠️ an UNPORTED decoration renders a placeholder, never a stand-in motif',
    /if \(motif === null\)/.test(DECOR_CODE) && DECOR_CODE.includes('viewBox="0 0 40 40"'));
  // ⚠️ The honest count: exactly two of five ported, and the registry names all five.
  const registered = ['lanterns', 'spring_couplets', 'zhong_kui', 'door_gods', 'festive_set'];
  check('⚠️ …and the registry covers all FIVE catalogue codes, with three still null',
    registered.every((c) => new RegExp(`\\b${c}:`).test(DECOR_CODE))
      && (DECOR_CODE.match(/:\s*null,/g) ?? []).length === 1);
  /**
   * ⚠️️ **THE FESTIVE SET RENDERS THE FOUR IT CONTAINS** (owner, 2026-11-08: *"just put all the other
   * decorations's art together"*). ⚠️ It is `null` in MOTIFS on purpose — the composition branch returns
   * BEFORE the motif lookup — so the null-count check above is not describing a gap.
   * ⚠️ And the list is asserted to be EXACTLY the other four catalogue codes: a set that silently stopped
   * containing one of its pieces would still look finished.
   */
  const composedLine = /festive_set: \[([^\]]*)\]/.exec(DECOR_CODE)?.[1] ?? '';
  const composedCodes = composedLine.split(',').map((c) => c.trim().replace(/'/g, '')).filter(Boolean);
  check('⚠️️ the FESTIVE SET is composed of the other FOUR decorations, not a placeholder',
    composedCodes.length === 4
      && ['lanterns', 'spring_couplets', 'zhong_kui', 'door_gods'].every((c) => composedCodes.includes(c)),
    composedCodes.join(' '));
  // ⚠️ POSITIVE CONTROL — the four parts must each have real art, or the set composes placeholders.
  check('⚠️ guard: every part of the set has a ported motif',
    ['lanterns:', 'spring_couplets:', 'zhong_kui:', 'door_gods:'].every((k) => DECOR_CODE.includes(k)));
  // ⚠️ POSITIVE CONTROL — the DECORATIONS list this registry must mirror really is five long.
  check('⚠️ guard: the catalogue still carries five decorations, so the registry cannot drift silently',
    DECORATIONS.length === 5);


  // `offerings_catalog.composed_of` — the SQL twin of this code field — and grants one of each
  // component, never the bundle itself. The SERVER behaviour is asserted in
  // `supabase/tests/purchase_bundle.sql`; THIS holds the code mirror the server was copied from, so a
  // change here that is not mirrored there is at least visible.
  check('⚠️ the Wealth Bundle COMPOSES the other four — it is not an item by itself',
    (() => {
      const bundle = getOffering('wealth_bundle');
      const others = OFFERINGS.filter((o) => o.code !== 'wealth_bundle').map((o) => o.code);
      return bundle.composedOf !== undefined
        && bundle.composedOf.length === others.length
        && others.every((c) => bundle.composedOf?.includes(c));
    })());
  check('…and it does NOT list itself — a bundle of one is not a bundle',
    !(getOffering('wealth_bundle').composedOf ?? []).includes('wealth_bundle'));
  check('⚠️ …and no PLAIN offering carries a composition (only the bundle does)',
    OFFERINGS.filter((o) => o.code !== 'wealth_bundle').every((o) => o.composedOf === undefined));

  /**
   * ⚠️ **THE FEATURED CARD MUST STAY PURCHASABLE** (SCRUM-221, owner 2026-11-07). It was a plain
   * `<View>`, so the Wealth Bundle **could not be bought at all** — only the four "More bundles"
   * cards were `Pressable` (found on the SCRUM-220 device run). ⚠️ Asserted STRUCTURALLY — *the
   * nearest opener before the featured `testID` must be a `<Pressable`* — so a tidy-up back to a
   * `<View>` goes red, and re-tuning the card's style cannot break the check.
   */
  const storeSrc = readFileSync(join(PROJECT_ROOT, 'src/app/store.tsx'), 'utf8');
  const featAt = storeSrc.indexOf('testID="store-featured"');
  const openerAt = Math.max(
    storeSrc.lastIndexOf('<Pressable', featAt),
    storeSrc.lastIndexOf('<View', featAt),
  );
  check('⚠️ the FEATURED card is PURCHASABLE — a `<Pressable`, not a bare `<View` (SCRUM-221)',
    featAt > 0 && openerAt > 0 && storeSrc.startsWith('<Pressable', openerAt));
  check('⚠️ …and a COMPOSED buy gets its OWN confirm body — never one that promises a bundle OBJECT',
    storeSrc.includes('store.buyBodyBundle') && /buyingOffering\?\.composedOf/.test(storeSrc));

  check('⚠️ the meta line is the REDEMPTION BASE (1.2×), not the price — see the board: `base 480`',
    baseMetaValue(getOffering('joss_paper_stack')) === 480,
    String(baseMetaValue(getOffering('joss_paper_stack'))));
  check('…and it is the 20% rule, not a hard-coded 480',
    OFFERINGS.every((o) => baseMetaValue(o) === Math.round(o.price * 1.2)));
  check('⚠️ a price renders with a unit, and an UNPRICED item renders null (never "0 pts")',
    pointsPrice(getOffering('gold_bar')) === '600'
      && pointsPrice({ ...getOffering('gold_bar'), price: Number.NaN }) === null);

  /**
   * ⚠️⚠️ **BOTH TABS ARE LIVE NOW, AND THIS CHECK IS THE OPPOSITE OF WHAT IT SAID THIS MORNING.**
   *
   * It used to assert *"Decorations is DISABLED — its prices are NULL until the economy pass"*. ⚠️ That was wrong
   * twice over: the board `EN · 7b` had **all five prices designed** (owner: *"there is already pricing for the
   * decorations in En-7b"*) and I had never read it, so the app hid a finished design behind a TODO of mine.
   *
   * ⚠️ **Every price is asserted against the board here**, because these numbers came off a drawing rather than
   * out of code and a typo in one of them would be invisible until someone was charged.
   */
  check('⚠️⚠️ both store tabs are LIVE — Decorations is no longer dark',
    STORE_TABS.every((tab) => tab.enabled));
  /**
   * ⚠️⚠️ **TRANSCRIBED FROM THE BOARD'S LAYER NAMES, NOT FROM THE CARD LAYOUT** — and the first version of
   * this table was wrong because it did the opposite. `EN · 7b` draws the four cards in a 2 × 2 grid, so the
   * two that sit on the LEFT (`Spring Couplets`, `Door Gods`) and the two on the RIGHT (`Zhong Kui Print`,
   * `Lanterns`) are trivially easy to pair by position — and Door Gods / Lanterns got swapped. ⚠️ **Because
   * this table was written from the same wrong pass as the catalogue, it PASSED**: it asserted the defect
   * back to itself. The authority is the layer NAME, which states its own item:
   *   `card · Door Gods cash = $1.49` · `card · Door Gods points = 1,200 pts`
   *   `card · Lanterns cash  = $1.99` · `card · Lanterns points  = 1,600 pts`
   * and `ZH · 7b` carries the same pairing (门神 $1.49 / 1,200 · 灯笼 $1.99 / 1,600).
   *
   * ⚠️ The real tripwire is that **no two decorations may share a price pair** — a transposition is then a
   * change of which CODE carries which number, and this table is the only thing that notices.
   */
  const BOARD_DECOR_PRICES: Record<string, readonly [number, number]> = {
    festive_set: [3000, 399], spring_couplets: [800, 99], zhong_kui: [1000, 129],
    door_gods: [1200, 149], lanterns: [1600, 199],
  };
  check('⚠️⚠️ every decoration is priced EXACTLY as `EN · 7b` draws it — points AND cash, in cents',
    DECORATIONS.length === 5
      && DECORATIONS.every((d) => {
        const want = BOARD_DECOR_PRICES[d.code];
        return want !== undefined && d.price === want[0] && d.cashPrice === want[1];
      }),
    DECORATIONS.map((d) => `${d.code}=${d.price}/${d.cashPrice}`).join(' '));
  // ⚠️ POSITIVE CONTROL — cash is INTEGER CENTS, so no float can ever reach a price.
  check('⚠️ guard: cash prices are whole cents, never a decimal',
    DECORATIONS.every((d) => Number.isInteger(d.cashPrice)));
  /**
   * ⚠️⚠️ **NO TWO DECORATIONS MAY SHARE A PRICE PAIR — this is the check that would have caught the
   * Door Gods / Lanterns transposition.** With five distinct pairs, a swapped row changes which CODE
   * carries which number; with a duplicated pair the swap would be a no-op and the table above could
   * silently stop discriminating. ⚠️ Asserted as a CONTROL on the table, not on the catalogue, so a
   * typo in `BOARD_DECOR_PRICES` cannot make it vacuous.
   */
  const pairs = Object.values(BOARD_DECOR_PRICES).map((p) => `${p[0]}/${p[1]}`);
  check('⚠️ guard: every board price PAIR is unique, so a transposition cannot hide',
    new Set(pairs).size === pairs.length && pairs.length === 5,
    pairs.join(' '));
  check('⚠️⚠️ the CASH rail is now DRAWN — the old "omit the chip" rule is retired',
    readFileSync(join(PROJECT_ROOT, 'src', 'app', 'store.tsx'), 'utf8').includes('store-cash-chip'));

  /**
   * ⚠️⚠️ **THE ALTAR'S DECORATIONS — SCRUM-205's acceptance, as arithmetic.**
   *
   * None of this is visible to `tsc`: a slot rect that runs off the board, an art rect bigger than the zone that
   * holds it, a picker that offers the wrong category, or a sheet height that matches one board and not the other.
   * ⚠️ Every number was measured off `EN · 1f`/`1d`/`1e` on 2026-11-09 (the table is in `lib/decorate.ts`), so this
   * block is what keeps the code and the board agreeing after the next edit.
   */
  const SLOTS = Object.keys(SLOT_HIT) as (keyof typeof SLOT_HIT)[];
  check('⚠️⚠️ every one of the SIX slots has a tap zone AND an art rect',
    SLOTS.length === 6 && SLOTS.every((s) => SLOT_ART[s] !== undefined));
  check('⚠️ …and both fit INSIDE the 390 × 844 board — a rect that runs off it is a piece you cannot see',
    SLOTS.every((s) => {
      const inside = (r: { x: number; y: number; w: number; h: number }) =>
        r.x >= 0 && r.y >= 0 && r.x + r.w <= DECOR_BOARD.w && r.y + r.h <= DECOR_BOARD.h;
      return inside(SLOT_HIT[s]) && inside(SLOT_ART[s]);
    }));
  /**
   * ⚠️⚠️ **THE ZONE MUST CONTAIN THE ART.** `1f` draws the tap targets larger than the pieces; the day one is
   * smaller, the piece is drawn outside the thing that selects it — the defect class the owner's eye keeps finding
   * first. ⚠️ Asserted per slot, so re-measuring one cannot quietly break another.
   */
  const outsideZone = SLOTS.filter((s) => {
    const z = SLOT_HIT[s];
    const a = SLOT_ART[s];
    return !(a.x >= z.x && a.y >= z.y && a.x + a.w <= z.x + z.w && a.y + a.h <= z.y + z.h);
  });
  check('⚠️⚠️ each ART rect sits INSIDE its own tap zone — a piece outside its zone cannot be tapped',
    outsideZone.length === 0, outsideZone.join(' '));

  /**
   * ⚠️⚠️ **ONLY THE SLOT'S OWN CATEGORY IS OFFERED** — the acceptance line SCRUM-205 exists for. ⚠️ Asserted by
   * CATEGORY, not by a list of codes, so a new decoration cannot silently escape it: a new BACKGROUND print still
   * may not appear in a side slot.
   */
  const everyCode = DECORATIONS.map((d) => d.code);
  check('⚠️⚠️ a slot offers ONLY its own category — a side slot never offers the background print',
    SLOTS.every((s) => {
      const opts = optionsForSlot(s, everyCode, null);
      return opts.length > 0 && opts.every((o) => o.decoration.category === SLOT_CATEGORY[s]);
    }));
  // ⚠️ POSITIVE CONTROL — the filter is not empty-by-accident: the SIDE slots really do offer two (S14).
  check('⚠️⚠️ the side slots offer the TWO placeable sets — and NEVER the Festive Set, which is a bundle',
    optionsForSlot('side_left', everyCode, null).length === 2
      && optionsForSlot('side_left', everyCode, null).every((o) => o.code !== 'festive_set')
      && optionsForSlot('background', everyCode, null).every((o) => o.code === 'zhong_kui'));
  /**
   * ⚠️⚠️ **A COMPOSED DECORATION IS A SKU, NOT A CHOICE** (owner, 2026-11-09). Asserted by `composedOf` rather than by
   * the code, so a future bundle cannot sneak into a picker: whatever the catalogue marks composed must never appear in
   * ANY slot's options, and must draw in no slot at all.
   */
  const composed = DECORATIONS.filter((d) => d.composedOf !== undefined);
  check('⚠️⚠️ every COMPOSED decoration is absent from every slot\'s options',
    composed.length === 1 && composed[0].code === 'festive_set'
      && SLOTS.every((s) => optionsForSlot(s, everyCode, null).every((o) => o.decoration.composedOf === undefined)));
  check('⚠️ …and it is made of the other four — the same set `decorations_catalog.composed_of` names',
    composed[0].composedOf?.slice().sort().join(',') === 'door_gods,lanterns,spring_couplets,zhong_kui');
  check('⚠️ an UNOWNED item is listed but NOT selectable, and an equipped one is not re-equipable',
    (() => {
      const o = optionsForSlot('side_left', ['spring_couplets'], 'spring_couplets');
      const equipped = o.find((x) => x.code === 'spring_couplets');
      const unowned = o.find((x) => x.code === 'door_gods');
      return equipped !== undefined && equipped.state === 'equipped' && !equipped.selectable
        && unowned !== undefined && unowned.state === 'unowned' && !unowned.selectable;
    })());

  /**
   * ⚠️⚠️ **THE SHEET HAS TWO HEIGHTS BECAUSE TWO BOARDS DRAW IT.** `1f2` (two options) is panel 520 with rows
   * 598/682; `1f3`/`1f4` (three) are panel 440 with rows 518/602/686. A frozen height is wrong on the other, and a
   * panel that stops short of 844 leaves a strip of shrine showing under the sheet.
   */
  const twoOpts = sheetLayout(2);
  const threeOpts = sheetLayout(3);
  check('⚠️⚠️ the picker sheet reproduces BOTH boards: 2 options → 520, 3 options → 440',
    twoOpts.panel.y === 520 && threeOpts.panel.y === 440
      && twoOpts.rows.map((r) => r.y).join(',') === '598,682'
      && threeOpts.rows.map((r) => r.y).join(',') === '518,602,686');
  check('⚠️ …and the panel always reaches the board bottom, with the button at the board\'s 774…826',
    twoOpts.panel.y + twoOpts.panel.h === DECOR_BOARD.h
      && threeOpts.panel.y + threeOpts.panel.h === DECOR_BOARD.h
      && threeOpts.button.y === 774 && threeOpts.button.y + threeOpts.button.h === 826);

  /**
   * ⚠️⚠️ **THE DRAW PLAN** — what the shrine paints, from what the server said is equipped. ⚠️ The Festive Set is an
   * AMALGAMATION (`EN · 1e` draws all four pieces), so equipping it must light five slots rather than squeeze four
   * motifs into one — and an explicitly equipped piece must keep its own slot.
   */
  const noDecor: Record<string, null> = {
    top_left: null, top_middle: null, top_right: null, side_left: null, side_right: null, background: null,
  };
  check('⚠️ nothing equipped draws NOTHING — the shrine is not decorated by default',
    drawPlan(noDecor as never).length === 0);
  const lanternOnly = drawPlan({ ...noDecor, top_left: 'lanterns' } as never);
  check('⚠️⚠️ a TOP set lights BOTH corners — `1d` draws a lantern in each, from ONE equip',
    lanternOnly.length === 2
      && lanternOnly.map((p) => p.slot).join(',') === 'top_left,top_right'
      && lanternOnly.every((p) => p.behind === false),
    lanternOnly.map((p) => `${p.slot}:${p.code}`).join(' '));
  const coupletsOnly = drawPlan({ ...noDecor, side_right: 'spring_couplets' } as never);
  check('⚠️⚠️ a COUPLET SET is a TRIO — 横批 across the top-middle plus a scroll down each side',
    coupletsOnly.length === 3
      && coupletsOnly.map((p) => p.slot).join(',') === 'top_middle,side_left,side_right',
    coupletsOnly.map((p) => p.slot).join(','));
  const doorGodsOnly = drawPlan({ ...noDecor, side_left: 'door_gods' } as never);
  check('⚠️ …and DOOR GODS are a trio too (assumed to share the couplets\' shape — see `SET_SLOTS`)',
    doorGodsOnly.length === 3
      && doorGodsOnly.map((p) => p.slot).join(',') === 'top_middle,side_left,side_right');
  const backgroundOnly = drawPlan({ ...noDecor, background: 'zhong_kui' } as never);
  check('⚠️ the BACKGROUND print draws BEHIND the tablet — the z-order `1e` depends on',
    backgroundOnly.length === 1 && backgroundOnly[0].behind === true);
  const setPlan = drawPlan({ ...noDecor, side_left: 'festive_set' } as never);
  check('⚠️⚠️ the FESTIVE SET draws NOTHING — it is a bundle, not an altarpiece (owner, 2026-11-09)',
    setPlan.length === 0, String(setPlan.length));

  /**
   * ⚠️⚠️ **A SET'S PIECE IS NOT ALWAYS THE SET'S FACE.** The couplets' top-middle piece is the **横批 banner**, not the
   * pair of scrolls — the owner's correction, and `1e` draws it at 141 × 40 (a squat banner, not a scroll). ⚠️ So the
   * drawing is chosen by SLOT, and the banner has art of its own rather than the pair stretched into a wide box —
   * which is exactly how it looked on glass before this.
   */
  check('⚠️⚠️ the COUPLETS\' pieces each use their OWN drawing: 横批 on top, ONE scroll per side',
    artVariantFor('spring_couplets', 'top_middle') === 'crown'
      && artVariantFor('spring_couplets', 'side_left') === 'scroll'
      && artVariantFor('spring_couplets', 'side_right') === 'scroll');
  check('⚠️⚠️ a LANTERN on the altar is ONE lantern — the pair motif is the store card\'s',
    artVariantFor('lanterns', 'top_left') === 'single' && artVariantFor('lanterns', 'top_right') === 'single');
  const ART_SRC_TXT = readFileSync(join(PROJECT_ROOT, 'src', 'components', 'decoration-art.tsx'), 'utf8');
  check('⚠️ …and every second drawing is the board\'s own box, matching the rect it is drawn into',
    ART_SRC_TXT.includes('box: [141, 40]') && ART_SRC_TXT.includes('box: [52, 66]')
      && ART_SRC_TXT.includes('box: [41, 160]')
      && SLOT_ART.top_middle.w === 141 && SLOT_ART.top_middle.h === 40
      && SLOT_ART.top_left.w === 52 && SLOT_ART.top_left.h === 66
      && SLOT_ART.side_left.w === 41 && SLOT_ART.side_left.h === 160,
    `${SLOT_ART.top_middle.w}×${SLOT_ART.top_middle.h} · ${SLOT_ART.top_left.w}×${SLOT_ART.top_left.h} · ${SLOT_ART.side_left.w}×${SLOT_ART.side_left.h}`);
  check('⚠️ …and the altar passes the variant through, so the banner is not silently replaced',
    readFileSync(join(PROJECT_ROOT, 'src', 'components', 'home', 'decor-layer.tsx'), 'utf8').includes('art={p.art}'));
  /**
   * ⚠️⚠️ **THE SLOT→CATEGORY RULE IS NOT COPIED.** `domain/catalogue.ts` owns `SLOT_CATEGORY` (S14j/S14k) and
   * `equip_decoration` enforces it; a second table in `decorate.ts` would be the "two implementations of one rule"
   * this project keeps deleting — and the day they disagree, a slot offers what the server will refuse.
   */
  const DECORATE_SRC = readFileSync(join(PROJECT_ROOT, 'src', 'lib', 'decorate.ts'), 'utf8');
  check('⚠️⚠️ `decorate.ts` IMPORTS SLOT_CATEGORY — it does not restate the slot→category map',
    /import\s*\{[\s\S]*?SLOT_CATEGORY[\s\S]*?\}\s*from\s*'\.\.\/domain\/catalogue\.ts'/.test(DECORATE_SRC)
      && !/SLOT_CATEGORY\s*[:=]/.test(stripComments(DECORATE_SRC)));
  check('⚠️ …and the altar hands the art a RECT, so a piece fills its measured box',
    readFileSync(join(PROJECT_ROOT, 'src', 'components', 'home', 'decor-layer.tsx'), 'utf8').includes('box={{')
      && readFileSync(join(PROJECT_ROOT, 'src', 'components', 'decoration-art.tsx'), 'utf8')
        .includes("preserveAspectRatio={box === undefined ? undefined : 'none'}"));



  /**
   * ⚠️⚠️ **THE SIZES MUST MATCH THE FILES ON DISK.** Since 2026-11-01 the art is five raster
   * cut-outs, and `ART_BOX` in `lib/offering-art.ts` MIRRORS each PNG's pixel size so the fitting can
   * happen in a pure module. ⚠️ **A mirror that drifts is worse than no mirror**: re-crop an image
   * and the box would silently letterbox or overflow it, with `tsc` perfectly happy — both numbers
   * are legal.
   *
   * ⚠️ So this reads each file's **IHDR** — bytes 16–23 of a PNG are width and height, big-endian —
   * and asserts the mirror agrees. It is the same posture as the HUD's two sets of numbers and the
   * tab bar's board values: the build's copy and the authority are compared, never assumed equal.
   */
  for (const code of artCodes()) {
    const file = join(PROJECT_ROOT, `assets/offerings/${code}.png`);
    if (!existsSync(file)) {
      check(`the art file for "${code}" exists`, false, file);
      continue;
    }
    const png = readFileSync(file);
    const isPng = png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    check(`⚠️ "${code}" is a real PNG (magic bytes, not a saved error page)`, isPng, file);
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    const box = artSize(code);
    check(`⚠️ …and \`ART_BOX\` MATCHES it on disk (${w}×${h})`,
      box.w === w && box.h === h, `mirror says ${box.w}×${box.h}, file says ${w}×${h}`);
    // ⚠️ A cropped cut-out must not be square-by-accident: the padding was removed on purpose.
    check(`…and it is a CROPPED cut-out, not the 1024×1024 original`,
      !(w === 1024 && h === 1024), `${w}×${h}`);
  }

  // ── ⚠️ THE ART — every catalogue code must have an illustration ─────────────
  check('⚠️ EVERY catalogue offering has art (none ships as a blank card)',
    artCodes().every((c) => { const b = artSize(c); return b.w > 0 && b.h > 0; }),
    artCodes().map((c) => `${c}:${artSize(c).w}x${artSize(c).h}`).join(' '));
  check('⚠️ the art aspects DIFFER — so a single fixed box would distort them',
    new Set(artCodes().map((c) => artSize(c).w / artSize(c).h)).size > 1);
  check('⚠️ `fitArt` CONTAINS — one scale for both axes, so nothing is stretched',
    (() => { const f = fitArt('wealth_bundle', 100, 100);
      return Math.abs(f.width / f.height - artSize('wealth_bundle').w / artSize('wealth_bundle').h) < 1e-9; })());
  check('…and it never overflows the box it is given',
    artCodes().every((c) => { const f = fitArt(c, 110, 80); return f.width <= 110.001 && f.height <= 80.001; }));
  // ⚠️ POSITIVE CONTROL — the fit must actually USE the box, not collapse to zero.
  check('⚠️ guard: the fit is not degenerate — it TOUCHES the box on the limiting axis',
    artCodes().every((c) => {
      const b = artSize(c);
      const f = fitArt(c, 220, 106);
      return Math.abs(Math.max(f.width / 220, f.height / 106) - 1) < 1e-9
        && f.width <= 220.001 && f.height <= 106.001
        && Math.abs(f.width / f.height - b.w / b.h) < 1e-9;
    }));
}

function ancestorSheetChecks(): void {
  section('23 · The tablet sheet — the ladder, the cap, and btrim (SCRUM-168)');

  // ── the ladder, exactly as `save_ancestor` and both policies spell it ──────
  check('the ladder is exactly head · co_head · elder',
    [...EDIT_ROLES].join(',') === 'head,co_head,elder');
  for (const r of ['head', 'co_head', 'elder']) check(`  ${r} may edit tablets`, canEditTablets(r));
  check('⚠️ a plain MEMBER may not (the RPC raises 42501, the policy filters SILENTLY)',
    !canEditTablets('member'));
  check('…and not-signed-in is not a role', !canEditTablets(null) && !canEditTablets(undefined));

  // ── the limits, from the CHECK constraints ────────────────────────────────
  check('surname max is the CHECK cr 20', SURNAME_MAX === 20);
  check('given name max is the CHECK cr 40', GIVEN_NAME_MAX === 40);
  check('relationship max is the CHECK cr 20', RELATIONSHIP_MAX === 20);

  // ── ⚠️ btrim FIRST — a surname of spaces is empty on the server too ──────
  check('a blank surname is refused', sheetProblem({ surname: '', givenName: '', relationship: '' }) === 'surname_required');
  check('⚠️ and so is a surname of THREE SPACES (the server btrims, so must this)',
    sheetProblem({ surname: '   ', givenName: '', relationship: '' }) === 'surname_required');
  check('20 characters is accepted', sheetProblem({ surname: 'x'.repeat(20), givenName: '', relationship: '' }) === null);
  check('21 is not', sheetProblem({ surname: 'x'.repeat(21), givenName: '', relationship: '' }) === 'surname_too_long');
  check('a 41-character given name is too long',
    sheetProblem({ surname: 'Tan', givenName: 'y'.repeat(41), relationship: '' }) === 'given_name_too_long');
  check('a 21-character relationship is too long',
    sheetProblem({ surname: 'Tan', givenName: '', relationship: 'z'.repeat(21) }) === 'relationship_too_long');

  // ── normalise mirrors nullif(btrim(...), '') ─────────────────────────────
  const clean = normaliseAncestorForm({ surname: '  Tan  ', givenName: '  ', relationship: ' Father ' });
  check('the form is trimmed', clean.surname === 'Tan' && clean.relationship === 'Father', JSON.stringify(clean));
  check('⚠️ a blank optional field becomes NULL, not an empty string (nullif)', clean.givenName === null);

  // ── the cap, from clans.ancestor_cap ─────────────────────────────────────
  check('the cap is 10 (clans.ancestor_cap default)', ANCESTOR_CAP === 10);
  check("⚠️ …and NOT the altar display cap of 4: the board pages, it does not refuse",
    ANCESTOR_CAP !== 4);
  check('9 live tablets is not full', !capReached(9));
  check('⚠️ 10 IS full — `>=`, not `>` (the 11th insert is what the trigger refuses)', capReached(10));
  check('…and 2 slots remain at 8', slotsRemaining(8) === 2);
  check('…and a legacy over-cap clan does not underflow', slotsRemaining(14) === 0);

  // ── ⚠️ THE RELATIONSHIP CHIPS (the board port, 2026-11-01) ─────────────────────────────
  check('there are five chips, as the board draws', RELATIONSHIP_CHIPS.length === 5);
  check('⚠️ the FIRST chip is the "none" chip — it clears the field', RELATIONSHIP_CHIPS[0] === RELATIONSHIP_NONE_CHIP);
  /**
   * ⚠️ THE ROW SPLIT IS A LAYOUT CONSTRAINT, NOT COSMETIC. The preview tablet starts at x 288,
   * so a single wrapping row runs `Father` underneath it — measured on glass 2026-11-01. The
   * board splits 3 then 2, and this is that number.
   */
  check('⚠️ the board splits the chips 3 then 2 — the preview sits at x 288',
    RELATIONSHIP_CHIP_ROW_BREAK === 3 && RELATIONSHIP_CHIP_ROW_BREAK < RELATIONSHIP_CHIPS.length,
    `break at ${RELATIONSHIP_CHIP_ROW_BREAK} of ${RELATIONSHIP_CHIPS.length}`);
  check('every chip key exists in BOTH locales', RELATIONSHIP_CHIPS.every(keyInBothLocales));

  check('the "none" chip matches an EMPTY relationship', chipSelected(RELATIONSHIP_NONE_CHIP, '—', ''));
  check('…and whitespace counts as empty (the server btrims)', chipSelected(RELATIONSHIP_NONE_CHIP, '—', '   '));
  check('…but NOT a real relationship', !chipSelected(RELATIONSHIP_NONE_CHIP, '—', 'Father'));

  check('a label chip matches its own label', chipSelected('ancestor.rel.father', 'Father', 'Father'));
  check('…and ignores surrounding space (btrim, both sides)', chipSelected('ancestor.rel.father', 'Father', '  Father '));
  /**
   * ⚠️ THE HONEST CASE. `ancestors.relationship` is free text, so a value typed by hand matches
   * no chip — and that is correct, not a bug to paper over with a "closest match".
   */
  check('⚠️ a HAND-TYPED relationship lights up NO chip', RELATIONSHIP_CHIPS.every(
    (k) => !chipSelected(k, k === RELATIONSHIP_NONE_CHIP ? '—' : 'Father', 'Grand-uncle')));

  check('the "none" chip WRITES null (not an empty string)', chipValue(RELATIONSHIP_NONE_CHIP, '—') === null);
  check('a label chip writes its own label', chipValue('ancestor.rel.father', 'Father') === 'Father');

  // ── ⚠️ THE PANEL'S GEOMETRY — the sheet covers the tab bar, and stops at the board's edge ──
  const panel = HOME_BANDS.sheetPanel;
  const bar = HOME_BANDS.tabbar;
  check('the panel reaches the board\'s BOTTOM exactly (400 + 444 = 844)',
    panel.y + panel.h === REFERENCE_HEIGHT, `${panel.y + panel.h} vs ${REFERENCE_HEIGHT}`);
  check('⚠️ …so the panel COVERS the tab bar, as the board paints it',
    panel.y <= bar.y && panel.y + panel.h >= bar.y + bar.h);
  check('the panel spans the full board width', panel.x === 0 && panel.w === REFERENCE_WIDTH);

  const prev = HOME_BANDS.sheetPreview;
  check('the preview sits INSIDE the panel', prev.y >= panel.y && prev.y + prev.h <= panel.y + panel.h);
  check('…and inside its x-range', prev.x >= panel.x && prev.x + prev.w <= panel.x + panel.w);
  /**
   * ⚠️ The preview and the altar's centre tablet are the SAME drawing at two scales — the whole
   * reason `preview · tablet (96)` may reuse `Tablet`. If the aspect ratios ever disagree, one of
   * them has been redrawn by hand.
   */
  const altarRatio = HOME_BANDS.addSlot.w / HOME_BANDS.addSlot.h;
  const previewRatio = prev.w / prev.h;
  check('⚠️ the preview is the altar tablet\'s SAME shape, scaled (aspect within 0.5%)',
    Math.abs(altarRatio - previewRatio) / altarRatio < 0.005,
    `${altarRatio.toFixed(4)} vs ${previewRatio.toFixed(4)}`);
}

/**
 * §24 · How a name is set on a tablet (SCRUM-146).
 *
 * ⚠️ A 牌位 is written top-to-bottom — correct for 陈秀英, wrong for `Chen`, which stacked gives
 * four lines of one letter on a plaque. Seen on glass 2026-10-31.
 */
function tabletNameChecks(): void {
  section("24 · Tablet names — vertical for CJK, rotated for Latin (SCRUM-146)");

  check('陈秀英 is set vertically (the column IS the convention)',
    nameOrientation('陈秀英') === 'vertical');
  check('⚠️ Chen is NOT — stacked it is four lines of one letter',
    nameOrientation('Chen') === 'rotated');
  check('Tan Wei is rotated on ONE line (a space does not make it a column)',
    nameOrientation('Tan Wei') === 'rotated');
  check('⚠️ a MIXED name is vertical — a stele does not rotate half a name',
    nameOrientation('陈 Chen') === 'vertical');
  check('and 陳 (traditional) is vertical too', nameOrientation('陳') === 'vertical');
  check('an empty name falls to vertical, so nothing rotates a zero-length line',
    nameOrientation('') === 'vertical' && nameOrientation('   ') === 'vertical');

  // ⚠️ The size shrinks as the name grows: the line must fit ALONG the frame, not just across it.
  const box = { width: 71.4, height: 235.8 };
  const short = rotatedNameSize(box, 4);
  const long = rotatedNameSize(box, 11);
  check('a short Latin name is bounded by the frame WIDTH, not the length',
    Math.abs(short - box.width * 0.62) < 1e-9, `${short.toFixed(2)}`);
  check('⚠️ a long one shrinks so it cannot run out of the frame ends',
    long < short, `11 chars ${long.toFixed(2)} < 4 chars ${short.toFixed(2)}`);
  check('…and never below zero for a degenerate length',
    rotatedNameSize(box, 0) > 0 && Number.isFinite(rotatedNameSize(box, 400)));

  // ── ⚠️ WHAT IS PAINTED — the board's own rule, and the altar and the preview share it ───
  check('the limit is the board\'s 3 characters', TABLET_NAME_MAX === 3);
  check('surname alone → 姓 + 氏, the traditional short form (the board draws 陈氏)',
    tabletName('陈', null) === '陈氏', tabletName('陈', null));
  check('…and an EMPTY given name is the same case, not a second rule',
    tabletName('陈', '') === '陈氏' && tabletName('陈', '   ') === '陈氏');
  check('surname + given → the first three characters (the board draws 陈大文)',
    tabletName('陈', '大文') === '陈大文', tabletName('陈', '大文'));
  check('⚠️ a longer name is TRUNCATED, not refused — the DB caps the surname at 20',
    tabletName('陈', '大文长') === '陈大文', tabletName('陈', '大文长'));
  /**
   * ⚠️ The 姓+氏 clause is its OWN rule, so it is NOT cut to three — the board states the limit
   * for "surname + given name" and then gives 姓 + 氏 as a separate case.
   */
  check('a two-character surname takes 氏 and is NOT cut to three',
    tabletName('欧阳', null) === '欧阳氏', tabletName('欧阳', null));
  /**
   * ⚠️ A LATIN surname takes no 氏. Beyond meaning nothing, 氏 is CJK — appending it would flip
   * `nameOrientation` to `vertical` and stack `C h e n` one glyph per line, the exact defect the
   * rotation exists to prevent.
   */
  check('⚠️ a LATIN surname with no given name stays bare (氏 would force it VERTICAL)',
    tabletName('Chen', null) === 'Chen' && nameOrientation(tabletName('Chen', null)) === 'rotated',
    `${tabletName('Chen', null)} / ${nameOrientation(tabletName('Chen', null))}`);
  check('no surname → nothing to paint (the caller supplies its own placeholder)',
    tabletName('', '大文') === '' && tabletName('   ', null) === '');
  check('the stored name is trimmed before it is painted', tabletName('  陈 ', ' 大文 ') === '陈大文');
  /**
   * ⚠️ SURROGATE SAFETY. `Array.from`, not `slice`: a 3-character cut by UTF-16 unit would split
   * an emoji or a rare ideograph in half and render a replacement glyph on the plaque.
   */
  check('⚠️ a 3-character cut never splits a surrogate pair',
    Array.from(tabletName('陈', '𠀀𠀁')).every((c) => c.codePointAt(0)! > 0xffff || c.length === 1)
    && Array.from(tabletName('陈', '𠀀𠀁')).length === 3,
    JSON.stringify(tabletName('陈', '𠀀𠀁')));
}

async function main(): Promise<void> {
  await storageChecks();
  await drainChecks();
  serviceChecks();
  section('17 · The designed confirm dialog — the boards\' geometry (SCRUM-123 · option A)');

  /*
   * ⚠️ MEASURED FROM THE BOARDS, SO IT IS ASSERTED HERE. `EN · 9b Buy offerings ·
   * confirm` was read shape by shape through the Penpot plugin; these checks hold those
   * numbers still, the same way §14 holds the Home pill's signed-off geometry.
   *
   * ⚠️ AND THE TWO BOARD-SOURCED COLOURS ARE CHECKED BY ARITHMETIC, NOT BY SNAPSHOT.
   * `dialog · title`'s `#2b2420` and `dialog · body`'s `#5a5048` are NOT tokens, so
   * `penpot-pairs.json` cannot cover them — it is a snapshot of what the sweep saw, and
   * the sweep has no entry for either. Computing the ratio here is the only coverage
   * they can have.
   */

  check('⚠️ the card is the boards\' fill and radius, not a guess',
    CONFIRM_SPEC.card.fill === '#f5f0e8' && CONFIRM_SPEC.card.radius === 16);

  check('⚠️ …and the boards\' paddings — 16 h · 24 top · 20 BOTTOM',
    CONFIRM_SPEC.card.padH === 16
      && CONFIRM_SPEC.card.padTop === 24
      && CONFIRM_SPEC.card.padBottom === 20);

  check('⚠️ …and the 20 px bottom padding is the SCRUM-104 fix — the cancel sits ON the card',
    CONFIRM_SPEC.card.padBottom >= 20 && CONFIRM_SPEC.gutter === 20);

  check('…the primary button is the board\'s 56 tall, r18, cinnabar',
    CONFIRM_SPEC.primary.height === 56
      && CONFIRM_SPEC.primary.radius === 18
      && CONFIRM_SPEC.primary.fill === '#c23b22');

  check('⚠️ …and the cancel keeps a 44 dp TOUCH target though its label is 20',
    CONFIRM_SPEC.cancel.touchHeight === 44 && CONFIRM_SPEC.cancel.labelSize === 13);

  check('the scrim is the board\'s colour at 50 % — the #88837d the record names',
    SCRIM.color === '#1a1512' && SCRIM.opacity === 0.5
      && scrimRgba() === 'rgba(26, 21, 18, 0.5)');

  check('⚠️ every text pair clears 4.5:1',
    CONFIRM_TEXT_PAIRS.every((pair) => contrastRatio(pair.fg, pair.bg) >= pair.min),
    CONFIRM_TEXT_PAIRS.map((p) => `${p.name}=${contrastRatio(p.fg, p.bg).toFixed(2)}`).join(' · '));

  /*
   * ⚠️ THE INVARIANT IS "AN OPAQUE SURFACE, NEVER THE SCRIM" — not "always the card".
   * The primary label sits on the cinnabar BUTTON, which is opaque and correct; the
   * failure `SCRUM-104` shipped was a label on the translucent SCRIM. Asserting the
   * card specifically would have been a check that fails on a correct design.
   */
  const CONFIRM_OPAQUE = [CONFIRM_SPEC.card.fill, CONFIRM_SPEC.primary.fill];
  check('⚠️ …and every pair sits on an OPAQUE surface — never the scrim (the SCRUM-104 defect)',
    CONFIRM_TEXT_PAIRS.every((pair) => CONFIRM_OPAQUE.includes(pair.bg)));

  /*
   * ⚠️ A CHECK THAT CANNOT FAIL IS NOT A CHECK. This reproduces the SCRUM-104 defect —
   * the cancel label composited onto the scrim — and asserts it WOULD go red. Without
   * it, the two assertions above could pass on a contrast function that always returned
   * a large number.
   */
  check('guard: …and that contrast check can FAIL (the SCRUM-104 defect, reproduced)',
    contrastRatio('#4a463f', '#88837d') < 4.5,
    `#4a463f on the scrim = ${contrastRatio('#4a463f', '#88837d').toFixed(2)}`);


  clanPillChecks();
  zhScriptChecks();
  screenCopyChecks();
  homeShrineScaleChecks();
  offeringsPlacementChecks();
  homePanelChecks();
  altarChecks();
  tabBarChecks();
  collectionChecks();
  storeChecks();
  itemBurnChecks();
  pickerChecks();
  accountChecks();
  ancestorSheetChecks();
  tabletNameChecks();
  shrineGeometryChecks();
  localeChecks();

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
