# 16 · Cultural consultation & ritual review — SCRUM-24

**Date:** 2026-10-01 (Session 24) · **Jira:** SCRUM-24 (**→ Done — planning, 2026-10-01**) · **Status:** ✅ plan complete · execution **deferred → SCRUM-49** (runs once the app is functional)
**Depends on:** [[04-ar-app-patterns]] (the returns-on-a-miss rule) · [[10-economy-spec]] (the money under review) · [[12-security-and-legal-scoping]] §B.4 (legal ≠ cultural — SCRUM-24 owns the cultural half) + §B.6/§B.8 (the honesty clause) · [[13-privacy-and-retention]] §4 (the ancestor-names rule) · [[15-clan-model-and-book-of-tributes]] (clan vocabulary · copy C1–C17) · Penpot boards (the review visuals)
**Feeds:** Penpot/build copy edits · Play listing copy · SCRUM-46 copy strings · the family-alpha gate

> **In one line:** before native code freezes the ritual framing, a real practitioner reviews five concrete things — the tier words, the throw, the never-destroyed offering, the digital tablets, and the money — against a bilingual 10-question sheet; this doc holds the sheet, the pre-decided change policy, and the record to fill afterwards.

---

## 1 · Why, and the boundary

"Consider cultural/legal consultation" has been carried since Session 1 with no owner. The design is now concrete enough that the review is answerable — every item below already exists as a board, a string, or a rule.

[[12-security-and-legal-scoping]] §B.4 draws the line this doc operates on: **legal clearance (licences · IP · PDPA/GDPR) ≠ cultural clearance (respect · meaning · appropriateness) — neither substitutes for the other.** The legal side is handled there (§B.3/B.5); this doc owns the cultural side.

**What is being reviewed (the five, from the ticket + the docs):**

| # | Item | Where it lives | Why a practitioner should see it |
|---|---|---|---|
| 1 | The four tier names — 正中 Bullseye ×2.0 · 虔誠 Devout ×1.5 · 擦邊 Graze ×1.0 · 偏失 Miss ×0 — and the *"aim for the fire's heart · 對準火心"* line | core-loop boards; burn + reward copy | grading devotion by aim is the boldest design call we've made |
| 2 | The offering **returns** on a miss — it is never destroyed | [[04-ar-app-patterns]] rule; burn behaviour | the line between "a game about burning" and a game about wasting |
| 3 | Digital ancestral tablets — user-typed names, up to 10 per clan | altar + ancestor-sheet boards · [[15-clan-model-and-book-of-tributes]] §5–6 | a screen-based tablet is the biggest departure from practice |
| 4 | Festival framing — Qingming and Hungry Ghost as the peak moments | festival/campaign plan | the ritual calendar is real; invented peaks would read wrong |
| 5 | Monetisation of a memorial (credits · points · ads · future slots) + family-safe advertising | [[10-economy-spec]] (locked) + store boards | money near ancestor names is where apps commonly offend |

Plus two sanity checks on sensitivities already written into the docs: **ancestor names never reach analytics/logs/shares/store listing** ([[13-privacy-and-retention]] §4) and **the store listing implies no temple affiliation and no spiritual efficacy** ([[12-security-and-legal-scoping]] §B.6/§B.8 honesty clause).

**Ticket tasks ↔ this doc:**

| SCRUM-24 task | Where | Status |
|---|---|---|
| List candidate advisors | §3 | ✅ drafted |
| Write the 10-question review sheet (+ screenshots) | §4 · screenshot pack §2 | ✅ sheet · ☐ PNG export at prep |
| Decide in advance what we will / won't change | §5 | ✅ |
| ~~Book the first conversation~~ | §6 | ⏭️ **deferred → SCRUM-49** (runs once the app is functional) |
| ~~Record the outcome in the concept board~~ | §7 (template) | ⏭️ **deferred → SCRUM-49** |

---

## 2 · The review pack (what the practitioner sees)

Prepared from **Penpot (the design source of truth)**, exported as a still PNG pack; the PM walks through it on a phone in the meeting — show, don't tell. Screens in flow order, EN row + 中文 row:

