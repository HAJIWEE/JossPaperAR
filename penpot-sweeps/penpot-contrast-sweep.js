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
 *  1b. Discovers the LEAGUE board's pairs as well (SCRUM-11). Its parts are named
 *      `row 1 · Chen Family (bg)`, `row 1 · rank`, `divider · promotion line`,
 *      `art · tier badge label` — NONE of which match the chip convention above. So before
 *      this branch the entire 6 / 6b League board was invisible to the ASSERTED half of the
 *      sweep and could only ever surface in part 2's report-only "lead" list. Rows resolve to
 *      their own `(bg)` sibling; the named singletons resolve by compositing.
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
 *  7. ⚠️ **A NESTED BOARD HAS NO FILL OF ITS OWN — DO NOT SCAN IT STANDALONE.** The
 *     `6 · League · list viewport (scroll)` board sits INSIDE `EN · 6 League` and has no fill,
 *     so `boardFillOf()` fell back to WHITE and reported a phantom
 *     `#7b621f on #ffffff = 5.82` for its promotion divider, whose real backdrop is the parent
 *     board's --paper (#f5f0e8, 5.13) — a 0.69 error on a pair whose whole margin is 0.63.
 *     Parts 1/1b/2 now scan TOP-LEVEL boards only; `ordered()` walks down into nested
 *     children, so no shape is lost and no phantom surface is invented.
 *  8. ⚠️ **A NAMED `(bg)` SIBLING IS NOT AUTOMATICALLY THE SURFACE** (trap 2, one level up).
 *     A league row's `row 1 · Chen Family (bg)` rectangle is the backdrop for its rank / name
 *     / points but NOT for the avatar glyph, which sits on its own ELLIPSE — and that ellipse
 *     is painted AFTER the row rect and covers the ink centre. The first version of part 1b
 *     preferred the named sibling unconditionally and so reported the avatar glyph as cream
 *     on the ROW (`#f8f1dc` / `#fdf8e7` / `#fbf7ee`) = 1.00–1.07: SIX failures on pairs that
 *     actually measure 4.51–7.91. The sibling is the honest pair only when nothing OPAQUE
 *     painted after it also covers the ink centre; otherwise the composite wins.
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

/* trap 7 (SCRUM-11 step 5): a board NESTED inside another board usually has NO fill of its
   own, so boardFillOf() falls back to WHITE and any pair measured on it is measured against
   a surface that does not exist. Scanning the nested copy of the 6 League list viewport
   standalone produced a phantom `#7b621f on #ffffff = 5.82` for its promotion divider, whose
   real backdrop is the parent board's --paper (#f5f0e8, 5.13). ordered() walks DOWN into
   nested children, so scanning top-level boards loses nothing and gains the real backdrop. */
const nestedBoardIds = new Set();
for (const b of boards) for (const s of ordered(b)) if (s.type === 'board') nestedBoardIds.add(s.id);
const topBoards = boards.filter(b => !nestedBoardIds.has(b.id));

/* every text shape already ASSERTED in part 1 or 1b — part 2 must not re-report it as a lead */
const assertedIds = new Set();

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
    assertedIds.add(s.id);
  }
}

/* 1b) the LEAGUE surfaces — a SECOND naming convention (SCRUM-11 step 5).
   WHY THIS DID NOT EXIST BEFORE: part 1 matches `/role chip \(label\)/` or `/^chip · /`.
   The 6 / 6b League boards name their parts `row 1 · Chen Family (bg)`, `row 1 · rank`,
   `divider · promotion line`, `art · tier badge label` — NONE of which match either pattern.
   So the whole league board was invisible to the ASSERTED half of this sweep: it could only
   ever appear in part 2's uncapped-by-nothing-but-15 "lead" list, which nothing asserts.
   That is the same shape of hole SCRUM-93 fell through, one level down.
   Rows resolve to their own `(bg)` sibling; the named singletons resolve by compositing. */
