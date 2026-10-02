/* ═══════════════════════════════════════════════════════════
   JOSS PAPER AR · Prototype interactions (v2 · Session 4)
   Exploratory mockup — NOT production code
   v2: car offering, ancestral-tablet altar, toss that lands in the fire
   ═══════════════════════════════════════════════════════════ */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const SCREEN_ORDER = ['home', 'capture', 'transform', 'burn', 'reward', 'league'];
const state = { current: 'home', transformPlayed: false, burnArmed: true, raf: 0, flyRaf: 0,
  points: 0, league: [], throws: 0, ancestors: [], sheetOpen: false, lastThrow: null };
/* what a throw earns lives with the throw itself — see AIM_TIERS in ④ Burn */

/* ── Screen navigation ─────────────────────────────────────── */
function go(id) {
  const next = $('#screen-' + id);
  if (!next || id === state.current) return;
  $$('.screen').forEach(s => s.classList.toggle('is-active', s === next));
  state.current = id;
  $$('.jump button').forEach(b => b.classList.toggle('is-current', b.dataset.goto === id));
  if (onEnter[id]) onEnter[id]();
}

const onEnter = {
  transform() { if (!state.transformPlayed) playTransform(); },
  burn()      { resetBurn(); },
  reward()    { startReward(); },
  league()    { renderLeague(); },
  capture()   { $('#shutterFlash').classList.remove('is-flashing'); }
};

/* ── Toast ─────────────────────────────────────────────────── */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-shown');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-shown'), 2300);
}
/* ── ③ Transform: before/after slider + reveal sequence ────── */
function setSlider(pct) {
  $('#compare').style.setProperty('--split', pct + '%');
}
function playTransform() {
  const overlay = $('#transformOverlay');
  state.transformPlayed = true;
  overlay.classList.add('is-playing');
  $('#compare').classList.remove('is-revealed');
  setSlider(94);
  setTimeout(() => {
    overlay.classList.remove('is-playing');
    $('#compare').classList.add('is-revealed');
    requestAnimationFrame(() => setSlider(50));
  }, 2300);
}
function initCompare() {
  const wrap = $('#compare');
  let dragging = false;
  const fromX = x => {
    const r = wrap.getBoundingClientRect();
    return Math.max(4, Math.min(96, (x - r.left) / r.width * 100));
  };
  wrap.addEventListener('pointerdown', e => {
    dragging = true;
    wrap.classList.add('is-dragging');
    wrap.setPointerCapture(e.pointerId);
    setSlider(fromX(e.clientX));
  });
  wrap.addEventListener('pointermove', e => { if (dragging) setSlider(fromX(e.clientX)); });
  const end = () => { dragging = false; wrap.classList.remove('is-dragging'); };
  wrap.addEventListener('pointerup', end);
  wrap.addEventListener('pointercancel', end);
}

/* ── ④ Burn: aim the offering — the fire grades where it lands ────────────────
   A throw is a flick, and its sideways travel IS the aim: the landing point
   follows the finger one-to-one, so the dotted guide, the live chip and the
   flight all say the same thing. What a throw is worth is decided by where it
   crosses the fire's mouth line — the line the guide's tip points at:

     正中 Bullseye ×2.0   inside the flame's heart
     虔誠 Devout   ×1.5   inside the flame
     擦邊 Graze    ×1.0   on the coals at the pit's edge
     偏失 Miss     ×0     outside the pit. An offering that lands in the dirt is
                          not burned: nothing is banked, and it comes back to the
                          hand so the throw can be made again.

   Those bands are not invented here: initAim() measures them off the fire's own
   artwork at that line (the inner flame's half-width, the outer flame's, and the
   ember bed's), so the target cannot drift away from the fire it is drawn on.
   The validator re-runs the same scanline over the polygons in index.html, and
   the render probe makes four throws and reads back what each one earned. */
const AIM_REACH = 150;                    // how far a flick may aim past the pit's edge
const BASE_VALUE = 400;                   // the reward screen's first row…
const GROUND_BONUS = 2.0;                 // …its new-ground multiplier…
const STREAK_BONUS = 50;                  // …and the flat streak of the day
const AIM_TIERS = [
  { key: 'bullseye', zh: '正中', en: 'Bullseye', mult: 2.0, of: "the flame's heart" },
  { key: 'devout',   zh: '虔誠', en: 'Devout',   mult: 1.5, of: 'inside the flame' },
  { key: 'graze',    zh: '擦邊', en: 'Graze',    mult: 1.0, of: "the coals at the pit's edge" },
  { key: 'miss',     zh: '偏失', en: 'Miss',     mult: 0,   of: 'the dirt beside the pit' }
];
let AIM = null;                           // the target, measured from the fire (initAim)
let drag = null;
let burnTimers = [];
const clearBurnTimers = () => { burnTimers.forEach(clearTimeout); burnTimers = []; };
const gradeLabel = tier => `${tier.zh} ${tier.en} ×${tier.mult ? tier.mult.toFixed(1) : 0}`;
const aimAwardOf = tier => tier.mult ? Math.round(BASE_VALUE * tier.mult * GROUND_BONUS + STREAK_BONUS) : 0;
/* what one devout throw is worth — the example the reward markup is authored with */
const REWARD_EXAMPLE = { tier: AIM_TIERS[1], award: aimAwardOf(AIM_TIERS[1]) };

