# 19 · Build plan — services, API, environments & the setup split

**Date:** 2026-10-03 (Session 27) · **Jira:** SCRUM-54 (backend of record) · SCRUM-53 (slice) · SCRUM-56 (PM provisioning) · SCRUM-57 (repo bootstrap)
**Status:** 📋 **plan — nothing built yet.** This is the how-to-stand-it-up companion to the architecture.
**Depends on:** [[ADRs/ADR-001-option-a-expo-rn-supabase-hosted-ai|ADR-001]] (the locked stack) · [[07-system-architecture]] **v2.8 — authoritative for services + schema** · [[ADRs/ADR-002-path-c-describe-then-generate|ADR-002]] (Path C) · [[ADRs/ADR-003-non-ar-ar-mvp-ar-framework|ADR-003]] (non-AR AR) · [[ADRs/ADR-005-honest-client-caps-append-only-ledger|ADR-005]] · [[ADRs/ADR-007-privacy-minimal-windowed-one-tap|ADR-007]] · [[10-economy-spec]] · [[11-integrity-posture]] · [[13-privacy-and-retention]] · [[14-nfr-device-and-performance-targets]] · [[15-clan-model-and-book-of-tributes]] · [[18-mvp-scope-and-timeline]] (M1)
**Feeds:** SCRUM-54 · SCRUM-53 · **SCRUM-56** (what the PM provisions) · **SCRUM-57** (what I bootstrap) · [[07-system-architecture]] v2.9 (the tidy in §9)

> **In one line:** doc 07 says **what the system is**; this doc says **how to stand it up** — the service build order, the complete API surface, the three-ring dev environment, the exact package manifest for Expo SDK 57, and a clean line between **what I can build in this repo with no accounts** (§6.1) and **what you must provision** (§6.2).

---

## 1 · Scope, and the one rule every API below obeys

This doc **does not re-specify** services or schema — doc 07 §3 and §5 are authoritative and this plan is written against them. It answers the four questions the build actually starts with: *in what order do the pieces go up, what are the exact interfaces, where does each piece run, and who sets up what.*

**The boundary rule (doc 07 §2, ADR-005) — every interface below is drawn to preserve it:**

> **The client *asserts*. The server *decides*. Only `award-service` writes money.**

### ✅ Verified while planning (2026-10-03) — the ADR-002 pipeline is still live and still the same price

The endpoints named in [[ADRs/ADR-002-path-c-describe-then-generate|ADR-002]] were checked against fal.ai's live catalogue — five months after the spike:

| Stage | Endpoint (ADR-002) | Live? | Today's price | ADR-002's number |
|---|---|---|---|---|
| ① identify | `fal-ai/moondream2/visual-query` | ✅ **live** | **$0.01** / 1,000 chars | $0.01/query |
| ② generate | `fal-ai/nano-banana-2` (t2i) | ✅ **live** | **$0.08** / image | $0.080/image |
| fallback (edit path) | `fal-ai/nano-banana-2/edit` | ✅ **live** | $0.08 / image | $0.080/image |
| | | | **→ $0.09/picture** | **≈US$0.09/picture** ✅ |

