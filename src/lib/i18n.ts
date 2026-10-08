/**
 * i18n — EN / 中文 (the two locales the design is signed off in, doc 15 §8).
 *
 * A deliberately TINY runtime: `i18n-js` plus one flat message table. The copy
 * itself is the locked product copy from the specs (doc 10 §4, doc 15 §8,
 * doc 13 §5) — where a string is already owned by another module, this file
 * IMPORTS it rather than restating it, so the two cannot drift.
 *
 * PURE ON PURPOSE: `i18n-js` is plain JavaScript, so this module loads under
 * plain Node and `src/lib/checks/run.ts` can assert the EN and 中文 tables have
 * exactly the same keys (a missing translation is a bug, not a fallback).
 *
 * ⚠️ `expo-localization` is NOT imported here. The device tag list is passed in
 * — that keeps the module Node-loadable and keeps the native dependency in the
 * device-only layer.
 */

import { I18n } from 'i18n-js';
import { QUOTA_SPENT_COPY } from '../domain/quota.ts';

export const LOCALES = ['en', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * The message table. Flat keys on purpose: one lookup, no nesting rules, and a
 * parity check that is a set comparison.
 */
export const MESSAGES = {
  en: {
    'app_name': 'Joss Paper AR',

    // ── the ritual (doc 10 §4 / doc 07 §4.2 — "the wait is UI") ────────────
    'ritual_preparing': 'The offering is being prepared…',
    'ritual_busy': 'The shrine is receiving many offerings — yours will be prepared shortly.',
    'ritual.cannotPrepare': 'This offering cannot be prepared.',
    'ritual.offeringPrepared': 'Your offering is ready.',
    'ritual.refundReturned': 'The offering could not be prepared — your points have returned.',
    // ⚠️ Two DIFFERENT retries, deliberately. `common.retry` is for a request
    // that did not cost anything (parked by the budget, or never sent);
    // `common.recapture` is for a capture that IS spent and needs a new photo.
    // One shared "try again" would imply a re-offer is free when it is not.
    'common.retry': 'Check again',
    'common.recapture': 'Offer a new photo',
    'common.done': 'Return to the shrine',
    'quota_spent': QUOTA_SPENT_COPY.en,

    // ── the throw (doc 05 §2 — the four bands) ────────────────────────────
    'band_bullseye': 'Bullseye',
    'band_devout': 'Devout',
    'band_graze': 'Graze',
    'band_miss': 'Miss',
    'reward.newGround': 'New ground',

    // ── clans & invites (doc 15 §8, doc 07 §4.6) ──────────────────────────
    'clan.forkJoin': 'Join a Clan',
    'clan.forkJoinHint': 'A family member sent you a link? Enter the code.',
    'clan.forkCreate': 'Create a Clan',
    'clan.forkCreateHint': "Start your family's altar.",
    'clan_name': 'Clan name',
    'clan.youWillBeHead': 'You will be the Clan Head.',
    'clan_code': 'Enter clan code',
    'clan_preview': '%{name} · %{ancestors} ancestors · %{members} members',
    'clan_welcome': 'Welcome to %{name}.',
    'clan.alreadyMember': 'You are already a member of this clan.',
    'clan.invalidCode': 'That invite code is not valid.',
    'clan.inviteFamily': 'Invite your family',
    'clan.shareCode': 'Share code · Show QR · Copy link',
    'role_head': 'Clan Head',
    'role_co_head': 'Co-Head',
    'role_elder': 'Elder',
    'role_member': 'Member',

    // ── the clan SCREENS — fork · create · join · manage (SCRUM-46 · doc 15 §4/§8) ──
    // Written from doc 15 §8's copy table (C1 fork title, C12 promote, C13 offer,
    // C17 delete) plus the statements §4 names. The screen keys the pure
    // `clan-flow.ts` returns — `ROLE_LABEL_KEY`, `promoteLabelKey`,
    // `leaveHintKey` — must exist here, and `check:lib` asserts exactly that.
    'clan.forkTitle': "Your family's altar",
    'clan.nameHint': 'e.g. 陳氏 · Tan Family',
    'clan.create': 'Create',
    'clan.join': 'Join',
    'clan.skip': 'Skip',
    'clan.next': 'Continue',
    'clan.back': 'Back',
    'clan.invite': 'Invite family',
    'clan.copied': 'Invite code copied.',
    'clan.placeFirstTablet': 'Place your first tablet',
    'clan.offerTo': "Offer to %{name}'s ancestors",
    'clan.manage': 'Members',
    'clan.yourRole': 'Your role',
    'clan.makeElder': 'Make Elder',
    'clan.makeCoHead': 'Make Co-Head',
    'clan.rename': 'Rename',
    'clan.renamePrompt': 'New clan name',
    'clan.removeMember': 'Remove',
    'clan.removeConfirm': 'Remove %{name} from the clan? Their past offerings stay.',
    'clan.leave': 'Leave this clan',
    'clan.leaveConfirm': 'Leave this clan? Your past offerings stay.',
    // ── the SCRUM-84 head-exit ramp (PM-answered 2026-10-08) ──────────────
    // The prompt is step ONE of the rule, so its copy prepares the head for the
    // question instead of refusing them.
    'clan.leaveHint': 'You will be asked who leads the clan next.',
    'clan.nameSuccessor': 'Name a successor',
    'clan.successorHint':
      'Choose who leads the clan after you — or leave it to the longest-standing elder.',
    'clan.leaveWithoutSuccessor': 'Leave without naming one',
    // the refusals, so a 中文 reader never meets the server's English sentence
    'clan.leaveNotMember': 'You are not a member of this clan.',
    'clan.leaveSelfSuccessor': 'You cannot name yourself as your successor.',
    'clan.leaveStrangerSuccessor': 'That person is not a member of this clan.',
    'clan.leaveNoSuccessor':
      'Nobody can lead after you yet. Promote a co-head first, or delete the clan.',
    'clan.successorNamed': '%{name} now leads the clan.',
    'clan.successorAuto':
      'No successor named — %{name}, the longest-standing elder, now leads the clan.',
    'clan.deleteClan': 'Delete this clan',
    'clan.deleteConfirm':
      'Delete this clan? Every member loses the altar and the Book of Tributes. This cannot be undone.',

    // ── the Book of Tributes (doc 15 §7) ──────────────────────────────────
    'book_header': 'Book of Tributes',
    'book_outside': 'A member made this offering.',
    'book_window': 'Showing the last month.',

    // ── privacy (doc 13 §5/§8, ADR-007) ───────────────────────────────────
    'privacy.firstRun':
      "Your photos, your ancestors' names, and where you pay tribute stay in your account. We use them only to make your offering — never sold, never in ads.",
    'privacy.rawPhotoNote':
      'Your original photo is deleted automatically a week after the offering is ready.',
    'delete_title': 'Delete everything',
    'delete_confirm': 'Delete everything? This cannot be undone.',
  },
  zh: {
    'app_name': 'Joss Paper AR',

    'ritual_preparing': '供品製作中…',
    'ritual_busy': '神龛正繁忙，您的供品稍後即成。',
    'ritual.cannotPrepare': '此供品無法製作。',
    'ritual.offeringPrepared': '您的供品已備好。',
    'ritual.refundReturned': '供品未能製成，點數已退回。',
    'common.retry': '再試一次',
    'common.recapture': '重新供相',
    'common.done': '回到神龛',
    'quota_spent': QUOTA_SPENT_COPY.zh,

    'band_bullseye': '正中',
    'band_devout': '虔誠',
    'band_graze': '擦邊',
    'band_miss': '偏失',
    'reward.newGround': '新地',

    'clan.forkJoin': '加入宗族',
    'clan.forkJoinHint': '家人發來了連結？輸入邀請碼。',
    'clan.forkCreate': '創建宗族',
    'clan.forkCreateHint': '建立您家族的祭壇。',
    'clan_name': '宗族名稱',
    'clan.youWillBeHead': '您將成為族長。',
    'clan_code': '輸入邀請碼',
    'clan_preview': '%{name} · 先人 %{ancestors} 位 · 成員 %{members} 位',
    'clan_welcome': '歡迎加入%{name}。',
    'clan.alreadyMember': '您已是此宗族的成員。',
    'clan.invalidCode': '邀請碼無效。',
    'clan.inviteFamily': '邀請家人加入',
    'clan.shareCode': '分享邀請碼 · 顯示二維碼 · 複製連結',
    'role_head': '族長',
    'role_co_head': '副族長',
    'role_elder': '長老',
    'role_member': '成員',

    // ⚠️ TRADITIONAL characters, matching this file (not doc 15 §8's table, which
    // is typed in SIMPLIFIED — 家人发来了链接 vs the shipped 家人發來了連結).
    // See the note in the EN block; the mismatch is recorded, not silently resolved.
    'clan.forkTitle': '您家族的祭壇',
    'clan.nameHint': '例：陳氏 · Tan Family',
    'clan.create': '創建',
    'clan.join': '加入',
    'clan.skip': '略過',
    'clan.next': '繼續',
    'clan.back': '返回',
    'clan.invite': '邀請家人',
    'clan.copied': '邀請碼已複製。',
    'clan.placeFirstTablet': '安放第一塊神主牌',
    'clan.offerTo': '向%{name}的先人供奉',
    'clan.manage': '成員',
    'clan.yourRole': '您的身分',
    'clan.makeElder': '設為長老',
    'clan.makeCoHead': '設為副族長',
    'clan.rename': '重新命名',
    'clan.renamePrompt': '新的宗族名稱',
    'clan.removeMember': '移出宗族',
    'clan.removeConfirm': '將 %{name} 移出宗族？先前的供奉紀錄將保留。',
    'clan.leave': '離開此宗族',
    'clan.leaveConfirm': '離開此宗族？先前的供奉紀錄將保留。',
    // the SCRUM-84 head-exit ramp — the successor prompt and its refusals
    'clan.leaveHint': '系統將詢問由誰接任帶領宗族。',
    'clan.nameSuccessor': '指定繼任者',
    'clan.successorHint': '選擇在您離開後帶領宗族的人，或交由加入最久的長老接任。',
    'clan.leaveWithoutSuccessor': '不指定直接離開',
    'clan.leaveNotMember': '您不是此宗族的成員。',
    'clan.leaveSelfSuccessor': '不能指定自己為繼任者。',
    'clan.leaveStrangerSuccessor': '此人不是此宗族的成員。',
    'clan.leaveNoSuccessor': '目前沒有可接任的人。請先設副族長，或刪除宗族。',
    'clan.successorNamed': '現由 %{name} 帶領宗族。',
    'clan.successorAuto': '未指定繼任者——由加入最久的長老 %{name} 帶領宗族。',
    'clan.deleteClan': '刪除宗族',
    'clan.deleteConfirm': '刪除宗族？所有成員將失去祭壇與供奉簿，無法復原。',

    'book_header': '供奉簿',
    'book_outside': '由宗族成員供奉。',
    'book_window': '僅顯示最近一個月。',

    'privacy.firstRun':
      '您的照片、先人姓名與祭拜位置只屬於您的帳號，僅用於製作供品。我們絕不出售這些資料。',
    'privacy.rawPhotoNote': '供品完成後，您的原始照片將於一週內自動刪除。',
    'delete_title': '刪除所有資料',
    'delete_confirm': '確定刪除所有資料？此操作無法復原。',
  },
} as const;

/**
 * ⚠️ THE KEY SEPARATOR — AND WHY `.` IS A BUG HERE.
 *
 * `i18n-js` reads `.` as a SCOPE separator, so `t('ritual.cannotPrepare')` was
 * looked up as the nested path `messages.en.ritual.cannotPrepare`, which does not
 * exist. Every DOTTED key in the table above was therefore unreachable, while
 * every underscore key (`ritual_preparing`, `clan_welcome`) worked — which is
 * exactly the pattern that made it so easy to miss.
 *
 * Found on glass 2026-10-06 (SCRUM-53 / SCRUM-64): the slice's failure screen
 * rendered `[missing "en.ritual.cannotPrepare" translation]` instead of the copy
 * we signed off, so a player hitting a recoverable error was shown nothing
 * readable. It survived the whole gate suite because `check:lib` compared key
 * SETS between the locales — and the one key it happened to interpolate is an
 * underscore one.
 *
 * THE TABLE IS FLAT ON PURPOSE ("one lookup, no nesting rules" — see MESSAGES
 * above), and a dotted key is a flat key that merely LOOKS nested. So the fix is
 * a separator that cannot occur inside a key: scope splitting is disabled
 * entirely, and every key is looked up whole, dots and all.
 *
 * ⚠️ Do not "tidy this away". Deleting it silently re-breaks every dotted key;
 * `check:lib` now asserts that every message RESOLVES, which is the check that
 * was missing the first time.
 */
const FLAT_KEY_SEPARATOR = '\u0000';

const i18n = new I18n(MESSAGES as unknown as Record<string, Record<string, string>>, {
  defaultSeparator: FLAT_KEY_SEPARATOR,
});
i18n.defaultLocale = DEFAULT_LOCALE;
i18n.enableFallback = true;
i18n.locale = DEFAULT_LOCALE;

/** Set the active locale. Both locales are complete, so there is no fallback UI. */
export function setLocale(locale: Locale): void {
  i18n.locale = locale;
}

export function activeLocale(): Locale {
  const current = i18n.locale;
  return (LOCALES as readonly string[]).includes(current) ? (current as Locale) : DEFAULT_LOCALE;
}

/** Translate. Interpolation uses i18n-js's `%{name}` placeholders. */
export function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options);
}

/**
 * Pick a supported locale from the device's language tags (as returned by
 * `expo-localization`'s `getLocales()`), e.g. ['zh-Hans-SG','en-SG'] → 'zh'.
 * Anything unrecognised falls back to English — the app is never untranslated.
 */
export function detectLocale(languageTags: readonly string[]): Locale {
  for (const tag of languageTags) {
    const lower = tag.toLowerCase();
    if (lower.startsWith('zh')) return 'zh';
    if (lower.startsWith('en')) return 'en';
  }
  return DEFAULT_LOCALE;
}

/** The keys a locale defines — used by the parity check, and by nothing else. */
export function messageKeys(locale: Locale): string[] {
  return Object.keys(MESSAGES[locale]);
}
