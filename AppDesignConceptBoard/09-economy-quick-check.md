# 💰 Economy quick check — can ad revenue fund the Path-C pipeline?

**Date:** 2026-09-26 (Session 18) · **Feeds:** SCRUM-18 (economy spec, formal) · ADR-008 (ad posture, still open) · ADR-002 (unit costs)
**Question (PM):** what exposure/distribution levels make ad revenue feasible against the cost of running the app?
**Nature:** sanity check with published benchmarks — *not* the economy spec; every number below is a planning placeholder until SCRUM-18.

---

## 1 · Unit economics (from the spike — measured, not assumed)

| | Cost | Source |
|---|---|---|
| **Photo burn** (Path C: identify → generate, incl. retry allowance) | **≈ US$0.10** (0.09 steady, ≤0.13 with 1 retry) | ADR-002 · spike actuals (133 runs) |
| **Store-item burn** (Track B closed-set short-circuit, no stylize) | **≈ US$0.01** | RESULTS Track B |
| **Non-burning active user** (browse league, collect, look) | **$0** | — |
| Backend (Supabase / storage / EAS) | $0 at alpha (free tiers); Pro ~$25/mo later | ADR-001 |

## 2 · What ads actually pay (published benchmarks, Sep 2025 → mid-2026)

| Format | Tier-1 (US/UK/CA/AU/JP) | Global average |
|---|---|---|
| Banner | $0.50–1.50 eCPM | $0.20–0.80 |
| Interstitial | $5.00–8.00 | $2.50–5.00 |
| Rewarded video | $15.00–30.00 | $8.00–18.00 |

- **Geography is the #1 lever** — 80% Tier-1 traffic ≈ **3× revenue** of an identical app at 20% Tier-1 *(Playwire/AdMob benchmarks, Sep 2025)*.
- **Mediation** (multi-network) adds **+40–60%** over AdMob-only; **plan on 70–80%** of any calculator figure.
- Non-game apps sit **below** the gaming benchmarks above (gaming runs +20–30%).
- Sources: Playwire "AdMob eCPM Benchmarks" (2025-09-17) · Tenjin/CAS Ad Monetization Benchmark Report 2026 (Q2 2026 data).

**ARPDAU planning band** (post-ritual placement only — ads never in the ritual flow, per the architecture rule; 0.75 haircut applied):

| Case | Assumed ad load | ARPDAU |
|---|---|---|
| 🔻 Conservative — global mix, light load | 5 banners + 0.5 interstitial/day | **≈ $0.005** |
| ◼️ **Moderate — diaspora mix (SG/TW/US/AU), standard load** | 10 banners + 1.5 inter + 0.5 rewarded | **≈ $0.011** |
| 🔺 Top — Tier-1 weighted + mediation | 15 banners + 3 inter + 1 rewarded | **≈ $0.04** |

## 3 · The break-even identity

```
photo_burns_per_DAU_per_day  ≤  ARPDAU ÷ US$0.09
```

| ARPDAU | Affordable photo burns / DAU / day | Expressed as |
|---|---|---|
| $0.005 (conservative) | **0.06** | 1 photo burn per ~18 daily-active users |
| $0.011 (moderate) | **0.12** | **1 photo burn per ~8 daily-active users** |
| $0.04 (top) | **0.45** | 1 photo burn per ~2 daily-active users |

Store-item burns stretch this 9× (each $0.01 instead of $0.09).

## 4 · The key finding — scale does NOT fix it

**Both sides scale linearly with users.** Downloads/DAU level changes the *absolute dollars* but never the *ratios* — an engaged photo-burner generates a deficit of $0.06–0.09/day no matter how many users there are. Feasibility is decided by **three ratios**, not by exposure:

1. **Photo-burning share of DAU** (vs lurkers who browse the league/altar and cost $0 but earn ads) — must be ≤ **~12%** at moderate ARPDAU, ≤ ~45% at top-case.
2. **Burn mix** — pushing users to **store-item burns** (Track B, $0.01) is a 9× cost lever.
3. **Audience geography** — a Tier-1-weighted diaspora audience is a ~3× revenue lever on the same behaviour.

**And the quota (SCRUM-18) is the hard cost control by design:** `burns/day cap × photo share × $0.09` is a *chosen* number, not an exposure-driven one.

## 5 · Exposure levels — what it looks like at each stage

Assumptions: moderate ARPDAU $0.011 · 1 photo burn + 1 store burn per burning DAU (cost $0.10) · top-case column = $0.04.

