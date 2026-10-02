/*
 * Penpot MCP sweep — icon occlusion + clipping audit (READ-ONLY)
 * Project: Joss Paper AR · file `JossPaperAR`, page "New-user tutorial · Core loop"
 * Trigger: PM saw logo/icon art partially obscured on `EN · 3d` (Transform / failed).
 *
 * Paste the body below into penpot__execute_code. Returns a compact failure report
 * only (no full child dumps) so the response stays small across 131 boards.
 *
 * Rules
 *  clip  : a visible shape crosses the board frame by more than TOL px
 *          (board.clipContent then hides the overflow -> "partially obscured")
 *  occl  : a later (higher parentIndex = painted on top) opaque sibling covers
 *          >= COV of an icon-class shape's area. Deliberate corner badges are
 *          skipped (occluder must be >= 25% of the icon's own area). Text is
 *          only flagged at the stricter TEXT_COV threshold.
 *
 * Tunables: TOL, COV, TEXT_COV, ICON_RE, ICON_TYPES
 */

const TOL = 1;          // px tolerance for the out-of-frame test
const COV = 0.30;       // non-text occluder: fraction of icon area covered
const TEXT_COV = 0.50;  // text occluder: stricter, labels are often legitimate
const ICON_TYPES = new Set(["ellipse", "path", "svg", "image", "circle"]);
const ICON_RE = /icon|logo|mark|art|glyph|seal|stamp|sigil|emblem|lantern|totem|offering/i;

const page = penpot.currentPage;
// NOTE (verified live 2026-09-28): this Penpot build's Page has NO `.boards` and no `.children`.
// Entry points are `page.root`, `page.findShapes({...})` and `page.getShapeById(id)`.
// findShapes({type:"board"}) returns 136 shapes here — it includes the page's "Root Frame",
// which must be filtered out before treating the rest as wireframe boards.
const boards = page.findShapes({ type: "board" }).filter(b => b.name !== "Root Frame");
const report = [];
let leaves = 0;

function absBounds(s) {
  const b = s.bounds;
  if (b && b.width != null) {
    return { x1: b.x, y1: b.y, x2: b.x + b.width, y2: b.y + b.height, w: b.width, h: b.height };
  }
  return { x1: s.x, y1: s.y, x2: s.x + s.width, y2: s.y + s.height, w: s.width, h: s.height };
}

// depth-first walk; siblings are kept in paint order (parentIndex asc = back to front)
function walk(shape, acc, parent) {
  const kids = (shape.children || []).slice()
    .sort((a, b) => (a.parentIndex || 0) - (b.parentIndex || 0));
  for (let i = 0; i < kids.length; i++) {
    const s = kids[i];
    acc.push({ shape: s, parent, idx: i, siblings: kids, depth: parent === null ? 0 : 1 });
    if (s.children && s.children.length) walk(s, acc, s);
  }
}

function isOpaque(s) {
  const fills = s.fills || [];
  const hasFill = fills.some(f =>
    f.fillColor && !/transparent/i.test(String(f.fillColor)) && (f.fillOpacity == null || f.fillOpacity > 0.05));
  return hasFill || (s.strokes || []).length > 0 || s.type === "image";
}

function overlapArea(a, b) {
  const w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const h = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  return (w > 0 && h > 0) ? w * h : 0;
}

for (const board of boards) {
  const acc = [];
  walk(board, acc, null);
  const bb = absBounds(board);
  const fails = [];

  for (const e of acc) {
    leaves++;
    const s = e.shape;
    if (s.hidden) continue;
    const b = absBounds(s);

    // 1) clipping against the board frame
    const out = [
      Math.round(bb.x1 - b.x1), Math.round(bb.y1 - b.y1),
      Math.round(b.x2 - bb.x2), Math.round(b.y2 - bb.y2)
    ].filter(v => v > TOL);
    if (out.length) {
      fails.push({ kind: "clip", name: s.name, type: s.type,
                   outLTRB: out, r: Math.round(b.x1 - bb.x1), t: Math.round(b.y1 - bb.y1),
                   w: Math.round(b.w), h: Math.round(b.h) });
    }

    // 2) occlusion of icon-class shapes by later siblings
    const isIcon = ICON_TYPES.has(s.type) || ICON_RE.test(s.name || "");
    if (!isIcon) continue;
    const area = Math.max(b.w * b.h, 1);

    for (let j = e.idx + 1; j < e.siblings.length; j++) {
      const t = e.siblings[j];
      if (t.hidden || !isOpaque(t)) continue;
      const tb = absBounds(t);
      const cov = overlapArea(b, tb) / area;
      const tArea = Math.max(tb.w * tb.h, 1);
      const isText = t.type === "text";
      if (tArea < 0.25 * area) continue;                 // corner badge -> intentional
      if (isText ? cov >= TEXT_COV : cov >= COV) {
        fails.push({ kind: isText ? "occl-text" : "occl", icon: s.name, iconType: s.type,
                     by: t.name, byType: t.type, cov: Math.round(cov * 100) + "%" });
      }
    }
  }

  if (fails.length) {
    report.push({ board: board.name, x: Math.round(board.x), y: Math.round(board.y),
                  clipContent: board.clipContent, n: fails.length, fails: fails.slice(0, 12) });
  }
}

return {
  page: page.name,
  boardsScanned: boards.length,
  leavesScanned: leaves,
  boardsFailing: report.length,
  report: report.slice(0, 25)
};
