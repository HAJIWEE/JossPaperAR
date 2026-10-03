# 18 · MVP scope & realistic timeline — SCRUM-14

**Date:** 2026-10-03 (Session 27) · **Jira:** SCRUM-14 · **Status:** ✅ **plan complete — SCRUM-14 → Done (planning)** · the *build* is tracked by the tickets this doc names (§9)
**Depends on:** [[05-concept-to-mvp-gap-analysis]] §2–§8 (the scope input — what is settled vs faked) · [[07-system-architecture]] v2.8 (service map + ~20-table schema) · [[10-economy-spec]] (quota = the AI-cost control) · [[11-integrity-posture]] (caps · rate limits · ledger) · [[13-privacy-and-retention]] · [[14-nfr-device-and-performance-targets]] (the numbered floor N1–N12) · [[15-clan-model-and-book-of-tributes]] (no non-clan altar) · [[16-cultural-consultation-and-ritual-review]] (the alpha gate) · [[17-ar-fire-spike-plan]] · [[ADRs/README|ADR-001 · 002 · 003 · 005 · 007]]
**Feeds:** the milestone tickets (§3) · the family-alpha gate · [[ADRs/README|ADR-004/006/008]] (still unwritten) · `project-costs.md` (spend windows)

> **In one line:** the MVP is **not "port the prototype"** — it is *replace each fake with a real service without changing the shape the prototype settled on* ([[05-concept-to-mvp-gap-analysis]] §1). This doc turns that into a **scope list, a dependency map, effort estimates, five milestones, a risk register and a testing plan** — sized against the project's real pace (a solo PM + AI, no deadline), not against a fiction.

---

## 1 · Definitions — what "MVP" means here

| Term | Meaning in this project | Evidence |
|---|---|---|
| **Slice complete** | one offering end-to-end **on a real phone**: camera → cartoonize → burn → aim-grade → award → **persisted** → visible in the league | SCRUM-17 (scoped) · [[17-ar-fire-spike-plan]] §2 |
| **MVP / family alpha** | a **closed, functional app**: real account, real clan + ancestors, real burns, the economy enforced, one festival's worth of use by the family | [[05-concept-to-mvp-gap-analysis]] §8.8 chain · [[15-clan-model-and-book-of-tributes]] |
| **Beta** | the alpha build hardened against the numbered floor (**N1–N12**), instrumented, and on Play internal testing | [[14-nfr-device-and-performance-targets]] §2 |
| **Not in MVP** | Virtual Temple · advanced AR-fire collection/exchange · battle pass · social beyond the clan · true world-locked AR | [[project-summary]] §MVP · [[ADRs/ADR-003-non-ar-ar-mvp-ar-framework\|ADR-003]] |

**The one structural rule the whole plan obeys:** the client *asserts*, the server *decides*, and **only `award-service` writes money** ([[07-system-architecture]] §2–§3). Every workstream below ends at that boundary.

---
## 2 · MVP scope — essential vs deferred  *(deliverable 1)*

### 2.1 Essential — the MVP is not the MVP without these

