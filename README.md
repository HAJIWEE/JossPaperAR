# JossPaperAR

> An AR app that replaces physical joss-paper burning with a digital ritual — capture an object, cartoonize it, throw it onto the fire, earn Tribute Points.
> Hobby project, family-legacy vision, no timeline pressure.

**Status:** 📐 design signed off · 📝 specs + ADRs written (**docs 01–19**) · 💻 **engineering started — repo + CI ✅ (SCRUM-15), Expo app scaffolded** · **next: SCRUM-57 repo bootstrap → SCRUM-54 backend → SCRUM-53 vertical slice** (build plan → [`AppDesignConceptBoard/19-build-plan-services-api-environments.md`](AppDesignConceptBoard/19-build-plan-services-api-environments.md))

## Where things live

| What | Where |
|---|---|
| 📋 Issue tracking (source of truth) | Jira → [hajiwee9411.atlassian.net](https://hajiwee9411.atlassian.net) project **SCRUM** |
| 🎨 Design source of truth | **Penpot** — file `JossPaperAR`, page *"New-user tutorial · Core loop"*, 153 boards, EN + 中文 |
| 🗂 Design concept board & specs | [`AppDesignConceptBoard/`](AppDesignConceptBoard/) — docs 01–18 + [`ADRs/`](AppDesignConceptBoard/ADRs/) |
| 🎨 Design system (tokens + checks) | [`design-system/`](design-system/) — `tokens.css` · `responsive.css` + the CI checks |
| 🧪 Retired prototype (spec, not code) | [`prototype/`](prototype/) — ⚠️ retired 2026-09-28, kept as reference |
| 🔬 Style spike results | [`spike/`](spike/) — 133 runs, Path C locked (ADR-002) |
| 🤖 Session hand-off for the next AI | [`next-ai-context.md`](next-ai-context.md) · open work in [`follow-up-items.md`](follow-up-items.md) · history in [`completed-work-archive.md`](completed-work-archive.md) |
| 💰 Costs (SGD) | [`project-costs.md`](project-costs.md) |

## Development environment

**Requirements:** **Node.js ≥ 22.18** with npm (Expo **SDK 57**'s floor is 22.13; the repo's check harness needs 22.18+, where Node runs TypeScript by default). CI uses Node 22. The app is a single-repo **Expo (SDK 57) / React Native + TypeScript** project at the repository root (stack: ADR-001 — Expo/RN + Supabase + hosted AI APIs), with **Expo Router** for navigation (routes live in `src/app/`).

```bash
git clone https://github.com/HAJIWEE/JossPaperAR.git
cd JossPaperAR
npm install

npx expo start          # dev server — scan the QR with the Expo Go app
npm run check           # the full local gate (see below)
```

### What lives where

| Path | What |
|---|---|
| `src/app/` | **Expo Router** — every file is a screen. `_layout.tsx` files define navigators |
| `src/domain/` | **Pure TypeScript** — aim bands · award maths · catalogue · quotas · currencies. No React, no network. Imported by both the app and the server |
| `src/theme/` | `tokens.ts` — the RN mirror of `design-system/tokens.css` |
| `src/components/` · `src/features/` · `src/lib/` | UI · feature-scoped code · client libraries |
| `design-system/` | The **authoritative** design tokens + the contrast/responsive gates |
| `AppDesignConceptBoard/` | The specs (01–19) + ADRs |

### Checks — run before opening a PR

```bash
npm run check           # everything below, in order
```

…which is:

```bash
npm run typecheck                       # tsc --noEmit
npm run check:tokens                    # src/theme/tokens.ts ↔ design-system/tokens.css must agree
npm run check:domain                    # aim bands · award maths · wallet invariant · quotas
node design-system/contrast-check.js    # expect: all 22 contrast checks passed
node design-system/responsive-check.js  # expect: all 21 responsive checks passed
npx expo-doctor                         # expect: 21/21 checks passed
```

The two `src/**/checks/*.ts` scripts are **plain Node scripts with no dependencies** — Node 22 strips the types, so there is no test framework to install. That keeps the project's *machine-readable verdict* habit (the retired prototype's `aim-check` / `render-check`) while staying dependency-free.

**`npm run check:domain` is the acceptance test of the vertical slice:** *the four aim bands grade true* (正中 ±14.55 · 虔誠 ±39.40 · 擦邊 ±96.97 · 偏失 ×0) — **not fps**. Both check scripts are themselves fault-tested: a deliberately corrupted value must turn them red.

The design-system scripts report `skipped` (never a false green) for the build-stylesheet scan until an app stylesheet exists.

### Backend (local, optional for now)

The Supabase stack runs locally in Docker — no account needed (see [`AppDesignConceptBoard/19-build-plan-services-api-environments.md`](AppDesignConceptBoard/19-build-plan-services-api-environments.md) §4):

```bash
supabase start          # Postgres + Auth + Storage + Edge runtime, in Docker
supabase db reset       # re-apply migrations + seed.sql
supabase functions serve
```

> ⚠️ An Android emulator reaches the host's local Supabase at **`10.0.2.2`**, not `localhost`.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request to `main`:

1. **Design-system checks** — `contrast-check.js` + `responsive-check.js`
2. **App checks** — `npm run typecheck` + `npx expo-doctor`

The machine-readable-verdict habit (`aim-check` / `render-check` from the retired prototype) is the pattern the real build's checks will follow.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) — branching, commits, check requirements, and the doc conventions (ADRs, session log, Jira-first issue tracking).

## Licence

[MIT](LICENSE) — © 2026 Gwee Jia Han. Chosen to match the stack (React, React Native, and Expo are all MIT); commercial use, forking, and private modification are all permitted. The concept board, ADRs, and design assets are covered by the same licence unless stated otherwise; third-party spike images (`spike/test-images/`) remain under their own CC licences and are internal evaluation material only.

