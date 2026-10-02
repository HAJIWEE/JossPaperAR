# ADR-007 · Privacy posture — collect minimal, retain windowed, coarsest location, one-tap delete

**Status:** ✅ **Accepted** · 2026-09-27 (Session 19)
**Decider:** stakeholder (PM), on AI architecture support
**Closes (gap-analysis §6):** **8 · privacy & retention** — what we store, for how long, how a user deletes it
**Related:** [[../13-privacy-and-retention|13-privacy-and-retention]] (the full posture: inventory · windows · copy · runbook) · [[../12-security-and-legal-scoping]] §B.5 (PDPA baseline · GDPR design target) · [[../07-system-architecture]] §5.3 · SCRUM-19 · SCRUM-24

---

## Context

Gap-analysis risk #5: this app holds *the most personal data imaginable* — photographs of family objects, ancestors' names (up to 4), and where the family burns. The prototype's implicit policy (everything in memory, gone on reload) is the safest possible posture **and cannot survive real accounts**. Meanwhile the compliance frame was pinned earlier today (12 §B.5): **PDPA is the mandatory baseline** (SG entity — 30d/3d breach clocks, DPO, retention limitation), **GDPR is the design target** where listed (Art. 9 may treat ritual content as religious-belief data; Recital 27 scopes the deceased out; Art. 17 erasure + Play's account-deletion rule converge on one flow). The decision must land **before any storage code is written**, and before the boot-flow boards (consent screens) are wired.

---

## Decision

1. **Collect the minimum** (13 §1): no NRIC/phone, no GPS trail, no cards (Play Billing), no precise coordinates — only the coarse geohash cell ever leaves the device; analytics is **opt-in, default OFF** and never sees photos/names/location.
2. **Every data class has a written retention window or it doesn't ship** (13 §2): raw photo **7 days after job terminal** · `cell_burns` 90 days · rate counters 24h · devices 90 days idle · logs 30 days (events only) · everything account-bound lives **only while the account lives**; `grid_cells` is indefinite *because it carries no identity*.
3. **Names rule:** ancestor names never enter analytics, crash reports, logs, or any share surface — kept for cultural reasons (SCRUM-24) even though both laws scope the deceased out.
4. **One-tap delete, server-side, with a receipt** (13 §9 runbook): children-first transaction, storage purge, **league points vanish** (`SUM(ledger)` recompute; `cohort_members` tombstoned with a display label; written `weekly_rolls` never rewritten), fraud evidence survives **90 days as a pseudonymous uuid** in `integrity_flags`; the receipt states that Google-side purchase records remain with Google.
5. **Consent without walls** (13 §5): one honest first-run notice (acknowledge) + Art. 9 ritual-data consent before the first ancestor is saved + optional toggles default OFF — EN/ZH copy written for the 40–50s audience, states logged in `consent_records`.
6. **Region = `ap-southeast-1` (Singapore)**; fal (US) receives images — disclosed, DPA on file, no-training confirmed (12 B.1).

---

## Alternatives considered → rejected

| Alternative | Why rejected |
|---|---|
| **Keep raw photos indefinitely** (re-stylize, re-generate, "just in case") | The raw is the most sensitive class and Path C needs it only during the job; 7 days covers retry + appeal. Indefinite retention has no product justification and directly contradicts PDPA retention limitation. |
| **Consent wall before first use** (GDPR-style gate everywhere) | Kills ADR-004 (no signup wall before the first burn) — the demographic forgives neither. Notices + toggles give auditable consent without a maze. |
| **Store precise coordinates** (better decay maths, real "new ground") | The concept's own ~4-block rule forbids it; `cell_hash` is sufficient for the multiplier and useless as a trail — privacy wins the tie. |
| **Anonymize instead of delete (keep league rows forever)** | The league is recompute-from-ledger by design — keeping rows for absent users would preserve exactly the data the user asked to erase. Tombstoned labels preserve *audit*, not *person*. |
| **Grace period / 30-day restore at alpha** | Extra state machine (soft-delete flags, restore path, purge later) for an invite-only family alpha; the honest immediate delete ships first — recorded as an open item for beta, not a rejection on principle. |
| **Do nothing until EU listing** (GDPR later) | Consent screens and the privacy hub are on boards we're wiring *now*; retrofitting them costs a redesign. PDPA is mandatory from day one regardless. |

---

## Consequences

**Good**
- The Data Safety form, privacy policy, and PDPA/GDPR notices all read from **one inventory** (13 §1) — three compliance artifacts, one source.
- Retention is enforced by **named crons**, not prose — a window in the table that isn't scheduled is a bug the §11 checklist catches.
- Deletion is **one RPC with a 0-row success probe** (13 §9.7) — testable, drillable, and doubles as the Play account-deletion requirement.
- Minimal collection means the breach blast radius (12 §A.1 asset #2) stays small by construction.

**Trade-offs / risks (accepted)**
- No raw photos beyond 7 days ⇒ a user cannot re-generate an old offering from source (accepted — they still have the sprite; re-shoot if they want a new one).
- Immediate delete = no undo (accepted; N5 confirmation says so plainly).
- `integrity_flags` retaining a pseudonymous uuid for 90 days after deletion is a **deliberate retention exception** (fraud evidence, legitimate interest) — documented, bounded, and the only one.
- Consent copy (N1–N6) will get another pass with SCRUM-24 (cultural review) and at privacy-policy drafting (B.8).

---

*Accepted 2026-09-27 (Session 19) as the SCRUM-19 decision record; full posture, EN/ZH copy, and the deletion runbook in [[../13-privacy-and-retention|13-privacy-and-retention]].*
