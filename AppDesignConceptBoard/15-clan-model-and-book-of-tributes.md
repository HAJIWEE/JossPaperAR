# 15 · Clan model, shared ancestors & the Book of Tributes — SCRUM-22

**Date:** 2026-09-30 (Session 23) · **Jira:** SCRUM-22 · **Status:** 📝 v0.3 — PM decisions folded in (30 Sep) · **v0.3 (2 Oct): §2.1 suffix removed · §4.2 order amended — both ratified when SCRUM-48 closed Done**; §10 = follow-ups only
**Depends on:** [[07-system-architecture]] §5.3 (`ancestors` · `tributes` · `burns`) · [[13-privacy-and-retention]] §2/§4 (retention windows · ancestor-name rule) · [[05-concept-to-mvp-gap-analysis]] §5.1 (the missing ancestor link) · SCRUM-29 boards (first-run flow)
**Feeds:** **SCRUM-46** (clan build — backend + frontend) · **SCRUM-48** ✅ **Done 2026-10-02** (Penpot boards — create / invite / join · 22 boards, EN+ZH) · **SCRUM-50** (QR invite — generation + scanner + deep links) · 07 → **v2.7** (§9) → **v2.8** (§4.6) · SCRUM-29 (clan step in first-run) · SCRUM-33 (privacy hub) · SCRUM-7/altar boards (shared list)

> **In one line:** a **clan** is a shared family altar — many people, one ancestor list, one Book of Tributes — with a three-step ladder of roles (Head → Elder → Member); names may repeat and are shown **plain** (the UUID disambiguates server-side, §2.1).

---

## 1 · Why clans (the Session-8 gap, resolved)

The prototype gives the user an altar of up to 4 tablets, but the throw never says *which ancestor* receives the offering, and nothing records what was burned ([[05-concept-to-mvp-gap-analysis]] §5.1). The clan model closes the loop: the altar is the **clan's**, every offering is made **inside a clan**, and every offering lands in that clan's **Book of Tributes**.

The [[13-privacy-and-retention]] §4 rule is unchanged and now load-bearing twice over: **ancestor names never reach analytics, logs, crash reports, or any share surface** — they live under RLS and appear only inside the clan UI.

**Foundational (PM, confirmed):** there is **no non-clan altar** — a user's tablets always live in a clan, so the first-run fork (§4) is required, not a choice to defer.

---

## 2 · The clan object

| Field | Rule |
|---|---|
| `name` | user-set at creation (e.g., 陈氏 · *Gwee Clan*), 2–20 characters — **not globally unique** |
| `id` | **UUID v4** — backend-only; never typed by a user, never shown in full |
| `#suffix` | disambiguator — **4–5 chars of the UUID**, shown only when needed (§2.1) |
| `code` | short human-typable code (~8 chars) — what invitations carry (§5.1) |
| `created_by` | the founding user → becomes **Clan Head** |
| `created_at` | shown as the founding date on the clan card |

### 2.1 Name collisions — the game pattern

Two clans may legitimately share a name (陈氏 is going to). The rule:

* **Unique name** → shown plain: 陈氏
* **Duplicate name** → **also shown plain**: 陈氏. Two clans may share a name; **no suffix, no prompt** — *"there is no need to prompt if other clans have the same name if it is fine to have same name"* (PM, 2026-10-02).
* The **UUID is the only disambiguator** — backend-only, never typed by a user, never shown. Every call still carries it.

This is the same trade players know from games: readable, nothing user-typed.

> ✅ **Amended — SCRUM-48 rev 2, ratified when SCRUM-48 closed Done (2026-10-02):** the earlier "game pattern" (`陈氏 #7c3a` on collision) is **withdrawn from the UI**. The duplicate-name prompt, the suffix notes and the suffix itself were removed from the boards; names display **plain**. The server still owns `display_name` + the `id`, so re-enabling a suffix would be a **display-only** change if it is ever wanted back.

---

## 3 · Roles & the permission matrix

