	# 💰 Project Cost Tracker — Joss Paper AR

> **Purpose**: Single source of truth for every cost incurred by or committed to this project — tooling, AI APIs, subscriptions, one-off fees.
> **Currency**: **SGD** (all amounts recorded in Singapore dollars)
> **Started**: 2026-09-25 (session 16, SCRUM-10 tech-stack work)

---

## ⚠️ INSTRUCTIONS FOR FUTURE AI — READ BEFORE RECORDING ANY COST

1. **Track every cost in SGD.** This is a hard rule — never leave an entry in foreign currency as the recorded amount.
2. **For any charge not in SGD, convert at the Mastercard market rate** for the transaction date, using the Mastercard currency converter:
   → <https://www.mastercard.us/en-us/holders/get-support/currency-conversion.html>
   (or the equivalent `mastercard.com` regional converter).
3. **Every converted entry must record all four fields:** original amount + original currency · the Mastercard rate used · the conversion date · the resulting SGD amount.
4. **If the Mastercard rate cannot be retrieved at the moment of entry** (tool unavailable), use the closest available mid-market rate as a *placeholder*, mark the row `⚠ rate placeholder`, and correct it to the Mastercard rate at the next session. (The actual charged amount on a Mastercard statement may differ slightly — cross-currency processing fees may also apply, e.g. ClinePass notes "additional processing fee may apply"; when the real statement charge is known, prefer it and note `statement actual`.)
5. **Log costs the moment they are committed or incurred** — don't wait for month end. Include *my own* operating costs (ClinePass) — this project pays for the AI that builds it.
6. **Keep an up-to-date running total** in the Budget Summary section below.

---

## 🔁 Recurring costs

