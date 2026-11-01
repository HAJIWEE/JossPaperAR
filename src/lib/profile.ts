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

import type { Locale } from './i18n.ts';

/**
 * The screen header — `btn · back (ink)` + `hud · screen title`. Shared by Profile · Settings · History.
 *
 * ── ⚠️ THE VISIBLE CIRCLE IS 34, NOT THE BOARD'S 42 ─────────────────────────
 * `EN · 8` / `8b` / `8c` all draw `btn · back (ink)` at **18,40 42×42** with a **2.5** stroke, and
 * `hud · screen title` starting at **x60** — i.e. the ring ends at exactly 60, where the text begins.
 * ⚠️ **On glass the ring reads as touching the `S`**, and a bold filled circle out-weighs the 17 dp
 * title beside it. Measured on `HN615L005386`, 2026-11-01.
 *
 * ⚠️ So this is a **deliberate departure**, filed for the board rather than copied: a port that
 * reproduces an unreadable header is not more faithful, it is wrong in the same way.
 * ⚠️ **The TOUCH target stays 44** — the circle shrinks, what the finger hits does not.
 */
/** `hud · screen title` — ⚠️ x moved **60 → 66**, so there is a real gap from the circle. */
export const HUD = {
  /** ⚠️ Invisible, 44 — the project's floor for the 40–50s audience (N11). */
  touch: { x: 14, y: 41, size: 44 },
  /** ⚠️ The VISIBLE circle, drawn centred inside the touch target. Was the board's 42 / stroke 2.5. */
  back: { size: 34, borderWidth: 2 },
  title: { x: 66, y: 51 },
} as const;

/**
 * ⚠️ **THE HUD HAS TWO BOARD VARIANTS, AND THEY ARE NOT INTERCHANGEABLE.**
 *
 * | where | circle | ring | glyph | title |
 * |---|---|---|---|---|
 * | **light** — on paper | `surface.paper` | `brand.ink` | `text.ink` | yes |
 * | **dark** — on the camera/video | `#14110F @ 0.5` | `#F5F0E8` | `#F5F0E8` | **none** |
 *
 * ⚠️ A light HUD on the camera is an ink ring on a dark frame — invisible. The dark variant is
 * `hud · back circle` on `EN · 2 Capture` and `EN · 4 Burn`; the light one is `btn · back (ink)` on
 * `EN · 3 Transform`, `EN · 8`/`8b`/`8c`, `EN · 6 League`.
 *
 * ⚠️ **`reward` (`EN · 5`) draws NO back button** — deliberately, and the build matches: the offering
 * is complete and the only ways on are the ones the screen offers. Do not "standardize" one onto it.
 *
 * ⚠️ `#14110F` and `#F5F0E8` are the board's own pigments. ⚠️ `#F5F0E8` **is** `surface.paper`, so
 * the dark variant's ring is the paper colour — that is what makes it read on a dark frame.
 */
export const HUD_TONES = {
  light: { fill: '#F5F0E8', stroke: '#1A1A1A', glyph: '#1A1A1A' },
  dark: { fill: 'rgba(20,17,15,0.5)', stroke: '#F5F0E8', glyph: '#F5F0E8' },
} as const;

export type HudTone = keyof typeof HUD_TONES;

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
 * `hist · week (bg)` — 20,124 350×64 **r14** · `hist · entry * (bg)` — 20,y 350×88 **r12**.
 *
 * ⚠️ The week card is r14 and the entries are r12 — measured, not a slip. The week card is a
 * SUMMARY (it shares its radius with the Profile cards) and the entries are a LIST.
 */
export const HISTORY_SPEC = {
  week: { x: 20, y: 124, w: 350, h: 64, radius: 14 },
  row: {
    x: 20,
    w: 350,
    h: 88,
    radius: 12,
    /** `hist · entry * (thumb)` — 32,246 60×60, so dx 12 / dy 14 inside the row, r10. */
    thumbDx: 12,
    thumbDy: 14,
    thumb: 60,
    thumbRadius: 10,
    /** `hist · entry * (name)` — 106,246 → dx 86 / dy 14. */
    textDx: 86,
    nameDy: 14,
    metaDy: 36,
    bandDy: 56,
    /** `hist · entry * (pts)` — 274,260 84×24, right-aligned inside the row. */
    ptsDx: 254,
    ptsDy: 28,
    ptsW: 84,
  },
} as const;

/**
 * ⚠️ **No Profile row is pending any more** — `history` and `collection` were the two that had no
 * server read, and both now have one (`my_offerings` / `my_collection`). ⚠️ This constant used to say
 * so; it is kept as an EMPTY list rather than deleted, because the gate below reads it and a
 * re-appearing row must be a deliberate act.
 */