| # | Feature | Source (locked) | Where it is built | Acceptance test |
|---|---|---|---|---|
| E1 | **Camera capture** — live preview + capture, framed, compressed ≤ 300 KB | 05 §3.1 · 14 §3 | `expo-camera` + client compression | capture on Tier F; upload ≤ 300 KB (N7) |
| E2 | **Cartoonization — Path C** (identify → validate → generate, style **D**) | [[ADRs/ADR-002-path-c-describe-then-generate\|ADR-002]] · 07 §4.2 | Edge Fn `cartoonize-orchestrator` + hosted AI | styled sprite holds D; p50 ≈ 12.6 s, p95 ≤ 30 s (N5) |
| E3 | **Non-AR AR burn** — fixed-position fire overlay, ≤ 400 KB sprite, flare/smoulder reaction | [[ADRs/ADR-003-non-ar-ar-mvp-ar-framework\|ADR-003]] · 14 §3 | RN views / Reanimated (UI thread) | ≥ 30 fps Tier F; input→render ≤ 100 ms (N3) |
| E4 | **Four-band throw + award** — 正中 ×2.0 · 虔誠 ×1.5 · 擦邊 ×1.0 · 偏失 ×0; 400 × band × ground + streak | 05 §2 (art-derived) | client measure → **server** award | **the four bands grade true** — the acceptance test (A5) |
| E5 | **Persisted ledger** — append-only, idempotent, server-only writer | [[ADRs/ADR-005-honest-client-caps-append-only-ledger\|ADR-005]] · 07 §5 | Postgres + RLS + `award-service` | same `idempotency_key` replayed → one award (N6) |
| E6 | **Clan + ancestors** — no non-clan altar; create/join, up to 10 tablets | [[15-clan-model-and-book-of-tributes]] | SCRUM-46 (+ SCRUM-50 QR) | a user cannot reach Home without a clan (15 §6) |
| E7 | **Tribute points, league & streaks** — cohorts, weekly roll, live board | SCRUM-11 · 07 §4.7 | `weekly-roll` + Realtime channel | board re-ranks live; promotion line follows the top 3 |
| E8 | **Burn limits** — 10 photo / 20 store burns per day, per **user** | [[10-economy-spec]] §1 | `quotas` + orchestrator gate | the quota copy shows; caps enforced server-side |
| E9 | **Alternative (store) items** — fixed-value burns with no photo (Track-B, $0.01) | 10 §2/§3 | catalogue (code-owned) + `item_code` burn | a store burn awards without a capture |
| E10 | **Location-based value** — new-ground ×2.0, decay on repeat, ~4-block cells, **no location trail** | [[13-privacy-and-retention]] · 07 §5 | cell hash → server flag | repeat burn in the same cell decays; no raw coordinates stored |
| E11 | **Privacy & consent build** — consent, retention windows, delete-all, names never in analytics/logs | [[ADRs/ADR-007-privacy-minimal-windowed-one-tap\|ADR-007]] · 13 | client + RLS + analytics config | delete-all clears captures + styled + names; analytics carry no names |
| E12 | **Offline durability** — captures queue across days and replay idempotently | 14 §2 (N6) | local SQLite queue | airplane mode → 48 h → reconnect → one award |

### 2.2 Deferred — explicitly out, and *why* (so it stops resurfacing)

| Deferred | Deferred to | Reason it is safe to defer |
|---|---|---|
| Virtual Temple (explorable 3D) | V2+ | asset + engine cost; no product question left open by it |
| AR-fire collection / exchange | V2+ | cosmetic only — needs the fire shipped first |
| Battle pass | after advertising revenue lands | the monetization sequence is ads → shop → pass ([[project-summary]]) |
| Social beyond the clan (visiting other temples) | V2+ | needs moderation, and a scale the family alpha cannot test |
| True world-locked AR (ARKit / ARCore / Unity) | the four exit ramps in ADR-003 | *non-AR AR* is what makes the Tier-F floor achievable |
| Purchasable ancestor slots (SCRUM-47) | after the build | a monetization decision, not a build blocker |
| Store screens beyond the catalogue | after alpha | the 4-item catalogue closes the loop; the shop UI is not MVP |
| Ad SDK integration | **after ADR-008** | *may ads ever enter the ritual flow?* is unanswered (§8) — the only MVP ad touch is the **post-ritual** rewarded photo |

**Scope rule that keeps the list honest:** anything that is neither in §2.1 nor a dependency in §3 is **out by default** — a new idea gets a Jira ticket, never an implicit place in the sprint.

## 3 · Task dependency map  *(deliverable 2)*

### 3.1 The gates — what must be true before the next thing starts

