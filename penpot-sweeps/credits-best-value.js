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
 * ⚠️ Today's ladder is LINEAR at the locked $1.55/1,000, so the "winner" is a TIE-BREAK
 * answer, not a unique fact: 1,000 / 3,000 / 6,000 / 10,000 all cost $1.55 per 1,000 and
 * the 500 is the only bundle WORSE than the rate ($1.56 — 155¢ × 500 = 77.5¢ rounds up).
 * A volume discount (permitted down to the $1.19 floor) is what would make it unique —
 * and this sweep picks that up automatically, because nothing here hard-codes 1,000.
 */

const CENTS_PER_1000 = 155;              // doc 10 line 13: US$1.55 / 1,000 (PM-locked)
const FLOOR_CENTS_PER_1000 = 119;        // doc 10: "bundles must average ≥ floor"
const TIE_BREAK = 'smallest';            // 'smallest' | 'largest'

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
  return { board: name, bundles, badgeOn: badge ? badge.name.match(/^row · (\d+)/)[1] : null };
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
  const average = read.bundles.reduce((a, b) => a + per1000(b), 0) / read.bundles.length;
  result[name] = {
    ladder: read.bundles.map((b) => `${b.credits} = ${money(b.priceCents)} (${money(per1000(b))}/1,000)`),
    badgeIsOn: read.badgeOn,
    formulaWinner: String(winner.credits),
    correct: read.badgeOn === String(winner.credits),
    tiedAtBestRate: tied.map((b) => b.credits),
    bestRate: money(bestRate),
    averagePer1000: money(average),
    aboveFloor: per1000(winner) >= FLOOR_CENTS_PER_1000 && average >= FLOOR_CENTS_PER_1000,
  };
}

/* the fragment to freeze into design-system/credits-ladder.json */
const first = Object.values(result).find((r) => typeof r === 'object');
return {
  verdict: first && first.correct ? '✅ the drawn badge IS the formula’s winner' : '⚠️ MISMATCH — move the badge',
  perBoard: result,
  frozenManifest: first
    ? {
        lockedRate: { centsPer1000: CENTS_PER_1000 },
        floor: { centsPer1000: FLOOR_CENTS_PER_1000 },
        bundles: readBoard(BOARDS[0]).bundles.map((b) => ({ credits: b.credits, priceCents: b.priceCents })),
        bestValueTieBreak: TIE_BREAK,
        bestValueCredits: Number(first.formulaWinner),
      }
    : null,
};
