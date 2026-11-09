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

import { View } from 'react-native';
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
/** One drawing: a source box, its rectangles, and any traced paths. */
interface Motif {
  readonly box: readonly [number, number];
  readonly inks: readonly Ink[];
  readonly trails: readonly Trail[];
  /**
   * ⚠️ **Paint the traced paths BEFORE the rectangles.** The default is the opposite — `offering-art.tsx`'s reasoning,
   * *"traces last, so a body is never covered by a later rectangle"* — which holds for a foil strip laid ON a body.
   * The single lantern is the counter-example: its hexagon IS the body, and the rib/base/bead sit on it.
   */
  readonly pathsFirst?: boolean;
}

/**
 * ⚠️ **ONE COUPLET SCROLL — what a SIDE of the altar holds** (`EN · 1d` `decor · couplet (side-left)`, 41 × 160),
 * ported 2026-11-09.
 *
 * ⚠️ **`COUPLET` is the whole TRIO** — a plaque with three gold panels over two vertical strips — i.e. the STORE CARD's
 * illustration. Drawing it into a 41 × 160 side rect (the owner, spotting it on glass: *"the side banners still show
 * all 3 banners in the couplets"*) put the plaque and BOTH strips down each side, so one side of the altar displayed a
 * whole set. The altar shows one object per slot: a scroll here, the 横批 at the top-middle.
 */
const COUPLET_SCROLL: Motif = {
  box: [41, 160],
  inks: [
    { x: 19.5, y: 2.1, w: 3.1, h: 10.3, fill: 'ink' },
    { x: 4.1, y: 10.3, w: 32.8, h: 145.6, rx: 3, fill: 'cinnabar', stroke: 'ink', sw: 3 },
    { x: 12.3, y: 22.6, w: 16.4, h: 20.5, fill: 'goldBright', stroke: 'ink', sw: 2 },
    { x: 12.3, y: 53.3, w: 16.4, h: 20.5, fill: 'goldBright', stroke: 'ink', sw: 2 },
    { x: 12.3, y: 84.1, w: 16.4, h: 20.5, fill: 'goldBright', stroke: 'ink', sw: 2 },
    { x: 12.3, y: 114.9, w: 16.4, h: 20.5, fill: 'goldBright', stroke: 'ink', sw: 2 },
  ],
  trails: [],
};

/**
 * ⚠️ **THE COUPLETS' THIRD PIECE — the 横批 (horizontal banner)**, ported 2026-11-09 from `EN · 1e`'s
 * `decor · 横批 (top-middle) @125,213 141×40`. It is a SEPARATE drawing, not the pair of scrolls: the owner's
 * correction (*"the Spring Couplets consist of a trio of objects … one for the top middle … one for the left … one
 * for the right"*) is what made the absence visible — the first build stretched the pair motif into 141 × 40 and it
 * read as two squashed scrolls on glass.
 * ⚠️ Its shape is the board's own: a cinnabar banner with **three** gold panels, which is why it is not simply the
 * side motif rotated.
 */
const COUPLET_CROWN: Motif = {
  box: [141, 40],
  inks: [
    { x: 4.7, y: 4.7, w: 131.6, h: 30.6, rx: 3, fill: 'cinnabar', stroke: 'ink', sw: 3 },
    { x: 28.2, y: 12.9, w: 23.5, h: 14.1, fill: 'goldBright', stroke: 'ink', sw: 2 },
    { x: 58.8, y: 12.9, w: 23.5, h: 14.1, fill: 'goldBright', stroke: 'ink', sw: 2 },
    { x: 89.3, y: 12.9, w: 23.5, h: 14.1, fill: 'goldBright', stroke: 'ink', sw: 2 },
  ],
  trails: [],
};

/**
 * ⚠️ **ONE LANTERN — what a corner of the altar holds** (`EN · 1d` `decor · lantern (top-left)`, 52 × 66), ported
 * 2026-11-09. ⚠️ **NOT the same drawing as `LANTERN`:** that one is a PAIR (two lanterns side by side, 85.1 × 72) and
 * it belongs on a STORE CARD. The owner's correction — *"the lanterns is also a pair one for each side"* — is about the
 * SET (two objects, one per side), not about a card illustration, so the altar needs one object per corner. Before this
 * the pair motif was drawn twice, i.e. **four** lanterns on a two-lantern set.
 * ⚠️ The body is a hexagon PATH, and it has to be painted BEFORE the rib/base/bead — hence `pathsFirst`.
 */
