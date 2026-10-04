# 📋 Follow-Up Items - Joss Paper AR

> **Open work only.** Completed items, superseded sections and the dated change log moved to **[[completed-work-archive]]** (2026-10-02, S26; reconciled again **2026-10-03, S27** — two stale lines claiming a live colour hold on `SCRUM-42`/`SCRUM-33` and an open "close `SCRUM-45`" removed; both are **Done** in Jira). Current state → **[[next-ai-context]]**.

---

## 🎯 Immediate Actions (Next 1–2 Weeks)

### 🔴 On the critical path

> **Sequenced by [[AppDesignConceptBoard/18-mvp-scope-and-timeline|doc 18]] (S27).** The scope, dependency map, estimates, milestones, risks and testing plan are locked there — this file tracks only the *actions*.

- [x] **`SCRUM-15` — repo + CI + dev environment** ✅ **Done 2026-10-02** — GitHub repo + CI (design-system + app checks, all green) · Expo SDK 57 scaffolded **single-repo** · README + CONTRIBUTING + `.env.example` · MIT licence · PRs #1–#3. Unblocked: `SCRUM-46`, `SCRUM-50`, `SCRUM-51`.
- [x] **`SCRUM-57` — repo bootstrap (PR-1)** ✅ **Done 2026-10-03** — Expo Router shell · RN theme bridge (with the parity guard) · domain modules (aim bands · award maths · catalogue · quota · currencies) · **the T2 acceptance test** (45 + 36 checks, zero-dependency, fault-tested) · CI + docs. Merged as **PR #9**.
- [ ] **`SCRUM-56` — PM provisioning** ⏰ — ✅ **done:** Supabase project `yercgevebxvtzkgctfai` (`ap-southeast-1`, Postgres 17.11) · CLI login **and link** · package id `app.josspaperar` · region · **fal.ai key verified working** (API scope, 72 chars) · ✅ **anonymous sign-ins enabled and proven** (real sign-in → 200, `is_anonymous`, session; with that JWT the catalogue reads and the ledger refuses writes). **Still open:** device/emulator (`SCRUM-52`) · invite domain (#6) · EAS login · GH secrets · Play Console (M4). *(→ [[AppDesignConceptBoard/19-build-plan-services-api-environments|doc 19]] §6.2)*
- [ ] **`SCRUM-41` — record the style-D spike spend in `project-costs.md`** ⏰ **due 2026-10-06** (In Progress) — the approved US$10–20 budget vs the actual **≈ US$4.49 / 133 runs**; then reconcile the fal invoice when it lands. **A PM action, time-boxed.** *(Note: PR-3's live verification added **≈ US$0.40** of real fal spend — 7 identify calls + 4 generations — logged as its own row in `project-costs.md`; keep the ~US$10 top-up in view for SCRUM-53.)*
- [x] **`SCRUM-54` — Supabase backend of record** ✅ **DONE 2026-10-04 (PR-2 + PR-3)** — **PR-2:** 21 tables · 25 policies · RLS on every one · private buckets · catalogue seeded (applied to the hosted project). **PR-3:** `submit_burn` (the spine) + 10 more RPCs + 3 Edge Functions (**deployed and run**) + the 5 client libs + 4 new gates. **Proven, not asserted:** a client `submit_burn` → 403 · a client ledger INSERT → 403 · `anon` → 0 rows over the REST API · a real burn → 1,600 tribute · a replay → `idempotent_replay` · a forged `band` ignored · a **full Path C run** → a persisted sprite at $0.09/15.0 s. *(→ [[AppDesignConceptBoard/19-build-plan-services-api-environments|doc 19]] §12)*
- [ ] **PR-3's findings — the follow-ups it created** (all recorded in doc 19 §12; none blocks PR-4 except the first)
  - [x] 🎯 **THE FOUR DECISIONS — all four RATIFIED by the PM 2026-10-04** (Jira is the source of truth; each ticket carries the options, the measured evidence and the consequence):
    | Ticket | The call | Ratified | Now |
    |---|---|---|---|
    | **`SCRUM-58`** | the styled sprite is **WebP** at 1K (49.7 KB) — accept, or PNG + a resize stage? | ✅ **A — accept WebP** | **nothing to build** — PR-3 already ships it; the bucket allows `webp`+`png` and `check:pathc` guards it |
    | **`SCRUM-59`** | what does an alpha **photo burn** cost the player? | ✅ **B — the daily cap + the daily AI-budget STOP-RULE** (no wallets yet) | ✅ **BUILT 2026-10-04 — its own PR** (migration `0011` + tests; see the line below) |
    | **`SCRUM-60`** | accept the **7 authenticated-definer advisories**, or move 4 RPCs behind a 4th Edge Function? | ✅ **A — accept 7** | **nothing to build** — recorded in doc 19 §12.4; revisit only if an audit asks |
    | **`SCRUM-61`** | ratify the **narrowed ADR-002 §4 colour rule** + amend the ADR | ✅ **A — ratify + amend** | ✅ **done** — ADR-002 gained **Amendment 1** (in PR #13) |
  - [x] ✅ **`SCRUM-59` (option B) — the AI-budget STOP-RULE IS ENFORCED (2026-10-04)** — migration `0011`: `app_config.daily_ai_budget_micros` (alpha **$5/day**, server-only, Dashboard-tunable) · `request_cartoonize` derives today's spend from `cartoonize_jobs.cost_micros` and **queues** when the shrine cannot afford one more photo (**the spec's $0.10 floor is kept**, so the budget is a HARD ceiling) · `cartoonize-orchestrator` returns **`200 {code:'shrine_busy'}`** and never calls fal · a parked job does **not** burn one of the ten daily attempts. **Verified:** `supabase/tests/ai_budget.sql` (S1–S5b/S6–S7, **fault-tested red** at the boundary) + `supabase/checks/exercise-budget.sh` (live: **510 ms / `cost_micros` NULL** against 14.9 s / 90,000 µ for a real run) + **PR-3's own suite re-run green**. *(→ doc 19 §12.5)*
  - [ ] 🔐 **`/tmp/keys.env`'s `SECRET` is ROTATED and stale** — measured 2026-10-04: `sb_secret_…` answers **401 `Invalid API key`** while the legacy service_role JWT (`SVC`) still works. `exercise-budget.sh` now tries both names and **proves the credential before mutating anything** (a stale key silently skipped the budget write and cost US$0.09 — doc 19 §12.5 finding 2), but the local key file needs refreshing. *(A PM action: rotation or a new secret key in `/tmp/keys.env`.)*
  - [ ] ⚠️ **Commits from an AI session are UNSIGNED** (`%G? = N`) even though every other commit in this repo is GPG-signed — the signing key's passphrase is not in the agent cache and the build shell has **no pinentry/TTY**, so signing hangs. Remedy: `git commit --amend -S` locally while the agent holds the passphrase, or **squash-merge** the PR (GitHub signs the merge commit). **A workflow decision**: accept PR-level signing, or give the agent a signing path (e.g. an SSH signing key whose private key is loaded). Both PR-3 (`b095fba`, `992cb85`) and PR-2 are signed, so this is a *state* issue, not a policy change.
  - [ ] ⚠️ **A FAILED generation cannot be retried for the SAME capture** — `unique(capture_id)` is the cost guarantee (one job per capture, doc 07 §4.2), and `request_cartoonize` treats any non-`queued` job as a paid replay. So a retry is a **NEW capture**. **PR-4's UX must own this**: on `status: failed`, offer a re-capture, never a re-request of the same offering.
  - [ ] 🟡 **`rls_enabled_no_policy` moved 4 → 5** with `app_config` (by design — it joins `rate_counters`/`integrity_flags`/`grid_cells`/`cell_burns` as server-only tables with RLS and deliberately no policies). Recorded in doc 19 §12.5; fold it into SCRUM-60's acceptance note if an audit ever asks for a clean lint report.
  - [ ] 🟡 **`crons`: `pg_cron` is still NOT enabled** — deliberately deferred with `weekly-roll`'s real body to **SCRUM-11** (doc 19 §4.3 says enable it in a migration; enabling an unused scheduler is noise). The stub is honest and gated by the secret key.
  - [ ] 🟡 **The league has no spec** — `get_league_board` returns the caller's own weekly tribute + an empty board with a `note`; `weekly-roll` reports `status: 'stub'`. Both are labelled stubs, not fake rankings.
  - [ ] 🟡 **doc 10 §4's funding model is HALF enforced — and the enforced half is now the one that BILLS** — **`SCRUM-59` option B ✅ built 2026-10-04**: the daily cap *and* the global AI-budget stop-rule (queue, never fail) are live. The **wallet** half stays deferred: the 150-credit fee · the 2,000-credit starter grant · the 15/month cap · the `grant|credits|ad` split need the cash shop and a `sign_in_grants` table that do not exist → `SCRUM-18` / `ADR-006`. **Nothing charges a player anything yet — what is enforced is the ceiling, not the price.**
  - [ ] 🟡 **`delete_my_data` does not remove Storage objects or the `auth.users` row** — the recipe returns the prefixes to purge and says so in the receipt; the Storage API + Admin API calls need a service-role path (an Edge Function or a scripted runbook step). **SCRUM-33.**
  - [ ] 🟡 **The 30-day offline replay window is PROVISIONAL** — doc 11 §9 item 4 still owns the real number (SCRUM-20). The queue never silently drops a burn: it stops retrying and hands the decision to the UI.
  - [ ] 🟡 **`quotas` has one counter, not the per-kind columns doc 10 §7 promises** — the 10/20 split is derived from `burns`. Either doc 10 §7 or the schema should move. **SCRUM-18.**
  - [ ] 🟡 **doc 07 §4.3 names `grid_cells` for new-ground, but only `cell_burns` has identity** — the code reads `cell_burns`; doc 07's line should be corrected in the next architecture tidy.
  - [ ] 🟡 **⚠️ PR-4 RULE: the client must generate the capture id BEFORE the upload** — `captures` deliberately has no UPDATE policy, so `storage_path` cannot be filled in later. Order: generate the id → upload to `captures/{uid}/{id}.jpg` → insert the row. (Found by an exercise that patched the path and watched the orchestrator 404.)
  - [x] 🟡 **The sprite format changed to WebP** (a PM-visible decision, measured) — **`SCRUM-58` → ✅ option A (accept WebP, 2026-10-04)**: a 1K PNG is 1.3 MB against doc 14 §3's 150 KB budget; 1K WebP is 49.7 KB. `check:pathc` guards it, and doc 07 §4.2 / doc 14 §3 / doc 19 §3.3 record it. **No work outstanding.**
  - [x] 🟡 **`get_advisors` carries 7 `authenticated_security_definer_function_executable` findings** (was 3) — **`SCRUM-60` → ✅ option A (accept 7, 2026-10-04)** — the baseline category, unavoidable for a client-callable RPC surface; the four exceptions (`preview_clan` · `join_clan` · `purchase_item` · `delete_my_data`) are documented in their migration, the `anon` class is **0** and machine-asserted, and no lint category is new. Recorded in doc 19 §12.4. *Revisit only if an audit wants a clean report — the RPC bodies would not change.*
  - [x] 🟡 **ADR-002 §4's colour rule was too blunt** and is now narrower (a 3+ token colour echoed across labels blocks; a generic one logs a note) — the refinement was forced by a live false positive (a teapot and a teacup both "brown"). **`SCRUM-61` → ✅ option A (ratify + amend, 2026-10-04): DONE** — **ADR-002 gained Amendment 1** (in PR #13), and `check:pathc` pins both the 3-token fingerprint and the false-positive case.
  - [ ] 🟢 **A signed-URL gotcha worth knowing**: `storage.createSignedUrl` can return a RELATIVE path; the orchestrator normalises it to absolute before handing it to fal (a relative URL produced a confusing `extraction_unusable`).
- [ ] **`SCRUM-52` — Buy the Tier F floor device** — 1 of 3 (Galaxy A05s · Redmi A5 · Nokia C-series, ~S$100–150) → becomes the named CI phone (doc 14 §1) · blocks `SCRUM-51` + the device checks in `SCRUM-53`. **A PM action.**
- [ ] **`SCRUM-53` — Build the MVP vertical slice** (SCRUM-17 execution) — camera → cartoonize → burn → award → persist on the floor device; distinct from SCRUM-17, which only *scoped* it (Done). Acceptance test = the **four aim bands**.
- [ ] **`SCRUM-55` — Write ADR-004 + ADR-006 + ADR-008** *from* the existing specs — decided but unrecorded; **ADR-008 (ad posture) additionally blocks the ad SDK + rewarded photo**.

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
- [ ] **Write `ADR-004` (identity) + `ADR-006` (burn-limit semantics) + `ADR-008` (ad posture)** — **now filed as `SCRUM-55`**; each is written *from* the spec that already decided it ([[AppDesignConceptBoard/10-economy-spec|10]] · [[AppDesignConceptBoard/13-privacy-and-retention|13]]). ADR-008 is a product call.
- [x] **Milestones plan** ✅ **done 2026-10-03 (S27)** — [[AppDesignConceptBoard/18-mvp-scope-and-timeline|doc 18]] (M0–M5) closes the SCRUM-10 chain item and **is** the SCRUM-14 deliverable.

### Business planning
- [ ] **Research advertising platforms** suitable for family-oriented content → `ADR-008` depends on this.
- [ ] **Plan monetization timeline and strategy.**
- [ ] **Plan community building approach.**
- [ ] **`SCRUM-43`** — legal long-tail (awareness only): Play fee vs the $1.19 floor · ToS/privacy policy · trademark · model-terms reads.

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
*Created 2026-09-22 · **Re-scoped 2026-10-02 (Session 26)** — completed items, the duplicated `MVP Architecture` section and the dated change log archived; this file now lists open work only. · **Updated 2026-10-03 (S27)** — SCRUM-14 closed → [[AppDesignConceptBoard/18-mvp-scope-and-timeline|doc 18]]; SCRUM-53/54/55 added; the critical path re-ordered. · **Reconciled 2026-10-03 (S27, post-merge)** — stale Jira-false lines corrected (`SCRUM-42`/`SCRUM-33`/`SCRUM-45` all **Done**), `SCRUM-41` added (due 6 Oct). · **Updated 2026-10-03 (S27b)** — [[AppDesignConceptBoard/19-build-plan-services-api-environments|doc 19]] build plan; **SCRUM-57** (repo bootstrap, startable now) + **SCRUM-56** (PM provisioning) added. · **Updated 2026-10-03 (S27c)** — **SCRUM-57 ✅ Done**; **SCRUM-54 half done** (schema applied to the hosted project); SCRUM-56 progress (link + fal key) + the **new anonymous sign-ins** PM item.*
