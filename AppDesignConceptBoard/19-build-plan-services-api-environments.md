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
styled/{user_id}/{capture_id}.webp      styled D    · ≤150 KB sprite (14 §3) · ⚠️ WebP, not PNG
```

> ⚠️ **The sprite is WebP, not PNG — measured 2026-10-04 (PR-3).** The first REAL
> Path C run produced a **1,326,732-byte** 1K PNG against 14 §3's 150 KB budget,
> while the same prompt at the same 1K resolution in **WebP is 50,900 bytes**.
> WebP carries alpha (the sprite needs it) and Android decodes it natively; the
> alternative (a resize/quantise stage) needs an image library the Deno Edge
> runtime does not ship. The `styled` bucket therefore allows **both** MIME types
> (`20261004095500_styled_bucket_webp.sql`), and `check:pathc` guards the choice.

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

> ✅ **Provisioned 2026-10-03 (PM decisions).** Project `yercgevebxvtzkgctfai` ("HAJIWEE's Project") · region **`ap-southeast-1` (Singapore)** ✅ as recommended · **Postgres 17.11** · `ACTIVE_HEALTHY`. CLI **v2.119.0** logged in. Package id **`app.josspaperar`** ✅ → `app.json`.

| Service | Tier | Bills? | Gates |
|---|---|---|---|
| **Supabase hosted** | free | no (until scale) | the slice's persist step + anything shared |
| **fal.ai** | metered | ⚠️ **yes — ≈$0.09/picture** | the live Path C call — **the only real spend in the MVP** |
| **EAS** | free tier | no | cloud Android builds; iOS later |
| **Play Console** | $25 once | no (one-off) | submission only — **not now** |

**What the live project already tells us (checked via MCP):**

- **`pg_cron` is available** (1.6.4, not yet installed) → `weekly-roll` has its scheduler (07 §4.4). **Enable it in a migration.**
- **`pgtap` is available** → SQL-level tests for the ledger/RLS rules are possible without adding a dependency.
- **`postgis` is available — and we must not use it.** The location model is a **coarse geohash cell with no coordinates and no trail** (13 §2). PostGIS would make raw-geometry storage one line away; its presence is not a reason. A deliberate non-use, worth stating.
- **`pg_partman`** is available if `ledger_events` ever needs time partitioning (not at alpha).
- Postgres is **17**, not 15 — everything in doc 07 §5 is unaffected.

### 4.4 Environment variable matrix

| Variable | Lives in | Ring 1 (local) | Ring 3 (cloud) | Secret? |
|---|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | app bundle | `http://localhost:54321` | project URL | no (public) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | app bundle | local anon key | **publishable key** (`sb_publishable_…`) | **no — RLS is what protects it** |
| `EXPO_PUBLIC_API_BASE_URL` | app | optional override | unused | no |
| `FAL_KEY` | **Edge Fn secrets only** | `supabase/functions/.env` | `supabase secrets set --env-file …` | 🔴 **yes — never in the bundle** |

**⚠️ Two corrections (2026-10-03, checked against the official docs):**

1. **`SUPABASE_SERVICE_ROLE_KEY` is NOT ours to set.** Supabase **injects** these into every Edge Function automatically, and any name starting with `SUPABASE_` is **reserved**:
   `SUPABASE_URL` · `SUPABASE_DB_URL` · `SUPABASE_JWKS` · **`SUPABASE_PUBLISHABLE_KEYS`** (JSON dict — RLS applies) · **`SUPABASE_SECRET_KEYS`** (JSON dict — **bypasses RLS**); *legacy:* `SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY`.
   Earlier revisions of this doc told the PM to *"put the service-role key into Edge secrets"*. **That was wrong, and it was unnecessary work** — a function just reads `SUPABASE_SECRET_KEYS['default']` (or the legacy var) with zero setup.
2. **Modern keys replace the legacy pair.** Supabase now issues **publishable** (`sb_publishable_…` — client-safe, replaces `anon`) and **secret** (`sb_secret_…` — bypasses RLS, replaces `service_role`); the legacy two keep working until end-2026. **This project uses the publishable key from day one** — it rotates independently and carries no legacy baggage. The `sb_secret_…` key is server-only: **never committed, never pasted into chat, never in the bundle.**

**The local-vs-hosted split:**

| Where | File | Loaded by |
|---|---|---|
| **Local** Edge Functions | `supabase/functions/.env` *(gitignored)* | automatically by `supabase start` / `functions serve` (or `--env-file`) |
| **Hosted** Edge Functions | *(no file ships)* | `supabase secrets set --env-file supabase/functions/.env` |
| **The app** | `.env` at the repo root *(gitignored)* | Expo — **only `EXPO_PUBLIC_*` reaches the bundle** |

Both real `.env` files are gitignored; the `.env.example` templates are committed. **Neither real file may ever be committed** — the one rule the build must not weaken.

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
| ~~**1**~~ ✅ | **Supabase project** — **done 2026-10-03**: `yercgevebxvtzkgctfai` ("HAJIWEE's Project") | Ring 3 — the slice's persist step and anything shared | **free** | ~~PR-3 · PR-4 · the M1 device run~~ **unblocked** — *still need: the anon key into `.env` + the service-role key into Edge secrets* |
| **2** | **fal.ai account + API key + a small credit top-up** | **Path C — the only metered spend.** ≈$0.09/picture → **US$10 ≈ 110 pictures**, ample for the slice | **~US$10** | the live cartoonize call |
| ~~**3**~~ ✅ | **Supabase CLI login** — **done 2026-10-03**: CLI **v2.119.0** at `/usr/local/bin/supabase`, logged in (verified: `supabase projects list` sees the project) | Ring 1 — `supabase start` / `db reset` / `functions serve` | free | ~~the local backend loop~~ **unblocked** |
| **4** | **EAS login** — `npx eas-cli login`, same interactive reason | cloud Android builds; the iOS-later path | free | dev builds |
| **5** | **Android SDK + emulator (KVM)** *or* the **Tier-F device** (SCRUM-52) | Ring 2 — emulator for speed, **device for truth** (N1) | free / ~S$100–150 | the M1 device run |
| **6** | **A domain for invite deep links** (e.g. `josspaperar.app` — doc 07 §4.6 assumes it) | App/Universal Links, so a QR invite survives the app not being installed | ~S$15/yr | **SCRUM-50 only — not the slice** |
| ~~**7**~~ ✅ | **Android package id** — **decided 2026-10-03: `app.josspaperar`** → set in `app.json` (`android.package`; `ios.bundleIdentifier` carries the same reverse-DNS as the natural pairing — trivially changeable while iOS is deferred) | baked into `app.json` + EAS; **painful to change after the first Play upload** | free | EAS build config — **resolved before any build** |
| ~~**8**~~ ✅ | **Supabase region** — **decided 2026-10-03: `ap-southeast-1` (Singapore)**, and the live project is already there | SEA latency; awkward to change later | free | project creation — **resolved** |
| **9** | **GitHub repo secrets** *(optional)* | lets CI run DB lint against a throwaway project | free | nice-to-have |
| **10** | **Google Play Console** — **defer** | submission only | $25 | M4 — not now |
| ~~**11**~~ ✅ | **Anonymous sign-ins on the hosted project** — Dashboard → Authentication → Providers. **Set 2026-10-03 (S27c) and VERIFIED by a real sign-in.** | **ADR-004** locks anonymous device identity first, so a user burns *before* any signup wall. Locally this is `enable_anonymous_sign_ins = true` in `config.toml` (the `supabase init` default is `false` and contradicts the ADR) — on the hosted project it is a Dashboard toggle with **no** migration/SQL equivalent. **Verified:** `POST /auth/v1/signup` → **HTTP 200**, `is_anonymous: true`, `role: authenticated`, a full session issued | free | - |

> **Three of these are one-time decisions that are expensive to reverse — #7 package id · #8 region · #6 domain. Five minutes each, now, saves a migration later.** The rest are logins.

### 6.3 What unblocks what

```
   ┌── YOU ─────────────────────────────────────────────────────┐
   │ ✅ #3 supabase CLI login ────▶ local backend loop ─────────┼──▶ E · F · G (I write, you run)
   │ ✅ #1 Supabase project ──────▶ Ring 3 persist ─────────────┼──▶ PR-3 · PR-4 · M1 device run
   │ ⬜ #2 fal.ai key ────────────▶ live Path C call ───────────┼──▶ the slice's cartoonize step
   │ ⬜ #5 device / emulator ─────▶ Ring 2 ─────────────────────┼──▶ N1 device verification
   │ ✅ #7/#8 decided ──⬜ #6 ────▶ config ─────────────────────┼──▶ SCRUM-50 · EAS
   └────────────────────────────────────────────────────────────┘
        ✅ = provisioned 2026-10-03.   Still open: #2 fal.ai · #5 device · #6 domain.

   ┌── ME — no dependencies at all ─────────────────────────────┐
   │ A · B · C · D · E(migrations) · F · G · H · I · J ─────────┼──▶ PR-1 ✅ shipped
   └────────────────────────────────────────────────────────────┘
```

**Since the CLI is live, PR-2 (SCRUM-54a) is now fully executable** — not just writable. **One PM step still needed to deploy to the hosted project:** `supabase link --project-ref yercgevebxvtzkgctfai` asks for the **database password** (or set `SUPABASE_DB_PASSWORD`). Local `supabase start` needs no linking at all — Docker is enough. *(The anon key also has to reach `.env`; the service-role key must go only into Edge secrets — never the bundle, never chat.)*

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
| **PR-3** | SCRUM-54b | Edge Functions (F) + RPCs (G) + client libs (H) | #1 · #2 *(to call them)* | **G3 — the backend of record** | ✅ **shipped 2026-10-04** — 6 migrations · 3 functions · 5 client libs · Path C lock guard · a live SQL verification. See **§12** for what building it found. |
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

## 12 · What PR-3 found (2026-10-04) — the plan vs the live project

PR-3 was built against the live project, and **the live project disagreed with the notes in five places.** Each was verified with a query or a real call before anything changed, and each is fixed in a migration rather than remembered.

