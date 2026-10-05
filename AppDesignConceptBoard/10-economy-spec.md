# 10 · Economy, quota & AI-cost model — SCRUM-18

**Date:** 2026-09-26 (Session 18) · **Jira:** SCRUM-18 · **Status:** ✅ complete (inputs locked, see [[09-economy-quick-check]] §7.7)
**Depends on:** [[ADRs/ADR-002-path-c-describe-then-generate|ADR-002]] (unit costs) · 09 quick check (benchmarks + derivation, SCRUM-18 comments 10105–10109)
**Feeds:** ADR-006 (burn-limit semantics) · ADR-008 (ad posture) · [[07-system-architecture]] §4.2/§5 (schema impact)

---

## 1 · Decisions (the whole model on one screen)

| Knob | Value |
|---|---|
| Photo credit price | **US$1.55 / 1,000** (break-even $1.19 + 30% worst-case margin; **floor $1.19** net-equivalent for bundles) |
| Photo fee | **150 credits** per capture-cartoonize |
| Starter grant | **2,000 credits** (13-photo runway, ≤ $1.33/user exposure) |
| Daily sign-in | **100 store points + 150 credits (= 1 free photo)** — sign-in-gated |
| Free-photo cap | **15/month** (ceiling $1.50–1.95/user) |
| 2nd free photo | ❌ → **ad-gated bonus photo** (watch a rewarded ad → +1, post-ritual only) |
| Daily burn caps | **10 photo burns/day** · **20 store-item burns/day** per user |
| AI cost / photo | **≈ US$0.10** (0.09–0.13 incl. ≤1 retry, ADR-002) |
| AI cost / store burn | **≈ US$0.01** (Track-B closed-set ID, no stylize) |
| Ads | **post-ritual only** (home/league/result screens; never inside the ritual) — banner + interstitial + rewarded (gated photo) |
| Stop rule | **global daily AI budget** exhausted → queue new burns, never silently fail |
| Wallets | `photo_credits` ≠ `tribute` ≠ `store` — **invariant: burn awards never produce photo credits** |

---

## 2 · Cost model (measured — spike actuals, ADR-002)

| Operation | Endpoint | Cost |
|---|---|---|
| Photo burn (Path C) | `moondream2` identify + `nano-banana-2` t2i | **$0.09** steady · **$0.10** planning · $0.13 worst (1 retry) |
| Store-item burn | `moondream2` closed-set ID only | **$0.01** |
| Correction-loop retry | re-probe + regenerate | +$0.09 (capped at 1 → ADR-002) |
| Sign-in / lurker / leaderboard | — | **$0** |
| Backend (Supabase/storage/CI) | free tiers | $0 at alpha · ~$25/mo at scale |

**Reward economy check (ticket question 4):** the spec'd formula — `400 × band(正中 2.0 / 虔誠 1.5 / 擦邊 1.0 / 偏失 0)`, new-ground ×2.0, streak +50 — **holds**, because awards live in `tribute` (leaderboard + store redemption) and **never convert to photo credits**: award size has zero AI-cost impact. Cadence check: typical burn earns 400–1,250 vs store items at 400–2,400 → **1–4 burns per cheap item** — a healthy reward rhythm. **Absolute numbers: keep as spec'd.**

**Alternative-items path (ticket question 5):** store bundles/gold bars (S13d catalogue) burn via `item_code` with **no photo** → Track-B ID cost **$0.01** → the free/low-cost ritual path for users with nothing to photograph. ✅

---

## 3 · Wallets & flows

```
photo_credits   in : cash shop ($1.55/1,000) · starter grant (2,000) · sign-in (150/day, 15/mo cap)
                out: photo fee (150) at CAPTURE time — refund on generation failure
tribute         in : burn awards (400 × band × [ground 2.0] + streak 50) · sign-in (100 store pts/day)
                out: store redemption (400–2,400 catalogue) · leaderboard = SUM(weekly)
store           in : S13d purchase accrual (20%) — unchanged
                out: store purchases
INVARIANT: credits ← money + deliberate grants ONLY; burn awards never mint credits.
```

---

## 4 · Quota rule — backend + UX copy (deliverable 2)

### Backend rule (server-authoritative, `cartoonize-orchestrator`)

```
on request_cartoonize(capture_id):
  assert captures.status == 'pending'
  assert user.photo_burns_today      <  10        # daily photo cap
  assert user.free_photos_this_month <  15        # grant cap (only for grant-funded)
  if funding == 'grant':
      assert sign_in_done_today && grant_available_today
  assert credits.balance             >= 150        # if funding by credits (else reject)
  assert global.ai_budget_today_usd  >= 0.10       # STOP RULE — else queue job
  debit 150 credits (if credit-funded) · enqueue cartoonize · record cost_micros/latency_ms/retries
  on generation failure → refund 150 credits · release budget reservation
store burns: same checks with cap 20/day and cost 0.01 against budget (Track B short-circuit).
```

