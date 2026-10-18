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

## Amendment 1 · 2026-10-04 — the colour-sanity rule was NARROWED (PR-3 · SCRUM-61, option A)

**Status:** ✅ ratified by the PM (SCRUM-61, 2026-10-04).

**Context.** §Decision item 4 requires the orchestrator to run *"**colour sanity** (identical colour string across different object types ⇒ reject and re-probe)"* — written from a real spike failure: the identify prompt's example colour `"denim blue metallic"` was echoed as the main object's colour on **five consecutive images**, including a rice cooker and a notebook.

**What the first real run showed.** Implemented literally, that rule refuses an honest answer. The deployed orchestrator returned this for a real teapot-and-teacup photo, and the rule rejected it — *"brown is claimed for both teacup and teapot"*:

```
[ { "label": "Teacup",     "colours": ["Light green", "Brown"] },
  { "label": "Teapot",     "colours": ["Brown", "Dark brown"] },
  { "label": "Tea leaves", "colours": ["Dark brown", "Light brown"] } ]
```

A teacup and a teapot **are** both legitimately brown. Taken literally, the rule blocks the ritual for ordinary scenes — the opposite of what the spike's leak required it to prevent.

**Amendment.** The **blocking** threshold is now the leak's own fingerprint: a colour of **three or more tokens** echoed **verbatim across different object labels** (`"denim blue metallic"` on a sedan *and* a rice cooker) still **rejects and re-probes**. A one- or two-token generic name (`brown`, `dark brown`) is logged as a **note** and the ritual proceeds.

* `COLOUR_LEAK_MIN_TOKENS = 3` · `colourLeak()` (blocking) vs `colourNotes()` (advisory) in `supabase/functions/_shared/pathtemplate.ts`.
* Five assertions in `supabase/checks/pathc-check.ts` pin the behaviour — **including the false-positive case**, so the narrowing cannot silently regress, and the 3-token leak fingerprint still blocks.

**Rejected.** *Reverting to the literal rule* — it refuses plausible photos (2 of 3 objects sharing a generic colour is normal). *Dropping the rule* — it would let a mis-coloured prompt reach the generator again, which is the one defect the spike proved.

**Effect on §Consequences.** None beyond this clause: the extraction stage keeps its validation, and the accepted trade-off ("extraction is the new weak link") is unchanged in kind.

---

## Amendment 2 · 2026-10-18 — STAGE ④ IS RESTORED: Path C never produced alpha (SCRUM-129)

**Status:** ✅ implemented, deployed and verified on glass (2026-10-18). The *finding* is the spike's; the *fix* is this amendment.

**Context.** §Decision 1 dropped the edit path's two bg-removal stages, and §Consequences states the win as *"Two calls per picture, clean background every time — no cutouts, no lighting filter to maintain, no re-cut failure modes."* §Decision 2's template asks for a *"blank warm rice-paper background, subject isolated."*

⚠️ **"Clean by construction" was true of the CONTENTS and false of the ALPHA CHANNEL.** `nano-banana-2` *paints* the background it is asked for, and a text-to-image model emits no transparency. So every styled sprite arrived as an **opaque cream card** — sampled off the burn screen on 2026-10-18 as **`#F3EDD8`** — and `/burn`, which draws that sprite over the live camera, showed a floating rectangle rather than an offering.

This was **already known and written down in the spike** (RESULTS, round 4): *"the stylizer generates a background … the pipeline needs a second bg-removal (stage ④, post-stylization) to hand AR a transparent sprite."* It was never carried into the accepted pipeline, and no gate noticed — because the claim was prose, and nothing asserted the sprite's alpha.

**Amendment.** Path C gains **stage ④ — a post-generation cutout** before storage:

> ① identify `moondream2` → ② validate → ③ generate `nano-banana-2` (v3) → **④ cut out `fal-ai/birefnet/v2`** → the **transparent** sprite is what is stored

* `model: 'General Use (Light)'`, `operating_resolution: '1024x1024'`, `refine_foreground: true`.
* **`output_format: 'webp'` explicitly** — the endpoint defaults to PNG, which is 1.3 MB-class against doc 14 §3's 150 KB budget. WebP keeps the bucket MIME (`image/webp`) and the `.webp` key unchanged, so §5's format decision still holds.
* The **generator** URL becomes an intermediate (returned as `generatedUrl` for diagnosis only). The **cutout** URL is what is uploaded to `styled`, so **the cutout's container is the sprite's container** — `check:pathc` asserts the two formats agree.
* Cost: `COST_MICROS.cutout = 1_000` micros — an **upper bound on a measured run**, not a published flat price (`birefnet/v2` bills $0.000575 per *compute second*; the measured synchronous call took **1.09 s ≈ $0.00063**). A clean picture is **91,000 micros (US$0.091)** — still "≈ US$0.09", so §5 and the daily stop-rule are unchanged.
* **A cutout failure FAILS the job; it does not fall back to the uncut frame.** A fallback would ship exactly this defect while reporting success. The capture stays `pending` and can be retried.

**Measured** on the real sprite cropped off the burn screen (280 × 153) — not on a sample image:

| Setting | Fully transparent | Fully opaque | Bytes | Verdict |
|---|---|---|---|---|
| **Light @1024, webp** | **71.2 %** | 21.6 % | **20.7 KB** | **chosen** — visually identical to Heavy on magenta, and fal's recommended default |
| Heavy @1024, webp | 70.5 % | 20.9 % | 21.1 KB | no visible gain |

Output is 4-channel **RGBA**, alpha **0** at every corner, and the thin ink outline survives the cut (inspected on a magenta composite, not assumed).

**Guards.** `check:pathc` **38 → 48**. Ten assert stage ④'s data; four **read `pathc.ts`** and assert the pipeline actually calls `falRun(CUTOUT_MODEL, …)` and returns `cut?.image?.url` — because deleting the call would otherwise leave every constant intact and every check green, which is precisely how this claim survived into production. Fault-tested: call replaced by the generator → **1 RED**; format left at PNG → **2 RED**.

**Effect on §Consequences.** The *"two calls per picture, no cutouts"* bullet is **superseded**: three calls (identify · generate · cut out), **≈ 13.7 s** and **US$0.091** measured. The multi-object / partial-capture advantages are unchanged. The accepted trade-off is the one the spike already priced — a third call that **cannot silently regress**, because a missing cutout is now a visible, gated failure rather than an opaque rectangle.

---

*Accepted 2026-09-26 (Session 18) on PM verdict after the Path-C scorecard (13/13 post-retries). Evidence: spike RESULTS §5b rounds 7–9 · `spike/results/path-C/` (19 images + iterations).*
