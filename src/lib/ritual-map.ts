/**
 * ritual-map.ts — the PURE half of the service layer.
 *
 * Its whole job is to turn **server responses** into **events on the offering
 * state machine**. That is deliberate: `src/domain/slice.ts` already encodes the
 * three client rules as a pure function, and every rule the live project taught
 * us (doc 19 §12/§12.5) lives there. This module's job is NOT to decide what
 * those rules mean — it is to report faithfully what the server said and let
 * the machine decide what it means.
 *
 * ⚠️ WHY IT IS A SEPARATE FILE: it imports NOTHING native, so `check:lib` can
 * assert the whole mapping with no network, no API key and no React Native
 * runtime (the same reason `queue.ts` takes an injected driver and
 * `split-storage.ts` takes injected stores). The half that needs the device —
 * the fetch, the session, `supabase.ts` — lives in `ritual.ts` beside it. If
 * these two are ever merged, the mapping silently stops being assertable.
 *
 * THE THREE OUTCOMES, AND WHY EACH IS NOT OBVIOUS
 *
 *   `styled`  → STYLED. The sprite exists. Straightforward.
 *   `queued`  → BUDGET_PARKED (rule ③). The orchestrator answers **HTTP 200**
 *               with `code: 'shrine_busy'` when the day's AI budget is spent.
 *               That is a *success* code carrying a *parked* job — treating it
 *               as an error would show the player a failure for a system
 *               working exactly as designed (SCRUM-59 / ADR-006).
 *   `failed`  → GENERATION_FAILED (rule ②). The capture is SPENT: `unique(
 *               capture_id)` means the same offering can never be re-requested,
 *               so the only way forward is a NEW capture. This is the one place
 *               it is tempting to offer a "retry" button, and doing so would
 *               either double-charge or silently fail.
 *
 * WHAT IT DOES NOT DO
 *
 * It never decides a band (ADR-005 — the client asserts only `accuracy`, the
 * server derives everything else) and it never writes money (`award-service` is
 * the only writer). It reports; the machine decides.
 */

import type { SliceEvent } from '../domain/slice.ts';

/** What the orchestrator can answer. Anything else is a failure. */
export type JobStatus = 'queued' | 'processing' | 'styled' | 'failed' | 'rejected';

export interface OrchestratorResponse {
  readonly job_id: string;
  readonly status: string;
  /** Rule ③: present and true when the AI-budget stop-rule parked the job. */
  readonly queued?: boolean;
  /** Rule ③: the code the client keys its copy off — 'shrine_busy'. */
  readonly code?: string;
  readonly styled_path?: string;
  readonly already_requested?: boolean;
}

export type Outcome =
  | { readonly kind: 'ok'; readonly events: readonly SliceEvent[]; readonly jobId: string }
  /**
   * The request itself could not be made — offline, a 5xx, an unparseable body.
   * ⚠️ This is NOT rule ②: no generation was attempted, so no capture was spent
   * and the offering is intact. Reporting it as GENERATION_FAILED would tell the
   * player to re-capture for a problem that never reached the server.
   */
  | { readonly kind: 'transient'; readonly reason: string };

/**
 * Map an orchestrator response onto state-machine events.
 *
 * PURE and exported separately from the fetch, so the mapping is assertable
 * without a network or an API key — which is how `check:slice` proves that a
 * `shrine_busy` becomes a PARK rather than a failure.
 */
export function eventsFromResponse(res: OrchestratorResponse): readonly SliceEvent[] {
  // Rule ③ FIRST. `shrine_busy` also carries `status: 'queued'`, so testing the
  // status before the code would file a parked job as a plain queued draft and
  // lose the fact that the budget — not the offer — stopped it.
  if (res.queued === true || res.code === 'shrine_busy') {
    return [{ type: 'BUDGET_PARKED' }];
  }

  const status = String(res.status ?? '').toLowerCase();

  if (status === 'styled' || status === 'completed') {
    return [{ type: 'STYLED', spritePath: res.styled_path ?? `styled/${res.job_id}` }];
  }

  if (status === 'failed' || status === 'rejected' || status === 'error') {
    // Rule ② — the capture is spent. `nextAction` will return 'recapture'.
    return [{ type: 'GENERATION_FAILED' }];
  }

  // 'queued' / 'processing' — a job exists and is legitimately in flight. The
  // offering waits; the UI polls. NOT a park, NOT a failure.
  return [{ type: 'CART_DRAFT' }];
}

/**
 * Failure codes that mean "the request never got an answer", as opposed to a
 * refusal the server understood and meant. The two must not be conflated: a
 * transport failure leaves the capture UNSPENT, so the offering is still whole.
 */
const TRANSPORT_CODES = new Set([
  'not_authenticated',
  'network_error',
  'service_unavailable',
  'bad_response',
  'too_many_requests',
  'timeout',
]);

/** True when a server error code is a transport problem, not a real refusal. */
export function isTransportCode(code: string): boolean {
  return TRANSPORT_CODES.has(code);
}

/**
 * The reason string for a non-2xx answer: the server's own `code` when it sent
 * one, otherwise `http_<status>`. Surfaced (not swallowed) so the screen and the
 * log can tell "the daily quota is spent" from "the network blinked".
 */
export function httpFailureReason(status: number, body: unknown): string {
  const code = (body as { code?: unknown } | null | undefined)?.code;
  if (typeof code === 'string' && code.trim().length > 0) return code.trim();
  return `http_${status}`;
}

/**
 * Map a non-2xx HTTP answer onto an `Outcome`.
 *
 * ⚠️ THIS FUNCTION IS THE FIX FOR A REAL DEFECT (found 2026-10-06). The branch it
 * replaces read:
 *
 *     if (!res.ok) return { kind: 'ok', jobId: 'x', events: [{ type: 'GENERATION_FAILED' }] };
 *
 * …which its own comment contradicted ("the capture was NOT spent") and which
 * broke two things at once:
 *
 *   • it reported **`kind: 'ok'` with a fake job id**, so the caller's transient
 *     handling was bypassed entirely and a `job_id` of `'x'` was invented;
 *   • it emitted **`GENERATION_FAILED`**, which sets `needsRecapture` — telling the
 *     player to photograph a *new* offering after a 500 or an exhausted daily
 *     quota. Nothing had been spent, and the offering they already had was valid.
 *
 * Rule ② belongs to a generation that actually **ran** and failed, and that
 * arrives on the **2xx** path (`status: 'failed' | 'rejected'`). A refusal — a
 * 4xx the server meant, or a 5xx it did not — never is one, so this returns
 * `transient` with the server's code and leaves the offering whole.
 */
export function outcomeFromHttpFailure(status: number, body: unknown): Outcome {
  return { kind: 'transient', reason: httpFailureReason(status, body) };
}
