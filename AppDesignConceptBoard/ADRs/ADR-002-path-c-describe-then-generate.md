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

## Amendment 3 · 2026-10-19 — DETECT UP TO THREE, CARTOONIZE ONE

**Status:** ✅ decided by the owner (2026-10-19) and implemented in the pipeline. `SCRUM-134`.

**Context.** §Decision 1's identify stage extracts **≤3 objects** and the pipeline handed **every** one of them to the generator — `stylePrompt` composed `Subject: A; then B; then C.` So a photograph of one offering on a cluttered desk came back as a low-poly **diagram of the desk**. The feature was demoed a few times and put in front of users, and the feedback was consistent: **the extra objects were not wanted.**

> *"3 objects generated max is not representative of the user's intent. The users' feedback says that the extra objects aren't wanted. So I decided that we will only have 1 object cartoonized. This means we should still detect if there is more than one object up to 3 objects but we should apply an analysis that assigns a probability factor to the objects and only cartoonize the one object with the highest probability."* — owner, 2026-10-19

⚠️ **The contradiction was already on the record and left standing.** `STYLE_TEMPLATE_V3.output` has always said *"One object only, centred, whole, clean silhouette"* — while the composed prompt named three subjects. The template was right; the pipeline was wrong. (Noted in `next-ai-context.md`, S66: *"the template contradicts itself … Framing is a design decision, not a bug fix."*)

**Amendment.** Path C gains a **selection stage between validate and generate**:

> ① identify `moondream2` (**≤3 objects**) → ② validate → **②b select** — rank the detected objects and take the **argmax** → ③ generate `nano-banana-2` (v3) from **that one object** → ④ cut out `birefnet/v2`

* **Detection is unchanged.** `MAX_OBJECTS = 3` still governs the identifier, and the extra objects are still *useful* — they are the evidence for which one the photograph is about. Only the RENDER cap is new: `CARTOONIZED_OBJECTS = 1`.
* **The probability is an ANALYSIS the code owns, not a number we ask the model for.** A VLM's self-reported confidence is uncalibrated and frequently absent (`moondream2` is a VQA model that answers in prose; the spike saw bare arrays). So `rankObjects()` scores each object as a weighted sum of three terms, and **only one comes from the model**:

  | term | weight | source |
  |---|---|---|
  | `stated` | **0.6** | the model's own **optional** `prominence` (0–1) — a hint, never the whole answer |
  | `order` | **0.35** | **position in the answer.** The identify prompt already asks for *"largest and most central first"*, so position is a measurement, not a guess. Object 0 → 1.0, the last → 1/n |
  | `count` | **0.05** | `count > 1` (the subject appears more than once) — a **tie-break**: at 0.05 it sits below the narrowest `order` gap (`0.35 / 3 ≈ 0.117`), so it cannot out-rank a better-positioned object |

  The weights sum to 1, so a score is already in 0–1; `rankObjects()` then **normalises the set into a probability distribution that sums to 1**, and `selectSubject()` takes the argmax. When nothing is stated the neutral default **0.5** is used for *every* unstated object — a constant that cannot change the argmax among them, so the ranking falls through to `order`, the signal we trust.
* ⚠️ **THE FIRST WEIGHT SET WAS WRONG, AND A SMOKE TEST FOUND IT — NOT REVIEW.** The first cut was `0.5 / 0.4 / 0.1`, and it looked reasonable. Run against a realistic answer it produced a **DEAD TIE**: two objects, the second explicitly ranked **0.9** by the model, scored **0.650 vs 0.650** against the unstated first — so the model's own ranking was worth *nothing*, and array order decided. The cause is structural: at n=2 the `order` gap is `order_weight × 0.5`, so `order` could out-shift a `stated` swing of the same size. `0.6 / 0.35 / 0.05` fixes it (**0.715 vs 0.650**), and both halves are now assertions — *a strong hint WINS, a weak hint does NOT*. *A weight is a claim; it has to be run, not reasoned.*
* **`prominence` is an OPTIONAL, loosely-typed hint — deliberately.** It is accepted as `z.union([z.number(), z.string()])` and normalised by `prominenceOf()`, which **drops** anything that is not a finite number and **clamps** the rest. A malformed hint must never fail the whole answer: the retry is ≈US$0.09, and it exists for an extraction we cannot use — not for a missing cosmetic field.
* **The single-object decision is enforced by the TYPE, not by a doc.** `stylePrompt(subject)` now takes **one** object instead of an array, so there is no expression that can hand the generator a list. A decision enforced only by prose is a decision that drifts — and `STYLE_TEMPLATE_V3.output`'s *"One object only"* is now simply true.
* ⚠️ **A subject's `count` is recorded but NO LONGER RENDERED.** The prompt used to read `3 × candle`; with one object that would contradict the template clause the whole decision rests on. `count` stays on the identified object (diagnosis, and the `count` term of the ranking). *If a multi-instance subject should render as multiple items, that is a one-line change to `stylePrompt` — flagged, not assumed.*
* **`dedupeObjects()` carries `prominence` through a merge** (highest wins, mirroring `count`). The merge branch builds a fresh object, so an un-carried field would silently drop the ranking signal for exactly the objects the model had ranked.
* **The choice is LOGGED with every candidate's probability**, and returned as `subject` (the one rendered) plus `objects` (all detected, ranked) on both `PathCResult` and the orchestrator response. ⚠️ **A silent substitution is the failure mode to fear** — if the sprite shows the wrong subject, the log and the response have to say what the pipeline believed and why. The client reads neither field.

