# 📊 Spike results — Tier 1 + Track B + Path B (2026-09-26)

**Status:** 🟢 **executed** — inputs from [[../test-images/MANIFEST|MANIFEST]] (MD5-verified), `store_payload: false` on every run
**Spend: ≈ US$4.49 of the US$20 cap — 133 runs** (incl. one 422 no-media failure, presumed unbilled — verify on invoice; detailed below; actual fal invoice to be reconciled under SCRUM-41)
**Outputs layout:** reorganized **by engine** at end of day → `spike/results/by-engine/{engine}/` (7 folders · 77 images · mapping in `by-engine/README.md`; the old `tier1/`, `tier2/`, `iter2/` folders are retired — all paths below updated)

---

## 1 · Cost & runs

| Endpoint | Unit price | Runs | Cost (USD) |
|---|---|---|---|
| `fal-ai/cartoonify` (3D cartoon, no prompt) | 0.100/img | 4 | 0.40 |
| `fal-ai/image-editing/cartoonify` (bold outline, no prompt) | 0.040/img | 4 | 0.16 |
| `fal-ai/flux-pro/kontext` (+ D-prompt) | 0.040/img | 4 | 0.16 |
| `fal-ai/bytedance/seedream/v4.5/edit` (+ D-prompt) | 0.040/img | 6 | 0.24 |
| `fal-ai/nano-banana-2/edit` (+ D-prompt; + Path-C t2i) | 0.080/img | 40 | 3.20 |
| `fal-ai/birefnet/v2` (bg removal, stage ① + post-stylize re-cuts incl. Heavy) | 0.0008/compute-s | 32 | ~0.09 |
| `fal-ai/hunyuan-3d` geometry (Path-B probe) | 0.015/unit | 2 | 0.03 |
| `fal-ai/moondream2/visual-query` (Track B + Path-C identify) | 0.01/1k chars | 29 | ~0.29 |
| **Total** | | **133 runs** | **≈ 4.49** |

### 1b · Cost per picture — seedream vs nano-2 (the two finalists), all-in through the pipeline

Verified via `get_pricing` 2026-09-26 (unchanged from the survey). All-in = stage ① bg-removal + stylizer; stage ② lighting filter is **$0** (local CPU). Birefnet averaged **≈$0.0015/img** across observed runs ($0.0008 × ~1.9 compute-s).

| Pipeline | Stage ① birefnet | Stage ② filter | Stylizer | **All-in / picture** |
|---|---|---|---|---|
| **seedream v4.5/edit** + prompt v2 | ~0.0015 | 0 (local) | **0.040** | **≈ US$0.042** |
| **nano-banana-2/edit** + prompt v2 + matte clause | ~0.0015 | 0 (local) | **0.080** | **≈ US$0.082** |

- **nano-2 costs 1.96× seedream** — the delta is exactly the stylizer price (+$0.040/picture); everything else is identical.
- **Both run as an A/B** (as in iter-2): **≈ US$0.123/picture**.
- **If the closed-set ID short-circuit fires first** (Track B path, moondream2 ≈$0.01/query): +$0.01 to either pipeline, but then there is *no* stylize on store offerings — the standard painted asset is returned (one-time cost, already sunk).
- **Scaling the spike:** Tier 2 (10 remaining Track-A inputs) → seedream **≈$0.42** · nano-2 **≈$0.82** · both **≈$1.23**. Full Track A (13 inputs) → **≈$0.54** / **≈$1.06**.
- **At product volume (1,000 user captures):** **≈$42** (seedream) vs **≈$82** (nano-2) all-in — the ~$40/1k difference is the whole argument for seedream *if* fidelity ties; the counter-argument is latency (seedream platform p50 **34.2s** ⚠️ vs nano-2 **11.8s**) — quality per dollar vs wait-time per picture.

## 2 · Latency observed (Tier 1)

