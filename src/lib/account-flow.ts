/**
 * account-flow.ts — the PURE rules of the ACCOUNT screens (SCRUM-215 · ADR-004 · its Amendment 1).
 *
 * ── ⚠️ WHY THIS FILE EXISTS ─────────────────────────────────────────────────
 * The account is the only place the app creates an identity a **PERSON** owns, and the tickets that
 * govern it put THREE rules on it that no JSX can hold:
 *
 *   1. ⚠️⚠️ **THE UPGRADE IS A LINK, NOT A MIGRATION** (ADR-004 rule 4: `profiles.user_id` IS the
 *      `auth.users` id). An anonymous device that adds an email must **keep its id**, so its tribute
 *      wallet, streak, ancestors and league standing come with it. **A second user is a FAILURE of
 *      SCRUM-215, not a shortcut.** ⚠️ That is a fact about WHICH Supabase call is made, so it is
 *      stated here as DATA and asserted by `check:lib`.
 *   2. ⚠️ **THE ACCOUNT IS OFFERED, NEVER DEMANDED** (ADR-004 · SCRUM-147): *"No sign-in wall before
 *      the first burn — nothing in onboarding may introduce one."* ⚠️ Amendment 1 then REQUIRED the
 *      account **after** the demo, and named the handoff. So there is a before and an after.
 *   3. **The code is SIX digits** — the boards say `verify code`, and `config.toml`'s
 *      `auth.email.otp_length` is 6.
 *
 * ⚠️ **PURE on purpose** — no React, no storage, no network — the same reason `tutorial.ts` and
 * `session-map.ts` are: so the rule can be asserted without a device.
 */

/**
 * ⚠️ **THE TWO FLOWS, AND THE ONE THING THAT DIFFERS** — which session the confirmation leaves you
 * holding, and therefore WHICH Supabase method sends the code.
 *
 * ⚠️ **THEY ARE NOT INTERCHANGEABLE.** `signInWithOtp` on the sign-up road would sign the device in as a
 * **different user** and abandon the anonymous one's ledger — the exact failure ADR-004 rule 4 names.
 */
export const ACCOUNT_MODES = {
  /**
   * ⚠️ **SIGN UP = THE IN-PLACE UPGRADE.** The device already holds an ANONYMOUS session (ADR-004 —
   * every install gets one on first run), so `account.ts` calls **`updateUser({ email })`**, which
   * ATTACHES the email to that same user, and confirms with **`type: 'email_change'`**.
   */
  signUp: { verifyType: 'email_change', keepsUserId: true },
  /**
   * A returning user on a new device: `signInWithOtp` → `verifyOtp({ type: 'email' })` → **their**
   * user. ⚠️ This one DOES replace the session, and that is correct — it is a sign-in, not an upgrade.
   */
  signIn: { verifyType: 'email', keepsUserId: false },
} as const;

export type AccountMode = keyof typeof ACCOUNT_MODES;

/**
 * ⚠️ **THE ONE CASE THE UPGRADE *CANNOT* DO** — and it is the server that decides it.
 *
 * Supabase's documented behaviour: `updateUser({ email })` **fails when the email already belongs to an
 * existing user** (*"This email belongs to an existing user. Please sign in to that account."*). ⚠️ The
 * documented workaround — sign in as that user and REASSIGN the anonymous rows — would create a second
 * user and a data reassignment, i.e. exactly the migration ADR-004 rule 4 forbids. So the app does NOT
 * attempt it: it tells the user to sign in, and the anonymous device's thin history is abandoned. That
 * is ADR-004's **accepted** trade-off ("*a user who clears app data loses their history… recovery is
 * exactly what an account upgrade buys*"), not a defect to paper over.
 */
export const EMAIL_TAKEN_MEANS_SIGN_IN = true;

/** The form steps, in the order the boards draw them (`0d6 Sign-up · email` → `0d7 … /verify code`). */
export const ACCOUNT_STEPS = ['email', 'code'] as const;
export type AccountStep = (typeof ACCOUNT_STEPS)[number];

/** The next tap, or `null` on the last step. */
export function nextAccountStep(step: AccountStep): AccountStep | null {
  const i = ACCOUNT_STEPS.indexOf(step);
  return i >= 0 && i < ACCOUNT_STEPS.length - 1 ? ACCOUNT_STEPS[i + 1] : null;
}

/** ⚠️ Six digits — `config.toml`'s `otp_length = 6`, and the boards' `verify code`. */
export const ACCOUNT_CODE_LENGTH = 6;

/** Is the code a complete one? ⚠️ Only digits, and exactly six — a partial code must not be sent. */
export function isCompleteCode(raw: string): boolean {
  return /^\d{6}$/.test(raw.trim());
}

/** The stored form of an email: trimmed and lower-cased, because GoTrue compares case-insensitively. */
export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export type EmailProblem = 'empty' | 'spaces' | 'no_at' | 'no_dot' | 'bad_domain';

/**
 * ⚠️ **A DELIBERATELY SHALLOW check.** The server is the authority on whether an address exists, and a
 * clever client regex refuses addresses that are in fact valid (`a+b@sub.domain.example`). This catches
 * only the obvious, so it can gate the button without ever blocking a real user.
 */
export function emailProblem(raw: string): EmailProblem | null {
  const v = raw.trim();
  if (v.length === 0) return 'empty';
  if (/\s/.test(v)) return 'spaces';
  const parts = v.split('@');
  if (parts.length !== 2) return 'no_at';
  const [local, domain] = parts;
  if (local.length === 0) return 'no_at';
  if (!domain.includes('.')) return 'no_dot';
  if (domain.startsWith('.') || domain.endsWith('.') || domain.startsWith('-')) return 'bad_domain';
  return null;
}

/**
 * ⚠️ **THE WALL RULE, AS DATA** (ADR-004 · SCRUM-147 · Amendment 1).
 *
 * *"No sign-in wall before the first burn — nothing in onboarding may introduce one."* Amendment 1 then
 * made the account **REQUIRED to create or join a clan**, and put it **after the demo** — so the rule is
 * not *"never"* but **"never BEFORE the first burn, and offered immediately after it"**.
 * ⚠️ Asserted by `check:lib`, not trusted to this comment.
 */
export const ACCOUNT_GATE = {
  reachableBeforeFirstBurn: false,
  offeredAfterFirstBurn: true,
} as const;
