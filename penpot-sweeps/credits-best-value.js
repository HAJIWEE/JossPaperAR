/**
 * credits-best-value.js — Penpot MCP sweep (READ-ONLY) → refreshes design-system/credits-ladder.json
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * `BEST VALUE` is a FORMULA, not a hand-placed label:
 *
 *     perCredit(b) = price(b) / credits(b)
 *     bestRate     = min(perCredit)              ← "best value" = cheapest credit
 *     winner       = bestRate, then SMALLEST credits   ← the documented tie-break
 *
 * ⚠️ `npm run check:credits` asserts the frozen manifest against that rule — but CI cannot
 * reach Penpot, so it cannot see where the badge ACTUALLY sits. This sweep closes that gap:
 * it reads the boards, recomputes the winner, and tells you whether the drawn badge agrees.
 *
 * Run it (in the Penpot plugin context, via the MCP) after ANY price change, then update
 * `design-system/credits-ladder.json` with what it prints.
 *
 * ⚠️ The ladder is an APPRECIATING PREMIUM (PM, 2026-10-10): the largest bundle costs
 * $1.55/1,000 — doc 10's rate — and each step DOWN adds $0.02/1,000. So there is a UNIQUE
 * winner (the 10,000 bundle) and the tie-break below is
 * retained only for a ladder that ever ties again. ⚠️ A smaller bundle must NEVER undercut a
 * larger one — that is the whole point of the premium. ⚠️ The step is indexed from the
 * LARGEST bundle, so retiring the smallest tier (the 500, withdrawn 2026-10-10) moved no
 * surviving price.
 *
 * ⚠️ Z-ORDER IS PART OF THIS FEATURE, and this sweep is the ONLY thing that can see it — CI
 * cannot reach Penpot. The badge must paint IN FRONT of its own row and its text above its
 * own pill, but stay UNDER a confirm-board scrim. The original defect: the badge was created
 * on the old 1,000 row and later RENAMED onto the 10,000 row — ⚠️ renaming does not change
 * paint order, so it rendered behind the row and the PM had to report it. Three traps:
 * read `parentIndex` (⚠️ `parent.children.indexOf(shape)` returns -1 — the children proxy
 * does not match a wrapped shape); ⚠️ `setParentIndex(N)` lands a forward-moved shape at
 * N+1, so nudge with bringForward/sendBackward and READ BACK; and ⚠️ never "fix" z with
 * `bringToFront()` on a confirm board, which lifts the badge over the scrim.
 */

const REFERENCE_CENTS_PER_1000 = 155;    // doc 10 line 13: US$1.55 / 1,000 — ⚠️ the rate the BEST VALUE bundle CARRIES and the LOWEST in the shelf (PM, 2026-10-10 S39), NOT a ceiling
const FLOOR_CENTS_PER_1000 = 119;        // doc 10: "bundles must average ≥ floor"
const BASE_CENTS_PER_1000 = 155;         // PM 2026-10-10 (S39): 'follow doc 10' — the LARGEST bundle carries doc 10's rate
const PREMIUM_STEP_CENTS = 2;            // …and each step DOWN the ladder adds this, per 1,000
const ROUNDING_STEP_CENTS = 5;           // ⚠️ and the exact price is rounded to the nearest 5¢
const TIE_BREAK = 'smallest';            // retained for a ladder that ever ties

const BOARDS = ['EN · 9e Credits', 'ZH · 9e 点数', 'EN · 9f Credits · confirm', 'ZH · 9f 点数 · 确认'];

const page = penpot.currentPage;
const boards = page.findShapes({ type: 'board' }).filter((b) => b.name !== 'Root Frame');
function descend(root) {
  const out = [];
  const walk = (s) => { for (const c of (s.children || [])) { out.push(c); walk(c); } };
  walk(root);
  return out;
}
const money = (cents) => `$${(cents / 100).toFixed(2)}`;
const per1000 = (b) => b.priceCents / (b.credits / 1000);