**Rejected.** *Asking the model for a confidence and using it alone* — uncalibrated, often absent, and it makes the decision depend on whichever field the model happened to emit. *Keeping the array and trusting the prompt's "One object only" clause* — that is what was already being ignored. *Rendering a fixed "first" object with no analysis* — the owner asked for a probability factor, and the ordering the prompt requests is a measurement worth scoring rather than assuming. *Dropping detection to one object* — the extra objects are what make the selection possible.

**Effect on §Consequences.** The *"Multi-object and partial/occluded captures work"* bullet is **narrowed, not removed**: multi-object captures are still *understood* (that is how the subject is chosen) but only **one object is rendered**. Cost and latency are **unchanged** — `identify`, `generate` and `cutout` are still exactly one call each, so the ≈US$0.091/run figure and the daily stop-rule stand.

**Guards.** `check:pathc` **48 → 72**. Sixteen of the new assertions are **behavioural** (the ranking, the probability distribution, the tie-break, the clamping, the empty set) and four **read `pathc.ts`** and assert the pipeline really calls `selectSubject(objects)` and really passes `stylePrompt(subject)` — never the array. ⚠️ **Fault-tested 10 times: 10 breaks → 10 reds, 0 survivors** (render cap · neutral default · count weight · prominence dropped by a merge · the hint removed from the prompt · the count multiplier restored · normalisation removed · `stylePrompt(objects)` restored · selection removed · the schema made strict). *(Two further checks — the strong-vs-weak hint pair and the `count < order / MAX_OBJECTS` invariant — bring the total to **74** and the fault-test count to **13**.)*

**✅ Verified with a REAL call (≈US$0.091, one Path C run, and the sprite was LOOKED AT).** On the spike's own multi-object input **`S09.jpg`**: the identifier returned **3** objects (Orange · Lemon · Apple), the pipeline logged `subject: "Orange" (0.38) chosen from 3 detected`, and the stored sprite — **1408 × 768 RGBA WebP, 49,704 B, 78.5 % fully transparent, alpha 0 at all four corners** — shows **ONE low-poly orange**. The spike's **already-paid-for** `S09__pathC_v3_t2i.jpg` is the **same input** through the old pipeline and shows **three** fruits. ⚠️ **The run also produced a finding no offline test could: the model returned `prominence: 1` for ALL THREE objects** — the hint **saturated**, so the `stated` term cancelled and **`order` decided**. That is exactly the case these weights were designed for, now measured rather than argued.

✅ **DEPLOYED 2026-10-24 — and the "needs an access token this worktree does not have" note that stood here was WRONG.** `npx supabase functions deploy cartoonize-orchestrator --project-ref yercgevebxvtzkgctfai --use-api` ran from the `89ebb` worktree and **succeeded**: **version 8 → 9**, `updated_at` **2026-10-18 02:07 UTC → 2026-10-24 05:46 UTC**, bundle hash **`a7db5d46…` → `f85d7d7f…`** — three independent signals that new code is live. ⚠️ **`verify_jwt` stayed `true`**, so there is no auth regression. ⚠️ **The CLI was already authenticated** (`npx supabase projects list` succeeded); the token is simply not in `~/.supabase/access-token` or `~/.config/supabase/`, which is what made a *file listing* look like "no token" — **absence of a file is not absence of a credential.** ⚠️ **And `--use-api` DOES handle multi-file** — it uploaded `index.ts` **plus all four `_shared/*` dependencies**, so the "single file or a pre-built zip" reasoning that ruled the connector out was a **non-problem**. ✅ **AND VERIFIED ON GLASS THE SAME DAY (2026-10-24).** The full ritual ran on **`25128PC17G`** (Android 16 / SDK 36, 720 × 1600 @ 320 dpi) in Expo Go against the **hosted** project, and the deployed orchestrator's **own log** recorded the selection — `subject: "Glass" (0.41) chosen from 3 detected — "Glass" 0.41, "Spoon" 0.33, "Computer Mouse" 0.26`: a real probability distribution summing to **1.00**, argmax rendered. The stored sprite (`styled/…d399f504….webp`, **39,578 B**, **1408 × 768 RGBA WebP**) shows **ONE** object — a low-poly glass — with **alpha 0 at all four corners** and **80.9 % of pixels fully transparent**, and **neither** the spoon **nor** the "Computer Mouse" (the transparent-cased circuit board) present. Job `cb6771c9-…`: `styled`, **91,000 micros**, **15,351 ms**, **0 retries**. The ritual completed end to end: `Devout ±17.73 px` → **600 tribute**, Balance 600. ⚠️ The photo deliberately contained **three** candidate objects, because a one-object scene would not have exercised the selection stage at all.

---

*Accepted 2026-09-26 (Session 18) on PM verdict after the Path-C scorecard (13/13 post-retries). Evidence: spike RESULTS §5b rounds 7–9 · `spike/results/path-C/` (19 images + iterations). Amendment 3 decided by the owner 2026-10-19 from demo + user feedback.*