| # | What the notes said | What the project actually said | What happened |
|---|---|---|---|
| **1** | "private buckets `captures` + `styled` exist" (hand-off, S27c) | `select * from storage.buckets` → **0 rows**. The slice schema is tables/RLS only — **no bucket DDL was ever written** | ✅ **migration 0006** creates both at the doc 19 §3.3 limits (300 KB jpeg · 150 KB png) plus the `storage.objects` policies. Before this the orchestrator had nowhere to write a sprite. |
| **2** | — (nobody mentioned it) | **Nothing created a `profiles` row.** No `handle_new_user` trigger exists, so an `auth.users` insert produced no profile — and every money/AI table FKs to `profiles`. **A brand-new anonymous user could not burn anything**: the ADR-004 first-run path was dead on arrival | ✅ **migration 0006** adds the auth trigger (`SECURITY DEFINER`, EXECUTE revoked from every client role — traps #1 + 0003). Proved by a real sign-in. |
| **3** | doc 10 §7: `quotas` gains `photo_burns_used` · `store_burns_used` · `free_photos_used_month` | `quotas` has **one** counter (`burns_used`); the per-kind columns were never applied, and there is no monthly-grant column or table | The 10/20 split is **derived from `burns`** inside `submit_burn` (the authoritative record anyway); `quotas.burns_used` stays a display rollup. **doc 10 §7 is misleading** → flagged for SCRUM-18. |
| **4** | doc 07 §4.3: new-ground comes "from `grid_cells`" | `grid_cells` is **aggregate-only and holds no identity** — it cannot answer "has THIS user burned here before?" | New-ground is read from **`cell_burns`** (the per-user decay table); doc 11 §1 allows either, so this is doc 07 naming the wrong table. `grid_cells` still receives the aggregate. |
| **5** | doc 19 §3.2: the app calls `submit_burn` · doc 19 §3.1: `award-service` is the only money writer | A function granted to `authenticated` **cannot** be the only writer — measured, not assumed: a `SECURITY DEFINER` function granted to `authenticated` moves the advisor's `authenticated_security_definer_function_executable` count **3 → 4** | **`submit_burn` + `request_cartoonize` are `service_role`-ONLY**, so "only the award path writes money" is true **by GRANT**, and the money path adds **zero** advisor findings. The client reaches them through the two Edge Functions — the stricter of the two doc lines. |

### 12.1 · The defects the verification test found (0007–0009)

`supabase/tests/pr3_verification.sql` is a machine that CAN fail — and it failed three times before it passed, each time on a real bug:

| Migration | Defect | Caught by |
|---|---|---|
| **0007** | `submit_burn` consumed a store offering's `inventory.qty` **before** the band was known, so a **miss destroyed the offering** — contradicting S9 ("the offering returns, never destroyed") | the S9 assertion |
| **0008** | `purchase_item` asked the `balances` **view** for `sum(amount)`; the view exposes `(user_id, currency, balance)` and `amount` lives on `ledger_events`. plpgsql does not resolve columns until first execution, so 0005 applied cleanly and only failed on the first purchase | the purchase assertion |
| **0009** | `delete_my_data`'s own VERIFY probe counted `cartoonize_jobs where user_id = …` — a column that does not exist (the table keys on `capture_id`), so the probe broke at exactly the moment it was meant to prove 0 rows | the delete assertion |

### 12.2 · The new gates, and what each one cost

| Gate | What it protects | Fault-tested? |
|---|---|---|
| `supabase/checks/sql-structure.js` | trap #7 — a truncated migration (balanced `$$`, parens, closed statements) | ✅ a truncated `create table` goes RED |
| `supabase/checks/pathc-check.ts` | **ADR-002's lock** — endpoints, the v3 template clauses, and the ABSENCE of example colours in the identify prompt | 32 assertions |
| `src/lib/checks/run.ts` | the client libs: idempotency keys · invite/QR payloads · EN/中文 parity · split storage · the queue's sent/dropped/retryable/stuck accounting | ✅ found a real bug: i18n-js treats `.` as a namespace separator, so flat dotted keys never resolved |
| `supabase/tests/pr3_verification.sql` | the PR's whole DoD list, against a real database | ✅ `1650 → 1601` goes RED with the exact failure |

### 12.3 · The verification, in numbers

Against `yercgevebxvtzkgctfai`, 2026-10-04. Everything below was **observed**, not inferred:

- **`supabase db push`** → all migrations applied; `migration list` shows **no drift**.
- **The SQL verification passed**, and **the same file with one number corrupted went RED** — the harness is alive.
- **The fixtures tear themselves down**: afterwards `profiles` · `auth.users` · `clans` · `burns` · `ledger_events` · `grid_cells` · `rate_counters` · `clan_members` · `ancestors` · `inventory` are all **0 rows**.
- **Over the real HTTP API**, with a real anonymous session: `POST /rest/v1/rpc/submit_burn` → **403 `42501 permission denied for function submit_burn`**; `POST /rest/v1/ledger_events` → **403 `42501`**; `GET /rest/v1/profiles` as `anon` → **200 `[]`**.
- **`get_advisors(security)`**: `authenticated_security_definer_function_executable` **3 → 7** — the four named exceptions, all inside a category the baseline already carried; `rls_enabled_no_policy` **unchanged at 4**; and **nothing in `public` is executable by `anon`** (0 functions) — trap #1's real invariant, asserted in the test.
- **The buckets exist**: `captures` (307200 · image/jpeg) · `styled` (153600 · image/png), both private.
- **The pg_cron question stays open**: enabling it is a SCRUM-11 step (the league has no spec yet), so it was deliberately NOT enabled here.
- **The sprite is WebP.** The very first real Path C run found this: a 1K PNG is **1,326,732 bytes** against doc 14 §3's 150 KB budget; 1K WebP is **50,900 bytes**. One parameter, same model/prompt/resolution → `0010` widens the `styled` bucket to accept both, `check:pathc` guards it, and doc 14 §3 + §3.3 above now say so.
- **The client must choose the capture id BEFORE it uploads.** `captures` deliberately has no UPDATE policy ("status/moderation are the orchestrator's to set"), so `storage_path` cannot be filled in afterwards — the real client order is: generate the id → upload to `captures/{uid}/{id}.jpg` → insert the row. Found by an exercise that patched the path and watched the orchestrator 404.
- **The Edge Function's own signed URL needed normalising.** `storage.createSignedUrl` can return a RELATIVE path (`/object/sign/…`), which fal cannot fetch — the symptom was a confusing `extraction_unusable`, because the identifier answered prose about a photo it could not see. The orchestrator prefixes the project URL when the value is relative.

### 12.4 · The four decisions — RATIFIED by the PM (2026-10-04)

| Ticket | The decision | Ratified choice | Effect on the build |
|---|---|---|---|
| **SCRUM-58** | the styled sprite's format | **A — WebP at 1K** | **none**: PR-3 already ships it (`GENERATE_OUTPUT_FORMAT`), the bucket allows `webp`+`png`, and `check:pathc` guards the choice so a "tidy-up" back to PNG cannot silently break the 150 KB NFR. |
| **SCRUM-59** | what an alpha photo burn costs the player | **B — the daily cap + a global daily AI-budget STOP-RULE (no wallets yet)** | ✅ **BUILT in its own PR** — migration `0011` + the orchestrator short-circuit + `supabase/tests/ai_budget.sql` + `supabase/checks/exercise-budget.sh` → **§12.5**. `request_cartoonize` now **queues** (never fails) once the shrine cannot afford one more photo, with the "the shrine is receiving many offerings…" copy. Budget stays **$5/day** (doc 10 §4) and is now a live `app_config` knob. The full wallet model (fee · grant · 15/month cap) stays deferred to beta (`SCRUM-18`/`ADR-006`). |
| **SCRUM-60** | the 7 `authenticated_security_definer_function_executable` advisories | **A — accept 7** | **none**: the four exceptions are documented in the migration that creates them, the `anon` class is **0** and machine-asserted, and no lint category is new. Revisit only if an audit demands a clean report (cheap then — the RPC bodies would not change). |
| **SCRUM-61** | ADR-002 §4's colour-sanity rule | **A — ratify the narrower rule + amend the ADR** | ✅ done in this PR: **ADR-002 gained Amendment 1** (`COLOUR_LEAK_MIN_TOKENS = 3`; the live false positive recorded; `check:pathc` pins both the fingerprint *and* the false-positive case). |

**SCRUM-59 was the one that changed the code**, and it was kept out of PR-3 on purpose — it edits `request_cartoonize`, which was already applied, so it belongs in its own migration + PR with its own tests. **It is built: see §12.5.**

### 12.5 · SCRUM-59 — the AI-budget stop-rule, built (migration `0011`)

**The decision was option B** (§12.4): enforce the daily cap **and** a global daily AI-budget stop-rule, with no wallets. This is what it took — and what it found.

**What shipped** (its own branch and PR, as promised):

| Piece | What it does |
|---|---|
| `20261004096000_ai_budget_stop_rule.sql` | `app_config` (server-only: RLS on, **no policies** — the `rate_counters` posture) · `ai_spend_today()` · `ai_budget_micros()` · and a `request_cartoonize` that **queues instead of failing** |
| `cartoonize-orchestrator` | honours `budget_exhausted` → **HTTP 200 `{code: shrine_busy, queued: true}`** and never reaches fal |
| `supabase/tests/ai_budget.sql` | S1–S5b/S6–S7 against the real database, **fault-tested red** |
| `supabase/checks/exercise-budget.sh` | the live, self-cleaning proof — **spends nothing by default** |

**Three findings worth keeping:**

1. **The spec's floor is load-bearing.** doc 10 §4 asserts `global.ai_budget_today_usd >= 0.10` — *not* "spend < budget". Kept literally, that makes the budget a **hard ceiling**: at $0.09 a photo, "≥ $0.10 of headroom" means the last job can never overrun the day. The first cut used `spend >= budget` (a *soft* ceiling — overrun by up to one job) and the boundary test caught the difference **before merge**: **$0.099999 of headroom queues; exactly $0.10 proceeds.** The floor also **fails closed** — a missing knob reads as 0 and stops spending rather than allowing it.

2. **⚠️ A rotated service key looks EXACTLY like a stop-rule that did not fire.** The first live run reported no queue — because `/tmp/keys.env`'s `SECRET` had been rotated (401 `Invalid API key`), so the budget was never written… and the run happily went on to complete a **real Path C generation** (US$0.09, logged in [[project-costs]]). The script now **(a) proves the credential before it mutates anything** and **(b) restores the budget from an `EXIT` trap**, so a half-finished run cannot leave the app locked out. *Rule for any future config-mutating runbook: prove the credential FIRST, mutate second.* The fallback also matters — `SVC` (the legacy service_role JWT) still worked while `SECRET` did not, so the script tries both rather than trusting one name.

3. **The Storage API's bulk delete can answer 200 and delete nothing.** `DELETE /storage/v1/object/{bucket}` with `{"prefixes":[…]}` returned **200** and left the objects exactly where they were (re-listing proved it); deleting **by path** worked. Worth knowing before a future cleanup step trusts a status code.

**The numbers** (hosted project, 2026-10-04 — same image, same capture shape, 40 minutes apart):

| | a real Path C run (PR-3) | the stop-rule firing |
|---|---|---|
| HTTP | 200 | **200** — `code: shrine_busy` (a queue, not an error) |
| latency | **14,988 ms** | **510 ms** |
| `cost_micros` | 90,000 | **NULL** |
| `cartoonize_jobs.status` | `styled` | **`queued`** — the offering keeps its row, so it is not lost |

**And the posture held:** `authenticated_security_definer_function_executable` **unchanged at 7** — the two new readers are unreachable from the Data API (`anon` · `authenticated` · `service_role` all revoked) and `request_cartoonize` stays `service_role`-only, so the new money-path logic added **zero** lint exposure. `rls_enabled_no_policy` moved **4 → 5**: `app_config` joins `rate_counters` · `integrity_flags` · `grid_cells` · `cell_burns` as a **server-only table with RLS and deliberately no policies** — the number rising is the design working, not a regression. **PR-3's own suite was re-run unchanged → green**, which is the regression check that matters (the 10/day cap and the grant posture are still asserted against the amended function).

**Residue: zero.** The verified run left no rows (profiles · captures · jobs), no Storage objects and no `auth.users`; the SQL test's teardown removes its fixtures **and asserts the budget was restored to $5/day**, because the alternative is an outage.

### 12.28 · S38r — SCRUM-100: the PM set a volume ladder, and the badge finally sits on a fact (2026-10-10)

**The PM:** *"Use $1.20 per 1000 tokens rate at the 10,000 credits offering then apply an appreciating premium on offerings that offer less than that, so 1.22 per 1000 tokens for the 6000 credits offering and so on."*

⚠️ **Encoded as a RULE, not five numbers** — because that is what the previous turn's requirement ("formulaic even in future price adjustments") means when applied to the pricing itself: **largest bundle = `baseCentsPer1000` ($1.20); each step DOWN the ladder adds `premiumStepCents` ($0.02) per 1,000.** So:

| Bundle | Price | Per 1,000 |
|---|---|---|
| 500 | $0.64 | $1.28 |
| 1,000 | $1.26 | $1.26 |
| 3,000 | $3.72 | $1.24 |
| 6,000 | $7.32 | $1.22 |
| **10,000** | **$12.00** | **$1.20** ← BEST VALUE |

⚠️ **Every price is EXACT** — `rate × credits ÷ 1000` lands on a whole number of cents for all five, so nothing rounds and the ladder cannot drift by a cent. ✅ Average **$1.22/1,000**: above doc 10's **$1.19 floor**, below the **$1.55 ceiling**.

⚠️ **AND THE WINNER IS NOW UNIQUE — the 10,000 bundle.** The four-way tie is gone, so **`BEST VALUE` states a fact rather than a tie-break's preference** — which is what §12.27 said it would take. The badge moved on all four boards, and ⚠️ **the list was reordered ascending** (500 → 10,000): it had been `1,000, 500, 3,000…`, an artefact of the old featured-first layout, and **a price list that jumps backwards is indefensible once the winner is the last row.**

**The gate grew to 9 checks and now enforces the RULE**, fault-tested in four directions: baseline ✓9 · a hand-tweaked price ✗ *("$7.00 should be $7.32")* · ⚠️ **the 500 undercutting the 1,000** ✗ *("500 at $1.10/1,000 does not beat 1000")* · a bundle pushed above the ceiling ✗ · restored ✓9. ⚠️ **The newest assertion is the one that matters: the ladder is an APPRECIATING PREMIUM — a smaller bundle may never undercut a larger one** — the PM's intent written as a rule that a future edit cannot quietly violate.

⚠️ **Two notes, recorded not "fixed":** **(a)** ⚠️ **$0.64 is below Google Play's and the App Store's minimum price point** (~$0.99 typical) — the 500 bundle is the concrete casualty of the rate-vs-shelf gap; **(b)** ⚠️ **doc 10 §3 still says `cash shop ($1.55/1,000)`, which is now the CEILING, not what anyone pays** — the ladder satisfies doc 10's *"bundles must average ≥ floor"* ✅, but the line should point at the ladder, and ⚠️ **editing a locked economy doc is not a call to make unprompted.**

⚠️ **And a self-inflicted git defect worth recording (handover trap 29).** My first two pushes this session targeted **`cline/06f64`** — the name in the Cline workspace's `latestGitBranchName` field, which is the **WORKTREE's** name and **not the branch in use**. `git branch` showed **`* cline/scrum-52-device`**, PR #30's real head. ⚠️ **`git push origin cline/06f64` exits 0 and prints nothing alarming** — it pushed a **stale leftover branch** and **the ref never moved**, so **two pushes reported success while PR #30 stayed exactly one commit behind** (`origin/cline/scrum-52-device` = `1aecb07`). ⚠️ **The same failure class as a gate that cannot fail:** I printed `PUSHED` on a success I had not checked, and caught it only by reading the PR's `head.sha` through the MCP. Fixed with `git push origin HEAD:cline/scrum-52-device` (**a clean fast-forward**, `1aecb07..4942ec7`, ancestor verified — no history rewritten) and **verified against the REMOTE** (`git ls-remote` = `git rev-parse HEAD`), not against a possibly-stale `origin/*` tracking ref. ⚠️ `cline/06f64` was left untouched at `b81a86e8` (PR #28's merge) — checked, not assumed.

⚠️ **AND THE SESSION'S OWN FAILURE CLASS LANDED INSIDE MY NEW GATE — a wrong figure presented as a check's output.** The first `credits-check` printed *"the ladder averages $1.24/1,000"* — but that was the **unweighted mean of the five RATES**, which gives a 500-credit bundle the same say as a 10,000-credit one. ⚠️ **The quantity that means anything is the credit-weighted one: what the shelf actually collects per credit = `Σprice ÷ Σcredits × 1000` = $1.217/1,000.** Both clear the $1.19 floor ✅, so **no conclusion changed** — but **I copied `$1.24` into five documents without re-deriving it, because it came out of a check.** ⚠️ **A check's message is not evidence** — the same rule that caught the blind `check:copy` and the hand-typed translation list, and here it was *inside* the tool I had just written to prevent that class. Fixed: the check now computes the **weighted** figure, names the naive one alongside it for contrast, and ⚠️ **states plainly that the average line is DISCLOSURE, not independent proof — because a weighted mean of values all ≥ floor cannot fall below it.** Fault-proved: pushing the 10,000 to $11.00 turns the floor **and** the average red together, exactly as that note claims ✅. A fixed-input control proves the two formulas are genuinely different quantities. **All five docs corrected from `$1.24` to `$1.22`; the ticket carries a correction comment.** `check:credits` is now **10 checks**.

### 12.29 · S38s — SCRUM-100: the 500 tier is retired, and the badge was painting BEHIND its own row (2026-10-10)

**The PM, twice:** *"we should not offer the 500 credits option just offer the 4 left"* and *"fix the Z arrangement, now the best value label is behind the offering."*

**1 · The 500 is gone.** ⚠️ **Retiring it moved NOTHING else** — the premium is indexed from the **LARGEST** bundle, not counted up from the smallest, so the four survivors keep their exact rates: 1,000 **$1.26** · 3,000 **$3.72** · 6,000 **$7.32** · 10,000 **$12.00**. ✅ It also retires the one price that **could not have been sold**: **$0.64 sits below Google Play's and the App Store's ~$0.99 minimum**, and the cheapest bundle is now $1.26 — so that open caveat from §12.28 is **closed by the removal**, not by a decision. ⚠️ **The row pitch went 82 → 100** so four rows keep the five-row footprint: dropping a row at the old pitch would have re-opened the *"too empty"* hole the PM had already reported once. Weighted average **$1.22**, above the $1.19 floor. ✅ Verified against the frozen manifest: 4 rows, exact prices, badge = formula winner, **no leftover 500 layers**.

**2 · ⚠️ THE BADGE WAS BEHIND ITS ROW — and no check of mine could see it.** The `BEST VALUE` pill was **created on the old 1,000 row** and later **renamed** onto the 10,000 row. ⚠️ **Renaming a shape does not change its paint order**, so it stayed *before* the row in the parent's children and the row rect painted over it. My checks covered bounds, ink fit and collisions — ⚠️ **never z-order between a badge and the thing it labels.** The PM's eye caught what six gates could not: this is the same shape of blind spot as `check:contrast` not reaching Penpot (§12.14), one layer up.
✅ **Fixed into a BAND, not "to front":** the badge must paint **in front of its own row** but **under a confirm-board scrim** — ⚠️ `bringToFront()` would have lifted it over the scrim and re-created the very z-bug I had already fixed once in §12.27. Final indices, verified per board: row rect **27** · row last **29** · badge bg **30** · badge text **31** · scrim **33** ✅.
⚠️ **Three Penpot traps, now written into the sweep header:** **(a)** ⚠️ `parent.children.indexOf(shape)` returns **-1** — the children proxy does not match a wrapped shape; read **`parentIndex`** instead (my first sweep reported `-1` for every row and I nearly read that as "carries no ordering information"); **(b)** ⚠️ `setParentIndex(N)` lands a **forward-moved** shape at **N+1**, so nudge with `bringForward`/`sendBackward` and **read back** — my first attempt put the badge text at **z33, above the scrim**, and the read-back caught it before it shipped; **(c)** never fix z with `bringToFront()` on a board that has a scrim. ✅ The **sweep** (`penpot-sweeps/credits-best-value.js`) now asserts all three z facts **and** the credit-weighted average — ✅ **it is the only thing that can see them, because CI cannot reach Penpot.** ✅ **A real call confirmed all four boards.**

**3 · ⚠️ AND MY OWN CONTROL FAILED LOUDLY — correctly.** With the 500 gone, the gate's premium control (which **hard-coded** `credits === 500`) mutated **nothing**, so the ladder came back unbroken and the control went **RED**: *"control: undercutting the SMALLEST bundle breaks the premium"* **failed**. ✅ **That is a control doing its job** — it refused to pass vacuously once the data it named disappeared. ⚠️ **A hard-coded control stops biting the moment its subject goes away, which is the quiet version of a check that cannot fail.** Both controls are now **data-derived** (the smallest bundle by sort, undercut by one cent per 1,000 below its neighbour's rate; **+1¢** on the second-largest for the rule) so they survive any future ladder. ✅ Re-fault-tested after the change: **10/10 green, full suite 16 gates, exit 0.**

**US$0.00 / S$0.00.** No paid work. ⚠️ **One item still open, unchanged from §12.28:** doc 10 §3's `$1.55/1,000` now describes the **ceiling**, not what anyone pays.



**The PM:** *"what is the real best value option now. The BEST VALUE Label should be truthful… should be formulaic even in future price adjustments and should truly reflect which IS the BEST VALUE."*

⚠️ **THE HONEST ANSWER WAS THAT THERE IS NO UNIQUE BEST VALUE.** The ladder is linear at the locked rate, so **four bundles tie at exactly $1.55/1,000** (1,000 · 3,000 · 6,000 · 10,000) and **the 500 is the only bundle WORSE than the rate** — **$1.56/1,000, because 155¢ × 500 = 77.5¢ rounds UP**. So a lone `BEST VALUE` on the 1,000 row was **a tie-break's answer, not a fact** — ⚠️ **and a hand-placed label survives a price change by becoming a lie, silently.**