| # | Moment | Export from | What it shows |
|---|---|---|---|
| 1 | Home / shrine + the altar | `1 Home / Shrine` · full altar `1c` · carousel `1b` · decorated `1d`/`1e` — both rows | the clan altar, tablets carrying real names, the feel |
| 2 | Add an ancestor | `1s Ancestor sheet` (+ `1s2` edit mode) | typing 姓/名/称谓 → the name painted onto the tablet |
| 3 | First-run fork | **not built — SCRUM-48**; show doc 15 §4 text + `0b` onboarding for the boot feel | Join / Create clan — the required entry, no personal altar |
| 4 | Capture → Transform | `2 Capture` → `3 Transform` (+ `3e` transforming) | the real photo → joss-art; the offering they will throw |
| 5 | The burn | `4 Burn` (+ `4b` flare) | the fire, the sight, the tier line, the throw |
| 6 | A miss (the return) | `4s Miss + rethrow` | the miss copy + the rethrow ladder note ("up to 虔誠 — never 正中") |
| 7 | Reward | `5 Reward` (+ `5b` — the ad card; doubles for Q9) | points count-up, the tier reveal |
| 8 | The Book of Tributes | **not built — SCRUM-48**; doc 15 §5/§7 as text | who offered when; members full, outsiders anonymised |
| 9 | The store / the money | `9 Cash shop` (+ `9b`) · `9c/9d Daily gift` · `7b Decorations` | where money and ads actually appear |

⚠️ **The clan/Book boards (SCRUM-48) do not exist yet.** If the first conversation happens before they are designed, show [[15-clan-model-and-book-of-tributes]] §5/§7 as text and mark the visuals "pending".

**Export checklist (PM, ~10 min at prep time):** export the nine moments above from Penpot as PNGs at 2× → name `S24-01-home.png` … `S24-09-store.png` → one folder per advisor language (`/zh` gets the 中文 row) → attached to the meeting materials. *(The Penpot plugin cannot batch-export to the vault; do this in the Penpot UI — File → Export.)* Board names above verified against the file on 2026-10-01 — 131 boards, page "New-user tutorial · Core loop".

## 3 · Candidate advisors

Aim: **one** conversation before the family alpha; more only if the first raises doubt. Cheapest first — the family itself is the highest-context reviewer and needs no scheduling.

| # | Candidate | Why them | Route | Status |
|---|---|---|---|---|
| 1 | **Family elder** — the PM's own grandmother/uncle generation | they *do* the ritual; their answers settle most of §4 | direct conversation, family setting | ☐ to invite |
| 2 | **Temple staff** — a Taoist/Buddhist temple with active joss practice | how offerings/tablets/tiers are actually done now; the "fire's heart" question belongs here | visit on a quiet weekday, ask at the office — bring the PNG pack | ☐ to schedule |
| 3 | **Clan-association officer** — Singapore 宗乡会馆 (SFCCA members run ancestral halls + Qingming ceremonies) | the 电子化 line; they hold the community's practice knowledge | intro via email; the SFCCA member list is public | ☐ to identify |
| 4 | **Academic** — NUS/NTU Chinese Studies or anthropology of religion | digital-memorial precedent; structured critique; low cost | email a 1-page brief + PNG pack; 30 min | ☐ optional |
| 5 | **Joss-paper craftsperson** — a 纸扎店 | motif/colour meaning — what must not be simplified or stylised | walk in, buy something, ask | ☐ optional |

Notes for the PM:
- **Compensation etiquette:** a red packet / small thank-you suits the family elder and temple staff; academics go through their normal courtesy. Budget it as a small one-off (log in `project-costs.md` if spent).
- **Record with consent** — ask before audio-recording; if declined, fill §7 live.
- **Language:** offer 中文 or English per advisor — the review sheet is bilingual for this reason.
- The same pack doubles as the **SCRUM-24 evidence**: keep the PNG folder + the filled §7 together under the ticket.

---

## 4 · The 10-question review sheet

### 4.1 How to run it
- **45–60 min.** Each question: show the board first, then read the question. One topic at a time.
- **Capture, don't argue.** The practitioner's words go into §7 verbatim where possible; decisions are made after, by the PM, against §5.
- **One conversation, structured.** If the advisor wants to roam, let them — the sheet's job is coverage, not order.

### 4.2 The sheet (copy-ready · bilingual)

