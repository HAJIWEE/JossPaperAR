/**
 * ═══ award-service — THE ONLY WRITER OF MONEY (doc 19 §3.1 F2) ═════════════
 *
 * `POST /functions/v1/award-service`, header `Idempotency-Key: <key>`, body:
 *
 *   { capture_id | item_code, clan_id, ancestor_id?, accuracy,
 *     cell_hash?, client_time? }
 *
 * It does exactly four things, in this order:
 *
 *   1. VERIFY THE CALLER with the user's own JWT (publishable key + RLS).
 *   2. STRIP the two things a client must never be able to supply: `band`
 *      (ADR-005 — the server derives it) and any `actor`.
 *   3. CALL `submit_burn` with the service role. That transaction is where the
 *      award is computed, clamped and ledgered — and its EXECUTE grant is
 *      revoked from anon/authenticated, so THIS function is the only way in.
 *      "Only award-service writes money" is enforced by GRANT, not convention.
 *   4. RETURN the receipt untouched, or map the Postgres error to a stable
 *      `code` the client turns into copy ("shrine busy", not "429").
 *
 * It deliberately knows nothing about the award formula: the maths lives in the
 * database (and in src/domain/award.ts, which the domain check guards), so
 * there is exactly one implementation of it.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { publishableKey, secretKey, supabaseUrl } from '../_shared/env.ts';
import {
  bearerToken,
  fail,
  idempotencyKey,
  json,
  preflight,
  rpcErrorToHttp,
} from '../_shared/http.ts';

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') return fail('method_not_allowed', 405);

  const token = bearerToken(request);
  if (!token) return fail('not_authenticated', 401);

  const key = idempotencyKey(request);
  if (!key) return fail('idempotency_key_required', 400);

  // ── 1 · who is this, really? ─────────────────────────────────────────────
  const asUser = createClient(supabaseUrl(), publishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await asUser.auth.getUser(token);
  if (authError || !authData?.user) return fail('not_authenticated', 401);

  // ── 2 · the body — accept the assertion, refuse the conclusion ───────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('bad_request', 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('bad_request', 400);
  }

  const payload = { ...(body as Record<string, unknown>) };
  delete payload.band;    // ADR-005: the server derives it from `accuracy`
  delete payload.actor;   // never client-supplied
  delete payload.user_id; // ditto — the actor is resolved from the JWT

  // ── 3 · the one transaction that writes money ────────────────────────────
  const admin = createClient(supabaseUrl(), secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc('submit_burn', {
    p_actor: authData.user.id,
    p_payload: payload,
    p_idempotency_key: key,
  });

  if (error) {
    const { status, code } = rpcErrorToHttp(error);
    // the message is surfaced for the developer, never as UI copy
    return fail(code, status, error.message);
  }

  // ── 4 · the receipt, untouched ───────────────────────────────────────────
  return json(data);
});
