/**
 * Edge-Function environment access — SCRUM-54b (doc 19 §4.4).
 *
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE: **the client never sees a secret.**
 * Every value here is read from `Deno.env` inside the Edge runtime and is never
 * returned in a response, logged, or embedded in an error message.
 *
 * Supabase INJECTS the Supabase-owned variables into every Edge Function, and
 * any name starting with `SUPABASE_` is RESERVED — so nothing here is something
 * a human sets (doc 19 §4.4 correction #1). The modern
 * `SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS` are JSON dicts; the
 * legacy `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` are read as a
 * fallback because they keep working until end-2026.
 *
 * `FAL_KEY` is the ONLY variable a human supplies:
 *   local  → `supabase/functions/.env` (gitignored, auto-loaded)
 *   hosted → `supabase secrets set --env-file supabase/functions/.env`
 */

/** Pull `key` out of a Supabase JSON-dict env var, tolerating junk. */
function dictValue(raw: string | undefined, key: string): string | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.length > 0) return value;
    }
  } catch {
    // a malformed dict is not a crash — fall through to the legacy variable
  }
  return null;
}

export function supabaseUrl(): string {
  const value = Deno.env.get('SUPABASE_URL');
  if (!value) throw new Error('SUPABASE_URL is not set — the platform injects it');
  return value;
}

/** The client-safe key (RLS applies). Used only to verify a caller's JWT. */
export function publishableKey(): string {
  const value = dictValue(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'), 'default')
    ?? Deno.env.get('SUPABASE_ANON_KEY');
  if (!value) throw new Error('no publishable key available');
  return value;
}

/** The server-only key (BYPASSES RLS). Reaches the money-path RPCs and Storage. */
export function secretKey(): string {
  const value = dictValue(Deno.env.get('SUPABASE_SECRET_KEYS'), 'default')
    ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!value) throw new Error('no secret key available');
  return value;
}

/** The Path C API key — the only metered spend in the MVP (ADR-002). */
export function falKey(): string {
  const value = Deno.env.get('FAL_KEY');
  if (!value) {
    throw new Error(
      'FAL_KEY is not set. Local: supabase/functions/.env (gitignored). '
      + 'Hosted: supabase secrets set --env-file supabase/functions/.env',
    );
  }
  return value;
}
