# 14 · NFRs — device floor & performance targets — SCRUM-20

**Date:** 2026-09-27 (Session 19) · **Jira:** SCRUM-20 · **Status:** ✅ complete
**Depends on:** [[ADRs/ADR-001-option-a-expo-rn-supabase-hosted-ai|ADR-001]] (non-AR AR · Android-first) · [[05-concept-to-mvp-gap-analysis]] §7.4 (risk #4) · [[10-economy-spec]] (latency/stop-rules) · [[11-integrity-posture]] §5 (rate-limit validation) · [[13-privacy-and-retention]] (§2 windows referenced below)
**Feeds:** SCRUM-15 (the floor device becomes the CI test device) · repo + CI milestone · SCRUM-17 (slice acceptance) · store listing (compatibility)

> **PM direction (2026-09-27):** *"not flagship-level hardware — we want to run on lower-end phones to reach wider audiences, especially rural ones."* This doc turns that into a **numbered floor** every later choice is measured against. The MVP's **non-AR AR** decision (ADR-003) is what makes this achievable — no ARCore, no world tracking, no GPU-class requirement.

**Grounding (verified today):** Statcounter, worldwide mobile Android, **Aug 2026** — Android 16 26.0% · 15 17.2% · 13 14.9% · 14 13.0% · 12 10.1% · 11 8.2% · **≤ Android 11 ≈ 19%** (older tail ≈ 11%). Android Go (since 8.1; Android 16 Go current) is built for **≤ 4GB RAM** devices with data-saver defaults — exactly the rural class we're targeting. **Supporting Android ≤ 11 isn't nostalgia; it's ~1 in 5 phones.**

---

## 1 · Device matrix

| Tier | Spec | Support level | Role |
|---|---|---|---|
| **F — floor (tested)** | **Android Go-class · 3GB RAM / 32GB · Android 11+ · 720p** | **guaranteed** — every NFR below must pass here | **the test device** (buys the SCRUM-15 CI plan its named phone) |
| **M — mid (primary)** | 4–6GB · Android 13+ | guaranteed — where most users are | daily-driver target |
| **H — high** | 6GB+ / recent SoC | no special work needed | — |
| **L — legacy** | Android 7–10 (minSdk 24), any RAM | **best-effort**: must install and not crash; not in the test matrix | reaches the rural tail cheaply |
| **< 3GB RAM** | e.g. 2GB hand-me-downs | **untested** — allowed to install, no guarantee; revisit with opt-in telemetry (SCRUM-25) | explicit non-goal today |

**Floor device shortlist (PM buys one, ~S$100–150 — becomes the named test device):**
1. **Samsung Galaxy A05s** (4GB/64GB, Android 14 at launch) — the safe pick, easy to buy in SG/SEA
2. **Xiaomi Redmi A5** (2025, Android Go class, 3–4GB) — closest to the true rural/Go profile
3. **Nokia C-series** (3GB) — budget-est, Go-flavoured

*Decision: pick 1 of 3 at the repo+CI milestone; record the exact model in this table and in SCRUM-15. Sizing rule of thumb: **if it runs Android Go well, it runs our app.***

**Min/target OS:** `minSdk 24` (Android 7 — free with Expo, no test obligation) · `targetSdk` = latest as Play requires at submission (compatibility is Play-enforced, not ours to age).

---

## 2 · The NFR table — target · measured how · what if we miss

| # | NFR | Target | Measured by | If missed |
|---|---|---|---|---|
| N1 | **Device floor** | Tier F passes every row below; legacy installs without crashing | matrix runs on the named device | never raise the floor silently — a floor change is an ADR-level decision (reach vs cost) |
| N2 | **Cold start** | **≤ 5 s** to shrine (Tier F, cold) · camera usable **≤ 7 s** | timed launch metric on device (ADB) in the per-behaviour device check | defer non-critical init (fonts, cache warm, analytics), lazy screens, trim JS bundle |
| N3 | **Throw frame rate & input** | **≥ 30 fps sustained on Tier F** · 60 fps on Tier M · input→render **≤ 100 ms** | per-frame counter over a 2-min ritual sim; **the aim bands (±14.55/±39.40/±96.97) are the acceptance test** — port `aim-check.js` to a native health check | drop overlay effects, animate on the UI thread (worklet), reduce fire sprite complexity — bands must not shift |
| N4 | **Thermal (one ritual)** | **No throttling within 5 min** continuous camera+overlay: frame time degradation **≤ 20%** | device thermal zones + fps-delta during the sim | cap preview at 720p, cut frame callbacks, dim overlay — *never* ship "hot phone" UX to this audience |
| N5 | **AI latency tail** | p50 ≈ **12.6 s** (measured, ADR-002) · **p95 ≤ 30 s** incl. 1 retry · tail UX = queue copy ("the shrine is receiving many offerings…") | `cartoonize_jobs.latency_ms` percentiles in production | prompt/validation tuning; extend loading-ritual copy; budget UI prefetch so the wait stays a ritual |
| N6 | **Offline (rural-first)** | **Queue persists across days**: capture queued offline → replays on reconnect; browse cached shrine; **burn replays idempotently** (same `idempotency_key` → same receipt, no double award) | airplane-mode script: queue → 48h gap → reconnect → verify single award | fix queue durability (SQLite, not memory) — this is a requirement, not a nicety (07 §7 **Q1 answered: cross-day queue**) |
| N7 | **Network floor** | Functional on **≈ 200 kbps / 400 ms RTT** (2G-EDGE-class): capture upload **≤ 300 KB**, sprite download **≤ 150 KB**, no video anywhere | network shaping in the test harness (throttle + RTT) | shrink JPEG quality/dimensions, sprite res, add backoff — payloads are a budget, not an accident |
| N8 | **Install & storage** | Play download (AAB) **≤ 40 MB** · installed footprint **≤ 120 MB** · app cache **≤ 64 MB** and **evictable** | `adb shell` sizes + Play pre-launch report | bundled art → on-demand fetch; evict sprite cache LRU; check every asset against §3 budget |
| N9 | **Memory** | Peak RSS **≤ 350 MB**; **no OOM** decoding captures on Tier F — downsample **≤ 2048 px** before decode, recycle bitmaps | profiler on the floor device during capture→burn flow | downsample harder, free bitmaps early, cap parallel decodes — OOM on a 3GB phone is a P0 |
| N10 | **Battery** | **≤ 8 %** per 10-min ritual session (camera continuous, Tier F) | device battery deltas over scripted sessions (BatteryHistorian where available) | lower preview fps/resolution; shorten camera-open windows; review wakelocks |
| N11 | **Accessibility** (doc 04) | system font scaling honoured to **×1.5** · text contrast **≥ 4.5:1** (and legible in sunlight — the outdoor ritual) · **haptics available as primary feedback** (public/silent places) | automated contrast checks + manual pass on Tier F | affected screens get a pass before beta — this audience *is* the accessibility case (40–50s eyes) |
| N12 | **Cost/active user** (ref) | ≤ **$3.64/user/month** ceiling; global stop-rule queues, never fails | `cartoonize_jobs.cost_micros` + economy dashboards | existing stop-rules (economy §4/§6) |

---

## 3 · Asset budget (the rule that keeps N2/N8/N9 true)

| Asset | Budget |
|---|---|
| Bundled app art (icons, fire sprite, fonts) | **≤ 8 MB total** — everything else fetched |
| Fire overlay animation | sprite sheet **≤ 400 KB**, ≤ 30 fps redraw on Tier F |
| Capture upload | **≤ 300 KB** (bounded long edge + JPEG q — 07 §4.1) |
| Styled sprite download | **≤ 150 KB** (transparent PNG at display size, not 2K) |
| Store/catalogue icons | on-demand + LRU cache inside the 64 MB ceiling |
| Fonts | 1 latin + 1 CJK subset — **subset, don't ship full CJK** (a full CJK font alone blows N8) |

---

## 4 · Decisions this doc closes

1. **07 §7 Q1 (offline queue):** **session-independent, persists across days** — local SQLite, replay idempotently on launch; `idempotency_key` kept until acked server-side (the unique constraint is permanent anyway — 11 §4). Rural connectivity made this the default answer.
2. **Floor = Tier F (3GB / Android 11 / Go-class)**, legacy L = install-only; **below 3GB = untested non-goal** (revisit with telemetry).
3. **The named floor device** (shortlist §1) → SCRUM-15's CI device. *Buying one is a ~S$100–150 decision for the PM at the repo+CI milestone.*
4. **30 fps is the floor, 60 fps the target** — honest for RN on low-end; the *aim bands*, not fps vanity, are the acceptance test.

## 5 · Open / deferred

| # | Item | Owner |
|---|---|---|
| 1 | Rate-limit numbers (11 §5) — validate against real play patterns on the floor device | alpha telemetry |
| 2 | < 3GB RAM tier — decide with opt-in telemetry data | post-alpha · SCRUM-25 |
| 3 | iOS floor (later): an equivalent Tier F iPad/iPhone for the iOS-add milestone | pre-iOS (ADR-001) |
| 4 | Data-saver mode (explicit toggle: "prepare offerings on Wi-Fi") — only if N7 shaping shows pain | post-alpha |
| 5 | One-device-check-per-behaviour harness design (ports `aim-check`/`render-check` habits) | SCRUM-15 / repo+CI |

---

*Created 2026-09-27 (Session 19) — SCRUM-20 deliverable: NFR table (N1–N12: target · measured · if-missed) + the floor device shortlist (Tier F, 3GB/Android 11/Go-class). Grounding: Statcounter Aug 2026 (≤ Android 11 ≈ 19% worldwide) · Android Go specs. PM direction: low-end/rural first — non-AR AR (ADR-003) is what makes the floor achievable.*
