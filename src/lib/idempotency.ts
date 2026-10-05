/**
 * Idempotency keys — the reason an offline queue is SAFE (doc 14 N6, doc 11 §4).
 *
 * Every burn, purchase and invite-resolution carries one. The server keeps a
 * `UNIQUE(idempotency_key)` on `burns` and `ledger_events`, so replaying a
 * queued action across days awards ONCE and returns the original receipt — the
 * key is the whole mechanism, which is why it is generated here and stored with
 * the queued payload rather than regenerated on send.
 *
 * PURE ON PURPOSE: no React, no network, no native module, and the uuid factory
 * is INJECTED. That keeps it checkable under plain Node (trap #6: Node's ESM
 * resolver needs the explicit `.ts` extension on relative imports) and lets the
 * device supply `expo-crypto`'s `randomUUID` while a test supplies a stub.
 */

/** The server's window, mirrored from `submit_burn`: 8..200 characters. */
export const KEY_MIN_LENGTH = 8;
export const KEY_MAX_LENGTH = 200;

export type UuidFactory = () => string;

/**
 * The prefixes are part of the key's shape, not decoration: a key that starts
 * `burn-` can be recognised in a log or an incident without joining tables.
 */
export const KEY_PREFIX = {
  burn: 'burn',
  purchase: 'purchase',
  cartoonize: 'cartoonize',
  join: 'join',
} as const;
export type KeyKind = keyof typeof KEY_PREFIX;

/**
 * Build a key. `prefix` is sanitised to the server's accepted charset so a
 * stray character can never push the key outside the 8..200 window.
 */
export function newIdempotencyKey(kind: KeyKind, uuid: UuidFactory): string {
  const prefix = KEY_PREFIX[kind];
  const key = `${prefix}-${uuid()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  // Defensive: an exotic uuid factory must not be able to break the contract.
  return key.slice(0, KEY_MAX_LENGTH);
}

/** The server's own rule, so a key can be rejected before it is queued. */
export function isValidIdempotencyKey(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= KEY_MIN_LENGTH
    && value.length <= KEY_MAX_LENGTH;
}
