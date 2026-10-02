#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────────
   render-check.js — does the generated artwork actually DRAW, and does it fit
   inside the stage that shows it? And does the shrine paint the names the user
   types onto their own tablets?

   Why it exists: an unterminated "<!--" around the generated block swallowed it
   whole, so every <use> resolved to nothing and every stage rendered empty —
   while the markup validator passed 79/79, because all the markup was still
   there. Static checks cannot see that. A browser can.

   How: Firefox headless screenshots *copies* of the committed pages (the real
   pages are never modified) with one style injected — a magenta background on
   every car stage. ImageMagick then measures two boxes per screen: the magenta
   stage box, and the artwork inside it (everything that is not magenta). If the
   artwork is missing, empty, or touching the stage edge, the check fails.

   Usage:  node prototype/tools/render-check.js [--keep]
   Needs:  firefox (+ ImageMagick `magick` to read the pixels)
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const PROJ = path.join(__dirname, '..');
const KEEP = process.argv.includes('--keep');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1];
const WORK = path.join(os.tmpdir(), 'jp-render-check');
const PROF = path.join(os.tmpdir(), 'jp-render-profile');
const W = 410, H = 864;                 // window = the phone frame (390) + its 2×10 border

let pass = 0, fail = 0;
const ok = (cond, msg) => { cond ? pass++ : fail++; console.log('  ' + (cond ? '✓' : '✗') + ' ' + msg); };
const section = t => console.log('\n' + t);
const shell = (...args) => execFileSync(args[0], args.slice(1), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
/* firefox gets no pipes: a helper/grandchild process keeps the inherited fds
   open, and execFileSync would then wait forever even though the screenshot is
   already on disk */
const firefox = args => execFileSync('firefox', args, { stdio: 'ignore' });
const has = bin => { try { shell('which', bin); return true; } catch { return false; } };

/* the magenta probe: an OUTLINE, not a background — it marks a stage's exact box
   without covering what is inside it (the photo panels must stay visible: their
   content is the thing being checked). */
const PROBE_CSS = '.proto-head{display:none!important} body{padding:0!important}'
  /* offset -4px keeps the ring inside the border box: the comparator panels are
     clip-pathed exactly at their border box, so an outside outline is clipped away */
  + ' [data-car-stage]{outline:4px solid #FF00FF!important; outline-offset:-4px!important}'
  /* the transform screen's "Transforming…" overlay is opaque and sits above the
     comparator, so it would hide the probe outlines */
  + ' #transformOverlay{display:none!important}';

/* every screen that shows the object or the offering. `paint` = the offering's
   azurite body must be drawn; `photo` = a real photograph must be there (sharp
   detail: blurring it has to cost variance, which a flat or missing panel won't).
   Uses --only=capture|transform|burn to stay inside one shell timeout. */
const SCREENS = [
  { file: 'index.html', screen: 'capture', label: 'capture · the real object in the viewfinder', w: W, h: H, photo: true },
  { file: 'index.html', screen: 'transform', label: 'transform · photo / offering wipe', w: W, h: H, paint: true, photo: true },
  { file: 'index.html', screen: 'burn', label: 'burn · the offering in hand', w: W, h: H, paint: true }
];

function prepare() {
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });
  fs.mkdirSync(PROF, { recursive: true });          // firefox refuses to start without it
  /* mirror the prototype (including assets/ — a photo panel can only be checked
     if its photograph is actually reachable from the temp copy) */
  for (const f of fs.readdirSync(PROJ)) {
    const src = path.join(PROJ, f), dst = path.join(WORK, f);
    if (fs.statSync(src).isDirectory()) fs.cpSync(src, dst, { recursive: true });
    else fs.copyFileSync(src, dst);
  }
  for (const f of ['index.html', 'fidelity-test.html']) {
    const p = path.join(WORK, f);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8')
      .replace('</head>', `<style>${PROBE_CSS}</style></head>`));
  }
}

function shoot(screen, out) {
  const url = 'file://' + path.join(WORK, screen.file) + (screen.screen ? '?screen=' + screen.screen : '');
  firefox(['--headless', '--no-remote', '--profile', PROF, '--window-size=' + screen.w + ',' + screen.h,
    '--screenshot', out, url]);
  if (!fs.existsSync(out)) throw new Error('no screenshot for ' + screen.label);
  return out;
}

