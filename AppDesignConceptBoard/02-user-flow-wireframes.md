# 📱 02 - User Flow & Wireframes

> **JIRA**: SCRUM-9 | **Status**: 🔄 In Progress — Phase 3, Penpot: 26 boards (EN + 中文, wired) | **Started**: 2026-09-23
> **Goal**: Map the complete user journey and sketch every core screen before development.

---

## 🗺️ Core User Flow (First Draft)

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  LAUNCH     │────▶│  ONBOARD    │────▶│  HOME /      │
│  (splash)   │     │  (tutorial) │     │  SHRINE      │
└─────────────┘     └─────────────┘     └──────┬───────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
                    ▼                          ▼                          ▼
            ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
            │  CAPTURE    │            │ LEADERBOARD │            │  PROFILE /  │
            │  OBJECT     │            │  (league)   │            │  COLLECTION │
            └──────┬──────┘            └─────────────┘            └─────────────┘
                   │
                   ▼
            ┌─────────────┐
            │  AI CARTOON-│
            │  IZATION    │  ← KEY MOMENT: user sees their object transform
            └──────┬──────┘
                   │
                   ▼
            ┌─────────────┐
            │  AR BURN    │  ← Aim + throw into fire, burn animation
            │  RITUAL     │
            └──────┬──────┘
                   │
                   ▼
            ┌─────────────┐
            │  REWARD     │  ← Tribute points, streak, value breakdown
            │  SCREEN     │
            └─────────────┘