**The cost model still holds exactly.** One observation, flagged not adopted: a newer **`google/nano-banana-2-lite`** exists and advertises *sub-2 s* latency (vs the spike's p50 ≈ 13 s) — but it bills per **"unit"**, not per image, so it is **not comparable** without its own micro-benchmark. Under ADR-002 the choice is locked; a re-benchmark is an **ADR-002 amendment candidate → §9.5**, never a silent swap.

---

## 2 · Service inventory & build order

Twelve services (doc 07 §3), re-cut by **when they can physically go up** and **what they need to exist first**.

| # | Service | Tech | Runs locally? | Account needed | Ticket | Build order |
|---|---|---|---|---|---|---|
| 1 | **App client shell** | Expo Router (RN + TS) | ✅ Expo Go | — | **SCRUM-57** | **1** |
| 2 | **Shared domain modules** (tokens · catalogue · aim · award) | pure TS | ✅ Node 22 | — | **SCRUM-57** | **1** |
| 3 | **Postgres + RLS** (slice subset) | Supabase / Postgres 15+ | ✅ **Docker present** | — | SCRUM-54 | 2 |
| 4 | **Auth** (anonymous first) | Supabase Auth | ✅ | — | SCRUM-54 | 2 |
| 5 | **Storage** (private buckets) | Supabase Storage | ✅ | — | SCRUM-54 | 2 |
| 6 | **`cartoonize-orchestrator`** | Deno (Edge Fn) | ✅ `functions serve` | fal.ai key | SCRUM-54 | **3** |
| 7 | **`award-service`** | Deno (Edge Fn) | ✅ | — | SCRUM-54 | **3** |
| 8 | **Hosted AI** (Path C) | fal.ai | ⚠️ cloud only | **fal.ai** | SCRUM-54 | 3 |
| 9 | **Realtime** (league channel) | Supabase Realtime | ✅ | — | SCRUM-11 | 5 |
| 10 | **`weekly-roll`** (cron) | Deno (Edge Fn) | ✅ | — | SCRUM-11 | 5 |
| 11 | **Ads SDK** | TBD | ❌ | — | **post-ADR-008** | deferred |
| 12 | **Analytics** (opt-in) | TBD | ❌ | — | later | deferred |

**Read the "Account needed" column:** services **1–7 and 9–10 need no account at all** — they run on Docker + Node, both already on the machine. The **only** account that gates the slice is **fal.ai** (service 8), and even that is only needed for the *live call*, not for writing, typing or testing the code.

---
## 3 · The API contract

Four interface kinds: **2 HTTP Edge Functions + 1 cron**, **Postgres RPCs**, **Storage paths**, **1 Realtime channel** — plus client-only modules that need no server at all. Signatures follow doc 07 §4 exactly; this section makes them **callable** (exact names, bodies, idempotency, who decides).

### 3.1 Edge Functions (HTTP, via `supabase.functions.invoke`)

| # | Function | Call | Auth | Body | Idempotent on | Returns |
|---|---|---|---|---|---|---|
| F1 | **`cartoonize-orchestrator`** | `POST /functions/v1/cartoonize-orchestrator` | user JWT | `{ capture_id }` | `capture_id` (one job per capture) | `{ job_id, status: 'queued'\|'styled'\|'rejected', styled_path? }` |
| F2 | **`award-service`** | `POST /functions/v1/award-service` | user JWT | `{ capture_id \| item_code, ancestor_id?, accuracy, cell_hash?, client_time }` + `Idempotency-Key` header | `idempotency_key` (UNIQUE → replay-safe) | the **reward receipt**: `{ band, award, new_ground, streak_day, tribute_balance, idempotent_replay }` |
| F3 | **`weekly-roll`** | cron (`pg_cron` / scheduled) | service role | — | `week_id` (one roll per week) | writes `weekly_rolls`; no client caller |

**F2 is the only writer of money.** No other path touches `ledger_events` (doc 07 §2, ADR-005 §8).

### 3.2 Postgres RPCs (`supabase.rpc(...)`)

| RPC | Caller | Purpose | Client *asserts* | Server *decides* |
|---|---|---|---|---|
| `request_cartoonize(capture_id)` | app | quota gate → insert `cartoonize_jobs` | which capture | **quota open?** · day rollover · job insert |
| `submit_burn(payload, idempotency_key)` | app | the burn + award transaction | `accuracy` · `cell_hash` · `client_time` | **band (derived from `accuracy`)** · award · clamp `0…1,650` · streak · new-ground · decay tick |
| `get_league_board()` | app | the board | — | ranking = `SUM(weekly tribute)` per cohort |
| `preview_clan(code)` | app | resolve an invite → preview card | the code | whether it resolves; **never ancestor names before joining** (13 §4) |
| `join_clan(code)` | app | join instantly (no approval queue) | the code | membership + role · rate limit |
| `create_clan(name)` | app | found a clan → head | the name | id · `code` generation · `ancestor_cap = 10` |
| `reroll_clan_code(clan_id)` | head | rotate the invite capability | — | head check · new 8-char code |
| `save_ancestor(...)` | app | add/edit a tablet | `surname` · `given_name` · `relationship` | **clan cap** (`clans.ancestor_cap`) · slot |
| `purchase_item(item_code, idempotency_key)` | app | spend store points | the **intent** | **price re-read from code constants** (a tampered client cannot set its own price) |
| `equip_decoration(slot, item_code)` | app | place a decoration | slot + item | ownership · **one-set-per-category** (S14k) · 6-slot grid |
| `delete_my_data()` | app | the one-tap delete (ADR-007) | — | cascade + tombstone (`cohort_members.user_id → NULL`) |

### 3.3 Storage — private buckets, signed URLs only

```
captures/{user_id}/{capture_id}.jpg     raw photo   · ≤300 KB · 7-day retention (13 §2)
styled/{user_id}/{capture_id}.png       styled D    · ≤150 KB sprite (14 §3)
```

> ✅ **Resolved — doc 07 v2.9.** §3 previously implied a `tributes` bucket, but [[15-clan-model-and-book-of-tributes]] §7 gives the Book of Tributes **no image**. The bucket is now removed from the architecture; **do not create it.** Fewer privacy surfaces is strictly better (13 §4).

### 3.4 Realtime

| Channel | Payload | Why | Fallback |
|---|---|---|---|
| `league:{cohort_id}` | re-rank tick after a burn | "the board re-ranks live" | **the DB query is authoritative** — the channel is a hint; a dropped socket must never corrupt state |

### 3.5 Client-only modules (no server, no cost, works offline)

| Module | Does | Why it is client-side |
|---|---|---|
| **Invite link + QR encode** | `react-native-qrcode-svg` from the cached `code` | zero cost/latency · works offline · the code leaves the device only via the share action the user chose (07 §4.6) |
| **Deep-link parse** | `expo-linking` → if first-run is incomplete, **hold the invite** and apply it after | invites arrive from outside the app (07 §4.6) |
| **Aim band derivation** | `deriveBand(accuracy)` — instant feedback on the throw | the *feel* must be instant; **the server re-derives the authoritative band** on submit |
| **Offline queue** | `expo-sqlite` + `idempotency_key` | cross-day durability is a **requirement** (14 N6), not a nicety |

### 3.6 The trust boundary, in one table

| Value | Client | Server |
|---|---|---|
| `accuracy` (the throw) | **asserts**, and cannot be verified | accepts **with caps** → derives the band; **the client never sends `band`** (ADR-005) |
| `band` | display only | **derived** |
| `award` | display only | **computed**, clamped `0…1,650`, then ledgered |
| **price / base_value** | displays from code constants | **re-reads** from code constants |
| quota · streak · new-ground | displays the last known | **recomputes** |
| `cell_hash` | asserts a coarse cell | accepts; stores **the cell only — never a trail** (13) |
## 4 · Development environments — three rings

Three rings, so the daily loop never waits on the cloud and the cloud never gets used for what Docker can do locally.

```
 RING 1 · LOCAL (daily loop, Fedora 44)          ← 95% of the work happens here
   Node 22.23 ✅ · npm 10.9 ✅ · Docker 29.8 ✅ · Supabase CLI ❌ · Android SDK/emulator ❌
   Postgres + Auth + Storage + Edge runtime all local, in Docker.  No account. No network. No cost.
        │
 RING 2 · DEVICE (proof it runs on real glass)
   Expo Go  (the slice — no native modules, by ADR-003)  →  dev build when a native module lands
   Android emulator (KVM) for speed  ·  the Tier-F device (SCRUM-52) for truth
        │
 RING 3 · CLOUD (shared state + the only metered spend)
   Supabase hosted (free)  ·  fal.ai (metered AI)  ·  EAS (free builds)  ·  Play Console ($25, at submission)
```

### 4.1 Ring 1 — what is *already on this machine* (checked 2026-10-03)

| Tool | State | Note |
|---|---|---|
| **Node** | ✅ **v22.23.1** | SDK 57's floor is **22.13.x** — satisfied. *(the README's "≥ 20" is now wrong → §9.4)* |
| **npm** | ✅ 10.9.8 | the repo uses npm (`package-lock.json`) |
| **Docker** | ✅ **29.8.1** | **this is the big one** — the whole local Supabase stack runs on it, so services 3–7 need no account |
| **Java** | ✅ 25 | needed for Android builds; **Android SDK + emulator still missing** |
| **Supabase CLI** | ❌ **not installed** | the single missing local tool → §6.2 item 3 |
| **Android SDK / emulator (KVM)** | ❌ | optional if the physical device lands first (SCRUM-52) |

