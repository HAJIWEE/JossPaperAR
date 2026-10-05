# ADR-006 · Burn-limit semantics — daily quota, cost per burn, no cooldown, hard global stop-rule

**Status:** ✅ **Accepted** · 2026-10-05 (Session 29) — *records the locked model from [[../10-economy-spec]] (SCRUM-18)*
**Decider:** stakeholder (PM) — SCRUM-18's inputs were locked at Session 18; SCRUM-59 later ratified the funding half (option B). This record closes the paper gap; it does not re-price anything
**Closes (gap-analysis §6):** **7 · burn-limit semantics** — daily quota / cost per burn / cooldown
**Related:** [[../10-economy-spec]] §1 (the model on one screen) · §4 (the backend rule **and** the EN/ZH copy) · §6 (ceilings) · [[../09-economy-quick-check]] (the benchmarks behind the numbers) · [[ADRs/ADR-002-path-c-describe-then-generate|ADR-002]] (unit costs · $0.09/photo) · [[ADRs/ADR-005-honest-client-caps-append-only-ledger|ADR-005]] (why the caps are an integrity control too) · [[../19-build-plan-services-api-environments|doc 19]] §12.5 (the stop-rule build) · SCRUM-18 · SCRUM-59

---

## Context

The economy spec answers a question that is really a *cost-control* question wearing an economy costume: **because the AI is paid per generation, the burn limit is the budget.** ADR-001 made hosted AI a day-one choice and said so plainly — *"hosted AI cost per burn makes quotas mandatory; burn limits *are* the cost control."* There is no self-hosted alternative to fall back on, so the limit cannot be an engagement lever; it is the ceiling.

Three facts from [[../09-economy-quick-check]] / [[../10-economy-spec]] shaped the model:

1. **A photo burn costs ≈ US$0.09** steady, $0.10 planning, **$0.13 worst-case** with one retry (ADR-002). A store-item burn costs **$0.01** — closed-set identify only, no stylize. The two costs differ by ~9×, so one cap cannot govern both.
2. **Burn awards must never mint photo credits.** Without that invariant the loop self-funds: a burn pays 400–1,250 tribute, which would buy more photos, and free points would become unlimited AI spend. Hence three wallets and a hard invariant — `credits in = real money + deliberate grants ONLY`.
3. **The audience must never feel metered.** Doc 09's cultural guard is explicit: *"the ritual itself must not feel paywalled — the quota message should read as *daily incense offering*, not a meter."* That is a UX constraint on how the cap is spoken, not a softening of the cap itself.

The failure mode to avoid is the one doc 09 §4 names as the worst outcome: **an unexpected fal invoice.** So the design has to hold in the *global* case, not only the per-user case.

---

## Decision

**The three semantics, settled:**

