/**
 * home-layout.ts — the PURE structure of the Home shrine (SCRUM-148 · SCRUM-160).
 *
 * ── WHY A MODULE AND NOT STYLE PROPS ────────────────────────────────────────
 * The same reason as `bookView` (SCRUM-122) and `PREPARING_COPY` (SCRUM-127):
 * **a structure nothing can read is a structure no gate can hold.** The team that
 * replaces the scaffold has to be able to assert *"the shrine is still a shrine"*
 * without a device, so the shape lives here as data and `src/app/index.tsx`
 * renders it.
 *
 * ── WHAT THIS FILE DELIBERATELY DOES *NOT* CONTAIN ──────────────────────────
 * ⚠️ **No absolute body bands — yet.** The signed-off Home's y-ranges (tribute ·
 * altar art · CTA) have to be read off the board before they can be frozen, and
 * the art itself does not exist in this repo (there is **no image asset at all** —
 * `assets/` holds icons only). Inventing numbers here and then asserting them
 * would freeze a guess, which is the exact failure `tokens.css`'s header records:
 * four of five hand-carried hexes were wrong and re-introduced the drift they were
 * meant to fix.
 *
 * ⚠️ So: `home-layout.ts` owns **the region list** (this ticket). The CTA/art band
 * numbers arrive with the art in **SCRUM-162**, and **SCRUM-163** freezes both and
 * adds the gate.
 *
 * ✅ **2026-10-31 — SCRUM-162 measured them, and the "944–1024" puzzle is solved.**
 * `clan-pill.ts`'s band list is not wrong: it is **page-absolute** (the board sits at
 * page `y 180`), while `HOME_BANDS` below is **board-relative**. Every figure
 * reconciles once converted — including the tab bar, `764 + 180 = 944`. Both frames
 * are now recorded, so nobody has to derive this a third time.
 *
 * ── THE ONE RULE THE ORDER ENCODES ──────────────────────────────────────────
 * ⚠️ **`cta` sits AFTER `altar` and BEFORE `footer`** — the offer is taken *at*
 * the altar, not from the chrome. S36 settled this by measurement: the header row
 * was the only empty rectangle on the signed-off Home, so the clan pill took it and
 * the CTA stayed down among the art. Reordering these regions is a design change,
 * not a refactor.
 */

import { DESIGN_REFERENCE_WIDTH } from '../theme/tokens.ts';

/**
 * The shrine's regions, in render order.
 *
 * ⚠️ `header` is the only region that is **not** inside the scroll view: it carries
 * the clan pill at a measured x (`PILL_X_ON_REFERENCE`), and scrolling it would
 * break that measurement. Every other region scrolls.
 *
 * ⚠️ Each region maps to a ticket, so a half-built shrine is legible rather than
 * mysterious: `totals` → SCRUM-161, `altar` → SCRUM-162 (+ the tablet sheet,
 * SCRUM-146), `cta` → SCRUM-162, `footer` → the shrine's entries (SCRUM-164).
 */
export const HOME_REGION_ORDER = ['header', 'totals', 'altar', 'cta', 'footer'] as const;

export type HomeRegion = (typeof HOME_REGION_ORDER)[number];

/**
 * The design reference the shrine is drawn at — re-exported so a consumer cannot
 * import a different width and quietly compare against the wrong canvas.
 */
export const REFERENCE_WIDTH = DESIGN_REFERENCE_WIDTH;

/**
 * The signed-off Home's bands, **measured from the board** — 2026-10-31.
 *
 * ⚠️ **BOARD-RELATIVE.** Read off `EN · 1 Home / Shrine` in Penpot (file
 * `JossPaperAR`), which sits at page `x 160, y 180`. Every number below is
 * `layer.y − board.y`, i.e. relative to the shrine's own top edge.
 *
 * ⚠️⚠️ **This is why `clan-pill.ts`'s band list looks wrong and is not.** Its
 * comment cites *"tribute/streak 280–328 · caption 332–350 · art 340–760 · CTA
 * 856–922 · tab bar 944–1024"* — and **844 − 180 = 664**, so a tab bar at 944 is
 * impossible on an 844-tall board. Those figures are **page-absolute**; subtract
 * the board's `y 180` and they agree with the table below exactly
 * (100+180 = 280 · 148+180 = 328 · 152+180 = 332 · 676+180 = 856 · 742+180 = 922 ·
 * 764+180 = **944** · 844+180 = **1024**). ⚠️ So do not "fix" that comment: it is
 * correct in its own frame. **Both frames are recorded here so nobody re-derives
 * this a third time.**
 *
 * ⚠️ What *was* a real error: SCRUM-160's brief said the tab bar ran 944–1024 in
 * board coordinates. It does not. This table is the corrected set.
 */
