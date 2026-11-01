/**
 * The header's two drawings — the app mark and the settings gear (SCRUM-162).
 *
 * ── PORTED, NOT REDRAWN ─────────────────────────────────────────────────────
 * Geometry is **verbatim** from the board's `icon · app mark (header)` (53.012 × 53.012,
 * 12 children) and `icon · settings (gear, vector)` (20 × 20), exported as SVG through the
 * Penpot plugin on 2026-10-31.
 *
 * ⚠️ Penpot exports each shape TWICE — a `fills` path and a `strokes` path with the SAME
 * geometry. Merging each pair into one element halves the node count and loses nothing.
 * ⚠️ The exported outer `<g>` also carries a `display: none` rect (the group's own bounds
 * placeholder) — dropped, it draws nothing.
 *
 * ── THE MARK IS TOKEN-COLOURED, THE GEAR IS NOT ─────────────────────────────
 * ✅ Every fill in the mark **is a token** — `#1A1A1A` ink, `#F0C75E` goldBright,
 * `#D4AF37` gold, `#C23B22` cinnabar — so it is written with `brand.*` and cannot drift
 * from `tokens.css`.
 * ⚠️ The gear's inner disc is the exported `#EAE2D2` (paperDeep), which reads as a
 * **cut-out**: on the header's own cream it must show *through*, so it is filled with
 * `surface.paper` — the shrine's background — not paperDeep. That is the one deliberate
 * departure, and it is the difference between a hole and a smudge.
 *
 * ── SIZING ──────────────────────────────────────────────────────────────────
 * ⚠️ Both take their size **from the parent band** (`100%`), never from a number here.
 * The band is what carries the canvas scale (`bandRect`), so a second scale inside the
 * art would be applied twice — the exact bug SCRUM-162 shipped with the shrine base.
 */

import Svg, { Ellipse, G, Path, Rect } from 'react-native-svg';

import { brand, surface } from '@/theme/tokens';

export function AppMark() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 53.012 53.012">
      {/* the bracketed frame — 8 bars, 2 per corner */}
      <G fill={brand.ink}>
        <Rect x={4.506} y={4.506} width={2.651} height={10.337} rx={1.325} />
        <Rect x={4.506} y={4.506} width={10.337} height={2.651} rx={1.325} />
        <Rect x={45.855} y={4.506} width={2.651} height={10.337} rx={1.325} />
        <Rect x={38.169} y={4.506} width={10.337} height={2.651} rx={1.325} />
        <Rect x={45.855} y={38.169} width={2.651} height={10.337} rx={1.325} />
        <Rect x={38.169} y={45.855} width={10.337} height={2.651} rx={1.325} />
        <Rect x={4.506} y={38.169} width={2.651} height={10.337} rx={1.325} />
        <Rect x={4.506} y={45.855} width={10.337} height={2.651} rx={1.325} />
      </G>
      {/* the gold tablet, its ink border, the cinnabar ring, the diamond */}
      <Rect x={12.723} y={12.723} width={27.566} height={27.566} rx={8}
        fill={brand.goldBright} stroke={brand.ink} strokeWidth={8} />
      <Rect x={19.614} y={19.614} width={13.783} height={13.783} rx={3}
        fill={brand.gold} stroke={brand.cinnabar} strokeWidth={9} />
      <Path d="M22.795,26.506L26.506,22.795L30.217,26.506L26.506,30.217Z"
        fill={brand.goldBright} stroke={brand.ink} strokeWidth={5} strokeLinejoin="round" />
    </Svg>
  );
}

export function SettingsGear() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 20 20">
      <Path
        d="M8.05,0.81L8.69,0.69L9.34,0.62L10,0.6L10.66,0.62L11.31,0.69L11.95,0.81L11.76,3.43L12.33,3.61L12.87,3.84L13.4,4.11L15.12,2.12L15.66,2.49L16.17,2.91L16.65,3.35L17.09,3.83L17.51,4.34L17.88,4.88L15.89,6.6L16.16,7.13L16.39,7.67L16.57,8.24L19.19,8.05L19.31,8.69L19.38,9.34L19.4,10L19.38,10.66L19.31,11.31L19.19,11.95L16.57,11.76L16.39,12.33L16.16,12.87L15.89,13.4L17.88,15.12L17.51,15.66L17.09,16.17L16.65,16.65L16.17,17.09L15.66,17.51L15.12,17.88L13.4,15.89L12.87,16.16L12.33,16.39L11.76,16.57L11.95,19.19L11.31,19.31L10.66,19.38L10,19.4L9.34,19.38L8.69,19.31L8.05,19.19L8.24,16.57L7.67,16.39L7.13,16.16L6.6,15.89L4.88,17.88L4.34,17.51L3.83,17.09L3.35,16.65L2.91,16.17L2.49,15.66L2.12,15.12L4.11,13.4L3.84,12.87L3.61,12.33L3.43,11.76L0.81,11.95L0.69,11.31L0.62,10.66L0.6,10L0.62,9.34L0.69,8.69L0.81,8.05L3.43,8.24L3.61,7.67L3.84,7.13L4.11,6.6L2.12,4.88L2.49,4.34L2.91,3.83L3.35,3.35L3.83,2.91L4.34,2.49L4.88,2.12L6.6,4.11L7.13,3.84L7.67,3.61L8.24,3.43Z"
        fill={brand.ink}
      />
      <Ellipse cx={10} cy={10} rx={3.3} ry={3.3} fill={surface.paper} />
    </Svg>
  );
}
