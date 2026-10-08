# 🤝 Hand-over prompt — next AI session

> **Written 2026-10-07 (S33 wrap) · rewritten 2026-10-08 (S34 wrap).** Paste everything below the rule into a fresh session's first message.
> It is deliberately self-contained: goal · state · what to do first · traps · files.
> The living versions are **[[next-ai-context]]** (state) · **[[follow-up-items]]** (open work) · **[[completed-work-archive]]** (history) · **[[AppDesignConceptBoard/19-build-plan-services-api-environments|doc 19]] §12** (what the backend found).

---

## 1 · Goal

Continue building **JossPaperAR** — an Expo/React Native AR app that replaces physical joss-paper burning with a digital ritual. Repo: `github.com/HAJIWEE/JossPaperAR` — work on a **`cline/<id>` worktree**, then PR into `main` (S34 used `/home/gweejiahan/.cline/worktrees/c1292/JossPaperAR` on `cline/c1292`) · the vault worktree is `~/Documents/Obsidian Vault/Projects/JossPaperAR` · Jira `hajiwee9411.atlassian.net` (project **SCRUM**, the source of truth for decisions).

**Where the project is.** The backend of record is **live and exercised** (Supabase + Postgres + Edge Functions on hosted `yercgevebxvtzkgctfai`), the economy's **AI-cost ceiling is enforced**, the **Android emulator target is live**, and 🎉 **the vertical slice completes a FULL ritual on glass** — capture → cartoonize → burn → award → persist.

**This session's work is on `cline/c1292` in PR #28 — OPEN, NOT MERGED.** `main` is still **`a076b88`**; the branch is **`940c85b`** (13 commits, CI green on every one). Nothing has been merged.

What S34 added, all committed and gated:

