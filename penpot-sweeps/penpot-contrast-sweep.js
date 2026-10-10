/*
 * Penpot MCP sweep — chip contrast audit (READ-ONLY) → refreshes design-system/penpot-pairs.json
 * Project: Joss Paper AR · file `JossPaperAR`, page "New-user tutorial · Core loop"
 * Ticket : SCRUM-93 (the 0e3 role chip failed AA at 2.77:1 on two SIGNED-OFF boards)
 *
 * WHY A SWEEP AND NOT A GATE
 *   `check:contrast` reads tokens.css and the app stylesheet. It has NO view of Penpot, so a
 *   board can ship at 2.77:1 while every gate stays green — which is exactly what happened,
 *   despite SCRUM-45 having cleared 132 AA failures in the same file. A signed-off board is
 *   not a checked board. So: THIS discovers and measures live; `penpot-pairs.json` freezes the
 *   result; `check:contrast` asserts the frozen file in CI without needing Penpot.
 *
 * WHAT IT DOES
 *   1. Discovers every chip COMPONENT on every board by its own naming convention
 *      (`X (label)` + `X (bg)`, or `chip · Y` + `chip · Y (bg)`) — NOT by a hard-coded board
 *      list. That is how the 0e12 copy of the 0e3 defect was found: the ticket listed two
 *      boards, the component was on four.
 *   2. Resolves the surface each label actually sits on, COMPOSITING fillOpacity.
 *   3. Applies the SIZE-AWARE threshold: normal text 4.5:1, large text (>=24px, or >=18.66px
 *      bold) 3:1.
 *   4. Prints the pair list that `design-system/penpot-pairs.json` should hold.
 *
 * TRAPS FOUND WHILE WRITING THIS (2026-10-10, S37) — the first produced 191 false findings
 *  1. ⚠️⚠️ **`fillOpacity` IS NOT DECORATION — COMPOSITE IT.** v1/v2 read `fills[0].fillColor`
 *     and ignored opacity, so a 12%-gold TINT on paper (`#d4af37` at `fillOpacity: 0.12`) was
 *     treated as a SOLID gold fill. `#7b621f` on that phantom surface computes 2.77:1 and is
 *     FALSE — the real surface is ~`#f3ecd9` and the true ratio is >5. This manufactured
 *     **191 "AA failures"**, including `#9a2b18` on `#c23b22` at 1.44 for chips that are
 *     8%-tinted. The lesson is the project's own: a check that cannot fail correctly is worse
 *     than none, and a big scary number is not evidence. Fix: `blend(fg, bg, alpha)` in paint
 *     order over the board fill.
 *  2. ⚠️ **A TEXT shape is not a SURFACE.** v1 accepted any filled shape as a backdrop, so
 *     text-behind-text produced findings like a green week-delta on an ink-coloured name.
 *     Backdrops are non-text filled shapes (or the board).
 *  3. ⚠️ **Threshold by SIZE.** Several "failures" were 90px/700 glyphs at 3.4:1 and 40px/800
 *     logotypes at 3.37:1 — both PASS the 3:1 large-text bar. Applying the 4.5 body bar to
 *     everything invents defects at exactly the rate it invents confidence.
 *  4. ⚠️ Not modelled, so treat as approximations: groups (no fill of their own), gradients,
 *     images, strokes, and mask-clipped shapes. Walking siblings in paint order is right for
 *     these flat board stacks but is not a renderer.
 *  5. ⚠️ `findShapes({type:"board"})` includes the "Root Frame" (as S36 recorded) — filter it.
 *  6. ⚠️ **A discovery sweep is not a proof of scope.** It finds chips matching the naming
 *     convention. A chip named something else is invisible here, which is why the manifest is
 *     frozen and reviewed rather than generated straight into the gate.
 */

const AA_BODY = 4.5, AA_LARGE = 3.0;
const toRGB = h => { h = String(h).replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const lum = rgb => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); };
const ratio = (fg, bg) => { const a = lum(toRGB(fg)), b = lum(toRGB(bg)); return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100; };
const toHex = rgb => '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const blend = (fg, bg, a) => toHex(toRGB(fg).map((c, i) => c * a + toRGB(bg)[i] * (1 - a)));   /* trap 1 */

const page = penpot.currentPage;
const ordered = (root) => { const out = []; const walk = s => { for (const c of (s.children || [])) { out.push(c); walk(c); } }; walk(root); return out; };
const boards = page.findShapes({ type: 'board' }).filter(b => b.name !== 'Root Frame');   /* trap 5 */
const hexes = s => (s.fills || []).map(f => f.fillColor).filter(Boolean).map(h => String(h).toLowerCase());
const solidFill = s => s.fills && s.fills.length && typeof s.fills[0].fillColor === 'string';
const contains = (o, x, y) => x >= o.x && x <= o.x + o.width && y >= o.y && y <= o.y + o.height;
const inkCentre = t => { const b = t.textBounds; return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : { x: t.x + t.width / 2, y: t.y + t.height / 2 }; };
const boardFillOf = b => solidFill(b) ? String(b.fills[0].fillColor).toLowerCase() : '#ffffff';

