This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

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

### Anything worked on is in the sprint — no exceptions

**A ticket you are actively working on must be in the active sprint.** Moving a ticket to `In Progress`/`In Review` while leaving it in the backlog hides the work from the sprint board and makes the board lie about what is happening.

This is not only for new tickets — **when you RESUME a backlog ticket, move it into the sprint in the same action.**

```bash
# the sprint id, re-read every time (never hard-code 1)
jql: project = SCRUM AND sprint IN openSprints()   → field customfield_10020
# then set it:  { "customfield_10020": <id> }

# the audit that must come back EMPTY — nothing in flight is stranded in the backlog
jql: project = SCRUM AND sprint is EMPTY AND statusCategory = "In Progress"
```

Run the audit before ending a session that changed any ticket's status. Two real cases it caught on 2026-10-05: **SCRUM-53** (the slice, moved to `In Progress` but left in the backlog) and **SCRUM-56** (PM provisioning, `In Progress` since 2026-10-03, never in a sprint). Both are now in Sprint 1, along with **SCRUM-52** (the device — in flight as a PM purchase even though its status is still `To Do`).

**Why it matters:** the sprint board is the PM's only honest view of the work. A ticket in the backlog and a ticket in the sprint are different claims about priority, and the board is where the PM looks to see what is actually moving.

**Why:** a decision that lives only in a PR description is invisible to the PM's workflow and will not be answered. An ADR stuck at 🟡 Proposed is a decision recorded as unmade — the ticket is what converts it.

**Corollary:** when a decision is genuinely the PM's, **do not mark the deliverable `Done`** on the strength of your own recommendation — park the build ticket in `In Review` and let the decision ticket carry the open question.

### Branching and merging

- Work on a **`cline/<id>` branch in a worktree**, then **open a PR into `main`**. Never push to `main` directly; never merge without being asked.
- `git commit` **hangs** in an agent shell (GPG signing waits on pinentry with no TTY). Commit with `-c commit.gpgsign=false`. Unsigned AI-session commits are accepted (`CONTRIBUTING.md` § Commits) — do not re-raise it.
- Worktrees share one `main` checkout, so `git checkout main` fails in a sibling worktree. Verify the merged state with `git merge-base --is-ancestor <local-branch> origin/main` — **not** `origin/<branch>`, because `git fetch --prune` deletes those refs *after* a merge and `--is-ancestor` then reports a misleading "not merged".
- Every applied migration is permanent: **never edit an applied migration** — add a new version number.

### Docs are part of "done"

Ship the docs with the work, not after: doc 19 §12.x · `next-ai-context.md` · `follow-up-items.md` (move closed items to `completed-work-archive.md`) · `project-costs.md` (SGD, Mastercard rate or a marked placeholder) · and a **Jira comment** on the ticket.

### Prove it with a real call

A check that cannot fail is not a check. **Fault-test every new gate by breaking it once and confirming it goes red**, and re-derive any figure you record from its inputs rather than copying a total forward. Record what you actually spent — a $0.00 line beats an absent one.

### Command set

```bash
npm run check            # full local gate suite (typecheck · tokens · domain · pathc · sql · adrs · contrast · responsive · libs)
npm run check:adrs       # ADR register ↔ files (status agreement)
npm run check:db         # SQL tests (needs docker + supabase/.temp/pooler-url)
npm run check:budget     # live AI-budget stop-rule proof — free by default
npx supabase migration list   # expect 11/11, no drift
npx supabase db push --yes
npx tsc --noEmit
```

**Known traps:** no local `psql` and no `supabase query` subcommand — to run SQL, add a migration file, `db push`, then delete it and `migration repair --status reverted <version>` or remote history drifts. `app_config` is a kill switch — any script that writes it must restore it from an `EXIT` trap. The Storage bulk-delete `{"prefixes":[…]}` answers `200` and deletes nothing; delete objects **by path**. A Path C generation is ≈ **US$0.09** — check the budget before spending.

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
