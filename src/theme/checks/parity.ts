/**
 * TOKEN PARITY CHECK — `node src/theme/checks/parity.ts`
 *
 * `design-system/tokens.css` is AUTHORITATIVE. `src/theme/tokens.ts` mirrors it
 * for React Native. This check asserts they cannot drift.
 *
 * Why it exists: this project has already been bitten by hand-carried hexes —
 * tokens.css's own header records that 4 of 5 values copied into the design file
 * were WRONG and *re-introduced the very drift the contrast tranche was fixing*.
 * A mirror without a guard is that same bug waiting to happen.
 *
 * Zero dependencies. Reads the CSS, reads the TS, compares. Fails loudly.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { brand, surface, text, disc, onColorCream } from '../tokens.ts';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../../..');
const CSS_PATH = resolve(ROOT, 'design-system/tokens.css');

/** css custom property → the mirrored TS value. */
const PAIRS: Record<string, string> = {
  // brand (decorative only)
  '--cinnabar': brand.cinnabar,
  '--cinnabar-soft': brand.cinnabarSoft,
  '--cinnabar-deep': brand.cinnabarDeep,
  '--gold': brand.gold,
  '--gold-bright': brand.goldBright,
  '--gold-deep': brand.goldDeep,
  '--azurite': brand.azurite,
  '--azurite-light': brand.azuriteLight,
  '--azurite-deep': brand.azuriteDeep,
  '--malachite': brand.malachite,
  '--malachite-deep': brand.malachiteDeep,
  '--jade-facet': brand.jadeFacet,
  '--ink': brand.ink,
  '--ink-soft': brand.inkSoft,
  '--muted': brand.muted,
  // surfaces
  '--paper': surface.paper,
  '--paper-deep': surface.paperDeep,
  '--paper-edge': surface.paperEdge,
  '--surface-row': surface.row,
  '--surface-row-zone': surface.rowZone,
  '--surface-row-you': surface.rowYou,
  '--surface-camera': surface.camera,
  // text on cream
  '--gold-text': text.gold,
  '--gold-bright-text': text.goldBright,
  '--malachite-text': text.malachite,
  '--azurite-text': text.azurite,
  '--cinnabar-text': text.cinnabar,
  '--ink-text': text.ink,
  '--ink-soft-text': text.inkSoft,
  '--muted-text': text.muted,
  // cream on a brand fill
  '--on-color-cream': onColorCream,
  // avatar discs
  '--disc-gold': disc.gold,
  '--disc-gold-deep': disc.goldDeep,
  '--disc-malachite': disc.malachite,
  '--disc-jade-facet': disc.jadeFacet,
};

function parseCss(css: string): Map<string, string> {
  const found = new Map<string, string>();
  const re = /--([a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{3,8})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    found.set(`--${m[1]}`, m[2].toUpperCase());
  }
  return found;
}

const EXPECTED_TOKENS = Object.keys(PAIRS).length;

const css = readFileSync(CSS_PATH, 'utf8');
const inCss = parseCss(css);

let passed = 0;
const failures: string[] = [];

console.log('\nToken parity — src/theme/tokens.ts ↔ design-system/tokens.css');

for (const [varName, tsValue] of Object.entries(PAIRS)) {
  const cssValue = inCss.get(varName);
  if (cssValue === undefined) {
    failures.push(`${varName} is in tokens.ts but has NO hex in tokens.css`);
    console.log(`  ✗ ${varName} — missing from tokens.css`);
    continue;
  }
  if (cssValue !== tsValue.toUpperCase()) {
    failures.push(`${varName}: css ${cssValue} ≠ ts ${tsValue.toUpperCase()}`);
    console.log(`  ✗ ${varName} — css ${cssValue} ≠ ts ${tsValue.toUpperCase()}`);
    continue;
  }
  passed += 1;
}

// A dead mirror must not read as a pass: if the CSS ever stops parsing we would
// otherwise "pass" with an empty comparison.
const GUARD = inCss.size >= EXPECTED_TOKENS;
if (!GUARD) {
  failures.push(`guard: parsed only ${inCss.size} hexes from tokens.css, expected ≥ ${EXPECTED_TOKENS}`);
  console.log(`  ✗ guard — parsed ${inCss.size} hexes, expected ≥ ${EXPECTED_TOKENS} (dead parse?)`);
} else {
  passed += 1;
  console.log(`  ✓ ${EXPECTED_TOKENS} tokens matched + guard — parsed ${inCss.size} hexes from tokens.css`);
}

console.log(`\n${'─'.repeat(64)}`);
if (failures.length === 0) {
  console.log(`✓ all ${passed} token-parity checks passed — the RN mirror matches the design tokens`);
  process.exit(0);
}
console.log(`✗ ${failures.length} token-parity problem(s):`);
for (const f of failures) console.log(`    · ${f}`);
process.exit(1);