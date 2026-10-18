/**
 * SPRITE RENDER — `node src/lib/checks/sprite-render.ts`
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * Stage ④ (`fal-ai/birefnet/v2`) is PAID to turn the generated frame into a
 * transparent sprite. Two lines in the client can silently undo that:
 *
 *   1. **A background behind the image.** #60 mounted the sprite on a
 *      `surface.paper` card — #F5F0E8, within a shade of the #F3EDD8 cream the
 *      cutout had just removed — so the transparent WebP landed on an opaque
 *      rectangle and the paid alpha was invisible. Measured on glass 2026-10-18.
 *   2. **`resizeMode="cover"`.** The cutout's bounding box is not square; `cover`
 *      fills the 72 dp box by scaling up and CROPPING, so the offering arrives
 *      cut off by its own frame. `contain` fits the whole sprite inside it.
 *
 * ⚠️ A SCREENSHOT CAUGHT THIS, NOT A GATE — and it is the SECOND time the
 * sprite's alpha has been lost (`d5af1a5` fixed the first). That is why this
 * file exists: `tsc` cannot see a style object, and `check:pathc` asserts the
 * SERVER asks for alpha — nothing asserted that the CLIENT preserves it.
 *
 * ── WHAT IT ASSERTS ────────────────────────────────────────────────────────
 *   1. the `<Image>` that draws `offeringUri` uses `resizeMode="contain"`
 *   2. the `offering` style declares no `backgroundColor` (the opaque card)
 *   3. …and no `borderWidth`/`borderColor` (a frame around a cut-out)
 *   4. …and no `overflow: 'hidden'` (a clip that can crop the sprite)
 *
 * ⚠️ BLINDNESS IS THE FAILURE MODE HERE: a regex that matches nothing passes
 * vacuously. So the extraction is asserted FIRST — if `offering: {` or the
 * `<Image>` cannot be found, the gate fails rather than reporting green.
 *
 * ⚠️ FAULT-TEST IT: set `resizeMode="cover"`, or add a `backgroundColor` to
 * `offering`, and confirm it goes RED.
 */
import fs from 'node:fs';
import path from 'node:path';

const PROJ = path.join(import.meta.dirname, '..', '..', '..');
const BURN = path.join(PROJ, 'src', 'app', 'burn.tsx');
const source = fs.readFileSync(BURN, 'utf8');

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

/** `name: { … }` from the StyleSheet, by brace matching (the block spans lines). */
function styleBlock(name: string): string | null {
  const at = source.indexOf(`${name}: {`);
  if (at < 0) return null;
  const open = source.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return null;
}

/** The JSX element that draws the offering — located by its source, not by index. */
function offeringImage(): string | null {
  const at = source.indexOf('source={{ uri: offeringUri }}');
  if (at < 0) return null;
  const start = source.lastIndexOf('<Image', at);
  const end = source.indexOf('/>', at);
  if (start < 0 || end < 0) return null;
  return source.slice(start, end + 2);
}

console.log('\nThe sprite stays transparent and uncropped — the client half of stage ④\n');

section('① The extraction FOUND the code — a blind gate cannot pass');

const offering = styleBlock('offering');
const image = offeringImage();

check('the `offering` style block is present', offering !== null);
check('the <Image> drawing `offeringUri` is present', image !== null);
check(
  'the image style is present too',
  styleBlock('offeringImage') !== null,
);

section('② The cut-out survives — nothing is painted behind it');

check(
  'the offering box has NO `backgroundColor`',
  offering !== null && !/backgroundColor/.test(offering),
  'a background fills the transparent pixels stage ④ paid for (the #F5F0E8 card)',
);
check(
  '…and no `borderWidth`/`borderColor`',
  offering !== null && !/\bborderWidth\b|\bborderColor\b/.test(offering),
  'a border draws a frame around a cut-out',
);
check(
  "…and no `overflow: 'hidden'`",
  offering !== null && !/overflow\s*:\s*['"]hidden['"]/.test(offering),
  'a clip can crop the sprite it is supposed to show whole',
);
check(
  '…and the image itself has no background either',
  styleBlock('offeringImage') === null || !/backgroundColor/.test(styleBlock('offeringImage') ?? ''),
);

section('③ The offering is FITTED, not cropped');

check(
  'the offering <Image> uses resizeMode="contain"',
  image !== null && /resizeMode\s*=\s*["']contain["']/.test(image),
  'without it React Native defaults to `cover`, which crops',
);
check(
  '…and NOT `cover` (the defect #60 shipped)',
  image !== null && !/resizeMode\s*=\s*["']cover["']/.test(image),
);

/* ── verdict ──────────────────────────────────────────────────────────────── */
// ⚠️ LAST: a check below this block could not change the exit code.
console.log('');
if (failed > 0) {
  console.error(`✗ ${failed} sprite-render checks FAILED:\n${failures.map((f) => `  · ${f}`).join('\n')}\n`);
  process.exit(1);
}
console.log(`✓ all ${passed} sprite-render checks passed\n`);
