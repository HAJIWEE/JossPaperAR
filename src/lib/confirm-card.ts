/**
 * confirm-card.ts — THE designed confirm dialog's SPEC (SCRUM-123, option A).
 *
 * ── ⚠️ WHY THE NUMBERS LIVE HERE AND NOT IN THE COMPONENT ────────────────────
 * They are MEASURED off the Penpot boards, and a measurement that only exists as a
 * style object cannot be asserted without a device. This is the project's usual
 * pure/device split — the same one `src/lib/clan-pill.ts` uses for the Home pill —
 * so `check:lib` can hold the geometry still while `confirm-card.tsx` only renders it.
 *
 * ── ⚠️ MEASURED, NOT ESTIMATED ───────────────────────────────────────────────
 * Read from **`EN · 9b Buy offerings · confirm`** (390 × 844 — the design reference)
 * via the Penpot plugin, shape by shape:
 *
 *   overlay · scrim    390 × 844        #1a1512 @ 0.5
 *   dialog · iap (bg)  x20 y300  350 × 284   #f5f0e8   r16
 *   dialog · title     x36 y324              #2b2420   17 / 700
 *   dialog · body      x36 y416              #5a5048   12.5 / 400
 *   btn · buy (bg)     x36 y454  318 × 56    #c23b22   r18
 *   btn · buy (label)                        #fff8e8   17 / 700
 *   btn · cancel       x36 y544              #4a463f   13 / 400
 *
 * The board's own paddings follow from those: **16** horizontal (36 − 20), **24**
 * top (324 − 300), **20** bottom (584 − 564). ⚠️ The 20 bottom padding is load-bearing
 * — it is exactly what `SCRUM-104` fixed, so the cancel label sits ON the card instead
 * of escaping onto the scrim (where it measured 2.50:1).
 *
 * ── ⚠️ TWO DELIBERATE DEVIATIONS FROM THE BOARD, BOTH STATED ─────────────────
 * 1. **`#2b2420` (title) and `#5a5048` (body) are NOT in `tokens.css`.** They are
 *    carried here verbatim because *matching the six boards* is the requirement, and
 *    `src/components/fire-art.tsx` is the precedent for a component owning its own
 *    palette. ⚠️ Because they are outside the token set, `penpot-pairs.json` cannot
 *    cover them — so `CONFIRM_TEXT_PAIRS` below does, and `check:lib` computes their
 *    ratios rather than trusting a snapshot.
 * 2. **The cancel's VISIBLE height is 20 px but its TOUCH target is 44.** The board
 *    draws a 20 px label; 44 dp is this project's floor for the 40–50s audience. The
 *    same resolution as the halved zoom pills: shrink what the eye sees, never the
 *    thing the finger has to hit.
 */

/**
 * `SCRIM` as an `rgba()` string.
 *
 * ⚠️ A colour with alpha, NOT an `opacity` style: `opacity` on the scrim's `View`
 * would fade the CARD inside it too, which is exactly the bug this shape avoids.
 */
export function scrimRgba(): string {
  const h = SCRIM.color.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${SCRIM.opacity})`;
}

/** The scrim — the board's `overlay · scrim`. Its 50 % resolves to `#88837d` on cream. */
export const SCRIM = { color: '#1a1512', opacity: 0.5 } as const;

export const CONFIRM_SPEC = {
  /** The board's gutter: the card is the screen's width minus twice this. */
  gutter: 20,
  card: { radius: 16, padH: 16, padTop: 24, padBottom: 20, fill: '#f5f0e8' },
  title: { size: 17, weight: '700', color: '#2b2420' },
  body: { size: 12.5, weight: '400', color: '#5a5048' },
  primary: {
    height: 56,
    radius: 18,
    fill: '#c23b22',
    labelColor: '#fff8e8',
    labelSize: 17,
    labelWeight: '700',
  },
  cancel: { labelSize: 13, labelWeight: '400', color: '#4a463f', touchHeight: 44 },
} as const;

/**
 * Every text pair the card can produce, with the ratio it must clear.
 *
 * ⚠️ EVERY `bg` IS THE CARD FILL, AND THAT IS THE POINT. `SCRUM-104`'s defect was a
 * label compositing onto the **scrim** (2.50:1) because it had escaped the card. A
 * card whose text is ALWAYS on its own opaque fill cannot reproduce that failure, and
 * these entries are the assertion that it does not: if a `bg` here ever became the
 * scrim colour, the ratio would fall through the floor and `check:lib` would say so.
 */
export const CONFIRM_TEXT_PAIRS = [
  { name: 'dialog · title', fg: CONFIRM_SPEC.title.color, bg: CONFIRM_SPEC.card.fill, min: 4.5 },
  { name: 'dialog · body', fg: CONFIRM_SPEC.body.color, bg: CONFIRM_SPEC.card.fill, min: 4.5 },
  {
    name: 'btn · primary (label)',
    fg: CONFIRM_SPEC.primary.labelColor,
    bg: CONFIRM_SPEC.primary.fill,
    min: 4.5,
  },
  { name: 'btn · cancel', fg: CONFIRM_SPEC.cancel.color, bg: CONFIRM_SPEC.card.fill, min: 4.5 },
] as const;

/** WCAG relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const channel = (offset: number): number => {
    const c = parseInt(h.slice(offset, offset + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/**
 * The WCAG 2.x contrast ratio between two colours.
 *
 * ⚠️ A local implementation on purpose: `design-system/contrast-check.js` owns the
 * CSS side of the same arithmetic, but the dialog's two board-sourced colours are not
 * tokens and cannot appear in `penpot-pairs.json` — so this is the only place they can
 * be checked at all.
 */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