const LANTERN_SINGLE: Motif = {
  box: [52, 66],
  pathsFirst: true,
  inks: [
    { x: 24.7, y: 1.7, w: 2.6, h: 10.4, fill: 'ink' },
    { x: 19.1, y: 12.2, w: 13.9, h: 5.2, rx: 2, fill: 'goldDeep', stroke: 'ink', sw: 2 },
    { x: 25.3, y: 17.4, w: 1.4, h: 24.3, fill: 'goldBright' },
    { x: 20.8, y: 40.8, w: 10.4, h: 4.3, rx: 2, fill: 'goldDeep', stroke: 'ink', sw: 2 },
    { x: 23.4, y: 45.2, w: 5.2, h: 5.2, rx: 2.6, fill: 'goldBright' },
    { x: 24.7, y: 49.5, w: 2.6, h: 13.9, fill: 'goldBright' },
  ],
  trails: [
    {
      d: 'M205.6666717529297,11459.5263671875L214.3333282470703,11447.3681640625L231.6666717529297,11447.3681640625L240.3333282470703,11459.5263671875L231.6666717529297,11471.6845703125L214.3333282470703,11471.6845703125Z',
      dx: -196.97,
      dy: -11442.13,
      fill: 'cinnabar',
      stroke: 'ink',
      sw: 3,
    },
  ],
};

