/**
 * CAPTURE-SIZE CHECKS — `node src/lib/checks/capture-size.ts`
 *
 * ⚠️ WHY THIS FILE EXISTS (SCRUM-124, found on glass 2026-10-17)
 *
 * A real phone produced a JPEG far over the `captures` bucket's 300 KB limit, so
 * every real offering died at `/preparing` with "This offering cannot be
 * prepared." Nothing caught it: the emulator's virtual camera produced ~10 KB
 * images, and no gate compared the client's upload policy with the bucket's
 * actual limit.
 *
 * So this asserts three things that can each fail on their own:
 *   ① the policy itself is coherent (edge, compression, sane progression);
 *   ② the bucket limit in the MIGRATION equals the constant the client uses —
 *      the drift guard, so a migration that changes the limit without touching
 *      the client (or vice versa) goes red;
 *   ③ `uploadCapture` still SHRINKS before it uploads — a source assertion, with
 *      a negative control proving the assertion is capable of failing.
 *
 * ⚠️ FAULT-TEST IT: delete the `boundedJpegBlob` call from `ritual.ts` and this
 * file must exit non-zero.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CAPTURE_BUCKET_MAX_BYTES,
  CAPTURE_COMPRESS,
  CAPTURE_MAX_EDGE_PX,
  CAPTURE_MIN_COMPRESS,
  CAPTURE_MIN_EDGE_PX,
  CAPTURE_SHRINK_ATTEMPTS,
  shrinkStep,
  withinCaptureBudget,
  CAPTURE_MIN_BYTES,
  isUploadableCaptureSize,
} from '../capture-size.ts';
import { escapeForNativeLoader, nativeLoaderUriFromDecoded, unescapeFromNativeLoader } from '../native-path.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

/**
 * The one predicate this file exists to keep true: the upload path shrinks the
 * bytes BEFORE it hands them to Storage.
 *
 * Written against source text on purpose — the alternative is a device run, and
 * this is the check that is supposed to make the device run unnecessary.
 */
function shrinksBeforeUpload(source: string): boolean {
  const call = source.indexOf('boundedJpegBlob(fileUri)');
  const upload = source.indexOf(".from('captures').upload(");
  return (
    call !== -1
    && upload !== -1
    && call < upload
    && source.includes("from './capture-size.ts'")
  );
}

// ── ① the policy is coherent ─────────────────────────────────────────────────
section('capture-size · the upload policy');

check('the bucket limit is the 300 KB the bucket actually enforces', CAPTURE_BUCKET_MAX_BYTES === 307_200);
check('the resize edge is 1080 or smaller', CAPTURE_MAX_EDGE_PX <= 1080);
check('the resize edge leaves a usable image', CAPTURE_MAX_EDGE_PX >= 720);
check('the first compression is between 0.3 and 0.8', CAPTURE_COMPRESS >= 0.3 && CAPTURE_COMPRESS <= 0.8);
check('there is more than one attempt', CAPTURE_SHRINK_ATTEMPTS >= 2);
check('the floor edge is below the first edge', CAPTURE_MIN_EDGE_PX < CAPTURE_MAX_EDGE_PX);
check('the floor compression is at or below the first', CAPTURE_MIN_COMPRESS <= CAPTURE_COMPRESS);

check('a 200 KB image is within budget', withinCaptureBudget(200 * 1024));
check('exactly the limit is within budget', withinCaptureBudget(CAPTURE_BUCKET_MAX_BYTES));
check('one byte over the limit is NOT within budget', !withinCaptureBudget(CAPTURE_BUCKET_MAX_BYTES + 1));
check('zero bytes is NOT within budget', !withinCaptureBudget(0));
check('NaN is NOT within budget', !withinCaptureBudget(Number.NaN));

