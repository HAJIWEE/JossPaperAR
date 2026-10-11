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

To meet *"we don't shorten or lengthen the time allowed to extend the streak"*, the boundary **the rule uses** must be **the user's own local day** — which means the streak, the quota and the daily AI ceiling stop sharing one global `v_day` and become per-user. ⚠️ That re-keys **two doc-10 locked economy values**, so it remains the PM's call and not a code preference — and §5.2 now makes it concrete, because the decided reminder hours only land in sane local hours if the boundary moves. → **`SCRUM-113`, answered in §4.2 below.**

### 4.2 · ✅ DECIDED — `SCRUM-113`, PM, 2026-10-11 — **option B, with a forward-only rule**

> *"The streak tracking will be as such. If the user is in SGT the streak will start and end at midnight SGT. If the user flies 12hr away the streak will end still at midnight SGT but the next streak extension period will start only from the next midnight of the new timezone. Always move the start forward never backwards, which is what Duolingo does sometimes."*

**The boundary is the user's own local midnight** — option **B**, not the global UTC day (A) and not a rolling 24 h window (C). ✅ **CONFIRMED 2026-10-11:** *"Yes it should be on the user's local day too"* — so the **quota** and the **daily AI ceiling** move to the same per-user key as well. ⚠️ Doc 10's *values* are untouched; what changes is the **key** they are counted against, so two users' AI-ceiling windows no longer coincide. That is a **cost-model** change, so it lands as its own reviewed change rather than being folded into the streak.

**The rule, derived — and this document has now had TWO versions of it, the first wrong outright and the second too strict.** The wording asks for two things at once, and a single "next local midnight" satisfies only the first:

1. each period **ends at a local midnight**; and
2. the boundary is **forward-only** — never *earlier* than the previous one. ⚠️ But monotonicity alone is not enough: as the arithmetic below shows, it still permitted a **12 h** window, so a floor is needed too.

```
period_end(n+1) = the earliest local midnight, in the user's CURRENT zone,
                  that is >= period_end(n) + interval '23 hours'
```

⚠️ **Why 23 h and not 24 h — and this is the third correction.** A first floor of 24 h was wrong in the other direction: it **destroys the shorter day**. The PM's decision explicitly accepts that days vary — *"some days will be longer and shorter"* — and the natural source is **DST**: a local day is **23 h** across the spring-forward shift and **25 h** across the fall-back. A 24 h floor rejects the 23 h midnight, so the loop skips to the *next* one and hands the user a ~47 h window: neither the day they live in nor a floor, just a distortion.

