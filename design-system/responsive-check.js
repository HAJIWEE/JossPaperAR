#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────────
   responsive-check.js — does the responsive foundation keep its promises, and
   does a stylesheet avoid the prototype's failure mode?

   Why it exists: contrast-check.js asserts the COLOUR layer; nothing asserted
   the LAYOUT layer. The census of the retired prototype found 470 hardcoded px
   values, 0 clamp()/min()/max(), 0 safe-area insets and a fixed 390×844
   canvas — the exact failure mode design-system/responsive.css exists to
   prevent. A rule nothing enforces is a wish, so this enforces three:

     1. the type scale — every clamp() is re-derived at the 390 px reference
        and must equal the design px from the Penpot census (2026-09-30);
     2. the foundation invariants — insets present, dvh fallback pair, no
        literal 390/844 outside comments, no raw font-size, a 44 px touch
        target, a growth cap;
     3. the build scan — once a build stylesheet exists, it must not
        reintroduce hard-coded type sizes, canvas literals, or a vh without
        its dvh pair.

   Usage:  node design-system/responsive-check.js [--css=path/to/styles.css]
   Needs:  node only (this is arithmetic and text scanning)
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');

const PROJ = path.join(__dirname, '..');
const FOUNDATION = path.join(__dirname, 'responsive.css');
const BUILD_CSS_CANDIDATES = ['src/styles.css', 'app/styles.css', 'build/styles.css', 'web/styles.css'];
const REF = 390;   /* the design reference width — the Penpot canvas */

let pass = 0, fail = 0;
const ok = (cond, msg) => { cond ? pass++ : fail++; console.log('  ' + (cond ? '✓' : '✗') + ' ' + msg); };
const section = t => console.log('\n' + t);

/* Comments are stripped before any literal scan — the header legitimately
   MENTIONS 390×844 to explain why it must never appear in code. */
const strip = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const rem2px = v => parseFloat(v) * 16;

/* ── part 1: the type scale, re-derived at the 390 px reference ───────────── */
/* The design px come from the Penpot census and are the contract. The clamp()
   slopes may change — as long as they still hit these anchors. A new step may
   not be invented without adding it here AND re-running the census. */
const SCALE = {
  '--fs-hero':76, '--fs-display':40, '--fs-title-hero':30, '--fs-title-page':26,
  '--fs-title-screen':24, '--fs-title-sheet':21, '--fs-title-row':17, '--fs-body-lg':15,
  '--fs-body':13, '--fs-body-sm':12, '--fs-label':11, '--fs-caption':10, '--fs-micro':9,
};

function checkScale(src) {
  section('type scale — every token re-derived at the ' + REF + ' px reference');
  for (const [token, design] of Object.entries(SCALE)) {
    const m = src.match(new RegExp(token + '\\s*:\\s*([^;]+);'));
    if (!m) { ok(false, token + ' is missing from responsive.css'); continue; }
    const val = m[1].trim();
    if (val.startsWith('clamp(')) {
      const parts = val.slice(6, -1).split(',');
      const mid = (parts[1] || '').match(/([\d.]+)rem\s*\+\s*([\d.]+)vw/);
      if (parts.length !== 3 || !mid) { ok(false, token + ' — clamp() middle term must be "Nrem + Nvw"'); continue; }
      const at = w => rem2px(mid[1]) + parseFloat(mid[2]) * w / 100;
      const at320 = at(320), at390 = at(REF), at480 = at(480);
      const bracketed = at320 >= rem2px(parts[0]) - 0.6 && at480 <= rem2px(parts[2]) + 0.6;
      ok(Math.abs(at390 - design) <= 0.5 && bracketed,
        token.padEnd(18) + ' ' + at390.toFixed(2) + ' px at ' + REF + ' (design ' + design + ') · range ' +
        at320.toFixed(1) + '–' + at480.toFixed(1) + ' px');
    } else {
      const fixed = val.match(/^([\d.]+)rem$/);
      if (!fixed) { ok(false, token + ' — expected rem or clamp(), got: ' + val); continue; }
      const px = rem2px(fixed[1]);
      ok(Math.abs(px - design) <= 0.01, token.padEnd(18) + ' ' + px + ' px fixed (design ' + design + ')');
    }
  }
  const found = new Set([...strip(src).matchAll(/--fs-[a-z-]+(?=\s*:)/g)].map(m => m[0]));
  const extra = [...found].filter(t => !(t in SCALE));
  ok(extra.length === 0, extra.length
    ? 'undocumented type step(s): ' + extra.join(', ') + ' — add to the census table first'
    : 'the scale is a closed set — no undocumented type steps');
}

