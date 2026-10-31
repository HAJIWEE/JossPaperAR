/**
 * The shrine base — the table the offerings rest on (SCRUM-162).
 *
 * ── PORTED, NOT REDRAWN ─────────────────────────────────────────────────────
 * Every path below is **verbatim** from the board's `art · shrine base (table)`
 * group in Penpot (`EN · 1 Home / Shrine`, file `JossPaperAR`), exported as SVG on
 * 2026-10-31 and transcribed with no geometry change. ⚠️ **Do not "tidy" the path
 * data** — the low-poly silhouette is the art direction (doc 05 §2).
 *
 * ⚠️ **Penpot exports each shape TWICE — a `fills` path and a `strokes` path for the
 * same `d`.** Merging each pair into one `<Path fill stroke strokeWidth>` is
 * deliberate and halves the node count; the pair is the same geometry, so nothing
 * is lost. Ten shapes become ten paths.
 *
 * ── WHY VECTORS, NOT AN IMAGE ───────────────────────────────────────────────
 * The same reason as `fire-art.tsx`: the art and the layout bands have to stay in
 * ONE px space. `HOME_BANDS.shrineBase` is 358×76 board px and the `viewBox` here is
 * 358×76, so at the 390 px reference the drawing is 1:1 and a future band change is
 * a scaled render rather than a re-export.
 *
 * ⚠️ Art hexes are allowed here and ONLY here — the screen itself carries none
 * (`check` enforces that on the shrine; `fire-art.tsx` sets the precedent with 8).
 * These five values are the board's own fills, not tokens: they are illumination on
 * the altar, not UI colour, and `tokens.ts` has no role for them.
 */

import Svg, { G, Path } from 'react-native-svg';

/** The board's own fills — `art · shrine base (table)`, read 2026-10-31. */
const ART = {
  /** The table's top plane. */
  top: '#D9B968',
  /** The table's front face. */
  face: '#9A6E2C',
  /** The gold trim, the incense stems and the two front legs. */
  gold: '#D4AF37',
  /** The centre plaque. */
  plaque: '#F0C75E',
  /** The rear legs, in shadow. */
  leg: '#8A5F26',
  /** The ink outline every shape shares. */
  ink: '#1A1A1A',
} as const;

export function ShrineBase() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 358 76">
      <G strokeLinejoin="round">
        {/* the table top */}
        <Path d="M14,0L344,0L358,12L0,12Z" fill={ART.top} stroke={ART.ink} strokeWidth={3} />
        {/* the front face */}
        <Path d="M0,12L358,12L358,48L0,48Z" fill={ART.face} stroke={ART.ink} strokeWidth={3} />
        {/* the gold trim line */}
        <Path d="M0,46L358,46L358,50L0,50Z" fill={ART.gold} stroke={ART.ink} strokeWidth={2} />
        {/* the centre plaque */}
        <Path d="M179,20L191,30L179,40L167,30Z" fill={ART.plaque} stroke={ART.ink} strokeWidth={2.5} />
        {/* left incense stem + its tray */}
        <Path d="M44,50L44,62" fill="none" stroke={ART.gold} strokeWidth={2.5} />
        <Path d="M38,62L50,62L47,76L41,76Z" fill={ART.gold} stroke={ART.ink} strokeWidth={2} />
        {/* right incense stem + its tray */}
        <Path d="M314,50L314,62" fill="none" stroke={ART.gold} strokeWidth={2.5} />
        <Path d="M308,62L320,62L317,76L311,76Z" fill={ART.gold} stroke={ART.ink} strokeWidth={2} />
        {/* the front legs */}
        <Path d="M32,50L68,50L58,72L42,72Z" fill={ART.leg} stroke={ART.ink} strokeWidth={3} />
        <Path d="M326,50L290,50L300,72L314,72Z" fill={ART.leg} stroke={ART.ink} strokeWidth={3} />
      </G>
    </Svg>
  );
}
