# Standard-item art — regenerated in the pipeline's own style

> ⚠️ **The finding (owner, 2026-11-01):** *"the standard items' Art Style is not consistent with the
> art generated thru the pipeline."*

**Confirmed.** The five standard items were **hand-ported from Penpot** (`art · Cash Bundle` /
`Gold Bar` / `Phone` / `House` / `wealth bundle (ingots)`, 82 shapes) — flat fills, hard outlines.
A styled capture comes out of **Path C** as a **very coarse low-poly 3D cartoon**. Two visual
languages on one screen.

---

# ✅ CHOSEN — all five picked by the owner, 2026-11-01

> **gold-bar-v1 · house-v2 · joss-paper-stack-v1 · smartphone-v1 · wealth-bundle-v1**

| item | chosen | rejected |
|---|---|---|
| Joss Paper Stack | **v1** | v2 |
| Gold Bar | **v1** | v2 |
| Smartphone | **v1** | v2 |
| House | **v2** | v1 |
| Wealth Bundle | **v1** | v2 |

⚠️ **The rejected variants are kept**, not deleted — they are the comparison the choice was made
against, and a future style change will want them.

⚠️ **Nothing is wired into the app yet.** See *Once you pick* at the foot of this note.

---

## 1 · Joss Paper Stack — ✅ **variant 1 CHOSEN**

| Variant 1 — **CHOSEN** | Variant 2 |
|---|---|
| ![[joss-paper-stack-v1.png]] | ![[joss-paper-stack-v2.png]] |

## 2 · Gold Bar — ⏳ awaiting your pick

| Variant 1 | Variant 2 |
|---|---|
| ![[gold-bar-v1.png]] | ![[gold-bar-v2.png]] |

## 3 · Smartphone — ⏳ awaiting your pick

| Variant 1 | Variant 2 |
|---|---|
| ![[smartphone-v1.png]] | ![[smartphone-v2.png]] |

## 4 · House — ⏳ awaiting your pick

| Variant 1 | Variant 2 |
|---|---|
| ![[house-v1.png]] | ![[house-v2.png]] |

## 5 · Wealth Bundle — ⏳ awaiting your pick

| Variant 1 | Variant 2 |
|---|---|
| ![[wealth-bundle-v1.png]] | ![[wealth-bundle-v2.png]] |

---

## How these were made

| | |
|---|---|
| model | **`fal-ai/nano-banana-2`** — the same endpoint `_shared/pathc.ts:366` calls |
| prompt | the pipeline's own `STYLE_TEMPLATE_V3`, verbatim |
| size | 1024 × 1024 PNG |
| jobs | `01a19646-16f3…` (Gold Bar) · `…-1733…` (Smartphone) · `…-1734…` (House) · `…-1730…` (Wealth Bundle) · `01a19632-9fa0…` (Joss Paper Stack) |

### The `Subject:` line used for each

| code | subject |
|---|---|
| `joss_paper_stack` | a stack of Chinese joss paper (spirit money), gold and cinnabar red |
| `gold_bar` | a single gold ingot (a Chinese gold bar), gold with darker gold facets |
| `smartphone` | a modern smartphone, dark charcoal body, azurite blue screen |
| `house` | a small traditional Chinese house, cream walls, dark grey tiled roof, azurite blue windows, cinnabar red door |
| `wealth_bundle` | a group of four Chinese offerings arranged together — a stack of joss paper, a gold ingot, a modern smartphone, and a small traditional house |

⚠️ **TEXT-TO-IMAGE, and that matters.** The template's `colourLock` clause says *"keep the subject's
own colours exactly as in the source image"* — and here there **was no source image**, so the model
interpreted each subject fresh. ⚠️ **Image-to-image is the honest comparison**: feed the existing
Penpot illustration as the source and let the template restyle it. That is what the pipeline actually
does to a photo.

## The style, verbatim from the codebase

`supabase/functions/_shared/pathtemplate.ts` → `STYLE_TEMPLATE_V3` (11 clauses).
`stylePrompt(subject)` joins them as
`Subject: <label> (colours exactly: <colours>). <base> <ink> <matte> <lighting> <colourLock> <glass> <noGroundShadow> <background> <structure> <detail> <output>`.

| key | clause |
|---|---|
| **base** | Render this as a VERY COARSE low-poly 3D cartoon: flat faceted surfaces with no more than 40 to 60 large flat polygon facets in total for the whole object — big folded-paper planes, deliberately minimal and chunky, not detailed and not finely triangulated. |
| **ink** | Single consistent ink outline weight around the silhouette and major part boundaries. |
| **matte** | The surface must be completely matte: no specular highlights, no glossy or mirror-like reflections, no lens flare and no bloom — lighting reads only as flat per-facet shading. |
| **lighting** | Light comes from directly above: top facets bright, side facets mid-tone, undersides dark. |
| **colourLock** | Keep the subject's own colours exactly as in the source image — do not recolour, re-tint or stylise them. The limited palette of cinnabar red, gold, azurite blue and malachite green applies only to shading accents and to the background. |
| **glass** | Any glass or windows must read transparent and see-through — not blacked out, not tinted and not reflective. |
| **noGroundShadow** | Do not draw a ground shadow or a contact shadow: the app adds its own. |
| **background** | Place the object on a plain, blank, warm rice-paper background, fully isolated — no scene, no props, no floor, no horizon. |
| **structure** | Keep every part separate and complete: nothing merges, vanishes or is redrawn, and each limb or part stays distinct. |
| **detail** | Any accessories and any printed text stay sharp and unchanged. |
| **output** | One object only, centred, whole, clean silhouette, no text overlay, no watermark, no borders. |

---

## ⚠️ Once you pick — what happens next

Choosing is **not** the same as shipping. The app draws the Penpot vectors today via
`components/offering-art.tsx`, and replacing them means either:

1. **Re-drawing the picked images as `react-native-svg`** — the project's established pattern
   (`fire-art.tsx`, `altar-halo.tsx`), so the art scales cleanly and stays a code-owned asset; or
2. **Slicing the PNGs to transparent cut-outs and bundling them as images** — faster, but the app
   then carries ~1 MB rasters and they cannot be recoloured.

⚠️ Option 1 is more work and more faithful to how every other illustration in this app is built.

## Where the files live

- **Repo:** `design-system/standard-item-art/` (committed with the branch)
- **Vault:** `Projects/JossPaperAR/design-system/standard-item-art/` (this folder)

## Cost

⚠️ **~US$0.32** for the four-item sweep (8 images), plus **~US$0.08** for the Joss Paper Stack pair —
**≈ US$0.40 total**, an **estimate at a published per-image rate, not a reconciled invoice line**.
Recorded in `project-costs.md`.