export const HOME_BANDS = {
  /** `icon · app mark (header)` — 15,49 53×53. */
  headerMark: { x: 15, y: 49, w: 53, h: 53 },
  /** `btn · settings` — 326,54 44×44. ⚠️ Its x is what `HEADER_SPEC` derives. */
  settings: { x: 326, y: 54, w: 44, h: 44 },
  /** `panel · tribute (bg)` — 20,100 230×48. */
  tribute: { x: 20, y: 100, w: 230, h: 48 },
  /** `panel · streak (bg)` — 258,100 112×48. */
  streak: { x: 258, y: 100, w: 112, h: 48 },
  /** `caption · altar state` — 20,152 350×18. */
  caption: { x: 20, y: 152, w: 350, h: 18 },
  /** `hint · cta` — 52,176 286×24. */
  hintCta: { x: 52, y: 176, w: 286, h: 24 },
  /** `art · altar halo (gradient)` — 18,160 354×420. */
  halo: { x: 18, y: 160, w: 354, h: 420 },
  /** `slot · ＋ add a tablet (tap)` — 131,285 129×307 (empty altar only). */
  addSlot: { x: 131, y: 285, w: 129, h: 307 },
  /** `nav · carousel prev` — 26,412 24×40. Only when there is more than one tablet. */
  carouselPrev: { x: 26, y: 412, w: 24, h: 40 },
  /** `nav · carousel next` — 340,412 24×40. */
  carouselNext: { x: 340, y: 412, w: 24, h: 40 },
  /** `zone · customizable temple (label)` — 28,214 224×22. */
  templeChip: { x: 28, y: 214, w: 224, h: 22 },
  /** `art · offerings (front)` — 30,434 330×170. */
  offerings: { x: 30, y: 434, w: 330, h: 170 },
  /** `art · shrine base (table)` — 16,588 358×76. */
  shrineBase: { x: 16, y: 588, w: 358, h: 76 },
  /** `btn · Make an Offering · 献供` — 20,676 350×66 (its shadow sits at y 680). */
  cta: { x: 20, y: 676, w: 350, h: 66 },
  /** `nav · tabbar (bg)` — 0,764 390×80. ⚠️ Four tabs: Shrine · League · Store · Profile. */
  tabbar: { x: 0, y: 764, w: 390, h: 80 },
} as const;

/**
 * The board's vertical origin on the page — the constant that converts this table
 * to `clan-pill.ts`'s absolute figures. Kept as a named value so the conversion is
 * arithmetic a reader can check, not a claim.
 */
export const BOARD_ORIGIN_Y = 180;

/**
 * The scale from the 390 px board to the real window.
 *
 * ⚠️ **MEASURED ON GLASS — 2026-10-31, POCO C81 Pro (`HN615L005386`): 720×1600 @
 * 320 dpi = **360 dp** wide.** Rendering `HOME_BANDS` unscaled put the shrine base's
 * right edge at `16 + 358 = 374` dp on a 360 dp screen — ⚠️ **14 dp off the side, and
 * the art was visibly clipped.** No gate could see it: every number was correct, in
 * the wrong frame. `clan-pill`'s fixed 236 had hidden the problem because a pill in a
 * row can overflow invisibly.
 *
 * ⚠️ So bands are **board px** and every consumer multiplies by this. A band must
 * never be pasted into a style as a raw number.
 */
/**
 * The scale the shrine is actually drawn at: **contain-fit, both axes**.
 *
 * ── WHY NOT WIDTH ALONE ─────────────────────────────────────────────────────
 * ⚠️ `homeScale(width)` was the first rule and it is **wrong for a tablet**. The
 * shrine is a portrait composition (390 × 844, ratio 2.16). Scale it by width alone on
 * an 800 × 1280 tablet and the canvas becomes **1732 tall** — the altar runs off the
 * bottom and the user must scroll a shrine that plainly fits. On a short screen it does
 * the opposite and overflows.
 *
 * ✅ **Contain-fit** takes the smaller of the two ratios, so the whole shrine is always
 * visible with no scrolling and nothing clipped:
 *   · phone 360 × 800  → `min(0.923, 0.948)` = **0.923** (width-limited, as before);
 *   · tablet 800 × 1280 → `min(2.051, 1.517)` = **1.517** (height-limited, centred);
 *   · small 320 × 568 → `min(0.821, 0.673)` = **0.673** (height-limited — the whole
 *     shrine still fits, everything smaller).
 *
 * ⚠️ **Never squash.** The art, the CTA and the aim grader were all measured against
 * these proportions, so the shrine scales uniformly or it lies.
 *
 * ⚠️ The margin this leaves is **deliberate negative space**, not a bug: on a tablet the
 * composition is centred rather than stretched to two edges it was never drawn for.
 */