**So the label became a formula:**
```
perCredit(b) = price(b) / credits(b)
bestRate     = min(perCredit)                   ← "best value" = cheapest credit
winner       = bestRate, then SMALLEST credits  ← the documented tie-break
```
The tie-break (best rate for the **least outlay**) is **one line to flip** (`bestValueTieBreak`) and **the formula does not change** — nothing in it hard-codes 1,000.

**✅ New gate `check:credits` (7 checks) — the 16th gate.** `design-system/credits-ladder.json` freezes the shelf **as drawn**, the same pattern as `penpot-pairs.json`, because **CI cannot reach Penpot**. ⚠️ **Fault-tested four ways, and the third is the point:** baseline ✓7 · badge moved off the winner ✗ *("formula says 1000 … the file says 3000")* · ⚠️ **a LEGAL discount — 10,000 to $13.00 — with the badge left behind ✗ ("formula says 10000 … the file says 1000")** · a bundle below the $1.19 floor ✗2 · restored ✓7. ⚠️⚠️ **A permitted price change now MOVES the best value and the build FAILS until the label follows it.** The rule is also written into each board as **plugin data**, and `penpot-sweeps/credits-best-value.js` recomputes and prints the manifest after any price change. ✅ **Verified live: the drawn badge IS the formula's winner on all four boards, and the average holds the floor.**

⚠️ **AND I FIXED A DEFECT IN MY OWN GATE BEFORE TRUSTING IT.** The first version asserted *"every bundle is priced AT the locked rate"* — which would have **blocked the very volume discount doc 10 explicitly permits**. It now asserts *"never above the rate, never below the floor"*, with a 1-cent rounding tolerance for the 500. ⚠️ **A gate that forbids a legal move is the same class of harm as a gate that permits an illegal one** — and this one would have been *fault-tested green*, because my fault tests only broke things toward failure.

⚠️ **The decision this leaves:** a single *factual* winner needs a **volume discount**, which doc 10 permits **down to the $1.19 floor** (the 10,000 bundle at **$11.90** wins outright). That is a **pricing** decision, not a labelling one, and it has not been made — but when it is, the gate says which row to move and **nothing else needs editing**.



**The PM:** *"after removing the offerings from the credits page now its too empty. can you re-design the whole thing, do not follow the decorations store or offering store design."*

⚠️ **Why the old layout failed once the art went: it was a product grid with no product.** Cards need illustrations; a credit balance is not a product. Removing the offering art left empty boxes — **the layout was wrong for the content, not merely missing pictures.**

**The new page (all four boards, versions `S38k`–`S38o`):** a **gold-stroked hero panel** carrying `CREDITS BALANCE / 1,750 / ≈ 11 offerings`, then a **`Buy credits` price list** — five rows of `N credits` → `≈ N offerings` → price, with a `BEST VALUE` badge overlapping the 1,000-credit row's edge, then the relation note. Header (back · title · cash chip · switcher) unchanged. ⚠️ **A price list, not a grid, because buying credits *is* a price list** — and the balance is the **hero** rather than one card among five.

⚠️ **Everything came from the file.** Styling is **copied from the file's own shapes** (panel `#fbf7ee`, ink `2.5` stroke, `r14`, the gold `#d4af37`). ⚠️ **And the build caught a styling bug in itself:** the first pass inherited **`Noto Serif SC` for everything**, because that is the *title* face — **this file uses `sourcesanspro` for data and labels and the serif only for display**, so all data is `sourcesanspro` and **only the hero numeral keeps the serif**. ⚠️ **The `≈ N offerings` figures are ARITHMETIC, not invention** — derived from the locked **150 credits per offering**: 500→3 · 1,000→6 · 3,000→20 · 6,000→40 · 10,000→66. ⚠️ **Prices stay `TBD` except the locked one**; doc 10 pins **$1.55 / 1,000** and nothing else, so the other four rows keep their placeholder rather than a number I made up.

⚠️ **FOUR DEFECTS THE BUILD CAUGHT IN ITSELF, and each is a repeat of a class from this session:**
1. **The credits balance appeared twice** — the header chip *and* the hero. ⚠️ The chip is gone; the hero owns the balance, and the header keeps only **Cash**.
2. ⚠️ **`toLocaleString` silently produced `1000`** — the plugin runtime has **no ICU**. Separators are now formatted by hand; every board reads `1,000 / 3,000 / 6,000 / 10,000`. ⚠️ *A formatting call that degrades silently is the same failure shape as a gate that cannot fail.*
3. ⚠️ **An orphaned empty pill survived on three boards** — ZH names its chip layers differently, so a **name-based** removal missed the background. Found by **comparing pill rects against labels in the chip band** (geometry, not names).
4. ⚠️⚠️ **On the confirm boards the new content was appended ABOVE the scrim**, which would have drawn the rows over the confirm dialog. Scrim + six sheet layers restacked, **verified by index: every row sits below the scrim**.

✅ **Structurally verified on all four boards:** nothing outside the board bounds; every text's ink fits its box; no row collides with the hero, the section label or the note; the confirm sheet is above the content. ⚠️ **Stated plainly: I cannot see images, so the aesthetic judgement is the PM's.** The board exports to a 390×844 PNG and the geometry above is what can be proved. ⚠️ Unchanged: the credit bundles other than $1.55 still read `TBD`, and the offering illustrations stay hidden — ⚠️ **the new design needs no illustration at all, which is the point.**



**The PM, on the page I had just built:** *"9e should not have offerings at all. It should be just Credits and their cash value. Emphasize on the credits. You can show the relation to how much offerings they can buy, but offerings should not be the focus."*

⚠️ **The leftover offerings were not in the copy. They were the ARTWORK and the layer names.** Five **visible art groups per board** — `art · Cash Bundle` · `art · House` · `art · Phone` · `art · Gold Bar` · `art · wealth bundle (ingots)` — i.e. **the cards were illustrated with the offerings they buy**, which is precisely "offerings are the focus". Plus **8 stale `(bg)` layer names per board** (`card · Cash Bundle cash (bg)`, `card · Gold Bar points (bg)`…) and a **full-card 165×150 `card · House owned (bg)` overlay** cloned from the store's House card.

⚠️ **The `(bg)` rename was done by GEOMETRY, not by guesswork** — each price pair was matched to the card it sits with (every pairing landed within **41–49 px**, consistently across all four boards). Guessing the order would have mis-assigned three of four pairs.

⚠️ **AND THE `House owned (bg)` RECT NEEDED A CHECK BEFORE HIDING IT.** At 165×150 it is **exactly card-sized**, so it could have been the *card's own background* rather than an "owned" badge — hiding the background would have broken the card. Measuring it against its siblings settled it: the card backgrounds **already existed under credit-numbered names** (`card · 500 (bg)` · `card · 3000 (bg)` · `card · 6000 (bg)` · `card · 10000 (bg)`), so the 165×150 duplicate is a **state overlay** ✅ safe to hide — and ⚠️ **those existing names are themselves evidence that the page was designed as a credits page all along**, which is why the `9c`/`9d` Credits tab pointed at it (§12.24).

⚠️ **THE UNIT CHANGE, and it answers the open question from §12.24:** `about 6 photos` → **`about 6 offerings`** (ZH `约 6 次拍摄` → **`约 6 次供品`**), likewise `≈3 / ≈20 / ≈66`. ⚠️ **That was the "photo counts are wrong" report:** the relation was being counted in photos when the thing a credit buys is an **offering**.

⚠️ **And the Store Points chip had to go.** Doc 10's invariant is *"credits ← money + deliberate grants ONLY"* — **credits cannot be bought with Store Points**, so a Store Points balance on a credits *purchase* page advertises a payment route that does not exist. It is now the **cash** chip: **Credits + Cash**, which is exactly "credits and their cash value".

✅ **Verified on all four boards:** card titles are credit amounts only (`1,000 / 500 / 3,000 / 6,000 / 10,000`, and `点数` in ZH); **zero visible offering names and zero visible offering art**; the brief layer-name clash the rename created is fixed (`card · 6000 owned (bg, hidden)`); 24 layers hidden, 40 renamed, versions `S38h`–`S38j`.

⚠️ **What this needs next, and it is not a naming job: the five hidden art slots are empty.** The cards now show credits + their cash value on their own, as asked — **but they need credit-token artwork** to replace the offering illustrations. ⚠️ **Also still open:** the non-featured bundles read **`price TBD`** — and the price shows **twice** per card (the `meta` line and the cash chip), both placeholder; doc 10 pins only `$1.55/1,000`, so the rest is not derivable and has not been invented.



**The PM answered all three (`SCRUM-99`), and `SCRUM-100` did not revert.**

**(1) House** — *"use 楼房"*: `祖屋 → 楼房` on `8c` · `8 Collection` · `2e`, `Family House → House` on `8 Collection`, layers renamed. Store, Collection, History and the picker now all read **`House` / `楼房`** ✅ — the pairing the icon spec (*"big modern house"*) argues for. **(2) Currencies** — *"积分 = 商店点数 · 点数 = 点数"*: **Store Points is 积分 everywhere; 点数 means credits only.** ⚠️ The sweep caught **seven more than I had found**, on `ZH · 7c`, where every decoration card was priced in 点数.

⚠️ **(3) The decision that mattered — and it proved I had broken a working screen.** The PM pointed out the Daily gift page is **orphaned** (wire it from the Home streak) and that the **Credits page is missing** from the Credits tab. ⚠️ **It was not missing — board `9` WAS the Credits page, and my `S38a` conversion had turned it into an offerings store.** The evidence was in the **interaction destinations**, which I had never read:

* **`9c`/`9d`'s `Credits` tab already pointed at board `9`** ✅ → board 9 was the Credits page, which is exactly why the PM found it missing after I changed it.
* **`EN · 9 / switcher · Decorations` was labelled `Daily gift` and correctly linked to `9c`** ⚠️ → the store screen carried a `[Daily gift | Credits]` switcher whose **labels and links were right**; only the **layer names** were stale. ⚠️ **In `S38a` I "fixed" the labels to `Offerings/Decorations` — I trusted the layer names and broke a correct link.**
* **`EN · 9 / btn · back → EN · 7 Store`** ✅ → board 9 is also the offerings purchase screen, so **both readings were true** and both were needed.

⚠️ **THE TWO LESSONS, AND THEY ARE MIRRORS.** With the offering name, **the board was right and the code was stale** — I had it backwards until the changelog said so. With the switcher, **the labels were right and the LAYER NAMES were stale** — I trusted the names and inverted a correct link. ⚠️ **A layer name is not evidence about the label; the interaction destination is.** Reading the 1,333 existing interactions before editing would have prevented both.

**✅ Done (`S38d`–`S38g`):** ⚠️ **the Credits page CREATED** — `EN · 9e Credits` · `ZH · 9e 点数` + `EN · 9f Credits · confirm` · `ZH · 9f 点数 · 确认`, cloned from `9`/`9b` with the **credits content restored verbatim from the board's own pre-conversion text** (nothing invented), placed on the file's real row pattern (EN `180+1840n`, ZH `1100+1840n`) with **no collisions**. `9c`/`9d`'s Credits tab re-pointed to it. ⚠️ **The orphan is fixed: Daily gift's `inbound` went `2 → 36`** — **all 34 Home streak layers** (`panel · streak flame` + `panel · streak label`, EN+ZH) now navigate to `9c`. ⚠️ **And two more wrong links fell out of the same audit:** the offerings store's `Decorations` tab pointed at **Daily gift** → now `7b`; Daily gift's back button pointed at the **offerings store** → now **Home**. ⚠️ **Board names renamed off "credits"** (`EN · 9 Cash shop / credits` → **`EN · 9 Buy offerings`**, `ZH · 9 商店 / 点数充值` → **`ZH · 9 购买供品`**) — ⚠️ **those names are what made the page look missing in the first place.** ✅ **`doc 10 §3` stands unchanged**: the Credits page *is* its `$1.55/1,000` cash shop.

⚠️ **Verified:** no dead ends — Home **—streak→** `9c` **—Credits→** `9e` **—card→** `9f`; and `9` **—card→** `9b`, its `Decorations` tab → `7b`. ⚠️ **Two gaps recorded, not hidden:** the Credits page's value lines still read **`≈20 photos`** — the board's own text, restored verbatim, ⚠️ **and photo counts are the thing that was reported wrong**, so it is flagged for confirmation; and the non-featured credit bundles still read **`price TBD`** (doc 10 pins only `$1.55/1,000`).



**The report.** *"In the shop EN-9 and ZH-9 we are using the number of credits instead of the name of the offerings as the title of the offerings, and on the same pages we are using number of photos in the yellow option — which is wrong. Standardize to the same design as the decorations. There should be no 'Credits' for Buying offerings; 'Credits' should only be for Making offerings."*

⚠️ **Board `9` was a credits shop wearing an offerings-store title.** `hud · screen title = Buy offerings`, yet every card's **title was a credit amount** (`1,000 credits` · `500 credits` · `3,000 credits` …), every price read **`price TBD`**, the value slot on the yellow card showed **photo counts** (`6 photos` · `≈20 photos` · `≈66 photos`), and the balance chip was **`Credits 1,750`** with **no cash chip at all**. ⚠️ **And board `7 Store` already did it right** — offering names, `base 480/960/1,440/720`, `$X.XX` + `NNN pts`, both balance chips. **So the fix was to make `9`/`9b` behave like `7`/`7b`/`7e`** — a copy, not a redesign.

**Done — 104 edits on `9` + `9b` (EN and ZH), versions `S38a`/`S38b`:** titles are offering names; prices are cash + Store Points; ⚠️ **the photo counts are gone** from the yellow option; the credits chip became the **cash** chip (layer renamed too); the credits-framed intro and note were replaced with the store's cash/points copy; the switcher was restored from stale `Daily gift / Credits` labels to `Offerings / Decorations`. ✅ **Verified: 84 layers measure byte-identical in ink AND box to the board each value was copied from** — the offerings store is now *literally* the decorations-store design, with zero reflow. **0 credits or photo mentions remain.**

⚠️ **The stale name, found while doing it.** The boards said **`Cash Bundle`** — which is the **old** name. The README changelog (2026-09-25, the icon redraw) records *"**Cash Bundle → joss-paper stack** (foil square + tie), Gold Bar → an LBMA-tapered block, House → big modern house, Phone → a real smartphone"*. **The boards were drawn before that rename**, so they were stale and the catalogue's `Joss Paper Stack` was correct. **5 visible names fixed** + **22 layer names** (`card · Cash Bundle *` → `card · Joss Paper Stack *`, both languages) so future sweeps match by layer name. ⚠️ **The generalisable lesson: when a board and the code disagree, do not assume the board is newer — check the changelog. I had it backwards until the changelog said otherwise.**

**⚠️ Three questions the boards cannot settle, filed as `SCRUM-99` (a `🎯 Decide:` ticket):**

1. **The House is four-way inconsistent** — `House` (`7 Store` · `8c` · `2e`) vs `Family House` (`8 Collection`); `楼房` (`7 Store`) vs `祖屋` (`8` · `8c` · `2e`) — and they **pair up wrongly across languages** (`House` beside `祖屋`). ⚠️ **Evidence points both ways**: the icon spec says the item became a *"big modern house"* (→ `House / 楼房`), but the **Collection** pairs `Family House / 祖屋` and ZH says 祖屋 on 3 of 4 boards.
2. ⚠️ **`点数` means BOTH currencies in 中文** — **Store Points** on `7d`/`7e` (`1,000 点数`, `商店点数 1,480`) and **credits** on `3c`/`9c`/`9d` (`点数已退回`, `点数 1,750`), while `5b` · `7 Store` · `9b` use **`积分`** for Store Points. A reader cannot tell the two apart. Doc 10's own UX copy uses 点数 for *credits*, so `积分 = Store Points · 点数 = credits` is the doc-aligned reading (4 layers change).
3. ⚠️⚠️ **Where are credits BOUGHT?** **Doc 10 §3 says `photo_credits in: cash shop ($1.55/1,000)`** — and README 2026-09-26 records it as **locked**. **Board `9` *was* that shop.** Converting it to an offerings store means **the spec'd credit source has no screen**: either (a) credits become grant-only (starter 2,000 + sign-in 150/day) and **doc 10 §3 + its runway arithmetic must be updated**, or (b) the cash shop stays and **this board-9 work reverts**. ⚠️ **I am not choosing (a) merely because I implemented it** — that is the "decision recorded as unmade" this project keeps catching.