/* the polygon the file actually draws, as [x, y] pairs: every band below is read off
   the artwork, never stated here */
const polyPoints = poly => poly.getAttribute('points').trim().split(/\s+/).map(p => p.split(',').map(Number));
/* how far the fire's own outline reaches sideways at a height: a scanline run over
   that polygon, in the flame's own units */
function halfWidthAt(pts, y) {
  const mid = (Math.min(...pts.map(p => p[0])) + Math.max(...pts.map(p => p[0]))) / 2;
  let half = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
      const x = a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]);
      half = Math.max(half, Math.abs(x - mid));
    }
  }
  return half;
}
const outlineHalfWidth = (poly, y) => halfWidthAt(polyPoints(poly), y);
/* the mouth line — where an offering sinks into the fire — is a line of the fire's own
   artwork: the height at which the outer flame is widest. It has to be found rather
   than assumed, because the flame's sides taper to a point at both ends: measured at
   the bottom of the drawing (where a "mouth" sounds like it should be) the outline has
   no width at all, and every band cut there would be zero. So the scanline is walked
   over the polygon's full height and the widest one wins. The answer comes back in the
   flame's own units, which is what makes it independent of the layout. */
function widestLine(poly) {
  const pts = polyPoints(poly);
  const ys = pts.map(p => p[1]);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  let best = { y: y0, half: 0 };
  for (let i = 0; i <= 400; i++) {
    const y = y0 + (y1 - y0) * i / 400, half = halfWidthAt(pts, y);
    if (half > best.half) best = { y, half };
  }
  return best;
}
/* The guide's tip is authored pointing at that mouth line (index.html), and the point
   it points with is the lowest corner of its little triangle. Read from the markup,
   never measured: a measurement taken after a throw would read back wherever the throw
   had left the tip, and every re-measure would inherit it. */
function authoredTip() {
  const low = polyPoints($('#throwGuide .guide-tip')).reduce((l, p) => (p[1] > l[1] ? p : l));
  return { x: low[0], y: low[1] };
}
function initAim() {
  const screen = $('#screen-burn'), flame = $('#burnFlame'), bed = $('.ember-bed'),
        obj = $('#burnObject');
  const svg = flame && flame.querySelector('svg');
  if (!screen || !svg || !bed || !obj) return;
  /* Two spaces meet on this screen: the burn screen's own CSS pixels (the phone's
     10px border taken off, and scaled to fit the window) and the 390×844 user units
     the guide and the sight are drawn in (their viewBox is stretched flat over the
     screen — preserveAspectRatio="none"). Every number below is converted into the
     SVG's units, so the geometry the throw is graded on and the line it flies are
     one coordinate system; only the offering's own transform is CSS pixels. */
  /* Measure the screen as it stands when it is ACTIVE. An inactive .screen sits at
     scale(.985) translateY(14px) — and this runs before the deep link has switched
     the class — so the target would be measured from an off-screen pose. */
  const keepT = screen.style.transform, keepTr = screen.style.transition;
  screen.style.transition = 'none';
  screen.style.transform = 'none';
  const sc = screen.getBoundingClientRect();
  const ux = 390 / sc.width, uy = 844 / sc.height;          // CSS px → SVG user units
  const css = box => ({
    l: box.left - sc.left, t: box.top - sc.top, w: box.width, h: box.height,
    cx: box.left + box.width / 2 - sc.left, cy: box.top + box.height / 2 - sc.top
  });
  /* the flame breathes (a scale on .fire), so measure it paused too — otherwise the
     target would shift with the phase of an animation */
  const keepAnim = flame.style.animation;
  flame.style.animation = 'none';
  const F = css(svg.getBoundingClientRect()), B = css(bed.getBoundingClientRect()),
        O = css(obj.getBoundingClientRect());
  flame.style.animation = keepAnim;
  screen.style.transform = keepT;
  screen.style.transition = keepTr;
  /* The mouth line is read off the fire's own artwork (widestLine) and lives in the
     flame's own units, so all that is left is to put it on the screen: the flame's box
     and the screen's box are both in CSS pixels, so the line is its top plus the line
     down the artwork, and uy carries the pair into the guide's units — once. */
  const sx = F.w / 200, sy = F.h / 240;                     // the flame's units → CSS px
  const mouth = widestLine(svg.querySelector('.flame-outer'));
  AIM = {
    cx: F.cx * ux,                                          // the fire's centre line
    mouthY: (F.t + mouth.y * sy) * uy,                       // the line the guide says it lands on
    heart: outlineHalfWidth(svg.querySelector('.flame-inner'), mouth.y) * sx * ux,
    flame: mouth.half * sx * ux,
    pit: (B.w / 2) * ux,                                    // the ember bed is the pit's mouth
    heldX: O.cx * ux,                                       // where the offering is held —
    heldY: O.cy * uy,                                       // the origin every throw starts from
    ashY: (B.t + B.h / 2) * uy,                             // where a graze comes to rest
    dirtY: (B.t + B.h) * uy + 10,                           // …and where a miss does
    apexY: (F.t - O.h / 2) * uy,                            // the arc clears the flame by half the offering
    ux, uy, cssX: 1 / ux, cssY: 1 / uy                      // and back again, for the offering's own transform
  };
  AIM.bands = [
    { ...AIM_TIERS[0], max: AIM.heart },
    { ...AIM_TIERS[1], max: AIM.flame },
    { ...AIM_TIERS[2], max: AIM.pit },
    { ...AIM_TIERS[3], max: Infinity }
  ];
  AIM.tip = authoredTip();                                  // the tip as authored — where drawGuide moves it from
  drawAimSight();
  renderAimLadder();
}
/* The target is drawn on a screen that changes size — styles.css scales the whole phone
   down on short windows — so it has to be measured again whenever the frame it is
   measured in changes. Deferred to `load`, because the first measurement can land
   before the layout has settled; skipped while an offering is in the air, since a throw
   is committed the moment it leaves the hand and a new target would bend its flight. */
