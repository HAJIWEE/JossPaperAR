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

/**
 * ── THE PREPARING SCREEN'S VERDICT: the anti-hang decision ──────────────────
 *
 * `requestCartoonize` answers immediately, but the job it reports may still be in
 * flight. The orchestrator returns the EXISTING row (`already_requested: true`)
 * when the job for this capture is no longer `queued` — and that row can be
 * `processing`/`running`. `eventsFromResponse` reports that correctly as
 * `CART_DRAFT`: *"a job exists and is legitimately in flight. The offering waits;
 * the UI polls."*
 *
 * ⚠️ THE SCREEN DID NEITHER. `preparing.tsx` had no branch for `CART_DRAFT` at
 * all, so `phase` stayed `{ kind: 'working' }` and the spinner span FOREVER — no
 * poll, no timeout, no error, and no way out but killing the app. It is reachable
 * whenever the first request's answer is lost (a timeout, a killed app) and the
 * offering is retried: the retry then lands on a job that is already running.
 *
 * This function exists so the decision is PURE and therefore assertable — the same
 * reason `eventsFromResponse` lives here rather than inside the screen. Its
 * contract is the fix:
 *
 *   · every outcome resolves to something the UI can RENDER, and
 *   · `'again'` is only ever returned while a bound remains — so the poll loop
 *     terminates by construction, whatever the server says.
 *
 * The bound lives here (it is the decision); the poll interval lives in the screen
 * (it is presentation). Re-asking is FREE and cannot double-charge:
 * `request_cartoonize` is idempotent per capture (`unique(capture_id)`), and the
 * orchestrator short-circuits any job that is no longer `queued`, so a repeat call
 * returns the existing row without ever reaching the provider.
 */

/** How many times the preparing screen may re-ask before it stops waiting. */
export const MAX_PROBES = 20;

export type ProbeVerdict =
  /** A sprite exists — go on to the fire. */
  | 'done'
  /** Rule ③: parked by the budget stop-rule. Free, and worth retrying. */
  | 'parked'
  /** Rule ②: the capture is spent — only a NEW capture can continue. */
  | 'spent'
  /** Nothing to wait for: show the retry affordance. */
  | 'retriable'
  /** Legitimately in flight and the bound has not been reached: poll again. */
  | 'again';

export function probeVerdict(
  outcome: Outcome,
  probesMade: number,
  maxProbes: number = MAX_PROBES,
): ProbeVerdict {
  // The request never got an answer (or was refused): nothing is in flight on
  // this client's behalf, so waiting would be waiting for nothing.
  if (outcome.kind === 'transient') return 'retriable';

  const event = outcome.events[0];
  switch (event?.type) {
    case 'BUDGET_PARKED':
      return 'parked';
    case 'GENERATION_FAILED':
      return 'spent';
    case 'STYLED':
      return 'done';
    case 'CART_DRAFT':
      return probesMade < maxProbes ? 'again' : 'retriable';
    default:
      // ⚠️ An explicit `default`, NOT a fall-through to 'again'. An empty event
      // list, or an event type this build does not know, must RESOLVE. Falling
      // through would hang the spinner on exactly the response nobody
      // anticipated — which is how the original defect survived review.
      return 'retriable';
  }
}

/**
 * ── THE UPLOAD'S VERDICT: did the PHOTO fail, or did the NETWORK? ───────────
 *
 * ⚠️ SCRUM-124 AC 3, and it is not cosmetic. `/preparing` used to mark EVERY
 * upload failure `spent` — the branch whose own comment says *"the capture is
 * spent, offering a retry would be a lie"* — and show *"This offering cannot be
 * prepared · Offer a new photo"* for both. So a momentary network blip during the
 * upload threw away a perfectly good offering and told the player to photograph
 * the object again. The two causes are not the same event and must not share copy:
 *
 *   unusable → the SAME photo cannot succeed. Storage refused the bytes on a
 *              ground that does not change between attempts (too large, wrong
 *              MIME), or the client's own shrink loop gave up. A new capture is
 *              genuinely the only way on — which is what `spent` MEANS.
 *   retry    → nothing about the photo is wrong: a dropped connection, a 5xx, or
 *              a session that needs re-adopting. `registerCapture` now tolerates
 *              a duplicate key, so re-running the whole step is safe and free.
 *
 * ⚠️ THE DEFAULT IS `retry`, deliberately. An unrecognised failure must never be
 * allowed to DESTROY an offering: waiting one more round costs nothing, while
 * telling a player their photo is unusable when it is not is unrecoverable (the
 * object has usually been put away by then).
 */

export type UploadVerdict = 'unusable' | 'retry';

