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
/**
 * `code → "minX minY width height"`, from the **cropped PNG's own pixels**.
 *
 * ⚠️⚠️ **THE ART IS A RASTER NOW, NOT 82 SVG SHAPES** (owner's call, 2026-11-01):
 * *"use `<image>` · use option 2"*. The five chosen style examples were cut out with
 * `fal-ai/birefnet/v2` — the pipeline's OWN stage ⓓ — and cropped to their alpha bounding box,
 * so the subject fills the box rather than floating in the 1024×1024 padding.
 *
 * ⚠️ **These numbers MIRROR the PNGs**, and a mirror that drifts is worse than none: `check:lib` §29
 * reads the **IHDR of each file on disk** and asserts these agree, so a re-crop cannot leave the
 * layout lying. The aspects genuinely DIFFER (0.50 for the phone against 1.44 for the bundle), which
 * is why fitting is contained rather than stretched.
 */
export const ART_BOX: Record<OfferingCode, string> = {
  joss_paper_stack: '0 0 787 764',
  gold_bar: '0 0 750 539',
  smartphone: '0 0 458 920',
  house: '0 0 882 748',
  wealth_bundle: '0 0 937 650',
};

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
