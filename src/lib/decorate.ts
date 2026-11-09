/**
 * decorate.ts — the PURE half of the altar customisation surface (SCRUM-156 · SCRUM-205).
 *
 * ── WHY THIS FILE EXISTS AT ALL ─────────────────────────────────────────────
 * The same reason as `home-layout.ts` and `store.ts`: **a structure nothing can read is a structure no gate
 * can hold.** "Which decorations are offered in a slot", "where does an equipped piece draw" and "how tall is
 * the picker sheet" are facts about a MAPPING, so they live here as data and the screens render them.
 *
 * ── EVERY NUMBER IS THE BOARD'S (`EN · 1f` family, read 2026-11-09) ──────────
 * | board | layer | board px |
 * |---|---|---|
 * | `1f` | `slot · top-left` (tap zone) | 30,210 66×66 |
 * | `1f` | `slot · top-middle` | 118,210 154×46 |
 * | `1f` | `slot · top-right` | 294,210 66×66 |
 * | `1f` | `slot · side-left` | 30,300 46×160 |
 * | `1f` | `slot · side-right` | 314,300 46×160 |
 * | `1f` | `slot · background` | 101,288 190×320 |
 * | `1d` | `decor · lantern (top-left)` **(the ART)** | 37,210 52×66 |
 * | `1d` | `decor · couplet (side-left)` | 33,300 41×160 |
 * | `1e` | `decor · 鍾馗像 (background)` | 101,367 190×161 |
 *
 * ⚠️⚠️ **THE TAP ZONE IS NOT THE ART RECT.** `1f` draws generous 66–320 px zones to hit; `1d`/`1e` draw the
 * *art* inside them at its own size — the background zone is 190×320 but the print is 190×161, and the side
 * zone is 46×160 against a 41×160 couplet. One number for both would either shrink the art or leave the piece
 * 159 px of invisible margin to hit.
 *
 * ⚠️ **The art is SCALED to its rect, not letterboxed** (`preserveAspectRatio="none"`). That looks wrong and
 * is not: every motif's source box is 85.1 × 72, yet the board draws couplets 41 × 160 and lanterns 52 × 66 —
 * it stretched them too. The rects are the design's answer to "what shape is this piece HERE", so the art
 * follows them rather than the other way round.
 *
 * ── ⚠️ THE ONE THING THIS FILE DOES *NOT* DECIDE ─────────────────────────────
 * It never decides **ownership** — `src/lib/decorations.ts` reads that from the server and `equip_decoration`
 * enforces it. This module only answers "what may be OFFERED" and "what would be DRAWN".
 */

import {
  DECORATIONS,
  DECORATION_SLOTS,
  SLOT_CATEGORY,
  type Decoration,
  type DecorationCode,
  type DecorationSlot,
  type DecorationSlotCategory,
} from '../domain/catalogue.ts';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The board the shrine is drawn on — the same 390 × 844 `ShrineCanvas` uses. */
export const DECOR_BOARD = { w: 390, h: 844 } as const;

/**
 * The six **tap zones** — `1f`'s `slot · …` rects, board-relative.
 * ⚠️ Zones, not art: they are deliberately larger than the drawing they hold.
 */
/**
 * ⚠️ **THE BOARD'S OWN TAP ZONES (`1f`), UNTOUCHED — the floor every zone is derived from.**
 * ⚠️ Exported for the gate, which asserts no zone is ever SMALLER than these: a zone that shrank below the board's own
 * rect would be a control the drawing did not ask for.
 */
export const BOARD_HIT: Record<DecorationSlot, Rect> = {
  top_left: { x: 30, y: 210, w: 66, h: 66 },
  top_middle: { x: 118, y: 210, w: 154, h: 46 },
  top_right: { x: 294, y: 210, w: 66, h: 66 },
  side_left: { x: 30, y: 300, w: 46, h: 160 },
  side_right: { x: 314, y: 300, w: 46, h: 160 },
  background: { x: 101, y: 288, w: 190, h: 320 },
};