**The daily loop, once the CLI is in:**
```bash
supabase start                 # Postgres + Auth + Storage + Studio + Edge runtime, in Docker
supabase db reset              # re-apply migrations + seed.sql from scratch (repeatable, safe)
supabase functions serve       # Deno runtime, with secrets from supabase/.env.local
npx expo start                 # the app, against the LOCAL backend
```
`EXPO_PUBLIC_API_BASE_URL=http://localhost:54321` (already sketched in `.env.example`) is what points the app at Ring 1 instead of Ring 3.

> ⚠️ **An Android emulator reaches the host's local Supabase at `10.0.2.2`, not `localhost`.** A physical device needs the host's LAN IP. Worth knowing before the first confusing *"network request failed"*.

### 4.2 Ring 2 — the device loop

- **Expo Go carries the entire slice.** ADR-003 (non-AR AR) means **no native module is needed** — `expo-camera` + RN views ship in Expo Go. That is a deliberate scheduling advantage: the slice can be demoed on a real phone *before* a dev build exists.
- A **development build** (`npx expo run:android` locally with the Android SDK, or `eas build --profile development`) is required the moment a module outside Expo Go's bundled set lands. None is planned for the slice.
- **The Tier-F device is the truth; the emulator is only speed.** N1: no milestone completes without a run on the named device.

### 4.3 Ring 3 — cloud services, and the *only* two that bill