// ⚠️ The 14-byte error body that got uploaded on glass (SCRUM-124). The ceiling
// alone passed it; `isUploadableCaptureSize` is the predicate the upload uses.
check('a 200 KB image is uploadable', isUploadableCaptureSize(200 * 1024));
check('a 14-byte error body is NOT uploadable', !isUploadableCaptureSize(14));
check('the floor itself is uploadable', isUploadableCaptureSize(CAPTURE_MIN_BYTES));
check('one byte below the floor is NOT uploadable', !isUploadableCaptureSize(CAPTURE_MIN_BYTES - 1));
check(
  'the floor is far below the ceiling',
  CAPTURE_MIN_BYTES > 0 && CAPTURE_MIN_BYTES < CAPTURE_BUCKET_MAX_BYTES,
);

const steps = Array.from({ length: CAPTURE_SHRINK_ATTEMPTS }, (_, i) => shrinkStep(i));
check(
  'every attempt keeps a legal edge',
  steps.every((s) => s.edge >= CAPTURE_MIN_EDGE_PX && s.edge <= CAPTURE_MAX_EDGE_PX),
);
check(
  'every attempt keeps a legal compression',
  steps.every((s) => s.compress >= CAPTURE_MIN_COMPRESS && s.compress <= CAPTURE_COMPRESS),
);
check(
  'later attempts never grow',
  steps.every((s, i) => i === 0 || s.edge <= steps[i - 1].edge),
);
check(
  'attempt 0 is the documented policy',
  steps[0].edge === CAPTURE_MAX_EDGE_PX && steps[0].compress === CAPTURE_COMPRESS,
);

// ── ② the migration and the client agree ─────────────────────────────────────
section('capture-size · the bucket limit cannot drift');

const bucketsMigration = read('supabase/migrations/20261004092000_storage_buckets_and_profile_bootstrap.sql');
const limitMatch = /'captures',\s*'captures',\s*false,\s*(\d+)/.exec(bucketsMigration);
check('the captures bucket declares a file_size_limit', limitMatch !== null);
check(
  'the migration limit equals CAPTURE_BUCKET_MAX_BYTES',
  limitMatch !== null && Number(limitMatch[1]) === CAPTURE_BUCKET_MAX_BYTES,
  limitMatch ? `migration says ${limitMatch[1]}, policy says ${CAPTURE_BUCKET_MAX_BYTES}` : 'no limit found',
);

// ── ③ the upload path still applies the policy ───────────────────────────────
section('capture-size · uploadCapture shrinks before it uploads');

const ritualSource = read('src/lib/ritual.ts');
check('ritual.ts imports the capture-size policy', ritualSource.includes("from './capture-size.ts'"));
check('ritual.ts defines the bounded blob helper', ritualSource.includes('async function boundedJpegBlob('));
check('ritual.ts shrinks BEFORE it calls storage.upload', shrinksBeforeUpload(ritualSource));

// Negative control — the assertion must be able to FAIL. If this ever stops
// being reported, the check above is vacuous and proves nothing.
check(
  'negative control: an upload with no resize is REJECTED by that same assertion',
  !shrinksBeforeUpload(
    'const blob = await (await fetch(fileUri)).blob();\n'
      + "await supabase().storage.from('captures').upload(path, blob, {});",
  ),
);

// ── ④ the uri survives exactly ONE native decode ─────────────────────────────
section('capture-size · the photo URI is escaped for the native loader');

// ⚠️ The measured trap: Expo Go's sandbox dir is literally named
// `%40josspaperar%2Fjoss-paper-ar`, and the native loaders decode a URI once —
// so passing the raw escape OR pre-decoding it both land on a path that does not
// exist (`open failed: ENOENT` / `Loading bitmap failed`). Every `%` must be
// escaped to `%25` so the loader's single decode restores the literal path.
const ENCODED = 'file:///data/user/0/host.exp.exponent/cache/ExperienceData/%40scope%2Fslug/Camera/a.jpg';
const ESCAPED = 'file:///data/user/0/host.exp.exponent/cache/ExperienceData/%2540scope%252Fslug/Camera/a.jpg';

