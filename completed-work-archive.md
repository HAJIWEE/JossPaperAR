# 🗄️ Completed Work Archive — Joss Paper AR

> **Purpose:** finished session history and closed follow-up items, moved out of [[next-ai-context]] and [[follow-up-items]] on **2026-10-02 (Session 26)** so those two files stay short enough to read at the start of a session.
>
> ⚠️ **Nothing here is live work.**
> - current state → **[[next-ai-context]]**
> - open items → **[[follow-up-items]]**
>
> Content is preserved **verbatim** from the source files (checkboxes, links and "TODO"-looking text are historical records — do not act on them).

**Contents**
1. **Session log** — sessions 2 → 27, newest first (was `next-ai-context.md` § Session Log)
2. **Superseded context sections** — the S19 review queue, the S20 open follow-up, the Sprint 0 goal
3. **`next-ai-context.md` footer history** — the dated `*Updated…*` change log
4. **Completed follow-up items & superseded notes** — was `follow-up-items.md` § Immediate Actions / Validation / Medium-Term / Key Questions / Resources / Notes
5. **`follow-up-items.md` footer history**

---


---

## 1 · Session log — sessions 2 → 27, newest first

> Verbatim from `next-ai-context.md`. Sessions 1–11 are compacted further down; the detail lives here.
### 🕐 Session Log — newest first

#### 📅 Session 27 (2026-10-03) — SCRUM-14 ✅ Done (planning): MVP scope + realistic timeline → doc 18; the three missing build tickets filed (SCRUM-53/54/55)
**Trigger:** PM — *"Take a look at Scrum-14 in Sprint 1 using the Jira MCP… Lets start Scrum-14."*

SCRUM-14 (*"Define MVP scope and create realistic project timeline"*, raised S2, Medium) was **In Progress** in Sprint 1 with its scope input already written (S8 — `05-concept-to-mvp-gap-analysis.md`), and the 2026-09-24 note on the ticket pointed at the milestone chain *spike → vertical slice → family alpha → beta*. What was missing was the **plan itself** — and, on inspection, three tickets the critical path silently needed.

