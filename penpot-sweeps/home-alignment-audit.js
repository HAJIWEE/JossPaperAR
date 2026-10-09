/*
 * Penpot MCP sweep — Home alignment audit for the S36 clan pill (READ-ONLY)
 * Project: Joss Paper AR · file `JossPaperAR`, page "New-user tutorial · Core loop"
 *
 * Trigger: PM reviewed the four S36 pill boards (2026-10-09) and reported THREE defects:
 *   1) "alignment issues with the clan head status display"  -> the role chip
 *   2) "the streak display is also aligned top"              -> the streak panel
 *   3) "the drop down arrow is inconsistent"                 -> `>` vs a down-triangle
 *
 * WHY THIS EXISTS RATHER THAN A GUESS — the lesson from `occlusion-contrast-audit-v3.js`:
 *    a Text shape reports a LAYOUT box, not its inked glyphs. The S36 pill was built by
 *    comparing LAYOUT boxes, which is why it passed a `0 collisions` check and still looks
 *    wrong to a human. This audit measures `textBounds` (the real ink box, ABSOLUTE coords)
 *    and compares INK centres to their container's centre.
 *
 * RULES
 *   chip  : |ink centre - chip-bg centre|            > TOL  -> defect 1
 *   pill  : |ink centre - pill-bg centre|            > TOL  -> defect 1 (the name)
 *   panel : |content ink span centre - panel centre| > TOL  -> defect 2
 *   arrow : the affordance glyphs differ across the four boards in FAMILY, not just
 *           codepoint. U+203A (single right angle quote) is punctuation; U+25BE (black
 *           down small triangle) is a geometric shape. Different blocks => different
 *           weight and optical size => defect 3. The file's own chevron convention is the
 *           angle-quote family (`< Back to the fork`), so the "open" state must be a
 *           ROTATED `>`, never a mixed-family glyph.
 *
 * TRAPS FOUND WHILE FIXING THIS (2026-10-09, S36b) — each one silently produced a wrong result
 *  1. A Text keeps its OLD WRAP until its content is rewritten. The pill's name read `h: 39.2`
 *     (2 lines) in an 80px box because it had NEVER been re-flowed since creation. Widening the
 *     box does nothing on its own; re-write `characters` (append a space, set it back) to force
 *     the re-flow. "Tan Family" needs 84.2px, not the 80 it was given.
 *  2. `verticalAlign` is a NO-OP when set to its CURRENT value — so restoring a box's height does
 *     not re-centre the text. Toggle it ('top' then 'center') WITH a re-flow between.
 *  3. `growType = 'auto-width'` COLLAPSES the height (a 44px box became 18px) and the text stays
 *     anchored where it was. Prefer `fixed` with a measured width for anything that must sit on an
 *     axis. If you must use auto-width, set the height AFTER, and re-verify.
 *  4. `rotate(angle)` is INCREMENTAL, not absolute. Two calls of 90 gave 180. Use the `rotation`
 *     property for an absolute value, and rotate about the box's OWN centre
 *     (`rotate(90, {x: cx, y: cy})`) or the glyph walks off-centre.
 *  5. A freshly created Text reports `textBounds` as ALL ZEROS until it has been laid out. Reading
 *     it immediately yields 0 and silently places siblings at x=0. Re-measure in a LATER call, and
 *     guard with a measured constant.
 *  6. `page.findShapes({type:"board"})` includes the "Root Frame" (which holds 157 boards), so a
 *     SUBTREE walk double-counts every panel and would have shifted 136 shapes twice. Walk DIRECT
 *     children (`board.children`) when fixing per-board, and de-duplicate by shape id.
 *
 * Penpot API notes (verified live 2026-09-28, re-confirmed 2026-10-09)
 *  - `Page` has no `.boards` / `.children`; entry points are `page.root`,
 *    `page.findShapes({...})`, `page.getShapeById(id)`.
 *  - `findShapes({type:"board"})` INCLUDES the page's "Root Frame" — filter it (matching
 *    by name sidesteps this).
 *  - `Text.textBounds` = {x,y,width,height} in ABSOLUTE page coords, same space as
 *    `shape.bounds`. `Text.verticalAlign` in center|top|bottom|null.
 *
 * Tunables: TOL
 */

const TOL = 1; // px — an ink centre further than this from its container's centre is a defect

const page = penpot.currentPage;

const PILL_BOARDS = [
  'EN · 1h Home / clan pill',
  'EN · 1h2 Home / clan pill · 2+ clans',
  'ZH · 1h Home / 宗族标识',
  'ZH · 1h2 Home / 宗族标识 · 2+ 宗族',
];
const HOME_BOARDS = ['EN · 1 Home / Shrine', 'ZH · 1 Home / 首页'];

const boards = page.findShapes({ type: 'board' });
const byName = (n) => boards.find((b) => b.name === n);

const r1 = (v) => Math.round(v * 10) / 10;
const centreY = (s) => r1(s.y + s.height / 2);
const inkCentreY = (t) => (t.textBounds ? r1(t.textBounds.y + t.textBounds.height / 2) : null);
const inkSpan = (shapes) => {
  const b = shapes.filter((s) => s.textBounds).map((s) => s.textBounds);
  if (!b.length) return null;
  const top = Math.min(...b.map((x) => x.y));
  const bot = Math.max(...b.map((x) => x.y + x.height));
  return { top: r1(top), bottom: r1(bot), centre: r1((top + bot) / 2) };
};

const descend = (shape, out = []) => {
  out.push(shape);
  if (shape.children) shape.children.forEach((c) => descend(c, out));
  return out;
};

