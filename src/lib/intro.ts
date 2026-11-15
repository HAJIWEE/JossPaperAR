/**
 * intro.ts — the THREE INTRO PANELS, as data (SCRUM-171)
 *
 * ⚠️⚠️ **THE COPY IS NOT HERE, AND THAT IS DELIBERATE.** Every string below is an i18n KEY resolved
 * from `lib/i18n.ts`, because the words are the **signed-off boards'** (`EN · 0b Onboarding` and its
 * two siblings, plus the ZH trio). This file only says WHICH keys a panel shows and in what order,
 * so a typo in the copy cannot be introduced by the layout.
 *
 * ⚠️ **THE PANELS ARE NOT SYMMETRICAL, and the boards are why:** panel 1 carries a **three**-step
 * eyebrow row (`BURIED · BURNED · NOW`), while panels 2 and 3 carry **two** each (`PHOTO · JOSS
 * STYLE`, `THROW · BURN`). Rendering three slots on every panel would invent a label.
 *
 * ⚠️ **NO IMPORTS, ON PURPOSE.** `check:lib` imports this module under plain Node, so it must not
 * reach `AsyncStorage` or anything react-native — that is the documented `ERR_MODULE_NOT_FOUND`
 * trap. The flag's device half lives in `intro-seen.ts`; the SCREEN lives in `app/onboarding.tsx`.
 */

export type IntroPanelId = 'p1' | 'p2' | 'p3';

export interface IntroPanel {
  readonly id: IntroPanelId;
  /** ⚠️ Two or three, per the board — never padded to a fixed width. */
  readonly eyebrows: readonly string[];
  readonly titleKey: string;
  readonly bodyKey: string;
  /** The CTA's own key: `Next` twice, then `Get started` on the last panel. */
  readonly ctaKey: string;
}

/**
 * ⚠️ **ORDER IS THE FLOW.** `SCRUM-171` is a three-step story — *what this is* → *what you offer* →
 * *what you do* — so the array's order IS the narrative and must not be sorted or reordered.
 */
export const INTRO_PANELS: readonly IntroPanel[] = [
  {
    id: 'p1',
    eyebrows: ['intro.p1.e1', 'intro.p1.e2', 'intro.p1.e3'],
    titleKey: 'intro.p1.title',
    bodyKey: 'intro.p1.body',
    ctaKey: 'intro.next',
  },
  {
    id: 'p2',
    eyebrows: ['intro.p2.e1', 'intro.p2.e2'],
    titleKey: 'intro.p2.title',
    bodyKey: 'intro.p2.body',
    ctaKey: 'intro.next',
  },
  {
    id: 'p3',
    eyebrows: ['intro.p3.e1', 'intro.p3.e2'],
    titleKey: 'intro.p3.title',
    bodyKey: 'intro.p3.body',
    /** ⚠️ The LAST panel's CTA is different copy, not a different button. */
    ctaKey: 'intro.start',
  },
];

export const INTRO_LAST_INDEX = INTRO_PANELS.length - 1;

export function isLastPanel(index: number): boolean {
  return index >= INTRO_LAST_INDEX;
}

/**
 * ⚠️ Clamped, never modulo: the last panel must not wrap back to the first. A wrap would make
 * `Get started` re-show the intro to someone who has finished it.
 */
export function nextPanel(index: number): number {
  return isLastPanel(index) ? INTRO_LAST_INDEX : index + 1;
}

export function clampPanel(index: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), INTRO_LAST_INDEX);
}

/**
 * ⚠️⚠️ **BOTH EXITS GO HERE — `Skip` AND `Get started` (owner, 2026-11-15: option A).**
 *
 * The intro does not end at the shrine: it hands to the **clan fork**, because a burn is clan-scoped
 * (`submit_burn` refuses without a `clan_id`, SCRUM-82) and a user who lands on the shrine with no
 * clan would see a `Begin an offering` that cannot complete. ⚠️ **`SCRUM-169` owns the wiring** —
 * this constant is the screen's own declaration of where it goes, not the boot flow's.
 */
export const CLAN_FORK_ROUTE = '/clan';

/** The screen that renders the three panels (SCRUM-171 · wired by SCRUM-169). */
export const INTRO_ROUTE = '/onboarding';

/** The shrine — the only route the intro may interrupt. */
export const ROOT_ROUTE = '/';

/**
 * ⚠️ **THE BOOT'S ONE DECISION (SCRUM-169).** The intro is offered **once**, and
 * **only from the root**: a deep link (`/clan`, `/league`), the sign-in wall or
 * any other screen must never be bounced to the panels.
 *
 * ⚠️ This is a PURE function on purpose — `check:lib` asserts the table below,
 * so "appears exactly once" is a tested fact rather than a boot flow nobody can
 * observe. The screen itself deliberately does not read the flag.
 */
export function shouldShowIntro(pathname: string, introSeen: boolean): boolean {
  return pathname === ROOT_ROUTE && introSeen === false;
}