/* ── masks ────────────────────────────────────────────────────────────────────
   box  : the magenta probe → the stage's own rectangle (fast path, no -fx).
          fuzz is reset to 0 for the second step, otherwise "not white" would
          also mean "not within 25% of white" and bright artwork would be kept.
   paint: the car's body — bright and bluish, which is exactly the locked
          azurite paint, and absent from every backdrop on these screens
          (camera feed, studio grey, rice paper, flame). */
const PAINT = '(b-r)>0.05 && (r+g+b)/3>0.30 ? 1 : 0';
function parseTrim(out) {
  const v = out.trim().replace(/\+/g, '').split(/\s+/).map(Number);
  return v.length === 4 && v[0] > 0 ? v : null;
}
function boxTrim(png, crop) {
  try {
    return parseTrim(shell('magick', png, '-crop', crop, '+repage',
      '-fuzz', '25%', '-fill', 'white', '-opaque', '#FF00FF',
      '-fuzz', '0', '-fill', 'black', '+opaque', 'white',
      '-trim', '-format', '%w %h %X %Y', 'info:'));
  } catch { return null; }
}
function paintTrim(png, crop) {
  try {
    return parseTrim(shell('magick', png, '-crop', crop, '+repage',
      '-fx', PAINT, '-trim', '-format', '%w %h %X %Y', 'info:'));
  } catch { return null; }
}

/* per screen: measure the stage boxes, then what is drawn inside them */
function checkScreen(s) {
  const png = shoot(s, path.join(WORK, s.screen + '.png'));
  const stage = boxTrim(png, `${W}x${s.h}+0+0`);
  if (!stage) return ok(false, `${s.label}: no car stage on screen — nothing was laid out`);
  const [sw, sh, sx, sy] = stage;
  ok(sw > 20 && sh > 20, `${s.label}: stage area ${sw}×${sh} at ${sx},${sy}`);
  /* inside the 4px probe outline, so the ring never counts as content */
  const inner = `${Math.max(1, sw - 12)}x${Math.max(1, sh - 12)}+${sx + 6}+${sy + 6}`;
  const stat = (crop, args) => Number(shell('magick', png, '-crop', crop, '+repage', ...args).trim());

  if (s.paint) {
    const paint = paintTrim(png, inner);
    if (!paint) ok(false, `${s.label}: the offering's paint is missing — the stage drew nothing`);
    else {
      const [pw, ph] = paint;
      ok(pw > 20 && ph > 10, `${s.label}: offering body ${pw}×${ph} px inside the stage`);
    }
  }
  if (s.photo) {
    /* a photograph has detail: blurring it must cost variance, while a flat fill
       or a blurred backdrop keeps nearly all of it. Measured on this photo:
       σ 0.170 sharp → 0.123 at blur 0x6 (ratio 1.38), against ~1.0 for a fill.
       Only asserted where the panel holds the photo ALONE (the viewfinder): on a
       mixed screen the flat paper and the offering dilute the ratio. */
    const sd = stat(inner, ['-format', '%[fx:standard_deviation]', 'info:']);
    ok(sd > 0.05, `${s.label}: the photo panel has content (σ ${sd.toFixed(3)})`);
    if (!s.paint) {
      const sdBlur = stat(inner, ['-blur', '0x6', '-format', '%[fx:standard_deviation]', 'info:']);
      ok(sdBlur > 0 && sd / sdBlur > 1.15,
        `${s.label}: that content is a sharp photograph, not a flat fill (σ ${sd.toFixed(3)} → ${sdBlur.toFixed(3)} when blurred, ratio ${(sd / sdBlur).toFixed(2)})`);
    }
  }
}

/* ── the shrine ───────────────────────────────────────────────────────────────
   The altar ships empty and every character on a tablet is something the user
   typed, so the only honest check is to fill it and look. Three copies of the
   home screen are written with a scripted ancestor state (temp files — the
   committed page is never touched): a fresh altar, one with 姓 alone, and one
   with 姓＋名. The tablet bodies are found by their own colour — nothing else on
   that screen is #8F2A0E/#7A2412/#A33714 — and the ink inside each tablet's gold
   frame is counted, cropped to sit inside the frame so the frame itself can't
   count. Surname-only must show ink; the given name must add a character's
   worth of it. Text painted outside the viewBox (the bug this was written
   after: baselines in altar coordinates instead of the tablet's) shows up as
   "the same ink", and an altar that is not empty shows up as "a tablet where
   nothing is enshrined". */
