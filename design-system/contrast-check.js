#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────────
   contrast-check.js — are the accessible tokens actually accessible, and does
   the stylesheet still reach for the decorative palette when it means text?

   Why it exists: the Penpot sweep found 130 low-contrast text findings, and all
   of them traced back to four pairings in the *locked SCRUM-6 palette*. The
   prototype CSS sampled 11 failing pairings out of 19. tokens.css now separates
   brand colours (decorative) from -text colours (verified on cream) — but a
   separation only holds if something enforces it. A value can be edited, or a
   new rule can say `color:var(--gold-deep)`, and nothing would notice until a
   user squints at their phone in daylight. This notices.

   Two parts:
     1. the token table — every documented ratio is recomputed from the file's
        own values and asserted. Edit a value and the ratio is re-derived, never
        trusted from a comment.
     2. the stylesheet lint — any `color:` / `fill:` / `stroke:` naming a
        DECORATIVE brand token is a violation: those are qualified for borders
        and fills only. Text must use a -text token. Scans the design-system
        foundation always, and the build stylesheet once one exists.

   Usage:  node design-system/contrast-check.js [--only=tokens|lint] [--css=path]
   Needs:  node only (no browser — this is arithmetic and text scanning)
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');

const PROJ = path.join(__dirname, '..');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1];

/* tokens.css sits beside this script in design-system/. */
const TOKENS_CSS = path.join(__dirname, 'tokens.css');

/* The prototype is retired, so its stylesheet is no longer the lint target.
   These are the build stylesheets the lint picks up once the real build
   exists; override with --css=path/to/styles.css.
   The design-system foundation ships with every build, so it is scanned
   ALWAYS — not only while the build CSS is missing. */
const BUILD_CSS_CANDIDATES = ['src/styles.css', 'app/styles.css', 'build/styles.css', 'web/styles.css'];
const FOUNDATION_CSS = ['design-system/responsive.css'];

let pass = 0, fail = 0;
const ok = (cond, msg) => { cond ? pass++ : fail++; console.log('  ' + (cond ? '✓' : '✗') + ' ' + msg); };
const section = t => console.log('\n' + t);

/* ── WCAG 2.x relative luminance + contrast ratio ─────────────────────────── */
const toRGB = h => {
  h = String(h).trim().replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error('not a hex colour: #' + h);
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
};
const luminance = rgb => {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
};
const ratio = (fg, bg) => {
  const a = luminance(toRGB(fg)), b = luminance(toRGB(bg));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
/* AA body text needs 4.5:1; large text (>=24px, or >=18.66px bold) needs 3:1 */
const AA_BODY = 4.5;
/* A -text token must clear AA body on EVERY cream surface. Which surface binds
   depends on the foreground: every brand colour here is DARKER than every cream,
   so contrast shrinks as the background darkens and the binding surface is the
   DARKEST cream (--paper-deep), not the lightest. That is counter-intuitive
   enough to be worth stating — #4A6FA5 reads 4.81 on #FDF8E7 and only 3.97 on
   #EAE2D2. The check below therefore computes the true worst across all five
   rather than testing one assumed-worst surface. */
const CREAMS = ['#FDF8E7', '#FBF7EE', '#F8F1DC', '#F5F0E8', '#EAE2D2'];
const HARDEST_CREAM = '#EAE2D2';   /* --paper-deep: the binding surface */

/* ── read the tokens straight out of tokens.css ───────────────────────────── */
function readTokens() {
  const src = fs.readFileSync(TOKENS_CSS, 'utf8');
  const t = {};
  for (const m of src.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{3,6})\s*[;}]/g)) t[m[1]] = m[2].toUpperCase();
  return { src, t };
}

/* ── part 1: the token table ──────────────────────────────────────────────── */
/* Each row is re-derived from the file, so a documented ratio can never drift
   silently from the value it describes. */
const TEXT_TOKENS = [
  ['--gold-text',        '--gold-deep'],
  ['--gold-bright-text', '--gold-bright'],
  ['--malachite-text',   '--malachite'],
  ['--azurite-text',     '--azurite'],
  ['--cinnabar-text',    '--cinnabar'],
  ['--ink-text',         null],
  ['--muted-text',       '--muted'],
];
const DISC_TOKENS = [
  ['--disc-gold',        '--gold'],
  ['--disc-gold-deep',   '--gold-deep'],
  ['--disc-malachite',   '--malachite'],
  ['--disc-jade-facet',  '--jade-facet'],
];
/* brand colours that already carry the cream glyph — asserted so that if one is
   ever lightened, the check fails instead of the avatar becoming unreadable */
const DISCS_ALREADY_OK = ['--azurite', '--cinnabar', '--azurite-deep', '--cinnabar-deep', '--malachite-deep'];