function remeasureAim() {
  if (state.current === 'burn' && !state.burnArmed) return;
  initAim();
  if (state.current === 'burn') resetBurn();                // re-arms the throw on the new sight
}
window.addEventListener('load', remeasureAim);
window.addEventListener('resize', remeasureAim);
const aimTierFor = offset => AIM.bands.find(b => Math.abs(offset) <= b.max);
const aimOf = dx => Math.max(-AIM_REACH, Math.min(AIM_REACH, dx));
const restPose = () => ({ x: AIM.heldX, y: AIM.heldY });
/* where a throw comes to rest: the flame takes a good one where the tip points,
   a graze drops onto the coals, a miss falls in the dirt beside the pit */
function landingPoint(tier, offset) {
  const x = AIM.cx + offset;
  return tier.key === 'miss' ? { x, y: AIM.dirtY }
    : tier.key === 'graze' ? { x, y: AIM.ashY }
    : { x, y: AIM.mouthY };
}
/* a real parabola through the two ends, peaking clear of the flame — x linear in
   time, y quadratic, which is exactly what a Quadratic Bezier draws when its
   control point sits halfway across */
const controlPoint = (from, to) => ({ x: (from.x + to.x) / 2, y: 2 * AIM.apexY - (from.y + to.y) / 2 });

/* the target itself: a dashed line across the pit's mouth with a tick at each band
   the fire's own outline draws — the flame's edge is ×1.5, its heart is ×2.0 */
function drawAimSight() {
  const svg = $('#aimSight');
  if (!svg || !AIM) return;
  const NS = 'http://www.w3.org/2000/svg';
  const line = (cls, x, half) => {
    const n = document.createElementNS(NS, 'line');
    n.setAttribute('class', cls);
    n.setAttribute('x1', x); n.setAttribute('y1', AIM.mouthY - half);
    n.setAttribute('x2', x); n.setAttribute('y2', AIM.mouthY + half);
    return n;
  };
  const mouth = document.createElementNS(NS, 'line');
  mouth.setAttribute('class', 'sight-line');
  mouth.setAttribute('x1', AIM.cx - AIM.pit); mouth.setAttribute('y1', AIM.mouthY);
  mouth.setAttribute('x2', AIM.cx + AIM.pit); mouth.setAttribute('y2', AIM.mouthY);
  svg.replaceChildren(mouth,
    line('sight-tick', AIM.cx - AIM.pit, 15), line('sight-tick', AIM.cx + AIM.pit, 15),
    line('sight-tick', AIM.cx - AIM.flame, 11), line('sight-tick', AIM.cx + AIM.flame, 11),
    line('sight-tick is-heart', AIM.cx - AIM.heart, 7), line('sight-tick is-heart', AIM.cx + AIM.heart, 7));
}
function renderAimLadder() {
  const el = $('#aimLadder');
  if (!el || !AIM) return;
  el.innerHTML = "Aim for the fire's heart · 對準火心 — " +
    AIM.bands.map(b => `<b>${b.zh} ×${b.mult ? b.mult.toFixed(1) : 0}</b>`).join(' · ');
}
/* the dotted line IS the flight: drawn from the same parabola the offering flies,
   so it cannot land anywhere but where the line said it would */
function drawGuide(from, to) {
  const path = $('#throwGuide .guide-path'), tip = $('#throwGuide .guide-tip');
  if (!path || !tip) return;
  const c = controlPoint(from, to);
  const r = n => n.toFixed(1);
  path.setAttribute('d', `M${r(from.x)},${r(from.y)} Q${r(c.x)},${r(c.y)} ${r(to.x)},${r(to.y)}`);
  tip.setAttribute('transform', `translate(${r(to.x - AIM.tip.x)},${r(to.y - AIM.tip.y)})`);   // the tip is authored pointing at AIM.tip
}
/* live, while a finger is down: the guide follows the flick, and the chip names
   the grade the throw is currently pointed at */
