# 🤝 Hand-over prompt — next AI session

> **Written 2026-10-06 (S31 wrap).** Paste everything below the rule into a fresh session's first message.
> It is deliberately self-contained: goal · state · what to do first · traps · files.
> The living versions are **[[next-ai-context]]** (state) · **[[follow-up-items]]** (open work) · **[[completed-work-archive]]** (history) · **[[AppDesignConceptBoard/19-build-plan-services-api-environments|doc 19]] §12** (what the backend found).

---

## 1 · Goal

Continue building **JossPaperAR** — an Expo/React Native AR app that replaces physical joss-paper burning with a digital ritual. Repo: `/home/gweejiahan/.cline/worktrees/eecec/JossPaperAR` (branch **`cline/scrum-53-wire`**) · remote `github.com/HAJIWEE/JossPaperAR` · Jira `hajiwee9411.atlassian.net` (project **SCRUM**, the source of truth for decisions).

**Where the project is:** the backend of record is **live and exercised** (Supabase + Postgres + Edge Functions on the hosted project `yercgevebxvtzkgctfai`), the economy's **AI-cost ceiling is enforced**, and the **Android emulator test target is live**. What is left is **PR-4 = SCRUM-53, the vertical slice** — and ⚠️ **it is blocked before its first run, not by hardware, but by `SCRUM-80`**.

## 2 · The PM's working rules (non-negotiable)

- Work on a **`cline/<id>` branch in a worktree**, then **open a PR into `main`**. Never push to `main` directly; never merge without being asked.
- **Anything worked on is in the sprint.** An `In Progress` / `In Review` ticket must be in the active sprint — **read the current sprint id, never hard-code it** (`jql: project = SCRUM AND sprint IN openSprints()`), set `customfield_10020`, then **read it back** (the field is not echoed on every write). Before ending a session, `jql: project = SCRUM AND sprint is EMPTY AND statusCategory = "In Progress"` **must return nothing**.
- **A decision for the PM goes to Jira** — a `Task` prefixed `🎯 Decide:`, in the sprint, explained so the PM can decide **without reading the repo**. Never leave it as a PR comment or a doc line.
- **Docs are part of "done"**: `next-ai-context.md` · `follow-up-items.md` (closed items move to `completed-work-archive.md`) · `project-costs.md` · and a **Jira comment** on the ticket.
- **Prove it with a real call.** A check that cannot fail is not a check — **fault-test every new gate** by breaking it once and confirming it goes red.
- **Unsigned commits from an AI session are fine** (`CONTRIBUTING.md` § Commits). `git commit` hangs in an agent shell (GPG waits on pinentry) → use `git -c commit.gpgsign=false`.

## 3 · Do this first, in order

1. Read `next-ai-context.md` (*Quick Reference* → *Start Here*) → `follow-up-items.md` → doc 19 **§12**.
2. Check **PR #23** (`cline/scrum-53-wire` → `main`, **3 commits**). CI is the first full typecheck, because a fresh worktree may have no `node_modules`. Verify a merge with `git merge-base --is-ancestor <branch> origin/main` — **not** `origin/<branch>`, which `fetch --prune` deletes *after* a merge.
3. Ask the PM for the **`SCRUM-80`** call (A: fold into PR-4 · B: its own PR-5 · C: defer). **Do not wire auth unilaterally** — it is a PR-scope decision, and it writes a user row to the live project on first launch.
4. Baseline is green: `npm run check` and `npx tsc --noEmit`.

## 4 · What exists (verified against the live project, not asserted)

- **Supabase** `yercgevebxvtzkgctfai` (ap-southeast-1, Postgres 17.11, CLI v2.119, **linked**) — **11 migrations, no drift** · 21 tables · 25 policies · private buckets `captures` (300 KB jpeg) + `styled` (webp+png) · **3 Edge Functions deployed and run** · **anonymous sign-ins ARE enabled and proven**.
- **The AI-budget stop-rule (SCRUM-59)** — `app_config.daily_ai_budget_micros` = **$5/day**, server-only; the shrine **queues** (`200 shrine_busy`) rather than failing, and a parked job does not consume one of the ten daily attempts.
- **The slice's write path** — `preparing.tsx` → `registerCapture` · `uploadCapture` · `requestCartoonize`; `reward.tsx` → `submitBurn`. Its **two dead wires are fixed** and pinned by a dependency-free gate, **`npm run check:wire`** (40 checks, fault-tested).
- **The emulator target (SCRUM-64)** — `floor_api30`: Android **11 / sdk 30** · **720×1280** · **320 dpi** · **2.92 GB**, read off the device.
- **Gates** — `npm run check` = tokens 36 · domain 45 · slice 36 · throw 33 · ads 51 · wire 40 · pathc 38 · sql 11 · adrs 34 · contrast 22 · responsive 21 · lib 97.

