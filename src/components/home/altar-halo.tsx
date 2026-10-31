/**
 * The altar halo — the gold glow behind the shrine (SCRUM-162).
 *
 * ── PORTED, NOT REDRAWN ─────────────────────────────────────────────────────
 * `art · altar halo (gradient)`, 354 × 420, exported through the Penpot plugin on
 * 2026-10-31. It is a single **radial** gradient: `#d4af37` at **0.15** opacity in the
 * centre `(177, 215)`, fading to **0** at radius **240**.
 *
 * ✅ `#d4af37` **is** `brand.gold`, so it is written as a token and cannot drift.
 *
 * ⚠️ One simplification, stated rather than hidden: Penpot exports the gradient inside a
 * `pattern` with a `gradientTransform` matrix — its internal unit-space plumbing. The
 * visible result is a circle centred at `(177, 215)` with equal radius on both axes, so
 * this renders a `userSpaceOnUse` radial gradient with those numbers directly. If the
 * glow ever looks elliptical on glass, that transform is what to revisit first.
 *
 * ⚠️ Sizing comes from the parent band (`100%`) — the band carries the canvas scale.
 */

import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { brand } from '@/theme/tokens';

export function AltarHalo() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 354 420">
      <Defs>
        <RadialGradient id="altar-halo" cx={177} cy={215} r={240} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={brand.gold} stopOpacity={0.15} />
          <Stop offset="0.75" stopColor={brand.gold} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={354} height={420} fill="url(#altar-halo)" />
    </Svg>
  );
}