| Gate | State | Blocks |
|---|---|---|
| **G1 · Repo + CI + dev environment** (SCRUM-15) | ✅ **cleared 2026-10-02** (PRs #1–#3, CI green) | — |
| **G2 · Tier-F floor device** (SCRUM-52) — *a PM purchase, ~S$100–150* | 🔴 **open** | every **device-measured** step: the slice's device check, the AR-fire spike (SCRUM-51), all of N1–N12 |
| **G3 · Backend of record** (Supabase project + the §5 schema subset + `cartoonize-orchestrator` / `award-service`) | 🔴 **open — no ticket existed until now** | E2 · E5 · E7 · E8 · E10 |
| **G4 · ADR-006 burn-limit semantics** | 🟠 unwritten (spec is [[10-economy-spec]]) | final E8 rule + copy |
| **G5 · ADR-008 ad posture** (*may ads ever enter the ritual flow?*) | 🟠 unwritten — **a product call** | the ad SDK, the rewarded photo, monetization planning — **not** the slice |
| **G6 · The build stylesheet exists** | 🔴 | `contrast-check.js` / `responsive-check.js` stop reporting `skipped`; the design-system gates bind to real CSS |

### 3.2 The map

```
 G1 repo + CI ✅ ─────────────────────────────────────────────┐
                                                             │
 G3 Supabase backend ──┐                                     │
                       ├──▶  M1 · VERTICAL SLICE  ◀───────────┘
 G2 floor device ──────┤         (camera → cartoonize → burn → award → persist)
                       │              │
                       └──▶  M2 · AR-FIRE SPIKE (SCRUM-51)      │
                                                                 ▼
                                          M3 · FAMILY ALPHA
                            ┌──────────────┬──────────────┬──────────────┬─────────────┐
                            ▼              ▼              ▼              ▼             ▼
                     SCRUM-46 clan    SCRUM-11 league  SCRUM-12 location  economy/    screens from
                     build (+ SCRUM-50 QR)  points · streaks   value · decay   wallets     Penpot
                            └──────────────┴──────────────┴──────────────┴─────────────┘
                                                                 │
                                                                 ▼
                                                     M4 · BETA HARDENING (N1–N12 · a11y · integrity · Play)
```

**Three rules the arrows encode:**

1. **G2 blocks measurement, not authoring.** Everything except the device-run checks can be built before the phone arrives — but *no milestone is "complete" without a run on the named Tier-F device* ([[14-nfr-device-and-performance-targets]] N1).
2. **The slice is deliberately thin.** One hard-coded clan and one object type (SCRUM-17's own task list) — the clan build (SCRUM-46) is **not** a slice dependency, and pretending otherwise is the classic way this milestone slips.
3. **Nothing downstream of `award-service` may be built client-side.** E5/E7/E8/E10 all land in one place, so the backend (G3) is one workstream, not four.

### 3.3 The map in Jira terms

| Ticket | Kind | Depends on | Blocks | Milestone |
|---|---|---|---|---|
| **SCRUM-15** ✅ | build | — | — | M0 |
| **SCRUM-52** floor device | PM action | — | SCRUM-51 · slice device check | M0 → M1/M2 |
| **SCRUM-53** *(new)* build the vertical slice | build | G1 ✅ · **G3** · SCRUM-52 | everything | M1 |
| **SCRUM-54** *(new)* Supabase backend of record | build | G1 ✅ (no device needed) | SCRUM-53 · 11 · 12 · 46 | M1 |
| **SCRUM-51** AR-fire spike | spike | G2 · 17 (plan) | SCRUM-13 | M2 |
| **SCRUM-13** AR fire mechanic + aiming | build | SCRUM-51 | alpha | M3 |
| **SCRUM-46** clan management build | build | SCRUM-54 · 15 (spec) | SCRUM-50 · alpha | M3 |
| **SCRUM-50** QR invite | build | SCRUM-46 | alpha invite-by-link | M3 |
| **SCRUM-11** points · league · streaks | design **+** build | SCRUM-54 · 10 · 11 (spec) | alpha progression | M3 |
| **SCRUM-12** location-based value | build | SCRUM-54 · 13 (privacy) | alpha decay | M3 |
| **SCRUM-55** *(new)* write ADR-004 / 006 / 008 | doc | 10 · 13 · [[ADRs/README]] | SCRUM-11 build rules · ad SDK | M3 (G4/G5) |
| **SCRUM-41** log spike spend | PM action | due 2026-10-06 | — | M0 |
| **SCRUM-49** cultural consultation | PM action | a functional app (alpha) | public release | M4 → M5 |
| **SCRUM-43** legal long-tail | PM action | — | Play submission | M4 |
| **SCRUM-47** purchasable slots | feature | alpha | — | post-MVP |

---
## 4 · Effort estimates  *(deliverable 3)*

### 4.1 The unit, and why it is not hours

This project's real unit is the **focused session** — one AI-assisted work block (~2–4 h of PM attention). It is measurable: **S1 → S26 happened in 11 calendar days** (2026-09-22 → 2026-10-02), i.e. **≈ 2.4 sessions/day** during the *design* phase.

Two honest caveats before reading the table:

- **Planning ≠ building.** The design phase had no device, no cloud project, no build-and-wait cycles. Estimates below assume the **build pace is slower**: **≈ 4 sessions/week**. If it holds at 2.4/day, everything lands ~3× sooner; if the first native build bites, it could be 2× slower. Hence the ranges.
- **The PM is not a mobile specialist** ([[next-ai-context]] — software dev, AI vibe-coding). The first Expo/Supabase build carries the largest learning curve in the plan, and it is deliberately front-loaded.

### 4.2 Per-workstream estimates

| # | Workstream | Ticket | Sessions (AI-assisted) | Notes |
|---|---|---|---|---|
| W0 | Floor device purchase | SCRUM-52 | **0.5** (a PM action) | ~S$100–150; 3 candidates listed in doc 14 §1 |
| W1 | **Supabase backend of record** (G3) | SCRUM-54 | **4–6** | schema + RLS + two Edge Fns + tests; not device-bound |
| W2 | **Vertical slice** | SCRUM-53 | **6–9** | camera · Path C call · fire overlay · aim port · offline queue; **the biggest unknown** |
| W3 | AR-fire spike | SCRUM-51 | **2–3** | doc 17 is already the test script; this is execution + numbers |
| W4 | AR fire mechanic (production) | SCRUM-13 | **3–5** | the spike's code, productised |
| W5 | Clan build (+ QR/links) | SCRUM-46 · 50 | **5–8** | doc 15 §9 schema is written; boards are built |
| W6 | Points · league · streaks · weekly roll | SCRUM-11 | **4–6** | spec needs writing first (it is *design* **+** build) |
| W7 | Location value + decay | SCRUM-12 | **3–4** | never prototyped — new ground ([[05-concept-to-mvp-gap-analysis]] §5) |
| W8 | Economy & wallets wiring (credits/points/store · quota UX) | part of 53/54 | **3–4** | catalogue is 4 items; shop UI deferred |
| W9 | **App screens from Penpot** (Home · altar · capture · burn · reward · collection · profile · privacy hub) | folded into the above | **6–10** | 153 boards include states/EN+ZH; ~30 unique screens. **The hidden cost** — the design is signed off, but it is a *design*, not code |
| W10 | Privacy & consent build | 13 spec | **2–3** | consent · retention · delete-all · analytics off |
| W11 | Beta hardening: N1–N12 on Tier F · a11y pass · integrity caps · instrumentation (SCRUM-25) | — | **6–10** | device matrix runs + fixes |
| W12 | The three ADRs | SCRUM-55 | **1–2** | written *from* existing specs |
| W13 | Cultural review (run + record) | SCRUM-49 | **1–2** + a 45–60 min conversation | doc 16 is ready; needs a functional app |
| W14 | Legal long-tail (awareness only) | SCRUM-43 | **1–2** | Play fee vs floor · ToS/privacy policy · trademark |

**Totals:** the slice path (W0+W1+W2+W3) = **13–19 sessions**. Full MVP → beta (all of the above) = **41–63 sessions** — call it **~50 sessions ±25 %**.

### 4.3 What would move the numbers

| Assumption | If it breaks |
|---|---|
| Hosted-AI Path C holds at scale (p95 ≤ 30 s, ≈ $0.10/photo) | falls back to the edit recipe (ADR-002) → +2–3 sessions |
| `expo-camera` + RN overlay holds ≥ 30 fps on Tier F | falls to a smaller preview / fewer effects — **never** raise the device floor (N1: a floor change is an ADR-level decision) |
| Expo/Supabase free tiers suffice | ~$25/mo at scale (doc 10 §2) — a cost row, not a schedule risk |
| PM attention stays at ~4 sessions/week | the whole calendar stretches linearly — see §5 |

---
## 5 · Timeline with milestones  *(deliverable 4)*

### 5.1 The milestone chain (unchanged from 05 §8.8 — now with gates and numbers)

```
   M0 FOUNDATION          M1 SLICE + M2 SPIKE         M3 FAMILY ALPHA              M4 BETA               M5 PUBLIC
   repo ✅ / device       one offering, real phone    real clan · real ancestors   N1–N12 on Tier F      consultation ✅
   ── Sprint 1 ────▶  ──── Sprints 1–2 ────────▶  ───── Sprints 3–7 ─────────▶  ── Sprints 7–9 ──▶  ── Qingming 2027? ──
      by 16 Oct              by 30 Oct                   by Dec 2026 – Jan 2027      by Feb 2027           ~5 Apr 2027
```

| Milestone | Definition of done | Tickets | Sessions | **At ~4 sessions/week** | *At the measured design pace* |
|---|---|---|---|---|---|
| **M0 · Foundation** | repo + CI + scaffold live · names floor device · spike spend logged | 15 ✅ · 52 · 41 | 0.5–1 | **by Sprint 1 close · 16 Oct 2026** | already done but for the purchase |
| **M1 · Vertical slice** | one offering end-to-end on Tier F; four bands grade true; award persisted; 3 failure paths honest | 54 · 53 | 10–15 | **Sprint 2–3 · by 6 Nov 2026** | by 24 Oct |
| **M2 · AR-fire spike** | doc 17 gate A1–A7 all pass — or a written "miss + what we change" | 51 | 2–3 | **Sprint 2–3 · by 6 Nov 2026** | by 20 Oct |
| **M3 · Family alpha** | real account · real clan + ancestors · real burns · economy + quota enforced · privacy build · one festival's-worth of use | 13 · 46 · 50 · 11 · 12 · 55 | 24–36 | **Sprints 4–7 · by 8 Jan 2027** | by 6 Nov |
| **M4 · Beta** | every N1–N12 measured on Tier F and met (or a documented waiver) · a11y pass · integrity caps live · instrumentation on · Play internal testing | 49 · 43 · instrumentation | 6–10 | **Sprints 8–9 · by 5 Feb 2027** | by 20 Nov |
| **M5 · Public** | cultural review recorded and its changes landed · store listing + honesty clause check · Play submission | 49 · 43 | 1–2 | **≈ Qingming 2027 (5 Apr)** — a real festival is the honest first public moment | — |

*Left column = the working estimate (build pace ≈ 4 focused sessions/week). Right column = what it looks like if the PM keeps the design-phase pace — shown only to prove the estimate is driven by effort, not by dates. **There is no deadline**: no milestone above is allowed to be met by cutting an acceptance criterion (§7); the sequence is what is fixed, not the calendar.*

### 5.2 Sprint-by-sprint plan (Sprint 1 → 4, concrete)

| Sprint | Window | The one goal | Work |
|---|---|---|---|
| **1** | 02–16 Oct 2026 | **Clear the two gates** | SCRUM-52 device (**PM**) · SCRUM-54 backend (can start now) · SCRUM-41 spend log (**PM**, due 6 Oct) · **SCRUM-14** ✅ this doc |
| **2** | 16–30 Oct | **The slice runs** | SCRUM-53 slice on device · SCRUM-51 spike · SCRUM-11 spec written |
| **3** | 30 Oct–13 Nov | **The slice is trustworthy** | slice failure paths + idempotency tests · spike findings → SCRUM-13 · SCRUM-46 start · ADR-006 written |
| **4** | 13–27 Nov | **Alpha features land** | SCRUM-46/50 clans · SCRUM-11 league · SCRUM-12 location · ADR-004/008 |
| **5–7** | 27 Nov–8 Jan | **Alpha is usable** | screens from Penpot · economy wiring · privacy build · instrumentation · **family alpha gate** |

**Sprint 1 note (this session's own output):** Sprint 1 already carries SCRUM-14 (this doc, now Done), SCRUM-11, SCRUM-41 and SCRUM-46. SCRUM-11/46 are **too early to finish** in Sprint 1 while G3/G2 are open — they are correctly *scheduled*, not *started*; SCRUM-54 (the new gate) is the item that can actually move this fortnight.

---
## 6 · Risk register  *(deliverable 5)*

**L** = likelihood · **I** = impact · both 1–5. **Trigger** = the observable that says it is happening.

| # | Risk | L | I | Mitigation | Trigger / early signal | Owner |
|---|---|---|---|---|---|---|
| R1 | **Cartoonization cannot hold style D at scale** — the visual promise collapses | 3 | 5 | spike already validated **Path C** (13/13); keep the **edit-based recipe** as a documented fallback (ADR-002); the *per-region rule* (wheels round on all four corners) is still untested → test it in the slice | a styled sprite that fails the §2 style-D checks twice in a row | build |
| R2 | **Cost per burn vs ad-only revenue** — an AI image per burn, free users, against ad eCPMs | 3 | 4 | quota **is** the control (10 photo burns/day); `$1.55/1,000` credits; stop-rule = global daily AI budget → queue, never fail (doc 10) | `cartoonize_jobs.cost_micros` trend vs the $3.64/user/mo ceiling (N12) | PM + build |
| R3 | **The wait during the ritual** — 12.6 s of AI in a solemn moment | 4 | 3 | the wait **is** UI (*"the offering is being prepared"*); queue copy; prefetch; offline capture queue | alpha testers abandon before the burn completes | build |
| R4 | **The 40–50s device reality** — mid-range Android, 3 GB, storage, permissions | 4 | 4 | the numbered floor (Tier F) + the **named device**; non-AR AR; asset budgets; measure **before** optimising | any NFR that fails on Tier F and cannot be *seen* on a dev machine | build |
| R5 | **Privacy of the most personal data imaginable** — family objects, ancestors' names, where they burn | 2 | 5 | retention windows · delete-all · names never in analytics/logs/shares (13 §4) · 4-block cells with **no trails** · ADR-007 | an ancestor name appearing in any log, crash report, or share card | PM + build |
| R6 | **The first native build takes far longer than estimated** (first Expo/RN + Supabase project for a non-mobile dev) | 4 | 3 | front-load it (M1) · keep the slice deliberately thin (one object, hard-coded clan) · `expo-doctor` + typecheck in CI from day one | the slice still not running on device at the end of Sprint 2 | build |
| R7 | **Screen build (Penpot → RN) is the hidden cost** — 153 boards are a design, not code | 4 | 3 | ~30 unique screens; build screens **as the flow needs them**, not board-by-board; reuse the design-system tokens | the alpha date moving while features are done but screens are not | build |
| R8 | **G2 device purchase stalls the whole measurement track** | 3 | 3 | it is a ~S$100–150 one-line PM action with 3 candidates listed; authoring (SCRUM-54, ADR-55) does **not** need it | Sprint 1 closes with SCRUM-52 still open | **PM** |
| R9 | **`ADR-008` (ad posture) is unanswered**, so monetization planning and the rewarded photo cannot be finished | 4 | 2 | it is a product question, not a technical one — one PM decision releases ADR-008, the ad SDK and the rewarded photo | alpha end with no monetization decision recorded | **PM** |
| R10 | **Solo capacity** — one PM + AI, no deadline, competing life demands | 4 | 3 | the timeline is effort-based, not date-based (§5); the scope rule (§2.2) keeps the list closed; every milestone is resumable | sessions/week falling below ~2 for more than two weeks | **PM** |
| R11 | **Cultural misstep lands after code is frozen** | 2 | 5 | consultation planned **before** the family alpha is public (doc 16); pre-decided change policy; copy edits land in one pass | review surfaces a change that touches data model, not copy | **PM** (SCRUM-49) |
| R12 | **Play compliance / legal long-tail** (fee vs floor · Data Safety · ToS · trademark · model terms) | 3 | 2 | awareness-only ticket SCRUM-43; `targetSdk` follows Play's rules automatically in Expo | submission blocked on the Data Safety form | **PM** |

**The two risks to watch hardest:** **R6 (first build)** — it is the only one that can move every date on its own — and **R8/R9**, which are *one PM action each* yet currently gate the critical path and monetization respectively.

---
## 7 · Testing & validation plan  *(deliverable 6)*

The prototype's habit is the standard: **behaviour is checked by a machine that can fail**, with a guard so a dead probe cannot read as a pass ([[05-concept-to-mvp-gap-analysis]] §2). It has to be ported, not re-invented — the prototype itself is retired (`prototype/README`).

### 7.1 The four tiers of check

| Tier | What it covers | How | When | Gate |
|---|---|---|---|---|
| **T1 · Static (CI, every push/PR)** | typecheck · `expo-doctor` · design-system contrast + responsive checks | GitHub Actions (`.github/workflows/ci.yml`, live) | now | red PR = do not merge |
| **T2 · Headless behaviour** | the pure logic: aim bands, award maths, decay, quota, idempotency key, catalogue values | Node/unit checks beside the code | per feature | the ported **`aim-check.js`** pattern: green/red squares read back, blue guard square |
| **T3 · Device checks (each, on Tier F)** | camera · cartoonize round-trip · fire overlay fps · input→render · cold start · storage · memory · battery · offline replay | scripted run on the **named floor device** + `adb` measures | per milestone | a milestone is not complete without it (N1) |
| **T4 · Human** | does the ritual *feel* right · is the copy respectful · can a 50-year-old do it without help | PM + family, on a real phone | M3 (alpha), M4 | the alpha gate |

### 7.2 The acceptance tests that actually decide "done"

| Check | Pass criterion | Source |
|---|---|---|
| **Aim bands grade true** | all four bands (±14.55 / ±39.40 / ±96.97 / miss) match the art-derived bands on a real touchscreen | doc 17 A5 — **the slice's acceptance test** |
| **Idempotent replay** | same `idempotency_key` → one ledger row and one receipt; a 48 h offline replay awards once | doc 14 N6 |
| **Server decides** | a tampered client cannot mint money: only `award-service` writes; caps 1,650/burn · 49,500/day · 6/min hold | [[11-integrity-posture]] |
| **Names stay private** | grep the analytics payload, logs, crash reports and share card for any test ancestor name → zero hits | 13 §4 |
| **No location trail** | repeat burn in one cell decays; no raw coordinates in any table | 13 · doc 12 |
| **Device floor** | N1–N12 pass on the named Tier-F device, measured | doc 14 §2 |
| **Theme** | contrast ≥ 4.5:1 on every cream surface, font scaling to ×1.5, haptics as primary feedback | doc 14 N11 |

### 7.3 The three failure paths (part of "slice complete", not an edge case)

| Failure | Required behaviour |
|---|---|
| **AI fails / is rejected** | credit refunded, honest retry affordance, the ritual is not stranded mid-burn (07 §4.2, doc 10 §3) |
| **Network fails** | capture queues locally and replays later; the burn itself never double-awards (N6) |
| **Throw misses** | the offering **returns** — it is never destroyed (05 · [[04-ar-app-patterns]]); copy matches the band |

### 7.4 Validation with real people (what actually de-risks the product)

- **Metrics are defined but not instrumented** (SCRUM-25 ✅ defined them) — wiring them is beta work (M4).
- **Alpha cohort:** the PM + family, on real phones, entering real ancestors' names — the first true test of R5 and R11.
- **Cultural review (SCRUM-49)** runs **before** the app is public, on a functional build, per doc 16.
- **Success question for the alpha** (not a vanity metric): *did anyone make an offering on a day nobody asked them to?* That single behaviour answers whether the ritual framing works — everything else is telemetry.

---
## 8 · What needs the PM (the plan's open inputs)

| # | Decision / input | Why it matters here | Cost |
|---|---|---|---|
| D1 | **Buy the floor device** — 1 of 3 in doc 14 §1 (Galaxy A05s · Redmi A5 · Nokia C-series) | gates G2 → the slice's device check + the spike | ~S$100–150 · 5 min (SCRUM-52) |
| D2 | **Ad posture — may ads ever appear inside the ritual flow?** | releases ADR-008 → the ad SDK, the rewarded photo, monetization (R9) | one call (SCRUM-55) |
| D3 | **Pick the slice's object + ancestor** (SCRUM-17 asked this and it stayed open) | a *real* family object is the strongest possible demo — and the fastest way to flush out D5 | one choice |
| D4 | **Pick the alpha's festival framing** — Qingming (~5 Apr 2027) vs Hungry Ghost (~Aug) | decides whether the public moment is M5 (Apr) or later; campaign + copy depend on it | one call |
| D5 | **Honest sessions/week** — the number that makes §5's calendar real | the estimate is effort-based; the calendar is just this number | one number |
| D6 | **Who pilots the alpha, and are they comfortable typing ancestors' names?** (doc 05 §8 prep) | the first true test of R5/R11; also the alpha's value | a family conversation |
| D7 | **Clan head-exit mechanic** + altar display at cap 10 (doc 15 §10) | blocks two SCRUM-46 behaviours | two calls |
| D8 | **Ratify ADR-004/006** when their records land | they are already-decided; the records merely stop re-litigation | a read-through |

**Everything else in this doc is decided.** No build work is waiting on a design question — the design is signed off, the specs are written, and the ADRs that matter are accepted.

---

## 9 · Deliverable status (ticket tasks ↔ this doc)

| SCRUM-14 task | Where | State |
|---|---|---|
| Define MVP scope (essential features only) | §2.1 | ✅ 12 essentials, each with source + build site + acceptance test |
| Create task dependency map | §3 | ✅ gates G1–G6 · the DAG · the Jira-terms table |
| Estimate effort for each task (in hours/days) | §4 | ✅ in **focused sessions** (the project's own measurable unit), with a stated pace assumption and ±25 % band |
| Create realistic timeline with milestones | §5 | ✅ M0–M5, two calendar columns |
| Identify potential risks and blockers | §6 | ✅ 12 risks, L/I, triggers, owners; blockers surfaced as gates |
| Plan testing and validation phases | §7 | ✅ T1–T4 tiers, the acceptance tests, the three failure paths |

**New tickets this doc files** (they did not exist, which is *why* the critical path looked stuck):

| Ticket | Why it had to exist |
|---|---|
| **SCRUM-53** — build the MVP vertical slice | SCRUM-17 was the *scope*; nothing was filed to build it, yet it is the next milestone |
| **SCRUM-54** — Supabase backend of record | G3: the persist step, the ledger, the league and the location grid all hang off one unbuilt thing |
| **SCRUM-55** — the three unwritten ADRs (004 · 006 · 008) | decided-but-unrecorded decisions; ADR-008 additionally blocks monetization |

---

## 10 · The plan in one screen

1. **Two one-PM-action gates open the critical path:** the **floor device** (SCRUM-52) and **ADR-008**.
2. **The next engineering move is the backend (SCRUM-54), then the slice (SCRUM-53)** — thin, on the real device, with the **aim bands** as its acceptance test.
3. **~50 focused sessions to beta**, front-loaded by the first native build (R6) and the screen build (R7); the release moment that matters is **Qingming 2027**.
4. **Scope is closed** — §2.2 is the answer to every "we could also…" for the next three months.

---

*Created 2026-10-03 (Session 27) — SCRUM-14 deliverable: MVP scope (essential vs deferred) · dependency map + gates · effort estimates · M0–M5 timeline · 12-risk register · T1–T4 testing plan. **SCRUM-14 → Done (planning)**; the build is tracked by SCRUM-53/54/55 + the existing 11/12/13/46/50/51/52. Sized against the project's real pace (solo PM + AI, no deadline) — the sequence is fixed, the calendar is not.*