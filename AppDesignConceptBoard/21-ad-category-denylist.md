# 21 · Ad-category denylist — the Singapore basis, and the enforceable list

**Date:** 2026-10-05 (research session) · **Jira:** **SCRUM-63** (split out of **SCRUM-62** = ADR-008 clause D) · **Status:** ✅ **research complete — every legal claim below is sourced and dated**; the list is now code plus a gate (`npm run check:ads`)
**Depends on:** [[ADRs/ADR-008-advertising-posture-never-inside-the-ritual|ADR-008]] (the accepted posture) · [[12-security-and-legal-scoping]] §B (the legal register — S9/D10) · [[10-economy-spec]] §1/§5 (the placement rule · revenue side) · [[16-cultural-consultation-and-ritual-review]] Q9 + §5 (the practitioner question, and the public pre-commitment)
**Feeds:** `src/domain/adCategories.ts` · `src/domain/checks/ads.ts` (**`npm run check:ads`**) · ADR-008 clause D (wording drafted → §7.1) · [[12-security-and-legal-scoping]] §B.10 · the **ad SDK selection** (now unblocked) · SCRUM-49

> **In one line:** three of the five blocked classes are compelled by **Singapore law** and one by a **regulator's directions** — but **alcohol is compelled by nothing except us**; the enforceable list is now machine-readable code with a fault-tested gate, so the SDK can be chosen against a contract instead of a prose intention.

---

## 1 · What SCRUM-63 asked, and where each answer is

| # | The question | Where |
|---|---|---|
| **1** | What exactly counts in each blocked category? | **§3** — the taxonomy, implemented as `AD_CLASSES` |
| **2** | What are the Singapore rules? Mandated or best practice? | **§2** — the headline finding |
| **3** | What does the SDK already block? | **§4** — verified for AdMob and AppLovin; Unity/Meta still to read |
| **4** | How do we enforce it? Can it be machine-checkable? | **§5** — three layers; layer 3 is `check:ads` |
| **5** | Does geo-targeting change the list? | **§6** |

**The ticket's five deliverables, and where they landed**

| Deliverable (SCRUM-63 §4) | Where it is |
|---|---|
| A written category taxonomy per class, precise enough to implement | **§3** + `src/domain/adCategories.ts` |
| A Singapore legal basis per class, with sources — *requirement* vs *recommendation* | **§2** |
| A candidate-SDK comparison + the residual gap we must fill | **§4** |
| An enforcement design, machine-checkable rather than a code-review convention | **§5** + **`check:ads`** (51 assertions, fault-tested red) |
| Feed the result back into ADR-008 D and doc 12 §B | **§7** — ADR wording drafted; doc 12 **§B.10** added |

---

## 2 · The Singapore legal basis — and the finding that matters

*Every row verified **2026-10-05**. Primary sources in §9.*

