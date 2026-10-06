# 20 · Business registration & compliance — Singapore sole proprietor

**Date:** 2026-10-05 (research session) · **Jira:** **SCRUM-65** (epic) with children **SCRUM-66 … SCRUM-78** (B1–B13) · **Status:** ✅ **research complete — every fact below is sourced and dated.** The *doing* is the tickets.
**Depends on:** [[12-security-and-legal-scoping]] §B.5 (PDPA baseline · GDPR design target) · [[13-privacy-and-retention]] §1/§7/§9 (the data inventory, the DPO, the delete runbook) · [[ADRs/ADR-007-privacy-minimal-windowed-one-tap|ADR-007]] · [[19-build-plan-services-api-environments]] §4 (what bills, and the deferred Play Console line)
**Feeds:** SCRUM-65 … SCRUM-78 · `project-costs.md` (every fee below becomes a row when it is paid) · [[12-security-and-legal-scoping]] (the entity now exists to hold the policies)

> **In one line:** the app is nearly ready to have a *legal person* behind it — Play billing, a PDPA DPO with a published contact, and a tax return all require one — so this doc is the **sourced answer for Singapore**, and the milestones (B1–B13) are the tickets that execute it.

---

## 1 · Why an entity is needed at all

Five things already decided in the specs quietly require a legal person. None of them can be satisfied by "the PM personally, unofficially".

