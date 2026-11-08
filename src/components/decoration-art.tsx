/**
 * THE DECORATION ART — hand-ported from Penpot as `react-native-svg` (SCRUM-212 · owner, 2026-11-08).
 *
 * ── ⚠️ WHY THESE ARE SVG WHEN THE OFFERINGS ARE RASTERS ──────────────────────
 * The offerings are **photoreal objects**, and their rasters were regenerated through the pipeline precisely so
 * they would match the low-poly camera capture (`offering-art.tsx` records that decision). ⚠️ **Decorations are
 * the opposite kind of drawing — printed, flat and graphic** (couplets, door gods, lanterns are ink-on-paper
 * motifs). Here the flat-vector look is *correct*, it recolours with the token set, and it costs no bundle size.
 *
 * ── ⚠️ TRANSCRIBED, NEVER DRAWN ─────────────────────────────────────────────
 * Every coordinate is the board's own, read out of the Penpot shapes on 2026-11-08 and normalised to each motif's
 * own box. ⚠️ Nothing is estimated: if a value looks odd, the board says so.
 *
 * ⚠️⚠️ **AND THE BOARD IS NOT COMPLETE — SAY SO RATHER THAN INVENTING.** Two of the four card icons
 * (`option · couplets (icon)`, `option · zhongkui (icon)`) are **byte-identical to `option · lanterns (icon)`** —
 * copy-paste placeholders, not art. So those two are ported from the **real in-situ motifs** instead. ⚠️
 * `festive_set` has no drawing of its own: the board shows it as the *assembled* home
 * (`EN · 1e Home / decorated (festive set)`), so it must be composed from the parts rather than traced.
 */

import Svg, { Rect } from 'react-native-svg';

import type { DecorationCode } from '@/domain/catalogue';
import { brand, surface } from '@/theme/tokens';

/**
 * ⚠️ One rect of a motif, in the BOARD's own numbers.
 * ⚠️ The board's `fill: null` / `stroke: null` rectangles are the GROUP'S OWN BOUNDS PLACEHOLDERS and draw
 * nothing — they are dropped rather than ported, exactly as the app mark drops the same rect (see header-art.tsx).
 *
 * `fill`/`stroke` are token KEYS, never hex — so the art follows `tokens.ts` like every other illustration and
 * cannot drift from the theme.
 */
type TokenKey = keyof typeof brand;

interface Ink {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly rx?: number;
  readonly fill: TokenKey;
  readonly stroke?: TokenKey;
  readonly sw?: number;
}

/** ⚠️ Typed on `brand`'s own keys, so a mistyped token is a COMPILE error rather than a silent `undefined` fill. */
const C = (k: TokenKey) => brand[k];

/** `decor · lantern (top-left)` — 52 × 66, 6 painted shapes. The lantern pair at the head of the altar. */
const LANTERN: { box: readonly [number, number]; inks: readonly Ink[] } = {
  box: [52, 66],
  inks: [
    { x: 15.6, y: 0, w: 20.8, h: 1.4, fill: 'ink' },
    { x: 6.5, y: 1.4, w: 39, h: 9.7, rx: 2, fill: 'cinnabar', stroke: 'ink', sw: 2.4 },
    { x: 11.4, y: 4.4, w: 7.2, h: 4.2, fill: 'goldBright', stroke: 'ink', sw: 1.6 },
    { x: 22.4, y: 4.4, w: 7.2, h: 4.2, fill: 'goldBright', stroke: 'ink', sw: 1.6 },
    { x: 33.4, y: 4.4, w: 7.2, h: 4.2, fill: 'goldBright', stroke: 'ink', sw: 1.6 },
    { x: 11.1, y: 14.6, w: 29.8, h: 43.4, rx: 14.9, fill: 'cinnabar', stroke: 'ink', sw: 2.6 },
    { x: 24, y: 22, w: 4, h: 4, fill: 'goldBright', stroke: 'ink', sw: 1.4 },
    { x: 24, y: 60, w: 4, h: 4, fill: 'goldBright', stroke: 'ink', sw: 1.4 },
  ],
};

/**
 * `art · Spring Couplets` — 85.1 × 72, the SEVEN-B-a card painting: a horizontal scroll above TWO vertical
 * ones. ⚠️ This replaces an earlier port of `decor · couplet (side-left)` (41 × 160), which is the single scroll
 * the SHRINE hangs — the wrong drawing for a store card. Read off `EN · 7b` on 2026-11-08.
 */
