# 06 · Tech stack options — SCRUM-10 research

**Status:** ✅ research complete · **decided — Option A locked in [[ADR-001-option-a-expo-rn-supabase-hosted-ai]] (2026-09-26)**
**Date:** 2026-09-25 (session 16)
**Jira:** SCRUM-10 · In Progress (constraints comment posted)
**Related:** [[05-concept-to-mvp-gap-analysis]] · [[04-ar-app-patterns]] · [[03-ai-design-tools]]

---

## 1 · Binding constraints (stakeholder, verbatim intent)

**Hard limitations**
1. **Dev platform = Fedora 44 (Linux).** Every tool in the chain (IDE, emulators, SDKs, GPU/ML tooling, CI we self-test) must have a working Fedora environment. macOS-only tooling (Xcode) is a conflict to solve explicitly, never assumed away.
2. **AI-assisted development on Cline.** Stack must be Cline-friendly: mainstream, well-documented languages/frameworks with strong public code representation; Cline runs as a VS Code extension on Fedora.

**Soft limitations**
3. **Cost low at this stage.** Free/open-source and free tiers first; paid only where no viable free option exists — and then named explicitly with expected cost.

**Functional requirements**
4. **Cross-platform + responsive** — one codebase, Android at minimum, responsive layouts for the 40–50s audience (web reach matters: CNY traffic is phone-heavy, both iOS and Android).
5. **AI pipeline**: background removal → object identification → cartoonization to **style D** (low-poly 3D × ink brush; fidelity target D).

---

## 2 · Key research findings (with sources, checked 2026-09)

