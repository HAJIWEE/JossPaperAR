/**
 * tablet-name.ts — how a name is SET on a tablet (SCRUM-146).
 *
 * ── ⚠️ THE PROBLEM THIS EXISTS FOR ─────────────────────────────────────────
 * A 牌位 is written **top to bottom, one character per line**. That is correct for 陈秀英 — the
 * board's own text layer is 51 × 170 on a 93-wide tablet, which *is* a column. It is wrong for
 * `Chen`, which stacked one character per line renders as
 *
 *     C
 *     h
 *     e
 *     n
 *
 * — four lines of one letter, on a plaque, on glass. Seen on the device 2026-10-31.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 * A name containing **any CJK character** is set vertically (the column is the convention, and a
 * mixed name like `陈 Chen` still reads as a Chinese column). A name with **none** is set on one
 * line, **rotated 90°** so it runs along the plaque's long axis like a spine — which is how Latin
 * is written on a vertical monument.
 *
 * ⚠️ Not "is it Chinese": a name is only rotated when it has **no** CJK at all. Rotating part of a
 * name is not a thing a stele does.
 */

/** Unified ideographs, ext-A, compatibility ideographs, and the full-width forms block. */
const CJK = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF01-\uFF60]/;

export type NameOrientation = 'vertical' | 'rotated';

/**
 * ⚠️ An EMPTY name answers `vertical`: nothing is drawn either way, and the empty case must not
 * take a branch that then rotates a zero-length Text.
 */
export function nameOrientation(name: string): NameOrientation {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'vertical';
  return CJK.test(trimmed) ? 'vertical' : 'rotated';
}

/**
 * The font size for a ROTATED (Latin) name, in the same units as `box`.
 *
 * ⚠️ Two limits, both necessary: the glyphs must clear the frame ACROSS the plaque (`box.width`)
 * and the whole line must fit ALONG it (`box.height`). The second is why the size shrinks as the
 * name gets longer — without it `Bartholomew` would run out of the frame's ends.
 *
 * ⚠️ `0.58` is an average Latin advance in ems, not a measurement: RN cannot measure text without
 * a layout pass. It is deliberately pessimistic so a wide name errs small rather than clipped.
 */
export function rotatedNameSize(box: { readonly width: number; readonly height: number }, length: number): number {
  const acrossFrame = box.width * 0.62;
  const alongFrame = (box.height * 0.92) / Math.max(1, length * 0.58);
  return Math.min(acrossFrame, alongFrame);
}

/**
 * How many characters a tablet's face carries.
 *
 * ⚠️ **The board's own number, not a guess.** `sheet · hint` on `EN · 1s Ancestor sheet`
 * reads *"Surname + given name paint up to 3 characters. No given name → 姓 + 氏, the
 * traditional short form."* Every tablet drawn on the Home boards carries three.
 */
export const TABLET_NAME_MAX = 3;

/**
 * The name PAINTED on a tablet — which is **not** the name that was stored.
 *
 * ── ⚠️ WHY THIS IS A RULE AND NOT A TEMPLATE ────────────────────────────────
 * The altar and the sheet's preview must paint the SAME glyphs. Two call sites building
 * the string inline is exactly how a preview and its result drift, and the drift is only
 * visible on glass. So the rule lives here, once, and `check:lib` holds it.
 *
 * | stored | painted | why |
 * |---|---|---|
 * | `陈` + *(none)* | `陈氏` | ⚠️ The board draws it: `EN · 1b Home / tablets (carousel)` has `tablet · right (陈氏)`. |
 * | `陈` + `大文` | `陈大文` | Surname + given, at the 3-character limit. |
 * | `陈` + `大文长` | `陈大文` | ⚠️ **Truncated**, not refused — the DB caps the surname at 20. |
 * | `Chen` + *(none)* | `Chen` | ⚠️ **No 氏** — see below. |
 * | *(blank)* | `` | Nothing to paint; the caller draws its own placeholder. |
 *
 * ── ⚠️ THE TWO CLAUSES ARE SEPARATE, AND THE BOARD SAYS SO ─────────────────
 * `sheet · hint`: *"Surname + given name paint up to 3 characters. **No given name → 姓 + 氏**,
 * the traditional short form."* The limit is stated for the first clause only; 姓 + 氏 is its own
 * rule. So `欧阳` + *(none)* paints `欧阳氏` and is **not** cut to three.
 *
 * ── ⚠️ 氏 IS CHINESE, SO A LATIN SURNAME DOES NOT TAKE IT ───────────────────
 * Two reasons, and the second is the one that bites:
 *   1. 氏 is a clan suffix; `Chen氏` means nothing.
 *   2. ⚠️ **氏 is CJK, so appending it drags the name into the VERTICAL branch** —
 *      `nameOrientation('Chen氏')` is `vertical`, i.e. `C h e n 氏` stacked one glyph per line,
 *      which is exactly the defect the 90° rotation exists to prevent (SCRUM-146, seen on glass
 *      2026-10-31). A bare `Chen` is Latin, so it rotates onto one line and reads as a name.
 *
 * ⚠️ `Array.from`, not `slice`: a name may carry a surrogate pair (an emoji, a rare
 * ideograph outside the BMP), and slicing by UTF-16 unit would cut one in half. `Tablet`
 * already reads the name the same way.
 */
export function tabletName(surname: string, givenName: string | null | undefined): string {
  const s = surname.trim();
  if (s.length === 0) return '';
  const g = (givenName ?? '').trim();
  /** ⚠️ No given name → the traditional short form 姓 + 氏, but only where 氏 means something. */
  if (g.length === 0) return CJK.test(s) ? `${s}氏` : s;
  return Array.from(s + g).slice(0, TABLET_NAME_MAX).join('');
}