const GOLD_INK = '(g/r>0.55) && (b<0.42) && (r>0.45) ? 1 : 0';
/* Injected into the probe pages: ring each tablet the app just drew, measured from
   the live DOM, so the harness can find the row by pixels without guessing where it
   landed (colour-matching the tablet body was tried first — the flat fills do not
   survive rendering exactly enough to trim against). */
const SHRINE_MARK = "function markTablets(){var s=document.querySelectorAll('#altarTablets .tablet-slot');" +
  "for(var i=0;i<s.length;i++){var r=s[i].getBoundingClientRect();var d=document.createElement('div');" +
  "d.style.cssText='position:fixed;z-index:99;pointer-events:none;outline:4px solid #FF00FF;left:'+" +
  "Math.round(r.left)+'px;top:'+Math.round(r.top)+'px;width:'+Math.round(r.width)+'px;height:'+Math.round(r.height)+'px';" +
  "document.body.appendChild(d);}}";
const SHRINE = [
  { name: 'shrine-empty', label: 'shrine · a fresh altar holds no tablet', state: '', want: 'none' },
  { name: 'shrine-surname', label: 'shrine · 姓 alone paints 姓氏 on the tablet',
    state: 'state.ancestors=[{surname:"陈"}];', want: 'some' },
  { name: 'shrine-given', label: 'shrine · typing a given name adds a character',
    state: 'state.ancestors=[{surname:"陈",given:"国华"}];', want: 'more' },
  /* the whole journey, through the real handlers: tap ＋ → type → press Place.
     (The slot is an SVG <g>, which has no .click() — dispatch a real event.)
     no-anim so the sheet has already slid away when the screenshot is taken. */
  { name: 'shrine-flow', label: 'shrine · ＋ → 陈国华 → Place on altar draws the tablet',
    state: 'document.body.classList.add("no-anim");' +
      'document.getElementById("addTabletSlot").dispatchEvent(new MouseEvent("click",{bubbles:true}));' +
      'document.getElementById("ancSurname").value="陈";' +
      'document.getElementById("ancGiven").value="国华";' +
      'document.getElementById("ancGiven").dispatchEvent(new Event("input",{bubbles:true}));' +
      'document.getElementById("ancestorPlace").click();',
    want: 'some' }
];

function checkShrine() {
  const base = fs.readFileSync(path.join(WORK, 'index.html'), 'utf8');   // already probed by prepare()
  const ink = {};
  for (const s of SHRINE) {
    const file = s.name + '.html';
    const js = SHRINE_MARK + s.state + 'renderAltar();markTablets();';
    fs.writeFileSync(path.join(WORK, file), base.replace('</body>', '<script>' + js + '</script></body>'));
    const png = shoot({ file, label: s.label, w: W, h: H }, path.join(WORK, s.name + '.png'));
    const ring = boxTrim(png, `${W}x${H}+0+0`);            // the magenta ring → the tablet's box
    if (!ring || ring[0] < 8 || ring[1] < 8) {
      ok(s.want === 'none', s.want === 'none'
        ? `${s.label}: nothing is drawn on the shelf`
        : `${s.label}: nothing was ringed — the tablet never reached the page`);
      ink[s.name] = 0;
      continue;
    }
    /* a 4px ring sits OUTSIDE the box it marks, so pull it back in */
    const w = ring[0] - 8, h = ring[1] - 8, x = ring[2] + 4, y = ring[3] + 4;
    if (s.want === 'none') {
      ok(false, `${s.label}: a tablet ${w}×${h} at ${x},${y} where nothing is enshrined`);
      ink[s.name] = 0;
      continue;
    }
    /* the size is load-bearing: with the character baselines in the wrong coordinate
       space the glyphs paint *outside* the tablet, which stretches this box (32×185
       instead of 32×83) — the ink count alone still sees displaced glyphs as ink */
    ok(w > 12 && w < 80 && h > 40 && h < 170,
      `${s.label}: one tablet drawn, ${w}×${h} px at ${x},${y} (a tablet is ~32×83 at this scale)`);
    /* what is counted must be the characters, never the gold frame: the frame's
       verticals sit at ±10 of a ±18-wide tablet (inner edge ±9.2) and its bars at
       local y −78 and −6, so sampling 0.28…0.72 across and 0.25…0.90 down of the
       finial-to-base box stays inside the opening — and the opening is where the
       1-3 stacked characters live (baselines at −60…−16, 22 apart) */
    const crop = `${Math.round(w * 0.44)}x${Math.round(h * 0.65)}+` +
      `${Math.round(x + w * 0.28)}+${Math.round(y + h * 0.25)}`;
    const px = Math.round(Number(shell('magick', png, '-crop', crop, '+repage',
      '-fx', GOLD_INK, '-format', '%[fx:mean*w*h]', 'info:').trim()));
    ink[s.name] = px;
    ok(px > 20, `${s.label}: ${px} px of gold character ink inside the frame`);
  }
  if (ink['shrine-surname'] && ink['shrine-given']) {
    /* the crop is inside the frame, so these counts are characters only. The exact
       number depends on the glyphs (大 is sparse, 国 is not) — what must hold is
       that the second name visibly adds ink. If the characters never painted, both
       counts would be identical (0, or frame ink if the crop leaked): this is the
       check that caught baselines landing outside the viewBox. */
    ok(ink['shrine-given'] > ink['shrine-surname'] + 10,
      `the name reaches the tablet: 姓＋氏 ${ink['shrine-surname']} px → 姓＋名 ${ink['shrine-given']} px of character ink`);
  }
}

