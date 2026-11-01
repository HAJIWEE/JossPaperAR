/**
 * THE OFFERING ART — the five standard items (SCRUM-150).
 *
 * ⚠️⚠️ **THIS WAS 82 HAND-PORTED SVG SHAPES AND IS NOW FIVE RASTER CUT-OUTS** — the owner's call,
 * 2026-11-01: *"use `<image>` · use option 2"*.
 *
 * ── WHY ──────────────────────────────────────────────────────────────────────
 * The Penpot vectors were **flat fills with hard outlines**; a capture that comes back from **Path C**
 * is a **very coarse low-poly 3D cartoon**. The owner's finding: *"the standard items' Art Style is
 * not consistent with the art generated thru the pipeline."* Two visual languages on one screen.
 *
 * So all five were regenerated **in the pipeline's own style** — `fal-ai/nano-banana-2`, the endpoint
 * `_shared/pathc.ts` calls, from `STYLE_TEMPLATE_V3` verbatim — and then cut out with
 * **`fal-ai/birefnet/v2`**, the pipeline's **own stage ④**, because a generated image sits on the warm
 * rice-paper background the template *asks for* and the app draws the offering **over the camera**.
 *
 * ── ⚠️ THE TRADE-OFF, STATED PLAINLY ─────────────────────────────────────────
 * ⚠️ **The art can no longer be recoloured, and it does not scale losslessly.** That is the cost of
 * option 2, accepted deliberately over re-tracing five raster illustrations as `react-native-svg`
 * (which is what every OTHER illustration in this app does — `fire-art.tsx`, `altar-halo.tsx`).
 * ⚠️ **~2.4 MB of bundled assets.** If the style changes again, these are regenerated, not edited.
 *
 * ── ⚠️ WHY THE SIZES LIVE IN A PURE MODULE ───────────────────────────────────
 * `lib/offering-art.ts` holds the boxes and the fitting, because a `.tsx` that imports
 * `react-native` **cannot be reached by `check:lib`**. ⚠️ The numbers there MIRROR the PNGs on disk,
 * and §29 reads each file's **IHDR** to prove they still agree — a mirror that drifts is worse than
 * no mirror at all.
 */

import { Image, type ImageSourcePropType } from 'react-native';

import type { OfferingCode } from '@/domain/catalogue';
import { artSize, fitArt } from '@/lib/offering-art';

/**
 * ⚠️ **STATIC `require`s, one per code.** Metro resolves these at BUILD time, so a computed path
 * (`require(\`…/${code}.png\`)`) bundles nothing and fails only on a device — which is why this is a
 * literal map and why §29 asserts every catalogue code has an entry.
 */
const ART: Record<OfferingCode, ImageSourcePropType> = {
  joss_paper_stack: require('../../assets/offerings/joss_paper_stack.png'),
  gold_bar: require('../../assets/offerings/gold_bar.png'),
  smartphone: require('../../assets/offerings/smartphone.png'),
  house: require('../../assets/offerings/house.png'),
  wealth_bundle: require('../../assets/offerings/wealth_bundle.png'),
};

/** ⚠️ Every code the catalogue ships — the ONE list, so a sixth item cannot be half-wired. */
export function artCodes(): readonly OfferingCode[] {
  return Object.keys(ART) as OfferingCode[];
}

/**
 * The illustration for a catalogue code, contained in the box the caller gives.
 *
 * ⚠️ `resizeMode="contain"`, never `cover`: the aspects differ (0.50 for the phone against 1.44 for
 * the bundle), so `cover` would crop the tall one and letterbox nothing. ⚠️ And **no
 * `backgroundColor`** — the cut-out's whole value is its transparency, and a background behind it
 * paints the pixels stage ④ just removed (the defect `check:sprite` exists for).
 */
export function OfferingArt({
  code,
  boxW,
  boxH,
}: {
  code: OfferingCode;
  boxW: number;
  boxH: number;
}) {
  const { width, height } = fitArt(code, boxW, boxH);
  return <Image source={ART[code]} style={{ width, height }} resizeMode="contain" accessibilityIgnoresInvertColors />;
}

/** ⚠️ The art's own box, re-exported so callers do not reach into the lib for it. */
export { artSize };