⚠️ **Also recorded, not fixed:** the board *names* (`EN · 9 Cash shop / credits` · `ZH · 9 商店 / 点数充值` = *"store / point top-up"*) are now stale; and `9`/`9b` have **no `card · House owned` state** where `7 Store` does, so the fourth card shows a name and a base value with **no price and no owned tag**.



**The sweep, done from the vendored table rather than from memory.** `SCRUM-95` had already burned on a hand-typed traditional list that missed 13 characters, so this time the check was **derived from the vendored OpenCC table** (`src/lib/zh-script.ts`, 2,965 pairs): dump the **distinct characters** used across every ZH board text (`1364 layers`), intersect, convert the hits.

**Exactly 6 traditional characters were present** — `誠 → 诚` · `對 → 对` · `準 → 准` · `邊 → 边` · `拋 → 抛` · `鍾 → 钟` — on **15 layers across 6 boards** (`4 Burn` · `4b` · `4s` · `5 Reward` · `5b` · `7b`). Converted at version **`S37i`**, then re-dumped and re-intersected: **0 remaining.** ⚠️ All are **1:1 substitutions**, so the strings are identical in length — **a reflow is impossible**, which is why this one needs no ink comparison.

⚠️ **My own hand-typed attempt was wrong twice, in public.** It **missed `拋`** — so `上滑對準火心拋入` is traditional in **four** characters, not two — and it **invented five false positives** (`分` · `身` · `馗` · `擦` · `虔`, all **identical in both scripts**). Built from a remembered list, the scan reported **58 hits of which ~4 were real.** ⚠️ **That is `SCRUM-95`'s missed-13 reproduced one session later on a different surface** — the lesson is not "be careful", it is **do not hand-type the reference set; load it**.

⚠️ **AND A REAL LIMITATION OF THE `SCRUM-98` METHOD, found here and recorded rather than quietly repaired: copy-from-a-twin copies the twin's SCRIPT too.** `ZH · 4 Burn / 焚烧` was **traditional**, so copying its strings into the untranslated `4b`/`4s` clones **propagated `對準火心 —` and `虔誠 ×1.5` into them** — those two boards read traditional where they had read **English**. Net still an improvement, but **not script-clean by construction**; fixed by this sweep. ⚠️ **The generalisation: a twin can pass the same-state test and still be wrong on another axis — script, terminology, currency. Same-state proves the state, not the quality.**

---

### 12.21 · S37f/g — SCRUM-98: `ZH · 1g` was an untranslated CLONE, and "at least" was right — 24 boards (2026-10-10)

**The report.** *"Zh-1g is still bilingual at least."* ⚠️ **`ZH · 1g 首页 / 离线` was not bilingual — it was an untranslated clone of its EN board.** Ten strings were pure English (`Shrine` · `League` · `Profile` · `Store` · `TRIBUTE POINTS` · `12-day streak` · `Your altar is empty — tap ＋ to add a tablet.` · `Offer something meaningful, once a day` · `Make an Offering` · `Everything here is customizable`), with only the offline banner in Chinese. And *"at least"* was correct: **24 ZH boards, 107 strings.**

**The blind spot is the same one, again.** `check:copy` (SCRUM-97) reads the repo; **CI cannot reach Penpot**, so a design board is invisible to it — the identical conclusion `SCRUM-93` reached for contrast. ⚠️ **This is the third time in one session that a reviewer's eye found what a gate could not see**, which is the honest state of the design file rather than a gap in the code gates.

**The method, and the trap it avoided.** Every English string was looked up against a **twin** — a same-named layer on a sibling ZH board carrying Chinese — and **95 of 107 had one**, so the fix was a **copy, not new copy**. ⚠️ **But a twin was accepted only when its own EN counterpart carries the identical English**, because **layer names alone are not enough**: the `1` and `1a` boards carry *different* Chinese under the same `hint · cta` name (`每日供奉一件有意义之物` vs `从这里开始 — 安放第一座牌位`), so a name-only match could have lifted the **first-run** string onto the **offline** board. Strings failing that test were **skipped and reported, never guessed.**

**Done:** `ZH · 1g` (10 strings, version `S37f`) + **88 strings across 13 boards** (version `S37g`) = **98 strings, 14 boards**.

**✅ Verified for `1g`, against its twin rather than a heuristic.** 17 layers compared with `ZH · 1 Home / 首页`: **all characters match, all ink matches (identical width×height), zero Latin text remains.** ⚠️ The first check I wrote flagged four layers as wrapping at a `inkH > 0.9 × boxH` threshold — **that was my metric being wrong** (one 12 px line inks ~16.5 in an 18 px box), not a defect, and it was replaced by the comparison that actually means something: **the clone must equal the good board.**

✅ **Verified — and the caveat is closed.** The ink/wrap comparison was completed for `1g` (**17/17: characters AND ink identical to its twin, zero Latin left**), then properly across **924 layer-pairs — every CJK layer on a ZH board against the same-named layer on its EN counterpart: 888 roughly equal · 34 MORE COMPACT (Chinese is shorter) · only 2 taller, neither a defect.** One carries an explicit `\n` (`三千年的心意，\n未曾改变。` — deliberately two lines, and **not one of my edits**); the other is a **~3 px** delta on a 4-character sheet title. ⚠️ **Zero wraps were introduced by the 98 substitutions.** ⚠️ Recorded but not a defect: **188 sub-pixel box overshoots on ZH and 194 on EN** — the file's house style in **both** languages. ⚠️ Stated gap: **101 CJK layers have no same-named EN counterpart**, so they were not compared. ⚠️ **And a trap to remember: `textBounds` is STALE within the call that sets `characters`** — the first re-measure reported `供品` at the *English* "Offerings" width (51.2), which would have manufactured a reflow that did not exist. **Read bounds in a SUBSEQUENT call.**

⚠️ **The residue was MY bug, not the file — the second correction in this entry.** The 6 strings I first reported as *"real defects with NO twin"* **have twins** (`供品` · `装饰` · `没有实物？选一件`, at the **same layer names**). ⚠️ **My same-state guard failed CLOSED on a bug**: the token→board map indexed **ZH and EN boards into one lookup**, so when a ZH board was indexed first under a token it was compared **against itself as if it were the EN board** — the check rejected a legitimate twin and I reported "no twin exists". ⚠️ **It looked exactly like principled caution; it was a defect** — the same class as the blind `check:copy` and the hand-typed translation list: *a check that fails the wrong way and reads as diligence*. Redone with explicit board/layer pairs and the **real** EN names (`EN · 7c Store · Decorations (more)` · `EN · 2 Capture`), which **prove the same state** — those boards say **"Offerings"** · **"Decorations"** · **"No object? Choose one"**, precisely the strings replaced. ✅ All 6 now measure **byte-identical to their twins INCLUDING box geometry** (`供品`/`装饰` 27×17.6 in a **171×33** box · `没有实物？选一件` 112×15.3 in a **174×27** box). **Version `S37h` → 104 strings / 14 boards.** ⚠️ **Left for a human:** `Xiao Chen` (`ZH · 0e7`) — a *demo clan name*, so `陈氏` would read better on a 中文 board, but the file's convention is **not** to localise clan names: **flagged, not changed**.

**✅ Legitimate Latin, recorded so a future sweep does not mangle it:** the invite codes (`GX7K-2M4P` · `GX7K-9Z9Z`), `AR` in the app mark, **`Tan Family`** (the clan name, deliberately un-localised and already asserted as such on the `0e3`/`1h` boards), and `EN` in the language row. ⚠️ **`Xiao Chen`** (`ZH · 0e7`) is flagged, not changed — a *demo clan name*, so `陈氏` would read better on a 中文 board, but the file's convention is not to localise clan names.



**Found by the reviewer, not by a gate.** *"Some Chinese panels which are marked zh still have English labels in the buttons and titles."* At that moment `tsc`, `check:lib` (382 checks) and `check:contrast` were **all green**. The lesson is the project's oldest one in a new costume: **the gates only see what they were built to see.**

**Three causes, each invisible to a different gate.**

1. ⚠️ **`burn.tsx` and `capture.tsx` did not import `t` at all.** 18 literals across four screens, several **bilingual** — `开始 · Begin`, `确认 · Confirm`, `上滑对准火心抛入 · Swipe up & aim for the heart`. So a 中文 panel showed **English* and an EN panel showed **Chinese**: the worst of both.
2. ⚠️ **Four sites rendered `{value.zh} {value.en}` — BOTH languages, in EVERY locale.** `burn.tsx`, `reward.tsx` ×2, `index.tsx`. This is not a translation gap but a **missing concept**: there was no supported way to read a bilingual `{ en, zh }` value in the active locale. Fixed with `localized()` in `i18n.ts`, which reads the locale **at call time** so a `setLocale` re-renders correctly.
3. ⚠️ **The catalogue had no Chinese at all.** `OFFERINGS[].name` was `{ en }` only — the five store items had no `zh`, so `localized(o.name)` returned English on a 中文 panel. **This one was found by a new assertion, not by the report** — and it is the argument for writing the assertion even when you think you know the scope.

**⚠️⚠️ The most transferable part: my first copy gate was BLIND and reported a clean pass.** It skipped any line containing `style=` — which is nearly **every JSX line**, since `style={styles.x}` is on almost all of them. So the fault test I ran (hardcoding `Swipe up and aim for the heart` back into `burn.tsx`) was skipped and the gate printed **✓ all 3 copy checks passed** over the defect it had just been handed. It was caught only because the fault test produced **no failure output**, which is not what a working gate looks like. The fix strips non-copy attribute **values** rather than skipping **lines**, and the gate now carries a **positive control that runs every time** — the detector must fire on a synthetic literal and a synthetic bilingual line, and stay quiet on a localised line and a `testID`-only line. **A blind gate is worse than no gate: it manufactures confidence.**

**The gate is wired, not just written.** `check:copy` (`src/lib/checks/copy.ts`) is in `npm run check` **and** in a new `ci.yml` step — the same discipline `SCRUM-93` forced on `check:contrast`, and the same trap: a gate that is not run is not a gate.

**Copy provenance, kept honest.** The 中文 for the ritual screens is taken **verbatim from the design boards where they carry it** (`上滑对准火心抛入` · `未中火心 · 供品回到您手中——未失未得。` · `重投最高至虔诚 ×1.5 —— 永不为正中 ×2.0。` · `三次已尽。` · `再次投掷` · `功德点`); **the remainder is new copy** written for this fix and listed in the PR. The five store names come from `ZH · 7 Store / 商店` (`金银纸 · 金条 · 手机 · 楼房 · 财富套装`), matched **by name, not by base value** — because the board's metas (`Gold Bar 基础 960`) **disagree with doc 10's prices**, which is a pre-existing drift now recorded in `SCRUM-96` along with two more: the board says **"Cash Bundle"** where the catalogue says *"Joss Paper Stack"*, and the House is **楼房** in the store but **祖屋** in the collection.

**One exemption, printed rather than silent.** `src/app/index.tsx` is the `SCRUM-53` scaffold and its prose documents the *numbers* for a reviewer; localising developer documentation is wasted work. Its **controls** are localised, and rule 2 will cover the file the moment it leaves the exemption list — the gate prints the exemption on every run so it cannot pass unnoticed.

**Verified.** `npm run check` **exit 0** (15 gates) · `check:lib` **382** (section 16 asserts the 21 `zh` strings carry **no Latin text** *and* exercises `localized()` across locales) · `check:copy` **7**. **Fault-tested red three ways, restored byte-identical:** a hardcoded literal, the both-languages pattern, and a `zh` string made English. ⚠️ **Not verified on glass** — that rides on `SCRUM-88`, because no device has been delivered.



**The decision.** PM: *"Simplified Chinese. Has a significant larger market."* That closes option **B** of the three `SCRUM-95` offered. ⚠️ **It was a cultural call, not an engineering one** — the audience is Chinese-reading families in the 40–50s diaspora band, Singapore is officially simplified but has a real traditional-using segment, and `AGENTS.md` calls cultural sensitivity non-negotiable. It had sat **untracked** since S31, visible only as an `⚠️ TRADITIONAL` comment in `i18n.ts` and a line in the handover.

**What moved.** The whole `zh` table **at once** — a partial flip was the thing `SCRUM-92` had refused to do, because a pill in simplified beside traditional neighbours is a **mixed-script screen**, worse than either consistent choice. The sweep then went wider than the ticket expected: the ZH copy also lives in `app/burn.tsx`, `domain/aim.ts` (the band labels), `domain/catalogue.ts` and `domain/quota.ts` — **11 files, 24 lines**, plus `i18n.ts`.

**⚠️⚠️ The most transferable finding: my first conversion was done with a hand-typed list of ~80 traditional forms, and my check of it was worthless.** The list silently missed **`來 · 碼 · 設 · 誠 · 邊 · 輸 · 線 · 內 · 歡 · 錯 · 維 · 機 · 問`** — the output shipped `家人发來了连结` and `設为长老`. Worse, the verification I wrote **grepped only for the characters the list already contained**, so it was structurally incapable of finding a miss: it reported "✅ no traditional character remains" over a table containing thirteen. **This is the same failure as the "12/12" migration count and the `check:contrast` blind spot — a check that cannot fail the right way.**

The fix was to stop authoring the mapping and **use an authoritative one**: **OpenCC's `TSCharacters.txt`** (Apache-2.0, ~5,000 entries), whose first pass immediately converted the 14 characters the hand list had missed. It is now vendored as two positionally-paired strings in **`src/lib/zh-script.ts`** (2,965 pairs, ~9 KB) with its source and licence in the header — so the **repo carries the means to redo the conversion**, and the guard is data, not opinion.

**⚠️ Character-level is not word-level, and the spec caught what the tool could not.** A character pass produces `连结` and `身分`; the correct simplified is **`链接`** and **`身份`**. Both were caught **by cross-checking doc 15 §8's copy table (C2/C10) and the `ZH · 0e9` board** — the spec was right and the conversion was wrong. Two hand fixes, and the lesson: *a converter proves characters; the spec proves wording.*

**The guard.** `check:lib` **section 15** asserts no shipping ZH string carries a traditional character — the `zh` messages, the four band labels, the quota copy, the catalogue names — plus the two word-level cases and a dictionary-size floor so a truncated data table fails loudly. **Fault-tested red twice, restored byte-identical:** `role_head → 族長` (2 failures) and `链接 → 连结` (1 failure, the word-level guard). `check:lib` **321 → 335**.

✅ **And it closes `SCRUM-92` AC 5 without touching a line of it**: the pill returns `ROLE_LABEL_KEY.head` = `role_head`, so the moment the table says **`族长`** the pill matches its board — which is exactly why the key was used instead of a hardcoded string.

⚠️ **Two corrections recorded rather than glossed.** First, my own `SCRUM-95` comment claimed *"all four S36 ZH design boards are simplified"* — they are **mostly**, and **7 strings are still traditional** (`虔誠 · 擦邊 · 對準 · 鍾馗像`), with the simplified forms sitting on *other* boards, so the file contradicts itself. Filed as **`SCRUM-96`**, and ⚠️ **its sweep is INCOMPLETE because the Penpot plugin tab was unreachable** — the ticket says so rather than implying a full pass. Second, the `zh-script.ts` data excludes **256** pairs whose characters are astral (2 UTF-16 units), because the helper pairs the two strings by index and an astral character would shift every later entry; that exclusion is documented in the file.