function previewAim(dx, dy) {
  if (!AIM) return;
  const offset = aimOf(dx);
  const tier = aimTierFor(offset);
  drawGuide({ x: AIM.heldX + dx * .35, y: AIM.heldY + dy * .55 }, landingPoint(tier, offset));
  const chip = $('#aimLive');
  if (chip) {
    chip.hidden = false;
    chip.dataset.tier = tier.key;
    chip.textContent = `Aim · ${gradeLabel(tier)}${tier.key === 'miss' ? ' — 未入火中' : ''}`;
  }
}
const hideAimLive = () => { const c = $('#aimLive'); if (c) c.hidden = true; };
const previewEnd = () => {
  hideAimLive();
  if (AIM && state.burnArmed) drawGuide(restPose(), landingPoint(AIM.bands[0], 0));
};

/* the offering flies the guide's own curve, sampled a frame at a time */
function flyOffering(tier, offset, from, onArrive) {
  const obj = $('#burnObject');
  const to = landingPoint(tier, offset);
  const c = controlPoint(from, to);
  const dur = tier.key === 'miss' ? 780 : tier.key === 'graze' ? 700 : 620;
  const t0 = performance.now();
  obj.classList.remove('is-dragging');
  obj.classList.add('is-flying');
  const frame = now => {
    const p = Math.min(1, (now - t0) / dur);
    const q = 1 - p;
    const x = q * q * from.x + 2 * q * p * c.x + p * p * to.x;
    const y = q * q * from.y + 2 * q * p * c.y + p * p * to.y;
    const scale = 1 - 0.42 * p;                                 // it is further from the hand
    const tilt = -20 * p + (p > .82 ? (p - .82) * 130 : 0);      // a tumble, then it rights itself
    obj.style.transform = `translate(${((x - AIM.heldX) * AIM.cssX).toFixed(1)}px,${((y - AIM.heldY) * AIM.cssY).toFixed(1)}px)`
      + ` translate(-50%,0) scale(${scale.toFixed(3)}) rotate(${tilt.toFixed(1)}deg)`;
    if (p < 1) { state.flyRaf = requestAnimationFrame(frame); return; }
    state.flyRaf = 0;
    onArrive();
  };
  state.flyRaf = requestAnimationFrame(frame);
}

/* one throw. The aim comes in from the flick, the grade and the points are decided
   here, and the fire's answer is written into the DOM the moment the offering
   leaves the hand — the flare waits for it on the CSS clock — so what a throw
   earned is inspectable instead of inferred from the animation. */
function throwOffering(offset, from) {
  if (!state.burnArmed || !AIM) return;
  const aim = aimOf(offset || 0);
  const tier = aimTierFor(aim);
  const award = aimAwardOf(tier);
  state.burnArmed = false;
  state.lastThrow = { offset: aim, tier, award };
  clearBurnTimers();
  hideAimLive();
  $('#swipeHint').classList.add('is-hidden');
  const takes = tier.key === 'bullseye' || tier.key === 'devout';
  $('#burnFlame').classList.toggle('is-flaring', takes);
  $('#burnFlame').classList.toggle('is-smoldering', tier.key === 'graze');
  $('#burnGlow').classList.toggle('is-flaring', takes);
  const obj = $('#burnObject');
  obj.dataset.tier = tier.key;
  $('#scoreValue').textContent = award ? '+' + award.toLocaleString() : '+0';
  $('#scoreGrade').textContent = `${gradeLabel(tier)} · ${tier.key === 'miss' ? '未入火中' : '入火'}`;
  $('#scorePopup').classList.toggle('is-miss', tier.key === 'miss');
  flyOffering(tier, aim, from || restPose(), () => landOffering(tier, award));
}
function landOffering(tier, award) {
  $('#scorePopup').classList.add('is-shown');
  if (tier.key === 'miss') {
    toast('偏失 · the offering fell outside the fire · 未入火中，再拋一次');
    burnTimers.push(setTimeout(returnToHand, 700));
    return;
  }
  /* the flame takes it, or the coals leave it charring */
  $('#burnObject').classList.add(tier.key === 'graze' ? 'is-charring' : 'is-consumed');
  $('#throwGuide').classList.add('is-hidden');
  burnTimers.push(setTimeout(awardTribute, 240));            // the score is real: it lands here
  burnTimers.push(setTimeout(() => go('reward'), 1500));
}
/* a missed offering was not burned, so it is still yours: it glides back to the
   hand and the throw is armed again — the ritual simply isn't finished yet */
