# 🗂️ Spike outputs — by engine

**Reorganized 2026-09-26 (Session 17, end of day)** — processed/after-processing images previously grouped by *tier/iteration* (`tier1/`, `tier2/`, `iter2/`) are now grouped by the **engine that produced them**. Filenames are unchanged; only locations moved. Source of truth for results: [[RESULTS]].

| Folder | fal.ai endpoint | Stage | Files |
|---|---|---|---|
| `cartoonify/` | `fal-ai/cartoonify` | stylizer (Tier-1 candidate) | 4 |
| `image-editing-cartoonify/` | `fal-ai/image-editing/cartoonify` | stylizer (Tier-1 candidate) | 4 |
| `flux-kontext/` | `fal-ai/flux-pro/kontext` | stylizer (Tier-1 candidate) | 4 |
| `seedream-v4.5/` | `fal-ai/bytedance/seedream/v4.5/edit` | stylizer (Tier-1 fidelity winner, rejected on latency) | 6 |
| `nano-banana-2/` | `fal-ai/nano-banana-2/edit` | **stylizer — FROZEN recipe pick** | 19 |
| `birefnet/` | `fal-ai/birefnet/v2` | stage ① cutouts + stage ④ Heavy re-cuts | 27 |
| `lighting-filter-local/` | *(local, free — `spike/scripts/lighting_filter.py`)* | stage ② lighting normalisation (normal + aggressive presets) | 13 |

**Total: 77 images.** Naming carries the provenance: `{ID}__{engine-tag}.{ext}` for stylizer outputs · `{ID}_cutout.png` (stage ①) · `{ID}_litfilter*.png` (stage ②) · `{ID}__nano2_*_cutout_heavy.png` (stage ④).

> **Path C outputs are NOT here** — the describe-then-generate probe results live in **`../path-C/`** (13 finals + `iterations/` history, with [[../path-C/EVALUATION|EVALUATION.md]] for the PM scoring pass).
