# 🤖 03 - AI Design Tools Comparison

> **Purpose**: Holistic value comparison of AI design tools for building the Joss Paper AR app's visual identity, mockups, and (potentially) in-app cartoonization.
> **Status**: ✅ **Research complete** — design tooling settled: **Penpot** (Session 9, replacing Figma) · runtime cartoonization settled: **Path C on fal.ai** ([[ADRs/ADR-002-path-c-describe-then-generate|ADR-002]] · closes **SCRUM-7**) | **Started**: 2026-09-23 · **closed**: 2026-10-02

---

## ⚠️ Two Different Jobs - Don't Mix Them Up!

We need AI tools for **two distinct purposes**:

| Job | What it is | When | Example tools |
|-----|-----------|------|---------------|
| **A. Design-Time Tools** | Tools *we* use to design the app (mockups, wireframes, style exploration, marketing assets) | During development (now) | **Penpot**, Canva, Adobe Firefly |
| **B. Runtime Cartoonization** | An API the *app* calls when a user photographs an object | In production (later) | Stable Diffusion API, GPT Image API, custom model |

💡 **Key insight**: The tools for A and B are mostly different! But research overlaps - testing cartoonization now with design tools tells us if the concept works.

---

## 🎨 Section A: Design-Time Tools (For Us)

> **🔀 Tooling decision (2026-09-24 · Session 9): Figma → Penpot.** Figma was dropped — its MCP integration kept blocking our AI-assisted workflow. **Penpot** is now the primary design tool: open-source, web-standards native (SVG/CSS), free, and shipped with an **official MCP server** that lets AI agents read and write directly in the design file. The comparison table below is kept for context; the deep dive is now Penpot.

### 📊 Quick Comparison

| Tool | Free Tier | Paid (Individual) | AI Features | Best For | Verdict |
|------|-----------|-------------------|-------------|----------|---------|
| **Penpot** 🥇 | ✅ Professional (free forever): no limits, no missing tools; 8 team members, 10GB storage | 💰 Unlimited $7/editor/mo (cap $175/mo) · Enterprise $25/member/mo | No built-in image gen; **official MCP server** gives any AI agent read/write access (design-as-code) | UI/UX design, wireframes, prototypes, dev handoff (SVG/CSS native) | ✅ **Primary design tool (since Session 9)** |
| **Canva** | ✅ Free tier with basic AI | 💰 Canva Pro (monthly/annual) - check site for price | Magic Studio: text-to-image, background removal, magic edit | Quick mockups, social/marketing assets, non-designers | 🥈 Good complement |
| **Adobe Firefly** | ✅ Limited monthly credits | 💰 Standalone subscription or via Creative Cloud | Text-to-image, generative fill, text effects - **commercially safe training data** | Style exploration, image editing | 🥈 Strong for assets |
| **Midjourney** | ❌ No free tier | 💰 Subscription required (~$10-60/mo tiers) | Best-in-class aesthetic image generation | Mood boards, style exploration | 🥉 (See note) |
| **Leonardo AI** | ✅ Daily free credits | 💰 Paid tiers available | Image gen with fine control, model training | Game assets, consistent characters | 🥉 (See note) |
| **OpenArt** | ✅ Free trial w/ daily credits | 💰 Subscription w/ credits | Multi-model hub (GPT Image, Seedream, Nano Banana Pro, Kling) | All-in-one experiment platform | 🔍 To evaluate |

> **Notes**: ⛔ **Figma dropped (2026-09-24)** — the design tool moved to **Penpot** over MCP integration issues. **Midjourney/Leonardo**: both blocked automated research and have no free API tier; manual signup required to evaluate — lower priority since Penpot + a runtime API likely covers our needs.

### 🥇 Penpot - Deep Dive (Confirmed Data, 2026-09-24)

**Why it's our primary tool — the open-source design tool built on web standards, with an official MCP server:**

| Feature | What It Does For Us |
|---------|--------------------|
| **Penpot Design** | Core wireframes, UI design, protoyping — CSS Flex/Grid layouts mirror the real front-end |
| **Penpot MCP Server** | 🔌 Any MCP-capable agent (VS Code, Claude, Cursor…) reads and writes the design file directly — the capability Figma's MCP could not deliver reliably |
| **Design as code** | Designs are SVG/CSS underneath — dev hand-off is inspection, not translation |
| **Design Tokens** | Lock our palette (`#C23B22`, `#D4AF37`, …) once, reuse across every screen |
| **Open Source (MPL 2.0)** | No vendor lock-in; free to self-host; own everything you make |
| **Self-host option** | Run Penpot + the MCP server in our own environment — no data leaves the machine |

**Pricing (confirmed 2026-09-24):**
- **Professional (Cloud, FREE)**: free forever and fully featured — no file limits (within storage), unlimited teams, up to 8 team members, 10GB storage
- **Unlimited ($7/editor/mo, capped at $175/mo)**: more storage (25GB), 30-day version history & file recovery, early features
- **Enterprise ($25/member/mo)**: SSO, governance, centralized administration
- **Private Server ($50k/yr)**: dedicated infrastructure for orgs — note: **self-hosting the community version is free**
- **MCP server**: free and open — local setup recommended (simpler), remote available