| Service | Tier | Bills? | Gates |
|---|---|---|---|
| **Supabase hosted** | free | no (until scale) | the slice's persist step + anything shared |
| **fal.ai** | metered | ⚠️ **yes — ≈$0.09/picture** | the live Path C call — **the only real spend in the MVP** |
| **EAS** | free tier | no | cloud Android builds; iOS later |
| **Play Console** | $25 once | no (one-off) | submission only — **not now** |

### 4.4 Environment variable matrix

| Variable | Lives in | Ring 1 (local) | Ring 3 (cloud) | Secret? |
|---|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | app bundle | `http://localhost:54321` | project URL | no (public) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | app bundle | local anon key | project anon key | **no — RLS is what protects it** |
| `EXPO_PUBLIC_API_BASE_URL` | app | optional override | unused | no |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Fn secrets **only** | `supabase/.env.local` | `supabase secrets set` | 🔴 **yes — never in the bundle** |
| `FAL_KEY` | Edge Fn secrets **only** | `supabase/.env.local` | `supabase secrets set` | 🔴 **yes — never in the bundle** |

The rule is already encoded in `.env.example` (written at SCRUM-15): `EXPO_PUBLIC_*` is public by definition; the AI key and the service-role key exist **only** server-side. **The build must not weaken this.**

---
## 5 · Dependency manifest — exact, for Expo SDK 57

Installed with **`npx expo install`** (never `npm install` for Expo-namespaced packages — it resolves the SDK-compatible version). SDK 57 = **React Native 0.86 · React 19.2.3 · compileSdk/targetSdk 36 · Android 7+**.

### 5.1 App runtime

```bash
# navigation & shell — expo-router is file-based; routes live in src/app/ (AGENTS.md)
npx expo install expo-router react-native-safe-area-context react-native-screens \
                 expo-linking expo-constants expo-status-bar

# the ritual (ADR-003 + 14 §3)
npx expo install expo-camera expo-image-manipulator expo-image expo-haptics

# offline durability + secure session (14 N6)
npx expo install expo-sqlite expo-secure-store expo-crypto

# i18n (EN / 中文), fonts, splash, app metadata
npx expo install expo-localization expo-font expo-splash-screen expo-application expo-file-system

# backend + the throw's animation
npm i @supabase/supabase-js
npx expo install @react-native-community/netinfo react-native-reanimated react-native-gesture-handler

# invite QR (07 §4.6 — client-side encode)
npx expo install react-native-svg && npm i react-native-qrcode-svg

# tiny i18n runtime
npm i i18n-js
```

### 5.2 Edge Functions (Deno runtime — `supabase/functions/*/index.ts`)

| Package | Why |
|---|---|
| `@supabase/supabase-js` | the service-role client inside the function |
| `@fal-ai/client` | **Path C** — `moondream2` identify → `nano-banana-2` t2i (ADR-002) |
| `zod` | validate the model's JSON **before it drives a prompt** (the `validate` stage in 07 §4.2) |

### 5.3 Dev & test — stay dependency-free where possible

The CI habit is **plain Node scripts with no `npm install`** (`.github/workflows/ci.yml`, design-system job). The domain logic is *pure TypeScript*, so the slice's **T2 headless acceptance test** keeps that property: run the aim/award checks directly with **Node 22's built-in type stripping** — no Jest, no tsx, no install. `jest-expo` is only worth adding if RN *component* tests become necessary; it is **not** needed for the slice.

### 5.4 ⚠️ Four traps to verify at install time — **do not trust memory** (AGENTS.md)

| # | Trap | What to do |
|---|---|---|
| **T1** | **Reanimated's Babel plugin moved.** v3 used `react-native-reanimated/plugin`; v4 moved worklets to **`react-native-worklets/plugin`** | read the installed major, then set `babel.config.js` to match. A wrong plugin fails **silently at runtime**, not at build |
| **T2** | **`expo-secure-store` has a value-size limit** (~2 KB) | a Supabase JWT can exceed it → use the documented split-storage pattern (small key in SecureStore, bulk in AsyncStorage) as the auth storage adapter |
| **T3** | **Supabase + React Native `URL` polyfill** | historically `react-native-url-polyfill/auto` is required; RN 0.86 may have a native `URL`. Check the *current* Supabase RN guide, not memory |
| **T4** | **`expo-file-system` vs `expo-file-system (legacy)`** — SDK 57 ships both | import from the **current** package; the legacy API is a trap in a new build |

---
## 6 · The setup split — what I build vs what you provision

### 6.1 What I build — **no account, no secret, no spend** (SCRUM-57 + the first half of SCRUM-54)

