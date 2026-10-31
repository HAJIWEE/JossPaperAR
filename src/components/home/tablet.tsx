/**
 * The ancestral tablet (SCRUM-146).
 *
 * ── PORTED, NOT REDRAWN ─────────────────────────────────────────────────────
 * `tablet · centre (陈秀英)` on `EN · 1c Home / full (4 tablets)` — 128.6 × 307.211, seven
 * shapes exported through the Penpot plugin on 2026-10-31. ⚠️ Its band is **131,285 129×307**,
 * which is the SAME band as `slot · ＋ add a tablet` on the empty board — the two swap in place
 * (`altar.ts` explains why that matters).
 *
 * ⚠️ **The exported first layer is dropped.** `base-background` is a 129×307 rect with no fill
 * and no stroke — Penpot's own bounds placeholder, the same `display: none` shape every export
 * carries. Drawing it would paint nothing; keeping it would be a lie about the layer count.
 *
 * ⚠️ Two of the six colours are tokens (`brand.gold`, `brand.ink`); the four cinnabar shades are
 * the board's own pigments — a lacquered tablet is not UI chrome, and `tokens.ts` has no role
 * for it.
 *
 * ── THE NAME: VERTICAL FOR 中文, ROTATED FOR LATIN ──────────────────────────
 * ⚠️ The board's text layer for the name is **51 × 170** on a 93-wide tablet — tall and narrow,
 * i.e. one character per line, which is how a 牌位 is written. RN has no `writing-mode`, so the
 * characters are stacked as separate `Text` lines inside the gold frame. ⚠️ **Both the frame and
 * the type scale with the tablet**, so a 4× smaller peek tablet gets 4× smaller glyphs rather
 * than clipped ones.
 *
 * ⚠️ **A Latin name is NOT stacked.** `Chen` set one character per line is four lines of a single
 * letter — seen on the device 2026-10-31. It is set on one line and rotated 90° instead, so it
 * runs along the plaque like a spine. `nameOrientation()` owns that decision; see `tablet-name.ts`.
 */

import { Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { nameOrientation, rotatedNameSize } from '@/lib/tablet-name';
import { brand } from '@/theme/tokens';

/** The board's own pigments — `tablet · centre`, read 2026-10-31. */
const ART = {
  /** The crown. */
  crown: '#A33714',
  /** The left face, in shadow. */
  left: '#7A2412',
  /** The right face, lit. */
  right: '#8F2A0E',
  /** The plinth. */
  base: '#5C1F14',
} as const;

/** The exported viewBox — every number below is in these units. */
const VB = { w: 128.6, h: 307.211 } as const;

/** The gold inner frame. ⚠️ The name is centred inside THIS, not the tablet. */
export const TABLET_TEXT_BOX = { x: 28.578, y: 28.578, w: 71.444, h: 235.767 } as const;

/** The plate alone — no name. */
export function TabletPlate() {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${VB.w} ${VB.h}`}>
      <Path d="M25.006,0.0002L103.594,0.0002L117.883,42.866L10.717,42.866Z" fill={ART.crown} />
      <Path d="M10.717,42.866L64.3,42.866L64.3,285.778L10.717,285.778Z" fill={ART.left} />
      <Path d="M64.3,42.866L117.883,42.866L117.883,285.778L64.3,285.778Z" fill={ART.right} />
      <Path d="M0,285.778L128.6,285.778L128.6,307.211L0,307.211Z" fill={ART.base} />
      <Rect
        x={TABLET_TEXT_BOX.x}
        y={TABLET_TEXT_BOX.y}
        width={TABLET_TEXT_BOX.w}
        height={TABLET_TEXT_BOX.h}
        fill="none"
        stroke={brand.gold}
        strokeWidth={1}
      />
      <Path
        d="M0,307.211L0,285.778L10.717,285.778L10.717,42.866L25.006,0.0002L103.594,0.0002L117.883,42.866L117.883,285.778L128.6,285.778L128.6,307.211L0,307.211"
        fill="none"
        stroke={brand.ink}
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * A tablet with a name on it.
 *
 * ⚠️ `width`/`height` come from the BAND (`bandRect` already applied the canvas scale), never
 * from a number in here — that is the same rule every art component in this folder follows.
 */
export function Tablet({
  name,
  width,
  height,
  testID,
}: {
  name: string;
  width: number;
  height: number;
  testID?: string;
}) {
  const s = width / VB.w;
  const box = {
    left: TABLET_TEXT_BOX.x * s,
    top: TABLET_TEXT_BOX.y * s,
    width: TABLET_TEXT_BOX.w * s,
    height: TABLET_TEXT_BOX.h * s,
  };
  const chars = Array.from(name);
  const orientation = nameOrientation(name);
  // ⚠️ Fit the column, not the box: a long name gets smaller glyphs rather than overflowing the
  // gold frame. 1.08 is the board's own leading for stacked characters.
  const line = Math.min((box.width * 0.82), (box.height / Math.max(1, chars.length)) * 0.82);
  // ⚠️ Latin is set on ONE line and rotated: stacked, `Chen` is four lines of one letter.
  const rotatedSize = rotatedNameSize(box, Math.max(1, chars.length));

  return (
    <View style={{ width, height }} testID={testID}>
      <TabletPlate />
      <View style={[{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }, box]}>
        {orientation === 'vertical' ? (
          chars.map((ch, i) => (
            <Text
              key={`${i}-${ch}`}
              allowFontScaling={false}
              style={{ color: brand.gold, fontSize: line, lineHeight: line * 1.08, fontWeight: '600' }}
            >
              {ch}
            </Text>
          ))
        ) : (
          // ⚠️ The inner view is the frame with its axes SWAPPED, so its centre coincides with the
          // box centre and a 90° rotation lands exactly on the frame. Rotating a view laid out at
          // the unrotated size would hang the name off one end of the plaque.
          <View
            style={{
              width: box.height,
              height: box.width,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ rotate: '90deg' }],
            }}
          >
            <Text
              numberOfLines={1}
              allowFontScaling={false}
              style={{ color: brand.gold, fontSize: rotatedSize, fontWeight: '600' }}
            >
              {name.trim()}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