/* ── part 2: foundation invariants ────────────────────────────────────────── */
function checkFoundation(src) {
  const code = strip(src);
  section("foundation invariants — the prototype's failure mode cannot return");
  ok(/env\(safe-area-inset-top/.test(code) && /env\(safe-area-inset-bottom/.test(code),
    'safe-area insets for top and bottom are present');
  ok(/100dvh/.test(code) && /100vh/.test(code),
    'viewport height ships as the 100vh → 100dvh fallback pair');
  ok(!/\b390\b|\b844\b/.test(code),
    'no literal 390 / 844 outside comments — the canvas is a reference, not an assumption');
  const fsUses = [...code.matchAll(/font-size\s*:\s*([^;}]+)/g)].map(m => m[1].trim());
  const hard = fsUses.filter(v => !/^(100%|inherit|var\(--fs-)/.test(v));
  ok(hard.length === 0, 'no raw font-size values' + (hard.length ? ' — found: ' + hard.join(' · ') : ''));
  ok(/--touch-target\s*:\s*44px/.test(code), 'the 44 px touch-target token is present');
  ok(/--content-max\s*:/.test(code) && /max-width\s*:\s*var\(--content-max\)/.test(code),
    'growth is capped and the column centres past 480 px');
  ok(/prefers-reduced-motion/.test(code), 'reduced motion is honoured');
}

/* ── part 3: the build stylesheet, once one exists ────────────────────────── */
function resolveBuildTarget() {
  const explicit = (process.argv.find(a => a.startsWith('--css=')) || '').split('=')[1];
  for (const rel of explicit ? [explicit] : BUILD_CSS_CANDIDATES) {
    const abs = path.isAbsolute(rel) ? rel : path.join(PROJ, rel);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

function scanBuild(file) {
  section('the build stylesheet keeps the same promises (once it exists)');
  if (!file) {
    /* Reported as skipped, NOT as a pass — a missing target must never read green. */
    console.log('  – skipped: no build stylesheet exists yet');
    console.log('      looked for: ' + BUILD_CSS_CANDIDATES.join(', '));
    console.log('      point it there with --css=path/to/styles.css once the build lands.');
    return;
  }
  const code = strip(fs.readFileSync(file, 'utf8'));
  console.log('  scanning ' + path.relative(PROJ, file));
  const fsUses = [...code.matchAll(/font-size\s*:\s*([^;}]+)/g)].map(m => m[1].trim());
  const hard = fsUses.filter(v => !/^(inherit|var\(--fs-|100%|1em)/.test(v));
  ok(hard.length === 0, hard.length
    ? hard.length + ' hard-coded font-size value(s): ' + hard.slice(0, 5).join(' · ')
    : 'text sizes come from the scale — no hard-coded font-size');
  ok(!/\b390\b|\b844\b/.test(code), 'no fixed-canvas literals');
  ok(!/100vh/.test(code) || /100dvh/.test(code), 'if 100vh appears, the dvh pair is present');
  ok(/env\(safe-area-inset/.test(code), 'full-screen surfaces respect the insets');
}

function main() {
  console.log('responsive-check · fluid type · safe areas · the prototype census, inverted');
  const src = fs.readFileSync(FOUNDATION, 'utf8');
  checkScale(src);
  checkFoundation(src);
  scanBuild(resolveBuildTarget());
  console.log('\n' + (fail ? '✗ ' + fail + ' failed · ' + pass + ' passed' : '✓ all ' + pass + ' responsive checks passed'));
  process.exit(fail ? 1 : 0);
}
main();
