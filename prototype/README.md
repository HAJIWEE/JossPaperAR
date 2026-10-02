# 📱 Prototype — "Feel the App" (v4)

> Exploratory clickable mockup of the Joss Paper AR core loop.
> **NOT production code** — a "paper prototype" to react to, iterate on, and validate the style.
> Built: 2026-09-24 (v1 Session 3) · **Iterated: 2026-09-24 (v2 Session 4, on review feedback)** · v3 Session 7 (the shrine the user builds) · **v4 Session 8 (the throw has aim)** · JIRA: SCRUM-6 (style) + SCRUM-9 (flow)

> [!warning] ⚰️ RETIRED — 2026-09-28. This prototype has served its purpose.
> **Penpot is now the single design source of truth** (PM decision). Do **not** build from this folder, and do not treat `styles.css` as a stylesheet to migrate — it is a historical record of how the flow and the style were validated.
> During the accessibility pass its palette was sampled and **11 of 19 real colour pairings failed WCAG AA**. That is evidence the defect lives in the locked SCRUM-6 palette, not in this mockup — which is why the fix belongs in Penpot, once, rather than here.
> The verified replacement tokens live **outside** this folder, in `design-system/tokens.css`, guarded by `design-system/contrast-check.js` (**20/20 checks pass**).
> To see the patterns the real build must not repeat: `node design-system/contrast-check.js --only=lint --css=prototype/styles.css` → 32 historical violations.

---

## ▶️ How to Open

- **Simplest**: double-click `index.html` (opens in any modern browser).
- Or serve locally: `python3 -m http.server` inside this folder → open http://localhost:8000
- Desktop recommended for review. Use the screen-jump chips at the top to move between screens, or press keys `1–6`.

## 🖱️ What's Clickable

