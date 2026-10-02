#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────────
   gen-car-3d.js — generates the car artwork for prototype/fidelity-test.html
   and for the car stages of prototype/index.html

   Why a generator: the fidelity test compares the SAME car at different
   tessellation levels, and the mockups show that same car as "the photo" and as
   "the offering". Hand-authored SVG coordinates can't guarantee any of that
   (they can't share a model), and they can't be re-derived. So the car is
   defined ONCE as a low-poly 3D mesh, projected with a fixed orthographic
   camera, and each variant is the same mesh simplified to a different
   tolerance. Silhouette drift is then measured, not eyeballed.

   Pipeline:  mesh (3D) → simplify (Douglas-Peucker, per variant)
              → orthographic project → backface cull → depth sort (painter)
              → flat-shade per face → emit SVG

   Output: rewrites the block in fidelity-test.html between
           <!-- BEGIN GENERATED CARS --> and <!-- END GENERATED CARS -->,
           updates the shared viewBox there, and in index.html fills the same
           block plus each car stage's viewBox and <use> target.

   Usage:  node prototype/tools/gen-car-3d.js [--check]
           --check  verify the committed pages match the generator (no write)
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');

const PAGE = path.join(__dirname, '..', 'fidelity-test.html');
const INDEX = path.join(__dirname, '..', 'index.html');
const CHECK = process.argv.includes('--check');
const BEGIN = '<!-- BEGIN GENERATED CARS';
const END = '<!-- END GENERATED CARS -->';

/* Car stages the generator owns in prototype/index.html — the two that show the
   OFFERING, and therefore have artwork to generate.

   The two places that show the *real* object (the capture viewfinder and the
   comparator's "before" half) are deliberately NOT stages: they carry a real
   photograph (assets/car-real.jpg, applied in styles.css), because a camera
   shows reality — not a render of the mesh. Making the generator own a render
   there was the previous iteration's compromise; this is what the app does. */
const STAGES = {
  /* `zoom` expands the stage's viewBox about its centre: the artwork is drawn
     smaller, so a side-by-side compare puts the two subjects at the same
     apparent size. The photo beside it is a low-angle shot (the car's height is
     ~63% of its frame) while the orthographic camera sees the roof (92%), so at
     zoom 1 the offering reads ~1.4× the area. 1.18 equalises the area. */
  'transform-after':  { href: 'carD', zoom: 1.18, what: 'the offering at the locked fidelity (D)' },
  'burn':             { href: 'carD', what: 'the offering in flight to the fire' }
};

/* ── vector math ─────────────────────────────────────────────────────────── */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = v => Math.hypot(v[0], v[1], v[2]);
const unit = v => { const l = len(v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (v, s) => [v[0] * s, v[1] * s, v[2] * s];

/* ── camera: fixed orthographic 3/4 view (no perspective term anywhere) ──── */
const YAW = (-36 * Math.PI) / 180;   // rotate car about Z: nose swings right + toward camera
const PITCH = (15 * Math.PI) / 180;  // camera elevation above the ground plane
const CAM = [Math.cos(PITCH) * Math.cos(YAW), Math.cos(PITCH) * Math.sin(YAW), Math.sin(PITCH)];
const VIEWDIR = scale(CAM, -1);                       // camera → scene
const RIGHT = unit([-CAM[1], CAM[0], 0]);             // screen +x
const UP = cross(RIGHT, VIEWDIR);                     // screen +y (before flipping)
const project = p => [dot(p, RIGHT), -dot(p, UP)];
const depthOf = p => dot(p, CAM);                     // larger = nearer the camera
const LIGHT = unit([0.34, -0.58, 0.74]);              // key light: above, front-right

/* ── palette (locked) ────────────────────────────────────────────────────── */
const INK = '#1A1A1A';
const PAINTS = {
  body: '#8FB0D0',    // azurite, mid
  roof: '#A9C4DC',
  glass: '#22323F',
  rubber: '#2E3438',   // tyre: dark slate, so a lit flank still separates from the ink line
  rubber2: '#242A2E',
  alloy: '#D4AF37',
  alloy2: '#F0DC9A',
  accent: '#C23B22',  // cinnabar
  lamp: '#FFD98A',
  steel: '#C9CFD6',
  /* the grille has to name a colour like every other material: it used to fall
     through to tone() with a non-hex string, which emitted fill="#NaNNaN10"
     (an invalid paint the browser drops — the grille rendered as a black hole) */
  grille: '#2B3339'
};
const hex2rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgb2hex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
/* k in [-1,1]: negative darkens toward ink, positive lifts toward white */
function tone(hex, k) {
  const c = hex2rgb(hex);
  const t = k >= 0 ? [255, 255, 255] : hex2rgb(INK);
  const a = Math.min(1, Math.abs(k));
  return rgb2hex(c.map((v, i) => v + (t[i] - v) * a));
}

/* ── the car, as a 3D mesh ───────────────────────────────────────────────────
   X = length (nose +126, tail −126), Y = width (0 = centreline), Z = height
   (0 = ground). Numbers are the locked 2D silhouette re-expressed in 3D:
   length 252 · roof 122 · belt 96 · floor 46 · wheelbase 120 · tyre r 30.
   ────────────────────────────────────────────────────────────────────────── */
const P = {
  nose: 126, tail: -126,
  bodyFloor: 46, belt: 96, roof: 122,
  halfW: 50,          // body half-width (unspecified in 2D — set from real-car
  glassW: 46,         // width:length, so the orthographic view isn't narrow)
  screenBase: 73, roofFront: 52, roofRear: -50, glassBase: -64,
  wheelX: [-66, 54], wheelZ: 30, wheelR: 30,
  arch: [{ x: [-101, -31], top: 82 }, { x: [19, 89], top: 82 }]
};

/* dense side profile (XZ), closed, counter-clockwise, arches notched out of the
   floor so the wheels sit in real openings rather than in front of a panel */
function denseProfile() {
  const p = [];
  const push = (x, z) => p.push([x, z]);
  push(P.tail, P.bodyFloor);
  push(-112, P.bodyFloor);
  for (const a of P.arch) {                        // quarter-ellipse up and over
    const [x0, x1] = a.x, c = (x0 + x1) / 2, r = (x1 - x0) / 2;
    for (let i = 0; i <= 8; i++) {
      const t = (i / 8) * Math.PI;
      push(c + r * Math.cos(Math.PI - t), 0);
      p[p.length - 1][1] = P.bodyFloor + (a.top - P.bodyFloor) * Math.sin(t);
    }
    push(x1, P.bodyFloor);
  }
  push(120, P.bodyFloor);
  push(P.nose, 52);
  push(P.nose, 62);
  push(125, 80);
  push(122, 90);
  push(110, 95);
  /* along the belt, nose → tail (decreasing X: this is the direction the
     traversal runs, otherwise the outline zig-zags back on itself) */
  push(P.screenBase, P.belt);
  push(P.roofFront, P.belt);
  push(P.roofRear, P.belt);
  push(P.glassBase, P.belt);
  push(-104, P.belt);
  push(-118, 92);
  push(-124, 80);
  push(-126, 66);
  return p;
}

/* Douglas-Peucker on a closed loop: split at the extreme-X points, simplify
   each chain, rejoin. Nested tolerances give nested detail — the same car. */
function simplifyClosed(profile, tol) {
  let iA = 0, iB = 0;
  profile.forEach(([x], i) => { if (x < profile[iA][0]) iA = i; if (x > profile[iB][0]) iB = i; });
  const chain = (from, to) => {
    const out = []; let i = from;
    for (; ;) { out.push(profile[i]); if (i === to) break; i = (i + 1) % profile.length; }
    return out;
  };
  const dp = pts => {
    if (pts.length < 3) return pts;
    const a = pts[0], b = pts[pts.length - 1];
    const ab = [b[0] - a[0], b[1] - a[1]];
    const L = Math.hypot(ab[0], ab[1]) || 1;
    let worst = -1, wi = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const ap = [pts[i][0] - a[0], pts[i][1] - a[1]];
      const d = Math.abs(ap[0] * ab[1] - ap[1] * ab[0]) / L;
      if (d > worst) { worst = d; wi = i; }
    }
    if (worst <= tol) return [a, b];
    return dp(pts.slice(0, wi + 1)).slice(0, -1).concat(dp(pts.slice(wi)));
  };
  return dp(chain(iA, iB)).slice(0, -1).concat(dp(chain(iB, iA)).slice(0, -1));
}

/* directed Hausdorff distance: worst gap between a simplified outline and the
   dense one, in model units — i.e. exactly what simplification cost */
function outlineDeviation(dense, simple) {
  let worst = 0;
  for (const d of dense) {
    let best = Infinity;
    for (let i = 0; i < simple.length; i++) {
      const a = simple[i], b = simple[(i + 1) % simple.length];
      const ab = [b[0] - a[0], b[1] - a[1]];
      const ap = [d[0] - a[0], d[1] - a[1]];
      const L2 = ab[0] * ab[0] + ab[1] * ab[1] || 1;
      const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1]) / L2));
      best = Math.min(best, Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t));
    }
    worst = Math.max(worst, best);
  }
  return worst;
}