/**
 * ⚠️⚠️ **HOW MUCH BIGGER THE BANNERS ARE DRAWN THAN THE BOARD'S RECTS** (owner, 2026-11-09: *"Make the Side banners 20%
 * bigger. Top banner 15% bigger. maintain the top center alignment."*).
 *
 * ⚠️ **ANCHORED TOP-CENTRE, which is the whole of "maintain the top center alignment":** the top edge and the horizontal
 * centre are held and the piece grows DOWNWARD and OUTWARD. ⚠️ Growing about the centre instead would lift the top edge by
 * half the growth every time the number changed — the same drift the background print's anchor was built to stop.
 * ⚠️ The factors are named here rather than baked into six numbers, so the provenance survives: the rects below still read
 * as the board's measurements, with a stated multiplier on three of them.
 */
export const BANNER_GROWTH = { top: 1.15, side: 1.2 } as const;

/**
 * The board's own `decor · …` art rects (`1d`/`1e`), BEFORE the owner's size changes — the base every grown rect is
 * derived from, and what the gate compares against.
 * ⚠️ `top_middle`'s 141 × 40 was measured on a `横批` — a wide scroll this catalogue does not sell yet. It is reused for
 * whatever TOP decoration lands there, which is the only honest option: the board has never drawn another item in that
 * slot, and a made-up rect would look measured.
 */
export const BOARD_ART: Record<DecorationSlot, Rect> = {
  top_left: { x: 37, y: 210, w: 52, h: 66 },
  top_middle: { x: 125, y: 213, w: 141, h: 40 },
  top_right: { x: 301, y: 210, w: 52, h: 66 },
  side_left: { x: 33, y: 300, w: 41, h: 160 },
  side_right: { x: 317, y: 300, w: 41, h: 160 },
  background: { x: 101, y: 367, w: 190, h: 161 },
};

/**
 * Grow a rect about its **TOP-CENTRE**: the top edge and the horizontal centre stay, the width and the bottom move.
 * ⚠️ This is what "maintain the top center alignment" means in arithmetic, and it is the opposite of `overshoot()`.
 */
export function growTopCentre(r: Rect, factor: number): Rect {
  const w = r.w * factor;
  const h = r.h * factor;
  return { x: r.x - (w - r.w) / 2, y: r.y, w, h };
}

/**
 * The tap zone for a grown piece: the board's zone, widened **only as far as the art now needs**, never narrowed.
 * ⚠️ A grown banner that pokes outside its dashed outline is a piece whose edge cannot be tapped in customise mode — the
 * zone exists to be bigger than the art, so when the art grows the zone has to follow. ⚠️ The 3 px margin keeps the zone
 * from ever being exactly the art.
 */
export function zoneFor(board: Rect, art: Rect, pad = 3): Rect {
  const x = Math.min(board.x, art.x - pad);
  const y = Math.min(board.y, art.y - pad);
  const right = Math.max(board.x + board.w, art.x + art.w + pad);
  const bottom = Math.max(board.y + board.h, art.y + art.h + pad);
  return { x, y, w: right - x, h: bottom - y };
}

/**
 * ⚠️⚠️ **THE PRINT HANGS FROM ITS ZONE'S TOP-CENTRE, AT `BACKGROUND_OVERSHOOT` OF THE ZONE** (owner, 2026-11-09:
 * *"shrink the background decoration size by 20% and bring it up another 10%"*, then *"maintain top center alignment but
 * reduce the background decoration another 20%"*).
 *
 * ⚠️ **THE ANCHOR IS THE LESSON, not the number.** Shrinking about the CENTRE moved the TOP EDGE every time the size
 * changed — the previous cut dropped it ~13 px while the body rose, which is exactly the drift *"maintain top center
 * alignment"* is asking to stop. So the top edge and the horizontal centre are now HELD, and a size change moves only the
 * width and the bottom edge.
 * ⚠️ That also **retires `BACKGROUND_LIFT`**: a lift exists to nudge a centred print, and an anchored one needs no nudge.
 * Removed rather than left at 0, so there is one way to position this print and not two that disagree.
 *
 * ⚠️ Provenance of the number, so the next cut has its history: `1.0` (the zone) → `1.1` (+10 %) → `0.88` (−20 %) →
 * `0.704` (another −20 %) → `0.8096` (+15 %) → **`0.68816`** (−15 %, i.e. `0.8096 × 0.85`).
 */