/* size-aware requirement — trap 3 */
function needFor(fs, fw) {
  const size = parseFloat(fs) || 0, weight = parseInt(fw, 10) || 400;
  return (size >= 24 || (size >= 18.66 && weight >= 700)) ? AA_LARGE : AA_BODY;
}
/* the surface a text actually sits on: composite every filled NON-TEXT shape below it that
   covers the ink centre, in paint order, over the board's own fill — traps 1 & 2 */
function surfaceUnder(list, idx, text, boardFill) {
  const c = inkCentre(text);
  let surface = boardFill, layers = 0;
  for (let j = 0; j < idx; j++) {
    const q = list[j];
    if (q.type === 'text' || q.type === 'board' || !solidFill(q)) continue;
    if (!contains(q, c.x, c.y)) continue;
    const a = q.fills[0].fillOpacity == null ? 1 : q.fills[0].fillOpacity;
    surface = blend(String(q.fills[0].fillColor).toLowerCase(), surface, a);
    layers++;
  }
  return { surface, layers };
}

/* 1) discover chip pairs by the component's own naming convention (not a board list) */
const pairs = [];
for (const b of boards) {
  const list = ordered(b);
  const boardFill = boardFillOf(b);
  const byName = (n) => list.find(s => s.name === n);
  for (const s of list) {
    if (s.type !== 'text' || !hexes(s).length) continue;
    if (!/role chip \(label\)|^chip · /.test(s.name) || /\(bg\)/.test(s.name)) continue;
    const bgName = /role chip \(label\)/.test(s.name)
      ? s.name.replace('(label)', '(bg)')
      : s.name.replace(/^(chip · [^·]+?)(?: · .*)?$/, '$1 (bg)');
    const bg = byName(bgName);
    const i = list.indexOf(s);
    const resolved = surfaceUnder(list, i, s, boardFill);
    const fg = hexes(s)[0];
    /* prefer the named sibling's fill when it is SOLID — that is the honest pair to freeze;
       a tinted sibling is not the rendered surface, so fall back to the composite (trap 1) */
    const siblingSolid = !!(bg && solidFill(bg) && (bg.fills[0].fillOpacity == null || bg.fills[0].fillOpacity >= 0.999));
    const bgHex = siblingSolid ? String(bg.fills[0].fillColor).toLowerCase() : resolved.surface;
    const need = needFor(s.fontSize, s.fontWeight);
    const r = ratio(fg, bgHex);
    pairs.push({
      board: b.name, layer: s.name, on: siblingSolid ? bg.name : 'composited surface',
      fg, bg: bgHex, text: need === AA_BODY ? 'normal' : 'large',
      ratio: r, need, pass: r >= need, siblingSolid,
      bgOpacity: bg && bg.fills[0] ? (bg.fills[0].fillOpacity == null ? 1 : bg.fills[0].fillOpacity) : null,
      compositedSurface: resolved.surface, compositedLayers: resolved.layers,
    });
  }
}

/* 2) a whole-page pass for pairs the naming convention misses — REPORTED, not asserted,
      because the resolver is an approximation (trap 4) and this list is a lead, not a verdict */
const otherFindings = [];
for (const b of boards) {
  const list = ordered(b);
  const boardFill = boardFillOf(b);
  list.forEach((s, i) => {
    if (s.type !== 'text' || !hexes(s).length || /role chip \(label\)|^chip · /.test(s.name)) return;
    const fg = hexes(s)[0];
    const { surface, layers } = surfaceUnder(list, i, s, boardFill);
    const need = needFor(s.fontSize, s.fontWeight);
    const r = ratio(fg, surface);
    if (r < need) otherFindings.push({
      board: b.name, layer: s.name, chars: String(s.characters || '').slice(0, 24),
      fs: s.fontSize, fw: s.fontWeight, fg, surface, layers, ratio: r, need,
    });
  });
}

const failures = pairs.filter(p => !p.pass);
return {
  revn: penpot.currentFile.revn,
  boards: boards.length,
  chipPairs: pairs.length,
  chipFailures: failures.length,
  failures,
  passing: pairs.filter(p => p.pass),
  /* the fragment to freeze into design-system/penpot-pairs.json */
  manifestPairs: pairs.map(p => ({ board: p.board, layer: p.layer, on: p.on, fg: p.fg, bg: p.bg, text: p.text })),
  otherFindingsBelowThreshold: otherFindings.length,
  otherFindings: otherFindings.slice(0, 15),
};
