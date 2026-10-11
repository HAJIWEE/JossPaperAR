# 22 · Streak spec — continuation · reset · timezone · reminders

> **SCRUM-11 step 4.** The ticket's wording is exact: *"a streak spec is written (continuation · reset · timezone · reminders) and the built behaviour matches it."* So this document is **descriptive first** — every rule below is what the code already does, quoted with its location — and **prescriptive second**, where the built behaviour and the audience's expectation diverge.
>
> ⚠️ **§1–§3 are description; §4–§6 carry the PM's decisions.** Every rule in §1–§3 was written FROM the implementation and cites its line. §4–§6 record the answers to the three questions this document opened — `SCRUM-112`, answered by the PM 2026-10-11 — and say plainly where an answer does **not** yet satisfy its own requirement.

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
- ⚠️ **There is no `freeze` — and `SCRUM-112.3` decided there will not be one.** PM, 2026-10-11: *"no freeze in MVP no freeze in final product, we can consider gifting freezes as rewards later iterations — we do not want to use all the cards up at the start."* So this is a **declined** pattern, not a deferred one: doc 04's collected suggestion *"Daily streak with **freeze** mechanic (don't punish holidays/festivals!)"* is **not** the plan, even though doc 04 is right that Hungry Ghost Festival and Qingming are *peak* engagement moments.
  **If a freeze ever appears it is a GIFT, not a mechanic** — granted to the user, never bought and never spent. The stated reason is the design reason: *"we do not want to use all the cards up at the start"* — a mechanic spends its novelty on day one, a gift does not. ⚠️ The absence is **asserted** in `supabase/tests/streak_spec.sql` (§7) so a freeze cannot be quietly reintroduced as a column or a RPC.

## 4 · Timezone — ⚠️ the rule most likely to surprise a user

**The boundary is UTC, and it is the SERVER's day.** `submit_burn` says so at `:66`: *"Quotas, streaks and the daily ceiling all key off the SERVER day (UTC), never…"*.

⚠️ **For a Singapore audience the ritual "day" therefore rolls over at 08:00 SGT, not midnight.** Two consequences, both real:

| The user does | The server sees | Result |
|---|---|---|
| Burns **23:00 SGT Monday** and **07:00 SGT Tuesday** | both are **Monday UTC** | ⚠️ **same day** — the streak does **not** advance, though the user lived two days |
| Burns **07:00 SGT** and **09:00 SGT** on one Tuesday | **Monday UTC**, then **Tuesday UTC** | ⚠️ **two days** — the streak advances **twice in one morning** |

Neither is a code defect; both follow from the boundary sitting somewhere other than where the user lives. ⚠️ **The divergent window is 00:00–08:00 SGT** — which is precisely a *morning*, and this audience's ritual is often a morning one.

**It is NOT a one-line change.** The same `v_day` drives the **quota** and the **daily AI ceiling** (`:66`) — both economy values locked in doc 10. Changing the boundary is a **doc-10 question**, not a code preference.

### 4.1 · ✅ DECIDED — `SCRUM-112.1`, PM, 2026-10-11

> *"We should be doing UTC recording in our backend but of course on the client side we should convert the datetime based on the client timezone. This would prevent issues when the user is traveling to far away places with different timezones — we don't shorten or lengthen the time allowed to extend the streak. Duolingo has this bug and I don't want it in ours."*

| Half of the decision | Status |
|---|---|
| **Storage is UTC** | ✅ **already true** — `submit_burn:66` keys the streak, the quota and the daily ceiling off the server UTC day, and no local date is written anywhere. **No code change.** |
| **The client converts for DISPLAY using the device timezone** | **to build** (step 6). ⚠️ One-way: no local time or local date is ever written back to the server. |

⚠️ **The second half of the decision is NOT yet satisfied — and this document must not imply that it is.** The two cases in the table above are defects in the **continuation rule**, not in the rendering. The rule compares `last_burn_date` to the **server UTC day**, so it is the *rule's* boundary that hands a travelling user a shortened or lengthened window. Rendering `23:00 SGT` as `23:00 SGT` changes nothing about whether the streak advanced.

