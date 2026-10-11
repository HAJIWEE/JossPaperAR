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
  WELL_KNOWN_DIR,
  aasaPathCoversJoin,
  expectedAssociatedDomain,
  isPlaceholderFingerprint,
  isPlaceholderTeamId,
  validateAasa,
  validateAssetLinks,
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

// ─── 3 · the code ↔ config tie ─────────────────────────────────────────────
section('3 · the tie — what the APP produces vs what the CONFIG claims');

const produced = new URL(inviteLink('ABCDEFGH'));
check('inviteLink() lands on the host the intentFilter claims', produced.host === data.host, produced.host);
check(
  'inviteLink() lands on the path the intentFilter claims',
  produced.pathname.startsWith(String(data.pathPrefix)),
  produced.pathname,
);

// ─── 4 · positive controls — the gate must be able to FAIL ─────────────────
section('4 · controls — a wrong config must be CAUGHT, not merely "not green"');

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

