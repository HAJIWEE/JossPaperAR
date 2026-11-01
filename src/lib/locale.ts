/**
 * locale.ts — the language switcher's RULES, pure (SCRUM-151 · SCRUM-34).
 *
 * ── ⚠️ WHY THIS EXISTS AT ALL ────────────────────────────────────────────────
 * Measured 2026-11-01: `setLocale` was called from **no screen and no component**, and neither was
 * `detectLocale`. Every string in the app was translated and `check:lib` §15/§16 held both tables —
 * ⚠️ **and a reviewer could not reach 中文.** The translation was complete; the switch was missing.
 *
 * ── ⚠️ PURE, SO THE RULES ARE ASSERTABLE ────────────────────────────────────
 * `src/lib/locale-store.ts` does the AsyncStorage read/write and nothing else. Which value wins,
 * what an unknown stored value means, and what the labels are — all facts, so they live here where
 * `check:lib` reads them without a device.
 */

import { DEFAULT_LOCALE, LOCALES, type Locale } from './i18n.ts';

/**
 * ⚠️ The persisted key. Namespaced, and **versionless on purpose**: the value is a locale tag, and
 * a future locale does not invalidate an old one — `normaliseLocale` decides what is valid.
 */
export const LOCALE_KEY = 'josspaperar.locale';

/**
 * ⚠️ **The switcher's labels are ENDONYMS, and they are NOT `t()` keys.**
 *
 * "EN" and "中文" read the same in every locale — which is the entire point of a language switcher:
 * a user who cannot read the language the app is currently in must still be able to find their own.
 * ⚠️ Translating them would hide 中文 behind English.
 */
export const LOCALE_LABELS: Record<Locale, string> = { en: 'EN', zh: '中文' };

/**
 * Is this string one of the locales the app ships? A type guard, so a caller cannot widen `Locale`
 * by string comparison alone.
 */
export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * ⚠️ **A stored value is UNTRUSTED.** It may be from an older build, hand-edited, or absent — so an
 * unrecognised tag falls back to the DEFAULT rather than to a broken locale that would render
 * `[missing "en.foo" translation]` on every screen.
 *
 * ⚠️ Case-insensitive and trimmed: `ZH`, ` zh ` and `zh-Hans` are all things a device or a migration
 * can produce, and none of them should cost a user their language.
 */
export function normaliseLocale(stored: string | null | undefined): Locale {
  if (stored == null) return DEFAULT_LOCALE;
  const tag = stored.trim().toLowerCase();
  if (tag.length === 0) return DEFAULT_LOCALE;
  /** ⚠️ `zh-Hans-SG` → `zh`: a full tag is not a locale we ship, but its language IS. */
  const primary = tag.split('-')[0];
  return isLocale(primary) ? primary : DEFAULT_LOCALE;
}

/**
 * ⚠️ Which locale the app should OPEN in.
 *
 * The order is the whole rule, and each step matters:
 *   1. **What the user chose** — a stored value always wins, because it is the only one that is a
 *      decision rather than a guess. ⚠️ Even when it disagrees with the device: an English speaker
 *      on a Chinese phone asked for English.
 *   2. **What the device says** — first run has nothing stored, and `detectLocale` (which already
 *      existed and was never called) is the right guess.
 *   3. **The default** — anything unrecognised, so the app is never untranslated.
 *
 * ⚠️ `stored` is checked with `!= null`, NOT truthiness: `''` is a stored-but-empty value and must
 * fall through to the device, which `normaliseLocale` already handles by returning the default — so
 * an empty string is treated as "no choice", which is the honest reading.
 */
export function resolveInitialLocale(
  stored: string | null | undefined,
  deviceTags: readonly string[],
): Locale {
  if (stored != null && stored.trim().length > 0) return normaliseLocale(stored);
  return detectLocaleFromTags(deviceTags);
}

/**
 * ⚠️ A LOCAL copy of the tag walk, so this module stays free of `i18n.ts`'s runtime.
 *
 * `i18n.ts`'s own `detectLocale` is the same walk — and it IS the one the app calls. This exists so
 * `resolveInitialLocale` is pure data-in/data-out and `check:lib` can drive it with fabricated tags
 * instead of the machine's real ones. ⚠️ `check:lib` asserts the two agree, so the copy cannot
 * drift into a second opinion.
 */
export function detectLocaleFromTags(languageTags: readonly string[]): Locale {
  for (const tag of languageTags) {
    const lower = tag.toLowerCase();
    if (lower.startsWith('zh')) return 'zh';
    if (lower.startsWith('en')) return 'en';
  }
  return DEFAULT_LOCALE;
}