const leagueBoards = topBoards.filter(b => /League/i.test(b.name));
for (const b of leagueBoards) {
  const list = ordered(b);
  const boardFill = boardFillOf(b);
  const seen = new Map();
  for (const s of list) {
    if (s.type !== 'text' || !hexes(s).length) continue;
    if (/role chip \(label\)|^chip · /.test(s.name)) continue;          /* part 1 owns these */
    const rowM = s.name.match(/^(row \d+) · /);
    let bgShape = null;
    if (rowM) {
      const p = rowM[1] + ' · ';
      bgShape = list.find(q => q.name.indexOf(p) === 0 && /\(bg\)$/.test(q.name)) || null;
    }
    const i = list.indexOf(s);
    const resolved = surfaceUnder(list, i, s, boardFill);
    const fg = hexes(s)[0];
    const siblingSolid = !!(bgShape && solidFill(bgShape) &&
      (bgShape.fills[0].fillOpacity == null || bgShape.fills[0].fillOpacity >= 0.999));
    /* trap 8 (SCRUM-11 step 5): a row's `(bg)` rectangle is the backdrop for rank / name /
       points but NOT for the avatar glyph, which sits on its own ELLIPSE — and the ellipse is
       painted after the row rect and covers the glyph's ink centre. Preferring the named
       sibling unconditionally reported the avatar glyph as cream on the ROW
       (#f8f1dc / #fdf8e7 / #fbf7ee) = 1.00–1.07: SIX false failures on pairs that really
       measure 4.51–7.91. The sibling is the honest pair only when nothing OPAQUE painted
       after it also covers the ink centre; otherwise the composite — which already walks in
       paint order — is right. Same lesson as trap 2, one level up: a named surface is not
       automatically the surface. */
    const c = inkCentre(s);
    const idxBg = bgShape ? list.indexOf(bgShape) : -1;
    let covered = false;
    if (idxBg >= 0) {
      for (let j = idxBg + 1; j < i; j++) {
        const q = list[j];
        if (q.type === 'text' || q.type === 'board' || !solidFill(q)) continue;
        const a = q.fills[0].fillOpacity == null ? 1 : q.fills[0].fillOpacity;
        if (a >= 0.999 && contains(q, c.x, c.y)) { covered = true; break; }
      }
    }
    const useSibling = siblingSolid && !covered;
    const bgHex = useSibling ? String(bgShape.fills[0].fillColor).toLowerCase() : resolved.surface;
    const need = needFor(s.fontSize, s.fontWeight);
    const layer = s.name.replace(/^row \d+ · /, 'row · ');             /* rows 1..8 collapse */
    const key = layer + '|' + fg + '|' + bgHex + '|' + need;
    const hit = seen.get(key);
    if (hit) { hit.rows++; continue; }
    const r = ratio(fg, bgHex);
    const rec = {
      board: b.name, layer, on: useSibling ? bgShape.name : 'composited surface',
      fg, bg: bgHex, text: need === AA_BODY ? 'normal' : 'large', ratio: r, need,
      pass: r >= need, siblingSolid: useSibling, convention: 'league', rows: 1,
      fs: s.fontSize, fw: s.fontWeight,
    };
    seen.set(key, rec);
    pairs.push(rec);
    assertedIds.add(s.id);
  }
}

/* 2) a whole-page pass for pairs the naming convention misses — REPORTED, not asserted,
      because the resolver is an approximation (trap 4) and this list is a lead, not a verdict */
const otherFindings = [];
for (const b of topBoards) {
  const list = ordered(b);
  const boardFill = boardFillOf(b);
  list.forEach((s, i) => {
    if (s.type !== 'text' || !hexes(s).length || /role chip \(label\)|^chip · /.test(s.name)) return;
    if (assertedIds.has(s.id)) return;                 /* part 1 / 1b already asserts it — no duplicate lead */
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
const chipPairs = pairs.filter(p => p.convention !== 'league');
const leaguePairs = pairs.filter(p => p.convention === 'league');
return {
  revn: penpot.currentFile.revn,
  boardsOnPage: boards.length,
  boardsScanned: topBoards.length,          /* trap 7 — nested boards are reached, not scanned twice */
  chipPairs: chipPairs.length,
  chipFailures: chipPairs.filter(p => !p.pass).length,
  leaguePairs: leaguePairs.length,
  leagueFailures: leaguePairs.filter(p => !p.pass).length,
  failures,
  league: leaguePairs,                      /* the SCRUM-11 step 5 manifest fragment */
  passing: pairs.filter(p => p.pass),
  /* the fragment to freeze into design-system/penpot-pairs.json */
  manifestPairs: pairs.map(p => ({ board: p.board, layer: p.layer, on: p.on, fg: p.fg, bg: p.bg, text: p.text })),
  otherFindingsBelowThreshold: otherFindings.length,
  otherFindings: otherFindings.slice(0, 15),
};
