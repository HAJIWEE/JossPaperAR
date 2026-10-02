#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────────
   aim-check.js — what does the fire actually pay for a throw?

   Why it exists: the target a throw is graded against is authored NOWHERE. app.js
   measures it off the flame's own polygons at runtime, converts it into the guide's
   390×844 units, and paints the sight, the ladder and the flight from that one
   measurement. Two mistakes are invisible to validate-fidelity.js and to render-check.js
   — both shipped once, and both are why this tool exists:

     · a band measured as zero. The flame's sides taper to a point, so a scanline just
       below the drawing finds no width at all: 正中 (×2.0) became unreachable except by
       a throw that was dead centre to the sub-pixel.
     · a measurement taken in the wrong space. styles.css scales the whole phone down on
       short windows, so the screen's CSS pixels and the guide's units are NOT the same
       size (≈1.19 against ≈1.23 of them per pixel on a 410×864 window). Mixing the two
       put the mouth line below the artwork and zeroed the same two bands.

   How: a *copy* of the prototype (the committed files are never modified) gets one extra
   script. It plays four throws — dead centre, just inside the flame, out on the coals and
   past the pit — reads back the grade, the award and the fire's answer for each,
   re-derives the bands from index.html's polygons with its own scanline, and checks the
   drawn target (the sight's ticks, the guide's tip, where a throw comes to rest). Every
   verdict is painted as a green/red square *and* written out as a line of text: the
   squares are read back with ImageMagick, the text stays in the screenshot for the eye
   (--keep keeps it). A blue square closes the strip, so a probe that died early cannot
   look like a pass — a lesson from this tool's own first draft: the probe is embedded
   here as a template string, so every quote in it has to be escaped *for the file it
   lands in*, and one bare apostrophe in a single-quoted string made the whole probe a
   syntax error that reported every check as failed while the page looked perfectly fine.
   main() now parses the probe before Firefox ever sees it, so that failure is a message.

   Usage:  node prototype/tools/aim-check.js [--keep]
   Needs:  firefox, ImageMagick (`magick` for the squares), like render-check.js
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const PROJ = path.join(__dirname, '..');
const KEEP = process.argv.includes('--keep');
const WORK = path.join(os.tmpdir(), 'jp-aim-check');
const PROF = path.join(os.tmpdir(), 'jp-aim-check-profile');
const W = 410, H = 864;                 // window = the phone frame (390) + its 2×10 border

let pass = 0, fail = 0;
const ok = (cond, msg) => { cond ? pass++ : fail++; console.log('  ' + (cond ? '✓' : '✗') + ' ' + msg); };
const section = t => console.log('\n' + t);

const url = () => 'file://' + path.join(WORK, 'index.html') + '?screen=burn';

/* firefox gets no pipes: a helper/grandchild process keeps the inherited fds open and
   execFileSync would then wait forever, even though the run is already over. --dump-dom
   is worse here — it prints a graphics warning and never quits — so the verdicts are read
   off the page instead, as squares painted into the screenshot. */
const firefox = args => execFileSync('firefox', args, { stdio: 'ignore' });
function shoot(out) {
  fs.rmSync(out, { force: true });
  firefox(['--headless', '--no-remote', '--profile', PROF, '--window-size=' + W + ',' + H,
    '--screenshot', out, url()]);
  if (!fs.existsSync(out)) throw new Error('firefox never wrote ' + out);
  return out;
}
/* the strip the probe paints: 18px squares, 2px apart, from (8, 8) — so square i is
   sampled at its centre, (17 + 20i, 17) */
function readSquares(png, n) {
  const marks = [];
  for (let i = 0; i < n; i++) marks.push('%[pixel:p{' + (17 + i * 20) + ',17}]');
  const out = execFileSync('magick', [png, '-format', marks.join(' '), 'info:'], { encoding: 'utf8' });
  return out.trim().split(/\s+/).map(s => {
    const m = /s?rgba?\((\d+),(\d+),(\d+)/.exec(s) || [, '0', '0', '0'];
    return { r: +m[1], g: +m[2], b: +m[3] };
  });
}
const green = c => c.g > 200 && c.r < 80 && c.b < 80;
const red = c => c.r > 200 && c.g < 80 && c.b < 80;
const blue = c => c.b > 200 && c.r < 90 && c.g < 130;

function prepare() {
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });
  fs.mkdirSync(PROF, { recursive: true });          // firefox refuses to start without it
  /* a run that was killed leaves the profile locked, and firefox would then start with
     no screenshot and no explanation at all */
  for (const f of ['lock', '.parentlock']) fs.rmSync(path.join(PROF, f), { force: true });
  for (const f of fs.readdirSync(PROJ)) {
    const src = path.join(PROJ, f), dst = path.join(WORK, f);
    if (fs.statSync(src).isDirectory()) fs.cpSync(src, dst, { recursive: true });
    else fs.copyFileSync(src, dst);
  }
  fs.writeFileSync(path.join(WORK, 'aim-probe.js'), PROBE);
  const page = path.join(WORK, 'index.html');
  fs.writeFileSync(page, fs.readFileSync(page, 'utf8')
    .replace('</body>', '<script src="aim-probe.js"></script></body>'));
}

