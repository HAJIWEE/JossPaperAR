/**
 * The Supabase client + the auth storage adapter (doc 19 §6.1 item H).
 *
 * TWO VERIFIED DETAILS, because both are places memory misleads:
 *
 *  1. ⚠️ **THE URL POLYFILL IS STILL REQUIRED.** doc 19 §5.4 T3 says "check the
 *     current Supabase RN guide, not memory" — so it was checked (2026-10-04):
 *     the official React Native quickstart still installs and imports
 *     `react-native-url-polyfill/auto`. Verified, not remembered.
 *
 *  2. **THE SPLIT-STORAGE ADAPTER.** `expo-secure-store` caps a value at ~2 KB
 *     and a session can exceed it (doc 19 §5.4 T2), so the storage is the
 *     pure, checked adapter from `split-storage.ts`: small values encrypted in
 *     SecureStore, oversized ones in AsyncStorage under a prefixed key.
 *
 * The key is the PUBLISHABLE key (`sb_publishable_…`) and it is meant to be
 * public: RLS is what protects the data, not the secrecy of this string
 * (doc 19 §4.4). Nothing here reads FAL_KEY — server secrets never ship.
 */

import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

import { createSplitStorage } from './split-storage.ts';

/**
 * The app-facing configuration. Only `EXPO_PUBLIC_*` values reach the bundle,
 * and either name for the client key is accepted: the modern publishable key
 * (doc 19 §4.4) or the legacy anon key, which keeps working until end-2026.
 */
export function supabaseConfig(): { url: string; key: string } {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    ?? '';
  return { url, key };
}

/** `true` when the app has enough configuration to talk to a backend at all. */
export function isConfigured(): boolean {
  const { url, key } = supabaseConfig();
  return url.length > 0 && key.length > 0;
}

/** The adapter instance the client persists sessions through. */
export const authStorage = createSplitStorage(
  {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    removeItem: (key) => SecureStore.deleteItemAsync(key),
  },
  {
    getItem: (key) => AsyncStorage.getItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
    removeItem: (key) => AsyncStorage.removeItem(key),
  },
);

function build(): SupabaseClient {
  const { url, key } = supabaseConfig();
  if (!url || !key) {
    throw new Error(
      'Supabase is not configured — set EXPO_PUBLIC_SUPABASE_URL and the '
      + 'publishable key in .env (see .env.example).',
    );
  }

  return createClient(url, key, {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      // the app is not a browser: there is no callback URL to sniff
      detectSessionInUrl: false,
    },
  });
}

/**
 * The client. Created lazily so an unconfigured checkout can still render the
 * app shell instead of crashing at import time — which is exactly the state a
 * fresh clone is in before `.env` exists.
 */
let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  client ??= build();
  return client;
}

/**
 * Keep the session fresh only while the app is in front (the pattern the
 * official guide uses): a backgrounded app stops its refresh timer, and
 * restarting it on foreground is what keeps `onAuthStateChange` firing.
 */
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (!client) return;
    if (state === 'active') void client.auth.startAutoRefresh();
    else void client.auth.stopAutoRefresh();
  });
}
