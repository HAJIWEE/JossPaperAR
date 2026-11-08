# 24 · Hosted email-delivery runbook — the account's 6-digit codes

> **Deliverable:** **`SCRUM-215`** (📧 Build the email-first account sign-up and sign-in, phase 1).
> **Status:** the **code half is BUILT and PROVEN on the local stack** (S78, 2026-11-07); **the hosted
> half is CONFIG ONLY and needs the owner** (no code left). Filed as its own ticket —
> **`SCRUM-222`** *🎯 Decide: configure the hosted email delivery*.
>
> **Companion docs:** [[19-build-plan-services-api-environments|doc 19]] §6.2 (the PM provisioning list)
> · [[ADRs/ADR-004-anonymous-identity-first-optional-account-later|ADR-004]] + Amendment 1 (the account
> is the *upgrade of the same `user_id`*, never a second user).

---

## 1 · What this is, in one paragraph

The account screen (`src/app/account.tsx`) is a **six-box code entry** confirmed with
`supabase.auth.verifyOtp` — `type: 'email_change'` on the **sign-up** road (`updateUser({ email })`,
the in-place upgrade) and `type: 'email'` on the **sign-in** road (`signInWithOtp`). For that code to
exist the email must **carry the 6-digit `{{ .Token }}`** — and GoTrue's **shipped** templates render a
**link**, not a code. So the flow needs **three** hosted things that are absent by default: an **SMTP
provider**, **two templates that carry `{{ .Token }}`**, and **`double_confirm_changes = false`**.

The in-repo half (templates + local flags) is **done and proven**; what remains is the **hosted
Dashboard configuration**, which only the owner can set.

---

## 2 · What is already done (S78, 2026-11-07 · commit `d8b7e74` · PR #79)

| # | Thing | Where | State |
|---|---|---|---|
| 1 | `email_change` template carrying `{{ .Token }}` | `supabase/templates/email_change.html` | ✅ wired in `config.toml` |
| 2 | `magic_link` template carrying `{{ .Token }}` | `supabase/templates/magic_link.html` | ✅ wired in `config.toml` |
| 3 | `double_confirm_changes = false` (local) | `supabase/config.toml` | ✅ committed |
| 4 | `enable_confirmations = true` (local) | `supabase/config.toml` | ✅ committed |
| 5 | Migration `20261107120000_wealth_bundle_composition.sql` | `supabase/migrations/` | ✅ **pushed to hosted** |

**Proven end-to-end on the local stack (Mailpit), BOTH roads:**

- **sign-up:** `PUT /auth/v1/user` → **200**, **same `auth.users` id** (the in-place UPGRADE),
  `email_change_sent_at` set → email *"Confirm your Joss Paper AR email"* carries code `915649`
  → `verifyOtp({ type: 'email_change' })` → **200, session, email confirmed**.
- **sign-in:** `POST /auth/v1/otp` → **200** → email *"Your Joss Paper AR sign-in code"* carries code
  `323470` → `verifyOtp({ type: 'email' })` → **200, session**.

`tsc` **0** · `npm run check` **EXIT 0**.

---

## 3 · Why hosted does not work yet — and it is NOT a code problem

Two measured facts, both from the live hosted project (`yercgevebxvtzkgctfai`):

1. ⚠️ **The built-in mailer refuses non-team addresses.** Supabase's default SMTP *"will refuse to
   deliver messages to addresses that are not part of the project's team"*, and it **hard-caps** at
   **`over_email_send_rate_limit`**. Measured: `POST /auth/v1/otp` to the **owner's own** address →
   **200**; a **non-team alias** → **429 `over_email_send_rate_limit`**. A real user's code is never
   sent until a custom SMTP exists.
2. ⚠️ **`double_confirm_changes` must be `false` on hosted too.** With the default `true`, an
   **anonymous** user (no old address) makes GoTrue answer **200**, write a pending `email_change`
   token, and **send NOTHING**. It is a local `config.toml` key **and** a hosted Dashboard toggle with
   **no** migration/SQL equivalent.

Everything below is therefore **provably needed** — none of it is optional polish.