/* ── the probe ────────────────────────────────────────────────────────────────
   Four throws, then a re-measurement of everything app.js measured, and one painted
   square per verdict. No backticks and no ${} in here on purpose: this source is
   embedded in the tool. The order of the judge() calls is the order of CHECKS below. */
const PROBE = `/* injected by tools/aim-check.js — never part of the prototype */
window.addEventListener('load', function () {
  var out = [];
  var say = function (tag, text) { out.push(tag + ' ' + text); };
  var strip = document.createElement('div');       // the machine-readable half: one square per check
  strip.style.cssText = 'position:fixed;left:8px;top:8px;z-index:100000;font-size:0;line-height:0;pointer-events:none';
  var square = function (colour) {
    var d = document.createElement('div');
    d.style.cssText = 'display:inline-block;width:18px;height:18px;margin-right:2px;background:' + colour;
    strip.appendChild(d);
  };
  var judge = function (good, text) {
    say(good ? 'PASS' : 'FAIL', text);
    square(good ? '#00FF00' : '#FF0000');
  };
  var n2 = function (v) { return v.toFixed(2); };
  var box = function (el) { var r = el.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; };
  var points = function (poly) { return poly.getAttribute('points').trim().split(/\\s+/).map(function (p) { return p.split(',').map(Number); }); };
  var halfWidthAt = function (pts, y) {
    var mid = (Math.min.apply(null, pts.map(function (p) { return p[0]; })) + Math.max.apply(null, pts.map(function (p) { return p[0]; }))) / 2;
    var half = 0;
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        var x = a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]);
        half = Math.max(half, Math.abs(x - mid));
      }
    }
    return half;
  };

  /* ① what each throw is paid, and what the fire does about it */
  var cases = [
    { aim: 0,   tier: 'bullseye', award: 1650, fire: 'is-flaring',    of: 'dead centre' },
    { aim: 30,  tier: 'devout',   award: 1250, fire: 'is-flaring',    of: 'inside the flame' },
    { aim: -70, tier: 'graze',    award: 850,  fire: 'is-smoldering', of: 'out on the coals' },
    { aim: 150, tier: 'miss',     award: 0,    fire: '',              of: 'past the pit' }
  ];
  cases.forEach(function (c) {
    resetBurn();
    throwOffering(c.aim);
    var t = state.lastThrow;
    var cls = document.getElementById('burnFlame').className;
    var went = c.fire ? cls.indexOf(c.fire) >= 0
      : cls.indexOf('is-flaring') < 0 && cls.indexOf('is-smoldering') < 0;
    judge(!!t && t.tier.key === c.tier && t.award === c.award && went
      && document.getElementById('burnObject').dataset.tier === c.tier,
      'a throw ' + c.of + ' is graded and paid the way the ladder says');
    say('INFO', 'aim ' + c.aim + ' (' + c.of + ') → ' + (t ? t.tier.key + ' ×' + t.tier.mult + ', ' + t.award + ' points' : 'nothing')
      + ' — fire[' + cls + '], popup ' + document.getElementById('scoreValue').textContent
      + ' ' + document.getElementById('scoreGrade').textContent);
  });

  /* ② the bands the app graded with, against the same polygons re-measured here. The
        flame's breathing is paused exactly as app.js pauses it: an animation in flight
        would move the outline under the scanline */
  resetBurn();
  var flame = document.getElementById('burnFlame');
  var keepAnim = flame.style.animation;
  flame.style.animation = 'none';
  var sc = box(document.getElementById('screen-burn'));
  var svg = document.querySelector('#burnFlame svg');
  var fr = box(svg), bed = box(document.querySelector('.ember-bed'));
  flame.style.animation = keepAnim;
  var ux = 390 / sc.w, uy = 844 / sc.h;                       // CSS px → the guide's units
  var sx = fr.w / 200, sy = fr.h / 240;                       // CSS px → the flame's units
  var yIn = (AIM.mouthY - (fr.t - sc.t) * uy) / (sy * uy);    // the mouth line, in the flame's units
  var inner = halfWidthAt(points(svg.querySelector('.flame-inner')), yIn) * sx * ux;
  var outer = halfWidthAt(points(svg.querySelector('.flame-outer')), yIn) * sx * ux;
  var bedHalf = bed.w * ux / 2;
  say('INFO', 'bands app ' + n2(AIM.heart) + '/' + n2(AIM.flame) + '/' + n2(AIM.pit)
    + ' — re-derived from the polygons ' + n2(inner) + '/' + n2(outer) + '/' + n2(bedHalf)
    + ' (mouth line y ' + n2(AIM.mouthY) + ', one flame unit = ' + n2(sy * uy) + ' guide units)');
  judge(inner > 1 && outer > 1, 'the scanline crosses the flame at the mouth line — not above or below the drawing');
  judge(AIM.heart > 0 && AIM.flame > AIM.heart && AIM.pit > AIM.flame,
    'no band collapsed: the heart is inside the flame, and the flame inside the pit');
  judge(Math.abs(AIM.heart - inner) < 0.6 && Math.abs(AIM.flame - outer) < 0.6 && Math.abs(AIM.pit - bedHalf) < 0.6,
    'the target app.js grades with is the fire index.html draws, to the pixel');

  /* ③ the drawn target: the sight, the guide's tip, and where a throw comes to rest */
  var ticks = document.querySelectorAll('#aimSight .sight-tick');
  judge(ticks.length === 6, 'six sight ticks are drawn — the pit, the flame and the heart, both sides');
  var tickX = function (i) { var b = box(ticks[i] || document.body); return ((b.l + b.w / 2) - sc.l) * ux; };
  judge(Math.abs(tickX(0) - (AIM.cx - AIM.pit)) < 0.6 && Math.abs(tickX(1) - (AIM.cx + AIM.pit)) < 0.6,
    'the outer ticks stand on the pit\\'s edges');
  judge(Math.abs(tickX(5) - (AIM.cx + AIM.heart)) < 0.6 && tickX(5) - AIM.cx > 1,
    'the inner ticks stand on the flame\\'s heart, clear of the centre line');
  say('INFO', 'ticks at ' + [0, 1, 2, 3, 4, 5].map(function (i) { return n2(tickX(i)); }).join(' · ')
    + ' — the pit at ±' + n2(AIM.pit) + ', the flame at ±' + n2(AIM.flame) + ', the heart at ±' + n2(AIM.heart));
  var tip = box(document.querySelector('#throwGuide .guide-tip'));
  var tipX = ((tip.l + tip.w / 2) - sc.l) * ux, tipY = ((tip.t + tip.h) - sc.t) * uy;   // the apex is the box's lower edge
  judge(Math.abs(tipX - AIM.cx) < 1.5 && Math.abs(tipY - AIM.mouthY) < 1.5,
    'the guide\\'s tip points at the mouth line');
  var d = document.querySelector('#throwGuide .guide-path').getAttribute('d');
  var end = d.trim().split(/\\s+/).pop().split(',').map(Number);
  judge(Math.abs(end[0] - AIM.cx) < 0.6 && Math.abs(end[1] - AIM.mouthY) < 0.6,
    'the dotted line ends where the throw is graded');
  say('INFO', 'tip apex (' + n2(tipX) + ', ' + n2(tipY) + ') against the mouth (' + n2(AIM.cx) + ', ' + n2(AIM.mouthY) + '), guide ' + d);
  var bull = landingPoint(AIM.bands[0], 0), miss = landingPoint(AIM.bands[3], AIM_REACH);
  judge(Math.abs(bull.x - AIM.cx) < 0.01 && Math.abs(bull.y - AIM.mouthY) < 0.01,
    'a bullseye comes to rest on the fire\\'s centre line, at the mouth');
  judge(Math.abs(miss.x - (AIM.cx + AIM_REACH)) < 0.01 && miss.y > AIM.ashY,
    'a miss is aimed past the pit and falls below the coals');
  say('INFO', 'a bullseye rests at (' + n2(bull.x) + ', ' + n2(bull.y) + '), a graze on the coals at y ' + n2(AIM.ashY)
    + ', a miss at (' + n2(miss.x) + ', ' + n2(miss.y) + ')');
  var ladder = document.getElementById('aimLadder').textContent;
  judge(/正中 ×2.0/.test(ladder) && /虔誠 ×1.5/.test(ladder) && /擦邊 ×1.0/.test(ladder) && /偏失 ×0/.test(ladder),
    'the ladder names all four grades');
  say('INFO', 'ladder: ' + ladder);

  /* the report: the text is for the eye (every line coloured by its verdict) and the
     squares above carry the same verdicts — those are for the tool */
  square('#3355FF');                                 // the guard: the probe reached the end
  var panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:0;top:34px;right:0;bottom:0;z-index:99999;margin:0;'
    + 'padding:8px;background:rgba(8,8,8,.94);font:11px/1.5 monospace;overflow:hidden';
  out.forEach(function (line) {
    var m = /^(PASS|FAIL|INFO) (.*)$/.exec(line);
    var d = document.createElement('div');
    d.style.color = !m ? '#BBBBBB' : m[1] === 'INFO' ? '#FFD98A' : m[1] === 'PASS' ? '#6EE36E' : '#FF6B6B';
    d.textContent = m ? (m[1] === 'INFO' ? '· ' : m[1] === 'PASS' ? '✓ ' : '✗ ') + m[2] : line;
    panel.appendChild(d);
  });
  document.body.appendChild(strip);
  document.body.appendChild(panel);
});
`;