```

---

## 📋 Screen Inventory

| # | Screen | Purpose | Priority | Status |
|---|--------|---------|----------|--------|
| 1 | **Splash / Launch** | Brand moment, loading | Low | ⏳ |
| 2 | **Onboarding** | Explain concept, permissions (camera, location) | High | ⏳ |
| 3 | **Home / Shrine** | Main hub - daily streak, quick burn entry | High | ⏳ |
| 4 | **Camera / Capture** | Photograph object to offer | High | ⏳ |
| 5 | **Cartoonization Preview** | See transformation, accept/retry | High | ⏳ |
| 6 | **AR Burn Ritual** | Aim & throw into AR fire | High | ⏳ |
| 7 | **Burn Result / Reward** | Points earned, streak update | High | ⏳ |
| 8 | **Item Selection** | Choose item to burn (own photo or standard item) | Medium | ⏳ |
| 9 | **Leaderboard / League** | Duolingo-style ranking | Medium | ⏳ |
| 10 | **Profile & Collection** | History, tribute total, settings | Medium | ⏳ |
| 11 | **Location Value Map** | Show nearby value zones (privacy-safe) | Low | ⏳ |
| 12 | **Streak / Calendar** | Daily streak visual | Low | ⏳ |
| 13 | **Shop / Item Bundles** | Buy standard offerings (post-MVP) | Deferred | ⏳ |

---

## 🔍 Screen Details To Sketch

### Screen 3: Home / Shrine
**Key elements:**
- Big, obvious **"Make an Offering"** button for 40-50s audience
- Current Tribute Points (prominent number)
- Streak indicator (e.g. 🔥 12 days)
- Mini leaderboard position preview
- Calm, warm aesthetic - like entering a temple

**Open questions:**
- Does the shrine have a persistent burning candle/incense visual?
- How do we show "you have X items to offer"?

**Altar states (S12, built in Penpot)** — `1` **empty** (＋ invite, "Your altar is empty — tap ＋ to add a tablet.") · `1b` **partial carousel** (3 tablets, centre full size + 72% neighbours, gold chevrons; "3 ancestors enshrined — swipe or tap a tablet to edit.") · `1c` **full** (4 tablets, no ＋, "…this altar is full."; the forward chevron dims at the edge). The **ancestor sheet** (`1s` add · `1s2` edit) carries the whole build: 姓氏 ＊ · 名字（选填） · 称谓 chips (EN: Grandfather… / 中文: 祖父…) · **live tablet preview** (the preview *is* the tablet — same builder as the altar), 姓＋氏 fallback taught in the hint, and ≥44 px **invisible touch targets** throughout (S9 decision applied; the ＋ slot was wired live in S12).

### Screen 4-5: Capture → Cartoonization
**Key elements:**
- Camera view with framing guide
- "Transforming..." animation (this is the magic moment)
- Before/after slider so user can compare
- Retry button (AI won't always nail it)

**Open questions:**
- How long is acceptable for AI processing? (2-5s target?)
- Offline behaviour - queue the cartoonization?
- What if the photo is unrecognisable? Fallback to standard item?

### Screen 6: AR Burn Ritual
**Key elements (inspired by Pokémon GO catch):**
- Camera view of real environment
- Fire positioned in front of user (fixed screen position)
- Cartoonized object "held" at bottom of screen
- Swipe-up-to-throw gesture with aiming guide
- Burn animation: object → crisp → ash → value explosion 💥

**Answered (Session 8 → 9):**
- Does accuracy matter physically (timing/speed) or just visually (aim position)? → **Visually (aim position)** — the release point is graded in four bands (正中 ×2.0 · 虔誠 ×1.5 · 擦邊 ×1.0 · 偏失 ×0)
- What feedback for a miss? (Respectful - not punishing on a ritual!) → **Decided (Session 9): a miss pays 0 but allows a re-attempt — the rethrow is penalised and can never score the top tier (正中)**

### Screen 7: Reward
**Key elements:**
- Points number animating up
- **Breakdown**: base value × aim band (正中 ×2.0 / 虔誠 ×1.5 / 擦邊 ×1.0 / 偏失 ×0 — Session 8) × location bonus
- Streak +1 celebration
- "Share" option? (maybe deferred)



---

## 🧩 UX Patterns to Borrow

| Source | Pattern | How We Adapt It |
|--------|---------|-----------------|
| **Pokémon GO** | AR throw mechanic (swipe to throw ball) | Swipe to throw offering into fire |
| **Pokémon GO** | Fixed-position AR target | Fire stays centred in front of user |
| **Duolingo** | League leaderboard (30 users, similar level) | "Tribute League" with nearby/similar users |
| **Duolingo** | Streak flame + freeze feature | Respectful equivalent (e.g. "Remembrance Flame") |
| **Pokémon GO** | Catch rate feedback (Excellent/Great/Nice) | Throw feedback (e.g. "Sincere / Devout / Gracious") |
| **Duolingo** | Bite-sized daily goal | "One offering a day" gentle goal |

---

## 🎨 Accessibility Notes (Target: 40-50s users)

- ❌ No tiny text, no low-contrast gold-on-yellow
- ✅ Minimum 16pt body text, large buttons (48px+ touch targets)
- ✅ High contrast for AR overlay elements (readable in sunlight)
- ✅ Clear Chinese/English labelling where appropriate
- ✅ Haptic feedback for throws (feels satisfying without looking)
- ⚠️ Consider users with reading glasses - avoid thin light fonts
- 📐 **Home layout (Session 9)**: the **shrine + tablets take a larger share of the screen**; supporting elements (points, streak, buttons) shrink accordingly — proportion to be **iterated later**

---

## 🔍 Tasks

### Phase 1: Flow & Sketches
- [ ] Finalise the core flow diagram (this doc)
- [ ] Sketch each High priority screen (paper or Penpot)
- [ ] Define gesture interactions (swipe to throw, pinch, tap)
- [ ] Design the cartoonization "reveal" moment

### Phase 2: Wireframes
- [ ] Low-fi wireframes of all screens 1-8
- [ ] Interactive prototype of core loop (capture → burn → reward)
- [ ] Annotate flows with states (loading, error, empty)

### Phase 3: Deliverables
- [ ] Full wireframe set
- [ ] Clickable prototype for user testing
- [ ] Design handoff notes

---

## 📌 Open Questions

1. What's the very first thing a new user should do - tutorial burn or guided capture?
2. One-session flow vs daily engagement flow - how do they connect?
3. Should the AR fire be persistent (always visible on home) or only during ritual?
4. How do we handle users who have "nothing worth burning"? (→ standard items flow)
5. Tablet/landscape support in MVP, or phone portrait only?

---

*Last updated: 2026-09-25 — Session 12: the altar's state set (empty · partial · full) and the ancestor sheet (add/edit) are built in Penpot, EN + 中文, wired; the ＋ slot went live. Earlier: Session 9 decisions folded in (miss → rethrow with penalty; altar-first Home sizing — iterate later; tablet naming confirmed); design tooling: Figma → Penpot*
