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

/**
 * ⚠️ The **detector**, kept apart from the decision above. The provider's wording differs by host —
 * hosted GoTrue says *"A user with this email address has already been registered"*, the local stack
 * says *"email address already registered by another user"* — so the match is deliberately loose.
 */
export const EMAIL_TAKEN_PATTERN = /already|exist|registered/i;

/**
 * ⚠️ **THE ONE FAILURE THAT IS NOT ABOUT THE EMAIL: the UPGRADE ROAD NEEDS SOMETHING TO UPGRADE.**
 *
 * ADR-004 rule 4 makes sign-up an **in-place upgrade** (`updateUser({ email })` on the anonymous session the
 * demo used). ⚠️ Since **Amendment 2** a device can be **signed out with no session at all** — and
 * `updateUser` has nothing to attach the email to, so the road cannot work. `account.ts` returns this reason
 * instead of letting the provider's own *"not authenticated"* reach the screen, and the screen turns it into
 * **sign in**, the same way it turns "email already taken" into sign in.
 *
 * ⚠️ It is a REASON, not copy: `issueKeyFor` never sees it, because the answer is a mode switch.
 */
export const NO_ANONYMOUS_SESSION = 'no_anonymous_session';

/** ⚠️ The decision APPLIED to a real failure: does this sign-up refusal mean *"sign in instead"*? */
export function meansSignInInstead(mode: AccountMode, reason: string): boolean {
  if (mode !== 'signUp') return false;
  // ⚠️ Amendment 2 — with no session there is nothing to upgrade, so the road IS sign-in.
  if (reason === NO_ANONYMOUS_SESSION) return true;
  return EMAIL_TAKEN_MEANS_SIGN_IN && EMAIL_TAKEN_PATTERN.test(reason);
}

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

/**
 * ⚠️ The union **and** its runtime list from ONE source, so `issueKeyFor` can never drift from
 * `EmailProblem`: the array is the value, the type is derived from it.
 */
export const EMAIL_PROBLEMS = ['empty', 'spaces', 'no_at', 'no_dot', 'bad_domain'] as const;
export type EmailProblem = (typeof EMAIL_PROBLEMS)[number];

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

/**
 * ⚠️ **Where the account HANDS OFF: the CLAN FORK.** ADR-004 Amendment 1 made the account **required to
 * create or join a clan**, so the fork is the next required step — and the demo handed off to *this*
 * screen (see `AFTER_TUTORIAL_ROUTE` in `tutorial.ts`). The whole first-run chain is therefore
 * **demo → account → clan fork → altar**.
 */
export const AFTER_ACCOUNT_ROUTE = '/clan';

/**
 * ⚠️ **The ACCOUNT SCREEN'S OWN ROUTE — and, since ADR-004 Amendment 2, THE SIGN-IN WALL.**
 *
 * `src/app/_layout.tsx` sends a session-less device that is **past its demo** here, so this string has two
 * jobs: it is where the tutorial hands off (`tutorial.ts` keeps its own copy to stay import-free, and a
 * `check:lib` assertion holds the two equal), and it is the exemption in that gate — ⚠️ **without which the
 * gate would redirect to the screen it is already on, forever.**
 */
export const ACCOUNT_ROUTE = '/account';

/**
 * ⚠️ **WHERE A CONFIRMED ACCOUNT GOES — and it is NOT always the fork** (found on glass 2026-11-08).
 *
 * `AFTER_ACCOUNT_ROUTE` is the **first-run** handoff: the account is created, and the clan fork is the next
 * required step (ADR-004 Amendment 1). ⚠️ **But a RETURNING user already has a clan**, and sending them to
 * the fork made them go through create-or-join again — the owner hit it on their own account: *"After i
 * re-login, it asked me to create or join a clan again, so i created the same clan, then the tablet i create
 * was still there."* ⚠️ So the data was fine and the **workflow was wrong**, which is the worse of the two:
 * it invites a second clan on top of a good one.
 *
 * ⚠️ **`hasClan: null` means the check could not be made** (offline, or the read failed). It keeps the
 * **documented first-run chain** — fork — because that is the safe, recoverable direction for a new user, and
 * the fork is also where a clan-less returning user must go anyway.
 */
export function routeAfterAccount(hasClan: boolean | null): string {
  return hasClan === true ? '/' : AFTER_ACCOUNT_ROUTE;
}

/**
 * ⚠️ **A REASON IS NOT COPY.** FOUND ON GLASS (2026-11-07): a failed `verifyOtp` printed the raw string
 * **`sign_in_failed`** in the issue line, because the screen rendered the reason verbatim. ⚠️ The board
 * (`EN · 0c4`) draws a sentence — *"That code didn't match. Have another go…"* — so the reason is mapped
 * here, in one place, and the screen renders a `t()` KEY.
 *
 * ⚠️ **What the map does NOT do:** it does not invent a **retry count**. The board's `2 tries left` is a
 * client-side budget this build has no source for — the server owns the limit — so the sentence stops
 * short of a number it could not honour.
 */
export function issueKeyFor(reason: string, step: 'email' | 'code' = 'email'): string {
  if (isEmailProblem(reason)) return 'account.emailInvalid';
  /**
   * ⚠️ **"WAIT" IS NOT "SOMETHING WENT WRONG"** (found on glass 2026-11-08). `signInWithOtp` answers **429**
   * when the address has been mailed too recently, and `reasonFromAuthError` maps that to `rate_limited` —
   * ⚠️ which used to fall through to `account.genericIssue`, so a **temporary** refusal read as a broken
   * sign-in. The owner reported it as *"it prevents me from logging in with the same email again"*.
   * ⚠️ It is mapped on the **EMAIL step only**: on the code step a 429 comes from a different limiter
   * (`over_request_rate_limit` on verification), and telling someone *"we just sent a code"* there is a lie.
   */
  if (step === 'email' && reason === 'rate_limited') return 'account.tooMany';
  /**
   * ⚠️ **ON THE CODE STEP, EVERY FAILURE IS A CODE FAILURE.** The provider's wording for a bad or stale
   * code is not a stable contract — the local stack answers **`sign_in_failed`**, which no
   * word-matching list would catch — so the STEP, not the sentence, decides. That is also what the board
   * draws (`EN · 0c4`: *"That code didn't match…"*).
   */
  if (step === 'code') return 'account.codeWrong';
  return 'account.genericIssue';
}

/** ⚠️ Keeps the `EmailProblem` union and `issueKeyFor` from drifting apart. */
function isEmailProblem(value: string): value is EmailProblem {
  return (EMAIL_PROBLEMS as readonly string[]).includes(value);
}
