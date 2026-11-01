/**
 * The offerings picker's rules — `EN · 2e Offerings picker` (SCRUM-149).
 *
 * ⚠️ **The board draws ONE card in the UNAVAILABLE state** — `card · Wealth Bundle (bg)` has
 * `fill=none` and a `#4a463f` outline where the other five are `#fbf7ee` with an ink border. So the
 * picker is not a flat list: **an item you do not own is drawn, and drawn as unavailable.** That is
 * the same posture `tab-bar.tsx` takes for Store before it existed — a dead link and an inert
 * live-looking control are both worse than a visibly unavailable one.
 *
 * ⚠️⚠️ **THE BOARD'S ITEM LIST IS NOT THE CATALOGUE'S, AND THE CATALOGUE WINS.** `EN · 2e` draws six
 * items — *Joss Stack 240 · Cash Bundle 480 · Phone 720 · Gold Bar 960 · House 1,440 · Wealth
 * Bundle* — where the catalogue has five (*Joss Paper Stack 480 · Gold Bar 720 · Smartphone 960 ·
 * House 1,440 · Wealth Bundle 2,400*). ⚠️ The board's numbers are the catalogue's bases **shifted by
 * one**, and it carries a *Joss Stack* that no catalogue entry has. `domain/catalogue.ts` is
 * code-owned and the SERVER re-reads it on every burn, so it is the authority; the board is filed.
 */

import { OFFERINGS, type Offering, type OfferingCode } from '../domain/catalogue.ts';
import { baseValueOf } from '../domain/catalogue.ts';
import type { Inventory } from './offerings-api.ts';

/** Geometry, in **board px** (`EN · 2e`, 390×844) — the same 2×3 grid as Collection. */
export const PICKER = {
  /** `note · collection` — 24,96 342×34. The board's own words, which explain the whole screen. */
  note: { y: 96 },
  card: { w: 165, h: 170, radius: 14, xs: [20, 197] as const, ys: [168, 350, 532] as const },
  /** `art · …` sits 12 below the card top (the board's `art · Joss Stack` is at y 180 in a card at 168). */
  art: { w: 110, h: 80, top: 12 },
  name: { dy: 100 },
  meta: { dy: 120 },
  text: { dx: 10, w: 145 },
} as const;

export interface PickerCell {
  readonly code: OfferingCode;
  readonly offering: Offering;
  /** ⚠️ `qty > 0` — the ONE thing that decides whether this card can be chosen. */
  readonly owned: boolean;
  readonly qty: number;
}

/**
 * Every burnable catalogue offering, with what the caller owns.
 *
 * ⚠️ **The list is the CATALOGUE, not the inventory.** A picker built from the inventory would hide
 * every item the player has not bought — so the screen would show an empty grid to a new player and
 * say nothing about what exists. The board draws the unowned state for exactly this reason.
 * ⚠️ **EVERY catalogue offering is offered**, and that is a fact worth stating: the server's
 * `offerings_catalog.burnable` defaults to **true** and no migration has ever set it false, so
 * filtering on it here would be a client-side copy of a server rule that has never fired. ⚠️ If a
 * future migration marks one non-burnable, `submit_burn` refuses it with *"unknown or non-burnable
 * offering"* — and **that refusal is the honest place for the rule to live**, because it is the one
 * that decides.
 */
export function pickerGrid(inventory: Inventory): readonly PickerCell[] {
  return OFFERINGS.map((offering) => {
    const raw = inventory[offering.code];
    const qty = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : 0;
    return { code: offering.code, offering, owned: qty > 0, qty: qty > 0 ? qty : 0 };
  });
}

/** ⚠️ The card's meta line: the item's **redemption base**, which is what a burn is worth. */
export function pickerBase(offering: Offering): number {
  return baseValueOf(offering.price);
}

/** ⚠️ True when the caller owns nothing at all — the screen says so rather than showing 5 dead cards. */
export function ownsNothing(inventory: Inventory): boolean {
  return Object.values(inventory).every((q) => !(typeof q === 'number' && q > 0));
}