**What landed.** `src/lib/clan-pill.ts` (the pure rules) · `src/components/clan-pill.tsx` (the render) · a header row in `src/app/index.tsx` · **34 new `check:lib` assertions** (`321`, was 287 at S36).

**The geometry was READ, not re-invented.** The signed-off board was measured with the Penpot plugin rather than eyeballed: pill **236×44 · r14** · name dx 14 · chip dx 106 dy 10 **h 24 · r12** · affordance dx 204 **18×18** — identical on all four boards (`EN|ZH` × 1 / 2+ clans). `check:lib` freezes every number, so a later "tidy-up" that rounds 14 to `radius.lg` (16) **fails**, which is the point: this control's whole justification is that it *moves nothing* signed off.

**Two derived values that would have moved the pill silently:**

- ⚠️ **RN draws `borderWidth` INSIDE the layout box**, but the board measures the name box 14 px from the pill's **outer** edge while its stroke is `alignment: inner`. So the RN padding is **11.5**, not 14 — typed naively the whole content shifts +2.5 px right of the signed-off position. Derived as `PILL_SPEC.name.dx − PILL_SPEC.borderWidth` and asserted.
- ⚠️ **The name box width is derived, not typed**: `chip.dx − name.dx` = **92**, which happens to equal the board's own 92. Asserting the two agree is what catches an edit to either one.

**The next exercise caught my own arithmetic.** A first `check` asserted the header re-adds to `330`; it is **310** (I had counted the right margin twice), and the gate went red on the first run. The assertion is now the identity that actually matters — `rightPad + settingsSlot + settingsGap + pillWidth + PILL_X === 390` — which ties the measured `x = 80` back to the 390 px reference instead of to a hand-summed constant.

**⚠️ The affordance is ONE glyph in TWO states.** `›` (U+203A) in both; the 2+ state is the **same glyph rotated 90°**. S36b fixed exactly this class of bug — `›` is punctuation and `▾` is a geometric shape, different Unicode blocks, so different weight and optical size. The gate asserts the codepoint *and* that both states return the identical string.