| Screen | Interaction |
|--------|-------------|
| ① Home / Shrine | **Your shrine — empty at first.** Tap the gold **＋** → a sheet asks for the ancestor's details (姓氏 required · 名字 optional · 称谓 chips) → **their name is painted onto a new tablet** on the altar. Tap a tablet to edit or remove it; the altar holds 4. · "Make an Offering" → Capture · mini-league card → League · tabs (Profile shows a toast) |
| ② Capture | Shutter button → flash → auto-advance to Transform (viewfinder frames *your* car + "Object detected" chip) |
| ③ Transform | "Transforming…" plays ~2.3s, then the before/after slider is draggable (PHOTO ↔ JOSS STYLE) · Retry replays |
| ④ Burn Ritual | **Drag the offering up and release** (or tap the hint) — **where you release is the aim**: the car arcs to the fire and the band it lands in sets the pay — 正中 (the fire's heart) ×2.0 · 虔誠 (inside the flame) ×1.5 · 擦邊 (out on the coals) ×1.0 · 偏失 (past the pit) ×0. A good throw flares the fire; a graze only smolders. Score pop → Reward |
| ⑤ Reward | Points count up, breakdown rows reveal in sequence |
| ⑥ Leaderboard | **Live** Tribute League: your rank is real — a throw banks what it earned (1,650 dead centre · 1,250 inside the flame · 850 on the coals · nothing for a miss) into the board and the home total, and the list re-ranks (promotion line follows the top 3) |

## 🔁 Review Feedback Applied (Session 4 · 2026-09-24)

| Feedback | Change |
|----------|--------|
| "The vase lost the shape of a vase — too simple. Replace it with a car." | The offering is now a **car** everywhere: capture viewfinder (photo), Transform before/after, and the held object in Burn. The silhouette was re-proportioned to a real car ratio (~2.1 : 1 length : height) so it reads instantly. |
| "Home is missing ancestral tablets behind the shrine — that's the point. We need an altar to host tablets, and to be able to add more." | Home has a **two-tier ancestral altar**: gold niche frame, 3 tablets (陈 · 祖 · 宗) on the raised shelf, a **＋ slot that adds / removes a tablet** (tappable, so the "add" affordance is demoable), incense table + censer + rising smoke in front, and a caption: "Ancestral altar · 祖先牌位 — tap ＋ to add a tablet". *(Superseded in Session 7 — the altar now ships empty and the user builds it with their own ancestors' names; see below.)* |
| "Object identity should be the user's actual object, cartoonized." | Confirmed and made explicit: the Capture viewfinder frames *your* car ("✦ Object detected"), and Transform shows the same object as photo → joss-style. |
| "The swipe flies over the fire — it must curve and land in the fire itself." | The throw is now a ballistic arc (`tossArc` keyframes): up-right → apex beside the flame → curves back → **lands inside the flame** at ~640 ms, where the flare fires and the object is consumed (fades out in the flame core). A dotted gold arc (`#throwGuide`) previews the trajectory, and the hint copy reads "Swipe up — into the fire · 抛入火中". |

## 🔁 Review Feedback Applied (Session 7 · 2026-09-24)

| Feedback | Change |
|----------|--------|
| "The tablets should display text that is user-inputted, which is the names of the ancestors. We should start the altar with nothing then have the user build out their own shrine by inputting their ancestor details." | The altar **ships empty** — `#altarTablets` is an empty layer and the sample 陈 · 祖 · 宗 trio is gone. The **＋** slot opens an **ancestor sheet**: 姓氏 (required, 1–2 characters), 名字 (optional), 称谓 chips (祖父 · 祖母 · 父亲 · 母亲), and a **live tablet preview** drawn by the same builder that paints the altar, so the preview cannot lie about what will be placed. A committed tablet reads **姓＋名** (up to 3 stacked characters) or **姓＋氏** — the traditional short form — when no given name is known. The shelf holds **4**: the row is centred on the niche and grows outward from the middle, the ＋ follows it, and it disappears when the altar is full. Tapping a placed tablet reopens the same sheet to edit or remove it. |

Three faults were caught by *looking at the rendered screens* rather than the markup, and all three are now guarded:

- the ＋ slot was positioned twice — authored `translate` **and** `renderAltar()` — so the ghost sat off the shelf (now the markup carries no transform and the app owns it);
- the character baselines were set in **altar** coordinates instead of the tablet's own space, so every name painted below the viewBox and vanished. `tools/render-check.js` now fills the shrine, finds each tablet by pixels and counts the character ink inside the gold frame — if a typed name does not paint, the check fails.
- **the censer ate the taps.** The three incense sticks and their embers are painted *after* the tablets and the ＋ slot, and SVG's default `pointer-events` makes every painted pixel a target — so on a fresh altar they sat exactly where the ＋ is (which was painted *behind* them: invisible as well as untappable), and with four tablets enshrined they sat on the middle tablets' faces. The shrine's scenery is now inert (`pointer-events="none"`: niche, both tiers, censer, sticks, embers, smoke), the ＋ slot paints **last**, and the ＋ was lifted into clear air (y −71…−53, above the sticks) with its pulse floor raised .5 → .75. Guarded from both ends: the validator reads the mark's path and the sticks' paths and asserts the mark clears them, and `render-check.js` asks the live DOM `elementFromPoint` at the ＋, at a tablet the incense crosses and at the CTA — a dispatched click cannot see this, because it is delivered with hit-testing bypassed.

## 🔁 Review Feedback Applied (Session 8 · 2026-09-24)

> *"Add real aim (and the ability to miss) to the throw, with a score multiplier based on how accurate it is."*

Until this session the toss always landed in the fire — the gesture was a yes/no, not a skill. Now **where you release is the aim**:

| Band | Aimed at | Paid |
|------|----------|------|
| 正中 | the fire's heart (±14.55 units) | **×2.0** → 1,650 |
| 虔誠 | just inside the flame (±39.40) | **×1.5** → 1,250 |
| 擦邊 | out on the coals (±96.97 — the ember bed's edge) | **×1.0** → 850 |
| 偏失 | past the pit | **×0** → 0 |

The figures are **measured off the fire's own artwork at runtime**, not authored: `app.js` finds the widest line of the outer flame (its mouth), converts that one measurement into the guide's 390×844 units, and paints the sight, the ladder, the dotted guide and the flight from it. The fire answers in kind — a flare for 正中/虔誠, only a smolder for 擦邊, nothing at all for a miss — and the ladder is spelled out under the fire: *Aim for the fire's heart · 瞄準火心 — 正中 ×2.0 · 虔誠 ×1.5 · 擦邊 ×1.0 · 偏失 ×0*.

**Two bugs had made two bands unreachable, and both had shipped past the markup validator *and* the render check:**

1. **A band measured as zero.** The flame's sides taper to a point, so a scanline just below the drawing finds no width at all — 正中 became a target only a throw dead-centre to the sub-pixel could hit.
2. **A measurement in the wrong space.** `styles.css` scales the whole phone down on short windows, so the screen's CSS pixels and the guide's units are *not* the same size; the app converted and then multiplied again, which put the mouth line below the artwork and zeroed the same two bands.

Both are the class of fault that only a *behavioural* check can see, so there is a new tool for it — `tools/aim-check.js`, described in **Files** below. It is fault-tested: sabotaging the pay constant turns exactly the three paying throws red (a miss still pays 0) and the run exits 1.

## 🎚 Car Fidelity A/B/C/D — `fidelity-test.html` (Session 6 · rebuilt in orthographic 3D)

Open **`fidelity-test.html`** (or the 🎚 chip on the prototype header). This isolates the one variable the Session-4
vase rejection exposed: **how much of the real shape must survive cartoonization?**

Since Session 6 the car is no longer hand-drawn SVG. It is a **low-poly 3D mesh** (side profile + cross-section rings,
wheel arches cut as real openings, wheels as flat discs set inside them) projected through a fixed **orthographic
camera** — yaw −36°, pitch 15°, no perspective term anywhere — then back-face culled, depth-sorted (painter's
algorithm) and flat-shaded into SVG by `prototype/tools/gen-car-3d.js`. The reference photo is a **smooth render of
that same mesh through that same camera**: gradient paint that mirrors sky and horizon, gradient glass, rubber,
a chrome grille, a contact shadow, a defocused backdrop and a grain layer. So the photo and the cartoons are one car
by construction rather than by eye.

Every variant is that **one mesh**, simplified to a different Douglas-Peucker tolerance:

| Variant | Facets (body+wheel) | Profile · drift | Outline | Character | Risk |
|---------|--------------------|-----------------|---------|-----------|------|
| **photo · reference** | 88 (78+10) | 30 · 0.4 | — | smooth render, same mesh, same camera — what the phone actually hands us | — |
| **A · High fidelity** | 56 (48+8) | 28 · 0.8 | 2.5 | round wheel arches, chamfered panels + specular strips, grille with two chrome bars, B-pillar, hub bolts | most like a 3D render — may lose the hand-made joss-paper feel |
| **B · Low-poly (current build)** | 37 (31+6) | 18 · 2.7 | 4 | arches straighten into cuts, chamfers carry the shading, wheels drop to 8-gons, no chrome bars or bolts | the middle: maybe not detailed enough to be *your* car, not bold enough to feel like paper |
| **C · Bold joss-paper** | 19 (13+6) | 16 · 5.6 | 7 | no cross-section rings at all (one flat slab swept once), no grille/bars/pillar, budget spent on 16-gon round tyres | closest to the vase failure mode — may read as *a* car, not *your* car |
| **D · Hybrid — B's body + C's wheels** ✅ | 37 (31+6) | 18 · 2.7 | 4 | **the pick.** B's body kept face-for-face, C's 16-gon discs and hubs swapped in | round disc inside B's angular arch; needs a per-region pipeline rule |

**Every wheel count is 4 + 2:** the near pair is modelled properly (tyre + hub, plus a sidewall and bolts at higher
fidelity) and the **far pair is one disc each** — because only the far wheel's *inner* face is ever on show, seen
through the near arch tunnel and as a sliver below the far rocker. The far pair is drawn *behind* the body, so the
body occludes it everywhere except where the panel genuinely opens. A 3/4 view has four wheel positions; modelling
two made the car read as a cut-out, which is exactly what the first review of this page caught.

**Facets** = polygons actually rendered after back-face culling (the contact shadow and the photo's backdrop/glints/grain
are tagged non-faces and excluded), split geometrically into `body + wheel` by distance to the projected wheel centres.
**Profile** = vertices in the simplified side outline; **drift** = the worst gap between that outline and the dense one,
in model units (the car is 252 long and 122 tall, so 2.7 ≈ a tyre's tread depth). Verify with:

```bash
node prototype/tools/validate-fidelity.js   # 144 checks: markup, badges, the wheels, the port, the aim, freshness
node prototype/tools/gen-car-3d.js --check  # fails if either page drifts from the generator
node prototype/tools/render-check.js        # a real browser: does it actually draw? (--only=capture|transform|burn|shrine)
node prototype/tools/aim-check.js           # what does the fire pay for a throw? four throws, the bands re-derived (--keep)
```

The validator decides body-vs-wheel **geometrically** and asserts that **D's body faces are B's, verbatim and in order**,
so the "kept face-for-face" claim is machine-checked rather than asserted in prose.

### ✅ Session-5 answer (unchanged, now expressed in mesh terms)

The user's instruction was *"the body of B but the wheels of C"* — a **mix**, not a level. In the 3D build that means
**D spends exactly B's 37 faces** and only raises the wheel segment count (8-gon → 16-gon, so vertex count goes
182 → 226). Nothing got more detailed; the **shape language** changed — round where it buys legibility (wheels),
faceted where it carries identity (body).

Two notes carried over:
- **Metric:** facets are now counted after culling, so the numbers moved (A 54 · B 35 · C 17 · D 35, all recomputed from
  the generated markup). The ordering that matters is unchanged: **A > B > C** on faces and vertices, and D = B on faces.
- **Wheel line weight:** the discs ship at B's outline weight (4), not C's 7, so one line weight runs across the whole
  car. Still a one-word change if you want it bolder.

This is now the target for the **first real AI cartoonization experiment** (SCRUM-6 follow-up).

### 🖼 The screens: generated offering, photographed object (Session 6 · port)

`index.html` no longer carries its own hand-drawn car, and it no longer fakes reality either. The split is now:

| Stage | Shows | Why |
|-------|-------|-----|
| ② capture · viewfinder | **the photograph** `assets/car-real.jpg` | a camera shows the real object — not a render of the mesh |
| ③ transform · left (PHOTO) | **the same photograph**, `assets/car-real-panel.jpg` | it is what the app received — and it has to be *to scale* with what is beside it |
| ③ transform · right (JOSS STYLE) | `#carD` — generated | what it becomes, at the locked fidelity |
| ④ burn · held offering | `#carD` — generated | the object you toss |

The two *offering* stages are marked `data-car-stage` and the generator owns **both** their `viewBox` and the `<use>`
they point at — the artwork inside them is not hand-editable, by construction. The two *photo* panels are plain divs
with no markup inside at all: their content is the photograph, applied in `styles.css` (the viewfinder uses the wide
crop as a `cover` background; the comparator's "before" half shows `car-real-panel.jpg` whole — `contain`, no blur,
no zoom). The photograph is the only third-party asset in the repo — source, licence and a swap-out note live in
**`assets/CREDITS.md`**, and it should be replaced with a photo of the family's own car before this is shown to anyone.

**Keeping the before/after pair to scale** (Session 6 review note — "the before is blur and zoomed in"):

- `car-real-panel.jpg` is the photograph **padded to the cartoon stage's exact aspect** (243 : 177.1 = 1.372), so
  `contain` lands it in the same on-screen band the D stage occupies: same width, same centre, no crop, no blur.
- The offering is additionally drawn at **85 %** in that one stage (`STAGES['transform-after'].zoom = 1.18` in the
  generator expands the stage's viewBox about its centre). Reason: the orthographic camera sees the roof, while the
  photo is a low-angle shot — at zoom 1 the offering read ~1.4× the photo's area. The zoom equalises area; the two
  cars' *widths* are within 3 % of each other (97 % vs 94 % of their band).

Known limitation, stated plainly: the photo is a *different car* from the mesh, so the wipe compares a real car against
D's silhouette rather than a shape-locked pair — **and** the two silhouettes differ in height (the photo's car is
~63 % of its frame's height, the offering's ~92 %), which no amount of scaling removes. That is the gap the first real
cartoonization experiment (SCRUM-6) exists to close; the fidelity page keeps the shape-locked photo→cartoon pair for
exactly that reason.

**Three rendering bugs surfaced by building this — all invisible to markup checks:**

1. **`fill="#NaNNaN10"`** — the grille material had no palette entry, so `tone()` produced NaN and the browser dropped
   the invalid fill: variants A/B/D each had a small **black hole** where the grille should be. Fixed by giving the
   grille a colour (`#2B3339`, matching the photo renderer).
2. **The generated block was commented out.** The `BEGIN` marker was emitted as `<!-- BEGIN … —` with no closing `-->`,
   so the entire block sat inside an HTML comment: every `<use>` resolved to nothing and **every stage rendered empty**
   — while the validator passed 79/79, because all the markup was still there. Fixed, and now covered twice: the
   validator asserts the block is *live markup*, and `tools/render-check.js` screenshots the real screens and measures
   whether the car is drawn.
3. **Only two wheels per car.** The mesh modelled the near-side pair, so a 3/4 view showed two wheel positions instead
   of four and read as a cut-out. The far pair is now in the mesh as one disc each (its inner face is all you can see),
   drawn *behind* the body. Facet counts rose 35 → 37 for B/D and the badges, copy and README were updated to match;
   the validator now asserts **discs at all four published wheel positions** and **four tyres per car**, and the
   geometric body/wheel split was re-founded on *roundness* (a wheel face must be a disc) because distance-to-wheel-centre
   stopped being sufficient once the far wheels projected onto the middle of the car.

## 🎨 Locked Style (SCRUM-6)

**Low-poly 3D × Traditional Ink Brush cartoon** — angular facets + ink-black outlines + traditional palette:

| Token | Hex | Use |
|-------|-----|-----|
| Cinnabar | `#C23B22` | Primary accent, fire |
| Gold Leaf | `#D4AF37` | Highlights, rewards |
| Azurite | `#4A6FA5` | Offering object facets |
| Malachite | `#0E9B78` | League / progression |
| Ink Black | `#1A1A1A` | Outlines, text |
| Rice Paper | `#F5F0E8` | Backgrounds |

## 🧪 What's Simulated

- AI cartoonization (the reference photo and the low-poly variants are all generated from one 3D mesh by `tools/gen-car-3d.js` — no API call)
- Camera views (CSS gradients, not real camera)
- Scoring backend (the breakdown follows the aim: base 400 × the band's 2.0 / 1.5 / 1.0 → × new-ground 2.0 + streak 50 = **1,650 / 1,250 / 850**, and a miss pays nothing) — **the total is banked**:
  `app.js` adds it to `state.points`, updates the home total and re-ranks the league; only the server side is missing
- The shrine's ancestor names — typed into the sheet, held in memory for the session (`state.ancestors`, no persistence yet, so a reload is a fresh empty altar by design)
- Nothing else about the shrine: the tablet art, the stacking of 1–3 characters, the centred row and the 4-tablet cap are all real code, not a mock

## 📌 Decisions to Review Together

1. ~~🎚 Pick a fidelity level: A, B or C~~ → **answered (Session 5): variant D** — B's body with C's wheels. Session 6
   rebuilt the whole test in orthographic 3D (one real mesh + a photoreal reference), so D is now specified as
   *B's mesh tolerance with C's wheel segment count*, machine-checked. Remaining blocker: running the first real
   cartoonization experiment against that target (SCRUM-6)
2. Home screen: meditative shrine vs festive celebration — the altar + tablets push it toward **ancestral/reverent**; still open (lanterns currently add warmth)
3. ~~Keep the user's real object identity vs generic luxury items?~~ → **Resolved (Session 4): the user's actual object, cartoonized** (photo → joss style)
4. Simple enough for a 40–50s user? (text sizes, touch targets, gestures)
5. **Altar tablets** → **built (Session 7), for review**: naming is 姓氏 + 名字 (falling back to 姓＋氏), with a 称谓 chip, and **4 tablets per altar**. Still to confirm: whether a family wants more than 4, and whether individual given names or a single family-line tablet (「陈氏」) is the more common want — the sheet supports the second today by leaving 名字 empty
6. **Aim: how generous should a throw be?** Session 8 measured the bands off the fire's own artwork (正中 ±14.55 · 虔誠 ±39.40 · 擦邊 ±96.97 units) and a miss pays **nothing**. Worth confirming: are those widths kind enough for 40–50s hands (the middle band alone is only ~29 units of a 390-unit screen), and should a complete miss really pay 0, or a small consolation?

## 📁 Files

- `index.html` — all 6 screens. The **2 offering stages are generated** (they carry `data-car-stage`; the generator owns
  their `viewBox` and their `<use>` target). The viewfinder and the comparator's "before" half are **photo panels** with
  no markup inside — the photograph comes from `styles.css`. Header reads **v3 · Session 7**
- `assets/car-real.jpg` + `assets/car-real-panel.jpg` + `assets/CREDITS.md` — the photograph the camera shows, and the
  same photo padded to the stage aspect for the compare panel (the only third-party files in the repo; source, licence,
  the padding recipe and the swap-out note are recorded next to them)
- `fidelity-test.html` — car fidelity A/B/C/D (orthographic 3D; squint test + blink comparator). Its car geometry is
  **generated** — the shapes live in `tools/gen-car-3d.js`, between the `BEGIN/END GENERATED CARS` markers
- `tools/gen-car-3d.js` — the car generator: mesh → Douglas-Peucker simplification → orthographic projection →
  back-face cull → painter sort → flat shades / photo gradients. Writes **both** pages; `--check` fails if either is stale
- `tools/validate-fidelity.js` — **144 assertions**: badges vs the SVG actually in the page (incl. D = B's body verbatim),
  the port's stage→variant contract, valid paint values, that the generated block is live markup, that the league score is
  real, and that **no ancestor is authored into the shrine** — the tablet text can only come from the user's input, the
  tablet row still fits the shelf the SVG actually draws, and nothing the altar draws as scenery can swallow a tap (the
  ＋'s mark is asserted clear of the incense, numbers read from the two paths themselves), plus the **aim section** — the four bands `app.js` grades with must equal the fire `index.html` draws (measured from the polygons at the mouth line), the six sight ticks must stand on the pit/flame/heart, and the guide's tip and the dotted line must end on that same mouth line
- `tools/render-check.js` — the browser-level check, **20 assertions**: screenshots the screens and measures that the offering
  is drawn and fits inside its stage (catches "the markup is fine but nothing renders"), fills the shrine to measure that a
  typed ancestor name really paints onto the tablet, and asks the live DOM `elementFromPoint` what is actually under the
  finger — at the ＋, at a tablet the incense crosses, and at the Make an Offering button (`--only=shrine`; the tap probe
  reports as green/red swatches in the window's corner, and a probe that never runs fails)
- `tools/aim-check.js` — the aim check, **16 assertions**: it copies the prototype, injects one script and plays **four
  throws** — dead centre, inside the flame, out on the coals, past the pit — reading back the grade, the award, the popup
  and the fire's reaction for each; re-derives the bands from `index.html`'s polygons with **its own scanline**; and checks
  the drawn target (six sight ticks on the pit/flame/heart, the guide's tip on the mouth line, and where a bullseye, a
  graze and a miss come to rest). Verdicts are green/red squares that `magick` reads back, closed by a **blue guard**
  square, so a probe that dies early cannot read as a pass — the tool exists because both band bugs shipped past the
  validator *and* the render check
- `styles.css` — design tokens + low-poly/ink-brush styling, and the ancestor sheet
- `app.js` — navigation, slider, throw interaction, reward animation, the live league, and the **shrine the user builds**