const COUPLET: { box: readonly [number, number]; inks: readonly Ink[] } = {
  box: [85.1, 72],
  inks: [
    // the horizontal scroll, with its three gold blocks
    { x: 9.2, y: 5.2, w: 66.8, h: 17, rx: 3, fill: 'cinnabar', stroke: 'ink', sw: 3 },
    { x: 18.3, y: 9.8, w: 13.1, h: 7.9, fill: 'goldBright', stroke: 'ink', sw: 2 },
    { x: 36, y: 9.8, w: 13.1, h: 7.9, fill: 'goldBright', stroke: 'ink', sw: 2 },
    { x: 53.7, y: 9.8, w: 13.1, h: 7.9, fill: 'goldBright', stroke: 'ink', sw: 2 },
    // the left scroll and its three character blocks (the last is a half block, as drawn)
    { x: 14.4, y: 27.5, w: 23.6, h: 40.6, rx: 3, fill: 'cinnabar', stroke: 'ink', sw: 3 },
    { x: 19.6, y: 32.7, w: 13.1, h: 9.8, fill: 'goldBright', stroke: 'ink', sw: 2 },
    { x: 19.6, y: 45.8, w: 13.1, h: 9.8, fill: 'goldBright', stroke: 'ink', sw: 2 },
    { x: 19.6, y: 58.9, w: 13.1, h: 5.2, fill: 'goldBright', stroke: 'ink', sw: 2 },
    // the right scroll
    { x: 47.1, y: 27.5, w: 23.6, h: 40.6, rx: 3, fill: 'cinnabar', stroke: 'ink', sw: 3 },
    { x: 52.4, y: 32.7, w: 13.1, h: 9.8, fill: 'goldBright', stroke: 'ink', sw: 2 },
    { x: 52.4, y: 45.8, w: 13.1, h: 9.8, fill: 'goldBright', stroke: 'ink', sw: 2 },
    { x: 52.4, y: 58.9, w: 13.1, h: 5.2, fill: 'goldBright', stroke: 'ink', sw: 2 },
  ],
};

/**
 * ⚠️ Every catalogue code maps to a motif or to `null`.
 * ⚠️ **`null` is an honest state, not a gap to fill with a guess**: the screen draws a placeholder tile and says
 * the art is pending. ⚠️ Reusing one lantern for four decorations would be worse than a placeholder, because it
 * looks finished.
 */
const MOTIFS: Record<DecorationCode, { box: readonly [number, number]; inks: readonly Ink[] } | null> = {
  lanterns: LANTERN,
  spring_couplets: COUPLET,
  zhong_kui: null,
  door_gods: null,
  festive_set: null,
};

/** ⚠️ Read by `check:lib`, so "which are ported?" is DATA rather than prose in this header. */
export function portedDecorationCodes(): readonly DecorationCode[] {
  return (Object.keys(MOTIFS) as DecorationCode[]).filter((c) => MOTIFS[c] !== null);
}

/**
 * Draw one decoration, contained in the box the caller gives.
 *
 * ⚠️ `viewBox` is the MOTIF's own box, so each keeps its aspect (0.79 for the lantern against 0.26 for the
 * couplet) — the caller sets the box and the art fits inside it rather than being squashed to it.
 * ⚠️ No background is painted: a decoration sits over the altar, and a filled backdrop would cover what it
 * decorates (the same reasoning as the cut-outs in `offering-art.tsx`).
 */
export function DecorationArt({ code, size }: { code: DecorationCode; size: number }) {
  const motif = MOTIFS[code];
  if (motif === null) {
    // ⚠️ A placeholder that LOOKS like a placeholder — never a stand-in motif.
    return (
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Rect x={2} y={2} width={36} height={36} rx={6} fill="none" stroke={brand.ink} strokeWidth={2} />
      </Svg>
    );
  }
  const [bw, bh] = motif.box;
  const scale = Math.min(size / bw, size / bh);
  return (
    <Svg width={bw * scale} height={bh * scale} viewBox={`0 0 ${bw} ${bh}`}>
      {motif.inks.map((r, i) => (
        <Rect
          key={i}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          rx={r.rx ?? 0}
          fill={C(r.fill)}
          stroke={r.stroke === undefined ? undefined : C(r.stroke)}
          strokeWidth={r.sw ?? 0}
        />
      ))}
    </Svg>
  );
}

/** ⚠️ The paper tone, exported so a caller can check contrast without reaching into the theme. */
export const DECORATION_GROUND = surface.paper;