**Our recommendation**: stay on **Professional (free)** — the free MCP server carries the AI-assisted workflow, so the whole design phase costs **$0**. ✨

---

## ⚙️ Section B: Runtime Cartoonization Options (For the App)

> The app must transform a user's photo of an object (e.g. a watch) into a joss-paper-style cartoon **in seconds**, on demand.

### 📊 Candidate Approaches

| Approach | How It Works | Pros | Cons | Cost Signal |
|----------|--------------|------|------|-------------|
| **1. Commercial image API** (GPT Image / Stability API / OpenArt API) | Send photo + style prompt → get cartoon back | No ML expertise, fast to build, quality improving fast | Per-call cost, style consistency varies, latency | Pay-per-image |
| **2. Style-transfer API** (dedicated cartoonization) | Specialised img2img models | Purpose-built, predictable | Fewer providers, may look generic | Pay-per-image |
| **3. Fine-tuned open model** (Stable Diffusion + LoRA) | Train custom style on joss paper examples | Full style control, own IP, can run locally | Requires GPU knowledge, hosting, slower iteration | GPU/hosting costs |
| **4. Background removal + paper texture overlay** (cheap MVP) | Remove bg → apply joss paper filter/texture | Very cheap, instant, deterministic | Not truly "AI cartoon", limited wow-factor | Near-free |

### 🔍 Providers Identified So Far

| Provider | Models/Products | API | Self-Host | Notes |
|----------|----------------|-----|-----------|-------|
| **Stability AI** | Stable Diffusion family, image/video/audio/3D models | ✅ Platform API | ✅ Self-hosted + cloud (Bedrock etc.) | Enterprise-grade, "commercially-safe" training data, open-weight options |
| **OpenAI** | GPT Image models, DALL-E legacy | ✅ Images API | ❌ | Strong prompt adherence, good for mockups & style tests |
| **OpenArt** | Aggregates multiple top models (GPT Image 2, Seedream 5, Nano Banana Pro, Flux 2) | ✅ (Platform w/ credits) | ❌ | 🆕 "OpenArt MCP" - generate images inside AI agents! Could test styles fast |
| **Leonardo AI** | Fine control + custom model training | ✅ (paid tiers) | ❌ | Popular for game assets; blocked automated research - manual check needed |
| **Midjourney** | Aesthetic leader | ❌ (no official API) | ❌ | Great for *our* moodboards, not runtime-useable |

> **🔄 Superseded (2026-09-26):** the runtime search converged on **fal.ai as the platform** — every candidate below was evaluated there instead (Stability/OpenAI/OpenArt/Leonardo were never re-checked; ADR-001 already locks *hosted day one*). See the spike results immediately below.

### 🧪 Experiment Plan (Cheap & Fast) — ✅ EXECUTED 2026-09-26

1. **Pick 10 test objects** (watch, car, house, phone, handbag, gold bar, etc.)
2. **Run each through 2-3 candidate approaches** with the same joss paper style prompt
3. **Score results** on: recognisability, cultural appropriateness, consistency, speed, cost
4. **Show poll to target users** (family members, 40-50s) - which looks "right"?
5. Only then commit to an approach for the MVP

### 📌 Open Questions

1. Per-image cost - what's sustainable given advertising-only MVP revenue?
2. Latency budget - is 3s acceptable? 5s? 10s?
3. Style consistency - how do we stop a "cartoon car" looking wildly different from a "cartoon watch"?
4. Moderation - what if users photograph something inappropriate? (need content filter)
5. Offline - cache popular items? Batch processing?

### 📊 Spike results (2026-09-26) — how the questions above were answered

**Scope:** 15 licence-clean test images ([[../spike/test-images/MANIFEST|MANIFEST]]) · **133 runs ≈ US$4.49** of the approved US$20 cap · full write-up `spike/results/RESULTS.md` · scorecard `spike/results/path-C/EVALUATION.md`.

| Endpoint (fal.ai) | Role | Cost/image | Latency (p50 / p90) | Verdict |
|---|---|---|---|---|
| `bytedance/seedream/v4.5/edit` | stylizer | $0.040 | **34.2s / 54.6s** | 🏆 Tier-1 fidelity winner — **rejected on latency** |
| `nano-banana-2/edit` + `nano-banana-2` **t2i** | stylizer | $0.080 | 11.8s / 21.6s (edit) · 11.5s (t2i) | ✅ **chosen stylizer** (ADR-002) |
| `flux-pro/kontext` | stylizer | $0.040 | 9.8s | ❌ fidelity below D |
| `image-editing/cartoonify` / `cartoonify` (3D) | stylizer | $0.040 / $0.100 | 11.7s / 10.7–58.4s ⚠️ | ❌ high variance, not D |
| **`birefnet/v2`** | **background removal** | ≈$0.0015/img (0.0008/compute-s) | 1.0s | ✅ stage ① + post-stylize re-cut in the *edit* path — **dropped under Path C** (clean by construction) |
| `moondream2/visual-query` | identify | $0.01/query | 1.1s | ✅ **chosen stage ①** — must be **closed-set** (Track B: zero-shot called joss paper "packaged snacks") |
| `hunyuan-3d` (geometry) | image→3D | $0.015/mesh | minutes | ❌ reserve only (Path B) |

