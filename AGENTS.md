This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## 🚦 Read this first — the Jira sprint rule

> **If you are working on a ticket, that ticket MUST be in the current sprint.**
>
> Run this **before you start work, and again before you finish**:
>
> ```bash
> # 1. which tickets are in flight but NOT in the sprint? — THIS must return nothing
> jql: project = SCRUM AND sprint is EMPTY AND statusCategory = "In Progress"
>
> # 2. and confirm your own ticket is actually in the sprint
> jql: key = <ISSUE-KEY>   → field customfield_10020
> ```
>
> To put it there: read the current sprint id from `jql: project = SCRUM AND sprint IN
> openSprints()` (**never hard-code the id — it changes every sprint**), then
> `editJiraIssue { "customfield_10020": <id> }`, then **read it back** — the sprint field is
> not echoed on every response, so a write that "succeeded" is not proof.
>
> **Resuming a backlog ticket counts as starting work** — move it into the sprint in the same
> action. It is not only for tickets you create.
>
> ⚠️ **Do not drag the whole backlog into the sprint.** A `To Do` ticket you are *not*
> working on belongs in the backlog — that is what a backlog is. The rule is about work in
> flight, not about emptying the queue. Only `In Progress` / `In Review` (and PM actions
> you have actually started) must be in the sprint.

Full detail, the reasoning, and the three real cases this caught: **Project rules → "Anything worked on is in the sprint"** below.

## Project rules (JossPaperAR)

This project's source of truth for decisions is **Jira** (`hajiwee9411.atlassian.net`, project `SCRUM`) — not the repo, not prose.

### PM decisions go to Jira — never just to a comment or a doc

**When a decision requires the PM (stakeholder), open a Jira ticket for it. Do not leave it as a PR comment, an ADR left in `Proposed`, or a line in a hand-off doc.**

Steps:

1. **Create a `Task`** in project `SCRUM` (issue type id `10003`).
2. **Prefix the summary with `🎯 Decide:`** (house convention for decision tickets — see SCRUM-59/60/61/62). Name the decision, not the work.
3. **Explain the context in the description** — enough that the PM can decide *without reading the repo*: what is already settled, what is genuinely open, why it needs a human (vs an engineering trade-off), the options with their consequences, what it blocks, and what happens if it is deferred.
4. **Add it to the active sprint.** Sprint field is `customfield_10020`; the current sprint is **id 1 = `SCRUM Sprint 1`** (2026-10-02 → 2026-10-16). Verify the sprint id via `jql: project = SCRUM AND sprint IN openSprints()` with field `customfield_10020` — **do not assume it stays 1**, and **do not assume a newly created issue is in the sprint** (it is not; set it explicitly and confirm with a read-back).
5. Label it `decision` (plus `pm-action`, and a domain label such as `adr-008` / `economy` / `cultural`).

**Why:** a decision that lives only in a PR description is invisible to the PM's workflow and will not be answered. An ADR stuck at 🟡 Proposed is a decision recorded as unmade — the ticket is what converts it.

**Corollary:** when a decision is genuinely the PM's, **do not mark the deliverable `Done`** on the strength of your own recommendation — park the build ticket in `In Review` and let the decision ticket carry the open question.

### Anything worked on is in the sprint — no exceptions

**A ticket you are actively working on must be in the active sprint.** Moving a ticket to `In Progress` / `In Review` while leaving it in the backlog hides the work from the sprint board and makes the board lie about what is happening.

This is **not** only for tickets you create. **When you RESUME a backlog ticket, move it into the sprint in the same action that starts the work** — resuming is what puts it in flight, and in-flight means in the sprint.

```bash
# 1. read the CURRENT sprint id — never hard-code 1, it changes every sprint
jql: project = SCRUM AND sprint IN openSprints()   → field customfield_10020

# 2. put the ticket in it — BEFORE you start working
editJiraIssue: { "customfield_10020": <id> }

# 3. read it back — the sprint field is not echoed on every response
jql: key = <ISSUE-KEY>   → field customfield_10020

# 4. before ending a session that changed any status, this MUST come back empty
jql: project = SCRUM AND sprint is EMPTY AND statusCategory = "In Progress"
```

⚠️ **Step 4 is the one that matters**, and the `statusCategory = "In Progress"` filter is deliberate. Widening it to `statusCategory != "Done"` returns **the entire backlog** — SCRUM-4, 5, 12, 13, 47, 49, 50, 51 and more — which is a *correct* backlog, not a failure. A gate that cries wolf is worse than no gate: an agent following "this must return nothing" would either drag every `To Do` ticket into the sprint or learn to ignore the check. **Scope the audit to work in flight.**

Three real cases the audit caught on 2026-10-05: **SCRUM-53** (moved to `In Progress`, left in the backlog), **SCRUM-56** (`In Progress` since 2026-10-03 and never once in a sprint — **two days of real work invisible on the board**), and **SCRUM-52** (the device — a purchase actively in flight, still sitting in the backlog; caught by eye rather than by the `In Progress` filter, which is why step 2 — confirm your *own* ticket — matters too).

**Why it matters:** the sprint board is the PM's only honest view of the work. A ticket in the backlog and a ticket in the sprint are different claims about priority, and the board is where the PM looks to see what is actually moving.

### Branching and merging

