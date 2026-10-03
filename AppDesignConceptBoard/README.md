# 🎨 App Design Concept Board - Joss Paper AR

> **Purpose**: Central hub for all design research, visual references, and UI/UX exploration for the Joss Paper AR app.
> **Started**: 2026-09-23
> **Phase**: Design Research & Concept Validation

---

## 🎯 Current Focus

We are currently focused on **two parallel tracks** (SCRUM-6 & SCRUM-9):

| Track | JIRA | Focus | Status |
|-------|------|-------|--------|
| 🖌️ **Look & Style** | SCRUM-6 | Research joss paper cartoon styles & visual elements | ✅ Style Locked (2026-09-24) |
| 📱 **Flow & UX** | SCRUM-9 | Map core user flow & create wireframes | ✅ **Closed (S14)** — 43 boards signed off; remaining design rides SCRUM-28 ✅ · 29 ✅ · 31 · 33 · 34 · 35 · 36 · 37 · 38 |

**Goal**: Get a feel of the **look, flow, and style** of the app *before* diving into technical implementation.

---

## 📂 Board Contents

### Research Documents
| File | Description | Status |
|------|-------------|--------|
| [[01-joss-paper-styles]] | Traditional joss paper designs, colors, motifs & cartoon style references | ✅ Style Locked (2026-09-24) |
| [[02-user-flow-wireframes]] | Core user flow, screen mapping & wireframe sketches | 🔄 Clickable HTML prototype built (`/prototype`) — v2 adds the ancestral altar (tablets + add-tablet), car offering & in-fire toss · **Penpot (S10–12): 26 boards — core loop, splash/store/collection, ancestor sheet + altar states, EN + 中文, wired** |
| [[03-ai-design-tools]] | AI tools for image generation & design (pricing + capability comparison) | 🟡 Partly — design tool settled (**Penpot**, MCP-wired — Session 9); **runtime** cartoonization still TBD |
| [[04-ar-app-patterns]] | AR app design inspiration (Pokémon GO, Duolingo, etc.) | ✅ Draft complete — contains the key MVP call: *non-AR AR first* |
| [[05-concept-to-mvp-gap-analysis]] | Concept vs prototype vs real MVP: every fake, every missing feature, and the decisions architecture must close | ✅ Complete (Session 8) — the Session-9 brief |
| [[06-tech-stack-options]] | Tech stack options for SCRUM-10 — Fedora 44 + Cline + low-cost + cross-platform constraints, 4 options compared, AI pipeline research | ✅ Decided (S16) — **Option A (Expo/RN + Supabase + hosted AI) leaned**, iOS deferred, spike approved, hosted APIs day one |
| [[07-system-architecture]] | System architecture — service boundaries, the capture → cartoonize → burn → award → league API sketch, and the full data model (ledger, cohorts, quotas, grid cells) | ✅ v2 (Session 17) — **authoritative for the locked stack (ADR-001)** |
| [[ADRs/README\|ADRs]] | Architecture decision records — the nine decisions from [[05-concept-to-mvp-gap-analysis]] §6; **ADR-001 locks Option A** (Expo/RN + Supabase + hosted AI) · **ADR-003 locks the AR mode** (non-AR AR) | 🔄 **5 accepted (ADR-001 · 002 · 003 · 005 · 007)** · open: ADR-004 · 006 · 008 |
| [[08-style-d-spike-plan]] | Style-D spike — fal.ai candidate + pricing survey (2 paths, 15 endpoints priced), budget math vs US$10–20, test matrix | ✅ **Closed (S18)** — 133 runs ≈ US$4.49; ADR-002 accepted (Path C) |
| [[09-economy-quick-check]] | Can ad revenue fund the pipeline? — unit economics vs published eCPM benchmarks, break-even identity, exposure-level scenarios | ✅ **Closed (S18)** — derivation + §7.7 price lock |
| [[10-economy-spec]] | **SCRUM-18 deliverable** — economy, quota & AI-cost model: pricing, wallets, burn-limit rule (UX copy + backend), ceilings, stop rule | ✅ **Complete (S18)** — inputs locked at $1.55/1,000 · feeds ADR-006/008 |
| [[11-integrity-posture]] | Trust posture — honest client + caps vs server verification (ADR-005): caps 1,650/burn · 49,500/day · 6/min rate limits | ✅ **Complete (S19)** — ADR-005 accepted |
| [[12-security-and-legal-scoping]] | Security & legal/IP scoping — PDPA baseline + GDPR design target · **§B.7 Play fee vs the locked floor** · model-terms reads | ✅ **Complete (S19)** — long-tail tracked as SCRUM-43 |
| [[13-privacy-and-retention]] | Privacy & retention — PII inventory · windowed retention (raw photo 7 d) · consent copy N1–N6 · one-tap delete runbook | ✅ **Complete (S19)** — ADR-007 accepted |
| [[14-nfr-device-and-performance-targets]] | NFRs — device floor **Tier F (3 GB / Android 11 / Go-class)** · N1–N12 + asset budget · the frame/thermal/battery gate the AR spike tests | ✅ **Complete (S19)** — SCRUM-20 |
| [[15-clan-model-and-book-of-tributes]] | Clan model & Book of Tributes — roles ladder · create/join/invite · shared ancestors (clan-owned, no personal altar) · EN/ZH copy C1–C17 | ✅ **Complete (S23)** — SCRUM-22 · feeds SCRUM-46/47/48 |
| [[16-cultural-consultation-and-ritual-review]] | Cultural consultation & ritual review — advisor list · bilingual 10-question sheet · pre-decided change policy · outcome template | ✅ **Complete (S24)** — SCRUM-24 (planning; execution → SCRUM-49) |
| [[17-ar-fire-spike-plan]] | **SCRUM-8 deliverable** — the AR-fire proof-of-concept plan: fire over a live camera on the Tier F floor device, gated by N3/N4/N10 + the aim bands; paired with [[ADRs/ADR-003-non-ar-ar-mvp-ar-framework\|ADR-003]] | 📋 **Planned (S26)** — execution deferred to repo+CI (SCRUM-15) + the floor device |
| [[18-mvp-scope-and-timeline]] | **SCRUM-14 deliverable** — MVP scope (12 essentials vs deferred) · gates + dependency map · effort estimates · **M0–M5 timeline** · 12-risk register · T1–T4 testing plan; files the missing build tickets **SCRUM-53/54/55** | ✅ **Complete (S27)** — SCRUM-14 → Done (planning) |