1. **Daily quota, not a per-burn cooldown.** **10 photo burns/day** · **20 store-item burns/day**, resetting at **local midnight** (device tz, server-verified — ADR-001's *"client asserts, server decides"*). There is **no per-burn cooldown**: the daily caps *are* the cooldown, and streak rewards already reward daily return. A cooldown would punish the festival-week user at exactly the wrong moment.
2. **Cost per burn is explicit and differentiated** — **≈ $0.09/photo** (Path C) vs **≈ $0.01/store burn** (Track B). This is what makes two separate caps correct rather than lazy, and it makes the store the cheap ritual path for users with nothing to photograph.
3. **A global daily AI budget is the hard stop-rule** — `app_config.daily_ai_budget_micros`, **$5/day at alpha**. When today's spend leaves **less than $0.10 of headroom**, the job **queues**; it never errors and never silently fails.

**The rule that makes the stop-rule a ceiling rather than a suggestion:** the check is *"is there ≥ $0.10 of headroom left?"* — not *"is spend < budget?"*. A soft `spend >= budget` check can still start a job that overruns the day by up to $0.09; the $0.10 floor (the planning cost) means **a job that starts can never push the day past the budget**. A missing knob reads as **0** ⇒ **fails closed** (everyone queues; nobody spends).

**Two supporting rules that are easy to get wrong:**

- **A queued job does not consume one of the user's ten attempts.** The daily allowance counts only jobs that actually **ran**. Otherwise the stop-rule would silently eat a player's day — the cap and the ceiling would double-charge the same person.
- **Queue-don't-fail is self-healing.** The parked job keeps its row (`unique(capture_id)`, the one-job-per-capture cost guarantee), so the next request for that offering re-checks the budget and proceeds the moment it opens.
## Alternatives considered → rejected

| Alternative | Why rejected |
|---|---|
| **A per-burn cooldown** (e.g. 60 s between burns) | Punishes exactly the user we are designing for — the festival-week relative doing several offerings in one sitting — and complicates the quota UI, all to solve a problem the daily cap already solves. Doc 10 §4: *"the daily caps are the cooldown."* |
| **A soft stop-rule** (`spend >= budget` rather than the $0.10 floor) | **Found and fixed by the boundary test before merge:** $0.099999 of headroom queued; exactly $0.10 proceeded. The soft form is a ceiling in name only — it can overrun the day by up to one job. The $0.10 floor is what makes it hard. |
| **One shared cap for photo and store burns** (e.g. 30 total) | Ignores the ~9× cost difference ($0.09 vs $0.01). A single cap lets a user spend their whole daily allowance on the cheap path, or blocks the expensive path behind the cheap one's arithmetic. Two caps track the two real costs. |
| **Let the cap fail loudly** (HTTP error when the budget is spent) | Converts an infrastructure condition into a user-facing error at the worst moment — someone mid-ritual, mid-generate. The offline-queue machinery already exists; *queue, never fail* reuses it. |
| **Count the attempt when the job is parked** | The stop-rule would silently consume a player's ten daily attempts, so a global outage would burn every user's day. The allowance counts only jobs that **ran**. |
| **Let burn awards mint photo credits** (the prototype's implicit loop) | The self-funding bug doc 09 §4 calls out: 400–1,250 points per burn ≫ the 150 fee ⇒ unbounded AI spend from *free* points. This is what the three-wallet invariant exists to prevent. |
| **No cap — trust the global budget alone** | The global budget stops *us* overspending; it does nothing to stop one user consuming the day's entire allowance before their family gets a turn. Both levels are load-bearing. |
| **Fail open when the config knob is missing** | A missing `app_config` row would read as unlimited and start billing at $0.09 per call. **Fails closed** instead: missing ⇒ 0 ⇒ everyone queues. |

---

## Consequences

**Good**
- **The invoice cannot surprise us.** $5/day at alpha is a hard ceiling with a bounded worst case (one in-flight job), not an estimate.
- **The cap is server-authoritative and hard to abuse**, which is why ADR-005 needs no cooldown machinery in the integrity model.
- **The queue is the same machinery as the offline queue**, so "queue, never fail" costs no new subsystem — it is a re-use of a path already specified, built and tested.
- **Two differentiated caps make the store a genuine cheap path** (≈ $0.01/burn), which keeps the ritual reachable for users with nothing to photograph — a cultural requirement, not just an economic one.
- **The copy keeps the ritual sacred.** "The shrine rests until dawn" is a limit stated as a rhythm; it does not read as a paywall or a meter.

**Trade-offs / risks (accepted)**
- **The hard floor can idle capacity.** Refusing to start a job with < $0.10 headroom means the last $0.09 of a day's budget may go unspent. Bounded, deliberate, and cheaper than an overrun.
- **The free tier is a subsidy, and it is metered in dollars** (≤ $3.64/user/month worst case, doc 10 §6). Acceptable because paying only ever buys *speed*, never the ritual itself.
- **Two caps and a stop-rule is more copy to localise** than one rule — hence the EN/ZH table being part of this record rather than an afterthought.
- **Queueing is invisible to the player**, which is a deliberate lie-by-omission in the player's favour and a real source of "why is it slow?" support questions at alpha. Accepted for beta instrumentation (SCRUM-25).
- **The wallet half is unbuilt**, so no player is charged anything yet. The model is specified and priced but not implemented; that gap is tracked, not forgotten.

---

## References

- [[../10-economy-spec]] §1 (the model) · §4 (the backend rule + the copy) · §5 (revenue) · §6 (ceilings) · §8 (open items)
- [[../09-economy-quick-check]] — the benchmarks behind the numbers; §4 the self-funding bug; the "must not feel paywalled" guard
- [[ADRs/ADR-002-path-c-describe-then-generate|ADR-002]] — unit costs ($0.09 steady / $0.13 worst) and the 1-retry cap
- [[ADRs/ADR-001-option-a-expo-rn-supabase-hosted-ai|ADR-001]] — hosted AI makes quotas mandatory; "client asserts, server decides"
- [[ADRs/ADR-005-honest-client-caps-append-only-ledger|ADR-005]] — the caps double as an integrity bound (≤ 49,500 tribute/user/day by construction)
- [[../19-build-plan-services-api-environments|doc 19]] §12.5 — the stop-rule build, the fault-tested boundary and the live proof
- SCRUM-18 (the spec) · SCRUM-59 (the funding decision, option B)

---

*Recorded 2026-10-05 (Session 29) as SCRUM-55. The model is locked (SCRUM-18, Session 18); the stop-rule half was **built and verified** 2026-10-04 (SCRUM-59, migration `0011`) — `supabase/tests/ai_budget.sql` fault-tested red at the $0.10 boundary, and a live run returning `200 shrine_busy` in 0.51 s with `cost_micros` NULL against 14.9 s / 90,000 micros for a real Path C run.*



**What is a ceiling today, and what is a price (deliberately not yet built):** the **150-credit photo fee · 2,000-credit starter grant · 15/month free-photo cap · `grant|credits|ad` funding split** all require a cash shop and a `sign_in_grants` table that do not exist. Deferred to beta (SCRUM-18). At alpha **nothing charges a player anything** — what is enforced is the **ceiling**, not the price.

**The copy is part of the decision** (doc 10 §4), because a cap read as a meter is a different product:

| State | EN | 中文 |
|---|---|---|
| Daily photo cap hit | *Today's offerings are complete — the shrine rests until dawn.* | *今日的供奉已圆满，神龛明晨再开。* |
| Free-photo monthly cap | *Your daily offering is still ready tomorrow — or prepare extra offerings now.* | *明日照常有每日供品；也可现在补充供品。* |
| Global budget / queue | *The shrine is receiving many offerings — yours will be prepared shortly.* | *神龛正繁忙，您的供品稍后即成。* |
| Refund on failure | *The offering could not be prepared — your points have returned.* | *供品未能制成，点数已退回。* |

Note what the queue line does **not** say: it never says "try again later" or names a budget. It is the shrine's own workload, not the player's failure.

---