check('an encoded sandbox path is escaped once', escapeForNativeLoader(ENCODED) === ESCAPED);
check('a plain file uri is left alone', escapeForNativeLoader('file:///tmp/a.jpg') === 'file:///tmp/a.jpg');
check('a non-file url is left alone', escapeForNativeLoader('https://x.test/%40y') === 'https://x.test/%40y');
check(
  'one native decode of the escaped uri lands on the literal path',
  decodeURIComponent(escapeForNativeLoader(ENCODED).replace('file://', '')) === ENCODED.replace('file://', ''),
);
check('ritual.ts escapes before the native decoder sees it', ritualSource.includes('escapeForNativeLoader(fileUri)'));
check('ritual.ts does not pre-decode the uri', !ritualSource.includes('decodeURIComponent'));

// ⚠️ And the inverse, for the manipulator's OWN output: it escapes one level
// further, and `fetch` (which does not decode) must collapse that extra level or
// it reads a 14-byte 404 body and uploads that.
const MANIPULATOR_OUT = 'file:///data/user/0/host.exp.exponent/cache/ExperienceData/%2540scope%252Fslug/ImageManipulator/x.jpg';

check('the manipulator output is collapsed for fetch', unescapeFromNativeLoader(MANIPULATOR_OUT) === ENCODED.replace('/Camera/a.jpg', '/ImageManipulator/x.jpg'));
check('collapsing a raw path is a no-op', unescapeFromNativeLoader(ENCODED) === ENCODED);
check('collapsing a plain path is a no-op', unescapeFromNativeLoader('file:///tmp/a.jpg') === 'file:///tmp/a.jpg');
check('a non-file url is not collapsed', unescapeFromNativeLoader('https://x.test/%25y') === 'https://x.test/%25y');
check(
  'escape and unescape round-trip',
  unescapeFromNativeLoader(escapeForNativeLoader(ENCODED)) === ENCODED,
);
check('ritual.ts fetches the collapsed manipulator uri', ritualSource.includes('unescapeFromNativeLoader(resized.uri)'));

// ⚠️ The OTHER form of the same trap (measured 2026-10-18, S60): a screen that
// reads the photo out of a ROUTE PARAM gets it DECODED, and on that form
// `escapeForNativeLoader` is a no-op — so `/burn`'s tutorial drew nothing. The
// scope directory must be re-encoded and then escaped once more, because the
// native loader decodes exactly once. `Image.getSize` returned 3000×4000 only
// for the double-encoded form; the other two answered ENOENT.
const DECODED = 'file:///data/user/0/host.exp.exponent/cache/ExperienceData/@scope/slug/Camera/a.jpg';

check('a DECODED sandbox path is rebuilt for the native loader', nativeLoaderUriFromDecoded(DECODED) === ESCAPED);
check(
  'one native decode of the rebuilt uri lands on the literal on-disk directory',
  decodeURIComponent(nativeLoaderUriFromDecoded(DECODED).replace('file://', ''))
    === '/data/user/0/host.exp.exponent/cache/ExperienceData/%40scope%2Fslug/Camera/a.jpg',
);
check('a plain cache path has no ExperienceData and is left alone',
  nativeLoaderUriFromDecoded('file:///data/user/0/app.josspaperar/cache/Camera/a.jpg')
    === 'file:///data/user/0/app.josspaperar/cache/Camera/a.jpg');
check('a non-file url is not rebuilt', nativeLoaderUriFromDecoded('https://x.test/@a/b') === 'https://x.test/@a/b');
check('a scope with no leaf is left alone (nothing to rebuild)',
  nativeLoaderUriFromDecoded('file:///x/ExperienceData/@scope/slug') === 'file:///x/ExperienceData/@scope/slug');

// ── summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(64)}`);
if (failures.length === 0) {
  console.log(`✓ all ${passed} capture-size checks passed`);
  process.exit(0);
}
console.log(`✗ ${failures.length} of ${passed + failures.length} capture-size checks FAILED:`);
for (const f of failures) console.log(`    · ${f}`);
process.exit(1);