const LANTERN: Motif = {
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
/**
 * ⚠️⚠️ **RE-BASED TO ITS INK BOUNDS** (2026-11-09). As the board draws it, the group is `101,367 190×161` but the ART
 * inside occupies only `x 35..155, y 9..139` of that group — the rest is an invisible `base-background`. Stretching the
 * board's box therefore stretched the MARGIN: asked to fill the background zone, the print still floated in a ring of empty
 * paper. ⚠️ So the motif's box is now the ink's own bounds (`53.7 × 62.2`, every coordinate shifted by `−15.7, −3.9`),
 * which makes "fill the rect you are given" true rather than approximately true.
 * ⚠️ A tight box also improves the store card and the picker row: they contain the motif in a square, so the old margin
 * made the print look small there too.
 */
const ZHONGKUI: Motif = {
  box: [53.7, 62.2],
  inks: [
    { x: 0, y: 0, w: 53.7, h: 4.6, rx: 3, fill: 'goldDeep', stroke: 'ink', sw: 2 },
    { x: 2.6, y: 4.6, w: 48.4, h: 57.6, rx: 3, fill: 'paper', stroke: 'ink', sw: 3 },
    { x: 5.2, y: 7.2, w: 43.2, h: 52.4, rx: 2, fill: 'paper', stroke: 'cinnabar', sw: 2 },
    { x: 22.3, y: 32.8, w: 9.2, h: 3.9, fill: 'ink' },
    { x: 21, y: 21.6, w: 11.8, h: 11.8, rx: 5.9, fill: 'paper', stroke: 'ink', sw: 2.5 },
  ],
  trails: [
    { d: 'M4262.58447265625,639.9818115234375L4269.130859375,613.7999877929688L4273.05859375,611.1818237304688L4266.51220703125,638.6727294921875Z', dx: -4252.1, dy: -588.9, fill: 'goldDeep', stroke: 'ink', sw: 2 },
    { d: 'M4266.51220703125,646.5272827148438L4291.3876953125,646.5272827148438L4288.11474609375,624.272705078125L4269.78515625,624.272705078125Z', dx: -4252.1, dy: -588.9, fill: 'cinnabar', stroke: 'ink', sw: 2.5 },
    { d: 'M4273.05859375,613.1454467773438L4284.84130859375,613.1454467773438L4282.22314453125,605.9454345703125L4275.6767578125,605.9454345703125Z', dx: -4252.1, dy: -588.9, fill: 'ink', stroke: 'ink', sw: 2.5 },
    { d: 'M4275.0224609375,621L4282.8779296875,621L4278.9501953125,629.5090942382812Z', dx: -4252.1, dy: -588.9, fill: 'ink', sw: 0 },
  ],
};

/**
 * `art · Door Gods` — 85.1 × 72. TWO paper panels side by side, each with a cinnabar inner border, a robed figure,
 * a pale face disc and a spear traced as a path. Read off `EN · 7b`, 2026-11-08.
 *
 * ⚠️⚠️ **A THIRD LEAF WAS TRANSCRIBED AND HAS BEEN REMOVED** (owner, 2026-11-09: *"The door gods object has 3
 * objects it should only have 2, the 2 from the left. the 3rd should be removed."*). The motif carries a THIRD
 * panel's robe (`x 70.5`) and gold torso panel (`x 67.7`) — at the trio's 32.5 pitch that is the third leaf, whose
 * frame sits past the 85.1 box and is therefore clipped, so it rendered as a **red-and-gold block floating beside the
 * pair**. ⚠️ It was a ghost of the same trio assumption SCRUM-228 has since reversed: door gods are a PAIR.
 * ⚠️ `check:lib` now asserts nothing in this motif lives past the second leaf, so a third cannot creep back.
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
    { x: 55.4, y: 15.7, w: 3.9, h: 6.5, rx: 2, fill: 'cinnabar', stroke: 'ink', sw: 2 },
    { x: 45.9, y: 26.8, w: 6.7, h: 7.9, rx: 3.35, fill: 'paper', stroke: 'ink', sw: 2 },
  ],
  trails: [
    { d: 'M4069.677734375,790.2000122070312L4080.875,773.1818237304688L4082.5546875,775.1454467773438L4071.357177734375,792.1636352539062Z', dx: -4059.6, dy: -747, fill: 'goldDeep', stroke: 'ink', sw: 1.5 },
    { d: 'M4115.5869140625,790.2000122070312L4104.3896484375,773.1818237304688L4102.7099609375,775.1454467773438L4113.9072265625,792.1636352539062Z', dx: -4059.6, dy: -747, fill: 'goldDeep', stroke: 'ink', sw: 1.5 },
  ],
};

/**
 * `decor · door god (side)` — **ONE leaf**, for the SIDE slots (owner, 2026-11-09: *"door gods should be 1 per side not 2
 * per side"*).
 *
 * ⚠️⚠️ **THE PAIR MOTIF IS THE STORE CARD'S ILLUSTRATION AND MUST NEVER BE STRETCHED INTO A SLOT.** A side slot is
 * **41 × 160** and `DOORGODS` is 85.1 × 72 with TWO leaves, so the altar drew **four door gods** with their spears
 * crossing — the defect the owner caught on glass. It is the same split the couplets and lanterns already have
 * (`COUPLET_SCROLL`, `LANTERN_SINGLE`): ⚠️ **a slot needs its own object drawing, chosen by SLOT**, and door gods were
 * the one set without one.
 * ⚠️ It is the **LEFT leaf of `DOORGODS`**, re-based to its own frame box (**22.4 × 56.3**) and carrying its own spear —
 * **ported, not redrawn**, so the altar and the card cannot disagree about the figure.
 * ⚠️ It is still stretched into the slot's 41 × 160, because that rect is the design's own shape; a leaf **drawn at**
 * 41 × 160 is SCRUM-226's generated art.
 */
const DOORGOD_LEAF: Motif = {
  box: [22.4, 56.3],
  inks: [
    { x: 0, y: 0, w: 22.4, h: 56.3, rx: 2, fill: 'paper', stroke: 'ink', sw: 3 },
    { x: 1.7, y: 1.9, w: 19, h: 52.4, rx: 2, fill: 'paper', stroke: 'cinnabar', sw: 2 },
    { x: 4.5, y: 28.8, w: 14.6, h: 17, rx: 2, fill: 'cinnabar', stroke: 'ink', sw: 2.5 },
    { x: 5, y: 14.4, w: 12.3, h: 14.4, rx: 2, fill: 'goldDeep', stroke: 'ink', sw: 2 },
    { x: 9, y: 7.8, w: 3.9, h: 6.5, rx: 2, fill: 'cinnabar', stroke: 'ink', sw: 2 },
    { x: 7.8, y: 18.9, w: 6.7, h: 7.9, rx: 3.35, fill: 'paper', stroke: 'ink', sw: 2 },
  ],
  trails: [
    { d: 'M4069.677734375,790.2000122070312L4080.875,773.1818237304688L4082.5546875,775.1454467773438L4071.357177734375,792.1636352539062Z', dx: -4065.2, dy: -754.9, fill: 'goldDeep', stroke: 'ink', sw: 1.5 },
  ],
};

const MOTIFS: Record<DecorationCode, Motif | null> = {
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

/**
 * THE FESTIVE SET IS AN AMALGAMATION, NOT A DRAWING OF ITS OWN (owner, 2026-11-08).
 *
 * "The festive set ... is just an amalgamation of the rest of the decorations on sale so for that festive set art,
 * just put all the other decorations's art together."
 *
 * That is exactly the `composedOf` relationship the offerings already use: `wealth_bundle` grants one of each of
 * the other four rather than a bundle object. So the set renders the four motifs it contains instead of a
 * 52-shape transcription of `art - Festive Set` - one drawing per item, no second copy to drift.
 */
const COMPOSED: Record<DecorationCode, readonly DecorationCode[] | undefined> = {
  festive_set: ['lanterns', 'spring_couplets', 'zhong_kui', 'door_gods'],
  lanterns: undefined,
  spring_couplets: undefined,
  zhong_kui: undefined,
  door_gods: undefined,
};

/**
 * ⚠️ **A COMPOSED code draws WIDER than the `size` it is given** — the set is a row of four motifs at `0.52 × size`
 * each, so it occupies ≈ `2.08 × size`. That is right where the caller has a wide well (the store's 220×106
 * featured card) and **wrong in a square one**: the picker's 64 dp icon clipped the leftmost lantern on glass
 * (2026-11-09). So a caller with a small square box asks here first rather than guessing from the code.
 */
/** ⚠️ A second drawing for the same code, chosen by the SLOT (see `decorate.ts#artVariantFor`). */
export type ArtVariant = 'crown' | 'single' | 'scroll' | 'leaf';

export function isComposed(code: DecorationCode): boolean {
  return COMPOSED[code] !== undefined;
}


export function DecorationArt({
  code,
  size,
  box,
  art,
}: {
  code: DecorationCode;
  size: number;
  /**
   * ⚠️ **A RECT TO FILL, when the caller has one — used by the altar, which draws each piece at the board's own
   * measured rect** (`decor · couplet (side-left)` is 41 × 160, not a square). ⚠️ That STRETCHES the art on
   * purpose (`preserveAspectRatio="none"`): every motif's source box is 85.1 × 72 while the board draws couplets
   * 41 × 160, so the board stretched them too — the rect is the design's answer to "what shape is this HERE".
   * ⚠️ Without `box` the art is contained in a square of `size` and keeps its aspect, which is what the store
   * cards and the picker rows want.
   */
  box?: { readonly w: number; readonly h: number };
  /**
   * ⚠️ **A SECOND DRAWING FOR THE SAME CODE** — the couplets' top-middle piece is the 横批 banner (`1e`), not the
   * pair of scrolls the sides use. Chosen by SLOT in `decorate.ts#artVariantFor`, never by the caller guessing.
   */
  art?: ArtVariant;
}) {
  const parts = COMPOSED[code];
  if (parts !== undefined) {
    // The four motifs in a row, scaled to the caller's box - the caller owns the size, the set owns the layout.
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: size }}>
        {parts.map((part) => (
          <DecorationArt key={part} code={part} size={size * 0.52} />
        ))}
      </View>
    );
  }
  const motif =
    art === 'crown' ? COUPLET_CROWN
      : art === 'single' ? LANTERN_SINGLE
        : art === 'scroll' ? COUPLET_SCROLL
          // ⚠️ ONE door leaf for a side slot — never the card's pair (owner, 2026-11-09).
          : art === 'leaf' ? DOORGOD_LEAF
            : MOTIFS[code];
  if (motif === null) {
    // ⚠️ A placeholder that LOOKS like a placeholder — never a stand-in motif.
    return (
      <Svg width={box?.w ?? size} height={box?.h ?? size} viewBox="0 0 40 40">
        <Rect x={2} y={2} width={36} height={36} rx={6} fill="none" stroke={brand.ink} strokeWidth={2} />
      </Svg>
    );
  }
  const [bw, bh] = motif.box;
  /** ⚠️ `box` wins over `size`: the caller measured this piece's rect off the board. */
  const w = box?.w ?? bw * Math.min(size / bw, size / bh);
  const h = box?.h ?? bh * Math.min(size / bw, size / bh);
  /** ⚠️ Built once, so `pathsFirst` can put the SAME nodes before or after the rectangles. */
  const paths = motif.trails.map((t, i) => (
    <G key={`t${i}`} transform={`translate(${t.dx}, ${t.dy})`}>
      <Path
        d={t.d}
        fill={t.fill === null ? 'none' : C(t.fill)}
        stroke={t.stroke === undefined ? undefined : C(t.stroke)}
        strokeWidth={t.sw ?? 0}
        strokeLinejoin="round"
      />
    </G>
  ));
  return (
    <Svg
      width={w}
      height={h}
      viewBox={`0 0 ${bw} ${bh}`}
      preserveAspectRatio={box === undefined ? undefined : 'none'}
    >
      {/* ⚠️ Traces last BY DEFAULT, so a body is never covered by a later rectangle — `pathsFirst` inverts it. */}
      {motif.pathsFirst === true ? paths : null}
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
      {motif.pathsFirst === true ? null : paths}
    </Svg>
  );
}

/** ⚠️ The paper tone, exported so a caller can check contrast without reaching into the theme. */
export const DECORATION_GROUND = surface.paper;
