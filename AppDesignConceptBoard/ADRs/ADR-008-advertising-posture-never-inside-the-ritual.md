# ADR-008 · Advertising posture — *never inside the ritual*

**Status:** ✅ **Accepted** · 2026-10-05 (Session 29) — *decided by the PM on **SCRUM-62**; drafted here as 🟡 Proposed, signed there*
**Decider:** stakeholder (PM) — **SCRUM-62** (2026-10-05), answering A/B/C/D. The *placement* half was already settled by [[../10-economy-spec]] §1 and [[../16-cultural-consultation-and-ritual-review]] §5; the *scope* half was decided on SCRUM-62
**Closes (gap-analysis §6):** **9 · ad posture** — *may ads ever appear inside the ritual flow?*
**Blocks:** ~~the ad SDK choice~~ — ✅ **unblocked 2026-10-05**: the clause-D research (**SCRUM-63**) landed and the SDK can now be selected against a written list (see **clause D** below) · monetization planning · doc 19 §6.2 item 11 · [[../09-economy-quick-check]] §4 (its +40–60% mediation assumption)
**Related:** [[../10-economy-spec]] §1 (ads = post-ritual only) · §5 (ARPDAU band $0.005 / $0.011 / $0.04) · [[../16-cultural-consultation-and-ritual-review]] §1.5 item 5 + Q8/Q9 (the practitioner question) · §5 (what we will and won't change) · [[../12-security-and-legal-scoping]] S9 + D10 (SDK vetting · EEA consent) · [[../13-privacy-and-retention]] §1 item 12 (ad id, later) · **SCRUM-62** (the decision) · **SCRUM-63** (D — category/compliance research) · SCRUM-49 (the cultural review) · SCRUM-43 (legal long-tail)

> **In one line:** advertising is **post-ritual only** — it may never enter the capture → cartoonize → burn → reward flow, and never appear while ancestor names are on screen. The rewarded bonus photo **exists but is never framed as a reward on a ritual screen** (A3). Volume is capped at **2 on app start / 3 in a row post-ritual** (B). Categories are a **strong NO for five classes** — gambling · loans · alcohol · tobacco/vapes · high-sugar drinks (D) — and the compliance research (**SCRUM-63**) found that **only four of the five are compelled by Singapore law: alcohol is our own stricter policy alone**. Protected moments follow **Singapore** practice for now, with the structure left open for other Chinese diasporas (C).

---

## Context

This is the one decision in the §6 set that is not an engineering trade-off. Everything else asks *"which tool is cheaper or faster?"*; this asks **"may a business model intrude on a memorial?"** — and it is the decision with the least reversibility, because an ad SDK integrated into the ritual flow cannot be quietly removed later without shipping the removal.

**What is already settled (and why this record is not re-deciding it):**

- **[[../10-economy-spec]] §1** lists ads as **"post-ritual only (home/league/result screens; never inside the ritual)"** — banner on home/league, interstitial at screen transitions, frequency-capped, rewarded = the ad-gated bonus photo. That line was locked at Session 18 as part of the economy.
- **[[../16-cultural-consultation-and-ritual-review]] §5** pre-commits the PM in public: ad **exclusions and protected moments may change on advice without re-litigation**, but *"the placement rule ('post-ritual only') itself stays."* That is a promise already made to a future practitioner, which is why a proposal to allow in-ritual ads would not be a technical change — it would be walking back a stated commitment.
- **[[../09-economy-quick-check]] §4** builds its economics on this assumption: the +40–60% mediation lever is only available *"with post-ritual ad placement only."* Reversing the posture would invalidate that section, not just this record.

**The cultural reasoning, which is the substance here.** Doc 16 exists because this app holds photographs of family objects and up to four ancestor names, and *"money near ancestor names is where apps commonly offend."* The ritual is a **repetition of a real practice** — burning paper for the dead — and its emotional integrity depends on nothing in the frame being a transaction. Three specific failure modes make the case:

1. **An ad during the ~15 s generation window** (ADR-002's p50 ≈ 13 s) would interrupt the one moment the player is *waiting for the ancestor's offering to be prepared*. Doc 16 pre-decides the answer to Q3 — the fire's heart must not become the focus — and an ad in that window makes the fire's heart a billboard.
2. **An ad on a screen showing ancestor names** would place a stranger's product beside a named person who has died. Doc 13 §4's rule that names never reach analytics, logs or shares exists precisely because of who names are.
3. **A rewarded ad gating a photo burn** puts the *earning of a devotional act* behind an advertiser. It is the sharpest edge of this decision and is flagged in doc 16 Q8 as the exact thing a practitioner is being asked about.

**What was open — and was decided on SCRUM-62:** the *volume* of post-ritual advertising, the **protected moments**, and the **category exclusions** doc 16 Q9 asks the practitioner to name. These were the four questions A–D put to the PM on 2026-10-05; all four are now answered below. Note why asking was legitimate: doc 16 §5 pre-authorises all three to change *without* re-opening the placement rule, so none of them was ever a placement question.

---

## Decision

### Settled now — the placement rule (engineering may proceed on this)

1. **Advertising never enters the ritual flow.** The capture → cartoonize → burn → reward sequence is **ad-free end to end**, including the ~15 s cartoonization wait and the result/award moment immediately following it.
2. **Ad surfaces are the outer app only:** **home · league · screen transitions** (frequency-capped interstitials) — i.e. the surfaces a player reaches *after* the ritual is complete.
3. **No ad while ancestor names are on screen** — the tablet/altar surfaces, the ancestor sheet and the Book of Tributes are permanently ad-free. This extends [[../13-privacy-and-retention]] §4's names-never rule to advertising, not just to analytics.
4. **No ad SDK is integrated at MVP.** Doc 19 §6.2 item 11 stays deferred; integrating an SDK before the posture is signed would be integrating it on the assumption it will never appear near the ritual — the assumption is the decision.
5. **One SDK, vetted, family-safe**, with the data-safety disclosure and EEA consent (UMP) declared **at integration time** ([[../12-security-and-legal-scoping]] S9/D10). Consent before any ad renders; Play defaults elsewhere.
6. **Ads are secondary revenue, never primary.** [[../10-economy-spec]] §5 keeps the cash shop primary and ads as profit; this ADR does not reopen that ordering.

### ✅ Decided on SCRUM-62 (2026-10-05) — the PM's four answers

| # | Decision | What it means in practice |
|---|---|---|
| **A** | **A3 · Allow the rewarded bonus photo, but never frame it as a reward on a ritual screen.** | The format survives (doc 10 §5's revenue case keeps its ads), but the offering is **presented on a post-ritual surface as an optional extra** — never as something the player *earns*, and never in the ritual's own language. It must not appear during, or immediately adjacent to, the capture → burn → reward sequence. **Revisitable at SCRUM-49** (doc 16 Q8 asks the practitioner the same question). |
| **B** | **Cap volume: 2 on app start, 3 in a row after the ritual.** | Two **absolute** interstitial slots on app entry; a **run** of at most 3 in a row post-ritual, which is the burst the ritual-complete transition actually generates. Banners are not counted in these caps but stay frequency-limited. *A starting cap to be tuned from real data, not a validated optimum.* |
| **C** | **Follow Singapore practice for now; leave the structure open for other Chinese diasporas.** | Protected moments today are the **SG** calendar and ritual rhythm (Qingming, Hungry Ghost month, CNY, death anniversaries). The rule is **modelled as data, not hard-coded**, so another diaspora's calendar and dates can be added by iteration later. Explicitly recorded: **Singapore is not the only Chinese diaspora** — a v1 scope decision, not a claim about "Chinese" timing generally. |
| **D** | **Strong NO — five classes: gambling · loans · alcohol · tobacco/vapes · high-sugar drinks.** | Blocked categories — cultural grounds first, compliance grounds second. The **detail landed 2026-10-05**: the exact taxonomy, the SDK's own limits, the Singapore basis per class, and the enforceable list are below and in [[../21-ad-category-denylist|doc 21]]. |

**What is now unblocked vs still gated**

* ✅ **Unblocked:** the A3 rewarded-flow *design* (surface + copy) · the B volume caps · **and the ad SDK choice** — clause D's research landed, so the selection can proceed against a written list and a gate.
* ⛔ **Still gated on nothing in this ADR.** No SDK is integrated at MVP anyway (clause 4); the SDK selection now turns on **auditability + consent support**, not on this record.

#### D — the compliance research (landed 2026-10-05 · SCRUM-63 → [[../21-ad-category-denylist|doc 21]])

The research found **five** classes to block, not three — and, more importantly, that **they do not all rest on the same footing.** Only these are compelled by Singapore law:

| Class | Singapore basis | Compelled? |
|---|---|---|
| **Gambling** | **Gambling Control Act 2022** — advertising unlawful gambling in or from Singapore, or **to a person in Singapore**, is an offence (an individual: fine up to **$20,000**); licensed operators' advertising and promotion is prohibited unless **approved by GRA** | 🔴 **Statutory** |
| **Loans / credit** | **Moneylenders Act 2008 s.29(3) r/w s.45(1)** → Registrar's Directions v3.0 (wef 2025-04-01): a licensee may advertise through a **closed channel list only** — directories · its own website · its own premises. **No entry reaches a third-party app surface**, and unlicensed lending is criminal | 🔴 **Regulatory direction** |
| **Alcohol** | **None.** Self-regulatory advice only (ASAS Singapore Code of Advertising Practice, Appendix K). Singapore has **no statutory ban** on alcohol advertising — and **Google permits** alcohol inventory to be served here | ⚪ **Our policy alone** |
| **Tobacco & vaporisers** | **Tobacco and Vaporisers Control Act 1993** — the tobacco advertising ban was extended to e-cigarettes and similar products, and expressly covers advertisements **published electronically** | 🔴 **Statutory** |
| **High-sugar drinks** | **Food Regulations reg. 184E–184F** — *"Advertisements related to Nutri-Grade beverages graded 'D' are prohibited"* (2022-12-30; freshly prepared 2023-12-30). Fine ≤ **$1,000** (≤ **$2,000** repeat) | 🔴 **Statutory** |

**The consequence for this record, stated plainly.** Gambling and loans are **unservable here, not merely inadvisable** — for loans because the permitted-channel list is *closed* and nothing on it reaches an app's ad slot, so no *licensed* moneylender can lawfully buy our inventory. But **alcohol is the one class where we are stricter than the law.** That is exactly why D was split out of this ADR rather than asserted in it, and it matters twice over: the record must not claim a compulsion it cannot support, and — per doc 16 §5, which pre-authorises exclusions to change on the practitioner's advice while the placement rule may not — **alcohol is the one exclusion SCRUM-49 may legitimately revisit**, and the one where the law would not protect us.

**Where it is enforced.** Our own list is the control of record, carried as code: **`src/domain/adCategories.ts`** (the five classes, their `basis`, the ritual-flow placement allow-list, the caps, protected moments) guarded by **`npm run check:ads`** — 51 assertions, fault-tested, in `npm run check` and CI — layered under the SDK's own category blocks and the Ad review center. The gate asserts **the legal basis per class**, so this ADR's honesty about alcohol cannot be silently "tidied up" into a legal claim later.

⚠️ **Two honest residuals:** the networks' taxonomies align with **no** country's law and their filters are documented as best-effort (AdMob **removes its `Consumer Loans` category on 2026-10-23**), so the list stays ours; and the **Unity/Meta** publisher-control read is still open (doc 21 §8 item 1) — needed before the SDK is *selected*, not before the slice. Nothing here is a runtime filter: **the MVP is ad-free.**
## Alternatives considered → rejected

| Alternative | Why rejected |
|---|---|
| **Ads inside the ritual flow** (banner on the burn screen, ad during the generation wait) | The decision this record exists to hold. It monetises the least sacred seconds of the app, makes the fire's heart a billboard during the one moment the player is waiting, and would reverse a commitment already pre-made to the cultural reviewer (doc 16 §5). |
| **Ads on screens showing ancestor names** | Places a stranger's product beside a named person who has died. Doc 13 §4 treats names as the most protected class in the app; advertising is no exception. |
| **Reward the devotional act itself** ("earn tribute by watching") | Doc 16 §5 already declines to change *the free / earned / optional-paid model* — paying only buys speed. Rewarding devotion with advertiser attention is a different and worse trade. |
| **Integrate an SDK at MVP "but only wire post-ritual slots later"** | The SDK's presence is itself the risk: ad libraries collect identifiers (doc 13 §1 item 12, "ad id") and a single mis-slotted placement puts an ad on the burn screen. Deferring the SDK defers the identifier too, until the protected-moment list is known. |
| **Treat ads as primary revenue** (drop the cash shop, maximise ARPDAU) | Doc 10 §5 already sequenced this — cash shop primary, ads secondary profit — and a memorial monetised by interruption is a reputational risk the family vision cannot absorb. |
| **No advertising at all** | Honest and safe, but it removes the free-tier subsidy doc 10 §6 depends on (expected $0.60/MAU-month) and is a *larger* decision than this ticket's question — it is a monetisation strategy call, not an ad-posture call. Recorded as the fallback if the review (SCRUM-49) objects to every format. |

---

## Consequences

**Good**
- **The cultural review gets a straight answer in the room** — placement is fixed before the conversation, so the practitioner spends their attention on the questions we actually need (A–D), not on re-litigating a settled line.
- **Engineering is unblocked where it is safe**: the no-in-ritual rule is a *constraint* the UI can be built against today, and **SCRUM-62's answers now make the A3 rewarded flow and the B volume caps buildable**. Only the SDK selection waits — and that is gated on **D → SCRUM-63**, not on the PM.
- **The blast radius of a mistake is bounded**: with no SDK at MVP and no ad-bearing surfaces in the ritual, the worst case is a stray banner on a home screen, not an ad over an ancestor's name.
- **Reversibility is preserved**: not integrating early means the protected-moment list can still be written honestly, and **A3 stays revisitable at SCRUM-49** at the cost of no uninstalled SDK and no sunk framing.

**Trade-offs / risks (accepted)**
- **Foregoing in-ritual ads costs real revenue** — the largest single ad placement surface in the app is the one we are declining. Accepted deliberately: this is a memorial, and doc 09's economics were computed *with* the constraint already in place.
- **The post-ritual rule needs real discipline**, because a "screen transition" interstitial is one navigation away from the ritual. Frequency caps and a per-surface allow-list are load-bearing, not polish.
- **The decision is only as good as its enforcement.** No ad inside the ritual is a rule a designer can break by accident; it wants a machine-readable check (a slot allow-list) before the first SDK lands, not a code-review convention.
- **B's caps (2/3) are a starting judgement, not a validated optimum.** They were set from judgement, not data; they must be tuned from real ad-fatigue and retention numbers once an SDK exists — and if they prove too loose, the cost is measured in the audience's trust.
- **C ships Singapore-only cultural timing.** Other Chinese diasporas have different calendars and dates; encoding SG practice is a **v1 scope decision**, not a claim about "Chinese" ritual timing in general. Mitigated by modelling the calendar as data rather than hard-coding dates.
- **D's mechanism is now in place — and it surfaced a distinction worth keeping.** The research (**SCRUM-63**) found the five classes do **not** share one legal footing: four are compelled (a statute or a regulator's directions) and **alcohol is our own stricter policy** — Singapore has no statutory ban, and Google *permits* the inventory. The risk that remains is **operational, not legal**: no network's taxonomy aligns with Singapore law, their filters are documented as best-effort, and one network's loans category is being withdrawn (AdMob, 2026-10-23) — so **our own list stays the control of record** (`check:ads`), with the Unity/Meta read still open.
- **A3 is revisitable at SCRUM-49.** If the practitioner objects to the rewarded format in a memorial setting, dropping it costs the secondary ad stream, not the app's viability.

---

## References

- [[../10-economy-spec]] §1 (the placement rule, locked) · §4 (the ad-gated copy) · §5 (revenue side · ARPDAU band) · §6 (free-tier subsidy)
- [[../16-cultural-consultation-and-ritual-review]] §1.5 item 5 · Q8/Q9 (the practitioner questions) · §5 (what we will and won't change — the pre-commitment)
- [[../09-economy-quick-check]] §4 (the +40–60% mediation lever, assumed post-ritual) · §7 (the cultural guard)
- [[../12-security-and-legal-scoping]] S9 (one vetted SDK) · D10 (EEA consent/UMP)
- [[../13-privacy-and-retention]] §1 item 12 (ad id — later) · §4 (names-never rule, extended here)
- [[../19-build-plan-services-api-environments|doc 19]] §6.2 item 11 (SDK TBD, deferred)
- [[../21-ad-category-denylist|doc 21]] — the clause-D research: the five classes, the **Singapore basis per class**, what AdMob/AppLovin actually block, and the three enforcement layers
- [[../18-mvp-scope-and-timeline|doc 18]] D8 (ratify ADR-004/006 when their records land — ADR-008 is the product half)
- SCRUM-62 (the decision) · **SCRUM-63** (the clause-D research) · SCRUM-49 (the cultural review — where A–D go) · SCRUM-43 (legal long-tail) · SCRUM-55 (this record)

---

*Drafted 2026-10-05 (Session 29) as SCRUM-55, then **accepted the same day**: the PM answered A–D on **SCRUM-62**. **A → A3** (rewarded photo allowed, never framed as a reward on a ritual screen) · **B → 2 on app start / 3 in a row post-ritual** · **C → Singapore practice now, structured as data for other Chinese diasporas** · **D → strong NO**, widened by the clause-D research (**SCRUM-63**, landed 2026-10-05 → [[../21-ad-category-denylist|doc 21]]) from three classes to **five**, with **alcohol the only one not compelled by Singapore law**. That research **unblocked the SDK choice**; the list is now code plus a gate (`src/domain/adCategories.ts` · `check:ads`). No SDK is integrated at MVP; the app is ad-free regardless.*

---
