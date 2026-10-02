# 13 · Privacy & data-retention posture — SCRUM-19

**Date:** 2026-09-27 (Session 19) · **Jira:** SCRUM-19 · **Status:** ✅ complete (decision recorded as [[ADRs/ADR-007-privacy-minimal-windowed-one-tap|ADR-007]])
**Depends on:** [[12-security-and-legal-scoping]] §B.5 (PDPA baseline · GDPR design target · D1–D10) · [[07-system-architecture]] §5.3 (schema) · [[05-concept-to-mvp-gap-analysis]] §7.5 (risk #5) · ADR-004 (anonymous first) · ADR-005/[[11-integrity-posture]] (flags)
**Feeds:** 07 → v2.5 · Play **Data Safety form** + **account-deletion** requirement (12 §B.5 hooks) · B.8 privacy policy · SCRUM-25 (analytics events) · SCRUM-33 (privacy hub screens) · SCRUM-12 (decay keeps `cell_burns`)

> **Posture in one line (ADR-007):** *collect the minimum, keep it for a bounded window, show the coarsest location that works, and let one tap erase everything — with a receipt.* The prototype's "everything in memory, gone on reload" survives as a **policy**, not an accident.

---

## 1 · PII inventory (D8 — one inventory, three consumers: this doc · Data Safety form · privacy policy)

| # | Data | Collected | Where it lives | Who can see it | Why |
|---|------|-----------|----------------|----------------|-----|
| 1 | **Raw capture photo** | always (photo path) | Storage `captures/{uid}/` (private bucket) | owner only (signed URL) | the stylization input |
| 2 | **Styled sprite** (AI output) | always | Storage `styled/{uid}/` | owner only | the offering — the product |
| 3 | **Ancestor names** (up to 4) | optional | Postgres `ancestors` (RLS) | owner only | the digital tablets |
| 4 | **Coarse location** (geohash cell ≈4 blocks) | optional | `grid_cells` (no identity) · `cell_burns` (user+cell+day) | server only; value **hidden as UI** (S11) | new-ground multiplier + decay |
| 5 | **Tribute record** (points, image ref, visibility `private` default) | always | `tributes` (RLS) | owner only unless shared | the Book of Tributes |
| 6 | **Ledger / purchases / grants** | always | `ledger_events` (append-only) | server only | balances, the receipt trail |
| 7 | **Device/session id** (anonymous auth) | always | `auth.users` · `devices` | server only | identity without signup (ADR-004) |
| 8 | **`client_time`/tz** | always | on `burns` rows | server only | offline ordering (never for math — ADR-005) |
| 9 | **Integrity signals** (accuracy, cell hops, flags) | automatic | `burns` · `integrity_flags` | server only | anti-cheat, log-only at alpha |
| 10 | **Consent records** | on consent | `consent_records` (new, §11) | server only | proof of consent (PDPA/GDPR) |
| 11 | **Usage events** | **opt-in only, default OFF** | analytics provider | provider | SCRUM-25 — never #1–#4, #9 |
| 12 | **Ad id** | later (beta) | ad SDK | SDK | S9/ADR-008 |

**Never collected:** NRIC/phone (no account wall — ADR-004) · raw GPS trail · contact lists · precise coordinates (only the coarse cell ever leaves the device) · payment cards (Play Billing handles money — we never see cards).

---

## 2 · Retention windows (the core decision)

| Data | Window | Enforced by |
|---|---|---|
| **Raw capture photo** | **purged 7 days after the job reaches terminal state** (`styled`/`rejected`) — retry/appeal window, then gone | nightly cron `purge_raw_captures` (nulls `storage_path`, deletes object) |
| Styled sprite · tribute image | **while the account lives** | delete-all (§9) |
| Ancestors · inventory · decorations · burns · ledger · streaks · quotas · tributes | **while the account lives** | delete-all (§9) |
| `cell_burns` | **90 days rolling** (decay input only — SCRUM-12 needs recent history, not a trail) | nightly cron |
| `grid_cells` | **indefinite** — aggregate, no user identity in the table | n/a (by construction) |
| `rate_counters` | **24 h** (60s windows are the live data) | daily cron |
| `devices` | **90 days after `last_seen_at`** | daily cron |
| `integrity_flags` | **12 months**; survive account deletion **90 days as pseudonymous uuid** (fraud evidence — deliberate §7 exception) | manual/cron |
| App/edge logs | **30 days**, events only — no photo bytes, no names, no coordinates (12 §A.3 S7) | platform config |
| `consent_records` | while the account lives (proof of consent) | delete-all |
| Analytics events (if opted in) | **13 months**, aggregated where possible | SCRUM-25 |
| Play purchase records | held **by Google**, outside our deletion — stated in the receipt (§9.6) | n/a |

**Rule of thumb:** *if a window isn't in this table, it doesn't exist yet — no new data class ships without one.*

---

## 3 · Location rule (~4-block privacy, honoured exactly)

* Client sends **only `cell_hash`** (geohash ≈4 blocks); no GPS coordinates are stored anywhere, ever.
* `grid_cells` holds aggregate value with **zero identity**; `cell_burns` holds `user + cell + day` — enough for decay, **useless as a trail** (and purged at 90 days).
* The cell's value/`new_ground` is **hidden as UI** (S11 decision) — we don't render a map, and neither does the client.
* Anomaly detection uses cell *hops* server-side (11 §6.5) without exporting coordinates anywhere.

---

## 4 · Ancestor-names rule (standing)

**Names never reach:** analytics · crash reports · logs · store listing · any share surface. They live in `ancestors` under RLS, appear only on the owner's tablet UI, and are excluded from every export except the user's own (§5, §9). Legally the deceased are out of scope on both sides (12 D9) — the rule is ours for cultural reasons (SCRUM-24 owns sensitivity).

---

## 5 · Consent & notices — written for a 40–50s reader (EN / 中文)

**Design: no walls.** ADR-004 (anonymous first) means consent can't gate the first burn. So: **one honest first-run notice (acknowledge, not a maze) + a Settings toggle for the optional stuff (default OFF)** — hosted in the boot flow (12 D1/D2), rendered on the signed-off `0b` board vocabulary.

| # | Moment | EN | 中文 |
|---|--------|----|------|
| N1 | **First-run notice** (D2) — acknowledge, single tap | *Your photos, your ancestors' names, and where you pay tribute stay in your account. We use them only to make your offering — never sold, never in ads.* | *您的照片、先人姓名与祭拜位置只属于您的账号，仅用于制作供品。我们绝不出售这些资料。* |
| N2 | **Raw-photo note** (transparency on §2) | *Your original photo is deleted automatically a week after the offering is ready.* | *供品完成后，您的原始照片将于一周内自动删除。* |
| N3 | **Art. 9 ritual-data consent** (12 D1, GDPR) — shown before the first ancestor is saved | *This app records your ancestral tributes. Continue?* | *此应用将记录您的祭拜供品。是否继续？* |
| N4 | **Analytics opt-in** (default OFF, toggle in settings) | *Help us improve — share anonymous usage. Never your photos, names, or location.* | *分享匿名使用情况以帮助改进 — 绝不包含照片、姓名或位置。* |
| N5 | **Delete prompt** (§9) | *Delete everything? Your photos, tablets, and records are erased from our servers. This cannot be undone.* | *删除全部资料？您的照片、牌位与记录将从服务器移除，无法复原。* |
| N6 | **Ads consent** (EEA, later — UMP, 12 D10) | (provided by Google's UMP form at integration; no custom copy needed) | （接入时由 Google UMP 表单提供） |

* **Analytics and ads are opt-IN; nothing else is** — location and photos are needed for the offering itself and are covered by N1+N2, not buried in checkboxes.
* Consent states are recorded in `consent_records` (§11) so withdrawal is as auditable as granting.

---

## 6 · Photo moderation posture (doc 03's open question)

1. **Provider-side moderation runs before stylization** — if fal/Google flags the capture, `captures.status → 'rejected'`, no generation, **no image retained beyond the 7-day raw window**.
2. Copy (never says "rejected for content" to this audience): *This offering cannot be prepared.* / *此供品無法製作。* — with the existing refund rule (economy §4: credits returned).
3. **Tributes are `private` by default** (already schema) — sharing is opt-in, so there is no public feed to moderate at alpha; family alpha = invite-only, PM sees flagged items directly.
4. If sharing goes public later → Play's UGC-moderation requirements kick in (12 B.2) — **explicitly out of MVP scope**, recorded so it gets re-checked before any share-surface ships.

---

## 7 · Region, transfers & the family alpha

* **Supabase region: `ap-southeast-1` (Singapore)** — matches the PDPA base posture (D5); chosen at repo milestone, recorded here so it isn't defaulted by accident.
* **fal.ai (US) receives images** — declared in the privacy policy; fal publishes a DPA (seen on their legal page, 12 D5) and does not train on Client Content (12 B.1).
* Analytics/ad providers: chosen *after* SCRUM-25/ADR-008, each with a DPA + transfer check — none exist yet.
* **Family alpha implication:** small and private ≠ exempt — it is *real* data under real law (PDPA applies from day one). What alpha changes: no automated deletion grace period, PM acts as DPO (12 D7), and the runbook (§9) is exercised **for real on the PM's own account before anyone else joins** — prove delete works by deleting your own data first.

---

## 8 · Delete-all — what happens, referential rules

**Entry:** Settings → Privacy hub (12 D3 → SCRUM-33) → *Delete everything* (N5) → one confirmation.

| Question | Decision |
|---|---|
| Immediate or grace period? | **Immediate, hard delete** at alpha (honest + simple); grace period (e.g. 30 days) = open for beta, §12 |
| What is deleted? | Everything in §1 rows 1–10 **except** `integrity_flags` (90-day pseudonymous hold, §2/§7) and Google-side purchase records (§9.6) |
| **League points?** | **They vanish.** Board = `SUM(ledger)` → with no rows, the user disappears from the next recompute; `cohort_members` is **tombstoned** (`user_id → NULL`, `display_label → "已注销 · deleted"`, week's points kept for that roll's audit); written `weekly_rolls` rows are **never rewritten** (they hold labels, not FKs — no profile FK on historical audit tables, §11) |
| Streak/quotas/cells? | deleted with the account; `grid_cells` aggregates are unaffected (they never held identity) |
| The ledger? | **deleted too** — append-only means *no edits while alive*, not *immortal after consent withdrawal*; there is no legal bookkeeping need at hobby scale. Fraud evidence survives separately in `integrity_flags` (§7) |
| Receipt? | **yes** — returned by the RPC and shown on-device: what was deleted, counts per class, timestamp, and the note that Play purchase records remain with Google (N5 confirmation screen) |

---

## 9 · 📋 Data-deletion runbook (deliverable 2)

**Trigger:** user taps *Delete everything* (in-app) · PM by hand (support case) · account-inactivity cleanup (post-alpha, §12).

1. **Authenticate** — the calling session must own the account (anonymous session or upgraded account); rate-limit: 1 delete attempt / 10 min / user.
2. **Client wipes local state first** — SQLite cache, queued offline captures (queued-but-unsent burns are dropped, not sent), image caches, i18n-independent.
3. **Storage purge** — delete all objects under `captures/{uid}/`, `styled/{uid}/`, `tributes/{uid}/` (list-then-delete; verify bucket listing returns empty for the uid).
4. **SQL transaction, children first:** `ancestors` → `equipped_decorations` → `inventory` → `cartoonize_jobs` → `captures` → `burns` → `ledger_events` → `streaks` → `quotas` → `cell_burns` → `devices` → `rate_counters` → `consent_records` → `tributes` → **tombstone** `cohort_members` (§8) → `profiles` (+ the `auth.users` link via the admin API).
5. **Leave behind:** `grid_cells` (no identity) · `integrity_flags` (pseudonymous, 90-day purge) · `weekly_rolls` (label-only history).
6. **Receipt** — RPC returns per-class counts + ISO timestamp; client renders N5-confirmation screen; if the account has an email (upgrade case), send one confirmation line.
7. **Verify** — the same RPC re-runs a probe query across every personal table for that uid; **0 rows** is the success condition; non-zero ⇒ abort-report to PM (and it's a bug, not a user problem).
8. **Sign out** and drop the session; app returns to Splash → first-run (the boot flow, SCRUM-28/29 boards).
9. **Play-side** — after Play account integration: ensure the Play Console account-deletion URL/flow points at this in-app path (12 §B.5 hook 1) — submission blocker.
10. **PM drill:** run steps 1–8 on the PM's own account before the family alpha opens; re-run after any migration touching §1 tables.

---

## 10 · Task-by-task coverage (ticket checklist)

| SCRUM-19 task | Where |
|---|---|
| PII inventory | §1 |
| Retention windows | §2 |
| Location: cell-only, no trails | §3 |
| Names never in analytics/crash | §4 |
| Delete-all one tap + receipt + league referential rules | §8, §9 |
| Consent flow for 40–50s readers | §5 (N1–N6) |
| Photo moderation | §6 |
| Region + family-alpha implications | §7 |

---

## 11 · Schema impact → [[07-system-architecture]] (v2.5)

* **New `consent_records`** — `user_id`, `kind` (`first_run`|`ritual_data`|`analytics`|`ads`), `granted` bool, `at` — in the Identity group; withdrawal = new row (append-style), not an edit.
* **Tombstone rule on historical tables:** `cohort_members.user_id` nullable; `weekly_rolls` and other audit rows keep **labels, not profile FKs** (ON DELETE SET NULL where an FK must exist).
* **Retention crons (Edge cron):** `purge_raw_captures` (7d) · `purge_cell_burns` (90d) · `purge_rate_counters` (daily) · `purge_devices` (90d idle) · `purge_integrity_flags` (12m / 90d post-delete).
* **`rpc.request_account_delete()`** — the §9 flow, server-side, returns the receipt payload.

## 12 · Open items (deliberate)

| # | Item | Owner |
|---|---|---|
| 1 | Deletion **grace period** (30-day restore) vs immediate — alpha ships immediate | beta · revisit with real delete data |
| 2 | Account-inactivity auto-purge threshold (e.g. 24 months) — not needed before beta | post-alpha |
| 3 | Analytics retention detail (13 months stated — exact aggregation) | SCRUM-25 |
| 4 | Privacy policy + ToS drafting (B.8) — consumes §1/§2/§5/§7 verbatim | SCRUM-19 ✅ inputs ready → write at first submission prep |
| 5 | UGC sharing moderation (if tributes ever become public) | pre-share · 12 B.2 |
| 6 | DPIA-shaped checklist (12 D7 — likely-required for GDPR) — a one-pager overkill at alpha; do it if EU listing happens | pre-EU listing |

---

*Updated 2026-09-27 (**v1.1**, same session) — **§5 ZH copy converted traditional → simplified** to match the ZH design row (all 63 Penpot boards are simplified; this doc was the outlier) — applied verbatim to the new 0b3/1s3 boards (SCRUM-44)*
*Created 2026-09-27 (Session 19) — SCRUM-19 deliverable: privacy & retention one-pager (§1–§8, §10) + data-deletion runbook (§9). Decision recorded as [[ADRs/ADR-007-privacy-minimal-windowed-one-tap|ADR-007]]; schema impact → [[07-system-architecture]] v2.5. Built on the §B.5 PDPA/GDPR design inputs (12) verified earlier this session.*
