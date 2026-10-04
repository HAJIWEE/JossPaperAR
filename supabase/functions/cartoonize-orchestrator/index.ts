/**
 * ═══ cartoonize-orchestrator — the Path C pipeline (doc 19 §3.1 F1) ═════════
 *
 * `POST /functions/v1/cartoonize-orchestrator`, body `{ capture_id }`.
 * Returns `{ job_id, status, styled_path? }`.
 *
 *   1. verify the caller (their JWT)
 *   2. QUOTA GATE — `request_cartoonize`, idempotent per capture
 *      (unique(capture_id)), so a retried request cannot pay twice
 *   3. sign a short-lived URL for the private `captures` object
 *   4. run PATH C (ADR-002, locked): identify → zod-validate → generate
 *   5. moderation: a provider refusal marks the capture `rejected`
 *   6. upload the PNG into the private `styled` bucket — the bucket's own
 *      file_size_limit (150 KB) enforces the NFR sprite budget
 *   7. record status + `cost_micros` + `latency_ms` + `retries` on the job,
 *      which is how cost and latency are LEARNED in production (doc 07 §5.3)
 *
 * The FAL_KEY is read inside this runtime and never leaves it (doc 19 §4.4).
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { publishableKey, secretKey, supabaseUrl } from '../_shared/env.ts';
import { bearerToken, fail, json, preflight, rpcErrorToHttp } from '../_shared/http.ts';
import { type FalError, runPathC } from '../_shared/pathc.ts';

/** doc 19 §3.3 — the styled sprite budget (the bucket enforces it too). */
const STYLED_MAX_BYTES = 153_600;

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') return fail('method_not_allowed', 405);

  const token = bearerToken(request);
  if (!token) return fail('not_authenticated', 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('bad_request', 400);
  }
  const captureId = (body as { capture_id?: unknown } | null)?.capture_id;
  if (typeof captureId !== 'string' || captureId.length === 0) {
    return fail('capture_id_required', 400);
  }

  // ── 1 · the caller ───────────────────────────────────────────────────────
  const asUser = createClient(supabaseUrl(), publishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await asUser.auth.getUser(token);
  if (authError || !authData?.user) return fail('not_authenticated', 401);
  const userId = authData.user.id;

  const admin = createClient(supabaseUrl(), secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── 2 · the quota gate (service-role only; idempotent per capture) ───────
  const { data: job, error: gateError } = await admin.rpc('request_cartoonize', {
    p_actor: userId,
    p_capture_id: captureId,
  });
  if (gateError) {
    const { status, code } = rpcErrorToHttp(gateError);
    return fail(code, status, gateError.message);
  }

  const jobRow = job as {
    job_id: string;
    status: string;
    already_requested?: boolean;
    budget_exhausted?: boolean;
    spend_micros_today?: number;
    budget_micros?: number;
  };

  // ── THE STOP-RULE (SCRUM-59 · doc 10 §4) ─────────────────────────────────
  // The day's AI budget is spent, so the job stays QUEUED and the PROVIDER IS
  // NOT CALLED. This is a 200, not an error: the offering is not lost — the
  // client shows the loading-ritual copy ("the shrine is receiving many
  // offerings…", `ritual_busy` in src/lib/i18n.ts) and the next request
  // re-checks the budget and proceeds the moment it opens.
  if (jobRow.budget_exhausted === true) {
    return json({
      job_id: jobRow.job_id,
      status: 'queued',
      queued: true,
      code: 'shrine_busy',
      spend_micros_today: jobRow.spend_micros_today ?? null,
      budget_micros: jobRow.budget_micros ?? null,
    });
  }

  if (jobRow.status !== 'queued') {
    // already asked for: return the existing job, never a second generation
    return json({ job_id: jobRow.job_id, status: jobRow.status, already_requested: true });
  }
  const jobId = jobRow.job_id;

  // ── 3 · the capture + a short-lived signed URL ───────────────────────────
  const { data: capture, error: captureError } = await admin
    .from('captures')
    .select('id, user_id, storage_path, status')
    .eq('id', captureId)
    .single();

  if (captureError || !capture) return fail('capture_not_found', 404, captureError?.message);
  if (capture.user_id !== userId) return fail('forbidden', 403);

  const { data: signed, error: signError } = await admin
    .storage.from('captures')
    .createSignedUrl(capture.storage_path, 600);
  if (signError || !signed?.signedUrl) {
    return fail('capture_unavailable', 500, signError?.message);
  }

  // ⚠️ VERIFIED THE HARD WAY: `createSignedUrl` can return a RELATIVE path
  // ('/object/sign/captures/…'), which fal cannot fetch — the identify call
  // then answers prose and the zod gate correctly refuses it, surfacing as
  // `extraction_unusable`. Normalise to an absolute URL so the pipeline can
  // actually see the photo.
  const imageUrl = signed.signedUrl.startsWith('http')
    ? signed.signedUrl
    : `${supabaseUrl()}/storage/v1${signed.signedUrl}`;

  await admin.from('cartoonize_jobs').update({ status: 'running' }).eq('id', jobId);

  // ── 4–7 · the pipeline, then the book-keeping ────────────────────────────
  // Held outside the try so a FAILURE can still report what the run COST —
  // a paid run whose spend is invisible is the one thing the job row exists to
  // prevent (doc 07 §5.3: "this is how we learn cost/burn").
  let paid: { costMicros: number; latencyMs: number; retries: number } | null = null;

  try {
    const result = await runPathC(imageUrl, (message) =>
      console.log(`[${jobId}] ${message}`));

    paid = {
      costMicros: result.costMicros,
      latencyMs: result.latencyMs,
      retries: result.retries,
    };

    const download = await fetch(result.styledUrl);
    if (!download.ok) {
      throw new Error(`could not download the generated sprite (${download.status})`);
    }
    const bytes = new Uint8Array(await download.arrayBuffer());
    if (bytes.byteLength > STYLED_MAX_BYTES) {
      // ⚠️ FOUND LIVE (2026-10-04): a 1K PNG from nano-banana-2 is ≈1.3 MB, so
      // the doc 14 §3 "≤150 KB sprite" budget is NOT reachable at 1K without a
      // resize/quantise stage. The check stays (an oversized sprite must never
      // be persisted) and the finding is recorded in doc 19 §12.
      throw new Error(
        `the sprite is ${bytes.byteLength} bytes — over the ${STYLED_MAX_BYTES}-byte budget`,
      );
    }

    const styledPath = `${userId}/${captureId}.${result.fileExtension}`;
    const { error: uploadError } = await admin.storage
      .from('styled')
      .upload(styledPath, bytes, { contentType: result.contentType, upsert: true });
    if (uploadError) throw new Error(`styled upload failed: ${uploadError.message}`);

    await admin.from('cartoonize_jobs').update({
      status: 'styled',
      cost_micros: result.costMicros,
      latency_ms: result.latencyMs,
      retries: result.retries,
      error: null,
    }).eq('id', jobId);

    await admin.from('captures').update({ status: 'styled' }).eq('id', captureId);

    return json({
      job_id: jobId,
      status: 'styled',
      styled_path: styledPath,
      latency_ms: result.latencyMs,
      cost_micros: result.costMicros,
      retries: result.retries,
      objects: result.objects,
    });
  } catch (caught) {
    const error = caught as FalError & { code?: string };

    if (error.moderation === true) {
      // doc 13 §6: the provider refused it BEFORE stylization — mark the
      // capture rejected; no image is kept beyond the 7-day raw window.
      await admin.from('cartoonize_jobs').update({
        status: 'rejected',
        error: 'provider_moderation',
      }).eq('id', jobId);
      await admin.from('captures').update({
        status: 'rejected',
        moderation: 'provider',
      }).eq('id', captureId);
      return fail('offering_cannot_be_prepared', 422);
    }

    const extractionFailed = error.code === 'extraction_unusable';
    await admin.from('cartoonize_jobs').update({
      status: 'failed',
      error: String(error.message ?? 'unknown').slice(0, 500),
      // a paid run records what it paid, even when the run fails
      ...(paid
        ? {
          cost_micros: paid.costMicros,
          latency_ms: paid.latencyMs,
          retries: paid.retries,
        }
        : {}),
    }).eq('id', jobId);

    // The capture stays 'pending', so the offering can be retried. No credit
    // refund is modelled yet — doc 10 §4's refund rule needs the funding model
    // that does not exist at alpha (a recorded PR finding).
    return fail(
      extractionFailed ? 'extraction_unusable' : 'generation_failed',
      extractionFailed ? 422 : 502,
      error.message,
    );
  }
});