## 4 · The hosted setup — A → D (owner, Supabase Dashboard)

Project **`yercgevebxvtzkgctfai`** ("HAJIWEE's Project") · region `ap-southeast-1` (Singapore).

### A · Custom SMTP — Google Workspace

**Auth → Email → SMTP Settings.** Two Google Workspace routes; pick ONE.

| | Route 1 — mailbox SMTP (simplest) | Route 2 — SMTP relay (better for an app) |
|---|---|---|
| **Host** | `smtp.gmail.com` | `smtp-relay.gmail.com` |
| **Port** | **587** (STARTTLS) or **465** (SSL) | **587** / **465** / **25** |
| **Username** | the full Workspace mailbox (e.g. `you@yourdomain`) | the relay-authorized mailbox *(or none if IP-authorized)* |
| **Password** | a **Google App Password** — 2-Step Verification must be ON (Google removed "less secure apps") | the mailbox password, *or* none when the admin authorizes by sending IP |
| **Daily cap** | ~2,000 (Workspace) | **~10,000** |
| **Admin setup** | none | the Workspace admin must enable the relay (allowlist mailbox or IP) |

- **Sender email must equal the authenticated mailbox** — Gmail **rewrites** the `From` to the account
  that authenticated, so a mismatch is silently rewritten.
- **Sender name:** `Joss Paper AR`.
- ⚠️ If the Workspace enforces **Advanced Protection / no-app-password**, use **Route 2**.

### B · Paste the two templates

**Auth → Email Templates.** Paste the **HTML** into these two templates:

| Dashboard template | Subject | Paste from |
|---|---|---|
| **Change email address** | `Confirm your Joss Paper AR email` | `supabase/templates/email_change.html` |
| **Magic link or OTP** | `Your Joss Paper AR sign-in code` | `supabase/templates/magic_link.html` |

⚠️ **The repo file is the source of truth.** If the file and the Dashboard ever disagree, the **file
wins** — and re-paste. (Local `content_path` config does **not** reach hosted.)

### C · Turn OFF "Secure email change"

**Auth → Providers → Email.** Set **Secure email change** = **OFF** — that is the hosted
`double_confirm_changes = false`. With it ON the sign-up road **sends nothing** (see §3.2). Also confirm
**Confirm email** = **ON** (hosted already reports `mailer_autoconfirm: false`).

### D · Raise the email rate limit (recommended)