/* ── read the ladder and the badge as DRAWN ───────────────────────────────────── */
const readBoard = (name) => {
  const b = boards.find((x) => x.name === name);
  if (!b) return null;
  const rows = descend(b).filter((s) => /^row · \d+ (credits|price|tag)$/.test(s.name));
  const bundles = [];
  for (const s of rows.filter((r) => /credits$/.test(r.name))) {
    const code = s.name.match(/^row · (\d+) credits$/)[1];
    const price = rows.find((r) => r.name === `row · ${code} price`);
    bundles.push({
      code,
      credits: Number(s.characters.replace(/[^0-9]/g, '')),
      priceCents: price ? Math.round(parseFloat(price.characters.replace(/[^0-9.]/g, '')) * 100) : null,
    });
  }
  const badge = rows.find((r) => /tag$/.test(r.name));
  // ⚠️ The badge's paint order is part of the feature, not a detail (see the header). Read
  //    `parentIndex`; never `children.indexOf`, and never assume a rename moved anything.
  const on = badge ? badge.name.match(/^row · (\d+)/)[1] : null;
  const rowRect = on ? descend(b).find((s) => s.name === `row · ${on}`) : null;
  const rowLast = on ? descend(b).find((s) => s.name === `row · ${on} relation`) : null;
  const tagBg = on ? descend(b).find((s) => s.name === `row · ${on} tag (bg)`) : null;
  const scrim = descend(b).find((s) => /scrim/i.test(s.name));
  return {
    board: name,
    bundles,
    badgeOn: on,
    z: {
      rowRectZ: rowRect ? rowRect.parentIndex : null,
      rowLastZ: rowLast ? rowLast.parentIndex : null,
      tagBgZ: tagBg ? tagBg.parentIndex : null,
      tagZ: badge ? badge.parentIndex : null,
      scrimZ: scrim ? scrim.parentIndex : null,
      inFrontOfRow: !!(badge && rowRect && tagBg && badge.parentIndex > rowRect.parentIndex && tagBg.parentIndex > rowRect.parentIndex),
      textAboveOwnPill: !!(badge && tagBg && badge.parentIndex > tagBg.parentIndex),
      underScrim: scrim ? !!(badge && tagBg && badge.parentIndex < scrim.parentIndex && tagBg.parentIndex < scrim.parentIndex) : 'n/a (no scrim)',
      badgeY: badge ? Math.round(badge.y - b.y) : null,
    },
  };
};

/* ── the rule ─────────────────────────────────────────────────────────────────── */
const compute = (bundles, tieBreak) => {
  const best = Math.min(...bundles.map(per1000));
  const tied = bundles.filter((x) => per1000(x) === best);
  const sorted = [...tied].sort((a, b) => (tieBreak === 'largest' ? b.credits - a.credits : a.credits - b.credits));
  return { bestRate: best, tied, winner: sorted[0] };
};

const result = {};
for (const name of BOARDS) {
  const read = readBoard(name);
  if (!read) { result[name] = 'MISSING'; continue; }
  const { bestRate, tied, winner } = compute(read.bundles, TIE_BREAK);
  // ⚠️ The credit-WEIGHTED average is what the shelf actually collects per credit. The naive
  //    mean of the rates gives a 1,000-credit bundle the same vote as a 10,000-credit one —
  //    it read $1.24 where the weighted truth was $1.22, and I copied that figure into five
  //    docs because a script printed it. A script's own output is not evidence.
  const totalCents = read.bundles.reduce((a, x) => a + x.priceCents, 0);
  const totalCredits = read.bundles.reduce((a, x) => a + x.credits, 0);
  const weighted = (totalCents / totalCredits) * 1000;
  const naive = read.bundles.reduce((a, x) => a + per1000(x), 0) / read.bundles.length;
  result[name] = {
    ladder: read.bundles.map((b) => `${b.credits} = ${money(b.priceCents)} (${money(per1000(b))}/1,000)`),
    badgeIsOn: read.badgeOn,
    formulaWinner: String(winner.credits),
    correct: read.badgeOn === String(winner.credits),
    zOrder: read.z,
    tiedAtBestRate: tied.map((b) => b.credits),
    bestRate: money(bestRate),
    averagePer1000Weighted: money(weighted),
    averagePer1000Naive: money(naive),
    aboveFloor: per1000(winner) >= FLOOR_CENTS_PER_1000 && weighted >= FLOOR_CENTS_PER_1000,
  };
}

/* the fragment to freeze into design-system/credits-ladder.json */
const first = Object.values(result).find((r) => typeof r === 'object');
return {
  verdict: first && first.correct ? '✅ the drawn badge IS the formula’s winner' : '⚠️ MISMATCH — move the badge',
  perBoard: result,
  frozenManifest: first
    ? {
        referenceRate: { centsPer1000: REFERENCE_CENTS_PER_1000 },
        floor: { centsPer1000: FLOOR_CENTS_PER_1000 },
        pricing: { baseCentsPer1000: BASE_CENTS_PER_1000, premiumStepCents: PREMIUM_STEP_CENTS, roundingStepCents: ROUNDING_STEP_CENTS },
        bundles: readBoard(BOARDS[0]).bundles.map((b) => ({ credits: b.credits, priceCents: b.priceCents })),
        bestValueTieBreak: TIE_BREAK,
        bestValueCredits: Number(first.formulaWinner),
      }
    : null,
};