/* profile → copy scaled inward about its centre (this makes the chamfer edge) */
function insetProfile(profile, s) {
  const xs = profile.map(p => p[0]), zs = profile.map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  return profile.map(([x, z]) => [cx + (x - cx) * s, cz + (z - cz) * s]);
}

/* sweep a profile across rings [{y,s}] → skin quads + two side caps */
function sweep(profile, rings, opts) {
  const faces = [];
  const pts = rings.map(r => insetProfile(profile, r.s).map(([x, z]) => [x, r.y, z]));
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < profile.length; i++) {
      const j = (i + 1) % profile.length;
      faces.push({
        pts: [pts[r][i], pts[r + 1][i], pts[r + 1][j], pts[r][j]],
        mat: opts.mat, kind: opts.kind, band: r, edge: i, stroke: opts.stroke !== false
      });
    }
  }
  faces.push({ pts: pts[0], mat: opts.mat, kind: opts.kind, cap: 'near', stroke: opts.stroke !== false });
  faces.push({ pts: pts[rings.length - 1].slice().reverse(), mat: opts.mat, kind: opts.kind, cap: 'far', stroke: opts.stroke !== false });
  return faces;
}
/* ── parts ───────────────────────────────────────────────────────────────── */

/* greenhouse: 3 visible panels (screen · roof · rear glass) swept across rings,
   plus the two side-glass caps. Sunk to z=92 so its base hides inside the body
   (no hairline gap where the two solids meet). */