/* The verdicts, in the order the probe judges them (the squares are read by position;
   the wording is the probe's, so the tool prints what the page shows). */
const CHECKS = [
  'a throw dead centre is graded and paid the way the ladder says',
  'a throw inside the flame is graded and paid the way the ladder says',
  'a throw out on the coals is graded and paid the way the ladder says',
  'a throw past the pit is graded and paid the way the ladder says',
  'the scanline crosses the flame at the mouth line — not above or below the drawing',
  'no band collapsed: the heart is inside the flame, and the flame inside the pit',
  'the target app.js grades with is the fire index.html draws, to the pixel',
  'six sight ticks are drawn — the pit, the flame and the heart, both sides',
  "the outer ticks stand on the pit's edges",
  "the inner ticks stand on the flame's heart, clear of the centre line",
  "the guide's tip points at the mouth line",
  'the dotted line ends where the throw is graded',
  "a bullseye comes to rest on the fire's centre line, at the mouth",
  'a miss is aimed past the pit and falls below the coals',
  'the ladder names all four grades'
];

const has = bin => { try { execFileSync('which', [bin], { stdio: 'ignore' }); return true; } catch { return false; } };

function main() {
  section('aim-check · ' + execFileSync('firefox', ['--version'], { encoding: 'utf8' }).trim());
  /* the probe is a string here and only becomes a script once it is written out, so a
     quote that is not escaped *for the file it lands in* would show up as a page that
     reports nothing at all — parse it here, where the message can name the broken line */
  try { new Function(PROBE); } catch (e) {
    console.log('  ✗ the probe is not valid JavaScript: ' + e.message);
    process.exit(2);
  }
  if (!has('magick')) {
    console.log('  ✗ ImageMagick (`magick`) reads the verdicts out of the screenshot — it is missing');
    process.exit(1);
  }
  prepare();
  const shot = shoot(path.join(WORK, 'aim-report.png'));
  const squares = readSquares(shot, CHECKS.length + 1);
  section('what the fire paid, and what it graded with');
  CHECKS.forEach((text, i) => {
    const c = squares[i];
    if (!c || (!green(c) && !red(c))) return ok(false, text + '   ← the probe never reached this check');
    ok(green(c), text);
  });
  const guard = squares[CHECKS.length];
  ok(!!guard && blue(guard),
    'the probe ran to the end — ' + CHECKS.length + ' checks, and nothing threw before the report was written');
  console.log('\n' + (fail ? '✗ ' + fail + ' failed · ' + pass + ' passed' : '✓ all ' + pass + ' aim checks passed'));
  console.log('  the report itself is in ' + shot + (KEEP ? '' : '   (removed — pass --keep to read it)'));
  if (!KEEP) fs.rmSync(WORK, { recursive: true, force: true });
  process.exit(fail ? 1 : 0);
}
main();

