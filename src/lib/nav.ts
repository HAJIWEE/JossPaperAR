/**
 * The navigation bar's destinations and its rules — **as data**, so a gate can assert the rules
 * against the REAL routes rather than a fixture that could quietly drift from the component.
 *
 * ⚠️ **Why this is a module and not two lines inside `tab-bar.tsx`:** the bar used to take an
 * `active: string` PROP, supplied by its caller as a literal (`<TabBar active="shrine" …>`). That
 * made "which tab am I on?" a question the CALLER answered, and the caller was answering it for one
 * screen only — so the moment the bar appeared anywhere else, the answer would be wrong and the
 * no-op rule below would silently stop holding. ⚠️ **The bar now derives it from the path and takes
 * no such prop**, which is the difference between a shrine-specific fix and a global rule.
 *
 * ⚠️ This module is **dependency-free apart from `profile.ts`** (both pure), so `check:lib` can
 * import it without dragging React Native into the check runner.
 */

import { PROFILE_ROUTE } from './profile.ts';

export const LEAGUE_ROUTE = '/league';
/** ⚠️ The shrine is the index route, so its path is the root — not `/shrine`. */
/** ⚠️ The storefront — SCRUM-150. It was `null` (disabled) until this landed. */
export const STORE_ROUTE = '/store';

export const SHRINE_ROUTE = '/';

export interface NavTab {
  readonly key: string;
  readonly icon: string;
  readonly labelKey: string;
  /**
   * ⚠️ `null` = the screen does not exist yet (Store, SCRUM-150). The tab renders visibly
   * unavailable rather than as a link that 404s.
   */
  readonly route: string | null;
  /**
   * The file that serves `route`, so a gate can check the two things a tab owes the user:
   * **the screen exists**, and **the screen renders the bar**.
   *
   * ⚠️ That second one is the owner's ruling of 2026-11-01 — *"nav bar should be accessible for the
   * 4 options it displays"*. A destination you can reach but cannot leave is a **one-way push**,
   * which is what the bar's League and Profile buttons were while the bar rendered on the shrine
   * alone. ⚠️ `null` here must travel with `route: null`: a tab with a screen but no file is a dead
   * link, and a file but no bar is the one-way push.
   */
  readonly screen: string | null;
}

/**
 * ⚠️ **Store is DISABLED, Profile is LIVE.** Store has no screen and a route that 404s is a defect,
 * not a placeholder. ⚠️ **Profile's screen now exists (SCRUM-151)**, so it became tappable the day it
 * landed — which is exactly what this bar promised: the geometry does not change, only the state.
 *
 * ⚠️ The League tab's `#4` subtext is a RANK (`nav · tab League subtext`, `text.gold`); there is no
 * rank read on this screen yet, so it is not drawn — a static "#4" would be a lie about the user's
 * position.
 */
export const NAV_TABS: readonly NavTab[] = [
  { key: 'shrine', icon: '\u{1F3EE}', labelKey: 'nav.shrine', route: SHRINE_ROUTE, screen: 'index.tsx' },
  { key: 'league', icon: '\u{1F3C6}', labelKey: 'nav.league', route: LEAGUE_ROUTE, screen: 'league.tsx' },
  { key: 'store', icon: '\u{1F6CD}', labelKey: 'nav.store', route: STORE_ROUTE, screen: 'store.tsx' },
  // ⚠️ `PROFILE_ROUTE`, not a literal — the tab bar and `check:lib` §26 read the SAME string.
  { key: 'profile', icon: '\u{1F464}', labelKey: 'nav.profile', route: PROFILE_ROUTE, screen: 'profile.tsx' },
];

/** A path without its query, hash, or a trailing slash. `/` stays `/`. */
export function normalizePath(path: string): string {
  const bare = path.split('?')[0].split('#')[0];
  if (bare.length > 1 && bare.endsWith('/')) return bare.slice(0, -1);
  return bare === '' ? SHRINE_ROUTE : bare;
}

/** Do two routes name the same screen? ⚠️ A query or a trailing slash does not make a new screen. */
export function isSamePath(a: string, b: string): boolean {
  return normalizePath(a) === normalizePath(b);
}

/**
 * ⚠️⚠️ **THE NAV BAR'S ONE RULE — and it is GLOBAL, not shrine-specific** (owner's ruling,
 * 2026-11-01):
 *
 * > *"Tapping the tab you are already on should not re-render the page. This is common sense how the
 * > nav bar should work for all pages."*
 *
 * It was `router.push(tab.route)` **unconditionally**, so pressing the current tab pushed a **second
 * copy** of the route onto the stack: the screen re-mounted (a visible re-render) and the stack grew
 * **one duplicate entry per tap**. ⚠️ The `disabled` prop covered the other half of the problem
 * (`route === null`), which is why it read as *"Shrine is special"* rather than *"the handler never
 * checks where it is"*.
 *
 * ⚠️ **A rule about a PATH, not about a tab** — which is exactly why it lives here. Every tab is
 * covered by the same expression, so there is no per-tab branch to forget, and `check:lib` §27 walks
 * **every** `NAV_TABS` entry plus a cross-product of paths.
 */
export function tabPressIsNoop(route: string | null, currentPath: string): boolean {
  // ⚠️ `null` is a tab with no screen yet. The Pressable is `disabled`, so the press cannot happen —
  // and a press that cannot happen must not be reported as one that would navigate.
  if (route === null) return true;
  return isSamePath(route, currentPath);
}

/**
 * Which tab a path belongs to, or `null` when the path is not one of the bar's tabs (Settings,
 * History, a clan screen…) — in which case **no tab is highlighted**, which is the honest answer
 * rather than defaulting to the shrine.
 *
 * ⚠️ Exact match, not a prefix: `/` must not claim `/league`.
 */
export function activeTabKey(
  pathname: string,
  tabs: readonly NavTab[] = NAV_TABS,
): string | null {
  const hit = tabs.find((tab) => tab.route !== null && isSamePath(tab.route, pathname));
  return hit === undefined ? null : hit.key;
}
