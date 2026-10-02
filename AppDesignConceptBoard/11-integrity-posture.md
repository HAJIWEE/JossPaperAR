# 11 · Points integrity & anti-cheat posture — SCRUM-21

**Date:** 2026-09-27 (Session 19) · **Jira:** SCRUM-21 · **Status:** ✅ complete (decision recorded as [[ADRs/ADR-005-honest-client-caps-append-only-ledger|ADR-005]])
**Depends on:** [[ADRs/ADR-001-option-a-expo-rn-supabase-hosted-ai|ADR-001]] (client asserts · server decides) · [[10-economy-spec]] (caps + stop-rule) · [[07-system-architecture]] §4.3/§5.3 (the flow + schema this extends)
**Feeds:** [[07-system-architecture]] §5.3 (v2.4) · SCRUM-19 (privacy of anomaly data) · SCRUM-11 (league stakes + escalation) · SCRUM-20 (offline queue window)

> **The posture in one line (ADR-005):** an **honest client with hard server-side bounds** — the throw itself is accepted with caps (it is a physical gesture and cannot be verified), while *everything around it* — quota, streak, new-ground, catalogue value, award maths, and the ledger — is recomputed server-side, capped, rate-limited, and written **append-only**.

---

## 1 · Trust matrix — what the client may assert vs. what the server decides

| Input | Who decides | Rule |
|---|---|---|
| **Throw accuracy** | client **asserts** | The only client-held number that reaches money. Accepted *with caps* (§3) — a physical throw cannot be verified server-side. |
| **Band (正中/虔誠/擦邊/偏失)** | server **derives** | Computed from `accuracy` via the §4.3 thresholds. ~~Client sends band~~ — the easiest cheat (claiming 正中 on a graze) is removed by derivation. |
| **Award** | server **computes** | `400 × band × 2.0 (new-ground) + 50 (streak)`; clamped to the §4 bounds. The client never sends an amount. |
| **Quota state** (10 photo / 20 store daily) | server **decides** | Re-checked inside the `submit_burn` transaction, not trusted from the client's cached view. |
| **Streak day** | server **decides** | From `streaks` (`last_burn_date`); client's streak display is cosmetic. |
| **New-ground flag** | server **decides** | From `grid_cells` / `cell_burns`; the client sends only a coarse `cell_hash` — and lying about it is bounded by §4. |
| **Catalogue value / base 400** | server **decides** | From `offerings_catalog` — never client-supplied. |
| **`cell_hash`** (coarse location) | client **asserts** | Accepted (§6.5) — only ever used for the hidden new-ground multiplier, capped. |
| **`client_time`** | client **asserts, server-ignores for math** | Used for display/offline ordering only; streaks and quotas key off **server** dates (clock tampering ⇒ signal, not exploit). |
| **Money movement** | server **only** | No client path writes `ledger_events` (RLS: no UPDATE/DELETE for any role) — `award-service` is the only award writer. |
| **Idempotency** | client **supplies key, server enforces** | `idempotency_key` UNIQUE on `burns` + `ledger_events` → an offline queue can replay safely; a replayed burn returns the original receipt, never a second award. |

---

## 2 · What the server always recomputes inside `submit_burn`

1. Capture/item exists, is owned, and is `styled` (photo path) or a valid `item_code` (store path)
2. Daily quota still open (photo 10 / store 20, **server-day**)
3. Global AI budget not exhausted (else → queue, never error — stop-rule, economy §4)
4. Band = derive(`accuracy`) · streak from `streaks` · new-ground from `grid_cells`
5. Award = formula, **clamped** to §4 bounds → append `burns` + `ledger_events(award)` in **one transaction**
6. Bump `streaks`, `quotas`, `cell_burns` (decay tick) — same transaction

---

## 3 · The throw: accepted with caps (the deliberate decision)

The gap-analysis §6.6 decision, now made explicit:

* **We accept the client's `accuracy`.** There is no server-side way to know where a phone was pointed. Verification theatre (motion sensors, screenshot attestation, camera proof) buys little and breaks the 40–50s experience.
* **We remove every free upgrade around it:** band is derived, award is computed, multipliers are server-owned, values are catalogue-owned. Cheating *accuracy* is the only lever left — and it is a **bounded** lever:
  * claim perfect aim every time ⇒ always 正中 × new-ground × streak = **1,650/burn**
  * × daily burn caps (10 + 20) ⇒ **≤ 49,500 tribute/day** — impossible to exceed, derivable by SQL, and visible as a §6 anomaly long before it matters
* **The prize-cheat is capped, logged, and correctable** — the league is rolled weekly from the ledger (§7), so a flagged account's points can be adjusted *after the fact* without touching history.

---

## 4 · Sanity bounds (hard server-side clamps)

| Bound | Value | Enforced where |
|---|---|---|
| Award per burn | **0 … 1,650** tribute (bullseye + new-ground + streak = 400×2.0×2.0 + 50) | `submit_burn` clamp |
| Band | derived from `accuracy`; `accuracy` clipped to **0 … 96.97** (beyond ⇒ 偏失, award 0) | `submit_burn` |
| Photo burns / day | **10** | `quotas` (server-day) |
| Store burns / day | **20** | `quotas` (server-day) |
| **Max tribute / user / day** | **49,500** (30 burns × 1,650) — derived ceiling, not a stored knob | composition of the above |
| Max tribute / user / week | **346,500** (7 × 49,500) — the impossible-score line for the league | `weekly-roll` sanity check |
| AI retries / picture | **1** (ADR-002) | orchestrator |
| Refunds | only on `status = failed`, per `idempotency_key` (no double refund) | orchestrator |