- ✅ **`SCRUM-46` — the clan system, end to end.** Backend: migrations **`0012`** (the role ladder + the Book read path + RLS + anti-abuse), **`0013`** (the head-exit ramp), **`0014`** (the successor's rank). Frontend: `clan-api.ts` (11 RPC wrappers) · `clan-flow.ts` · `clan-ui.tsx` · five screens (`clan/index|create|join|manage|book`). New gate **`check:clanapi`**.
- ✅ **`SCRUM-84` — ANSWERED and built.** The successor **inherits the departing rank** (`set role = v_role`): a departing `head` hands over to a new **`head`**, a departing **sole `co_head`** to a `co_head`, and a head leaving a co-head behind promotes **nobody**. ⚠️ This **reverses `0013`'s own rationale** that `head` was "the founder's immutable fact" — what survives is the **founding** fact (`clans.created_by` is never rewritten); headship now has a **line of succession**.
- ✅ **`SCRUM-85` — BUILT** (the `SCRUM-83` answer, option E): the first burn is a **tutorial** — no clan, no points, **no AI spend** — then the fork.

**Left for next session:** merge PR #28 · **the first device run** of the clan screens and the tutorial (nothing has been seen on glass) · **`SCRUM-50`** (the QR half — ⚠️ still in the **backlog**, so move it into the sprint *when you start it*) · the **Home clan card** (needs a Home design pass) · **`SCRUM-52`** (the device purchase) · **`SCRUM-83`'s ZH character-set mismatch** (the doc says simplified, the shipped i18n is traditional).

## 2 · The PM's working rules (non-negotiable)

- Work on a **`cline/<id>` branch in a worktree**, then **open a PR into `main`**. Never push to `main` directly; never merge without being asked.
- **Anything worked on is in the sprint.** An `In Progress` / `In Review` ticket must be in the active sprint — **read the current sprint id, never hard-code it** (`jql: project = SCRUM AND sprint IN openSprints()`), set `customfield_10020`, then **read it back** (the field is not echoed on every write). ⚠️ **Resuming a backlog ticket counts as starting work** — move it in the same action. Before ending a session, `jql: project = SCRUM AND sprint is EMPTY AND statusCategory = "In Progress"` **must return nothing**.
- **A decision for the PM goes to Jira** — a `Task` prefixed `🎯 Decide:`, in the sprint, explained so the PM can decide **without reading the repo**. Never leave it as a PR comment or a doc line. ⚠️ And when a decision is genuinely the PM's, **do not mark the deliverable `Done` on your own recommendation** — park it `In Review` and let the decision ticket carry the open question.
- **Docs are part of "done"**: `next-ai-context.md` · `follow-up-items.md` (closed items move to `completed-work-archive.md`) · `project-costs.md` · and a **Jira comment** on the ticket.
- **Prove it with a real call.** A check that cannot fail is not a check — **fault-test every new gate** by breaking it once and confirming it goes red. ⚠️ **And fault-test BOTH directions when a rule has two branches.** S34's migration `0014` is the model: fixture **A** fails when the rank is hard-coded `co_head`, fixture **H** fails when it is hard-coded `head`, and only the real rule passes both.
- **Unsigned commits from an AI session are fine** (`CONTRIBUTING.md` § Commits). `git commit` hangs in an agent shell (GPG waits on pinentry) → use `git -c commit.gpgsign=false`.

## 3 · Do this first, in order

1. Read `next-ai-context.md` (*Quick Reference* → *Start Here*) → `follow-up-items.md` → doc 19 **§12.11 – §12.12e** (the ritual's first complete run, then the clan API, the head-exit ramp, the tutorial, and the successor's rank).
2. **PR #28 is OPEN and awaiting the PM's merge.** Do not assume it is in. `main` = `a076b88`; `cline/c1292` = `940c85b`. ⚠️ A fresh worktree has **no `node_modules` and no `.env`** — run `npm install` and copy `.env.example` → `.env` before anything else, or the ritual dies at `preparing`. Verify a merge with `git merge-base --is-ancestor <branch> origin/main` — **not** `origin/<branch>`, which `git fetch --prune` deletes *after* a merge.
3. **Green the local gates before touching anything**, so a red one is definitely yours: `npm run check` + `npx tsc --noEmit`. Expect **`lib` 242**, `check` reporting **14 migrations structurally sound**, and **0** TS errors.
4. **Start the local stack for the DB gates** — `npx supabase start` (free, no account, applies the migrations **from the files**). Then `npm run check:clanapi` (**81/81**) and the SQL suite (⚠️ **needs `--network host`** — trap 20; without it every file reports `Connection refused` and it *reads* like a failing test).
5. **Sprint audit** (rule 2). It was clean at the S34 wrap: `SCRUM-46` **In Progress** and `SCRUM-85` **In Review**, both in **Sprint 1 (id 1)**; `SCRUM-50` deliberately left in the backlog. ⚠️ `SCRUM-50` is **`To Do` with no sprint** — if you pick it up, move it in *first*.
6. Then pick from §5.

## 4 · What exists (verified against the repo and the local stack — not asserted)

| | |
|---|---|
| `main` | **`a076b88`** — every PR through **#27** merged, CI green |
| this branch | **`cline/c1292` = `940c85b`** · 13 commits · **PR #28 OPEN** (not merged) |
| local gates | `npm run check` **all green**: `tokens 36 · domain 45 · slice 36 · throw 33 · ads 51 · wire 52 · session 17 · pathc 38 · sql/migrations 14 · adrs 34 · contrast 22 · responsive 21 · lib 242` |
| DB gates | `check:clanapi` **81/81** · `clan_management.sql` **109 assertions, exit 0** — both need `npx supabase start`; the SQL suite also needs **`--network host`** (trap 20) |
| migrations | **14 files on disk.** The hosted project was last verified at **12/12**, so ⚠️ **`0013` and `0014` are almost certainly NOT applied there**, and this worktree is **not linked** (`Cannot find project ref`). `npx supabase link` + `migration list` **before** any `db push` — and expect to push **2** |
| typecheck | `npx tsc --noEmit` → **0 errors** |
| screen counts | **5** clan screens · the tutorial branch in `capture → preparing → burn → reward` |
| spend | fal.ai **≈ US$5.16** of the approved **US$10–20** — **unchanged**: S34 spent **US$0.00** |

**The two things S34 deliberately did NOT do:** no **device run** (nothing on glass), and no **`db push`** to the hosted project (migrations were proved on the local stack instead, which is free and equally real).

## 5 · What's next — the PM picks

1. **⭐ Merge PR #28** *(PM action — everything in it is green)*. It carries `SCRUM-46`'s clan system, `SCRUM-84`'s succession rule and `SCRUM-85`'s tutorial. Until it merges, `main` does not have the clan system at all.
2. **⭐ The first DEVICE RUN — the highest-value unknown in the project.** Nothing about the clan screens or the tutorial has ever been seen on glass. They are validated only by types, `check:lib` and the `check:clanapi` contract. Run the emulator (traps 1 · 14 · 15 · 16) and drive **tutorial → fork → create → join → manage → book**, then a **second** ritual as a real clan member. ⚠️ Expect this to find defects the gates *cannot* see — S32 found **three** in the write path that had never executed.
3. **`SCRUM-50` — the QR half of `SCRUM-46`** (generation · scanner · invite deep links). ⚠️ It is **`To Do` with NO sprint** — move it into the active sprint *in the same action* that starts it (rule 2). `clans.code` already exists; the payload is the invite deep link (architecture: doc 07 §4.6).
4. **The Home clan card** — `SCRUM-46`'s last surface. ⚠️ It needs a **Home design pass**: the signed-off layout has **no free band**, so this is a **design** task before it is a coding one.
5. **`SCRUM-52` — buy the Tier F floor device** (the named CI phone, four-band acceptance test). A PM purchase, in Sprint 1.
6. **`SCRUM-83`'s ZH character-set mismatch** — doc 15 §8 specifies **simplified**, the shipped `i18n.ts` is **traditional**. Small, but it is a real product decision, not a typo.

**Recommended:** (1) then (2). The device run is where the next real bugs are, and it needs nothing but the emulator.

## 6 · Traps that cost real time (measured — don't re-derive them)

**Emulator / toolchain**

1. ⚠️ **The emulator SEGFAULTS when headless** — `-no-window` (any GPU mode: `swiftshader_indirect`, `off`) kills `qemu-system-x86` with `status=11/SEGV` ~26 s into boot. It needs a **real display**. Run it detached, or it is reaped: `systemd-run --user --unit=floor-avd --collect --setenv=DISPLAY=:0 --setenv=XAUTHORITY=/run/user/1000/xauth_<id> /opt/android-sdk/emulator/emulator -avd floor_api30 -no-snapshot -no-boot-anim`.
2. **`sdkmanager` is deprecated** — the CLI is `android sdk list/install`, `android emulator create|list|start|stop`, `android info`, `android init`.
3. **`platforms;android-36` ≠ `android-36.1`** — a minor-version platform is **not** a drop-in (it needs `minorApiLevel = 1` **and AGP 8.13+**). Install the base one. *(Moot for Expo Go, which compiles nothing locally.)*
4. **Watchman is not needed** (SDK ≤ 55 only). **JDK 17 is not needed** — there is no `expo-dev-client`.
5. **Never `sudo android-studio`** — it leaves root-owned SDK paths and *"Failed to read or create install properties file"*.

**Backend / data**

6. ⚠️ **`run-sql-tests.sh` calls `docker run` WITHOUT `--network host`** — so `127.0.0.1:54322` resolves to the *throwaway client container's own* loopback, and **every** SQL file reports `Connection refused` while the stack is perfectly healthy. It **reads exactly like a failing test** (S34 nearly diagnosed it as its own breakage). Locally, run the suite yourself with `--network host`: `docker run --rm -i --network host postgres:17 psql "<url>" -v ON_ERROR_STOP=1 -q -f - < supabase/tests/<file>.sql`. The same trap applies to any `docker run` test client.
7. **No local `psql`, and no CLI `query` subcommand.** Run SQL by adding a migration, `db push`, then delete the file and `migration repair --status reverted <version>` — otherwise the remote history drifts.
8. **Never edit an applied migration** — fixes get a new version number. ⚠️ **S34 applied this the strict way:** a *comment-only* edit is safe (prove it by filtering the diff to non-comment lines — the executable SQL must be byte-identical), but a **behavioural** change goes in a **new migration** even when the old one looks local-only. Reason: a worktree without `supabase link` **cannot prove** whether a migration is live, and an unverifiable edit is how drift starts. That is why the successor's rank is `0014`, not an edit to `0013`.
9. ⚠️ **`supabase db reset` re-applies the migration files** — the fast, free way to make a migration change take effect locally, and the way to clear residue. You can also re-apply a single `create or replace function` migration by hand (`psql -f supabase/migrations/<file>.sql`) without a reset — but the SQL suite's `assert_true` **RAISES**, so a failing run aborts **before** its teardown and leaves residue; `db reset` before trusting the next run.
10. **`app_config` is a kill switch** — any script that writes it must restore it from an `EXIT` trap, or one run locks every user out.
11. **The Storage bulk-delete `{"prefixes":[…]}` answers `200` and deletes nothing** — delete objects **by path**.
12. **`/tmp/keys.env`'s `SECRET` is rotated and stale (401)** — the legacy `SVC` JWT still works; **prove a credential before mutating config** (a stale key silently skipped a budget write and cost US$0.09).
13. **JWTs in `/tmp/user.env` expire in ~1 h.**
14. ⚠️ **`set_member_role` REFUSES `head`, deliberately.** The ladder appoints `co_head`s; **succession through `leave_clan` is the only path to headship** (migration `0014`). Do not "fix" the refusal — it is the difference between an appointment and a line of succession.
15. ⚠️ **Two `head` rows exist momentarily inside a succession** (the promotion runs before the departing head's row is deleted). Safe and proved: there is **no uniqueness constraint** on `head`, and the deferred ≥1-head-power trigger is a **minimum**, not a maximum.
16. ⚠️ **Re-defining `leave_clan`: match the SIGNATURE exactly.** `leave_clan(uuid)` and `leave_clan(uuid, uuid default null)` are **different functions**, and because of the `default` the 2-arg one is callable with **one** argument — leaving both in place makes every 1-arg call **ambiguous** (`could not choose the best candidate function`). `0013` dropped the 1-arg form for that reason; `0014` used `create or replace` on the **identical** signature rather than dropping again.
17. **The SQL-harness traps in `AGENTS.md` § Known traps** bite silently — read them before writing a test: `SET LOCAL` / `set_config(…, is_local := true)` **do not survive across statements** (use session-scoped), a `pg_temp` table **grants nothing** to PUBLIC, and a `DEFERRABLE INITIALLY DEFERRED` constraint trigger fires at COMMIT so an exception handler **cannot** catch it.

**Client**

18. ⚠️ **`i18n-js` reads `.` as a scope separator.** The `MESSAGES` table is *flat by design*, so a dotted key silently resolved to `[missing "en.…" translation]` on the device — for **all 16** of them. `src/lib/i18n.ts` now disables scope splitting, and `check:lib` asserts every message **resolves** *and* returns its own copy verbatim. **Do not "tidy that away".**
19. **The worktree needs its own `.env`** (gitignored; copy `.env.example`). Without it `supabase()` throws *"Supabase is not configured"* and the ritual dies at `preparing`.
20. **The burn screen's graded THROW is a swipe** — `adb shell input swipe 360 1101 360 717 500`, then **Confirm** at `(360, 1113)`. ⚠️ **A Metro warning toast sits over the bottom and eats the swipe** — dismiss it first (tap the `×` at ~`(656, 1091)`), or the throw silently does not register.
21. **Metro survives an emulator restart.** After re-booting `floor-avd`, relaunch the app with `adb shell am start -a android.intent.action.VIEW -d 'exp://<host-LAN-ip>:8081' host.exp.exponent` (the dev server is still on `:8081`). Re-read the bundle from Metro — the whole point is to run the **new** code.
22. **`pkill -f 'qemu-system-x86_64'` SELF-MATCHES** — the pattern matches the `pkill` command's own cmdline, so it SIGTERMs the shell. Stop the emulator with **`systemctl --user stop floor-avd`** (`systemctl --user reset-failed floor-avd` to clear a failed unit), never `pkill -f`.
23. **The slice's clan needed NO migration.** `create_clan` is SECURITY INVOKER (granted to `authenticated`) and `clan_members_select_member` lets a caller read their own membership — so **do not add a migration for the slice's clan.**
24. ⚠️ **There are NO generated DB types.** Nothing statically checks an RPC's argument names or response fields — `tsc` is blind to it and a typo fails **only on a device**, as an empty screen. **`npm run check:clanapi` is that gate** (it drives the real RPCs over real PostgREST). **When you add an RPC or change its shape, extend that file** — it was fault-tested by renaming `p_clan_id` to `p_clanid`, which turned **22** checks red.
25. ⚠️ **The tutorial must never spend AI money.** A live Path C call costs **≈US$0.09 for every new user**, invisibly, before any quota or clan exists to bound it. `TUTORIAL_CONSEQUENCES` states `createsClan · awardsPoints · writesLedger · callsServer · callsAi` as **all-`false` data a gate asserts**, and the demo skips `registerCapture`/`uploadCapture`/`requestCartoonize` entirely. `DemoReceipt` is a **different type** from `BurnReceipt` so demo money cannot render as real.

**GitHub / records**

26. ⚠️ **Create PRs with the GitHub MCP server, NOT `gh`.** They authenticate differently: `git push` works through the **`kwallet6`** credential helper (KWallet) while `gh` uses a **fine-grained PAT in its own keyring** (`~/.config/gh/hosts.yml`, no `GH_TOKEN` env). That PAT is **read-only** on this repo — `gh api /repos/HAJIWEE/JossPaperAR --jq .permissions` answers `{"pull":true,"push":false,…}` — so `gh pr create` fails with **`403 Resource not accessible by personal access token (createPullRequest)`** *even though the push just succeeded*. ⚠️ **Measured correction (S34): `gh api` READS work fine** — `gh api /repos/HAJIWEE/JossPaperAR/actions/runs` returned CI status reliably and is the quickest way to check a run. It is **writes** that 403. Do not burn a round-trip "fixing token permissions".
27. **A 403 is not a 401.** `gh auth status` reporting *no* `Token scopes:` line is the **fine-grained-PAT fingerprint** (classic tokens list their scopes) — a useful tell when diagnosing which credential is actually in play.
28. ⚠️ **Scope the sprint audit or it cries wolf.** `sprint is EMPTY AND statusCategory = "In Progress"` is the check; widening it to `statusCategory != "Done"` returns **the entire backlog** (SCRUM-4, 5, 12, 13, 47, 49, 50, 51 …), which is a *correct* backlog and not a failure. A gate that is always red gets ignored — or worse, an agent drags every `To Do` ticket into the sprint to silence it.

## 7 · Commands

```bash
npm install                       # node_modules may be absent in a fresh worktree
cp .env.example .env              # the worktree needs its own (trap 19)
npx expo start --android          # run the app on the emulator via Expo Go
npm run check                     # full local gate suite — expect lib 242, 14 migrations sound
npm run check:clanapi             # client↔server clan CONTRACT — needs `npx supabase start`
npm run check:db                  # SQL tests (needs docker + supabase/.temp/pooler-url)
npm run check:budget              # the live stop-rule proof — free by default
npx tsc --noEmit                  # expect 0 errors

npx supabase start                # local stack: applies the migrations FROM THE FILES (free, no account)
npx supabase db reset             # re-apply the migration files; also clears residue (trap 9)
npx supabase migration list       # ⚠️ verify the REMOTE count before any push (trap 8)
npx supabase db push --yes        # ⚠️ only after `link` + `migration list` — expect to push 2

# the SQL suite, run the way that actually works locally (trap 6):
docker run --rm -i --network host postgres:17 psql \
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -q -f - < supabase/tests/clan_management.sql

systemctl --user stop floor-avd   # stop the emulator (trap 1 to start it; never `pkill -f`)
```

## 8 · Money

fal.ai credit: **≈ US$5.16 spent** of the approved **US$10–20** (≈ **S$6.61** at the Mastercard rate **1.2808**) — the style-D spike US$4.49 · PR-3 ≈US$0.40 · SCRUM-59 ≈US$0.09 · the two 2026-10-07 E2E runs ≈US$0.09 each. A full Path C generation is **≈US$0.09**; the stop-rule bounds the global daily spend, and **every** spend is logged in `project-costs.md`.

**You may spend freely inside the budget — no need to ask.** ⚠️ Re-derive the total from `project-costs.md` rather than trusting this line; it goes stale silently.

⚠️ **S34 spent US$0.00, and that is the pattern worth copying:** a migration can be proved against a **local Supabase stack on Docker** (real Postgres 17.11 + real PostgREST) for free, so **prefer the local stack to a hosted push** when the goal is verification rather than deployment. The only thing that costs money here is **fal.ai**, and the tutorial exists precisely so that new users never trigger it.