| Class | Instrument | Regulator | Mandated or our policy? | The operative fact |
|---|---|---|---|---|
| **Gambling** | **Gambling Control Act 2022** | Gambling Regulatory Authority (GRA); Singapore Police Force | 🔴 **Mandated — criminal** | *"it is an offence to advertise unlawful gambling activities in or from Singapore or from outside Singapore to persons situated in Singapore"* — an individual is liable on conviction to a fine up to **$20,000**. Separately: *"All forms of advertising and promotion by licensed gambling operators are prohibited unless otherwise approved by GRA."* |
| **Loans / credit** | **Moneylenders Act 2008 s.29(3) r/w s.45(1)** → **Registrar's Directions on Advertising & Marketing Activities of Licensed Moneylenders** (v3.0, wef **2025-04-01**) | Registry of Moneylenders (Ministry of Law) | 🔴 **Mandated — for the liable party** | The directions permit a licensee to advertise *"in the following manner **only**"*: business/consumer **directories**, **its own internet website**, and materials within or on the exterior of **its own premises**. Expressly **not permitted**: paid-for internet links (*"sponsored links"*), materials on **social-media or video-hosting sites**, **SMS / WhatsApp / WeChat / email** to the public or past patrons, and soliciting outside the premises. **No entry on that closed list reaches a third-party app's ad slot.** |
| **Alcohol** | **— no statute.** Self-regulatory only: **ASAS Singapore Code of Advertising Practice, Appendix K** | Advertising Standards Authority of Singapore (industry body) | ⚪ **NOT mandated — our own stricter policy** | Singapore has **no statutory prohibition on alcohol advertising**. Appendix K is audience-focused advice: children not portrayed drinking (if present in a natural family scene, *"made clear that they are not drinking"*); ads not directed at young people; anyone shown drinking *"obviously over 18"*; no unsafe-activity depiction; *"never encourage over-indulgence"*. **Google permits alcohol ads to be served in Singapore** — SG is on its country list — so this inventory *can* arrive. |
| **Tobacco & vaporisers** | **Tobacco and Vaporisers Control Act 1993** (formerly the Tobacco (Control of Advertisements and Sale) Act) | Health Sciences Authority (HSA) | 🔴 **Mandated — statutory** | The prohibition on tobacco advertisements was **extended to cover e-cigarettes and similar products**, and — the point for us — the ban **expressly extends to advertisements published electronically**, including advertisements originating in Singapore *"whether targeting local or foreign audiences"*. Vaporisers are also "imitation tobacco products": they cannot be imported, sold, bought or possessed. |
| **High-sugar drinks** | **Food Regulations reg. 184E–184F** (Food (Amendment No. 2) Regulations 2021) | Singapore Food Agency / MOH / Health Promotion Board | 🔴 **Mandated — statutory** | *"Advertisements related to Nutri-Grade beverages graded 'D' are prohibited"* — prepacked and dispenser beverages from **2022-12-30**, extended to **freshly prepared** beverages from **2023-12-30** (a small-business exemption applies to the latter). Penalty: fine up to **$1,000** for a first offence, up to **$2,000** on a second or subsequent conviction. |

### 2.1 The finding, stated plainly

Four things the ticket asked for, and one it did not:

1. **Gambling and loans are effectively *unservable* in Singapore — not merely inadvisable.** For gambling it is a criminal offence provision. For loans it is structural: the permitted-channel list is **closed**, and nothing on it reaches a third-party app's ad slot — so no *licensed* moneylender can lawfully buy our inventory, and an *unlicensed* one is already breaking the law. Neither exclusion is a preference we could trade for revenue, and ADR-008 should say so.
2. **Alcohol is the one class where we are stricter than the law.** That matters twice over. *Honesty:* the ADR must not claim a compulsion it cannot support — which is exactly why SCRUM-63 was split out rather than asserted in the ADR. *Reversibility:* doc 16 §5 publicly pre-commits us that ad **exclusions** may change on the cultural practitioner's advice while the **placement rule** may not. So alcohol's exclusion is the one the practitioner can legitimately revisit — and it is also the one where **the law would not protect us** if we allowed it.
3. **Two classes the ticket did not name are statutorily banned and belong on the list.** Nicotine/vapes — the ticket's own aside (*"does it mean … e-cigarettes/vaping?"*) — is not alcohol: it is a **separate statutory class** with its own Act. And doc 16 Q9's "unhealthy food" narrows, in Singapore law, to a specific named sub-class: **Nutri-Grade "D"**. Both are enforced against the *advertiser*, but serving them from Singapore is real exposure and neither is negotiable on cultural advice.
4. **"Mandated" describes the *liable party*, not us.** In every row the first liability sits with the advertiser or the operator, not the publisher. Our exposure as the network's customer is different in kind: platform-policy enforcement, loss of the ad account, and the reputational cost of showing a memorial's audience something illegally supplied by someone else. Worth stating in the ADR, because it is the difference between *"we would be prosecuted"* and *"we would be complicit, and Play could act"*.

---

## 3 · The taxonomy — precise enough to implement