function greenhouse(rings, opts) {
  /* Base sits exactly on the belt. It used to be sunk 4 units into the body to
     avoid a seam — but sunk geometry is inside the body, and painter ordering
     then painted the glass over the body's side panel. At z = belt nothing is
     occluded by construction, and the body's chamfer strip covers the seam. */
  const prof = [[P.screenBase, P.belt], [P.roofFront, P.roof], [P.roofRear, P.roof], [P.glassBase, P.belt]];
  const mats = ['glass', 'roof', 'glass'];          // edge 0 windscreen · 1 roof · 2 rear glass
  const faces = [];
  const pts = rings.map(r => insetProfile(prof, r.s).map(([x, z]) => [x, r.y, z]));
  for (let r = 0; r < rings.length - 1; r++) {
    for (let e = 0; e < 3; e++) {
      const i = e, j = (e + 1) % 4;
      faces.push({
        pts: [pts[r][i], pts[r + 1][i], pts[r + 1][j], pts[r][j]],
        mat: mats[e], kind: 'body', part: 'greenhouse', stroke: opts.stroke !== false
      });
    }
  }
  faces.push({ pts: pts[0], mat: 'glass', kind: 'body', part: 'glass-near', stroke: opts.stroke !== false });
  faces.push({ pts: pts[rings.length - 1].slice().reverse(), mat: 'glass', kind: 'body', part: 'glass-far', stroke: opts.stroke !== false });
  if (opts.pillar) {                                // B-pillar on the side glass
    const x = 2, w = 7;
    for (const y of [-P.glassW - 0.4, P.glassW + 0.4]) {
      faces.push({
        pts: [[x, y, P.belt], [x, y, P.roof - 1.5], [x + w, y, P.roof - 1.5], [x + w, y, P.belt]],
        mat: 'body', kind: 'body', part: 'pillar', outward: [0, y < 0 ? -1 : 1, 0], stroke: opts.stroke !== false
      });
    }
  }
  return faces;
}

/* wheel: a flat disc in the XZ plane at the body's outer face — the low-poly
   convention the 2D design used, now sitting inside a real arch opening.
   segment count is the roundness knob (and the thing D inherits from C). */
function wheel(cx, cz, seg, hubSeg, opts) {
  const y = opts.y, R = P.wheelR, r = opts.hubR;
  const ring = (n, rad, y0) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      out.push([cx + rad * Math.cos(th), y0, cz + rad * Math.sin(th)]);
    }
    return out;
  };
  const faces = [];
  /* layer 2: the wheel is drawn after the body. That is safe by construction —
     the arch notch in the profile is wider than the tyre, so the disc can only
     ever cover the body where the body has a hole. */
  const push = f => faces.push({ ...f, layer: 2, kind: 'wheel' });
  push({ pts: ring(seg, R, y), mat: 'rubber', part: 'tyre', stroke: opts.stroke !== false });
  if (opts.sidewall) push({ pts: ring(seg, R * 0.78, y - opts.sidewall), mat: 'rubber2', part: 'sidewall', stroke: opts.stroke !== false });
  push({ pts: ring(hubSeg, r, y - (opts.sidewall || 0)), mat: 'alloy', part: 'hub', stroke: opts.stroke !== false });
  if (opts.bolt) push({ pts: ring(Math.max(6, hubSeg - 4), r * 0.34, y - (opts.sidewall || 0)), mat: 'alloy2', part: 'bolt', stroke: false });
  return faces;
}

/* the far-side wheel. A 3/4 view shows FOUR wheel positions, not two — the far
   pair is visible through the near arch tunnel and as a sliver below the far
   rocker, and their absence is exactly what makes a model read as a cut-out.
   Only the far wheel's *inner* face is ever on show (the hub cap is on the outer
   face, pointing away), so it is a single disc: no hub, no bolts. It is drawn
   BEFORE the body (layer -0.5) so the body occludes it everywhere except where
   the panel genuinely opens, and its normal is forced toward the near side —
   that is the face pointing at the camera. */
function farWheel(cx, cz, seg, opts) {
  const y = opts.y, R = P.wheelR, pts = [];
  for (let i = 0; i < seg; i++) {
    const th = (i / seg) * Math.PI * 2;
    pts.push([cx + R * Math.cos(th), y, cz + R * Math.sin(th)]);
  }
  return { pts, mat: 'rubber2', kind: 'wheel', part: 'tyre-far',
    outward: [0, -1, 0], layer: -0.5, stroke: opts.stroke !== false };
}

/* contact shadow on the ground plane: an ellipse, projected like everything
   else. Not a "face" — it carries no shape, so the facet metric ignores it. */
function shadowFace() {
  const n = 30, rx = 134, ry = 56, pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push([rx * Math.cos(t), ry * Math.sin(t), 1.5]);
  }
  return { pts, mat: 'shadow', kind: 'shadow', layer: -1, stroke: false, notFace: true };
}