/* ── and every tap reaches what it aims at ───────────────────────────────────
   Written after the incense swallowed two taps. The sticks and their embers are
   painted AFTER the tablets and the ＋ slot, and SVG's default pointer-events
   ("visiblePainted") makes every painted pixel a target — so the three embers,
   which sit exactly over the ＋ on an empty altar (altar 112…128 across, y≈103)
   and over the middle tablets' faces once four are enshrined, quietly ate those
   taps. A dispatched click cannot see this: it is delivered to the element it
   names, with hit-testing bypassed — the shrine-flow check passes either way.
   So this probe asks the live DOM what is actually under the point, and reports
   through a 20×20 swatch in the window's corner that ImageMagick reads back:
   green = the tap lands on the thing it aimed at, red = something else took it,
   no swatch at all = the probe never ran (also a failure — the pass has to be
   signalled, not merely un-refuted). The page's own caption is left holding the
   reading, so a kept screenshot names the offender. */
const HIT_PROBE =
  /* a point in an element's own user space → page coordinates, and what is on top */
  "function hitAt(el,x,y){var svg=document.querySelector(\"#screen-home .shrine-art svg\");" +
    "var p=svg.createSVGPoint();p.x=x;p.y=y;p=p.matrixTransform(el.getScreenCTM());" +
    "return document.elementFromPoint(p.x,p.y);}" +
  "function isIn(el,sel){return !!(el&&el.closest&&el.closest(sel));}" +
  "function tag(el){return el?(el.tagName+(el.id?\"#\"+el.id:\"\")+" +
    "(el.getAttribute(\"class\")?\".\"+el.getAttribute(\"class\").split(\" \").join(\".\"):\"\")):\"nothing\";}" +
  "var report=[];" +
  "function swatch(i,pass,who,got){var d=document.createElement(\"div\");" +
    "d.style.cssText=\"position:fixed;left:\"+(6+i*24)+\"px;top:6px;width:20px;height:20px;\"+" +
    "\"z-index:99999;background:\"+(pass?\"#00FF00\":\"#FF0000\");" +
    "document.body.appendChild(d);" +
    "report.push(who+(pass?\" ok\":\" ← BLOCKED BY \"+tag(got)));}" +
  /* ① an empty altar: the middle of the ＋ must be the ＋ slot, not the incense
        burning across the same spot. The aim point is read out of the mark the
        file actually draws — its crossbar's y and its vertical bar's x — so if
        the ＋ ever moves, the probe moves with it (a probe that could not aim
        fails rather than passing by default) */
  "var gd=document.querySelector(\"#tabletGhost .ghost-plus\").getAttribute(\"d\");" +
  "var bar=/M-?[\\d.]+,(-?[\\d.]+) H/.exec(gd),arm=/ M(-?[\\d.]+),-?[\\d.]+ V/.exec(gd);" +
  "var slot=document.getElementById(\"addTabletSlot\");" +
  "var g0=(bar&&arm)?hitAt(slot,+arm[1],+bar[1]):null;" +
  "swatch(0,!!(g0&&isIn(g0,\"#addTabletSlot\")),\"＋(\"+(bar&&arm?arm[1]+\",\"+bar[1]:\"unparsed\")+\")\",g0);" +
  /* ② control: the empty niche wall must NOT be the ＋ slot or a tablet — a probe
        that always said yes would make ① meaningless */
  "var svg=document.querySelector(\"#screen-home .shrine-art svg\");" +
  "var g1=hitAt(svg,45,100);" +
  "swatch(1,!isIn(g1,\"#addTabletSlot\")&&!isIn(g1,\"#altarTablets\"),\"niche air\",g1);" +
  /* ③ four enshrined: a tap where the incense crosses a tablet reaches the tablet
        (112 is the left stick's x; the tablet it crosses is found from its own
        translate, so this survives any change to the row spacing) */
  "state.ancestors=[{surname:\"陈\",given:\"大文\"},{surname:\"林\",given:\"秀\"}," +
    "{surname:\"黄\",given:\"美\"},{surname:\"吴\",given:\"德\"}];" +
  "renderAltar();" +
  "var slots=document.querySelectorAll(\"#altarTablets .tablet-slot\"),tab=null,lx=0;" +
  "for(var i=0;i<slots.length;i++){var tx=slots[i].transform.baseVal.getItem(0).matrix.e;" +
    "if(112-tx>=-13&&112-tx<=13){tab=slots[i];lx=112-tx;}}" +
  "var g2=tab?hitAt(tab,lx,-45):null;" +
  "swatch(2,!!(tab&&isIn(g2,\".tablet-slot\")),\"tablet\",g2);" +
  /* ④ the screen's own call to action — in case an overlay ever grows over it */
  "var cta=document.querySelector(\"#screen-home .home-cta .btn-primary\");" +
  "var r=cta.getBoundingClientRect();" +
  "var g3=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);" +
  "swatch(3,isIn(g3,\".btn-primary\"),\"offering button\",g3);" +
  "document.getElementById(\"altarCaption\").textContent=\"tap probe · \"+report.join(\" · \");";
