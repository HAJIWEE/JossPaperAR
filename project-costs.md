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
| 2026-09 | ClinePass — this month's cost | **US$2.12** | 1.2771 ⚠ placeholder (convert with Mastercard rate at charge date when statement lands) | **S$2.71** | **Next charge: 2026-10-22** — expected at standard US$9.99/mo unless promo/proration continues; verify against statement |

---

## 🧪 One-off / ad-hoc costs

| Date | Item | Purpose | Original | Rate | **SGD** | Status |
|---|---|---|---|---|---|---|
| 2026-09-25 | **Style-D fidelity spike — budget approved** (stakeholder) | Prove low-poly 3D × ink brush is achievable via hosted APIs (fal/Replicate credits) before provider lock-in | US$10–20 budget · **actual US$4.49** | 1.2771 ⚠ placeholder | **S$5.73 actual** (est. — 4.49 × 1.2771) | ✅ approved · **spent 2026-09-26** (133 runs, well under cap ✅) — *estimate; final fal invoice to reconcile at SCRUM-41 close (due 2026-10-06)* |

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
| ~~when the style-D spike runs~~ **spike ran 2026-09-26** | reconcile final USD→SGD @ Mastercard rate | → Jira **SCRUM-41** (due 2026-10-06): actual **US$4.49 / 133 runs** recorded (est. S$5.73 ⚠ placeholder) — apply Mastercard rate when fal invoice/statement lands, then close |
| conditional | Apple Developer US$99/yr | only if/when iOS ships |

> ⚠️ **Calendar note (2026-09-25):** the Circleback MCP is **read-only** (search-only — it cannot create events or action items) and currently returns **zero calendar events** (no calendar connected/synced yet). Billing reminders therefore live in **Jira as dated action items** + this page. If calendar-write tooling is connected later, mirror these dates into the calendar.

**Instruction for future AI:** when any date above arrives → open the Jira item, record the charge per the rules at the top of this page (SGD @ Mastercard market rate), update *Budget summary*, then **roll the calendar forward** by creating the next dated Jira item (22nd of the following month).

---

## 📊 Budget summary

| Category | SGD |
|---|---|
| Committed recurring (ClinePass / month) | S$12.76 |
| Style-D spike — **actual** (2026-09-26, est. @1.2771 ⚠, pending fal invoice) | **S$5.73** (US$4.49 / 133 runs — under the US$20 cap ✅) |
| **Total known outlay (first month, incl. spike actual)** | **≈ S$8.44** (ClinePass actual S$2.71 + spike actual S$5.73) |
| Actual spend to date (ClinePass, this month) | S$2.71 (US$2.12) |
| Paid services running | none yet (all free tiers) |

*Soft-limit posture: cost kept low — everything runs on free tiers except ClinePass (the development agent itself) and the approved spike.*

---

## 🧭 Decision log (cost-relevant)

- **2026-09-25** — **Hosted APIs from day one** for the AI pipeline (bg removal / ID / cartoonize), stakeholder decision — rationale: *"make sure deployment is fine from day 1"*. No self-hosted GPU capex.
- **2026-09-25** — **Style-D spike approved** at US$10–20 budget (see one-offs).
- **2026-09-25** — **iOS out of MVP scope** (platform must support later; avoids $99/yr Apple fee for now).
- **2026-09-26** — **Style-D spike executed** (SCRUM-41): **US$4.49 / 133 runs final** — far under the US$20 cap.
- **2026-09-26** — **ADR-002 accepted: Path C** (describe-then-generate: `moondream2` → `nano-banana-2` t2i ≈ **US$0.10/picture**; edit recipe = fallback); **economy v1 locked** (10-economy-spec): credits **$1.55/1,000** · fee 150 · starter 2,000 · sign-in 100 store pts + 150 credits/day · free-photo cap 15/mo · ads post-ritual only · production AI budget ≈ $0.10/photo (budget rows below updated from cartoonify-era estimates).
- Context: [[06-tech-stack-options]] · Jira SCRUM-10 · SCRUM-18 · SCRUM-41

---

## 📏 Rate reference

- **Mastercard converter (authoritative for entries)**: <https://www.mastercard.us/en-us/holders/get-support/currency-conversion.html>
- Placeholder source used on 2026-09-25: mid-market USD→SGD **1.2771** (ECB via Frankfurter API, date 2026-09-25)
- Cross-currency fees: possible (e.g. ClinePass "additional processing fee may apply") — capture statement actual when it lands.

---

*Last updated: 2026-09-26 — **style-D spike actual logged** (US$2.63 = est. S$3.36 @1.2771 ⚠ placeholder; 86 runs ≤ US$20 cap; recipe locked, ADR-002 pending) per SCRUM-41.*
*Updated 2026-09-25 — page created (session 16); ClinePass + spike budget logged; first-month actual **US$2.12 = S$2.71** recorded, **next charge 2026-10-22**.*