/* ── photo renderer ──────────────────────────────────────────────────────────
   Same mesh, same camera — the difference is that the reference is *smooth*:
   gradient fills that read as sky and horizon reflected in paint, instead of
   one flat tone per face. This is the "before" image the app would receive. */
function photoScene(b) {
  const x = P2(b.x0 - 9), y = P2(b.y0 - 9), w = P2(b.w + 18), h = P2(b.h + 18);
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#gBack)" data-notface="1"/>` +
    `<ellipse cx="${P2(b.x0 + b.w * 0.5)}" cy="${P2(b.y0 + b.h * 0.30)}" rx="${P2(b.w * 0.62)}" ry="${P2(b.h * 0.55)}" fill="url(#gGlow)" data-notface="1"/>`;
}
function photoDefs(b) {
  const yb = b.y1 + 4, yt = b.y0 - 4;
  const v = t => P2(yb + (yt - yb) * t);
  return `<linearGradient id="gFlank" gradientUnits="userSpaceOnUse" x1="0" y1="${v(0)}" x2="0" y2="${v(1)}">` +
    `<stop offset="0" stop-color="#22384F"/><stop offset="0.13" stop-color="#3C5D80"/>` +
    `<stop offset="0.25" stop-color="#6E93B8"/><stop offset="0.33" stop-color="#DCE7F1"/>` +
    `<stop offset="0.41" stop-color="#8FB0D0"/><stop offset="0.63" stop-color="#A9C4DC"/>` +
    `<stop offset="1" stop-color="#CFDCE8"/></linearGradient>` +
    `<linearGradient id="gTop" gradientUnits="userSpaceOnUse" x1="0" y1="${v(0)}" x2="0" y2="${v(1)}">` +
    `<stop offset="0.3" stop-color="#8FB0D0"/><stop offset="0.46" stop-color="#A9C4DC"/>` +
    `<stop offset="0.7" stop-color="#DCE7F1"/><stop offset="1" stop-color="#EDF3F8"/></linearGradient>` +
    `<linearGradient id="gNose" gradientUnits="userSpaceOnUse" x1="0" y1="${v(0)}" x2="0" y2="${v(1)}">` +
    `<stop offset="0" stop-color="#31506F"/><stop offset="0.3" stop-color="#4A6FA5"/>` +
    `<stop offset="0.52" stop-color="#7FA3C6"/><stop offset="0.72" stop-color="#5B82AF"/>` +
    `<stop offset="1" stop-color="#8FB0D0"/></linearGradient>` +
    `<linearGradient id="gGlass" gradientUnits="userSpaceOnUse" x1="0" y1="${v(0)}" x2="0" y2="${v(1)}">` +
    `<stop offset="0" stop-color="#141E26"/><stop offset="0.3" stop-color="#22323F"/>` +
    `<stop offset="0.4" stop-color="#7FA3C6"/><stop offset="0.46" stop-color="#26384A"/>` +
    `<stop offset="0.78" stop-color="#3C5D80"/><stop offset="1" stop-color="#7FA3C6"/></linearGradient>` +
    `<linearGradient id="gTyre" gradientUnits="userSpaceOnUse" x1="0" y1="${v(0)}" x2="0" y2="${v(1)}">` +
    `<stop offset="0" stop-color="#191D20"/><stop offset="0.45" stop-color="#2E3438"/>` +
    `<stop offset="1" stop-color="#454C52"/></linearGradient>` +
    `<linearGradient id="gRim" gradientUnits="userSpaceOnUse" x1="0" y1="${v(0)}" x2="0" y2="${v(1)}">` +
    `<stop offset="0" stop-color="#7E6016"/><stop offset="0.3" stop-color="#D4AF37"/>` +
    `<stop offset="0.5" stop-color="#F7EBB4"/><stop offset="0.72" stop-color="#B08A24"/>` +
    `<stop offset="1" stop-color="#D4AF37"/></linearGradient>` +
    `<linearGradient id="gBack" gradientUnits="userSpaceOnUse" x1="0" y1="${P2(b.y0 - 9)}" x2="0" y2="${P2(b.y1 + 9)}">` +
    `<stop offset="0" stop-color="#EDF2F7"/><stop offset="0.42" stop-color="#DDE3E8"/>` +
    `<stop offset="0.62" stop-color="#C9CFD3"/><stop offset="1" stop-color="#B9BFC3"/></linearGradient>` +
    `<radialGradient id="gGlow" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.55"/>` +
    `<stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="gShade" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#1A1A1A" stop-opacity="0.44"/>` +
    `<stop offset="0.55" stop-color="#1A1A1A" stop-opacity="0.24"/><stop offset="1" stop-color="#1A1A1A" stop-opacity="0"/></radialGradient>` +
    `<filter id="grain" x="0" y="0" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" seed="7"/>` +
    `<feColorMatrix type="saturate" values="0"/></filter>`;
}
function photoFill(f) {
  if (f.mat === 'glass') return 'url(#gGlass)';
  if (f.mat === 'rubber' || f.mat === 'rubber2') return 'url(#gTyre)';
  if (f.mat === 'alloy' || f.mat === 'alloy2' || f.mat === 'steel') return 'url(#gRim)';
  if (f.mat === 'lamp') return shade('#FFD98A', f.n, 0.3);
  if (f.mat === 'grille') return shade('#2B3339', f.n, 0.12);
  const n = f.n;
  if (n[2] > 0.55) return 'url(#gTop)';                    // bonnet · roof · boot
  if (n[1] < -0.45) return 'url(#gFlank)';                 // the flank facing camera
  if (n[0] > 0.35) return 'url(#gNose)';                   // the front
  return shade(f.mat === 'roof' ? PAINTS.roof : PAINTS.body, n, 0.2);
}
/* ── the reference, in parts ─────────────────────────────────────────────────
   `scene` is the studio backdrop + glow, `car` is the object itself (contact
   shadow + body + specular + wheels) and `grain` is the film overlay. The
   fidelity page renders all three as one photo. The capture and comparator
   stages in index.html place only `car` over the camera feed / their own CSS
   backdrop, because a viewfinder shows the object, not a studio photo of it.
   Splitting the render (instead of drawing it twice) is what keeps the paint
   identical between the two pages. */