export const BACKGROUND_OVERSHOOT = 0.68816;

/**
 * ⚠️ **WHERE THE BOX IS ALIGNED: its top edge, as a fraction of the ZONE's height above the zone's top** (`0.028` = `8.96`
 * board px). ⚠️ **A fraction of the ZONE, never of the print** — a fraction of the print moves the alignment edge every time
 * the size changes, which is the drift *"maintain top center alignment"* exists to stop.
 * ⚠️ Where `0.028` comes from, so it is a measurement and not a taste: an earlier *"bring it up another 10 %"* lifted the
 * 0.88 print by 10 % of its own height (`28.16`) from a centred position `35.2` below the zone's top, so `35.2 − 28.16 =
 * 8.96`, and `8.96 / 320 = 0.028` exactly.
 * ⚠️⚠️ **THIS IS THE ONLY VERTICAL CONTROL THERE IS — the box sits ON this edge, with no lift on top of it** (owner,
 * 2026-11-09: *"bring it down back 15% cos now its encroaching on the top banner"*). ⚠️ The `BACKGROUND_RAISE = 0.15` of the
 * previous commit is **deleted, not zeroed** — the same rule `BACKGROUND_LIFT` got: one way to position this print, not two
 * that disagree. What it did is recorded here instead: `38.86` board px up, putting the top at `240.2`, where the print
 * reached into the chip band (`a fault test at 0.30 proved the collision`). ⚠️ **Reversing the lift is what fixes the banner
 * overlap** — the −15 % size alone would have left the top `38.86` px too high.
 */
export const BACKGROUND_TOP_OFFSET = 0.028;

/**
 * A rect hung from the **TOP-CENTRE** of `zone`: horizontally centred, `factor` of the zone's size, its top edge
 * `topOffset` of the zone's height above the zone's top (negative values drop it below).
 * ⚠️ Top-centre, not top-left: the zone is symmetric about the shrine, and a left anchor would walk the print sideways.
 */
export function hungFrom(zone: Rect, factor: number, topOffset: number): Rect {
  const w = zone.w * factor;
  const h = zone.h * factor;
  return { x: zone.x + (zone.w - w) / 2, y: zone.y - zone.h * topOffset, w, h };
}

/**
 * The six **art rects** — `1d` / `1e`'s `decor · …` groups, board-relative, with the owner's banner sizes applied.
 *
 * ⚠️ Three of them are `growTopCentre(BOARD_ART[slot], BANNER_GROWTH.…)`: the side banners **+20 %** and the top banner
 * **+15 %**, anchored so the top edge and the horizontal centre do not move. The other three are the board's rects
 * unchanged — a size change was asked of two sets, not of the whole altar.
 */
export const SLOT_ART: Record<DecorationSlot, Rect> = {
  top_left: BOARD_ART.top_left,
  top_middle: growTopCentre(BOARD_ART.top_middle, BANNER_GROWTH.top),
  top_right: BOARD_ART.top_right,
  side_left: growTopCentre(BOARD_ART.side_left, BANNER_GROWTH.side),
  side_right: growTopCentre(BOARD_ART.side_right, BANNER_GROWTH.side),
  /** `decor · 鍾馗像 (background)` — ⚠️ **HUNG FROM THE ZONE'S TOP-CENTRE, and nothing else** (owner, 2026-11-09:
   * *"further reduce the size of the zhong kui art by 15% and bring it down back 15%"*).
   * ⚠️ One step again, after two commits of a second one: `hungFrom()` is the whole placement — `BACKGROUND_OVERSHOOT` for
   * size, `BACKGROUND_TOP_OFFSET` for the edge it hangs from. A lift on top of an anchor was two controls for one edge, and
   * the second is what walked the print into the chip band. */
  background: hungFrom(BOARD_HIT.background, BACKGROUND_OVERSHOOT, BACKGROUND_TOP_OFFSET),
};