function returnToHand() {
  const obj = $('#burnObject');
  if (!obj) return;
  obj.classList.remove('is-flying');
  obj.classList.add('is-returning');
  obj.style.transform = '';
  burnTimers.push(setTimeout(() => {
    obj.classList.remove('is-returning');
    delete obj.dataset.tier;
    state.lastThrow = null;
    state.burnArmed = true;
    drawGuide(restPose(), landingPoint(AIM.bands[0], 0));      // the throw that lands in the heart, back again
    $('#swipeHint').classList.remove('is-hidden');
    $('#scorePopup').classList.remove('is-shown', 'is-miss');
  }, 620));
}
function resetBurn() {
  const obj = $('#burnObject');
  clearBurnTimers();
  if (state.flyRaf) { cancelAnimationFrame(state.flyRaf); state.flyRaf = 0; }
  state.burnArmed = true;
  state.lastThrow = null;
  drag = null;
  obj.classList.remove('is-flying', 'is-dragging', 'is-returning', 'is-consumed', 'is-charring');
  delete obj.dataset.tier;
  obj.style.transform = '';
  hideAimLive();
  $('#swipeHint').classList.remove('is-hidden');
  $('#throwGuide').classList.remove('is-hidden');
  $('#burnFlame').classList.remove('is-flaring', 'is-smoldering');
  $('#burnGlow').classList.remove('is-flaring');
  $('#scorePopup').classList.remove('is-shown', 'is-miss');
  if (AIM) drawGuide(restPose(), landingPoint(AIM.bands[0], 0));
}
function initBurn() {
  const obj = $('#burnObject');
  obj.addEventListener('pointerdown', e => {
    if (!state.burnArmed) return;
    drag = { x: e.clientX, y: e.clientY };
    obj.setPointerCapture(e.pointerId);
    obj.classList.add('is-dragging');
    previewAim(0, 0);
  });
  obj.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    obj.style.transform = `translate(calc(-50% + ${(dx * .35).toFixed(1)}px), ${(dy * .55).toFixed(1)}px)`;
    previewAim(dx * AIM.ux, dy * AIM.uy);
  });
  const end = e => {
    if (!drag) return;
    const dx = (e.clientX - drag.x) * AIM.ux, dy = (e.clientY - drag.y) * AIM.uy;   // into the guide's own units
    const from = { x: AIM.heldX + dx * .35, y: AIM.heldY + dy * .55 };
    drag = null;
    obj.classList.remove('is-dragging');
    obj.style.transform = '';
    if (dy < -70) throwOffering(aimOf(dx), from);
    else previewEnd();
  };
  obj.addEventListener('pointerup', end);
  obj.addEventListener('pointercancel', () => {
    drag = null;
    obj.classList.remove('is-dragging');
    obj.style.transform = '';
    previewEnd();
  });
  /* the hint line is the accessible path to the same throw: a tap (or Enter/Space)
     sends the offering along the throw that lands in the heart */
  $('#swipeHint').addEventListener('click', () => { if (state.burnArmed) throwOffering(0, restPose()); });
}

/* ── ⑤ Reward: what this throw actually earned ───────────────
   Every row is rewritten from the throw that landed — the base, the aim it was
   graded at, the new-ground bonus and the streak — and the hero counts up to the
   same total awardTribute() banks and the league re-ranks on. The numbers in the
   markup are the devout example, so the page is honest before any JS runs. */
function startReward() {
  const el = $('#rewardPoints');
  const t = state.lastThrow && state.lastThrow.award ? state.lastThrow : REWARD_EXAMPLE;
  const tier = t.tier, target = t.award;
  const aimValue = Math.round(BASE_VALUE * tier.mult);
  const card = $('#rewardCard');
  const set = (key, value) => {
    const b = card && card.querySelector(`[data-key="${key}"] b`);
    if (b) b.textContent = value;
  };
  set('base', BASE_VALUE.toLocaleString());
  set('aim', aimValue.toLocaleString());
  set('ground', Math.round(aimValue * GROUND_BONUS).toLocaleString());
  set('streak', '+' + STREAK_BONUS);
  set('total', target.toLocaleString());
  const aimRow = card && card.querySelector('[data-key="aim"] span');
  if (aimRow) aimRow.textContent = `Aim — ${gradeLabel(tier)}`;
  const badge = $('#rewardAim');
  if (badge) badge.textContent = `🎯 ${gradeLabel(tier)} · ${tier.of}`;
  cancelAnimationFrame(state.raf);
  const rows = $$('#screen-reward .reward-row, #screen-reward .reward-total');
  rows.forEach(r => r.classList.remove('is-shown'));
  el.textContent = '0';
  const t0 = performance.now(), dur = 1150;
  const tick = now => {
    const p = Math.max(0, Math.min(1, (now - t0) / dur));
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased).toLocaleString();
    if (p < 1) state.raf = requestAnimationFrame(tick);
    else rows.forEach(r => setTimeout(() => r.classList.add('is-shown'), 150 + (+r.dataset.delay) * 190));
  };
  state.raf = requestAnimationFrame(tick);
}

/* ── ② Capture wiring ──────────────────────────────────────── */
function initCapture() {
  $('#shutterBtn').addEventListener('click', () => {
    const f = $('#shutterFlash');
    f.classList.add('is-flashing');
    setTimeout(() => go('transform'), 330);
    setTimeout(() => f.classList.remove('is-flashing'), 750);
  });
  $('#btnFlash').addEventListener('click', () => toast('Flash toggle — mockup only ⚡'));
  $('#btnGallery').addEventListener('click', () => toast('Gallery import — next iteration 🖼'));
}

