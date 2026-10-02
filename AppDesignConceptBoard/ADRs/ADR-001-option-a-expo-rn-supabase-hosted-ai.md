# ADR-001 · Option A — Expo / React Native + Supabase + hosted AI

**Status:** ✅ **Accepted** · 2026-09-26 (Session 17)
**Deciders:** stakeholder (PM), on AI research support
**Closes (gap-analysis §6):** **1 · client platform & runtime** · **4 · backend shape** · the *day-one hosted* half of **3 · cartoonization runtime**
**Related:** [[06-tech-stack-options]] (the research) · [[07-system-architecture]] (the resulting service map + schema) · SCRUM-10

---

## Context

**Binding constraints** (stakeholder, S16):
1. **Dev platform = Fedora 44 (Linux)** — no macOS tooling in the daily loop.
2. **Cline-assisted development** — mainstream, well-documented languages/frameworks with strong public code representation.
3. **Cost low at this stage** — free/open first; paid only where no viable free option exists, and named explicitly.
4. **Cross-platform, one codebase** — Android at minimum; iOS must be *addable* later; web reach desirable (CNY traffic is phone-heavy, both platforms).
5. **AI pipeline**: background removal → object identification → cartoonization to **style D** (low-poly 3D × ink brush).

**What was already known going in** (S16 research → [[06-tech-stack-options]]):
- All four cross-platform options share the same *iOS-needs-macOS* constraint; viable Linux paths are EAS Build (free: 15 Android + 15 iOS builds/mo), Codemagic, or cloud Mac rental.
- Stakeholder decisions already closed in S16: **iOS out of the MVP** (but the platform must add it later with zero code change) · **style-D spike approved** (US$10–20) · **hosted APIs from day one** (deployment must work day 1; no GPU capex).
- The one serious concern against Option A — the **alpha-quality AR wrapper** (`@sceneview-sdk/react-native`) — was elaborated: the MVP doesn't use it at all (*non-AR AR*: camera + fixed overlay), Android AR is the functional path, and four exit ramps exist for true AR later → **non-blocking**.

This ADR converts that leaning into a decision so downstream work (schema, spike, economy, repo/CI) can stop hedging.

---

## Decision

**Adopt Option A:**

1. **App** — **Expo (React Native + TypeScript)**, **Android-first**; iOS added later via EAS cloud builds with **zero code change** ($99/yr Apple only when we actually ship iOS); a web target remains available from the same codebase.
2. **Backend** — **Supabase**: Auth (anonymous sign-in first → optional account upgrade), Postgres with Row Level Security, Storage (private buckets), Edge Functions, Realtime, scheduled jobs.
3. **AI** — **hosted APIs from day one** for all three pipeline stages (bg removal → object ID → style-D stylization); the *specific provider(s)* are chosen on the spike's measured cost/latency → **ADR-002**; **API keys live only in Edge Functions, never in the client**.
4. **AR** — MVP ships as ***non-AR AR***: live camera + fixed-position overlay (`expo-camera` + RN views, no ARCore/bridge). True AR is post-MVP, Android-first, via the documented exit ramps (SceneView RN Android → Scene Viewer intent → @reactvision/react-viro → bounded Kotlin module).
5. **Money flow** — a single **append-only ledger** in Postgres, written only by the `award-service` Edge Function (schema: [[07-system-architecture]] §5.3).

---

## Alternatives considered → rejected

| Alternative | Why rejected |
|---|---|
| **Flutter** | Close second. Expo/RN wins on TypeScript (one language across app + edge functions), Expo's managed tooling + EAS iOS-later path, and the strongest public code representation for Cline. SceneView ships an RN SDK; Flutter parity lags. |
| **PWA / web-first** | Camera fidelity, performance, storage and install friction for the 40–50s audience; no app-store presence. (Expo still gives a web target if we want reach later.) |
| **Unity** | **Reserve** — only if the 3D scene becomes the product's core. Heavy runtime, worse Cline fit, overkill for a camera + overlay MVP. |
| **Native Android + native iOS** | Two codebases — violates constraint 4 outright; iOS still needs macOS either way. |
| **Custom Node/Postgres service** | Real transactions for the ledger and real queries for cohorts/geo are needed — but the ops burden is wrong for a solo hobby project. Managed Postgres gives the same guarantees without running it. |
| **Firebase** | Viable, but SQL suits the ledger + cohort queries, RLS maps cleanly onto the per-user model, and Supabase bundles auth/storage/realtime/edge in one free tier. |
| **Self-hosted GPU / local model** | Rejected day one (stakeholder): *deployment must work day 1*, no GPU capex. Revisit only if hosted cost-per-burn proves unsustainable against ad revenue (SCRUM-18). |