1. **Deliverable — [[AppDesignConceptBoard/18-mvp-scope-and-timeline|doc 18 · MVP scope & realistic timeline]]** ✅. §1 definitions (slice / alpha / beta / deferred) · §2 **12 essentials vs 8 deferred**, each essential carrying its source doc, build site and acceptance test · §3 the **dependency map** (gates **G1–G6**, the DAG, and the same map in Jira terms) · §4 effort in **focused sessions** (the project's own measurable unit — S1→S26 ran in 11 days) with a stated pace assumption · §5 the **M0–M5 timeline** · §6 a **12-risk register** (L/I · trigger · owner) · §7 the **T1–T4 testing plan** + the acceptance tests + the three failure paths · §8 what still needs the PM (D1–D8).
2. **The finding that mattered:** the plan's own dependency map exposed that **nothing was filed to *build* the vertical slice** (SCRUM-17 was only the *scope*, and is Done) and that **no ticket existed for the backend of record** — yet the persist step, the ledger, the league and the location grid all hang off it. **Filed: SCRUM-54** (Supabase backend: schema + RLS + `cartoonize-orchestrator` + `award-service`) · **SCRUM-53** (build the slice — thin: one object type, a hard-coded clan; acceptance test = the four aim bands) · **SCRUM-55** (write the three unwritten ADRs 004/006/008 — decided but unrecorded).
3. **Honesty over a tidy Gantt:** the timeline is **effort-driven** — ~50 focused sessions to beta with the two calendar columns shown side by side (build pace ≈ 4 sessions/week → **beta ≈ Feb 2027 · public ≈ Qingming 2027**; the design-phase pace would be ~3× sooner). It names the two risks that can move every date (**R6 first native build · R7 the Penpot→RN screen build**) and the two *one-PM-action* gates (**SCRUM-52 device · ADR-008 ad posture**) that currently hold the path.
4. **Scope is now closed:** §2.2 is the standing answer to every "we could also…" for the next three months (Virtual Temple · AR-fire collection · battle pass · social beyond the clan · true AR · slots · store UI beyond the catalogue · the ad SDK until ADR-008).
5. **Docs updated:** concept-board index (doc **18** row) · [[next-ai-context]] (critical path re-ordered; S27 logged) · [[follow-up-items]] (SCRUM-53/54/55 added; the SCRUM-10 milestones item closed; **Key Question 1 — timeline — answered**) · this archive. **Jira:** `SCRUM-14` → **Done (planning)**.

#### 🎯 Session 26 (2026-10-02) — SCRUM-8 ✅ Done (planning): the AR framework question answered → ADR-003 (non-AR AR) + doc 17 (AR-fire PoC plan, execution deferred)
#### 🎯 Session 26 (2026-10-02) — SCRUM-8 ✅ Done (planning): the AR framework question answered → ADR-003 (non-AR AR) + doc 17 (AR-fire PoC plan, execution deferred)
**Trigger:** PM — *"Let's start on Scrum-8, refer to the obsidian notes for context."*

SCRUM-8 (*"Explore AR development frameworks — ARKit, ARCore, Unity, etc."*, raised S2, High) had gone stale: the **decision** was made back in S8 (doc 04) and encoded as clause 4 of **ADR-001**, but was **never recorded** — both the ADR register and ADR-001's mapping table pointed at a missing **ADR-003**. This session writes it and closes the ticket as a **planning** deliverable.

1. **Deliverable — [[AppDesignConceptBoard/ADRs/ADR-003-non-ar-ar-mvp-ar-framework|ADR-003 · AR mode & framework = *non-AR AR* for the MVP]]** ✅ Accepted. The MVP uses **no AR framework**: `expo-camera` live preview + a fixed-position RN overlay (the fire is a **≤ 400 KB sprite sheet**, **≤ 30 fps on Tier F**); the throw keeps the four aim bands (正中 ±14.55 · 虔誠 ±39.40 · 擦邊 ±96.97 · 偏失 ×0) ported from the retired prototype. **Rejected, with reasons:** ARKit (iOS-only + world-locking unwanted) · ARCore-direct (Tier F floor can't guarantee it; a native module breaks Expo Go) · Unity/AR Foundation (second runtime + blows the ≤40 MB AAB / ≤120 MB install budget) · Flutter · web-AR (WebXR/8th Wall) · `react-native-arkit` · adopting **SceneView RN _now_** (alpha; its iOS bridge *"does not link, does not run"*; upstream #909 ≈ 5–10 % API coverage). **True AR deferred post-MVP** via **4 exit ramps**: SceneView RN Android → Android Scene Viewer intent → @reactvision/react-viro → a bounded Kotlin module.
2. **Deliverable — [[AppDesignConceptBoard/17-ar-fire-spike-plan|doc 17 · AR-fire spike plan]]** (mirrors doc 08's shape): answers 6 questions; **acceptance = doc 14's N3/N4/N10** (≥ 30 fps Tier F / 60 fps Tier M · input ≤ 100 ms · no throttle in a 5-min run · battery ≤ 8 %/10 min) **+ the aim bands (A5 — the acceptance test)** + sunlight legibility + the sprite budget; PoC = `expo-camera` + overlay, **no native module** (runs in **Expo Go**); test matrix R1–R6 on the **Tier F floor device**; verdict/stop rules (downgrades in order; a floor change **reopens ADR-003**). **Execution deferred** to the **repo+CI milestone (SCRUM-15)** + the floor device.
3. **⚠️ Reconciled an inconsistency:** SCRUM-17's acceptance criteria say *"60 fps AR overlay"*; **doc 14 is the authority** (30 fps floor on Tier F, 60 fps the Tier-M target) and the **aim bands, not fps, are the acceptance test** (doc 14 §4.4).
4. **Docs updated:** [[AppDesignConceptBoard/ADRs/README|ADR register]] (**5 accepted: 001 · 002 · 003 · 005 · 007**) · concept-board index (docs **11–17** added; ADRs row) · [[next-ai-context]] · [[follow-up-items]] · ADR-001's mapping table now resolves (it already predicted §6.2 → ADR-003).
5. **Jira:** `SCRUM-8` → **Done (planning)**; a **follow-up ticket** filed for the **spike execution** (needs repo+CI + the floor device) — parallel to the SCRUM-49 pattern.

#### 🕯️ Session 25 (2026-10-02) — SCRUM-48 clan boards ✅ DONE (PM-marked): 22 boards (EN + ZH), both rows wired, boot hand-off rewired to the required fork; doc 15 → v0.3
**Trigger:** PM — *"start on SCRUM-48, refer to the obsidian notes for context."*

1. **Deliverable — 22 new Penpot boards**, new series **`EN · 0e Clan`** (band y 20340) + **`ZH · 0e 宗族`** (band y 21260), 11 each, **both rows wired inside themselves** (96 interactions total; none orphaned). Saved version **"SCRUM-48 clan boards · create/share/join · EN+ZH wired · 24 boards"** → rev 2 **"…rev2 · realistic QR · logo centred · duplicate-name prompt removed"**; page also carries `comment · SCRUM-48 decisions`. Boards: fork · create-name · create-confirm · create-invite · join-code · join-QR-scan · join-preview · join-success · invite & share · **2 states** (invalid code · already a member).
2. **Hand-off REWIRED** — `0d3` Verify → fork `0e` (was → ancestor sheet `1s`), because the fork is **required** (no non-clan altar, doc 15 §6). `0d3` is a signed-off SCRUM-29 board → **flagged for review**. `1s` is **reused unmodified** as the terminal hand-off into Home.
3. **Paths:** create `0e → 0e2 → 0e3 → 0e4` (invite, skippable) → `1s` → Home · join `0e → 0e5 → 0e7` preview → `0e8` success → Home (QR route `0e5 ⇄ 0e6`) · share surface `0e9` = the three C10 actions + re-roll · states `0e10 → 0e5` · `0e12 → Home`.
4. **Decisions** (on the page + Jira comment `10181`): (a) **create-path order deviates from doc 15 §4.2** (spec: sheet-then-invite) → implemented confirm → invite → sheet, so the signed-off `1s` boards stay the terminal hand-off and **no board is orphaned** — **flagged for PM**; (b) native share sheet / clipboard are platform surfaces → demo-wired to the primed invite card `0e4`; (c) **Home has no clan card yet** — the signed-off Home layout has no free band → "Home → clan card → invite surface" needs a Home design pass (feeds **SCRUM-46**); (d) all text uses the S21 accessible tokens (`--gold-text #7B621F` · `--cinnabar-text #B73820` · `--muted-text #69655E`), brand gold `#D4AF37` is fill-only.
5. **Copy:** C1–C17 from spec §8; ZH locked against this row — **宗族 · 族长 · 长老 · 副族长 · 成员 · 供奉簿 · 邀请码**.
6. **Jira:** `SCRUM-48` → **In Review** (comment `10181`) → **✅ DONE (PM-marked 2 Oct)**. **Ratified at Done:** decision (a) the create-path order · **ZH terminology lock** · the **§2.1 suffix removal** — all folded into doc 15 → **v0.3**; doc 07 → **v2.8** (§4.6).
7. **🔧 Penpot MCP lessons:** a **4-board build in one call timed out** (the plugin hung, ~1 h) → build **1–2 boards per call** and do wiring in a **separate pass**; `penpot.createText('')` returns **null** — pass a non-empty string, then set `characters`; **moving a board moves its children** (absolute coords follow); `saveVersion(label)` persists a named version.

8. **🔁 Rev 2 — PM review feedback applied the same session:** (a) **realistic QR codes** on `0e6` / `0e9` (3 finders + separators + timing + alignment + dense data modules, 33×33 + quiet zone, drawn as a single SVG path ≈52% density); (b) **clan logo centred on `0e8`** (the gold disc + emblem sat 20 px right of centre → disc centre 195 = board centre); (c) **duplicate-name prompt REMOVED** — same names are fine, so the `0e11` state board (EN+ZH) is deleted, the suffix notes are gone, and names display plain (陈氏) — **spec §2.1 `#suffix` display is now unused → doc 15 §2.1 amended (v0.3, ratified at Done)**. Board count **24 → 22**; 96 interactions, none orphaned; re-versioned.

9. **📐 QR = a feature + architecture concern (PM, same session):** the Penpot QR stays **decorative / non-scannable** (wireframe only) — but production QR **generation is now specified as an app feature**. New **[[AppDesignConceptBoard/07-system-architecture]] §4.6** (→ **v2.8**): `clans.code` = one active **8-char capability** (re-rollable) · the **QR payload is the invite deep link** (`https://josspaperar.app/join/{code}` + `josspaperar://` fallback) · **client-side generation** (`react-native-qrcode-svg` — offline, no server cost) · **scanning** via `expo-camera` `barcodeScannerSettings` (**no new native module**) · resolve → `preview_clan` → `join_clan` · joins throttled via `rate_counters` · privacy = **code only**, excluded from analytics. Doc 15 **§5.1 + §2.1** cross-referenced; **`SCRUM-50` filed** (Relates `SCRUM-46` · `SCRUM-48`). Also corrected doc 07's `clans` note — the name displays **plain** (the `#suffix` UI display is dropped).

**Next: the SCRUM-46 clan build (backend + frontend) with SCRUM-50 (QR invite: generation + scanner + deep links) alongside.**


#### 🧧 Session 24 (2026-10-01) — SCRUM-24 cultural consultation planned: advisor list, bilingual 10-question review sheet, change policy, outcome template (vault doc 16)
**Trigger:** PM — *"lets start scrum-24"*, after the context refresh.

1. **Deliverable — [[AppDesignConceptBoard/16-cultural-consultation-and-ritual-review]]** (SCRUM-24 → Done):
   - **§3 Advisor list** — family elder first (highest context, no scheduling) → temple staff → clan-association officer (SFCCA) → academic → joss-paper craftsperson; red-packet etiquette · recording consent · language per advisor
   - **§2 Review pack** — the nine Penpot moments to export as a PNG pack (altar · add-ancestor · first-run fork · capture→transform · burn · miss/return · reward · Book *(pending SCRUM-48)* · store) + export checklist — the Penpot plugin can't batch-wrap, so this is a PM prep action
   - **§4 The 10-question bilingual sheet** — tier names · the throw · "the fire's heart" · the never-destroyed miss · digital tablets · the clan altar · festivals · the money · ads · names/privacy — each question carries the board to show; a scope guard (§4.3) keeps legal/pipeline/style out of the room
   - **§5 Change policy, decided in advance** — will-change (wording · script · festivals · ad categories · tablet display) vs won't-change (core loop · never-destroyed · clans · names rule · the money model) + decline-with-courtesy answers
   - **§7 Outcome record template** — the ticket's second deliverable, to fill within 24 h of the conversation
2. **🔎 Found while writing — the script mix (confirmed live on the boards):** the core-loop copy ships **traditional** (虔誠 · 擦邊 · 對準火心) while newer copy (13 §5 v1.1 · clan C1–C17) is **simplified** — and `ZH · 4 Burn` mixes both in one board (虔誠 · 擦邊 beside 焚烧仪式); the sheet's Q1 makes the choice explicit (recorded §4.4).
3. **Jira:** SCRUM-24 → **In Progress** → **✅ Done** (comments `10176` + `10177`; description tasks dispositioned — book/run/record **deferred → SCRUM-49**). **`SCRUM-49` filed** (Low — *Run the cultural consultation & ritual review (deferred until a functional app)*) + **Relates** link. **PM decision: validation only once the app is functional.** Nothing changed in Penpot or the app — the bridge was used **read-only** (131 boards listed; board names + burn/miss/tablet copy extracted).
**Next: SCRUM-49 parked — activate when the family-alpha build runs on a phone → live-app demo (+ §2 pack backup) → book the first conversation → run the 10 questions → fill §7 → feed §8 downstream.**

#### ✅ Session 23 (2026-09-30) — SCRUM-22 clan model spec DONE & CLOSED: clan/bloodline tracking locked, Book of Tributes specified, schema applied (07 → v2.7)
**Trigger:** PM — the app moves from individual altars to **clan / bloodline tracking**: finish SCRUM-22 (ancestor addressing + the Book of Tributes spec), then wrap the day.

1. **Clan model locked (PM decisions — all in [[AppDesignConceptBoard/15-clan-model-and-book-of-tributes]] §6):**
   - **Offering is clan-scoped** — no per-ancestor attribution (*"in real life no one specifies which specific ancestor to tribute to… it doesn't make sense to dilute the tribute per ancestor"*). This **answers SCRUM-10 doc 07 §7 Q3** — the **clan** is the addressing unit. ✅ Q3 struck in 07.
   - **No non-clan altar** — every user creates or joins a clan at first-run; the Join/Create fork is **required**, not skippable.
   - **Roles ladder: Head → Elder → Member** — Head grants Elder; Head elevates Elder → **Co-Head** (co-heads can delete the clan); elders add/remove ancestors; members tribute only; a clan always keeps ≥ 1 Head.
   - **Cap = 10 ancestors per clan** — *"larger clans normally suggest a longer and more successful clan"*; extra slots **monetized later** (`clans.ancestor_cap`, default 10 → value change, not migration).
   - **UUID v4 backend-only** — display suffix (4–5 chars) only when clans share a name (`陈氏 #7c3a`); users may hold **multiple clans** with different roles; **quotas & rewards stay per user**.
   - **Book of Tributes** — offering · clan · user · points · date · festival (optional); **no image** (no CDN growth); rolling **1-month** window; members see everything, outside viewers see an **anonymised** projection.
2. **Deliverable written — [[AppDesignConceptBoard/15-clan-model-and-book-of-tributes]] (v0.2):** §2 clan object + collision suffix · §3 roles matrix · §4 create/join flow (code · QR · link — no approval queue) · §5 membership & invitations (re-rollable code, leave rules) · §6 shared ancestor list · §7 the Book · §8 **EN/ZH copy C1–C17** · §9 schema · §10 follow-ups. Link check: 0 broken.
3. **Schema applied → [[AppDesignConceptBoard/07-system-architecture]] v2.7:** new `clans` + `clan_members` tables; `ancestors` becomes **clan-owned** (no personal altar; cap = the clan's); `burns`/`tributes` gain `clan_id`; `tributes.visibility` default `clan`; §7 Q3 answered.
4. **Jira:** `SCRUM-22` → **Done** (all 9 tasks ticked; description rewritten with the final decisions; closing comment) · **`SCRUM-47` filed** — slot monetization (Low · backlog) · **`SCRUM-48` filed** — *Design + wire: Clan creation, sharing & joining boards (EN/ZH)* with the full board list, wiring + copy refs (suggested series `0e`) · `SCRUM-29` cross-ref comment (clan selection → SCRUM-48).
5. **Open (spec §10):** head-exit mechanic (PM) · ZH terminology lock (design row: 宗族 · 族长 · 长老 · 副族长 · 成员 · 供奉簿 · 邀请码) · altar display at cap 10 (design — the altar art holds 4 tablets) · Book window hide-vs-purge (build). **No Penpot work today.**

#### ✅ Session 22 (2026-09-30) — SCRUM-45 responsive/safe-area criterion DONE: rules recorded, both guards green
**Trigger:** PM — continue the approved plan: close the last SCRUM-45 criterion (responsive rules) and wire the tools for the real build.

1. **Penpot census run first (read-only)** — the scale had to be read *from the file*, not invented (the S21 lesson). 135 boards confirmed: **131 × 390×844** + 4 × 390×620 that are **scroll-viewport crops of the League list, not a device** → the reference frame is 390×844 and nothing else. **2,427 text shapes · 55 size/weight combos · 9→90 px**; families `sourcesanspro` 2229 · `Noto Serif SC` 190 · `Noto Sans SC` 8. Measured: gutter `sheet · title relX = 20`; top chrome first row at y 36–40; `nav · tabbar (bg)` = y 764→844 (**80 px**, full-bleed); last nav label bottom y 826 → **18 px clearance**; **no system chrome (status bar / notch / home indicator) is drawn at all** — insets are entirely the build's responsibility.
2. **`design-system/responsive.css` written** — the layout layer that ships with the build (link order: tokens.css → responsive.css):
   - **fluid display type** — 8 `clamp()` tokens (hero 76 · display 40 · title-hero 30 · title-page 26 · title-screen 24 · title-sheet 21 · title-row 17 · body-lg 15), each anchored so the design px renders **exactly at 390**, range 320→480;
   - **fixed small type** — 13/12/11/10/9 px steps in **rem** (system scaling ×1.5 reaches them; small text never shrinks on small phones);
   - **safe areas by pattern** — `--pad-screen-top:max(40px, inset)` (top: never collide, never drift) vs `--pad-tabbar-end:calc(18px + inset)` (bottom bar: grows over the gesture zone) — both render design values on notch-less devices;
   - plus gutter `clamp(1rem, 5vw, 1.5rem)` (19.5 @390 ≈ measured 20) · **44 px touch targets** (+8 px gaps, invisible-rect rule) · `100vh → 100dvh` pair · content cap `30rem` centred · glyph sizes px on purpose (icons must NOT scale with font size) · short-viewport breakpoint (≤700 px) · reduced-motion block · viewport contract (`viewport-fit=cover`; never `user-scalable=no`).
3. **`design-system/responsive-check.js` written — 21/21** — re-derives every clamp() at the 390 px reference from the census table (a slope may change; the anchor may not), asserts the invariants (insets · dvh pair · no literal 390/844 outside comments · no raw font-size · 44 px target · growth cap · reduced motion), and scans the build stylesheet with the same honesty rule as contrast-check (`skipped` ≠ green; `--css=` to point it).
4. **`contrast-check.js` upgraded — 22/22** — its lint no longer skips while the build CSS is missing: it now **always scans the foundation** (`design-system/responsive.css`) *plus* the build stylesheet once one exists, and still prints the "no build stylesheet yet" note loudly.
5. **Status:** SCRUM-45 responsive/safe-area criterion ✅ recorded → Jira comment posted (5 of 6 criteria). **Still PM-blocked:** visual review of the 47 changed boards → the colour hold on `SCRUM-42`/`SCRUM-33` stays until then. The build-CSS lint criterion stays open by definition until the build exists — it runs the moment `src/styles.css` lands, no rewrite; wire both guards into CI at the repo + CI milestone (`SCRUM-15`).

#### ✅ Session 21 (2026-09-29) — SCRUM-45 contrast work COMPLETE: tranche 2 applied, 132 AA failures cleared, `lowcAA 0`
**Trigger:** PM — finish the SCRUM-45 accessibility wrap-up: apply the Penpot low-contrast palette fixes, then complete post-fix validation.
1. **Rollback point saved first** — named Penpot version **`S21 · pre-a11y palette fix (clip0/occl14/lowc130)`** at `revn 223`, so the whole batch is reversible from the Penpot UI.
2. **All 4 palette swaps applied** (130 shapes across 47 boards), using the **`design-system/tokens.css` values** so the design file and the real build inherit the *same* hex:

   | from | to | token | n | post-fix ratio |
   |---|---|---|---|---|
   | `#a8862a` | `#7b621f` | `--gold-text` | **84** | 4.52 |
   | `#f0c75e` | `#77632f` | `--gold-bright-text` | **26** | 4.52 |
   | `#a39d92` | `#69655e` | `--muted-text` | **16** | 4.50 |
   | `#d4af37` *(disc fill)* | `#887023` | `--disc-gold` | **4** | 4.52 |

   The cream avatar glyph **`#FFF8E8` was never changed** — the disc *fill* darkened instead, exactly as the token layer prescribes.
3. **⚙️ Tooling lessons — these cost real time, write them down:**
   - **`penpot.replaceColor()` silently no-ops here.** It returned success output but the file did not change. **Never trust its return value.**
   - **Direct `shape.fills = [...]` assignment is the working path** for text fills. Proven with a single-shape write + fresh re-read (`#a8862a` → `#7b621f`) *before* attempting the batch.
   - The batch ran **in one undo block**, no write errors; file revision **223 → 224** confirmed server-side mutation. A fresh census then matched the expected deltas exactly (+84 / +26 / +16 / +4).
   - **Penpot normalises hex to lowercase** — every comparison must be case-insensitive.
   - ⚠️ **The MCP request timeout ≠ the plugin's execution timeout.** `runAudit3()` reported *"timed out after 120 seconds"*, but the plugin task **kept running and completed server-side** — `storage.auditPostFix` was fully populated and readable on the next call. **Check `storage` for an already-landed result before re-running an expensive audit.** (PM subsequently raised the MCP timeout 5m → 1h.)
   - The Penpot tab **suspends** when unfocused and needs a user click before plugin code runs again — but **`storage` survives the suspension**, including seeded audit functions.
4. **Post-fix validation — all green:**
   - **Full re-audit (`storage.auditPostFix`): `clip 0 · occl 14 · lowc 0`** over 135 boards / 10,042 shapes. `lowc` **130 → 0** (all 47 boards clear). The **occlusion set is byte-identical to baseline** (same board/art/by/coverage tuples) — expected, since only *fills* changed and occlusion is a bounds test. Those 14 remain the intentional swatch previews on `1f2/1f3/1f4 Home / customize` + `4s Miss + rethrow`; **do not "fix" them.**
   - Contrast-only pass: **LOWC 0**, 2,453 text shapes checked. Post-fix ratios **for the 130 changed findings only**: **min 4.52 · max 5.42** — those all clear AA 4.5:1. ⚠️ *This says nothing about the rest of the file — see item 8: 132 further text shapes were never in the `lowc` set and still sit below AA.*
   - 🔴 **BUT — see item 8. `lowc 0` does *not* mean "all text meets AA".** The audit's threshold is **`cr < 3.0`**, not 4.5, so it never flags the 3.0–4.5 band. A re-run of the *authoritative* function with the predicate widened to `cr>=3.0 && cr<4.5` found **136 shapes in the band; font-size triage confirms 132 are genuine AA-body failures** (only 4 are legitimately-large text).
   - Local `node design-system/contrast-check.js` → **21/21 pass, exit 0** (both `--only=tokens` and the full run).
   - PNGs exported for PM eyeball — one per swap type: `ZH · 8c 历史` · `EN · 8d Collection / empty` · `EN · 9d Daily gift / claimed` · `EN · 6 League`.
5. **Token layer extended** — **`--muted #A39D92`** + **`--muted-text #69655E`** added to `design-system/tokens.css`. The streak-calendar grey-beige had **no token at all**, living only as a raw hex in the design file — which is precisely why nothing caught it at 2.09:1. Pair registered in `contrast-check.js`; **tokens 34 → 36, checks 20/20 → 21/21**. Also fixed a stale in-file path comment in `tokens.css` (`prototype/tools/…` → `design-system/…`).
6. **🩹 Remaining SCRUM-45 scope = the responsive rules** (fluid type · `env(safe-area-inset-*)` · real breakpoints). That half belongs to the *real build's* CSS, not to Penpot, so it cannot be closed by design work alone.
7. **✅ Jira updated (MCP restored after a session reload):**
   - **`SCRUM-45` → In Progress** (4 of 6 acceptance criteria met — *not* Done), comment `10163`: applied swaps + census deltas, the re-audit numbers, the band finding, the tranche-2 table, and the tooling lessons.
   - **`SCRUM-42` (`10164`) + `SCRUM-33` (`10165`)** → commented that the **colour sign-off hold must be KEPT**.
   - ⚠️ **This reverses what was planned earlier today.** The original note said "release the colour hold once this lands." *Given the band finding, releasing it would have been actively wrong* — the palette is internally inconsistent, so those In Review boards need their second visual pass **after** tranche 2. Signing off colour now means signing off a palette that is about to change, and needing a third pass.
8. **🔴 NEW DEFECT FOUND during validation — the file is now INTERNALLY INCONSISTENT, and `lowc 0` is a false green.**
   The swap was driven by the audit's `lowc` findings, i.e. **only pairs below 3.0**. The *same* colours survive everywhere their backdrop differs enough to land ≥3.0 — so brand gold `#a8862a` is **still the foreground on 112 text shapes**, now sitting alongside the swapped `#7b621f` in the same semantic role. **The palette renders two different golds depending on backdrop.** Verified pairs (re-run of the authoritative function, predicate `cr>=3.0 && cr<4.5`, 135 boards / 10,042 shapes):

   | fg | bg | ratio | n | boards | sample | ready token |
   |---|---|---|---|---|---|---|
   | `#a8862a` | board `#f5f0e8` | **3.03** | **88** | 34 | `chip · points balance` — "Store Points 1,480" | `--gold-text #7B621F` |
   | `#a8862a` | `#fbf7ee` | 3.22 | 10 | 4 | `hist · week streak` — "🔥 12 天" | `--gold-text` |
   | `#fff8e8` | `#0e9b78` | 3.32 | 8 | 5 | `art · tier badge label` — "JADE" | `--disc-malachite #0C8265` |
   | `#a8862a` | `#f8f1dc` | 3.05 | 8 | 3 | `row 1 · rank` — "1" | `--gold-text` |
   | `#0e9b78` | `#fdf8e7` | 3.30 | 4 | 3 | `row 3 · weekly move` — "▲ 3 this week" | `--malachite-text #0A7359` |
   | `#fff8e8` | `#a8862a` | 3.25 | 4 | 3 | `row 5 · avatar glyph` — "吴" | `--disc-gold-deep #8B6F23` |
   | `#c23b22` | `#eae2d2` | 4.14 | 4 | 4 | `banner · wrong code (text)` | `--cinnabar-text #B73820` |
   | `#a8862a` | `#f5f0e8` | 3.03 | 4 | 4 | `sheet · row pts hint` | `--gold-text` |
   | `#a8862a` | board `#ffffff` | 3.44 | 2 | 1 | `divider · promotion line` | `--gold-text` |
   | `#c23b22` | board `#1b1613` | 3.37 | 2 | 2 | `logo · Joss` — "金纸" | ⚠️ see warning |
   | `#c23b22` | board `#121418` | 3.46 | 2 | 2 | `miss · glyph` — "✕" | ⚠️ see warning |

   > [!warning] FONT-SIZE TRIAGE COMPLETE — 132 of the 136 are GENUINE AA failures
   > Re-ran the authoritative function capturing `fontSize`/`fontWeight` and applying WCAG's large-text rule (≥24px, or ≥18.66px bold ⇒ bar is 3.0, else 4.5). Result (`storage.bandTriage`): **genuineFail 132 · largeOk 4 · unknown 0**.
   > - **Only 4 legitimately pass**, and they are *exactly* the two light-on-dark rows: `logo · Joss` "金纸" **40px/800** and `miss · glyph` "✕" **90px/700**. **These must NOT be darkened** — `--cinnabar-text #B73820` is darker and would make light-on-dark *worse*. They already clear the 3.0 large-text bar (and logotypes are WCAG-exempt anyway). **Leave them alone.**
   > - **132 are real body-text failures.** Note `row 1 · rank` "1" is **19px/400** — *not* large (needs ≥24px, or ≥18.66px **bold**), so it genuinely fails; an eyeball guess would have wrongly excused it.
   > - **Every one of the 132 has a machine-checked token ready** → tranche 2 is fully specified: `--gold-text #7B621F` **112** · `--disc-malachite #0C8265` **8** · `--malachite-text #0A7359` **4** · `--disc-gold-deep #8B6F23` **4** · `--cinnabar-text #B73820` **4** = **132**.

   Font sizes per genuine-failure group: `#a8862a`/board `#f5f0e8` **12/700** · `#a8862a`/`#fbf7ee` **14/700** · `#fff8e8`/`#0e9b78` **11/400** · `#a8862a`/`#f8f1dc` **19/400** · `#0e9b78`/`#fdf8e7` **11/400** · `#fff8e8`/`#a8862a` **16/700** · `#c23b22`/`#eae2d2` **11.5/400** · `#a8862a`/`#f5f0e8` **13/400** · `#a8862a`/board `#ffffff` **11/700**.

9. **✅ TRANCHE 2 APPLIED — 2026-09-29, PM said "apply now". All 132 genuine AA body-text failures cleared; `lowcAA 0` verified live.**
   - **Rollback saved first** — named Penpot version `SCRUM-45 pre-tranche-2 rollback (lowc 0 / 132 AA fails open)` at `revn 226`. Post-fix version `SCRUM-45 tranche-2 canonical · AA body 0 · tokens.css-aligned` at **`revn 229`**.
   - **120 distinct shape edits = 112 text + 8 discs**, clearing all 132 findings. **47 boards** visibly changed (not the 34 the plan estimated). Finding count ≠ shape count: nested boards surface some shapes twice, and the plan's `--disc-malachite 8` / `--disc-gold-deep 4` were *finding* counts — the real distinct discs are **6 + 2 = 8**.
   - 🔴 **CAUGHT IN VERIFICATION — 4 of the 5 token values in the item-8 plan were WRONG.** They were hand-carried into the notes and contradicted `design-system/tokens.css` (which this doc already quoted correctly in the design-tokens section). Applied first, then corrected:

     | token | plan/notes (wrong) | canonical `tokens.css` | shapes re-fixed |
     |---|---|---|---|
     | `--gold-text` | `#7b621f` | `#7B621F` ✓ already right | — |
     | `--malachite-text` | `#07604a` | **`#0A7359`** | 2 |
     | `--cinnabar-text` | `#8d2b18` | **`#B73820`** | 4 |
     | `--disc-gold-deep` | `#7b621f` | **`#8B6F23`** | 2 |
     | `--disc-malachite` | `#07604a` | **`#0C8265`** | 6 |

     All four wrong values *did* clear 4.5 (5.50–7.14) but were **darker than necessary** and reintroduced exactly the Penpot↔`tokens.css` drift that caused this tranche. **14 shapes** re-applied to canonical; canonical ratios **4.51–5.82**, all ≥4.5. **Lesson: read hex from `tokens.css`, never retype it from a note.**
   - **Verified post-fix, live** (`storage.auditV4`): boards 135 · scanned 10,042 · textChecked 2,453 · **`clip 0 · occl 14 · lowc 0 · lowcAA 0 · largeLow 0`**. `occl` **byte-identical to baseline** (fills only changed). File-wide ratio range **3.37–18.51** — the 3.37 floor is `logo · Joss`, a legitimate large-text pass, **not** a defect.
   - **The 4 protected shapes were NOT touched** — re-read *after* the edit: `logo · Joss` (40/800, `EN/ZH · 0 Splash`) and `miss · glyph` (90/700, `EN/ZH · 4s`) all still `#c23b22`. ✅
   - **Palette now internally consistent** — text-role census: **`#a8862a` 0 · `#0e9b78` 0** residual; `#7b621f` 190 · `#0a7359` 2 · `#b73820` 4. Discs: `#8b6f23` 2 · `#0c8265` 6. **0 residual over-dark values anywhere.** `#c23b22` remains on 29 text shapes — legitimate (25 pass AA + the 4 large passes). Decorative `#a8862a` (234) / `#0e9b78` (50) *fills* also remain and are correct: brand values are for fills, not text.
   - `design-system/contrast-check.js` still **21/21** ✅. **0 Penpot token bindings lost** (no target shape had one) · 0 fill-drift mismatches · 0 verify failures.
   - **Tooling fixed:** `penpot-sweeps/occlusion-contrast-audit-v3.js` now carries a **`runAudit4`** with a `lowcAA` (4.5, non-large) bucket + `largeLow` (large text under 3.0). `runAudit3` left untouched for baseline diffing. A passing sweep is now `clip 0 · occl 14 · lowc 0 · lowcAA 0 · largeLow 0`. ⚠️ while inserting it, two comment blocks were spliced wrong (block A lost its closer, which silently commented out `runAudit4`); repaired and proven by `node --check` + a `typeof` check that both functions are really defined. **Verify comment-delimiter balance after any line-number insert into this file.**

**⚠️ Status after tranche 2 — what is and is not closed.**

1. ~~**🔴 The real remaining failure set is 132 text shapes below AA 4.5:1**~~ → **✅ CLOSED by tranche 2 (item 9). `lowcAA 0`, verified live over 2,453 text shapes.**
2. ~~**🔴 The palette is internally inconsistent — `#a8862a` and `#7b621f` in the same semantic role**~~ → **✅ CLOSED. Text-role census now reads `#a8862a` 0 · `#0e9b78` 0.** Decorative brand *fills* remain (234 / 50) and are correct — brand values are for fills, not text.
3. ~~**Fix the audit tooling**~~ → **✅ DONE. `runAudit4` added to `penpot-sweeps/occlusion-contrast-audit-v3.js` with a `lowcAA` (<4.5, non-large) bucket plus `largeLow`; `runAudit3` kept untouched for baseline diffing. A passing sweep is now `clip 0 · occl 14 · lowc 0 · lowcAA 0 · largeLow 0`.**
4. ~~**Tranche 2 is fully specified**~~ → **✅ APPLIED — but the specification was partly wrong.** 4 of the 5 token hexes in the *prose* plan were hand-carried and did not match `design-system/tokens.css`; they were caught in verification and re-applied (item 9). Note the item-8 table's "ready token" column was already correct — only the separate prose plan had drifted. **Read hex from `tokens.css`, never from a note.**
5. **✅ HONOURED — the 4 legitimate large-text passes were not darkened.** Re-read *after* the edit: `logo · Joss` "金纸" 40px/800 and `miss · glyph` "✕" 90px/700 are all still `#c23b22`.
6. **🔴 STILL OPEN — do NOT close `SCRUM-45`.** The **responsive/safe-area criterion** (fluid type · `env(safe-area-inset-*)` · real breakpoints) is untouched and belongs to the real build's CSS, not Penpot. The colour half is now genuinely complete; the responsive half is not.
7. ~~**Do not apply tranche 2 without the PM's visual call**~~ → **✅ The call was given ("apply now") and tranche 2 is applied.** 47 boards changed visibly.
8. **🟡 NEW — a PM visual review of the 47 changed boards is still owed.** Only after it should the colour hold on `SCRUM-42`/`SCRUM-33` be reassessed. **The hold stays for now.**

**Next: 🟡 PM VISUAL REVIEW of the 47 tranche-2 boards → then reassess the colour hold on `SCRUM-42`/`SCRUM-33` → and close `SCRUM-45`'s remaining responsive/safe-area criterion in the real build's CSS. ✅ Colour/contrast is DONE and verified: `clip 0 · occl 14 · lowc 0 · lowcAA 0 · largeLow 0` · `contrast-check.js` 21/21 · Penpot `revn 229` (pre-tranche rollback `revn 226`). ⚠️ `SCRUM-45` is still NOT closeable — responsive work outstanding.**

#### 🔧 Session 20 (2026-09-28, cont.) — full-file Penpot sweep → accessible token system handed off (`design-system/`)
**Trigger:** PM — the Penpot file *is* the real product, so sweep all of it (not just the tutorial page), and build a proper accessibility/token system rather than leaving the checks stranded in the prototype.
1. **🔒 Source of truth settled (PM decision): Penpot governs. `prototype/` is RETIRED** — kept as historical evidence of what the real build must not repeat; *not* a migration target. The prototype's passing chevron no longer excuses Penpot's failing one.
2. **Accessibility sweep of the Penpot UI run** — `penpot-sweeps/occlusion-contrast-audit-v3.js`, read-only over **135 boards / 10,042 shapes** on page *New-user tutorial · Core loop*. *(Both counts are correct — they measure different things. **131** = top-level boards, what the build log and the PM see. The audit's **135** = those 131 **+ 4 nested boards**, because it enumerates with `page.findShapes({type:"board"})` and filters out the page's Root Frame (136 → 135). Verified live 2026-09-29: 131 top-level · 135 recursive · 10,465 total nodes, of which the audit scans 10,042 leaves. **Neither file needs "correcting".**)* (v3 measures `shape.textBounds` and walks true paint order; the earlier geometry-only `icon-occlusion-audit.js` produced almost all false positives — it measured text by its *layout* box and only compared siblings. **Use v3.**) Results: **0 clipping defects** · the **14 occlusion alarms are intentional** background-swatch previews on `1f3/1f4 Home / customize` (do not "fix") · the **"first tab obscured" defect was real and is fixed** (z-order only, 6 ancestor sheets) · **130 low-contrast findings across 47 boards, traced to just 4 colour tokens**. Findings → [[follow-up-items]].
3. **Accessible token layer + contrast guard moved out of the retired prototype → `design-system/`:**
   - `design-system/tokens.css` — 36 tokens, split by *role*: `--<colour>` = brand/decorative, `--<colour>-text` = verified ≥4.5:1 on all five creams, `--disc-<colour>` = darkened fill so the cream glyph never changes
   - `design-system/contrast-check.js` — dependency-free WCAG checker + CSS lint; **tokens 21/21 pass**
   - ⚠️ the on-disk checker was found **broken** (pointed at nonexistent root-level `tokens.css`/`styles.css`); path resolution fixed, lint re-aimed at the *future build* stylesheet, and it now **loudly reports `skipped`** when no build CSS exists — no false green
4. **Jira: `SCRUM-45` opened** — ♿ accessibility remediation (the 4 Penpot token swaps + responsive rules), with the full audited table and acceptance criteria. Comments added to **`SCRUM-42`** and **`SCRUM-33`** recommending the *colour* sign-off be held until SCRUM-45 lands.
   - ⚠️ **the ticket and both comments were first filed with wrong ratios** taken from a verbal summary (`#8B2F27`/`#2F5D55` on cream were listed as failures; they actually **pass** at 7.56 AAA / 6.80 AA). All three were **corrected in place** against the audit script + an independent recompute. **Lesson: quote the audit script's output, never a recalled summary.**
5. **⚠️ Blocked:** the Penpot MCP/plugin connection — required to apply the palette fixes and re-run the sweep.
**→ RESOLVED in Session 21 (2026-09-29): connection restored, all 4 swaps applied, re-audit returned `clip 0 · occl 14 · lowc 0`. ⚠️ But that is *not* AA compliance — the same session found 132 further AA body-text failures outside the `lowc` set (see the Session 21 entry above, item 8). The blocker is cleared; the accessibility work is not.**

#### 🔧 Session 20 (2026-09-28) — Sprint 0 design remainder built (→ 131 boards) + Daily Gift boards repaired
**Trigger:** PM — complete the Sprint 0 design tickets, then a whole-file review; during that pass the Daily Gift boards (`EN/ZH · 9c/9d`) were found broken.
1. **Sprint 0 design remainder built** — the remaining design tickets (onboarding panels · offerings picker · profile/settings/history · language completion · state pass · catalogue · item detail) built + wired in **both rows**; **Penpot 87 → 131 boards** (EN + ZH); the **EN|中文 language pill removed** per PM; all 7 design tickets → **In Review** alongside `SCRUM-42`.
2. **🔧 Daily Gift repair — `EN/ZH · 9c/9d` (4 boards), diagnosed then rebuilt:**
   - **Clone debris from shop board `9` deleted** (13 shapes/board — 4 bundle arts · 7 price pills · 2 orphan featured pills)
   - **Stranded elements restored** to the intended bottom rhythm — streak **y560** · Claim **y640** · footer note **y700**
   - **Featured card 300 → 190 tall** (its empty lower band is now the calendar); **value line widened 180 → 330** — the copy (*100 store points + 150 credits = 1 free photo*) was **clipped** in a fixed 180px box at 12px
   - **7-day streak calendar added** (y408–496 · 7 × 42×88 pills): d1–d2 ✓ · **d3 = today** (matches the `DAY 3` tag — `TODAY`/`今天`, cinnabar outline) · d4–7 muted future; on `9d` d3 shows ✓ (claimed)
   - **Switcher fixed** — active segment moved to the **right** half (x197), both labels restored (`Credits | Daily gift` / `点数 | 每日礼包`), active label cream, inactive one wired back to the shop board
   - **Interactions verified** — `9c` Claim (bg + label) → `9d` · Back → `9` · switcher → `9`; `9d` carries no Claim action (claimed state), no self-navigation debris left
   - **Audit green on all four**: 39 children each, nothing outside the 390×844 frame, no unintended overlaps, PNG exports pulled for eyeball
   - ⚠️ two self-inflicted bugs caught by the audit and fixed: the debris rule deleted EN 9c's *already-moved* Claim bg (re-cloned from ZH 9c, interaction restored, z-order under the label), and future days initially received a ✓ label (removed)
3. **⚠️ Penpot plugin cannot save named versions** — the plugin API exposes undo blocks only (`history.undoBlockBegin/Finish`); **the PM must save the named version in the UI** (File → Version history) before any tab reload.
**Next: PM whole-file review of the 131 boards → then `SCRUM-42` + the 7 Sprint 0 design tickets → Done.**


#### ✅ Session 19 (2026-09-27) — SCRUM-10 chain closed (integrity · privacy · NFRs) + 24 boards built
**Trigger:** PM — refresh context, continue the tech stack/architecture; then security + legal/IP scoping; then PDPA/GDPR note-down; then low-end/rural NFRs; then *"edit the wireframes before repo+CI"*.
1. **SCRUM-21 integrity ✅ Done** — [[AppDesignConceptBoard/11-integrity-posture]]: trust matrix (client asserts **`accuracy` only** — **band derived server-side**), caps **1,650/burn · 49,500/day · 346,500/week impossible-line**, rate limits (6/min), `integrity_flags` **log-only at alpha**, corrections = compensating adjustments; **ADR-005 accepted**; 07 → v2.4. Repo scanned: **no secrets anywhere** ✅.
2. **Security & legal/IP scoping** — [[AppDesignConceptBoard/12-security-and-legal-scoping]]: S1–S11 security requirements · fal.ai **grants no output IP** + we indemnify + no-train (primary source) · **Play AI-Gen policy in scope** (moderation gate = S5) · asset licences clean · **🚨 §B.7 Play Billing ~15% vs the $1.19 floor → SCRUM-43 filed** · trademark/ToS/model-terms long-tail; later expanded with **§B.5 PDPA (baseline) + GDPR (design target)**: obligations table (30d/3d vs 72h clocks · **Art. 9 religious-belief data** · Recital 27 deceased out of scope) + **D1–D10 design considerations**.
3. **SCRUM-19 privacy ✅ Done** — [[AppDesignConceptBoard/13-privacy-and-retention]]: PII inventory (12 classes) · **retention windows (raw photo purged 7 days post-job)** · consent copy **N1–N6 EN/ZH** for 40–50s readers · moderation posture · **delete-all: league points vanish, cohort tombstoned, `integrity_flags` survives 90d pseudonymous** · 10-step deletion runbook (0-row probe = success); **ADR-007 accepted**; 07 → v2.5; §5 ZH copy converted **traditional → simplified** (v1.1).
4. **SCRUM-20 NFRs ✅ Done** (PM: low-end/rural-first) — [[AppDesignConceptBoard/14-nfr-device-and-performance-targets]]: **Tier F floor = 3GB / Android 11 / Android-Go class** (Statcounter Aug 26: ≤A11 ≈ 19%) · N1–N12 targets (cold start ≤5s · **30fps floor / 60 mid, aim bands = acceptance** · p95 AI ≤30s · **cross-day offline queue → 07 Q1 answered** · 200 kbps network floor · install ≤40MB incl. **CJK-subset rule**) · **floor-device shortlist (PM buys, ~S$100–150)**; 07 → v2.6.
5. **Design block** — **SCRUM-44 ✅ Done**: `0b3` privacy notice ×2 (0b2's 7 exits rerouted through it) · `1s3` ritual-data consent ×2 (gates *Place on altar*) · **N2 footnotes on the signed-off Capture boards**. **SCRUM-42 → In Review**: 14 economy boards — `9` cash shop (featured 1,000 @ $1.55, tiers *price TBD*) · `9b` IAP confirm · `9c/9d` daily gift · `2b/2c/2d` + `3b/3c` quota states (spec §4 verbatim) · `5b` ad card (Reward's *Return* rerouted through it) · credits chips on Captures; geometry + wiring audits green — **Penpot 63 → 87 boards**.
6. **Jira:** 21/19/20/44 → **Done** · 42 → **In Review** · 43 **filed** · SCRUM-33 scope comment (privacy hub).
**Spend: none. ⚠️ PM: Review queue (top of file) · save named Penpot version. Next: repo + CI milestone (S1 secrets · S2 RLS CI check · S6 npm audit · floor-device harness) → milestones.**


#### ✅ Session 18 (2026-09-26, cont.) — SCRUM-10: Path C probed, evaluated & ADR-002 ACCEPTED
**Trigger:** PM proposed **Path C** after the edit-recipe lock — identify objects via machine vision (≤3, with characteristics) → **generate the cartoon from blank** instead of editing the photo.

1. **Path C probe:** `moondream2/visual-query` identify (S01 matched PM's expected attrs `["blue","sedan","4 doors"]` exactly) → `nano-banana-2` **t2i** from characteristics + style tokens on blank rice-paper bg — clean background by construction, 2 calls ≈ $0.09/picture, ~12.6s (vs edit path 4 calls ≈ $0.087, ~14.5s)
2. **PM prompt iterations → v3 template:** *top-down lighting shader* (wireframe has bottom shadows → light from above) · *source-exact colours* (v1 invented a car colour) · *transparent glass*; identify prompt must carry **no example colours** (the "denim blue metallic" example leaked into 5 answers incl. a rice cooker)
3. **Wider probe: all 12 remaining Track-A inputs** (32 runs) — generation 12/12 clean; extraction issues surfaced: example-colour leak (fixed) · **S05 notebook missed 4×** (targeted probe recovered) · duplicate objects · schema drift. **Seedream comparison:** Path C + seedream t2i = cheapest ($0.05/pic) but keeps the 34s wall → **nano-2 stays**
4. **Outputs reorganized → `spike/results/path-C/`** (13 finals + `iterations/` + **EVALUATION.md** scorecard) · PM scored: 11 pass first round, fails = S02 colours · S07 extra shoe · S09 missing bowl
5. **Correction loop validated** (extract → validate → targeted re-probe → regenerate): S02 dark-grey fix ✅ · S09 white-bowl fix ✅ · S07 needed 3 attempts (count flipped **both ways** — VLM counts unreliable → majority-vote rule) → **13/13 after retries**
6. **🏆 PM VERDICT: "PATH C is the way forward"** — failure rate (3/13, 23% needing ≥1 retry) *"acceptable for now, work on it as we go along"* → **[[AppDesignConceptBoard/ADRs/ADR-002-path-c-describe-then-generate|ADR-002]] written & ✅ ACCEPTED** (Path C pipeline · v3 template normative · Track B closed-set mandatory · validation + correction loop part of the design · edit recipe = documented fallback; register updated)
7. **Docs:** [[AppDesignConceptBoard/07-system-architecture]] → **v2.2** (§4.2 = Path C pipeline, diagram + service map refreshed) · [[spike/results/RESULTS]] §5b verdict + rounds 7–9 · spend **133 runs ≈ US$4.49 of $20** · SCRUM-10 comments **10100–10103** (+ decision comment)
8. **Economy thread (same session, quick check → LOCKED):** [[AppDesignConceptBoard/09-economy-quick-check]] written — ad benchmarks vs Path-C costs, break-even identity (`photo burns/DAU ≤ ARPDAU÷$0.09`, ads = subsidy not funding) → **PM direction: points-gated photos** (2,000 starter · 150/photo · cash shop) → back-calc: break-even **$0.78 marginal / $1.19 fully-loaded per 1,000** → **PM: +30% worst-case margin → 🔒 $1.55/1,000 credits LOCKED** plus sign-in grants (100 store pts + 150 credits = 1 free photo/day, 15/mo cap), ad-gated bonus photo replaces a 2nd free photo, wallet invariant (photo_credits ≠ tribute ≠ store), charge-at-capture, quota backstop; seasonal loyalty deferred (grants only) · SCRUM-18 comments **10105–10109** · **formal economy spec still to write from these locked inputs**
9. **SCRUM-18 ✅ DONE + SCRUM-41 reconciled to final (same session):** [[AppDesignConceptBoard/10-economy-spec]] written — all 6 ticket questions closed (measured costs · quota rule 10 photo/20 store daily caps + EN/中文 "out of offerings" UX copy + backend pseudocode · post-ritual ads · reward formula holds via wallet invariant · $0.01 store-burn path · ceilings: $3.64/user/month grant worst-case + **global daily AI budget stop-rule → queue**) → SCRUM-18 **transitioned Done** (comment 10110) · **project-costs.md reconciled to spike final: US$4.49/133 runs = est S$5.73, first-month total ≈S$8.44, under US$20 cap** · production rows locked (Path C $0.09–0.13/photo; bg-removal row superseded) · SCRUM-41 comment 10111 — *stays In Progress only for the external fal-invoice Mastercard-rate swap (due 2026-10-06)* · [[AppDesignConceptBoard/07-system-architecture]] → **v2.3** (three currencies)
10. **Next:** integrity one-pager (SCRUM-21) → privacy posture (SCRUM-19) → NFRs (SCRUM-20) → repo + CI · ADR-006/008 from economy spec · fal invoice lands → close SCRUM-41 · stragglers: S13 portrait sign-off · S16 low-light confirmation · U02 laptop photo (all PM-blocked)

#### ✅ Session 17 (2026-09-26) — SCRUM-10: system diagram + data model
**Direction (stakeholder):** services & schema first — draw the boundaries and tables before naming libraries.

1. **[[AppDesignConceptBoard/07-system-architecture]] drafted (v1)** — system diagram + **11 service boundaries** (App client · Supabase Auth/Postgres/Storage/Edge Fns/Realtime · hosted AI · ads · analytics; rule: *client asserts, server decides* — only `award-service` writes ledger rows), the **capture → cartoonize → burn → award → league API sketch** (RPC names, idempotency keys so the offline queue replays safely, the receipt that carries the hidden "New ground bonus" line, cron `weekly-roll`), and the **data model**: ~20 tables + `balances` view — append-only **2-currency ledger** (tribute/store), `quotas` = burn limits = AI-cost control, coarse **~4-block grid cells with no location trails**, cohorts/weekly rolls (Duolingo-style), 6-slot decoration equip with the one-set-per-category rule, Book of Tributes
2. **7 open questions routed** → SCRUM-18 (quota/cost ceiling) · SCRUM-19 (retention) · SCRUM-20 (offline-queue NFR) · SCRUM-21 (trust vs recompute) · SCRUM-22 (ancestor addressing) · SCRUM-11 (cohort shape) · SCRUM-41 (provider spike = where `cost_micros`/`latency_ms` get real numbers)
3. Indexed in the concept-board README (07 row added) · **progress comment posted on SCRUM-10**
4. **ADR-001 written & ✅ ACCEPTED — Option A is LOCKED**: Expo/RN (TS) + Supabase + hosted AI day one · Android-first · iOS later with zero code change · non-AR-AR MVP → [[AppDesignConceptBoard/ADRs/ADR-001-option-a-expo-rn-supabase-hosted-ai]]; the **ADR register** opened at [[AppDesignConceptBoard/ADRs/README]] (gap-analysis §6's 9 decisions → 8 ADRs, mapping inside; rejected Flutter/PWA/Unity/native/Firebase/self-host all recorded)
5. **07 streamlined to v2** — hedging removed, status = authoritative service map + schema for the locked stack; [[AppDesignConceptBoard/06-tech-stack-options]] status flipped to "decided"
6. **fal.ai MCP connected + spike survey done (free/read-only)** → [[AppDesignConceptBoard/08-style-d-spike-plan]] — 15 endpoints priced across the pipeline (bg removal $0.0008/s–0.016/img · stylize $0.04–0.15/img · image→3D probes $0.015–0.05); two paths mapped (A = 2D img2img incl. cartoonify + LoRA, B = image→3D→render, which `recommend_model` actually ranked first); budget math: ~120 generations ≈ US$6–19, cheap endpoints first, hard stop US$20; **ready to run**
7. **Spike inputs built + PM-reviewed** → [[spike/test-images/MANIFEST]] (link: `spike/test-images/MANIFEST.md`) — 16-slot taxonomy (G1 split into **5 ritual-tradition sub-groups** per PM: replica-tradition/daily-carry/wealth/wearables/home), 15 licence-clean Wikimedia files sourced, visually QC'd, normalised (≤1536 px, EXIF off), **MD5-hashed**; PM review (2 rounds) → **S04–S07 + S15 replaced** (too clean → in-context shots; **2 standing criteria added: in-the-wild bg + single object in focus**) and **S10/S11 → Track B: identify-only, no stylize** (they're store offerings → recognition path returns the standard painted asset — a pipeline short-circuit now recorded in [[AppDesignConceptBoard/07-system-architecture]] §4.2 + open question 8); S13 portrait still pending sign-off; tiered run = 48 runs ≈ US$2–8
8. **🟢 Style-D spike EXECUTED end-to-end — 86 runs ≈ US$2.63 of the US$20 cap** → [[spike/results/RESULTS.md]] (cost table §1 · **§1b cost-per-picture** · latency §2 · **all 77 outputs reorganized by engine → `spike/results/by-engine/`** — cartoonify 4 · image-editing-cartoonify 4 · flux-kontext 4 · seedream-v4.5 6 · nano-banana-2 19 · birefnet 27 · lighting-filter-local 13 · Track B PASS-with-closed-set · Path B reserve)
9. **Six PM decision rounds → recipe LOCKED (round 6):** seedream won fidelity but **lost on latency** (platform p50 34.2s vs the 3–10s ritual assumption → nano-2's 11.8s); **lighting-normalisation filter** spec'd then made **aggressive** (`spike/scripts/lighting_filter.py` — validated to 0.08/255 against the original; preset `--radius-div 96 --knee 0.45 --knee-strength 0.5`) which fixed subject isolation (U01 IoU 0.54 → 0.744; S01 0.961; Tier-2 7/9 ≥ 0.71 — S12/S16 weak = scene inputs as PM predicted); **prompt v3** (colour + anatomy + detail clauses); **stage ④ Heavy re-cut** mandatory because the stylizer regenerates a background; PM approved the **polygon level as good-enough-for-this-stage (non-blocker)** → **FROZEN: ① birefnet Light → ② aggressive lighting filter ($0 local) → ③ `nano-banana-2/edit` + prompt v3 → ④ birefnet Heavy re-cut ≈ US$0.087/picture**; Track B verdict: **closed-set catalogue ID mandatory** (zero-shot VLM misread joss paper as "packaged snacks"; moondream2 ≈$0.01/query)
10. **Docs carried forward same day:** [[AppDesignConceptBoard/07-system-architecture]] → **v2.1** (§4.2 = the 4-stage pipeline, diagram refreshed, open Q7/Q8 annotated spike-answered) · spike spend logged → [[project-costs]] (**SCRUM-41 → In Progress**, est. **S$3.36** @1.2771 ⚠ placeholder) · SCRUM-10 progress comments **10088–10098** (wrap = 10098) · **next: PM rubric-scores the 13 Track-A outputs (≥8/13 gate) → draft ADR-002**

**🏁 END OF DAY 2026-09-26 (Session 17 wrapped) — Next session:** 🟢 **spike EXECUTED & RECIPE LOCKED (round 6 — PM: polygon level approved, non-blocker)** → [[spike/results/RESULTS.md]] (**all 77 outputs reorganized by engine → `spike/results/by-engine/{engine}/`** — Tier-1 20 + iter-2/U01 tuning + **Tier 2: 9 inputs, 7/9 IoU ≥ 0.71, S12/S16 weak = scene inputs as PM predicted**; **≈US$2.63 / 86 runs of the US$20 cap**) — **FROZEN style-D pipeline: ① birefnet Light → ② aggressive lighting filter (`spike/scripts/lighting_filter.py --radius-div 96 --knee 0.45 --knee-strength 0.5`, local $0) → ③ `nano-banana-2/edit` + prompt v3 → ④ birefnet Heavy re-cut ≈ US$0.087/picture** (seedream rejected on latency p50 34.2s vs 11.8s); key findings: **closed-set catalogue ID mandatory** (zero-shot VLM misread joss paper as "packaged snacks"; moondream2 ≈$0.01/query); **stylizer regenerates a background → stage ④ mandatory**; `cartoonify` hit 58s; Path B image→3D $0.015/mesh stays reserve · **NEXT: PM rubric-scores all 13 Track-A outputs (≥8/13 gate) → draft ADR-002** (provider + cost/latency + closed-set ID); **spend logged** in `project-costs.md` (SCRUM-41, est. S$3.36) ✅; [[AppDesignConceptBoard/07-system-architecture]] **v2.1 — §4.2 now carries the 4-stage pipeline** · **pending: S13 portrait sign-off · S16 low-light confirmation · U02 laptop photo** → economy spec (SCRUM-18)

#### ✅ Session 16 (2026-09-25) — SCRUM-10: tech-stack research & decisions
**Trigger:** stakeholder kick-off of the architecture ticket with hard limits (**Fedora 44** dev platform · **Cline**-friendly tooling), soft limit (**cost low**), and the pipeline requirement (bg removal → object ID → cartoonize to **style D**).

1. **Constraints pinned on SCRUM-10** (Jira) and researched: framework landscape (2026 deep-dive) · iOS-without-Mac paths (EAS Free = 15 iOS builds/mo, Codemagic 500 min/mo, Apple $99/yr) · bg-removal (rembg free vs ~$12.99/mo APIs) · cartoonization ($0.001–0.04/image) · CI free tiers
2. **Options written up** → [[AppDesignConceptBoard/06-tech-stack-options]] — **A Expo/RN** · B Flutter · C PWA · D Unity (reserve), with a comparison matrix, the AI-pipeline breakdown, and all sources; indexed in the concept-board README
3. **All four selection questions decided**: **Option A (Expo/React Native) leaned** · **iOS OUT of MVP** (platform must support it later — Expo adds it with zero code change) · **style-D fidelity spike APPROVED at US$10–20** · **hosted APIs from day one** (stakeholder: *"make sure deployment is fine from day 1"* — no GPU capex)
4. **AR-wrapper concern closed** — `@sceneview-sdk/react-native` is self-described **alpha** (bridges expose ~5–10% of the Android API, issue #909; iOS bridge not linked/run in CI) → **non-blocking**: the MVP is *non-AR AR* (camera + overlay, no wrapper), Android AR is the functional path, 4 exit ramps documented (SceneView Android → Scene Viewer intent → @reactvision/react-viro → bounded Kotlin module)
5. **Cost tracking created** → [[project-costs]] — SGD-only with the **Mastercard-rate conversion rule pinned for future AI**; **ClinePass US$2.12 this month = S$2.71** logged (rate 1.2771 ⚠ placeholder), **next charge 2026-10-22**; billing calendar + roll-forward instructions on the page
6. **Dated Jira action items** so the next AI can act on billing dates: **SCRUM-39** (due 22 Oct) · **SCRUM-40** (22 Nov) · **SCRUM-41** (log spike spend, due 2026-10-06)
7. **Circleback MCP added** — connectivity verified (3 probes OK, no errors) but workspace empty (no meetings/tags/profiles yet) and **read-only**: it cannot create calendar events or action items → billing reminders live in Jira + [[project-costs]] instead

#### ✅ Session 15 (2026-09-25) — the auth block: login + create account
**Trigger:** continue the Sprint 0 design remainder (boot screens).

1. **SCRUM-28 Login** — 10 boards (`0c`…`0c5`, EN/ZH) at x −800, fully wired; title per PM = **"Sign in or register new account"** / 登录或注册新账号; QA: 28 white-on-light recolors, 96 forced reflows, 4 stale-glyph titles recreated → **Done**
2. **SCRUM-29 Create account** — 10 boards (`0d`…`0d5`, EN/ZH) at x −320, wired end-to-end **Splash → Login → Sign-up → 0d3 → ancestor sheet → first-run Home** (also wired the ancestor sheet's orphan Place button); decisions note on-canvas (comment API timed out ×3) → **Done**
3. **Board count → 63**; board fixes: SCRUM-6 + SCRUM-9 closed, SCRUM-17…25 added to Sprint 0 (21 issues); sprint field quirk = bare scalar `2`
4. **Tool learnings**: stale-glyph bug (recreate via `createText`, don't edit `characters`), period-probe staleness detection, ZH boards use localized CTA names, `growType` auto-height → fixed layout recipe

#### ✅ Session 14 (2026-09-25) — the boot flow: onboarding, permissions, first-run Home
**Trigger:** continuing the app frame — the first-run experience (SCRUM-27) and the hand-off into the altar.

1. **Onboarding** (`EN/ZH · 0b`) — panel 1 of 3: a triptych **buried → burned → now** (a burial mound, its doorway honoured, a gold bar at its base · the joss-paper stack · the phone carrying the shrine glyph), captions, the headline *“Three thousand years, one intention.”* / 三千年的心意，未曾改变。, dots, **Skip**, **Next** — the Splash's glow, lanterns and wordmark carried over so the boot reads as one moment
2. **Permissions** (`EN/ZH · 0b2`) — **Camera** and **Location** as cards, each with its own **Allow** pill, a **Continue** + **Not now**, and the denied-pathway promise (“the ask returns the first time it is needed”)
3. **First-run Home** (`EN/ZH · 1a`) — a gold halo + dashed ring around the empty altar slot and the callout pill **“Start here — place your first tablet”** / 从这里开始 — 安放第一座牌位
4. **The first-run loop is closed** — Splash → Onboarding → Permissions → first-run Home → ＋ → the ancestor sheet → Place → the altar with a tablet; Skip / Not now land on Home (every interaction walked)
5. **Layout** — the boot row reads in flow order: Splash −2240 · Onboarding −1760 · Permissions −1280; the Home column gained the `1a` pair at its top (the four existing state pairs shifted one row-pair down)
6. **Tool notes** — the mound / arrow / camera / pin icons joined `storage.ART`; a cloned button label smuggled its parent's link again (`继续` kept “→ Capture”) — the wiring audit caught it before the version save
7. **Fix pass (14b)** — the boot boards no longer inherit the Splash's dark (`#1b1613` + vignette): they sit on **paper** with the gold glow, so only the Splash is dark; the triptych was re-laid on the art's *ink* — one ground line (was 259/268/271), captions on true centres (the mound 8 px and the phone 10 px off), even 44 px gaps, arrows on the row's optical middle, dots centred, and the mound cleared the left lantern
8. **The app mark (14c)** — the lanterns are gone from the Splash and Onboarding; in their place a new mark: **AR framing brackets over the joss sheet** (bright gold, the cinnabar-framed foil square, embers rising) — Splash: above the wordmark in cream-on-dark; Onboarding: top-centre 76 px ink-on-paper; plus a new spec board `ICON · app mark + tile` (tile variants paper · cinnabar · ink and the 64/32/24 px ladder with a launcher preview)
9. **Header mark (14d)** — the last lanterns (on `0b2`, both rows) are gone; the **"Joss / Paper AR / JOSS PAPER AR" labels are replaced by the 44 px simplified mark** on all 12 Home-family boards (the secondary screens keep their back-button + screen-title header) — the header is now language-neutral: one less translated string per row
10. **Align + space pass (14e)** — the header mark's box is **solved from its own ink** so **44 px of ink sits at (20, 54)** — exactly the page margin, exactly the settings button (it had been indented 4 px and 37 px small); the no-embers variant was re-centred (square sheet, concentric foil). And the **nameplate plaque above the tablet is removed** from all Home-family boards: `art · shrine base (plaque · table)` → `art · shrine base (table)`, the space (y 206–248) left open and **reserved for purchasable customizations**
11. **Home layout (14f)** — the **league card is gone**: the position is a **9 px gold-deep subtext (#4) under the League tab label** (y 824); **"Make an Offering" dropped to y 620**; and a **reserved customization band** (dashed, 350×57 at y 696 — the card's old footprint) labelled *Customization space · decorations & point exchanges* / 自定义空间 · 装饰与积分兑换 so purchases / point exchanges have a home from the start
12. **Home layout, settled (14g)** — review correction: the CTA goes to the **bottom of the page** (y 676, 22 px above the dock) and the band is **removed** — customization isn't a strip. Instead **the whole temple scene is the customization zone** (dashed 14, 206 → 362×450, drawn behind the art, labelled *Everything here is customizable* / 此处一切皆可自定义): in the product every piece inside is replaceable — backdrop/niche · frame · table · offerings · nameplate · tablet finish
13. **The decoration store (14h)** — the store gained an **Offerings | Decorations** switcher (content shifted 46 px) and **`EN/ZH · 7b`** opened with traditional pieces: **春联 · 鍾馗像 · 门神 · 灯笼** plus the **新春套装** (the four composed, featured $3.99 / 3,000 pts), priced cash + points with *Decoration · permanent* metas — a **points sink** (no base-value rule). **SCRUM-36** filed for the customization system itself: equipping flow, per-piece slots vs whole-zone, catalogue expansions (福字 · 中国结 · 剪纸 · 香炉 · 长明灯 · 盆景 · 貔貅 totems · seasonal sets)
14. **Decorated Home mockups (14i)** — `EN/ZH · 1d` (横批 + couplets + lanterns) and `1e` (the full 新春套装: adds 鍾馗像 + the 门神 pair) show the temple dressed; the **placement scheme** is the first proposal for the equipping rules (横批 above the tablet · couplet per flank · lanterns hanging at the zone top · Zhong Kui top-centre · door gods at the lower flanks). Single-piece art builders were added so pieces mix: `decorCoupletV` · `decorCoupletH` · `decorLantern` · `decorDoorGodV`
15. **The slot system (14j)** — review decision: decorations are **categorised into top / side / background** and the zone holds **6 slots** — top-left 66×66 · top-middle 154×46 · top-right 66×66 · side-left 46×160 · **background 190×320 behind the tablet** · side-right 46×160. New board `EN/ZH · 1f Home / customize · 6 slots` (the customize surface: dashed grid + category labels + *Tap a slot to place a decoration* / 轻点格子，安放装饰); `1d`/`1e` rebuilt so pieces sit in their slots (the 鍾馗像 on a layer **behind** the tablet). Open question flagged: **春联 and 门神 are both side items** → alternatives; 门神 could move to the *top* category if both should be wearable. (The tab suspension also reset the plugin `storage` — helpers + the decor builders were re-seeded.)
16. **One set per category (14k)** — the rule from review: overlapping sets are **both kept as inventory** (the 新春套装 keeps 春联 *and* 门神) but the **display shows one set per category**, switchable free. Built as `EN/ZH · 1f2 Home / customize · choose a set`: the customize view with the side slots highlighted + a picker sheet (Side decorations / 侧边装饰 · 春联 *Equipped/展示中* ✓ vs 门神 *Owned/已拥有* ○ · **Equip this set / 展示此套**). Generalises to top · side · background
17. **Wrap** — **SCRUM-9 closed** (description refreshed: 43 boards, all tasks ticked, the remainder delegated) and the four done tickets closed with notes: **SCRUM-26** · **SCRUM-27** · **SCRUM-30** · **SCRUM-32**. Two follow-ups filed — **SCRUM-37** (item detail + purchase confirmation) and **SCRUM-38** (onboarding panels 2–3) — and **all the remaining design tickets joined "SCRUM Sprint 0"** (28 · 29 · 31 · 33 · 34 · 35 · 36 · 37 · 38 + 6 · 9 · 10), which is the next session's target

#### ✅ Session 13 (2026-09-25) — the offering icons redrawn (review feedback on Store + Collection)
**Trigger:** looking at the Store and Collection boards — the icons were too small and the shapes didn't fit the vision.

1. **All five redrawn** as flat low-poly vector art with ink outlines, ~2.5–3× the old drawn size: **Cash Bundle → a joss-paper stack** (fanned sheets, gold top sheet carrying the red-framed foil square + a cinnabar tie) · **Gold Bar → an LBMA-tapered block** (trapezoidal front — 84 wide at the base, 68 at the top — with a bright top face, deep-gold side and a stamped diamond; re-cut in 13b after review) · **House → a big modern house** (flat roofs, full-height glazing, a lit window, cinnabar door, carport, greenery) · **Phone → a real smartphone** (rounded body, azurite screen with a facet, camera/speaker, the shrine glyph on the screen) · **Wealth bundle → the four icons composed into one** (house behind, stack/bar/phone grouped in front)
2. **Sizes** — store cards **72 px** tall (the art used to be ~30–62 px inside a 100 px box), collection **78 px**, featured bundle **220×106**; soft contact shadows; collision-checked against the card text (3 px clearance)
3. **Applied everywhere** — `EN/ZH · 7 Store` + `EN/ZH · 8 Collection`; version saved `S13 — store & collection icons redrawn`
4. **Tool notes** — `createShapeFromSvg` lands at **viewBox size** (its width/height attrs are ignored → `resize()` after), board children take **absolute page coords**, and the whole set lives in `storage.ART` as JS-built primitives (transforms baked into points, no `opacity`) so it can be re-used — the offerings picker (SCRUM-31) will want it
5. **Store economy settled (13c → 13d)** — the cards were priced at 1.5× base (no reason to redeem), then briefly at parity (still harsh); the rule is now **base value = 1.2 × the redemption price**, so a burn at the lowest band already returns more than the price paid, while the **20% Store-Point accrual keeps the store a net sink** (spend 800 → minimum 960 tribute → 192 back as Store Points · net −608) — no farming loop, and photographing your own objects stays the cheapest play. Final ladder: **Cash Bundle 400 pts/base 480 · Phone 600/720 · Gold Bar 800/960 · House (owned) base 1,440 · Wealth Bundle 2,000/2,400**; cash $0.99–$2.99 (~480 pts per $1), the bundle's edge on the cash side

#### ✅ Session 12 (2026-09-25) — the ancestor sheet + the altar's states
**Trigger:** SCRUM-30 — the one interactive flow still missing from the canvas, and the carousel's ＋/edit entries that were wired to stand-ins.

1. **Six new boards, EN + 中文** — `1s` **add sheet** (姓氏 ＊ · 名字（选填） · 称谓 chips · live tablet preview · 安放) · `1s2` **edit mode** (filled fields, Grandfather/祖父 chip selected, preview paints 陈大文, Place + Remove ghost) · `1c` **full altar** (4th tablet 陈秀英, no ＋, "this altar is full", forward chevron dimmed) — the altar state set (**empty · partial · full**) is complete, with a caption per state
2. **Wiring closed the loop** — Home's ＋ → `1s` (the slot was **dead** until now) · carousel chevron → `1s` (the ＋ as the last carousel position — replaces the S11 stand-in) · centre tablet → `1s2` · sheets' Place/Remove → `1b` · `1c` back chevron → `1b`; verified by walking every interaction on all 10 Home-family boards
3. **S9 touch-target decision applied** — invisible rects (≥44 px) carry the taps: ＋ slot 141×319 · centre tablet 141×319 · chevrons 44×44 · ✕ 44×44; the artwork itself is inert. Learned: hit-testing **does not fall through**, so button *labels* carry the link too
4. **Repaired `ZH · 1b`** — a half-translated clone (12 chrome strings still English; the language chip on EN); now fully 中文, chip on 中文, segment colours copied from `ZH · 1`
5. **Copy split per row** — chips EN Grandfather… / 中文 祖父… · the prototype's bilingual hint split (No given name → 姓 + 氏, the traditional short form / 未填名字则刻「姓＋氏」) · a new edge-of-list hint on `1c` (Swipe to view your other tablets / 左右滑动，查看其他牌位)
6. **Machine-checked** — text-overflow sweep after a forced reflow; version saved `S30 — ancestor sheet + altar states · wiring verified`; page now **26 boards**

#### ✅ Session 11 (2026-09-25) — the app frame starts: splash, store, collection; the tablets become a carousel
1. **Splash / loading** (`EN · 0 Splash` / `ZH · 0 Splash / 启动页`) designed + wired as the boot board · **Store** (featured bundle · 4 bundle cards · owned state · placeholder pricing) · **Collection** (stats strip · item grid with the real D-mesh car + standard items · empty-slot invitation)
2. **Location-value decided HIDDEN** — no dedicated UI; it surfaces only as the Reward receipt's "New ground bonus" line (the zone screens + Burn chip built earlier were removed)
3. **The tablets became a carousel** (`1b`) — centre tablet full size, neighbours at 72% scale, faded 90%; gold chevrons both sides; "Swipe to bring a tablet forward / 左右滑动，切换牌位" — the ＋ is the natural last carousel position
4. **Home fixes** — the temple frame simplified to one tone, the offerings restored as a **front layer** (opaque tablets were painting over them), then the **temple starts unfurnished**: frame, backdrop and lattice become purchasable decorations, the tablet finial becomes a shop upgrade
5. Boards 18 → **20**; versions saved at each milestone (revn 55–60) — but the `ZH · 1b` clone was left half-translated (repaired in S12)

#### ✅ Session 10 (2026-09-24) — the prototype moves to Penpot: the tutorial, in two languages
**Trigger:** decisions closed, Figma retired → port the locked core loop into Penpot, split the bilingual UI into two language iterations, and file what a full app still needs.

1. **The core loop is now a Penpot page** — `JossPaperAR` → *"New-user tutorial · Core loop"*: 6 boards @390×844 (Home · Capture · Transform · Burn · Reward · League), faithful to v4 — the **D-mesh car as its 37 flat facets**, fire/altar as vector art, gradient backgrounds native — the **whole flow clickable** (12 wired interactions, verified per row). Font-fallback glyphs (gear, retry) were **redrawn as vectors** so they can't drift.
2. **Two language iterations** — Row 1 **English UI** (`EN · …`), Row 2 **中文界面** (`ZH · …`); every screen translated (60 strings, zero misses), and each row's flow wired inside itself.
3. **Language switcher (new feature)** — an **EN | 中文** segmented pill on Home (active segment = cinnabar chip) cross-navigating EN Home ↔ ZH Home; verified in both directions. The pattern to reuse on the remaining screens (SCRUM-34).
4. **The full-app design backlog is filed** — SCRUM-26…35 (see *Start Here*).
5. **A hard-won practice** — the first Penpot build was **lost when the browser suspended the tab before autosave**; it was rebuilt, and every milestone since is **saved as a named version** in the file history (build → alignment fixes → EN/ZH → switcher). Keep the tab awake; save a version before any reload.

#### ✅ Session 9 (2026-09-24) — parked decisions closed; tooling moves to Penpot
- **Throw generosity** — a complete miss pays 0 but may be **re-attempted; the rethrow can never score the top tier (正中)**
- **40–50s sizing** — Home: the **shrine + tablets grow**, supporting elements shrink; **proportions to iterate later (noted)**
- **Tablet naming** — keep as built: 姓氏 + 名字 + 称谓 chip · 姓＋氏 fallback · **4 per altar**
- **Tooling** — Figma dropped (MCP issues) → **Penpot** (open-source, official MCP server); docs + JIRA updated
- Still open from that list: **home feel** (reverent vs festive)

#### ✅ Session 8 — the throw has aim
- Where you release **is** the aim, graded against the **fire's own artwork** (never an authored number)
- **Bands & pay** — 正中 ±14.55 **×2.0** · 虔誠 ±39.40 **×1.5** · 擦邊 ±96.97 **×1.0** · 偏失 **×0** → **1,650 / 1,250 / 850 / 0**; the fire answers in kind (flare / smolder / nothing)
- Two unit bugs made two bands unreachable — invisible to markup checks → new tool `prototype/tools/aim-check.js` (16 checks, fault-tested)
- The reflection written up: [[AppDesignConceptBoard/05-concept-to-mvp-gap-analysis]] — what the prototype settles vs what the real MVP must replace

#### ✅ Session 7 — the user builds the shrine
- The altar **ships empty**; **＋ → the ancestor sheet** (姓氏 required · 名字 optional · 称谓 chips · live tablet preview), **4 tablets**, 姓＋氏 fallback, tap a tablet to edit/remove
- Three render faults found by eye (double-positioned ＋ · baselines in the wrong coordinate space · the censer swallowing taps) — fixed, now machine-guarded (133 markup + 20 render checks)

#### ✅ Session 6 — fidelity rebuilt in real 3D; the screens use it
- The fidelity test became **one low-poly mesh through a fixed orthographic camera**, against a **photoreal render of the same mesh** — silhouette drift measured, badges machine-checked; **D = B's body + C's wheels, machine-verified**
- `prototype/index.html` ported to the same mesh (v3): the viewfinder + comparator *before* show a **real photograph**; *after* + the tossed offering show **D**; the far-wheels bug fixed (37 faces); new browser-level `tools/render-check.js`

#### ✅ Session 5 — the fidelity target decided
- A/B/C/D fight across four fidelity levels → the user asked for a **mix**: *"the body of B but the wheels of C"* → **variant D** built in `prototype/fidelity-test.html`

#### ✅ Session 4 — prototype review + four fixes
- Offering **vase → car** (~2.1 : 1 silhouette) · Home became the **ancestral altar** + tappable ＋ slot · **object identity = the user's actual object, cartoonized** · the toss **curves and lands inside the fire**

#### ✅ Session 3 — "Feel the App"
- **Style locked** — low-poly 3D + traditional ink brush; palette: cinnabar `#C23B22` · gold `#D4AF37` · azurite `#4A6FA5` · malachite `#0E9B78` · ink `#1A1A1A` · rice paper `#F5F0E8`
- **Clickable HTML prototype** of the core loop at `prototype/` (6 screens @390×844); JIRA SCRUM-6/9 updated

#### ✅ Session 2 — setup
- JIRA project (12 tasks, epic **SCRUM-5**) · Obsidian concept board (5 docs) · design-tooling research · AR patterns (Pokémon GO / Duolingo) started

---



---

## 2 · Superseded context sections

> Verbatim from `next-ai-context.md` (was above the Start Here section). **Stale as of S25/S26** — kept for the record: the S19 review queue is largely closed, and the Sprint 0 goal is long past. Anything still open has been carried into `follow-up-items.md`.
### 🩹 Open follow-up — 2026-09-28 (Session 20, in progress)

- [ ] **🚨 PM-reported defect: logo/icon art partially obscured** — spotted on **`EN · 3d` Transform / failed**; reads as a z-order or bounds defect, not a style issue.
- [ ] **Agreed scope = audit ALL 131 boards** (both language rows) for icon **occlusion** (a later/opaque sibling covering an icon-class shape) *and* **clipping** (icons crossing the 390×844 frame, or a `clipContent` parent cutting them) → **fix every board that fails** → re-audit → export a PNG of each fixed board for PM eyeball.
- [ ] **Sweep method** (read-only pass first, then fixes): recursive child walk → absolute bounds per leaf → sibling-intersection test (flag when ≥30% of an icon's area is covered; ignore deliberate corner badges ≤25% of the icon and labels sitting inside it) + out-of-frame test at 1px tolerance → report failing boards compactly, no full dumps.
- [ ] ⚠️ **~~Blocked on the Penpot bridge~~ — bridge confirmed ALIVE 2026-09-30 (S22: the census reads ran fine; if a call ever reports "suspended", click the Penpot tab to wake it — the plugin tab sleeps when unfocused).** The S21 full-file re-audit already reported `clip 0` / `occl 14` swatch-only, so re-check `EN · 3d` specifically only if the defect is still visible to the eye.
- [ ] After the sweep: PM whole-file review → then `SCRUM-42` + the 7 Sprint 0 design tickets → **Done**. **Named Penpot version still to save — must be done in the Penpot UI** (File → Version history); the plugin API exposes undo blocks only, no version endpoint.


### 🔍 Review queue — Session 19 (PM: take your time)

> Everything S19 produced, where to look, and the specific question each item asks. When you're done: **save a named Penpot version**, flip `SCRUM-42` to Done, then say go for **repo + CI**.

#### A · Penpot — 24 new boards (file `JossPaperAR`, page *"New-user tutorial · Core loop"*)

**Privacy & consent (SCRUM-44 — Done, but please eyeball):**
- [ ] `EN/ZH · 0b3` **privacy notice** — boot flow now runs **0b2 permissions → 0b3 notice → 1a** (the file's real wiring had 0b2 jumping straight to 1a; file beat ticket — confirm you're happy)
- [ ] `EN/ZH · 1s3` **ritual-data consent** — modal over the ancestor sheet: *Place on altar → 1s3 → Continue / Not yet* (first save only)
- [ ] **N2 raw-photo footnotes on the two signed-off Capture boards** (additive: 11px @75%, y838/1758, clear of the shutter) — ⚠️ one of only two kinds of edit made to signed-off boards

**Economy (SCRUM-42 — In Review, your OK closes it):**
- [ ] Shop column **x=4480**: `9` cash shop (featured **1,000 credits @ $1.55** = the only locked price; other tiers deliberately *price TBD* per economy spec §8.3) · `9b` confirm (Google Play IAP sheet = placeholder; **Buy** is a deliberate dead end) · `9c/9d` daily gift claim / claimed — 🔧 **repaired 2026-09-28** (clone debris cleared · stranded streak/Claim/note restored · **7-day streak calendar added** · value line un-clipped · switcher fixed · interactions re-verified — see Session 20)
- [ ] State stacks: **`2b`** daily cap · **`2c`** out of credits · **`2d`** free-allowance (under Capture) · **`3b`** queue · **`3c`** refund (under Transform) · **`5b`** ad card (under Reward) — all spec §4 copy verbatim, both rows
- [ ] ⚠️ **Decision A:** Reward's *"Return to Shrine"* now routes through the `5b` ad card; *"View League" still skips it* — right, or should both exits pass it?
- [ ] ⚠️ **Decision B:** credits chip added to both signed-off Capture boards (tap → cash shop) — visual change to signed-off boards
- [ ] Copy spot-check: quota strings = spec §4; all ZH = **simplified**

#### B · New docs (5 — read at leisure)

- [ ] [[AppDesignConceptBoard/11-integrity-posture]] — trust matrix · **caps 1,650/burn · 49,500/day · 6/min rate limits** · anomaly signals log-only at alpha · (ADR-005)
- [ ] [[AppDesignConceptBoard/12-security-and-legal-scoping]] — **🚨 §B.7: Play Billing's ~15% cut vs the locked $1.19 floor — does the economy still hold?** · §B.5 PDPA/GDPR D1–D10 · §B.1 fal grants no output IP · §B.6 trademark timing
- [ ] [[AppDesignConceptBoard/13-privacy-and-retention]] — **§2 retention windows (raw photo = 7 days!)** · §5 consent copy N1–N6 · §8 delete rules (league points vanish; flags survive 90d) · §9 deletion runbook · (ADR-007)
- [ ] [[AppDesignConceptBoard/14-nfr-device-and-performance-targets]] — **floor device: pick 1 of 3 (~S$100–150): Galaxy A05s / Redmi A5 / Nokia C-series** · 30fps floor decision · cross-day offline queue
- [ ] [[AppDesignConceptBoard/15-clan-model-and-book-of-tributes]] — **NEW (S23)** the clan model spec: roles ladder · create/join/invite flows · shared ancestor list · Book of Tributes (no image · 1-month window · inside/outside visibility) · EN/ZH copy C1–C17 · feeds SCRUM-46/47/48

#### C · Jira

- [ ] `SCRUM-42` → **Done** after your Penpot pass (currently In Review)
- [ ] `SCRUM-43` (filed) — legal long-tail: Play fee vs floor · ToS/privacy policy · trademark · model-terms reads — awareness only for now
- [ ] `SCRUM-33` picked up a scope comment (privacy hub: export · delete + receipt · consent toggles · policy links) — read before designing Settings
- [ ] **S23 (awareness):** `SCRUM-22` ✅ Done (clan spec → doc 15 · 07 v2.7) · `SCRUM-46` clan build (spec'd) · `SCRUM-47` slot monetization (Low) · `SCRUM-48` clan boards ✅ **Done (PM-marked)** — create/share/join (design)

#### D · Decisions already recorded as accepted (flag anything you disagree with)

- [ ] **ADR-005** (honest client + caps) · **ADR-007** (minimal collection · windowed retention · one-tap delete)
- [ ] Doc 13 §5 ZH copy converted **traditional → simplified** (to match the boards)
- [ ] Supabase region `ap-southeast-1` · `integrity_flags` 90-day post-delete hold · immediate delete (no grace) at alpha · minSdk 24 install-only legacy tier

---

---

### 🏁 Sprint 0 — the next session's goal

> **"SCRUM Sprint 0"** (Jira board 1 · active · ends 2026-10-06). **Next session = complete Sprint 0.**

**In the sprint:** `SCRUM-6` ✅ closed (goal met — style locked, target **D**) · `SCRUM-9` ✅ closed · `SCRUM-10` 🔄 **architecture — S19: SCRUM-21 ✅ integrity (ADR-005) · SCRUM-19 ✅ privacy (ADR-007) · SCRUM-20 ✅ NFRs — remaining: repo + CI → milestones** · `SCRUM-42` 🔄 **economy flows built → In Review (awaiting PM eyeball)** · `SCRUM-44` ✅ privacy/consent boards · `SCRUM-43` 🆕 legal long-tail (awareness only) · and the **design remainder**: `SCRUM-28` ✅ login · `SCRUM-29` ✅ create account · `SCRUM-31` offerings picker · `SCRUM-33` profile/settings/history · `SCRUM-34` language completion · `SCRUM-35` state pass · `SCRUM-36` customization catalogue + pickers · `SCRUM-37` item detail + purchase · `SCRUM-38` onboarding panels 2–3

**Suggested order** (each = boards + wiring in **both rows**, then a named Penpot version):
1. **`SCRUM-38`** onboarding panels 2–3 — small; extends the existing `0b` board with the copy ladder already written
2. ~~**`SCRUM-28` + `SCRUM-29`**~~ ✅ **done** — Login (`0c`…`0c5`, title = "Sign in or register new account") + Sign-up (`0d`…`0d5`) both built & wired EN/ZH; boot flow closes end-to-end (Splash → Login → Sign-up → ancestor sheet → first-run Home)
3. **`SCRUM-31`** offerings picker (`EN/ZH · 2b`) — reuses the store/icon vocabulary; values check against the aim bands
4. **`SCRUM-36`** catalogue — more decorations (福字 · 中国结 · 剪纸 · 香炉 · 长明灯 · 盆景 · 貔貅 totems · a **seasonal set**) + the **top / background pickers** + the **empty-slot state**
5. **`SCRUM-37`** item detail + purchase confirmation — closes the shop loop and the decoration picker's "not owned" route
6. **`SCRUM-33`** profile/settings/history · **`SCRUM-34`** language completion · **`SCRUM-35`** state pass (incl. the miss → rethrow flow)
7. **`SCRUM-10`** architecture — 🔄 **in progress — S17+S18**: ADR-001 ✅ · diagram + schema (07 → v2.3) · **spike ✅ closed** (US$4.49/133 runs) · **ADR-002 ✅ Path C** · **economy ✅ SCRUM-18 Done** ([[AppDesignConceptBoard/10-economy-spec]]); **S19: SCRUM-21 ✅ → SCRUM-19 ✅ → SCRUM-20 ✅ all closed**; **remaining in SCRUM-10's chain: repo + CI → milestones** (brief in [[AppDesignConceptBoard/05-concept-to-mvp-gap-analysis]]) · also S19: **SCRUM-42 built (In Review)** · **SCRUM-44 ✅** · **SCRUM-43 filed** · docs 11–14 new

---


---

## 3 · `next-ai-context.md` footer history

> Verbatim from `next-ai-context.md`.
*Updated 2026-10-02 (**Session 26 wrap**) — 🎯 **SCRUM-8 ✅ Done (planning) — the AR framework question is answered & recorded.** The decision (S8/doc 04 · ADR-001 clause 4) had never been written up, so the register and ADR-001 both pointed at a missing **ADR-003**; this session writes it. **[[AppDesignConceptBoard/ADRs/ADR-003-non-ar-ar-mvp-ar-framework|ADR-003]]** = the MVP's "AR" is ***non-AR AR*** (live `expo-camera` preview + a fixed-position RN overlay; ≤400 KB fire sprite, ≤30 fps Tier F); **ARKit / ARCore-direct / Unity / web-AR / `react-native-arkit` rejected**; true AR post-MVP via **4 exit ramps**. New **doc 17** = the AR-fire **proof-of-concept plan** (N3/N4/N10 + aim bands as the gate; runs in Expo Go, no native module) — **execution deferred** to repo+CI (SCRUM-15) + the Tier F floor device. ADRs register → **5 accepted**; concept-board index → docs **11–17**; ⚠️ reconciled SCRUM-17's "60 fps" against doc 14's 30 fps floor. Jira `SCRUM-8` → **Done**; a **follow-up ticket** carries the spike run.*
*Updated 2026-09-30 (**Session 23 wrap**) — 🕯️ **SCRUM-22 clan model spec ✅ Done & closed — individual altars → clan/bloodline tracking**: vault doc **15-clan-model-and-book-of-tributes** written with the PM locks (clan-scoped offerings → answers 07 §7 Q3 · no non-clan altar · roles Head/Elder/Member · cap 10 + future slot monetization · Book of Tributes without images, 1-month window, inside/outside visibility · EN/ZH copy C1–C17) · **07-system-architecture → v2.7** (`clans` · `clan_members` · `clan_id` on ancestors/burns/tributes) · Jira: **SCRUM-22 Done** · **SCRUM-47** filed (slots · Low) · **SCRUM-48** filed (clan boards — create/share/join, EN/ZH) · `SCRUM-29` cross-ref added · no Penpot work (bridge untouched)*
*Updated 2026-09-27 (**Session 19 wrap**) — SCRUM-10 chain: **SCRUM-21 ✅ + SCRUM-19 ✅ + SCRUM-20 ✅ all Done** (ADR-005 + ADR-007 accepted · docs 11-integrity / 12-security-legal / 13-privacy / 14-NFR created · 07 → v2.6) · security & legal/IP scoping incl. **PDPA baseline + GDPR design target** and the **Play-fee-vs-floor flag (12 §B.7 → SCRUM-43)** · design block: **SCRUM-44 ✅ Done** (privacy/consent boards) + **SCRUM-42 built → In Review** (14 economy boards) — **Penpot 63 → 87**; **Review queue section added at the top** for PM*
*Updated 2026-09-26 (**Session 17 wrap**) — SCRUM-10 architecture build-out: system diagram + data model drafted ([[AppDesignConceptBoard/07-system-architecture]]), indexed in the concept board, progress commented on SCRUM-10 · **then Option A LOCKED → ADR-001 accepted**, ADR register opened, 07 streamlined to v2, 06 flipped to decided*
*Updated 2026-09-25 (**Sessions 15+16 wrap**) — S15: auth block signed off (login + signup, boards → 63, SCRUM-28/29 Done) · S16: SCRUM-10 research phase complete (options → decisions, AR-wrapper concern closed), cost tracker + billing action items (SCRUM-39/40/41) created; Circleback MCP verified read-only*
*Created 2026-09-22 · **Reformatted 2026-09-24 (Session 10 wrap)** — newest-first layout, Start Here at the top, older sessions compacted; the previous version is recoverable from Obsidian file recovery*
*Updated 2026-09-25 (Session 14 wrap) — the boot flow folded in (onboarding · permissions · first-run Home; the boot row re-ordered, the Home column shifted) · 14b: only the Splash is dark, the triptych re-aligned on ink · 14c: the app mark (AR brackets over the joss sheet) replaces the lanterns · 14d: the mark replaces the wordmark labels in the headers · 14e: the header mark aligned to the margin; the plaque above the altar removed (space reserved for monetization) · 14f–14g: the league card → a League-tab subtext, CTA pinned to the bottom, the whole temple scene marked as the customizable zone · 14h–14i: the **decoration store** (7b) + **decorated Home mockups** (1d/1e) and the placement scheme; SCRUM-36 filed · 14j: the **6-slot decoration grid** (top · side · background) with the `1f` customize view, and the dressed views rebuilt on the slots · 14k: the **one-set-per-category rule** (bundle keeps both, display shows one) and the `1f2` picker · **SCRUM-9 closed** (43 boards signed off; the remaining design rides SCRUM-28/29/31/33/34/35/36) · wrap: the done tickets (26 · 27 · 30 · 32) closed, **SCRUM-37** + **SCRUM-38** filed, and the whole remainder moved into **SCRUM Sprint 0** — the next session's target*
*Updated 2026-09-25 (Session 13 wrap) — the offering icon set redrawn for Store + Collection; SVG-in-Penpot tool notes added*
*Updated 2026-09-25 (Session 12 wrap) — Sessions 11 + 12 folded in (app-frame boards, the ancestor sheet + altar states, the Penpot cloning gotchas)*
*Purpose: context hand-off for the next AI session*


---

## 4 · `follow-up-items.md` — snapshot before the 2026-10-02 cleanup

> Verbatim, **all items open and closed**. The live file now carries only genuinely open work.
### 🎯 Immediate Actions (Next 1-2 Weeks)

#### Research & Discovery
- [x] Research existing joss paper cartoon styles and visual elements → **Style locked 2026-09-24** (low-poly 3D + traditional ink brush)
- [x] Identify AI APIs for cartoonization/background removal
- [x] Explore AR development frameworks (ARKit, ARCore, Unity, etc.) → **DONE 2026-10-02 (S26)**: closed by [[AppDesignConceptBoard/ADRs/ADR-003-non-ar-ar-mvp-ar-framework|ADR-003]] — the MVP uses **no AR framework** (Expo/RN `expo-camera` + a fixed overlay = *non-AR AR*); ARKit / ARCore-direct / Unity rejected; true AR deferred to 4 exit ramps (SceneView RN → Scene Viewer intent → react-viro → Kotlin module)
- [x] Study Pokémon GO AR implementation patterns → **DONE (S8)** — the catch pattern (object fixed to the phone · non-AR AR mode · Nice/Great/Excellent → the 正中 · 虔誠 · 擦邊 tiers · miss returns, never destroyed) recorded in [[AppDesignConceptBoard/04-ar-app-patterns]]; adopted as the MVP AR call in [[AppDesignConceptBoard/ADRs/ADR-003-non-ar-ar-mvp-ar-framework|ADR-003]] (S26)
- [ ] Research Duolingo leaderboard mechanics

#### Planning & Design
- [x] Create wireframes/mockups of core user flow → first **clickable HTML prototype** built (`prototype/` folder, Session 3); **v2 iterated on Session-4 review feedback** (car offering, ancestral altar, in-fire toss), **v3/v4 add the shrine the user builds and real aim on the throw (Session 8)**
- [x] Decide how much real shape must survive cartoonization → **answered Session 5**: not a level but a **mix** — *"the body of B but the wheels of C"*, built as **variant D** in `prototype/fidelity-test.html` (37 faces = 31 body + 6 wheel, outline 4 — mesh tolerance 3.1, 18-vertex profile, 16-gon wheels). This is the cartoonization target.
- [x] Port the approved mockup to **Penpot** — done (Sessions 10–12): the file `JossPaperAR` now holds **26 boards** — the core loop, splash/store/collection, and the ancestor sheet + altar states — **EN + 中文, all wired**; the design↔AI bridge is Penpot's official MCP server
- [ ] **Swap the placeholder photo** for the family's own car: `prototype/assets/car-real.jpg` **and** `car-real-panel.jpg` (the second is the first padded to the stage aspect — recipe in `assets/CREDITS.md`). Removes the CC BY-SA licence question and fixes the remaining transform-slider mismatch, since the placeholder is a different car whose silhouette is a different shape.
- [ ] **Tap targets on Home for 40–50s hands** — `tools/render-check.js` measures a tablet at **32×83 px** on a 390 px screen (narrower than the 44 px most touch guidelines ask for) and two tablets sit 42 units apart, so a near-miss opens nothing. Grow the *touch* area with an invisible rect rather than the artwork; the ancestor sheet's relationship chips are the other candidate. **Decision closed (Session 9)**: the shrine + tablets take a larger share of the Home screen and supporting elements shrink (proportions to iterate later) — do the invisible-rect touch upgrade in that same proportion pass.
- [ ] Determine cartoonization approach (existing AI APIs vs custom model) — informed by the fidelity pick: **D needs shape-locking img2img at B's mesh tolerance + a per-region rule so the wheels stay round and appear on all four corners (a 3/4 view shows the far pair through the arch tunnels)**. Session 6 rebuilt the fidelity test in orthographic 3D (one real 3D mesh, photoreal reference, measured silhouette drift, machine-checked badges), so the target is now unambiguous. Next step is the first real experiment (SCRUM-6).
- [ ] Define technical architecture and tech stack
- [ ] Plan data storage for location-based value system
- [ ] Consider hosting strategy for MVP
- [ ] Evaluate no-code/low-code options if needed

#### 🏗️ MVP Architecture (next session — see [[AppDesignConceptBoard/05-concept-to-mvp-gap-analysis]])
- [ ] **Close the platform & runtime decision** (native ×2 · Flutter/RN · Unity · web-first) — everything else depends on it (feeds SCRUM-10)
- [x] **Confirm the MVP AR mode**: fixed-overlay "non-AR AR" over a live camera (doc 04's recommendation) — true ARCore/ARKit becomes a later photo mode → **DONE 2026-10-02 (S26)**: recorded as [[AppDesignConceptBoard/ADRs/ADR-003-non-ar-ar-mvp-ar-framework|ADR-003]] (SCRUM-8) · PoC plan = [[AppDesignConceptBoard/17-ar-fire-spike-plan|doc 17]] (execution deferred to repo+CI + the floor device)
- [ ] **Decide the cartoonization runtime with measured numbers**: cost/photo, p95 latency, moderation, retry — spike against **D** as the acceptance target (SCRUM-6/7)
- [ ] **Choose the backend shape** for a points ledger + ~30-user weekly cohorts + the geo grid + quotas (BaaS vs serverless vs custom)
- [ ] **Write the privacy posture before any storage code**: photo retention windows, ancestor names never in analytics, delete-all, consent
- [ ] **Define burn limits as the AI-cost control** (daily quota vs cost per burn vs cooldown)
- [ ] **Write the NFR targets**: mid-range-Android floor, 60 fps throw, p95 cartoonization latency, offline behaviour, cost per active user
- [ ] **Port the prototype's test habit** to the native app (machine-read verdicts, a fault-tested harness, one device check per behaviour)
- [ ] **Scope the vertical slice**: one offering end-to-end on a real device — camera → cartoonize → burn → award → persist

#### 🕯️ Clan model & Book of Tributes — **SPEC ✅ 2026-09-30 (SCRUM-22 Done)** · **doc 15 → v0.3 after SCRUM-48** — see [[AppDesignConceptBoard/15-clan-model-and-book-of-tributes]]
- [x] **Spec + schema locked** — doc 15 (v0.2) + [[AppDesignConceptBoard/07-system-architecture]] **v2.7**: clan-scoped offerings (no per-ancestor attribution — answers 07 §7 Q3) · no non-clan altar (first-run fork required) · roles **Head → Elder → Member** (co-heads can delete) · **cap 10** + slot monetization later (`clans.ancestor_cap`) · Book of Tributes: no image · 1-month window · members full / outsiders anonymised · EN/ZH copy C1–C17
- [x] **SCRUM-48 ✅ DONE 2026-10-02 (PM-marked)** — Penpot boards: clan **creation · sharing · joining** — **22 boards built** (`EN · 0e Clan` + `ZH · 0e 宗族`, 11 each; fork · create-name · create-confirm · create-invite · join-code · join-QR · join-preview · join-success · invite & share · 2 states), **both rows wired** (96 interactions total; none orphaned). **Rev 2 (PM review):** realistic QR codes · clan logo centred on `0e8` · **duplicate-name prompt removed** (the `0e11` state board is deleted and `#suffix` is dropped from names — spec §2.1 display now unused, flagged). **Boot hand-off `0d3` → fork REWIRED** (the fork is required — no non-clan altar, doc 15 §6); `1s` ancestor sheet **reused unmodified** as the terminal hand-off. Saved Penpot version *"…EN+ZH wired · 24 boards"* → *"SCRUM-48 clan boards · rev2 · realistic QR · logo centred · duplicate-name prompt removed"*; decisions block on the page + Jira comment `10181`. **Ratified when Done (2 Oct):** the create-path order (**doc 15 §4.2 amended** to match the boards) · **ZH terminology locked** (§10 item 6 closed) · the **§2.1 suffix removal** (doc 15 → **v0.3**; names display plain, no duplicate prompt) · **QR build tracked as `SCRUM-50`** (architecture → [[AppDesignConceptBoard/07-system-architecture]] §4.6)
- [ ] **SCRUM-46** — clan build (backend + frontend) — spec §9 = the schema · §10 = open build items (Book window hide-vs-purge · anti-abuse rate limits)
- [ ] **SCRUM-50** — **QR invite: generation + scanner + deep links** (Relates `SCRUM-46` · `SCRUM-48`) — `clans.code` = one active **8-char capability** (re-rollable) → **QR payload = the invite deep link** · generation **client-side** (`react-native-qrcode-svg`, offline, no server cost) · scan via `expo-camera` `barcodeScannerSettings` (no new native module) · `preview_clan` → `join_clan` (no approval queue) · join throttled via `rate_counters` · privacy = **code only**, excluded from analytics. Architecture → **[[AppDesignConceptBoard/07-system-architecture]] §4.6** (07 → **v2.8**); the Penpot QR is a **decorative placeholder**
- [ ] **PM decisions open (spec §10):** head-exit mechanic (promote-first proposed) · ZH terminology lock (宗族 · 族长 · 长老 · 副族长 · 成员 · 供奉簿 · 邀请码) · altar display at cap 10 (the art holds 4 tablets)
- [ ] **SCRUM-47** (Low · backlog) — purchasable ancestor slots beyond the free cap

#### 🧧 Cultural consultation & ritual review — **PLANNED · SCRUM-24 ✅ Done (planning) · execution DEFERRED → SCRUM-49** — see [[AppDesignConceptBoard/16-cultural-consultation-and-ritual-review]]
- [x] **Plan + review sheet written** — vault doc 16: advisor list (§3) · bilingual 10-question sheet (§4) · pre-decided change policy (§5) · outcome template (§7) · export checklist with exact board names (§2)
- [ ] **SCRUM-49 (Low · parked)** — run the consultation **once the app is functional**: live-app demo (+ §2 pack backup) → book the first conversation → run the 10 questions → fill §7 → feed §8 downstream
- 🔎 **Found:** the ZH copy mixes scripts (traditional core-loop vs simplified new copy — verified live on `ZH · 4 Burn`) — doc 16 §4.4; Q1 settles it

#### ♿ Accessibility sweep of the Penpot UI — **CONTRAST/COLOUR COMPLETE 2026-09-29 · RESPONSIVE RULES RECORDED 2026-09-30** (see `penpot-sweeps/occlusion-contrast-audit-v3.js` · `design-system/responsive.css` · `design-system/responsive-check.js`)
> [!success] ✅ CONTRAST/COLOUR IS DONE — verified 2026-09-29 (Session 21, tranche 2). ✅ **RESPONSIVE/SAFE-AREA RULES RECORDED — 2026-09-30 (Session 22): `design-system/responsive.css` + `responsive-check.js` 21/21.** **Resume at: PM visual review of the 47 changed boards.**
> **Final verified state:** `clip 0 · occl 14 (byte-identical to baseline) · lowc 0 ·` **`lowcAA 0`** `· largeLow 0` over 135 boards / 10,042 shapes / 2,453 text shapes. `design-system/contrast-check.js` **22/22** (21 token checks + the foundation stylesheet lint — which now always has a real target instead of `skipped`).
> **Applied:** 120 shape edits (112 text + 8 discs) across 47 boards cleared all **132** AA body-text failures. Penpot `revn 229` (pre-tranche rollback `revn 226`). Text-role residual `#a8862a` **0** · `#0e9b78` **0** — the palette is now internally consistent.
> **⚠️ `lowc 0` IS NOT AA COMPLIANCE.** The `lowc` bucket fires at `<3.0`; the AA gate is the new **`lowcAA`** bucket in `runAudit4`. Report `lowcAA`, never `lowc`.
> **🔴 Found during verification:** 4 of the 5 planned token hexes were **wrong** (hand-carried into the notes, over-dark, drifted from the build) — corrected on 14 shapes. **Read hex from `design-system/tokens.css`, never from a note.**
> **Still open:** (1) **PM visual review** of the 47 boards → then release the colour hold on `SCRUM-42`/`SCRUM-33` (held on purpose — see comment 10167/10168); (2) **`SCRUM-45` closeability** — the responsive criterion is ✅ recorded & machine-checked (S22); what remains is its *application to the real build*: the build-CSS lint runs automatically once a build stylesheet exists — wire both guards into CI at the repo + CI milestone (`SCRUM-15`). **Resume at the PM visual review.**

A read-only MCP sweep of all **135 boards / 10,042 shapes** on page *New-user tutorial · Core loop*. An earlier geometry-only audit (`penpot-sweeps/icon-occlusion-audit.js`) had produced **almost all false positives** — it measured text by its *layout* box instead of its *inked* box and only compared siblings, so it reported labels "occluded" by their own button. v3 measures `shape.textBounds`, walks true paint order, and excludes deliberate modal/chrome layering.

- [x] **Find and fix the "first tab obscured" defect** → real, and fixed. On all **6** ancestor sheets — `EN · 1s Ancestor sheet`, `EN · 1s2 … / edit mode`, `EN · 1s3 … / ritual-data consent`, `ZH · 1s 安奉牌位`, `ZH · 1s2 … / 编辑`, `ZH · 1s3 … / 祭拜数据同意` — `nav · tab League subtext` was painted **on top of** `modal · scrim` and `sheet · title`, so the subtext floated over the sheet face and collided with the title (ZH overlaps `sheet · title` by 18×16 px). Reordered below the modal layer in all 6 (**z-order only — no geometry or colour changed**). Verified: the subtext now paints at flatten index 11, ahead of the scrim (78/102) and the title (86/87/111). The other 24 boards carrying this shape have no scrim and were already correct.
- [x] **Fix the 4 low-contrast colour tokens — 130 findings across 47 boards.** This is the real defect class and it is a *token* fix, not 130 edits. **With Penpot now the single design source of truth (prototype retired), this is the one and only place the fix lands** — apply the four swaps below in Penpot, then re-run the sweep:

  | fg | bg | ratio | n | what | candidate shades (verified) | ✅ APPLIED in Penpot (S21) |
  |---|---|---|---|---|---|---|
  | `#a8862a` | `#eae2d2` | 2.67 | **84** | joss-gold body text on cream panels — history CJK glyph rows (车/金/屋/香…), League rows, tutorial steps, and **every `nav · tab League subtext` (30 boards)** | **`#7b621f` → 4.52 AA** · `#9d7d27` → 3.02 (large only) · `#584616` → 7.08 AAA | **`#7b621f`** = `--gold-text` · **4.52** · 84 shapes |
  | `#f0c75e` | `#f5f0e8` | **1.42** | 26 | pale-yellow tutorial carousel chevrons — verified visually as essentially invisible; worst ratio in the file | `#826b33` → 4.52 AA · `#a38840` → 3.01 (large only) | **`#77632f`** = `--gold-bright-text` · **4.52** · 26 shapes |
  | `#a39d92` | `#fbf7ee` | 2.52 | 16 | muted-grey secondary labels (streak-calendar day numbers) | ~~`#767169`~~ superseded · `#958f85` → 3.00 (large only) | **`#69655e`** = `--muted-text` · **4.50** · 16 shapes |
  | `#fff8e8` | `#d4af37` | 1.99 | 4 | cream avatar glyph on a joss-gold disc | darken the **disc**, keep the cream glyph (smaller visual change); ~~`#6f5715` → 6.51~~ was over-dark · glyph-side alt `#474541` → 4.55 rejected | **disc `#d4af37` → `#887023`** = `--disc-gold` · **4.52** · glyph `#fff8e8` **unchanged** · 4 shapes |

  > [!important] Two of the four originally-recommended shades were superseded at apply time
  > The applied values are the **`design-system/tokens.css` token values**, not the first candidate list — so the Penpot file and the real build now inherit the *same* hex, which was the whole point of fixing this in the token layer.
  > - **`#a39d92`**: applied **`#69655E`** (`--muted-text`), **not** the earlier `#767169`. `#69655E` is the token that clears 4.50 on all five creams.
  > - **`#d4af37` disc**: applied **`#887023`** (`--disc-gold`, 4.52), **not** the earlier `#6f5715` (6.51). `#6f5715` clears AAA but is considerably darker than the brand gold; `#887023` is the *lightest* hue-preserving shade that reaches AA, so it is the smaller visual change — consistent with the rule applied to every other token. **The cream glyph `#FFF8E8` was never changed**, exactly as designed.

  Every replacement above is the **lightest hue-preserving shade** of the current colour (RGB scaled toward black, so the brand hue survives) that clears the stated target. All ratios were recomputed and machine-verified — an earlier candidate list was arithmetically wrong (e.g. `#7d6219` was quoted as 4.50 but is really **4.49**, which fails AA).

- [x] **Confirm the clipping / occlusion alarms are false** → dismissed, do not "fix". **0** shapes cross their board frame. The **14** remaining occlusion findings are all intentional: `option · hengpi|lanterns|landscape (bg)` drawn over `art · shrine base (table)` / `art · offerings (front)` on the `1f3/1f4 Home / customize` boards are **background swatch previews** deliberately covering the shrine to show the swap.
- [x] **Re-run the sweep after the token change** → **PASSED on its own criteria 2026-09-29 (Session 21): `clip 0 · occl 14 (swatch-only) · lowc 0`** across **135 boards / 10,042 shapes**. `lowc` **130 → 0** (−130, all 47 boards clear); `clip` unchanged at 0; `occl` unchanged at 14 **and the occlusion set is byte-identical to the baseline** (same board/art/by/coverage tuples) — expected, since only *fills* changed and occlusion is a bounds test. Post-fix ratios **for the 130 changed findings only**: **min 4.52 · max 5.42** — those all clear AA 4.5:1. ⚠️ **But see the next item — this green does not mean AA is met; 132 further text shapes were never in the `lowc` set.** **Tranche 2 (2026-09-29): all 132 AA body-text failures cleared — `lowcAA 0`, verified live.**
  > [!note] How the fixes were actually written to Penpot (two dead ends first)
  > - **`penpot.replaceColor()` silently no-ops here** — it returned success output but the file did not change. **Do not trust its return value.**
  > - **Direct `shape.fills = [...]` assignment is the working path** for text fills. Verified with a single-shape write + fresh re-read (`#a8862a` → `#7b621f`) before doing the batch.
  > - All remaining fixes were applied **in one undo block** with no write errors; the file revision bumped **223 → 224**, confirming server-side mutation. A fresh census then confirmed the expected deltas: `#a8862a`→`#7b621f` **+84** · `#f0c75e`→`#77632f` **+26** · `#a39d92`→`#69655e` **+16** · `#d4af37`→`#887023` **+4**.
  > - **Penpot normalises hex to lowercase** — all comparisons must be case-insensitive.
  > - A **rollback version was saved first**: `S21 · pre-a11y palette fix (clip0/occl14/lowc130)` at `revn 223`.
  > - ⚠️ **The MCP request timeout is not the plugin's execution timeout.** The full `runAudit3()` call reported "timed out after 120 seconds", but the plugin task **kept running and completed server-side** — `storage.auditPostFix` was fully populated and readable on the next call. Before re-running an expensive audit, **check whether the previous result already landed in `storage`**.
- [x] **🔴 NEW (Session 21 validation): `lowc 0` is a FALSE GREEN — 136 text shapes still sit below AA 4.5:1, and the palette is now internally inconsistent.** The audit's threshold is **`cr < 3.0`**, so it structurally cannot see the 3.0–4.5 band. Re-running the *authoritative* function with the predicate widened to `cr>=3.0 && cr<4.5` (135 boards / 10,042 shapes) found **136 shapes** still under the AA body-text bar — including **112 whose foreground is still the un-swapped brand gold `#a8862a`** (3.03–3.44). Cause: the swap was driven by the `lowc` findings, i.e. only pairs *below 3.0*, so the same colours survive wherever the backdrop happens to land ≥3.0. **Result: `#a8862a` and the swapped `#7b621f` now coexist in the same semantic role — the file renders two different golds depending on backdrop.** Largest groups: `#a8862a` on board `#f5f0e8` **88 @ 3.03** (34 boards, e.g. `chip · points balance` "Store Points 1,480") · on `#fbf7ee` **10 @ 3.22** · cream `#fff8e8` on `#0e9b78` **8 @ 3.32** (`art · tier badge label` "JADE") · on `#f8f1dc` **8 @ 3.05**. Full table in [[next-ai-context]] (Session 21 entry, item 8).
  > [!warning] FONT-SIZE TRIAGE COMPLETE (`storage.bandTriage`) — 132 genuine, 4 legitimately pass
  > Captured `fontSize`/`fontWeight` and applied WCAG's large-text rule (≥24px, or ≥18.66px bold ⇒ 3.0 bar, else 4.5): **genuineFail 132 · largeOk 4 · unknown 0**.
  > - **Leave the 4 large-text shapes alone** — `logo · Joss` "金纸" **40px/800** and `miss · glyph` "✕" **90px/700**, both `#c23b22` on a **dark** board. They clear the 3.0 large-text bar, and **darkening them (`--cinnabar-text`) would make light-on-dark worse.**
  > - **132 are real body-text failures** — e.g. `row 1 · rank` "1" is **19px/400**, *not* large (needs ≥24px, or ≥18.66px **bold**); an eyeball guess would have wrongly excused it.
  > - **Tranche 2 is fully specified — every one of the 132 has a machine-checked token:** `--gold-text #7B621F` **112** · `--disc-malachite #0C8265` **8** · `--malachite-text #0A7359` **4** · `--disc-gold-deep #8B6F23` **4** · `--cinnabar-text #B73820` **4** = **132**. Write path is proven (`shape.fills = [...]`), rollback version exists at `revn 223`.
  > - ✅ **PM VISUAL CALL GIVEN ("apply now") — tranche 2 APPLIED 2026-09-29.** It collapsed `#a8862a` → `#7b621f` on 120 shapes across **47** boards (the estimate said 34 — the real blast radius was larger). All 132 AA failures are now cleared; **`lowcAA 0`**.
- [x] **Fix the audit so this can never read green again** → **DONE 2026-09-29.** `occlusion-contrast-audit-v3.js` now carries **`runAudit4`** with a **`lowcAA`** bucket (`<4.5` and not WCAG large text) plus **`largeLow`** (large text under 3.0). `runAudit3` is left untouched for baseline diffing. A passing sweep is now `clip 0 · occl 14 · lowc 0 · lowcAA 0 · largeLow 0`. ⚠️ **`lowc 0` on its own is NOT a pass — report `lowcAA`.**
- [x] **Jira updated (Session 21, MCP restored after a session reload)** → **`SCRUM-45` moved to In Progress** (4 of 6 acceptance criteria met — *not* Done) with comment `10163` carrying the applied swaps + census deltas, the re-audit numbers, this band finding, the tranche-2 table and the tooling lessons. **`SCRUM-42` (`10164`) and `SCRUM-33` (`10165`) commented that the colour sign-off hold must be KEPT.** ⚠️ **This reverses the plan recorded earlier the same day** ("release the hold once this lands") — *given the band finding, releasing it would have been actively wrong*: the palette is internally inconsistent, so those In Review boards need their second visual pass **after** tranche 2. Signing off colour now means signing off a palette that is about to change and needing a third pass.


- [x] **Root-caused the 130 findings: they are the locked SCRUM-6 palette, not the artwork** → the fix belongs in the token layer, so it lands once and both the Penpot file and the real build inherit it. Sampling `prototype/styles.css` against the same rule found **11 of 19** real pairings failing — including two classes the Penpot sweep never saw: **malachite `#0E9B78` on cream** (2.73–3.32 — `.lr-name em`, `.mini-move`) and the **`facet-jade` conic gradient**, whose stops span 2.36 → 5.09 so text on it fails at the light stops and passes at the dark one. A gradient cannot be fixed by picking one colour; every stop has to clear the bar.
- [x] **Built the accessible token layer** → `design-system/tokens.css` (36 tokens) + `design-system/contrast-check.js` *(moved out of `prototype/` on 2026-09-28 when the prototype was retired — the build's design system must not live inside a retired folder)*. The governing rule is that **a colour can be fine as a border or fill and still fail as text** (`--gold-deep` is a valid `border-color` on `.league-row.is-you` and fails at 2.67 as `.mini-rank` text), so tokens are split by *role* rather than renamed wholesale: `--<colour>` stays the brand value for decorative use, `--<colour>-text` is verified ≥4.5:1 on every cream surface, `--disc-<colour>` darkens the *fill* so the cream avatar glyph never has to change. **21/21 token checks pass** (was 20/20 before `--muted` / `--muted-text` were added in S21).
  > [!warning] The binding cream surface is the DARKEST one, not the lightest
  > Every brand colour is darker than every cream, so contrast *shrinks* as the background darkens. `#4A6FA5` reads **4.81** on `#FDF8E7` but only **3.97** on `--paper-deep #EAE2D2`. Qualifying a token against the lightest cream would have passed it and shipped a failure. `contrast-check.js` therefore computes the true worst across all five surfaces.
- [x] ~~**Migrate `styles.css` to the `-text` tokens**~~ — **superseded by the source-of-truth decision: Penpot governs, the prototype is retired.** The 32 lint hits in `prototype/styles.css` are no longer live defects to fix; they are a historical record of the patterns the real build must not repeat. Reproduce the list any time with `node design-system/contrast-check.js --only=lint --css=prototype/styles.css`. The lint itself no longer scans the prototype by default — it looks for the real build's stylesheet (`src/`, `app/`, `build/`, `web/`) and reports **skipped, not passed**, until one exists, so a missing target can never read green.
  > [!important] The divergence is resolved, and it makes the chevron a real defect
  > Penpot and the prototype had diverged: the carousel chevron is `#F0C75E` on cream in Penpot (**1.42 — fails**) but sits on the dark burn screen in the prototype (`.swipe-hint .chev` on `--surface-camera #121418` = **11.45 — passes**). With Penpot as the reference, **the chevron fails and must be recoloured in Penpot** — the prototype's passing dark-background version no longer counts as an excuse.
- [ ] **Expect alignment/display breaks in real CSS, and machine-check them rather than eyeballing** — the prototype is a *fixed-canvas mockup*, and the census explains why the real build will drift: **470 hardcoded px values · 43 `position:absolute` · 38 translate transforms · 0 `clamp()/min()/max()` · 0 safe-area insets · 1 media query** (and that one is a `max-height:980px` desktop-frame tweak — grep-verified S22, not responsive, and no `prefers-reduced-motion` exists anywhere in `prototype/`). Everything is pinned to `.phone{width:390px;height:844px}`, and the notch is a decorative div rather than `env(safe-area-inset-*)`. Port the `render-check.js` pattern (headless Firefox + ImageMagick, machine-read verdicts) to measure real rendered boxes at several device sizes instead of finding the overflow by eye. **Since the prototype is retired, treat these numbers as a warning about what the real build must avoid, not a work queue against `prototype/styles.css`** — the census describes the failure mode to design out from the start (fluid type, `env(safe-area-inset-*)`, real breakpoints), and the checks belong in the new build's CI, not bolted onto the mockup. → ✅ **DONE 2026-09-30 (S22):** the fix class is now the build's foundation — `design-system/responsive.css` (fluid `clamp()` type · `env(safe-area-inset-*)` patterns · the one earned breakpoint · 44 px targets, gutters and insets measured off the file) with `design-system/responsive-check.js` (**21/21**) re-deriving every clamp() at the 390 px reference and asserting the invariants; the build-stylesheet scan runs automatically the moment a build CSS exists.
- [x] **Jira: `SCRUM-45` opened** — ♿ *Accessibility remediation: contrast tokens verified; Penpot palette fixes + responsive rules pending*. Carries the audited table above, the root cause, the blocked-on-Penpot note, and acceptance criteria (re-run → `clip 0 · occl 14 (swatch-only) · lowc 0`, plus `design-system/contrast-check.js --only=tokens` → **21/21**). Comments added to **`SCRUM-42`** and **`SCRUM-33`** recommending the PM **hold the colour sign-off** on the In Review boards until this lands — otherwise those boards need a second visual pass after the palette fix.
  > [!warning] The ticket and both comments were first filed with **wrong ratios**
  > They were written from a recalled session summary instead of this script's output — two pairings were listed as failures that actually **pass** (`#8B2F27` on cream = **7.56 AAA**, `#2F5D55` on cream = **6.80 AA**), and the finding counts were wrong (44/19/20/8 instead of the real 84/26/16/4). All three were corrected in place against `occlusion-contrast-audit-v3.js` plus an independent recompute. **Rule going forward: quote the audit script's output, never a summary.**



#### Validation
- [x] Create simple prototype to test core concept → **clickable core-loop prototype** built (Session 3, 2026-09-24)
- [x] Review prototype v1 with the user → **feedback applied** (Session 4): car offering (vase retired), ancestral-tablet altar with add-tablet slot on Home, "user's actual object cartoonized" confirmed, throw now curves and lands inside the fire
- [x] Review prototype v2 with the user → **feedback applied (Session 7)**: the altar **ships empty** and the user builds their own shrine — the ＋ opens an ancestor sheet (姓氏 + 名字 + 称谓 chips) whose text is painted onto the tablet, 姓＋氏 fallback when no given name is known, **4 tablets per altar**, tap a tablet to edit or remove. **Confirmed (Session 9): keep the current convention as-is** (4 tablets per altar · 姓氏 + 名字 + 称谓 chip · 姓＋氏 fallback) — no change needed. Three render faults were also found by eye and fixed (slot double-positioned, baselines in the wrong coordinate space, and the censer's sticks/embers swallowing taps aimed at the ＋ and at the tablets they cross) — all three now machine-checked: **133/133** markup assertions + **20/20** browser render checks
- [x] Review prototype v3 with the user → **feedback applied (Session 8)**: the throw now has **real aim**, so it is possible to miss and accuracy pays. Where you release decides the band — 正中 (the fire's heart) ×2.0 · 虔誠 ×1.5 · 擦邊 (on the coals) ×1.0 · 偏失 (past the pit) ×0 — and the band decides the reward (**1,650 / 1,250 / 850 / 0**). The target is measured off the fire's own artwork at runtime; two bugs had made two bands unreachable (a scanline that found zero width below the drawing, and a measurement taken in the wrong unit space). Verified by a new tool — **16/16** aim checks: `prototype/tools/aim-check.js`
- [ ] Identify potential beta testers (family members, cultural practitioners)
- [ ] Plan user testing approach
- [ ] Define success metrics for MVP

---

### 📅 Medium-Term Actions (Next 1-2 Months)

#### Technical Development
- [ ] Determine cartoonization approach (existing AI APIs vs custom model)
- [ ] Research AR fire implementation options
- [ ] Plan core game loop implementation
- [ ] Set up development environment and tools
- [ ] Create initial prototype with basic AR burning mechanic

#### Business Planning
- [ ] Research advertising platforms suitable for family-oriented content
- [ ] Plan monetization timeline and strategy
- [ ] Consider legal/cultural consultation needs
- [ ] Plan community building approach

---

### 🎯 Key Questions to Answer in Next Session

1. **Technical Approach**: What's the best way to implement cartoonization? (existing AI APIs vs custom model)
2. **AR Framework**: Which AR framework should we use for development?
3. **Monetization**: How do we integrate advertising without disrupting the experience?
4. **Timeline**: What's a realistic timeline for MVP given technical learning curve?
5. **Validation**: What's the simplest way to test if people want this?

---

### 📚 Resources to Explore Before Next Session

#### Technical Research
- AI cartoonization APIs and tools
- AR development frameworks documentation
- Pokémon GO AR implementation patterns
- Duolingo leaderboard mechanics

#### Cultural Research
- Existing joss paper designs and styles
- Traditional burning rituals and symbolism
- Family memorial practices in Chinese culture

#### Business Research
- Family-oriented advertising platforms
- Mobile app monetization strategies
- AR app development costs and timelines

---

### 🤝 Notes for Next AI Session

**User Role**: Product Manager/Project Manager  
**Technical Level**: Software developer but not mobile app specialist  
**Development Approach**: AI vibe coding  
**Timeline**: No pressure - hobby project with family legacy vision  

**Priority**: Get cartoonization style right, then build simple AR burning mechanic

---

*Created: 2026-09-22*  
*Updated: 2026-10-02 (Session 26 — SCRUM-8 closed as planning) - 🎯 **The AR framework question is answered and recorded: [[AppDesignConceptBoard/ADRs/ADR-003-non-ar-ar-mvp-ar-framework|ADR-003]] accepted** — the MVP's "AR" is ***non-AR AR*** (live `expo-camera` preview + a fixed-position RN overlay; the fire is a ≤400 KB sprite sheet, ≤30 fps on Tier F). **ARKit / ARCore-direct / Unity / web-AR / `react-native-arkit` all rejected** (world-locking is deliberately unwanted; a native module would break the Tier F floor and Expo Go). **True AR deferred to post-MVP** via four exit ramps (SceneView RN → Scene Viewer intent → react-viro → bounded Kotlin module). New **[[AppDesignConceptBoard/17-ar-fire-spike-plan|doc 17]]** = the **proof-of-concept plan** (fire over a live camera on the Tier F floor device, gated by N3/N4/N10 + the aim bands) — **execution deferred** to the repo+CI milestone (SCRUM-15) + the floor device. ⚠️ **Reconciled:** SCRUM-17's *"60 fps"* vs doc 14's *30 fps floor / 60 fps Tier-M target* — doc 14 is the authority, and the **aim bands are the acceptance test**. ADRs register now **5 accepted (001 · 002 · 003 · 005 · 007)**; docs 11–17 added to the concept-board index. Next: repo + CI → the AR-fire spike.*  
*Updated: 2026-10-01 (Session 24 — SCRUM-24 planned & closed; validation deferred) - 🧧 new vault doc `16-cultural-consultation-and-ritual-review`: advisor list · bilingual 10-question review sheet (tier names · throw · fire's heart · miss/return · tablets · clan altar · festivals · money · ads · names) · pre-decided will/won't-change policy · outcome record template · screenshot-pack checklist (board names + copy verified live in Penpot). Finding: the ZH copy mixes scripts — confirmed **within one board** (`ZH · 4 Burn`: traditional 虔誠 · 擦邊 beside simplified 焚烧仪式); Q1 settles it. **PM decision: seek validation only once the app is functional.** Jira: SCRUM-24 → **Done (planning)** · **SCRUM-49 filed** (Low · Relates) carries the execution (live-app prep → book → run → record). Nothing changed in Penpot/app (bridge used read-only).*  
*Updated: 2026-09-30 (**Session 23 — clan model & Book of Tributes**) - 🕯️ **SCRUM-22 spec ✅ Done & closed**: new vault doc `15-clan-model-and-book-of-tributes` (roles ladder · create/join/invite flows · shared ancestors · Book of Tributes · EN/ZH copy C1–C17) + **07-system-architecture → v2.7** (clans + clan_members; ancestors clan-owned; burns/tributes + clan_id; §7 Q3 answered). PM locks: clan-scoped offerings · no non-clan altar · cap 10 + future slot monetization. Jira: SCRUM-22 Done · **SCRUM-47** filed (slots · Low) · **SCRUM-48** filed (clan boards create/share/join · EN/ZH) · SCRUM-29 cross-ref. Next design = SCRUM-48; next build = SCRUM-46.*  
*Updated: 2026-09-30 - **Session 22 · SCRUM-45 responsive/safe-area criterion DONE — rules recorded and machine-checked.** `design-system/responsive.css` written from a fresh Penpot census (2,427 text shapes · 55 size/weight combos · 9→90 px; tab bar 80 px · 18 px clearance; gutter 20; no system chrome drawn): fluid clamp() display sizes anchored exactly at 390 · fixed rem small sizes (×1.5 scaling honoured) · safe-area patterns (top `max()` · bottom stacked) · the single earned breakpoint · 44 px touch targets · dvh pair · content cap. New guard `design-system/responsive-check.js` **21/21**; `contrast-check.js` **22/22** — its lint now always scans the foundation instead of skipping, so the build-CSS criterion is one `--css=` away when the build lands. Still open: PM visual review of the 47 boards → release the colour hold on `SCRUM-42`/`SCRUM-33`; CI wiring with repo+CI (SCRUM-15).*  
*Updated: 2026-09-29 (later) - **Session 21 continued · SCRUM-45 TRANCHE 2 APPLIED — the colour/contrast work is now genuinely complete and verified.** The PM gave the visual call ("apply now"). **132 genuine AA body-text failures cleared by 120 shape edits (112 text + 8 discs) across 47 boards** — `--gold-text` 112 · `--cinnabar-text` 4 · `--malachite-text` 2 · `--disc-malachite` 6 · `--disc-gold-deep` 2. 🔴 **Caught during verification: 4 of the 5 planned token hexes were WRONG** — hand-carried into the notes, they contradicted `design-system/tokens.css`, were *over-dark*, and reintroduced the very Penpot↔tokens drift that caused this tranche. Re-applied to the canonical values on **14 shapes**; canonical ratios **4.51–5.82**, all ≥4.5. Re-audit: **`clip 0 · occl 14 (byte-identical to baseline) · lowc 0 · lowcAA 0 · largeLow 0`** over 135 boards / 2,453 text shapes; `contrast-check.js` **21/21**; **text-role census `#a8862a` 0 · `#0e9b78` 0** — the palette is internally consistent. ✅ The **4 legitimate large-text passes were NOT darkened** (`logo · Joss` 40/800 · `miss · glyph` 90/700 — still `#c23b22`). Penpot versions: **`revn 226` pre-tranche rollback · `revn 229` post-fix**. **Tooling fixed:** `penpot-sweeps/occlusion-contrast-audit-v3.js` now carries **`runAudit4`** with a `lowcAA` (4.5) bucket + `largeLow` — **`lowc 0` is NOT AA compliance and must never be reported as such again**. 🩹 **`SCRUM-45` is still NOT closeable** — the responsive/safe-area criterion is outstanding. **Colour hold on `SCRUM-42`/`SCRUM-33` STAYS** until the PM visually reviews the 47 changed boards. Next: PM visual review → reassess the colour hold → close the responsive criterion in the real build's CSS.*  

*Updated: 2026-09-28 (end of day) - **Jira `SCRUM-45` opened** for the accessibility remediation (the 4 Penpot token swaps + responsive rules), with comments on `SCRUM-42` and `SCRUM-33` recommending the colour sign-off be held until it lands. `design-system/tokens.css` + `contrast-check.js` recorded in [[next-ai-context]] as the verified token reference (20/20). **Blocked on the Penpot connection.** Tomorrow: confirm connection → apply the 4 swaps → re-run `runAudit3` (target `clip 0 · occl 14 · lowc 0`) → ~~close SCRUM-45~~ **⚠️ superseded 2026-09-29 — that plan assumed `lowc 0` meant AA compliance. It does not: the audit threshold is `<3.0`, and 132 AA body-text failures remain outside that set. `SCRUM-45` is In Progress, not closeable. See the 2026-09-29 entry above.***  
*Updated: 2026-09-28 - Accessibility sweep of the Penpot UI: all 135 boards audited read-only for clipping, z-order and text contrast (`penpot-sweeps/occlusion-contrast-audit-v3.js`). The "first tab obscured" defect was confirmed real and fixed by z-order in 6 ancestor sheets; 0 clipping defects; the 14 occlusion alarms dismissed as intentional swatch previews; **130 low-contrast findings across 47 boards traced to just 4 colour tokens** — open, with WCAG-compliant replacements computed  
*Updated: 2026-09-25 - Sessions 11–12: app frame (splash/store/collection) + ancestor sheet & altar states built in Penpot (26 boards, EN + 中文, wired); location-value confirmed hidden; mockup port to Penpot marked complete  
*Updated: 2026-09-24 - Session 9: parked decisions folded in (tap-target direction; tablet naming confirmed as-is); mockup port now targets **Penpot**  
*Purpose: Track follow-up actions and prepare for next development session*

#### 🎯 SCRUM-8: AR framework & mode — **✅ DONE (planning) 2026-10-02**
- [x] **Framework recommendation + justification** → the MVP uses **no AR framework** — *non-AR AR* = `expo-camera` live preview + a fixed-position RN overlay. **ARKit / ARCore-direct / Unity / web-AR / `react-native-arkit` all rejected** → [[AppDesignConceptBoard/ADRs/ADR-003-non-ar-ar-mvp-ar-framework|ADR-003]]
- [x] **Technical architecture overview** → camera preview behind a fixed-position fire **sprite overlay** (≤ 400 KB, ≤ 30 fps Tier F); the four aim bands ported from the retired prototype; structure already in [[AppDesignConceptBoard/07-system-architecture]] §2
- [x] **Proof-of-concept plan for the AR fire mechanic** → [[AppDesignConceptBoard/17-ar-fire-spike-plan|doc 17]] — fire over a live camera on the **Tier F floor device**, gated by **N3/N4/N10** + the aim bands
- [ ] **Run the AR-fire spike** — execution **deferred** to the repo+CI milestone (SCRUM-15) + the Tier F floor device (doc 14 §1) → tracked as a follow-up Jira ticket

#### 🎯 SCRUM-17: MVP Vertical Slice Scope (2026-10-02)
- [x] Pick the one object type and one ancestor for the slice → **DONE**: car (variant D, 37 faces) + generic placeholder ancestor
- [x] Define the happy path + three failure paths → **DONE**: AI fail · network fail · throw miss documented with error handling
- [x] Write acceptance criteria, including the measured aim bands → **DONE**: cold start <3s, cartoonization <10s p95, 60fps AR overlay, offline queue <5min, all 4 aim bands verified
- [x] Agree the demo script — what a family alpha tester actually sees → **DONE**: "First Burn" 10-minute scenario documented

#### 🏗️ MVP Architecture (next session — see [[AppDesignConceptBoard/05-concept-to-mvp-gap-analysis]])
- [x] **Close the platform & runtime decision** (native ×2 · Flutter/RN · Unity · web-first) — everything else depends on it (feeds SCRUM-10) → **DONE 2026-09-26**: Option A — Expo / React Native (TypeScript) + Supabase + hosted AI APIs, Android-first