---


## 🧭 Design Principles (Draft)

These principles guide all design decisions for the app:

1. **Respectful First** - Cultural sensitivity is non-negotiable. The app honors tradition, it doesn't mock it.
2. **Simple for 40-50s** - Large touch targets, clear typography, minimal cognitive load. No twitch-reflex mechanics.
3. **Warm & Festive** - Gold, red, and warm tones. Feel of a temple festival, not a cold tech product.
4. **Rewarding, Not Punishing** - Progression should feel like honoring, not grinding.
5. **Family Legacy Feel** - The app should feel like something you'd want to pass down.

---

## 🔗 Related Documents

- [[next-ai-context]] - Context handoff for AI sessions
- [[project-summary]] - Full project overview & decisions
- [[project-costs]] - 💰 Project cost tracker (all costs in SGD; Mastercard-rate conversion rule for future AI) — created 2026-09-25
- [[brainstorming-session-1]] - Original brainstorming notes
- [[follow-up-items]] - Action items tracker

---

## 📅 Session Log

| Date | Session | Focus | Outcome |
|------|---------|-------|---------|
| 2026-09-22 | 1 | Ideation | Core concept, MVP features, monetization decided |
| 2026-09-23 | 2 | Design Research Kickoff | Created concept board, started SCRUM-6 & SCRUM-9 |
| 2026-09-24 | 3 | "Feel the App" | Style locked (low-poly 3D × ink brush); clickable HTML prototype of the core loop built in `/prototype` |
| 2026-09-24 | 4 | Prototype review & iteration | Offering changed to a **car**; home became an **ancestral altar** (tablets + tappable add-tablet slot); object identity decided (**user's actual object, cartoonized**); toss now **curves and lands in the fire** |
| 2026-09-24 | 5 | Car fidelity A/B/C/D | Built `prototype/fidelity-test.html` — the same car at 4 fidelity levels (33 / 19 / 12 / 19 faces, each split body+wheel) with a squint test + blink comparator, to answer *how much real shape must survive cartoonization*. **Answer: a mix, not a level** — the user asked for *B's body with C's wheels*, built as **variant D (19 faces = 15 body + 4 wheel)**, now the cartoonization target for the first real AI experiment |

| 2026-09-24 | 6 | Orthographic 3D rebuild + port to the screens | The fidelity test's car is no longer flat SVG: it is a **low-poly 3D mesh** projected through a fixed **orthographic camera** (no perspective), built by `prototype/tools/gen-car-3d.js`; the reference is now a **photoreal smooth render of that same mesh** instead of a flat cartoon. Every variant is the *same mesh* at a different Douglas-Peucker tolerance (A 56 / B 37 / C 19 / D 37 rendered faces), so silhouette drift is measured (0.8 / 2.7 / 5.6 units) instead of eyeballed. D unchanged in intent — B's body, C's wheels — and now machine-verified as B's body faces verbatim. **Then `index.html` was ported to the same mesh** (v3): the **capture viewfinder and the comparator's "before" half now show a real photograph** of a car (a Commons CC BY-SA placeholder, credited in `assets/CREDITS.md`), while the "after" half and the tossed offering show **D** — generated, with the generator owning each offering stage's viewBox + `<use>`. **Review caught that the 3/4 view had wheels on one side only**: the far pair is now modelled as one disc each (visible through the arch tunnels and below the far rocker), which took D to 37 faces (31 body + 6 wheel) and forced the validator's body/wheel split to be re-founded on *roundness*. Three rendering bugs were found and fixed on the way (a NaN grille fill; the generated block accidentally sitting inside an HTML comment so nothing drew at all; the missing far wheels) — all now covered by a new browser-level `tools/render-check.js` |

---

| 2026-09-24 | 7 | The user builds the shrine | The altar ships **empty** and the user adds their own ancestors (姓氏 + 名字 + 称谓 chips, 姓＋氏 fallback, 4 tablets, tap to edit/remove); three render faults found by eye and fixed (double-positioned ＋, baselines in the wrong space, the censer eating taps) and now machine-guarded — 133 markup + 20 render checks |
| 2026-09-24 | 8 | The throw has aim (+ the gap analysis) | The throw is graded: four bands measured off the fire's own artwork (正中 ±14.55 ×2.0 · 虔誠 ±39.40 ×1.5 · 擦邊 ±96.97 ×1.0 · 偏失 ×0) paying **1,650 / 1,250 / 850 / 0**, two unit bugs fixed, new tool `prototype/tools/aim-check.js` (16 checks, fault-tested). Then the reflection: [[05-concept-to-mvp-gap-analysis]] — what the prototype settles vs what the real MVP must replace |
| 2026-09-24 | 9 | Parked decisions closed + tooling | **Throw miss → rethrow allowed, but never the top tier (正中)** · **Home gives the altar more screen** and shrinks supporting elements (iterate later) · tablet naming **confirmed as-is**. Design tooling switched **Figma → Penpot** (Figma's MCP kept blocking AI-assisted work; Penpot's official MCP server is now wired in) |
| 2026-09-24 | 10 | Penpot: the tutorial, in two languages | Core loop rebuilt in Penpot as the new-user tutorial (6 boards, flow wired; D-mesh car + vector icons); **EN row + 中文 row** with the **EN \| 中文 switcher** on Home (verified both ways); full-app design backlog filed (**SCRUM-26…35**) |
| 2026-09-25 | 11 | The app frame starts — splash, store, collection | Splash/loading designed + wired; **Store** (featured bundle, 4 cards, owned state, placeholder pricing); **Collection** (stats strip, item grid, empty-slot invitation); **location-value decided HIDDEN** (only the Reward receipt line); the tablets became a **carousel** (`1b`, chevrons, ＋ as last position); Home's temple **starts unfurnished** — frame/backdrop/lattice become purchasable decorations |
| 2026-09-25 | 12 | The ancestor sheet + the altar's states | `EN/ZH · 1s` add sheet (姓氏 ＊ · 名字（选填） · 称谓 chips · live preview · 安放) · `1s2` edit (Place + Remove ghost) · `1c` full altar (no ＋, "this altar is full", forward chevron dimmed); **the ＋ slot is live**, carousel chevron → ＋, centre tablet → edit; invisible ≥44 px touch targets; the half-translated `ZH · 1b` repaired; page **26 boards**, version-saved |
| 2026-09-25 | 13 | The offering icons redrawn | Review feedback: too small + wrong shapes. **Cash Bundle → joss-paper stack** (foil square + tie), **Gold Bar → an LBMA-tapered block** (trapezoidal, wider at the base — reshaped in 13b), **House → big modern house**, **Phone → a real smartphone**, **wealth bundle = the four composed into one**; store cards 72 px / collection 78 px / featured 220×106; **store economy: base value = 1.2 × redemption price** (400/480 · 600/720 · 800/960 · bundle 2,000/2,400 — 13d) |
| 2026-09-25 | 14 | The boot flow: onboarding, permissions, first-run Home | `EN/ZH · 0b` onboarding (panel 1: the **buried → burned → now** triptych, headline, dots, Skip/Next) · `0b2` permissions (Camera + Location cards, Allow pills, Continue/Not now, denied-pathway promise) · `1a` **first-run Home** (gold halo + dashed ring on the empty slot, callout pill "Start here — place your first tablet"); **first-run loop closed** Splash → Onboarding → Permissions → Home → ＋ → sheet; boot row re-ordered, Home column shifted · **14b**: boot boards moved off the Splash's dark onto paper (**only the Splash is dark**) and the triptych re-aligned on ink · **14c**: lanterns replaced by the new **app mark** (AR brackets over the joss sheet) + `ICON` spec board (tile variants + 64/32/24 px ladder) · **14d**: the **mark replaces the "Joss Paper AR" wordmark labels** in the headers of the 12 Home-family boards; last lanterns off `0b2` · **14e**: header mark aligned to the 20 px margin (44 px ink), and the **plaque above the tablet removed** — that space reserved for purchasable customization · **14f**: **league card → League-tab subtext (#4)**, CTA lowered, **customization band** provisioned at y 696 · **14g**: CTA pinned to the **bottom**; the band replaced by **the whole temple scene as the customizable zone** (dashed, behind the art — everything inside replaceable) · **14h**: **decoration store** (`7b`, EN/ZH) — 春联 · 鍾馗像 · 门神 · 灯笼 + 新春套装, behind a new **Offerings \| Decorations** switcher; **SCRUM-36** filed for the customization system · **14i**: **decorated Home mockups** (`1d` couplets+lanterns · `1e` full festive set) + the placement scheme · **14j**: the **6-slot decoration grid** (top · side · background) + `1f` customize view (EN/ZH); `1d`/`1e` rebuilt on the slots (background print behind the tablet) · **14k**: the **one-set-per-category rule** + the `1f2` picker (choose 春联 or 门神; both stay owned) |
| 2026-09-25 | 15 | The auth block: login + create account | **SCRUM-28 + SCRUM-29 closed** — 10 boards each (`0c`…`0c5` / `0d`…`0d5`, EN + 中文), wired end-to-end (Splash → Login → Sign-up → ancestor sheet → first-run Home); title per PM *"Sign in or register new account"*; QA pass (28 recolors · 96 reflows · 4 stale-glyph titles recreated); **board count → 63**; sprint fixes (SCRUM-6/9 closed, 17…25 added → 21 issues) |
| 2026-09-25 | 16 | Tech stack researched & decided (SCRUM-10 research phase) | Constraints locked (**Fedora 44 · Cline · low cost · cross-platform · style-D pipeline**) → **[[06-tech-stack-options]]** (4 options compared, sources); decisions: **Option A (Expo/RN) leaned · iOS deferred · style-D spike US$10–20 approved · hosted APIs day one**; AR-wrapper concern (SceneView RN = alpha) ruled non-blocking; **[[project-costs]]** started (SGD @ Mastercard rate, ClinePass US$2.12 logged) + dated billing action items **SCRUM-39/40/41**; Circleback MCP verified (read-only) |
| 2026-09-26 | 17 | System architecture drafted (SCRUM-10 build-out) | Stakeholder picked **services + data model before libraries** → **[[07-system-architecture]] v1**: system diagram, 11 service boundaries, the capture → cartoonize → burn → award → league API sketch (idempotent, offline-queue safe), ~20-table data model (append-only 2-currency ledger, quotas = AI-cost control, ~4-block grid cells with no location trails, cohorts + weekly rolls, Book of Tributes); 7 open questions routed to SCRUM-11/18/19/20/21/22/41; progress comment on SCRUM-10 · *same day:* **ADR-001 accepted** · **style-D spike executed** (recipe locked round 6, 77 outputs by engine, spend → SCRUM-41) |
| 2026-09-26 | 18 | **Path C → ADR-002 · economy → SCRUM-18 done** | **PM proposed Path C (describe-then-generate)** → probe + prompt v3 (top-down shader · source colours · transparent glass) + wider probe on all 13 Track-A inputs → scorecard [[spike/results/path-C/EVALUATION]] (**13/13 after the correction loop**) → **PM: "PATH C is the way forward" → [[ADRs/ADR-002-path-c-describe-then-generate\|ADR-002]] ✅ accepted** (moondream2 → nano-2 t2i ≈ $0.10/pic; edit recipe = fallback; 07 → **v2.2**) · **economy thread**: [[09-economy-quick-check]] (ad benchmarks · break-even identity) → points-gated photos → back-calc → **locked: $1.55/1,000 credits + sign-in grants + ad-gated photo** → **[[10-economy-spec]] written, SCRUM-18 ✅ Done** (quota rule + EN/ZH UX copy + ceilings; 07 → **v2.3, three currencies**) · **SCRUM-41 reconciled** (US$4.49/133 runs = est S$5.73, under cap; awaiting fal invoice) |

---

*Last updated: 2026-10-03 (Session 27 — **SCRUM-14 closed (planning)**: [[AppDesignConceptBoard/18-mvp-scope-and-timeline|doc 18]] = MVP scope (12 essentials vs deferred) · gates G1–G6 + dependency map · effort estimates in focused sessions · **M0–M5 timeline** (beta ≈ Feb 2027; public ≈ Qingming 2027) · 12-risk register · T1–T4 testing plan. Filed the three tickets the critical path was missing: **SCRUM-53** (build the vertical slice) · **SCRUM-54** (Supabase backend of record) · **SCRUM-55** (ADR-004/006/008).)*
*Last updated: 2026-10-02 (Session 26 — **SCRUM-8 closed (planning)**: [[AppDesignConceptBoard/ADRs/ADR-003-non-ar-ar-mvp-ar-framework|ADR-003]] accepted — the MVP's "AR" is *non-AR AR* (camera preview + fixed overlay; ARKit / ARCore-direct / Unity rejected), true AR deferred to four exit ramps; [[AppDesignConceptBoard/17-ar-fire-spike-plan|doc 17]] = the AR-fire PoC plan, execution deferred to the repo+CI milestone + the Tier F floor device.)*
*Last updated: 2026-10-02 (Session 25 — **SCRUM-48 clan boards built in Penpot**: 22 new boards `EN · 0e Clan` + `ZH · 0e 宗族` (fork · create ×3 · join ×4 · invite & share · 2 states), both rows wired, boot hand-off `0d3` → fork rewired, `1s` ancestor sheet reused unmodified → **Done (PM-marked)** · rev 2 after PM review (realistic QR · clan logo centred · duplicate-name prompt removed). The per-session table above is maintained only to S18 — see [[next-ai-context]] for the full session log.)*
*Last updated: 2026-09-26 (Session 18 — Path C locked via ADR-002, economy v1 locked + SCRUM-18 spec done, SCRUM-41 reconciled; spike closed at US$4.49/133 runs)*
*Last updated: 2026-09-25 (**Sessions 15+16 wrap**) — auth screens signed off (S15, boards → 63) · tech-stack research & decisions + cost tracker + billing action items (S16); [[06-tech-stack-options]] + [[project-costs]] added*