function photoParts(model, b) {
  const drawn = paint(model);
  const body = [], wheels = [];
  for (const f of drawn) {
    if (f.notFace) continue;
    (f.kind === 'wheel' ? wheels : body).push(poly(f, photoFill(f), '', 0));
  }
  const shadeEl = drawn.find(f => f.kind === 'shadow');
  /* highlight: the chamfer strip catches the sky — the specular that tells you
     the paint is glossy. Drawn as the strip itself, lightened, on the near side. */
  const spec = drawn.filter(f => f.band === 0 && f.kind === 'body' && f.n[2] > 0.25)
    .map(f => poly(f, '#FFFFFF', '', 0).replace('fill="#FFFFFF"', 'fill="#FFFFFF" fill-opacity="0.18"')).join('');
  return {
    scene: photoScene(b),
    car: (shadeEl ? poly(shadeEl, 'url(#gShade)', '', 0) : '') + body.join('') + spec + wheels.join(''),
    grain: `<rect x="${P2(b.x0 - 9)}" y="${P2(b.y0 - 9)}" width="${P2(b.w + 18)}" height="${P2(b.h + 18)}" filter="url(#grain)" opacity="0.05" data-notface="1"/>`
  };
}
function renderPhoto(model, b) {                 // the whole photo, as one string
  const p = photoParts(model, b);
  return p.scene + p.car + p.grain;
}

/* lights + grille: the cues that say "car" rather than "box". Kept at every
   fidelity level (identity, not detail) but with fewer parts as detail drops.
   They are decals on the nose surface, so they get their own layer: otherwise
   painter ordering buries the far-side lamp under the nose it sits on. */
function noseX(z) {                                 // the nose face's slight rake
  return z <= 62 ? P.nose : P.nose - (4 * (z - 62)) / 28;
}
function lamps(level) {
  const W = P.halfW;
  const faces = [];
  const decal = (pts, mat, part, n) => faces.push({
    pts: pts.map(([x, y, z]) => [noseX(z) + x, y, z]),
    mat, kind: 'lamps', part, outward: n, layer: 3, stroke: level.stroke > 0
  });
  for (const s of [-1, 1]) {                        // headlights flank the grille
    const y0 = s * W * 0.48, y1 = s * W * 0.96;
    decal([[0.7, y0, 72], [0.7, y1, 72], [0.7, y1, 86], [0.7, y0, 86]], 'lamp', 'lamp', [1, 0, 0.12]);
  }
  if (level.grille) {
    decal([[0.9, -22, 70], [0.9, 22, 70], [0.9, 22, 86], [0.9, -22, 86]], 'grille', 'grille', [1, 0, 0.12]);
    if (level.bars) {
      for (const z of [[74, 77.5], [79.5, 83]])
        decal([[1.4, -19, z[0]], [1.4, 19, z[0]], [1.4, 19, z[1]], [1.4, -19, z[1]]], 'steel', 'bar', [1, 0, 0.12]);
    }
  }
  return faces;
}

/* ── build one variant: same mesh, simplified to the level's tolerance ────── */
function buildModel(level, tag) {
  const dense = denseProfile();
  const prof = simplifyClosed(dense, level.tol);
  const faces = [];
  let seq = 0;
  const stamp = f => { f.seq = seq++; f.variant = tag; return f; };
  sweep(prof, level.rings, { mat: 'body', kind: 'body' }).forEach(f => faces.push(stamp(f)));
  greenhouse(level.ghRings, { ...level, stroke: level.stroke > 0 }).forEach(f => faces.push(stamp(f)));
  lamps(level).forEach(f => faces.push(stamp(f)));
  for (const cx of P.wheelX) {
    /* near side: discs sit 1.5 units inside the body's outer plane, so the arch
       lip is in front of the tyre — that recess is what makes the wheel look
       like it is in a wheel well rather than pasted on the side */
    wheel(cx, P.wheelZ, level.seg, level.hubSeg, {
      y: -(P.halfW - 1.5), hubR: level.hubR, stroke: level.stroke > 0,
      sidewall: level.sidewall || 0, bolt: level.bolt
    }).forEach(f => faces.push(stamp(f)));
    /* far side: the same wheel mirrored, behind the body (see farWheel) */
    faces.push(stamp(farWheel(cx, P.wheelZ, level.seg, {
      y: P.halfW - 1.5, stroke: level.stroke > 0
    })));
  }
  faces.push(stamp(shadowFace()));
  return { faces, profile: prof, deviation: outlineDeviation(dense, prof), level };
}