/* ── ① Home altar: add / remove an ancestral tablet ────────── */
/* ── The shrine: the user builds it, one ancestor at a time ────
   The altar ships EMPTY. What appears on a tablet is exactly what the user
   typed — surname first, then the given name — drawn by the same builder the
   sheet's preview uses, so the preview is not a picture *of* the tablet, it IS
   the tablet. Nothing here (or in index.html) authors an ancestor's name. */
const ALTAR_MAX = 4;        // tablets this shelf holds
const ALTAR_Y = 148;        // the shelf's top edge, in altar coordinates
const ALTAR_CX = 120;       // the niche's centre — the row is centred on it
const ALTAR_GAP = 42;       // tablet spacing
/* Character baselines are in the TABLET's own coordinates (its base sits at y=0,
   its gold frame spans y −78…−6), not the altar's — this is the coordinate space
   #tabletDef was drawn in, so the same builder works on the altar and in the
   sheet's preview. −38 is the frame's optical middle (it matches the hand-authored
   y=110 the three sample tablets used, which was 148−38). */
const TABLET_TXT_Y = -38;
const TABLET_TXT_GAP = 22;
const NS_SVG = 'http://www.w3.org/2000/svg';
let relPick = '';           // the relationship chip currently chosen
let sheetIndex = -1;        // -1 = adding, >= 0 = editing that tablet

/* the characters that go on a tablet: 姓 + 名, or 姓 + 氏 when no given name */
function tabletChars(a) {
  const surname = (a.surname || '').trim();
  const given = (a.given || '').trim();
  return given ? [surname, ...given.split('')] : [surname, '氏'];
}
/* 1-3 stacked characters, balanced around the frame's middle */
function charBaselines(n) {
  const y = TABLET_TXT_Y, g = TABLET_TXT_GAP;
  return n <= 1 ? [y]
    : n === 2 ? [y - g / 2, y + g / 2]
    : [y - g, y, y + g];
}
/* one tablet = #tabletDef + the characters. Used by the altar AND the preview. */
function drawTablet(parent, chars) {
  const body = document.createElementNS(NS_SVG, 'g');
  body.setAttribute('class', 'tablet-body');
  const shape = document.createElementNS(NS_SVG, 'use');
  shape.setAttribute('href', '#tabletDef');
  body.appendChild(shape);
  const ys = charBaselines(chars.length);
  chars.forEach((ch, i) => {
    const t = document.createElementNS(NS_SVG, 'text');
    t.setAttribute('class', 'tablet-txt');
    t.setAttribute('x', '0');
    t.setAttribute('y', ys[i] === undefined ? TABLET_TXT_Y : ys[i]);
    t.textContent = ch;
    body.appendChild(t);
  });
  parent.appendChild(body);
}
function renderAltar() {
  const layer = $('#altarTablets');
  const slot = $('#addTabletSlot');
  const caption = $('#altarCaption');
  if (!layer || !slot) return;
  const shown = state.ancestors.length;
  const withGhost = shown < ALTAR_MAX ? 1 : 0;                        // the ＋ rides after the last tablet
  const first = ALTAR_CX - (shown + withGhost - 1) * ALTAR_GAP / 2;   // the whole row is centred
  layer.replaceChildren();
  state.ancestors.forEach((a, i) => {
    const g = document.createElementNS(NS_SVG, 'g');
    g.setAttribute('class', 'tablet-slot' + (a.fresh ? ' is-new' : ''));
    g.setAttribute('transform', `translate(${first + i * ALTAR_GAP},${ALTAR_Y})`);
    g.setAttribute('role', 'button');
    g.setAttribute('tabindex', '0');
    g.setAttribute('aria-label', `${tabletChars(a).join('')}${a.relation ? ' · ' + a.relation : ''} — edit or remove`);
    g.dataset.index = i;
    drawTablet(g, tabletChars(a));
    layer.appendChild(g);
  });
  slot.classList.toggle('is-hidden', !withGhost);
  slot.setAttribute('transform', `translate(${first + shown * ALTAR_GAP},${ALTAR_Y})`);
  if (caption) {
    caption.textContent = shown === 0
      ? 'Your altar is empty · 尚未安奉牌位 — tap ＋ to place your first tablet'
      : `${shown} ${shown === 1 ? 'ancestor' : 'ancestors'} enshrined · 已安奉 — tap a tablet to edit` +
        (withGhost ? ', ＋ to add' : ' (this altar is full)');
  }
  state.ancestors.forEach(a => { delete a.fresh; });   // the landing animation runs once
}