**⚠️ The pill reuses the switcher; it does not build one.** Tapping routes to `/clan/manage`, where the switcher already lives (S36's note: *"do not build a second switcher"*). The active clan is `clans[0]` — the same default `manage.tsx` uses — so the two cannot disagree; a **persisted** active clan does not exist yet and is deliberately not invented here.

**⚠️ One acceptance criterion is NOT met, and the ticket is `In Review` rather than `Done` because of it.** AC 6 requires a **device screenshot**, and the floor device has been **purchased but not delivered**. `SCRUM-64` states the emulator is *"a development target, not an acceptance target"*, so it cannot stand in. The build is proven by **types + 321 gate assertions + a four-way fault test** and by nothing on glass.

**⚠️ AC 5 could not be met as written, and I did not fake it.** It asks for the board's **simplified** ZH (`宗族` · `族长`) while the shipped `i18n.ts` is **traditional** (`族長` · `成員`), so hardcoding the board's string would have put **simplified text inside a screen whose neighbours are traditional** — a mixed-script screen, worse than either consistent choice. The pill therefore returns the **existing** key (`ROLE_LABEL_KEY`) and writes **no new CJK copy**; `check:lib` asserts that role by role so a future edit cannot fork it. **The script question had no ticket at all** — it existed only as an `⚠️ TRADITIONAL` comment in `i18n.ts` and a line in the handover — so it was filed as **`SCRUM-95`** (🎯 Decide, in Sprint 1) with the three options and their consequences.

**⚠️ One deliberate gap, labelled rather than hidden.** SCRUM-91 drew only the 1-clan and 2+-clan pills, so with **zero** clans Home has no designed clan control. The old scaffold entry therefore **stays, but only in that state**, because `AFTER_TUTORIAL_ROUTE` sends a new user to the fork while the fork's *Skip* can return them to Home — deleting it would strand a clan-less user with no route. It is commented as a gap, not dressed up as the pill.

**Also corrected:** the four docs written earlier the same day said the device **gate was cleared**, which read as *available*. It is **purchased, awaiting delivery**, so `SCRUM-88` and `SCRUM-51` are still blocked in practice — the distinction the docs now carry.



**The defect, re-derived rather than copied.** `#7b621f` on `#d4af37` = **2.77:1** — computed independently by the gate's own luminance function, which also reproduces the ticket's number. **`#7b621f` is `--gold-text`**, a token verified for **cream** backdrops (worst 4.52 on `--paper-deep`); `#d4af37` is **`--gold`**, a **decorative fill-only** token. So this is not a bad colour — it is a **role inversion**, exactly what `tokens.css` opens by warning about: *"A colour can be perfectly good as a border or a fill and still fail as text."*

**The fix was not invented — it was already approved.** The S36 pill's role chip uses ink on gold: `card · role chip (bg)` `#d4af37` + `card · role chip (label)` `#1a1a1a` on all four pill boards. `#1a1a1a` on `#d4af37` = **8.28:1**, re-derived here. So the `0e3` chip had simply **drifted from its own component**; the fix moved it back. Penpot version **`S37b · SCRUM-93 — role chip AA on 0e3 + 0e12 (all 4 boards)`**.

⚠️ **The ticket listed TWO boards. The component was on FOUR.** A discovery sweep matched the chip by its **naming convention** (`card · role chip (label)` + its `(bg)` sibling) across all 161 boards, not by a hard-coded board list — and found the **identical defect at 2.77:1 on `EN/ZH · 0e12 Clan / state · already a member`**. All four were fixed. **Fixing only "the two `0e3` chips" would have been a half-fix that looked complete**, which is the same shape as S36b's panel defect (one component, 35 boards).

**The durable half is the gate.** `check:contrast` reads `tokens.css` and the app source, so it **structurally cannot see a Penpot board** — that is *why* a signed-off board could carry an AA failure, **despite `SCRUM-45` having cleared 132 AA failures in the same file**. `check:contrast` therefore gained a **third part**, which asserts **`design-system/penpot-pairs.json`** — a **frozen snapshot** of the board pairs, refreshed by **`penpot-sweeps/penpot-contrast-sweep.js`**. Two properties are deliberate:

- **A control pair is asserted green.** `#7b621f` on cream (`link · back`, **5.13:1**) **must keep passing** — the gate fails if it drops. This is a **role** inversion, not a banned colour: a check that simply forbade `#7b621f` would be wrong, and would have "fixed" the wrong thing.
- **The requirement is DERIVED, not stored.** `min` comes from `text` (`normal` → 4.5, `large` → 3.0) and any contradicting `min` is rejected, so a failing pair cannot be made to pass by editing a number. An **empty or gutted manifest also fails** rather than reading green.

⚠️ **A snapshot is not a sweep**, and the gate prints that limit rather than implying coverage: a pair newly added to a board stays invisible until the sweep is re-run. The sweep is what discovers; the manifest is what CI can assert.

**Fault-tested four ways — all red, then restored:** manifest `fg` → `#7b621f` (**1 failed**); `min` quietly lowered (**rejected**); manifest gutted (**1 failed, 0 passed**); and **live in Penpot** — the label put back to `#7b621f` measured **2.77 FAIL**, restored to `#1a1a1a` measured **8.28 PASS**, with the four boards re-verified afterwards. Corrected sweep over the whole file: **122 chip pairs · 8 role-chip pairs · 0 failures.**

⚠️⚠️ **My own first sweep was wrong, and it is the most transferable thing here.** It read `fills[0].fillColor` and **ignored `fillOpacity`**, so a **12 %-gold tint on paper** (`#d4af37` at `0.12`) was treated as a **solid gold fill**. `#7b621f` on that phantom surface computes 2.77 and is **false** — the real surface is ~`#f3ecd9` and the true ratio is >5. That manufactured **191 "AA failures"**, including `#9a2b18` on `#c23b22` at **1.44** for chips that are **8 %-tinted**. Three separate errors compounded: no alpha compositing, **Text shapes accepted as surfaces** (text-behind-text), and the **4.5 body bar applied to 90 px glyphs and 40 px logotypes** that need only 3.0. **A big scary number is not evidence** — the corrected resolver reports **16**, and only **6** of those sit on a solid fill. All four traps are recorded in `penpot-sweeps/penpot-contrast-sweep.js` so the next sweep does not re-derive them.

⚠️ **Two adjacent findings were FILED, not silently fixed** — `SCRUM-94`. Both would change the artwork, so they are not the sweep's to edit: the `0e8` success glyph is `#fff8e8` on a **solid** `#d4af37` disc = **1.99:1**, a pair `tokens.css` already names verbatim (*"was #D4AF37 @ 1.99 — the worst in app"*) with the compliant `--disc-gold:#887023` provided — ⚠️ **but it is an emoji, and a renderer may ignore an emoji's fill, so the verdict depends on a check before any edit**; and `7 Store`'s Owned chip is **4.42:1** — **0.08 short**, on a **composited** surface, so it must be re-derived on the real stack. ⚠️ **Neither is asserted in the manifest yet, deliberately**: the manifest holds what has been *verified*, not what has been *guessed*.



**The review found three things the `0 collisions` check could not see:** the clan-head chip looked misaligned, the streak panel was top-aligned, and the drop-down arrow was inconsistent. ⚠️ **The first two share one root cause, and it was mine: I checked the pill against LAYOUT boxes (`shape.width`/`height`) when a Penpot `Text` reports a box that is not its inked glyphs.** The house tooling already said so — [[penpot-sweeps/occlusion-contrast-audit-v3.js]]: *"a Text shape reports a LAYOUT box far wider than the inked glyphs... measure with `textBounds`"*. I had read that file and still built the pill on layout boxes. **A gate that measures the wrong box passes.**

**What the ink said.** `EN · 1h`, name: box 80 wide, ink **51.9 × 39.2** → `lines: 2.2`. ⚠️ **"Tan Family" was WRAPPING to two lines** — and at `lineHeight 1.2` inside a 44 px pill that reads as *"misaligned"* even though every box was centred to 0.2 px. The chip was also cramped: ink 77.4 inside an 84 box = **3.3 px padding**. And the streak panel's content ink sat **1.8 px from its top vs 10.4 px from its bottom**.

**Fixed the measure, not the symptom.** Name re-flowed to one line (**it needs 84.2 px, not 80**); chip re-padded to **8 px** and re-seated from the name's *ink* edge; the affordance unified to **ONE glyph family** — `›` (**U+203A**), with the open state that **same glyph rotated 90°**. The old pairing was `›` vs `▾` (**U+25BE**, a filled geometric triangle): different Unicode blocks, different weights (ink 3.9 vs 6.0 wide) — inconsistent *by construction*.

⚠️ **The panel defect was on 35 boards, not one.** The streak and tribute panels are copies of a single component and every copy carried the identical error (streak −4.3, tribute +2.7). Fixed **136 shapes across 34 boards** (streak +4, tribute −3), so the fix did not ship on four boards and stay broken on thirty. Re-measured: **68 panels, max deviation 0.3 px, 0 still off.**

⚠️ **Six Penpot traps, each of which silently produced a wrong result** (recorded in the sweep's header, because they will recur):
1. **A `Text` keeps its OLD WRAP until its content is rewritten.** Widening the box does nothing on its own. This is why the name wrapped on three boards *after* I had "fixed" it.
2. **`verticalAlign` is a NO-OP when set to its current value** — restoring a box's height does not re-centre the text. Toggle it, with a re-flow between.
3. **`growType = 'auto-width'` COLLAPSES the height** (44 → 18) and leaves the text anchored where it was.
4. **`rotate()` is INCREMENTAL, not absolute** — two calls of 90° gave **180°**. Use the `rotation` property, and rotate about the box's own centre or the glyph walks off-centre.
5. **A freshly created `Text` reports `textBounds` as ALL ZEROS** until it has been laid out — reading it immediately placed a sibling at `x=0`, off the board. Re-measure in a *later* call, and guard with a measured constant.
6. **`findShapes({type:"board"})` includes the "Root Frame" (which holds 157 boards)**, so a *subtree* walk double-counts every panel and would have shifted those 136 shapes **twice**. Walk **direct children** and de-duplicate by shape id. ⚠️ **The dry run caught this before the write** — which is the only reason it is a footnote and not a defect.
7. ⚠️ **VERIFY IN THE PARENT'S FRAME, NEVER AGAINST ABSOLUTE LITERALS — and this one reached the PM.** Recreating the name on three boards set it to `x = 254`, the correct value *for board 1 only*. On the other three the pill sits **470 / 1020 / 1490 px** further right, so the name — and the chip, and the arrow — rendered **outside their board**, and the PM saw an **empty pill** while every check I ran still passed, because those checks compared siblings *to each other* and used hardcoded `254`/`444` literals. **Derive every position from the container's own x (`bg.x + pad`), and assert `child.x >= bg.x && child.x + child.w <= bg.x + bg.width` for every child.** ⚠️ **Note the shape of this failure: my gate was green and the design was broken.** The PM's eye found what the check could not — the second time this session (the first being the pill that passed `0 collisions` while the name wrapped). **Prefer a check that compares a shape to its CONTAINER over one that compares shapes to each other**; sibling-relative deltas are exactly what hid this.

Fixed in **`S36c`** (revn 283): every position re-derived from the pill background, re-verified with an explicit `OUTSIDE_PILL` assertion — **0 offenders on all four boards**.

✅ **AND THE PM APPROVED IT (2026-10-09: *"looks good"*)** — the Home clan pill is **signed off**, which **unblocks `SCRUM-92`** and completes the design half of `SCRUM-91`'s option A. ⚠️ **Build from `S36c`**; `S36` and `S36b` each carry defects. ⚠️ **Two rounds of review, and each round the PM found something my gates had blessed** — the pattern recorded above is the most useful thing this section holds, and it generalises: *a check that compares a shape to its sibling cannot see a fault the siblings share.*

⚠️ **Corollary, and a correction to this session's own docs: the file has 161 real boards, not 162.** Every count taken this session ("158 → 162") includes the Root Frame; the honest figures are **157 → 161**. The **+4 delta is unaffected**, and the *conclusions* do not move — but this is now the **third** time a carried-forward number has needed re-deriving (§12.13's "12/12", §12.14's doc-15 misquote, and this).

Checkpointed as named version **`S36b · Home alignment fixes (pill ink + panels + one chevron)`**. **Spend US$0.00** — Penpot only, no AI call.

---


### 12.15 · S36 — the Home "clan card" is a PILL: the layout was measured, and the answer changed (2026-10-09)

**The task.** `SCRUM-91` asked whether a scaffold entry satisfies *"Home is clan-scoped (clan card / switcher)"*, or whether the card must be **designed + built** — the last item holding `SCRUM-46` open. The PM took the design pass first (option A).

⚠️ **The pass changed the answer, because the premise — a clan *card* — had never been checked against the board.** Two earlier sessions *stated* "the signed-off Home layout has no free band" and [[next-ai-context]] carried it as fact. This session **measured** it: rasterise all **35** Home layers and solve for the largest empty rectangle. Exactly **one** region comes back — **`x 230–486, y 180–280`**, the **header row** between the app mark and `btn · settings`:

| Band (board y) | Occupant |
| --- | --- |
| 229–282 | app mark · settings |
| 280–328 | tribute panel · streak panel |
| 332–350 | "altar state" caption |
| 340–760 | altar halo (art) |
| 856–922 | Make an Offering CTA |
| 944–1024 | tab bar |

⚠️ **My own first attempt got this wrong, and the check caught it.** I placed a full-width bar at **y 282–338** on the strength of a **truncated** layer dump that hid the tribute/streak panels — i.e. I contradicted a recorded fact on partial evidence, the same failure class as the "12/12" migration count (§12.13) and the doc-15 misquote (§12.14). The difference: a **collision check** was cheap enough to run, so it failed loudly in a work board instead of shipping. **When a layout claim can be tested in one call, test it before writing it down.**

**The design.** A **header pill**, not a card — it occupies space that is *already* empty and moves **nothing** that was signed off. Four new boards (`EN · 1h` · `EN · 1h2` · `ZH · 1h` · `ZH · 1h2`), EN + ZH, each on a **clone** of its own Home board, so **no signed-off board was mutated**. Spec: `240,234` · **236×44** (≥44 px target) · r14 · `#eae2d2` + 2.5 px `#1a1a1a` inner stroke — the **`btn · settings` treatment**, so it reads as chrome, not content. Clan name `Noto Serif SC` 700/15, shown **plain** (§2.1) and deliberately **not localised** — matching the existing `0e3` pair, which already renders `Tan Family` on the ZH board. Role chip `#d4af37` r12 carrying the **locked** vocabulary (`Clan Head` · `族长`). Affordance `›` (one clan) → `▾` (2+), because ⚠️ **the switcher already exists** in `clan/manage.tsx` — the pill only has to *say* that it opens it, so no second switcher is built. Checkpointed in Penpot as named version **`S36 · Home clan pill (SCRUM-91 option A)`**.

**Proved, not asserted.** Collision check — pill box against all 35 layers: **0 collisions on all four boards**, inner boxes strictly sequential (name 254–334 · chip 342–426 · affordance 426–462). Contrast **re-derived** from the fills: name **13.52** · affordance **7.28** · chip label **8.28** — all pass AA. (Penpot's plugin API *does* expose `file.saveVersion(label)`, so the "versions can only be saved in the UI" note that has sat in [[next-ai-context]] for several sessions is wrong — it was a claim about the API, not a call against it.)

⚠️ **A defect found in a signed-off board — by having to pick a compliant colour.** The existing `0e3` role chip (`EN · 0e3` **and** `ZH · 0e3`, `👑 …` at 13 px / 700) is `#7b621f` on `#d4af37` = **2.77:1** — failing AA (4.5) *and* even the 3:1 large-text floor. The new pill uses `#1a1a1a` on gold (**8.28**), so the failure is **not** propagated. Filed **`SCRUM-93`** — and the durable half is not the chip but the gate: **`check:contrast` reads `tokens.css` and the app source, so it structurally cannot see a Penpot board.** A chip can fail AA there indefinitely while every gate stays green, *despite* S21 having cleared 132 AA failures in this same file. **A signed-off board is not a checked board.**

**Filed, then DECIDED.** `SCRUM-92` (build the pill) and `SCRUM-93` (the contrast defect), both in Sprint 1. ⚠️ **Nothing was marked `Done` on the strength of the design pass alone** — and that restraint was right: on **2026-10-09 the PM made the call**: **`SCRUM-46` CLOSES, and the pill becomes `SCRUM-92`'s own work** — chosen explicitly *because the pill still needs the PM's review and that takes time*. ⚠️ **Nothing was cut:** `SCRUM-46`'s Scope item transfers to `SCRUM-92` **verbatim**. ⚠️ **And `SCRUM-92` was therefore not ready to build at that point — it waited on the review, not on engineering.** ✅ **That review happened, twice, and the verdict was *"looks good"* — see §12.16.** (This is the same discipline `SCRUM-50` closed under: *split out, not cut*, each residual carrying the original criterion's wording.)

**Spend: US$0.00** — Penpot only; no AI call, no deploy ([[project-costs]]).

---


### 12.14 · S35b — SCRUM-86: the invite code is elder-and-above, and two traps that nearly produced a false green (2026-10-09)

**The decision.** PM: *"limit link sharing to elder and above seniority."* ⚠️ **This CONFIRMED the spec rather than changing it** — doc 15 §3's matrix has always read `| Invite new members (link · code · QR) | ✅ | ✅ | ❌ |` (Head ✅ · **Elder ✅** · Member ❌). Two things had drifted *from* that row: `canInvite` returned `hasHeadPower` (justified by a comment that **misquoted doc 15** as saying "Elder ❌"), and the database never enforced it at all. ⚠️ **I repeated that misquote in my first SCRUM-86 comment before reading the document** — a claim about a doc is not the doc, and this is the second time in one day a carried-forward claim was wrong (the "12/12" migration count was the first).

**Migration `0015`.** Three parts: the column becomes unreadable to clients · `clan_invite_code(p_clan_id)` (SECURITY DEFINER, gated to elder+) becomes the only path to it · and `reroll_clan_code` is **replaced**, because its `returning code, name` reads a column the role no longer has. ⚠️ That last one is the shape of breakage a column revoke causes: the migration applies cleanly and the feature dies only when a head taps Re-roll.

⚠️ **TRAP A — a column revoke on top of a table-wide grant is a SILENT NO-OP.** Supabase grants `authenticated` **table-wide** SELECT, and **column ACLs are additive**: `revoke select (code)` leaves the table-wide grant standing, so `code` stays readable while the migration looks correct. The table-wide grant must be **dropped** and every *other* column re-granted by name. ⚠️ That re-grant list is now **fail-CLOSED** — a column added to `clans` later is unreadable until listed — and `invite_sharing.sql` **S9** asserts the list covers every column except `code`, so the failure is loud instead of a silent client regression.

⚠️ **TRAP B — `supabase start` does NOT apply new migrations to an existing volume.** The Docker volume `supabase_db_JossPaperAR` **persisted from an earlier session**, so `supabase start` reused it: `START_EXIT=0`, no error, and the stack looked healthy — while `clan_invite_code` **did not exist** and `authenticated` still held SELECT on `code`. **The first "it applied cleanly" was a FALSE GREEN.** It was caught only by querying the database instead of trusting the exit code:

```sql
select version from supabase_migrations.schema_migrations order by version desc limit 3;
```

which read `20261008200000` — one migration short. **`npx supabase db reset` re-applies from the files** and fixed it. ⚠️ **The generalisation: a green exit code is evidence that a command finished, not that it did anything.** Verify the STATE, not the status.

**Verified — local.** `clan_management.sql` **109 ✓** (not broken) · `invite_sharing.sql` **25 ✓** (new, self-contained fixtures) · `ai_budget.sql` **17 ✓** · `check:clanapi` **92/92** (was 81). ⚠️ **FAULT-TESTED**: replacing the table-wide revoke with the column-only form turns **S7 + S8 RED**, which proves both that the no-op is real and that the suite catches it.

**Verified — live, by real calls.** `db push` (after a `--dry-run`, and after checking that nothing else reads the column — **no Edge Function references `clans`**, and the revoke is scoped to `authenticated`/`anon` so `service_role` is untouched). Remote is now **15/15, no drift**; the live PostgREST exposes `/rpc/clan_invite_code`; and `GET /rest/v1/clans?select=code` answers **401 `42501 permission denied`**.

⚠️ **A deliberate side effect, recorded rather than hidden:** `anon` now loses SELECT on the **whole table**, not just the column — the unavoidable consequence of dropping a table-wide grant. It is the *tighter* posture, nothing in the client reads `clans` before a session exists, and **PR-3's R4 already tolerates it**: its loop treats a table `anon` cannot read at all as *"also 'reads nothing'"*. Pinned by **S13**.

⚠️ **FOUND, NOT CAUSED — `pr3_verification.sql` is RED on the local stack, with or without this change** (proved by moving the migration aside and re-running). It uses **`set local role authenticated`**, which is a **no-op** under `run-sql-tests.sh` (psql autocommit; `SET LOCAL` outside a transaction warns and does nothing) — so its *"an authenticated INSERT into `ledger_events` is DENIED"* assertion actually runs as the owner. ⚠️ **`clan_management.sql` uses plain `set role`, which is exactly why that file passes** — the house guidance exists and was applied to one file but not the other. Note also that its failure **aborts before its teardown**, and the residue then broke a *later* file's C7 assertion until a `db reset` — the documented residue trap, demonstrated live rather than quoted.

⚠️ **The PM ENDORSED option B on 2026-10-09** (*"B option is worth it"*) — the **more invasive** option, chosen deliberately over the cheap one. **A retrospective endorsement, not a new instruction** (B shipped the same day), but the reasoning is the durable part and worth keeping: **A** would have meant editing doc 15 §3 **to match a bug**, over a column any member could still `select`, and **C** would have been **security theatre** — so A and C both leave the rule enforceable **only by the client**, which is the opposite of this project's posture (*the server is the authority*, ADR-005). B is the only one of the three where a determined member **cannot** widen the family. **It cost one migration** — which is the honest measure of whether "worth it" held up.

---

### 12.13 · S35 — the hosted project was THREE MIGRATIONS BEHIND, and a fresh worktree is not linked (2026-10-09)

**The finding, measured.** `npx supabase migration list` read **remote 11 / local 14**. Three migrations — `0012` (*clan_management_api*), `0013` (*clan_head_exit*) and `0014` (*clan_successor_rank*) — had **never been pushed**. So the **entire clan system that `main` had just merged was dead on the live backend**: `set_member_role` · `remove_member` · `leave_clan` · `rename_clan` · `delete_clan` · `clan_book` were all **404 by absence**, and SCRUM-82's fixed award path was running against a schema that predated its own guard.

⚠️ **The S34 handover asserted "the hosted project was last verified at 12/12" — it was 11.** A remembered number is not a measurement. This is the second time this project has been bitten by a carried-forward total (see [[project-costs]]'s rule about re-deriving a figure from its inputs), and the honest generalisation is the one already in AGENTS.md: **re-derive, don't copy forward.**

**The trap that made it invisible — a fresh worktree is NOT linked.** `supabase link` writes `supabase/.temp/` (project ref, pooler URL) and `.temp` is **gitignored**, so **local link state is per-worktree**. A session that notes "the CLI is linked" is describing *its own worktree*; the next session's fresh worktree is unlinked, and every `migration list` / `db push` fails with *"Cannot find project ref. Have you run supabase link?"* — which reads like a missing credential, not like "you are about to check the wrong thing". **Re-link and re-read the remote count before any push** (this is trap 8's rule, and it is now the first thing the S35 session did).

**The fix.** `db push --dry-run` first (to print the exact pending set rather than trusting a count), then `db push --yes` — all three applied. `migration list` now reads **14/14, no drift**. ⚠️ Checked first that none of the three touches `app_config` (the kill switch): **they do not** — the ability to kill every user's session is not something to discover mid-push. No spend: a push is free.

**Proved by a real call, not by a count.** With the service-role key, `GET /rest/v1/` (the PostgREST OpenAPI root) now lists the full clan surface — **14 clan/role RPCs**: `create_clan` · `join_clan` · `leave_clan` · `set_member_role` · `remove_member` · `rename_clan` · `delete_clan` · `clan_book` · `clan_role_of` · `is_clan_head` · `is_clan_member` · `preview_clan` · `new_clan_code` · `reroll_clan_code`. ⚠️ The `anon` key **cannot** read that root any more — it answers **401 `Invalid API key` / *"Only the `service_role` API key can be used for this endpoint"*** — so the introspection itself needs the service key (a read, not a mutation).

**A posture finding, recorded rather than "fixed".** `clans_select_member` is `using (is_clan_member(id) or created_by = auth.uid())` — a **table-level** policy, so **any member can read `clans.code` by selecting it**. The client's gate on the invite surface is therefore a **UI** gate, not a security boundary. Tightening it is an **RLS / security-posture decision** (a PM call), not a client change — and a new `clan_invite_code` RPC gated to head-power would be **security theatre** while `clans` stays member-readable. Recorded on **SCRUM-50**.

**Client defects this session's gate found** (full detail on [[follow-up-items]]): `invites.ts` **truncated a nine-character code** (`/join/ABCDEFGHJ` returned `ABCDEFGH` — the guess its own contract forbids) · the scan duplicate check compared **raw payloads**, so the same code as a link and then as a paste read as **two** scans · the join screen **collapsed "bad code" into "offline"**, so an unreachable shrine told a user their family's code was wrong and the invite was **never retried**. All three were found by writing the intended behaviour down as a **test** rather than as a comment.

---

### 12.12 · SCRUM-46 — the clan management API (2026-10-08)

**What was already there.** `clans` · `clan_members` · `create_clan` · `preview_clan` · `join_clan` · `reroll_clan_code` · `save_ancestor` · `is_clan_member` · `clan_role_of` · `is_clan_head` · `enforce_ancestor_cap` all shipped with PR-2/PR-3. What SCRUM-46 adds is the half doc 15 §3 *promises* and nothing implemented: **the role ladder, leaving and removal, rename, delete, and the Book of Tributes read path** — plus the anti-abuse limits §5.2 hands to this ticket.

**Migration `0012` — 12/12, no drift.** The real gap was RLS, not logic: `clan_members` had a **SELECT policy only**, so role changes and leaving had *no path at all* and the tempting fix was SECURITY DEFINER. Adding `clan_members_update_head` · `clan_members_delete_head_or_self` · `clans_delete_head` closes it and keeps **all five management RPCs SECURITY INVOKER** (RULE B). Only `clan_book` is elevated — RULE B's **fifth** named exception, because a NON-member must read the anonymised projection `tributes_select_member` will not grant.

**Three decisions this ticket owned (doc 15 §10), taken and recorded.**
1. **§10.5 Book window → HIDE, not purge.** The spec's own wording is a *read* rule (*"shows and QUERIES the last month only"*), §5.3 promises a leaver their entries *stay*, and purging needs a scheduler `pg_cron` deliberately has off. Hide → purge stays open later; purge → hide does not.
2. **§5.2 anti-abuse → 10 clans per user · 3 joins per hour.** doc 11 §5's "≈3× the fastest honest play".
3. **§10.4 head exit → promote-first**, the spec's own proposal. ⚠️ **The PM confirmation is filed as `SCRUM-84`** — this is the documented reading, not a decision taken here.

**⚠️ Two real defects the verification found — both in this migration's first cut.**
1. **The joins-per-hour limb was DEAD LOGIC.** It was written as `10`, equal to the clan cap — but a membership *is* a clan, so the clan limb always binds first and the hourly limb can never fire. Now `3`, and both the pure gate and C11 assert the ordering holds.
2. **The `≥1 head` invariant would have BLOCKED a GDPR deletion.** As a *hard* DB invariant it fires when a co-head who is not the founder erases their data and legitimately orphans a clan — i.e. `delete_my_data()` would have failed. Fixed by exempting the case where the member's **profile** is gone, which works because the trigger is `DEFERRABLE INITIALLY DEFERRED` (by COMMIT the profile is deleted, so `delete_my_data`'s existing order needs no change). Deferral also buys the two things an immediate trigger cannot: `delete_clan`'s cascade works, and **promote-then-leave in one transaction** is allowed — exactly the §10.4 UI.

**The verification — `supabase/tests/clan_management.sql`.** C1–C12 + teardown, every assertion RAISING, so the run is green or red. It drives the API as **real signed-in users** (`set role authenticated` + a real `request.jwt.claims`), not as the owner, so RLS is genuinely in the path. It proves: the founder is the only head · a code joins instantly and a bad one fails loudly · **an elder cannot promote, invite, rename or remove** · head is not assignable and the founder's role is immutable · **the sole head is refused when leaving and the founder may leave once a co-head exists** · the invariant fires **in the database** (`set constraints … immediate` is what makes a *deferred* error observable) · the Book's two projections, the 45-day row hidden **but still present**, and `private` withheld from non-members · delete cascades to members, tributes and burns · **both** anti-abuse limbs.

**⚠️ Two harness facts, measured — they matter to every SQL test here.** `set_config(…, is_local := true)` and `SET LOCAL` **do not survive across statements** under `run-sql-tests.sh` (psql autocommit): each statement is its own transaction, so `SET LOCAL` even warns *"can only be used in transaction blocks"*. Session-scoped `SET ROLE` / `set_config(…, false)` is the form that works in BOTH runners. And a `pg_temp` table grants **nothing** to PUBLIC — the test needs an explicit `grant … to authenticated`, or its first read/write as a user fails. *(`pr3_verification.sql` uses `SET LOCAL`, so it only works on the CLI-migration path, not `run-sql-tests.sh` — recorded, not changed.)*

**Gates:** `tokens 36 · domain 45 · slice 36 · throw 33 · ads 51 · wire 43 · session 17 · pathc 38 · sql 12 · adrs 34 · contrast 22 · responsive 21 · lib 153` (+ the new SQL file, which `run-sql-tests.sh` picks up automatically). **Fault-tested:** flipping the pure rules to 10/10 and to allow-any-role turned **7** `lib` checks red; removing the trigger's profile exemption turned **C12** red with the expected message.

**Spend: US$0.00** — no fal.ai call, no deploy: `npm install`, the local gate suite, and a local Supabase stack on Docker. The invariant, the caps and the Book were proved against a **real Postgres 17.11**, not asserted.

**Left for SCRUM-46:** ⬜ **the QR half** — SCRUM-50 owns the scanner and the rendered QR (needs `react-native-svg` + a QR lib, which are native modules and so want a dev build). ⬜ **the Home clan card**, which needs a Home design pass: the signed-off Home layout has **no free band** for it. ⬜ **first-run routing** — deliberately NOT changed, because whether the fork replaces the slice's auto-create is **`SCRUM-83`**.

### 12.12d · SCRUM-83 answered (option E) — the first burn is a TUTORIAL (2026-10-08)

**The decision**, verbatim: *"the first burn should be a tutorial, a demo to the user. so no clan involved and no real points to contribute to any clan. after the tutorial build the PATH C mentioned in the ticket."* Recorded on `SCRUM-83` (now **Done**); built under **`SCRUM-85`**.

So the first-run sequence is **tutorial → your family's altar** — replacing the silent auto-created *"My Altar"*. Option C (the fork) is now the thing the tutorial hands off **to**, which is the shape none of A–D described.

**⚠️ THE CONSTRAINT THAT SHAPED THE BUILD — the tutorial must not spend AI money.** A demo that ran a real Path C generation would cost **≈ US$0.09 for every new user** — the unmetered bill doc 10 §6 put a ceiling on — and it would be **invisible**, because it happens *before* any quota, clan or `app_config` budget row exists to bound it. So the demo **skips `registerCapture` · `uploadCapture` · `requestCartoonize` entirely**, and the "preparing" beat is a local timer (`TUTORIAL_WAIT_MS`).

A useful consequence: **no new asset was needed.** `burn.tsx` never renders the sprite — it is the offering's *identity*, not its picture — so the tutorial carries the captured photo straight through. A bundled demo sprite would be decoration, not a demo.

**`src/lib/tutorial.ts` — the invariants as DATA.** `TUTORIAL_CONSEQUENCES` states `createsClan · awardsPoints · writesLedger · callsServer · callsAi` — all `false`, and a gate asserts every one. A future change that wires the demo into the server or the AI has to **delete an assertion that says why**, rather than quietly reintroducing a per-user cost.

**`DemoReceipt` is a DIFFERENT TYPE from `BurnReceipt`**, so demo money cannot be rendered by the code that renders the server's. It carries `balanceDelta: 0`, and it uses the **real award maths** (`computeAward`) with no new-ground and no streak bonus — so a Devout throw demos **600**, the real single-burn number. Honest, and banked nowhere.

**`ensureClan` is DELETED, not deprecated.** The SCRUM-82 shortcut is gone from `src/lib/clan.ts` (file removed), along with `planClan` and `SLICE_CLAN_NAME` from `clan-rules.ts`. A helper whose comment says *"the real flow is SCRUM-46/50"* is an invitation to wire the shortcut back in, so `check:lib` §9 was rewritten to assert only the NAME rule that create and rename still need. `reward.tsx` now calls `myClans()`; **no clan** routes to the fork — **not** a retry, because a retry fails identically forever, which is how the old failure presented.

**One latent bug fixed on the way:** `preparing.tsx` was the one hop that **bypassed `toBurnParams`** and pushed raw params — precisely the pattern `route-params.ts` was written to prevent, and the reason a new flag can vanish silently. It now uses the builder.

**Proof.** `check:lib` §12 (20 checks: the five invariants, the first-run decision, the fork hand-off, the demo receipt's arithmetic and shape, the flag's parsing) · **`check:wire` §5** (9 checks: the flag on both builders and both readers, a REAL hop carrying **no** param at all, the four-hop chain, and a deliberately **dropped** flag reading as a real turn). **Fault-tested both ways:** `callsAi: true` turns 2 lib checks red; dropping the flag at the burn hop turns 2 wire checks red.

⚠️ **Parity caught a real miss:** the tutorial copy was added to EN and *not* 中文 — `check:lib`'s locale-parity assertion failed, which is the check doing exactly its job.

**Gates:** `wire 43 → 52` · `lib 210 → 229` · 13 migrations · 0 TS errors. **Spend US$0.00** — the tutorial's whole point is that it costs nothing, and building it cost nothing either.



**The decision.** The PM answered with a **hybrid**, not either option I offered: *"if there is no co-head, prompt leaving clan head to name a successor, if none named, promote automatically the oldest elder by time of joining the clan."* Recorded on `SCRUM-84` (now **Done**), and folded into doc 15 §3/§5.3/§10 item 4.

**⚠️ This superseded a shipped behaviour.** `0012` implemented pure promote-first — a sole head was **refused**. That is wrong now, so `leave_clan` is **re-specified in migration `0013`**, never edited in place.

**Migration `0013` — the ramp.** A head-power holder leaving: another holder exists → leave; else a **named** successor is promoted to co-head, else the **oldest elder** (`order by joined_at asc, user_id asc`) is promoted, else **refused**. Three implementation notes worth keeping:

* **`drop function` first.** `leave_clan(uuid)` and `leave_clan(uuid, uuid default null)` are *different functions* to Postgres, and the default makes the 2-arg form callable with one argument — leaving both makes every 1-arg call **ambiguous** ("could not choose the best candidate function"). The old signature has to go explicitly.
* **The successor becomes `co_head`, not `head`.** §3 keeps `head` the founder's immutable fact, `set_member_role` already refuses to assign it, and the deferred ≥1-head trigger counts head *power* (head OR co_head) — so a clan led by a co-head is valid. Making the successor literally `head` would make "who founded this clan" mutable.
* **The `user_id` tiebreak.** Two elders who joined in the same second must resolve **deterministically**; a rule that picks a different successor on a second run is not a rule.

**⚠️ The one case the instruction does not cover**, flagged on the ticket rather than silently decided: **no co-head, no elder, nobody named**. "Promote the oldest elder" has no candidate, so it **refuses** and names both exits. The alternative — auto-promoting an arbitrary *member* — would invert the ladder in exactly the case where the clan is least supervised.

**Client + screen.** `leaveClan(clanId, successorId?)` returns *what happened* (`successor`, `auto_promoted`), and `planLeave` in `clan-roles.ts` mirrors the ramp purely so the screen can **prompt before the tap**. Two details a screen would have got wrong:

1. **The refusal is decided by the pure mirror BEFORE the call**, so what the user reads is our translated copy. The server's refusal is an English sentence (`42501`) — `LEAVE_REFUSAL_KEY` exists so a 中文 reader does not meet it mid-flow.
2. **"Leave without naming one" is offered only when the fallback can actually run** (`auto_promote_then_leave`). At any other point it would lead straight into the refusal — a button that lies.

**Proof.** `clan_management.sql` **C13** — five purpose-built fixtures with **explicit `joined_at`** (which also keeps the joins-per-hour limb clear): two elders where the older must win · a named successor · a **same-second tie** · the no-candidate refusal plus both validation refusals · a co-head clan where nobody is promoted. Plus the end state read **as the owner**, so RLS cannot flatter it. And `check:clanapi` grew a **`p_successor`** section — the argument name `tsc` cannot check — with `p_successor` **omitted** (the SQL default) and **named**.

**Fault-tested:** flipping `order by joined_at asc` to `desc` turns C13's *"the OLDEST elder"* assertion **red**.

**Gates:** `tokens 36 · domain 45 · slice 36 · throw 33 · ads 51 · wire 43 · session 17 · pathc 38 · sql 13 · adrs 34 · contrast 22 · responsive 21 · lib 200 → 210` · `check:clanapi 55 → 69`. **Spend US$0.00.**

**⚠️ Clarified by the PM the same day:** *"if there is a cohead and another cohead leaves without nominating the cohead becomes the only cohead."* — i.e. **the ramp does not fire while another head-power holder remains**: a co-head leaving needs no nomination, nobody is promoted, and the survivor is simply the only co-head. That was **already the behaviour** (`v_others` is counted before the ramp), but it **was not asserted** — fixture E only covered *the head* leaving with a co-head present. Two fixtures added, both asserting the **strong** form (*no other member's role changed*, not merely that the leaver got out):

* **F** — founder head + two co-heads + an elder → one co-head leaves → the survivor is the only co-head, the founder is untouched, and **the elder is still an elder**.
* **G** — **two co-heads and NO `head` row** (reachable once a founder has left) → one leaves → the survivor is the **sole head-power holder** and **the elder is still an elder**. This is the case where a misplaced ramp would have dragged an unrelated elder up the ladder.

Also asserted in the pure mirror (`check:lib`) and over real PostgREST (`check:clanapi` **§9d**) — three layers.

⚠️ **And the fixtures caught a real interaction:** F/G added memberships to u1/u2, and C11's 11 spare-clan heads split across two keepers pushed **u2 to ELEVEN — over the 10-clan cap**. The trigger correctly refused it, which failed the *whole file at its COMMIT* rather than in an assertion (a confusing failure mode, worth knowing). The spares are now spread across **three** keepers and every keeper stays under the cap. `clan_management.sql` GREEN · `check:clanapi` **77/77** · `lib` **234**.

#### ✅ ANSWERED on SCRUM-84 — the RANK a successor is promoted INTO (2026-10-08, later)

The PM's follow-up did not resolve from its wording alone (*"it will depend if the new nominated head is joining a co-head"*), so the question was left open and the code was made to **refuse to let it drift silently** — the rank was pulled out of the `UPDATE` and asserted from three directions. The PM then settled it:

> **"hand over to a new head if no co-head, co-head if co-head already exists."**

That is one sentence of SQL: **the successor INHERITS the rank of the person they succeed** — `set role = v_role`. Migration **`0014`** (a NEW file; `0013` is applied and is never edited).

| Who leaves | Who is promoted | The clan ends up with |
|---|---|---|
| a **`head`**, no co-head | the named successor, else the oldest elder → **`head`** | **one `head`** |
| a **`head`**, with a co-head | **nobody** — that co-head carries on | a **co-head** leads ← *"co-head if co-head already exists"* |
| a **sole `co_head`** (no `head` row) | → **`co_head`** | a **co-head** leads |

⚠️ **This reverses `0013`'s rationale on `head`, deliberately.** `0013` refused to promote into `head` because `head` was "the founder's immutable fact". **What survives is the FOUNDING fact** — `clans.created_by` still records who founded the clan and is never rewritten (C13 now asserts that *after* a succession has moved the headship). What changes is that **headship no longer dies with the founder**, which is the entire point of a line of succession, and it means a clan may have a `head` who did not found it. ⚠️ `set_member_role` **still refuses** `head`: the ladder appoints co-heads, and **succession is the only path to headship**.

**Asserted as a PAIR, so neither value can be hard-coded.** Fixture **A** (a departing `head` → `head`) and the NEW fixture **H** (**no `head` row** at all, a sole co-head → `co_head`) are deliberately opposite: hard-code *either* value and one passes while the other fails. Plus:

| Layer | What pins it |
|---|---|
| `check:lib` | the pure plan carries **`promoteTo`** — the rank was pulled out of the `UPDATE` and made reviewable — and **8** checks pin the rule (both ranks, both paths, the "co-head already exists" branch, and the invariant stated once) |
| `check:clanapi` **§9b/§9c** | the promoted successor's **actual role read back from `clan_members`** over PostgREST — the strongest form, because it exercises the *real* function rather than trusting a duplicated literal |
| `clan_management.sql` **C13 A + H** | the end state read **as the OWNER**, so RLS cannot flatter it — and `created_by` is asserted to **survive** the succession |

⚠️ **The change went into a NEW migration rather than editing `0013`'s body.** `0013` may already be applied on the hosted project and this worktree has **no `supabase link`** (`Cannot find project ref`), so an edit to it could not be verified against remote migration history — and an unverifiable edit is how drift starts. `0014` uses `create or replace` on the **same signature**, deliberately: `0013`'s header warns that a stray `leave_clan(uuid)` would make every 1-arg call ambiguous.

⚠️ **A harness trap re-confirmed:** `run-sql-tests.sh` calls `docker run` **without `--network host`**, so `127.0.0.1:54322` resolves to the *throwaway client container's own* loopback and every file reports `Connection refused` — which reads exactly like a failing test. The SQL suite must be run with `--network host` (or a non-loopback URL) locally. `clan_management.sql` GREEN that way; `check:clanapi` **81/81**; `lib` **240**.

⚠️ **FAULT-TESTED, both ways — and the pair is what makes it a gate rather than a decoration.** Before the decision landed, the fault test also proved the `head` promotion was *possible*: no constraint, no trigger and no RLS policy refused it, so the answer's cost turned out to be **one line rather than a schema change**. (⚠️ Two `head` rows exist **momentarily** while the promotion runs before the departing head's row is deleted — safe, because there is no uniqueness constraint on `head` and the deferred ≥1-head trigger is a **minimum**, not a maximum.) After it landed, forcing `set role` back to the old literal `'co_head'` turns fixture **A** red; forcing `'head'` turns fixture **H** red. **`set role = v_role` is the only value that passes both.**



**The gap this closed.** The RPCs existed and were proved, but **nothing called them**: the only `.rpc()` site in `src/` was `create_clan` in the SCRUM-82 shortcut. So the app could not invite, promote, remove, rename, leave, delete or read the Book at all.

**`src/lib/clan-api.ts` — the device half.** Eleven typed wrappers (create · preview · join · reroll · myClans · clanMembers · setMemberRole · removeMember · leaveClan · renameClan · deleteClan · clanBook). They normalise their inputs through the PURE modules (`normaliseClanCode`, `isValidClanName`) so the client and the server agree on what a code and a name are, and they parse responses defensively because **there are no generated DB types** — a cast would turn a server change into a silent `undefined` on a screen.

**`src/lib/clan-flow.ts` — the pure rules of the screens.** The wizard order, the button gates, the preview args and the **rendered action list**, delegating every permission to `clan-roles.ts` (which mirrors the SQL) rather than restating `role === 'head'` in a component. Two things it decided that a screen would have got wrong:

1. **The invite card comes BEFORE the ancestor sheet** — the amended order, now asserted, so swapping them in a component is a red gate rather than a silent product regression.
2. **A non-member's action list is the Book and nothing else.** The first cut appended `leave` unconditionally, which rendered a **Leave** button — and an **Offer** — on a clan the viewer was not in. Caught by writing the assertion.

**`src/components/clan-ui.tsx` + five screens** — `clan/index` (the fork), `clan/create` (four taps), `clan/join` (code → preview → join), `clan/manage` (card · roster · ladder · rename · leave · delete) and `clan/book`. Destructive actions confirm, and the **leave refusal is passed through verbatim** so a sole head reads *"promote a co-head first"* rather than a generic failure.

**⚠️ `npm run check:clanapi` — a new gate, for a gap nothing else covered.** With no generated types, nothing static checks that the argument names `clan-api.ts` sends (`p_clan_id`, `p_user_id`, `p_role`, `p_code`, `p_name`, `p_limit`) or the response fields it reads (`clan_id` · `ancestor_count` · `was` · `entries` …) match the database. `tsc` is blind to it and it fails only on a device, as an empty screen. The test drives the **real RPCs over real PostgREST** with the real arg names and asserts the real fields — **55 checks, all passing**, and **fault-tested**: renaming `p_clan_id` → `p_clanid` turns **22 of 55 red**.

**Verification.** `tsc` clean · `lib` 153 → **200** (47 new checks in the screens group, fault-tested — swapping the wizard order and deleting the outsider guard turned **7** red) · `check:clanapi` **55/55** · the full suite green. **Spend US$0.00** — a local Supabase stack on Docker, no AI call, no deploy. The screens are validated by types and by the contract; **no device run was made this session**, so `testID`s are in place for one.



### 12.11 · SCRUM-82 — the clan bootstrap, and the first complete ritual (2026-10-07)

**The blocker.** `submit_burn` is clan-scoped: it requires `clan_id` (migration 0004 §226) **and** the caller's `clan_members` row (§252). The slice's `submitBurn` sent only `{ capture_id, accuracy }`, and a fresh anonymous user is in no clan — so `award-service` answered **400** and `burns` stayed **0**. §12.10 proved everything upstream; this was the last step.

**The fix — no migration needed.** `create_clan(name)` already exists (SECURITY INVOKER, granted to `authenticated`), and `clan_members_select_member` lets a caller read their own membership — so the slice can reuse-or-create entirely from the client:

| File | Half | What |
|---|---|---|
| `src/lib/clan-rules.ts` | **pure** | `SLICE_CLAN_NAME` · `isValidClanName` · `planClan` (reuse vs create) |
| `src/lib/clan.ts` | device | `ensureClan()` — reuse the caller's clan, else `create_clan` |
| `src/lib/ritual.ts` | device | `submitBurn(..., clanId)` now sends `clan_id` |
| `src/app/reward.tsx` | wire | `await ensureClan()` before the award |
| `src/lib/checks/run.ts` | gate | **8 checks** (`check:lib` 97 → 105), fault-tested red |

**The first complete ritual, on glass.** Emulator `floor_api30`, driven over `adb`:

> capture → cartoonize (**`styled`, US$0.09**) → burn (**虔誠 Devout ±28.57 px**) → **award → persist**

`clans: 1` ("My Altar") · `clan_members: 1` (head) · `burns: 1` (band `devout`, `award_snapshot` **600**) · `ledger_events: 1` · `tributes: 1`. The reward screen showed the **server's** receipt — **600 · Balance 600** — not the client's own grade (ADR-005).

**The one thing this is not.** The auto-create is a slice **shortcut** for the real "four taps to head" flow (doc 15 §4.2 / SCRUM-46/50). It is a stand-in, not the clan model — filed as **SCRUM-83** for the PM.

### 12.10 · SCRUM-53 — the slice's first device run (2026-10-07)

**What ran.** With SCRUM-80's auth bootstrap in place, the slice ran on the emulator (`floor_api30`, Android 11 / SDK 30) for the first time, driven over `adb`: **capture → cartoonize → burn**. It reached the burn screen with the real styled sprite and graded a throw.

**It failed a few times before it worked — three real defects, none ever exercised** (S31 died at auth, so the whole write path was virgin).

| # | Where | Defect | Fix |
|---|---|---|---|
| 1 | `uploadCapture` | read `fetch(uri).text().split(',')[1]` as if the media URI were a `data:` URI; `takePictureAsync` returns a `file://` URI, so the "base64" was garbage | read the bytes as a **Blob** |
| 2 | `uploadCapture` | RN Blobs carry an **empty type** → uploaded as `text/plain` → `mime type text/plain is not supported` | re-wrap with an explicit `image/jpeg` type |
| 3 | `captureStoragePath` | baked the **bucket name into the object key** (`captures/{uid}/…`); the bucket's RLS policy (`foldername(name)[1] = auth.uid()`) read the owner as `"captures"` → `new row violates row-level security policy` | a **bucket-relative** key `{uid}/{id}.jpg` (matches the `styled` convention + the pr3 fixture); the function moved to the pure `src/lib/storage-path.ts` so `check:wire` asserts it (3 checks, fault-tested red) |

Defects 1–3 are **SCRUM-81** (PR #26; `check:wire` 40 → 43).

**What it proved.** After the upload fix the pipeline completed on glass: `cartoonize_jobs.status = 'styled'`, `cost_micros = 90000` (**US$0.09**), `latency_ms = 16131`, the sprite persisted to the private `styled` bucket, and the throw graded **虔誠 Devout ±22.94 px** — the first real Path C burn driven from the app.

**What still blocks the ritual — SCRUM-82.** The **award** never lands: `award-service` returns **400**, because `submit_burn` requires `clan_id` (migration 0004, line 226) **and** the actor's `clan_members` row (line 252). The slice's `submitBurn` sends only `{ capture_id, accuracy }`, and a fresh anonymous user is in no clan — the slice's "hard-coded clan" was never wired, and there is no clan bootstrap. `burns = 0`.

**Cost.** US$0.09 (`project-costs.md`) — the first real spend of the slice.

### 12.8 · SCRUM-53 continued — the write path's two dead wires (2026-10-06)

**The finding.** §12.7 made the three client rules executable, and the screens *were* wired to the service layer (`preparing.tsx` → `registerCapture` · `uploadCapture` · `requestCartoonize`; `reward.tsx` → `submitBurn`). But **the slice's last hop could not complete, and nothing could notice:**

1. **The capture id was dropped between screens.** `burn.tsx` read **no route params at all** — no `useLocalSearchParams` — so `confirm` pushed `/reward` with `{ offsetPx, throwNumber }` and no `captureId`. `reward.tsx` then refused with a generic `bad_params`, which means **the reward screen could never show a receipt**: every player who completed the ritual ended at *"This offering cannot be prepared."* expo-router params are an untyped string bag, so the compiler had no opinion and no check covered a route push.
2. **A non-2xx answer was reported as a FAILED GENERATION.** `requestCartoonize` answered every `!res.ok` with `{ kind: 'ok', jobId: 'x', events: [{ type: 'GENERATION_FAILED' }] }` — a fake job id *and* rule ②'s event, contradicting its own comment (*"the capture was NOT spent"*). A 500, or an exhausted daily quota, therefore told the player to photograph a **new** offering for a failure that never touched the server. `isTransportCode` had been written for exactly this distinction and was **never called**.

Both are the same species as §12.7's problem: **a rule that lives only in prose and in a caller's memory.**

**What landed**

| Fix | Where |
|---|---|
| The route contract **as code** — `captureId` is a **required argument** of `toRewardParams`, so a hop cannot forget it; a missing id is refused **by name** (`missing_capture_id`), and an absent `offsetPx` is refused rather than becoming `Number(undefined)` → `NaN` | `src/lib/route-params.ts` **(new, pure)** |
| `burn.tsx` reads its own params; a lost id now says so honestly and offers a fresh start, instead of grading a throw that could never be awarded | `src/app/burn.tsx` |
| `reward.tsx` parses instead of coercing, and a broken route gets its own **`lost`** state — not a retry button that must fail forever | `src/app/reward.tsx` |
| `outcomeFromHttpFailure(status, body)` — a non-2xx is **`transient`, never rule ②**, carrying the server's own `code` | `src/lib/ritual-map.ts` → used in `src/lib/ritual.ts` |
| **`npm run check:wire`** — 40 checks, **dependency-free** (so it runs on a bare checkout *and* in CI's dependency-free job, unlike `check:lib` which needs `npm ci`) | `src/lib/checks/ritual-wire.ts` **(new)** |

**The gate is fault-tested, and it guards the regressions themselves.** Making a refusal report `ok` goes **red on 6** assertions; letting a reward route through without a capture id goes **red on 5**. It also asserts the **counter**-fact, so the fix cannot buy green by blunting the rules it protects: a 2xx `status: 'failed'` **still** emits `GENERATION_FAILED` (rule ②), `shrine_busy` **still** parks (rule ③), and a `styled` job **still** yields a sprite.

⚠️ **What is still not done, and it is the honest headline: the slice has never been run end-to-end.** Two dead wires are now correct — that is not the same as *proven*. The acceptance test (the four bands, on the Tier-F floor device) still waits on **SCRUM-52**, and no live Path C call (≈ **US$0.09**, inside the approved budget) has been made for a real burn. **That run is the next step**, not another refactor.

### 12.7 · SCRUM-53 started — the slice's client rules, made executable (2026-10-05)

**The finding.** The three client rules of §12/§12.5 were written as *warnings*, which is the form most easily violated: a well-meaning refactor six weeks later breaks a rule that nothing in the type system objects to, and the breakage is discovered by a player rather than by a check.

They are now a **typed state machine** (`src/domain/slice.ts`) with a machine check (`npm run check:slice`, in `npm run check` + CI):

| Rule | Encoded as |
|---|---|
| ① capture id minted **before** the upload | `CAPTURE_TAKEN` carries the client-minted id; `CART_DRAFT` is **refused** when `captureId` is null, so the id can never be minted implicitly |
| ② a **failed** generation means a **NEW** capture | `GENERATION_FAILED` discards the spent id, sets `needsRecapture`, and `nextAction` returns **`recapture`** — the UI cannot offer a retry of the row |
| ③ `200 shrine_busy` is a **queue**, not an error | `BUDGET_PARKED` → `queued`: not a failure, id **kept**, and it resumes straight to `styled` with no re-request and no re-upload |

**36 checks green, and the harness fault-tested two ways.** Breaking rule ② (a failure that keeps the spent id) goes **red on that assertion**; breaking rule ③ (treating `shrine_busy` as an error) goes **red on six**. The harness also asserts **its own aliveness** — a deliberately wrong belief must be reported as a failure, then the counters are restored, so a dead harness cannot print an unbroken column of ticks.

**Three defects the check caught in the first implementation** — worth recording because none was visible by reading the code:

1. **A stale sprite survived a failed generation.** `GENERATION_FAILED` cleared the capture id but left `spritePath`, so a failure after a previously-styled offering would have shown a sprite for an offering that no longer existed. Fixed: the whole offering resets.
2. **A spent offering reported an endless `wait`.** After three misses the state is `thrown`, and `nextAction` had no `thrown` branch — it fell through to `wait`, which would have left a screen spinning forever after the last legal throw. Fixed: a spent `thrown` is `done`.
3. **The identity assertions were testing the harness, not the machine.** Several checks compared `transition(x, e) === x` where `x` was built by a function *call* — so each side was a different object and every "illegal event is ignored" check failed for the wrong reason. Fixed by binding each fixture to a local first.

**Also:** the emulator question (the PM is waiting on a 10.10 sale for the Tier-F device, **SCRUM-52**) is filed as **SCRUM-64**. KVM was measured as **genuinely usable** on the dev laptop — `KVM_GET_API_VERSION → 12` and `KVM_CREATE_VM` succeeded, which is the real proof. The scope is honest: an emulator is a **development** target, so every *functional* acceptance criterion can be met on it and **no performance** one (N2/N3/N4/N10) can.

⚠️ **A near-miss recorded for the sake of the next session:** the first KVM probe used a malformed `ioctl` buffer and returned `EINVAL` — the *classic* signature of "nested virtualisation unavailable" — which would have justified dropping the emulator plan on a false premise. The device was fine; the test was wrong. **"The check failed" and "the thing is broken" are different claims, and the difference is worth one more attempt before abandoning a plan.**

---

---
### 12.6 · SCRUM-55 — the three unwritten ADRs, recorded (SCRUM-10 chain)

**The finding.** Three of the nine §6 decisions in [[05-concept-to-mvp-gap-analysis]] were **made in prose and recorded nowhere**: identity (§6.5), burn-limit semantics (§6.7) and ad posture (§6.9). They were already *binding* — encoded in doc 07, enforced by doc 10's quota rule, and pre-committed to the cultural reviewer in doc 16 §5 — but with no ADR, each one was one edit away from being re-litigated by someone who had not read the reasoning.

**What landed (2026-10-05, Session 29):**

| ADR | Decision | Status |
|---|---|---|
| [[ADRs/ADR-004-anonymous-identity-first-optional-account-later|ADR-004]] | **anonymous device identity first, optional account later** — no signup wall before the first burn; the upgrade *links* the same `user_id` (no data migration) | ✅ **Accepted** |
| [[ADRs/ADR-006-burn-limit-semantics-daily-quota-cost-per-burn|ADR-006]] | **daily quota** (10 photo / 20 store, local midnight, server-verified) · **cost per burn** differentiated ($0.09 vs $0.01) · **no per-burn cooldown** (the caps *are* the cooldown) · **hard global stop-rule** on the $0.10 floor | ✅ **Accepted** |
| [[ADRs/ADR-008-advertising-posture-never-inside-the-ritual|ADR-008]] | **ads never inside the ritual flow**; outer surfaces only; no ad while ancestor names are on screen; **no ad SDK at MVP** | 🟡 **Proposed — PM decision** |

**Why ADR-008 is deliberately *not* Accepted.** Its placement rule is already locked ([[10-economy-spec]] §1 · [[16-cultural-consultation-and-ritual-review]] §5 pre-commits that *"the placement rule itself stays"*), so engineering can build against "no ads in the ritual" today. But four sub-questions are a **product** call and are routed to the cultural review (**SCRUM-49**): **A** the rewarded ad-gated bonus photo (the sharpest edge — it puts the earning of a devotional act behind an advertiser) · **B** ad volume/frequency · **C** protected moments (festival days?) · **D** category exclusions. Marking it Accepted would have recorded a decision the PM has not made.

**The gate that stops it recurring — `npm run check:adrs`.** Writing the records is only half the fix; the register can drift from the files again by hand. The check parses the register **and** every ADR file and fails on: a registered row with no file · a file with no register row · a **status the two disagree on** · a row still saying *"record to write"* · a record missing the house sections. It runs in `npm run check` and CI.

**Fault-tested red** (a harness that cannot fail is not a check), each confirmed individually:

| Fault | Result |
|---|---|
| an ADR row removed from the register | 🔴 `ADR-006 … ON DISK BUT MISSING FROM THE REGISTER` |
| a register row → a file that does not exist | 🔴 `REGISTERED BUT THE FILE IS MISSING` |
| register says **Accepted**, file says **Proposed** (the ADR-008 trap) | 🔴 `STATUS DISAGREES — register says "accepted", file says "proposed"` |
| an ADR's `## Consequences` heading stripped | 🔴 `INCOMPLETE — missing "## Consequences"` |

One **real defect in the check itself** was found this way and fixed: the *"record to write"* scan initially matched the whole README and therefore **its own documentation prose** — a false red. It now scans table rows only.

**Status:** ✅ **ADR-008 Accepted** (SCRUM-62, 2026-10-05): A3 · caps 2 on app start / 3 in a row post-ritual · Singapore for now (structured for other diasporas) · D strong NO, detail in **SCRUM-63**. All nine §6 decisions recorded; all eight ADRs Accepted.

*Created 2026-10-03 (Session 27) — the stand-it-up plan for [[07-system-architecture]]: service build order · the complete API surface (3 Edge Fns · 11 RPCs · storage · realtime) · the 3-ring environment with the local toolchain audited · the exact SDK-57 package manifest + install traps · the build-vs-provision split (A–J ↔ #1–#10, filed as **SCRUM-57** / **SCRUM-56**) · and 4 doc-07 inconsistencies found while mapping the build against the architecture. Path C endpoints and prices verified live: **ADR-002's cost model still holds exactly.***
*Updated 2026-10-05 (S29c) — **§12.7**: SCRUM-53 started; the slice's three client rules are now a typed state machine with a fault-tested gate (`npm run check:slice`), and the emulator interim target is filed as **SCRUM-64**.*
*Updated 2026-10-10 (S37) — **§12.17**: `SCRUM-93` closed — the `0e3` role chip was a **role inversion** (`--gold-text` on a gold fill, 2.77:1), fixed to the approved pill treatment (ink on gold, **8.28:1**), and the real deliverable is that **`check:contrast` can now see a Penpot board**: a third part asserts the frozen `design-system/penpot-pairs.json` (incl. a control pair that **must stay green**), refreshed by a live sweep — fault-tested red four ways. ⚠️ **The component was on 4 boards, not the 2 the ticket listed.** ⚠️ **My own first sweep was wrong** — it ignored `fillOpacity`, so a 12 %-gold tint became a phantom "solid gold" backdrop and manufactured **191 false findings**; corrected to **16**, and the four traps are recorded in the sweep. Two adjacent findings filed as **`SCRUM-94`**. **US$0.00.***
*Updated 2026-10-09 (S36) — **§12.15**: the Home *"clan card"* is a **pill**, because the layout was finally **measured** instead of assumed — one empty rectangle on the whole board, the header row. Found and filed an **AA failure in a signed-off board** (`SCRUM-93`: `0e3`'s chip is 2.77:1, and `check:contrast` cannot see Penpot at all), and filed the build as **`SCRUM-92`**. **US$0.00.***
