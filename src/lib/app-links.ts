/**
 * app-links.ts — the UNIVERSAL-LINK contract, as data (SCRUM-89 · doc 07 §4.6).
 *
 * WHY THIS FILE EXISTS. The ticket's own warning is the reason:
 *
 *   "A universal link that is configured WRONG fails **silently and identically
 *    to not being configured at all** — Android simply opens the browser."
 *
 * So the wiring is not "a task you do once in `app.json`". It is **three files
 * that must agree with each other**, across two platforms and two languages:
 *
 *   `app.json`                                → `android.intentFilters` · `ios.associatedDomains`
 *   `.well-known/assetlinks.json`             → Android's half of the two-way association
 *   `.well-known/apple-app-site-association`  → iOS's half
 *
 * ⚠️ **Nothing in the type system connects them.** `app.json` is JSON, both
 * association files are JSON, and a typo in any one of the three is a **silent
 * no-op on a device** — which is exactly why the ticket's acceptance criterion
 * cannot be satisfied by reading a diff.
 *
 * So the expected shape lives here, and `npm run check:links` asserts that the
 * three files actually agree. ⚠️ **That gate proves the CONFIG, not the LINK** —
 * whether Android really opens the app is a real tap (or
 * `adb shell pm get-app-links app.josspaperar` reporting `verified`), and it
 * needs BOTH a live domain and a signed build. See `public/.well-known/README.md`.
 *
 * PURE ON PURPOSE — no React, no filesystem, no network — so plain Node checks it.
 * ⚠️ The host and the scheme are NOT re-declared here: they are imported from
 * `invites.ts`, the single source the QR payload already uses.
 */

import { INVITE_HOST, INVITE_SCHEME } from './invites.ts';

/** The one path a universal link may claim: `https://<host>/join/{CODE}`. */
export const APP_LINKS_PATH_PREFIX = '/join';

/** Where the two association files live in the repo (Expo Router web convention). */
export const WELL_KNOWN_DIR = 'public/.well-known';
export const ASSET_LINKS_FILE = 'assetlinks.json';
export const AASA_FILE = 'apple-app-site-association';

/** Android's half — Google's Digital Asset Links. */
export const ASSET_LINKS_RELATION = 'delegate_permission/common.handle_all_urls';
export const ASSET_LINKS_NAMESPACE = 'android_app';

/**
 * ⚠️ THE TWO PLACEHOLDERS — and why they are sentinels rather than guesses.
 *
 * Both values can **only** exist after a **signed build**:
 *
 *  · `sha256_cert_fingerprints` comes from the app's **signing certificate**.
 *    Expo's own guide says "if you're using EAS Build … **after creating a
 *    build**". There is no `eas.json` in this repo and EAS login is still open
 *    (`SCRUM-56`), so the value is genuinely unknown.
 *  · `appID` needs the **Apple Developer Team ID**, and iOS is deferred
 *    (`ADR-001` / `ADR-003`).
 *
 * ⚠️ **A placeholder that silently ships is the exact failure this ticket exists
 * to prevent** — so these are all-zeroes, which cannot be mistaken for a real
 * value, `check:links` recognises them, and `public/.well-known/README.md` says so.
 */
export const PLACEHOLDER_SHA256_FINGERPRINT =
  '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00';
export const PLACEHOLDER_APPLE_TEAM_ID = '0000000000';

/** `AA:BB:…` — 32 bytes, colon-separated, upper-case hex. */
export const SHA256_FINGERPRINT_PATTERN = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
/** `<10-char Apple Team ID>.<bundle id>` — Expo: `"appID": "QQ57RJ5UTD.com.example.myapp"`. */
export const APPLE_APP_ID_PATTERN = /^[A-Z0-9]{10}\.[A-Za-z0-9.-]+$/;

export function isSha256Fingerprint(value: unknown): value is string {
  return typeof value === 'string' && SHA256_FINGERPRINT_PATTERN.test(value);
}

/** True while a fingerprint is still the sentinel — i.e. NOT yet a real cert. */
export function isPlaceholderFingerprint(value: unknown): boolean {
  return value === PLACEHOLDER_SHA256_FINGERPRINT;
}

export function isPlaceholderTeamId(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(`${PLACEHOLDER_APPLE_TEAM_ID}.`);
}

/**
 * Does one AASA `paths` entry claim our `/join` prefix?
 *
 * Apple matches these as patterns, so the honest test is COVERAGE, not equality:
 * `*` and `/*` cover everything, `/join` covers the bare path, and `/join/*`
 * (or any `/join/…`) covers what `inviteLink()` actually produces.
 */
export function aasaPathCoversJoin(path: unknown): boolean {
  if (typeof path !== 'string') return false;
  const p = path.trim();
  return p === '*' || p === '/*' || p === APP_LINKS_PATH_PREFIX || p.startsWith('/join/');
}

