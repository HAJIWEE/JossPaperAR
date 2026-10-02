# ADR-005 · Integrity posture — honest client, server-derived band, capped append-only ledger

**Status:** ✅ **Accepted** · 2026-09-27 (Session 19)
**Decider:** stakeholder (PM), on AI architecture support
**Closes (gap-analysis §6):** **6 · integrity posture** — honest client + sanity bounds vs server verification
**Related:** [[../11-integrity-posture|11-integrity-posture]] (the full one-pager: trust matrix · bounds · rate limits · anomaly signals · corrections) · [[../07-system-architecture]] §4.3/§5.3 · [[../10-economy-spec]] · SCRUM-21

---

## Context

The leaderboard is the product's competition, and its honesty is the whole prize — but a throw is a **physical gesture**: the server cannot know where the phone was pointed. The prototype banks awards in memory and re-ranks a local league; the MVP moves money-shaped points (`tribute`) onto a shared weekly board, so the stakes are real from day one. The economy is already locked ([[../10-economy-spec|economy spec]]): daily burn caps 10 photo / 20 store, one global AI budget stop-rule, three wallets with the invariant *burn awards never mint photo credits*. Whatever posture we pick must fit a 40–50s audience (no verification friction) and a solo hobby builder (no anti-cheat operations team).

---

## Decision

1. **Honest client + hard server-side bounds.** The client's `accuracy` is the *only* client-held number that reaches money, and it is accepted deliberately — documented as a bounded, monitored risk.
2. **The server derives everything around the throw.** `band` is computed from `accuracy` (the client no longer sends it); award, streak, new-ground, catalogue value, and quota are recomputed inside the `submit_burn` transaction. Cheating accuracy is the sole remaining lever.
3. **Every lever is capped:** award clamped 0–1,650/burn; 10+20 burns/day ⇒ **≤ 49,500 tribute/user/day** by construction; 6/min `submit_burn` (idempotent queue replays exempt); weekly impossible-score line 346,500.
4. **Append-only ledger** (already schema'd in 07 §5.3): `award-service` the only award writer, no UPDATE/DELETE for any role, `idempotency_key` UNIQUE ⇒ replay-safe offline queue; corrections = compensating `adjustment` events; balances are a `SUM` view.
5. **Log anomalies, don't auto-punish (alpha):** award velocity · perfect-aim streaks · impossible streaks · clock/tz tampering · cell hopping · ledger anomalies → `integrity_flags`, **log-only** at alpha; escalation ladder defined but deferred to beta (SCRUM-11).

---

## Alternatives considered → rejected

| Alternative | Why rejected |
|---|---|
| **Server verification of the throw** | Physically impossible — no server-side signal knows where the phone pointed. Sensor/proof-of-camera schemes are spoofable theatre and add friction this audience won't forgive. |
| **Client sends `band` directly** (prototype behaviour) | A free upgrade (claim 正中 on a graze) for zero benefit — derivation costs nothing and closes it. |
| **OS attestation (Play Integrity) day one** | Bumps friction + complexity before there is evidence of abuse; anonymous-first identity (ADR-004) would be undermined. Revisit at beta if device-fake signals appear. |
| **Mutable balance counter** | Editable by definition; no audit trail; the exact thing a corrupt/dev build would increment. The SUM-of-events is self-checking. |
| **Aggressive anti-cheat ML / shadow-bans at alpha** | No data, no ops capacity, invite-only family cohort — signals first, policy later. |
| **Trusting `client_time` for streaks/quotas** | Free clock-rolling of daily caps; server dates are used for all math (client time is display-only). |

---

## Consequences

**Good**
- The one unverifiable input is reduced to a single bounded number; everything else is server maths enforced in one transaction.
- Cheating yields at most 49,500 pts/day, is *visible* (perfect-aim + velocity signals), and is correctable after the fact via ledger adjustments — the weekly league roll is the natural correction point.
- Zero added client friction; fits ADR-001's "client asserts, server decides" and needs no new infrastructure (Postgres constraints + RPC checks only).

**Trade-offs / risks (accepted)**
- Some players *will* spoof aim — accepted as the cost of an unverifiable gesture; capped and monitored, not prevented.
- Rate-limit counters in-DB are approximate under concurrency — fine at alpha scale (SCRUM-20 to revisit if needed).
- Response ladder beyond log-only is undefined until beta — deliberate: wrong automated penalties on a family app are worse than a few cheated points.

---

*Accepted 2026-09-27 (Session 19) as the SCRUM-21 decision record; full posture + schema sketch in [[../11-integrity-posture|11-integrity-posture]].*
