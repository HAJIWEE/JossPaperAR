# 17 · AR-fire spike plan — the fire over a live camera (SCRUM-8)

**Status:** 📋 **Planned — not executed.** Execution is **deferred** to the **repo + CI milestone** (SCRUM-15) + the **Tier F floor device** (doc 14 §1), so the numbers are measured on real hardware, not extrapolated.
**Date:** 2026-10-02 (Session 26)
**Jira:** SCRUM-8 (framework question — closed by [[ADRs/ADR-003-non-ar-ar-mvp-ar-framework|ADR-003]]) · spike execution tracked as a follow-up ticket
**Related:** [[ADRs/ADR-003-non-ar-ar-mvp-ar-framework]] (the decision this tests) · [[04-ar-app-patterns]] (the pattern) · [[07-system-architecture]] §2 (the overlay in the system) · [[14-nfr-device-and-performance-targets]] (N3/N4/N10 — the gate) · [[05-concept-to-mvp-gap-analysis]] §8 spike (b)

---

## 1 · What the spike must answer

The MVP's "AR" is **non-AR AR** ([[ADRs/ADR-003-non-ar-ar-mvp-ar-framework|ADR-003]]): a live camera preview with a **fixed-position fire overlay** and the four-band throw. Nothing about that is proven on a real low-end phone yet. This spike answers:

1. **Does the fire composite at the frame budget on the floor device?** — ≥ 30 fps sustained on **Tier F**, 60 fps on Tier M (**N3**).
2. **Does the throw stay under the input budget?** — touch → fire reaction → grade **≤ 100 ms** (**N3**).
3. **Does one full ritual thermally throttle?** — no throttling within a 5-min continuous camera+overlay run; frame-time degradation **≤ 20 %** (**N4**).
4. **What does the camera cost in battery?** — **≤ 8 % per 10-min session** (**N10**).
5. **Do the measured aim bands read true on a real touchscreen?** — the four bands (正中 ±14.55 · 虔誠 ±39.40 · 擦邊 ±96.97 · 偏失 ×0) must grade the same as the prototype's `aim-check.js` (**the acceptance test**).
6. **Is the fire legible in sunlight?** — doc 04's overlay-readability rule (dark scrim behind the fire/score; the centre kept clear for aiming).

---

## 2 · Acceptance target

**The gate is doc 14, not a new spec.** A pass = **all** of:

| # | Criterion | Source | Target |
|---|---|---|---|
| A1 | Frame rate, sustained | N3 | **≥ 30 fps on Tier F** · 60 fps on Tier M |
| A2 | Input → render latency | N3 | **≤ 100 ms** |
| A3 | Thermal (one ritual) | N4 | no throttle in a 5-min run; frame-time degradation **≤ 20 %** |
| A4 | Battery | N10 | **≤ 8 %** per 10-min session (camera continuous, Tier F) |
| A5 | **Aim bands grade true** | aim spec (gap-analysis §2) | all four bands match the artwork-derived bands |
| A6 | Sunlight readability | doc 04 | fire + score legible outdoors; centre clear |
| A7 | Asset budget | doc 14 §3 | fire sprite sheet **≤ 400 KB**; ≤ 30 fps redraw on Tier F |

> ⚠️ **Reconciles an inconsistency:** SCRUM-17's acceptance criteria wrote *"60 fps AR overlay"* — doc 14 is the authority: **30 fps is the floor on Tier F, 60 fps the target on Tier M**, and **the aim bands, not fps vanity, are the acceptance test** (doc 14 §4.4). The slice should cite doc 14, not "60 fps" unqualified.

---

## 3 · The PoC architecture (what we actually build to test)