### 2.1 The iOS-from-Linux problem (the hard one)
- iOS builds/signing **require macOS somewhere** — no workaround exists ([VpsGona iOS-without-Mac guide, 2026-05](https://vpsgona.com/en/blog/articles/ios-development-without-mac-2026.html)).
- Viable paths from Fedora:
  - **EAS Build (Expo)** — cloud macOS builds; **Free plan = 15 Android + 15 iOS builds/month**, store submission included ([expo.dev/pricing](https://expo.dev/pricing)).
  - **Codemagic** — mobile CI/CD with cloud macOS; **Free = 500 build min/month**, unlimited apps, single user (note: limits tightened 2026-09 — history 60→30 days; [Codemagic pricing](https://codemagic.io/pricing)).
  - Cloud Mac rental (~$20/day when needed) — only for interactive sessions, not everyday dev.
- **Apple Developer Program = $99/year** — unavoidable when publishing iOS (not needed for Android-only MVP).
- Emulators: Android emulator works on Fedora (KVM is excellent on Fedora); **iOS simulator only on macOS** → develop/test Android-first; test iOS via TestFlight builds from CI.

### 2.2 Cross-platform framework landscape (2026)
- React Native, Flutter, KMP, Capacitor, Tauri all mature; **all share the same iOS-needs-macOS constraint** ([2026 cross-platform deep dive](https://www.youngju.dev/blog/culture/2026-05-25-cross-platform-mobile-react-native-flutter-expo-capacitor-tauri-kotlin-mp-lynx-2026-deep-dive.en)).
- **Expo** is the current sweet spot for solo devs: React Native with managed tooling, EAS cloud builds, OTA updates, and a **web target** from the same codebase (expo.dev; Expo MCP exists for agent-assisted dev).
- **Flutter**: first-class Android + iOS + **web + Linux desktop** targets; Fedora install documented (community); iOS via Codemagic.
- **AR reality**: none of the mainstream frameworks has first-class AR. The notable 2026 development: **SceneView (sceneview.org) ships Android, iOS, Web, Desktop, *and* Flutter + React Native SDKs** ([feature log](https://sceneview.org/blog/feature-log/)) — place 3D + AR (ARCore/ARKit/WebXR) from the same scene description ([Google Play @sceneview](https://play.google.com/store/apps/details?id=org.sceneview.app)). Community RN/Flutter AR wrappers otherwise lag.

### 2.3 AI pipeline (bg removal → object ID → cartoonize)

| Stage | Self-hosted (free) | Hosted API (paid) | Notes |
|---|---|---|---|
| **Background removal** | `rembg` (U²-Net/IS-Net, ONNX) — pip install, **~10 s/image on CPU**, quality dips on hair/complex bg ([benchmark](https://ai-engine.net/blog/rembg-vs-cloud-background-removal-api)) | remove.bg / similar — ~3.5 s, clean edges, **free tier then ~$12.99/mo** class pricing | Cold-start model downloads ~170 MB; self-host fine for low volume |
| **Object identification** | YOLO / SAM (free, well-supported, CPU-viable) | Vision LLM API (per-call cost) | YOLO/CLIP sufficient for joss-paper item categories |
| **Cartoonize (style D)** | Local diffusion (SDXL + style LoRA / ControlNet) — **needs NVIDIA GPU**, quality/fidelity to style D unproven on Fedora | **fal.ai `image-editing/cartoonify` = $0.04/image** ([llms.txt](https://fal.ai/models/fal-ai/image-editing/cartoonify/llms.txt)) · Replicate styles ≈ **$0.001–0.01/image** (e.g. ~$0.003 Tokyo night style, [apatero roundup](https://apatero.com/blog/best-cheap-image-generation-api-2026)) | fal Cartoonify gives bold-outline cartoons — **not low-poly 3D**; style D likely needs ControlNet/IP-Adapter pipeline or a fine-tuned LoRA + reference sheet of Style D outputs |

**Key risk to test early:** style-D fidelity. Off-the-shelf "cartoonify" ≠ low-poly 3D × ink brush. Options: (a) prompt-engineer SDXL/Flux img2img against the Style D sample set, (b) train a small style LoRA on Style D samples (Replicate/fal host training, ~one-off cost), (c) hybrid: 2D cartoonize now, true low-poly 3D later (matches MVP scope anyway). *Timebox a style-D spike before committing.*

### 2.4 Backend / auth / storage (cost lens)
- **Supabase** (Postgres, auth, storage, edge functions) — free tier generous for MVP; self-hostable later. Fits Cline well (SQL + TypeScript).
- **Firebase** — free Spark tier, Google lock-in; fine too but less portable.
- **Own FastAPI + Postgres** on a free-tier host — max control, more work; only worth it if AI pipeline needs custom GPU serving.

---

## 3 · The options

### Option A — Expo / React Native (TypeScript) + Supabase + hosted AI
One TS codebase → **Android + iOS + responsive web** (Expo web) from one repo.
- ✅ **Best Cline fit**: TypeScript is Cline's strongest language; Expo has an MCP server for agent workflows; huge training corpus.
- ✅ Fedora: 100 % local dev for Android + web (Android Studio/SDK, Node, KVM emulator); iOS built in EAS cloud (**15 builds/mo free**).
- ✅ AR via **SceneView RN** (or ARQuickLook/Scene Viewer fallback) — same JS codebase.
- ✅ Cost ≈ **$0** during MVP (free tiers everywhere; $99/yr Apple only when shipping iOS).
- ⚠️ RN AR wrappers are less battle-tested than native; JS bridge overhead for heavy scenes (acceptable for static offerings).
- ⚠️ 15 iOS builds/month = discipline needed on release cadence.

### Option B — Flutter (Dart) + Supabase + hosted AI
One Dart codebase → Android + iOS + **web + Linux desktop**.
- ✅ Excellent responsive UI system (Material) — good for 40–50s-friendly layouts; mature, single rendering model.
- ✅ Fedora: official Linux support; iOS via **Codemagic free 500 min/mo**.
- ✅ **SceneView Flutter SDK** exists for AR.
- ⚠️ Dart/Flutter = second-best Cline fit (still good; fewer MCP/tooling options than TS).
- ⚠️ Web target is weaker than a real web framework (SEO, first-load); two rendering paths to test.

### Option C — Web-first PWA (React/Next.js) + Capacitor + Supabase + hosted AI
Responsive web app as the product; Capacitor wraps it for app stores later.
- ✅ **Best for Fedora + Cline** — pure web stack, everything local, zero platform toolchains.
- ✅ **Cheapest & fastest** to iterate; responsive by construction; reaches every phone incl. WeChat browser use-cases.
- ✅ AR via **WebXR** (Android Chrome) / Scene Viewer / iOS Quick Look — no native code.
- ⚠️ Weakest store presence & push; iOS WebXR is poor; AR experience noticeably below native.
- ⚠️ Camera/upload/permission flows more fiddly in browser.

### Option D — Unity (C#) + AR Foundation (AR-heavy path)
True cross-platform AR (ARCore+ARKit) with official **Linux editor** support.
- ✅ Best-in-class AR if AR becomes the core of the product.
- ⚠️ Responsive app UI in Unity is painful; Cline less effective in Unity projects; heavier engine than MVP needs.
- Verdict: **hold in reserve** — only if native AR quality proves essential post-MVP.

---

## 4 · Comparison matrix

| Criterion (weight) | A · Expo/RN | B · Flutter | C · PWA | D · Unity |
|---|---|---|---|---|
| Fedora 44 dev (hard) | ✅ Android+web local, iOS cloud | ✅ local, iOS via CI | ✅ fully local | ✅ editor on Linux |
| Cline-friendliness (hard) | ✅✅ TS + MCP | ✅ Dart | ✅✅ TS | ⚠️ C#/Unity-centric |
| Cross-platform + responsive | ✅✅ mobile+web one codebase | ✅ mobile+web (web weaker) | ✅✅ responsive native-grade web | ⚠️ AR great, UI costly |
| AR capability | ✅ SceneView RN | ✅ SceneView Flutter | ⚠️ WebXR/Scene Viewer | ✅✅ best |
| Cost at MVP | ~$0 (+$99 Apple later) | ~$0 (+$99 Apple later) | ~$0 | ⚠️ asset/store overhead |
| AI pipeline fit | ✅ TS client + Supabase fn | ✅ | ✅ | ⚠️ |
| Speed for solo dev | ✅✅ | ✅ | ✅✅ | ❌ |

---

## 5 · Preliminary recommendation (for evaluation, not yet decided)

**Lean: Option A (Expo/React Native + Supabase + hosted AI)** — it maximises the two hard constraints (Fedora-only dev with cloud iOS; Cline's strongest language + MCP), satisfies cross-platform + responsive with one codebase, keeps MVP cost ≈ $0, and has a credible AR path (SceneView) that can mature after MVP. **Option C** is the strong fallback if we decide store presence/AR aren't needed for launch — it's the fastest and cheapest to validate the core loop. **Option B** if we judge UI polish/dart team familiarity more important than the TS/Cline advantage.

**Regardless of option, the shared architecture shape:**
```
[Expo/Flutter/PWA client: EN/ZH responsive UI]
        │  HTTPS
[Supabase: auth · Postgres · storage (photos, style-D outputs)]  ← free tier
        │  edge function (TS) or thin FastAPI service
[AI pipeline: bg removal (rembg self-host | API) → YOLO/SAM id → cartoonize (fal/Replicate, $0.001–0.04/img)]
        │
[AR display: SceneView (RN/Flutter) | WebXR/Scene Viewer (PWA)]
```

**Open questions for the stakeholder:**
1. Option A, B, or C? (D only if AR is judged the product core now.)
2. Is **iOS in scope for MVP**? (Android+web MVP ⇒ $0; iOS adds $99/yr + build-farm discipline.)
3. Budget for a **style-D fidelity spike** (a few days + ~$10–20 of API credits) before locking the cartoonization provider?
4. GPU access for self-hosted diffusion, or commit to hosted APIs from the start?

---

## 6 · Sources
- [Cross-platform mobile 2026 deep dive](https://www.youngju.dev/blog/culture/2026-05-25-cross-platform-mobile-react-native-flutter-expo-capacitor-tauri-kotlin-mp-lynx-2026-deep-dive.en)
- [iOS development without a Mac (2026)](https://vpsgona.com/en/blog/articles/ios-development-without-mac-2026.html) · [Expo pricing](https://expo.dev/pricing) · [Codemagic pricing](https://codemagic.io/pricing)
- [rembg vs cloud bg-removal benchmark](https://ai-engine.net/blog/rembg-vs-cloud-background-removal-api)
- [fal.ai Cartoonify ($0.04/img)](https://fal.ai/models/fal-ai/image-editing/cartoonify/llms.txt) · [cheap image API roundup 2026](https://apatero.com/blog/best-cheap-image-generation-api-2026)
- [SceneView features (Flutter/RN/Web/AR)](https://sceneview.org/blog/feature-log/) · [SceneView on Google Play](https://play.google.com/store/apps/details?id=org.sceneview.app) · [Unity on Linux](https://docs.unity3d.com/Manual/linux.html)
### Deep dive: the Option A "AR wrapper" concern, elaborated (2026-09-25)

Checked the actual package — `@sceneview-sdk/react-native` v4.31.0, published Aug 2026 ([npm](https://www.npmjs.com/package/@sceneview-sdk/react-native)):

1. **It self-describes as "Alpha".** README verbatim: *"3D model loading works on both platforms. AR scene is functional on Android. The iOS native bridge is CI-verified … it type-checks only: **it does not link, does not run**."* → Android AR works today; iOS AR is not yet proven to even build end-to-end.
2. **Thin API coverage.** [Upstream issue #909](https://github.com/sceneview/sceneview/issues/909): *"RN/Flutter: bridges expose only ~5–10% of Android core API."* Enough for load-a-model + plane detection; our richer interactions (toss-and-curve, custom gestures, lighting/fog tweaks) may hit the bridge's ceiling → fallback is writing Kotlin/Swift native modules ourselves.
3. **Very low adoption** — ~5 npm dependents; effectively a small-maintainer project. RN "new architecture" and version churn can break it; when it does, fixing native bridge code is slower than TS even with Cline.
4. **Expo friction (minor)** — any AR native module means **development builds** (prebuild/EAS), not Expo Go. Routine, but a workflow change.

**Why this is much smaller than it sounds:**
- **MVP doesn't use the wrapper at all.** Our own AR MVP call ([[04-ar-app-patterns]]) is *non-AR AR*: camera background + fixed overlay (Pokémon GO's default mode) = plain `expo-camera` + RN views. Zero ARCore/bridge involvement. The wrapper is a **post-MVP** question only.
- **Android-first alignment**: Android AR is the functional path, and we just deferred iOS — the alpha-quality part (iOS bridge) is out of scope by design.
- **Exit ramps if true AR stalls** (in order of preference):
  1. SceneView RN Android AR (the working path) for the world-locked throw scene;
  2. Android **Scene Viewer intent** — Google's native AR renderer, invoked from RN, zero wrapper code;
  3. **@reactvision/react-viro** community fork (claims Expo support, active new-arch fixes);
  4. a **bounded native Kotlin module** for just the throw screen, controlled from TS.
  The AR screen is one screen — even the worst case is a contained cost, not an architecture failure.

**Verdict:** concern noted and quantified, but it does **not** block Option A — neither for MVP (non-AR AR) nor plausibly later (Android has 4 exit ramps).
**Decisions (2026-09-25, stakeholder):**
- **iOS = out of MVP scope**, provided the chosen platform can add iOS later — ✅ satisfied by all options (Expo adds iOS via EAS with zero code change; revisit at $99/yr Apple when shipping iOS).
- **Leaning Option A (Expo/RN)** — confirmed pending the AR-wrapper concern, which has now been elaborated above (verdict: does not block).

Remaining open: (3) style-D fidelity spike approval; (4) self-host GPU vs hosted APIs.
**Decisions (2026-09-25, stakeholder) — all four open questions now closed:**
- ~~(1) Option A/B/C?~~ → **Leaning A (Expo/RN)**, AR-wrapper concern elaborated above — verdict: does not block.
- ~~(2) iOS in MVP?~~ → **No** — iOS out of MVP; platform must support adding later (Expo: zero code change, $99/yr only when shipping).
- ~~(3) Style-D spike?~~ → **Approved**, budget US$10–20 (logged in [[project-costs]]).
- ~~(4) Self-host GPU vs hosted APIs?~~ → **Hosted APIs from day one** — rationale: guarantee deployment works from day 1; no GPU capex.

**Cost tracking**: dedicated page started → [[project-costs]] (SGD, Mastercard-rate conversion rule for future AI, ClinePass US$9.99/mo logged).
