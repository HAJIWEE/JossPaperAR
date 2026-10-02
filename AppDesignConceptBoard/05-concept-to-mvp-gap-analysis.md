# 🔍 05 - Concept → Prototype → MVP Gap Analysis

> **Purpose**: Where the locked prototype and the stated concept still disagree — and therefore what the *real* (non-HTML) MVP has to build.
> **Status**: ✅ Complete (2026-09-24 · Session 8) — this is the brief for the Session-9 architecture work
> **Related**: [[project-summary]] (the concept) · [[../prototype/README|prototype/README]] (what exists, and what it fakes) · [[next-ai-context]] (the plan)

---

## 1. The one-line summary

The prototype answered the **product** questions it was built to answer — style, flow, feel, the shape of the economy — and none of the **engineering** ones. Everything it shows is real code, but every external dependency is faked: no camera, no AI call, no server, no GPS, no accounts, no persistence. The MVP is therefore **not** "port the prototype"; it is **replace each fake with a real service without changing the shape the prototype settled on**. The prototype is the spec, not the codebase.

## 2. What the prototype settles — treat as spec, don't re-litigate

| Settled | The spec, precisely | Machine-checked by |
|---------|--------------------|---------------------|
| **Art direction** | Low-poly 3D × ink brush; variant **D** = B's mesh tolerance (3.1 units, 18-vertex profile) with C's 16-gon wheels; **37 rendered faces** (31 body + 6 wheel); palette cinnabar `#C23B22` · gold `#D4AF37` · azurite `#4A6FA5` · malachite `#0E9B78` · ink `#1A1A1A` · rice paper `#F5F0E8` | `fidelity-test.html` + `tools/validate-fidelity.js` (144 checks) |
| **Screen flow & copy** | 6 screens at 390×844; the shrine the *user* builds (姓氏 + 名字 + 称谓 chips, 姓＋氏 fallback, 4 tablets per altar, no ancestor authored in) | `index.html` + `tools/render-check.js` (20 checks) |
| **The throw and its economy** | Four bands, measured off the fire's own artwork: 正中 ±14.55 **×2.0** · 虔誠 ±39.40 **×1.5** · 擦邊 ±96.97 **×1.0** · 偏失 **×0**; award = 400 × band × 2.0 (new ground) + 50 (streak) = **1,650 / 1,250 / 850 / 0**; a wild throw misses | `tools/aim-check.js` (16 checks) |
| **The league works** | A throw banks its award, the board re-ranks live, the promotion line follows the top 3 | `app.js` (verified in both browser tools) |
| **The verification habit** | Behaviour is checked by a machine that can *fail* — green/red squares read back from a screenshot, a blue guard square so a dead probe cannot read as a pass, and the test itself fault-tested | all three tools |

## 3. Every fake in the prototype → what the MVP must put in its place

