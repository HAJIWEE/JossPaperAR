# 🎯 Path C evaluation sheet — describe-then-generate (nano-banana-2 t2i)

**PM evaluation pass** · run 2026-09-26 · pipeline: `moondream2 identify → nano-banana-2 text-to-image (v3 template)` · cost ≈ US$0.09–0.11/picture
**Compare against:** the *edit-path* outputs in [[../by-engine/README|by-engine/nano-banana-2/]] (frozen recipe round 6) — same 13 Track-A inputs.
**Gate (mirror Track A):** ≥8/13 pass → Path C viable for ADR-002.

## What the v3 template already bakes in (do not re-review each time)

source-exact colours · **top-down lighting shader** (wireframe has bottom shadows) · transparent glass where applicable · no ground shadow (app adds it) · blank warm rice-paper background · coarse 40–60-facet low-poly + ink outline + matte

## The 13 finals

| ID  | Subject                                                 | Style-D look | Reads as the source object            | Colours match source | Clean bg + top light | Verdict |
| --- | ------------------------------------------------------- | :----------: | ------------------------------------- | -------------------- | -------------------- | :-----: |
| S01 | Mercedes A220 sedan (transparent glass)                 |      Ok      | Ok                                    | Ok                   | Ok                   | ☐ pass  |
| S02 | Lumia phone                                             |      Ok      | Ok                                    | No                   | Ok                   |   no    |
| S03 | rice cooker                                             |      OK      | Ok                                    | Ok                   | No                   | ☐ pass  |
| S04 | wallet + ID card                                        |      OK      | ok                                    | ok                   | ok                   | ☐ pass  |
| S05 | glasses + notebook *(notebook only via targeted probe)* |      ok      | ok                                    | ok                   | ok                   | ☐ pass  |
| S06 | watch + notebook                                        |      Ok      | ok                                    | ok                   | ok                   | ☐ pass  |
| S07 | Vans sneakers + socks                                   |      ok      | No - extra shoe                       | ok                   | ok                   |   no    |
| S08 | teapot + cup                                            |      ok      | ok                                    | ok                   | ok                   | ☐ pass  |
| S09 | fruit bowl (orange/lime/apple)                          |      ok      | no - missing bowl and too low details | ok                   | ok                   | ☐ pass  |
| S12 | HDB block                                               |      ok      | ok                                    | ok                   | ok                   | ☐ pass  |
| S14 | ang pow packet                                          |      ok      | ok                                    | ok                   | ok                   | ☐ pass  |
| S15 | keys on keyring                                         |      ok      | ok                                    | ok                   | ok                   | ☐ pass  |
| S16 | ancestor altar                                          |      ok      | ok                                    | ok                   | ok                   | ☐ pass  |

**Score: ___ /13 (gate ≥8)**

## Head-to-head vs edit path (per input, pick one)

| ID  | Path C | Edit path (frozen) | Winner | Note                                                         |
| --- | :----: | :----------------: | :----: | ------------------------------------------------------------ |
| S01 |  this  |         ☐          |   ☐    | instance fidelity test — does *a* sedan read as *this* A220? |
| S05 |  this  |         ☐          |   ☐    | multi-object composition test                                |
| S12 |  this  |         ☐          |   ☐    | scene/building input                                         |
| S16 |  this  |         ☐          |   ☐    | dim/altar input                                              |

## Known caveats going in (from the probe — RESULTS §5b round 8)

1. **Extraction issues already found & fixes planned:** prompt-example colour leak (fixed in prompt) · S05 notebook missed 4× (needs targeted passes/stronger VLM) · duplicate objects in JSON (dedupe layer) · schema drift (strict validation).
2. **Generation was 12/12 clean** — judge the *images*, the extraction risks are logged separately.
3. **Fidelity ceiling:** Path C can never preserve instance-level details the VLM didn't extract (scratches, custom plates, exact wear). If rubric "reads as *this* object" fails systematically, that's the edit path's argument for ADR-002.

## Iteration history (not part of the gate)

`iterations/` — v1 (initial attrs, no lighting/colour rules) · v2 (top-down shader + source-colour lock) · S05 v1 multi-object attempt.

---
*Outputs moved here from `by-engine/nano-banana-2/` for evaluation (2026-09-26). Source of truth for the probe write-up: [[RESULTS]] §5b.*

---

## Round 2 — re-pass of failed/flagged items (2026-09-26, 6 runs ≈ US$0.27)

**Targeted identify probes first:**

| ID | Probe question | Answer |
| --- | --- | --- |
| S02 | exact phone colour | **dark grey, glossy** (v3 run had generated black → the colour fail) |
| S07 | shoe count | **exactly 1 shoe** + checkered sock (v3 extraction's plural "shoes" caused the extra shoe) |
| S09 | bowl present? | **yes — white bowl, 9 fruits** (bowl was never extracted → never prompted) |

**Fixes applied in the regeneration prompt:** S02 = colour lock *"dark grey glossy, NOT pure black"* · S07 = count lock *"EXACTLY ONE shoe, do NOT draw a second shoe or a pair"* · S09 = container lock *"white bowl clearly holding the fruits, do not omit it"* + per-fruit detail cues (peel dimples, stems) within the facet budget.

| ID | Re-score here | Your verdict |
| --- | :-: | :-: |
| S02 (dark grey) | ☐ pass | ☐ fail |
| S07 (1 shoe) | ☐ pass | ☐ fail |
| S09 (white bowl + detail) | ☐ pass | ☐ fail |

Files: `S02__pathC_repass_t2i.jpg` · `S07__pathC_repass_t2i.jpg` · `S09__pathC_repass_t2i.jpg` (previous v3 versions kept alongside for comparison).

**Note:** this round validated the *correction loop* — targeted probe → prompt fix → regenerate. If all three pass, the production recipe needs **per-failure retry logic** (extract → validate → targeted re-probe → regenerate), which adds ≈$0.09 per retry but keeps steady-state cost at ≈$0.09/picture.

### S07 attempt 3 — count corrected to pair (2026-09-26, 1 run ≈ US$0.08)

Repass 1 produced **one shoe too few** — the `shoe_count: 1` probe answer was **wrong** (VLM undercounts; the round-8 extraction had listed two shoe entries all along). Regenerated with **pair lock**: *exactly TWO matching sneakers, left + right, do NOT draw a third AND do NOT omit either*.

→ Re-score: `S07__pathC_repass2_t2i.jpg` — ☐ pass ☐ fail

**Lesson (feed into ADR-002):** VLM **counts are unreliable in both directions** (overcounted in v3, undercounted in repass 1) — count-critical objects need either majority-vote counting across N queries, closed-set priors, or a human-in-the-loop check. Overriding the count from a single probe answer is how this failure flipped.

---

## ✅ FINAL VERDICT (2026-09-26, PM)

- **S07 repass 2 (the pair): PASS** → scorecard closes at **13/13 after the correction loop** (3 inputs / 23% needed ≥1 retry; S07 needed 2).
- PM: *"the failure rate is acceptable for now, we will have to work on it as we go along — **PATH C is the way forward**."*
- Decision recorded → **[[ADR-002-path-c-describe-then-generate|ADR-002]] ✅ Accepted** (Path C = the style-D pipeline; edit recipe retained as fallback; validation + correction loop is part of the accepted design).
