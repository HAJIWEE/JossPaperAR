#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────────
   validate-fidelity.js — checks the generated car artwork in fidelity-test.html
   against the claims the page makes about it.

   The point is to be independent: counts come from the SVG that is actually in
   the page, and body-vs-wheel is decided geometrically — a wheel face has to BE
   a disc (round, the right size, sitting at one of the four published wheel
   positions), not a panel — so the split never comes from the generator's own
   bookkeeping. Distance alone stopped being enough once the far-side wheels
   existed: those project onto the *middle* of the car, so "near a wheel centre"
   also caught body panels.

   Usage:  node prototype/tools/validate-fidelity.js
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const gen = require('./gen-car-3d.js');

const PAGE = path.join(__dirname, '..', 'fidelity-test.html');
const html = fs.readFileSync(PAGE, 'utf8');
const INDEX = path.join(__dirname, '..', 'index.html');
const index = fs.readFileSync(INDEX, 'utf8');
let pass = 0, fail = 0;
const ok = (cond, msg) => { cond ? pass++ : fail++; console.log('  ' + (cond ? '✓' : '✗') + ' ' + msg); };
const section = t => console.log('\n' + t);

/* ── parse the generated groups out of the page ───────────────────────────── */
const GROUPS = {};
for (const g of html.matchAll(/<g id="(car\w+)"([^>]*)>([\s\S]*?)<\/g>/g)) {
  const attrs = {};
  for (const a of g[2].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
  GROUPS[attrs['data-variant']] = { id: g[1], attrs, markup: g[3] };
}
const polysOf = markup => [...markup.matchAll(/<polygon points="([^"]+)"([^>]*)>/g)]
  .filter(x => !/data-notface/.test(x[2]))
  .map(x => x[1].trim().split(/\s+/).map(p => p.split(',').map(Number)));
const centroid = pts => pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const centresOf = k => GROUPS[k].attrs['data-wheel-centres'].split(' ').map(p => p.split(',').map(Number));
/* a wheel face is a disc: enough vertices, and every vertex roughly the same
   distance from its own centroid (the orthographic projection squashes a disc
   into an ellipse — ~0.6 ratio of short to long axis here — while a body panel
   is a quad or an outline-shaped cap and never round). It also has to sit at
   one of the four published wheel positions. */
const radiusOf = pts => { const c = centroid(pts); return pts.reduce((s, v) => s + dist(v, c), 0) / pts.length; };
function isWheelFace(p, centres) {
  if (p.length < 6) return false;
  const c = centroid(p);
  if (!centres.some(w => dist(c, w) < 40)) return false;
  const rs = p.map(v => dist(v, c));
  return Math.max(...rs) < 32 && Math.min(...rs) > Math.max(...rs) * 0.55;
}
function splitBodyWheel(polys, centres) {
  const body = [], wheel = [];
  for (const p of polys) (isWheelFace(p, centres) ? wheel : body).push(p);
  return { body, wheel };
}
const split = k => splitBodyWheel(polysOf(GROUPS[k].markup), centresOf(k));
const tyresOf = k => split(k).wheel.filter(p => radiusOf(p) > 20);      // tyres ~r30, hubs ~r12, bolts smaller
const hubsOf = k => split(k).wheel.filter(p => radiusOf(p) <= 20);

section('structure');
ok(Object.keys(GROUPS).length === 6, '6 generated groups: ' + Object.keys(GROUPS).join(' · '));
for (const k of ['A', 'B', 'C', 'D', 'photo', 'photo-car']) ok(!!GROUPS[k], `group for variant ${k}`);
const ids = Object.values(GROUPS).map(g => g.id);
const uses = [...html.matchAll(/<use[^>]*href="#([\w-]+)"/g)].map(x => x[1]);
ok(uses.length > 0 && uses.every(u => ids.includes(u)), `every <use> (${uses.length}) resolves to a generated group`);

section('viewBox');
const models = gen.buildAll();
const b = gen.boundsOf(models);
const vb = gen.pageViewBox(b);
const vbs = [...html.matchAll(/viewBox="([^"]+)"/g)].map(x => x[1]);
ok(vbs.length > 0 && vbs.every(v => v === vb), `all ${vbs.length} car stages share viewBox="${vb}"`);

section('facets: markup vs the badges on the cards');
const expected = {};
for (const k of ['A', 'B', 'C', 'D']) {
  /* slice from the *card* (the generated <g> also carries data-variant, earlier in the file) */
  const at = html.search(new RegExp('<article class="ft-card[^>]*data-variant="' + k + '"'));
  const card = html.slice(at, at + 1200);
  expected[k] = {
    facets: +/ft-badge is-key">(\d+) facets/.exec(card)[1],
    body: +/ft-badge">(\d+) body · (\d+) wheel/.exec(card)[1],
    wheel: +/ft-badge">(\d+) body · (\d+) wheel/.exec(card)[2]
  };
}
for (const k of ['A', 'B', 'C', 'D']) {
  const polys = polysOf(GROUPS[k].markup), s = split(k), e = expected[k];
  ok(polys.length === e.facets, `${k}: ${polys.length} rendered faces = badge "${e.facets} facets"`);
  ok(s.body.length === e.body && s.wheel.length === e.wheel,
    `${k}: geometric split ${s.body.length}+${s.wheel.length} = badge "${e.body} body · ${e.wheel} wheel"`);
}

section('fidelity ordering');
const n = k => polysOf(GROUPS[k].markup).length;
const pts = k => polysOf(GROUPS[k].markup).reduce((a, p) => a + p.length, 0);
ok(n('A') > n('B'), `A (${n('A')}) has more faces than B (${n('B')})`);
ok(n('B') > n('C'), `B (${n('B')}) has more faces than C (${n('C')})`);
ok(n('D') === n('B'), `D (${n('D')}) spends exactly B's face budget (${n('B')})`);
ok(pts('A') > pts('B') && pts('B') > pts('C'), `vertices fall with resolution: ${pts('A')} › ${pts('B')} › ${pts('C')}`);
ok(pts('D') > pts('B'), `D uses more vertices than B (${pts('D')} › ${pts('B')}) — wheels, not body`);

section('wheels: all four positions are modelled (your fix)');
const wc = centresOf('D');
ok(wc.length === 4, `4 wheel centres published — near + far (${wc.length})`);
for (const k of ['A', 'B', 'C', 'D', 'photo-car']) {
  const label = k === 'photo-car' ? 'photo' : k;
  const w = centresOf(k);
  const covered = w.filter(c => split(k).wheel.some(p => dist(centroid(p), c) < 6)).length;
  ok(covered === 4, `${label}: discs at all four wheel positions (${covered}/4)`);
  const tyres = tyresOf(k);
  ok(tyres.length === 4, `${label}: four tyres — ${tyres.length} disc faces of radius ~30`);
  ok(new Set(tyres.map(p => p.length)).size === 1, `${label}: all four tyres are the same disc (${tyres[0] ? tyres[0].length : 0}-gon)`);
}
ok(hubsOf('B').length === 2 && hubsOf('C').length === 2,
  `only the near side carries hubs (B ${hubsOf('B').length} · C ${hubsOf('C').length}) — the far wheels show their inner face only`);

section("D is B's body + C's wheels (the Session-5 pick)");
const key = polys => polys.map(p => p.map(v => v.join(',')).join(' '));
const dB = key(split('D').body), bB = key(split('B').body);
ok(dB.length === bB.length && dB.every((p, i) => p === bB[i]),
  `D's body is B's body verbatim (${dB.length} faces, same order, identical coordinates)`);
const dT = tyresOf('D'), cT = tyresOf('C'), bT = tyresOf('B');
ok(dT.length === cT.length && new Set(dT.map(p => p.length)).has(Math.max(...cT.map(p => p.length))),
  `D's four tyres carry C's geometry (${dT[0] ? dT[0].length : 0}-gon)`);
ok(Math.max(...cT.map(p => p.length)) > Math.max(...bT.map(p => p.length)),
  `C's tyre is rounder than B's (${Math.max(...cT.map(p => p.length))}-gon vs ${Math.max(...bT.map(p => p.length))}-gon) and D inherits it`);

section('the reference really is a smooth render');
const ph = GROUPS['photo-car'].markup;
ok(/url\(#gFlank\)/.test(ph) && /url\(#gTop\)/.test(ph), 'photo uses gradient paint fills, not flat tones');
ok(/url\(#gGlass\)/.test(ph) && /url\(#gTyre\)/.test(ph), 'photo uses gradient glass and tyres');
ok(/filter="url\(#grain\)"/.test(GROUPS.photo.markup), 'the photo carries a grain layer');
ok(/data-notface="1"/.test(GROUPS.photo.markup) && /data-notface="1"/.test(ph),
  'photo backdrop · shadow · grain are marked as non-faces');

section('the cut-out (car only) is the same object, not a second copy');
ok(!/url\(#gBack\)/.test(ph) && !/url\(#gGlow\)/.test(ph), 'carPhotoCar carries no studio backdrop — it can sit on the camera feed');
ok(/url\(#gShade\)/.test(ph), 'carPhotoCar keeps the contact shadow, so the object still sits on the ground');
ok(/<use href="#carPhotoCar"\/>/.test(GROUPS.photo.markup), 'the full photo draws that cut-out through <use>');

section('every fill is a real paint');
const fills = [...Object.values(GROUPS).map(g => g.markup).join('').matchAll(/fill="([^"]+)"/g)].map(m => m[1]);
const defs = new Set([...html.matchAll(/id="([\w-]+)"/g)].map(m => m[1]));
const bad = [...new Set(fills.filter(f =>
  !/^#[0-9A-Fa-f]{6}$/.test(f) && f !== 'none' && !(f.startsWith('url(#') && defs.has(f.slice(5, -1)))))];
ok(bad.length === 0, bad.length ? `invalid paint values: ${bad.join(' · ')}` : `all ${fills.length} fills are 6-digit hex or url(#def) references`);
ok(!/NaN/.test(html) && !/NaN/.test(index), 'no NaN leaked into either page (a bad material used to emit fill="#NaNNaN10")');

section('cartoon style holds');
for (const k of ['A', 'B', 'C', 'D']) {
  const flat = !/url\(#g(Flank|Top|Nose|Glass|Tyre|Rim)\)/.test(GROUPS[k].markup);
  const tones = new Set(GROUPS[k].markup.match(/fill="#[0-9A-Fa-f]{6}"/g)).size;
  ok(flat && tones >= 3, `${k}: flat fills only, ${tones} tones from the locked palette`);
}

section('index.html · the offering is generated, the object is a photograph');
const blockOf = src => {
  const s = src.indexOf('<!-- BEGIN GENERATED CARS'), e = src.indexOf('<!-- END GENERATED CARS -->');
  return s < 0 || e < 0 ? null : src.slice(s, e);
};
ok(!!blockOf(index), 'index.html carries a GENERATED CARS block');
ok(blockOf(index) === blockOf(html), 'that block is byte-identical to the fidelity page\'s — one generator, one mesh');
const stages = [...index.matchAll(/<svg\b([^>]*)data-car-stage="([\w-]+)"([^>]*)>([\s\S]*?)<\/svg>/g)]
  .map(m => ({ key: m[2], tag: m[1] + m[3], inner: m[4] }));
ok(stages.length === 2, `2 generated stages — the ones that show the offering: ${stages.map(s => s.key).join(' · ')}`);
const [vx, vy, vw, vh] = vb.split(' ').map(Number);
for (const s of stages) {
  const href = (/<use href="#([\w-]+)"\/>/.exec(s.inner) || [])[1];
  ok(href === 'carD', `${s.key} → #${href} (the offering at the locked fidelity D)`);
  /* a stage's viewBox is the shared one, optionally expanded about its centre so
     a side-by-side compare can match the photo's apparent size (STAGES.zoom) */
  const box = ((/viewBox="([^"]+)"/.exec(s.tag) || [])[1] || '').split(' ').map(Number);
  const centre = Math.abs(box[0] + box[2] / 2 - (vx + vw / 2)) < 0.2 && Math.abs(box[1] + box[3] / 2 - (vy + vh / 2)) < 0.2;
  const aspect = Math.abs(box[2] / box[3] - vw / vh) < 0.01;
  const expand = box[2] / vw;
  ok(box.length === 4 && centre && aspect && expand >= 1 && expand <= 1.5,
    `${s.key}: same centre + aspect as the shared viewBox` +
    (expand > 1.001 ? `, expanded ${expand.toFixed(2)}× → offering drawn at ${Math.round(100 / expand)}%` : ''));
}
/* the two places that show the REAL object must be the photograph, not a render:
   the camera is not rendering a mesh, and neither is the "before" half of the
   comparator — it is the same photo the app received */
const photoPanels = [...index.matchAll(/<div\b[^>]*data-car-stage="([\w-]+)"[^>]*>([\s\S]*?)<\/div>/g)]
  .map(m => ({ key: m[1], inner: m[2] }));
const photoKeys = photoPanels.map(p => p.key);
ok(photoKeys.includes('capture') && photoKeys.includes('transform-before'),
  `the viewfinder and the "before" half are photo panels (${photoKeys.join(' · ')})`);
ok(photoPanels.every(p => p.inner.trim() === ''), 'those panels carry no markup at all — nothing to fake reality with');
const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
const assetRefs = (css.match(/assets\/car-real\.jpg/g) || []).length;
ok(assetRefs >= 1, `styles.css keeps the wide viewfinder crop of the photo (${assetRefs} reference)`);
ok(fs.existsSync(path.join(__dirname, '..', 'assets', 'car-real.jpg')), 'the photo asset exists');
ok(fs.existsSync(path.join(__dirname, '..', 'assets', 'CREDITS.md')),
  'the photo\'s source + licence + swap-out note are recorded (assets/CREDITS.md)');
/* the before/after pair has to be the same size on screen: the panel asset is the
   photograph padded to the cartoon stage's aspect, shown whole and un-zoomed */
const before = (/\.compare-before\{([^}]*)\}/.exec(css) || [, ''])[1];
ok(/car-real-panel\.jpg/.test(before) && /contain/.test(before),
  'the before panel shows assets/car-real-panel.jpg whole (contain) — no crop, no zoom');
ok(!/blur\(/.test(css) || !/\.compare-before[^{]*\{[^}]*blur\(/.test(css),
  'nothing blurs the before panel — it is the photo, shown as received');
const panelRefs = (css.match(/assets\/car-real-panel\.jpg/g) || []).length;
ok(panelRefs >= 1 && fs.existsSync(path.join(__dirname, '..', 'assets', 'car-real-panel.jpg')),
  'the panel asset exists (photo padded to the stage aspect, so contain lands it in the same band)');
ok(index.indexOf('viewBox="0 0 240 224"') > 0 && index.indexOf('viewBox="0 0 200 240"') > 0 && index.indexOf('viewBox="0 0 390 844"') > 0,
  'shrine · flame · throw-guide keep their own coordinate systems');

section('index.html · no leftovers from the 2D artwork');
/* exact forms only: "#carPh" alone is a substring of the new "#carPhotoCar"
   reference, so a loose probe reports the port as a failure */
for (const stale of ['id="carCam"', 'id="carPh"', 'id="glassPh"', 'id="rimPh"', 'id="lightPh"', 'id="bgPh"',
  'url(#carPh)', 'url(#glassPh)', 'url(#rimPh)', 'M310,246',
  '134,222 236,222 257,248 120,248', 'viewBox="48 214 276 138"', 'viewBox="0 0 340 460"'])
  ok(!index.includes(stale), `no trace of "${stale}"`);
ok(/v4 \(Session 8\)/.test(index), 'the prototype header reads v4 · Session 8 — bump it here when it changes');

section('no stale numbers left in the copy');
/* "19 facets" is deliberately absent from this list: 19 is C's real count now.
   These are the numbers from the 2D metric and from the two-wheel mesh. */
for (const stale of ['>33 facets<', '>12 facets<', '>54 facets<', '>35 facets<', '>17 facets<',
  '>29 body · 4 wheel<', '>15 body · 4 wheel<', '>8 body · 4 wheel<', '19-face',
  'same silhouette vertices', 'hand-drawn SVG'])
  ok(!html.includes(stale), `copy no longer claims "${stale.replace(/^>|<$/g, '')}"`);

section('the generated block is live markup');
/* A stage that references a group inside an HTML comment renders *nothing*,
   while every static assertion above still passes — so check the container:
   the BEGIN marker must close, and no comment may open inside the block. */
const liveBlock = src => {
  const s = src.indexOf('<!-- BEGIN GENERATED CARS');
  const e = src.indexOf('<!-- END GENERATED CARS -->');
  if (s < 0 || e < 0) return false;
  const body = src.slice(s, e);
  const closed = body.indexOf('-->');
  return closed > 0 && !body.slice(closed + 3).includes('<!--');
};
ok(liveBlock(html), 'fidelity-test.html: BEGIN marker closes with --> and the block is not commented out');
ok(liveBlock(index), 'index.html: BEGIN marker closes with --> and the block is not commented out');

section('tribute league — the score is real');
{
  const list = (/<ol class="league-list" id="leagueList">([\s\S]*?)<\/ol>/.exec(index) || [])[1] || '';
  const rows = list.split('<li ').slice(1).map(s => s.split('</li>')[0])
    .filter(s => /class="league-row/.test(s))
    .map(s => ({
      you: /data-you="1"/.test(s),
      points: +((/class="lr-points">([\d,]+)</.exec(s) || [, '0'])[1]).replace(/,/g, '')
    }));
  ok(!!list, 'the board is addressable (#leagueList) — the app re-renders it on every award');
  ok(rows.length === 8, `${rows.length} rows on the board`);
  ok(rows.every((r, i) => i === 0 || rows[i - 1].points >= r.points),
    'it starts in descending order: ' + rows.map(r => r.points.toLocaleString()).join(' · '));

  const me = rows.findIndex(r => r.you);
  ok(me > 0, `the user has their own row (rank ${me + 1} of ${rows.length})`);
  const homeTotal = +((/id="homePoints">([\d,]+)</.exec(index) || [, '0'])[1]).replace(/,/g, '');
  ok(rows[me].points === homeTotal, `board and home screen agree on the total (${homeTotal.toLocaleString()})`);
  ok((/<span class="mini-rank">#(\d+)<\/span>/.exec(index) || [, '0'])[1] === String(me + 1),
    `the home screen's league chip shows the same rank (#${me + 1})`);

  const appJs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  /* What one throw banks is a model now — base × the aim it was graded at × the
     new-ground bonus, plus the streak — so the validator rebuilds it from the constants
     and the grades, and makes the reward screen's authored example pay out exactly that.
     The number is not allowed to exist twice. */
  const num = (re, s = appJs) => +(((re.exec(s) || [])[1] || '0').replace(/[+,]/g, ''));
  const base = num(/const BASE_VALUE = ([\d.]+)/);
  const ground = num(/const GROUND_BONUS = ([\d.]+)/);
  const streak = num(/const STREAK_BONUS = ([\d.]+)/);
  const grades = (appJs.match(/mult: ([\d.]+)/g) || []).map(m => +m.split(' ')[1]);
  ok(grades.length === 4 && grades[0] > grades[1] && grades[1] > grades[2] && grades[3] === 0 && base > 0,
    'the grades are ordered ×' + grades[0] + ' / ×' + grades[1] + ' / ×' + grades[2] + ' / ×' + grades[3] + ' and the base is real (' + base + ')');
  const devout = Math.round(base * grades[1] * ground + streak);
  const rowValue = key => num(new RegExp('data-key="' + key + '"[^>]*><span>[^<]*</span><b>([+\\d,]+)</b>'), index);
  const rewardTotal = rowValue('total');
  ok(devout === rewardTotal && devout > 0, `one devout throw banks what the reward screen says (${devout.toLocaleString()})`);
  ok(rowValue('base') === base && rowValue('aim') === Math.round(base * grades[1])
    && rowValue('ground') === Math.round(base * grades[1] * ground) && rowValue('streak') === streak,
    'the rows the reward screen is authored with are the model, line by line');
  ok(rows[me - 1].points > rows[me].points && rows[me - 1].points - rows[me].points < devout,
    `the first throw closes the gap to rank ${me} (${(rows[me - 1].points - rows[me].points).toLocaleString()} < ${devout.toLocaleString()}) — the user moves up`);
  ok(/setTimeout\(awardTribute/.test(appJs), 'the burn screen banks the tribute as the offering lands');
  ok(/function readLeague/.test(appJs) && /state\.league/.test(appJs) && /league\(\)\s*\{\s*renderLeague\(\)/.test(appJs),
    'the board is read from the markup, owned by app.js, and re-rendered on entry');
}

section('the aim — the fire grades the throw, and the grade is worth points');
{
  const appJs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  /* The target is not authored anywhere: app.js runs a scanline over the flame polygons
     index.html draws, at the line where the flame is widest, and the sight, the ladder
     and the flight are all painted from that one measurement. */
  ok(/function widestLine/.test(appJs) && /outlineHalfWidth\(svg\.querySelector\('\.flame-inner'\)/.test(appJs)
    && /widestLine\(svg\.querySelector\('\.flame-outer'\)\)/.test(appJs),
    "the bands are cut from index.html's own flame polygons (widestLine · halfWidthAt)");
  ok(/mouthY: \(F\.t \+ mouth\.y \* sy\) \* uy/.test(appJs),
    "the mouth line crosses into the guide's units exactly once — the two spaces are never mixed");
  ok(/<svg class="aim-sight" id="aimSight"[^>]*><\/svg>/.test(index)
    && /<p class="burn-ladder" id="aimLadder"><\/p>/.test(index),
    'the sight and the ladder ship empty: no band is stated in the copy');
  ok(/drawAimSight\(\)/.test(appJs) && /renderAimLadder\(\)/.test(appJs),
    'app.js paints the sight and the ladder from the measurement');
  ok(/const aimAwardOf = tier => tier\.mult \? Math\.round\(BASE_VALUE \* tier\.mult \* GROUND_BONUS \+ STREAK_BONUS\) : 0/.test(appJs)
    && /state\.lastThrow = \{ offset: aim, tier, award \}/.test(appJs),
    'a throw carries the grade it was aimed at and the award that follows from it');
  ok(/const mouth = widestLine/.test(appJs) && /AIM\.tip = authoredTip\(\)/.test(appJs),
    "the tip is read from the markup, so a re-measure cannot inherit where a throw left it");
  ok(/window\.addEventListener\('resize', remeasureAim\)/.test(appJs) && /window\.addEventListener\('load', remeasureAim\)/.test(appJs),
    'the target is re-measured when the frame it was measured in changes size');
  ok(/classList\.add\(tier\.key === 'graze' \? 'is-charring' : 'is-consumed'\)/.test(appJs)
    && /burnTimers\.push\(setTimeout\(returnToHand, 700\)\)/.test(appJs),
    'only the coals or the flame consume the offering: a miss is not burned and comes back');
  ok(/aimRow\.textContent = `Aim — \$\{gradeLabel\(tier\)\}`/.test(appJs),
    'the reward screen names the aim the throw was actually graded at');
}

section('the shrine — the user builds it, and their own names go on it');
{
  const appJs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  /* nothing is authored in: the altar ships with an empty tablet layer */
  ok(/<g id="altarTablets"><\/g>/.test(index),
    'index.html authors NO ancestor tablets — #altarTablets is an empty layer');
  ok(!/<text class="tablet-txt"[^>]*>[\u4e00-\u9fff]/.test(index),
    'no ancestor character is hard-coded in the markup (the sample 陈 · 祖 · 宗 trio is gone)');
  ok(!/class="slot-4"/.test(index) && /id="addTabletSlot"/.test(index),
    'the ＋ slot invites a tablet instead of shipping a pretend fourth one');
  ok(/id="altarCaption"[^>]*>Your altar is empty/.test(index),
    'the caption the user first sees says the altar is empty');

  /* the sheet is the only way in, and it takes details, not just one string */
  const sheet = (/<form class="sheet" id="ancestorSheet"([\s\S]*?)<\/form>/.exec(index) || [])[1] || '';
  ok(!!sheet, 'there is an ancestor sheet to build the shrine with');
  ok(/<input id="ancSurname"[^>]*required/.test(sheet), 'it asks for the surname (required, 1–2 characters)');
  ok(/<input id="ancGiven"/.test(sheet), 'and for an optional given name');
  const chips = [...sheet.matchAll(/class="chip[^"]*" data-rel="([^"]*)"/g)].map(m => m[1]).filter(Boolean);
  ok(chips.length >= 4 && chips.includes('祖父'),
    `${chips.length} relationship chips (${chips.join(' · ')}) — relationship without typing`);
  ok(/<g id="ancPreview"><\/g>/.test(sheet) && /type="submit"/.test(sheet),
    'the sheet previews the tablet and submits it');
  ok(/id="ancestorRemove"[^>]*hidden/.test(sheet),
    'the same sheet removes a tablet, hidden until it is editing one');

  /* the app owns it, and the characters come from the input */
  ok(/ancestors: \[\]/.test(appJs), 'state.ancestors starts empty — every load is a bare altar');
  ok(/function renderAltar/.test(appJs) && /function drawTablet/.test(appJs) && /function tabletChars/.test(appJs),
    'app.js draws the altar: renderAltar · drawTablet · tabletChars');
  ok(/given \? \[surname, \.\.\.given\.split\(''\)\] : \[surname, '氏'\]/.test(appJs),
    "the tablet text is the user's own: 姓＋名, or 姓＋氏 when no given name is known");
  ok(/drawTablet\(g, tabletChars\(a\)\)/.test(appJs),
    'the altar paints exactly what the user entered — and nothing else');
  ok(/drawTablet\(g, tabletChars\(\{ surname: d\.surname/.test(appJs),
    'the sheet preview paints the same tablet (one builder, so the preview cannot lie)');
  ok(/addEventListener\('click', add\)/.test(appJs) && /openTabletSheet\(-1\)/.test(appJs),
    'the ＋ slot opens the sheet — by tap and by keyboard');
  ok(/toggle\('is-hidden', !withGhost\)/.test(appJs), 'the ＋ disappears once the altar is full');

  /* the geometry is read back out of the picture, not assumed */
  const shelf = +((/points="36,(\d+) 204,\d+ 214,\d+ 26,\d+" fill="#D9B968"/.exec(index) || [])[1] || 0);
  const ALTAR_Y = +((/const ALTAR_Y = (\d+)/.exec(appJs) || [])[1] || 0);
  ok(shelf > 0 && ALTAR_Y === shelf, `tablets stand on the shelf the SVG actually draws (y ${shelf})`);
  const ALTAR_CX = +((/const ALTAR_CX = (\d+)/.exec(appJs) || [])[1] || 0);
  ok(ALTAR_CX === 16 + 208 / 2 && /<rect x="16" y="\d+" width="208"/.test(index),
    `the row stays centred in the niche (x ${ALTAR_CX})`);
  const max = +((/const ALTAR_MAX = (\d+)/.exec(appJs) || [])[1] || 0);
  const gap = +((/const ALTAR_GAP = (\d+)/.exec(appJs) || [])[1] || 0);
  const halfW = +((/polygon points="-(\d+),-6 [^"]*" fill="#5C1F14"/.exec(index) || [])[1] || 0);
  const left = ALTAR_CX - (max - 1) * gap / 2 - halfW;
  const right = ALTAR_CX + (max - 1) * gap / 2 + halfW;
  ok(halfW > 0 && left >= 26 && right <= 214,
    `all ${max} tablets still fit the shelf the SVG draws (row spans ${left}…${right}, shelf 26…214)`);

  /* A tap has to reach through the scenery to what it was aimed at. The incense
     sticks stand in front of the MIDDLE of the shelf, so with four tablets
     enshrined they are painted over a tablet's faces — and on an empty altar over
     the ＋ — while SVG's default pointer-events make every painted pixel a
     target. The censer quietly ate those taps until the shrine was made inert. */
  const shrine = (/<svg viewBox="0 0 240 224">([\s\S]*?)<\/svg>/.exec(index) || [])[1] || '';
  const scenery = shrine.replace(/<defs>[\s\S]*?<\/defs>/g, '');      // the tablet/ghost templates
  const painted = [...scenery.matchAll(/<(g|path|circle|rect)\b[^>]*>/g)].map(m => m[0])
    .filter(t => /\bstroke="|fill="#/.test(t));
  ok(painted.length >= 8 && painted.every(t => /pointer-events="none"/.test(t)),
    `every piece of shrine scenery is inert (${painted.length} painted elements — the niche, the `
    + 'two tiers, the censer, the sticks, the embers and the smoke can none of them swallow a tap)');
  ok(!/<g id="(altarTablets|addTabletSlot)"[^>]*pointer-events/.test(shrine),
    'the tablet layer and the ＋ slot are the two things a tap may land on');
  ok(shrine.indexOf('id="altarTablets"') < shrine.indexOf('id="addTabletSlot"')
    && shrine.indexOf('incense + smoke') < shrine.indexOf('id="addTabletSlot"'),
    'the ＋ slot paints last in the shrine, so the incense cannot cover the ＋ that invites it');

  /* …and the ＋ must be *visible* as well as tappable: the censer's sticks and
     embers are drawn across the middle of the shelf, so the mark has to clear
     them and stay inside the gold frame. Both numbers are read out of the files
     (the mark's own path, the sticks' own paths) rather than restated here. */
  const plusD = (/class="ghost-plus" d="([^"]+)"/.exec(index) || [])[1] || '';
  const barY = +((/M-?[\d.]+,(-?[\d.]+) H/.exec(plusD) || [])[1] || 0);          // the crossbar
  const arm = / M-?[\d.]+,(-?[\d.]+) V(-?[\d.]+)/.exec(plusD) || [];            // top, bottom
  const stickTop = Math.min(...[...index.matchAll(/<path d="M\d+ 146 V(\d+)"\/>/g)].map(m => +m[1]));
  const markTop = ALTAR_Y + +(arm[1] || 0), markBottom = ALTAR_Y + +(arm[2] || 0);
  ok(Number.isFinite(stickTop) && arm[2] && barY && markBottom < stickTop && markTop > ALTAR_Y - 78,
    `the ＋ the invitation draws clears the incense and stays in the frame (mark ${markTop}…${markBottom}, `
    + `crossbar ${ALTAR_Y + barY}, sticks start at ${stickTop}, frame opening ${ALTAR_Y - 78}…${ALTAR_Y - 12})`);
}

section('generator freshness');
try {
  execFileSync(process.execPath, [path.join(__dirname, 'gen-car-3d.js'), '--check'], { stdio: 'pipe' });
  ok(true, 'both pages match tools/gen-car-3d.js');
} catch (e) {
  ok(false, 'a page is stale — run: node prototype/tools/gen-car-3d.js');
  console.log('    ' + String(e.stdout || e.stderr || '').trim().split('\n').join('\n    '));
}

console.log('\n' + (fail ? `✗ ${fail} failed · ${pass} passed` : `✓ all ${pass} checks passed`));
process.exit(fail ? 1 : 0);
