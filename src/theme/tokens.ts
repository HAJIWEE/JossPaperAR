/**
 * THE THEME BRIDGE — the React Native mirror of `design-system/tokens.css`.
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
 * The design file (Penpot) and the CI colour gate both speak `tokens.css`. The
 * app cannot import CSS, so this file carries the SAME values into TypeScript.
 * Two sources of truth for one palette is exactly the drift that already burned
 * this project once (tokens.css's own header: 4 of 5 hand-carried hexes were
 * wrong and *re-introduced the very drift the tranche was fixing*).
 *
 * So the rule is: **`tokens.css` is authoritative. This file mirrors it, and a
 * check asserts they agree** — `node src/theme/checks/parity.ts`. Never edit a
 * hex here without re-running the design-system contrast check.
 *
 * ── THE ROLE RULE (do not "simplify" this) ───────────────────────────────────
 * A colour can be a perfect border/fill and still FAIL as text (tokens.css:
 * `--gold-deep` is fine as a border, 2.67:1 as body text). Tokens are split by
 * ROLE, not renamed:
 *   brand.*    decorative ONLY — borders, fills, strokes. NEVER text on cream.
 *   text.*     verified ≥4.5:1 on EVERY cream surface. Use for text/icons on paper.
 *   onCream    cream content (#FFF8E8) sitting ON a brand-colour fill.
 *   disc.*     darkened fills so the cream glyph passes on avatar discs.
 */

export const brand = {
  cinnabar: '#C23B22',
  cinnabarSoft: '#D9644B',
  cinnabarDeep: '#9A2B18',
  gold: '#D4AF37',
  goldBright: '#F0C75E',
  goldDeep: '#A8862A',
  azurite: '#4A6FA5',
  azuriteLight: '#8FB0D0',
  azuriteDeep: '#31506F',
  malachite: '#0E9B78',
  malachiteDeep: '#07795C',
  jadeFacet: '#23B98F',
  ink: '#1A1A1A',
  inkSoft: '#4A463F',
  muted: '#A39D92',
} as const;

export const surface = {
  paper: '#F5F0E8',
  paperDeep: '#EAE2D2',
  paperEdge: '#D9CFBA',
  row: '#FBF7EE',
  rowZone: '#F8F1DC',
  rowYou: '#FDF8E7',
  /** #screen-burn — dark, so brand gold passes contrast here. */
  camera: '#121418',
} as const;

/** Each ≥4.5:1 on every cream surface above (worst case = paperDeep). */
export const text = {
  gold: '#7B621F',
  goldBright: '#77632F',
  malachite: '#0A7359',
  azurite: '#446698',
  cinnabar: '#B73820',
  ink: '#1A1A1A',
  inkSoft: '#4A463F',
  muted: '#69655E',
} as const;

export const onColorCream = '#FFF8E8';

/** Avatar discs — the FILL darkens so the cream glyph never has to change. */
export const disc = {
  gold: '#887023',
  goldDeep: '#8B6F23',
  malachite: '#0C8265',
  jadeFacet: '#188164',
} as const;

// ── Layout ───────────────────────────────────────────────────────────────────
// From design-system/responsive.css. N11: system font scaling honoured to ×1.5,
// and touch targets are 44 px (the 40–50s audience is the accessibility case).

export const TOUCH_TARGET = 44;
export const TOUCH_GAP = 8;

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 20, xl: 32 } as const;

// ── The fluid type scale ─────────────────────────────────────────────────────
// CSS uses clamp(min @320px, slope, max @480px); each token is anchored so its
// value AT 390 px equals the design reference (responsive-check.js asserts that
// in CSS). RN has no clamp(), so we reproduce the same linear interpolation at
// runtime from the window width — same numbers, same behaviour.
//
// Reference: design-system/responsive.css lines 81–88.

export interface FluidSize {
  /** Value at the 320 px floor, in px. */
  readonly min: number;
  /** Value at the 480 px ceiling, in px. */
  readonly max: number;
  /** The design-reference value at 390 px (what the boards were drawn at). */
  readonly at390: number;
}

export const fontSize = {
  hero: { min: 64, max: 91.43, at390: 76 },
  display: { min: 34, max: 47.71, at390: 40 },
  titleHero: { min: 26, max: 35.14, at390: 30 },
  titlePage: { min: 23, max: 29.86, at390: 26 },
  titleScreen: { min: 21, max: 27.86, at390: 24 },
  titleSheet: { min: 19, max: 23.57, at390: 21 },
  titleRow: { min: 16, max: 18.29, at390: 17 },
  bodyLg: { min: 14, max: 16.29, at390: 15 },
  body: { min: 13, max: 15, at390: 14 },
  caption: { min: 11, max: 12, at390: 11.5 },
} as const satisfies Record<string, FluidSize>;

/** Linear interpolate a fluid token between the 320 and 480 px bounds. */
export function fluidSize(token: FluidSize, windowWidth: number): number {
  const W_MIN = 320;
  const W_MAX = 480;
  if (windowWidth <= W_MIN) return token.min;
  if (windowWidth >= W_MAX) return token.max;
  const t = (windowWidth - W_MIN) / (W_MAX - W_MIN);
  return token.min + t * (token.max - token.min);
}

/** The scale a milestone is verified at: the 390 px design reference. */
export const DESIGN_REFERENCE_WIDTH = 390;