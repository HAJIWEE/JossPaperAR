/**
 * ritual.ts — the DEVICE half of the service layer: the authenticated call.
 *
 * The decisions live in `ritual-map.ts`; this file only fetches and hands the
 * body over. Keeping them apart is what lets `check:lib` prove rule ③ without a
 * session (see that file's header).
 */

import { eventsFromResponse, outcomeFromHttpFailure, type Outcome, type OrchestratorResponse } from './ritual-map.ts';
import { captureStoragePath } from './storage-path.ts';
import { supabase, supabaseConfig } from './supabase.ts';

export { eventsFromResponse, httpFailureReason, isTransportCode, outcomeFromHttpFailure, type Outcome, type OrchestratorResponse } from './ritual-map.ts';

/**
 * Ask the orchestrator to prepare the offering under the client-minted id.
 *
 * The id was minted BEFORE the upload (rule ①), so this call and the upload
 * agree on which row they are talking about — there is no server-created row to
 * adopt afterwards.
 */
export async function requestCartoonize(
  captureId: string,
  opts: { signal?: AbortSignal } = {},
): Promise<Outcome> {
  let token: string | undefined;
  let base: string;
  try {
    // ⚠️ `supabaseConfig()`, NOT `supabase().supabaseUrl` — that property is
    // `protected` on SupabaseClient and tsc rejects it. Caught by fault-testing.
    base = supabaseConfig().url;
    const { data } = await supabase().auth.getSession();
    token = data.session?.access_token;
  } catch {
    return { kind: 'transient', reason: 'not_authenticated' };
  }
  if (!token) return { kind: 'transient', reason: 'not_authenticated' };

  let res: Response;
  try {
    res = await fetch(`${base}/functions/v1/cartoonize-orchestrator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ capture_id: captureId }),
      ...(opts.signal ? { signal: opts.signal } : {}),
    });
  } catch {
    // Offline, DNS, TLS, timeout. Nothing reached the server, so nothing was
    // spent — this must NOT be reported as a failed generation.
    return { kind: 'transient', reason: 'network_error' };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { kind: 'transient', reason: 'bad_response' };
  }

  if (!res.ok) {
    // ⚠️ FIXED 2026-10-06. This branch used to return
    // `{ kind: 'ok', jobId: 'x', events: [{ type: 'GENERATION_FAILED' }] }` —
    // a fake job id plus rule ②'s event, contradicting its own comment that the
    // capture was NOT spent. A 5xx, or a 4xx the server meant (quota complete,
    // capture not found), would therefore have told the player to photograph a
    // new offering. No job is created on a non-2xx, so nothing is spent and the
    // offering is intact: this is transient, carrying the server's own code.
    // The classification is pure and checked — see `check:wire`.
    return outcomeFromHttpFailure(res.status, body);
  }

  const parsed = body as OrchestratorResponse;
  if (!parsed?.job_id) return { kind: 'transient', reason: 'bad_response' };

  return { kind: 'ok', jobId: parsed.job_id, events: eventsFromResponse(parsed) };
}
/**
 * Register the capture row under the id minted on the screen (rule ①).
 *
 * ⚠️ WHY THE CLIENT INSERTS THIS ROW: `captures.id` is the primary key, and the
 * id was minted BEFORE the photo was taken so that a failed generation could be
 * replaced by a genuinely new one. If the server minted the id, that guarantee
 * would be gone — the client would have to adopt whatever the server chose.
 * RLS (`captures_insert_own`, `with check (user_id = auth.uid())`) is what makes
 * this safe: a client can only ever insert its own row, and there is
 * deliberately NO client UPDATE policy — `status` and `moderation` belong to the
 * orchestrator alone.
 *
 * `storage_path` is derived here, not passed in, so it cannot disagree with the
 * key the upload writes to: one source of truth for the path.
 */
// `captureStoragePath` lives in the PURE `storage-path.ts` (imported above) so the
// dependency-free `check:wire` can assert the key shape without the native client.

/** Insert the capture row. Returns the user id it was written under. */
export async function registerCapture(captureId: string): Promise<{ userId: string }> {
  const { data: userData, error: userError } = await supabase().auth.getUser();
  const userId = userData.user?.id;
  if (userError || !userId) throw new Error('not_authenticated');

  const { error } = await supabase().from('captures').insert({
    id: captureId,
    user_id: userId,
    storage_path: captureStoragePath(userId, captureId),
    status: 'pending',
  });
  if (error) throw new Error(`capture_insert_failed: ${error.message}`);
  return { userId };
}

/**
 * Upload the photo bytes into the private `captures` bucket.
 *
 * The object lands at exactly `captureStoragePath(...)` — the same string the row
 * records — because the orchestrator later signs that path and hands it to the
 * provider. If the two ever disagreed, the failure would surface as an opaque
 * provider 404 after the money was already spent, which is why the path is
 * computed by one function rather than written twice.
 */
export async function uploadCapture(
  userId: string,
  captureId: string,
  fileUri: string,
): Promise<{ path: string }> {
  const path = captureStoragePath(userId, captureId);

  // ⚠️ FOUND ON GLASS (2026-10-07) — this path had never actually run (the S31
  // attempt died at auth), and it failed twice before it worked:
  //  ① the old code read `fetch(uri).text().split(',')[1]` as if the uri were a
  //     `data:` URI, but `takePictureAsync` returns a `file://` uri — so the
  //     "base64" was garbage and nothing uploaded;
  //  ② RN Blobs carry an EMPTY type, and the `captures` bucket allows only
  //     image/*; an untyped Blob uploads as `text/plain` and is REJECTED
  //     ("mime type text/plain is not supported"). Re-wrap with an explicit type.
  // The bytes go up AS A BLOB (RN fetch's array-buffer form is not reliable
  // across platforms); the bucket's file_size_limit enforces 300 KB regardless.
  const res = await fetch(fileUri);
  const raw = await res.blob();
  const blob = raw.type === 'image/jpeg' ? raw : new Blob([raw], { type: 'image/jpeg' });

  const { error } = await supabase().storage.from('captures').upload(path, blob, {
    contentType: 'image/jpeg',
    // The row already exists (rule ①); re-uploading the same bytes must not 409
    // and strand an offering whose row is already committed.
    upsert: true,
  });
  if (error) throw new Error(`capture_upload_failed: ${error.message}`);
  return { path };
}

/**
 * The receipt `award-service` returns — the ONLY source of the band and award.
 *
 * ⚠️ The client already graded this throw locally for the preview. It is NOT
 * what is shown as earned: this receipt is. ADR-005 gives the server sole
 * authority over the band, so `submitBurn` returns what the server said and the
 * screen displays that, never the local preview. A disagreement between the two
 * is therefore visible rather than silently papered over.
 */
export interface BurnReceipt {
  readonly band: string;
  readonly multiplier: number;
  readonly award: number;
  readonly new_ground: boolean;
  readonly streak_day: number | null;
  /** True when the integrity clamp bound the award (doc 11 §2). */
  readonly clamped: boolean;
  readonly kind: string;
  readonly tribute_balance: number;
  /** True when this exact `idempotency_key` had already been paid. */
  readonly idempotent_replay: boolean;
  readonly burn_id: string;
}

export type SubmitResult =
  | { readonly kind: 'ok'; readonly receipt: BurnReceipt }
  /**
   * The award was not written. Nothing was banked, so the offering is still
   * whole and the throw may be repeated — with the SAME idempotency key, which
   * is what makes a repeat safe (doc 14 N6: one key, one award, forever).
   */
  | { readonly kind: 'transient'; readonly reason: string };

/**
 * Submit the burn. `accuracy` is the px offset; the band is NEVER sent — the
 * function strips a client-supplied `band` anyway (ADR-005), and this never
 * constructs one.
 *
 * ⚠️ The `idempotency_key` is derived from the capture id and the THROW NUMBER,
 * not generated fresh per attempt. That is what makes a network retry safe: the
 * same throw replayed carries the same key, so the server recognises it and
 * pays once. A fresh key per retry would turn a dropped connection into a second
 * award for one throw.
 *
 * ⚠️ `clanId` is REQUIRED by `submit_burn` (SCRUM-82): the burn is clan-scoped,
 * and the server refuses without it. The caller obtains one via `ensureClan()`.
 */
export async function submitBurn(
  captureId: string,
  accuracyPx: number,
  throwNumber: number,
  clanId: string,
  opts: { signal?: AbortSignal } = {},
): Promise<SubmitResult> {
  if (!Number.isFinite(accuracyPx) || accuracyPx < 0) {
    // aim.ts refuses a negative/NaN offset rather than grading it, and so does
    // the server. Catching it here turns a 500 into a no-op.
    return { kind: 'transient', reason: 'accuracy must be a finite, non-negative px offset' };
  }
  if (typeof clanId !== 'string' || clanId.length === 0) {
    // submit_burn requires a clan_id (SCRUM-82). Failing here costs nothing —
    // no request is sent — and is honest about why.
    return { kind: 'transient', reason: 'clan_required' };
  }

  let token: string | undefined;
  let base: string;
  try {
    base = supabaseConfig().url;
    const { data } = await supabase().auth.getSession();
    token = data.session?.access_token;
  } catch {
    return { kind: 'transient', reason: 'not_authenticated' };
  }
  if (!token) return { kind: 'transient', reason: 'not_authenticated' };

  const idempotencyKey = `burn:${captureId}:${throwNumber}`;

  let res: Response;
  try {
    res = await fetch(`${base}/functions/v1/award-service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The award path takes its idempotency key in this header, not the body.
        'Idempotency-Key': idempotencyKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ capture_id: captureId, accuracy: accuracyPx, clan_id: clanId }),
      ...(opts.signal ? { signal: opts.signal } : {}),
    });
  } catch {
    return { kind: 'transient', reason: 'network_error' };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { kind: 'transient', reason: 'bad_response' };
  }

  if (!res.ok) return { kind: 'transient', reason: (body as { code?: string })?.code ?? 'bad_response' };

  const receipt = body as BurnReceipt;
  // A receipt without an award is not a receipt. Better a retry than a screen
  // that reads "0" and sends the player away thinking they earned nothing.
  if (typeof receipt?.award !== 'number' || typeof receipt.burn_id !== 'string') {
    return { kind: 'transient', reason: 'bad_response' };
  }
  return { kind: 'ok', receipt };
}