The list lives in **code**, not in prose: **`src/domain/adCategories.ts` → `AD_CLASSES`**. Five classes, each with `includes` (what belongs in it), `excludes` (what must *not* be swept in by a lazy keyword) and `basis` (§2's classification). `npm run check:ads` asserts all of it.

| Class | `basis` | Shape of the list (abridged) |
|---|---|---|
| **`gambling`** | `statutory` | casino/slots/table games · sports **and esports** betting, odds/tipster services · lottery, toto, 4D · crash/binary-style games of chance, prediction markets · **social casino** and sweepstakes-casino titles · gambling affiliates. *Excludes:* skill games with no stake or prize; sports news without betting |
| **`loans`** | `regulatory_direction` | **payday / salary-advance** · **BNPL / "pay later"** · personal loans, fast cash, instant-approval · credit cards, balance transfers · pawnbroking, cash-for-gold, debt consolidation, credit repair · loan aggregators · crypto-collateralised lending · "get rich quick". *Excludes:* insurance; deposit/savings with no credit element |
| **`alcohol`** | `policy` | beer, wine, spirits, soju, sake, cider, RTDs, alcohol delivery · bars/pubs/clubs/happy hour · brew kits, mixers, accessories. *Excludes:* 0% ABV alternatives (blocked anyway as look-alikes) |
| **`nicotine`** | `statutory` | e-cigarettes, vapes, pods, heated tobacco, nicotine pouches · shisha, snus, snuff, chewing tobacco · cigarettes. *Excludes:* licensed cessation products (e.g. nicotine patches) |
| **`unhealthy_food`** | `statutory` | **Nutri-Grade "D"** beverages (the statutory core) · energy drinks, syrups, high-sugar powders · child-targeted fast food/confectionery (ASAS Children's Code — self-regulatory, so our policy). *Excludes:* "A"/"B" grades; ungraded food with no ad ban |

**Why each of those decisions is in the list — the three the ticket flagged as ambiguous:**

* **"Loans" is not one blob.** Q1 warned that if "loans" means everything from payday apps to mortgage brokers, an under-specified list "leaks exactly the categories it was written to exclude". So **payday/advance** and **BNPL** are named *separately* (different risk profiles, and BNPL is the fastest-growing deceptive-ad category), and credit cards / pawnbroking / aggregators each appear on their own line. The `excludes` field then protects the opposite failure — insurance and savings products are **not** swept in.
* **Gambling's gateway is "social casino", and it is on the list.** A social-casino ad is not unlawful gambling in Singapore (no real-money prize), but it is the visual and behavioural gateway to the category, and Play runs a dedicated *Social Casino Games* program precisely because it is treated separately. For a family audience, blocking real-money gambling and allowing its look-alike would be a half-measure.
* **Vaping belongs to `nicotine`, not to `alcohol`.** The ticket's parenthetical put them in the same breath; the law does not. They have different Acts, different regulators and different bases — and `check:ads` asserts that no vape term appears in the alcohol class, so the two cannot drift back together.

**What is deliberately *not* blocked** (and why that is a feature, not an oversight): the list excludes *skill games with no stake*, *sports news without betting*, *insurance*, *savings/deposits*, *0% ABV drinks* and *"A"/"B" Nutri-Grade drinks*. A denylist that swallows legitimate family-safe advertising costs revenue for no compliance gain, and — worse — makes the list un-auditable: nobody can tell a bug from a policy.

---

## 4 · What the SDK already blocks — and the gap that stays ours

**The headline: no network's taxonomy aligns with Singapore law, and every control comes with a documented limitation.** That is not a criticism of the networks — their category lists are built for ad *brand-safety*, a different problem from *statutory* compliance in one country. It is the reason our list is the control of record and the SDK is a second layer.

### 4.1 Google AdMob — verified 2026-10-05

| Control | What it does | The limitation that matters |
|---|---|---|
| **General ad categories** | Block broad categories (Google's own examples: Apparel, Internet, Real Estate, Vehicles) | *"available for ads in a **limited set of languages**, regardless of the language of your app"* |
| **Sensitive ad categories** | **Standard** categories are allowed by default; **Restricted** categories are **blocked by default** (e.g. Gambling) | *"Depending on your country, you might not have all of the categories listed"* — the list is **per-country and mutable**, so it must be read in the console, not hard-coded |
| ⚠️ **`Consumer Loans`** | A loans-related sensitive category | **Removed on 2026-10-23**, and it was *"specific to Japanese and Korean"* anyway — i.e. **AdMob has never offered a general loans block.** This is the single most important finding for our `loans` class |
| **Ad content rating** | Age-appropriate rating cap (movie-style) | A coarse control; it does not map to a *statutory* class |
| **App install ads / advertiser URLs / ad networks** | Block specific app IDs, advertiser URLs, whole networks | Precise but **manual** — it enumerates bad actors after you find them |
| **Ad review center** | Per-creative review; a block applies **account-wide** | Reactive — it reviews what already ran |
| **Alcohol** | Country-gated: publishers in *"Alcohol promotion allowed countries"* can opt in | **Singapore is on Google's permitted list** → alcohol inventory *can* be served; AdMob itself *"strongly recommends"* not opting in where an association with alcohol would be inappropriate |

**Google states the residual openly, and it is the sentence this whole section exists for:** *"Our system classifies ads automatically and we don't rely on advertiser-provided categorization. Our technology makes its best attempt to filter ads from the categories above; however, **we don't guarantee that it blocks every related ad**."*

### 4.2 AppLovin MAX Ad Review — verified 2026-10-05

The strongest *publisher-defined* rule engine of the networks checked:

* **Default risky-content flags begin operating immediately** — "you do not need to take more steps to enable those flags".
* Publishers can **customise the categories** (*Risky Content Settings → Risky Content Preferences*) "to align with your definition of risky".
* Publishers can **create rules** keyed on **Title · Website · Store Category · store Content Rating** (*Risky Content Rules*), and a companion **Rules Management API** exists.
* ⚠️ **Limitation:** flags are applied *"based on the ad's content (this applies only to full-screen ads)"* — so banners/interstitials are not covered by that detection.

### 4.3 Unity / Meta — **not verified this session** ⚠️

Both were checked and the documentation pages returned 404s, so **they are recorded as unverified rather than guessed**. Before an SDK is selected, read (or re-locate) the publisher-side equivalents of AdMob's controls — for **Unity (LevelPlay / Unity Ads)**: child-directed/age designation, content-rating or content-filtering settings, and any advertiser/category blocklist; for **Meta Audience Network**: whether *publishers* (not advertisers) get category blocking at all, and at what granularity. **This is the one open item from SCRUM-63's deliverable (c)** → §8.

### 4.4 The residual gap we must fill ourselves

| Gap | Why the SDK cannot close it |
|---|---|
| **The one country's law** | Every control above is brand-safety-shaped and country-agnostic. SFA's Nutri-Grade "D" ban, HSA's vape-ad ban and MLA's closed channel list have **no SDK category that corresponds** |
| **`loans`, generally** | With AdMob's `Consumer Loans` gone (2026-10-23) and never general, there is no category to tick — this class is ours |
| **The religious/family context** | "Alcohol is inappropriate next to a memorial" is not a brand-safety category any network sells |
| **The best-effort clause** | The networks say they cannot guarantee the filter; the guarantee has to come from our own review layer (§5) |

**Conclusion for the SDK selection:** the choice is decided by (a) which network's controls are *auditable* to us and (b) which supports our consent posture (ADR-008 already names **Google's UMP** for EEA consent, which points at AdMob) — **not** by any claim that one network aligns with Singapore law. None does.

---

## 5 · Enforcement — three layers, and the one that is a gate

| Layer | What it is | When it acts | Who can break it |
|---|---|---|---|
| **1 · SDK configuration** | Map our five classes onto the network's own controls: category blocks, the **content-rating cap**, app-install blocks, and — critically — **alcohol switched OFF explicitly** (SG is a permitted country, so this is a real switch, not a default) | at integration, then on any policy change | a silent console change; a network deprecating a category (AdMob's `Consumer Loans`, 2026-10-23) |
| **2 · Ad review center** | Per-creative review; blocking by **advertiser URL** or advertiser, **account-wide**; AppLovin's rule engine (Title · Website · Store Category · store Content Rating) | continuously, **reactively** | nothing structural — but it only sees what already ran |
| **3 · Our denylist as code** | `src/domain/adCategories.ts` — the five classes, the legal basis, the placement allow-list, the caps, protected moments, and a review-time classifier | at **design time** (can this new surface carry an ad?), at **review time** (what is this creative?), and at **config time** (what must be blocked?) | `npm run check:ads` — which is to say: **nobody, silently** |

### 5.1 Q4's answer: yes, it can be a `check` — and it now is

```bash
npm run check:ads      # node src/domain/checks/ads.ts — 51 assertions, zero dependencies
```

It runs in the aggregate `npm run check` and as its own step in CI (`.github/workflows/ci.yml`, the dependency-free job), alongside `check:pathc` and `check:sql`. **Fault-tested the way this repo requires** — flipping alcohol's `basis` from `policy` to `statutory` turns it **red** (exit 1, with the two specific assertions named); restoring it turns it green. A gate that cannot fail is not a gate.

**What it guards — the two things prose cannot:**

1. **The legal basis cannot drift.** The check asserts `gambling = statutory`, `loans = regulatory_direction`, **`alcohol = policy`**, `nicotine = statutory`, `unhealthy_food = statutory` — and that any class claiming `policy` has **no instrument** while every class claiming otherwise **names one**. If a later session "tidies up" by making alcohol statutory to justify the block, CI fails. That is the *exact* error SCRUM-63 was split out to prevent, now impossible to make quietly.
2. **The false-positive alibi.** A denylist that blocks our own copy would be worse than none — so the check runs the app's **own ritual vocabulary** (doc 10 §4's EN copy, the tier names 正中/虔誠/擦邊, the shrine lines, the tablet words) through the classifier and requires **zero matches**. Those vocabulary lines are asserted: if someone adds `offering` or `tribute` to a deny list, the gate goes red.

