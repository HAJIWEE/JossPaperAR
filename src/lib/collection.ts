/**
 * The Collection screen's rules — ported from `EN · 8 Collection` and `EN · 8d Collection / empty`.
 *
 * ⚠️ **Pure, so a gate can hold it.** The grid's fill order, which empty cell carries copy, and the
 * "never ×0" rule are all facts about the MAPPING, not about the render — the same reason
 * `PREPARING_COPY` and `PROFILE_ROWS` live in modules rather than in JSX.
 */

import { OFFERINGS } from '../domain/catalogue.ts';
import { localized } from './i18n.ts';

/**
 * Geometry, in **board px** (`EN · 8`, 390×844). ⚠️ The grid is two columns of 165×170 cards at
 * x **20 · 197** and y **168 · 350 · 532** — three rows, six slots, and the board fills them in
 * reading order.
 */
export const COLLECTION = {
  /** The two stat cards. `stat · offerings burned (bg)` is 20,94 165×40; the second at x 205. */
  stat: { y: 94, w: 165, h: 40, radius: 12, xs: [20, 205] as const },
  /** `card · …` 165×170, r14. ⚠️ Not evenly spaced horizontally (20 → 197 = 177, card is 165). */
  card: { w: 165, h: 170, radius: 14, xs: [20, 197] as const, ys: [168, 350, 532] as const },
  /**
   * ⚠️ **THE ART WELL.** The board draws `art · Gold Bar` etc. inside each card — a centred
   * illustration at most 110×80, starting 14 below the card's top.
   *
   * ⚠️ **THOSE ILLUSTRATIONS DO NOT EXIST IN THE APP.** The catalogue is code-owned names and prices
   * (`domain/catalogue.ts`); there is no per-item art anywhere in `src/`, and `components/home/
   * offerings.tsx` is the ALTAR's art, not a per-item sprite. So the well is reserved at the board's
   * exact geometry and rendered as a plain surface — ⚠️ **not** filled with an invented glyph, which
   * would look real and be a lie. The art is filed as owed.
   */
  art: { w: 110, h: 80, top: 14 },
  /** `card · <name>` — 13 px, 100 below the card top. */
  name: { dy: 100, size: 13 },
  /** `card · <name> meta` — 11 px, `burned ×N`, 120 below the card top. */
  meta: { dy: 120, size: 11 },
  /**
   * ⚠️ **THE EMPTY SLOT'S OWN OFFSETS** (`8d`): the `＋` at **+44**, and the two copy lines at
   * **+104** and **+122**. ⚠️ They are NOT the item card's offsets, and the board draws **no art
   * well** in an empty slot.
   *
   * ⚠️ **Every one of these is an OFFSET, not a flow.** The first build laid the card out as a flex
   * column with `marginTop: 'auto'` on the name, and on glass the copy **overflowed the 170 px card**
   * and collided with the next row — the board's fixed offsets are what keep the two lines inside it.
   */
  emptyPlus: { dy: 44, size: 30 },
  emptyLine1: { dy: 104 },
  emptyLine2: { dy: 122 },
  /**
   * ⚠️ The name and the meta are **LEFT-aligned at +10, 145 wide** — not centred. The board's
   * `card · Gold Bar name` is `207,268 145×18` inside a card at `197,168`, so the inset is 10.
   */
  text: { dx: 10, w: 145 },
  /** `note · collection` — 24,760 342×34. */
  note: { y: 760 },
} as const;

/** How many slots the grid shows. ⚠️ Six = the board's three rows of two, and it never grows. */
export const COLLECTION_SLOTS = COLLECTION.card.xs.length * COLLECTION.card.ys.length;

export type EmptyCopy = 'none' | 'firstEver' | 'nextOne';

export interface CollectionCell {
  readonly kind: 'item' | 'empty';
  /** The catalogue code for an item cell, `null` for an empty one. */
  readonly itemCode: string | null;
  readonly burned: number;
  /**
   * ⚠️ **ONLY THE FIRST EMPTY CELL CARRIES COPY.** The board draws `＋` alone on five of the six
   * dashed slots and words on the first. ⚠️ And WHICH words depends on whether the grid is entirely
   * empty — `Nothing here yet / your first burn lands here` (8d) versus `Offer something new / and
   * it lands here` (8). That is a fact about the mapping, so it is decided here.
   */
  readonly emptyCopy: EmptyCopy;
}

/**
 * Lay the collected items into the board's six slots, filling in reading order.
 *
 * ⚠️ **Items BEYOND the sixth are dropped, and that is a real limit, not an oversight.** The board
 * draws a fixed six; the catalogue holds five offerings, so six is currently unreachable — but a
 * decoration set or a sixth offering would overflow silently. The caller is expected to check
 * `overflowed`.
 */
export function collectionGrid(
  items: readonly { readonly itemCode: string; readonly burned: number }[],
): readonly CollectionCell[] {
  const cells: CollectionCell[] = [];
  const emptyCount = Math.max(0, COLLECTION_SLOTS - items.length);
  const firstEmptyIndex = items.length;

  for (let i = 0; i < COLLECTION_SLOTS; i += 1) {
    const item = items[i];
    if (item !== undefined) {
      cells.push({ kind: 'item', itemCode: item.itemCode, burned: item.burned, emptyCopy: 'none' });
      continue;
    }
    // ⚠️ The FIRST empty slot is the one that speaks — and it says something different when there
    // is nothing at all, which is the difference between `8d` and `8`.
    const isFirstEmpty = i === firstEmptyIndex;
    const emptyCopy: EmptyCopy = !isFirstEmpty
      ? 'none'
      : items.length === 0
        ? 'firstEver'
        : 'nextOne';
    cells.push({ kind: 'empty', itemCode: null, burned: 0, emptyCopy });
  }

  void emptyCount;
  return cells;
}

/** ⚠️ True when the caller has more collected items than the board's six slots can show. */
export function collectionOverflows(itemCount: number): boolean {
  return itemCount > COLLECTION_SLOTS;
}

/**
 * The localized name for a catalogue code, or `null` when the code is not one we ship.
 *
 * ⚠️ **The screen must never print a raw code.** `burns.item_code` is a catalogue key, and rendering
 * `gold_bar` where the board says *Gold Bar* is the defect `SCRUM-97` closed for the store. ⚠️ A
 * `null` return is a REAL answer — a row whose code the bundle does not know is a row the bundle
 * cannot name, and it renders as a gap rather than as the code.
 */
export function collectedItemName(code: string | null): string | null {
  if (code === null) return null;
  const found = OFFERINGS.find((o) => o.code === code);
  return found === undefined ? null : localized(found.name);
}

/**
 * ⚠️ **A COUNT IS NEVER `×0`.** A cell is only an item because the server counted at least one burn,
 * so `burned ×0` would be a contradiction on screen — and a negative is a value the server cannot
 * have produced. Both are clamped to 1, and `check:lib` §28 asserts it.
 */
export function displayBurnCount(burned: number): number {
  return Number.isFinite(burned) && burned >= 1 ? Math.floor(burned) : 1;
}
