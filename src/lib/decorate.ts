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
export const SLOT_HIT: Record<DecorationSlot, Rect> = {
  top_left: { x: 30, y: 210, w: 66, h: 66 },
  top_middle: { x: 118, y: 210, w: 154, h: 46 },
  top_right: { x: 294, y: 210, w: 66, h: 66 },
  side_left: { x: 30, y: 300, w: 46, h: 160 },
  side_right: { x: 314, y: 300, w: 46, h: 160 },
  background: { x: 101, y: 288, w: 190, h: 320 },
};

/**
 * The six **art rects** — `1d` / `1e`'s `decor · …` groups, board-relative.
 *
 * ⚠️ `top_middle`'s 141 × 40 was measured on a `横批` — a wide scroll this catalogue does not sell yet. It is
 * reused for whatever TOP decoration lands there, which is the only honest option: the board has never drawn
 * another item in that slot, and a made-up rect would look measured.
 */
export const SLOT_ART: Record<DecorationSlot, Rect> = {
  top_left: { x: 37, y: 210, w: 52, h: 66 },
  top_middle: { x: 125, y: 213, w: 141, h: 40 },
  top_right: { x: 301, y: 210, w: 52, h: 66 },
  side_left: { x: 33, y: 300, w: 41, h: 160 },
  side_right: { x: 317, y: 300, w: 41, h: 160 },
  background: { x: 101, y: 367, w: 190, h: 161 },
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
  return DECORATIONS.filter((d) => d.category === category).map((d) => {
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
  readonly art?: 'crown' | 'single';
}

/**
 * Which drawing a piece uses in a given slot.
 *
 * ⚠️ Only the couplets have a second drawing so far (the 横批, ported from `1e`). The door gods' third piece has no
 * art of its own — the board never draws the door gods on an altar — so it borrows the side motif and that is
 * recorded as owed rather than invented.
 */
export function artVariantFor(code: DecorationCode, slot: DecorationSlot): 'crown' | 'single' | undefined {
  /** the couplets' 横批 banner, only in the top-middle */
  if (code === 'spring_couplets' && slot === 'top_middle') return 'crown';
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
 * | Door Gods | **3** | `top_middle` · `side_left` · `side_right` |
 * | Lanterns | **2** — one each side (the upper corners) | `top_left` · `top_right` |
 * | Zhong Kui | 1 — the print behind the tablet | `background` |
 *
 * ⚠️ **The board corroborates the third couplet:** `EN · 1e` draws `decor · 横批 (top-middle) @125,213 141×40` —
 * 横批 *is* the horizontal banner of a couplet set. `1d` omits it, which is why the first pass read the set as a pair.
 * ⚠️ **`equip_decoration` stores ONE row per set** (S14k clears the other slot in the category), so this table is the
 * only place the pieces-per-set fact can live. ⚠️ Measured on glass 2026-11-09: with `lanterns` in `top_left` only one
 * corner lit — the defect that started this.
 * ⚠️ **Door Gods' trio shape is ASSUMED to match the couplets'** (same category, same three positions). No board
 * draws the door gods on an altar, so this is the one line here that is inference rather than measurement.
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
  /** a TRIO, the couplets' shape — see the caveat above */
  door_gods: ['top_middle', 'side_left', 'side_right'],
  /** one print, behind the tablet */
  zhong_kui: ['background'],
  /**
   * ⚠️ **THE FESTIVE SET IS AN AMALGAMATION — the four others put together** (owner, 2026-11-08), and `EN · 1e` is the
   * board that proves it: it draws 横批 top-middle, a lantern in each corner, a couplet down each side and Zhong Kui
   * behind the tablet — i.e. all six slots.
   * ⚠️ The SIDES show the couplets, not the door gods: they are the same category and replace each other (S14k), so a
   * set that owns both still displays one. `1e` displays the couplets.
   */
  festive_set: ['top_left', 'top_middle', 'top_right', 'side_left', 'side_right', 'background'],
};

/** Which of the set's own motifs draws in each slot it fills — the amalgamation, slot by slot (`1e`). */
const FESTIVE_PARTS: Partial<Record<DecorationSlot, DecorationCode>> = {
  top_left: 'lanterns',
  top_middle: 'spring_couplets',
  top_right: 'lanterns',
  side_left: 'spring_couplets',
  side_right: 'spring_couplets',
  background: 'zhong_kui',
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

  // 1 · explicit pieces first — each fills ITS set's slots (a pair fills two).
  for (const slot of DECORATION_SLOTS) {
    const code = equipped[slot];
    if (code === null || code === undefined) continue;
    if (code === 'festive_set') continue; // the amalgamation is applied last
    for (const target of SET_SLOTS[code]) add(target, code);
  }

  // 2 · the Festive Set fills whatever is left of its five slots.
  for (const slot of DECORATION_SLOTS) {
    if (equipped[slot] !== 'festive_set') continue;
    const parts = FESTIVE_PARTS;
    for (const target of SET_SLOTS.festive_set) {
      const part = parts[target];
      if (part !== undefined) add(target, part);
    }
  }

  return plan;
}


/** Which category a slot belongs to — re-exported so a caller cannot import a second copy of the rule. */
export function categoryOf(slot: DecorationSlot): DecorationSlotCategory {
  return SLOT_CATEGORY[slot];
}