/**
 * The six **tap zones** — the board's `1f` rects, widened only where a grown banner needs it, never narrowed.
 * ⚠️ Derived, not a second table: the invariant `1f` depends on (*"the zone is bigger than the piece"*) is now maintained by
 * construction for the pieces that grew, instead of being quietly broken by a hand-edited number.
 */
export const SLOT_HIT: Record<DecorationSlot, Rect> = {
  top_left: BOARD_HIT.top_left,
  top_middle: zoneFor(BOARD_HIT.top_middle, SLOT_ART.top_middle),
  top_right: BOARD_HIT.top_right,
  side_left: zoneFor(BOARD_HIT.side_left, SLOT_ART.side_left),
  side_right: zoneFor(BOARD_HIT.side_right, SLOT_ART.side_right),
  background: BOARD_HIT.background,
};

/** `slot · hint (how it works)` — 20,618 350×18, drawn only in customise mode. */
export const SLOT_HINT: Rect = { x: 20, y: 618, w: 350, h: 18 };

/**
 * The picker sheet, from `1f2` (two options) **and** `1f3`/`1f4` (three) — two boards, one rule.
 *
 * ⚠️ The panel is **bottom-anchored to the board's own bottom** (844) and grows by exactly **80 px per extra
 * option**: 324 tall at two, 404 at three. ⚠️ That 80 is **not** the 84 row pitch, and rounding it to the pitch
 * is how a sheet ends up 8 px off the board on one of the two states.
 */
export const DECOR_SHEET = {
  boardBottom: 844,
  /** `btn · Equip this set (bg)` — 20,774 350×52. The same on both sheet heights. */
  button: { x: 20, y: 774, w: 350, h: 52 } as Rect,
  rowH: 78,
  rowPitch: 84,
  rowTopOffset: 78,
  panelBase: 164,
  panelPerRow: 80,
  titleTopOffset: 26,
  subTopOffset: 54,
} as const;

export interface SheetLayout {
  readonly panel: Rect;
  readonly title: Rect;
  readonly sub: Rect;
  readonly rows: readonly Rect[];
  readonly button: Rect;
}

/**
 * Lay the sheet out for `count` options.
 *
 * ⚠️ Reproduces BOTH boards exactly, which is the point of deriving it instead of freezing one: `1f2` = panel
 * 520, rows 598 / 682; `1f3` = panel 440, rows 518 / 602 / 686. A hard-coded height is wrong on the other.
 */
export function sheetLayout(count: number): SheetLayout {
  const n = Math.max(1, Math.trunc(count));
  const h = DECOR_SHEET.panelBase + DECOR_SHEET.panelPerRow * n;
  const top = DECOR_SHEET.boardBottom - h;
  const rows: Rect[] = [];
  for (let i = 0; i < n; i += 1) {
    rows.push({
      x: 20,
      y: top + DECOR_SHEET.rowTopOffset + i * DECOR_SHEET.rowPitch,
      w: 350,
      h: DECOR_SHEET.rowH,
    });
  }
  return {
    panel: { x: 0, y: top, w: DECOR_BOARD.w, h },
    title: { x: 20, y: top + DECOR_SHEET.titleTopOffset, w: 310, h: 26 },
    sub: { x: 20, y: top + DECOR_SHEET.subTopOffset, w: 350, h: 16 },
    rows,
    button: DECOR_SHEET.button,
  };
}