/**
 * The parts of a failure that decide the verdict — a message and a status, never
 * the bytes. Shaped to accept Supabase's `StorageError` (`status` · `statusCode`)
 * and `StorageApiError` (`code`) without this module importing either: keeping it
 * structurally typed is what keeps this file loadable under plain Node.
 */
export interface UploadFailureSignal {
  readonly status?: number;
  readonly statusCode?: string;
  readonly code?: string;
  readonly message?: string;
}

/**
 * The service's own error codes for "these bytes can never be accepted"
 * (supabase.com/docs/guides/storage/debugging/error-codes). `capture_unusable` is
 * OURS — it is what the client's shrink loop reports when it gives up.
 */
const UNUSABLE_UPLOAD_CODES = new Set([
  'EntityTooLarge',
  'PayloadTooLarge',
  'InvalidMimeType',
  'invalid_mime_type',
  'capture_unusable',
]);

/**
 * Message fallbacks, lower-cased. ⚠️ These duplicate the codes ON PURPOSE: the
 * 413 the PM hit on glass arrived as *"The object exceeded the maximum allowed
 * size"* with the code absent, so keying only on codes would have classified the
 * one failure we have actually seen as retryable.
 */
const UNUSABLE_UPLOAD_PATTERNS = [
  'payload too large',
  'exceeded the maximum allowed size',
  'entity too large',
  'mime type',
];

export function uploadFailureVerdict(failure: UploadFailureSignal): UploadVerdict {
  // ⚠️ MEASURED (2026-10-17, local storage API): the too-large refusal arrives as
  // **HTTP 400 with `statusCode: "413"`** — NOT as an HTTP 413. So the numeric
  // status is only the fallback; `statusCode` is the field that actually carries
  // it. Checking `status` alone was near-dead code that the message patterns
  // happened to rescue.
  if (failure.status === 413 || failure.statusCode === '413') return 'unusable';

  if (failure.code && UNUSABLE_UPLOAD_CODES.has(failure.code)) return 'unusable';
  if (failure.statusCode && UNUSABLE_UPLOAD_CODES.has(failure.statusCode)) return 'unusable';

  const message = (failure.message ?? '').toLowerCase();
  if (UNUSABLE_UPLOAD_PATTERNS.some((pattern) => message.includes(pattern))) return 'unusable';

  // Everything else — offline, DNS, TLS, a 5xx, an expired session — leaves the
  // photo intact. Re-running the step is free and is the honest next action.
  return 'retry';
}

/**
 * ── IS THE OBJECT ALREADY THERE? (the upload's idempotency test) ────────────
 *
 * ⚠️ FOUND ON GLASS (2026-10-17, SCRUM-124 device run) — and it is the reason
 * **the retry could never actually succeed.**
 *
 * The upload used `upsert: true` with a comment promising that "re-uploading the
 * same bytes must not 409 and strand an offering whose row is already
 * committed". ⚠️ **But an upsert is `INSERT … ON CONFLICT DO UPDATE`, and the
 * `captures` bucket has only INSERT and SELECT policies — no UPDATE.** So on the
 * SECOND attempt, against an object that already exists, Storage answers:
 *
 *     {"statusCode":"403","error":"Unauthorized","code":"AccessDenied",
 *      "message":"new row violates row-level security policy"}
 *
 * …and the retry died at the upload step, every time, for ever. The measured
 * matrix (a real call each, against the local stack):
 *
 *     object ABSENT, upsert omitted  → 200  {"Key":"captures/…","Id":"…"}
 *     object EXISTS, upsert omitted   → 409  {"code":"KeyAlreadyExists",
 *                                             "message":"The resource already exists"}
 *     object EXISTS, x-upsert: true   → 403  {"code":"AccessDenied", …RLS…}
 *
 * So the fix is to send NO upsert and treat the 409 as the SUCCESS it is: the
 * object is present and holds the same bytes (same source photo, deterministic
 * resize), which is exactly the state the caller wanted. ⚠️ **This is the same
 * idempotency lesson as `registerCapture`'s `23505`, on the other half of the
 * step** — and it deliberately does NOT widen storage permissions to make
 * `upsert` legal, because a client that can rewrite its own raw capture is a
 * bigger change than an upload that declines to rewrite identical bytes.
 */
const ALREADY_PRESENT_CODES = new Set(['KeyAlreadyExists', 'Duplicate', 'ResourceAlreadyExists']);

export function uploadAlreadyPresent(failure: UploadFailureSignal): boolean {
  // ⚠️ `statusCode`, NOT `status` — the measured duplicate is HTTP **400** with
  // `statusCode: "409"`, so keying on the numeric status would miss it entirely.
  if (failure.statusCode === '409') return true;
  if (failure.code && ALREADY_PRESENT_CODES.has(failure.code)) return true;
  return (failure.message ?? '').toLowerCase().includes('already exists');
}