**Decision → [[ADRs/ADR-002-path-c-describe-then-generate|ADR-002]] ✅ Accepted (2026-09-26):** **Path C — describe-then-generate** = `moondream2` identify → `nano-banana-2` t2i from the normative style-D template. **≈ US$0.09/picture steady-state (≤$0.13 with retries) · p50 ≈ 13s · clean background by construction** — the pipeline makes **no background-removal call at all**; the edit path (incl. birefnet) is retained as the documented fallback. Scorecard: **13/13 pass** after the correction loop (3/13 needed ≥1 targeted retry).

### ✅ Open questions — answered

1. **Per-image cost** → **≈ US$0.09** steady-state / ≤$0.13 worst-case (ADR-002 §5) ≈ **$90 per 1,000 captures** — the measured input to the economy/quota model (**SCRUM-18** ✅ Done).
2. **Latency budget** → measured **p50 ≈ 13s** (1.1s identify + 11.5s generate), above the 3–10s assumption → accepted as a **loading-ritual wait**; seedream's 34s/54.6s killed the cheaper option.
3. **Style consistency** → the **v3 template is normative** (source-exact colours · top-down lighting · transparent glass · no ground shadow · coarse low-poly + one ink weight) + the **mandatory closed-set catalogue short-circuit** (Track B) for culturally specific store offerings.
4. **Moderation** → **provider-side gate before stylization**: `captures.status: pending → styled | rejected` (**S5** in doc 12 · posture in doc 13 §6); a rejected capture generates nothing and is purged inside the 7-day raw-photo window.
5. **Offline** → **queue + idempotent replay**, not a cached pipeline: captures persist in local SQLite and replay on reconnect (doc 14 **N6** / 07 §7 Q1); shrine browse assets cached inside the 64 MB cache ceiling (**N8**).

---

## 🧮 Holistic Value Summary

### Recommended Stack (Draft)

| Need | Recommended | Cost | Why |
|------|-------------|------|-----|
| UI design & wireframes | **Penpot (free)** | $0 | Open-source, MCP-wired into our AI workflow, SVG/CSS-native hand-off |
| Quick assets & marketing | **Canva Free/Pro** | Free → low monthly | Fast, templates, easy for non-designers |
| Style exploration (moodboards) | **Canva AI / Adobe Firefly / OpenArt** | Bundled / free credits | Test style directions fast (Penpot carries no built-in image gen) |
| Runtime cartoonization | **Path C — `moondream2` → `nano-banana-2` t2i on fal.ai** ([[ADRs/ADR-002-path-c-describe-then-generate\|ADR-002]]) | **≈ US$0.09/picture** | Measured in the spike: holds style D, clean background by construction, p50 ≈ 13s |

### Budget-Friendly Path (Hobby Project)
1. **Now**: Penpot (free cloud or self-host) + its free MCP server + Canva free + free AI credits → complete design phase for **$0**
2. **Design validation**: Use OpenArt free daily credits / GPT image gen for style tests
3. **MVP build**: Add one paid API only (runtime cartoonization) - keep it minimal
4. **Later**: Upgrade Penpot (Unlimited) only if storage/version-history binds; add a self-hosted model if volume justifies

---

## 🔍 Research Tasks

- [x] Confirm Figma pricing & AI capabilities (2026-09-23) — ⤳ superseded
- [x] **Switch design tooling to Penpot** + confirm pricing & MCP server (2026-09-24) — Figma dropped over MCP issues; Penpot's MCP server is official, free and local-first
- [x] Identify major provider categories (design-time vs runtime)
- [x] List candidate runtime providers (Stability, OpenAI, OpenArt, Leonardo)
- [x] Manually check Leonardo AI & Midjourney (sites blocked automated access)
- [x] Run style experiment: 10 objects × 3 approaches
- [x] Get real per-image API pricing quotes (Stability, OpenAI, OpenArt)
- [x] Decide runtime approach for MVP
- [x] Define image moderation strategy

---

## 📚 Reference Links

- Penpot: https://penpot.app/ · Pricing: https://penpot.app/pricing · MCP server: https://penpot.app/ai/mcp-server
- Stability AI: https://www.stability.ai/
- OpenAI Images API: https://platform.openai.com/docs/guides/images
- OpenArt: https://www.openart.ai/
- Canva AI: https://www.canva.com/
- Adobe Firefly: https://www.adobe.com/products/firefly.html

---

*Last updated: 2026-10-02 — **SCRUM-7 closed**: runtime experiment executed (2026-09-26, 133 runs ≈ US$4.49) → decision recorded in [[ADRs/ADR-002-path-c-describe-then-generate|ADR-002]] (Path C) and all five open questions answered above.*
*Previous: 2026-09-24 — design tooling switched Figma → Penpot (Session 9; Figma's MCP integration issues)*