| Endpoint | Platform p50 (14–21 Sep) | Observed today |
|---|---|---|
| birefnet | 1.0s | all 4 returned synchronously ✅ |
| `image-editing/cartoonify` | 11.7s | sync within wait ✅ |
| `flux-pro/kontext` | 9.8s | sync within wait ✅ |
| `nano-banana-2/edit` | 11.8s | sync within wait ✅ |
| `seedream v4.5/edit` | **34.2s** ⚠️ | surprisingly sync today |
| `cartoonify` (3D) | unknown | **inference 10.7s / 15.1s / 30.2s / 58.4s** — high variance, needed polling ⚠️ |
| `hunyuan-3d` geometry | unknown | completed within a few minutes |
| `moondream2` query | 1.1s | sync ✅ |

**Ritual-wait implication (SCRUM-18):** worst observed ≈ 58s (`cartoonify`) vs the ~3–10s design assumption. Prompt-driven editors sit at ~10–15s (seedream's platform p50 34s is a risk flag even though today ran fast).

## 3 · Track A outputs — `spike/results/by-engine/{engine}/{ID}__{endpoint}.{ext}`

> 🏆 **PM VERDICT (Tier 1): `bytedance/seedream/v4.5/edit` = the winner** — closest to the vision. **Refinement noted: reduce the polygon count** (output is over-faceted vs variant D's 37-face budget) → **prompt v2** below, validated on S01 before Tier 2.

> **PM DIRECTION (2026-09-26, round 3 — provider leaning reversed on latency):** *seedream's latency is too long* — platform p50 **34.2s** / p90 **54.6s** vs the 3–10s ritual-wait assumption (and even today's lucky sync runs aren't an SLA). **nano-banana-2 is now favoured**: fidelity with the lighting filter + matte clause judged **fine** (iter-2 S01 + U01), latency ~3× better (p50 **11.8s** / p90 21.6s — still above the assumption, feeds SCRUM-18), at **2× the cost (≈$0.082 vs $0.042/pic, §1b)**. **Next lever = prompt fine-tuning (v3) on nano-2**, not more model search. → **Tier 2 = nano-2 × 10 remaining Track-A inputs ≈ US$0.82** → ADR-002 written around nano-2 unless Tier 2 contradicts.

**Prompt v3 (2026-09-26, nano-2 only — PM choice: "run v3 on S01 + U01 first, then Tier 2 with the winning prompt"):** = prompt v2 + matte clause + three fidelity clauses — (1) **subject real colours kept** (skin tone, hair, clothing, materials; the limited palette applies to shading accents + rice-paper background), (2) **anatomy/structure lock** (every limb/part separate and complete — both legs distinct — nothing merges, vanishes or is redrawn), (3) **detail hold** (accessories such as glasses/watch and any printed text stay sharp and unchanged). Run from the existing lit-filter inputs → `S01__nano2_litfilter_v3.jpg`, `U01__nano2_litfilter_v3.jpg` ($0.16; S01 lit-filter input re-uploaded for this run).

> ✅ **PM VERDICT (round 4): v3 = better than v2** — but *the stylizer's output background was not completely removed* → **both v3 outputs re-run through birefnet** → `S01__nano2_litfilter_v3_cutout.png`, `U01__nano2_litfilter_v3_cutout.png` (RGBA, alpha 0–255 verified; ~$0.003). **⚠️ Architecture finding for 07 §4.2 / ADR-002:** the stylizer *generates* a background (the prompt itself asks for "rice-paper tones"), so the stage-① cutout alone is not enough — **the pipeline needs a second bg-removal (stage ④, post-stylization)** to hand AR a transparent sprite. Alternative to test later: ask the stylizer for a plain/transparent backdrop instead (fewer calls, but the re-cut is only ~$0.0015 and proven).

**Round 4b (U01 isolation still not clean → Heavy re-cuts, both variants run for comparison):**

| Variant | Input | Output | Transparent px |
|---|---|---|---|
| pass 1 (Light @1024) | U01 v3 jpg | `U01__nano2_litfilter_v3_cutout.png` | 65.7% |
| **Heavy @2048 from source jpg** | U01 v3 jpg | `U01__nano2_v3_recut_heavy_from_jpg.png` | **66.2%** |
| **Heavy @2048 from the cutout** | pass-1 cutout | `U01__nano2_v3_recut_heavy_from_cutout.png` | 63.9% |

(~$0.01; PM to eyeball which edge quality is best. Note: re-passing the *cutout* recovered fewer pixels into alpha than re-segmenting the source — if Heavy-from-jpg wins, **stage ④ should re-cut the stylizer's output directly, not chain cutters**.)


**Round 5 (2026-09-26 — PM request: "compare the v2 and v3 background removal; maybe the lighting filter is not aggressive enough"):**

- **Filter script now on disk & validated:** `spike/scripts/lighting_filter.py` — re-implementation of the spec-of-record reproduces `U01_litfilter.png` to **0.08/255** mean diff (rounding only). Aggressive preset: `--radius-div 96 --knee 0.45 --knee-strength 0.5` (finer illumination map + harder highlight compression) → `U01_litfilter_aggressive.png`.
- **Isolation quality proxy:** transparent-pixel fraction of the stage-④ cut, plus **IoU of the cut mask vs the stage-① original-photo cutout** (layout is preserved by the editor, so the original silhouette is the reference). Higher = subject isolated closer to truth.

| Cut input → Heavy cut | Transparent px | IoU vs original silhouette |
|---|---|---|
| original photo (stage ①, reference) | 81.4% | — |
| **v2 stylized output** | **82.5%** | **0.818** ✅ |
| v3 (normal filter) — pass 1 Light | 65.7% | 0.539 |
| v3 (normal filter) — Heavy from jpg | 66.2% | 0.544 |
| v3 (normal filter) — Heavy from cutout | 63.9% | 0.508 |
| **v3 (AGGRESSIVE filter)** | **75.3%** | **0.744** ↑ |

- **Finding 1 (v2 vs v3):** v2's stylized output re-segments cleanly (≈ the original silhouette); **v3's leaves ~⅓ of the frame as foreground** — background-ish pixels attached to the subject. One of the v3 prompt clauses (likely the palette/background-colour instruction) makes subject and background harder to separate.
- **Finding 2 (PM's hypothesis): ✅ CONFIRMED direction** — the aggressive lighting filter moves v3 isolation from IoU 0.54 → **0.744** (transparency 66% → 75%) — a large step toward v2's 0.818, without giving up v3's fidelity wins. Files: `U01__nano2_litfilter_aggressive_v3.jpg`, `U01__nano2_aggressive_v3_cutout_heavy.png`.
- **Open (needs PM eyeball + decision):** (a) accept aggressive-filter v3, (b) iterate filter harder still, or (c) try v3 minus the colour clause (isolate which clause hurts separation). Note: one accidental duplicate Heavy run (re-ran v3 jpg instead of v2) ≈ $0.005 wasted — logged.


**Round 5b — S01 validated on the accepted recipe ✅:** PM accepted `U01__nano2_aggressive_v3_cutout_heavy.png` → same recipe run on S01: aggressive filter (`S01_litfilter_aggressive.png`, local) → nano-2 + prompt v3 (`S01__nano2_litfilter_aggressive_v3.jpg`, $0.08) → Heavy re-cut (`S01__nano2_aggressive_v3_cutout_heavy.png`, RGBA ✅, ~$0.006). **Isolation: transparent 45.8%, IoU vs stage-① silhouette = 0.961** — excellent (better than U01's 0.744).

> 🎯 **FROZEN TIER-2 RECIPE (pending PM's final go):** ① birefnet Light cutout → ② lighting filter **aggressive preset** (`lighting_filter.py --radius-div 96 --knee 0.45 --knee-strength 0.5`, $0 local) → ③ nano-2/edit + **prompt v3** → ④ birefnet **Heavy @2048** re-cut on the stylizer output → **≈ US$0.087/picture all-in** (0.002 stage ① + 0.08 stylize + 0.005 stage ④). Tier 2 = 10 remaining Track-A inputs ≈ **US$0.87**.


### 3c · Tier 2 — coverage run (2026-09-26, 9 remaining Track-A inputs, frozen recipe) ✅ complete

PM green-light: *"looks good for the 2, run the rest"* (+ heads-up: *some images have no focus object* → expect weaker reads). All 9 ran the full 4-stage pipeline: ① birefnet Light → ② aggressive lighting filter (local) → ③ nano-2 + prompt v3 (object wording) → ④ birefnet Heavy @2048 re-cut. **27 runs ≈ US$0.77.**

Outputs (reorganized by engine): `{ID}_cutout.png` → `by-engine/birefnet/` · `{ID}_litfilter_aggressive.png` → `by-engine/lighting-filter-local/` · `{ID}__nano2_aggressive_v3.jpg` → `by-engine/nano-banana-2/` · `{ID}__nano2_aggressive_v3_cutout_heavy.png` → `by-engine/birefnet/` (RGBA verified for all 9).

| Input | Subject | Transparent px | IoU vs stage-① silhouette | PM rubric ①–⑤ |
|---|---|---|---|---|
| S03 | rice cooker | 29.0% | 0.714 | ☐ |
| S04 | wallet (desk) | 54.9% | 0.880 | ☐ |
| S05 | glasses + notebook | 94.8% | 0.742 | ☐ |
| S06 | watch on wrist | 67.4% | 0.866 | ☐ |
| S07 | sneakers on feet | 77.2% | **0.916** | ☐ |
| S08 | teapot scene | 49.8% | 0.806 | ☐ |
| S12 | HDB block | 79.2% | **0.384** ⚠️ | ☐ |
| S15 | keys on keyring | 73.6% | 0.814 | ☐ |
| S16 | altar scene (low-light) | 71.9% | 0.683 ⚠️ | ☐ |

- **7/9 at IoU ≥ 0.71** — isolation holds on the object cases, consistent with S01 (0.961) / U01 (0.744).
- **S12 (0.384) and S16 (0.683) are the weak ones** — both *scene* inputs (whole building against sky; altar with no single focus object), matching the PM's prediction. Low IoU here can mean either cutter failure **or** the stylizer legitimately recomposed the scene — needs the human eye, not the metric.
- **Scoring for ADR-002's ≥8/13 gate:** Tier 1 already covers S01/S02/S09/S14 (PM scores pending); Tier 2 adds these 9. Track A total = 13 (S13 still excluded).


**Round 6 — 🎯 PM LOCK (2026-09-26):** *"aggressive_v3 polygon count is good — this is good for this stage and should not be a blocker. lock this in and carry on."* → **the frozen recipe's facet level is APPROVED** (Tier-2 outputs: S03–S08, S12, S15, S16 + the S01/U01 validations). The polygon-count refinement thread (opened at the Tier-1 verdict) is **closed for this stage** — revisit only if art direction later tightens toward variant D's authored 37-face budget. **FINAL style-D output standard for the spike: ① birefnet Light → ② aggressive lighting filter (local, $0) → ③ nano-banana-2/edit + prompt v3 → ④ birefnet Heavy re-cut ≈ US$0.087/picture.**


**PM ITERATION (2026-09-26, second round):**
- **seedream** → *reduce polygons* → **prompt v2** run on S01 → `spike/results/by-engine/seedream-v4.5/S01__seedream_polyv2.jpg` ($0.04)
- **nano-banana-2** → *registers light reflections too much; filter lighting BEFORE modeling* → **new pipeline stage implemented**: a deterministic **lighting-normalisation filter** (illumination map = blurred luminance, divide it out, exposure-restore, highlight-gamma, re-apply alpha — free, local, client-side capable) then nano-2 with prompt v2 + explicit matte/no-reflections instruction → `spike/results/by-engine/nano-banana-2/S01__nano2_litfilter_v2.jpg` ($0.08; filter input kept as `by-engine/lighting-filter-local/S01_litfilter.png`) · **architecture note: insert this filter as a pipeline stage between bg-removal and stylization in [[07-system-architecture]] §4.2**

**Prompt v2 (polygon-reduced, in effect from the S01 validation run):**
*…VERY COARSE low-poly… no more than 40 to 60 large flat polygon facets in total for the whole object — big folded-paper planes, deliberately minimal and chunky, not detailed or finely triangulated — single consistent ink outline weight… limited palette of cinnabar red, gold, azurite blue, malachite green on warm rice-paper tones…*

**Prompt v2 — canonical full string (recorded 2026-09-26; the verbatim string used on S01 was not stored — reconstructed from the excerpt above + the §4 draft, and used verbatim for all runs from U01 onward):**
> Render the subject as a VERY COARSE low-poly 3D cartoon: flat faceted surfaces with no more than 40 to 60 large flat polygon facets in total for the whole object — big folded-paper planes, deliberately minimal and chunky, not detailed or finely triangulated. 3D-consistent faceting, single consistent ink outline weight, limited palette of cinnabar red, gold, azurite blue, malachite green on warm rice-paper tones, no gradients, no photorealism, clean silhouette.

nano-banana-2 runs append the matte clause:
> The surface must be completely matte: no specular highlights, no glossy or mirror-like reflections, no lens flare and no bloom — lighting reads only as flat per-facet shading.

**Lighting-normalisation filter — spec of record** (stage between ① bg-removal and ③ stylization; deterministic, local, free): illumination map = Gaussian-blurred luminance (radius = longest edge / 48 ≈ 32 px at 1152×1536, floor 0.03) → divide RGB by it → exposure-restore (alpha-weighted mean-luminance match to the original) → highlight-gamma (soft-knee compression above 0.7, asymptoting to 1.0, so blown speculars collapse instead of clipping) → re-apply the original alpha.

### 3b · User-photo run — U01 (2026-09-26, PM's own photo)

> 📸 **U01 "person at the kettle"** — the PM's own in-the-wild photo (the manifest's "own photos strengthen the POC" case). Input: `spike/test-images/U01.jpg` · 1152×1536 · MD5 `e6e60ce7ed3a2c35aae5be81c21925de` (normalised from `~/Pictures/Media.jpeg`, 1920×2560; auto-orient → EXIF strip → long edge ≤1536). **Not part of the hashed S-set** — logged here as an ad-hoc iter-2 test.

Pipeline = full 3-stage order of `07-system-architecture` §4.2, 3 jobs ≈ **US$0.12**:

| Stage | Input | Output (under `spike/results/by-engine/`) | Cost |
|---|---|---|---|
| ① birefnet/v2 cutout | U01.jpg | `birefnet/U01_cutout.png` (1152×1536) | ~0.001 |
| ③ seedream v4.5/edit + prompt v2 | cutout | **`seedream-v4.5/U01__seedream_polyv2.jpg`** (2048×2048) | 0.04 |
| ② lighting filter (local) | cutout | `lighting-filter-local/U01_litfilter.png` (1152×1536) | 0 |
| ③ nano-banana-2/edit + prompt v2 + matte clause | lit-filter | **`nano-banana-2/U01__nano2_litfilter_v2.jpg`** (896×1195) | 0.08 |

**First observations (PM scores against the rubric §3):**
- **seedream** — coarse faceting held; glasses / wristwatch / "Body of knowledge" tee text all preserved (shape preservation ✅); but the model **recoloured the black hair to cinnabar red** and dropped the objects in both hands (kettle & scale gone, hands simplified) — palette-clash vs. faithful-colour tension to judge.
- **nano-banana-2** — fully matte ✅ no speculars (the lit-filter + matte clause appears to have killed the reflection problem on this input); boldest ink line of the two, closest to the locked palette; but more shape drift (legs merge into one column, skin went ochre, only one shoe reads).
- **Latency:** both returned synchronously within the wait today (seedream again faster than its 34 s platform p50).

**Pending:** U02 (the laptop photo) — not yet saved to disk by the PM; run on the same recipe when provided.


Scoring rubric vs **variant D** (fill in per run): ① 3D-consistent faceting ② ~single ink outline weight ③ locked palette (cinnabar/gold/azurite/malachite on rice paper) ④ shape preserved (*still reads as the user's object*) ⑤ no photorealism/gradients. **Target: pass ≥8/13 Track A photos per endpoint → ADR-002.**

| Input | cartoonify | image-editing/cartoonify | flux kontext | seedream 4.5 | nano-banana-2 |
|---|---|---|---|---|---|
| **S01 car** (benchmark) | `S01__cartoonify.png` | `S01__imgedit.png` | `S01__kontext.png` | `S01__seedream.jpg` | `S01__nano2.png` |
| **S02 phone** | `S02__cartoonify.png` | `S02__imgedit.png` | `S02__kontext.png` | `S02__seedream.jpg` | `S02__nano2.png` |
| **S09 fruit** | `S09__cartoonify.png` | `S09__imgedit.png` | `S09__kontext.png` | `S09__seedream.jpg` | `S09__nano2.png` |
| **S14 ang pow** | `S14__cartoonify.png` | `S14__imgedit.png` | `S14__kontext.png` | `S14__seedream.jpg` | `S14__nano2.png` |
| **PM verdict** | ☐ | ☐ | ☐ | ☐ | ☐ |

> Stage-① cutouts (birefnet) were the stylizers' inputs — pipeline order matches `07-system-architecture` §4.2. Output dims note: kontext/img-edit returned 1392×752-class images; seedream returned ~1–1.4 MB 4-class JPEGs; `cartoonify` sometimes changed aspect (e.g. S09 → 768×1024) — **record as a fidelity risk** (aspect drift = shape-preservation strike).

## 4 · Track B — catalogue identification (NO stylize) ✅ verdict in

| Query style | S10 (joss-paper stack) | S11 (incense) |
|---|---|---|
| **Zero-shot** ("what's the main object?") | ❌ **"Packaged snacks"** | ✅ "Incense sticks" |
| **Closed-set** ("which of *our* items: joss paper / incense / gold bars / candle / fruit…?") | ✅ **"joss paper / spirit money"** | (not needed — zero-shot already matched) |

**Finding → design (feeds ADR-002 + 07 §4.2 open Q8):** the identification call **must be closed-set against the store catalogue**, not open labelling — zero-shot misclassified culturally specific objects. Cost ≈ **$0.01/query** (moondream2, p50 1.1s) → the short-circuit is cheap *and* viable with the right prompt shape. **Track B verdict: PASS (with closed-set requirement).**

## 5 · Path B — image→3D probes (geometry mode, 40k faces) ✅ both completed

- **S01 car** → GLB `…/OnYsGb9XPmp_DnRz0JH88_model.glb` (476 KB) + preview PNG — completed in minutes
- **S09 fruit** → GLB `…/Z21FRxO5LU8tj4tuUG7U__model.glb` (481 KB) + preview PNG
- **Verdict for ADR-002 (partially answered):** Path B *works mechanically* at $0.015/mesh — but a raw mesh isn't the D-pipeline output; it would need app-side rendering + ink treatment (a runtime change, not a drop-in). **Note:** v3.1 schema says *LowPoly/Sketch not available in v3.1* → low-poly face budgets must come from `face_count` (min 40k — far above D's 37-face art target, which is authored, not generated). Path B stays **reserve/strategic**, not MVP.

## 5b · Path C probe — describe-then-generate (2026-09-26, PM proposal) 🧪 experimental

**The idea (PM, post-lock):** don't stylize the capture directly — ① use machine vision to identify the objects **and their characteristics** (limit **3 objects**; the car example → `["blue", "sedan", "four doors"]`), then ② **generate from a blank canvas** from those characteristics + the style-D tokens ("low poly", "cartoon", "colour palette"). Claimed benefits: **clean background every time** · **drops stages ①②④** (bg-removal · lighting filter · re-cut) · enables **multiple objects per picture** and **partial/occluded captures**.

**Probe run (2 identify + 2 generate ≈ US$0.18):**

| Stage | Endpoint | Result |
|---|---|---|
| ① identify | `fal-ai/moondream2/visual-query` (~$0.01, p50 1.1s) | **S01** → `[["blue","sedan","4 doors","medium","metal"], …]` ✅ **exact match to the PM's expected attributes** (+2 background sedans, capped at 3) · **S05** → 3 objects returned but ⚠️ **notebook missed / mislabelled** |
| ② generate | `fal-ai/nano-banana-2` **text-to-image** ($0.08, p50 11.5s) | attrs + style tokens → `path-C/iterations/S01__pathC_t2i_from-attrs.jpg` · multi-object → `path-C/iterations/S05__pathC_t2i_multiobj.jpg` |

**First read:**
- ✅ **clean blank background by construction** — no cutter, no lighting filter
- ✅ pipeline collapses to **2 calls ≈ US$0.09/picture** — cost-neutral vs the frozen 4-stage (≈$0.087), simpler, latency ≈ identify 1.1s + generate 11.5s
- ✅ **multi-object generation works** in one image (S05); partial/occluded inputs no longer a segmentation problem (identify what's visible, generate the whole object)
- ⚠️ **fidelity trade-off (the big one):** rubric ④ *"still reads as the user's object"* weakens — you get *a* blue sedan, not *this* A220 (no instance preservation: exact model, wear marks, custom details)
- ⚠️ **extraction becomes the weak link:** moondream2 missed the notebook on S05 — may need a stronger VLM, a stricter extraction schema + validation, or retries
- ⚠️ run-to-run consistency depends on prompt assembly (seed parameter available for reproducibility)

**Round 7 — PM feedback on the probe output + prompt v2 (2026-09-26):**
1. **"Objects lack lighting shaders"** → the wireframe already adds **bottom shadows**, so for consistency the generation must carry a **top-down lighting shader** (light from directly above: top facets bright, sides mid, undersides dark).
2. **"Car colours don't exist in the original image"** → **subject colours must stay exactly as in the source photo**; the accent palette applies only to the background.

**v2 prompt changes:** identify prompt now demands *precise colour exactly as in the source* (S01 → **"denim blue metallic"** ✅ — matches the manifest's actual paint name); generate prompt adds the **top-down shader clause** + **source-colour lock** + "no ground shadow (app adds it)".

| Run | Result |
|---|---|
| identify v2 (moondream2) | `[["denim blue metallic","sedan", …]` ✅ precise source colour extracted |
| generate v2 first attempt | ❌ **422 `no_media_generated`** (upstream rejection; params verified correct, prompt reviewed — presumed unbilled, verify on invoice) |
| generate v2 retry | ✅ `path-C/iterations/S01__pathC_v2_t2i_toplight-srccolour.jpg` — denim-blue sedan, top-lit shading, blank background |
| generate v3 (PM: "make the glass transparent") | ✅ `path-C/S01__pathC_v3_t2i.jpg` — added *windows/glass transparent and see-through, not blacked out or tinted* clause |

**Round 8 — wider probe: all 12 remaining Track-A inputs through Path C (2026-09-26, 32 runs ≈ US$1.16):**
S02–S09, S12, S14–S16 (+ S05 re-run with v3 prompt) → identify (moondream2) → t2i (nano-2, v3 style template: source-colour lock + top-down shader + no ground shadow + blank background). Outputs: **`path-C/Sxx__pathC_v3_t2i.jpg`** (12 files, moved to the dedicated [[path-C/EVALUATION|path-C/]] folder with an evaluation sheet; 12/12 generations succeeded, zero 422s).

| # | Input | Extraction verdict | Issues surfaced |
|---|---|---|---|
| S02 | Lumia phone | ✅ type correct (phone, Microsoft/Windows logos) | 🔴 **colour-example leak** (v2.1) |
| S03 | rice cooker | ✅ type correct | 🔴 leak + **type key dropped** in re-run (schema instability) |
| S04 | wallet | ✅ correct (dark-brown leather + ID card) | 🔴 leak |
| S05 | glasses + notebook | ⚠️ **notebook missed 4×**; recovered only via targeted yes/no probe ("black, leather-like") | 🔴 leak + 🔴 **multi-object extraction unreliable** |
| S06 | watch + notebook | ✅ notebook+watch+laptop found in re-run | 🔴 leak |
| S07 | Vans sneakers | ✅ checkered off-white shoes + socks | duplicates (shoe ×2) |
| S08 | teapot + cup | ✅ light-green cup + brown teapot | minor duplicate (teapot ×2) |
| S09 | fruit bowl | ✅ orange + lime + apple | — |
| S12 | HDB block | ✅ white building + green roof | good |
| S14 | ang pow | ✅ red envelope (foil finish) | duplicates (envelope ×3, finish variants) |
| S15 | keys | ✅ gold keys + blue key | duplicates (key ×2) |
| S16 | altar | ✅ gold statue + red candle + white bowl | good |

**Issues that propd up (extraction stage only — generation was 12/12 clean):**
1. 🔴 **Prompt-example leakage** — the identify prompt's example colour *"denim blue metallic"* was echoed as the main object's colour on **5 consecutive images** (S02–S06) where it cannot be right (a rice cooker!). **Fix: never put example colours in the extraction prompt**; rewritten as *"describe what you see, do not copy example words"* → all 5 corrected on re-run. *A validation rule "identical colour string across different object types ⇒ reject" would catch this in production.*
2. 🔴 **Multi-object scenes lose items** — S05's notebook was missed on **4 general extraction attempts** and only surfaced via a **targeted yes/no probe**. Scene inputs need either per-object targeted passes, a stronger VLM, or closed-set priors (Track B) — the cap-3 "list the main objects" phrasing isn't enough.
3. 🟡 **Duplicate/near-duplicate objects** in the JSON (glasses ×4, envelope ×3, shoe ×2) → needs a dedupe/validation layer before prompt assembly.
4. 🟡 **Schema instability** — same image returned three different JSON shapes across re-runs (typed keys → dropped `type` → flat array). Production needs strict schema validation + one retry.
5. ✅ **Generation side solid:** 12/12 t2i succeeded, all with blank rice-paper backgrounds, held the coarse-facet style, source colours, and top-down shading — no bg-removal, no lighting filter, no re-cut.

**Cost of this probe:** 20 identify calls (~$0.20, incl. leak-correction re-runs) + 12 t2i ($0.96) ≈ **US$1.16** → all-in Path C ≈ $0.09–0.11/picture *including* retries (the $0.09 steady-state estimate holds when extraction succeeds first try).


> 🏆 **PM VERDICT (Path C, 2026-09-26, post-scorecard):** ***"PATH C is the way forward"*** — describe-then-generate adopted as the style-D pipeline; failure rate (3/13 needed ≥1 targeted retry) *"acceptable for now, we will work on it as we go along."* → **recorded in [[ADR-002-path-c-describe-then-generate|ADR-002]]** (accepted). The frozen edit recipe (round 6) is retained as the documented fallback.

**Status (superseded by the verdict above): experimental probe no longer — Path C is DECIDED.** Correction loop (extract → validate → targeted re-probe → regenerate) is part of the accepted pipeline (ADR-002 §4).

## 6 · Next steps

1. **PM scores the 20 outputs** (rubric §3) → identifies Tier-1 winners
2. **Tier 2** (winners × S03–S08, S12, S15–S16 ≈ 9 images × 1–2 endpoints ≈ US$1–2)
3. → **ADR-002** (provider + real `cost_micros`/`latency_ms` + closed-set ID requirement) → log actual spend in `project-costs.md` (**SCRUM-41**) → economy spec (SCRUM-18) with **~$0.05–0.06/burn** all-in estimate confirmed

---
*Created 2026-09-26 (Session 17) — Tier-1 run executed via fal.ai MCP; 41 runs, ≈US$1.27; outputs archived (and reorganized by engine at end of day → `spike/results/by-engine/`).*