/* the sheet: add, edit, remove — one pattern for all three */
function currentDraft() {
  return {
    surname: ($('#ancSurname').value || '').trim(),
    given: ($('#ancGiven').value || '').trim(),
    relation: relPick
  };
}
function updateTabletPreview() {
  const g = $('#ancPreview');
  if (!g) return;
  const d = currentDraft();
  g.replaceChildren();
  drawTablet(g, tabletChars({ surname: d.surname || '姓', given: d.given }));
}
function setRelation(rel) {
  relPick = rel || '';
  $$('#ancRelation .chip').forEach(c => c.classList.toggle('is-on', (c.dataset.rel || '') === relPick));
  updateTabletPreview();
}
function openTabletSheet(index) {
  const sheet = $('#ancestorSheet'), scrim = $('#ancestorScrim');
  if (!sheet || !scrim) return;
  const editing = index >= 0;
  if (!editing && state.ancestors.length >= ALTAR_MAX) {
    toast(`This altar holds ${ALTAR_MAX} tablets · 此坛已满`);
    return;
  }
  sheetIndex = editing ? index : -1;
  const a = editing ? state.ancestors[index] : { surname: '', given: '', relation: '' };
  $('#ancSurname').value = a.surname || '';
  $('#ancGiven').value = a.given || '';
  setRelation(a.relation || '');
  $('#ancestorTitle').textContent = editing ? 'Edit ancestor · 编辑祖先' : 'Add an ancestor · 添加祖先';
  $('#ancestorRemove').hidden = !editing;
  updateTabletPreview();
  scrim.hidden = false;
  sheet.hidden = false;
  /* the class goes on next frame so the transition can run. Guarded: a close that
     lands before that frame must not be undone by it (probed by the flow check). */
  requestAnimationFrame(() => {
    if (!state.sheetOpen) return;
    scrim.classList.add('is-open');
    sheet.classList.add('is-open');
  });
  state.sheetOpen = true;
  setTimeout(() => { if (state.sheetOpen) $('#ancSurname').focus(); }, 300);
}
function closeTabletSheet() {
  const sheet = $('#ancestorSheet'), scrim = $('#ancestorScrim');
  if (!sheet || sheet.hidden) return;
  scrim.classList.remove('is-open');
  sheet.classList.remove('is-open');
  state.sheetOpen = false;
  sheetIndex = -1;
  /* likewise: a re-open inside these 300 ms must not be hidden by this timer */
  setTimeout(() => {
    if (state.sheetOpen) return;
    sheet.hidden = true;
    scrim.hidden = true;
  }, 300);
}
function placeTablet() {
  const d = currentDraft();
  if (!d.surname) {
    toast('Fill in the surname first · 请先填写姓氏');
    $('#ancSurname').focus();
    return;
  }
  const name = tabletChars(d).join('');
  const editing = sheetIndex >= 0;
  if (editing) state.ancestors[sheetIndex] = { ...d, fresh: true };
  else state.ancestors.push({ ...d, fresh: true });
  renderAltar();
  closeTabletSheet();
  toast(`${name} ${editing ? 'updated' : 'placed on your altar'} · ${editing ? '已更新' : '已安奉'}`);
}
function removeTablet() {
  if (sheetIndex < 0) return;
  const [gone] = state.ancestors.splice(sheetIndex, 1);
  renderAltar();
  closeTabletSheet();
  toast(`${tabletChars(gone).join('')} taken off the altar · 已移走`);
}
function initAltar() {
  const slot = $('#addTabletSlot');
  const layer = $('#altarTablets');
  if (!slot || !layer) return;
  const add = () => openTabletSheet(-1);
  slot.addEventListener('click', add);
  slot.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); add(); }
  });
  const edit = e => {
    const t = e.target.closest ? e.target.closest('.tablet-slot') : null;
    if (t) openTabletSheet(+t.dataset.index);
  };
  layer.addEventListener('click', edit);
  layer.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); edit(e); }
  });
  const sheet = $('#ancestorSheet');
  if (sheet) {
    sheet.addEventListener('submit', e => { e.preventDefault(); placeTablet(); });
    $('#ancestorClose').addEventListener('click', closeTabletSheet);
    $('#ancestorScrim').addEventListener('click', closeTabletSheet);
    $('#ancestorRemove').addEventListener('click', removeTablet);
    ['#ancSurname', '#ancGiven'].forEach(sel => $(sel).addEventListener('input', updateTabletPreview));
  }
  $$('#ancRelation .chip').forEach(c => c.addEventListener('click', () => setRelation(c.dataset.rel || '')));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.sheetOpen) closeTabletSheet();
  });
  renderAltar();          // an empty altar, with the ＋ waiting in the middle
}

/* ── Tribute points + league ─────────────────────────────────
   The award the burn screen shows is not decoration: it lands in
   state.points, updates the home total, and re-ranks the leaderboard — so the
   user genuinely moves up. The board is read out of the markup once (the HTML
   stays the authored initial state), then this code owns the order. */
const ord = n => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
function readLeague() {
  state.league = $$('#leagueList .league-row').map((row, i) => {
    const gained = /▲\s*(\d+)/.exec(row.querySelector('.lr-name').innerHTML);
    return {
      name: row.querySelector('.lr-name').childNodes[0].textContent.trim(),
      chr: row.querySelector('.lr-avatar').textContent,
      style: row.querySelector('.lr-avatar').getAttribute('style') || '',
      points: +row.querySelector('.lr-points').textContent.replace(/[^0-9]/g, ''),
      you: row.hasAttribute('data-you'),
      week0: i + 1 + (gained ? +gained[1] : 0),     // where they started the week
      moved: false
    };
  });
}
const rankOf = player => state.league.slice().sort((a, b) => b.points - a.points).indexOf(player) + 1;

