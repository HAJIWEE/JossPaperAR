/**
 * check:links — SCRUM-89. The UNIVERSAL-LINK CONFIG, asserted.
 *
 * The ticket's premise is that a wrong config is INVISIBLE: *"a universal link
 * that is configured wrong fails silently and identically to not being
 * configured at all — Android simply opens the browser."* Three files must
 * agree, and **nothing in the type system connects them**:
 *
 *   `app.json` · `.well-known/assetlinks.json` · `.well-known/apple-app-site-association`
 *
 * ⚠️ WHAT THIS GATE DOES **NOT** PROVE: that Android actually opens the app.
 * That is a **real tap** — or `adb shell pm get-app-links app.josspaperar`
 * reporting `verified` — and it needs a **live domain** and a **signed build**,
 * neither of which exists yet (`SCRUM-56` #6; there is no `eas.json`). So this
 * gate proves the CONFIG; the RELEASE GUARD below states what remains.
 *
 * Dependency-free (Node 22 strips the types), so it belongs in the
 * dependency-free CI job beside `check:ads` / `check:throw`.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AASA_FILE,
  APP_LINKS_PATH_PREFIX,
  ASSET_LINKS_FILE,
  HEADERS_FILE,
  PUBLIC_DIR,
  REDIRECTS_FILE,
  WELL_KNOWN_DIR,
  WELL_KNOWN_URL_PATH,
  WRANGLER_FILE,
  aasaPathCoversJoin,
  expectedAssociatedDomain,
  isPlaceholderFingerprint,
  isPlaceholderTeamId,
  parseRedirects,
  playListingUrl,
  validateAasa,
  validateAssetLinks,
  validateHeaders,
  validateRedirects,
  validateWranglerConfig,
} from '../app-links.ts';
import { INVITE_HOST, INVITE_SCHEME, inviteLink } from '../invites.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

let passed = 0;
const failures: string[] = [];
const notes: string[] = [];

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
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

function readJson(rel: string): { readonly ok: boolean; readonly value?: unknown; readonly problem?: string } {
  try {
    return { ok: true, value: JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) };
  } catch (error) {
    return { ok: false, problem: `${rel} — ${(error as Error).message}` };
  }
}

/** Read a text file that is NOT JSON (`_redirects` · `_headers` · `wrangler.jsonc`). */
function readText(rel: string): { readonly ok: boolean; readonly value: string; readonly problem?: string } {
  try {
    return { ok: true, value: readFileSync(join(ROOT, rel), 'utf8') };
  } catch (error) {
    return { ok: false, value: '', problem: `${rel} — ${(error as Error).message}` };
  }
}

console.log('\napp-links · the universal-link config (SCRUM-89 · doc 07 §4.6)\n');
console.log(`The one canonical link: ${inviteLink('ABCDEFGH')}\n`);

// ─── 1 · app.json ──────────────────────────────────────────────────────────
section('1 · app.json — the native registration');

const config = readJson('app.json');
check('app.json parses', config.ok, config.problem ?? '');
const expo = (config.value as { expo?: Record<string, unknown> } | undefined)?.expo ?? {};
const android = (expo.android ?? {}) as Record<string, unknown>;
const ios = (expo.ios ?? {}) as Record<string, unknown>;
const filters = (android.intentFilters ?? []) as Record<string, unknown>[];

check('android.intentFilters declares exactly one filter', Array.isArray(filters) && filters.length === 1);
const filter = (filters[0] ?? {}) as Record<string, unknown>;
check('the filter opens a VIEW', filter.action === 'VIEW');
// ⚠️ Expo SDK 57: "Specifying autoVerify is required for Android App Links to
// work correctly." Without it Android never runs the association check.
check('⚠️ autoVerify is TRUE (Expo: required for App Links)', filter.autoVerify === true);
const categories = (filter.category ?? []) as string[];
check(
  'category carries BROWSABLE + DEFAULT',
  categories.includes('BROWSABLE') && categories.includes('DEFAULT'),
);

const data = ((filter.data ?? []) as Record<string, unknown>[])[0] ?? {};
check('data.scheme is https (App Links, not a standard deep link)', data.scheme === 'https');
check(
  `data.host is ${INVITE_HOST} — the SAME host the QR payload uses`,
  data.host === INVITE_HOST,
  String(data.host),
);
check(`data.pathPrefix is ${APP_LINKS_PATH_PREFIX}`, data.pathPrefix === APP_LINKS_PATH_PREFIX, String(data.pathPrefix));

const domains = (ios.associatedDomains ?? []) as string[];
check(`ios.associatedDomains contains ${expectedAssociatedDomain()}`, domains.includes(expectedAssociatedDomain()), domains.join(' '));
check(`expo.scheme is ${INVITE_SCHEME} (the custom-scheme fallback)`, expo.scheme === INVITE_SCHEME, String(expo.scheme));