/** What the picker calls a category — `sheet · title` / `sheet · sub` on `1f2` / `1f3` / `1f4`. */
export interface CategoryCopy {
  readonly titleKey: string;
  readonly subKey: string;
  /** `Equip this set` (a set) vs `Equip this` — the BACKGROUND board's own label. */
  readonly buttonKey: string;
}

export const CATEGORY_COPY: Record<DecorationSlotCategory, CategoryCopy> = {
  side: { titleKey: 'decor.sheetTitleSide', subKey: 'decor.sheetSubSide', buttonKey: 'decor.equipSet' },
  top: { titleKey: 'decor.sheetTitleTop', subKey: 'decor.sheetSubTop', buttonKey: 'decor.equipSet' },
  background: {
    titleKey: 'decor.sheetTitleBackground',
    subKey: 'decor.sheetSubBackground',
    buttonKey: 'decor.equipOne',
  },
};

/** `slot · <x> (label)` — the little word inside each outline on `1f`. */
export const CATEGORY_LABEL_KEY: Record<DecorationSlotCategory, string> = {
  side: 'decor.slotSide',
  top: 'decor.slotTop',
  background: 'decor.slotBackground',
};

/** The state a row is in. ⚠️ `unowned` is NOT the same fact as `owned` — one can be equipped tonight. */
export type DecorState = 'equipped' | 'owned' | 'unowned';

export interface DecorOption {
  readonly code: DecorationCode;
  readonly decoration: Decoration;
  readonly state: DecorState;
  /** ⚠️ What the button does. A row nobody owns must never look equipable. */
  readonly selectable: boolean;
}

/**
 * What a slot OFFERS: every catalogue decoration **in that slot's category**.
 *
 * ⚠️⚠️ **This is the rule SCRUM-205's acceptance is about** — a side slot must never offer the background
 * print. ⚠️ It is derived from `SLOT_CATEGORY` and `Decoration.category`, **not** from a second table here: the
 * slot→category map is single-sourced in `domain/catalogue.ts` (S14j/S14k), and a copy would be the second
 * opinion this project keeps deleting.
 * ⚠️ Unowned items ARE listed — with their price, as `1f3`/`1f4` draw them (*"Not owned · $0.99 / 800 pts"*) —
 * because a catalogue the user cannot see is a catalogue they cannot want.
 */
export function optionsForSlot(
  slot: DecorationSlot,
  owned: readonly DecorationCode[],
  equipped: DecorationCode | null,
): readonly DecorOption[] {
  const category = SLOT_CATEGORY[slot];
  return DECORATIONS
    /**
     * ⚠️⚠️ **A COMPOSED SET IS A SKU, NOT A CHOICE** (owner, 2026-11-09). The Festive Set is the other four sold
     * together — buying it grants them, so a picker row for the set itself would offer something that cannot be placed
     * and is not owned as an item. Filtered on `composedOf`, not on the code, so a future bundle is excluded too.
     */
    .filter((d) => d.composedOf === undefined && d.category === category)
    .map((d) => {
      const isOwned = owned.includes(d.code);
      const state: DecorState = equipped === d.code ? 'equipped' : isOwned ? 'owned' : 'unowned';
      return { code: d.code, decoration: d, state, selectable: isOwned && equipped !== d.code };
    });
}

export interface DrawPlan {
  readonly slot: DecorationSlot;
  readonly code: DecorationCode;
  readonly rect: Rect;
  /** ⚠️ `true` for the background print: `1e` paints it BEHIND the tablet. */
  readonly behind: boolean;
  /**
   * ⚠️ **A SET'S PIECE IS NOT ALWAYS THE SET'S FACE.** The couplets are a trio and the top-middle one is the 横批 — a
   * banner, not a scroll — so the drawing is chosen by SLOT as well as by code. `undefined` = the code's own motif.
   */
  readonly art?: 'crown' | 'single' | 'scroll';
}