| # | Work item | Deliverable | Needs |
|---|---|---|---|
| **A** | **App shell** | `expo-router` skeleton: `src/app/_layout.tsx` + typed routes for Home · Capture · Burn · Reward; **replaces the `App.tsx` placeholder** | — |
| **B** | **Theme bridge** | `src/theme/tokens.ts` — the RN mirror of `design-system/tokens.css` (brand · `-text` · `-on` · disc tokens, type scale, spacing). **One source of truth:** the CSS belongs to the design file, the TS to the build, and a check asserts they agree | — |
| **C** | **Domain modules** (pure TS) | `src/domain/`: `catalogue.ts` (offerings + decorations, `base_value = 1.2 × price`) · `aim.ts` (**the four art-derived bands**) · `award.ts` (`400 × band × ground + 50`, clamp `0…1,650`) · `quota.ts` · `currency.ts` | — |
| **D** | **The acceptance test** | `node`-runnable checks for **aim bands + award maths + the wallet invariant** — the T2 harness *and* the SCRUM-53 acceptance test | — |
| **E** | **Local backend** | `supabase/config.toml` · `migrations/` for the **slice subset** (`profiles` · `clans` · `clan_members` · `ancestors` · `captures` · `cartoonize_jobs` · `burns` · `ledger_events` · `quotas` · `streaks` · `rate_counters` · `consent_records`) **with RLS on every table** · `seed.sql` | Docker ✅ |
| **F** | **The three Edge Functions** | `cartoonize-orchestrator` (Path C + zod validate + cost/latency recording) · `award-service` (**the only money writer**) · `weekly-roll` (stub) | — *(a live call needs the fal key)* |
| **G** | **The RPCs** | the SQL functions in §3.2 — `submit_burn` first, it is the slice's spine | — |
| **H** | **Client libs** | `supabase.ts` (client + auth storage adapter) · `queue.ts` (expo-sqlite, cross-day) · `idempotency.ts` · `invites.ts` (link + QR) · `i18n.ts` (EN/中文) | — |
| **I** | **CI expansion** | add `expo lint` + the domain tests + `supabase db lint` to `.github/workflows/ci.yml` | — |
| **J** | **Docs** | README + CONTRIBUTING build section: the exact commands above, the 3 rings, the env matrix | — |

**Everything in A–J is writable today, on this machine, with zero accounts.** The only parts that cannot be *verified* without accounts are the **live fal.ai call** (F) and the **hosted deploy** (E in Ring 3).

### 6.2 What **you** must provision — the PM action list (filed as **SCRUM-56**)

| # | Item | Why | Cost | Blocks |
|---|---|---|---|---|
| **1** | **Supabase account + one project** → give me the **Project URL** + **anon key**; put the **service-role key** into the Edge secrets (never to me in chat) | Ring 3 — the slice's persist step and anything shared | **free** | PR-3 · PR-4 · the M1 device run |
| **2** | **fal.ai account + API key + a small credit top-up** | **Path C — the only metered spend.** ≈$0.09/picture → **US$10 ≈ 110 pictures**, ample for the slice | **~US$10** | the live cartoonize call |
| **3** | **Supabase CLI login** — `supabase login` is an **interactive device-code flow** | Ring 1 — `supabase start` / `db reset` / `functions serve` | free | the local backend loop |
| **4** | **EAS login** — `npx eas-cli login`, same interactive reason | cloud Android builds; the iOS-later path | free | dev builds |
| **5** | **Android SDK + emulator (KVM)** *or* the **Tier-F device** (SCRUM-52) | Ring 2 — emulator for speed, **device for truth** (N1) | free / ~S$100–150 | the M1 device run |
| **6** | **A domain for invite deep links** (e.g. `josspaperar.app` — doc 07 §4.6 assumes it) | App/Universal Links, so a QR invite survives the app not being installed | ~S$15/yr | **SCRUM-50 only — not the slice** |
| **7** | **Decide the Android package id** (`app.josspaperar` vs `sg.josspaperar` …) | baked into `app.json` + EAS; **painful to change after the first Play upload** | free | EAS build config |
| **8** | **Decide the Supabase region** — recommend **`ap-southeast-1` (Singapore)** | SEA latency; also awkward to change later | free | project creation |
| **9** | **GitHub repo secrets** *(optional)* | lets CI run DB lint against a throwaway project | free | nice-to-have |
| **10** | **Google Play Console** — **defer** | submission only | $25 | M4 — not now |

> **Three of these are one-time decisions that are expensive to reverse — #7 package id · #8 region · #6 domain. Five minutes each, now, saves a migration later.** The rest are logins.

### 6.3 What unblocks what

