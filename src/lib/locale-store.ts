/**
 * locale-store.ts — the DEVICE half of the language choice (SCRUM-151).
 *
 * The DECISION lives in the pure `locale.ts` (`resolveInitialLocale` · `normaliseLocale`); this file
 * only reads, writes and applies the one value, and asks the device what language it speaks.
 *
 * ⚠️ **AsyncStorage, like `first-run.ts` and `supabase.ts`.** The SecureStore split in
 * `split-storage.ts` exists because a JWT can exceed SecureStore's ~2 KB cap — one locale tag is
 * two characters, and the split would be ceremony.
 *
 * ⚠️ **`expo-localization` is imported HERE and not in `locale.ts`**, on purpose: `locale.ts` is
 * loaded by `check:lib` under plain Node, and a native module import would break that. The tag list
 * crosses the boundary as a parameter.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';

import { setLocale, type Locale } from './i18n.ts';
import { LOCALE_KEY } from './locale.ts';

/**
 * The device's language tags, most-preferred first — e.g. `['zh-Hans-SG', 'en-SG']`.
 *
 * ⚠️ A failure returns `[]`, which `resolveInitialLocale` reads as "no opinion" and answers with the
 * default. ⚠️ Deliberately NOT a hard-coded `['en']`: that would make a detection failure
 * indistinguishable from an English device, and the two want different debugging.
 */
export function deviceLanguageTags(): readonly string[] {
  try {
    return getLocales().map((l) => l.languageTag);
  } catch {
    return [];
  }
}

/**
 * The stored tag, or `null`.
 *
 * ⚠️ **`null` means NOTHING STORED — it does not mean "English".** The distinction is load-bearing:
 * `resolveInitialLocale` falls through to the DEVICE on `null`, so a Chinese phone opens in 中文 on
 * first run. Folding a failed read into `'en'` would silently pin every first run to English.
 */
export async function readStoredLocale(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LOCALE_KEY);
  } catch {
    return null;
  }
}

/**
 * ⚠️ **The ONE place `setLocale` is called.** It mutates the `i18n` instance, so a second call site
 * would be a second source of truth for "what language is the app in" — and `activeLocale()` (used
 * by `localized()` and `invite-qr.tsx`) reads that instance, not React state.
 */
export function applyLocale(locale: Locale): void {
  setLocale(locale);
}

/**
 * Persist the choice. ⚠️ Best-effort, and it does NOT roll back the in-memory switch: the user has
 * already seen the app change language, and reverting it because a disk write failed would be a
 * worse lie than losing the choice on the next cold start.
 */
export async function writeLocale(locale: Locale): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // The choice still applies for this run; the next cold start falls back to the device.
  }
}