| Stage | DAU | Ad revenue / day | AI cost / day at **12% burning** | AI cost / day at **40% burning** | Verdict |
|---|---|---|---|---|---|
| **Family alpha** | ~50 | ~$0.55 | $0.60 ✅ roughly break-even | $2.00 ❌ −$1.45/day (~−$45/mo) | Runs as a **cost centre** — the expected price of the hobby alpha |
| **Soft launch** | 1,000 | ~$11 | $12 ✅ ~break-even | $40 ❌ −$29/day (~−$870/mo) | **Feasible iff quota holds burning ≤12%** |
| **Small community** | 5,000 | ~$55 | $60 ✅ ~break-even | $200 ❌ −$145/day | Same — ratios, not scale |
| **Top-case column** (Tier-1 + mediation) | 5,000 | ~$200 | $60 ✅ +$140 | $200 ✅ 0 | Ads *can* fund a heavily-burning base — but only in the top case |

**Thresholds to remember:**
- AdMob pays out monthly with a **$100 threshold** — below ≈ 9,000 moderate-ARPDAU DAU-days you're just accumulating a balance, not cash-flowing.
- **Festival bursts** (Qingming / Hungry Ghost = the product's peak) spike burning **and** eCPMs together — quota caps the tail risk; holiday CPMs partially offset.
- Alpha-scale burn cost with no ad volume: **≈ $1–3/day** — treat as the known operating cost until distribution exists.

## 6 · Verdict

1. **Ads are a subsidy, not the funding.** An engaged photo-burner costs 3–20× what they earn in ads at any realistic ad load. Never model ad revenue as covering the *heavy* user.
2. **Ad revenue is feasible for the *blended average* at ≥ ~1,000 DAU** — provided the SCRUM-18 quota keeps photo burns ≤ ~1/day for ≤ ~12% of DAU (moderate case), or the audience is Tier-1-weighted (breaks even at ~45% burning).
3. **Exposure level itself is not the variable** — 10k DAU at a bad burning ratio loses 10× more than 1k DAU at the same bad ratio. **Distribution helps only by adding ad-monetizable lurkers and shifting geo mix.**
4. **Levers, in order of magnitude:** quota (hard cap) · burn mix → store items ($0.01, 9× cheaper) · audience geo (3×) · mediation (+40–60%) · retry cap in the correction loop (≤$0.13/burn) · *post-ritual ad placement only (ADR-008 still open — this check assumes the architecture's "never in the ritual flow" rule).*
5. **Formal numbers belong to SCRUM-18** — this check sets the shape (break-even identity + ratios); the spec should pick the quota, the ad load, and the geo mix explicitly.

---

*Created 2026-09-26 (Session 18) — quick feasibility pass on PM request; benchmarks cited inline; all costs from ADR-002 spike actuals.*

---

## 7 · PM PROPOSAL (2026-09-26): points-gated photos + cash shop — the primary revenue

**Proposal:** start every user with **2,000 points** · charge **150 points per picture** (cartoonization) · sell points in a **cash shop** (real money) → revenue flows from the *core flow* itself; ads drop to secondary subsidy.

### 7.1 Validation math

| Quantity | Value |
|---|---|
| Free runway | 2,000 ÷ 150 = **13 photos per user** (13 full + 50 left over) |
| AI exposure of the grant | 13.3 × $0.10 ≈ **US$1.33 per new user** (max loss if they never buy) |
| Break-even point price | 150 pts must cover $0.10 → **≥ $0.67 / 1,000 points** |
| Suggested tier **$0.99 / 1,000 pts** | revenue/photo = **$0.149** → gross margin **+$0.049 (+33%)** over AI cost |
| …after Google Play fee (15% < $1M/yr) | net ≈ **$0.126/photo → +26% over AI** ✅ |
| Each cash-shop sale | profitable for any photo count funded — **core flow monetized directly** ✅ |

**Verdict: financially sound.** The ratio problem of §4 dissolves — revenue is now levied on the *exact activity that costs money*, instead of hoping ads (ARPDAU $0.011) cover burns ($0.10). Ads + starter grant = the free-tier subsidy; cash shop = the funding.

### 7.2 Three decisions this forces (must be closed in SCRUM-18)

1. **Which wallet pays the 150?** ⚠️ **Do NOT charge the `tribute` ledger:**
   - leaderboard = `SUM(weekly tribute)` would be polluted by photo spending;
   - **the loop inverts**: burn awards are **400–1,250 pts** (prototype spec: bands ×1.0/×1.5/×2.0 + streak) ≫ 150 fee → active players mint +250/cycle → *photo → burn → richer → photo* funds **unbounded AI spend from free points**.
   - **Recommended: a third balance — `photo_credits`** — produced only by (a) the cash shop, (b) grants (2,000 starter, streak/seasonal bonuses). Burn awards never touch it; `tribute` stays pure leaderboard. Simple invariant: **credits in = real money + deliberate grants; credits out = photos.**
2. **Quota (SCRUM-18) remains the hard backstop.** Points gate the casual layer; only the daily burn/capture cap bounds exploiters and festival bursts. Points alone are not cost control.
3. **Charge at capture (cartoonize request), not at burn** — the $0.10 is spent at generation; unburned photos must not be free AI. Failed generations → auto-refund the 150.

### 7.3 The resulting revenue stack (ranked)

| Layer | Role | Scale |
|---|---|---|
| **Cash shop (photo credits)** | **primary — funds the pipeline** | +33% gross on every credit-funded photo |
| Starter grant 2,000 | bounded acquisition subsidy | ≤ $1.33/user |
| Burn awards → photos | engagement loop, **capped by quota** | cost, controlled |
| Ads (post-ritual only) | free-tier subsidy, secondary | ≈ $0.005–0.04 ARPDAU |

### 7.4 Open questions for SCRUM-18

- Price tiers ($0.99/1,000 · $4.99/5,500 bonus · $9.99/12,000 bonus?) and any store-point interaction (S13d's 20% accrual).
- Daily quota numbers (capture cap × $0.13 worst-case = max daily exposure per user).
- Whether earn-loops may grant *credits* at all (recommendation: only event/seasonal grants, never per-burn).
- UX/ADR-004: 13 free photos must cover the full first-run experience — verify against the onboarding loop (capture → burn → reward) before fixing the 150.
- Cultural guard (ADR-008-adjacent): the **ritual itself must not feel paywalled** — the quota message should read as *daily incense offering*, not a meter.

---

*Section 7 added 2026-09-26 (Session 18) — PM proposal, validated against spike unit costs + prototype award values. Formal spec → SCRUM-18.*

### 7.5 BACK-CALCULATION — break-even points (ads = pure profit)

**Definition:** *sustainable* = points revenue (net of platform fees) covers **all AI cost** → ad revenue sits fully on top as profit. Constants: AI cost **C = $0.10/photo** (0.09–0.13 band) · fee **F = 150 pts** · grant **G = 2,000 pts = 13.33 photos** · Google Play **f = 15%** (first $1M/yr).

**The identity** (every knob ties to this):

```
sale $/1,000 pts  ×  0.85  ×  (150 ÷ 1,000)  ≥  C  ÷  paid-share
   (net of Play)        (revenue per photo)        (grant amortization)
```

#### A · Marginal break-even (paid photos cover only themselves — ignores the grant)

| | Cost $0.09 | **Cost $0.10** | Cost $0.13 (retry stress) |
|---|---|---|---|
| **$ per 1,000 pts — gross** | $0.60 | **$0.67** | $0.87 |
| **$ per 1,000 pts — net of Play 15%** | $0.71 | **$0.78** | $1.02 |
| **Break-even FEE at $0.99/1,000** (net) | 107 pts | **119 pts** | 154 pts |

→ *At the proposed 150 pts + $0.99: net revenue/photo = **$0.126** vs $0.10 cost = **+26%** ✅ (worst-case retries: −3%, so the 1-retry cap must hold).*

#### B · Fully-loaded break-even (the 13 free photos amortized over paid photos)

Paid share `u = 1 − 13.33 ÷ lifetime-photos N`:

| Lifetime photos N | paid share u | **Sale price BE — gross** | **Sale price BE — net of Play** |
|---|---|---|---|
| 25 (light user) | 0.47 | $1.43 | **$1.68** |
| **40 (typical)** | 0.67 | **$1.00** | **$1.18** |
| 64 | 0.79 | $0.84 | $0.99 |
| 100 (heavy) | 0.87 | $0.77 | $0.90 |
| ∞ (grant negligible) | 1.00 | $0.67 | $0.78 |

**Or as the fee (at $0.99/1,000, net):** N=25 → **214 pts** · N=40 → **178 pts** · N=64 → 150 pts ✓ (the proposed fee fully amortizes at N ≈ 64).

#### C · Verdict — the sustainable configuration

| Knob | Proposed | **Break-even for sustainability** | Recommendation |
|---|---|---|---|
| Sale price / 1,000 pts | $0.99 | **$0.78 marginal · $1.18 at typical 40-photo user** | **$1.19/1,000** (or $0.99 with a bonus tier that averages ≥$1.19) |
| Photo fee | 150 pts | **119 marginal · 178 at typical user** | keep **150** and raise price (fee is the UX-visible number — keep it low) |
| Starter grant | 2,000 | 13.33 photos ≈ **$1.33/user** absorbed by the price above | keep 2,000 (good runway) if price ≥$1.19; else trim to 1,000 |
| Retry cap | ≤1 retry | holds C ≤ $0.13 → price floor $1.02 marginal | keep (already ADR-002) |

**Bottom line:** with **150 pts/photo**, the model is sustainable (ads = pure profit) when **1,000 points sell for ≥ $1.19** (typical-user basis; floor **$0.78** if you ignore the grant). At the originally suggested $0.99 the points layer breaks even only for users taking **≥64 lifetime photos** — under that, ads quietly fund the grant instead of being profit. Fixed backend (Supabase $0–25/mo) is covered by the ad layer once the above holds.

*Added 2026-09-26 (Session 18) — back-calculation requested by PM; feeds SCRUM-18 price-tier decision.*

### 7.6 FEASIBILITY — daily sign-in points + 1–2 free photos/day (PM, 2026-09-26)

**Adds:** ① daily sign-in points so users can still exchange items in the store · ② **1–2 free photos/day** · ③ seasonal loyalty rewards system — *deferred to later iterations* (recorded below as a hook, not specced).

#### ① Daily sign-in points → store exchange: ✅ FEASIBLE (essentially free)

- Store items are **catalogue** (no AI cost); sign-in points must land in the **store/tribute wallet, never `photo_credits`** (invariant from §7.2). Burning those items later costs only the Track-B **$0.01** ID call, itself quota-capped → **no meaningful AI exposure**.
- Amount check: cheapest store item = **400 pts** → **70–100/day** redeems it in 4–6 days (full month ≈ 2,100–3,000 pts ≈ 2–7 cheap items or 1–1.5 wealth bundles) — generous but harmless.
- Loop guard: sign-in → buy → burn → award (400–1,250) circulates **tribute/ledger only** — leaderboard-visible, AI-invisible. ✅
- *Unify with S13d's existing 20% store-point accrual in SCRUM-18 (one store wallet, one sign-in ladder).*

#### ② 1–2 free photos/day: ⚠️ NOT self-funding — feasible only as a *bounded grant*

Unit reality (sustainable price $1.19, margin **+$0.052/paid photo**; ads moderate **$0.011/active day**):

| | 1 free photo/day | 2 free photos/day |
|---|---|---|
| AI cost / active day | **$0.10** | **$0.20** |
| …per active month (30d) | **≤ $3.00** | ≤ $6.00 |
| …per MAU-month at ~6 active days | **≈ $0.60** | ≈ $1.20 |
| Ads cover | **11%** | 6% |
| Paid photos/day needed to neutralize | ~2 | ~4 |

**Verdict:** ads can *never* cover daily free photos (even the top-case ARPDAU $0.04 covers ≤40% of one). The free layer is structurally a **subsidy budget** — the question is only whether it's *bounded and small*:

| Basis (per 1,000 MAU) | Photos | AI cost | Coverage (ads + ~5% conversion) | **Gap** |
|---|---|---|---|---|
| Expected — 1/day × 6 active days | 6,000 | $600 | ≈ $160 | **≈ $440/mo** |
| Ceiling — cap 15/month, grinders maxed | 15,000 | $1,500 | ≈ $160 | ≈ $1,340/mo |

→ **2 free/day as baseline: ❌ rejected** (doubles a deficit that already needs closing; marginal retention gain unproven).
→ **1 free/day: ⚠️ feasible only with caps + conversion** — hard **monthly cap (15)**, sign-in-gated, and the cash shop must carry it (needs conversion well above the classic 2–5%, or higher-tier buyers).

**Recommended v1 (feasible configuration):**
1. **Sign-in grant = 100 store points + 150 photo credits (exactly 1 photo), monthly cap 15 photos** → expected ≈ **$0.60/MAU-month**, ceiling **$1.50** — a *visible, tunable* line item instead of an open tap.
2. **2nd/extra photo of the day = credits** (the purchase trigger — the 2,000 grant + daily 150 give casuals runway; the "want a 2nd photo now" moment is the conversion hook).
3. **Ad-gated bonus photo** (watch a rewarded ad → +1 photo, outside the ritual flow): turns the subsidy into **engaged ad inventory** — a rewarded view ($0.015–0.03) recovers 15–30% of that photo's cost *and* lifts ARPDAU. Recommended over a 2nd free photo.
4. **Quota (SCRUM-18)** stays the hard backstop on top of the cap.

#### ③ Seasonal loyalty (deferred — hook recorded)

Later-iteration system should **modulate the grant streams only** (streak-boosted sign-in, Qingming/Hungry Ghost credit doublers, festival photo tokens) — never the paid price or the credit invariant. Backlog: *loyalty/seasonal rewards spec* → SCRUM-18 follow-up.

#### Feasibility summary

| Addition | Verdict | Cost exposure |
|---|---|---|
| Sign-in store points (70–100/day) | ✅ feasible now | ≈ $0 (catalogue + $0.01 burns, quota-capped) |
| 1 free photo/day | ⚠️ feasible **as capped grant**: sign-in-gated, 15/month, price at $1.19 | expected **$0.60/MAU-mo**; ceiling $1.50 |
| 2 free photos/day (baseline) | ❌ not feasible — doubles the deficit | would add +$0.60/MAU-mo |
| Ad-gated bonus photo | ✅ recommended substitute for #2 | partially self-funding (15–30%) |
| Seasonal loyalty | 🔜 later — modulates grants only | bounded by design |

*Added 2026-09-26 (Session 18) — feasibility pass on PM's daily sign-in + free-photo proposal; feeds SCRUM-18.*

### 7.7 🔒 LOCKED — economy v1 (PM decision, 2026-09-26)

**Price: 1,000 credits = US$1.55** — the $1.19 fully-loaded break-even (§7.5) **+30% safety margin** (PM) for worst-case sustainability.

| Margin check (net of Google 15%) | Revenue/photo **$0.1976** vs… | Margin |
|---|---|---|
| central AI cost | $0.10 | **+98%** |
| **fully-loaded typical** (grant amortized, N=40) | $0.150 | **+32%** ✅ *— the 30% target* |
| worst-case marginal (1-retry stress) | $0.13 | +52% |
| **worst-case fully-loaded** (stress + amortized) | $0.195 | **+1% ≈ break-even** — ads absorb |

→ Design intent: **typical users fund the free tier; worst case is break-even; ad revenue sits on top as profit.** Effective ratio: **1 paid photo ≈ funds 1 free photo** (margin $0.10 ≈ free cost $0.10).

**The locked package:**

| Knob | Value |
|---|---|
| **Photo credit price** | **$1.55 / 1,000** (floor: never discount below **$1.19 net-equivalent**; bundles must average ≥ that) |
| **Photo fee** | **150 credits** (UX-visible number stays low) |
| **Starter grant** | **2,000 credits** (13-photo runway, ≤$1.33/user exposure) |
| **Daily sign-in** | **100 store points + 150 photo credits (= 1 free photo)** — separate wallets; sign-in-gated |
| **Free photo cap** | **15/month** (ceiling $1.50/active user) |
| **2nd free photo/day** | ❌ replaced by **ad-gated bonus photo** (watch rewarded ad → +1, post-ritual only) |
| **Wallets invariant** | `photo_credits` (in = shop + grants · out = photos) ≠ `tribute` (burn awards/leaderboard) ≠ store points |
| **Charge moment** | at capture/cartoonize request; auto-refund on generation failure |
| **Retry cap** | ≤1 (ADR-002) — load-bearing: holds C ≤ $0.13 |
| **Quota (SCRUM-18)** | daily burn/capture cap = hard backstop on top of all grants |
| **Seasonal loyalty** | 🔜 deferred — may only modulate *grants* (streak/festival doublers), never price or invariant |

**Recorded for SCRUM-18:** unit costs (ADR-002) · ad benchmarks (§2) · break-even identity (§3/§7.5) · sign-in + free-photo feasibility (§7.6) · **this lock (§7.7)**. Formal economy spec still to be written from these locked inputs.

*Locked 2026-09-26 (Session 18) — PM: "lock in the feasible solution… add a 30% margin to the price to account for worst case."*