⚠️ **23 h is the right threshold because it is the shortest a REAL local day can be** — the largest DST shift in the tz database is 1 h (Lord Howe's is 30 min) — so anything under 23 h cannot be a calendar day at all. It can only be a **travel truncation**, which is the thing the floor exists to refuse. So one number does both jobs: **23 h preserves every genuine local day (23/24/25 h) and still refuses the 12 h travel stub.**

| Case | Local day | v1 (no floor) | v2 (24 h floor) | **v3 = the rule (23 h)** |
|---|---|---|---|---|
| No travel | 24 h | 24 h ✅ | 24 h ✅ | **24 h** ✅ |
| **DST spring-forward** | **23 h** | 23 h ✅ | ~47 h ❌ **over-corrected** | **23 h** ✅ |
| DST fall-back | 25 h | 25 h ✅ | 25 h ✅ | **25 h** ✅ |
| **West** — SGT → UTC−4 (the "12 h away" case) | truncated | **12 h** ❌ **under-corrected** | 36 h ✅ | **36 h** ✅ |
| **East** — SGT → UTC+12 | truncated | 20 h ❌ | 44 h ✅ | **44 h** ✅ |

✅ **Both failure modes are now closed, and they pull in opposite directions** — which is why neither the floorless rule nor a 24 h floor is right. The boundary only ever moves later, every genuine local day survives at its true length, and a travel stub is refused.

### 4.3 · ✅ DECIDED — the travel gap belongs to the NEXT period: **option (ii)**, PM, 2026-10-11

The wording settled the boundaries but not what a burn *inside* the travel gap counts as. The PM chose **(ii)**: **a burn in the gap counts for the NEXT period — it advances immediately, and the user is "already in" the new day when it opens.**

**Why (ii) is the only option consistent with the rest of the decision: it leaves no dead time.** Under **(i)** a burn in the gap does nothing, which a user cannot tell apart from a penalty for flying; under **(iii)** the streak silently stalls. (ii) is the only one in which the deadline moves **only later** — the same forward-only principle as the boundary itself. ⚠️ It is also what makes §4.2's **≥ 24 h half** the honest reading rather than a refinement: with the gap absorbed into the next period, the window ends at the next *usable* midnight, not at a nominal one 12 h away.

⚠️ **Accepted cost, recorded:** a burn just before the gap ends lands on the new day, so it cannot also count for the old one. It favours the user, which is the intended direction.

### 4.4 · What the rule needs to be built (checked, not assumed)

1. **A per-user timezone.** **No column anywhere stores one** — `profiles` has none and `streaks` has none — so nothing today can answer *"what is this user's local midnight?"*. **Decision (engineering, not the PM's):** the client sends its **IANA zone** with the burn and the server stores the last-seen zone — one-way, the same direction as §4.1, so the server never guesses a zone.
2. **A remembered previous boundary.** `streaks` is `(user_id, current_days, last_burn_date date)`. The rule compares against an **instant**, so it needs a `timestamptz` column. From a bare `date` it cannot be re-derived.

### 4.5 · ✅ DECIDED — everything is RECORDED in UTC, even though the *day* is local

> *"Recording of any time should always be UTC on the db, meaning we should record when the period of day starts in UTC, which will be different for people in different timezones."*

⚠️ **The storage form and the rule's boundary are two different things, and they are easy to conflate:**

| | |
|---|---|
| **Stored** | Every instant is a `timestamptz`, so Postgres records **UTC**. ⚠️ `streaks.period_start` **and** `streaks.period_end` are both `timestamptz` — the period start is the previous period's end, expressed in UTC. |
| **Zone-dependent** | *Which* UTC instant that is depends entirely on the user's zone: **00:00 SGT = 16:00 UTC**, but **00:00 UTC−4 = 04:00 UTC**. ⚠️ That difference is precisely why the zone must be stored (`profiles.iana_tz`) and why a `date` column could never hold the boundary — a local date divorced from its zone is not recoverable. |
| **The client** | Renders those UTC instants in the device's zone (§4.1). One-way: nothing local is ever written back. |

✅ **Asserted:** both columns are `timestamp with time zone`, and the same *local* midnight is a **different** UTC instant in two zones.

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

### 5.2 · ✅ RESOLVED — the boundary moved, so the reminder hours are sane

⚠️ **This section used to be an argument for `SCRUM-113`; it is now the evidence that the fix landed.** Under the **old UTC boundary** the expiry was 24:00 UTC, and the three decided offsets landed like this:

| Reminder | Old (expiry 24:00 UTC) | **Now (expiry = the user's LOCAL midnight)** | |
|---|---|---|---|
| 12h | 20:00 SGT | **12:00 local** | ✅ midday |
| 4h | ⚠️ **04:00 SGT** | **20:00 local** | ✅ evening, and previously **the middle of the night** |
| 1h | 07:00 SGT | **23:00 local** | ✅ just before the deadline |

⚠️ **The 4h reminder used to land at 04:00 SGT** — and doc 04 names *"engagement-baiting at unsocial hours"* as exactly the pattern to avoid. It was never a copy problem; it was the boundary. With the expiry at the user's own midnight the same three offsets become **12:00 / 20:00 / 23:00 local — all sane**, and this is now *derived* rather than hoped for.

✅ **The test prints it on every run**, so the number is visible rather than assumed — and it is a number to READ, not a gate, because the reminders are client-side and nothing schedules them yet (§5.1).

## 6 · The three questions, ANSWERED — `SCRUM-112`, PM, 2026-10-11

| # | Question | Answer |
|---|---|---|
| 1 | Is the UTC day boundary acceptable for a Singapore-first audience? | **Storage stays UTC** ✅; the **client converts for display** using the device timezone. ⚠️ The requirement — *"we don't shorten or lengthen the time allowed to extend the streak"* — is **not met by a display change**; the *rule's* boundary is the open part → **`🎯 SCRUM-113`** |
| 2 | Do reminders ship in the MVP, and with what copy? | ✅ **Ship in the MVP**: exactly **three** (12h / 4h / 1h before expiry), **no aggression**. ⚠️ Needs `expo-notifications` + a dev build. ✅ **The hours are now sane** — the 4h one used to land at 04:00 SGT and now lands at 20:00 local, because `SCRUM-113` moved the expiry to the user's own midnight (§5.2) |
| 3 | Is the festival freeze a post-MVP item? | ❌ **No freeze in the MVP and no freeze in the final product** as a mechanic. It may return in a later iteration **only as an explicitly granted gift/reward** — *"we do not want to use all the cards up at the start"*. doc 04's suggestion is therefore **declined**, not deferred |

**Two follow-ups the answers create — neither is a question for the PM:**

1. **Reminders are new MVP scope.** The E7 / W6 line in doc 18 reads *cohorts, weekly roll, live board*, and doc 18 §2.2 closed MVP scope without a reminder feature. Shipping them in the MVP is a scope change of record, so it needs its own build ticket + EN/ZH copy.
2. **A gifted freeze is a future reward, not a mechanic.** If it is ever built it must arrive **granted** — never something the user must buy or must remember to spend. That distinction is the whole reason the card is being held back.

## 7 · What is asserted, rather than believed

`supabase/tests/streak_spec.sql` drives **every row of §2's table**, plus §2.3's miss rule and §3's reset-to-1, through the real `submit_burn` against a real database. **This document and that file are two statements of the same thing**, and a run fails if they part. **23 assertions**, all green.

### 7.1 · What the test asserts for `SCRUM-112` — and one thing it refuses to

| | |
|---|---|
| ✅ **§4.1 storage is UTC** | `public.burn_day()` returns the UTC date **and** its *definition* names `utc` — asserted twice on purpose: the behavioural check alone cannot tell UTC from SGT during the 00:00–08:00 SGT overlap, so it could only ever fail one third of the time, and a gate that passes the rest is not a gate. Plus: a **rewarded** burn writes `last_burn_date = burn_day()`. |
| ✅ **§4.2's rule, adopted** | `submit_burn` keys the quota, the decay tick, the derived ceiling and the streak off the **user's local day** (migration `20261011170000`). ⚠️ The **global** AI budget deliberately does **not** move: `ai_spend_today()` sums every user against one `app_config` budget, and a global window cannot belong to one user's zone. |
| ✅ **§3 no freeze** | asserted across the **catalog** — no table, no column and no function in `public` may carry a freeze. A decision that lives only in prose can be undone by a migration nobody reviews. |
| ⚠️ **§5's reminder schedule — NOT asserted** | **deliberately.** The reminders are client-side local notifications and nothing schedules them yet, so an assertion here could only restate fixed timezone arithmetic — it would hold for every value the code could take. ⚠️ **This was measured, not assumed:** fault-testing `burn_day()` to `Asia/Singapore` left that arithmetic green, so the decorative assertion was **deleted** rather than kept for the look of coverage. §5.2's three hours are printed by a `raise notice` — a number to read, not a gate. |

⚠️ **Both real gates were fault-tested and both go RED:** creating `public.streak_freezes`, and pointing `burn_day()` at a local zone (the latter fails on the *definition* check — the always-distinguishing half).

⚠️ **§4.2's rule now has its own suite** — `streak_window.sql`, **117 assertions**: the 23 h DST day, the 25 h fall-back day, 36 h west, 44 h east, the naive 12 h rule asserted *as a trap*, 8 zones × 4 bases swept for forward-only / ≥ 23 h / lands-on-a-local-midnight, an invalid zone **raising**, and both boundary columns being `timestamptz`.
⚠️ **Both floors were fault-tested, and they fail in opposite directions:** no floor → the west-bound travel truncation goes **RED**; a 24 h floor → the 23 h DST day goes **RED at 47 h**. That is why the rule is 23 h and the assertions exist to keep it there.
⚠️ **`streak_spec.sql` asserts the UTC boundary** — because it is still the boundary of *something*: `burn_day()` remains the GLOBAL AI budget's clock. The two assertions that USED to guard the streak's UTC day were **CHANGED rather than deleted**, exactly as this section required. ✅ **And `submit_burn` now uses the new rule** (migration `20261011170000`): it writes the **local date** to `last_burn_date` and the **window** as two UTC instants, and `streak_spec.sql` asserts all three — so none of them can drift alone. **23 assertions**, green.

---

*Created 2026-10-11 (S55) — SCRUM-11 step 4. Written FROM the implementation, not ahead of it: every rule cites its line, and the only prescriptions are the three questions in §6.*
*Updated 2026-10-11 (S55) — **the three questions in §6 are ANSWERED** (`SCRUM-112`, PM). §4.1 records that the display half of the timezone answer does **not** by itself meet the "no shortened or lengthened window" requirement (→ `🎯 SCRUM-113`), and §5.2 shows the decided reminder hours depend on that same boundary.*
*Updated 2026-10-11 (S55) — **`SCRUM-113` is ANSWERED, BUILT AND ADOPTED**: §4.2 the rule (local midnight, forward-only, **23 h** floor — three versions, the two floors failing in opposite directions), §4.3 the travel gap (option **(ii)**), §4.4 what it needed, §4.5 the UTC recording rule, and §5.2 **RESOLVED** — the 4h reminder moved off 04:00 because the expiry moved to the user's own midnight. Migrations `20261011160000` (the rule) and `20261011170000` (`submit_burn` adopts it: quota, decay tick and derived ceiling follow the local day; the **global** AI budget stays UTC by design). **422 SQL assertions across 9 suites**, including 117 for the window and 23 for the spec — and the two UTC assertions were **changed, not deleted** (§7.1).*