---

## 5 · Rate limits (per user, server-enforced)

| Endpoint | Limit | Note |
|---|---|---|
| `submit_burn` | **6 / minute** | a human throw cycle (aim · throw · receipt) is ≥ 5s; 6/min ≈ 3× the fastest honest play |
| `request_cartoonize` | **3 / minute** | the daily cap binds first; this only blunts bursts against provider spend |
| `purchase_item` | **5 / minute** | store is a points *sink*; nothing legit bursts here |
| Capture upload | **10 / hour** | raw-photo storage pressure; daily photo cap is 10 anyway |

* **Counter**: short in-DB window counter (per-user, per-endpoint, 60s bucket) inside the same RPC — no Redis needed at alpha; revisit with SCRUM-20 NFRs.
* **Idempotent replays of the offline queue do not count against the limit** (same `idempotency_key` ⇒ replay, not a new event).
* Exceeding ⇒ reject with the existing quota/queue UX copy (never a raw error) — a rate-limited user should see *shrine busy* language, not *429*.

---

## 6 · Anomaly signals worth logging (→ new `integrity_flags` table)

| # | Signal | Detection |
|---|---|---|
| 1 | **Award velocity** | user's daily award > 49,500 (impossible by construction ⇒ means a code path broke) or sustained top-percentile for 7+ days |
| 2 | **Perfect-aim streak** | ≥ 20 consecutive 正中 over ≥ 3 days (honest distributions decay fast — graze is the modal band) |
| 3 | **Impossible streak** | `streaks.current_days` > account age − 1 |
| 4 | **Clock tampering** | `client_time` skew > 15 min from server time, or timezone hopping across daily resets |
| 5 | **Cell hopping** | burns in > 4 distinct `cell_hash`es within 1 hour (geohash ~4 blocks ⇒ impossible travel) |
| 6 | **Ledger anomalies** | any `ledger_events` insert not from a known `actor`; negative-award anomaly; `balances` mismatch vs. replayed sum |
| 7 | **Idempotency abuse** | same key, different payload ⇒ reject + flag |
| 8 | **Refund/queue abuse** | repeated generation-failure refunds from one device |

**Response ladder**: (1) log-only — **the alpha default** · (2) shadow-limit (halve caps) · (3) weekly-roll hold (points counted, promotion withheld pending review) · (4) suspend. Escalation policy beyond log-only is **explicitly deferred** to beta, when SCRUM-11 league stakes exist — family alpha needs only the log.

> **Privacy link (SCRUM-19):** flags store `user_id + signal + timestamp + evidence json` — **no photos, no ancestor names, no raw coordinates** (only the coarse cell hash already in the schema).

---

## 7 · Appeal / correction — fixing a wrong award without editing history

1. **Never UPDATE or DELETE a ledger row** (no role has the grant — RLS).
2. A correction = a compensating **`adjustment`** event: `amount = ±n`, `ref_event_id` → the event being corrected, `reason`, `actor` (`admin`/`system`).
3. `balances` is a `SUM` view — the correction self-propagates; the original stays auditable.
4. **User-facing path**: family alpha = the PM hears it directly (invite-only); beta = in-app "report a score" → flag review (§6 ladder).
5. **Weekly rolls are snapshots** — a correction landing after a roll applies to the *next* roll; `weekly_rolls` audit rows are never rewritten (an explicit `adjustment` + note is the record).

---

## 8 · Schema impact → [[07-system-architecture]] (applied as v2.4)

* **`band` moves out of the client payload** — `submit_burn` takes `accuracy` only; `burns.band` stays as the *server-derived* stored value.
* **`ledger_events.type`** gains `grant` (sign-in/starter/ad-gated), `topup` (cash-shop), `refund` (failed generation) → `award|purchase|accrual|grant|topup|refund|adjustment`.
* **`ledger_events`** gains `actor` (who wrote it) + `reason` (required for `adjustment`).
* **New `integrity_flags`** table: `id`, `user_id`, `signal`, `severity`, `evidence` (jsonb), `created_at`, `reviewed_at?`, `outcome?`.
* **New `rate_counters`**: `user_id`, `endpoint`, `window_start`, `n` — PK(`user_id`,`endpoint`,`window_start`).

---

## 9 · Open / deferred

| # | Item | Owner |
|---|---|---|
| 1 | Escalation beyond log-only (shadow-limit → hold → suspend) — needs real signal data | beta · SCRUM-11 |
| 2 | OS-level attestation (Play Integrity API) — **not** day one; revisit if §6 shows spoofed devices | beta |
| 3 | Rate-limit exact numbers (6/min etc.) — validate against real play patterns | SCRUM-20 NFRs |
| 4 | Offline queue replay window (how many days an unflushed burn may land) | SCRUM-20 (07 §7 Q1) |
| 5 | Do anomaly signals count as processing needing consent? (no PII beyond user_id, but confirm) | SCRUM-19 |

---

*Created 2026-09-27 (Session 19) — SCRUM-21 deliverable: integrity one-pager + ledger event schema sketch. Decision recorded as [[ADRs/ADR-005-honest-client-caps-append-only-ledger|ADR-005]]; schema impact applied to [[07-system-architecture]] v2.4.*