**Auth → Rate Limits → Rate limit for sending emails.** The default is low; raise it once a real SMTP is
in place (the custom SMTP's own cap then becomes the real ceiling).

> **Redirect URLs** are **not** required for the **code** path (the code is typed in-app, no deep link).
> They matter only if the emails' *"confirm with one tap"* links are ever used — see §6.

---

## 5 · How to verify (after A–D)

1. Sign up a **fresh** address that is **not** already a user.
2. The email must arrive **with a 6-digit code**, not just a link.
3. Type the code → the screen advances to the **clan fork** (`AFTER_ACCOUNT_ROUTE = '/clan'`).

```bash
# the app's EXACT calls, against hosted (URL + publishable key from .env)
URL=https://yercgevebxvtzkgctfai.supabase.co
KEY=$EXPO_PUBLIC_SUPABASE_ANON_KEY
# 1) the anonymous session every install gets (ADR-004)
ANON=$(curl -sS -X POST "$URL/auth/v1/signup" -H "apikey: $KEY" \
  -H 'Content-Type: application/json' -d '{}'); T=$(echo "$ANON" | jq -r .access_token)
# 2) the UPGRADE — attaches the email to THAT SAME user
curl -sS -X PUT "$URL/auth/v1/user" -H "apikey: $KEY" -H "Authorization: Bearer $T" \
  -H 'Content-Type: application/json' -d '{"email":"someone@example.com"}'
# expect 200 + new_email + email_change_sent_at  →  then READ THE INBOX for the code
```

⚠️ **A known trap:** an address already registered returns **422** *"A user with this email address has
already been registered"* on the sign-up road. That is **correct** — the app turns it into **sign in
instead** (`EMAIL_TAKEN_MEANS_SIGN_IN`); it does **not** reassign the anonymous rows (that reassignment
is the second user ADR-004 rule 4 forbids). Use a fresh address to test sign-up.

## 6 · Deliberately NOT in scope here

- ⚠️ **The template copy is a DRAFT for PM review.** The account strings are **`SCRUM-217`**; these two
  email templates are **new copy** in the same family and need the owner's wording/approval. They are
  English-only; a **中文** variant (the app is EN/中文) is a follow-up — Supabase does not switch template
  language by recipient locale.
- ~~**`{{ .ConfirmationURL }}` one-tap links** appear in both templates as a convenience, but the app has
  **no deep-link handler** for them (scheme `josspaperar`; the only intent filter is `/join`). They open
  the Supabase verify endpoint, not the app. Building that is separate.~~
  ⚠️⚠️ **REMOVED FROM BOTH TEMPLATES, 2026-11-08 — A PLAYER TAPPED IT AND IT DID NOT WORK.** The note above
  was accurate and the link shipped anyway, which is the same defect class this project already refuses for
  dead rows and dead toggles: **a control that cannot do what it promises is worse than an absent one.**
  The email now offers **only the six-digit code**, which is what the app can actually receive.
  ⚠️⚠️ **AND IT IS NOT COMING BACK: email sign-in is CODE-ONLY by product decision, and Google sign-in is
  expected to carry ~99% of users once the Google console is available** (owner, 2026-11-08). So the three
  blockers below are recorded for the record, **not as a work item** — building the one-tap return would be
  work spent on the road Google is about to replace. ⚠️ See `follow-up-items.md` → *GOOGLE SIGN-IN*, which
  carries the trap that matters (the demo's anonymous user must keep its id, so first-run Google is
  **link**-then-verify, not `signInWithOAuth`).
  ⚠️ **For completeness, what one-tap would have needed — all three:**
  1. `emailRedirectTo` in `sendAccountCode()` (`emailRedirectTo` appears **nowhere** in `src/` today), so
     `.ConfirmationURL` has an app-shaped destination;
  2. a **handler for the return** — parse `#access_token=…&refresh_token=…` and `setSession` — because
     `detectSessionInUrl: false` and the only intent filter is `https://josspaperar.app/join`;
  3. the **hosted Redirect URLs allowlist** entry for the scheme (a Dashboard setting, §4), or Supabase
     silently falls back to the Site URL and the browser dead-ends exactly as it did.
  ⚠️ **And it cannot be verified in Expo Go** — Expo Go does not route a `josspaperar://` link, so proving
  it needs an **EAS build** (a local native build is impossible here: only Java 25 is installed). Recorded
  as a follow-up, `⏳ one-tap`.
  ⚠️ **`check:lib` now asserts both templates carry `{{ .Token }}` and NO `{{ .ConfirmationURL }}`** — and it
  strips HTML comments first, because the note explaining the removal has to name the tag.
- **Email-address erasure** — `delete_my_data` must also erase the email and the Play data-safety form
  must declare it: **`SCRUM-219`**.
- **The `FAMILY NAME` field** the sign-up board draws (`0d6`) is **omitted** — **`SCRUM-214(A)`** is open.

---

## 7 · The one-line summary

**The code half is built and proven locally; the hosted half is four Dashboard settings only the owner
can set — an SMTP provider (Google Workspace is ready), the two `{{ .Token }}` templates pasted in,
`Secure email change` OFF, and a raised email rate limit.** Nothing here needs a code change.

---

## 8 · Rollback / "did I break sign-in?"

These settings are **additive** and safe to revert:
- SMTP off → back to the built-in mailer (team-only, rate-capped) — the app keeps working for team
  addresses.
- Templates reverted to default → the emails carry a **link** again; the **code step stops working**
  locally and hosted. Nothing else is affected.
- `Secure email change` back **ON** → the **sign-up** road silently sends nothing again.

⚠️ **The failure mode to watch for is silence, not an error**: with the flags wrong the API answers
**200** and the inbox stays empty. So *"the request succeeded"* is never evidence the email was sent —
**read the inbox** (or, locally, **Mailpit** at `http://127.0.0.1:54324`).


