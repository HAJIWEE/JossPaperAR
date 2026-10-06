# Contributing — JossPaperAR

> Conventions for working in this repo. Context: hobby project, AI-assisted
> ("vibe") coding, no timeline pressure — but a **locked design** (Penpot) and
> **accepted ADRs** that code must obey.

## 📋 Issue tracking — Jira first

**Jira is the source of truth** for work items → [hajiwee9411.atlassian.net](https://hajiwee9411.atlassian.net), project **SCRUM**.
GitHub Issues are enabled but are *not* the tracker — file work in Jira and reference the key (e.g. `SCRUM-15`) in commits and PRs.

## 🌿 Branching

- `main` is the protected default — never push to it directly; open a PR.
- AI/Cline sessions work on `cline/<id>` branches (worktrees), then PR into `main`.
- Branch names: `cline/<short-purpose>` or `feature/<short-purpose>`.

## ✍️ Commits

- Imperative subject, concise: `Add CI workflow for design-system checks`
- Reference the Jira key when the change closes or advances a ticket: `… (SCRUM-15)`
- Keep secrets out — `.env` is gitignored; only `.env.example` (with placeholders) is committed.
- **Unsigned commits from an AI session are expected and accepted** (PM decision, 2026-10-04). The GPG signing key's passphrase is not available to the agent shell and there is no pinentry/TTY, so `git commit -S` hangs — agents commit with signing off rather than blocking. *Don't re-raise this as a finding.* If signed history is ever required, `git commit --amend -S` locally (with the passphrase cached) or squash-merge, which GitHub signs.

## ✅ Checks — run before opening a PR

```bash
npm run check                            # runs everything below, in order
```

```bash
npm run typecheck                        # tsc --noEmit
npm run check:tokens                     # src/theme/tokens.ts ↔ design-system/tokens.css
npm run check:domain                     # aim bands · award · wallet invariant · quotas
npm run check:pathc                      # ADR-002's LOCKED Path C pipeline (endpoints · v3 clauses · no colour leak)
npm run check:sql                        # migration structure: balanced $$/parens, closed statements (trap #7)
npm run check:lib                        # client libs: keys · invites · EN/中文 parity · split storage · the queue
node design-system/contrast-check.js     # expect: all 22 contrast checks passed
node design-system/responsive-check.js   # expect: all 21 responsive checks passed
npx expo-doctor                          # expect: 21/21 checks passed
```

**Against a real database** (needs the hosted project; `check:db` uses the pooler URL from `supabase/.temp/`):

```bash
supabase db push            # apply migrations, then confirm: supabase migration list (no drift)
npm run check:db            # the PR-3 SQL verification (supabase/tests/*.sql)
```

`check:pathc`, `check:sql` and `check:db` are **dependency-free** and run in CI's design-system job; `check:lib` needs `node_modules` (it imports `i18n-js`) and runs in the app job. The full run is:

```bash
npm run check                            # runs all of the above, in order
```

CI (`.github/workflows/ci.yml`) runs all of the above on every push/PR to `main`, so a red PR means one of them broke.

**Both `src/**/checks/*.ts` scripts are fault-tested.** Before trusting a green run, corrupt a value and confirm it goes **red** — a harness that cannot fail is not a check (the retired prototype's guard-square rule). `check:domain` is the **acceptance test of the vertical slice**: *the four aim bands grade true*, not fps.

**Colour rule the lint enforces:** decorative brand tokens (`--gold`, `--cinnabar`, …) are for borders/fills only — text must use a `-text` token from `tokens.css`. New colour pairings must clear **WCAG AA 4.5:1 on every cream surface**.

**Responsive rule:** no hard-coded type sizes or `390/844` canvas literals in build CSS; safe-area insets and the `vh`/`dvh` pair are mandatory (see `design-system/responsive.css`).

When the real build stylesheet exists, point both checks at it: `--css=path/to/styles.css`.

## 📚 Documentation conventions

- **ADRs** (`AppDesignConceptBoard/ADRs/`) — one record per architecture decision: context · decision · rejected alternatives · consequences. Accepting one updates the ADR register in `AppDesignConceptBoard/README.md`.
- **Session log** lives in `completed-work-archive.md`, **newest first**; the live hand-off is `next-ai-context.md`; open work is `follow-up-items.md`. Keep those three in sync — nothing completed should linger in the open-work file.
- **Specs** live as numbered docs in `AppDesignConceptBoard/` (01–21) and are authoritative over prototypes: the `prototype/` folder is **retired** — it is a spec, not code.
- **Costs** go in `project-costs.md` (SGD, one row per actual/commitment).

## 📱 Build conventions (ADR-001 — app scaffolded, single repo)

- Stack: **Expo / React Native** (Android-first, iOS deferred) + **Supabase** + hosted AI APIs.
- **Non-AR AR** (ADR-003): `expo-camera` preview + fixed-position overlay; the fire is a ≤400 KB sprite sheet, ≥30 fps on the Tier-F floor device. Aim bands are the acceptance test, not fps.
- Machine-readable verdicts, not eyeballing: every behaviour gets a scripted check (the retired `aim-check.js` / `render-check.js` pattern) and at least one device check.
- AI keys stay **server-side** (Supabase Edge Functions); client sees only `EXPO_PUBLIC_*` values (`.env.example`).
- **Routes live in `src/app/`** (Expo Router — every file is a screen); non-route code stays outside it. Pure logic goes in `src/domain/` (no React, no network) so the server can import the *same* constants.
- **`design-system/tokens.css` is authoritative**; `src/theme/tokens.ts` mirrors it and `check:tokens` fails if they drift. Never hard-code a hex in a component.

### ⚠️ Four traps already paid for — don't re-learn them

1. **There is no `babel.config.js`** — Expo SDK 57 does not need one, and adding one that references `babel-preset-expo` **breaks the bundle** (`babel-preset-expo` is nested under `expo/`, not resolvable from the root). It was added and removed during SCRUM-57; the Android bundle is the proof (`npm run bundle:android`).
2. **Reanimated's Babel plugin moved** (when it lands with the throw): v3 = `react-native-reanimated/plugin`, v4 = `react-native-worklets/plugin`. A wrong plugin fails **silently at runtime**, not at build.
3. **`expo-secure-store` caps a value at ~2 KB** — a Supabase JWT can exceed it; use the split-storage pattern (small key in SecureStore, bulk in AsyncStorage).
4. **`npm ci` is the CI gate, and it is stricter than `npm install`.** `react-dom` must stay pinned to the version matching `react` (SDK 57 = `19.2.3`) or `npm ci` fails with ERESOLVE and the PR goes red. If you add a dependency, run `npm ci --dry-run` before pushing.
