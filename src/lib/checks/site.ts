/**
 * check:site — the PLAY CONSOLE website contract, asserted.
 *
 * Google's org verification needs a LIVE URL that names the org and carries
 * the two declared contact channels. Three files must agree with SCRUM-71:
 *
 *   public/index.html   → org name · email · phone · privacy link
 *   public/privacy.html → standalone policy URL + deletion contact
 *   public/_redirects   → must NOT touch `/` or `/.well-known/`
 *
 * ⚠️ WHAT THIS GATE DOES NOT PROVE: that the domain serves these files.
 * That is a real deploy + `curl -sI https://josspaperar.app/` (200, no
 * redirect). See public/.well-known/README.md.
 *
 * Dependency-free (Node 22 strips the types), same as check:links.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** The SCRUM-71 values — the site must carry THESE, not lookalikes. */
const ORG_NAME = 'JOSSPAPERAR';
const EMAIL = 'superAdmin@josspaperar.app';
const PHONE_TEL = 'tel:+6597830688';

let passed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

console.log('\nsite · the Play Console website contract (SCRUM-71 values)\n');

const index = read('public/index.html');
check('index.html names the org', index.includes(ORG_NAME));
check('index.html carries the contact email', index.includes(EMAIL));
check('index.html carries the contact phone', index.includes(PHONE_TEL));
check('index.html links the privacy policy', index.includes('/privacy.html'));
check('index.html names the Play package', index.includes('app.josspaperar'));
/* ⚠️ The demo and the landing page are two halves of one journey: a Play
   reviewer lands on `/`, and the only way they reach the demo is this link.
   Publishing /demo without it leaves the demo reachable only by typing the
   URL — which is how this was missed the first time. Asserted BOTH ways. */
check('index.html links the demo', index.includes('href="/demo/"'));

/* ⚠️ SCRUM-119 — the DONATION surface (PayNow).
   A payment QR is the one asset on this site where a silent swap is
   indistinguishable from working: the page still renders, the alt text still
   reads correctly, and the money goes to a different account. So the asset is
   FROZEN BY HASH — and the hash failing is the point. It forces whoever changed
   the QR to re-verify it, then update the hash AND the UEN stated on the page.
   ⚠️ What is NOT asserted here: that the PNG encodes the UEN. This check is
   deliberately dependency-free (Node strips the types) and a real QR decoder is
   not available to it. The verified pair is therefore: the page STATES the UEN,
   and the asset is byte-for-byte the file that was decoded and CRC-checked.
   The decode for `2eec7dc5…` gave SG.PAYNOW · proxy type 2 (UEN) · 53533816C ·
   amount editable · EMVCo CRC 4278 — validated, not assumed. */
const QR_FILE = 'public/paynow-qr.png';
const QR_SHA256 = '2eec7dc517c5601b674bbcbcf6e6ba262768523c7ef8ab2ad9e642c55453ce91';
const QR_UEN = '53533816C';