To meet *"we don't shorten or lengthen the time allowed to extend the streak"*, the boundary **the rule uses** must be **the user's own local day** — which means the streak, the quota and the daily AI ceiling stop sharing one global `v_day` and become per-user. ⚠️ That re-keys **two doc-10 locked economy values**, so it remains the PM's call and not a code preference — and §5.2 now makes it concrete, because the decided reminder hours only land in sane local hours if the boundary moves. → **`🎯 SCRUM-113`**.

## 5 · Reminders

⚠️ **None exist.** No `expo-notifications` dependency, no push channel, no scheduling code anywhere in this repo. The word appears only in the *pattern* notes:

- doc 02 — *"friendly reminders"* as a Streak/Calendar screen idea, compared with **Duolingo**
- doc 04 — Duolingo's reminders listed under patterns **to avoid**: *"Guilt-tripping notifications, aggressive monetization"*

True regardless of the decision: because a miss does not touch `streaks` (§2.3) and a gap resets **to 1** (§3), there is **less to remind about than Duolingo has** — the design already declines to punish a lapse.

### 5.1 · ✅ DECIDED — `SCRUM-112.2`, PM, 2026-10-11

> *"Good idea on the reminder, ship it in MVP, there's no need for aggression, lock in 12hr reminder, 4 hour reminder and 1 hour reminder just 3 reminders before the streak expiry."*

| | |
|---|---|
| **Ships in the MVP?** | ✅ **Yes** — and this is a **scope addition**: reminders sat outside E7 (doc 18) and outside W6's estimate, so an MVP that includes them is bigger than the MVP of record |
| **How many?** | **Three, and only three** — no drip, no re-nudging after the third |
| **When?** | **12h · 4h · 1h before the streak expiry** |
| **Tone** | **No aggression.** No guilt copy (*"you'll lose your streak!"*), no loss threats, no manufactured urgency — doc 04 names the pattern, doc 16's audience rule applies |

⚠️ **Three consequences, none optional:**

1. **`expo-notifications` is ABSENT — and it is a native module**, so it needs a **development build** (Expo Go will not carry it), plus `expo-device` for platform targeting, a permission prompt, and EAS push credentials if any delivery is remote. New dependency + new build-profile work.
2. ⚠️ **Delivery must be client-local scheduling, not server push.** A server cron would have to know every device's instants and fan out pushes; `expo-notifications`' local scheduling computes them **on-device from the last burn** and stays correct **in the user's own timezone** — the same stance §4.1 takes. This is the natural pairing of 112.1 and 112.2, and it is why the reminder copy must survive being scheduled days in advance.
3. ⚠️ **The instants depend on a boundary that is not settled.** "Before the streak expiry" is unambiguous only once the expiry *is*. See §5.2.

### 5.2 · ⚠️ The hours only work if the boundary moves — the argument for `SCRUM-113`

Under the **current UTC boundary** the expiry is the end of the server UTC day, **24:00 UTC**, so the three decided offsets land at:

| Reminder | Instant (UTC) | = Singapore time | |
|---|---|---|---|
| 12h | 12:00 UTC | **20:00 SGT** | ✅ a reasonable evening |
| 4h | 20:00 UTC | **04:00 SGT** | ⚠️ **the middle of the night** |
| 1h | 23:00 UTC | **07:00 SGT** | ✅ reasonable — arguably the morning ritual |

⚠️ The 4h reminder lands at **04:00 SGT**, and doc 04 names *"engagement-baiting at unsocial hours"* as exactly the pattern to avoid. So the reminder decision **is itself an argument for the local-day boundary** (`SCRUM-113` option **B**) or the rolling window (option **C**): under either, the expiry is the user's own end-of-day and the same three offsets become **12:00 / 20:00 / 23:00 local** — all sane. Recorded because this is invisible until the notification fires at 4am.

