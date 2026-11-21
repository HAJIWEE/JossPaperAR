/**
 * **THE REFUSAL CONTRACT** — typed reasons for a refused `purchase_item` (SCRUM-242).
 *
 * ⚠️⚠️ **THIS MODULE IMPORTS NOTHING, ON PURPOSE.** It is the pure half of the refusal path, so both the
 * API layer (`offerings-api.ts`, which loads the Supabase client) and the gate runner (`checks/run.ts`,
 * which runs under plain Node) can use it. ⚠️ Importing `offerings-api` from a check pulls in
 * `react-native-url-polyfill` and **crashes the whole suite** — measured 2026-11-21 — which is exactly why
 * the parser lives here rather than beside the RPC call.
 *
 * ⚠️ **The server types the reason; the client never parses prose.** `purchase_item` puts JSON in Postgres
 * `DETAIL`, PostgREST returns it as `error.details`, and this reads `refusal` out of it. A reworded `raise`
 * therefore cannot silently degrade the copy — the failure mode of matching the message text (option A).
 */

/** The reason a purchase was refused, as the SERVER states it. */
export type PurchaseRefusal =
  | { readonly kind: 'insufficient_funds'; readonly needed: number; readonly available: number; readonly shortBy: number }
  | { readonly kind: 'rate_limited' }
  | { readonly kind: 'unknown_item'; readonly itemCode: string }
  | { readonly kind: 'unpriced_item'; readonly itemCode: string }
  | { readonly kind: 'idempotency_key_reused' }
  | { readonly kind: 'bad_idempotency_key' }
  | { readonly kind: 'not_signed_in' };

/** Every `refusal` value this build understands. ⚠️ Mirrors the migration's `json_build_object` calls. */
export const REFUSAL_KINDS = [
  'insufficient_funds', 'rate_limited', 'unknown_item', 'unpriced_item',
  'idempotency_key_reused', 'bad_idempotency_key', 'not_signed_in',
] as const;

/**
 * The typed refusal in `DETAIL`, or `null` when there is none.
 *
 * ⚠️ **`null` is a real answer, not a failure**: an UNEXPECTED error (a dropped connection, a constraint
 * nobody anticipated) carries no detail, and the UI must fall back to its own generic copy rather than
 * printing a database message. ⚠️ Anything malformed — bad JSON, an unknown kind, a missing number — is also
 * `null`, because a half-understood refusal is worse than an honest "that did not work".
 */
export function parseRefusal(details: unknown): PurchaseRefusal | null {
  if (typeof details !== 'string' || details.trim().length === 0) return null;
  let body: unknown;
  try {
    body = JSON.parse(details);
  } catch {
    return null;
  }
  if (typeof body !== 'object' || body === null) return null;
  const row = body as Record<string, unknown>;
  const kind = row.refusal;
  if (typeof kind !== 'string') return null;
  if (!(REFUSAL_KINDS as readonly string[]).includes(kind)) return null;

  const int = (key: string): number | null => {
    const v = row[key];
    return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null;
  };
  const code = typeof row.item_code === 'string' ? row.item_code : null;

  switch (kind) {
    case 'insufficient_funds': {
      const needed = int('needed');
      const available = int('available');
      /** ⚠️ Both numbers or nothing — copy that quotes a `NaN` is the class of defect this project avoids. */
      if (needed === null || available === null) return null;
      const shortBy = int('short_by') ?? Math.max(needed - available, 0);
      return { kind: 'insufficient_funds', needed, available, shortBy };
    }
    case 'rate_limited':
      return { kind: 'rate_limited' };
    case 'unknown_item':
      return code === null ? null : { kind: 'unknown_item', itemCode: code };
    case 'unpriced_item':
      return code === null ? null : { kind: 'unpriced_item', itemCode: code };
    case 'idempotency_key_reused':
      return { kind: 'idempotency_key_reused' };
    case 'bad_idempotency_key':
      return { kind: 'bad_idempotency_key' };
    case 'not_signed_in':
      return { kind: 'not_signed_in' };
    default:
      return null;
  }
}
