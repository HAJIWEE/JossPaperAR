/**
 * The fire — the aim target on BURN (doc 17 §2 A5 · ADR-003).
 *
 * ⚠️ DRAWN AS VECTORS, NOT EXPORTED AS AN IMAGE. The four aim bands were measured
 * off this artwork's heart (doc 05 §2), so the artwork and the thresholds have to
 * stay in the SAME px space. A 1×/2×/3× image export picks its own scale, which
 * would silently rescale the target underneath the grader at `HEART_AT`. Here the
 * scale is OURS, in code, and the grader is told about it — see `ART_SCALE`.
 *
 * The three layers (glow · sight · flame) are positioned from ONE anchor — the
 * heart — so they cannot drift apart on a different screen size or aspect ratio.
 *
 * Geometry is taken verbatim from the board's `art · fire` group. The flame stack
 * is one silhouette replicated three times: layer 2 is layer 1 scaled by 0.6964
 * about (1795, 648.2), which checks out on all three axis pairs (top, widest,
 * bottom), and layers 3–4 continue that same geometric progression.
 */

import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Defs, G, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

/** Penpot art space. 1 unit = 1 dp. */
const ART = {
  viewBox: '1700 540 190 190',
  /** The flame's heart — the exact point `HEART_AT` grades against. */
  heart: { x: 1795, y: 648.5 } as const,
  /** The art box's top-left, in Penpot units — the anchor arithmetic below. */
  origin: { x: 1700, y: 540 } as const,
  size: 190,
  glow: 300,
} as const;

/**
 * How large the drawing is rendered, as a fraction of its Penpot size.
 *
 * ⚠️ THIS SCALE IS NOT FREE, AND THE BANDS DO NOT MOVE WITH IT. `aim.ts`'s four
 * thresholds (±14.55 · ±39.40 · ±96.97) are the fire's OWN proportions in Penpot
 * units — the heart ticks, the flame's half-width, the ember bed's edge. Render
 * the art at 0.9 and the flame's visible half-width becomes 33.7 dp while 虔诚's
 * threshold is still 39.40, so the boundary would fall OUTSIDE the flame and a
 * throw that visibly misses would still pay ×1.5. The screen therefore divides
 * the measured offset by this constant before `gradeThrow` (`burn.tsx`), which
 * keeps every band on the same part of the drawing at any size.
 */
export const ART_SCALE = 0.9;

/** The flame's tip in Penpot units — the highest point of `FLAME_PATH`. */
const FLAME_TIP_Y = 543.76;

/** How far the tip sits above the heart, in dp at the current scale. */
export const FLAME_TOP_ABOVE_HEART = (ART.heart.y - FLAME_TIP_Y) * ART_SCALE;

/** What the fire does when an offering lands on it: a hit flares, a graze smoulders. */
export type FireReaction = 'flare' | 'smoulder';

/** The outer silhouette. Every layer below is this path, scaled. */
const FLAME_PATH =
  'M1795,543.76 L1822.36,607.12 L1832.44,658.96 L1795,705.04 L1757.56,658.96 L1767.64,607.12 Z';

/** Coolest → hottest. Penpot fill colours, not theme tokens: they are artwork. */
const FLAME_FILLS = ['#e5531f', '#ff9a3c', '#ffd98a', '#fff3d6'] as const;

/** The relation the board itself uses between layer 1 and layer 2. */
const LAYER_SCALE = 0.6964;
const FOCUS = { x: 1795, y: 648.2 } as const;

/** The radial glow: 300 × 300 centred on the flame, fading out by 70% of its radius. */
const GLOW_STOPS = [
  { offset: 0, color: '#ff9a3c', opacity: 0.55 },
  { offset: 0.45, color: '#e5531f', opacity: 0.28 },
  { offset: 0.7, color: '#e5531f', opacity: 0 },
] as const;

/** 9 × 9 drifting embers, scattered outside the flame so they read as sparks. */
const EMBERS = [
  { x: 1745.14, y: 648.14 },
  { x: 1819.14, y: 640.14 },
  { x: 1781.14, y: 630.14 },
  { x: 1845.14, y: 658.14 },
  { x: 1729.14, y: 665.14 },
] as const;
const EMBER_SIZE = 9;