export const PROFILE_ROWS_PENDING: readonly string[] = [];

/**
 * ⚠️ **Every route this surface may point at** — the Profile tab, its rows, and the shrine's gear.
 *
 * Exported so the tab bar and `check:lib` read the SAME strings: a typo, or a route deleted later,
 * would otherwise become a dead link (the SCRUM-145 defect) with nothing able to see it.
 */
export const PROFILE_ROUTE = '/profile';
export const HISTORY_ROUTE = '/history';
export const SETTINGS_ROUTE = '/settings';
export const COLLECTION_ROUTE = '/collection';

export const PROFILE_ROUTES: readonly string[] = [
  PROFILE_ROUTE,
  HISTORY_ROUTE,
  COLLECTION_ROUTE,
  SETTINGS_ROUTE,
];

/**
 * ⚠️ The rows, in board order. `route: null` = **not built yet** → the row renders DISABLED.
 *
 * ⚠️ **ALL THREE ARE LIVE as of SCRUM-151.** `history` needed `my_offerings`, `collection` needed
 * `my_collection` — both are migrations, and both are why those rows rendered disabled for as long as
 * they did: a card would otherwise have had to **invent** its count, which this project treats as
 * worse than a missing screen.
 */
export const PROFILE_ROWS = [
  { id: 'history', route: HISTORY_ROUTE },
  { id: 'collection', route: COLLECTION_ROUTE },
  { id: 'settings', route: SETTINGS_ROUTE },
] as const;

export type ProfileRowId = (typeof PROFILE_ROWS)[number]['id'];

/** ⚠️ Is this row a real destination? — the ONE place "is it wired" is decided. */
export function rowIsLive(route: string | null): boolean {
  return route !== null;
}

/** The short month names the History meta line uses. ⚠️ Not `Intl`: Hermes' coverage varies. */
const MONTHS: Record<Locale, readonly string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  zh: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
};

/**
 * The History meta line — `Today · 8:42 PM` / `Yesterday · 9:03 PM` / `26 Sep · 7:31 PM`.
 *
 * ⚠️ **Hand-formatted, not `Intl`.** Hermes ships a partial ICU, so `toLocaleTimeString('zh')` is
 * not dependable across devices — and a date is the one string a user can immediately tell is wrong.
 * ⚠️ 12-hour for EN and **24-hour for 中文**: the board draws `8:42 PM`, and `20:42` is how 中文
 * reads a clock. Forcing one onto the other is the kind of "translation" that reads as a bug.
 *
 * ⚠️ An unparseable timestamp returns `''` rather than `Invalid Date` — the caller renders a blank
 * line, which is honest, instead of a JavaScript error on a plaque.
 */
export function burnedAtLabel(iso: string, now: Date, locale: Locale): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return `${dayWord(at, now, locale)} · ${clock(at, locale)}`;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayWord(at: Date, now: Date, locale: Locale): string {
  if (sameLocalDay(at, now)) return locale === 'zh' ? '今天' : 'Today';
  const yesterday = new Date(now.getTime());
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameLocalDay(at, yesterday)) return locale === 'zh' ? '昨天' : 'Yesterday';
  return `${at.getDate()} ${MONTHS[locale][at.getMonth()]}`;
}

function clock(at: Date, locale: Locale): string {
  const minutes = String(at.getMinutes()).padStart(2, '0');
  const h24 = at.getHours();
  if (locale === 'zh') return `${String(h24).padStart(2, '0')}:${minutes}`;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${minutes} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/**
 * The History thumb's glyph.
 *
 * ⚠️ `EN · 8c History` draws a GLYPH per thumb (车 · 金 · 屋 · 纸 · 机) and the catalogue carries
 * **no glyph** — those are illustrative, and inventing a mapping would be a second source of truth
 * for what an item is called. This DERIVES one from the name's first character, so it is
 * locale-correct by construction and cannot drift from the name beside it.
 * ⚠️ `Array.from`, not `[0]`: a name starting with a surrogate pair would otherwise cut in half.
 */
export function offeringGlyph(name: string): string {
  return Array.from(name.trim())[0] ?? '';
}

/**
 * ⚠️ **"1 days" is not copy.** `hist.weekStreak` is `🔥 %{days} days` and the board only draws the
 * 12-day case — so the singular is ours, exactly as it is for the altar caption. A screen-side
 * ternary would put the rule where no gate can read it, so it lives here.
 */
export function streakDayKey(days: number): string {
  return days === 1 ? 'hist.weekStreakOne' : 'hist.weekStreak';
}
