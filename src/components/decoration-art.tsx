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

import Svg, { G, Path, Rect } from 'react-native-svg';

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

/**
 * `art · Lanterns` — 85.1 × 72, the SEVEN-B card painting: a gold bar above TWO hexagonal lanterns, each traced
 * as a PATH (not a stack of rects), with gold caps, a tassel bead and a tassel. Read off `EN · 7b`, 2026-11-08.
 * ⚠️ This replaces a port of `decor · lantern (top-left)` (52 × 66) — the single lantern the SHRINE hangs, which
 * is the wrong drawing for a store card and is why the card looked off.
 * ⚠️ The circles (`e` on the board) are rects with `rx` = half their width; the board draws no ovals here. ⚠️ The board's
 * hanging cords are `#121418`, which is darker than any token; they are drawn as `ink` rather than adding a
 * one-off hex, so the art stays inside the token set.
 */
const LANTERN: { box: readonly [number, number]; inks: readonly Ink[]; trails: readonly Trail[] } = {
  box: [85.1, 72],
  inks: [
    { x: 10.5, y: 3.9, w: 64.2, h: 3.3, rx: 2.5, fill: 'goldDeep', stroke: 'ink', sw: 2 },
    // ── left lantern ──
    { x: 29.1, y: 7.2, w: 2, h: 9.2, fill: 'ink' },
    { x: 24.9, y: 15.7, w: 10.5, h: 3.9, rx: 2, fill: 'goldDeep', stroke: 'ink', sw: 2 },
    { x: 29.6, y: 19.6, w: 1, h: 20.9, fill: 'goldBright' },
    { x: 26.2, y: 39.9, w: 7.9, h: 3.3, rx: 2, fill: 'goldDeep', stroke: 'ink', sw: 2 },
    { x: 28.1, y: 43.2, w: 3.9, h: 3.9, rx: 1.95, fill: 'goldBright' },
    { x: 29.1, y: 46.5, w: 2, h: 10.5, fill: 'goldBright' },
    // ── right lantern ──
    { x: 54, y: 7.2, w: 2, h: 9.2, fill: 'ink' },
    { x: 49.8, y: 15.7, w: 10.5, h: 3.9, rx: 2, fill: 'goldDeep', stroke: 'ink', sw: 2 },
    { x: 54.5, y: 19.6, w: 1, h: 20.9, fill: 'goldBright' },
    { x: 51.1, y: 39.9, w: 7.9, h: 3.3, rx: 2, fill: 'goldDeep', stroke: 'ink', sw: 2 },
    { x: 53, y: 43.2, w: 3.9, h: 3.9, rx: 1.95, fill: 'goldBright' },
    { x: 54, y: 46.5, w: 2, h: 10.5, fill: 'goldBright' },
  ],
  trails: [
    { d: 'M4253.6201171875,777.1090698242188L4260.166015625,766.6363525390625L4273.25830078125,766.6363525390625L4279.8046875,777.1090698242188L4273.25830078125,787.5818481445312L4260.166015625,787.5818481445312Z',
      dx: -4236.62, dy: -747.04, fill: 'cinnabar', stroke: 'ink', sw: 3 },
    { d: 'M4278.49560546875,777.1090698242188L4285.04150390625,766.6363525390625L4298.1337890625,766.6363525390625L4304.68017578125,777.1090698242188L4298.1337890625,787.5818481445312L4285.04150390625,787.5818481445312Z',
      dx: -4236.6, dy: -747.04, fill: 'cinnabar', stroke: 'ink', sw: 3 },
  ],
};

/**
 * `art · Spring Couplets` — 85.1 × 72, the SEVEN-B-a card painting: a horizontal scroll above TWO vertical
 * ones. ⚠️ This replaces an earlier port of `decor · couplet (side-left)` (41 × 160), which is the single scroll
 * the SHRINE hangs — the wrong drawing for a store card. Read off `EN · 7b` on 2026-11-08.
 */
const COUPLET: { box: readonly [number, number]; inks: readonly Ink[]; trails: readonly Trail[] } = {
  box: [85.1, 72],
  trails: [],
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
const MOTIFS: Record<DecorationCode, { box: readonly [number, number]; inks: readonly Ink[]; trails: readonly Trail[] } | null> = {
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
/**
 * ⚠️ A traced PATH, in the board's own `d` data.
 * ⚠️⚠️ Penpot writes path data in ABSOLUTE board coordinates (`M4253.6,777.1L…`), so a `d` cannot simply be
 * dropped into a motif's small viewBox — each one carries the translate that brings it back to the motif's
 * origin. ⚠️ The numbers below are the group's own absolute origin, subtracted once at read time.
 */
interface Trail {
  readonly d: string;
  readonly dx: number;
  readonly dy: number;
  readonly fill: TokenKey | null;
  readonly stroke?: TokenKey;
  readonly sw?: number;
}

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
      {/* ⚠️ Traced paths last, so a body is never covered by a later rectangle. */}
      {motif.trails.map((t, i) => (
        <G key={`t${i}`} transform={`translate(${t.dx}, ${t.dy})`}>
          <Path
            d={t.d}
            fill={t.fill === null ? 'none' : C(t.fill)}
            stroke={t.stroke === undefined ? undefined : C(t.stroke)}
            strokeWidth={t.sw ?? 0}
            strokeLinejoin="round"
          />
        </G>
      ))}
    </Svg>
  );
}

/** ⚠️ The paper tone, exported so a caller can check contrast without reaching into the theme. */
export const DECORATION_GROUND = surface.paper;