/**
 * Which drawing a piece uses in a given slot.
 *
 * ⚠️ Only the couplets have a second drawing so far (the 横批, ported from `1e`). The door gods' third piece has no
 * art of its own — the board never draws the door gods on an altar — so it borrows the side motif and that is
 * recorded as owed rather than invented.
 */
export function artVariantFor(code: DecorationCode, slot: DecorationSlot): 'crown' | 'single' | 'scroll' | undefined {
  /** the couplets' 横批 banner, only in the top-middle */
  if (code === 'spring_couplets') return slot === 'top_middle' ? 'crown' : 'scroll';
  /** ⚠️ ONE lantern per corner: the pair motif belongs on a store card, not on the altar */
  if (code === 'lanterns') return 'single';
  return undefined;
}

/**
 * ⚠️⚠️ **WHERE A DECORATION ACTUALLY DRAWS — and it is not "the slot it is stored in".**
 *
 * ⚠️ **CORRECTED 2026-11-09 BY THE OWNER, who eyeballed the shrine** — and it is a composition fact that was not
 * written down anywhere: *"the Spring Couplets consist of a trio of objects as a set one for the top middle of the
 * shrine, one for the left of the shrine and one for the right of the shrine. Similarly the lanterns is also a pair
 * one for each side, The door Gods is also a trio one."*
 *
 * | set | pieces | slots |
 * |---|---|---|
 * | Spring Couplets | **3** — 横批 + a scroll each side | `top_middle` · `side_left` · `side_right` |
 * | Door Gods | **2** — one door leaf each side, **NO top piece** | `side_left` · `side_right` |
 * | Lanterns | **2** — one each side (the upper corners) | `top_left` · `top_right` |
 * | Zhong Kui | 1 — the print behind the tablet | `background` |
 *
 * ⚠️ **The board corroborates the third couplet:** `EN · 1e` draws `decor · 横批 (top-middle) @125,213 141×40` —
 * 横批 *is* the horizontal banner of a couplet set. `1d` omits it, which is why the first pass read the set as a pair.
 * ⚠️ **`equip_decoration` stores ONE row per set** (S14k clears the other slot in the category), so this table is the
 * only place the pieces-per-set fact can live. ⚠️ Measured on glass 2026-11-09: with `lanterns` in `top_left` only one
 * corner lit — the defect that started this.
 *
 * ⚠️⚠️ **DOOR GODS WERE THE ONE INFERENCE HERE, AND THE OWNER HAS NOW SETTLED IT (SCRUM-228, 2026-11-09).**
 * They were given the couplets' three slots *by inference* — no board draws them on an altar, and the owner's earlier
 * *"The door Gods is also a trio one"* was the only evidence. Asked directly whether they own a top-middle band, the
 * answer was: **"No door god is a left right only, no top"** — i.e. a **PAIR**, which is also what a 门神 actually is
 * (they flank a doorway; no traditional 横批 carries them). ⚠️ So they now draw exactly like the lanterns and the
 * `top_middle` band is the **couplets' 横批 alone**. ⚠️ The borrowed banner was visibly wrong on glass: two PORTRAIT
 * panels stretched into a 162 × 46 band read as a squashed card (SCRUM-226's render evidence).
 */