check('index.html links the PayNow QR', index.includes('src="/paynow-qr.png"'));
check('index.html states the UEN the QR encodes', index.includes(QR_UEN));
check(
  'index.html names PayNow and scopes it to Singapore',
  /PayNow/.test(index) && /Singapore banking app/.test(index),
);
check('index.html gives the QR a descriptive alt text', /alt="PayNow QR code/.test(index));
/* ⚠️ The enlarged view must reuse the SAME frozen file. A second, "high-res" QR
   would be an asset the hash freeze does not cover — exactly the silent-swap
   hole the freeze exists to close. Asserted as a count, so adding a third QR
   file or pointing one elsewhere fails rather than passing quietly. */
check(
  'the enlarged QR reuses the same frozen asset (no second QR file)',
  (index.match(/src="\/paynow-qr\.png"/g) ?? []).length === 2,
);
check(
  'index.html can enlarge the QR (a native <dialog> carries it)',
  index.includes('<dialog') && index.includes('data-qr-open'),
);

const qrBytes = readFileSync(join(ROOT, QR_FILE));
check('the PayNow QR asset exists and is non-trivial', qrBytes.length > 1000, `${qrBytes.length} bytes`);
{
  const digest = createHash('sha256').update(qrBytes).digest('hex');
  check(
    'the PayNow QR is byte-for-byte the artefact that was VERIFIED (frozen)',
    digest === QR_SHA256,
    digest === QR_SHA256
      ? ''
      : `hash changed (${digest.slice(0, 16)}…) → re-decode the new QR, confirm its UEN, then update QR_SHA256 AND the UEN shown on the page`,
  );
}

const privacy = read('public/privacy.html');
check('privacy.html exists and is standalone', privacy.length > 1000);
check('privacy.html names the controller', privacy.includes(ORG_NAME));
check('privacy.html carries the deletion contact', privacy.includes(EMAIL));
check('privacy.html states the photo window', privacy.includes('7 days'));
check('privacy.html states what Google keeps', privacy.includes('Held by Google'));

const redirects = read('public/_redirects');
const lines = redirects.split('\n').filter((l) => l.trim() !== '' && !l.trim().startsWith('#'));
check(
  'no redirect touches `/` or `/.well-known/` (Apple no-redirect rule)',
  lines.every((l) => {
    const src = l.split(/\s+/)[0] ?? '';
    return src.startsWith('/join');
  }),
  lines.filter((l) => !(l.split(/\s+/)[0] ?? '').startsWith('/join')).join('; '),
);

// ─── the DEMO (public/demo) ────────────────────────────────────────────────
// The published interactive prototype. Two contracts:
//
//  1. FRAMING — it must read as a public demo, not internal scaffolding, and
//     it must carry the CC BY-SA attribution the car photograph requires.
//     (CREDITS.md: "swap both files … before this mockup is shared or
//     published" — kept, so credit is mandatory, not optional.)
//  2. SURFACE POLICY — a decorative brand token may only be used as text where
//     the surface is DARK. The app-wide lint cannot express "on dark", and the
//     demo is deliberately NOT in its scan list, so the allowance is
//     enumerated HERE and asserted both ways: an unlisted usage fails, and a
//     listed-but-unused entry ALSO fails (so the list cannot rot into
//     permission for something that no longer exists).
//
// ⚠️ WHY NOT JUST SWAP THEM ALL TO -text: measured, not assumed. 11 of these
// sit on the camera/burn screens (#121418) and one on the tablet face
// (#7A2412). The -text counterparts (#77632F, #7B621F) are DARK BY DESIGN —
// verified against cream — so on a near-black surface they invert the defect
// instead of fixing it, and the aim sight, throw guide, swipe chevron and
// score pop would vanish into the fire.
const DEMO_DIR = 'public/demo';
const ON_DARK_DEMO_SELECTORS = [
  // the page chrome — the page surrounds the phone on #171412
  '.proto-head h1 .zh',
  '.style-chip',
  '.jump button:hover',
  '.jump button.is-current',
  // the tablet face is dark red (#7A2412 / #8F2A0E)
  '.tablet-txt',
  // the capture + burn screens (#121418)
  '.detect-chip',
  '.aim-sight .sight-line',
  '.aim-sight .sight-tick',
  '.aim-sight .sight-tick.is-heart',
  '.burn-ladder b',
  '.aim-live',
  '.throw-guide .guide-path',
  '.throw-guide .guide-tip',
  '.swipe-hint .chev',
  '.score-pop',
  '.aim-badge',
];

const DEMO_DECORATIVE = [
  '--cinnabar', '--cinnabar-soft', '--cinnabar-deep',
  '--gold', '--gold-bright', '--gold-deep',
  '--azurite', '--azurite-light', '--azurite-deep',
  '--malachite', '--malachite-deep', '--jade-facet',
  '--muted',
];
/* ⚠️ The leading boundary group is load-bearing — see the same fix in
   design-system/contrast-check.js. Without it `border-top-color:` is read as
   `color:` and every decorative BORDER reports as a text defect. */
const DEMO_COLOR_PROPS = /(?:^|[\s;{])(color|fill|stroke)\s*:\s*var\((--[a-z0-9-]+)\)/g;

const demo = read(`${DEMO_DIR}/index.html`);
const demoCss = read(`${DEMO_DIR}/styles.css`);

// 1 · framing
check('demo exists', demo.length > 10000 && demoCss.length > 10000);
check('demo no longer shows the internal fidelity test', !demo.includes('fidelity-test'));
check('demo does not describe itself as non-production scaffolding', !/exploratory, not production code/.test(demo));
check('demo links back to the site root', demo.includes('href="/"'));
check('demo links the privacy policy', demo.includes('/privacy.html'));
check('demo carries the contact email', demo.includes(EMAIL));
check('demo states it is a prototype', /not the released app/i.test(demo));
check(
  'demo carries the CC BY-SA attribution the photograph requires',
  /CC BY-SA/.test(demo) && /Wikimedia Commons/.test(demo),
);

// 2 · surface policy
const usedOnDark = new Set<string>();
const offenders: string[] = [];
{
  let selector = '';
  const cssLines = demoCss.split('\n');
  cssLines.forEach((line) => {
    const s = line.match(/^([^{]+)\{/);
    if (s) selector = s[1].trim();
    if (/^\s*--/.test(line)) return; // a token definition is not a usage
    for (const m of line.matchAll(DEMO_COLOR_PROPS)) {
      if (!DEMO_DECORATIVE.includes(m[2])) continue;
      if (ON_DARK_DEMO_SELECTORS.includes(selector)) usedOnDark.add(selector);
      else offenders.push(`${selector} → ${m[1]}:var(${m[2]})`);
    }
  });
}
check(
  'demo: no decorative token used as text on a CREAM surface',
  offenders.length === 0,
  offenders.slice(0, 4).join(' · '),
);
const stale = ON_DARK_DEMO_SELECTORS.filter((s) => !usedOnDark.has(s));
check(
  'demo: every on-dark allowance is still actually used (the list cannot rot)',
  stale.length === 0,
  stale.join(' · '),
);

console.log('\n────────────────────────────────────────────────────────────────');
if (failures.length > 0) {
  console.log(`✗ ${failures.length} of ${passed + failures.length} site checks FAILED:`);
  for (const f of failures) console.log(`   ✗ ${f}`);
  process.exit(1);
}
console.log(`✓ all ${passed} site checks passed`);
