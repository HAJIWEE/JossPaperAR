/**
 * altar.ts — which part of the altar renders (SCRUM-146).
 *
 * ── WHY PURE ────────────────────────────────────────────────────────────────
 * Same reason as `bookView` (SCRUM-122) and `homePanels` (SCRUM-161): the empty/filled choice
 * is a fact about *which thing is shown*, so it lives where `check:lib` can read it instead
 * of in JSX that only an eye can check.
 *
 * ── ⚠️ THE BAND IS SHARED, ON PURPOSE ──────────────────────────────────────
 * The board draws `slot · ＋ add a tablet` at **131,285 129×307** and the CENTRE TABLET at
 * **exactly the same band** (`EN · 1c Home / full (4 tablets)`). So the ＋ affordance and the
 * tablet occupy one slot and swap in place — the altar does not reflow when the first tablet
 * is added. ⚠️ Rendering them in different places would move everything below.
 *
 * ── ⚠️ A CAROUSEL, NOT A GRID ──────────────────────────────────────────────
 * The filled board shows the **centre** tablet (129×307) with the neighbour peeking at 93×221,
 * plus `nav · carousel prev` (26,412 24×40) and `nav · carousel next` (340,412 24×40). So any
 * number of tablets is reachable by paging — never a "+N more" that strands the rest, which is
 * what SCRUM-146's brief warned about at the cap of 10.
 */

/**
 * ⚠️⚠️ **THE ALTAR SHOWS THREE AND PAGES BY ONE — THERE IS NO PAGE SIZE OF FOUR.**
 * (owner, 2026-11-09: *"i believe its already correct at 3"* — confirmed against the code, not taken on trust.)
 *
 * `carouselStage()` draws **centre + left + right** (`EN · 1b`) and `pageStep()` moves **one** tablet per swipe, so the stage
 * REPORTS three and the only limit is the list's length. The **clan cap is 10** (`ancestor_cap`, `ANCESTOR_CAP`): the carousel
 * pages to the tenth, it does not refuse it.
 *
 * ⚠️⚠️ **A DEAD `ALTAR_DISPLAY_SLOTS = 4` USED TO SIT HERE, AND THREE GATES GUARDED IT.** It was transcribed from a board's own
 * NAME (`EN · 1c Home / full (4 tablets)`) rather than decided — the owner never asked for four — and **nothing ever rendered
 * it**: `index.tsx` imports seven things from this file and that was not one of them. So the checks asserted a number no screen
 * read, while the behaviour that *is* real (three on the stage, one page per swipe) was covered by the stage geometry instead.
 * That is the vacuous-gate class: **a gate is only worth its line if the thing it reads is the thing that renders.**
 * ⚠️ Deleting the constant is what makes "how many are on screen" and "how many a clan may hold" impossible to conflate again.
 * ⚠️ **The board was RENAMED to `EN · 1c Home / full (3 tablets)` on 2026-11-09** — but measured by layer name, **its art still
 * draws TWO** (`tablet · left` + `tablet · centre`, no `tablet · right`, where `EN · 1b` has one at x=400). **A board is fixed
 * when its layers say so, not when its name does.**
 */

/**
 * ⚠️ **THE TABLET DRAWS AT 72 % OF ITS BAND** (owner, 2026-11-09: *"the tablet is also too big now… reduce the tablet
 * size by 20%"*).
 *
 * ⚠️ The BAND (`slot · ＋ add a tablet` / the centre tablet, `131,285 129×307`) is **not** the drawing: it is also the ＋
 * slot's tap target, so shrinking the band would shrink the control and move the carousel. Only the ART shrinks.
 * ⚠️ Bottom-aligned, not centred: the tablet's plinth must stay resting on the table (`y 588`), so it loses its height
 * from the TOP. Centring it would float the plaque off the burner.
 */
export const TABLET_SCALE = 0.72;

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Where the tablet draws inside its band: `TABLET_SCALE` of it, centred horizontally and sitting on the band's floor. */
export function tabletBox(band: { readonly w: number; readonly h: number }): Box {
  const w = band.w * TABLET_SCALE;
  const h = band.h * TABLET_SCALE;
  return { x: (band.w - w) / 2, y: band.h - h, w, h };
}


