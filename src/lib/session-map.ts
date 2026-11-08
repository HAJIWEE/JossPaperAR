/**
 * session-map.ts — the PURE half of the identity bootstrap (SCRUM-80 / ADR-004).
 *
 * ADR-004 is "anonymous device identity first, optional account later": the very
 * first burn happens with no account, so the app must issue an **anonymous**
 * Supabase Auth session before its first authenticated call. The SERVER half has
 * existed since migration 0006 (anonymous sign-ins are enabled and were proven by
 * a real call). ⚠️ The CLIENT half did not: `signInAnonymously` appeared **zero
 * times** in `src/`, so `auth.getSession()` was always empty, `registerCapture`
 * threw `not_authenticated`, and RLS refused the write (`401 / 42501`). The slice
 * could not complete a single ritual — that is SCRUM-80.
 *
 * WHY ITS OWN FILE: it imports NOTHING (no native, no Supabase client), so
 * `check:session` can assert the whole decision — reuse vs sign-in vs
 * unconfigured, and the error mapping — with no network, no key and no device.
 * The device half (`session.ts`, which calls `supabase().auth`) lives beside it,
 * exactly as `ritual-map.ts` (pure) sits beside `ritual.ts` (device).
 */

/** The auth state as the device half reads it. */
export interface SessionState {
  /** `isConfigured()` — a URL and a client key are present. */
  readonly configured: boolean;
  /** `true` when `auth.getSession()` returned a session. */
  readonly hasSession: boolean;
  /** The session's user id, when there is one. */
  readonly userId?: string | null;
}

/**
 * What the bootstrap should DO with a given state.
 *
 * ⚠️ `reuse` REQUIRES a real user id. A session object with no user id cannot be
 * signed into anything, so reusing it would silently reproduce the very
 * `not_authenticated` failure this module exists to prevent — which is why a
 * session-less-of-a-user falls through to `sign_in` rather than being trusted.
 */
export type SessionPlan =
  | { readonly action: 'reuse'; readonly userId: string }
  | { readonly action: 'sign_in' }
  | { readonly action: 'skip'; readonly reason: 'not_configured' };

/** Decide the next step from the observed state. Pure — that is the whole point. */
export function planSession(state: SessionState): SessionPlan {
  if (!state.configured) return { action: 'skip', reason: 'not_configured' };
  if (state.hasSession && typeof state.userId === 'string' && state.userId.length > 0) {
    return { action: 'reuse', userId: state.userId };
  }
  return { action: 'sign_in' };
}

/**
 * ⚠️ **THE BOOTSTRAP'S INPUT NOW CARRIES ONE MORE FACT** (ADR-004 **Amendment 2**, 2026-11-08): whether this
 * device is **past onboarding** — i.e. it has linked an account, or signed out of one. ⚠️ That — and **not**
 * "does a session exist" — is what decides whether an anonymous session may be minted at all.
 *
 * ⚠️⚠️ **IT DELIBERATELY DOES NOT ASK `needsTutorial()`.** That was the first design, and **the device
 * falsified it**: the demo flag is written by one screen (the demo branch of `reward.tsx`), so a user whose
 * first burn was a real one reads *"demo owed"* forever, the bootstrap minted, and a signed-out user came
 * back to a shrine. See `onboarded.ts`.
 */
export interface BootstrapState extends SessionState {
  /** `readOnboarded()` — this device has linked an account, or has signed out of one. */
  readonly onboarded: boolean;
}

/**
 * What the app should do with the identity on this launch.
 *
 * ⚠️ **`mint_anonymous` and `require_sign_in` are the amendment.** Before it, a session-less device ALWAYS
 * got an anonymous session — which meant signing out silently produced a *new anonymous shrine* and the
 * account was reachable forever. ⚠️ **The anonymous identity is now a FIRST-INSTALL artifact only.**
 */
export type BootstrapPlan =
  | { readonly action: 'reuse'; readonly userId: string }
  | { readonly action: 'mint_anonymous' }
  | { readonly action: 'require_sign_in' }
  | { readonly action: 'skip'; readonly reason: 'not_configured' };

/**
 * Decide the identity for this launch. Pure — no storage, no network, no React.
 *
 * ⚠️ **THE ORDER IS THE RULE:**
 *   1. no config → nothing to do;
 *   2. a session with a real user id → **reuse** (never mint a second identity on one device);
 *   3. **not past onboarding** → **mint anonymous** — the ONLY window in which an anonymous session may be
 *      created, because it is the only state that still needs one;
 *   4. otherwise → **require a sign-in.**
 *
 * ⚠️ **Rule 1 of ADR-004 still holds:** nothing gates the first burn, because a fresh device is not past
 * onboarding and therefore gets the anonymous session the demo runs on.
 *
 * ⚠️ **`clearOnboarded()` is therefore load-bearing for the DELETE path:** "delete everything" clears the
 * record, so the device is legitimately new again and returns to an anonymous shrine. That is the one way
 * back to anonymous, and it is the delete's, not a sign-out's.
 */
export function planBootstrap(state: BootstrapState): BootstrapPlan {
  // ⚠️ `planSession` STAYS the authority on reuse/skip — this function only adds the onboarding gate.
  const base = planSession(state);
  if (base.action === 'skip') return base;
  if (base.action === 'reuse') return { action: 'reuse', userId: base.userId };
  return state.onboarded ? { action: 'require_sign_in' } : { action: 'mint_anonymous' };
}

/**
 * Map a Supabase auth error (or any thrown value) onto a STABLE reason string.
 *
 * The reason is carried, not shown raw: the screen keys its copy off a phase, so
 * this is for logging and for the caller's branching, never for the user. Kept
 * pure so the mapping is assertable, and total — it never throws on junk.
 *
 * The most likely real cause is `anonymous_disabled`: ADR-004 expects anonymous
 * sign-ins ENABLED (doc 19 §6.2 item 11), and switching them off is the one
 * server-side change that would break the first-run path.
 */
export function reasonFromAuthError(err: unknown): string {
  const e = (err ?? {}) as { code?: unknown; status?: unknown; message?: unknown };
  const code = typeof e.code === 'string' ? e.code : '';
  const status = typeof e.status === 'number' ? e.status : 0;
  const message = typeof e.message === 'string' ? e.message.toLowerCase() : '';

  if (code === 'anonymous_provider_disabled' || message.includes('anonymous')) return 'anonymous_disabled';
  if (status === 429 || code === 'over_request_rate_limit') return 'rate_limited';
  if (code === 'request_timeout' || message.includes('timeout') || message.includes('timed out')) return 'timeout';
  if (message.includes('network') || message.includes('fetch')) return 'network_error';
  return 'sign_in_failed';
}
