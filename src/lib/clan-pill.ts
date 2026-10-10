/**
 * clan-pill.ts — the PURE rules of the Home clan pill (SCRUM-92 · SCRUM-91 §option A).
 *
 * ── WHY A PILL, AND WHY THESE NUMBERS ────────────────────────────────────────
 * SCRUM-91's design pass MEASURED the signed-off Home instead of assuming it:
 * rasterising all 35 layers and solving for the largest empty rectangle returns
 * exactly ONE region — the header row. Every other band is occupied (tribute /
 * streak 280–328 · altar-state caption 332–350 · art 340–760 · CTA 856–922 ·
 * tab bar 944–1024), so a *card* was never placeable without unzipping a
 * signed-off layout. The control is therefore a **pill**, chosen because it
 * occupies space that is ALREADY empty and moves nothing.
 *
 * ⚠️ **The geometry below is READ OFF Penpot, not invented.** It was measured on
 * 2026-10-10 across all four boards (`EN|ZH` × 1 / 2+ clans), identical in every
 * one: pill **236×44 · r14** · name dx 14 · chip dx 106 dy 10 **h 24 · r12** ·
 * affordance dx 204 **18×18**. `check:lib` freezes them so a later edit cannot
 * quietly drift from the approved design — the same reason `tokens.css` is
 * asserted rather than trusted.
 *
 * ── THE ONE GLYPH, TWO STATES RULE (do not "improve" this) ───────────────────
 * The affordance is `›` (U+203A) in BOTH states. The 2+ state is **the same
 * glyph ROTATED 90°**, never a second character. S36b fixed exactly this class of
 * bug: `›` (punctuation) and `▾` (a geometric shape) are different Unicode blocks,
 * so they carry different weight and optical size and read as inconsistent. The
 * file's own convention is the angle-quote family (`‹ Back`), so the open state
 * must be a rotated angle quote.
 *
 * ── THE TOKENS ARE ROLES, NOT HEXES ──────────────────────────────────────────
 * Every colour maps to an existing token, and each was already verified:
 *   pill fill    `surface.paperDeep` (#EAE2D2) — a surface
 *   pill stroke  `brand.ink`         (#1A1A1A) — decorative, correct for a border
 *   name         `text.ink`          (#1A1A1A) — text on cream, worst 13.52
 *   chip fill    `brand.gold`        (#D4AF37) — decorative, correct for a fill
 *   chip label   `text.ink`          (#1A1A1A) — on that gold fill = 8.28:1 ✅
 *   affordance   `text.inkSoft`      (#4A463F) — on cream
 * ⚠️ **The chip label is the pair SCRUM-93 just fixed** (ink on gold, 8.28:1). The
 * component must NOT reach for `text.gold` — that is a CREAM-backdrop token and on
 * this gold fill it measures **2.77:1**, which is the exact defect SCRUM-93 closed.
 */

import { ROLE_LABEL_KEY } from './clan-flow.ts';
import { type ClanRole } from './clan-roles.ts';
import { DESIGN_REFERENCE_WIDTH } from '../theme/tokens.ts';

/**
 * The signed-off pill. Penpot `S36c`, read 2026-10-10 — DO NOT DRIFT.
 *
 * ⚠️ These are DESIGN geometry, not scale tokens. `radius.lg` is 16 and
 * `space.md` is 12; the board says 14, 12 and 10, so they are literals here and
 * asserted by `check:lib`. Rounding one to a token would silently move the pill.
 */
export const PILL_SPEC = {
  width: 236,
  height: 44,
  radius: 14,
  /** The stroke is `alignment: inner` on the board, so it does not add to 44. */
  borderWidth: 2.5,
  name: { dx: 14, width: 92, fontSize: 15, fontWeight: '700', lineHeight: 1.2 },
  chip: { dx: 106, dy: 10, height: 24, radius: 12, fontSize: 12, fontWeight: '700' },
  affordance: { dx: 204, dy: 13, size: 18, fontSize: 12, rotationOpenDeg: 90 },
} as const;

/** U+203A — the ONLY character the affordance ever renders. The open state rotates it. */
export const AFFORDANCE_GLYPH = '\u203A';

/**
 * The header row the pill lives in, board-relative on the 390 px reference.
 *
 * Derived, not guessed: the app mark ends 68.5, `btn · settings` starts 326 and
 * is 44 wide, the right margin is 20, and the gap between the pill and settings is
 * 10. So the pill spans **80 → 316** — the empty rectangle SCRUM-91 measured — and
 * it overlaps neither neighbour (AC 4).
 */