---

## Consequences

**Good**
- **One TypeScript codebase** end-to-end — app, edge functions, shared types.
- **Free tiers cover development**: EAS free (15 Android + 15 iOS builds/mo), Supabase free tier, Android emulator under KVM on Fedora → the daily loop needs **zero Apple tooling**.
- **iOS later with zero code change** — the S16 requirement, satisfied.
- **RLS** gives per-user isolation without app-level ACL code; the schema in [[07-system-architecture]] already assumes it.
- Hosted AI means no infrastructure to run for the KEY pipeline.

**Trade-offs / risks (accepted)**
- Native modules (AR later) mean **Expo development builds** instead of Expo Go — routine, but a workflow change.
- RN new-architecture churn may break the **alpha AR wrapper** — post-MVP concern only; four exit ramps documented in [[06-tech-stack-options]].
- **iOS builds require macOS somewhere** (EAS cloud) when we choose to ship; $99/yr Apple at that point.
- **Hosted AI cost per burn** makes quotas mandatory — burn limits *are* the cost control (SCRUM-18 → ADR-006).
- Supabase free-tier limits apply at scale — fine for the family alpha; revisit at beta.

**Constraint compliance:** Fedora ✅ (no Xcode needed for the MVP) · Cline ✅ (TS + mainstream stack) · cost ✅ (free tiers; planned spend = approved spike + metered AI usage) · cross-platform ✅ · style-D hosted pipeline ✅.

---

## Decision mapping — gap-analysis §6 → the ADR series

| §6 | Decision | ADR | Status |
|---|----------|-----|--------|
| 1 | Client platform & runtime | **ADR-001** (this) | ✅ Accepted 2026-09-26 |
| 4 | Backend shape | **ADR-001** (this — Option A names Supabase) | ✅ Accepted 2026-09-26 |
| 3 | Cartoonization runtime (direction) | **ADR-001** (this — hosted from day one) | ✅ Direction accepted |
| 3 | Cartoonization **provider** + real cost/latency | **ADR-002** | ⏳ Open — set by the style-D spike (SCRUM-41) |
| 2 | AR mode: non-AR AR first | **[[ADRs/ADR-003-non-ar-ar-mvp-ar-framework\|ADR-003]]** | ✅ Accepted 2026-10-02 (SCRUM-8) |
| 5 | Identity: anonymous device first | **ADR-004** | ⚠️ Decided (encoded in [[07-system-architecture]]) — record to be written |
| 6 | Integrity posture | **[[ADRs/ADR-005-honest-client-caps-append-only-ledger\|ADR-005]]** | ✅ Accepted 2026-09-27 (SCRUM-21) |
| 7 | Burn-limit semantics | **ADR-006** | ⏳ Open — SCRUM-18 |
| 8 | Privacy & retention | **[[ADRs/ADR-007-privacy-minimal-windowed-one-tap\|ADR-007]]** | ✅ Accepted 2026-09-27 (SCRUM-19) |
| 9 | Ad posture | **ADR-008** | ⏳ Open — product question (does advertising ever enter the ritual flow?) |

*(9 decisions → 8 ADRs: §6.1 and §6.4 close together inside Option A.)*

---

## References

- [[06-tech-stack-options]] — research, comparison matrix, sources (iOS-from-Linux paths, AI pricing, AR-wrapper elaboration)
- [[07-system-architecture]] — the service map + data model this decision produced (v2, written against the locked stack)
- SCRUM-10 — constraint pinning (S16) and progress comments (S16/S17)

---

*Created 2026-09-26 (Session 17) — Option A locked by stakeholder decision.*