| Item | Provider | Original | Rate (→SGD) | Rate date | **SGD** | Billing | Notes |
|---|---|---|---|---|---|---|---|
| **ClinePass subscription** (the AI building this project) | Cline Bot Inc | **US$9.99** | 1.2771 (mid-market ⚠ placeholder — replace with Mastercard rate at first charge) | 2026-09-25 | **S$12.76** /month | monthly | Official standard rate — **next charge: 2026-10-22** ([cline.bot/cline-pass](https://cline.bot/cline-pass)); promo period (3rd-party reports 30% off first 3 months) may apply — verify against first statement. Includes open-weight models (GLM 5.3, Kimi K3/K2.7, DeepSeek V4, Qwen3.7/3.8, MiniMax M3, MiMo) with generous quotas |

**Recurring monthly total: ≈ S$12.76** (subject to Mastercard rate at each charge — that is the standard-rate plan figure; **actual first-month charge was US$2.12**).

**Actual charges:**

| Date | Item | Original | Rate (→SGD) | **SGD** | Notes |
|---|---|---|---|---|---|
| 2026-09 | ClinePass — this month's cost | **US$2.12** | ⚠ **still 1.2771 placeholder** — deliberately *not* re-rated to 1.2808 | **S$2.71** | **Next charge: 2026-10-22** — expected at standard US$9.99/mo (US$9.99 × 1.2808 ≈ **S$12.80**/mo at the current rate) unless promo/proration continues; verify against statement. ⚠ **Open:** SCRUM-41 reconciled the **fal.ai** rows, but this is a **different transaction date** — if 1.2808 is the card's standing rate rather than the rate for *this* charge, say so and it is re-based; otherwise the statement settles it at SCRUM-39 (2026-10-22). |

---

## 🧪 One-off / ad-hoc costs

| Date | Item | Purpose | Original | Rate | **SGD** | Status |
|---|---|---|---|---|---|---|
| 2026-09-25 | **Style-D fidelity spike — budget approved** (stakeholder) | Prove low-poly 3D × ink brush is achievable via hosted APIs (fal/Replicate credits) before provider lock-in | US$10–20 budget · **actual US$4.49** | **1.2808** (Mastercard, **verified 2026-10-05**) | **S$5.75** (4.49 × 1.2808) | ✅ approved · **spent 2026-09-26** (133 runs, well under cap ✅) — ✅ **reconciled at SCRUM-41 (2026-10-05)** @ the Mastercard rate · **no overrun** (US$4.49 of the US$20 cap = 22%) |
| 2026-10-04 | **PR-3 live verification (SCRUM-54b)** — real fal calls against the deployed Edge Functions | Prove the locked Path C pipeline runs end-to-end on the hosted runtime, with cost/latency recorded: 7 × `moondream2` identify (~$0.01) + 4 × `nano-banana-2` 1K generate (~$0.08) | **≈ US$0.40** (est. — 0.07 + 0.32; two runs were spent discovering the PNG-size defect and the colour-rule false positive) | **1.2808** (Mastercard, verified 2026-10-05) | **≈ S$0.51** (0.40 × 1.2808) | ✅ **incurred 2026-10-04** — one run completed fully (`cost_micros: 90000`, `latency_ms: 14988`, a persisted sprite). ✅ **rate reconciled at SCRUM-41** (was a 1.2900 ⚠ placeholder). |

| 2026-10-05 | **SCRUM-53 service layer** — `ritual.ts` / `ritual-map.ts` / `preparing.tsx` | Wire the client to the deployed orchestrator under the pre-minted capture id | **US$0.00** — no fal.ai call was made: the mapping is asserted against the orchestrator's **real response contract**, and the live run is the device/emulator acceptance step (SCRUM-52) | **1.2808** (Mastercard, verified 2026-10-05) | **S$0.00** | ✅ **no spend** — logged so the zero is on the record rather than absent. A live Path C run (≈ US$0.09) is authorised and budgeted for the acceptance step. |
| 2026-10-04 | **SCRUM-59 stop-rule verification** — 4 live runs against the deployed orchestrator | Prove the budget **QUEUES** instead of spending (doc 10 §4) | **≈ US$0.09** (the first run **mis-fired** — a rotated service key meant the budget was never written, so it completed a real Path C generation; the corrected runs return `shrine_busy` in 0.5 s and spend **nothing**) | **1.2808** (Mastercard, verified 2026-10-05) | **≈ S$0.12** (0.09 × 1.2808) | ✅ **incurred 2026-10-04** — logged because it *was* spent; the intended path costs **$0.00** (doc 19 §12.5 finding 2). ✅ **rate reconciled at SCRUM-41.** |


| 2026-10-05 | **SCRUM-55 — the three ADRs** | Documentation + a zero-dependency Node gate (`npm run check:adrs`) | **US$0.00** | — | **S$0.00** | ✅ no API calls, no migrations, nothing deployed — recorded so the ticket's cost is explicit |

| 2026-10-06 | **S31 — SCRUM-64 emulator setup, the first end-to-end attempt, and the i18n fix** | Stand up an interim emulator test target; attempt the slice's first end-to-end run | **US$0.00** — **no fal.ai call was made**: the emulator needs no API, and the path stopped at `preparing` (the missing client auth bootstrap, **SCRUM-80**) *before* any paid step could be reached | — | **S$0.00** | ✅ **no spend** — logged so the zero is on the record rather than absent. The live Path C run (≈ US$0.09) stays budgeted and **unspent**. |

| 2026-10-07 | **SCRUM-53 — the slice's first device run (emulator `floor_api30`)** | Capture → cartoonize → burn, end to end, after SCRUM-80 + SCRUM-81 | **≈ US$0.09** — one real Path C run: `cartoonize_jobs.cost_micros = 90000`, `latency_ms = 16131` | **1.2808** (Mastercard, verified 2026-10-05) | **≈ S$0.12** (0.09 × 1.2808) | ✅ **incurred 2026-10-07** — the first real AI burn, driven from the app on the emulator. fal total ≈ **US$5.07 / S$6.49** of the approved US$10–20. |

| 2026-10-07 | **SCRUM-82 — the clan fix, validated on the emulator** | Prove the full ritual completes (capture → cartoonize → burn → **award → persist**) | **≈ US$0.09** — one real Path C run: the job `styled`, `cost_micros = 90000` | **1.2808** (Mastercard) | **≈ S$0.12** | ✅ **incurred 2026-10-07** — the ritual completed and awarded **600 devout tribute**. fal total ≈ **US$5.16 / S$6.61** of the approved US$10–20. |

| 2026-10-08 | **S34 — the post-merge docs reconciliation (SCRUM-82) + `SCRUM-46`: the clan API *and* its screens + `SCRUM-85`: the first-run tutorial** | Bring the docs back in line with `main` after PR #27 merged; then build the clan role ladder + the Book read path, the client API layer and the clan screens, prove them against a real database, and make the first burn a no-cost tutorial | **US$0.00** — **no fal.ai call was made**: the session ran `npm install`, the local gate suite, and a **local Supabase stack on Docker** (migrations applied from the files, real Postgres 17.11 + real PostgREST). ⚠️ **This is the point of the tutorial itself** — a demo that generated an offering would have cost ≈US$0.09 per new user, so the tutorial deliberately calls neither the server nor the AI | — | **S$0.00** | ✅ **no spend** — logged so the zero is on the record rather than absent. The fal total is unchanged at ≈ **US$5.16 / S$6.61** of the approved US$10–20. |
| 2026-10-08 | **S34 (cont.) — `SCRUM-84`: the successor's RANK, answered and built (migration `0014`)** | Resolve the PM's clarification into a rule, change `leave_clan` so the successor **inherits the departing rank**, and assert it from three directions | **US$0.00** — **no fal.ai call was made**: the work was a migration, the pure mirror, and three LOCAL gates (`check:lib` · `check:clanapi` · the SQL suite) against the **local Supabase stack on Docker**. ⚠️ The fault tests re-applied the migrations with `db reset` — Docker CPU, not spend | — | **S$0.00** | ✅ **no spend** — logged so the zero is on the record rather than absent. The fal total is unchanged at ≈ **US$5.16 / S$6.61** of the approved US$10–20. |

| 2026-10-10 | **`SCRUM-52` — the Tier F floor device (the named CI/test phone)** — 1 × **POCO C81 Pro** | The hardware gate behind **`SCRUM-51`** (AR-fire PoC) and the device-check half of **`SCRUM-17`** (vertical slice): every NFR in doc 14 is written against a **numbered floor device**, not a flagship | **S$157.73** (already SGD — no conversion) | — (SGD, no FX) | **S$157.73** | ✅ **bought 2026-10-10** — ⚠️ **NOT one of the three shortlisted candidates** (Galaxy A05s · Redmi A5 · Nokia C-series) and **S$7.73 over the S$100–150 budget**; the PM took the cheapest device they could find. Specs **meet/exceed Tier F** — **4 GB RAM** (floor 3 GB) · **Android 15 / HyperOS 3** (floor 11) · **720×1600** · 64 GB + microSD — so **the floor is UNCHANGED and no ADR is triggered** (`N1` forbids only a *silent raise*; this is neither a raise nor a drop). ⚠️ **Honest limit: 4 GB is the *top edge* of Tier F, so this device does NOT prove the strict 3 GB Go-class case.** Named in **doc 14 §1** and Jira **`SCRUM-52`**. |

<!-- APPEND-NEW-ONEOFF-COSTS-ABOVE -->

---

## 📅 Planned / conditional costs (known, not yet incurred)

| Item | When triggered | Original | **SGD (est)** | Status |
|---|---|---|---|---|
| Apple Developer Program | Only if/when iOS ships (iOS deferred out of MVP) | US$99 /year | ≈ S$126.43 | Conditional — not budgeted now |
| fal.ai **Path C production** (ADR-002: nano-banana-2 t2i + moondream2 ID) | Production, per photo burn | US$0.09–0.13 /photo | ≈ S$0.115–0.166 /photo | **Locked (S18)** — offset by credits at $1.55/1,000 (+32% margin) |
| fal.ai store-burn ID (Track B closed-set) | Production, per store burn | US$0.01 /burn | ≈ S$0.013 /burn | **Locked (S18)** |
| ~~Background-removal API~~ | ~~Production~~ | ~~$12.99 /month class~~ | ~~≈ S$16.59 /month~~ | **Superseded (S18)** — Path C drops bg-removal entirely (ADR-002) |
| Supabase (DB/auth/storage) | — | Free tier | **S$0** | MVP on free tier |
| EAS Build / Codemagic (CI) | — | Free tiers (15 iOS builds / 500 min) | **S$0** | MVP on free tier |
| Expo / framework licenses | — | Free, MIT/open-source | **S$0** | — |

---

## 📅 Billing calendar (for future AI — act on these dates)

| Date | Event | Action for the AI on duty |
|---|---|---|
| **2026-10-22** | ClinePass monthly charge | → Jira **SCRUM-39**: record actual charge here (USD→SGD @ Mastercard rate) in *Actual charges*, update *Budget summary*, create next month's Jira item |
| **2026-11-22** | ClinePass monthly charge | → Jira **SCRUM-40**: same procedure, then create December's item |
| **2026-12-22** | ClinePass monthly charge | create Jira item on/after 22 Nov (recur the 22nd monthly, indefinitely) |
| **2027-01-22** | ClinePass monthly charge | …and so on |
| ~~when the style-D spike runs~~ **spike ran 2026-09-26** | ~~reconcile final USD→SGD @ Mastercard rate~~ ✅ **done 2026-10-05** | **SCRUM-41 closed**: the stakeholder read the **Mastercard rate = 1.2808** off the billing statement; all three fal rows re-based off the placeholders (spike **S$5.75**, PR-3 **≈S$0.51**, SCRUM-59 **≈S$0.12**). **No overrun.** |
| conditional | Apple Developer US$99/yr | only if/when iOS ships |

> ⚠️ **Calendar note (2026-09-25):** the Circleback MCP is **read-only** (search-only — it cannot create events or action items) and currently returns **zero calendar events** (no calendar connected/synced yet). Billing reminders therefore live in **Jira as dated action items** + this page. If calendar-write tooling is connected later, mirror these dates into the calendar.

**Instruction for future AI:** when any date above arrives → open the Jira item, record the charge per the rules at the top of this page (SGD @ Mastercard market rate), update *Budget summary*, then **roll the calendar forward** by creating the next dated Jira item (22nd of the following month).

---

## 📊 Budget summary

| Category | SGD |
|---|---|
| Committed recurring (ClinePass / month) | S$12.76 |
| Style-D spike — **actual** (2026-09-26, **@1.2808 Mastercard, reconciled 2026-10-05**) | **S$5.75** (US$4.49 / 133 runs — under the US$20 cap ✅) |
| fal.ai credit — **spent to date** (spike **S$5.75** + PR-3 verification **≈S$0.51** + SCRUM-59 verification **≈S$0.12** + the two 2026-10-07 E2E runs **≈S$0.12** each) | **≈ S$6.61** (≈ **US$5.16** of the approved US$10–20 — **26% used**) — *re-derived 2026-10-10 from the row above: US$4.49+0.40+0.09+0.09+0.09 = **US$5.16** × 1.2808 = **S$6.61** (the per-row SGD roundings sum to S$6.62))* |
| **Floor device — one-off hardware** (POCO C81 Pro · `SCRUM-52` · bought 2026-10-10) | **S$157.73** (SGD, no FX) |
| **Total known outlay to date** (ClinePass **S$2.71** + fal **≈S$6.61** + floor device **S$157.73**) | **≈ S$167.05** — ⚠️ *replaces the stale \"first month\" figure of ≈S$8.47, which omitted four fal rows and all hardware.* Hardware is now the largest single line by far. |
| Actual spend to date (ClinePass, this month) | S$2.71 (US$2.12) |
| Paid services running | none yet (all free tiers) |

*Soft-limit posture: cost kept low — everything runs on free tiers except ClinePass (the development agent itself) and the approved spike.*

---

## 🧭 Decision log (cost-relevant)

- **2026-09-25** — **Hosted APIs from day one** for the AI pipeline (bg removal / ID / cartoonize), stakeholder decision — rationale: *"make sure deployment is fine from day 1"*. No self-hosted GPU capex.
- **2026-09-25** — **Style-D spike approved** at US$10–20 budget (see one-offs).
- **2026-09-25** — **iOS out of MVP scope** (platform must support later; avoids $99/yr Apple fee for now).
- **2026-09-26** — **Style-D spike executed** (SCRUM-41): **US$4.49 / 133 runs final** — far under the US$20 cap.
- **2026-10-05** — **SCRUM-41 closed**: Mastercard **1.2808** confirmed from the statement; all fal.ai rows converted at the real rate (**≈ S$6.38 total**) instead of placeholders. **22% of the approved US$10–20 used; no overrun.** No top-up needed yet — keep it in view for SCRUM-53.
- **2026-09-26** — **ADR-002 accepted: Path C** (describe-then-generate: `moondream2` → `nano-banana-2` t2i ≈ **US$0.10/picture**; edit recipe = fallback); **economy v1 locked** (10-economy-spec): credits **$1.55/1,000** · fee 150 · starter 2,000 · sign-in 100 store pts + 150 credits/day · free-photo cap 15/mo · ads post-ritual only · production AI budget ≈ $0.10/photo (budget rows below updated from cartoonify-era estimates).
- Context: [[06-tech-stack-options]] · Jira SCRUM-10 · SCRUM-18 · SCRUM-41

---

## 📏 Rate reference

- **Mastercard converter (authoritative for entries)**: <https://www.mastercard.us/en-us/holders/get-support/currency-conversion.html>
- Placeholder source used on 2026-09-25: mid-market USD→SGD **1.2771** (ECB via Frankburter API, date 2026-09-25)
- **Mastercard rate on record: USD→SGD 1.2808** — read by the stakeholder off the billing statement **2026-10-05**, and applied to every fal.ai row at SCRUM-41. This supersedes the 1.2771/1.2900 ⚠ placeholders. *Note it is the rate the card **charged**, so it already carries any cross-currency spread — no further fee is added on top (rule 4's `statement actual`).*
- Cross-currency fees: possible (e.g. ClinePass "additional processing fee may apply") — capture statement actual when it lands.

---

*Updated 2026-10-10 (S37i) — **`SCRUM-96`'s script sweep also at US$0.00 / S$0.00.** The boards were swept for traditional characters **using the vendored OpenCC table rather than a hand-typed list** — finding exactly **6** (`誠·對·準·邊·拋·鍾`) on **15 layers / 6 boards**, converted at version `S37i`, **0 remaining**. **No paid line:** Penpot edits and a local intersection. ⚠️ The same entry records the honest cost of the earlier approach: my hand-typed scan reported **58 hits of which ~4 were real**. fal.ai stays **≈ S$6.61 / US$5.16**; all-time **≈ S$167.05**, of which **S$157.73 is the floor device**.*
*Updated 2026-10-10 (S37f/g) — **`SCRUM-98` also at US$0.00 / S$0.00.** The reviewer's *"Zh-1g is still bilingual at least"* turned out to be **24 ZH design boards carrying untranslated English UI copy** — `ZH · 1g` was a **clone that missed translation**, not a bilingual board. **98 strings across 14 boards** were translated **by copying a same-state twin** (never invented), each accepted only when its own EN counterpart carried the identical English. ⚠️ **The ink/wrap comparison is finished for `1g` only** — the Penpot tab suspended, and a box sized for English need not suit Chinese. **No paid line:** the work was Penpot and the mapping logic. The fal.ai total stays **≈ S$6.61 / US$5.16**; the all-time total **≈ S$167.05**, of which **S$157.73 is the floor device**.*
*Updated 2026-10-10 (S37e) — **`SCRUM-97` (the 中文 copy defect) also at US$0.00 / S$0.00.** A reviewer's screenshot found what four green gates could not: `burn.tsx` and `capture.tsx` never imported `t`, four sites rendered both languages at once, and the store catalogue had **no Chinese at all**. The fix was 21 keys + a `localized()` picker + a new `check:copy` gate — no paid line. ⚠️ **The one cost was again a mistake, and again free to find: my first copy gate skipped every line carrying a `style=` attribute (i.e. nearly all of them) and reported a clean pass over a hardcoded literal.** The fal.ai total stays **≈ S$6.61 / US$5.16**; the all-time total **≈ S$167.05**, of which **S$157.73 is the floor device**.*
*Updated 2026-10-10 (S37d) — **`SCRUM-95` (simplified Chinese) also at US$0.00 / S$0.00**, and this one is instructive about *where* cost sits in this project: a whole-app language decision, an 11-file conversion, a vendored 2,965-pair character table and 14 new gate assertions cost **nothing**, because the only two paid lines here remain **hardware** (S$157.73 for the floor device) and **fal.ai image generation** (≈ S$6.61 to date). ⚠️ **The one thing that did cost was a mistake, and it was free to find: a hand-typed conversion list that missed 13 characters, verified by a check that could only look for what the list already knew.** No spend — but it would have shipped a mixed-script app if the font of authority had been my own typing rather than OpenCC's data.*
*Updated 2026-10-10 (S37c) — **`SCRUM-92` also at US$0.00 / S$0.00, and again a genuine zero**: the work was Penpot (reading the signed-off geometry, no paid service), the local gate suite, and Node — nothing deployed, nothing generated. The fal.ai total is **unchanged at ≈ S$6.61 / US$5.16**; the all-time total stays **≈ S$167.05**, of which **S$157.73 is the floor device** — ⚠️ **purchased but not yet delivered**, which is why `SCRUM-92` stops at `In Review` rather than shipping a device screenshot. ⚠️ **The pattern is now three sessions running: the expensive line in this project is hardware and image generation; a whole UI control, its geometry and 34 gate assertions cost nothing.***
*Updated 2026-10-10 (S37 · cont.) — **`SCRUM-93` at US$0.00 / S$0.00, and it is a genuine zero rather than an unmeasured one.** The work was **Penpot** (two label fills + two named versions — no paid service), the **local** gate suite (`node design-system/contrast-check.js`, free), and one **live sweep** run through the Penpot plugin. ⚠️ **The distinction worth keeping is the one this ticket was about:** the deliverable is not the chip — it is that **`check:contrast` can now assert a Penpot board pair in CI**, which costs nothing per run and would have caught the defect on the day it was drawn. The fal.ai total is **unchanged at ≈ S$6.61 / US$5.16** (26 % of the US$20 ceiling); the all-time total stays **≈ S$167.05**, of which **S$157.73 is the floor device** — hardware remains the largest line by an order of magnitude.*  
*Updated 2026-10-10 (S37) — **one real spend, and it is hardware, not AI: the floor device.** `SCRUM-52` closed in substance — the PM bought **1 × POCO C81 Pro for S$157.73** (already SGD, no FX conversion needed) — ⚠️ **purchased, NOT yet delivered** as of the session close, so the hardware gate is satisfied **on paper only** and `SCRUM-88`/`SCRUM-51` stay blocked in practice. ⚠️ **Two deviations from the plan, both recorded rather than smoothed over:** it is **not one of the three shortlisted candidates** (Galaxy A05s · Redmi A5 · Nokia C-series) and it is **S$7.73 over the S$100–150 budget** — the PM took the cheapest device they could find. ✅ **It meets/exceeds Tier F** (4 GB / Android 15 / 720×1600), so **the floor is unchanged and no ADR is triggered** — but ⚠️ **4 GB is the top edge of Tier F, so the strict 3 GB Go-class case is NOT proven by this device.** The fal.ai line is **unchanged at ≈ S$6.61 / US$5.16** (26% of the US$20 ceiling); the **new all-time total is ≈ S$167.05**, and hardware is now the largest line in the project by an order of magnitude. Re-derived from the rows above, not carried forward.*  
*Updated 2026-10-09 (S36) — **the whole session ran at US$0.00 / S$0.00**, and the fal.ai total is **unchanged at ≈ S$6.61 / US$5.16**. ⚠️ **No fal.ai call was made, and nothing was deployed — the entire session was Penpot.** The work was the `SCRUM-91` option-A design pass (the Home clan pill: 4 boards, EN + ZH) and the measurement that redirected it. ⚠️ **The distinction worth keeping: this is a design deliverable, so the honest cost line is a genuine zero, not an unmeasured one** — the only tool used was the Penpot plugin against the existing file (revn 264), and its named-version checkpoint (`file.saveVersion`) is free. **26% of the approved US$20 ceiling stands.** ⚠️ One thing this session *did* cost: a wrong first placement (a full-width bar at y 282–338 off a **truncated** layer dump) that a one-call collision check caught — the cheapest kind of mistake, and worth recording because it is the same failure class as the "12/12" count.*  
*Updated 2026-10-09 (S35b) — **`SCRUM-86` also at US$0.00 / S$0.00**; the fal.ai total is **unchanged at ≈ S$6.61 / US$5.16**. The work was server-side only — migration `0015` (the invite-code grant), the client ladder, and the tests — plus one `supabase db push` (free). ⚠️ **The whole verification ran on the LOCAL Docker stack**: `clan_management.sql` 109 · `invite_sharing.sql` 25 · `ai_budget.sql` 17 · `check:clanapi` 92, all against a real Postgres 17 and a real PostgREST. **That continues S34's pattern, and is worth restating: proving a database change costs nothing here** — the only paid line in this project remains fal.ai image generation. ⚠️ One caveat found, and it cost nothing but nearly cost a false green: a persisted Docker volume made the first "the migration applied" untrue until `supabase db reset` (doc 19 §12.14, trap B).*  
*Updated 2026-10-09 (S35) — **the whole session ran at US$0.00 / S$0.00**, and the fal.ai total is **unchanged at ≈ S$6.61 / US$5.16** (26% of the approved US$20). No AI call was made: the work was `SCRUM-50`'s QR invite (client-only — the QR is encoded **on the device**, exactly why doc 07 §4.6 chose a client-side encoder), plus **`supabase db push` of the three unpushed migrations** (`0012`–`0014`, free). **Two dependencies were added and both are FREE open-source with no licence fee or metering:** `react-native-svg` (**MIT**, pinned to SDK 57's 15.15.4) and `react-native-qrcode-svg` (**MIT**, bundling the MIT `qrcode` encoder). ⚠️ **The distinction worth keeping: this ticket's feature is deliberately the free kind of feature** — a QR that is generated locally costs nothing per user, where a server-side QR service or an image-upload round trip would have added a line to this file. Verified before adopting them: `bundle:android` exports clean (4.5 MB) and `expo-doctor` is 21/21.*  
*Updated 2026-10-08 (S34 wrap) — **the whole session ran at US$0.00 / S$0.00**: the post-merge docs reconciliation, `SCRUM-46`'s clan API **and** its five screens, `SCRUM-84`'s successor-rank rule (migration `0014`, with both fault-test directions), and `SCRUM-85`'s tutorial. ⚠️ **No fal.ai call was made in the entire session** — every migration was proved on a **local Supabase stack on Docker** (real Postgres 17.11 + real PostgREST), which is free and equally real. **That is the pattern worth keeping: verify locally, spend only when generating.** The fal total is unchanged at **≈ S$6.61 / US$5.16** of the approved US$10–20.*  
*Updated 2026-10-08 — **S34**: the post-merge docs reconciliation **and `SCRUM-46`'s clan management API** both logged at **US$0.00 / S$0.00** — no AI call, no deploy to the hosted project, and the migration was proved on a **local Supabase stack on Docker** (real Postgres 17.11) rather than by spending. The fal total stands at **≈ S$6.61 / US$5.16** — the two 2026-10-07 Path C runs — i.e. **26%** of the approved US$20 ceiling.*  
*Updated 2026-10-05 — **SCRUM-41 closed**: the Mastercard rate **1.2808** was read off the statement and applied to every fal.ai row (spike **S$5.75** · PR-3 **≈S$0.51** · SCRUM-59 **≈S$0.12** → **≈ S$6.38 / US$4.98**), superseding the 1.2771 & 1.2900 ⚠ placeholders. Also logged **SCRUM-55 = S$0.00**.*
*Previous (2026-10-04) — PR-3 verification ≈US$0.40 and the SCRUM-59 stop-rule verification ≈US$0.09 logged (the latter from a mis-fired first run; the corrected path costs nothing — doc 19 §12.5).*
*Updated 2026-09-25 — page created (session 16); ClinePass + spike budget logged; first-month actual **US$2.12 = S$2.71** recorded, **next charge 2026-10-22**.*
