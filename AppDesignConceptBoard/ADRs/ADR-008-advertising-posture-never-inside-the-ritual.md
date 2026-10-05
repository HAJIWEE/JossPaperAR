# ADR-008 · Advertising posture — *never inside the ritual*

**Status:** 🟡 **Proposed — PM decision required** · drafted 2026-10-05 (Session 29, SCRUM-55)
**Decider:** ⚠️ **the PM (product call — not an engineering one).** The *placement* half is already settled by [[../10-economy-spec]] §1 and [[../16-cultural-consultation-and-ritual-review]] §5; the *scope* half below is what still needs a signature
**Closes (gap-analysis §6):** **9 · ad posture** — *may ads ever appear inside the ritual flow?*
**Blocks:** the ad SDK choice · the **rewarded** (ad-gated bonus photo) · monetization planning · doc 19 §6.2 item 11 · [[../09-economy-quick-check]] §4 (its +40–60% mediation assumption)
**Related:** [[../10-economy-spec]] §1 (ads = post-ritual only) · §5 (ARPDAU band $0.005 / $0.011 / $0.04) · [[../16-cultural-consultation-and-ritual-review]] §1.5 item 5 + Q8/Q9 (the practitioner question) · §5 (what we will and won't change) · [[../12-security-and-legal-scoping]] S9 + D10 (SDK vetting · EEA consent) · [[../13-privacy-and-retention]] §1 item 12 (ad id, later) · SCRUM-49 (the cultural review) · SCRUM-43 (legal long-tail)

> **In one line:** advertising is **post-ritual only** — it may never enter the capture → cartoonize → burn → reward flow, and never appear while ancestor names are on screen. The **placement** of that rule is settled; **how much** we advertise, and **which categories and moments are protected**, is the open product call routed to SCRUM-49.

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

**What remains genuinely open — and is why this is Proposed, not Accepted:** the *volume* of post-ritual advertising (how many banners/interstitials is too many for a family app), the **protected moments** (festival days? the ancestor sheet? the Book of Tributes?), and the **category exclusions** doc 16 Q9 asks the practitioner to name (gambling, loans, alcohol, unhealthy food…). Doc 16 §5 pre-authorises all three to change *without* re-opening the placement rule — so they belong to the practitioner review (SCRUM-49), not to this ADR.

---

## Decision

### Settled now — the placement rule (engineering may proceed on this)

1. **Advertising never enters the ritual flow.** The capture → cartoonize → burn → reward sequence is **ad-free end to end**, including the ~15 s cartoonization wait and the result/award moment immediately following it.
2. **Ad surfaces are the outer app only:** **home · league · screen transitions** (frequency-capped interstitials) — i.e. the surfaces a player reaches *after* the ritual is complete.
3. **No ad while ancestor names are on screen** — the tablet/altar surfaces, the ancestor sheet and the Book of Tributes are permanently ad-free. This extends [[../13-privacy-and-retention]] §4's names-never rule to advertising, not just to analytics.
4. **No ad SDK is integrated at MVP.** Doc 19 §6.2 item 11 stays deferred; integrating an SDK before the posture is signed would be integrating it on the assumption it will never appear near the ritual — the assumption is the decision.
5. **One SDK, vetted, family-safe**, with the data-safety disclosure and EEA consent (UMP) declared **at integration time** ([[../12-security-and-legal-scoping]] S9/D10). Consent before any ad renders; Play defaults elsewhere.
6. **Ads are secondary revenue, never primary.** [[../10-economy-spec]] §5 keeps the cash shop primary and ads as profit; this ADR does not reopen that ordering.

### ⚠️ Open — the PM's call, routed to SCRUM-49

| # | Open question | Why it needs a human |
|---|---|---|
| **A** | **The rewarded ad-gated bonus photo** — is watching a family-safe ad for one extra offering ever acceptable in a memorial setting? (doc 10 §1 assumes yes; doc 16 Q8 asks the practitioner exactly this) | It puts the *earning of a devotional act* behind an advertiser. It is the single sharpest edge of this decision. **Options: allow (spec'd) · drop the rewarded format entirely · allow it but never name it as a reward on a ritual screen.** |
| **B** | **Frequency and volume** — how many banners/interstitials is acceptable in a family app? What is the cap per session? | Doc 10 §5 gives an ARPDAU *band* ($0.005 / $0.011 / $0.04), not an ad-count rule. Volume is a product judgement against a cultural risk. |
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
- **Engineering is unblocked where it is safe**: the no-in-ritual rule is a *constraint* the UI can be built against today; only the SDK and the rewarded format wait.
- **The blast radius of a mistake is bounded**: with no SDK at MVP and no ad-bearing surfaces in the ritual, the worst case is a stray banner on a home screen, not an ad over an ancestor's name.
- **Reversibility is preserved**: not integrating early means the protected-moment list can still be written honestly, and a rejected rewarded format costs no uninstalled SDK.

**Trade-offs / risks (accepted)**
- **Foregoing in-ritual ads costs real revenue** — the largest single ad placement surface in the app is the one we are declining. Accepted deliberately: this is a memorial, and doc 09's economics were computed *with* the constraint already in place.
- **The post-ritual rule needs real discipline**, because a "screen transition" interstitial is one navigation away from the ritual. Frequency caps and a per-surface allow-list are load-bearing, not polish.
- **The decision is only as good as its enforcement.** No ad inside the ritual is a rule a designer can break by accident; it wants a machine-readable check (a slot allow-list) before the first SDK lands, not a code-review convention.
- **A–D stay open into beta**, so monetization planning is provisional until SCRUM-49 runs.

---

## References

- [[../10-economy-spec]] §1 (the placement rule, locked) · §4 (the ad-gated copy) · §5 (revenue side · ARPDAU band) · §6 (free-tier subsidy)
- [[../16-cultural-consultation-and-ritual-review]] §1.5 item 5 · Q8/Q9 (the practitioner questions) · §5 (what we will and won't change — the pre-commitment)
- [[../09-economy-quick-check]] §4 (the +40–60% mediation lever, assumed post-ritual) · §7 (the cultural guard)
- [[../12-security-and-legal-scoping]] S9 (one vetted SDK) · D10 (EEA consent/UMP)
- [[../13-privacy-and-retention]] §1 item 12 (ad id — later) · §4 (names-never rule, extended here)
- [[../19-build-plan-services-api-environments|doc 19]] §6.2 item 11 (SDK TBD, deferred)
- [[../18-mvp-scope-and-timeline|doc 18]] D8 (ratify ADR-004/006 when their records land — ADR-008 is the product half)
- SCRUM-49 (the cultural review — where A–D go) · SCRUM-43 (legal long-tail) · SCRUM-55 (this record)

---

*Drafted 2026-10-05 (Session 29) as SCRUM-55. **Status is deliberately 🟡 Proposed, not Accepted** — clauses 1–6 restate a placement rule already locked in doc 10 §1 and doc 16 §5, but A–D are an open product decision routed to SCRUM-49, and this ADR should not be read as ratified until the PM signs it.*

| **C** | **Protected moments beyond the names rule** — festival days (Qingming, Hungry Ghost)? the day of an ancestor's death anniversary? | Doc 16 §5 pre-authorises adding no-ad moments on advice. Which ones is a product call. |
| **D** | **Category exclusions** — gambling · loans · alcohol · unhealthy food · any others | Doc 16 Q9 asks the practitioner to name them; the SDK choice follows from the list. |

**Recommendation (offered, not decided):** ratify 1–6 now so engineering is unblocked, and take **A** as the one real question — the rest is genuinely the reviewer's. If A is dropped, the economy is still viable: doc 10's revenue case rests on the cash shop, with ads as *profit* (§5).

---
