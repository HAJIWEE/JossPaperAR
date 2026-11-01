/**
 * The offering art's **boxes** — pure data, so a gate can hold them (SCRUM-150).
 *
 * ⚠️ **The DRAWINGS live in `components/offering-art.tsx`**, which imports `react-native-svg` and so
 * cannot be reached by `check:lib`. ⚠️ The geometry is separated out precisely so §29 can assert that
 * **every catalogue code has art** and that **`fitArt` contains** — neither of which `tsc` can see,
 * because a missing code and a distorted box are both perfectly legal types.
 *
 * ⚠️ Every `viewBox` is transcribed from the Penpot group's own box (`EN · 7 Store`), and the two
 * numbers are the ones `fitArt` uses. ⚠️ **They DIFFER** — 85.8×72 for the cash bundle against
 * 220.4×106 for the wealth bundle — so a caller that sized every item to one box would distort four
 * of the five, which is why fitting is contained rather than stretched.
 */

import { OFFERINGS, type OfferingCode } from '../domain/catalogue.ts';

/** `code → "minX minY width height"`, from the board. ⚠️ Read by BOTH the drawings and the fit. */
export const ART_BOX: Record<OfferingCode, string> = {
  joss_paper_stack: '0 0 85.8 72',
  gold_bar: '0 0 102.9 72',
  smartphone: '0 0 54.3 72',
  house: '0 0 111.3 72',
  wealth_bundle: '0 0 220.4 106',
};

/** The art's box in board px, parsed from the `viewBox`. ⚠️ Never re-typed as a second constant. */
export function artSize(code: OfferingCode): { readonly w: number; readonly h: number } {
  const parts = ART_BOX[code].split(' ').map(Number);
  return { w: parts[2], h: parts[3] };
}

/**
 * The rendered size that fits `boxW × boxH` **without distorting** — contain, not cover.
 *
 * ⚠️ **ONE scale for BOTH axes**, which is what "contain" means. Using `boxW / w` for the width and
 * `boxH / h` for the height would stretch every item to fill the box — a change that looks plausible
 * on screen and is wrong on every card whose aspect differs.
 */
export function fitArt(
  code: OfferingCode,
  boxW: number,
  boxH: number,
): { readonly width: number; readonly height: number } {
  const { w, h } = artSize(code);
  const k = Math.min(boxW / w, boxH / h);
  return { width: w * k, height: h * k };
}

/** ⚠️ Every code in the catalogue, so §29 can assert none is missing an illustration. */
export function artCodes(): readonly OfferingCode[] {
  return OFFERINGS.map((o) => o.code);
}