Ladder: **Clan Head → Clan Elder → Member** (the PM's "clan-heads → clan-elders → members").

| Capability | 👑 Head | 🙏 Elder | 🕯️ Member |
|---|---|---|---|
| Make offerings to the clan's ancestors | ✅ | ✅ | ✅ |
| See the full Book of Tributes (who made each offering) | ✅ | ✅ | ✅ |
| Add / remove **ancestors** on the shared list | ✅ | ✅ | ❌ |
| Invite new members (link · code · QR) | ✅ | ✅ | ❌ |
| Promote member → elder | ✅ | ❌ | ❌ |
| Promote elder → **co-head** | ✅ | ❌ | ❌ |
| Rename the clan | ✅ | ❌ | ❌ |
| Remove a member / elder | ✅ | ❌ | ❌ |
| **Delete the clan** | ✅ (incl. co-heads) | ❌ | ❌ |

**Co-head** = an elder lifted to head power ("elders to become co-clan heads who then can delete the clan if they wish" — PM). Full Head column, including the ability to delete the clan; only the founding history differs.

Rules:
* A clan always has **≥ 1 Head** — the ladder cannot be emptied. ⚠️ **Updated 2026-10-08 (`SCRUM-84`):** a Head who wants out is **no longer stuck** — the ladder prompts them to **name a successor**, else auto-promotes the **oldest elder** (migration `0013`), and refuses only when there is no co-head, no elder *and* nobody named. Deleting the clan remains the other exit.
* ⚠️ **Headship now has a LINE OF SUCCESSION** (`SCRUM-84` follow-up, migration `0014`): **the successor inherits the departing rank** — a departing `head` hands over to a new `head`, a departing sole `co_head` to a `co_head`, and a head who leaves a co-head behind promotes **nobody**. So `head` is **no longer only the founder's**: `clans.created_by` still records who founded the clan and is **never rewritten** (the *founding* fact is immutable; the *seat* is not). `set_member_role` still refuses `head` — succession is its only path.
* The founder is not special: any head may rename, invite, promote, delete.
* ⚠️ **The Invite row above is now ENFORCED, not merely stated (`SCRUM-86`, 2026-10-09).** The PM confirmed it (*"limit link sharing to elder and above seniority"*) — so **this table did not change**; two things that had drifted from it did. **(a)** `canInvite` in `src/lib/clan-roles.ts` returned head-power only, and the comment above it **misquoted this document** as saying "Elder ❌". **(b)** The database never enforced the row at all: `clans_select_member` is **table-level** RLS, so any member could read `clans.code` directly. Both are fixed — migration **`0015`** revokes the table-wide SELECT on `clans` and re-grants every column **except `code`**, and `clan_invite_code(p_clan_id)` serves it to **elder and above**. ⚠️ **Re-roll stays Head-only** (`0015` deliberately did not touch it), which is also what §5.1 and doc 07 §4.6 already say — sharing a link and retiring it are different acts.

---

## 4 · Clan creation flow (deliverable · UI states)

Entry: **required** in first-run, straight after account creation (SCRUM-29 board `0d`) — a user cannot reach Home without creating or joining a clan (no non-clan altar, §6). Later reachable from Profile → **My Clans**. Both language rows mirror.

### 4.1 The fork — one screen, two cards

* **加入宗族 · Join a Clan** — *a family member sent you a link? Enter the code.* → §4.3
* **创建宗族 · Create a Clan** — *start your family's altar.* → §4.2

### 4.2 Create — four taps to head

1. **Name it** — type the clan name; hint chips (陈氏 · 林氏 · Tan Family…); live preview of the display name (shown **plain** — §2.1).
2. **Confirm** — card: the name · *you will be the Clan Head* · one line of rules (ancestors are shared · invite family) → single **创建 · Create** button.
3. **Invite card (skippable)** — *Invite your family* with code + QR + share sheet primed.
4. **First ancestor hand-off** — straight into the existing ancestor ＋ sheet (*"place your first tablet"*).

States: empty name disabled · duplicate name allowed (shown plain) · success → Home on the clan altar.

> ✅ **Order amended to match the built design (SCRUM-48 ✅ Done 2026-10-02):** the **invite card comes before the ancestor sheet** (3 ⇄ 4 above). Reason: the signed-off `1s` ancestor-sheet boards stay the **terminal hand-off into Home**, so no board is orphaned. On `0e / 0e4`, **Skip** and **Continue** both lead into the sheet.

### 4.3 Join — three ways to one tap

| Method | Flow |
|---|---|
| **Code** | paste/type the ~8-char code → clan preview card → **加入 · Join** |
| **QR** | scan (camera) → same preview → Join |
| **Link** | open the invite link → same preview → Join |

Preview card shows: clan display name · ancestor count · member count · who invited you (or the founder). **No ancestor names before joining** (13 §4).

**Decision — no approval queue.** A valid code joins instantly; a mistyped or revoked code fails loudly. Vetting is human, not a UI gate: heads can remove members, the code can be re-rolled. Rationale: the 40–50s audience + family-alpha reality; an approval inbox would be the app's first support burden. *Revisit if clans outgrow family (§10).*

---

## 5 · Membership & invitations

### 5.1 The invitation = the code, dressed three ways
One active `code` per clan (Head can re-roll it): **link · QR · copyable code**, all from the clan card. The invite surface is always one tap from Home.

> **Build detail → [[07-system-architecture]] §4.6** — code alphabet · the **QR payload is the invite deep link** · generation is **client-side** · scanning via `expo-camera` · the `preview_clan` / `join_clan` resolve path. Ticket **SCRUM-50**. The QR on the Penpot boards is a **decorative placeholder**; the production QR is generated at runtime from the real code.

### 5.2 Multiple clans, per-user rewards (PM rule)
* A user may belong to **many clans**, with a **different role in each** (elder here, member there).
* **Every quota and reward is per USER** — the existing caps (10 photo burns · 20 store burns / day — [[10-economy-spec]] §1) are shared across all of the user's clans; no clan multiplies them.
* Consequence: **tribute is clan-scoped.** "Make an Offering" always resolves to *a chosen clan* — the button lives on the clan's altar/card, not in global chrome.
> ⚠️ **Where the clan identity lives on Home — SETTLED by the S36 design pass (2026-10-09, `SCRUM-91` option A).** *"Home is clan-scoped"* is satisfied by a **header PILL**, not a card: the signed-off Home layout has **no free band** — **measured**, not assumed (rasterising all 35 layers returns exactly **one** empty rectangle on the board, the header row `x 230–486, y 180–280`) — so the control sits **between the app mark and the settings button**: `240,234` · **236×44** · r14 · the `btn · settings` treatment, carrying the clan name (shown **plain**, §2.1) + the viewer's **role chip** + an affordance that opens the clan surface. ⚠️ **This does not soften the rule above:** the pill says *which* altar and *how to switch*; **"Make an Offering" stays on the altar/card, never in the chrome.** Boards `EN · 1h` · `EN · 1h2` · `ZH · 1h` · `ZH · 1h2`, Penpot version **`S36 · Home clan pill (SCRUM-91 option A)`**; the build is **`SCRUM-92`** (which `blocks` `SCRUM-46`). ⚠️ **The switcher already exists** in `clan/manage.tsx` — the pill **opens it** rather than duplicating it.

* Anti-abuse limits (clans per user, joins per hour…) live in SCRUM-46 with the `rate_counters` pattern ([[11-integrity-posture]] §5).

### 5.3 Leaving & removal

| Case | Rule |
|---|---|
| Member / elder leaves | instant and free; their **past** Book entries stay (the record is the clan's) |
| Head removes a member | allowed; same history rule |
| Head leaves | ✅ **Answered at SCRUM-84 (2026-10-08) — the ramp.** If a co-head exists, they simply leave. Otherwise they are **prompted to name a successor**; if they name none, the **oldest ELDER by time of joining** is auto-promoted to **co-head**, and then they leave. Refused only when there is no co-head, no elder **and** nobody named (then: promote a co-head, or delete the clan). No headless clans, ever. |

---

## 6 · The shared ancestor list

* **One list per clan, common to every member** — and every member tributes to **all** of it (PM: *"ancestor list is common across for all clan members. all clan members tribute to all clan ancestors."*). ✅ **Confirmed (PM):** an offering is **clan-scoped**, not addressed to a single tablet — *"in real life no one specifies which specific ancestor to tribute to… it doesn't make sense to dilute the tribute per ancestor"*. This answers [[07-system-architecture]] §7 **Q3** (*"is `ancestor_id` required on a burn, or is shrine-wide the default?"* → **the clan is the addressing unit; per-ancestor attribution is out of MVP**).
* **There is no non-clan altar** ✅ — every user creates or joins a clan at first-run; every tablet list is a clan list (§4). No personal-altar fallback exists.
* **Management = Head / co-head / elder** — add · edit · archive. Members view and tribute only.
* Removed ancestors are **archived, not erased** (`archived_at`) so Book entries that reference an era still read cleanly.
* Names stay under RLS + the [[13-privacy-and-retention]] §4 rule — never in analytics, logs, or share surfaces.
* **Cap = 10 ancestors per clan** ✅ — *"larger clans normally suggest a longer and more successful clan"*; **additional slots will be monetized later** — a lineage aspiration worth paying for. Keep the cap a **server-side per-clan value** (`clans.ancestor_cap`, default 10) so expansion is a value change, not a migration (§9). Note: the altar art holds 4 tablets; showing up to 10 needs a display strategy (§10).

---

## 7 · The Book of Tributes (the record)

### 7.1 Entry shape (PM-locked)

| Field | In the entry? | Notes |
|---|---|---|
| **Offering** | ✅ | the item / capture name |
| **Clan** | ✅ | display name (+#suffix) — the entry's anchor |
| **User** | ✅ | who made the offering — visibility differs (§7.2) |
| **Points** | ✅ | what that offering earned |
| **Date** | ✅ | shown inside the rolling window |
| **Festival** | ✅ optional | set on festival days |
| **Image** | ❌ | **deliberately dropped** — no per-tribute image reference, no growing CDN copies (PM). The styled sprite itself is unchanged ([[13-privacy-and-retention]] §2). |

### 7.2 Visibility — in-clan vs outside

| Viewer | Sees |
|---|---|
| **Clan member** | the **full** entry — offering · clan · user · points · date (the "who" is the social heart) |
| **Outside the clan** (signed in, not a member) | offering · clan · points · date — the member is shown as **anonymous** (*"A member made this offering"*) |

**Window:** a **rolling 1 month** — the Book shows and queries the last month only (PM: *"history should go back at max a month"*). Whether older rows are hidden or purged is a build-time detail ([[13-privacy-and-retention]] §2 amendment) — §10.

---

## 8 · Copy (EN / 中文) — the whole flow

| # | Moment | EN | 中文 |
|---|--------|----|------|
| C1 | Fork screen title | *Your family's altar* | *您家族的祭坛* |
| C2 | Join card | *Join a Clan — a family member sent you a link? Enter the code.* | *加入宗族 — 家人发来了链接？输入邀请码。* |
| C3 | Create card | *Create a Clan — start your family's altar.* | *创建宗族 — 建立您家族的祭坛。* |
| C4 | Create · name field | *Clan name* · hint 陈氏 · Tan Family | *宗族名称* · 例：陈氏 · 林氏 |
| C5 | Create · confirm | *You will be the Clan Head.* | *您将成为族长。* |
| C6 | Create · invite card | *Invite your family* | *邀请家人加入* |
| C7 | Join · code field | *Enter clan code* | *输入邀请码* |
| C8 | Join · preview | *{name} · {n} ancestors · {m} members* | *{名称} · 先人 {n} 位 · 成员 {m} 位* |
| C9 | Join · success | *Welcome to {name}.* | *欢迎加入{名称}。* |
| C10 | Clan settings · invite | *Share code · Show QR · Copy link* | *分享邀请码 · 显示二维码 · 复制链接* |
| C11 | Role labels | *Clan Head · Elder · Member* | *族长 · 长老 · 成员* |
| C12 | Promote (head only) | *Make Elder* / *Make Co-Head* | *设为长老* / *设为副族长* |
| C13 | Make an offering (clan-scoped) | *Offer to {name}'s ancestors* | *向{名称}的先人供奉* |
| C14 | Book · header | *Book of Tributes* | *供奉簿* |
| C15 | Book · outside view | *A member made this offering.* | *由宗族成员供奉。* |
| C16 | Book · window note | *Showing the last month.* | *仅显示最近一个月。* |
| C17 | Delete clan (head) | *Delete this clan? Every member loses the altar and the Book of Tributes. This cannot be undone.* | *删除宗族？所有成员将失去祭坛与供奉簿，无法复原。* |

**Terminology (ZH lock — confirm against the design row):** 宗族 clan · 族长 head · 长老 elder · 副族长 co-head · 成员 member · 供奉簿 Book of Tributes · 邀请码 invite code. *(供奉 already means "offering" in the shipped copy — [[10-economy-spec]] §4.)*

> ⚠️ **CHARACTER-SET MISMATCH — measured 2026-10-08, and not silently resolved.** This table is typed in **SIMPLIFIED** (C2's *家人发来了链接？输入邀请码。*), but the shipped `src/lib/i18n.ts` is **TRADITIONAL** (*家人發來了連結？輸入邀請碼。*) — and the code is what the signed-off `ZH · 0e 宗族` boards were built from. The new SCRUM-46 copy was therefore written **traditional**, to match the app rather than this table. **Which character set the Singapore-diaspora audience should read is a product question for the PM** (Singapore is officially simplified, but its traditional-using families are a real segment) — a definitive answer means either a sweep of the i18n table or a correction here. Recorded so a future session does not copy this table into the app and silently half-translate it.

---

## 9 · Schema impact → [[07-system-architecture]] (v2.7)

**New tables** (naming/style per §5.3):

| Table | Key columns | Notes |
|---|---|---|
| `clans` | `id` uuid PK, `name`, `code`, `created_by`, `created_at`, `archived_at?`, `ancestor_cap` (default **10**) | `name` not unique; server composes `display_name` (suffix on collision); `ancestor_cap` is raised later by **slot purchases** (monetization hook) |
| `clan_members` | `clan_id`, `user_id`, `role` (`head`\|`co_head`\|`elder`\|`member`), `joined_at` | PK(`clan_id`,`user_id`); **≥1 head-power** enforced by a **`DEFERRABLE INITIALLY DEFERRED` constraint trigger** (migration `0012`), so it fires at COMMIT and never blocks a same-transaction succession |

**Changed tables:**

| Change | Detail |
|---|---|
| `ancestors` | gains `clan_id` **required** — no personal altars (§6); the old 4-cap becomes the **clan cap** = `clans.ancestor_cap` (default 10, slot purchases later) |
| `burns` | gains `clan_id` (**required**) — the burn is clan-scoped; `ancestor_id` stays nullable but is **not** part of the offering flow (07 Q3 now answered) |
| `tributes` | gains `clan_id`; `visibility` default becomes `clan` (**members see all; non-members see the anonymised projection**); rolling 1-month window noted against [[13-privacy-and-retention]] §2; entry API shape = §7.1 (no image) |

**RLS sketch** (exact policies = SCRUM-46): read `clan_members`/`ancestors`/`tributes` where `clan_id ∈ my clans`; ancestor writes gated on role ∈ {head, co_head, elder} and capped by `clans.ancestor_cap`; delete-clan RPC asserts role ∈ {head, co_head}; the non-member read path returns the anonymised projection only.

---

## 10 · Open items (deliberate)

| # | Item | Owner |
|---|---|---|
| 1 | ~~Offering scope~~ → ✅ **resolved (PM): clan-scoped** — no per-ancestor attribution; *"in real life no one specifies which ancestor"* (§6) | ~~PM~~ ✅ |
| 2 | ~~Personal vs clan altars~~ → ✅ **resolved (PM): no non-clan altar** — the first-run fork is required (§4/§6) | ~~PM~~ ✅ |
| 3 | ~~Ancestor cap~~ → ✅ **resolved (PM): cap 10**, extra slots monetized later (§6/§9) | ~~PM~~ ✅ |
| 4 | ~~Head-exit mechanic~~ → ✅ **resolved (PM, 2026-10-08 — SCRUM-84)**: a **HYBRID**, neither of the two I offered. **Prompt the leaving head to name a successor; if none is named, auto-promote the OLDEST ELDER by `joined_at`** (ties break on `user_id`, so it is deterministic). The successor becomes **co-head, not `head`** — §3 keeps `head` the founder's immutable fact. ⚠️ **SUPERSEDED the same day (migration `0014`): the successor INHERITS the departing rank** — *"hand over to a new head if no co-head, co-head if co-head already exists."* A departing **`head`** (no co-head) hands over to a new **`head`**; a departing **sole `co_head`** hands over to a `co_head`; a head who leaves a **co-head** behind promotes **nobody** — that co-head carries on. ⚠️ **§3's immutability is NARROWED, not dropped:** `clans.created_by` still records the founder and is never rewritten, but **headship now has a line of succession**, so a clan may have a `head` who did not found it. `set_member_role` still refuses `head` — succession is its only path. Refused only when there is **no co-head AND no elder AND nobody named**. Built in migrations `0013` + `0014`. | ~~PM~~ ✅ |
| 5 | Book window — hide vs purge rows older than 1 month (13 §2 amendment) | build ticket (SCRUM-46) |
| 6 | ~~ZH terminology lock~~ → ✅ **locked against the design row (SCRUM-48 Done 2026-10-02)**: **宗族 · 族长 · 长老 · 副族长 · 成员 · 供奉簿 · 邀请码** | ~~design row~~ ✅ |
| 7 | **Altar display at cap 10** — the art holds 4 tablets; scroll / rows / pages needs a design pass (feeds SCRUM-7/29 boards) | design row |

---

*Updated 2026-10-02 (**v0.3** · SCRUM-48 rev 2 → **closed Done**) — **§2.1 amended: duplicate names display plain** (suffix + prompt withdrawn) · **§4.2 order amended: invite card before the ancestor sheet** (matches the built boards) · **§10 item 6 resolved — ZH terminology locked** · **invitation build detail → [[07-system-architecture]] §4.6 + SCRUM-50** (§5.1) · doc 07 → **v2.8**.*
*Updated 2026-09-30 (**v0.2**, same session) — PM confirmations folded in: offerings are **clan-scoped** (no per-ancestor attribution) · **no non-clan altar** (first-run fork required) · ancestor cap **10**, extra slots **monetized later** (`clans.ancestor_cap`; §6/§9).*
*Created 2026-09-30 (Session 23) — SCRUM-22 deliverable: clan model spec — roles matrix · creation/join flow · invitation system · shared ancestor list · Book of Tributes shape + visibility · EN/ZH copy. Feeds SCRUM-46 (build) and the [[07-system-architecture]] v2.7 amendment.*
*Updated 2026-10-09 (**v0.4** · S36) — **§5.2 amended: the Home clan control is a header PILL, settled by MEASUREMENT.** The signed-off Home has no free band — rasterising all 35 layers returns exactly **one** empty rectangle (the header row `x 230–486, y 180–280`) — so no card was ever placeable. ⚠️ The rule it does **not** soften: *"Make an Offering" stays on the altar/card, never in the chrome*. Build → **`SCRUM-92`** (`blocks` `SCRUM-46`) · and a signed-off board fails AA (`0e3`'s chip = **2.77:1**) → **`SCRUM-93`**.*