const SET_SLOTS: Record<DecorationCode, readonly DecorationSlot[]> = {
  /** a PAIR, one hanging each side — the upper corners (`1d` draws both) */
  lanterns: ['top_left', 'top_right'],
  /**
   * a TRIO: 横批 across the top + a scroll down each side.
   * ⚠️ The top-middle piece is drawn with the pair's motif stretched into 141 × 40 — the 横批 has **no ported art of
   * its own** yet (`1e` has it as raw shapes). Filed rather than faked with a second motif.
   */
  spring_couplets: ['top_middle', 'side_left', 'side_right'],
  /**
   * ⚠️⚠️ **A PAIR — left and right only, NO top piece** (owner, 2026-11-09, answering SCRUM-228: *"No door god is a
   * left right only, no top"*). ⚠️ They briefly carried the couplets' `top_middle` **by inference** and drew two
   * portrait panels stretched into a 162 × 46 band, which read as a squashed card rather than a pair of door leaves.
   * ⚠️ This is the ticket's **option A** and it is a deliberate reversal of the earlier *"the door Gods is also a
   * trio one"* — documented so it is not "corrected" back by a future reader. `check:lib` asserts the pair.
   */
  door_gods: ['side_left', 'side_right'],
  /** one print, behind the tablet */
  zhong_kui: ['background'],
  /**
   * ⚠️⚠️ **THE FESTIVE SET IS A BUNDLE, SO IT DRAWS NOWHERE** (owner, 2026-11-09): buying it grants the four
   * decorations it is made of, and those are equipped individually. ⚠️ An empty list is deliberate and stronger than
   * the previous expansion — there is no `festive_set` inventory row to equip, and `purchase_item` never writes one
   * (`decorations_catalog.composed_of`). If such a row somehow existed, drawing nothing is the honest outcome.
   */
  festive_set: [],
};

/**
 * Everything the shrine should draw, from the equipped map.
 *
 * ⚠️ Pure and total: it never throws, and an absent/unknown slot is simply not drawn — a row the client cannot
 * name is a row it must not draw (`decorations.ts` drops those before they get here).
 * ⚠️ **An explicitly equipped piece wins its slot**: if a category holds one set (the server guarantees it) the
 * only way two codes meet is the Festive Set plus an explicit piece, and the explicit choice is the more specific
 * instruction — a set must not quietly overwrite it.
 * ⚠️ The order is stable (the catalogue's slot order) so a screenshot diff means a change, not a reshuffle.
 */
export function drawPlan(
  equipped: Readonly<Record<DecorationSlot, DecorationCode | null>>,
): readonly DrawPlan[] {
  const plan: DrawPlan[] = [];
  const taken = new Set<DecorationSlot>();

  const add = (slot: DecorationSlot, code: DecorationCode) => {
    if (taken.has(slot)) return;
    plan.push({
      slot,
      code,
      rect: SLOT_ART[slot],
      behind: SLOT_CATEGORY[slot] === 'background',
      art: artVariantFor(code, slot),
    });
    taken.add(slot);
  };

  // ⚠️ ONE loop: a piece fills ITS set's slots (a pair fills two, a trio three). A COMPOSED set has none — it is a SKU.
  for (const slot of DECORATION_SLOTS) {
    const code = equipped[slot];
    if (code === null || code === undefined) continue;
    for (const target of SET_SLOTS[code]) add(target, code);
  }

  return plan;
}


/** Do two board rects overlap? ⚠️ Strict: touching edges do not count. */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * ⚠️⚠️ **IS THE CHIP'S BAND CLEAR?** (owner, 2026-11-09 — the answer to `SCRUM-225`)
 *
 * > *"If that position is empty then show the Chip, else clicking on the decoration enters the customizing workflow too."*
 *
 * ⚠️ The chip (`zone · customizable temple (label)`, 28,214 224×22) sits **inside** the top decoration band — the
 * top-left lantern draws at 37,210 52×66 and the couplets' 横批 at 125,213 141×40, so both run **through** the label.
 * `1d`/`1e` draw no chip at all for exactly that reason.
 *
 * So the chip is the **empty-state** affordance and the DECORATION takes over the tap once one is there: this function
 * decides which of the two the shrine shows, from what it is about to draw — one rule, one place.
 */
export function chipBandClear(plan: readonly DrawPlan[], band: Rect): boolean {
  return plan.every((p) => !rectsOverlap(p.rect, band));
}

/** Which category a slot belongs to — re-exported so a caller cannot import a second copy of the rule. */
export function categoryOf(slot: DecorationSlot): DecorationSlotCategory {
  return SLOT_CATEGORY[slot];
}