/* ── shading ─────────────────────────────────────────────────────────────── */
const HALF = unit(add(LIGHT, CAM));
function faceNormal(pts, forced) {
  const n = unit(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
  if (forced) { const f = unit(forced); return dot(n, f) < 0 ? scale(n, -1) : n; }
  return n;
}
function shade(mat, n, specAmt) {
  const lam = Math.max(0, dot(n, LIGHT));
  const spec = Math.pow(Math.max(0, dot(n, HALF)), 16) * (specAmt || 0);
  return tone(PAINTS[mat] || mat, (lam - 0.56) * 1.5 + spec);
}
const centroid = pts => scale(pts.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / pts.length);

/* orthographic pipeline: cull → sort (painter, farthest first) → emit */
function paint(model, opts) {
  const kept = [];
  for (const f of model.faces) {
    const n = faceNormal(f.pts, f.outward);
    if (dot(n, CAM) <= 0.0001) continue;             // back-facing
    const c = centroid(f.pts);
    /* depth is rounded before comparison: coplanar stack-ups (tyre → sidewall →
       hub → bolt, all in the same wheel plane) must fall through to the
       insertion order, not be decided by a 1e-14 float difference */
    kept.push({ ...f, n, c, depth: Math.round(depthOf(c) * 1000) / 1000, screen: f.pts.map(project) });
  }
  kept.sort((a, b) => ((a.layer || 0) - (b.layer || 0)) || (a.depth - b.depth) || (a.seq - b.seq));
  return kept;
}

const P2 = n => Math.round(n * 10) / 10;
function poly(f, fill, stroke, sw) {
  const pts = f.screen.map(([x, y]) => `${P2(x)},${P2(y)}`).join(' ');
  const s = (sw > 0 && f.stroke !== false && !f.noStroke)
    ? ` stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"` : '';
  /* carry the marker into the markup: the facet metric is defined on the SVG
     that is actually in the page, so "not a face" has to be visible there */
  const nf = f.notFace ? ' data-notface="1"' : '';
  return `<polygon points="${pts}" fill="${fill}"${s}${nf}/>`;
}

/* ── cartoon renderer: one flat fill per face, ink outline ───────────────── */
function renderCartoon(model) {
  const sw = model.level.stroke;
  const drawn = paint(model);
  const els = [];
  let pts = 0, shadow = '', wheelCount = 0;
  for (const f of drawn) {
    if (f.kind === 'shadow') {
      const sp = f.screen.map(([x, y]) => `${P2(x)},${P2(y)}`).join(' ');
      shadow = `<polygon points="${sp}" fill="${INK}" fill-opacity="0.15" data-notface="1"/>`;
      continue;
    }
    els.push(poly(f, shade(PAINTS[f.mat] || f.mat, f.n, model.level.specAmt ?? 0.16), INK, sw));
    pts += f.pts.length;
    if (f.kind === 'wheel') wheelCount++;
  }
  const bodyCount = els.length - wheelCount;
  return { markup: shadow + els.join(''), faces: els.length, body: bodyCount, wheel: wheelCount, pts };
}

/* ── build every variant ─────────────────────────────────────────────────── */
const VARIANTS = ['photo', 'A', 'B', 'C'];
function buildAll() {
  const models = {};
  for (const k of VARIANTS) models[k] = buildModel(LEVELS[k], k);
  /* D = B's body + C's wheels — the Session-5 pick, expressed in 3D: the same
     mesh as B, with only the wheel segment count raised to C's. */
  models.D = buildModel({
    ...LEVELS.B, seg: LEVELS.C.seg, hubSeg: LEVELS.C.hubSeg, hubR: LEVELS.C.hubR,
    sidewall: 0, bolt: false
  }, 'D');
  return models;
}
function boundsOf(models) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const m of Object.values(models)) {
    for (const f of m.faces) for (const p of f.pts) {
      const [x, y] = project(p);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

/* ── visual bench: write every variant stacked into one standalone SVG ───── */
function renderVariant(key, model, b) {
  return key === 'photo' ? renderPhoto(model, b) : renderCartoon(model).markup;
}
function writeBench(models, out) {
  const b = boundsOf(models);
  const pad = 12, H = b.h + pad * 2;
  const keys = Object.keys(models);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="900" viewBox="${b.x0 - pad} ${b.y0 - pad} ${b.w + pad * 2} ${H * keys.length}">`;
  s += `<defs>${photoDefs(b)}</defs>`;
  s += `<rect x="${b.x0 - pad}" y="${b.y0 - pad}" width="${b.w + pad * 2}" height="${H * keys.length}" fill="#F5F0E8"/>`;
  keys.forEach((k, i) => {
    const dy = H * i;
    s += `<g transform="translate(0,${Math.round(dy)})">${renderVariant(k, models[k], b)}</g>`;
    s += `<text x="${b.x0}" y="${b.y0 + 12 + dy}" font-family="Menlo,monospace" font-size="13" fill="#1A1A1A">${k} · ${models[k].profile.length} profile pts · dev ${models[k].deviation.toFixed(1)}</text>`;
  });
  s += '</svg>';
  fs.writeFileSync(out, s);
  return b;
}

/* ── write the generated block + shared viewBox into the page ────────────── */
const pageViewBox = b => [P2(b.x0 - 7), P2(b.y0 - 7), P2(b.w + 14), P2(b.h + 14)].join(' ');
/* projected wheel centres, published so a validator can tell body from wheel
   without trusting the generator's own bookkeeping */
/* projected wheel centres, published so a validator can tell body from wheel
   without trusting the generator's own bookkeeping. All four: the far pair is
   real geometry, and it has to be attributable to a wheel. */
function wheelCentres() {
  const ys = [-(P.halfW - 1.5), P.halfW - 1.5];
  return P.wheelX.map(cx => ys.map(y => project([cx, y, P.wheelZ]).map(v => P2(v)).join(','))).flat().join(' ');
}
function generatedBlock(models, b) {
  const wc = wheelCentres();
  const meta = (key, srcKey) => {
    const m = models[srcKey || key];
    return `data-variant="${key}" data-profile-pts="${m.profile.length}"` +
      ` data-dev="${m.deviation.toFixed(2)}" data-wheel-centres="${wc}"`;
  };
  const photo = photoParts(models.photo, b);
  const groups = [
    /* the object on its own — this is what index.html composites over the camera
       feed and over the comparator's CSS backdrop */
    `    <g id="carPhotoCar" ${meta('photo-car', 'photo')} data-cutout="1">${photo.car}</g>`,
    /* the whole photo. It draws the car through <use> rather than re-emitting
       it, so "the photo is the same object" is structural, not a coincidence */
    `    <g id="carPhoto" ${meta('photo')}>${photo.scene}<use href="#carPhotoCar"/>${photo.grain}</g>`
  ];
  for (const k of ['A', 'B', 'C', 'D'])
    groups.push(`    <g id="car${k}" ${meta(k)}>${renderVariant(k, models[k], b)}</g>`);
  return `<svg width="0" height="0" style="position:absolute; overflow:hidden" aria-hidden="true" focusable="false">
  <defs>
    ${photoDefs(b)}
${groups.join('\n')}
  </defs>
</svg>`;
}
const wrappedBlock = (models, b) =>
  /* the marker closes on purpose: an unterminated "<!--" swallows the whole
     block, the <use> references then resolve to nothing and every stage renders
     empty — while all the static assertions still pass */
  `${BEGIN} — shapes come from tools/gen-car-3d.js; edit the generator, not this block -->\n` +
  `${generatedBlock(models, b)}\n${END}`;

/* fidelity-test.html: the block, then every car stage's viewBox from the bounds */
function buildFidelity(models, b) {
  let html = fs.readFileSync(PAGE, 'utf8');
  const vb = pageViewBox(b);
  const wrapped = wrappedBlock(models, b);
  if (html.includes(BEGIN)) {
    html = html.slice(0, html.indexOf(BEGIN)) + wrapped + html.slice(html.indexOf(END) + END.length);
  } else {
    const s = html.indexOf('<!-- ═══════════ geometry library');
    const e = html.indexOf('</svg>', s) + '</svg>'.length;
    if (s < 0 || e < 6) throw new Error('cannot find the geometry library block in ' + PAGE);
    html = html.slice(0, s) + wrapped + html.slice(e);
  }
  const cut = html.indexOf(END) + END.length;
  return html.slice(0, cut) + html.slice(cut).replace(/viewBox="[^"]*"/g, `viewBox="${vb}"`);
}

/* index.html: the same block, then each car stage's viewBox AND its <use>
   target. The stage SVGs are the page author's hooks (id, role, aria-label,
   sizing) — the artwork inside them is not hand-editable, by construction:
   whatever sits between the tags is replaced by a single <use>. The page also
   carries shrine, flame and throw-guide SVGs, so we only touch tags that are
   explicitly marked data-car-stage. */
function buildIndex(models, b) {
  let html = fs.readFileSync(INDEX, 'utf8');
  const vb = pageViewBox(b);
  if (!html.includes(BEGIN) || !html.includes(END))
    throw new Error('no <!-- BEGIN GENERATED CARS --> placeholder in ' + INDEX);
  html = html.slice(0, html.indexOf(BEGIN)) + wrappedBlock(models, b)
    + html.slice(html.indexOf(END) + END.length);
  const cut = html.indexOf(END) + END.length;
  const seen = [];
  /* a stage may zoom out about the shared viewBox's centre (see STAGES.zoom) */
  const viewBoxFor = key => {
    const z = STAGES[key].zoom || 1;
    if (z === 1) return vb;
    const [x, y, w, h] = vb.split(' ').map(Number);
    return [x + w * (1 - z) / 2, y + h * (1 - z) / 2, w * z, h * z].map(P2).join(' ');
  };
  const tail = html.slice(cut).replace(
    /<svg\b([^>]*)data-car-stage="([\w-]+)"([^>]*)>[\s\S]*?<\/svg>/g,
    (all, pre, key, post) => {
      const stage = STAGES[key];
      if (!stage) throw new Error(`unknown car stage "${key}" in index.html — expected: ${Object.keys(STAGES).join(' · ')}`);
      seen.push(key);
      const stageVb = viewBoxFor(key);
      let tag = `<svg${pre}data-car-stage="${key}"${post}>`;
      tag = /viewBox="/.test(tag)
        ? tag.replace(/viewBox="[^"]*"/, `viewBox="${stageVb}"`)          // keep it in place
        : tag.replace(/^<svg/, `<svg viewBox="${stageVb}"`);              // or add it
      return `${tag}<use href="#${stage.href}"/></svg>`;
    });
  const missing = Object.keys(STAGES).filter(k => !seen.includes(k));
  if (missing.length) throw new Error('car stage(s) missing from index.html: ' + missing.join(', '));
  return html.slice(0, cut) + tail;
}

/* write (or verify) both pages from one set of models */
function writePage(models, b) {
  const pages = [
    { file: PAGE, html: buildFidelity(models, b) },
    { file: INDEX, html: buildIndex(models, b) }
  ];
  let stale = 0;
  for (const p of pages) {
    const name = path.relative(path.join(__dirname, '..'), p.file);
    const committed = fs.readFileSync(p.file, 'utf8');
    if (committed === p.html) { console.log('  = ' + name + ' up to date'); continue; }
    if (CHECK) { console.error('  ✗ ' + name + ' is stale — run: node prototype/tools/gen-car-3d.js'); stale++; continue; }
    fs.writeFileSync(p.file, p.html);
    console.log('  → wrote ' + name);
  }
  if (stale) process.exit(1);
  if (CHECK) console.log('✓ both pages match the generator');
}

function main() {
  const models = buildAll();
  const b = boundsOf(models);
  console.log('projected bounds:', b.x0.toFixed(1), b.y0.toFixed(1), b.w.toFixed(1), b.h.toFixed(1));
  console.log('viewBox="' + [P2(b.x0 - 6), P2(b.y0 - 6), P2(b.w + 12), P2(b.h + 12)].join(' ') + '"');
  for (const k of Object.keys(models)) {
    const m = models[k], r = renderCartoon(m);
    console.log('  ' + k.padEnd(5) + ' profile ' + String(m.profile.length).padStart(3) + ' pts · dev ' +
      m.deviation.toFixed(2).padStart(5) + ' · faces ' + String(r.faces).padStart(3) +
      ' (body ' + String(r.body).padStart(3) + ' / wheel ' + r.wheel + ') · verts ' + r.pts);
  }
  if (process.argv.includes('--bench')) {
    const out = '/tmp/car-bench.svg';
    writeBench(models, out);
    console.log('bench →', out);
  }
  writePage(models, b);
  return models;
}


const W = P.halfW, G = P.glassW;
const LEVELS = {
  photo: {
    tol: 0.55, stroke: 0, seg: 24, hubSeg: 16, hubR: 13.5, sidewall: 1.6, bolt: true, pillar: true,
    grille: true, bars: true,
    rings: [{ y: -W, s: 1 }, { y: -W + 2.5, s: 0.975 }, { y: -30, s: 0.99 }, { y: 30, s: 0.99 }, { y: W - 2.5, s: 0.975 }, { y: W, s: 1 }],
    ghRings: [{ y: -G, s: 1 }, { y: -G + 4, s: 0.965 }, { y: G - 4, s: 0.965 }, { y: G, s: 1 }]
  },
  A: {
    tol: 1.1, stroke: 2.5, seg: 12, hubSeg: 8, hubR: 12, bolt: true, pillar: true, grille: true, bars: true,
    rings: [{ y: -W, s: 1 }, { y: -W + 3.4, s: 0.955 }, { y: W - 3.4, s: 0.955 }, { y: W, s: 1 }],
    ghRings: [{ y: -G, s: 1 }, { y: -G + 4.5, s: 0.94 }, { y: G - 4.5, s: 0.94 }, { y: G, s: 1 }]
  },
  B: {
    tol: 3.1, stroke: 4, seg: 8, hubSeg: 6, hubR: 12, bolt: false, pillar: true, grille: true, bars: false,
    rings: [{ y: -W, s: 1 }, { y: -W + 3.4, s: 0.955 }, { y: W - 3.4, s: 0.955 }, { y: W, s: 1 }],
    ghRings: [{ y: -G, s: 1 }, { y: G, s: 1 }]
  },
  C: {
    tol: 7.4, stroke: 7, seg: 16, hubSeg: 12, hubR: 12, bolt: false, pillar: false, grille: false, bars: false,
    rings: [{ y: -W, s: 1 }, { y: W, s: 1 }],
    ghRings: [{ y: -G, s: 1 }, { y: G, s: 1 }]
  }
};

if (require.main === module) main();
module.exports = { buildAll, boundsOf, writeBench, renderCartoon, photoParts, renderPhoto, generatedBlock,
  denseProfile, simplifyClosed, outlineDeviation, pageViewBox, wheelCentres, LEVELS, STAGES, P, project, paint, shade };

