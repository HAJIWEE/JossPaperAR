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
| ADR-004 · identity = anonymous first, account later (§6.5) | no signup wall before the first burn | ⚠️ Decided — encoded in [[07-system-architecture]] — record to write |
| [[ADR-005-honest-client-caps-append-only-ledger]] | §6.6 integrity posture — honest client + caps vs server verification | ✅ **Accepted 2026-09-27** |
| ADR-006 · burn-limit semantics (§6.7) | daily quota / cost per burn / cooldown | ⏳ Open — SCRUM-18 |
| [[ADR-007-privacy-minimal-windowed-one-tap]] | §6.8 privacy & retention — collect minimal · windowed · coarse location · one-tap delete | ✅ **Accepted 2026-09-27** |
| ADR-008 · ad posture (§6.9) | may ads ever appear inside the ritual flow? | ⏳ Open — product question |

---

*Started 2026-09-26 (Session 17) with ADR-001 (Option A locked).*
*Updated 2026-10-02 (Session 26) — **ADR-003 accepted** (non-AR AR for the MVP; ARKit/ARCore/Unity rejected for the MVP; true AR post-MVP via 4 exit ramps) · closes SCRUM-8 §6.2.*
