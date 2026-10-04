/**
 * The DEVICE half of the offline queue — the only file that knows about
 * `expo-sqlite` and `expo-crypto` (doc 14 N6; doc 19 §5.1).
 *
 * `queue.ts` holds the policy and is pure. This adapter is the durability: a
 * real SQLite table, in the app's private storage, which is what makes the
 * queue survive a process death, an app update and DAYS offline — the rural
 * requirement, not a nicety (doc 14 N6).
 *
 * Two details that matter:
 *   · `idempotency_key` is UNIQUE in the table, so a double-tap on "burn"
 *     cannot queue the same offering twice — the INSERT is `or ignore`.
 *   · the key is generated HERE, once, at enqueue time, and travels with the
 *     row. Regenerating it at send time would defeat replay-safety entirely.
 */

import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import { type UuidFactory, newIdempotencyKey } from './idempotency.ts';
import { type Queue, type QueueDriver, type QueuedItem, createQueue } from './queue.ts';

/** The app's private outbox database. */
export const OUTBOX_DB_NAME = 'josspaper-outbox.db';

const DDL = `
create table if not exists outbox (
  id              integer primary key autoincrement,
  kind            text    not null,
  idempotency_key text    not null unique,
  payload         text    not null,
  created_at      integer not null,
  attempts        integer not null default 0,
  last_error      text
);
create index if not exists outbox_created_idx on outbox (created_at);
`;

interface OutboxRow {
  id: number;
  kind: string;
  idempotency_key: string;
  payload: string;
  created_at: number;
  attempts: number;
  last_error: string | null;
}

function toItem(row: OutboxRow): QueuedItem {
  return {
    id: row.id,
    kind: row.kind as QueuedItem['kind'],
    idempotencyKey: row.idempotency_key,
    payload: row.payload,
    createdAt: row.created_at,
    attempts: row.attempts,
    lastError: row.last_error,
  };
}

/** A `QueueDriver` backed by expo-sqlite. The handle is opened once, lazily. */
export function expoSqliteDriver(databaseName: string = OUTBOX_DB_NAME): QueueDriver {
  let handle: Promise<SQLite.SQLiteDatabase> | null = null;
  const open = (): Promise<SQLite.SQLiteDatabase> => {
    handle ??= SQLite.openDatabaseAsync(databaseName);
    return handle;
  };

  return {
    async init(): Promise<void> {
      const db = await open();
      await db.execAsync(DDL);
    },

    async insert(item): Promise<void> {
      const db = await open();
      // `or ignore` on the UNIQUE key: enqueueing the same action twice is a
      // no-op rather than a duplicate ritual.
      await db.runAsync(
        'insert or ignore into outbox (kind, idempotency_key, payload, created_at, attempts) '
        + 'values (?, ?, ?, ?, 0)',
        item.kind,
        item.idempotencyKey,
        item.payload,
        item.createdAt,
      );
    },

    async pending(limit: number): Promise<QueuedItem[]> {
      const db = await open();
      const rows = await db.getAllAsync<OutboxRow>(
        'select id, kind, idempotency_key, payload, created_at, attempts, last_error '
        + 'from outbox order by created_at asc, id asc limit ?',
        limit,
      );
      return rows.map(toItem);
    },

    async ack(id: number): Promise<void> {
      const db = await open();
      await db.runAsync('delete from outbox where id = ?', id);
    },

    async fail(id: number, error: string): Promise<void> {
      const db = await open();
      await db.runAsync(
        'update outbox set attempts = attempts + 1, last_error = ? where id = ?',
        error,
        id,
      );
    },

    async size(): Promise<number> {
      const db = await open();
      const row = await db.getFirstAsync<{ n: number }>('select count(*) as n from outbox');
      return row?.n ?? 0;
    },

    async clear(): Promise<void> {
      const db = await open();
      await db.runAsync('delete from outbox');
    },
  };
}

/** `expo-crypto`'s UUID v4 — the device's randomness for idempotency keys. */
export const deviceUuid: UuidFactory = () => Crypto.randomUUID();

/** The queue the app uses. */
export function deviceQueue(): Queue {
  return createQueue(expoSqliteDriver());
}

/** Convenience: a fresh, correctly-prefixed key for a burn. */
export function newBurnKey(): string {
  return newIdempotencyKey('burn', deviceUuid);
}