```
┌──────────────────────────── burn screen (Expo / React Native) ────────────────────────────┐
│  <Camera>  (expo-camera)         ← live preview, no capture yet                          │
│      │                                                                                    │
│      └─▶ overlay layer (RN views / Reanimated, UI thread)                                 │
│             · fire sprite sheet  (animated, fixed screen position — the pit)              │
│             · offering  (the styled sprite being held)                                    │
│             · aim guide + 6 sight ticks + score pop                                       │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

- **No AR framework** — `expo-camera` + RN views only (ADR-003). The spike is deliberately built *without* any native module so it can run in **Expo Go**.
- **The fire is a sprite-sheet**, not a shader/particle system — it must fit ≤ 400 KB and ≤ 30 fps redraw on Tier F (doc 14 §3).
- **The throw** ports the prototype's aim-band derivation: the bands are measured from the fire's own artwork; the spike checks the native screen reproduces the same four bands.
- **The fire's reaction** (flare on a good throw, smoulder on a graze) is part of the composite test — it must not push frame time over budget.

---

## 4 · Test matrix

**Device:** the **named Tier F floor device** (doc 14 §1 shortlist — Galaxy A05s / Redmi A5 / Nokia C-series, ~S$100–150, bought at the repo+CI milestone). One Tier M phone as the 60 fps reference.

**Runs (per device):**

| Run | What it does | Reads |
|---|---|---|
| R1 · idle composite | camera preview + fire animating, no throw, 2 min | sustained fps · frame-time p95 · dropped frames |
| R2 · full ritual | the "First Burn" 10-min scenario (capture skipped — sprite held) | fps during throw · input→render latency · battery delta |
| R3 · aim sweep | four scripted throws (dead centre · in the flame · on the coals · past the pit) | grade + award + fire reaction vs `aim-check.js` |
| R4 · thermal soak | 5 min continuous camera + overlay | frame-time degradation % · thermal-zone temps |
| R5 · sunlight | outdoor, midday, fire + score on screen | legibility (photo + eyeball) |
| R6 · sprite budget | weigh the sprite sheet; count redraws | KB · redraw fps on Tier F |

**Tooling:** the spike is a **dev-only screen** in the app (a `?spike=fire` route). Metrics via per-frame counters + ADB (fps, battery, thermal zones) — the same "machine-read verdict" habit the prototype used (`aim-check.js`), ported as a native health check (feeds SCRUM-25 / doc 14 §5.5).

---

## 5 · Recorded per run

- Device + OS + RAM/SoC · ambient conditions (indoor/outdoor, sunlight)
- **sustained fps** (R1/R2) · **frame-time p95** · dropped-frame count
- **input→render latency** (R2) — touch timestamp → first fire-reaction frame
- **battery delta** (R2) — % per 10 min · **thermal degradation** (R4) — % frame-time change over 5 min
- **aim verdicts** (R3) — each of the four bands, pass/fail vs the artwork-derived bands
- **fire sprite sheet size** (R6) in KB
- Verdict per A1–A7 · the *actual* phone model recorded back into doc 14 §1

---

## 6 · Verdict & stop rules

- **PASS** = A1–A7 all met on Tier F → the non-AR AR approach is proven; hand N3/N4/N10's measured numbers to the vertical slice (SCRUM-17) and the store listing (compatibility).
- **PARTIAL** = frame budget missed → apply the documented downgrades **in order**: drop overlay effects → move animation to the UI thread (worklet) → reduce fire sprite complexity → cap preview at 720p → dim overlay. **The aim bands must not shift** (doc 14 N3).
- **FAIL** = the fire cannot composite at 30 fps on Tier F even at reduced settings → reopen **ADR-003** (a floor change or a rendering-strategy change is an ADR-level decision, per doc 14 N1).
- **Stop rule:** no new paid service is needed for this spike — it is a device build, not an API spend. The only cost is the **floor device** (~S$100–150, a PM purchase already flagged in doc 14 §1).

---

## 7 · Execution notes (for the session that runs it)

- **Prerequisites:** the **repo + CI milestone** (SCRUM-15) exists (a dev build to install) · the **Tier F device** is in hand · the fire sprite sheet is drawn (≤ 400 KB).
- **Order:** R1 → R2 → R3 (correctness first, then budget) → R4/R5/R6.
- **Reuse, don't reinvent:** the aim check is a **port of `prototype/tools/aim-check.js`** (16 assertions, four scripted throws, guard square so a dead probe can't read as a pass). ⚠️ the prototype is retired — port the *pattern*, not the HTML.
- **After:** record the measured numbers in this doc · update [[14-nfr-device-and-performance-targets]] §2 with any tier change · comment on the follow-up Jira ticket · feed the vertical slice (SCRUM-17).

---

*Created 2026-10-02 (Session 26) — SCRUM-8 deliverable: the proof-of-concept plan for the AR fire mechanic. Deferred to the repo+CI milestone (SCRUM-15) + the Tier F floor device.*

