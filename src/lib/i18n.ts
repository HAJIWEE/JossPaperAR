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

const i18n = new I18n(MESSAGES as unknown as Record<string, Record<string, string>>);
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
