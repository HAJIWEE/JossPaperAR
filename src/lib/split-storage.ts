/**
 * The SPLIT-STORAGE auth adapter — doc 19 §5.4 T2.
 *
 * ── THE TRAP ────────────────────────────────────────────────────────────────
 * `expo-secure-store` caps a value at roughly **2 KB**, and a Supabase session
 * (JWT + refresh token) can exceed it. The failure is a refused write, which
 * looks like a random sign-out. The documented pattern is: keep the SMALL value
 * in the encrypted store, the BULK somewhere else.
 *
 * ── HOW THIS DOES IT ────────────────────────────────────────────────────────
 * A value that fits goes to the secure store (encrypted at rest). A value too
 * large goes to the bulk store under a prefixed key AND the secure-store entry
 * is REMOVED — so the two can never disagree about the same key. Reads check
 * the secure store first, then the bulk store. Writes always clear the other
 * side, which is what keeps a shrunken session from resurrecting an old one.
 *
 * ── ⚠️ THE HONEST TRADE-OFF ─────────────────────────────────────────────────
 * A value above the cap is NOT encrypted at rest; Supabase's own React Native
 * guidance puts the whole session in AsyncStorage, so this is strictly better
 * than the default — but it is a trade-off, not a win, and it is recorded here
 * rather than hidden. (The alternative — refusing to persist a large session —
 * would sign the user out mid-ritual.)
 *
 * PURE ON PURPOSE: both stores are injected, so this module has no imports and
 * `src/lib/checks/run.ts` can drive it with in-memory fakes.
 */

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** The documented `expo-secure-store` ceiling, in bytes — with headroom. */
export const SECURE_STORE_LIMIT_BYTES = 2000;

/** The namespace the oversized values live under in the bulk store. */
export const BULK_PREFIX = 'josspaper.bulk.';

export function bulkKey(key: string): string {
  return `${BULK_PREFIX}${key}`;
}

/**
 * Compose the adapter. `limit` is compared against `String.length`, which is an
 * exact byte count for the ASCII/Base64 payload of a JWT and a conservative
 * *under*-estimate for multi-byte text — the safe direction for a hard cap.
 */
export function createSplitStorage(
  secure: KeyValueStore,
  bulk: KeyValueStore,
  limit: number = SECURE_STORE_LIMIT_BYTES,
): KeyValueStore {
  return {
    async getItem(key: string): Promise<string | null> {
      const small = await secure.getItem(key);
      if (small !== null) return small;
      return await bulk.getItem(bulkKey(key));
    },

    async setItem(key: string, value: string): Promise<void> {
      if (value.length <= limit) {
        await bulk.removeItem(bulkKey(key)); // never leave a stale bulk copy
        await secure.setItem(key, value);
        return;
      }
      await bulk.setItem(bulkKey(key), value);
      await secure.removeItem(key); // never leave a stale secure copy
    },

    async removeItem(key: string): Promise<void> {
      await secure.removeItem(key);
      await bulk.removeItem(bulkKey(key));
    },
  };
}
