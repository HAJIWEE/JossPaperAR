# 📋 Follow-Up Items - Joss Paper AR

> **Open work only.** Completed items, superseded sections and the dated change log moved to **[[completed-work-archive]]** (2026-10-02, S26; reconciled again **2026-10-03, S27** — two stale lines claiming a live colour hold on `SCRUM-42`/`SCRUM-33` and an open "close `SCRUM-45`" removed; both are **Done** in Jira). Current state → **[[next-ai-context]]**.

---

## 🎯 Immediate Actions (Next 1–2 Weeks)

### 🔴 On the critical path

> **Sequenced by [[AppDesignConceptBoard/18-mvp-scope-and-timeline|doc 18]] (S27).** The scope, dependency map, estimates, milestones, risks and testing plan are locked there — this file tracks only the *actions*.

- [x] **`SCRUM-15` — repo + CI + dev environment** ✅ **Done 2026-10-02** — GitHub repo + CI (design-system + app checks, all green) · Expo SDK 57 scaffolded **single-repo** · README + CONTRIBUTING + `.env.example` · MIT licence · PRs #1–#3. Unblocked: `SCRUM-46`, `SCRUM-50`, `SCRUM-51`.
- [x] **`SCRUM-57` — repo bootstrap (PR-1)** ✅ **Done 2026-10-03** — Expo Router shell · RN theme bridge (with the parity guard) · domain modules (aim bands · award maths · catalogue · quota · currencies) · **the T2 acceptance test** (45 + 36 checks, zero-dependency, fault-tested) · CI + docs. Merged as **PR #9**.
- [ ] **`SCRUM-56` — PM provisioning** ⏰ — ✅ **done:** Supabase project `yercgevebxvtzkgctfai` (`ap-southeast-1`, Postgres 17.11) · CLI login **and link** · package id `app.josspaperar` · region · **fal.ai key verified working** (API scope, 72 chars) · ✅ **anonymous sign-ins enabled and proven** (real sign-in → 200, `is_anonymous`, session; with that JWT the catalogue reads and the ledger refuses writes). **Still open:** device/emulator (`SCRUM-52`) · invite domain (#6) · EAS login · GH secrets · Play Console (M4). *(→ [[AppDesignConceptBoard/19-build-plan-services-api-environments|doc 19]] §6.2)*
- [x] **`SCRUM-41` — record the style-D spike spend in `project-costs.md`** ✅ **done 2026-10-05** — the PM read the **Mastercard rate off the statement (USD→SGD 1.2808)**; every fal.ai row is re-based off its placeholder at the real rate: spike **US$4.49 = S$5.75** · PR-3 **≈US$0.40 = S$0.51** · SCRUM-59 **≈US$0.09 = S$0.12** → **fal total ≈ S$6.38 / US$4.98**. **NO OVERRUN** — 22% of the approved US$10–20 used, so **no top-up needed**; keep ~US$10 in view for `SCRUM-53`. ⚠ *The September **ClinePass** row (US$2.12) is a different transaction date and keeps its 1.2771 placeholder until the statement settles it at `SCRUM-39` (2026-10-22).*
- [ ] **PR-3's open follow-ups** — the *closed* ones (`SCRUM-54` itself, all four decisions, the `SCRUM-59` build, the unsigned-commit question, the `rls_enabled_no_policy` note and the signed-URL gotcha) moved to **[[completed-work-archive]] §5**. **These are what remains** — and ⚠️ **the two ⚠️ items below are the ones PR-4 must read before its first write path lands.**
  - [ ] 🔐 **`/tmp/keys.env`'s `SECRET` is ROTATED and stale** — measured 2026-10-04: `sb_secret_…` answers **401 `Invalid API key`** while the legacy service_role JWT (`SVC`) still works. `exercise-budget.sh` now tries both names and **proves the credential before mutating anything** (a stale key silently skipped the budget write and cost US$0.09 — doc 19 §12.5 finding 2), but the local key file needs refreshing. *(A PM action: rotation or a new secret key in `/tmp/keys.env`.)*
  - [ ] ⚠️ **A FAILED generation cannot be retried for the SAME capture** — `unique(capture_id)` is the cost guarantee (one job per capture, doc 07 §4.2), and `request_cartoonize` treats any non-`queued` job as a paid replay. So a retry is a **NEW capture**. **PR-4's UX must own this**: on `status: failed`, offer a re-capture, never a re-request of the same offering.
  - [ ] ⚠️ **PR-4 must handle the QUEUE state as a normal outcome, not an error** — `cartoonize-orchestrator` can return **`200 {code:'shrine_busy', queued:true}`** when the day's AI budget is spent (the stop-rule above): show `ritual_busy` from `src/lib/i18n.ts` ("the shrine is receiving many offerings…") and keep the offering — the *next* request for that capture proceeds on its own once the budget opens.
  - [ ] 🟡 **`crons`: `pg_cron` is still NOT enabled** — deliberately deferred with `weekly-roll`'s real body to **SCRUM-11** (doc 19 §4.3 says enable it in a migration; enabling an unused scheduler is noise). The stub is honest and gated by the secret key.
  - [ ] 🟡 **The league has no spec** — `get_league_board` returns the caller's own weekly tribute + an empty board with a `note`; `weekly-roll` reports `status: 'stub'`. Both are labelled stubs, not fake rankings.
  - [ ] 🟡 **doc 10 §4's funding model is HALF enforced — and the enforced half is now the one that BILLS** — **`SCRUM-59` option B ✅ built 2026-10-04**: the daily cap *and* the global AI-budget stop-rule (queue, never fail) are live. The **wallet** half stays deferred: the 150-credit fee · the 2,000-credit starter grant · the 15/month cap · the `grant|credits|ad` split need the cash shop and a `sign_in_grants` table that do not exist → `SCRUM-18` / `ADR-006`. **Nothing charges a player anything yet — what is enforced is the ceiling, not the price.**
  - [ ] 🟡 **`delete_my_data` does not remove Storage objects or the `auth.users` row** — the recipe returns the prefixes to purge and says so in the receipt; the Storage API + Admin API calls need a service-role path (an Edge Function or a scripted runbook step). **SCRUM-33.**
  - [ ] 🟡 **The 30-day offline replay window is PROVISIONAL** — doc 11 §9 item 4 still owns the real number (SCRUM-20). The queue never silently drops a burn: it stops retrying and hands the decision to the UI.
  - [ ] 🟡 **`quotas` has one counter, not the per-kind columns doc 10 §7 promises** — the 10/20 split is derived from `burns`. Either doc 10 §7 or the schema should move. **SCRUM-18.**
  - [ ] 🟡 **doc 07 §4.3 names `grid_cells` for new-ground, but only `cell_burns` has identity** — the code reads `cell_burns`; doc 07's line should be corrected in the next architecture tidy.
  - [ ] 🟡 **⚠️ PR-4 RULE: the client must generate the capture id BEFORE the upload** — `captures` deliberately has no UPDATE policy, so `storage_path` cannot be filled in later. Order: generate the id → upload to `captures/{uid}/{id}.jpg` → insert the row. (Found by an exercise that patched the path and watched the orchestrator 404.)

- [ ] **`SCRUM-52` — Buy the Tier F floor device** — 1 of 3 (Galaxy A05s · Redmi A5 · Nokia C-series, ~S$100–150) → becomes the named CI phone (doc 14 §1) · blocks `SCRUM-51` + the device checks in `SCRUM-53`. **A PM action.**
- [ ] **`SCRUM-53` — Build the MVP vertical slice** (SCRUM-17 execution) — camera → cartoonize → burn → award → persist on the floor device; distinct from SCRUM-17, which only *scoped* it (Done). Acceptance test = the **four aim bands**.
- [x] **`SCRUM-55` — Write ADR-004 + ADR-006 + ADR-008** ✅ **Done 2026-10-05 (S29)** — all three written *from* the specs that had already decided them. **ADR-004** (anonymous identity first, optional account later) and **ADR-006** (daily quota · cost per burn · **no** cooldown · hard global stop-rule) **Accepted**. **ADR-008** (ad posture) was drafted as 🟡 Proposed and then **Accepted the same day** once the PM answered A–D on **`SCRUM-62`**: **A3** rewarded photo · **B** caps 2 on app start / 3 in a row post-ritual · **C** Singapore practice now, modelled as data for other diasporas · **D** strong NO (gambling, loans, alcohol). ⚠️ The **ad SDK choice** stays gated on **`SCRUM-63`** (the D category/compliance research) — but the **MVP has no ads at all**, so this does not block PR-4. The register is guarded by **`npm run check:adrs`** (fault-tested red on 4 cases), so decided-but-unrecorded drift cannot return.

### 🏢 Business & compliance — register and run the Singapore sole proprietorship

> **Research done, sourced and dated → [[AppDesignConceptBoard/20-business-registration-and-compliance.md]]** (2026-10-05). Milestones filed as **`SCRUM-65`** (epic) + **`SCRUM-66`–`SCRUM-78`** (B1–B13). ⚠️ **The two traps:** the **D-U-N-S lead time** before the Play organization account can be verified (B11), and **outstanding MediSave blocking the ACRA renewal** (B10 → B12). ACRA + Play cost to complete the core: **S$115 + US$25 ≈ S$147**.

- [ ] **B1 `SCRUM-66`** — lock the business identity (registered name · address route · public legal name) — **blocks everything**
- [ ] **B2 `SCRUM-67`** — reserve the business name on Bizfile (**S$15**)
- [ ] **B3 `SCRUM-68`** — register the sole proprietorship (**S$100**) → **UEN** + Business Profile ⚠️ the free copy expires in **60 days**
- [ ] **B4 `SCRUM-69`** — Corppass + ACRA e-services access (required for every government transaction)
- [ ] **B5 `SCRUM-70`** — business bank account (Play payouts · IRAS + MediSave GIRO)
- [ ] **B6 `SCRUM-71`** — business email + phone + a live URL (Play publishes two of them)
- [ ] **B7 `SCRUM-72`** — PDPA: appoint the DPO, register it with PDPC, publish the contact, policy v1
- [ ] **B8 `SCRUM-73`** — licence/permit check (GoBusiness e-Adviser) → file the verdict
- [ ] **B9 `SCRUM-74`** — tax: myTax · records · **Form B by 18 Apr** · GST watch (**S$1M**)
- [ ] **B10 `SCRUM-75`** — MediSave / CPF self-employment arrangement ⚠️ **gates the renewal**
- [ ] **B11 `SCRUM-76`** — Google Play Console **organization** account (**D-U-N-S** · US$25 · verification) — un-defers doc 19 §4 #10
- [ ] **B12 `SCRUM-77`** — compliance calendar + the one-page runbook
- [ ] **B13 `SCRUM-78`** — decision: the incorporation trigger (deferred)

### 🖌️ Design — PM review & decisions
- [ ] **Whole-file visual review of the 47 boards** changed by the S21 contrast tranche — an eyeball that is still owed. *(Note: it no longer "releases a colour hold" — `SCRUM-42` and `SCRUM-33` are already **Done** in Jira since 30 Sep; the old hold wording is in the archive.)*
- [ ] **Save a named Penpot version** — Penpot UI → File → Version history (the plugin API has no version endpoint).
- [ ] **⚠️ Decision A** — Reward's *"Return to Shrine"* routes through the `5b` ad card but *"View League"* skips it. Should both exits pass it?
- [ ] **⚠️ Decision B** — a credits chip was added to both **signed-off** Capture boards (tap → cash shop); confirm the visual change.
- [ ] **Confirm the boot-flow wiring** — `0b2 permissions → 0b3 privacy notice → 1a`; the file's real wiring had `0b2 → 1a` (file beat ticket).
- [ ] 👁 **Re-check `EN · 3d` (Transform / failed) for the obscured icon** — S21's re-audit reports `clip 0` / `occl 14 (swatch-only)`, so only re-test if still visible.
- [ ] **Tap targets on Home for 40–50s hands** — `tools/render-check.js` measures a tablet at **32×83 px** on a 390 px screen (narrower than the 44 px touch guideline). Decision closed S9: **grow the tap area with an invisible rect rather than the artwork** (incl. tappable areas of unlabelled/unlit tablets — their hit area came out by accident). Execution still pending.

### 🕯️ Clan model & Book of Tributes — **spec ✅, build open**
- [ ] **`SCRUM-46` — clan build** (backend + frontend) — doc 15 §9 = the schema · §10 = open build items (Book window hide-vs-purge · anti-abuse rate limits).
- [ ] **`SCRUM-50` — QR invite**: generation · scanner · deep links (Relates `SCRUM-46` · `SCRUM-48`) — `clans.code` = one active **8-char re-rollable capability**; **QR payload = the invite deep link**; generation client-side; scanning via `expo-camera`. Architecture already written → 07 §4.6.
- [ ] **PM decisions still open (doc 15 §10)** — head-exit mechanic (promote-first proposed) · altar display at cap 10 (the art holds 4 tablets). *(ZH terminology ✅ locked at S25; `#suffix` removed → doc 15 v0.3.)*
- [ ] **`SCRUM-47`** (Low · backlog) — purchasable ancestor slots beyond the free cap.

### 🧧 Cultural consultation — parked
- [ ] **`SCRUM-49` (Low)** — run the consultation **once the app is functional**: live-app demo (+ §2 pack backup) → book the first conversation → run the 10 questions → fill §7 → feed §8.

### ♿ Accessibility — Penpot work ✅ done (`SCRUM-45` closed in Jira 2026-10-01), residuals open
- [ ] **Recolour the carousel chevron** — `#F0C75E` on cream in Penpot = **1.42, fails**; the prototype's passing value (11.45) was on a dark background and no longer counts.
- [ ] **Wire `contrast-check.js` / `responsive-check.js` into CI** once a build stylesheet exists — they report `skipped`, never `passed`, until one does.

### 🔬 Validation & research
- [ ] **Duolingo leaderboard mechanics** — the Tribute League's promotion/relegation model.
- [ ] **Identify potential beta testers** (family members, cultural practitioners).
- [ ] **Plan the user testing approach.**
- [ ] **Determine the cartoonization approach for the *real* build** — the style-D spike validated **Path C** (ADR-002), but variant D still needs shape-locking img2img at B's mesh tolerance *plus a per-region rule so the wheels stay round on all four corners* (a 3/4 view shows the far pair through the arch tunnels). That per-region rule is untested.
- [ ] ⚠️ *Likely obsolete* — **swap the placeholder car photo** in `prototype/assets/`; the prototype is retired, so this only matters if the fidelity page is reused.

---

## 📅 Medium-Term Actions (Next 1–2 Months)

### Technical development
- [ ] **Port the prototype's test habit to the native app** — machine-read verdicts, a fault-tested harness, one device check per behaviour (`aim-check.js` / `render-check.js` patterns).
- [ ] **Plan the core game loop implementation.**
- [ ] **Execute the vertical slice (`SCRUM-53`)** — SCRUM-17 wrote the acceptance criteria; the *build* is now SCRUM-53, gated by SCRUM-54 + the floor device. The slice = camera → cartoonize → burn → award → persist, end-to-end on a real device.
- [ ] **Run the AR-fire spike (`SCRUM-51`)** — blocked by the floor device; plan is [[AppDesignConceptBoard/17-ar-fire-spike-plan|doc 17]].
- [x] **Write `ADR-004` (identity) + `ADR-006` (burn-limit semantics) + `ADR-008` (ad posture)** ✅ **done 2026-10-05 (S29, SCRUM-55)** — [[AppDesignConceptBoard/ADRs/ADR-004-anonymous-identity-first-optional-account-later|ADR-004]] ✅ and [[AppDesignConceptBoard/ADRs/ADR-006-burn-limit-semantics-daily-quota-cost-per-burn|ADR-006]] ✅ **Accepted**; [[AppDesignConceptBoard/ADRs/ADR-008-advertising-posture-never-inside-the-ritual|ADR-008]] ✅ **Accepted 2026-10-05** on `SCRUM-62` (A3 · caps 2/3 · SG-for-now · D strong NO, detail → `SCRUM-63`). **All nine §6 decisions are now recorded and all eight ADRs are Accepted** — the register has no open row left, and `npm run check:adrs` keeps it that way.
- [x] **Milestones plan** ✅ **done 2026-10-03 (S27)** — [[AppDesignConceptBoard/18-mvp-scope-and-timeline|doc 18]] (M0–M5) closes the SCRUM-10 chain item and **is** the SCRUM-14 deliverable.

### Business planning
- [ ] **Research advertising platforms** suitable for family-oriented content → **ADR-008 ✅ accepted** (SCRUM-62); the *category* half is now researched (**SCRUM-63** → [[AppDesignConceptBoard/21-ad-category-denylist|doc 21]]); the *network* half **is** the SDK selection and stays open.
- [x] **`SCRUM-63` — the ad-category denylist** ✅ **researched 2026-10-05** — the five classes with a **Singapore basis per class** (gambling · loans · tobacco/vapes · Nutri-Grade "D" are **compelled**; **alcohol is our own stricter policy — no SG statute bans it, and Google *permits* it here**), the implementable taxonomy, what AdMob/AppLovin actually block (and their documented limits), and the three enforcement layers → [[AppDesignConceptBoard/21-ad-category-denylist|doc 21]]. **Now code, not prose:** `src/domain/adCategories.ts` + **`npm run check:ads`** (51 assertions, fault-tested, in CI).
- [ ] **`SCRUM-63` — the one residual:** the **Unity / Meta publisher-control read** (doc 21 §4.3, §8 item 1) — their doc pages 404'd, so they are recorded *unverified*; needed before the **SDK is selected**, not before the slice.
- [ ] **Plan monetization timeline and strategy.**
- [ ] **Plan community building approach.**
- [ ] **`SCRUM-43`** — legal long-tail (awareness only): Play fee vs the $1.19 floor · ToS/privacy policy · trademark · model-terms reads.
- [ ] **`SCRUM-65`** — **business registration & compliance** (Singapore sole proprietor) — milestones **B1–B13**; *new 2026-10-05*, listed in full under **🏢 Business & compliance** in Immediate Actions; research → [[AppDesignConceptBoard/20-business-registration-and-compliance|doc 20]].

---

## 🎯 Key Questions to Answer in Next Session

1. **Timeline** ✅ **answered 2026-10-03 (S27)** — [[AppDesignConceptBoard/18-mvp-scope-and-timeline|doc 18]]: ~50 focused sessions to beta (≈ Feb 2027), public ≈ Qingming 2027; effort-driven, not date-driven. The one input it still needs is **D5 — your honest sessions/week**.
2. **Validation** — what's the simplest way to test if people want this? (metrics are *defined* in `SCRUM-25` ✅ but **not yet instrumented**)
3. **Monetization** — may ads ever appear **inside** the ritual flow? → this is `ADR-008`, a product call.
4. **PM review** — the items under *Design — PM review & decisions* above.

---

## 📚 Resources to Explore Before Next Session

### Technical research
- Duolingo leaderboard mechanics · Expo / React Native camera + overlay patterns · AI cartoonization APIs (background removal, style transfer)

### Cultural research
- Traditional burning rituals and symbolism · family memorial practices in Chinese culture
  *(joss-paper designs & styles ✅ done — style locked 2026-09-24)*

### Business research
- Family-oriented advertising platforms · mobile app monetization strategies

---

## 🤝 Notes for Next AI Session

**User Role**: Product Manager/Project Manager  
**Technical Level**: Software developer but not a mobile app specialist  
**Development Approach**: AI vibe coding  
**Timeline**: No pressure — hobby project with family legacy vision  
**Priority**: Get cartoonization style right, then build the simple AR burning mechanic  

---

*Purpose: track **open** follow-up actions. Completed and superseded items → [[completed-work-archive]].*  
*Created 2026-09-22 · **Re-scoped 2026-10-02 (Session 26)** — completed items, the duplicated `MVP Architecture` section and the dated change log archived; this file now lists open work only. · **Updated 2026-10-03 (S27)** — SCRUM-14 closed → [[AppDesignConceptBoard/18-mvp-scope-and-timeline|doc 18]]; SCRUM-53/54/55 added; the critical path re-ordered. · **Reconciled 2026-10-03 (S27, post-merge)** — stale Jira-false lines corrected (`SCRUM-42`/`SCRUM-33`/`SCRUM-45` all **Done**), `SCRUM-41` added (due 6 Oct). · **Updated 2026-10-03 (S27b)** — [[AppDesignConceptBoard/19-build-plan-services-api-environments|doc 19]] build plan; **SCRUM-57** (repo bootstrap, startable now) + **SCRUM-56** (PM provisioning) added. · **Updated 2026-10-03 (S27c)** — **SCRUM-57 ✅ Done**; **SCRUM-54 half done** (schema applied to the hosted project); SCRUM-56 progress (link + fal key) + the **new anonymous sign-ins** PM item. · **Updated 2026-10-04 (S28 · S28b)** — **`SCRUM-54` ✅ Done** (PR-2 + PR-3 code-complete; **PR #13** awaiting the PM's merge) and **`SCRUM-59` ✅ BUILT** (the AI-budget stop-rule; **PR #14**, stacked on #13). All four PR-3 decisions ratified and closed; the closed items moved to [[completed-work-archive]] §5. Two new **PR-4-read** items added: the failed-generation re-capture rule and the `shrine_busy` queue state.*