function checkTokens() {
  const { src, t } = readTokens();

  section('text tokens clear AA body (4.5:1) on EVERY cream — the worst of the five is shown');
  for (const [token, brand] of TEXT_TOKENS) {
    const v = t[token];
    if (!v) { ok(false, token + ' is missing from tokens.css'); continue; }
    /* the true worst across all five creams, not one assumed-worst surface */
    const worst = Math.min(...CREAMS.map(bg => ratio(v, bg)));
    const note = brand && t[brand]
      ? '   (brand ' + t[brand] + ' on ' + HARDEST_CREAM + ' = ' + ratio(t[brand], HARDEST_CREAM).toFixed(2) + ')'
      : '';
    ok(worst >= AA_BODY, token.padEnd(20) + ' ' + v + '  worst ' + worst.toFixed(2) + ' across all 5 creams' + note);
  }

  section('avatar discs carry the cream glyph at 4.5:1 — the fill darkens, the glyph does not');
  const glyph = t['--on-color-cream'];
  if (!glyph) ok(false, '--on-color-cream is missing from tokens.css');
  else {
    for (const [token, brand] of DISC_TOKENS) {
      const v = t[token];
      if (!v) { ok(false, token + ' is missing from tokens.css'); continue; }
      const r = ratio(glyph, v);
      const note = t[brand] ? '   (brand ' + t[brand] + ' alone = ' + ratio(glyph, t[brand]).toFixed(2) + ')' : '';
      ok(r >= AA_BODY, token.padEnd(20) + ' ' + v + '  with ' + glyph + ' = ' + r.toFixed(2) + note);
    }
    for (const brand of DISCS_ALREADY_OK) {
      const v = t[brand];
      if (!v) { ok(false, brand + ' is missing from tokens.css'); continue; }
      ok(ratio(glyph, v) >= AA_BODY, brand.padEnd(20) + ' ' + v + ' still carries ' + glyph + ' = ' + ratio(glyph, v).toFixed(2));
    }
  }

  section('the facet-jade gradient clears 4.5:1 at EVERY stop, not just its darkest');
  const grad = (src.match(/--facet-jade-a11y\s*:\s*conic-gradient\(([^;]*)\)/) || [])[1];
  if (!grad) ok(false, '--facet-jade-a11y is missing or is not a conic-gradient');
  else {
    const stops = [...grad.matchAll(/var\((--[a-z0-9-]+)\)/g)].map(m => m[1]);
    ok(stops.length >= 3, 'the gradient has ' + stops.length + ' stops to check');
    for (const s of stops) {
      const v = t[s];
      if (!v) { ok(false, '  stop ' + s + ' is not defined'); continue; }
      ok(ratio(glyph, v) >= AA_BODY,
        '  stop ' + s.padEnd(20) + ' ' + v + ' = ' + ratio(glyph, v).toFixed(2));
    }
  }
}

/* ── part 2: the stylesheet lint ──────────────────────────────────────────── */
/* Decorative brand tokens are qualified for borders and fills. Naming one in a
   colour-bearing property means text or an icon is about to be painted with a
   value that was never checked against a background. */
const DECORATIVE = [
  '--cinnabar', '--cinnabar-soft', '--cinnabar-deep',
  '--gold', '--gold-bright', '--gold-deep',
  '--azurite', '--azurite-light', '--azurite-deep',
  '--malachite', '--malachite-deep', '--jade-facet',
  '--muted',
];
const COLOR_PROPS = /\b(color|fill|stroke)\s*:\s*var\((--[a-z0-9-]+)\)/g;

function resolveLintTargets() {
  const explicit = (process.argv.find(a => a.startsWith('--css=')) || '').split('=')[1];
  const build = [];
  for (const rel of explicit ? [explicit] : BUILD_CSS_CANDIDATES) {
    const abs = path.isAbsolute(rel) ? rel : path.join(PROJ, rel);
    if (fs.existsSync(abs)) { build.push(abs); break; }
  }
  const foundation = FOUNDATION_CSS.map(rel => path.join(PROJ, rel)).filter(abs => fs.existsSync(abs));
  return { build, foundation };
}

function lintStylesheet() {
  const { build, foundation } = resolveLintTargets();
  section('stylesheet never paints text with a decorative brand token');
  if (!build.length) {
    /* Reported, NOT silently passed — a missing build target must never read green. */
    console.log('  – no build stylesheet yet (looked for ' + BUILD_CSS_CANDIDATES.join(', ') + ')');
    console.log('      point it there with --css=path/to/styles.css once the real build lands —');
    console.log('      until then the design-system foundation below is the scanned target.');
    console.log('      prototype/styles.css is deliberately NOT scanned: the prototype is retired');
    console.log('      and Penpot is the design source of truth, so its 32 decorative-token');
    console.log('      usages are a historical record, not a live build defect.');
  }
  const targets = [...build, ...foundation];
  if (!targets.length) { console.log('  – skipped: nothing to scan'); return; }
  const hits = [];
  for (const file of targets) {
    console.log('  scanning ' + path.relative(PROJ, file));
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      /* a token's own definition in :root is not a usage */
      if (/^\s*--/.test(line)) return;
      for (const m of line.matchAll(COLOR_PROPS)) {
        if (DECORATIVE.includes(m[2])) hits.push({ file: path.relative(PROJ, file), ln: i + 1, prop: m[1], tok: m[2] });
      }
    });
  }
  if (!hits.length) ok(true, 'no decorative token is used as text — every colour: names a -text token');
  else {
    ok(false, hits.length + ' rule(s) paint text with a decorative brand token:');
    for (const h of hits) console.log('      ' + h.file + ' line ' + String(h.ln).padStart(4) + '  ' + h.prop + ':var(' + h.tok + ')');
    console.log('      swap each to its -text counterpart from tokens.css, or confirm the');
    console.log('      background is dark (--surface-camera) and the brand value passes there.');
  }
}

function main() {
  console.log('contrast-check · WCAG 2.x relative luminance');
  if (ONLY && ONLY !== 'tokens' && ONLY !== 'lint')
    throw new Error('--only=' + ONLY + ' matches no part (try: tokens · lint)');
  if (!ONLY || ONLY === 'tokens') checkTokens();
  if (!ONLY || ONLY === 'lint') lintStylesheet();
  console.log('\n' + (fail ? '✗ ' + fail + ' failed · ' + pass + ' passed' : '✓ all ' + pass + ' contrast checks passed'));
  process.exit(fail ? 1 : 0);
}
main();