/**
 * The ember bed: five overlapping triangles fanning from the base line. The edges
 * are the midpoints between neighbouring apexes — so the fan tiles with no gaps and
 * stays mirror-symmetric about the heart, which the raw numbers on their own do not.
 */
const BED = {
  apex: [1723.24, 1756.36, 1795, 1833.64, 1866.76],
  edge: [1703, 1739.8, 1775.68, 1814.32, 1850.2, 1887],
  apexY: 709.68,
  baseY: 724.4,
  fill: ['#b33a12', '#7a2e12', '#e5531f', '#7a2e12', '#b33a12'],
  stroke: '#5c1f0a',
  strokeWidth: 2.5,
} as const;

/**
 * The aim sight: 21 dashes spanning 242 units, centred on the heart, with the three
 * nearest the middle dropped to leave room for the two heart ticks. Subtle on
 * purpose (0.34) — it marks the heart without covering the flame it grades against.
 */
const SIGHT = {
  height: 14,
  spacing: 12,
  dashWidth: 2,
  dashHeight: 3,
  tickHeight: 10,
  tickOffset: 14.55,
  centreGap: 1,
  colour: '#f0c75e',
  opacity: 0.34,
} as const;

interface Props {
  /** Screen width in dp — the sight spans it, so it needs the measured value. */
  readonly width: number;
  /** Screen px of the flame's heart. Bands are graded against exactly this point. */
  readonly heartX: number;
  readonly heartY: number;
  /**
   * The fire's answer to an offering that has just landed. `null` before the
   * first throw, and on a miss — the fire does not take what fell outside it.
   */
  readonly reaction?: FireReaction | null;
  /** Bumped per throw, so two grazes in a row still both smoulder. */
  readonly reactionNonce?: number;
}

