# JossPaperAR

> An AR app that replaces physical joss-paper burning with a digital ritual — capture an object, cartoonize it, throw it onto the fire, earn Tribute Points.
> Hobby project, family-legacy vision, no timeline pressure.

**Status:** 📐 design signed off · 📝 specs + ADRs written · 💻 **engineering starting (repo + CI, SCRUM-15)** — the app itself is not scaffolded yet.

## Where things live

| What | Where |
|---|---|
| 📋 Issue tracking (source of truth) | Jira → [hajiwee9411.atlassian.net](https://hajiwee9411.atlassian.net) project **SCRUM** |
| 🎨 Design source of truth | **Penpot** — file `JossPaperAR`, page *"New-user tutorial · Core loop"*, 153 boards, EN + 中文 |
| 🗂 Design concept board & specs | [`AppDesignConceptBoard/`](AppDesignConceptBoard/) — docs 01–17 + [`ADRs/`](AppDesignConceptBoard/ADRs/) |
| 🎨 Design system (tokens + checks) | [`design-system/`](design-system/) — `tokens.css` · `responsive.css` + the CI checks |
| 🧪 Retired prototype (spec, not code) | [`prototype/`](prototype/) — ⚠️ retired 2026-09-28, kept as reference |
| 🔬 Style spike results | [`spike/`](spike/) — 133 runs, Path C locked (ADR-002) |
| 🤖 Session hand-off for the next AI | [`next-ai-context.md`](next-ai-context.md) · open work in [`follow-up-items.md`](follow-up-items.md) · history in [`completed-work-archive.md`](completed-work-archive.md) |
| 💰 Costs (SGD) | [`project-costs.md`](project-costs.md) |

## Development environment

**Requirements:** Node.js ≥ 20 (CI uses 22). No other tooling is needed *yet* — the checks below are plain Node scripts with no dependencies.

```bash
git clone https://github.com/HAJIWEE/JossPaperAR.git
cd JossPaperAR

# accessibility gate (WCAG contrast on tokens + decorative-token lint)
node design-system/contrast-check.js        # expect: all 22 contrast checks passed

# responsive foundation gate (type scale, safe areas, touch targets)
node design-system/responsive-check.js      # expect: all 21 responsive checks passed
```

Both scripts report `skipped` (never a false green) for the build-stylesheet scan until the real app stylesheet exists — point them at it with `--css=path/to/styles.css`.

**The Expo/React Native app does not exist yet** (stack locked in ADR-001: Expo/RN + Supabase + hosted AI APIs). When it lands, its setup steps belong here — see [`CONTRIBUTING.md`](CONTRIBUTING.md) for the conventions it must follow.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs the design-system checks on every push and pull request to `main`. The machine-readable-verdict habit (`aim-check` / `render-check` from the retired prototype) is the pattern the real build's checks will follow.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) — branching, commits, check requirements, and the doc conventions (ADRs, session log, Jira-first issue tracking).