const HIT_LABELS = [
  'a fresh altar · the middle of the ＋ is the ＋ slot — the incense over it does not eat the tap',
  'a fresh altar · the empty niche wall is not a tablet (control: a probe that always said yes would prove nothing)',
  'four enshrined · a tap where the incense crosses a tablet reaches the tablet, not the sticks',
  'home · the Make an Offering button is what sits under the finger'
];

function checkShrineHits() {
  const base = fs.readFileSync(path.join(WORK, 'index.html'), 'utf8');   // already probed by prepare()
  const file = 'shrine-hits.html';
  fs.writeFileSync(path.join(WORK, file),
    base.replace('</body>', '<script>' + HIT_PROBE + '</script></body>'));
  const png = shoot({ file, label: 'shrine · does the tap reach what it aims at', w: W, h: H },
    path.join(WORK, 'shrine-hits.png'));
  HIT_LABELS.forEach((label, i) => {
    /* each swatch is 20×20 at (6+24i, 6): read the centre back */
    const px = shell('magick', png, '-format', `%[pixel:p{${16 + i * 24},16}]`, 'info:').trim();
    const [r, g, b] = (px.match(/\d+/g) || []).map(Number);
    const green = r < 24 && g > 231 && b < 24;
    ok(green, green ? label
      : `${label} — the probe read ${px}, not green: something else is painted over the tap `
        + 'point (see the shrine svg\'s pointer-events and the ＋ slot\'s paint order). '
        + 'The kept screenshot\'s caption names what took it.');
  });
}

function main() {
  console.log('render-check · ' + shell('firefox', ['--version']).split('\n')[0]);
  if (!has('magick')) {
    console.log('\n⚠ ImageMagick (`magick`) not found — cannot read pixels, render check skipped.');
    process.exit(0);
  }
  prepare();
  section('every screen draws the offering, inside the stage that shows it');
  const list = ONLY === 'shrine' ? [] : (ONLY ? SCREENS.filter(s => (s.screen || 'cards') === ONLY || s.file.startsWith(ONLY)) : SCREENS);
  if (!list.length && ONLY !== 'shrine')
    throw new Error('--only=' + ONLY + ' matches no screen (try: capture · transform · burn · fidelity · shrine)');
  for (const s of list) checkScreen(s);
  if (!ONLY || ONLY === 'shrine') {
    section('the shrine paints the names the user types onto the tablet');
    checkShrine();
    section('and every tap reaches what it aims at');
    checkShrineHits();
  }
  if (!KEEP) fs.rmSync(WORK, { recursive: true, force: true });
  else console.log('\nworking copy + screenshots: ' + WORK);
  console.log('\n' + (fail ? `✗ ${fail} failed · ${pass} passed` : `✓ all ${pass} render checks passed`));
  process.exit(fail ? 1 : 0);
}
main();