export function homeFitScale(windowWidth: number, windowHeight: number): number {
  return Math.min(windowWidth / DESIGN_REFERENCE_WIDTH, windowHeight / REFERENCE_HEIGHT);
}

/**
 * The board's own height. `390 × 844` — the canvas 131 of the 135 Penpot boards
 * are drawn on (`design-system/responsive.css`).
 */
export const REFERENCE_HEIGHT = 844;

/** A band, in board px. */
export interface Band {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * A band → an absolutely-positioned style, in device dp.
 *
 * ⚠️ **THIS IS THE ONLY PLACE A BAND BECOMES A STYLE.** SCRUM-162 shipped bands that
 * were pasted straight into `paddingLeft`, which put the shrine base's right edge at
 * `16 + 358 = 374` dp on a 360 dp screen — the art was clipped and no gate could see
 * it, because each number was right in its own frame.
 *
 * ⚠️ And the layout must be **absolute, not a flow**. The shrine is a fixed-art
 * composition on a 390×844 canvas: stacking its regions with `marginBottom` throws
 * away the y-coordinates the board actually specifies, which is what made the first
 * pass place things wrongly. Proportions are locked by the canvas; nothing reflows.
 */
export function bandRect(band: Band, scale: number) {
  return {
    position: 'absolute' as const,
    left: band.x * scale,
    top: band.y * scale,
    width: band.w * scale,
    height: band.h * scale,
  };
}

/**
 * Does this band fit inside the canvas at this scale?
 *
 * ⚠️ Exported so `SCRUM-163` can assert the layout is valid at a **360 dp** device
 * and not only on the 390 px reference — the exact blind spot that let the clipped
 * art through. Pure arithmetic, no device.
 */
export function bandFits(band: Band, scale: number, canvasWidth: number): boolean {
  return (band.x + band.w) * scale <= canvasWidth + 0.01;
}




/**
 * Is this the region list a shrine must have, in the right order?
 *
 * ⚠️ Exported as a FUNCTION rather than left to `check:lib` to inline, so the
 * assertion tests the same expression the screen uses. A gate that re-implements
 * the rule it checks can drift from the code it is guarding.
 */
export function isShrineOrder(regions: readonly string[]): boolean {
  return (
    regions.length === HOME_REGION_ORDER.length &&
    regions.every((region, i) => region === HOME_REGION_ORDER[i])
  );
}

/**
 * The tab bar — `nav · …` on `EN · 1 Home / Shrine`, read 2026-10-31.
 *
 * Four tabs at x **12 · 106 · 199 · 293**, each 86 wide and 62 tall, inset 10 under the bar's
 * top edge; the active one gets a `#C23B22` pill with **r12**.
 *
 * ⚠️ **THE BOARD'S ACTIVE-TAB INK IS A DEFECT, AND IT IS NOT COPIED.** `nav · tab Shrine
 * (active bg)` is `#C23B22` and its icon/label are inked `#9A2B18` — dark red on cinnabar red =
 * **1.44:1**, far under AA's 4.5 and visibly legible only if you already know what it says.
 * `onColorCream` (#FFF8E8) on the same fill is **4.90:1**, so that is what the bar renders and
 * `check:lib` §22 asserts the arithmetic. ⚠️ **Filed for the board, not silently "fixed".**
 */
export const TAB_BAR = {
  /** The ink rule along the bar's top edge. */
  topLine: 3,
  // ⚠️ `topInBar` is the number a CHILD of the bar band must use: the band already starts at
  // board y 764, so `top: 774` would push every tab 764 px down and out of view. ⚠️ Measured on
  // glass 2026-10-31 — the bar drew its background and NO tabs, because this is the same
  // absolute-vs-board-relative class as the offerings offset. §22 asserts the two agree.
  tab: { y: 774, topInBar: 10, w: 86, h: 62, radius: 12 },
  /** The four tab origins, from the board. ⚠️ Not evenly spaced (94 · 93 · 94). */
  xs: [12, 106, 199, 293] as const,
} as const;
