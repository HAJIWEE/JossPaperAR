# 🖌️ 01 - Joss Paper Styles Research

> **JIRA**: SCRUM-6 | **Status**: 🔄 In Progress | **Started**: 2026-09-23
> **Goal**: Define the visual language of the app. The cartoonization style is the KEY technical priority - we must get this right.

---

## 🎯 Research Objective

Find and document existing joss paper designs, visual elements, and cartoon styles so we can define what our captured objects should transform into.

**The core question**: When a user photographs a souvenir, what should it *become* before it's thrown into the AR fire?

---

## 📖 Traditional Joss Paper - Key Facts

### What It Is
- Also known as **spirit money**, **incense paper** (金紙 / 阴司纸 / 纸钱)
- Papercrafts or sheets burned as offerings in **Chinese ancestral worship**
- Also used in Vietnamese (tiền vàng mã) and other Asian funeral traditions
- Purpose: ensure the deceased "has sufficient means in the afterlife"

### Historical Evolution (Our App's Context)
1. **Ancient Era**: Emperors/nobility buried *actual valuables* with the dead
2. **Common Practice**: Ordinary people burned *joss paper* as an abstract replacement (paper = money)
3. **Our App**: AR abstraction - the next step in the evolution 🚀

### Types of Joss Paper (Visual Reference)
| Type | Description | Visual Notes |
|------|-------------|--------------|
| **Traditional** | Crude bamboo paper, rough texture | Earthy, yellowed tones |
| **Hell Bank Notes** | Look like real currency (banknote style) | Colorful, printed, detailed borders |
| **Gold/Silver Paper** | Squares of gold & silver foil | Bright metallic, simple squares |
| **Contemporary** | Papier-mâché luxury goods (paper cars, phones, houses) | Miniature versions of real objects |
| **Ingot-shaped** | Folded into sycee (yuanbao) shapes | Distinctive boat/crescent shape |

---

## 🎨 Visual Language - LOCKED IN

### ✅ CHOSEN STYLE: Low-poly 3D + Traditional Ink Brush Cartoon

**Decision Date**: 2026-09-24 (Session 3)
**Rationale**: Combines geometric modernity with cultural heritage - bridges "paper" and "object" while maintaining respectful, elegant aesthetic.

### Color Palette (Low-poly 3D + Ink Brush)
| Color | Hex Code | Meaning | Usage |
|-------|----------|---------|-------|
| 🔴 **Cinnabar Red** | #C23B22 | Luck, joy, prosperity | Primary accent, fire elements |
| 🟡 **Gold Leaf** | #D4AF37 | Wealth, deity, afterlife currency | Highlights, borders, rewards |
| 🔵 **Azurite Blue** | #4A6FA5 | Sky, spiritual realm | Secondary accent, water elements |
| 🟢 **Malachite Green** | #0E9B78 | Nature, renewal | Tertiary accent, nature elements |
| ⚫ **Ink Black** | #1A1A1A | Calligraphy, depth | Outlines, text, shadows |
| ⚪ **Rice Paper White** | #F5F0E8 | Purity, background | Base backgrounds, paper texture |

### Geometric Style Notes
- **Low-poly 3D**: Angular, faceted surfaces with visible polygon edges
- **Ink brush textures**: Subtle gradients, brush stroke overlays, slight imperfections
- **Color application**: Flat colors with subtle shading (no smooth gradients)
- **Edges**: Bold ink-black outlines (2-3px) for clarity on AR overlay

### Common Motifs & Symbols
- [ ] Jade Emperor / deities on hell bank notes
- [ ] Dragon & phoenix patterns
- [ ] Chinese numerals & currency markings (e.g. "10,000 yuan")
- [ ] Cloud patterns (祥云)
- [ ] Yanluo Wang (King of Hell) imagery
- [ ] Sycee / yuanbao (gold ingot) shape

---

## 🖌️ Cartoonization Direction - IMPLEMENTATION PLAN

> ⚠️ **Cultural sensitivity note**: Must be respectful. This is ancestor veneration, not a joke.

### Technical Implementation Approach
1. **Low-poly 3D Geometry**: Mesh simplification + faceted shading
2. **Ink Brush Textures**: Procedural brush stroke overlays
3. **Color Palette**: Strict adherence to the 6-color palette above
4. **Outlines**: Bold ink-black strokes (2-3px) for AR readability
5. **Animation**: Subtle breathing/pulsing effect on cartoonized objects

### AI Tool Candidates
- Image-to-image style transfer (keep object recognisable)
- Background removal + paper texture overlay
- Custom LoRA / style model training

---

## 🔍 Research Tasks

### Phase 1: Gather References
- [x] Collect photos of traditional joss paper designs (gold/silver paper, hell notes)
- [x] Find modern cartoon/stylized joss paper illustrations
- [x] Research existing AR/virtual offering apps and their visual style
- [x] Document color palettes from real joss paper
- [x] Collect motif/symbol references

### Phase 2: Define Style ✅ COMPLETE
- [x] Generate test images with AI tools using each style option (A-E)
- [x] Review against cultural sensitivity checklist
- [x] **Pick 1 primary style + 1 backup** → Low-poly 3D + Ink Brush
- [x] Define the "paper transformation" visual effect
- [x] Create mood board

### Phase 3: Deliverables
- [x] Style guide (colors, textures, motifs, do's & don'ts) ✅
- [ ] Example: photo → joss paper cartoon transformation gallery
- [ ] Prompt library for the chosen AI tool

---

## 📌 Open Questions

1. Should the cartoonized object retain the user's *actual* object identity (their exact watch), or become a *generic luxury item* (a generic gold watch)?
2. How "paper-like" should the result look - obvious it's joss paper, or subtle?
3. Do we need multiple style tiers (cheap = simple, expensive = elaborate)?
4. How do we handle text/logos on photographed objects (e.g. brand names)?
5. Should burning animation match the joss paper aesthetic (paper curling, gold foil glinting)?

---

## 📚 Reference Links (To Fill In)

- [ ] Wikipedia: Joss paper - https://en.wikipedia.org/wiki/Joss_paper
- [ ] _(add more as we research)_

---

*Last updated: 2026-09-24 - Style locked, HTML prototype development started*
