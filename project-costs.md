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

| 2026-10-07 | **SCRUM-80 — the client identity bootstrap (ADR-004)** | Adopt an anonymous session at first launch + re-ensure before the ritual; prove it against the live project | **US$0.00** — no fal.ai call: an anonymous sign-in is **free**, and the slice's paid step (Path C, ≈ US$0.09) is not reached until the device run | — | **S$0.00** | ✅ **no spend** — logged so the zero is on the record rather than absent. The ≈ US$0.09 Path C run stays budgeted and **unspent**. |

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
| fal.ai credit — **spent to date** (spike **S$5.75** + PR-3 verification **≈S$0.51** + SCRUM-59 verification **≈S$0.12** + SCRUM-53 service layer **S$0.00**) | **≈ S$6.38** (≈ **US$4.98** of the approved US$10–20 — **30% used**) |
| **Total known outlay (first month, incl. spike actual)** | **≈ S$8.47** (ClinePass actual S$2.71 + fal actual S$5.75) |
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

*Updated 2026-10-05 — **SCRUM-41 closed**: the Mastercard rate **1.2808** was read off the statement and applied to every fal.ai row (spike **S$5.75** · PR-3 **≈S$0.51** · SCRUM-59 **≈S$0.12** → **≈ S$6.38 / US$4.98**), superseding the 1.2771 & 1.2900 ⚠ placeholders. Also logged **SCRUM-55 = S$0.00**.*
*Previous (2026-10-04) — PR-3 verification ≈US$0.40 and the SCRUM-59 stop-rule verification ≈US$0.09 logged (the latter from a mis-fired first run; the corrected path costs nothing — doc 19 §12.5).*
*Updated 2026-09-25 — page created (session 16); ClinePass + spike budget logged; first-month actual **US$2.12 = S$2.71** recorded, **next charge 2026-10-22**.*