> Copy this block into a one-pager for the meeting. ZH is written in simplified (the app's copy direction); the tier names appear **as shipped** — Q1 asks about the script.

**Q1 — The four names.** The app grades a throw into four tiers — English row: *Bullseye ×2.0 · Devout ×1.5 · Graze ×1.0 · Miss ×0*; Chinese row: *正中 ×2.0 · 虔誠 ×1.5 · 擦邊 ×1.0 · 偏失 ×0* (as shipped — traditional characters). Do these words sit right for a ritual? Would you change any — and should the app use traditional or simplified characters?
*中文：应用把供奉分成四级——中文行：**正中 ×2.0 · 虔誠 ×1.5 · 擦邊 ×1.0 · 偏失 ×0**（目前为繁体）；英文行：Bullseye / Devout / Graze / Miss。这四个词用得对吗？有哪个要改？（另外：界面该用繁体还是简体字？）*
*Show: both burn boards — the tier line under the fire.*

**Q2 — The throw.** The offering is thrown into the fire — drag up, release; where it lands sets the grade. Is a *thrown* offering the right gesture (versus placing it, or a single tap)?
*中文：供奉是用手向上拖、松手「抛」进火里；落点决定等级。用「抛」这个动作可以吗？（还是应该用「放」或者点一下就好？）*
*Show: the burn board — then a live throw if possible.*

**Q3 — "The fire's heart".** The aim line reads *"Aim for the fire's heart" / 「對準火心」* (swipe hint: *"Swipe up & aim for the heart" / 「上滑對準火心拋入」*), and the best grade (正中) is the centre of the flame. Does aiming at the flame's centre feel right — or does it risk making the fire itself the focus, when it should be the ancestors?
*中文：瞄准提示是「**對準火心**」（上滑提示「上滑對準火心拋入」），最高等级就是火焰的正中。把「火心」当作瞄准目标合适吗？会不会让「火」变成了主角，而不是先人？*
*Show: the burn board with the sight + ladder.*

**Q4 — A miss.** A miss pays nothing and the offering **falls back to the hand** — the shipped copy: *"Missed the fire — the offering falls back to your hand — nothing is lost, nothing is earned." / 「未中火心 · 供品回到您手中——未失未得。」* Up to 3 throws per offering; a rethrow caps at 虔誠 — never 正中 *(SCRUM-23)*. Is "returns, never destroyed" the right rule — and does the wording say it the right way?
*中文：没抛中的时候不得分，供品**回到手中**——现有文案：「**未中火心 · 供品回到您手中——未失未得。**」每次供奉最多投 3 次；补投最高只到 虔誠，永不为 正中。这条「不烧毁、可重试」的规则对吗？这样的说法得体吗？*
*Show: `4s Miss + rethrow` — the copy + the ladder note.*

**Q5 — The tablets.** Users type ancestors' names (姓 · 名 · 称谓 chips) and each appears on a tablet on the altar; a clan holds up to 10. Names paint up to 3 characters; without a given name the app shows 姓 + 氏 (e.g. 陈氏). Are digital tablets acceptable at all? What would make them feel right — the wording on a tablet, how a name is displayed, what happens when an ancestor is removed?
*中文：用户输入先人的称呼（姓 · 名 · 称谓），显示在祭坛的电子牌位上；一个宗族最多十位。名字最多显示 3 个字；没有名字时显示「姓 + 氏」（如 陈氏）。用电子牌位可以接受吗？怎样做才算得体——牌位上的文字、名字的写法、移除先人时的处理？*
*Show: the altar + `1s Ancestor sheet` — note the altar art currently draws 4 tablets (display at cap 10 is a pending design item, doc 15 §10).*

**Q6 — The clan altar.** One shared altar per clan: many family members, one ancestor list, one Book of Tributes recording who offered when; members see everything, outsiders see an anonymised note. Does one shared altar match how the family venerates together? Is any part of the structure — a Head, Elders who manage the list, Members who offer — a problem?
*中文：每个宗族共用一座祭坛：多位家人、一份先人名册、一本供奉簿（记录谁在何时供奉过什么）；族内成员看得完整，族外人只看到简略信息。共用祭坛符合家族一起祭拜的方式吗？族长／长老／成员的分工有没有不妥的地方？*
*Show: [[15-clan-model-and-book-of-tributes]] §3/§5/§7 as text (boards pending SCRUM-48).*

**Q7 — The festivals.** The app peaks at Qingming and the Hungry Ghost month; the daily streak has a freeze so festival weeks are never punished. Are those the right two peaks? What other days matter most — CNY · winter solstice · death anniversaries · the 7th month's specific days?
*中文：应用在清明和盂兰节（鬼月）最活跃；连续记录遇到节日会「冻结」，不强迫每天打卡。这两个高峰对吗？还有哪些日子最重要（新年 · 冬至 · 忌日 · 七月十四/十五）？*
*Show: the festival/campaign plans.*

**Q8 — The money.** The app is free to use; offerings beyond the free daily allowance are earned with points (or bought), free users may watch a family-safe ad for one extra, and later, altar slots beyond 10 would be purchasable. Is any of that unacceptable in a memorial setting — and where exactly is the line?
*中文：应用本身免费；超出每日免费次数的供奉，用点数兑换或购买；免费用户也可以看一则家庭友善的广告，换取多一次供奉；日后超过十位的牌位需要购买。在祭祀的场景里，哪些做法不能接受？界限在哪里？*
*Show: the store boards (`9` · `9c/9d`) — walk the money pass itself.*

**Q9 — Advertising.** Ads are family-safe only, and only after the ritual — never inside the offering itself. What categories must never appear (gambling · loans · alcohol · unhealthy food …)? And is there any other moment that must stay ad-free (e.g., while ancestor names are on screen, festival days)?
*中文：广告只放家庭友善的内容，而且只在仪式结束之后出现，绝不打断供奉的过程。哪些类别绝对不能出现（赌博 · 借贷 · 酒类 · 不健康食品……）？还有没有其他必须保持无广告的时刻（例如先人的名字显示时、节日当天）？*
*Show: the ad slots (`5b` card · Daily Gift).*

**Q10 — Names and privacy.** Ancestor names never appear in analytics, logs, crash reports, the store listing, or any share surface — they stay only inside the family's own screens. Is that the right level of protection? What else should be protected — or is there anything we show that would surprise you?
*中文：先人的名字不会出现在数据分析、系统日志、崩溃报告、商店介绍或任何分享画面里——只在家族自己看到的界面上。这样的保护够吗？还有哪些应该保护？有没有什么地方，我们展示的方式会让你觉得意外？*
*Show: the tablet board (what is on screen) — the rules are read, not shown.*

### 4.3 What the practitioner is NOT being asked about (scope guard)

Say this at the start, so the conversation stays useful: **not** licensing/legal (already handled — [[12-security-and-legal-scoping]]), **not** the AI pipeline or pricing maths, **not** the visual style itself (locked), **not** app-store mechanics. And state the honesty rule that is already ours — the store listing will claim no spiritual efficacy and no temple affiliation — then move on.

### 4.4 Micro-decisions this sheet may settle

| # | Decision | Why it's open now |
|---|---|---|
| 1 | **Script per surface** — traditional vs simplified | the app currently *mixes* — confirmed live on the boards: `ZH · 4 Burn` shows traditional 虔誠 · 擦邊 beside simplified 焚烧仪式 **in the same board**; older core copy traditional vs newer copy simplified (doc 13 v1.1). Q1 makes this an explicit decision |
| 2 | The exact ZH wording of the "returns" copy | Q4's second half — the miss message is not yet written |
| 3 | The ad exclusion list (concrete categories) + any protected moments | Q9 → feeds the economy doc + build |
| 4 | Tablet wording details (the tablet's secondary line, removal copy) | Q5 |

---

## 5 · What we will and won't change (decided in advance)

Deciding *now* means the practitioner gets a straight answer in the room — and we never quietly redesign under social pressure.

**Will change on advice (no re-litigation):**

| Area | Bound |
|---|---|
| Wording — tier names · the "fire's heart" line · miss copy · tablet wording | any change that keeps the meaning; EN + ZH both |
| Script choice per surface (Q1) | whatever the advisor says reads right for their generation |
| Festival set & weighting (Q7) | add/remove days; adjust campaign emphasis |
| Ad exclusions & protected moments (Q9) | new categories; extra no-ad moments — the placement rule ("post-ritual only") itself stays |
| Tablet display details (Q5) | styling, 称谓 chips, add/remove flow wording |

**Won't change (would take a real redesign + the PM):**

| Area | Why it stands |
|---|---|
| The core loop shape — capture → transform → burn → reward | validated end-to-end; the economy, integrity posture and quota model are built on it |
| "The offering is never destroyed" | the standing rule since [[04-ar-app-patterns]] (Session 4) — it *is* the tone |
| Grades exist at all | generosity is the tunable part (band widths, retries, the rethrow cap); the mechanic stays |
| Clan-scoped altars — no personal altar | SCRUM-22 lock (doc 15 §6 · 07 v2.7) |
| Names-never-in-analytics rule | standing (13 §4) — we can only ever *tighten* it |
| Free / earned / optional-paid model | SCRUM-18 lock (doc 10) — categories & placement are the tunable part |

**Decline-with-courtesy (expect these; how to answer):**

| Likely suggestion | In-room answer |
|---|---|
| "Make everything free / remove purchases" | the free allowance + earned points already make paying optional — paying only buys speed. Show the quota copy (*"Today's offerings are complete…"*). Noted for a future review |
| "Connect it to a real temple's altar" | out of scope at MVP; genuinely a good later idea — noted |
| "Ritual X should get a full event" | noted; campaign planning decides — not declined outright |
| "Change the throw to a tap" | the throw is the validated gesture, but the *way it feels* (aim generosity, retries) is tunable — explore what bothers them |

---

## 6 · Logistics & booking

| Item | Plan |
|---|---|
| **Owner** | PM — the conversation itself. AI prepared the materials; the booking is a PM action |
| **When** | **once a functional app exists** (PM decision 2026-10-01) — the family-alpha build on a phone; no longer calendar-bound |
| **Where** | in person preferred (family home / temple visit); a video call works with the PNG pack |
| **Length** | 45–60 min · one conversation, structured by §4 |
| **Materials** | printed §4.2 (bilingual) · phone with the PNG pack (§2) · §5 for the PM's eyes only |
| **Language** | 中文 / English per advisor |
| **Recording** | ask consent; if declined, fill §7 live |
| **Thank-you** | red packet / gift where appropriate (log any spend in `project-costs.md`) |
| **After** | record into §7 within 24 h · decisions → §8 downstream → Jira comment |

---

## 7 · Outcome record (fill after — one page)

*The ticket's second deliverable. Fill within 24 h of the conversation; keep the advisor's own words where they matter.*

**Conversation:** date · who · where · format · length · language ·
**Also present:** · **Recording:** consented ☐ / notes only ☐

**Blessed (no change needed):**
- …

**Changed (what → where it landed):**
| Change | Lands in | Done? |
|---|---|---|
| … | doc / board / string | ☐ |

**Declined (what → why):**
- …

**Surprised us (things we had not thought of):**
- …

**Decisions needed (who · by when):**
- …

**Next review moment:** ☐ after the family alpha · ☐ before Play submission · ☐ other: …

---

## 8 · Downstream (where outcomes land)

| Outcome | Lands in |
|---|---|
| Copy edits (tier names, aim line, miss copy, tablets) | Penpot core-loop boards → build strings |
| Script decision (Q1) | copy pass across both rows — one script per surface dictionary |
| Ad rules (categories · protected moments) | this doc §7 → [[10-economy-spec]] next revision + ADR-008 (ad posture) |
| Festival list changes | campaign plan + the economy doc's seasonal-rewards open item |
| Tablet / altar changes | SCRUM-46 (build) · SCRUM-48 (boards) · SCRUM-7 (altar displays) |
| Store-listing tone confirmation | Play listing copy — honesty clause check (12 §B.6/§B.8) |

---

## 9 · Status of this deliverable

| Part | State |
|---|---|
| §3 advisor list | ✅ drafted (this session) |
| §4 review sheet (bilingual) | ✅ written |
| §5 change policy | ✅ decided |
| §2 screenshot pack | ⏭️ at meeting-prep time once the app exists (live-app demo preferred; PNG pack as backup) |
| §6 booking | ⏭️ **deferred → SCRUM-49** (validate against the functional app) |
| §7 outcome record | ⏭️ after the conversation → fills **SCRUM-49** → then SCRUM-49 closes |

---

*Created 2026-10-01 (Session 24) — SCRUM-24 deliverable: advisor list · bilingual 10-question review sheet · pre-decided change policy · logistics · outcome template. **SCRUM-24 → Done (planning)**; the execution (book · run · record) is **deferred to SCRUM-49** — PM decision: seek validation only once the app is functional.*


