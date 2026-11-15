# 22 · THE DEMO RUN SCRIPT (SCRUM-202 · parent SCRUM-157)

> **What this is:** the ordered set of taps for the sprint's acceptance run, each with the
> observable that decides pass/fail. ⚠️ **It is the SCRIPT, not the result** — the result lives on
> SCRUM-200/201 with the build id and the numbers.

**Record before starting (the result is attributed to a build, not to "the app"):**

| field | value |
|---|---|
| device | `HN615L005386` |
| build | `46d68f02-b446-4c4d-8d9b-922113e315f3` · APK `g3YOXYK…` |
| commit | `c0a6872` (merged as `83f7203`) |
| installed at | `dumpsys package app.josspaperar → lastUpdateTime` |
| backend | **hosted** (the preview build inlines `EXPO_PUBLIC_SUPABASE_URL`) |

⚠️ **A failed install looks like a finished one** (`SCRUM-145`: `INSTALL_FAILED_USER_RESTRICTED`
*after* a successful download). Confirm with `dumpsys … lastUpdateTime`, **never** the install
exit code.

## Rules for the run

1. **Cold start to finish in one sitting** — no reloading Metro, no fixing code mid-run
   (a run that edits code is no longer evidence).
2. **Every screen you can enter, you can leave.** A control that renders and does nothing is a
   **failure**, not a note.
3. **Numbers, not adjectives.** Cold start → first frame · capture → styled · burn → award.
   Compare to doc 14: **p50 ≈ 12.6 s**, **p95 ≤ 30 s** for Path C.
4. **No raw error text on screen** — a Postgres message is not product copy.
5. ⚠️ **Anything not reached is written down as not reached.** "Not checked" and "verified" are
   different claims and only one of them is useful.

## The steps

| # | screen | action (testID) | expected observable |
|---|---|---|---|
| 1 | cold start | `am force-stop` → `am start -W` | splash → **first frame**; no scaffold flash; **TotalTime** recorded |
| 2 | shrine | `shrine-board` renders | clan pill (name + role), tribute figure, ≥1 tablet, **Begin an offering** |
| 3 | capture | `home-begin` | camera or an explicit rationale; ⚠️ **never a dead button** (`SCRUM-170`) |
| 4 | capture | `capture-choose-offering` | the offering picker, priced, both currencies |
| 5 | throw | `burn-offering` | the throw resolves; band + accuracy shown |
| 6 | reward | award card | award, band, `×2.0` **only when the cell is fresh** (`SCRUM-237`), Book entry written |
| 7 | Book | `clan-open-book` | entries with dates; the empty state if this clan has none (`SCRUM-122`) |
| 8 | league | `league` tab | rank, cohort rows, promotion line **or** an honest "not placed" |
| 9 | store | `store-featured`, `store-switcher` | prices in **both** currencies; "you cannot afford this" is explicit |
| 10 | decorations | `store-decor-featured` | owned vs unowned is visible; buying uses `confirm-card` |
| 11 | profile | `profile-header`, `profile-name`, `profile-email` | the **user's** name + email; edits persist |
| 12 | settings | `settings-language` | language switch, plus delete/export/retention entries |
| 13 | back out | system back | returns to the shrine; **no screen traps the back gesture** |
| 14 | 中文 pass | `settings-language` → 中文 | steps 2–12 again: **zero English**, nothing rendered twice, no heading over nothing (`SCRUM-203`) |

## What this script cannot do from a desk

⚠️ **Steps 3–6 need a physical offering in front of the camera.** The phone cannot be aimed from
here, and Path C costs ≈ **US$0.091** per run. If the run stops at step 3, the honest record is
*"steps 1–2 and 7–14 reached; 3–6 NOT SEEN — no subject, no spend"*, not a green tick.

## Filling it in

For each step, record **pass / fail / not seen**, and for a fail: the screen, the tap that did
nothing, and the copy shown. ⚠️ **Every failure becomes its own ticket** (`SCRUM-201`), linked from
the parent — a failure that lives only in a summary is the green-summary-that-omits-a-failure the
sprint gate exists to prevent.