- Work on a **`cline/<id>` branch in a worktree**, then **open a PR into `main`**. Never push to `main` directly; never merge without being asked.
- ⚠️ **Open PRs with the GitHub MCP server (`createPullRequest`) — never the `gh` CLI.** `git push` and `gh` authenticate through **different stores**: git uses the `kwallet6` helper (KWallet), while `gh` holds a **fine-grained PAT in its own keyring** (`~/.config/gh/hosts.yml`; there is no `GH_TOKEN` in the env). That PAT is **read-only on this repo** — `gh api /repos/HAJIWEE/JossPaperAR --jq .permissions` answers `{"pull":true,"push":false,…}` — so `gh pr create` fails with **`403 Resource not accessible by personal access token (createPullRequest)`** *even though the push just succeeded*. **Do not go and "fix token permissions": that is the wrong diagnosis and a wasted round-trip.** Read PRs, CI and checks through the MCP too, for the same reason. *(Measured 2026-10-08, opening PR #28 — see `handover-prompt.md` §6 traps 18–19.)*
- `git commit` **hangs** in an agent shell (GPG signing waits on pinentry with no TTY). Commit with `-c commit.gpgsign=false`. Unsigned AI-session commits are accepted (`CONTRIBUTING.md` § Commits) — do not re-raise it.
- Worktrees share one `main` checkout, so `git checkout main` fails in a sibling worktree. Verify the merged state with `git merge-base --is-ancestor <local-branch> origin/main` — **not** `origin/<branch>`, because `git fetch --prune` deletes those refs *after* a merge and `--is-ancestor` then reports a misleading "not merged".
- Every applied migration is permanent: **never edit an applied migration** — add a new version number.

### Spend within the approved budget without asking

**You do not need to ask before spending fal.ai credit, as long as the spend stays inside the approved budget.**

* **Approved:** US$10–20 for the AI work; **US$5.16 spent** as of 2026-10-08 (≈ S$6.61 at the Mastercard rate 1.2808 — two Path C runs on 2026-10-07; reconciled at SCRUM-41). The full Path C pipeline is ≈ **US$0.09/run**. *Re-derive this figure from `project-costs.md` rather than trusting this line — it goes stale silently.*
* **In scope without asking:** any number of verification runs that keep the total **under US$20**.
* **Still ask first:** anything that would take the total **over US$20**, a new service or subscription, or a purchase of physical hardware.
* **Always:** log the spend in `project-costs.md` (SGD @ the Mastercard rate, with the USD figure and the derivation inline) and say what it bought. A $0.00 line beats an absent one.

Rationale: the ceiling exists so an unmetered bill cannot surprise us (doc 10 §6), not to require a round-trip before every $0.09 run. The stop-rule already bounds the *global* spend per day (`app_config.daily_ai_budget_micros`).

### Docs are part of "done"

Ship the docs with the work, not after: doc 19 §12.x · `next-ai-context.md` · `follow-up-items.md` (move closed items to `completed-work-archive.md`) · `project-costs.md` (SGD, Mastercard rate or a marked placeholder) · and a **Jira comment** on the ticket.

### Prove it with a real call

A check that cannot fail is not a check. **Fault-test every new gate by breaking it once and confirming it goes red**, and re-derive any figure you record from its inputs rather than copying a total forward. Record what you actually spent — a $0.00 line beats an absent one.

### Command set

```bash
npm run check            # full local gate suite (typecheck · tokens · domain · pathc · sql · adrs · contrast · responsive · libs)
npm run check:adrs       # ADR register ↔ files (status agreement)
npm run check:db         # SQL tests (needs docker + supabase/.temp/pooler-url)
npm run check:clanapi    # the clan client↔server CONTRACT (needs `npx supabase start`)
npm run check:budget     # live AI-budget stop-rule proof — free by default
npx supabase start                                            # local stack — applies the migrations FROM THE FILES, no account/link needed
bash supabase/checks/run-sql-tests.sh \
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres"   # the whole supabase/tests/ suite against that local Postgres
npx supabase migration list   # expect 12/12, no drift
npx supabase db push --yes
npx tsc --noEmit
```

**Known traps:** no local `psql` and no `supabase query` subcommand — to run SQL, add a migration file, `db push`, then delete it and `migration repair --status reverted <version>` or remote history drifts. `app_config` is a kill switch — any script that writes it must restore it from an `EXIT` trap. The Storage bulk-delete `{"prefixes":[…]}` answers `200` and deletes nothing; delete objects **by path**. A Path C generation is ≈ **US$0.09** — check the budget before spending.

**SQL-test harness traps** (measured 2026-10-08 — they break tests silently, so read them before writing one):

* ⚠️ `set_config(…, is_local := true)` and `SET LOCAL` **do not survive across statements** under `run-sql-tests.sh` — psql runs each statement in its own transaction (autocommit), and `SET LOCAL` even warns *"can only be used in transaction blocks"*. Use **session-scoped** `SET ROLE` / `set_config(…, false)`: that form works in **both** runners (and inside the CLI-migration path too).
* ⚠️ A `pg_temp` table grants **nothing** to PUBLIC. A test that switches to `authenticated` needs an explicit `grant select, insert, update, delete on pg_temp.<t> to authenticated`, or its first read/write fails with *permission denied for table*.
* A **`DEFERRABLE INITIALLY DEFERRED`** constraint trigger fires at COMMIT, so an exception handler **cannot** catch it. Force it with `set constraints <name> immediate` **inside the transaction** (at top level it only warns and does nothing) to make the violation observable and assertable.
* The local DB URL is printed by `npx supabase status`; a `docker run` test client needs `--network host` to reach `127.0.0.1:54322`.
* ⚠️ **The client has NO generated DB types**, so nothing static checks that an RPC's argument names (`p_clan_id`…) or response fields match the database — `tsc` is blind to it and it fails only on a device. `npm run check:clanapi` drives the real RPCs over real PostgREST and asserts the real fields. **When you add an RPC or change its shape, extend that file** — fault-tested by renaming `p_clan_id` to `p_clanid`, which turns 22 checks red.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