function renderLeague() {
  const list = $('#leagueList');
  if (!list || !state.league.length) return;
  const ranked = state.league.slice().sort((a, b) => b.points - a.points);
  list.innerHTML = '';
  ranked.forEach((p, i) => {
    const rank = i + 1;
    const li = document.createElement('li');
    li.className = 'league-row' + (rank <= 3 ? ' in-zone' : '') +
      (p.you ? ' is-you' : '') + (p.moved ? ' is-moved' : '');
    if (p.you) li.setAttribute('data-you', '1');
    const gain = p.you ? p.week0 - rank : 0;
    li.innerHTML =
      `<span class="lr-rank">${rank}</span>` +
      `<span class="lr-avatar" style="${p.style}">${p.chr}</span>` +
      `<span class="lr-name">${p.name}${gain ? `<em>${gain > 0 ? '▲' : '▼'} ${Math.abs(gain)} this week</em>` : ''}</span>` +
      `<span class="lr-points">${p.points.toLocaleString()}</span>`;
    list.appendChild(li);
    if (rank === 3) {                   // the promotion line follows the top 3
      const divider = document.createElement('li');
      divider.className = 'league-divider';
      divider.textContent = '▲ Promotion line';
      list.appendChild(divider);
    }
  });
  const me = ranked.find(p => p.you);
  const mine = me ? ranked.indexOf(me) + 1 : 0;
  const meta = $('#leagueMeta');
  if (meta && mine) {
    meta.textContent = mine <= 3
      ? `You are ${ord(mine)} — inside the promotion zone · ends in 2d 6h`
      : 'Top 3 advance to Gold · ends in 2d 6h';
  }
  /* the home screen's chip is the same board: keep the two in step */
  const rankChip = $('.mini-rank'), moveChip = $('.mini-move');
  if (rankChip && mine) rankChip.textContent = `#${mine}`;
  if (moveChip && me) {
    const week = me.week0 - mine;
    moveChip.textContent = week ? `${week > 0 ? '▲' : '▼'} ${Math.abs(week)}` : '—';
  }
}

/* the offering landed in the fire: bank what the aim earned, and see if it changed
   the board. A throw that missed never reaches here — nothing was burned. */
function awardTribute() {
  const t = state.lastThrow;
  const me = state.league.find(p => p.you);
  if (!me || !t || !t.award) return;
  state.throws++;
  const before = rankOf(me);
  const home = $('#homePoints');
  state.points += t.award;
  me.points += t.award;
  const after = rankOf(me);
  const ranked = state.league.slice().sort((a, b) => b.points - a.points);
  const passed = ranked[after];                       // the family now sitting below
  state.league.forEach(p => { p.moved = false; });
  if (home) home.textContent = state.points.toLocaleString();
  me.moved = after < before;
  renderLeague();
  const line = `${gradeLabel(t.tier)} · +${t.award.toLocaleString()}`;
  toast(after < before
    ? `${line} · you passed ${passed ? passed.name : 'the next family'} — now ${ord(after)} · 名次上升`
    : `${line} · tribute counted · 功德入账`);
}

/* ── Wiring + keyboard shortcuts ───────────────────────────── */
$$('[data-goto]').forEach(el => el.addEventListener('click', () => go(el.dataset.goto)));
$('#btnRetryTop').addEventListener('click', playTransform);
$('#btnRetry').addEventListener('click', playTransform);
$('#btnSettings').addEventListener('click', () => toast('Settings — next iteration ⚙'));
$('#tabProfile').addEventListener('click', () => toast('Profile & Collection — next iteration 🚧'));

document.addEventListener('keydown', e => {
  const idx = SCREEN_ORDER.indexOf(state.current);
  if (['1', '2', '3', '4', '5', '6'].includes(e.key)) go(SCREEN_ORDER[+e.key - 1]);
  if (e.key === 'ArrowRight') go(SCREEN_ORDER[(idx + 1) % SCREEN_ORDER.length]);
  if (e.key === 'ArrowLeft')  go(SCREEN_ORDER[(idx - 1 + SCREEN_ORDER.length) % SCREEN_ORDER.length]);
});

initCompare();
initAim();                  // measure the target off the fire before anything can be thrown at it
initBurn();
initCapture();
initAltar();
/* the tribute total and the board start from what the markup says */
const homePts = $('#homePoints');
state.points = homePts ? +homePts.textContent.replace(/[^0-9]/g, '') : 12480;
readLeague();
$$('.jump button').forEach(b => b.classList.toggle('is-current', b.dataset.goto === 'home'));

/* ── Deep link: index.html?screen=burn (instant switch; handy for review/screenshots) ── */
const startScreen = new URLSearchParams(location.search).get('screen');
if (startScreen && SCREEN_ORDER.includes(startScreen) && startScreen !== state.current) {
  document.body.classList.add('no-anim');
  go(startScreen);
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('no-anim')));
}