```
   ┌── YOU ─────────────────────────────────────────────────────┐
   │ #3 supabase CLI login ───────▶ local backend loop ─────────┼──▶ E · F · G (I write, you run)
   │ #1 Supabase project ─────────▶ Ring 3 persist ─────────────┼──▶ PR-3 · PR-4 · M1 device run
   │ #2 fal.ai key ───────────────▶ live Path C call ───────────┼──▶ the slice's cartoonize step
   │ #5 device / emulator ────────▶ Ring 2 ─────────────────────┼──▶ N1 device verification
   │ #6/#7/#8 decisions ──────────▶ config ─────────────────────┼──▶ SCRUM-50 · EAS · project creation
   └────────────────────────────────────────────────────────────┘

   ┌── ME — no dependencies at all ─────────────────────────────┐
   │ A · B · C · D · E(migrations) · F · G · H · I · J ─────────┼──▶ PR-1 ships with no account
   └────────────────────────────────────────────────────────────┘
```

**The critical insight: the entire first PR needs nothing from you.** PR-1 (SCRUM-57) is shell + theme + domain modules + tests + CI — pure repo work, and it is the piece that makes everything after it fast.

---
## 7 · Target repo layout

Single repo (SCRUM-15's decision), app at the root, backend alongside it. **Routes in `src/app/`; everything else outside it** (AGENTS.md).

```
JossPaperAR/
├── src/
│   ├── app/                    # ← expo-router: every file here IS a screen
│   │   ├── _layout.tsx         #   root navigator · providers · i18n · auth gate
│   │   ├── index.tsx           #   boot → first-run fork
│   │   ├── (onboarding)/       #   0b permissions · 0b3 privacy · 0d clan fork
│   │   ├── (ritual)/           #   capture · burn · reward      ← the slice
│   │   ├── home.tsx            #   the shrine
│   │   └── (clan)/             #   clan · invite · join
│   ├── components/             # reusable UI (the ≥44 px hit-rect habit lives here)
│   ├── theme/                  # tokens.ts (mirror of design-system/tokens.css) · type.ts
│   ├── domain/                 # PURE TS — no React, no network
│   │   ├── catalogue.ts        #   offerings + decorations (base_value = 1.2 × price)
│   │   ├── aim.ts              #   the four art-derived bands
│   │   ├── award.ts            #   400 × band × ground + 50, clamp 0…1,650
│   │   ├── quota.ts            #   10 photo / 20 store per day, per user
│   │   └── __checks__/         #   the T2 acceptance tests (plain node, no deps)
│   ├── features/               # feature-scoped UI + hooks (capture/ burn/ clan/ league/)
│   └── lib/                    # supabase.ts · queue.ts · idempotency.ts · invites.ts · i18n.ts
├── supabase/
│   ├── config.toml
│   ├── migrations/             # RLS on every table — the rule, not an afterthought
│   ├── functions/
│   │   ├── cartoonize-orchestrator/index.ts
│   │   ├── award-service/index.ts
│   │   └── weekly-roll/index.ts
│   └── seed.sql
├── design-system/              # ✅ exists — tokens.css · responsive.css + the CI checks
├── AppDesignConceptBoard/      # ✅ exists — the specs (01–19) + ADRs
├── spike/                      # ✅ exists — the Path C results
├── .github/workflows/ci.yml    # ✅ exists — to be extended (item I)
└── .env.example                # ✅ exists — to be extended with the §4.4 matrix
```

**Why `domain/` is separate and pure:** it is the part that carries the **acceptance test** (the aim bands), it must be testable with zero dependencies, and keeping React out of it is what makes the server able to reuse the *same* constants (doc 07 §5.1.6 — *the catalogue is code, and the server re-reads it*).

---

## 8 · Build sequence — the next four PRs

| PR | Ticket | Contents | Needs you? | Gate it clears |
|---|---|---|---|---|
| **PR-1** | **SCRUM-57** | shell (A) · theme (B) · domain (C) · tests (D) · CI (I) · docs (J) | ❌ **nothing** | the repo can carry real code |
| **PR-2** | SCRUM-54a | `supabase/config.toml` + migrations + RLS + seed (E) | #3 *(to *run* it)* | the local backend loop |
| **PR-3** | SCRUM-54b | Edge Functions (F) + RPCs (G) + client libs (H) | #1 · #2 *(to call them)* | **G3 — the backend of record** |
| **PR-4** | **SCRUM-53** | the ritual screens wired end-to-end | #1 · #2 · #5 | **G2 + M1 — the slice runs on glass** |

**PR-2 through PR-4 can all be *written* before any account exists** — the accounts are needed to *run* them, and only PR-4's device run is genuinely gated by hardware.

### The slice's own definition of done (unchanged — doc 17 §2)

> **The four aim bands grade true** on a real touchscreen — 正中 ±14.55 ×2.0 · 虔誠 ±39.40 ×1.5 · 擦邊 ±96.97 ×1.0 · 偏失 ×0. **Not fps.** Plus: award written only by `award-service`; replaying an `idempotency_key` awards once; the three failure paths honest.

---

## 9 · Inconsistencies found in doc 07 while planning this

Found by mapping the build against the architecture. **Items 1–3 were fixed in this session → doc 07 is now v2.9** (item 4 was fixed in the same PR).

| # | Where | Problem | Resolution |
|---|---|---|---|
| **1** | §4.5 | `rpc.save_ancestor(...)` — *"CHECK ≤ 4 non-archived tablets per user"* was **stale**. Ancestors became **clan-owned** in SCRUM-22 (doc 15), with cap = `clans.ancestor_cap` (**default 10**) — §5.3 already said so. The "4" is the **altar *display* cap**, a different rule | ✅ **fixed (v2.9)** — restated as **clan-scoped, cap = `clans.ancestor_cap`**, with the display cap noted separately |
| **2** | §3 (service table) | listed a **`tributes` Storage bucket**, but [[15-clan-model-and-book-of-tributes]] §7 says the Book carries **no image** (its §5.3 table has no image column either) | ✅ **fixed (v2.9)** — the bucket is gone (fewer privacy surfaces, per 13 §4) |
| **3** | §6 | *"**Open for SCRUM-18**: daily quota size…"* — SCRUM-18 is **Done**; the quotas are locked in [[10-economy-spec]] §1 | ✅ **fixed (v2.9)** — struck, pointing at doc 10 |
| **4** | README §Development environment | said **"Node.js ≥ 20"**; **SDK 57's floor is Node 22.13.x** (official SDK 57 table). CI already used Node 22, so only the docs were wrong | ✅ **fixed** in this PR |

**Why item 1 mattered most:** it would have led an implementer to build a **4-ancestor cap** into the schema, the RPC and the altar UI — contradicting the clan model that SCRUM-22/48/15 already locked (cap 10, and it is a future monetisation lever via SCRUM-47). A wrong cap is a data-model bug, not a typo.

### 9.5 Re-benchmark first read — `nano-banana-2-lite` vs the locked `nano-banana-2` (2026-10-03)

**Status: 🧪 first read, NOT a verdict.** 2 subjects × 2 models, run on the same reconstructed v3 prompt. ADR-002 remains locked; this exists so the *question* is documented with evidence rather than opinion.

| Subject | Prompt (reconstructed v3 template) | Outputs |
|---|---|---|
| **Altar** (S16) | "a gold statue, a red candle, a white bowl…" | `nano-banana-2` → `jO7svwG8…png` · `nano-banana-2-lite` → `dw0CL75N1…png` |
| **HDB block** (S12) | "white concrete with a green roof…" | `nano-banana-2` → `L2EOf11-…png` · `nano-banana-2-lite` → `E1UdSZIS…png` |

All four saved to the **fal library** (provenance kept) so the URLs do not expire: assets `db0avccregjfqb95d6og` · `db0avckregjfk7p5d6rg` · `db0avcsregjfk7p5d6ug` · `db0avd4regjfk7p5d730`.

> ⚠️ **The v3 template was reconstructed**, not lifted — the literal prompt was built inline during the S18 session and is not in the repo. It was rebuilt from the *normative* spec in [[07-system-architecture]] §4.2 + [[../spike/results/path-C/EVALUATION]] §7 (source-colour lock · top-down lighting shader · transparent glass · no ground shadow · blank warm rice-paper · coarse 40–60 facets + one ink weight + matte). **This is methodologically fine for a model-vs-model comparison** (identical prompt to both), but it means the outputs are *not* directly comparable to the S18 scorecard images.

**What was measured (objective):**

| # | Finding | Consequence |
|---|---|---|
| 1 | **API drop-in compatible** — same endpoint shape (`prompt` required), same output (`images[0].url`), same 1024×1024 PNG | a switch would be **one endpoint string** in `cartoonize-orchestrator`, no client change |
| 2 | **Vendor latency evidence is `null`** — `p50_ms`/`p90_ms` = `null`, `sufficient_evidence: false` | the advertised **"sub-2 s" is copy, not a measurement.** The spike's **p50 ≈ 13 s** for `nano-banana-2` is likewise the only real number we own |
| 3 | **Latency was NOT measured in this pass** — the MCP run interface returns no wall-clock | a real latency answer needs a **scripted run in the dev loop** where timing is observable (§8 PR-1's harness is the natural home) |
| 4 | 🔴 **The price is unresolved** — `google/nano-banana-2-lite` bills **per "unit" at $1**, not per image (`nano-banana-2` = **$0.08/image**) | **cost per picture cannot be stated.** This *alone* blocks a cost-based switch |
| 5 | Metadata differs — lite returns `width`/`height` (1024), `nano-banana-2` returns `null` for both | minor; matters only for the doc 14 §3 asset-budget check |
| 6 | ✅ **No catastrophic failure** — all four produced plausible low-poly / ink-brush renders, warm cream background, no ground shadow, correct subject colours | the Path C *pipeline shape* survives on both models |

**What was NOT measured — and must not be claimed:** whether lite holds **style D** (37 faces = 31 body + 6 wheel · one ink weight · the **untested per-region wheel rule**). That is a **human visual verdict**, exactly as the S18 spike was — and 2 subjects is a first read, not the 13-input scorecard. **The PM's eye is the instrument here, not mine.**

**Verdict of this pass: keep ADR-002 exactly as it is.** The honest conclusion is *"not ruled out, not justified"*:

1. 🔴 **Two hard blockers** — the billing unit is unresolved (#4) and latency is unverifiable from vendor evidence (#2). Neither can be answered by generating more images.
2. **If both clear favourably**, a proper re-run is cheap and well-defined: **the 13 Track-A inputs · scripted wall-clock timing · the PM's scorecard** — ≈US$2, with the S18 `manifest` and `EVALUATION` sheet already in the repo as the template.
3. **Why it is still worth pursuing:** the wait is **doc 18's R3** — the single weakest moment in the ritual (*12.6 s of AI in a solemn moment*). If lite holds D at a fraction of the latency, it is the largest UX win available to the MVP. **Logged, not acted on.**

**Follow-up to file:** *(a)* ask fal for the lite billing basis + a per-image price; *(b)* if favourable, run the 13-input scripted re-benchmark.

---
## 10 · What I need from you — the short version

**To start building right now: nothing.** PR-1 (§8) has zero external dependencies.

**Before the slice runs on a device (the real gate), five things — and three are one-time decisions:**

| Priority | Item | Why it matters | Cost |
|---|---|---|---|
| 🔴 **now-ish** | **Supabase CLI login** (#3) | unlocks the whole local backend loop — Docker is already here | free |
| 🔴 **now-ish** | **Decide package id · region · domain** (#7 · #8 · #6) | the three that are expensive to reverse | free / ~S$15/yr |
| 🟡 **before PR-3** | **Supabase project** (#1) + **fal.ai key** (#2) | Ring 3 + the only metered spend (**~US$10 ≈ 110 pictures**) | ~US$10 |
| 🟡 **before PR-4** | **Device or emulator** (#5) | N1 — a milestone completes on real glass, not on a dev machine | free / ~S$100–150 |
| ⚪ later | EAS (#4) · GH secrets (#9) · Play Console (#10) | dev builds, CI DB lint, submission | free · $25 |

*(Full detail, with the "blocks" column, in §6.2 → filed as **SCRUM-56**.)*

---

## 11 · Deliverable status

| Part | State |
|---|---|
| §2 service inventory + build order | ✅ 12 services, re-cut by "can it go up locally / what account does it need" |
| §3 API contract | ✅ 3 Edge Fns · 11 RPCs · 2 storage buckets · 1 Realtime channel · 4 client-only modules · the trust-boundary table |
| §4 environments (3 rings) | ✅ with this machine's toolchain **audited** (Node 22.23 ✅ · Docker 29.8 ✅ · CLI ❌) |
| §5 dependency manifest | ✅ exact SDK 57 install lines + 3 Deno packages + **4 install traps** |
| §6 the setup split | ✅ 10 items I build (A–J, no account) vs 10 items you provision (#1–#10) + the unblock graph |
| §7 repo layout | ✅ target tree |
| §8 build sequence | ✅ PR-1 → PR-4, with the "needs you?" column |
| §9 found inconsistencies | ✅ **all 4 fixed** — doc 07 → **v2.9** (items 1–3) + README (item 4) |
| §9.5 generator re-benchmark | 🧪 **first read done** — 4 outputs × 2 subjects; **2 hard blockers found** (billing unit unresolved · latency unverifiable) → **ADR-002 stays locked** |
| **Verification** | ✅ Path C endpoints + prices re-checked live (2026-10-03) — ADR-002's $0.09/picture **still exact** |

**The plan's own summary:** doc 07 already told us *what* to build; the only expensive surprises were in the *setup* — and the audit shows **this machine can run the entire backend locally with no accounts, and the first PR needs nothing at all.** The accounts buy the *live call* and the *device truth*, not the ability to start.

---

*Created 2026-10-03 (Session 27) — the stand-it-up plan for [[07-system-architecture]]: service build order · the complete API surface (3 Edge Fns · 11 RPCs · storage · realtime) · the 3-ring environment with the local toolchain audited · the exact SDK-57 package manifest + install traps · the build-vs-provision split (A–J ↔ #1–#10, filed as **SCRUM-57** / **SCRUM-56**) · and 4 doc-07 inconsistencies found while mapping the build against the architecture. Path C endpoints and prices verified live: **ADR-002's cost model still holds exactly.***

---