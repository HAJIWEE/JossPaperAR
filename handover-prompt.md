# 🤝 Hand-over prompt — next AI session

> **Written 2026-10-04 (S28b wrap).** Paste everything below the rule into a fresh session's first message.
> It is deliberately self-contained: goal · state · what to do first · traps · files.
> The living versions are **[[next-ai-context]]** (state) · **[[follow-up-items]]** (open work) · **[[completed-work-archive]]** (history) · **[[AppDesignConceptBoard/19-build-plan-services-api-environments|doc 19]] §12** (what PR-3 and SCRUM-59 found).

---

## 1 · Goal

Continue building **JossPaperAR** — an Expo/React Native AR app that replaces physical joss-paper burning with a digital ritual. Repo: `/home/gweejiahan/.cline/worktrees/e02cf/JossPaperAR` · remote `github.com/HAJIWEE/JossPaperAR` · Jira `hajiwee9411.atlassian.net` (project **SCRUM**, the source of truth for decisions).

**Where the project is:** the backend of record is **live and exercised** (Supabase + Postgres + Edge Functions on the hosted project `yercgevebxvtzkgctfai`), and the economy's **AI-cost ceiling is enforced**. The next big thing is **PR-4 = SCRUM-53, the vertical slice on glass** — gated only on the PM buying the Tier-F floor device (**SCRUM-52**).

## 2 · The PM's working rules (non-negotiable)

- Work on a **`cline/<id>` branch in a worktree**, then **open a PR into `main`**. Never push to `main` directly; never merge without being asked.
- **Docs are part of "done"**: doc 19 §12.x, `next-ai-context.md`, `follow-up-items.md` (moving closed items to `completed-work-archive.md`), `project-costs.md`, and a **Jira comment** on the ticket.
- **Prove it with a real call.** A check that cannot fail is not a check — fault-test new gates by breaking them once and confirming they go red.
- **Costs are real.** A full Path C generation is ≈ **US$0.09**. Log every spend in `project-costs.md` (SGD, Mastercard rate or a marked placeholder).
- **Unsigned commits from an AI session are fine** (`CONTRIBUTING.md` § Commits). Don't re-raise it.

## 3 · Do this first, in order

1. `git fetch --all` and check the state of **PR #13** (PR-3, branch `cline/e02cf`) and **PR #14** (SCRUM-59, branch `cline/scrum-59`, **stacked on #13 — merge it second**).
2. **If they merged:** `git checkout main && git pull`, then flip Jira **SCRUM-54 → Done** (close it as *SCRUM-54b*) and **SCRUM-59 → Done**. If **not** merged: say so and **ask the PM before starting any new branch** — branching off `main` while #13 is unmerged means no `0011` exists and the stop-rule work would be missing.
3. Read `next-ai-context.md` → *Start Here* → `follow-up-items.md` → doc 19 **§12 and §12.5**.
4. Know the baseline is green: `npm run check` and `npx tsc --noEmit` (both currently pass).

## 4 · What exists (all verified against the live project, not asserted)