/**
 * ⚠️⚠️ **THE CAROUSEL SHOWS THREE TABLETS AT ONCE — `EN · 1b` draws left + centre + right** (owner, 2026-11-09: *"Refer to
 * En-1b i should see 3 tablets"*). ⚠️ The board's own rects are `tablet · centre (陈大文)` `131,285 129×307`,
 * `tablet · left (陈德海)` `57,369 93×221` and `tablet · right (陈氏)` `240,369 93×221`.
 *
 * ⚠️⚠️ **THEY ARE RECORDED AS RATIOS, NOT AS SIZES, and that is deliberate.** Measured off the board: `93/129 = 0.721` and
 * `221/307 = 0.720` — the neighbours are **0.72 of the centre**, and their centres sit **±92** from the centre's, i.e.
 * `92/129 = 0.713` of its width. ⚠️ The board's centre is full-band-size, but this app's centre is drawn at `TABLET_SCALE`
 * (0.72) because the owner shrank it separately — copying the board's absolute `93×221` would therefore draw three tablets
 * the SAME size and lose the hierarchy the board is showing. Ratios keep the picture and the owner's size.
 */
export const NEIGHBOUR_SCALE = 0.72;

/** `92 / 129` — a neighbour's centre from the current tablet's centre, as a fraction of its width. */
export const NEIGHBOUR_OFFSET = 0.713;

/**
 * The **geometric slot** of a neighbour, independent of whether that neighbour exists — `carouselStage()` uses it to decide
 * *what to draw*, and the screen uses it to place the **＋ add-tablet** control where the third tablet would sit (owner,
 * 2026-11-09: *"move the Add Ancestor + to where the 3rd tablet would've been"*).
 * ⚠️ One function, so the ＋ can never be a few px off the slot it advertises.
 */
export function peerSlot(
  band: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  side: 'left' | 'right',
): Box {
  const c = tabletBox(band);
  const w = c.w * NEIGHBOUR_SCALE;
  const h = c.h * NEIGHBOUR_SCALE;
  const offset = c.w * NEIGHBOUR_OFFSET;
  const midX = band.x + c.x + c.w / 2;
  return { x: midX + (side === 'left' ? -offset : offset) - w / 2, y: band.y + c.y + c.h - h, w, h };
}

/**
 * **The area a swipe may start in** — the three-tablet stage, whether or not the neighbours exist (the ＋ slot included).
 * ⚠️ A gesture needs REAL bounds; every piece of the stage is absolutely positioned, so without this the responder would be
 * attached to a zero-size box and never see a touch.
 * ⚠️ Always the full three-slot width, not "the tablets that exist": the swipe must work on the FIRST and LAST tablet too, where
 * a peer is missing but its slot is still where the finger lands.
 */
export function stageBounds(band: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }): Box {
  const c = tabletBox(band);
  const centre = { x: band.x + c.x, y: band.y + c.y, w: c.w, h: c.h };
  const left = peerSlot(band, 'left');
  const right = peerSlot(band, 'right');
  const x = Math.min(left.x, centre.x, right.x);
  const y = Math.min(left.y, centre.y, right.y);
  const r = Math.max(left.x + left.w, centre.x + centre.w, right.x + right.w);
  const b = Math.max(left.y + left.h, centre.y + centre.h, right.y + right.h);
  return { x, y, w: r - x, h: b - y };
}

/** The three-tablet stage: the current tablet, plus whichever neighbours exist. Rects are BOARD-absolute. */
export interface Stage {
  readonly centre: Box;
  readonly left: Box | null;
  readonly right: Box | null;
}

/**
 * ⚠️ **Bottom-aligned, not top-aligned**: the board puts the neighbours' feet at `590` against the centre's `592`, so all three
 * stand on the same table line — the 2 px is the board's own slack, and aligning exactly is the honest reading of it.
 * ⚠️ Ends are ends: no left neighbour on the first tablet, no right on the last (`1b` draws all three because it is the
 * middle state).
 */
