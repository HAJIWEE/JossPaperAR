# 🤝 Hand-over prompt — next AI session

> **Written 2026-10-07 (S33 wrap) · reconciled 2026-10-08 (S34).** Paste everything below the rule into a fresh session's first message.
> It is deliberately self-contained: goal · state · what to do first · traps · files.
> The living versions are **[[next-ai-context]]** (state) · **[[follow-up-items]]** (open work) · **[[completed-work-archive]]** (history) · **[[AppDesignConceptBoard/19-build-plan-services-api-environments|doc 19]] §12** (what the backend found).

---

## 1 · Goal

Continue building **JossPaperAR** — an Expo/React Native AR app that replaces physical joss-paper burning with a digital ritual. Repo: `github.com/HAJIWEE/JossPaperAR` — work on a **`cline/<id>` worktree**, then PR into `main` (this S34 session used `/home/gweejiahan/.cline/worktrees/c1292/JossPaperAR` on `cline/c1292`) · the vault worktree is `~/Documents/Obsidian Vault/Projects/JossPaperAR` · Jira `hajiwee9411.atlassian.net` (project **SCRUM**, the source of truth for decisions).

**Where the project is:** the backend of record is **live and exercised** (Supabase + Postgres + Edge Functions on the hosted project `yercgevebxvtzkgctfai`), the economy's **AI-cost ceiling is enforced**, the **Android emulator test target is live**, and 🎉 **the vertical slice (PR-4 = SCRUM-53) now completes a FULL ritual on glass** — capture → cartoonize → burn → **award → persist**. All three blockers are fixed (`SCRUM-80` auth · `SCRUM-81` upload · `SCRUM-82` the clan-scoped award). **Left: run the four-band acceptance test on the real Tier-F device (`SCRUM-52`), and answer one open product decision (`SCRUM-83`).** ✅ **The merge train is closed — `main` = `a076b88`, every PR through #27 merged, CI green.**

## 2 · The PM's working rules (non-negotiable)

- Work on a **`cline/<id>` branch in a worktree**, then **open a PR into `main`**. Never push to `main` directly; never merge without being asked.
- **Anything worked on is in the sprint.** An `In Progress` / `In Review` ticket must be in the active sprint — **read the current sprint id, never hard-code it** (`jql: project = SCRUM AND sprint IN openSprints()`), set `customfield_10020`, then **read it back** (the field is not echoed on every write). Before ending a session, `jql: project = SCRUM AND sprint is EMPTY AND statusCategory = "In Progress"` **must return nothing**.
- **A decision for the PM goes to Jira** — a `Task` prefixed `🎯 Decide:`, in the sprint, explained so the PM can decide **without reading the repo**. Never leave it as a PR comment or a doc line.
- **Docs are part of "done"**: `next-ai-context.md` · `follow-up-items.md` (closed items move to `completed-work-archive.md`) · `project-costs.md` · and a **Jira comment** on the ticket.
- **Prove it with a real call.** A check that cannot fail is not a check — **fault-test every new gate** by breaking it once and confirming it goes red.
- **Unsigned commits from an AI session are fine** (`CONTRIBUTING.md` § Commits). `git commit` hangs in an agent shell (GPG waits on pinentry) → use `git -c commit.gpgsign=false`.

## 3 · Do this first, in order