| # | Faked today | What the MVP needs | What that forces architecturally |
|---|-------------|--------------------|----------------------------------|
| 1 | **The camera** — the "viewfinder" is a CSS gradient over a placeholder photo | live preview + capture with framing/quality guidance | camera stack + permissions + client-side compression + a device matrix (mid-range Android!) |
| 2 | **The AI** — the "cartoonized" object is a pre-generated SVG mesh; no API is called anywhere | photo → styled result that **holds D** (3D-consistent faceting, ~37-face budget) | runtime provider choice, cost/photo, latency budget, moderation, retry path, result storage |
| 3 | **The AR compositing** — the fire is an authored SVG inside an HTML phone frame | fire over a **live camera feed**, fixed screen position (doc 04: *non-AR AR* first) | render stack, frame budget, thermal/battery, sunlight readability, haptics (doc 04: haptics > sound) |
| 4 | **The throw** — scripted keyframes; the bands are read from SVG polygons | the same feel on a real touchscreen at 60 fps, with the same bands | keep the *derivation* (art → bands) or bake and verify against the art; an input-latency budget |
| 5 | **Points** — `state.points` in memory, gone on reload | a server-side, auditable ledger per user | auth, API, idempotent writes, caps, rate limits |
| 6 | **The league** — the opponents are authored rows in the markup | real users, ~30 per cohort, weekly roll, promotion/relegation, anonymised names | scheduled jobs, cohort assignment, privacy rules |
| 7 | **The altar** — ancestor names live in `state.ancestors`, lost on reload | persistent, private, multi-device, deletable | data model + encryption + retention + **no ancestor names in analytics** |
| 8 | **The streak** — a fixed `+50` row | real day counters, freeze (don't punish holidays), timezone/DST | server time as the authority, notifications |

## 4. Concept features never prototyped at all

- **Location-based value** — the whole home-ground / exploration-bonus / decay system (SCRUM-12)
- **Burn limits** and **alternative items** — both named as MVP must-haves in Session 1, both absent
- **A real streak** plus its reminders; the Duolingo comparison currently exists only as a copy line
- **Festival-calendar engagement** — Qingming and Hungry Ghost are the *peak* moments (doc 04)
- **Onboarding / tutorial** — capture → cartoonize → burn → league, as the concept describes it
- **Accounts, recovery and the family-legacy vision** — "grows over generations": today a shrine dies with the browser tab
- **The Book of Tributes** — offering history / collection (doc 04)
- **Cultural consultation** — names, ritual framing, tier names; still no advisor engaged

## 5. Gaps inside the prototype itself (product, not engineering)

1. **The burn is not addressed to an ancestor.** You can hold four tablets, but the throw never says *who* the offering is for. For a ritual app that is the emotional centre, not a detail — and it is what would give the Book of Tributes something to record.
2. **Discovery has no shape.** The concept is "travel, find what is worth honouring"; the prototype captures *anything*. Location value is the mechanic that expresses it — a product decision first, GPS second.
3. **"Burn limits" is undefined** — a cap, a quota, a cooldown, or a cost? The honest answer is that it is the AI bill wearing a product hat.

## 6. The decisions architecture must close (in this order)

| # | Decision | Options | Why it is here |
|---|----------|---------|----------------|
| 1 | **Client platform & runtime** | native iOS + Android · Flutter/React Native · Unity · web-first PWA | everything depends on it — AR plugin, AI SDK, device matrix, store fees |
| 2 | **AR mode** | fixed-overlay "non-AR AR" (doc 04) vs true ARCore/ARKit | the fixed overlay removes the entire world-tracking risk; true AR becomes a later "photo mode" |
| 3 | **Cartoonization runtime** | cloud API (Stability/OpenAI) · self-hosted LoRA · on-device (CoreML/ONNX) | the KEY priority, the biggest cost, and the 3–10 s wait — decide on the spike's measured numbers, not opinion |
| 4 | **Backend shape** | BaaS (Firebase/Supabase) · serverless functions · custom service | the ledger needs real transactions; cohorts and the geo grid need real queries |
| 5 | **Identity** | anonymous device id first, optional account later | nobody in this demographic forgives a signup wall before the first burn |
| 6 | **Integrity posture** | honest client + sanity bounds vs server verification | a physical throw cannot be verified server-side — the realistic answer is caps, rate limits and an append-only ledger |
| 7 | **Burn-limit semantics** | daily quota · cost per burn · cooldown | it *is* the AI cost control (see #3) |
| 8 | **Privacy & retention** | photos · ancestor names · location | decide retention windows and delete-all **before** writing any storage code |
| 9 | **Ad posture** | whether ads may appear in the ritual flow at all | it changes the economy model and the ad SDK choice |

## 7. The five risks that could sink the MVP (in order)

1. **Cartoonization quality at D** — if the output cannot hold 3D-consistent faceting, the visual promise collapses. Mitigation: the spike, with the fidelity page's **D** as the acceptance target (SCRUM-6/7).
2. **Cost per burn vs ad-only revenue** — an AI image per burn, for free users, against ad eCPMs. Mitigation: the quota model (#7), cheaper tiers, caching, on-device later.
3. **The wait during the ritual** — 3–10 s of AI in a solemn moment. Mitigation: make the wait part of the ritual ("the offering is being prepared"), prefetch, honest progress, offline capture queue.
4. **The 40–50s device reality** — mid-range Android, storage pressure, permissions, older OS versions. Mitigation: a written device matrix as an NFR, the non-AR mode, small asset budgets.
5. **Privacy of the most personal data imaginable** — photos of family objects, ancestors' names, where they burn. Mitigation: retention windows, opt-in analytics that never see names, delete-all, no raw location trails.

## 8. What Session 9 (architecture) should produce

1. **ADRs** for the nine decisions above, each with the rejected options and the reason.
2. **A system architecture diagram** + service boundaries + the API sketch: capture → cartoonize job → result → burn → award → league.
3. **A data model**: users · ancestors/tablets · offerings · burns/awards · ledger events · cohorts · weekly rolls · grid cells · quotas.
4. **The economy spec** — values, the measured multipliers, decay, quotas, streaks, and the ad-revenue-vs-cost ceiling.
5. **NFR targets** — device matrix, min OS, cold start, 60 fps throw, p95 cartoonization latency, offline behaviour, cost per active user.
6. **Privacy/security posture** — PII inventory, retention, deletion, consent, moderation of user photos.
7. **Repo + CI + test plan** — port the prototype's habit: machine-read verdicts, a fault-tested harness, one device check per behaviour.
8. **Milestones** (feeds SCRUM-14): spike → vertical slice (one offering end-to-end on a real device) → family alpha → beta.
9. **The handover pack from the prototype** — the §2 spec table, the aim maths, the copy, the art targets.

**Spikes that ride along**: (a) the cartoonization experiment with real cost and latency numbers · (b) the fire over a live camera on a mid-range Android · (c) a tiny end-to-end backend: award → ledger → weekly roll. **(a) ran S18 → ADR-002; (b) is now planned → [[17-ar-fire-spike-plan|doc 17]] (SCRUM-8); (c) still to come.**

**Prep for the user (~10 min)**: which phone/platform you actually carry (this picks the first target) · who in the family would pilot it, and whether they are comfortable entering ancestors' names into it · whether ads may appear in the ritual flow at all.

---

*Created: 2026-09-24 (Session 8), from the prototype review. Next: [[next-ai-context]] — Session 9 (software architecture for the MVP).*