- **Supabase project** `yercgevebxvtzkgctfai` (ap-southeast-1, Postgres 17.11, CLI v2.119, **linked**) — **11 migrations applied**, `migration list` shows **no drift**.
- **Schema (PR-2):** 21 tables · 25 policies · RLS everywhere · private buckets `captures` (300 KB jpeg) + `styled` (150 KB, **webp**+png) · catalogue seeded.
- **Backend of record (PR-3):** `submit_burn` (the spine: one transaction = one burn, server-derived band, award clamped 0–1,650, replay-safe on `idempotency_key`) + 10 more RPCs + **3 Edge Functions deployed and run** (`award-service`, `cartoonize-orchestrator` = Path C, `weekly-roll` = honest stub) + 5 client libs (`src/lib/`: `supabase.ts` · `queue.ts` + `queue-sqlite.ts` · `idempotency.ts` · `invites.ts` · `i18n.ts`).
- **AI-budget stop-rule (SCRUM-59, migration `0011`):** `app_config.daily_ai_budget_micros` = **$5/day** (server-only, Dashboard-tunable); `request_cartoonize` **queues** when the shrine cannot afford one more photo (the spec's **$0.10 floor** is kept → a hard ceiling); `cartoonize-orchestrator` answers **`200 {code:'shrine_busy', queued:true}`** and never calls fal.
- **Gates:** `npm run check` (typecheck · tokens · domain · Path C lock · SQL structure · contrast · responsive · client libs) · `supabase/tests/pr3_verification.sql` (the PR-3 DoD, run against the real DB) · `supabase/tests/ai_budget.sql` (the stop-rule, S1–S5b/S6–S7) · `npm run check:budget` (the live stop-rule proof, **free by default**).
- **Advisor posture:** `authenticated_security_definer_function_executable` = **7** (accepted, SCRUM-60); `rls_enabled_no_policy` = **5** (by design — server-only tables). **Nothing in `public` is executable by `anon`.**

## 5 · What's next — the PM picks

1. **PR-4 = SCRUM-53 (the slice on glass)** — camera → cartoonize → burn → award → persist, on the Tier-F device. **Three client rules** (doc 19 §12/§12.5): ① generate the capture id **before** the upload · ② a **failed** generation means a **NEW capture** (retry the capture, not the row) · ③ **`200 shrine_busy`** is a **queue, not an error** → show `ritual_busy` and keep the offering. *Building can start before the device arrives; only the acceptance test needs it (N1).*
2. **`delete_my_data` does not purge Storage objects or the `auth.users` row** (SCRUM-33's area) — backend-only, not device-gated, and the recipe is now measured (delete objects **by path**; `DELETE /auth/v1/admin/users/{id}`).
3. **The league spec** (SCRUM-11) — `get_league_board` + `weekly-roll` are labelled stubs; `pg_cron` is deliberately not enabled yet.
4. **`SCRUM-55`** — write ADR-004/006/008 from the specs that already decided them; **ADR-008 (ad posture) is a product call**.

## 6 · Traps that cost real time (all measured — don't re-derive them)

1. **There is no local `psql`, and the CLI has no `query` subcommand.** To run SQL: copy it to `supabase/migrations/<newer-version>_xxx.sql`, `npx supabase db push --yes`, then **delete the file and** `npx supabase migration repair --status reverted <version>` — otherwise the remote history drifts from local.
2. **Never edit an applied migration.** Fixes are new version numbers (that is how 0007–0010 and 0011 came to be).
3. **The money path is `service_role`-only BY GRANT.** Granting a definer function to `authenticated` moves the advisor count (3 → 7). To let a client do something, **extend an Edge Function**, don't widen a grant.
4. **`/tmp/keys.env`:** `SVC` (legacy service_role JWT) **works**; `SECRET` is **rotated → 401**. Prefer `SVC`, and **prove the credential before mutating config** — a stale key silently skipped a budget write and cost US$0.09.
5. **JWTs in `/tmp/user.env` expire in ~1 h.** Mint a fresh anonymous user: `POST /auth/v1/signup -d '{"data":{"source":"…"}}'`.
6. **`app_config` is a kill switch** (the AI budget). Any script that writes it must restore it from an `EXIT` trap — a run that leaves it at 0 locks every user out.
7. **The Storage API's `{"prefixes":[…]}` bulk delete answers `200` and deletes nothing.** Delete objects **by path**.
8. **Editing `request_cartoonize`?** It is the quota gate *and* the stop-rule: the daily allowance counts only jobs that **ran** (a parked job must not burn an attempt), and the budget check uses the **$0.10 floor**, not `spend >= budget`.

## 7 · Commands

```bash
npx supabase db push --yes             # apply migrations (linked to yercgevebxvtzkgctfai)
npx supabase migration list            # expect 11/11, no drift
npx supabase functions deploy cartoonize-orchestrator
npm run check                          # the full local gate suite (typecheck · tokens · domain · pathc · sql · libs)
npm run check:db                       # the SQL tests (needs docker + supabase/.temp/pooler-url)
npm run check:budget                   # the live stop-rule proof — free by default
npx tsc --noEmit                       # typecheck on its own
```

## 8 · Money

fal.ai credit: **≈ US$4.98 spent** of the approved **US$10–20** (style-D spike US$4.49 · PR-3 verification ≈US$0.40 · SCRUM-59 verification ≈US$0.09). A full Path C run is ≈ **US$0.09** — check the budget first, and log every spend in `project-costs.md` (SGD; reconcile at **SCRUM-41**, due 2026-10-06).