## 5 · What's next — the PM picks

1. 🎯 **`SCRUM-80` — the client auth bootstrap.** The slice cannot complete a single ritual: nothing creates a session, so `registerCapture` throws `not_authenticated` and RLS refuses an anonymous write (`401 / 42501`). **This gates SCRUM-53's M1 *and* SCRUM-52.**
2. **`SCRUM-52`** — buy the Tier-F floor device (~S$100–150). *A PM action.*
3. **The live ≈US$0.09 Path C burn** — the first end-to-end proof, once #1 is answered.
4. **`SCRUM-33`** — `delete_my_data` does not purge Storage objects or the `auth.users` row.
5. **`SCRUM-11`** — the league spec (`get_league_board` + `weekly-roll` are labelled stubs; `pg_cron` deliberately off).

## 6 · Traps that cost real time (measured — don't re-derive them)

**Emulator / toolchain**
1. ⚠️ **The emulator SEGFAULTS when headless** — `-no-window` (any GPU mode: `swiftshader_indirect`, `off`) kills `qemu-system-x86` with `status=11/SEGV` ~26 s into boot. It needs a **real display**. Run it detached, or it is reaped: `systemd-run --user --unit=floor-avd --collect --setenv=DISPLAY=:0 --setenv=XAUTHORITY=/run/user/1000/xauth_<id> /opt/android-sdk/emulator/emulator -avd floor_api30 -no-snapshot -no-boot-anim`.
2. **`sdkmanager` is deprecated** — the CLI is `android sdk list/install`, `android emulator create|list|start|stop`, `android info`, `android init`.
3. **`platforms;android-36` ≠ `android-36.1`** — a minor-version platform is **not** a drop-in (it needs `minorApiLevel = 1` **and AGP 8.13+**). Install the base one. *(Moot for Expo Go, which compiles nothing locally.)*
4. **Watchman is not needed** (SDK ≤ 55 only). **JDK 17 is not needed** — there is no `expo-dev-client`.
5. **Never `sudo android-studio`** — it leaves root-owned SDK paths and *"Failed to read or create install properties file"*.

**Backend / data**
6. **No local `psql`, and no CLI `query` subcommand.** Run SQL by adding a migration, `db push`, then delete the file and `migration repair --status reverted <version>` — otherwise the remote history drifts.
7. **Never edit an applied migration** — fixes are new version numbers.
8. **`app_config` is a kill switch** — any script that writes it must restore it from an `EXIT` trap, or one run locks every user out.
9. **The Storage bulk-delete `{"prefixes":[…]}` answers `200` and deletes nothing** — delete objects **by path**.
10. **`/tmp/keys.env`'s `SECRET` is rotated and stale (401)** — the legacy `SVC` JWT still works; **prove a credential before mutating config** (a stale key silently skipped a budget write and cost US$0.09).
11. **JWTs in `/tmp/user.env` expire in ~1 h.**

**Client**
12. ⚠️ **`i18n-js` reads `.` as a scope separator.** The `MESSAGES` table is *flat by design*, so a dotted key silently resolved to `[missing "en.…" translation]` on the device — for **all 16** of them. `src/lib/i18n.ts` now disables scope splitting, and `check:lib` asserts every message **resolves** *and* returns its own copy verbatim. **Do not "tidy that away".**
13. **The worktree needs its own `.env`** (gitignored; copy `.env.example`). Without it `supabase()` throws *"Supabase is not configured"* and the ritual dies at `preparing`.

## 7 · Commands

```bash
npm install                      # node_modules may be absent in a fresh worktree
npx expo start --android         # run the app on the emulator via Expo Go
npm run check                    # the full local gate suite
npm run check:db                 # SQL tests (needs docker + supabase/.temp/pooler-url)
npm run check:budget             # the live stop-rule proof — free by default
npm run check:wire               # the slice's route contract + outcome mapping
npx tsc --noEmit
npx supabase db push --yes       # apply migrations (linked to yercgevebxvtzkgctfai)
npx supabase migration list      # expect 11/11, no drift
systemctl --user stop floor-avd  # stop the emulator (see trap 1 to start it)
```

## 8 · Money

fal.ai credit: **≈ US$4.98 spent** of the approved **US$10–20** (style-D spike US$4.49 · PR-3 ≈US$0.40 · SCRUM-59 ≈US$0.09). **S31 (2026-10-06) spent nothing** — no Path C run was made. A full Path C generation is ≈ **US$0.09**; the stop-rule bounds the global daily spend, and every spend is logged in `project-costs.md` (SGD, Mastercard rate or a marked placeholder).
