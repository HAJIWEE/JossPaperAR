/**
 * The offerings on the altar — candles, incense and the burner (SCRUM-162).
 *
 * ── PORTED, NOT REDRAWN ─────────────────────────────────────────────────────
 * `art · offerings (front)`, 330 × 170. It is a group of **seven sub-groups / 19 shapes**,
 * all exported through the Penpot plugin on 2026-10-31 and transcribed verbatim.
 *
 * ⚠️ **THE COORDINATES ARE FOLDED INTO ONE SPACE, DELIBERATELY.** The board keeps the 19
 * shapes inside an inner group that sits at `y 68`; every path below has that **+68**
 * applied already, so a single `viewBox="0 0 330 170"` draws the whole thing and there is
 * no nested translate to drift. Check one: the left candle body is `M50,36…` in the group
 * and `M50,104…` here, and 104 − 36 = 68.
 *
 * ⚠️ **This is why the shapes are listed in PAINT ORDER, not id order**: the smoke is
 * behind the incense, the incense behind the burner, and the burner behind its own feet.
 * Re-ordering them changes the drawing.
 *
 * ⚠️ Art hexes, not tokens — except two. `#F5F0E8` (the candle bodies) **is
 * `surface.paper`**, and `#1A1A1A` is `brand.ink`; those two are written as tokens. The
 * other nine are the board's own pigments and `tokens.ts` has no role for illumination.
 * (`fire-art.tsx` sets the same precedent with 8.)
 *
 * ⚠️ Sizing comes from the parent band (`100%`) — the band carries the canvas scale.
 */

import Svg, { Ellipse, G, Path } from 'react-native-svg';

import { brand, surface } from '@/theme/tokens';

/** The board's own pigments — `art · offerings (front)`, read 2026-10-31. */
const ART = {
  /** The tray / dish lips. */
  tray: '#E0C77E',
  /** The outer flame body. */
  flame: '#FF9A3C',
  /** The flame's outline, a burnt orange. */
  flameEdge: '#C2560F',
  /** The flame's core. */
  flameCore: '#FFF3D6',
  /** The glowing incense tips. */
  ember: '#E5531F',
  /** The burner's front face. */
  burner: '#C9A24B',
  /** …its shaded half. */
  burnerShade: '#B8863B',
  /** …and its feet, shared with the shrine base. */
  foot: '#8A5F26',
  /** The incense sticks. */
  stick: '#7A4A2B',
  /** The smoke wisps. */
  smoke: '#8A8175',
} as const;

export function Offerings() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 330 170">
      {/* ── smoke, furthest back — the board gives each wisp its own opacity ── */}
      <Path d="M156,64C144,44,164,30,152,4" fill="none" stroke={ART.smoke} strokeWidth={4}
        strokeLinecap="round" opacity={0.38} />
      <Path d="M174,60C186,42,166,26,178,0" fill="none" stroke={ART.smoke} strokeWidth={4}
        strokeLinecap="round" opacity={0.24} />

      {/* ── the incense: three sticks with glowing tips ── */}
      <G stroke={ART.stick} strokeWidth={3.5} strokeLinecap="round">
        <Path d="M156,122L156,76" />
        <Path d="M165,122L165,70" />
        <Path d="M174,122L174,76" />
      </G>
      <G fill={ART.ember}>
        <Ellipse cx={156} cy={76} rx={4} ry={4} />
        <Ellipse cx={165} cy={70} rx={4} ry={4} />
        <Ellipse cx={174} cy={76} rx={4} ry={4} />
      </G>

      {/* ── the burner: dish, front face, shaded half, two feet ── */}
      <Path d="M132,122L198,122L192,132L138,132Z" fill={ART.tray} stroke={brand.ink} strokeWidth={2.5} strokeLinejoin="round" />
      <Path d="M138,132L192,132L182,162L148,162Z" fill={ART.burner} stroke={brand.ink} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M138,132L165,132L165,162L148,162Z" fill={ART.burnerShade} stroke={brand.ink} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M144,162L152,162L150,170L146,170Z" fill={ART.foot} stroke={brand.ink} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M178,162L186,162L184,170L180,170Z" fill={ART.foot} stroke={brand.ink} strokeWidth={1.5} strokeLinejoin="round" />

      {/* ── the two outer trays ── */}
      <Path d="M0,150L32,150L27,158L5,158Z" fill={ART.tray} stroke={brand.ink} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M330,150L298,150L303,158L325,158Z" fill={ART.tray} stroke={brand.ink} strokeWidth={2} strokeLinejoin="round" />

      {/* ── the four candle flames sitting on those trays ── */}
      <G fill={ART.ember} stroke={brand.ink} strokeWidth={2} strokeLinejoin="round">
        <Ellipse cx={10} cy={76} rx={6} ry={6} />
        <Ellipse cx={22} cy={78} rx={6} ry={6} />
        <Ellipse cx={308} cy={76} rx={6} ry={6} />
        <Ellipse cx={320} cy={78} rx={6} ry={6} />
      </G>

      {/* ── the left candle: body, tray, flame, core ── */}
      <Path d="M50,104L58,104L58,154L50,154Z" fill={surface.paper} stroke={brand.ink} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M42,154L66,154L62,162L46,162Z" fill={ART.tray} stroke={brand.ink} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M54,68L64,90L54,106L44,90Z" fill={ART.flame} stroke={ART.flameEdge} strokeWidth={2.5} strokeLinejoin="round" />
      <Path d="M54,82L59,93L54,103L49,93Z" fill={ART.flameCore} stroke={brand.ink} strokeWidth={1.5} strokeLinejoin="round" />

      {/* ── the right candle: the same four shapes, mirrored about x 165 ── */}
      <Path d="M272,104L280,104L280,154L272,154Z" fill={surface.paper} stroke={brand.ink} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M264,154L288,154L284,162L268,162Z" fill={ART.tray} stroke={brand.ink} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M276,68L286,90L276,106L266,90Z" fill={ART.flame} stroke={ART.flameEdge} strokeWidth={2.5} strokeLinejoin="round" />
      <Path d="M276,82L281,93L276,103L271,93Z" fill={ART.flameCore} stroke={brand.ink} strokeWidth={1.5} strokeLinejoin="round" />
    </Svg>
  );
}