export function carouselStage(
  band: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  index: number,
  count: number,
): Stage {
  const c = tabletBox(band);
  const centre: Box = { x: band.x + c.x, y: band.y + c.y, w: c.w, h: c.h };
  return {
    centre,
    left: index > 0 ? peerSlot(band, 'left') : null,
    right: index < count - 1 ? peerSlot(band, 'right') : null,
  };
}

export type AltarView =
  | { readonly kind: 'empty' }
  | {
      readonly kind: 'tablet';
      /** Index into the owner's list, already clamped. */
      readonly index: number;
      readonly count: number;
      readonly hasPrev: boolean;
      readonly hasNext: boolean;
    };

/**
 * ⚠️ `index` is CLAMPED, not trusted: removing a tablet while the carousel sits on the last
 * page would otherwise point past the end of the list and render nothing.
 */
export function altarView(count: number, index: number): AltarView {
  if (count <= 0) return { kind: 'empty' };
  const safe = Math.min(Math.max(0, Math.trunc(index)), count - 1);
  return {
    kind: 'tablet',
    index: safe,
    count,
    hasPrev: safe > 0,
    hasNext: safe < count - 1,
  };
}

/** Where a page tap goes. ⚠️ Wraps nothing: the ends are ends. */
export function pageStep(index: number, count: number, delta: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(0, index + delta), count - 1);
}

/**
 * ⚠️⚠️ **WHICH WAY A HORIZONTAL DRAG PAGES — one pure function, because getting it wrong is invisible.**
 * (owner, 2026-11-09: *"there is still a bug where i am toggling thru the same 2 sets. differentiate the swipe if its from left
 * to right or right to left and how it should increment or decrement the tablets"*).
 *
 * ⚠️ **`dx` is the finger's travel**: a swipe whose finger goes right→left has a NEGATIVE `dx` and must **advance** (+1, the next
 * tablet comes forward from the right), exactly as a page in a book moves. Left→right goes **back** (−1).
 * ⚠️ Below `commit` the answer is **0** — no page change — so a small drag is not a gesture.
 * ⚠️ This is a pure function and not an inline ternary **because the first cut read `dx` inside a `setPage` updater**: React runs
 * that later, RN reuses and RESETS one `gestureState` per gesture, so `dx` was 0 by then and the direction was always −1 — swiping
 * forward clamped at the first tablet and the carousel looked like it toggled between two. Logged proof: `page 0 -> 0 of 6 dx=0`.
 */
export function swipeStep(dx: number, commit: number): -1 | 0 | 1 {
  if (Math.abs(dx) < commit) return 0;
  return dx < 0 ? 1 : -1;
}

/** The page a swipe lands on. ⚠️ `pageStep` clamps, so the ends are ends rather than a wrap. */
export function pageAfterSwipe(page: number, count: number, dx: number, commit: number): number {
  return pageStep(page, count, swipeStep(dx, commit));
}

/**
 * The altar-state caption — `caption · altar state`, one line above the halo.
 *
 * ── ⚠️ WHY THE KEY IS CHOSEN HERE AND NOT IN THE SCREEN ─────────────────────
 * `EN · 1 Home / Shrine` carries the EMPTY line and `EN · 1b Home / tablets (carousel)` the
 * filled one; the screen used to render the empty line unconditionally, so a shrine holding
 * three tablets still read *"Your altar is empty"* — the difference the owner saw against the
 * board. The choice is a fact about the count, so it lives here where `check:lib` reads it.
 *
 * ⚠️ **The singular is OURS.** The board draws only the 3-tablet case, and `%{count} ancestors`
 * would print *"1 ancestors"*. One key, one branch, asserted.
 *
 * ⚠️ `count <= 0` returns the EMPTY key rather than the plural: a negative count is not a
 * state the server can produce, and falling through to "−1 ancestors" would be worse than
 * the empty line.
 */
export function altarCaption(count: number): {
  readonly key: string;
  readonly options?: Record<string, unknown>;
} {
  if (count <= 0) return { key: 'home.altarEmpty' };
  if (count === 1) return { key: 'home.altarFilledOne' };
  return { key: 'home.altarFilled', options: { count: String(count) } };
}
