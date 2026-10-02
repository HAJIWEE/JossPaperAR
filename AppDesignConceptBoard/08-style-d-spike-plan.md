# 08 · Style-D spike — candidate & pricing survey (SCRUM-41)

**Status:** 🟢 **Tier 1 + Track B + Path B EXECUTED (2026-09-26)** — results & PM scoring sheet → [`spike/results/RESULTS.md`](../spike/results/RESULTS.md) · spend ≈ **US$1.27** of the US$20 cap · key findings: **closed-set ID required** (zero-shot VLM misread joss paper as "packaged snacks") · `cartoonify` latency up to 58.4s · Path B image→3D works but stays reserve
**Date:** 2026-09-26 (Session 17)
**Jira:** SCRUM-10 (pipeline) · **SCRUM-41** (log the actual spend — due 2026-10-06)
**Budget:** ✅ approved **US$10–20** — hard stop at US$20, flag overrun in `project-costs.md`
**Related:** [[06-tech-stack-options]] §2.3 (AI-pipeline research) · [[07-system-architecture]] (`cartoonize_jobs.cost_micros` / `latency_ms` land here) · ADR-002 (to be written from this spike's numbers)

---

## 1 · What the spike must answer

**Acceptance target = fidelity variant D** (machine-checked spec, gap-analysis §2):
3D-consistent faceting · ~37 rendered faces (31 body + 6 wheel) · one ink weight · wheels round on all four corners · palette locked (cinnabar `#C23B22` · gold `#D4AF37` · azurite `#4A6FA5` · malachite `#0E9B78` · ink `#1A1A1A` · rice paper `#F5F0E8`).

**The four questions (from SCRUM-10's constraints):**
1. Which hosted endpoint holds **D** on a real user photo — and which doesn't?
2. **Cost per image** (pipeline total, not just the stylizer)?
3. **Latency** p50 (the 3–10 s ritual wait — gap risk #3)?
4. Does the pipeline need all three stages, or can one endpoint do it in one shot?

---

## 2 · Two candidate paths

`recommend_model` classified this task as **image-to-3D** — worth taking seriously, because style D *is* a 3D look:

### Path A — 2D stylization (img2img) — the obvious route
Prompt-driven editors applied to the (optionally bg-removed) photo, with the style described in the prompt; or a **LoRA trained on the D artwork** for consistency.

| Stage | Endpoint | Price | Unit |
|---|---|---|---|
| ① bg removal | `fal-ai/birefnet/v2` | 0.0008 | compute-second |
| ① bg removal (alt) | `fal-ai/ben/v2/image` | 0.025 | megapixel |
| ① bg removal (alt) | `pixelcut/background-removal` | 0.016 | image |
| ② object ID | `fal-ai/sam-3/image` | 0.005 | unit |
| ③ stylize — **dedicated** | `fal-ai/cartoonify` (3D cartoon, preserves composition) | **0.100** | image |
| ③ stylize — **dedicated** | `fal-ai/image-editing/cartoonify` (bold outlines) | **0.040** | image |
| ③ stylize — editor | `fal-ai/flux-pro/kontext` | **0.040** | image |
| ③ stylize — editor | `fal-ai/bytedance/seedream/v4.5/edit` | **0.040** | image |
| ③ stylize — editor | `fal-ai/nano-banana-2/edit` | **0.080** | image |
| ③ stylize — editor | `fal-ai/nano-banana-pro/edit` | **0.150** | image |
| ③ stylize — editor | `openai/gpt-image-2.5/flare/edit` | 1.000 | unit ⚠️ |
| ③ stylize — **LoRA** | `fal-ai/flux-lora` (train on D artwork, then apply) | **0.035** | megapixel |

⚠️ GPT Image 2.5's unit price came back as `$1/unit` — verify the actual billing unit in its schema before spending (may be per higher-quality unit or bundle).

### Path B — image → 3D → render (the faithful route)
Generate a low-poly mesh from the photo, then render it with the ink treatment. **3D-consistent faceting by construction** — exactly what D demands — but the output is a mesh, not a styled image: it changes the runtime (app must render/re-texture), so this is a *strategic* test, not just a fidelity test.

| Endpoint | Price | Unit | Notes |
|---|---|---|---|
| `fal-ai/hunyuan-3d/v3.1/pro/image-to-3d` | **0.015** | unit | published-guidance #1 |
| `fal-ai/trellis-2` | **0.050** | unit | native 3D generative |
| `tripo3d/h3.1/image-to-3d` | (check at run) | — | published-guidance #2 |
| `meshy/v7.1/image-to-3d` | (check at run) | — | has an explicit **low-poly mode** |

---

## 3 · Budget math (US$10–20)

Per-image pipeline cost, Path A with a mid editor: **birefnet (~$0.001–0.005) + SAM ($0.005) + stylize ($0.04–0.15) ≈ $0.05–0.16/image**.

| Spend | Images at $0.05 (cheap path) | at $0.16 (premium path) |
|---|---|---|
| US$10 | ~200 | ~60 |
| US$20 (cap) | ~400 | ~125 |

A flat matrix (~10 photos × 6 endpoints × 2 prompt variants ≈ 120 generations ≈ US$6–19) is more than we need — use the **tiered plan**: **Tier 1 calibration (4 photos × 6 endpoints = 24 runs) + Tier 2 coverage (~12 × winners-only = 24 runs) ≈ 48 runs ≈ US$2–8 cheap-first**, which keeps real headroom inside the US$20 cap for escalation (premium re-runs, a LoRA attempt). **Plan: run the cheap candidates first, only escalate to nano-banana-pro/gpt-image if the cheap ones fail D.**

**Extrapolation for SCRUM-18** (cost control): the stylize stage alone at $0.04/image ⇒ **~$0.05/burn all-in** at MVP scale — this is the number the quota model must cap.

---

## 4 · Proposed spike matrix

**Inputs are fixed** → the taxonomy lives in [`MANIFEST.md`](../spike/test-images/MANIFEST.md) (G1 regrouped **by ritual tradition** · T1–T5 + G2–G6 + condition overlays C1/C2); currently 15 files, MD5-hashed:

- **Track A · stylize (13 inputs):** S01 car (repo ground truth) · S02 phone · S03 rice cooker · S04 wallet · S05 glasses/desk scene · S06 worn watch · S07 boots · S08 teapot · S09 fruit · S12 HDB · S14 ang pow · S15 keys-on-clutter (C1) · S16 altar (C2) — *±S13 portrait, pending sign-off*
- **Track B · identify-only (2 inputs, NO stylize)** — PM decision 2026-09-26: **S10 joss-paper stack · S11 incense** are store offerings, so the pipeline must *recognise* them and return the **standard painted asset**. Spike questions: which identification call (VLM label-match vs the catalogue — shortlist at run time), does it get these two right, and what does it cost (expected ≪$0.01)? Feeds the `cartoonize-orchestrator` short-circuit in [[07-system-architecture]] §4.2.
- **Tier 1 · calibration (all 6 endpoints):** S01 · S02 · S09 · S14 → pick the winners → **Tier 2 · coverage (winners only):** the rest of Track A

**Runs per photo:**
1. `cartoonify` (0.10) — the purpose-built one, baseline
2. `image-editing/cartoonify` (0.04) — cheap dedicated
3. `flux-pro/kontext` (0.04) — general editor + D prompt
4. `seedream/v4.5/edit` (0.04) — general editor + D prompt
5. `nano-banana-2/edit` (0.08) — escalation candidate
6. *(one-off, not per photo)* Path B probes: `hunyuan-3d` + `meshy low-poly` on 2 photos — judge only "does the faceting hold D?" and note the runtime implication

**The D prompt** (draft — refine at run time): *low-poly 3D cartoon render, flat faceted surfaces, single consistent ink outline weight, limited palette of cinnabar red / gold / azurite blue / malachite green on warm rice-paper tones, no gradients, no photorealism, clean silhouette on transparent background*.

**Recorded per run:** output image · pass/fail vs each D criterion · cost (from pricing × unit) · wall-clock latency · shape-preservation score (does it still read as *the user's* object?).

> 📸 **Inputs are fixed** → see [`spike/test-images/MANIFEST.md`](../spike/test-images/MANIFEST.md) — 15 licence-clean files (Wikimedia route), normalised (≤1536 px, EXIF stripped) and **MD5-hashed**; S13 (portrait) pending stakeholder sign-off. Tier-1 calibration set: S01 · S02 · S09 · S14. The manifest records the honest caveats (stock-like bias, resolution spread, scene-vs-product mix) for the write-up.

**Verdict:** **Track A** — ≥1 endpoint holds D on ≥8 of the Track A photos within budget → **ADR-002** written with the winner + real `cost_micros`/`latency_ms` → numbers feed the economy spec (SCRUM-18). Zero winners → re-scope: LoRA training run, or Path B study. **Track B** — both catalogue items identified correctly → standard asset returned → the short-circuit in [[07-system-architecture]] §4.2 is validated (and its ID-call cost measured).

---

## 5 · Execution notes (for the session that runs it)

- **Tooling is ready**: the fal.ai MCP is connected and verified (search · `get_pricing` · `get_model_schema` · `submit_job`/`check_job`/`get_job_result`). Long jobs → submit + poll, never re-submit.
- **Guardrails:** check `get_pricing` again immediately before running (cached ~5 min); cumulative spend tracked as we go; **stop at US$20**; set `store_payload: false` on runs containing user-like photos.
- **Order:** cheap endpoints first → escalate only on failure (§3).
- **After:** log the actual spend in `project-costs.md` (SGD @ Mastercard rate) per **SCRUM-41** · write **ADR-002** · post numbers to SCRUM-10.

---

*Created 2026-09-26 (Session 17) — fal.ai MCP connectivity verified; 15-endpoint candidate + pricing survey captured; spike pending stakeholder run.*
