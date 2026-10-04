/**
 * The offline queue — CROSS-DAY durability is a REQUIREMENT, not a nicety
 * (doc 14 N6; doc 07 §7 Q1: "queue persists across days, local SQLite").
 *
 * The rural-first answer to connectivity is: the capture and the burn are
 * written to a durable local outbox, and replay is safe because every item
 * carries its `idempotency_key` — the server's UNIQUE constraints mean a replay
 * awards ONCE (doc 11 §4/§5: "replays do not count against the rate limit").
 *
 * ── WHY THE POLICY AND THE STORAGE ARE SEPARATE ─────────────────────────────
 * This file holds the POLICY and is PURE (no React, no native module, storage
 * is an injected driver). That buys two things: plain Node can check the policy
 * (`src/lib/checks/run.ts`), and the device can swap SQLite for anything else
 * without touching the rules. `queue-sqlite.ts` is the only file that knows
 * about `expo-sqlite`.
 */

/** The three things that can be queued. Each maps to a server endpoint. */
export type QueuedKind = 'burn' | 'cartoonize' | 'join';

export interface QueuedItem {
  readonly id: number;
  readonly kind: QueuedKind;
  readonly idempotencyKey: string;
  /** Opaque JSON — the queue never interprets it. */
  readonly payload: string;
  /** Epoch ms. Survives process death, app restarts and DAYS (doc 14 N6). */
  readonly createdAt: number;
  readonly attempts: number;
  readonly lastError?: string | null;
}

/** The storage contract. Deliberately small: seven calls. */
export interface QueueDriver {
  init(): Promise<void>;
  insert(item: Omit<QueuedItem, 'id' | 'attempts'>): Promise<void>;
  pending(limit: number): Promise<QueuedItem[]>;
  ack(id: number): Promise<void>;
  fail(id: number, error: string): Promise<void>;
  size(): Promise<number>;
  /** Drop everything — used by the one-tap delete (doc 13 §9 step 2). */
  clear(): Promise<void>;
}

/** After this many tries the item stops being retried automatically. */
export const MAX_ATTEMPTS = 5;

/**
 * ⚠️ PROVISIONAL. doc 11 §9 item 4 lists "how many days an unflushed burn may
 * land" as an OPEN question owned by SCRUM-20. So the window exists as a named
 * constant that NOTHING silently enforces: the queue never discards a burn on
 * its own — it stops *retrying* and hands the decision to the user/UI. The
 * server's idempotency makes a late replay safe either way.
 */
export const REPLAY_WINDOW_DAYS = 30;

/** How long an item has been waiting, in whole days. */
export function ageInDays(item: Pick<QueuedItem, 'createdAt'>, now: number): number {
  return Math.floor(Math.max(0, now - item.createdAt) / 86_400_000);
}

/** Past the provisional window — the UI flags it; the queue does not drop it. */
export function isExpired(
  item: Pick<QueuedItem, 'createdAt'>,
  now: number,
  windowDays: number = REPLAY_WINDOW_DAYS,
): boolean {
  return ageInDays(item, now) > windowDays;
}

/** Still worth an automatic attempt. */
export function isSendable(item: Pick<QueuedItem, 'attempts'>): boolean {
  return item.attempts < MAX_ATTEMPTS;
}

/**
 * The replay order: OLDEST FIRST (a ritual in time order), and only items still
 * worth attempting. Deterministic — `createdAt` then `id` — so a drain is
 * reproducible and a test can assert it.
 */
export function replayOrder(items: readonly QueuedItem[], now: number = 0): QueuedItem[] {
  return [...items]
    .filter((item) => isSendable(item))
    .sort((a, b) => (a.createdAt - b.createdAt) || (a.id - b.id));
}

/**
 * What `send` may report back. The distinction is the whole point:
 *   'sent'  → acknowledged, remove it
 *   'retry' → TRANSIENT (no network, 5xx, shrine busy) — keep it, come back
 *   'drop'  → PERMANENT (403 not your clan, 400 malformed) — remove it and
 *             report, because retrying a refused action forever is a lie
 * A THROWN error is treated as 'retry': an exception is never proof of refusal.
 */
export type SendOutcome = 'sent' | 'retry' | 'drop';
export type Send = (item: QueuedItem) => Promise<SendOutcome>;

export interface DrainReport {
  readonly sent: number;
  readonly dropped: number;
  readonly retryable: number;
  /** Attempted too many times — offered to the user, never silently discarded. */
  readonly stuck: number;
  readonly remaining: number;
}

export interface Queue {
  enqueue(kind: QueuedKind, idempotencyKey: string, payload: string): Promise<void>;
  drain(send: Send, now?: number): Promise<DrainReport>;
  size(): Promise<number>;
  clear(): Promise<void>;
}

/**
 * Build a queue over a driver. The idempotency key is supplied by the CALLER
 * and stored with the payload: regenerating it at send time would defeat the
 * entire mechanism, because the server would see a brand-new key every retry.
 */
export function createQueue(driver: QueueDriver, batchSize = 50): Queue {
  return {
    async enqueue(kind: QueuedKind, idempotencyKey: string, payload: string): Promise<void> {
      await driver.init();
      await driver.insert({ kind, idempotencyKey, payload, createdAt: Date.now() });
    },

    async drain(send: Send, now: number = Date.now()): Promise<DrainReport> {
      await driver.init();
      const batch = replayOrder(await driver.pending(batchSize), now);

      let sent = 0;
      let dropped = 0;
      let retryable = 0;

      for (const item of batch) {
        let outcome: SendOutcome;
        try {
          outcome = await send(item);
        } catch (caught) {
          // An exception is never proof of refusal → treat as transient.
          outcome = 'retry';
          await driver.fail(item.id, String((caught as Error)?.message ?? caught).slice(0, 300));
          retryable += 1;
          continue;
        }

        if (outcome === 'sent' || outcome === 'drop') {
          await driver.ack(item.id);
          if (outcome === 'sent') sent += 1;
          else dropped += 1;
          continue;
        }

        await driver.fail(item.id, 'transient');
        retryable += 1;
      }

      const left = await driver.pending(batchSize);
      return {
        sent,
        dropped,
        retryable,
        stuck: left.filter((item) => !isSendable(item)).length,
        remaining: left.length,
      };
    },

    async size(): Promise<number> {
      await driver.init();
      return await driver.size();
    },

    async clear(): Promise<void> {
      await driver.init();
      await driver.clear();
    },
  };
}
