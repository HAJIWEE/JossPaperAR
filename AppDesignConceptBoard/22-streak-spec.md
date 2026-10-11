# 22 · Streak spec — continuation · reset · timezone · reminders

> **SCRUM-11 step 4.** The ticket's wording is exact: *"a streak spec is written (continuation · reset · timezone · reminders) and the built behaviour matches it."* So this document is **descriptive first** — every rule below is what the code already does, quoted with its location — and **prescriptive second**, where the built behaviour and the audience's expectation diverge.
>
> ⚠️ **Nothing here is a new decision.** Where a rule is genuinely open it is marked **OPEN** and carries a `🎯` ticket rather than an answer.

## 1 · What a streak IS

A streak counts **consecutive server days on which the user earned something**. It is not a count of burns, and it is not a calendar this product draws.

| | |
|---|---|
| Stored | `public.streaks (user_id PK, current_days, last_burn_date)` |
| Per burn | `public.burns.streak_day` — **nullable, and NULL means the burn was a miss** |
| Written by | `public.submit_burn`; the client asserts nothing about it (doc 07 §2 boundary rule) |
| Bonus | **+50**, and only while the streak is *active* (`c_streak_bonus`) |
| Maximum | 正中 + new ground + streak = **1,650** — the clamp (doc 10 §2) |

## 2 · Continuation — the four cases, exactly as built

`supabase/migrations/20261004090000_rpc_submit_burn.sql:333-347`. The server day is `v_day`.

| Case | `streak_day` | active? | +50? |
|---|---|---|---|
| **No `streaks` row yet** (first ever burn) | `1` | **no** — *"day 1 of a chain is not yet a streak"* | **no** |
| **Already burned today** (`last_burn_date = v_day`) | `greatest(1, current_days)` — **unchanged** | yes, once `current_days >= 2` | from day 2 |
| **Burned yesterday** (`last_burn_date = v_day - 1`) | `current_days + 1` | **yes** — *"yesterday → today continues the chain"* | **yes** |
| **A gap of 2+ days** | `1` | **no** — *"a gap resets the chain"* | **no** |

⚠️ **Three properties follow, and all three are deliberate:**

1. **A second burn in the same day does not advance the streak** — it cannot be farmed by burning repeatedly — and it does **not** reset it either.
2. **Day 1 is not "active", so it earns no +50.** The bonus begins on the **second consecutive day**: a one-off burn is not a streak, and the reward says so.
3. ⚠️ **A MISS does not touch the `streaks` row at all.** A miss sets `v_streak_day := 0`, writes `burns.streak_day = NULL`, and — because the upsert sits inside `if v_award > 0` (`:421`) — **`last_burn_date` is left exactly as it was**. So a miss neither advances the streak nor breaks it. That is generous and it is intended (S9: the offering returns), but it was **nowhere written down** until this document.

## 3 · Reset

- **A gap of two or more days resets to 1, not to 0.** The chain restarts; it does not disappear.
- `current_days` never drops below 1 for a rewarded burn (`:349` — *"0 is reserved for a miss"*).
- ⚠️ **Nothing decrements or expires a streak on a timer.** There is no reset job; the count is re-derived from `last_burn_date` on the next rewarded burn.
- ⚠️ **There is no `freeze`.** doc 04 carries the collected pattern *"Daily streak with **freeze** mechanic (don't punish holidays/festivals!)"* and notes **Hungry Ghost Festival and Qingming are *peak* engagement moments**. **A freeze is NOT in the MVP scope** (doc 18 §2.2) and is not implemented — recorded here as a **deliberate non-implementation**, not an oversight. See §6.

## 4 · Timezone — ⚠️ the rule most likely to surprise a user

**The boundary is UTC, and it is the SERVER's day.** `submit_burn` says so at `:66`: *"Quotas, streaks and the daily ceiling all key off the SERVER day (UTC), never…"*.

⚠️ **For a Singapore audience the ritual "day" therefore rolls over at 08:00 SGT, not midnight.** Two consequences, both real:

| The user does | The server sees | Result |
|---|---|---|
| Burns **23:00 SGT Monday** and **07:00 SGT Tuesday** | both are **Monday UTC** | ⚠️ **same day** — the streak does **not** advance, though the user lived two days |
| Burns **07:00 SGT** and **09:00 SGT** on one Tuesday | **Monday UTC**, then **Tuesday UTC** | ⚠️ **two days** — the streak advances **twice in one morning** |

Neither is a code defect; both follow from the boundary sitting somewhere other than where the user lives. ⚠️ **The divergent window is 00:00–08:00 SGT** — which is precisely a *morning*, and this audience's ritual is often a morning one.

**It is NOT a one-line change.** The same `v_day` drives the **quota** and the **daily AI ceiling** (`:66`) — both economy values locked in doc 10. Changing the boundary is a **doc-10 question**, not a code preference. **OPEN → `🎯 SCRUM-112`.**

## 5 · Reminders

⚠️ **None exist.** No `expo-notifications` dependency, no push channel, no scheduling code anywhere in this repo. The word appears only in the *pattern* notes:

- doc 02 — *"friendly reminders"* as a Streak/Calendar screen idea, compared with **Duolingo**
- doc 04 — Duolingo's reminders listed under patterns **to avoid**: *"Guilt-tripping notifications, aggressive monetization"*

**The posture is decidable now even though the feature is not built:**

| | |
|---|---|
| **What we would not do** | Guilt copy (*"you'll lose your streak!"*), streak-loss threats, engagement-baiting at unsocial hours — doc 04 names the pattern, doc 16's audience rule applies |
| **What is already true** | Because a miss does not touch `streaks` (§2.3) and a gap resets **to 1** (§3), there is **less to remind about than Duolingo has** — the design already declines to punish a lapse |
| **What is OPEN** | Whether reminders ship in the MVP at all, and with what copy. ⚠️ **They are not in E7** (doc 18), so the honest default is *not in the MVP* — but that is the PM's call, not an inference → **`🎯 SCRUM-112`** |

## 6 · The three OPEN questions, in one place

| # | Question | Why it is the PM's |
|---|---|---|
| 1 | **Is the UTC day boundary acceptable for a Singapore-first audience?** | It drives the quota and the AI ceiling — **locked doc-10 economy values** — so it is an economy decision with a cost dimension, not a code preference |
| 2 | **Do reminders ship in the MVP, and with what copy?** | Not in E7; the copy is audience-facing, and doc 04 names guilt as the pattern to avoid |
| 3 | **Is the festival freeze a post-MVP item?** | doc 04 calls it out culturally (*"don't punish holidays/festivals!"*) while doc 18 §2.2 closes MVP scope without it |

## 7 · What is asserted, rather than believed

`supabase/tests/streak_spec.sql` drives **every row of §2's table**, plus §2.3's miss rule and §3's reset-to-1, through the real `submit_burn` against a real database. **This document and that file are two statements of the same thing**, and a run fails if they part.

---

*Created 2026-10-11 (S55) — SCRUM-11 step 4. Written FROM the implementation, not ahead of it: every rule cites its line, and the only prescriptions are the three questions in §6.*