const packageName = String(android.package ?? '');
check(
  'one package name governs both halves (android.package = ios.bundleIdentifier)',
  packageName.length > 0 && packageName === ios.bundleIdentifier,
  `${packageName} vs ${String(ios.bundleIdentifier)}`,
);

// ─── 2 · the two association files ─────────────────────────────────────────
section('2 · .well-known — the website half of the two-way association');

const assetLinks = readJson(join(WELL_KNOWN_DIR, ASSET_LINKS_FILE));
check(`${ASSET_LINKS_FILE} parses`, assetLinks.ok, assetLinks.problem ?? '');
const assetProblems = assetLinks.ok ? validateAssetLinks(assetLinks.value, packageName) : [];
check(
  `${ASSET_LINKS_FILE} declares our package, relation and a well-formed fingerprint`,
  assetLinks.ok && assetProblems.length === 0,
  assetProblems.join(' · '),
);

const aasa = readJson(join(WELL_KNOWN_DIR, AASA_FILE));
check(`${AASA_FILE} parses`, aasa.ok, aasa.problem ?? '');
const aasaProblems = aasa.ok ? validateAasa(aasa.value, String(ios.bundleIdentifier ?? '')) : [];
check(
  `${AASA_FILE} declares our appID and covers ${APP_LINKS_PATH_PREFIX}`,
  aasa.ok && aasaProblems.length === 0,
  aasaProblems.join(' · '),
);

// ─── 3 · the deploy — what SERVES the two files above ──────────────────────
section('3 · the deploy — the hosting config that serves them');

const wrangler = readText(WRANGLER_FILE);
check(
  `${WRANGLER_FILE} exists — \`npx wrangler deploy\` publishes NOTHING without it`,
  wrangler.ok,
  wrangler.problem ?? '',
);
const wranglerProblems = wrangler.ok ? validateWranglerConfig(wrangler.value) : [];
check(
  `${WRANGLER_FILE} serves ${PUBLIC_DIR}/ · stays assets-only · uses only schema-valid keys`,
  wrangler.ok && wranglerProblems.length === 0,
  wranglerProblems.join(' · '),
);

const redirects = readText(join(PUBLIC_DIR, REDIRECTS_FILE));
check(`${PUBLIC_DIR}/${REDIRECTS_FILE} exists — the store fallback`, redirects.ok, redirects.problem ?? '');
const redirectProblems = redirects.ok ? validateRedirects(redirects.value, packageName) : [];
check(
  `${REDIRECTS_FILE} sends ${APP_LINKS_PATH_PREFIX}/* to the Play listing for ${packageName}`,
  redirects.ok && redirectProblems.length === 0,
  redirectProblems.join(' · '),
);
check(
  `nothing redirects ${WELL_KNOWN_URL_PATH}/ — Apple: host the file "with no redirects"`,
  redirects.ok &&
    !parseRedirects(redirects.value).some((rule) => rule.source.includes(WELL_KNOWN_URL_PATH)),
);

const headers = readText(join(PUBLIC_DIR, HEADERS_FILE));
check(`${PUBLIC_DIR}/${HEADERS_FILE} exists — the response headers`, headers.ok, headers.problem ?? '');
const headerProblems = headers.ok ? validateHeaders(headers.value) : [];
check(
  `${HEADERS_FILE} serves both association files as application/json`,
  headers.ok && headerProblems.length === 0,
  headerProblems.join(' · '),
);

// ─── 4 · the code ↔ config tie ─────────────────────────────────────────────
section('4 · the tie — what the APP produces vs what the CONFIG claims');

const produced = new URL(inviteLink('ABCDEFGH'));
check('inviteLink() lands on the host the intentFilter claims', produced.host === data.host, produced.host);
check(
  'inviteLink() lands on the path the intentFilter claims',
  produced.pathname.startsWith(String(data.pathPrefix)),
  produced.pathname,
);

// ─── 5 · positive controls — the gate must be able to FAIL ─────────────────
section('5 · controls — a wrong config must be CAUGHT, not merely "not green"');

check('a wrong package name is reported', validateAssetLinks(assetLinks.value, 'app.wrong').length > 0);
check(
  'a malformed fingerprint is reported',
  validateAssetLinks(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: packageName,
          sha256_cert_fingerprints: ['not-a-fingerprint'],
        },
      },
    ],
    packageName,
  ).length > 0,
);
check(
  'a wrong appID is reported',
  validateAasa({ applinks: { apps: [], details: [{ appID: 'NOPE', paths: ['/join/*'] }] } }, String(ios.bundleIdentifier ?? '')).length > 0,
);
check(
  'a path that does NOT cover /join is reported',
  validateAasa(
    {
      applinks: {
        apps: [],
        details: [{ appID: `QQ57RJ5UTD.${String(ios.bundleIdentifier ?? '')}`, paths: ['/clans/*'] }],
      },
    },
    String(ios.bundleIdentifier ?? ''),
  ).length > 0,
);
check('aasaPathCoversJoin rejects an unrelated prefix', !aasaPathCoversJoin('/clans/*') && aasaPathCoversJoin('/join/*') && aasaPathCoversJoin('*'));