export function FireArt({ width, heartX, heartY, reaction = null, reactionNonce = 0 }: Props) {
  /**
   * The reaction runs on the UI thread: a scale on two static layers is exactly
   * what the native driver is for, and this is the one animation on the screen
   * that must never miss a frame (doc 17 A2 — the fire has to answer the throw).
   *
   * ⚠️ The hooks come BEFORE the early return below. An early return above a hook
   * would change the hook count between renders the moment the layout arrives.
   */
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reaction === null) return;
    pulse.stopAnimation();
    pulse.setValue(0);
    // A flare is a struck flame: fast out, slower settle. A smoulder only swells
    // — the coals take the offering, but only just.
    const flare = reaction === 'flare';
    Animated.sequence([
      Animated.timing(pulse, {
        toValue: flare ? 1 : 0.4,
        duration: flare ? 130 : 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(pulse, {
        toValue: 0,
        duration: flare ? 340 : 460,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [reaction, reactionNonce, pulse]);

  if (width === 0 || heartX === 0 || heartY === 0) return null;

  // Anchor each layer by its own heart offset inside its art box, so the heart
  // lands on (heartX, heartY) rather than on some corner or centre. Every offset
  // is in Penpot units and every one of them is multiplied by the same scale.
  const flameSize = ART.size * ART_SCALE;
  const glowSize = ART.glow * ART_SCALE;
  const flameLeft = heartX - (ART.heart.x - ART.origin.x) * ART_SCALE;
  const flameTop = heartY - (ART.heart.y - ART.origin.y) * ART_SCALE;
  const glowLeft = heartX - glowSize / 2;
  const glowTop = heartY - glowSize / 2;

  // The sight is drawn in SCREEN space (it spans the width), but its spacing and
  // its ticks mark distances on the artwork — so they scale with it, or the
  // ticks would no longer sit on the bullseye's edge.
  const sightHeight = SIGHT.height * ART_SCALE;
  const sightTop = heartY - sightHeight / 2;
  const dashWidth = SIGHT.dashWidth * ART_SCALE;
  const dashHeight = SIGHT.dashHeight * ART_SCALE;

  const dashes: { x: number; y: number }[] = [];
  for (let n = -10; n <= 10; n += 1) {
    if (Math.abs(n) <= SIGHT.centreGap) continue;
    dashes.push({
      x: heartX + n * SIGHT.spacing * ART_SCALE - dashWidth / 2,
      y: (sightHeight - dashHeight) / 2,
    });
  }
  const tickY = (sightHeight - SIGHT.tickHeight * ART_SCALE) / 2;

  // The glow is centred on the heart, so scaling it about its own centre IS
  // scaling about the heart. The flame's box is centred slightly below it, so at
  // peak flare the heart drifts ~1 dp — invisible, transient, and it returns to
  // exactly 1. The grade is computed at release, before any of this runs.
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] });
  const flameScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <>
      {/* Glow — the warm halo the camera image shows through. Centred on the
          heart, so its reaction scales about the point being graded. */}
      <Animated.View
        style={{
          position: 'absolute',
          left: glowLeft,
          top: glowTop,
          width: glowSize,
          height: glowSize,
          transform: [{ scale: glowScale }],
        }}
      >
        <Svg width={glowSize} height={glowSize}>
          <Defs>
            <RadialGradient
              id="fire-glow"
              cx={glowSize / 2}
              cy={glowSize / 2}
              r={glowSize / 2}
              gradientUnits="userSpaceOnUse"
            >
              {GLOW_STOPS.map((s) => (
                <Stop key={s.offset} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />
              ))}
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={glowSize} height={glowSize} fill="url(#fire-glow)" />
        </Svg>
      </Animated.View>

      {/* The flame itself: embers behind, then the stack coolest layer first. */}
      <Animated.View
        style={{
          position: 'absolute',
          left: flameLeft,
          top: flameTop,
          width: flameSize,
          height: flameSize,
          transform: [{ scale: flameScale }],
        }}
      >
        <Svg width={flameSize} height={flameSize} viewBox={ART.viewBox}>
          {EMBERS.map((e) => (
            <Rect
              key={`${e.x}-${e.y}`}
              x={e.x}
              y={e.y}
              width={EMBER_SIZE}
              height={EMBER_SIZE}
              fill="#ffd98a"
              opacity={0.75}
            />
          ))}

          {FLAME_FILLS.map((fill, i) => {
            const k = LAYER_SCALE ** i;
            return (
              <G
                key={fill}
                transform={`translate(${FOCUS.x} ${FOCUS.y}) scale(${k}) translate(${-FOCUS.x} ${-FOCUS.y})`}
              >
                <Path d={FLAME_PATH} fill={fill} />
              </G>
            );
          })}

          {BED.apex.map((apex, i) => (
            <Polygon
              key={apex}
              points={`${BED.edge[i]},${BED.baseY} ${apex},${BED.apexY} ${BED.edge[i + 1]},${BED.baseY}`}
              fill={BED.fill[i]}
              stroke={BED.stroke}
              strokeWidth={BED.strokeWidth}
              strokeLinejoin="round"
            />
          ))}
        </Svg>
      </Animated.View>

      {/* Aim sight — the reticle the 120 dp heart disc used to stand in for. */}
      <Svg width={width} height={sightHeight} style={{ position: 'absolute', left: 0, top: sightTop }}>
        <G fill={SIGHT.colour} opacity={SIGHT.opacity}>
          {dashes.map((d) => (
            <Rect key={d.x} x={d.x} y={d.y} width={dashWidth} height={dashHeight} />
          ))}
          <Rect
            x={heartX - SIGHT.tickOffset * ART_SCALE - dashWidth / 2}
            y={tickY}
            width={dashWidth}
            height={SIGHT.tickHeight * ART_SCALE}
          />
          <Rect
            x={heartX + SIGHT.tickOffset * ART_SCALE - dashWidth / 2}
            y={tickY}
            width={dashWidth}
            height={SIGHT.tickHeight * ART_SCALE}
          />
        </G>
      </Svg>
    </>
  );
}
