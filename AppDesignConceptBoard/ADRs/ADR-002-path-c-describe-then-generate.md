# ADR-002 · Path C — describe-then-generate cartoonization (moondream2 → nano-banana-2 t2i)

**Status:** ✅ **Accepted** · 2026-09-26 (Session 18)
**Decider:** stakeholder (PM), on AI research support
**Closes (gap-analysis §6):** **3 · cartoonization runtime — the provider + pipeline half** (ADR-001 locked *hosted day one*; this names the endpoints, the flow, and the measured numbers)
**Related:** [[08-style-d-spike-plan|08-style-d-spike-plan]] · spike [[RESULTS|RESULTS]] §5b · scorecard [[EVALUATION|path-C/EVALUATION]] · [[07-system-architecture]] §4.2 · SCRUM-10 · SCRUM-41

---

## Context

The style-D spike (approved US$10–20; closed at **133 runs ≈ US$4.49**) proved two end-to-end pipelines on the same 13-image Track-A set:

| | **Path A — edit-based** (recipe frozen, round 6) | **Path C — describe-then-generate** (PM proposal) |
|---|---|---|
| Flow | ① birefnet Light cutout → ② lighting filter (local, $0) → ③ `nano-banana-2/edit` + prompt v3 → ④ birefnet Heavy re-cut | ① `moondream2/visual-query` identify (≤3 objects, precise source colours) → ② `nano-banana-2` **text-to-image** with the v3 template |
| Cost | ≈ US$0.087/picture | ≈ **US$0.09/picture** (0.01 + 0.08); ≤0.13 with retries |
| Latency | ~14–15s (4 sequential stages) | ≈ **12.6s** (1.1 + 11.5, published p50s) |
| Background | clean only if both cuts succeed (IoU 7/9 ≥0.12 weak cases = scene inputs) | **clean by construction** |
| Multi-object / partial capture | ✗ (segmentation of occluded items fails) | ✓ (identify what's visible → generate the whole) |
| Instance fidelity | ✓ (edits the actual photo) | limited to what the VLM extracts |

**PM evaluation of the 13 Path-C finals:** 13/13 pass after the correction loop; **3/13 (23%) needed ≥1 targeted retry** (S02 wrong colour · S07 count flipped twice · S09 missing bowl). PM verdict: *"the failure rate is acceptable for now, we will have to work on it as we go along — **PATH C is the way forward**."* Quality adjustments demanded during evaluation are now part of the template: **top-down lighting shader** (wireframe carries bottom shadows → light must read from above), **source-exact colours**, **transparent glass**.

---

## Decision

1. **Pipeline = Path C (describe-then-generate).** Per capture: **① identify** `fal-ai/moondream2/visual-query` (~$0.01, p50 1.1s) → extract ≤3 objects with *precise colours exactly as in the source* (no example colours in the prompt — proven leak) → **② generate** `fal-ai/nano-banana-2` **t2i** ($0.08, p50 11.5s) from attributes + the style template. Stages ①②④ of the edit path (bg removal ×2, lighting filter) are **dropped**.
2. **The v3 generation template is normative:** source-exact colour lock (accent palette applies to the background only) · **top-down lighting shader** (top facets bright, sides mid, undersides dark — pairs with the app's bottom shadow) · transparent see-through glass where applicable · **no ground shadow** (the app adds it) · blank warm rice-paper background, subject isolated · coarse low-poly 40–60 facets + single ink outline + fully matte.
3. **Track B closed-set catalogue short-circuit stays mandatory before generation** — store offerings (S10/S11 class) return the standard painted asset with one ID call; zero-shot VLMs misread culturally specific items.
4. **The orchestrator must run a validation + correction loop** (this is the accepted answer to the failure rate): strict schema validation + one retry · dedupe of extracted objects · *colour sanity* (identical colour string across different object types ⇒ reject and re-probe) · **count-critical objects ⇒ majority vote across N queries or closed-set priors** (S07 proved single-probe counts flip both ways) · targeted re-probe → regenerate. Each retry ≈ $0.09 and is recorded on `cartoonize_jobs (cost_micros, latency_ms, retries)`.
5. **Providers on fal.ai**, keys in Edge Functions only (ADR-001 §3). Cost budget for quotas: **≈$0.09 steady-state, ≤$0.13 worst-case** per picture (SCRUM-18 / ADR-006); p50 ≈ 13s → the wait stays UI (loading ritual).

---

## Alternatives considered → rejected

| Alternative | Why rejected |
|---|---|
| **Path A — edit-based recipe** (frozen round 6) | Proven and PM-locked *for that approach*: best instance fidelity, ≈$0.087, but 4 stages, bg-removal failure modes (S12/S16), **single-object only, no partial capture**. **Retained as the documented fallback** if Path C's fidelity ceiling bites at product scale. |
| **Path A with seedream v4.5** | Tier-1 fidelity winner, $0.042 — killed on latency (platform p50 **34.2s** / p90 54.6s) in spike round 3. |
| **Path C with seedream v4.5 t2i** | Cheapest configuration found (≈$0.05/pic) but inherits the same ~34s wall — latency unchanged by the new approach. |
| **Path C with seedream v5** (flash/lite/pro) | Now on fal ($0.035–0.00017/compute-s, flash marketed as fast) but **untested** — no measured p50, no style-D evidence. Revisit only if nano-2 economics change. |
| **Path B — image→3D** (hunyuan-3d etc.) | Spike probe: minutes-scale latency, no style-D advantage. |
| **Self-hosted GPU / local model** | Rejected in ADR-001 (day-1 deployment, no capex); unchanged. |

---

## Consequences

**Good**
- **Two calls per picture, clean background every time** — no cutouts, no lighting filter to maintain, no re-cut failure modes.
- **Multi-object and partial/occluded captures work** — the features Path A cannot offer at any price.
- **Cost-neutral vs Path A** (+$0.003/pic; ~$3 per 1,000) and **~2s faster**; same model family (nano-banana-2 edit & t2i) keeps style language consistent.
- The **correction loop was validated live** (3/3 failures fixed for $0.27) — retry cost is bounded and measurable.

**Trade-offs / risks (accepted)**
- **Extraction is the new weak link**: 23% of inputs needed ≥1 retry in the spike; VLM **counts are unreliable in both directions** (S07) — mitigations decided in §4 of this ADR; expect to iterate on the extraction prompt/validation as we go (PM's explicit acceptance).
- **Instance-fidelity ceiling**: Path C reproduces only what the VLM extracts — *a* denim-blue sedan, not necessarily *this* A220's wear and details. If rubric "reads as *this* object" fails systematically in production → **fall back to Path A** (documented above).
- Cultural/closed-set misreads → Track B remains mandatory, not optional.
- nano-2 t2i p50 11.5s is still above the 3–10s ritual assumption → loading ritual design (SCRUM-18) unchanged.

---

*Accepted 2026-09-26 (Session 18) on PM verdict after the Path-C scorecard (13/13 post-retries). Evidence: spike RESULTS §5b rounds 7–9 · `spike/results/path-C/` (19 images + iterations).*