/** The single `intentFilter` `app.json` must carry. Derived from the host constant. */
export function expectedIntentFilter(host: string = INVITE_HOST): {
  readonly action: string;
  readonly autoVerify: boolean;
  readonly data: readonly { readonly scheme: string; readonly host: string; readonly pathPrefix: string }[];
  readonly category: readonly string[];
} {
  return {
    action: 'VIEW',
    // ⚠️ Expo SDK 57: "Specifying autoVerify is required for Android App Links
    // to work correctly." Without it the OS never runs the association check.
    autoVerify: true,
    data: [{ scheme: 'https', host, pathPrefix: APP_LINKS_PATH_PREFIX }],
    category: ['BROWSABLE', 'DEFAULT'],
  };
}

/** The single `ios.associatedDomains` entry `app.json` must carry. */
export function expectedAssociatedDomain(host: string = INVITE_HOST): string {
  return `applinks:${host}`;
}

/** The custom scheme — re-exported so a caller never re-types it. */
export const APP_LINK_SCHEME = INVITE_SCHEME;

/**
 * Validate a parsed `assetlinks.json`. Returns PROBLEMS (empty = good).
 *
 * ⚠️ An unfilled sentinel is deliberately NOT a problem here — it is a
 * *readiness* fact, and failing a build for something no one can fix before a
 * signed build exists would make the gate red for the wrong reason. The gate
 * reports it separately as a RELEASE GUARD.
 */
export function validateAssetLinks(value: unknown, packageName: string): string[] {
  const problems: string[] = [];
  if (!Array.isArray(value) || value.length === 0) {
    return ['assetlinks.json must be a non-empty JSON ARRAY'];
  }
  const entry = value[0] as Record<string, unknown>;
  const relation = entry?.relation;
  if (!Array.isArray(relation) || !relation.includes(ASSET_LINKS_RELATION)) {
    problems.push(`relation must include "${ASSET_LINKS_RELATION}"`);
  }
  const target = entry?.target as Record<string, unknown> | undefined;
  if (!target || typeof target !== 'object') {
    problems.push('target is missing');
    return problems;
  }
  if (target.namespace !== ASSET_LINKS_NAMESPACE) {
    problems.push(`target.namespace must be "${ASSET_LINKS_NAMESPACE}"`);
  }
  if (target.package_name !== packageName) {
    problems.push(`target.package_name must be "${packageName}" (it is ${JSON.stringify(target.package_name)})`);
  }
  const fingerprints = target.sha256_cert_fingerprints;
  if (!Array.isArray(fingerprints) || fingerprints.length === 0) {
    problems.push('target.sha256_cert_fingerprints must be a non-empty array');
  } else {
    for (const fp of fingerprints) {
      if (!isSha256Fingerprint(fp)) {
        problems.push(
          `sha256_cert_fingerprints entry is not 32 colon-separated uppercase hex bytes: ${JSON.stringify(fp)}`,
        );
      }
    }
  }
  return problems;
}

/** Validate a parsed `apple-app-site-association`. Returns PROBLEMS (empty = good). */
export function validateAasa(value: unknown, bundleId: string): string[] {
  const problems: string[] = [];
  const root = value as Record<string, unknown> | null;
  const applinks = root?.applinks as Record<string, unknown> | undefined;
  if (!applinks || typeof applinks !== 'object') {
    return ['the top-level "applinks" object is missing'];
  }
  if (!Array.isArray(applinks.apps)) {
    problems.push('"applinks.apps" must be an array (Apple requires it, even when empty)');
  }
  const details = applinks.details;
  if (!Array.isArray(details) || details.length === 0) {
    return [...problems, '"applinks.details" must be a non-empty array'];
  }
  const detail = details[0] as Record<string, unknown>;
  const appID = detail?.appID;
  if (!APPLE_APP_ID_PATTERN.test(String(appID ?? ''))) {
    problems.push(`appID must look like "<10-char Team ID>.<bundle id>" (it is ${JSON.stringify(appID)})`);
  } else if (!String(appID).endsWith(`.${bundleId}`)) {
    problems.push(`appID must end with ".${bundleId}" (it is ${JSON.stringify(appID)})`);
  }
  const paths = detail?.paths;
  if (!Array.isArray(paths) || paths.length === 0) {
    problems.push('details[0].paths must be a non-empty array');
  } else if (!paths.some(aasaPathCoversJoin)) {
    problems.push(
      `details[0].paths must cover "${APP_LINKS_PATH_PREFIX}" (inviteLink() produces ${APP_LINKS_PATH_PREFIX}/{CODE})`,
    );
  }
  return problems;
}

