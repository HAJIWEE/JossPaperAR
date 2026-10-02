# ADR-003 · AR mode & framework — *non-AR AR* for the MVP

**Status:** ✅ **Accepted** · 2026-10-02 (Session 26)
**Deciders:** stakeholder (PM), on AI research support
**Closes (gap-analysis §6):** **2 · AR mode** — *non-AR AR first* (decided S8/doc 04 · recorded here)
**Answers:** **SCRUM-8** — *"Explore AR development frameworks (ARKit, ARCore, Unity, etc.)"*
**Related:** [[04-ar-app-patterns]] (the pattern research) · [[06-tech-stack-options]] §2.2 (the AR-wrapper elaboration) · [[07-system-architecture]] (the render/service map) · [[14-nfr-device-and-performance-targets]] (N3/N4/N10 — the frame & thermal budget) · [[17-ar-fire-spike-plan]] (the PoC plan) · SCRUM-8

---

## Context

SCRUM-8 (raised Session 2, High priority) asked four questions the project had to answer before building the burn ritual:

1. **Which AR framework should we use?** (ARKit · ARCore · Unity · …)
2. **What are the trade-offs between native vs cross-platform approaches?**
3. **How do we implement the AR fire mechanic?** (fixed position like Pokémon GO's default catch)
4. **What's the simplest way to validate the concept?**

**What had already been settled by the time this record was written (S8 → S26):**

- **The AR pattern** ([[04-ar-app-patterns]], S8): we take Pokémon GO's **catch mechanic** — an object fixed *relative to the phone*, not world-locked — and its **"non-AR AR" mode** (camera background + fixed overlay). Doc 04's explicit recommendation: *"Start with the non-AR AR mode … Add true AR later."*
- **The stack** ([[ADRs/ADR-001-option-a-expo-rn-supabase-hosted-ai|ADR-001]], S16/17): **Option A — Expo / React Native (TypeScript) + Supabase + hosted AI APIs**, **Android-first**, iOS deferred, and — as clause 4 of that decision — ***non-AR AR* for the MVP** with true AR deferred to four documented exit ramps.
- **The device floor** ([[14-nfr-device-and-performance-targets]], S19): **Tier F = 3GB RAM · Android 11 · Android Go-class · 720p**, chosen because the audience is rural/low-end. The PM direction (*"not flagship-level hardware"*) is what makes dropping ARCore/ARKit mandatory, not merely convenient — world tracking and a GPU-class render path cannot be guaranteed on a 3GB Go-class phone.
- **The frame & thermal budget** (doc 14): **N3** ≥30 fps sustained on Tier F · 60 fps on Tier M · input→render **≤ 100 ms**; **N4** no thermal throttling within a 5-min ritual (frame-time degradation ≤ 20%); **N10** battery ≤ 8 % per 10-min session.

**The three framework families weighed (SCRUM-8's actual question):**

| Family | What it is | Verdict for our MVP |
|---|---|---|
| **Native AR SDKs** | ARKit (iOS) · ARCore (Android) — world tracking, plane detection, light estimation | **Not used in the MVP.** They require a device/OS/hardware floor Tier F does not meet, add a native module (Expo dev builds, not Expo Go), and buy *world-locking* — a capability the burn ritual deliberately does **not** want (the fire must sit at a fixed screen position). |
| **Game engines** | Unity (AR Foundation) · Godot | **Rejected.** A second runtime, a second language, a heavyweight app shell (>100 MB vs the ≤40 MB AAB budget, N8), and it throws away the one-TypeScript-codebase win from ADR-001. Its value (3D scene rendering) is only needed for true-AR, which is post-MVP. |
| **Camera + overlay in the app's own stack** | `expo-camera` live preview + RN-rendered overlay (the check-out path, and exactly what the retired HTML prototype already *is*, minus the camera) | **Adopted.** No new native module, no second runtime, works on the Tier F floor, and it is structurally already what the prototype validated. |

---

## Decision

1. **The MVP ships as *non-AR AR*.** The burn screen is a **live camera preview** (`expo-camera`) with the **fire and the offering rendered as a fixed-position overlay** in plain React Native views — the fire sits at a constant screen position, exactly like Pokémon GO's default catch screen. **No ARCore, no ARKit, no Unity, no AR native module** in the MVP.
2. **"AR framework" for the MVP = none beyond the app's own stack.** The composite is `expo-camera` + RN views; the fire is a **sprite-sheet animation** (≤ 400 KB, ≤ 30 fps redraw on Tier F — doc 14 §3), driven on the UI thread. The throw is the already-validated **aim-band** interaction (正中 ±14.55 ×2.0 · 虔誠 ±39.40 ×1.5 · 擦邊 ±96.97 ×1.0 · 偏失 ×0), ported from the retired prototype's `aim-check.js`.
3. **True AR (world-locked fire) is deferred to post-MVP, Android-first.** When it comes, the framework is chosen from the **four exit ramps** below, in preference order — all of which keep the app in Expo/RN and cost one screen, not an architecture:
   1. **SceneView RN Android AR** (`@sceneview-sdk/react-native`) — the *working* path (Android AR is functional; the alpha iOS bridge is out of scope since ADR-001 deferred iOS).
   2. **Android Scene Viewer intent** — Google's native AR renderer invoked from RN; **zero wrapper code**.
   3. **@reactvision/react-viro** — community fork, claims Expo + new-architecture support.
   4. **A bounded native Kotlin module** for just the throw screen, controlled from TypeScript.
4. **The PoC plan is [[17-ar-fire-spike-plan]]** — the "fire over a live camera on a mid-range Android" spike from [[05-concept-to-mvp-gap-analysis]] §8, with doc 14's N3/N4/N10 as its acceptance gate. Execution is deferred until the **repo + CI milestone** exists and the **Tier F floor device** is in hand (tracked as a follow-up ticket).

---

## Alternatives considered → rejected

| Alternative | Why rejected |
|---|---|
| **ARKit (iOS only)** | iOS is out of MVP scope (ADR-001); and world-locking is not wanted — the fire is deliberately screen-fixed. |
| **ARCore (Android)** | Requires a device/OS/GPU floor Tier F does not guarantee; adds a native module → **Expo development builds** instead of Expo Go; contradicts the low-end/rural-first PM direction. The MVP does not need plane detection, depth or light estimation. |
| **Unity (+ AR Foundation)** | A second runtime + language; a heavy app shell that blows the ≤ 40 MB AAB / ≤ 120 MB install budget (N8); discards ADR-001's single-TypeScript-codebase win. Its strength (3D scene render) is a true-AR need only. |
| **Flutter (+ an AR plugin)** | Flutter was ADR-001's close second, but the stack is already RN; AR plugins for Flutter lag RN/SceneView parity. |
| **Web AR (WebXR · 8th Wall · model-viewer)** | The PWA/web-first route was rejected in ADR-001 (camera fidelity, performance, storage and install friction for the 40–50s audience). WebAR also adds a paid SDK (8th Wall) and browser-camera variability. |
| **`react-native-arkit`** | Effectively unmaintained (last meaningful release years ago), iOS-only, and depends on ARKit — already excluded. |
| **Adopting SceneView RN *now*** | It self-describes as **"Alpha"**; the iOS bridge type-checks but *"does not link, does not run"*; upstream issue #909 notes RN/Flutter bridges expose only ~5–10 % of the Android core API ([[06-tech-stack-options]] §2.2 deep-dive). Correct choice **only at the true-AR milestone**, not day one. |

---

## Consequences

**Good**
- **The entire AR concern collapses to "camera + a sprite overlay"** — no native module, so the daily loop keeps **Expo Go**; no new language; everything stays in the one TypeScript codebase.
- **It is the only choice that meets the Tier F floor** (3GB/Android 11/Go-class) — which is the whole point of the low-end-first decision.
- **The prototype already validated the interaction shape** (fixed fire, four aim bands, measured from the fire's own artwork), so the MVP is a port, not a re-design.
- **No AR-world-tracking failure modes** (tracking loss, lighting-dependent plane detection) can ever surface in the ritual — the screen-fixed fire cannot "lose the world".
- **Four documented exit ramps** keep true AR cheap to add later (one screen).

**Trade-offs / risks (accepted)**
- **Less "wow"** than world-locked AR — deliberately accepted for MVP reliability and reach (doc 04).
- **True AR later means a development build** (native module) and possibly a Kotlin module — a contained, documented cost, not an architecture failure.
- **The output is one flat composite** — no depth/occlusion, so a real object can't pass *behind* the fire. Not needed for the ritual as designed.
- **Frame/thermal discipline is now load-bearing** — with no AR framework doing it for us, N3/N4/N10 must be earned by the overlay implementation (hence the PoC plan).

---

## SCRUM-8's key questions — answered

1. **Which AR framework should we use?** → **For the MVP: none** — `expo-camera` + a fixed RN overlay. **For true AR (post-MVP):** SceneView RN (Android) first, with Scene Viewer intent / react-viro / a bounded Kotlin module as fallbacks.
2. **Native vs cross-platform trade-offs?** → Native AR SDKs buy world tracking we don't want and impose a hardware/OS floor we can't guarantee; Unity buys 3D scene rendering we don't need yet and costs a second runtime + app size. Cross-platform (Expo/RN) wins outright for a screen-fixed ritual on low-end Android.
3. **How is the AR fire mechanic implemented?** → Camera preview behind a **fixed-position fire sprite overlay**; the offering is thrown with the four aim bands measured from the fire's artwork (see [[07-system-architecture]] §2 and [[17-ar-fire-spike-plan]]).
4. **Simplest way to validate?** → **[[17-ar-fire-spike-plan]]**: fire over a live camera on the Tier F floor device, judged by N3/N4/N10 + the aim bands — deferred to the repo+CI milestone.

---

## References

- [[04-ar-app-patterns]] — the Pokémon GO catch pattern and the original *non-AR AR* recommendation (S8)
- [[06-tech-stack-options]] §2.2 — the SceneView RN AR-wrapper elaboration (alpha status, exit ramps)
- [[ADRs/ADR-001-option-a-expo-rn-supabase-hosted-ai|ADR-001]] — clause 4 (AR: non-AR AR; true AR post-MVP)
- [[07-system-architecture]] §2 — the app/overlay in the system diagram
- [[14-nfr-device-and-performance-targets]] — N3 (frame rate & input) · N4 (thermal) · N10 (battery)
- [[17-ar-fire-spike-plan]] — the proof-of-concept plan

---

*Created 2026-10-02 (Session 26) — records the S8/doc 04 decision as ADR-003 and closes the SCRUM-8 framework question.*