**What it deliberately does *not* claim.** It is **not a runtime filter** — no impression can be filtered until an SDK exists (doc 19 §6.2 item 11 stays deferred, ADR-008). Layers 1 and 2 are the runtime controls; layer 3 is the *policy of record* that layers 1 and 2 are configured against, plus the review-time backstop. The check validates **the policy**, not the live auction — so the review center and a periodic audit are still required (→ §8).

### 5.2 A check this doc said did not exist — and then found it did

SCRUM-63 §3 Q4 refers to *"`check:pathc` / `check:adrs`"*. When this research was done, **`check:adrs` did not exist in this worktree** (searched: no script, no file), so the ticket's premise looked wrong — and the gate was therefore named **`check:ads`**, for its subject rather than for ADR-008, to leave the `check:adrs` name free.

**The ticket was right, and this checkout was behind.** `check:adrs` had already landed on `main` (`AppDesignConceptBoard/ADRs/check-adrs.js`, PR #16 / SCRUM-55 — 34 register-integrity checks) while this branch sat **17 commits behind**, so the search was correct for the tree I had and wrong about the repository. Both gates now run, side by side and without collision: `check:ads` (below) and `check:adrs` (the ADR register). The lesson worth keeping is the habit, not the naming — **verify against the repo, not just the checkout** — and this section was rewritten rather than left standing once the tree caught up.

---

## 6 · If we geo-target later (Q5)

* **The list is a minimum, not a maximum.** It is written for **Singapore law**, and every basis is a Singapore instrument. Other markets may *add* classes: the EEA has per-member-state alcohol rules, the UK has its own HFSS advertising restrictions from 2025–26, and China — where Play is absent anyway (doc 12 §B.5) — has its own regime. Nothing here gets *weaker* in another market.
* **The controlling fact is the *viewer's* jurisdiction, not the advertiser's.** This is the trap the ticket flags: ad **inventory is cross-border**, so an impression shown to a user in Singapore can be sold by an advertiser sitting anywhere. Our existing answer is already correct in shape — the list is applied **by placement, to every impression, regardless of where the demand came from** — and it is why layer 3 keys on the *creative*, not on the advertiser's registration.
* **Modelling for a second market.** The classes are already structured (`includes`/`excludes`/`basis`/`instrument`), so a second market is a **`regions` field**, not a rewrite — but be honest about today's state: **the module is Singapore-only and says so**, and `basis` carries a *Singapore* instrument. Adding the EEA means adding bases, not editing these.
* **Consent is already handled separately and must stay in front of the list.** The EEA gate is **UMP before any ad renders** (doc 12 **D10**, ADR-008) — a different control from a category block, and it does not move when the category list grows.

---

## 7 · What this changes

### 7.1 ADR-008 clause D — ✅ **applied 2026-10-05**

**This section was first written as a paste-instruction, because ADR-008 was not on this branch** — it lived on `cline/scrum-55-adrs`, which this worktree had been cut before. When `main` was synced (**2026-10-06**, 17 commits later) **ADR-008 arrived**, so **clause D was edited directly** instead. What changed in the ADR:

* the **D row** now names **five** classes, not three;
* a new **"D — the compliance research"** subsection carries the per-class Singapore basis table, the alcohol nuance, where it is enforced, and the two honest residuals;
* the **`Blocks:`** header no longer claims D gates the SDK — the research **unblocked** it;
* the **risk line** ("D is a strong NO with the mechanism still outstanding") was rewritten, since the mechanism is now in place.

The clause text below is kept as the **reference wording** — it is what ADR-008 now says in prose:

> **D — Category exclusions** *(accepted 2026-10-05; the compliance basis researched in **SCRUM-63** → [[21-ad-category-denylist|doc 21]])*
>
> Five classes are excluded. Exactly **one of them is our own choice rather than the law's**:
>
> | Class | Basis |
> |---|---|
> | **Gambling** | **Statutory.** Advertising unlawful gambling in or from Singapore, or to a person situated in Singapore, is an offence under the **Gambling Control Act 2022** (an individual: fine up to **$20,000**); licensed operators' advertising and promotion is prohibited unless **approved by GRA** |
> | **Loans / credit** | **Regulatory.** A licensed moneylender may advertise through a **closed list of channels only** (**Moneylenders Act 2008 s.29(3) r/w s.45(1)**, Registrar's Directions v3.0 wef 2025-04-01) — directories, its own website, its own premises. No entry reaches a third-party app surface, and unlicensed lending is criminal |
> | **Alcohol** | ⚪ **Our own policy — NOT a legal requirement.** Singapore has **no statutory ban** on alcohol advertising, and Google **permits** alcohol inventory here. The exclusion is stricter than the law; it rests on the memorial's audience and the family-safe promise, and per doc 16 §5 it is the one exclusion a cultural reviewer may revisit |
> | **Tobacco & vaporisers** | **Statutory.** The **Tobacco and Vaporisers Control Act** prohibits tobacco advertisements, extends the ban to e-cigarettes and similar products, and expressly covers advertisements **published electronically** |
> | **High-sugar drinks** | **Statutory.** Advertisements for **Nutri-Grade "D"** beverages are prohibited under the **Food Regulations** |
>
> Enforced in three layers — the SDK's own controls, the Ad review center, and **our own denylist carried as code** (`src/domain/adCategories.ts`) guarded by **`npm run check:ads`**. Classes may be added, but a class's **`basis` cannot change silently** — the gate fails. The list is written for **Singapore** and is a **minimum** for any later market.

### 7.2 What landed in [[12-security-and-legal-scoping]]

* **A new §B.10** — the five-class denylist, its legal basis and the enforcement layers, so the legal register no longer treats "ad categories" as a loose end.
* **S9 updated** — the ad-SDK line now carries the finding that no network aligns with SG law, and names the two questions the selection must answer (auditability + consent support).
* **D10 gains a caveat** — alcohol can legitimately be served in Singapore, so the block is a deliberate setting, not a default.

### 7.3 What this unblocks, and what it does not

* ✅ **The ad SDK selection** — SCRUM-63's stated blocker. It can now be chosen against a **written list and a gate** rather than a prose intention.
* ✅ **The A3 rewarded flow and the B caps** are untouched — they were already buildable (the placement rule and caps are now also asserted by `check:ads`).
* ⛔ **Not** on the critical path: PR-4 / **SCRUM-53**. The MVP has **no ads at all**; nothing here is needed to ship the vertical slice.

---

## 8 · Open items — what is *not* settled

| # | Open | Why it is left open | Close it by |
|---|---|---|---|
| 1 | **Unity / Meta publisher controls** | The doc pages 404'd; recorded as **unverified rather than guessed** | reading the LevelPlay/Unity and Audience Network publisher docs before SDK selection |
| 2 | **The live AdMob category list for the SG account** | Google's list is **per-country and mutable** — hard-coding it would be wrong | reading *Blocking controls → Sensitive categories* **in the console** at integration and mapping our five classes onto whatever is actually offered |
| 3 | **Alcohol's default state in AdMob** | Google describes a country-gated **opt-in**; the console is the source of truth | confirming the setting at integration and setting it **OFF** — SG *is* a permitted country |
| 4 | **AdMob's `Consumer Loans` removal (2026-10-23)** | A **dated** change to a category we would have relied on | diarising it, and treating the `loans` class as ours regardless |
| 5 | **The TVCA *advertising* penalty figure** | The verified penalty ($10,000/6 months; $20,000/12 on repeat) attaches to the **emerging-tobacco and shisha product bans**, not to the advertising provision | reading the Act's advertising section if a vape creative ever appears in review (moot in practice — the class is blocked) |
| 6 | **Live-side verification** | The gate validates the **policy**, not the impression stream (no SDK, no runtime filter) | a review-center pass **before each public release** and after any SDK or network change; plus the classified-creative check on anything flagged |
| 7 | **Reconciliation with the cultural review** | Doc 16 **Q9** asks the practitioner to name categories too — and ours must line up with theirs | **SCRUM-49**; if the practitioner names a class we lack, it is added here (and `check:ads` extended), not argued about |

---

## 9 · Sources — every one checked **2026-10-05**

**Singapore — gambling**
* GRA, *Responsible Gambling, Advertising & Promotion* — <https://www.gra.gov.sg/harm-minimisation/responsible-gambling-advertising-promotion> (the two quotes in §2, and the $20,000 individual fine)
* Gambling Control Act 2022 — <https://sso.agc.gov.sg/Act/GCA2022> (the Act itself; the GRA page carries the operative summary)

**Singapore — moneylending**
* Registry of Moneylenders, *Registrar's Directions on Advertising & Marketing Activities of Licensed Moneylenders*, **Version 3.0 wef 2025-04-01** — <https://rom.mlaw.gov.sg/files/Registrar's%20Directions/Advertising_Marketing_Directions_dated_1_Apr_2025.pdf> (read in full for §2: the closed permitted-channel list and the eight prohibitions)
* Moneylenders Act 2008, s.29(3) and s.45(1) — <https://sso.agc.gov.sg/Act/MA2008> (the directions' enabling provisions)
* Registry of Moneylenders — <https://rom.mlaw.gov.sg/> (the regulator's index of licence conditions, directions and the Professional Service Handbook)

**Singapore — alcohol**
* ASAS, *Singapore Code of Advertising Practice*, **Appendix K — Advertising for Alcoholic Drinks** — <https://asas.org.sg/Portals/0/SCAP%202008_1.pdf> (read in full: the six clauses quoted in §2)
* Google Ads, *Alcohol* policy (country list) — <https://support.google.com/adspolicy/answer/6012382> (**Singapore is on the permitted list**)

**Singapore — tobacco & vaporisers**
* HSA, *Overview of tobacco control* — <https://www.hsa.gov.sg/tobacco-regulation/overview/> (the Act's current name; the advertisements-and-promotions section; vaporisers as imitation tobacco products)
* MOH/HSA, *Singapore Enhances Tobacco Control Measures* (2016) — <https://www.hsa.gov.sg/announcements/singapore-enhances-tobacco-control-measures/> (the extension of the advertising ban to e-cigarettes, to **electronically published** advertisements, and to advertisements originating in Singapore targeting local or foreign audiences; and the product-ban penalties)
* Tobacco and Vaporisers Control Act 1993 — <https://sso.agc.gov.sg/Act/TVCA1993>

**Singapore — Nutri-Grade**
* MOH, *Mandatory Nutrition Labelling And Advertising Prohibitions For "Nutri-Grade" Beverages From 30 December 2022* — <https://www.moh.gov.sg/newsroom/mandatory-nutrition-labelling-and-advertising-prohibitions-for-nutri-grade-beverages-from-30-december-2022/> (Grade D advertising prohibition; reg. 184F(2); penalties)
* MOH, *Implementation Of Nutri-Grade Requirements For Freshly Prepared Beverages From 30 December 2023* — <https://www.moh.gov.sg/newsroom/implementation-of-nutri-grade-requirements-for-freshly-prepared-beverages-from-30-december-2023/> (the extension, the small-business exemption, the penalties)

**Platform controls**
* AdMob, *Ad blocking options for your apps* — <https://support.google.com/admob/answer/3150235> (the eight control types)
* AdMob, *General ad categories* — <https://support.google.com/admob/answer/9173404> (and the *"we don't guarantee that it blocks every related ad"* clause)
* AdMob, *List of sensitive categories* — <https://support.google.com/admob/answer/3150953> (Standard vs Restricted; per-country availability; the **2026-10-23** removal of `Downloadable Utilities`, `Consumer Loans`, `Astrology & Esoteric`; the alcohol opt-in and its recommendation)
* AppLovin MAX, *Ad Review — Risky content detection* — <https://support.applovin.com/en/max/ad-review/risky-content-detection> (default flags, custom categories, rules on Title/Website/Store Category/store Content Rating, full-screen-only limitation)
* Google Ads, *Financial products and services* — <https://support.google.com/adspolicy/answer/2464998> (personal loans and "high APR" loans as restricted categories; required disclosures)

**In-repo (verified earlier, reused here):** [[ADRs/ADR-008-advertising-posture-never-inside-the-ritual|ADR-008]] (accepted 2026-10-05) · [[12-security-and-legal-scoping]] §B.4/§B.5 (2026-09-27) · [[10-economy-spec]] §1/§4/§5 · [[16-cultural-consultation-and-ritual-review]] Q8/Q9/§5.

---

## 10 · The change set

| File | Change |
|---|---|
| `src/domain/adCategories.ts` | **new** — the denylist, the legal basis per class, the placement allow-list, caps, protected moments, the review-time classifier |
| `src/domain/checks/ads.ts` | **new** — 51 assertions, fault-tested red |
| `src/domain/index.ts` | exports the new module |
| `package.json` | **`check:ads`** added **and wired into the aggregate `check`** — merged as a **union** with the gates that landed on `main` meanwhile (`check:slice` · `check:throw` · `check:adrs`), so all four run |
| `.github/workflows/ci.yml` | a new dependency-free CI step for `check:ads`, alongside the slice/throw steps |
| [[12-security-and-legal-scoping]] | **§B.10** added; **S9** and **D10** carry the findings; register row **B.10** |
| [[ADRs/ADR-008-advertising-posture-never-inside-the-ritual\|ADR-008]] | **clause D applied** (five classes + the per-class basis subsection), `Blocks:` header and risk line corrected — the research unblocked the SDK choice |
| [[ADRs/README\|the ADR register]] | the ADR-008 row and note now record the research and its widening to five classes |
| this doc | the research of record for SCRUM-63 |

---

*Last updated: **2026-10-06** — after `main` was synced (17 commits; PRs #16–#21 arrived): **ADR-008 clause D was applied directly** (§7.1), the §5.2 correction was rewritten once `check:adrs` turned out to exist after all, and the change set now records the **union of gates** (`slice` · `throw` · `ads` · `adrs`). Still true: SCRUM-63's five questions are answered, the deliverable list is satisfied **except the Unity/Meta SDK read** (§4.3, §8 item 1), no ad SDK is integrated, and this gate is **policy, not a runtime filter**.*
