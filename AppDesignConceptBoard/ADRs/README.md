# 🧭 ADRs — Architecture Decision Records (SCRUM-10)

**Purpose**: one record per architecture decision from [[05-concept-to-mvp-gap-analysis]] §6 (the nine decisions), each with context, the decision, rejected alternatives, and consequences.
**Format**: MADR-lite · statuses: draft → accepted → superseded · numbered in the order they close (not the §6 order).
**Parent**: [[README|App Design Concept Board]]

---

## Register

| ADR | Decision (§6) | Status |
|-----|---------------|--------|
| [[ADR-001-option-a-expo-rn-supabase-hosted-ai]] | §6.1 platform · §6.4 backend · §6.3 direction (hosted day one) | ✅ **Accepted 2026-09-26** |
| [[ADR-002-path-c-describe-then-generate]] | §6.3 cartoonization runtime — provider + pipeline (the provider half of ADR-001) | ✅ **Accepted 2026-09-26** |
| [[ADR-003-non-ar-ar-mvp-ar-framework]] | §6.2 AR mode — *non-AR AR* for the MVP (camera + fixed overlay; true AR post-MVP) | ✅ **Accepted 2026-10-02** |
| [[ADR-004-anonymous-identity-first-optional-account-later]] | §6.5 identity — anonymous device first, optional account later (no signup wall before the first burn) | ✅ **Accepted 2026-10-05** |
| [[ADR-005-honest-client-caps-append-only-ledger]] | §6.6 integrity posture — honest client + caps vs server verification | ✅ **Accepted 2026-09-27** |
| [[ADR-006-burn-limit-semantics-daily-quota-cost-per-burn]] | §6.7 burn-limit semantics — daily quota · cost per burn · no cooldown · hard global stop-rule | ✅ **Accepted 2026-10-05** |
| [[ADR-007-privacy-minimal-windowed-one-tap]] | §6.8 privacy & retention — collect minimal · windowed · coarse location · one-tap delete | ✅ **Accepted 2026-09-27** |
| [[ADR-008-advertising-posture-never-inside-the-ritual]] | §6.9 ad posture — may ads ever appear inside the ritual flow? | 🟡 **Proposed 2026-10-05 — PM decision** (placement settled; A–D → SCRUM-49) |

**8 of 9 recorded · 7 Accepted · 1 Proposed.** (Nine decisions → eight ADRs: §6.1 and §6.4 close together inside Option A.)

> ⚠️ **ADR-008 is the only one not Accepted, deliberately.** Its placement rule (*never inside the ritual*) is already locked by [[../10-economy-spec]] §1 and [[../16-cultural-consultation-and-ritual-review]] §5, but the rewarded ad-gated photo, ad volume, protected moments and category exclusions are an open **product** call routed to the cultural review (**SCRUM-49**). Do not read it as ratified.

---

## Machine-readable check

`npm run check:adrs` reads this register **and** every ADR file, and fails if they disagree — a status claimed here that the file contradicts, a missing ADR file, a decision row still marked *"record to write"*, or a file with no register row. The drift this ticket existed to fix (three decisions decided in prose but recorded nowhere) cannot come back silently.

---

*Started 2026-09-26 (Session 17) with ADR-001 (Option A locked).*
*Updated 2026-10-02 (Session 26) — **ADR-003 accepted** (non-AR AR for the MVP; ARKit/ARCore/Unity rejected for the MVP; true AR post-MVP via 4 exit ramps) · closes SCRUM-8 §6.2.*
*Updated 2026-10-05 (Session 29, SCRUM-55) — **ADR-004 · ADR-006 accepted**, closing the two decided-but-unrecorded rows; **ADR-008 drafted as 🟡 Proposed** with its open product questions (A–D) routed to SCRUM-49. All nine §6 decisions are now recorded: **7 Accepted + 1 Proposed.** `npm run check:adrs` added so the register cannot drift from the files.*
