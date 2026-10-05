/**
 * ritual.ts — the DEVICE half of the service layer: the authenticated call.
 *
 * The decisions live in `ritual-map.ts`; this file only fetches and hands the
 * body over. Keeping them apart is what lets `check:lib` prove rule ③ without a
 * session (see that file's header).
 */

import { eventsFromResponse, type Outcome, type OrchestratorResponse } from './ritual-map.ts';
import { supabase, supabaseConfig } from './supabase.ts';

export { eventsFromResponse, isTransportCode, type Outcome, type OrchestratorResponse } from './ritual-map.ts';

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
    // A 4xx/5xx that is not an auth problem means the request was understood
    // and refused (quota complete, capture not found, server error). The
    // capture was NOT spent — `request_cartoonize` never got as far as a job.
    return { kind: 'ok', jobId: 'x', events: [{ type: 'GENERATION_FAILED' }] };
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
export function captureStoragePath(userId: string, captureId: string): string {
  return `captures/${userId}/${captureId}.jpg`;
}

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

  // React Native has no `fetch(uri).blob()` for file:// URIs on every platform,
  // so the array-buffer form is used and the bytes are wrapped by hand. RN's
  // fetch returns base64 for a data URI, which is why it is decoded here rather
  // than sent as-is.
  const res = await fetch(fileUri);
  const base64 = (await res.text()).split(',')[1] ?? '';

  const { error } = await supabase().storage.from('captures').upload(path, base64ToBytes(base64), {
    contentType: 'image/jpeg',
    // The row already exists (rule ①); re-uploading the same bytes must not 409
    // and strand an offering whose row is already committed.
    upsert: true,
  });
  if (error) throw new Error(`capture_upload_failed: ${error.message}`);
  return { path };
}

/** Decode base64 into bytes for the storage upload. */
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
