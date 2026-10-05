/**
 * HTTP plumbing for the Edge Functions — CORS, JSON, and one honest error map.
 *
 * The map matters more than it looks: the client must never render a raw
 * Postgres error (doc 11 §5 — "a rate-limited user should see *shrine busy*
 * language, not *429*"). Each error surface therefore carries a stable
 * `code` the client turns into copy, and an HTTP status for the transport.
 */

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, idempotency-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function preflight(): Response {
  return new Response('ok', { headers: corsHeaders });
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** The error shape the client switches on. `code` is the contract. */
export interface ErrorBody {
  readonly error: string;
  readonly code: string;
  readonly detail?: string;
}

export function fail(code: string, status: number, detail?: string): Response {
  const body: ErrorBody = detail ? { error: code, code, detail } : { error: code, code };
  return json(body, status);
}

/**
 * Turn a Postgres/RPC error into an HTTP status plus a stable code.
 *
 * The SQLSTATEs come from the RPCs themselves (see the migrations):
 *   42501 not yours / not signed in        → 403 forbidden
 *   23505 already exists (replayed id)     → 409 conflict
 *   22000 payload mismatch                 → 400 bad_request
 *   22023 bad argument                     → 400 bad_request
 *   P0001 raised business rule             → 429 busy / spent, else 400
 */
export function rpcErrorToHttp(error: { code?: string | null; message?: string | null } | null): {
  status: number;
  code: string;
} {
  const sqlstate = (error?.code ?? '').toUpperCase();
  const message = (error?.message ?? '').toLowerCase();

  switch (sqlstate) {
    case '42501':
      return { status: 403, code: 'forbidden' };
    case '23505':
      return { status: 409, code: 'conflict' };
    case '22000':
      return { status: 400, code: 'idempotency_payload_mismatch' };
    case '22023':
      return { status: 400, code: 'bad_request' };
    case 'P0001':
      if (message.includes('busy')) return { status: 429, code: 'shrine_busy' };
      if (message.includes('allowance is complete')) {
        return { status: 429, code: 'allowance_spent' };
      }
      if (message.includes('ceiling') || message.includes('could not be consumed')) {
        return { status: 409, code: 'refused' };
      }
      return { status: 400, code: 'refused' };
    default:
      return { status: 500, code: 'internal' };
  }
}

/**
 * Read the caller's JWT from the Authorization header. Returns null when the
 * header is missing or is not a bearer token — never a partial value.
 */
export function bearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization') ?? req.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

/** The Idempotency-Key header (doc 19 §3.1 F2). */
export function idempotencyKey(req: Request): string | null {
  return req.headers.get('Idempotency-Key') ?? req.headers.get('idempotency-key');
}
