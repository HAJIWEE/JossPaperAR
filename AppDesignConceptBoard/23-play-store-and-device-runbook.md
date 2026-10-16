# 23 · Play Store registration & the device run — the two runbooks

**Date:** 2026-10-12 · **Jira:** **SCRUM-110** (the Play listing · the store fallback · the 2nd fingerprint) · **SCRUM-109** (the Tier-F device delivery → `SCRUM-88` · `106` · `92` AC 6 · `51` · `108`) · **Status:** ⚠️ **written AHEAD of the actions — every step below is unexecuted.** The facts it cites are verified and dated; the clicks are not yet done.
**Depends on:** [[20-business-registration-and-compliance]] **§8 — the authoritative entity-facing Play section** (account type · fee · documents · **the D-U-N-S lead time**) · [[19-build-plan-services-api-environments]] §6.2 (#6 domain ✅ · #7 package id ✅ · **#10 Play = this document**) · `public/.well-known/README.md` (the live fingerprint, and the `apksigner` trap) · `public/_redirects` (§A.5 — the fallback is already built) · [[13-privacy-and-retention]] (the policy the listing must link)
**Feeds:** **SCRUM-110** · **SCRUM-109** → `SCRUM-88` · `SCRUM-106` · `SCRUM-92` (AC 6) · `SCRUM-51` · ⚠️ **SCRUM-76** owns the *account*; this document covers the *listing* on top of it

> **In one line:** these are two very different gates that look like one — **Play is paperwork you can finish in an evening but cannot compress** (a new **personal** account owes **12 testers, opted in continuously for 14 days**, before production access is even requestable), and **the device is a 20-minute setup that unblocks five tickets the automated gates structurally cannot check.**

---


## 0 · Do it in this order

| # | Step | Where | Time | Unblocks |
|---|---|---|---|---|
| 1 | ⚠️ **Decide the account type** — personal vs organization | Play Console, once | **5 min to decide · up to 3 weeks to *wait*** | everything in Part A |
| 2 | Create the account (**US$25**) + identity verification | Play Console | ~30 min + Google's review | the listing |
| 3 | Create the app with package **`app.josspaperar`** | Play Console | 5 min | the store URL |
| 4 | Fill the listing + the policy declarations — ✅ **the privacy policy is already live** at `https://josspaperar.app/privacy` (§A.2 step 4) | Play Console + repo | 1–2 h | submission |
| 5 | Upload a signed **AAB** (`production` profile) | EAS → Play Console | ~30 min | the closed test |
| 6 | ⚠️ Closed test: **12 testers × 14 continuous days** *(personal accounts only)* | Play Console | **≥ 14 days of calendar** | production access |
| 7 | ⚠️ **Add Play App Signing's fingerprint** to `assetlinks.json`, redeploy, re-verify | repo → Cloudflare | 15 min | the App Link on **Play-signed** builds |
| 8 | Install the dev build on the phone; run the device set | the phone | 20 min setup, then the run | **five tickets** |

⚠️ **Step 8 is completely independent of steps 1–7.** The device run uses a **dev build**, not a store install, so it needs nothing from Play — and if the phone is still in transit, **Part A is not blocked by it.** Do them in parallel.

---

## A · The Play Store — `SCRUM-110`

### A.1 ⚠️ Decide the account type BEFORE paying — it is the timeline, not a detail

Fetched from **Google Play Console Help** on **2026-10-12**, verbatim:

> *"Developers with **personal** accounts created after **November 13, 2023**, must run a **closed test** for their app with a minimum of **12 testers who have been opted in continuously for at least 14 days**. When you meet these criteria, you can **apply for production access** on the Dashboard…"*
> — and: *"Certain features in Play Console, such as **Production** … remain **disabled** until developers meet these testing requirements."*

| | **Personal** account | **Organization** account |
|---|---|---|
| Cost / fee | **US$25** one-time ≈ S$32 | same **US$25**, same |
| Testing gate before production | ⚠️ **12 testers, 14 continuous days — mandatory** | ✅ **none** |
| Identity documents | a personal ID | ⚠️ **two kinds of document + a D-U-N-S number** → [[20-business-registration-and-compliance]] §8.4–§8.5 |
| Lead time you cannot compress | **≥ 14 days** *after* a build is ready | ⚠️ the **D-U-N-S** lead time, **before** you can even apply |
| Needs a real Android device | ✅ yes — plus a separate **device verification** step | ✅ also |

⚠️ **The 14 days is calendar time, not effort.** It starts only once 12 real people are opted in **continuously** — drop below 12 and the clock is not met. So the choice is: **a personal account costs 2+ weeks of waiting that no amount of work can shorten**; an organization account costs paperwork *with lead time* (D-U-N-S) that should be started **now** if that is the route.

⚠️ **Both routes need a physical Android device** (Google lists a separate *"Device verification requirements for new developer accounts"* page). ⚠️ **So the Tier-F phone that `SCRUM-109` is waiting on helps *both* gates** — another reason it is worth chasing.

✅ **This decision is already owned** — the account itself is **`SCRUM-76`** and the reasoning is [[20-business-registration-and-compliance]] §8.1/§8.5. **This document does not re-open it**; it only states the cost of each branch so the choice can be made with the timeline visible. ⚠️ If you want it restated as a standalone decision ticket, say the word.

### A.2 The listing, step by step

**Step 1 — the account.** Play Console → *Create account* → choose *Personal* or *Organization* (§A.1) → pay **US$25** → complete **identity verification** (Google reviews this; expect a wait).

**Step 2 — create the app.** Console → *Create app*.
- **App name:** `Joss Paper AR` (matches `app.json`).
- ⚠️ **Package name: `app.josspaperar`** — it must equal `app.json` → `android.package` **exactly**, and ⚠️ **it is permanent**: it can never be changed or reused, and it is **painful to change after the first upload**. It is already frozen on purpose ([[19-build-plan-services-api-environments]] §6.2 #7).
- Default language: English (the app ships EN + ZH via `expo-localization`).
- Type: **App** (not Game). Free.

**Step 3 — the store listing assets.** ⚠️ The Console shows the current spec inline next to each field — **trust that, not this list** — but at the time of writing it is roughly: a **512×512** icon PNG, a **1024×500** feature graphic, and **≥ 2 phone screenshots**, plus a short and a full description.
- ✅ **The screenshots do not need the phone** — take them from the floor AVD (`systemctl --user start floor-avd`), which is exactly what it is for.
- ⚠️ Write the description as the **adult, cultural** product it is — a ritual companion, not a children's app (see *target audience* below).

**Step 4 — the policy declarations — ⚠️ this is the part that actually blocks submission**

**4a. ✅ The privacy-policy URL is LIVE — this step is done** (corrected 2026-10-16).

`https://josspaperar.app/privacy` → **HTTP 200**, a standalone page reachable **without** the app and without a login. ⚠️ Fault-tested rather than assumed: `/definitely-not-real-xyz123` → **404**, so the 200 is a real page and not a wildcard. Source is `public/privacy.html` (+ `public/index.html`), landed in `04913bd` (*"Site: Play Console one-pager + privacy policy on josspaperar.app"*) and `8f4e430`; ✅ **`npm run check:site` now asserts those files' values.**

⚠️ **Why this paragraph used to say the opposite — and why that is kept here.** On **2026-10-12** this was a *measured* claim: `public/` genuinely held only `_headers`, `_redirects` and the hidden `.well-known/`, so the page really did not exist. The deployment landed afterwards. A claim that was **checked** and later became stale is the easiest kind to keep trusting, which is why the correction is dated rather than silent.

✅ It covers what the app really does — **anonymous sign-in**, **photos sent for cartoonization**, **clan membership**, and the **retention window** (see 4b) — from [[13-privacy-and-retention]] plus [[20-business-registration-and-compliance]] §7 (the DPO duty).

⚠️ **What this does NOT settle:** `check:site` proves the **files** are correct — its own header states it does **not** prove the domain *serves* them. That half is the deploy + `curl`, also confirmed on 2026-10-16 (200, no redirect).

**4b. ⚠️ The Data Safety form — the one answer that needs care.** Play asks whether data is **collected** and **shared**. The honest answer turns on **retention**, not on transport: photos do leave the device and reach the server and the AI provider for cartoonization, so the real question is whether they are **stored, and for how long**. ✅ **Answer it from [[13-privacy-and-retention]] and [[ADRs/ADR-007-privacy-minimal-windowed-one-tap|ADR-007]] (minimal, windowed), never from memory** — a wrong declaration here is the classic cause of a post-launch strike. ⚠️ Declare **only what the app actually does**, and treat `package.json` as the source of truth for that: at the time of writing there is **no analytics or crash-reporting SDK** installed.

**4c. Content rating.** The IARC questionnaire — answer it honestly for what ships: **ads are present** ([[21-ad-category-denylist]] · ADR-008), **user photos are captured**, and answer for any free text that can pass between clan members if the clan surface carries it.

**4d. Ads.** Declare **yes** — ads are in scope (ADR-008: **never inside the ritual**).

**4e. Target audience.** This is a **ritual tool for adults** (the ELDER tier). ⚠️ **Do not opt into the Families programme** — opting in changes the rules for ads, data and design.

**4f. ⚠️ App access — give the reviewer a way in.** The app bootstraps with **anonymous sign-in**, so a reviewer *can* open it — but the **join flow needs a valid invite code**. ⚠️ Put **test instructions plus a live invite code** in the *App access* field. A reviewer who cannot exercise a core flow is a rejection; and note the code is **elder-and-above, enforced server-side** (`SCRUM-86`, migration `0015`), so use a real elder's code.

**Step 5 — upload the AAB.**
- `npx eas-cli@latest build --profile production --platform android` → EAS produces the **AAB** Play wants (confirm the artifact type on the build page — ⚠️ Play takes `.aab`, not `.apk`).
- ⚠️ **EAS owns `versionCode`** — `eas.json` sets `appVersionSource: "remote"` and the `production` profile sets `autoIncrement: true`. **Do not hand-edit it.** ✅ Measured 2026-10-12: `npx expo config --type introspect` reports `versionCode: None`, i.e. it is deliberately absent from the repo.
- ⚠️ Check the **target API** first (§A.3) — a build that fails that gate cannot be submitted at all.

**Step 6 — the testing tracks.**
- **Internal testing** — optional, ≤100 testers, available within minutes. ✅ The fastest way to get a real **Play** install into your own hands.
- **Closed testing** — email lists / Google Groups. ⚠️ **On a personal account this IS the gate: 12 testers, 14 continuous days.** Recruit **12 real Google accounts** and keep them opted in.
- Then **apply for production access** from the Dashboard and answer its questions honestly (design, test process, production readiness).

### A.3 ⚠️ Target API — a hard gate that moved on 2026-08-31, and it has already moved

**Google Play Console Help**, fetched **2026-10-12**, verbatim:

> *"**Starting August 31, 2026:** New apps and app updates must target **Android 16 (API level 36)** or higher to be submitted to Google Play … You will be able to request an extension to **November 1, 2026** if you need more time."*

⚠️ **That deadline is already in the past** — so an app submitted **today** must target **API 36**. (The extension exists but is a form, not a default.)

⚠️ **This project does not set it in the repo** — `app.json` has no `android.targetSdkVersion`, so the value comes from the Expo SDK's prebuild defaults, and ✅ **measured 2026-10-12: `npx expo config --type introspect` does *not* surface `targetSdkVersion` either.** So **check it from an artifact or from a device — do not assume**:

```bash
# from the built APK/AAB base APK  (aapt2 lives in Android SDK BUILD-TOOLS,
# not platform-tools — the same directory as apksigner; see public/.well-known/README.md)
aapt2 dump badging base.apk | grep -i targetSdkVersion

# from an INSTALLED app, on the device
adb shell dumpsys package app.josspaperar | grep -i targetSdk
```

✅ **If it is below 36** it is a **code change, not a Play setting**: `npx expo install expo-build-properties`, pin `android.targetSdkVersion: 36`, rebuild. ⚠️ Expo SDK 57 defaults to a recent API, so this may already be satisfied — **which is exactly why to check rather than to assume it.**

### A.4 ⚠️ The step that fails SILENTLY — Play App Signing's second fingerprint

**Why it is needed:** **Play App Signing re-signs the app.** The certificate on an **installed Play build is Google's**, not the EAS one. Android matches the *installed* certificate against `assetlinks.json`, so the file must carry **both** — the EAS signer **and** Play's.

**Today's state (measured):** `public/.well-known/assetlinks.json` carries exactly **one** fingerprint — `4B:D8:B2:4E:…:AB:FF:A2`, the **EAS/preview** signer, derived from a real signed APK with **`apksigner`** (not `keytool`). ⚠️ `keytool -printcert -jarfile` cannot read that APK at all — it is **v2-only signed**, so `keytool` prints nothing and looks like a different problem. Use `apksigner` from the Android SDK's **build-tools**.

**The steps:**

1. Play Console → **Test and release → Setup → App integrity → App signing key certificate** → copy the **SHA-256**.
   ⚠️ **Copy the *App signing key* fingerprint, NOT the *upload key* one.** They are different values, both are shown on that page, and picking the wrong one **fails silently** — the link just opens the browser.
2. Add it as a **second string** in the `sha256_cert_fingerprints` array. ✅ **Keep the existing one** — a dev/preview install and a Play install are *different* installs, and both must verify.
3. Deploy the site (the Worker is built from this repo).
4. `npm run check:links` → the **RELEASE GUARD** should stop warning (it checks structure and cross-file agreement; it cannot fetch Play's key for you, and does not pretend to).
5. ⚠️ **Verify on the Play-signed install — not the EAS one:**
   ```bash
   adb shell pm get-app-links app.josspaperar     # expect: verified
   ```
   Then **tap a real link** (from SMS/Notes/another app). ⚠️ `adb shell am start -a android.intent.action.VIEW -d "https://josspaperar.app/join/…"` **does NOT prove it** — that **bypasses** the association check and looks like success either way. Both traps are already written down in `public/.well-known/README.md`.

### A.5 ✅ The store fallback is ALREADY BUILT — only the listing is missing

`public/_redirects` already carries:

```
/join/*  https://play.google.com/store/apps/details?id=app.josspaperar  302
```

…with its own note: *"⚠️ Not yet published to Play — this 404s on Google's side until it is."* ✅ **So `SCRUM-110`'s first closing condition is a `curl`** — after the listing is live, re-run it and confirm it reaches the store page instead of a 404.

✅ The design reasoning is worth keeping, because it explains why a plain 302 is correct rather than lazy: **the OS intercepts a verified App Link *before any HTTP request leaves the device*.** So reaching `_redirects` **already means** the app did not take the link (not installed, or not yet verified) — which is precisely when the store is the right answer.

### A.6 ⚠️ What a listing does NOT solve — please do not promise this

⚠️ **A store install does not carry the invite code.** `public/_redirects` says it plainly: deferred deep-linking needs the code passed as a Play **`referrer`** and read back in-app via the **Play Install Referrer API** — *"a native capability this app does not have yet."* So a brand-new user who taps a QR **installs the app and then must re-enter the code** (or be sent a new one).

✅ That is a **designed, recorded gap — not a defect**, and it is **not** part of `SCRUM-110`. ⚠️ It deserves its own ticket; **say the word and I will open one.**

⚠️ **Adjacent, and the same shared surface:** the **domain renewal** — `josspaperar.app` renews **2027-10-10** ([[19-build-plan-services-api-environments]] §6.2 #6): *"if it lapses, every shared QR dies silently."* Not a Play issue; listed here because it is the other half of "the link works".

### A.7 ✅ The Play checklist — with the verification for each

| ☐ | Item | Owner | How to know it is done |
|---|---|---|---|
| ☐ | Account type decided (**§A.1**) | **PM** | the choice is made *before* paying |
| ☐ | Account created + identity verified | **PM** | Console shows the account as verified |
| ☐ | **Device verification** completed | **PM** | Google's device-verification step clears — ⚠️ needs a real Android device |
| ☐ | App created, package **`app.josspaperar`** | **PM** | the package matches `app.json` exactly |
| ✅ | **Privacy policy live at a public URL** | **code** | `curl -I https://josspaperar.app/privacy` → **200**, no login — ✅ **verified 2026-10-16** |
| ☐ | Data Safety + content rating + ads declared | **PM** | answered from doc 13 / ADR-007, not memory |
| ☐ | Test instructions + a live invite code in *App access* | **PM** | a reviewer could complete a join |
| ☐ | **Target API ≥ 36** (**§A.3**) | **code** | `aapt2 dump badging … \| grep targetSdkVersion` |
| ☐ | AAB uploaded (`production` profile) | **code** | the Console accepts it as a new release |
| ☐ | Closed test: **12 testers × 14 continuous days** | **PM** | the Dashboard's testing requirement shows **met** |
| ☐ | Production access granted | **PM** | Production is no longer disabled |
| ☐ | ⚠️ **Play App Signing fingerprint added + App Link re-verified** (**§A.4**) | **code** | `adb shell pm get-app-links app.josspaperar` → **`verified`**, plus a **real tap** |
| ☐ | The `curl` reaches the store, not a 404 (**§A.5**) | **PM** | the 302 resolves to the live listing |

---

## B · The phone — `SCRUM-109` → the device-gated set

### B.0 ⚠️ Two things to be clear about before touching the phone

1. **The phone must exist.** ⚠️ `SCRUM-52` is `Done`, but that ticket was the **purchase**; the **undelivered handset** is tracked in **`SCRUM-109`** — 1 × **POCO C81 Pro** (Android 15 / HyperOS 3 · 4 GB RAM · 720×1600 · 64 GB + microSD · 6,000 mAh). **Nothing has run on it yet**, which is why `SCRUM-88` · `106` · `92` (AC 6) · `51` · `108` are "blocked in practice" while reading as done on paper.
2. ⚠️ **The emulator is not a substitute.** `SCRUM-64` says so itself: the floor AVD is *"a **development** target, **not** an acceptance target."* Everything below needs **glass**.

### B.1 What to set up on the phone — about 20 minutes

**On the handset:**
- Complete the out-of-box setup and put it on **the same Wi-Fi as your computer** (§B.3 has the fallback if that network isolates clients).
- **Settings → About phone → tap *Build number* 7×** → Developer options unlock.
- **Developer options → USB debugging = ON.**
- ⚠️ **HyperOS / MIUI carries an extra gate:** installing over USB usually needs **Developer options → *Install via USB* = ON**, and on some builds that switch demands a **Xiaomi account** and/or a **SIM**. ⚠️ **If it refuses to stay on, that is why** — and the dev build can be installed from a **download link opened on the phone itself** instead (§B.2), which sidesteps the USB-install path entirely. *(Xiaomi reshuffles these between releases — check it live rather than trusting a blog post.)*
- **Keep the screen awake** for long sweeps (Developer options → *Stay awake*, or `adb shell svc power stayon true` while plugged in).
- ⚠️ **Write down the Android version it actually reports** — *"Android 15 / HyperOS 3"* is a **Tier-F claim** in the ticket and worth confirming on the real unit.

**On the computer:**
```bash
adb devices          # the phone must appear as "device" — not "unauthorized"
```
⚠️ `unauthorized` means the RSA prompt **on the phone's screen** was not accepted. Accept it and tick *always allow*. (If `adb` is missing, it lives in the Android SDK's **platform-tools**.)

### B.2 The dev build — ⚠️ one package has to be added first

⚠️ **`eas.json`'s `development` profile sets `developmentClient: true`, but `expo-dev-client` is NOT in `package.json`.** Measured 2026-10-12. That profile will refuse to build until the package is added:

```bash
npx expo install expo-dev-client        # ✅ resolves the SDK-compatible version — never `npm install` for an Expo package
npx eas-cli@latest whoami               # confirm EAS is logged in first
npx eas-cli@latest build --profile development --platform android
```

- ⚠️ **Why a dev build rather than Expo Go:** the app depends on native modules (`expo-camera`, `expo-sqlite`, `expo-secure-store`, `expo-localization`), and **a project needs a development build as soon as it has native code**. It also lets you reload JS without rebuilding.
- **Install the result:** the build page offers a **QR code / URL** — ✅ **open it on the phone** to download and install the APK directly. That route also avoids the Xiaomi USB-install gate above.
- ✅ **Rebuild only when native code changes.** A JS-only change does not need one; adding a library with native code does.

### B.3 The dev loop

```bash
cd <worktree>
cp .env.example .env        # ⚠️ only if absent — a fresh WORKTREE needs its own (handover trap 19)
npx expo start              # then scan the QR from the dev build
```

- ⚠️ **The `.env` is small and load-bearing** — measured, the app-facing env is exactly **two** variables (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`), and they are read by **Metro**, not by the phone. So **which worktree you typed `expo start` in decides which backend the phone talks to.**
- ✅ **The phone talks to the HOSTED Supabase** (`yercgevebxvtzkgctfai`, `ap-southeast-1`) over HTTPS. **It does not need the local Supabase stack** — that exists for tests and the SQL suite, and nothing in it has to be running for a device run.
- ⚠️ **If the phone cannot see the dev server** (guest/corporate Wi-Fi often isolates clients): `npx expo start --tunnel`, or USB with `adb reverse tcp:8081 tcp:8081`.
- **The dev menu:** shake the phone, or press `Ctrl+D` in the terminal.
- ✅ `npm run bundle:android` (`expo export --platform android`) is a useful pre-flight — it proves the JS bundles **before** you carry a defect to the device.

### B.4 What to grant and check on the device

- ⚠️ **Camera permission.** The scanner (join) and the fire effect both need it. ✅ Grant it on the first prompt; if it was ever denied, re-enable it in Settings. ⚠️ **A denied camera permission looks exactly like a broken scanner** — check it *first* when the scanner "does not work".
- **The App Link, on this very install:**
  ```bash
  adb shell pm get-app-links app.josspaperar      # expect: verified
  ```
  ✅ **A dev/preview build CAN verify** — its signer is the **EAS** fingerprint that is *already* in `assetlinks.json` (`4B:D8:B2:…`). ⚠️ Only a **Play-signed** install needs the **second** fingerprint (§A.4). This is how `SCRUM-88`'s cold-start clause and `SCRUM-108` get tested.
- ⚠️ **Battery optimisation:** HyperOS kills backgrounded apps aggressively. If long sweeps keep dying mid-run, set the app to **no restrictions**.
- ✅ **Nothing else.** The app ships no notification, analytics or crash SDK — so there is no other permission to reason about.

### B.5 ⚠️ What the run must actually produce — the *why* of all of the above

This is the list the device tickets are waiting on. Each row names the ticket it closes.

| # | What to do | How, honestly | Ticket |
|---|---|---|---|
| 1 | **Cold-start a real invite link → join preview** | ⚠️ **Tap a real link** for the *routing* question. `adb shell am start -W -a android.intent.action.VIEW -d "https://josspaperar.app/join/<CODE>"` is useful for the **timing** but ⚠️ **bypasses the association check** — it answers the speed question, never the routing one | `SCRUM-88` AC 1 · `SCRUM-108` |
| 2 | **Scan a QR while offline** | Aeroplane mode ON → scan a code shown on another screen → the decode must still work (the *join* may queue) | `SCRUM-88` AC 3 |
| 3 | ⚠️ **No invite code in logs** | `adb logcat -c` (clear), do a full join, then `adb logcat \| grep -i "<the code>"` → **must be empty** | `SCRUM-88` AC 4 |
| 4 | **The full walk:** tutorial → fork → create → join → manage → book | ✅ Then a **second** ritual as a real clan member. ✅ For the two-party join a **second identity** is needed — the **emulator** is a perfectly good second party (the app supports **anonymous** sign-ins), so a second handset is not required | `SCRUM-88` · `SCRUM-106` |
| 5 | **The six confirm dialogs** | Exercise each one explicitly | `SCRUM-106` |
| 6 | **The clan pill** | | `SCRUM-92` AC 6 |
| 7 | **The fire effect over a live camera** | On the real sensor, in real light — not a virtual camera | `SCRUM-51` |
| 8 | ⚠️ **The two timings** | **Cold start:** `adb shell am force-stop app.josspaperar` **first**, then `am start -W` — ⚠️ a warm start is not a cold start. **Camera-ready:** record the screen and read the time off the video; ⚠️ timing by eye is not a measurement | `SCRUM-109` (AC 4) |
| 9 | ✅ **Capture evidence** | `adb exec-out screencap -p > shot.png` · `adb shell screenrecord /sdcard/run.mp4`. ⚠️ **A device claim without evidence is only a claim** | all of them |

⚠️ **The server half of row 3** (whether the code reaches analytics/logs on the *server*) is checkable too, via the Supabase log stream — **ask and I will pull it.**

### B.6 ⚠️ Honest limits of this run

- ⚠️ **4 GB is the *top edge* of Tier F.** So this handset **cannot prove the strict 3 GB Go-class case** — already recorded against `SCRUM-52`, and it does not go away by running the phone.
- ⚠️ **Expect defects the gates structurally cannot see.** S32's first device run found **three**, all in a write path that had never executed. The paths that have never run are exactly the ones under test here — **the clan screens and the tutorial**.
- ✅ **The emulator is still the right tool for development** (§B.1 · `SCRUM-64`) — just not for acceptance.

---

## C · The order, on one screen

```
TRACK 1 — Play (Part A)                        TRACK 2 — the phone (Part B)
─────────────────────────                      ─────────────────────────────
1. Decide personal vs org   (§A.1) ⚠️ FIRST    1. Phone arrives (SCRUM-109)
2. Create account + verify  (§A.2)             2. Dev setup on the phone (§B.1)
3. ⚠️ Privacy policy page — the one            3. npx expo install expo-dev-client
   artifact that does not exist (§A.2 4a)      4. Build + install the dev build (§B.2)
4. ⚠️ Check target API ≥ 36  (§A.3)            5. npx expo start → the run (§B.3)
5. Listing + declarations   (§A.2)             6. Run §B.5, capture evidence
6. Upload the AAB           (§A.2)             7. Comment the results onto
7. Closed test: 12 × 14 ⚠️  (§A.2)                SCRUM-88 / 106 / 92 / 51
8. Listing live → the curl  (§A.5)
9. ⚠️ Add Play's fingerprint +
   re-verify the App Link   (§A.4)
```

✅ **The two tracks never block each other.** ⚠️ Only two items sit on the critical path for *both*: a **real Android device** (Play device verification *and* the device run) and the **API-36 check** (which can fail a submission outright).

## D · What this document does NOT cover

- **The entity, tax, DPO and D-U-N-S work** — [[20-business-registration-and-compliance]], and the account ticket **`SCRUM-76`**.
- **Choosing an ad SDK** — `SCRUM-107`, gated on the publisher-control read.
- **The AR mechanic itself** — `SCRUM-13`, per ADR-003's non-AR approach.
- ⚠️ **Carrying the invite code through an install** (deferred deep-linking) — §A.6: a recorded gap with **no ticket yet**.

---

**⚠️ Provenance.** Every claim above is sourced either to a file in this repo (section named), to a Jira ticket, or to a primary web source fetched **2026-10-12** (**Google Play Console Help**: *App testing requirements for new personal developer accounts* · *Target API level requirements for Google Play apps*). ⚠️ **The items marked as measured — the missing `expo-dev-client`, the single fingerprint, the absent privacy page, the two env variables, `versionCode: None` — were run against this working tree on 2026-10-12**, not recalled. ⚠️ **One of those has since changed: the privacy page now EXISTS** — ✅ corrected in **§A.2 step 4a** on **2026-10-16**. The list records what was measured *on that date*, **not** the current state.
