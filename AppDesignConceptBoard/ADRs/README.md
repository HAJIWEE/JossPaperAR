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
| [[ADR-008-advertising-posture-never-inside-the-ritual]] | §6.9 ad posture — may ads ever appear inside the ritual flow? | ✅ **Accepted 2026-10-05** (A3 · caps 2/3 · SG-for-now · D→SCRUM-63) |

**8 of 9 recorded · 8 Accepted.** (Nine decisions → eight ADRs: §6.1 and §6.4 close together inside Option A.)

> ✅ **ADR-008 accepted on SCRUM-62** (2026-10-05). **A** → A3: the rewarded bonus photo exists but is **never framed as a reward on a ritual screen**. **B** → **2 interstitials on app start, 3 in a row post-ritual**. **C** → **Singapore** practice for now, modelled as data so other Chinese diasporas can be added by iteration. **D** → **strong NO** for gambling, loans and alcohol — the category/compliance detail is split to **SCRUM-63**, which gates the SDK choice.

---

## Machine-readable check

`npm run check:adrs` reads this register **and** every ADR file, and fails if they disagree — a status claimed here that the file contradicts, a missing ADR file, a decision row still marked *"record to write"*, or a file with no register row. The drift this ticket existed to fix (three decisions decided in prose but recorded nowhere) cannot come back silently.

---

*Started 2026-09-26 (Session 17) with ADR-001 (Option A locked).*
*Updated 2026-10-02 (Session 26) — **ADR-003 accepted** (non-AR AR for the MVP; ARKit/ARCore/Unity rejected for the MVP; true AR post-MVP via 4 exit ramps) · closes SCRUM-8 §6.2.*
*Updated 2026-10-05 (Session 29, SCRUM-55 + SCRUM-62) — **ADR-004 · ADR-006 accepted**, closing the two decided-but-unrecorded rows; then **ADR-008 accepted** the same day after the PM answered A–D on **SCRUM-62**. All nine §6 decisions are now recorded and **all eight ADRs are Accepted**. `npm run check:adrs` guards the register so it cannot drift from the files — including a *status disagreement*, which is how a 🟡 Proposed could have been lost here.*
