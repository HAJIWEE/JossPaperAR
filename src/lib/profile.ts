/**
 * profile.ts — Profile & Settings: the board's geometry and the row model, PURE (SCRUM-151).
 *
 * ── PORTED, NOT REDRAWN ─────────────────────────────────────────────────────
 * `EN · 8 Profile` and `EN · 8b Settings`, read through the Penpot plugin on 2026-11-01. Same split
 * as `home-layout.ts`: the numbers live here so `check:lib` can hold them without a device, and the
 * screens only render.
 *
 * ── ⚠️ WHY THE ROWS ARE DATA ────────────────────────────────────────────────
 * A row that exists in the JSX but not in a model is a row no gate can see — and the two defects
 * this screen class already shipped (the tab bar drawn with NO tabs; the settings gear that was
 * decorative) were both "the control is in the code but not in the composition". The rows are a list,
 * and the list is asserted.
 */

/** `btn · back (ink)` 18,40 42×42 r21 · `hud · screen title` at 60,51. Shared by both screens. */
export const HUD = {
  back: { x: 18, y: 40, size: 42, radius: 21 },
  title: { x: 60, y: 51 },
} as const;

/**
 * `profile · row * (bg)` — 20,y 350×64, **r12**.
 *
 * ⚠️ A Profile row is **64** tall and a Settings row is **56** — measured, not a rounding difference.
 * Profile rows carry a two-line label + sub; Settings rows carry a label + sub and a trailing control
 * (the pill or a toggle), and the board gives them less room. Conflating them would either clip the
 * Settings controls or leave the Profile rows airy.
 */
export const PROFILE_ROW = {
  x: 20,
  w: 350,
  h: 64,
  radius: 12,
  /** Label / sub insets, from `profile · row * (label)` 36,432 and `· (sub)` 36,454. */
  labelDx: 16,
  labelDy: 12,
  subDy: 34,
  /** `profile · row * (chev)` 340,436 — the `›` affordance. */
  chevDx: 320,
  chevDy: 16,
} as const;

/** `set · row * (bg)` — 20,y 350×56, r12. */
export const SETTINGS_ROW = {
  x: 20,
  w: 350,
  h: 56,
  radius: 12,
  labelDx: 16,
  labelDy: 10,
  subDy: 30,
  chevDx: 320,
  chevDy: 12,
} as const;

/**
 * `set · lang pill` — 244,136 **118×32 r16**, with the ACTIVE segment `set · lang active`
 * 246,138 **58×28 r14** inset by 2 and filled `onColorCream` with an ink stroke.
 *
 * ⚠️ The two segments are **58 and 56** on the board, not 59/59 — the sample is fitted to `EN` and
 * `中文`, which are different widths. Rendering them as two equal halves is what the pill reads as,
 * and it keeps the track symmetric in both locales. `check:lib` holds the TRACK and the radius; the
 * segment widths are content-driven, the same call the tablet sheet's chips make.
 */
export const LOCALE_PILL = {
  w: 118,
  h: 32,
  radius: 16,
  /** ⚠️ The inset that makes the active segment sit INSIDE the track rather than on it. */
  inset: 2,
  segmentRadius: 14,
} as const;

/** `profile · header (card)` 20,100 350×120 r14 · `profile · tribute (card)` 20,236 350×76 r14. */
export const PROFILE_CARD = { x: 20, w: 350, headerH: 120, tributeH: 76, radius: 14 } as const;

/** `profile · stat * (bg)` — three 110×64 r12 tiles at x 20 · 140 · 260, y 328. */
export const PROFILE_STATS = { xs: [20, 140, 260] as const, w: 110, h: 64, radius: 12, y: 328 } as const;

/**
 * ⚠️ The two rows that have **no server read** — stated here so the screens cannot quietly grow a
 * live-looking control for them. See the ticket comment: `public.tributes` exists but the RPC surface
 * has no read for it, so both render **visibly disabled** (the `tab-bar.tsx` pattern) rather than
 * opening a screen that would show an empty list as fact.
 */
export const PROFILE_ROWS_PENDING = ['history', 'collection'] as const;

/** The Profile rows, in board order. `route: null` = not built yet. */
export const PROFILE_ROWS = [
  { id: 'history', route: null },
  { id: 'collection', route: null },
  { id: 'settings', route: '/settings' },
] as const;

export type ProfileRowId = (typeof PROFILE_ROWS)[number]['id'];

/** ⚠️ Is this row a real destination? — the ONE place "is it wired" is decided. */
export function rowIsLive(route: string | null): boolean {
  return route !== null;
}
