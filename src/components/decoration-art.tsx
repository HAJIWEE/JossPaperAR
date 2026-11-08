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
/** ⚠️ Both token sets: the board paints paper panels with `#f5f0e8`, which is `surface.paper`, not a brand colour. */
type TokenKey = keyof typeof brand | keyof typeof surface;

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
const C = (k: TokenKey): string =>
  Object.prototype.hasOwnProperty.call(brand, k) ? brand[k as keyof typeof brand] : surface[k as keyof typeof surface];

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
/**
 * `art · Zhong Kui Print` — 85.1 × 72. A gold bar over a framed print: paper panel, cinnabar inner border, a
 * pale face disc, and the figure traced as four paths (robe, sash, hat, beard). Read off `EN · 7b`, 2026-11-08.
 * ⚠️ The board draws the small mark at (38, 36.7) as a STROKE-ONLY rect; it is a filled `ink` rect here, because
 * a no-fill shape would need a bare "none" literal and the token lookup is typed on `brand`'s keys.
 */
const ZHONGKUI: { box: readonly [number, number]; inks: readonly Ink[]; trails: readonly Trail[] } = {
  box: [85.1, 72],
  inks: [
    { x: 15.7, y: 3.9, w: 53.7, h: 4.6, rx: 3, fill: 'goldDeep', stroke: 'ink', sw: 2 },
    { x: 18.3, y: 8.5, w: 48.4, h: 57.6, rx: 3, fill: 'paper', stroke: 'ink', sw: 3 },
    { x: 20.9, y: 11.1, w: 43.2, h: 52.4, rx: 2, fill: 'paper', stroke: 'cinnabar', sw: 2 },
    { x: 38, y: 36.7, w: 9.2, h: 3.9, fill: 'ink' },
    { x: 36.7, y: 25.5, w: 11.8, h: 11.8, rx: 5.9, fill: 'paper', stroke: 'ink', sw: 2.5 },
  ],
  trails: [
    { d: 'M4262.58447265625,639.9818115234375L4269.130859375,613.7999877929688L4273.05859375,611.1818237304688L4266.51220703125,638.6727294921875Z', dx: -4236.4, dy: -585, fill: 'goldDeep', stroke: 'ink', sw: 2 },
    { d: 'M4266.51220703125,646.5272827148438L4291.3876953125,646.5272827148438L4288.11474609375,624.272705078125L4269.78515625,624.272705078125Z', dx: -4236.4, dy: -585, fill: 'cinnabar', stroke: 'ink', sw: 2.5 },
    { d: 'M4273.05859375,613.1454467773438L4284.84130859375,613.1454467773438L4282.22314453125,605.9454345703125L4275.6767578125,605.9454345703125Z', dx: -4236.4, dy: -585, fill: 'ink', stroke: 'ink', sw: 2.5 },
    { d: 'M4275.0224609375,621L4282.8779296875,621L4278.9501953125,629.5090942382812Z', dx: -4236.4, dy: -585, fill: 'ink', sw: 0 },
  ],
};

/**
 * `art · Door Gods` — 85.1 × 72. TWO paper panels side by side, each with a cinnabar inner border, a robed figure,
 * a pale face disc and a spear traced as a path. Read off `EN · 7b`, 2026-11-08.
 */
const DOORGODS: { box: readonly [number, number]; inks: readonly Ink[]; trails: readonly Trail[] } = {
  box: [85.1, 72],
  inks: [
    { x: 5.6, y: 7.9, w: 22.4, h: 56.3, rx: 2, fill: 'paper', stroke: 'ink', sw: 3 },
    { x: 7.3, y: 9.8, w: 19, h: 52.4, rx: 2, fill: 'paper', stroke: 'cinnabar', sw: 2 },
    { x: 10.1, y: 36.7, w: 14.6, h: 17, rx: 2, fill: 'cinnabar', stroke: 'ink', sw: 2.5 },
    { x: 10.6, y: 22.3, w: 12.3, h: 14.4, rx: 2, fill: 'goldDeep', stroke: 'ink', sw: 2 },
    { x: 14.6, y: 15.7, w: 3.9, h: 6.5, rx: 2, fill: 'cinnabar', stroke: 'ink', sw: 2 },
    { x: 13.4, y: 26.8, w: 6.7, h: 7.9, rx: 3.35, fill: 'paper', stroke: 'ink', sw: 2 },
    { x: 38.1, y: 7.9, w: 22.4, h: 56.3, rx: 2, fill: 'paper', stroke: 'ink', sw: 3 },
    { x: 39.8, y: 9.8, w: 19, h: 52.4, rx: 2, fill: 'paper', stroke: 'cinnabar', sw: 2 },
    { x: 70.5, y: 36.7, w: 14.6, h: 17, rx: 2, fill: 'cinnabar', stroke: 'ink', sw: 2.5 },
    { x: 67.7, y: 22.3, w: 12.3, h: 14.4, rx: 2, fill: 'goldDeep', stroke: 'ink', sw: 2 },
    { x: 55.4, y: 15.7, w: 3.9, h: 6.5, rx: 2, fill: 'cinnabar', stroke: 'ink', sw: 2 },
    { x: 45.9, y: 26.8, w: 6.7, h: 7.9, rx: 3.35, fill: 'paper', stroke: 'ink', sw: 2 },
  ],
  trails: [
    { d: 'M4069.677734375,790.2000122070312L4080.875,773.1818237304688L4082.5546875,775.1454467773438L4071.357177734375,792.1636352539062Z', dx: -4059.6, dy: -747, fill: 'goldDeep', stroke: 'ink', sw: 1.5 },
    { d: 'M4115.5869140625,790.2000122070312L4104.3896484375,773.1818237304688L4102.7099609375,775.1454467773438L4113.9072265625,792.1636352539062Z', dx: -4059.6, dy: -747, fill: 'goldDeep', stroke: 'ink', sw: 1.5 },
  ],
};

const MOTIFS: Record<DecorationCode, { box: readonly [number, number]; inks: readonly Ink[]; trails: readonly Trail[] } | null> = {
  lanterns: LANTERN,
  spring_couplets: COUPLET,
  zhong_kui: ZHONGKUI,
  door_gods: DOORGODS,
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