export const HEADER_SPEC = {
  /** `icon · app mark (header)` ends here — the pill must start to its right. */
  markRight: 68.5,
  /** `btn · settings` is a 44×44 target. */
  settingsSlot: 44,
  /** The pill's right edge → settings' left edge. */
  settingsGap: 10,
  /** The board's own outer margin. */
  rightPad: 20,
} as const;

/** Where the pill starts on the design reference: 390 − 20 − 44 − 10 − 236 = **80**. */
export const PILL_X_ON_REFERENCE =
  DESIGN_REFERENCE_WIDTH - HEADER_SPEC.rightPad - HEADER_SPEC.settingsSlot - HEADER_SPEC.settingsGap - PILL_SPEC.width;

/**
 * ⚠️ The board fixes the name box at **92 px**, which fits its sample ("Tan
 * Family" inks 84.2). Real names are **2..20 characters** (`isValidClanName`), so
 * the render must let the box **flex and ellipsise** rather than clip — the pill's
 * own geometry is what is signed off; the name is the one part that must give.
 */
export const NAME_FLEXES = true;

/**
 * ⚠️ **RN's `borderWidth` is drawn INSIDE the layout box** (`box-sizing: border-box`),
 * but the board measures the name box **14 px from the pill's OUTER edge** while its
 * stroke is `alignment: inner` (0 → 2.5). So the RN padding must be
 * **14 − 2.5 = 11.5**, or the name — and everything after it — sits 2.5 px right of
 * the signed-off position. Derived here rather than typed into the component, so
 * `check:lib` can assert it.
 */
export const CONTENT_PAD_H = PILL_SPEC.name.dx - PILL_SPEC.borderWidth;

/**
 * The name's box width, **derived**: the chip starts at 106 and the name at 14, so
 * the name occupies exactly 92 — which is also what the board records. Asserting the
 * two agree is how a future edit to either one is caught.
 */
export const NAME_WIDTH = PILL_SPEC.chip.dx - PILL_SPEC.name.dx;


/** A clan as the pill needs it — structural, so this module stays native-free. */
export interface PillClan {
  readonly name: string;
  readonly role: ClanRole;
}

/** Where a tap goes. `clan-manage` holds the switcher; `clan-fork` is create/join. */
export type PillTarget = 'clan-manage' | 'clan-fork';

export interface PillView {
  /** ⚠️ `false` with no clan — the design has no clan-less pill, so Home shows none. */
  readonly show: boolean;
  readonly name: string | null;
  /** An i18n KEY, never a string — so the pill cannot fork the ZH vocabulary. */
  readonly roleLabelKey: string | null;
  readonly glyph: string;
  /** ⚠️ 2+ clans. The SAME glyph — see the one-glyph rule in the header. */
  readonly glyphRotated: boolean;
  readonly target: PillTarget;
  readonly clanCount: number;
}

/**
 * The pill's view model.
 *
 * ⚠️ **The active clan is `clans[0]`** — the same default `clan/manage.tsx` uses
 * (`mine[0]`), so the two agree. A *persisted* active clan does not exist yet;
 * inventing one here would make the pill and the switcher disagree.
 *
 * ⚠️ **`roleLabelKey` returns an EXISTING key** (`role_head` …; `ROLE_LABEL_KEY`,
 * SCRUM-46) rather than a literal — that was the right call while the table was
 * *traditional* and this AC asked for the board's *simplified* `族长`: hardcoding it
 * would have put simplified text on a screen whose neighbours read traditional, a
 * **mixed-script screen**. ✅ **SCRUM-95 has since settled it** (PM, 2026-10-10:
 * *"Simplified Chinese. Has a significant larger market."*), the table is simplified
 * throughout, and `role_head` now resolves to **族長 → 族长** — so the pill matches its
 * board *without a single hardcoded string*, which is precisely why the key was used.
 */
export function pillView(clans: readonly PillClan[]): PillView {
  const first = clans[0];
  if (!first) {
    return {
      show: false,
      name: null,
      roleLabelKey: null,
      glyph: AFFORDANCE_GLYPH,
      glyphRotated: false,
      target: 'clan-fork',
      clanCount: 0,
    };
  }
  return {
    show: true,
    name: first.name,
    roleLabelKey: ROLE_LABEL_KEY[first.role],
    glyph: AFFORDANCE_GLYPH,
    glyphRotated: clans.length >= 2,
    target: 'clan-manage',
    clanCount: clans.length,
  };
}

/** The route a tap opens. Kept here so the screen cannot route somewhere else. */
export function pillRoute(target: PillTarget): string {
  return target === 'clan-manage' ? '/clan/manage' : '/clan';
}