## 6 · The three questions, ANSWERED — `SCRUM-112`, PM, 2026-10-11

| # | Question | Answer |
|---|---|---|
| 1 | Is the UTC day boundary acceptable for a Singapore-first audience? | **Storage stays UTC** ✅; the **client converts for display** using the device timezone. ⚠️ The requirement — *"we don't shorten or lengthen the time allowed to extend the streak"* — is **not met by a display change**; the *rule's* boundary is the open part → **`🎯 SCRUM-113`** |
| 2 | Do reminders ship in the MVP, and with what copy? | ✅ **Ship in the MVP**: exactly **three** (12h / 4h / 1h before expiry), **no aggression**. ⚠️ Needs `expo-notifications` + a dev build, and the hours assume `SCRUM-113` |
| 3 | Is the festival freeze a post-MVP item? | ❌ **No freeze in the MVP and no freeze in the final product** as a mechanic. It may return in a later iteration **only as an explicitly granted gift/reward** — *"we do not want to use all the cards up at the start"*. doc 04's suggestion is therefore **declined**, not deferred |

**Two follow-ups the answers create — neither is a question for the PM:**

1. **Reminders are new MVP scope.** The E7 / W6 line in doc 18 reads *cohorts, weekly roll, live board*, and doc 18 §2.2 closed MVP scope without a reminder feature. Shipping them in the MVP is a scope change of record, so it needs its own build ticket + EN/ZH copy.
2. **A gifted freeze is a future reward, not a mechanic.** If it is ever built it must arrive **granted** — never something the user must buy or must remember to spend. That distinction is the whole reason the card is being held back.

## 7 · What is asserted, rather than believed

`supabase/tests/streak_spec.sql` drives **every row of §2's table**, plus §2.3's miss rule and §3's reset-to-1, through the real `submit_burn` against a real database. **This document and that file are two statements of the same thing**, and a run fails if they part. **22 assertions**, all green.

### 7.1 · What the test asserts for `SCRUM-112` — and one thing it refuses to

| | |
|---|---|
| ✅ **§4.1 storage is UTC** | `public.burn_day()` returns the UTC date **and** its *definition* names `utc` — asserted twice on purpose: the behavioural check alone cannot tell UTC from SGT during the 00:00–08:00 SGT overlap, so it could only ever fail one third of the time, and a gate that passes the rest is not a gate. Plus: a **rewarded** burn writes `last_burn_date = burn_day()`. |
| ✅ **§3 no freeze** | asserted across the **catalog** — no table, no column and no function in `public` may carry a freeze. A decision that lives only in prose can be undone by a migration nobody reviews. |
| ⚠️ **§5's reminder schedule — NOT asserted** | **deliberately.** The reminders are client-side local notifications and nothing schedules them yet, so an assertion here could only restate fixed timezone arithmetic — it would hold for every value the code could take. ⚠️ **This was measured, not assumed:** fault-testing `burn_day()` to `Asia/Singapore` left that arithmetic green, so the decorative assertion was **deleted** rather than kept for the look of coverage. §5.2's three hours are printed by a `raise notice` — a number to read, not a gate. |

⚠️ **Both real gates were fault-tested and both go RED:** creating `public.streak_freezes`, and pointing `burn_day()` at a local zone (the latter fails on the *definition* check — the always-distinguishing half).

---

*Created 2026-10-11 (S55) — SCRUM-11 step 4. Written FROM the implementation, not ahead of it: every rule cites its line, and the only prescriptions are the three questions in §6.*
*Updated 2026-10-11 (S55) — **the three questions in §6 are ANSWERED** (`SCRUM-112`, PM). §4.1 records that the display half of the timezone answer does **not** by itself meet the "no shortened or lengthened window" requirement (→ `🎯 SCRUM-113`), and §5.2 shows the decided reminder hours depend on that same boundary.*