| # | Driver | What actually forces it |
|---|---|---|
| 1 | **Play billing** | The cash shop sells **digital goods** → Google Play Billing is mandatory → Play requires a **developer account with a legal name, a public developer profile and a payments profile** ([[12-security-and-legal-scoping]] §B.7; economy floor is §B.7's open question, tracked in **SCRUM-43**) |
| 2 | **PDPA** | The app holds photographs, ancestors' names and coarse location. The PDPA binds an **organisation** and requires an appointed **DPO whose business contact details are made available** — doc 12 §D7 already nominated the PM; this is the *paperwork* half |
| 3 | **Tax** | Sole-proprietor profit is **the owner's income** — it has to appear on a return; Play payouts and fal.ai spend need a paper trail either way |
| 4 | **Contracts** | The **fal.ai DPA**, the **Play Developer Distribution Agreement**, any ad-network contract, and the **ToS/privacy policy** each name an entity |
| 5 | **Store display rules** | Play *publishes* the developer's legal name, country, developer email/phone — and the **full address** once the app monetizes. There is no way to sit behind "an individual" for an organization listing |

**What this doc is not:** legal advice. It is a sourced operating checklist — the same posture as [[12-security-and-legal-scoping]] §B.5 (*"rules below are design inputs, not legal advice"*).

---

## 2 · The entity decision — sole proprietorship (and what is being accepted)

**Decided (PM): register as a Singapore sole proprietorship.** Recorded here as the decision of record; the alternatives are kept only so the choice can be **re-priced later** (trigger list → **B13 · SCRUM-78**).

| | **Sole proprietorship** ✅ chosen | LLP | Pte Ltd |
|---|---|---|---|
| **Legal personality** | **none** — the owner *is* the business | separate | separate |
| **Liability** | **unlimited, personal** | limited (partners liable for own acts) | limited |
| **Setup cost** | **S$115** (name S$15 + registration S$100) | ~S$115 + LLP agreement | ~S$315+ (name + incorporation) + ongoing |
| **Ongoing statutory load** | renewal only | renewal + annual declaration | company secretary, annual return, audit-if-threshold, filings |
| **Tax** | **personal income tax rates** on profit | personal rates per partner | 17% corporate + partial exemptions |
| **Play organization account** | ✅ possible (B11) | ✅ | ✅ |
| **Perpetuity / sellable** | ❌ | partial | ✅ |
| **Right when** | hobby→early revenue, one person, low liability exposure | two+ people, wanting liability sharing without a company | revenue, hiring, investors, meaningful liability |

**The honest statement of risk being accepted:** a data-protection claim touching family photographs and ancestors' names would land on **personal assets**. Doc 12 §A.1 ranks exactly that data as the project's top asset. The mitigation today is **technical**, not corporate: RLS everywhere, private buckets, 7-day raw windows, delete-all, names never in logs (doc 12 §A.2–A.3, ADR-007) — which is *why* the technical posture is not optional.

**The counterweights that make the sole prop right now:** S$115, no audit, no company secretary, and an organization Play account is still available. The judgement has an **expiry date** → **B13**.

---

## 3 · Registration — who, what, how much

*Sources: ACRA — *Registering a sole proprietorship or partnership* (page updated 2026-03-25) and *Service & transaction fees: Sole proprietorships & partnerships* (updated 2026-02-06) — both checked **2026-10-05**.*

### 3.1 Who may register

| Situation | Rule |
|---|---|
| Citizen / PR with **Singpass** | Register yourself. **Only the person who reserved the business name can register the business** — they must be an owner (or an authorised representative if all owners are not locally resident) |
| Foreigner **without** Singpass | **Must engage a corporate service provider (CSP)** to register |
| **All owners live overseas** | One **authorised representative who is ordinarily resident** in Singapore is required |
| Filing via a CSP | The CSP files with **Corppass** |

### 3.2 What has to be prepared

| Item | Detail |
|---|---|
| **Approved name + eService number** | from B2. ⚠️ You must register the **same entity type** you reserved |
| **Singpass / Corppass** | individuals vs CSP |
| **Proposed commencement date** | when the business starts |
| **Business email address** | required at registration — plan it in B6 |
| **Business address** | the main operating address. **A P.O. Box is not allowed.** A small business run from home is allowed under the **Home Office Scheme** only with **HDB** approval (HDB residents) or **URA** approval (private property) **before** registering |
| **Owner's personal details** | **NRIC/FIN**, full name, date of birth |
| **Owner's residential address** | ⚠️ **ACRA sends all official letters here** — including the renewal reminder. Keep it current |
| **Contact address · email · mobile** | used for notices and the renewal SMS |

### 3.3 The five steps (Bizfile)

1. Log in to Bizfile → **"Register new business entity"**.
2. Enter the **business details** (commencement date, business email, business address).
3. **Add owners** — a sole proprietorship needs at least one; a nominee/trustee must declare their beneficiary type.
4. Choose the **registration period (1 year or 3 years)**, review, read and tick the declaration, then **pay**. *Optional: buy a special unique UEN.*
5. Check the **Bizfile inbox**: **Notice of successful registration** + **UEN** + the link to a **free Business Profile**.

### 3.4 Fees (published, SGD)

| Transaction | Fee |
|---|---|
| Apply for new business entity **name** | **S$15** |
| **Register** new business entity | **S$100** |
| **Renew** business registration | **S$30** |
| Convert to a limited liability partnership (LLP) | S$40 |
| File a Notice of Error (general lodgement) | S$60 |

⚠️ **Verify at the payment screen.** The published table shows a single **S$100** registration figure and a **S$30** renewal figure, while the *period* is chosen as **1 or 3 years** — confirm the **3-year** total at payment and record what was actually paid (B3). Every fee once paid becomes a row in `project-costs.md`.

### 3.5 The two outputs to bank

1. **The UEN** — the key for Corppass, GST, the bank, and the Play payments profile.
2. **The Business Profile PDF** — ⚠️ the free copy **expires 60 days** after registration. This is the document Google Play accepts as an *"extract from commercial register"* (B11) and that the bank asks for (B5). **Save it outside Bizfile.**

## 4 · After registration — the obligation map

*Source: ACRA — *Post-registration guide: Sole proprietorship or partnership* (updated 2026-04-01) and *Overview of managing a sole proprietorship or partnership* (updated 2026-07-20) — checked 2026-10-05.*

| When | Obligation | Ticket |
|---|---|---|
| **Immediately** | Open a **corporate bank account** — ACRA names ANEXT Bank, Bank of China, CIMB, DBS, Maybank, OCBC, State Bank of India, UOB, and notes it can be opened right after Bizfile registration | **B5** |
| **Immediately (required)** | Apply for **Corppass** — the single login for **all** government-to-business transactions, Bizfile included; apply **one day after** the UEN is issued | **B4** |
| **Immediately** | Check **licences and permits** with the **GoBusiness Licence e-Advisers** — if none are needed, trading can start immediately after registering | **B8** |
| **Immediately** | Download the free **Business Profile** (within **60 days**) | **B3** |
| **Before trading** | *(Employers)* CPF Submission Number + employment-law duties — **not applicable at hobby scale**; revisit only if hiring | — |
| **Before trading** | **Data protection**: appoint a **DPO**, publish the contact, adopt a policy | **B7** |
| **Before trading** | **Taxes**: myTax access, records, Form B | **B9** |
| **Ongoing** | **Renew** every 1 or 3 years · **update information within 14 days** of any change · **use the registered name only** · **MediSave** arrangements | **B10 · B12** |
| **Optional** | **Trade mark** at IPOS · **InvoiceNow** e-invoicing · **SMS Sender ID** registration · cybersecurity resources | **B8** · SCRUM-43 B.6 |

---

## 5 · Tax — a sole proprietor *is* the taxpayer

*Source: IRAS — *Filing responsibilities of self-employed individuals* · *Check if you need to register for GST* · *Compulsory and voluntary MediSave contributions* (checked 2026-10-05).*

| Item | Rule |
|---|---|
| **Who is taxed** | The **individual**. A sole proprietorship is **not a separate taxpayer** — there is no 17% corporate tier and no corporate filing |
| **Which return** | **Form B** — the return for individuals with trade/business/profession income |
| **Deadline** | **18 April** (paper window 1 Mar → 18 Apr; e-filing runs to 18 Apr) |
| **Statement length** | revenue **≤ S$200,000** → **2-line statement** (revenue · adjusted profit/loss) · revenue **> S$200,000** → **4-line statement** (revenue · gross profit/loss · allowable deductions · adjusted profit/loss) |
| **Records** | Proper records/accounts are required and retained — the practical reason to keep business spend separate from personal money |
| **Relief** | The **mandatory MediSave** contribution is **fully tax-relieving** (§6) |
| **Deductible spend** | fal.ai, Supabase, domains, Play fees — the app's own operating costs **are** business expenses. `project-costs.md` becomes the seed of this record |

### 5.1 GST — a watch, not a task

* **Threshold: S$1,000,000 taxable turnover.** Below it, IRAS says **no action is required** — keep monitoring.
* **Two bases of liability:** **retrospective** (taxable turnover in the past calendar year exceeded S$1M) and **prospective** (you can reasonably expect the next 12 months to exceed S$1M). Deadline mechanics — retrospective: apply by **30 January** of the following year; prospective: within **30 days**. ⚠️ Re-read IRAS's page if the threshold is ever approached.
* ⚠️ **Why the watch is serious:** a late registration still requires **accounting for GST on past turnover even though none was collected**. IRAS reports it finds ~100 late registrations a year, each paying on average **~S$100,000** in GST and penalties.
* **Decision recorded:** **do not register voluntarily** below the threshold — quarterly filing and price-visible tax on a S$1.19 floor, with no recoverable input tax at this scale.
* **The trigger to re-check:** when the **cash shop** (or any ad revenue) starts — **Play revenue counts toward taxable turnover**.
* **Mechanics when it happens:** GST registration is filed via **myTax** and requires **Corppass authorisation** for IRAS digital services (B4).

---

## 6 · MediSave — the obligation that can cancel the business

*Source: ACRA — *Overview of managing a sole proprietorship or partnership* / *Renewing your registration for sole proprietorships or partnerships* · CPF — *Saving as a self-employed person* (checked 2026-10-05).*

| Rule | Detail |
|---|---|
| **Threshold** | If **annual net trade income exceeds S$6,000**, you must have arranged with CPF to pay MediSave **in full** or **by monthly instalments** |
| **⚠️ Consequence** | With **outstanding MediSave payable**, ACRA **may cancel the business registration early**, notifies all owners — and **will not process the renewal** |
| **⚠️ GIRO timing trap** | Setting the arrangement up is not enough: the renewal is still refused until the **first GIRO deduction has actually been taken** (applications by the 15th deduct on the 25th; later ones the following month) |
| **When it starts** | The payable is computed from the **net trade income IRAS assesses** — so it arrives with the **first Form B**, not on day one. Which is exactly why it is worth knowing *before* the first renewal |
| **Upside** | The mandatory contribution is **fully tax-relieving**, and it is the owner's own healthcare savings — not a fee |
| **Adjacent** | CPF's self-employment scheme also ties some **licence applications/renewals** to MediSave standing; **CAYE** (*Contribute As You Earn*) applies if corporate buyers ever pay the business |

---

## 7 · Data protection — the DPO duty the entity must discharge

*Sources: PDPC — *Getting Started as a Data Protection Officer (DPO)* / *Kickstart Your Data Protection Journey* (page published 2026-09-01, checked 2026-10-05); the PDPA posture itself was verified in-repo earlier ([[12-security-and-legal-scoping]] §B.5, 2026-09-27).*

### 7.1 What is legally required, and what is merely good practice

| | Requirement | Basis |
|---|---|---|
| **Required** | **Appoint a Data Protection Officer** and **make the DPO's business contact information available** | PDPA; doc 12 §D7 |
| **Required** | **Purpose notices** at collection, retention limits, access/correction/erasure, breach notification | doc 12 §B.5 (PDPA is the mandatory baseline; GDPR is the design target) |
| **Expected route** | **Register the DPO with PDPC** — PDPC's own guidance for organisations opens with *"Step 1: Register Your DPO — submit or update your DPO's details and have them published in the **DPO Registry**"* | PDPC guide |
| **Good practice this project already has** | the inventory, windows, consent copy, runbooks | [[13-privacy-and-retention]] · [[ADRs/ADR-007-privacy-minimal-windowed-one-tap\|ADR-007]] |

**Who:** the **PM**, per doc 12 §D7 — the DPO function is a co-ordination role, not a lawyer's job, and at hobby scale there is no one else. **Publish a contact** (policy + the B6 website): an unregistered, unpublished DPO is the common failure mode.

### 7.2 One inventory, three artifacts — do not build a second list

Doc 12 §D8 still holds: the **single inventory from doc 13 §1** feeds all three of

1. the **PDPA purpose notices**,
2. the **Play Data Safety form** ([[12-security-and-legal-scoping]] §B.5 hook 2 → **SCRUM-43 / SCRUM-19**), and
3. the **GDPR Art. 13 disclosures** (if EEA-listed).

### 7.3 The two runbooks that make the policy real

* **Breach** — doc 12 §D6: who decides, the **3-day PDPC** clock and the **72h GDPR** clock, where events are logged (*never* photo bytes or ancestor names — doc 12 §A.3 S7).
* **Delete-all** — doc 13 §9: the children-first transaction, storage purge, the receipt, the verification probe. The **in-app implementation is SCRUM-33**, and its **account-deletion URL is a Play submission blocker** (doc 13 §9.9).

### 7.4 Two things worth restating before the family alpha opens

1. **PDPA applies from day one and size is not a shield** — doc 13 §7: *"small and private ≠ exempt — it is real data under real law."* The family alpha therefore runs **the PM's own data through the real delete runbook first** (doc 13 §9 item 10).
---

## 8 · Google Play — the entity-facing part

*Source: Google Play Console Help — *Get started with Play Console* · *Required information to create a Play Console developer account* · *Google Play Developer Verification: required documents by country and region (Singapore)* (all checked **2026-10-05**).*

### 8.1 Personal or organization account?

**Organization.** Two reasons:

1. A **personal** account created after **13 November 2023** must first satisfy **additional testing requirements** — a closed test with testers over a continuous period — plus device verification, before it can distribute on Play. An organization account has no such gate.
2. The organization shape is the one that matches the registered business, and it is what carries a **public legal name + address**.

### 8.2 Cost and eligibility

| | |
|---|---|
| **Fee** | **US$25, one-time** |
| **Payment** | Credit/debit only — MasterCard, Visa, American Express (Discover, U.S. only; Visa Electron outside the U.S.); **prepaid cards are not accepted** |
| **Age** | The registrant must be **18 or older** |
| **Also required at signup** | accept the **Google Play Developer Distribution Agreement**; Google may ask for a **valid government ID and a credit card in the same legal name** — if those are invalid the fee is **not refunded** |

### 8.3 Required information (organization account)

| Field | Notes |
|---|---|
| **Developer name** | can differ from the legal name; **shown publicly** |
| **D-U-N-S number** | verified against the payments profile → §8.5 |
| **Organization name + address** | taken from the linked **Google payments profile**; must match ACRA **exactly** |
| **Organization phone** | required |
| **Organization website** | required → **B6** |
| **Contact name · contact email · contact phone** | how Google reaches you (not published) — the contact email should be an **organization** address, not generic/personal |
| **Developer email + developer phone** | **published** on the developer profile; Google warns it **may remove apps** if they become inaccessible |

### 8.4 Verification — Google requires **two kinds** of document

> Google: *"Organizations are required to provide 2 different types of documentation for developer verification: **organization registration documents** **and** a government-issued photo ID from an authorized representative."*

| Type | Accepted (verified list) | What we use |
|---|---|---|
| **Organization registration document** | *Certificate of incorporation or registration* · ***Extract from commercial register*** · *Business licence* · *Tax certificate* | the **ACRA Business Profile** saved in **B3** |
| **Authorized representative's photo ID** | passport · identification card · driving licence · permanent residence card — *can be issued in any country* | For **Singapore**: a **Singaporean government-issued photo ID** **plus a proof of address** (govt photo ID showing the address, utility bill, insurance statement, credit-card or bank statement) **matching the profile** |

**Hard rules that cause failures:**

* ⚠️ All documents must **match the payments profile exactly** (personal details, organization name, address). Google names mismatch as the **primary reason verification fails** — the profile can be corrected *during* verification.
* ⚠️ **Never submit an unsupported, modified or fake document** — Google states modified/fake documents can lead to **immediate account and app removal**.
* The photo ID must be **valid (not expired), in colour, clear, well lit, and not a photocopy**.

### 8.5 ⚠️ The trap — D-U-N-S has lead time

* The number is **free from Dun & Bradstreet**. Google explicitly warns about **third-party services charging large administrative fees for a free process** — do not pay one.
* A **small sole proprietorship is frequently not yet in D&B's database**, so the record has to be **requested and created**. Treat this as the epic's only **long-latency** item: **request it the day the UEN exists** (right after B3), not when the app is ready to upload.
* The **legal name and address supplied to D&B must match the ACRA registration** — the same exactness the Play verification demands.

### 8.6 What becomes public

---

## 9 · Trade mark — *not* covered by business registration

*Source: IPOS — *Trade Marks Overview → Forms and Fees* (page updated 2026-09-03; fee-update circulars effective 2025-09-01 and 2026-04-01) — checked 2026-10-05.*

**Registering the business name with ACRA does not give you the mark.** ACRA registration prevents an *identical/too-similar business name* being registered with ACRA; it is **not** an exclusive right to use the name as a brand, and it does nothing about an app-store-listing squatter. A **trade mark at IPOS** is the instrument that does — and it is the only IP item here that a court will enforce.

| IPOS form | What | Fee |
|---|---|---|
| **TM4** | Application to register a trade mark — specification items **fully adopted** from IPOS's Classification Database of pre-approved descriptions | **S$280 per class** |
| **TM4** | Same, where the specification does **not** fully adopt the pre-approved list | S$410 per class |
| (acceleration) | *SG Trade Marks Fast* first-examination acceleration (requested only at filing) | + S$200 / + S$250 per class |
| **TM19** | Renewal on/before expiry · late renewal · restoration | **S$480** · S$700 · S$770 per class |

**Notes for us:**

* **Use the Classification Database.** IPOS *strongly encourages* the pre-approved descriptions — it both avoids objections and reduces cost (S$280 vs S$410/class) and processing time.
* **Timing:** this belongs *before* any public store listing — it is already tracked as **SCRUM-43 §B.6**, and it is the one legal item whose cost (S$280+) exceeds the entire registration. The decision of *whether* to file pre-launch is therefore a real one, not a formality.
* **It is not a blocker** for the Play submission (Google does not require a registered mark), so it is deliberately **not** a milestone ticket here — only cross-referenced.

---

## 10 · The cash needed

*All figures are published fees; every one becomes a row in `project-costs.md` when actually paid (SGD, with the Mastercard rate recorded for anything billed in USD).*

| Item | Amount | Ticket |
|---|---|---|
| ACRA — business **name** application | **S$15** | B2 |
| ACRA — business **registration** | **S$100** | B3 |
| Google Play Console registration | **US$25** (one-time) ≈ **S$32** | B11 |
| **Core total to be fully registered + Play-verified** | **≈ S$147** | — |
| Business address — *if* a virtual office is chosen (the alternative is the free Home Office Scheme route) | ~S$20–40/month | B1 |
| Business domain + email alias | ~S$15–20/year | B6 |
| ACRA renewal | **S$30** per renewal (1 or 3-year period) | B12 |
| Trade mark (optional, and the big one) | **S$280/class** (+ $200 acceleration; + agent fees if an agent files) | SCRUM-43 §B.6 |

**Two accounting notes:**

1. All of the above are **deductible business expenses** against the app's income (B9) — keep the receipts in the records folder from the first payment, not reconstructed at year end.
---

## 11 · The compliance calendar — the recurring routine *(deliverable: B12 commits this)*

*The point of this table is that a future session — or a future you — can run the obligations without re-researching them. Every row was verified on 2026-10-05; the source URLs are in §13.*

| When | What | Where | If missed |
|---|---|---|---|
| **Once, at start** | Reserve the name (**S$15**) → register (**S$100**) → download the Business Profile | Bizfile | cannot trade legally under the name |
| **Once, immediately after** | Bank account · Corppass (+ ACRA e-services access) · licence check · PDPA DPO · MyTax/records | see B5–B9 | renewal becomes impossible; compliance gaps open |
| **Within 60 days of registration and each renewal** | Download the free **Business Profile** | Bizfile inbox | the free copy expires (paying for it later is avoidable) |
| **Within 14 days of ANY change** | Lodge the change (address · email · owner details) | Bizfile | **late lodgement penalties** |
| **Before every renewal** ⚠️ | Confirm **MediSave** standing — full payment or an instalment arrangement, with at least the **first GIRO deduction taken** | CPF Self-employment dashboard | **ACRA will refuse the renewal** and may cancel the registration early |
| **Every 1 or 3 years** (window opens **60 days before** expiry) | **Renew** the business registration (**S$30** published) | Bizfile via Corppass | penalties; entity may be **cancelled 60 days after expiry** |
| **By 18 April, annually** | File **Form B** (2-line if revenue ≤ S$200k, else 4-line) | myTax | penalties + interest |
| **Continuously, reviewed quarterly** | **GST watch** — taxable turnover vs **S$1,000,000** (retrospective + prospective bases) | myTax / own books | late registration forces GST on **past** turnover (~S$100k average case) |
| **On any data incident** | Run the **breach** runbook — **3-day** PDPC clock (72h GDPR if EEA) | doc 12 §D6 | regulatory penalties |
| **Annually** | Records/accounts tidy · reuse the **single data inventory** for the notices + Play Data Safety + GDPR · check the **AI-budget stop-rule** | repo + Play Console | tax reconstruction pain; unbounded spend |
| **Annually** | **"Is the business still the right shape?"** — run the B13 trigger list | this doc §2 | the sole-prop risk is accepted by **default** rather than by decision |
| **Whenever the app monetizes** | Confirm the Play payments profile + tax position for the revenue stream | Play Console / myTax | payout holds; under-declared income |

---

## 12 · Open questions — confirm *at the time*, not now

| # | Question | Why it is left open | How it closes |
|---|---|---|---|
| 1 | The **3-year** registration total | ACRA's published table shows a single **S$100** registration figure and a **S$30** renewal figure, while the period is chosen at payment | read the total on the **payment screen** and record what was paid (**B3**) |
| 2 | The **country-specific** Play organization document list | Google states the two required document *types* and the accepted generic list (*certificate of incorporation or registration · extract from commercial register · business licence · tax certificate*); the rendered Singapore list surfaced the **individual** documents, not a separate organization enumeration | the **Play Console verification task** shows the accepted set for *this* profile — confirm there before submitting; the **ACRA Business Profile** is the natural *extract from commercial register* (**B11**) |
| 3 | Whether **D&B already holds** the business | unknown until asked | request the D-U-N-S immediately after the UEN and let the **lead time** run (**B11**) |
| 4 | Whether **any licence** is required | product-specific | the **GoBusiness e-Adviser verdict** is the answer of record (**B8**) |
| 5 | **GST** application deadline mechanics | the **threshold and both bases** are verified; the deadline wording should be re-read only if the threshold is approached | re-read IRAS when turnover nears S$1M (**B9**) |
| 6 | Is **PDPC DPO registration** mandatory or merely expected? | the **duty** (appoint + make the contact available) is clear; registration is how PDPC's own guidance says to complete it | treat registration as the completion of the duty — no grey area worth litigating (**B7**) |

---

## 13 · The ticket map & sources

### 13.1 The milestones

| # | Ticket | What it does | Traps |
|---|---|---|---|
| — | **`SCRUM-65`** | **Epic** — the whole of this doc | — |
| **B1** | `SCRUM-66` | Lock the business identity — registered name · address route · public legal name | blocks everything; **the address is a public display decision** |
| **B2** | `SCRUM-67` | Reserve the business name (Bizfile, **S$15**) | reserved names lapse — reserve and register in one sitting |
| **B3** | `SCRUM-68` | Register the sole proprietorship (**S$100**) → **UEN** + Business Profile | ⚠️ the free Business Profile **expires in 60 days** |
| **B4** | `SCRUM-69` | Corppass + ACRA e-services access | required for **every** government transaction, renewals included |
| **B5** | `SCRUM-70` | Business bank account | where Play pays out and where the **MediSave GIRO** runs |
| **B6** | `SCRUM-71` | Business email · phone · live URL | Play **publishes** the developer email + phone |
| **B7** | `SCRUM-72` | PDPA — DPO appointed, registered, published; policy v1 | one **inventory** feeds three artifacts |
| **B8** | `SCRUM-73` | Licence/permit check (GoBusiness e-Adviser) | file the verdict; decide the SMS Sender ID |
| **B9** | `SCRUM-74` | Tax — myTax · records · **Form B by 18 Apr** · **GST watch (S$1M)** | late GST registration taxes **past** turnover |
| **B10** | `SCRUM-75` | MediSave / CPF self-employment arrangement | ⚠️ **outstanding MediSave blocks/cancels the renewal** |
| **B11** | `SCRUM-76` | Play Console **organization** account | ⚠️ **D-U-N-S lead time**; documents must match the payments profile exactly |
| **B12** | `SCRUM-77` | Compliance calendar + one-page runbook | puts the MediSave check **before** every renewal |
| **B13** | `SCRUM-78` | Decision — the **incorporation trigger** | names when the sole prop stops being right |

### 13.2 Sources — every one checked **2026-10-05**

**ACRA (Singapore)**
* *Registering a sole proprietorship or partnership* — <https://www.acra.gov.sg/register/business/registering-different-business-structures/sole-proprietorship-or-partnership/> (page updated 2026-03-25)
* *Service & transaction fees: Sole proprietorships & partnerships* — <https://www.acra.gov.sg/manage/sole-proprietorship-partnerships/service-transaction-fees/> (updated 2026-02-06)
* *Post-registration guide: Sole proprietorship or partnership* — <https://www.acra.gov.sg/register/business/after-registering/sole-proprietorship-or-partnership/> (updated 2026-04-01)
* *Overview of managing a sole proprietorship or partnership* — <https://www.acra.gov.sg/manage/sole-proprietorship-partnerships/overview/> (updated 2026-07-20)
* *Renewing your registration for sole proprietorships or partnerships* — <https://www.acra.gov.sg/manage/sole-proprietorship-partnerships/key-requirements-common-offences/renewing-your-registration/> (updated 2026-07-20)

**IRAS**
* *Filing responsibilities of self-employed individuals* — <https://www.iras.gov.sg/taxes/individual-income-tax/self-employed-and-partnerships/tax-obligations-of-self-employed-persons/filing-responsibilities-of-self-employed-persons-(including-individual-partners)>
* *Do I need to register for GST* — <https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/gst-registration-deregistration/do-i-need-to-register-for-gst>
* *Check if you need to register for GST* — <https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/gst-registration-deregistration/check-if-you-need-to-register-for-gst>
* *Compulsory and voluntary MediSave contributions* — <https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-reliefs-rebates-and-deductions/tax-reliefs/compulsory-and-voluntary-medisave-contributions>

**CPF**
* *Saving as a self-employed person* — <https://www.cpf.gov.sg/member/growing-your-savings/cpf-contributions/saving-as-a-self-employed-person>

**PDPC**
* *Getting Started as a Data Protection Officer (DPO)* — <https://www.pdpc.gov.sg/organisations/resources/getting-started-as-a-data-protection-officer-dpo> (published 2026-09-01)

**Google Play Console Help**
* *Get started with Play Console* — <https://support.google.com/googleplay/android-developer/answer/6112435>
* *Required information to create a Play Console developer account* — <https://support.google.com/googleplay/android-developer/answer/13628312>
* *Developer verification: required documents by country and region (Singapore)* — <https://support.google.com/googleplay/android-developer/answer/15633622?co=GENIE.CountryCode%3DSG&hl=en>

**IPOS**
* *Trade Marks — Forms and Fees* — <https://www.ipos.gov.sg/about-ip/trade-marks/forms-and-fees/> (updated 2026-09-03)

**In-repo (verified earlier, reused here):** [[12-security-and-legal-scoping]] §B.5 (sources checked 2026-09-27) · [[13-privacy-and-retention]] §1/§7/§9 · [[ADRs/ADR-007-privacy-minimal-windowed-one-tap|ADR-007]] · [[19-build-plan-services-api-environments]] §4.

---

*Last updated: 2026-10-05 — research session. **`SCRUM-65`** opened with **B1–B13** filed as `SCRUM-66`…`SCRUM-78`. Nothing has been filed with ACRA yet — every step is a ticket.*
