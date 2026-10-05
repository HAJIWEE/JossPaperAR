# ADR-004 · Identity — anonymous device first, optional account later

**Status:** ✅ **Accepted** · 2026-10-05 (Session 29) — *records a decision taken S16/S20, already encoded in [[../07-system-architecture]]*
**Decider:** stakeholder (PM) — the direction was fixed when ADR-001 chose the stack; this record closes the paper gap, it does not re-open the call
**Closes (gap-analysis §6):** **5 · identity** — *anonymous device id first, optional account later*
**Answers:** the signup-wall question raised in [[../05-concept-to-mvp-gap-analysis]] and encoded in [[../07-system-architecture]] §2 (service map) / §5.3 (`profiles`)
**Related:** [[../13-privacy-and-retention]] §1 item 7 (device/session id · "identity without signup") · [[ADRs/ADR-005-honest-client-caps-append-only-ledger|ADR-005]] (attestation *because* identity is thin) · [[ADRs/ADR-007-privacy-minimal-windowed-one-tap|ADR-007]] (rejected the consent wall) · [[../19-build-plan-services-api-environments|doc 19]] §6.2 item 11 (anonymous sign-ins, **verified live**) · SCRUM-19 · SCRUM-24

---

## Context

The gap analysis put identity in the same register as the AR mode and the cartoonization runtime: a decision that had been *made* but only encoded in prose. [[../05-concept-to-mvp-gap-analysis]] row 5 reads, in full:

> **anonymous device id first, optional account later** — *nobody in this demographic forgives a signup wall before the first burn*

[[../07-system-architecture]] then encoded it twice: in the service map (*"Auth — anonymous first, → account"*) and in §5.3 (`profiles.user_id` = `auth.users`, with the note *"anonymous sign-in first; account upgrade links the same `user_id` (no data migration)"*). That second half is the load-bearing part — it means the upgrade is a **link**, not a migration.

**Why the audience decides this, not the technology.** The users are late-40s-to-50s, largely rural/low-end, and the ritual is an act of remembrance for a specific ancestor. Every friction step between *"I want to burn this for Grandma"* and *"I am holding a phone"* is a step where a real user simply does not do the thing. A signup wall is the single most reliable way to lose that user at exactly the moment the product is asking for trust. The stack makes anonymous identity cheap — Supabase Auth issues a real `auth.users` row for an anonymous session — so the wall would be a *choice*, not a constraint. It is declined.

**What the identity is *for*.** Identity exists here to attach a ledger and a quota to a player, so the league can rank and the daily caps can count. It is **not** an authentication claim about a person, and it is not a recovery mechanism. That distinction is what makes anonymous-first coherent: there is nothing in the ritual that genuinely requires knowing *who* you are, only *which device's* history this is.

**It was already load-bearing before this record existed.** The first-run path was, in fact, briefly dead: a brand-new anonymous user could not burn anything, because nothing created a `profiles` row for an `auth.users` insert and every money/AI table FKs to `profiles` ([[../19-build-plan-services-api-environments|doc 19]] §12 finding 2). Migration `0006` added the `handle_new_user` trigger, and a real `POST /auth/v1/signup` now returns `200` with `is_anonymous: true` and a full session. The decision has been exercised against the live project, not merely asserted.

---

## Decision

1. **The first burn happens with no account at all.** First run issues an **anonymous** Supabase Auth session — a real `auth.users` row with `is_anonymous: true`, indistinguishable downstream from any other authenticated principal for RLS, grants and foreign keys.
2. **Anonymous is a complete identity for the whole alpha.** Quotas, streaks, the ledger, the league, the Book of Tributes and the privacy posture all work against it. Nothing in the MVP is gated behind an upgrade.
3. **The account is optional, and asking for it is itself a design decision.** No screen nags, no banner, no "finish your profile" interstitial. If an account is wanted, it is offered in context (clan features, cross-device continuity) — never demanded to unlock the ritual.
4. **Upgrade links the same `user_id`; it does not migrate data.** `profiles.user_id` is the `auth.users` id, so converting an anonymous session carries the ledger, the ancestors and the streak with it. No data migration, no re-onboarding, no loss of league standing.
5. **Consent without walls** ([[ADRs/ADR-007-privacy-minimal-windowed-one-tap|ADR-007]] §5): one honest first-run notice to acknowledge, plus Art. 9 ritual-data consent before the first ancestor name — auditable, recorded in `consent_records`, but **not** an account gate. This is the precedent for the whole pattern: *notice and toggle*, never *wall*.
6. **Privacy follows the thin identity.** No NRIC, no phone, no contact list — the identity data class is the device/session id alone, held server-side, never in analytics ([[../13-privacy-and-retention]] §1 item 7).