1. Read `next-ai-context.md` (*Quick Reference* → *Start Here*) → `follow-up-items.md` → doc 19 **§12** (esp. **§12.11**, the ritual's first complete run).
2. **Nothing is awaiting review.** **PR #27 is MERGED** (2026-10-07) and `main` = **`a076b88`**; PRs **#24–#27** (the red CI · SCRUM-80 · SCRUM-81 · SCRUM-82) are all in. ⚠️ A fresh worktree has **no `node_modules` and no `.env`** — run `npm install` and copy `.env.example` → `.env` before anything else, or the ritual dies at `preparing`. Verify a merge with `git merge-base --is-ancestor <branch> origin/main` — **not** `origin/<branch>`, which `fetch --prune` deletes *after* a merge.
3. **Ask the PM for the `SCRUM-83` call** (🎯, in Sprint 1): how the slice gives a new user a clan — **A** auto-create a personal altar (*shipped*, the recommendation) · **B** one shared seeded clan · **C** build the real create/join flow now · **D** defer. ⚠️ **The merge already happened without it (PR #27, 2026-10-07) and the ticket still carries no comment** — so this now decides whether **A** *stays*, not whether the PR lands. It is the **one open product decision**.
4. Baseline is green: `npm run check` and `npx tsc --noEmit`.
5. The emulator E2E is **re-runnable** and is the only real proof of the award path (≈**US$0.09** per run) — see §6 traps 14–16 for the exact recipe.

## 4 · What exists (verified against the live project, not asserted)

- **Supabase** `yercgevebxvtzkgctfai` (ap-southeast-1, Postgres 17.11, CLI v2.119, **linked**) — **11 migrations, no drift** · 21 tables · 25 policies · private buckets `captures` (300 KB jpeg) + `styled` (webp+png) · **3 Edge Functions deployed and run** · **anonymous sign-ins ARE enabled and proven**.
- **The AI-budget stop-rule (SCRUM-59)** — `app_config.daily_ai_budget_micros` = **$5/day**, server-only; the shrine **queues** (`200 shrine_busy`) rather than failing, and a parked job does not consume one of the ten daily attempts.
- **The slice, proven end-to-end (2026-10-07)** — the full ritual ran on `floor_api30`: capture → cartoonize (**styled, US$0.09**) → burn (**虔誠 Devout ±28.57 px**) → **award → persist** → `clans: 1` ("My Altar") · `clan_members: 1` (head) · `burns: 1` (band `devout`, `award_snapshot` **600**) · `ledger_events: 1` · `tributes: 1`. The reward screen showed the **server's** receipt — **600 · Balance 600** (ADR-005).
- **The slice's write path** — `preparing.tsx` → `registerCapture` · `uploadCapture` · `requestCartoonize`; `reward.tsx` → `ensureClan()` → `submitBurn(…, clanId)`. Fixed and pinned by **`npm run check:wire`** (43 checks) + the clan rules in **`check:lib`**.
- **The emulator target (SCRUM-64)** — `floor_api30`: Android **11 / sdk 30** · **720×1280** · **320 dpi** · **2.92 GB**, read off the device.
- **Gates** — `npm run check` = tokens 36 · domain 45 · slice 36 · throw 33 · ads 51 · **wire 43** · pathc 38 · sql 11 · adrs 34 · contrast 22 · responsive 21 · **lib 105** (+ `session` 17).

## 5 · What's next — the PM picks

1. 🎯 **`SCRUM-83` — how the slice gives a new user a clan.** Decides whether to keep the shipped auto-create (**A**) or switch (**B/C/D**). **The one open product decision** — the merge is already done, so **B/C/D** now mean *rework*, not *delay*.
2. **`SCRUM-52`** — the **four-aim-band acceptance test** on the floor device (buy the Tier-F unit, ~S$100–150). **Now unblocked** — the ritual completes. *A PM action.*
3. ✅ **Merge PR #27 — DONE 2026-10-07** — and the **post-merge docs reconciliation is done too (S34 · 2026-10-08)**: the build track on `main` is fully merged (`a076b88`), so `next-ai-context.md`'s PR table and `follow-up-items.md`'s "PR #27 open" lines were corrected. No conflict had to be hand-resolved this time.
4. **`SCRUM-56` residual** — GH secrets + EAS login, once a throwaway Supabase project exists for CI.
5. **`SCRUM-33`** — `delete_my_data` does not purge Storage objects or the `auth.users` row. **`SCRUM-11`** — the league spec (`get_league_board` + `weekly-roll` are labelled stubs; `pg_cron` deliberately off).

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
14. **The burn screen's graded THROW is a swipe** — `adb shell input swipe 360 1101 360 717 500`, then **Confirm** at `(360, 1113)`. ⚠️ **A Metro warning toast sits over the bottom and eats the swipe** — dismiss it first (tap the `×` at ~`(656, 1091)`), or the throw silently does not register.
15. **Metro survives an emulator restart.** After re-booting `floor-avd`, relaunch the app with `adb shell am start -a android.intent.action.VIEW -d 'exp://<host-LAN-ip>:8081' host.exp.exponent` (the dev server is still on `:8081`). Re-read the bundle from Metro — the whole point is to run the **new** code.
16. **`pkill -f 'qemu-system-x86_64'` SELF-MATCHES** — the pattern matches the `pkill` command's own cmdline, so it SIGTERMs the shell. Stop the emulator with **`systemctl --user stop floor-avd`** (`systemctl --user reset-failed floor-avd` to clear a failed unit), never `pkill -f`.
17. **The clan fix needed NO migration.** `create_clan` is SECURITY INVOKER (granted to `authenticated`) and `clan_members_select_member` lets a caller read their own membership — so **do not add a migration for the slice's clan.**

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

fal.ai credit: **≈ US$5.16 spent** of the approved **US$10–20** (style-D spike US$4.49 · PR-3 ≈US$0.40 · SCRUM-59 ≈US$0.09 · the two 2026-10-07 E2E runs ≈US$0.09 each). A full Path C generation is ≈ **US$0.09**; the stop-rule bounds the global daily spend, and every spend is logged in `project-costs.md` (SGD @ the Mastercard rate 1.2808). **You may spend freely inside the budget — no need to ask.**
