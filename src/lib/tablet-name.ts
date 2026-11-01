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