---

## Alternatives considered → rejected

| Alternative | Why rejected |
|---|---|
| **Account required before the first burn** | The decision this record exists to prevent. For this audience it converts a 30-second act of remembrance into an account-creation task, at the worst possible moment. The prototype was explicitly wall-free and its retention was never the concern. |
| **A soft wall** ("continue as guest", sign-in upsell mid-flow) | A soft wall is a hard wall with worse manners: it still interrupts the ritual and still trains the user that the app wants something before it gives. Rejected on the same grounds as the hard one. |
| **Guest accounts with a device fingerprint** (no server identity) | Would break the thing identity is *for*. Quota and streak need a server-side principal to count against; the league needs a stable row; `ledger_events.user_id` needs a real foreign key. A fingerprint is also a privacy posture [[../13-privacy-and-retention]] rejects outright. |
| **Local-only identity first** (the prototype's in-memory model) | Cannot survive a reinstall, cannot rank a league, cannot enforce a daily cap — and its only virtue, that nothing leaves the device, is already contradicted by the photo upload. ADR-007 is explicit that in-memory "cannot survive real accounts". |
| **Defer the decision until the MVP is built** | The one option that guarantees the cost: the auth model is the earliest irreversible schema choice. `profiles` FKs to `auth.users`; choosing later means choosing twice. |

---

## Consequences

**Good**
- **The first-run path has no wall in it**, which is the whole point, and it is now the *default* code path rather than a bypass.
- **The upgrade is cheap by construction** — same `user_id`, no migration — so "ask for the account later" remains genuinely available later.
- **Anti-abuse stays proportionate.** ADR-005 can adopt *log-only* integrity signals and defer Play Integrity, precisely because a thin identity does not make abuse invisible; it makes it *bearable to observe*. Reclaiming a lightweight anonymous account is an option; reclaiming a real person's identity is not.
- **The blast radius stays small.** One data class (device/session id) instead of a dossier, which keeps ADR-007's PDPA/GDPR argument intact.

**Trade-offs / risks (accepted)**
- **A user who clears app data loses their history**, league standing and streak. Real, accepted: there is no email to recover from *by design*, and recovery is exactly what an account upgrade buys. The copy must never imply durability that anonymous identity does not provide.
- **Clan and invite flows are the first place this hurts** — an anonymous device cannot be shared across a family's phones, so [[../15-clan-model-and-book-of-tributes|doc 15]]'s shared altar genuinely wants an account. That is a legitimate in-context prompt for rule 3, and it is why the upgrade is offered rather than hidden.
- **Device-loss is unrecoverable at alpha**, and the fix (a recovery path) is account-shaped. Deferred deliberately, not overlooked.
- **Multi-device users see one streak until they upgrade.** Bounded and honest; the upgrade is the fix.

---

## References

- [[../05-concept-to-mvp-gap-analysis]] — §6 decision 5 (the row this record closes)
- [[../07-system-architecture]] §2 (service map · *"anonymous first, → account"*) · §5.3 (`profiles`)
- [[../13-privacy-and-retention]] §1 item 7 (the device/session id class) · §5 (consent without walls)
- [[ADRs/ADR-005-honest-client-caps-append-only-ledger|ADR-005]] §rejected (attestation deferred *because* of anonymous-first)
- [[ADRs/ADR-007-privacy-minimal-windowed-one-tap|ADR-007]] — rejected the pre-first-burn consent wall
- [[../15-clan-model-and-book-of-tributes]] — the shared altar, the natural account prompt
- [[../19-build-plan-services-api-environments|doc 19]] §6.2 item 11 · §12 finding 2 (the `profiles` bootstrap defect)

---

*Recorded 2026-10-05 (Session 29) as SCRUM-55. The decision predates it (S16/S20, encoded in doc 07 v2.x); this record closes the re-litigation gap and marks the anonymous sign-in path **verified live** on `yercgevebxvtzkgctfai`.*