// Hosting controls — each one is a way the LIVE link breaks silently.
check(
  'a redirect of /.well-known is reported (Apple: "no redirects")',
  validateRedirects(
    `/.well-known/${AASA_FILE} /oops 302\n${APP_LINKS_PATH_PREFIX}/* ${playListingUrl(packageName)} 302`,
    packageName,
  ).length > 0,
);
check(
  'a fallback pointing at SOMEONE ELSE\'S app is reported',
  validateRedirects(`${APP_LINKS_PATH_PREFIX}/* ${playListingUrl('app.someoneelse')} 302`, packageName).length > 0,
);
check(
  'a MISSING fallback is reported (the browser would dead-end)',
  validateRedirects(`# nothing but a comment`, packageName).length > 0,
);
check(
  'a fallback that is not a redirect is reported',
  validateRedirects(`${APP_LINKS_PATH_PREFIX}/* ${playListingUrl(packageName)} 200`, packageName).length > 0,
);
check(
  'a "main" in wrangler.jsonc is reported (no Worker script exists)',
  validateWranglerConfig('{"name":"x","main":"src/index.ts","assets":{"directory":"./public/"}}').length > 0,
);
check(
  'a wrangler.jsonc publishing the WRONG directory is reported',
  validateWranglerConfig('{"name":"x","assets":{"directory":"./dist/"}}').length > 0,
);

// Observability controls — the schema sets `additionalProperties: false`, so a
// misspelled key is not ignored, it FAILS the deploy. These prove it is caught.
const OBS_PREFIX = '{"name":"x","assets":{"directory":"./public/"},"previews":{},"observability":';
check(
  'an INVALID observability key is reported (schema: additionalProperties:false)',
  validateWranglerConfig(`${OBS_PREFIX}{"logz":{"enabled":true}}}`).length > 0,
);
check(
  'an invalid observability.logs key is reported',
  validateWranglerConfig(`${OBS_PREFIX}{"logs":{"invokation_logs":true}}}`).length > 0,
);
check(
  'the REAL observability block is schema-valid',
  validateWranglerConfig(
    `${OBS_PREFIX}{"enabled":true,"redact_query_string":true,"logs":{"enabled":true,"invocation_logs":true,"persist":true}}}`,
  ).length === 0,
);
check(
  'comment-stripping does not trip on "main" SPOKEN INSIDE a comment',
  validateWranglerConfig('{\n  // no "main": assets-only, on purpose\n  "name":"x",\n  "assets":{"directory":"./public/"},\n  "previews":{}\n}').length === 0,
);
check(
  'a wrangler.jsonc MISSING the `previews` block is reported',
  validateWranglerConfig('{"name":"x","assets":{"directory":"./public/"}}').length > 0,
);
check('an empty _headers is reported (no content type)', validateHeaders('').length > 0);

// ─── release guard — the two prerequisites, stated plainly ─────────────────
const firstTarget = ((assetLinks.value as unknown[] | undefined)?.[0] ?? {}) as {
  target?: { sha256_cert_fingerprints?: unknown[] };
};
const fingerprint = (firstTarget.target?.sha256_cert_fingerprints ?? [])[0];
const firstDetail = (((aasa.value as { applinks?: { details?: { appID?: unknown }[] } } | undefined)?.applinks?.details ?? [])[0] ?? {}) as { appID?: unknown };

if (isPlaceholderFingerprint(fingerprint)) {
  notes.push(`⚠️ sha256_cert_fingerprints is STILL THE SENTINEL (all-zeroes) — fill it from a SIGNED BUILD (\`eas credentials\`) before deploying ${ASSET_LINKS_FILE}.`);
}
if (isPlaceholderTeamId(firstDetail.appID)) {
  notes.push(`⚠️ appID still carries the sentinel Team ID — fill it from the Apple Developer Team ID before deploying ${AASA_FILE}.`);
}
notes.push('⚠️ NOT PROVEN HERE: that a real tap opens the app. That needs the domain live AND a signed build — `adb shell pm get-app-links app.josspaperar` must report `verified`. See public/.well-known/README.md.');
notes.push('⚠️ A wrong host, path or fingerprint costs nothing to fix here and everything to miss in production: a broken universal link fails SILENTLY.');

console.log('\n── RELEASE GUARD ───────────────────────────────────────────────');
for (const note of notes) console.log(`  ${note}`);

console.log('\n────────────────────────────────────────────────────────────────');
if (failures.length > 0) {
  console.log(`✗ ${failures.length} of ${passed + failures.length} app-link checks FAILED:`);
  for (const failure of failures) console.log(`   ✗ ${failure}`);
  process.exit(1);
}
console.log(`✓ all ${passed} app-link checks passed`);