const report = { chip: [], pillName: [], panel: [], arrow: [], verticalAlign: [] };

// ── 1) the pill: name ink vs pill centre, chip-label ink vs chip-bg centre ───────────────
for (const name of PILL_BOARDS) {
  const b = byName(name);
  if (!b) { report.chip.push({ board: name, MISSING: true }); continue; }
  const all = descend(b);
  const pick = (n) => all.find((s) => s.name === n);
  const bg = pick('clan · pill (bg)');
  const nm = pick('clan · name');
  const chipBg = pick('clan · role chip (bg)');
  const chipLbl = pick('clan · role chip (label)');
  const aff = pick('clan · affordance');

  const pillC = bg ? centreY(bg) : null;
  const chipC = chipBg ? centreY(chipBg) : null;

  report.chip.push({
    board: name,
    chipBgCentre: chipC,
    chipLabelInkCentre: inkCentreY(chipLbl),
    dChip: chipC != null && chipLbl ? r1(inkCentreY(chipLbl) - chipC) : null,
    chipLabelValign: chipLbl ? chipLbl.verticalAlign : null,
    chipLabelLineHeight: chipLbl ? chipLbl.lineHeight : null,
    chipLabelChars: chipLbl ? chipLbl.characters : null,
    chipLabelInkBox: chipLbl ? chipLbl.textBounds : null,
    chipBgBox: chipBg ? { y: r1(chipBg.y), h: r1(chipBg.height) } : null,
  });

  report.pillName.push({
    board: name,
    pillCentre: pillC,
    nameInkCentre: inkCentreY(nm),
    dName: pillC != null && nm ? r1(inkCentreY(nm) - pillC) : null,
    nameValign: nm ? nm.verticalAlign : null,
    nameFontSize: nm ? nm.fontSize : null,
    dNameVsChip: nm && chipLbl ? r1(inkCentreY(nm) - inkCentreY(chipLbl)) : null,
  });

  report.arrow.push({
    board: name,
    chars: aff ? aff.characters : null,
    codepoints: aff ? Array.from(aff.characters).map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ') : null,
    fontFamily: aff ? aff.fontFamily : null,
    fontSize: aff ? aff.fontSize : null,
    rotation: aff ? aff.rotation : null,
    inkBox: aff ? aff.textBounds : null,
    box: aff ? { x: r1(aff.x), w: r1(aff.width), h: r1(aff.height) } : null,
  });
}

// ── 2) the streak panel (and the tribute panel beside it, as the control) ────────────────
for (const name of HOME_BOARDS) {
  const b = byName(name);
  if (!b) { report.panel.push({ board: name, MISSING: true }); continue; }
  const all = descend(b);
  for (const key of ['streak', 'tribute']) {
    const bg = all.find((s) => s.name === 'panel · ' + key + ' (bg)');
    if (!bg) continue;
    const content = all.filter((s) => s.type === 'text' && s.name.indexOf('panel · ' + key) === 0 && s.name.indexOf('(bg)') === -1);
    const span = inkSpan(content);
    const panelTop = r1(bg.y);
    const panelBot = r1(bg.y + bg.height);
    const panelC = centreY(bg);
    report.panel.push({
      board: name, panel: key,
      panelBox: { top: panelTop, bottom: panelBot, centre: panelC, h: r1(bg.height) },
      contentInk: span,
      dContent: span ? r1(span.centre - panelC) : null,
      marginTop: span ? r1(span.top - panelTop) : null,
      marginBottom: span ? r1(panelBot - span.bottom) : null,
      DEFECT: span ? Math.abs(span.centre - panelC) > TOL : null,
      content: content.map((t) => ({ n: t.name, chars: t.characters, fs: t.fontSize, valign: t.verticalAlign, ink: t.textBounds ? { y: r1(t.textBounds.y), h: r1(t.textBounds.height) } : null })),
    });
  }
}

// ── did `verticalAlign` actually take on the pill's own texts? ───────────────────────────
{
  const b = byName(PILL_BOARDS[0]);
  if (b) {
    for (const s of descend(b)) {
      if (s.type !== 'text') continue;
      if (['nav · ', 'panel · ', 'caption · ', 'hint · ', 'btn · ', 'zone · ', 'touch · '].some((p) => s.name.indexOf(p) === 0)) continue;
      report.verticalAlign.push({
        n: s.name, chars: s.characters, valign: s.verticalAlign,
        boxH: r1(s.height), inkH: s.textBounds ? r1(s.textBounds.height) : null,
        slack: s.textBounds ? r1(s.height - s.textBounds.height) : null,
      });
    }
  }
}

const defects = {
  chip_delta: report.chip.filter((x) => x.dChip != null && Math.abs(x.dChip) > TOL).map((x) => x.board + ' d' + x.dChip),
  name_delta: report.pillName.filter((x) => x.dName != null && Math.abs(x.dName) > TOL).map((x) => x.board + ' d' + x.dName),
  name_vs_chip: report.pillName.filter((x) => x.dNameVsChip != null && Math.abs(x.dNameVsChip) > TOL).map((x) => x.board + ' d' + x.dNameVsChip),
  panel: report.panel.filter((x) => x.DEFECT).map((x) => x.board + ' / ' + x.panel + ' d' + x.dContent + ' (top ' + x.marginTop + ' bottom ' + x.marginBottom + ')'),
  arrowFamilies: Array.from(new Set(report.arrow.map((a) => a.codepoints))),
};

return { revn: penpot.currentFile.revn, boardCount: boards.length, defects, report };