- Daily caps reset at **local midnight** (device tz, server-verified per ADR-001 "client asserts, server decides").
- **No per-burn cooldown** — the daily caps *are* the cooldown; streak rewards daily return instead.
- **Stop rule:** `global.ai_budget_today_usd` (config; alpha = $5/day, production ≈ 70% of trailing-7-day cash-shop net). Exhausted → jobs **queue** (offline-queue machinery already exists), never error.

> ⚠️ **Implementation status (2026-10-04).** The **daily caps are enforced** in `request_cartoonize` (10/day photo allowance + a 3/min burst limit), and the **global stop-rule is now ratified as the next piece of work** — PM decision **SCRUM-59 option B** (2026-10-04): enforce the daily cap *and* the daily AI-budget stop-rule, with the job **queued** rather than failed. The alpha budget stays **$5/day** as written above. Everything else in this block — the 150-credit photo fee, the 2,000-credit starter grant, the 15/month free cap, the `grant|credits|ad` funding split — needs the wallet mechanics and stays deferred to beta (`SCRUM-18` / `ADR-006`).

### UX copy (EN / 中文) — "out of offerings", never "out of credits"

| State | EN | 中文 |
|---|---|---|
| Daily photo cap hit | *Today's offerings are complete — the shrine rests until dawn.* | *今日的供奉已圆满，神龛明晨再开。* |
| Out of photo credits | *Prepare more offerings to continue.* | *请补充供品后再继续。* |
| Free-photo monthly cap hit | *Your daily offering is still ready tomorrow — or prepare extra offerings now.* | *明日照常有每日供品；也可现在补充供品。* |
| Ad-gated offer (opt-in, post-ritual) | *Watch to prepare one more offering.* | *观看以再备一份供品。* |
| Global budget / queue | *The shrine is receiving many offerings — yours will be prepared shortly.* | *神龛正繁忙，您的供品稍后即成。* |
| Refund on failure | *The offering could not be prepared — your points have returned.* | *供品未能制成，点数已退回。* |

---

## 5 · Revenue side (ticket question 3)

| Stream | Spec |
|---|---|
| **Cash shop (primary)** | $1.55/1,000 (floor $1.19) · bundles must average ≥ floor · revenue/photo net **$0.1976** → **+32% margin** typical, worst case ≈ break-even |
| **Ads (secondary — profit)** | **Post-ritual only** (architecture rule; ADR-008 to formalise): banner (home/league) · interstitial (screen transitions, frequency-capped) · **rewarded = the ad-gated bonus photo**. Family-safe inventory; ARPDAU band $0.005 / **$0.011** / $0.04 (conservative/moderate/top) |
| **Free-tier subsidy** | starter 2,000 + sign-in 150/day (≤15/mo) → expected **$0.60/MAU-month**, ceiling **$1.95** |

---

## 6 · Ceilings (ticket question 6)

| Ceiling | Value |
|---|---|
| **Per-user monthly subsidy** (grants only: 13 starter + 15 free) | **≤ 28 photos ≈ $2.80 typical / $3.64 worst** |
| Per-user daily exposure (all funding, cap 10) | $1.00 typical / $1.30 worst — paid portion is revenue-positive |
| **Per-user monthly net** | ≤ −$3.64 (never buys) … typically ≈ **+$0.50** (mixed) |
| Global stop | `daily_ai_budget` → **queue new burns when exhausted** (§4) |
| Alpha operating cost | ≈ **$1–3/day** total (expected — 09 §5) |

---

## 7 · Schema impact → [[07-system-architecture]]

- §5.1 principle 5: **two currencies → three** (`photo_credits` joins `tribute`, `store`); `balances` view gains the credits sum.
- New columns/tables: `profiles.photo_credits` (or `ledger_events.currency += 'credit'`), `sign_in_grants (user_id, day, credits, store_pts, unique)`, `quotas` gains `photo_burns_used`, `free_photos_used_month`, `store_burns_used`.
- `cartoonize_jobs` already carries `cost_micros/latency_ms`; add `retries`, `funding_source (grant|credits|ad)`.
- **Doc updated to v2.3 alongside this spec.**

## 8 · Open items (deliberately out of scope)

1. **ADR-006** (burn-limit semantics) & **ADR-008** (ad posture) — formal records to write from this spec.
2. **Seasonal loyalty / rewards** — later iteration; may only modulate *grants* (streak/festival doublers), never price or the wallet invariant.
3. **Cash-shop price tiers/bundles** — concrete shelf ($4.99/$9.99 tiers) when IAP integration is specced; floor $1.19 binding.
4. Geo/mediation tuning of ARPDAU (3× lever) — post-launch.

---

*Created 2026-09-26 (Session 18) — SCRUM-18 deliverable: economy + cost model doc & burn-limit rule (UX copy + backend rule). All inputs from the locked quick check (09 §7.7).*
