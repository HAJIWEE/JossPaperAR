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

// ─── the DEPLOY contract — what SERVES the two files above ──────────────────
//
// An association file nobody serves is not a universal link. Serving it needs a
// hosting config — three MORE files that nothing type-checks:
//
//   `wrangler.jsonc`     → which folder is published, and how
//   `public/_redirects`  → the store fallback when the app is not installed
//   `public/_headers`    → the response headers Google/Apple expect
//
// ⚠️ **LIVE FINDING, 2026-10-11.** This repo had NO Wrangler config, while the
// current Cloudflare "Connect to Git" flow is **Workers Builds**, whose deploy
// step runs `npx wrangler deploy`. With no config that command has no Worker and
// no assets directory, so it publishes nothing and every `.well-known` URL 404s.
// **A missing deploy config fails exactly as silently as a wrong one** — which
// is why it is asserted here rather than left to a checklist.

/** The Wrangler config, read by `npx wrangler deploy` (Workers Builds). */
export const WRANGLER_FILE = 'wrangler.jsonc';
/** The static root that gets published. */
export const PUBLIC_DIR = 'public';
/** The URL path both association files are served from. */
export const WELL_KNOWN_URL_PATH = '/.well-known';
/** Cloudflare's two directives files — parsed by Workers, never served. */
export const REDIRECTS_FILE = '_redirects';
export const HEADERS_FILE = '_headers';
/** Where the fallback must send a browser with no app installed. */
export const PLAY_LISTING_PREFIX = 'https://play.google.com/store/apps/details?id=';

/**
 * The EAS build config — `SCRUM-56` #4.
 *
 * ⚠️ Why this is GATED and not merely filed: without a **signed** build the cert
 * SHA-256 is unknowable, so `assetlinks.json` keeps its all-zero sentinel and the
 * link can never be verified. `eas.json` is the first link in that chain:
 *
 *   `eas login` → `eas build --profile preview` → an installable APK
 *     → the RELEASE cert SHA-256 → fills the sentinel
 *       → `adb shell pm get-app-links app.josspaperar` can finally report `verified`
 *
 * A missing `eas.json` fails as silently as everything else here: nothing in the
 * type system notices, `expo-doctor` does not care, and the only symptom is a link
 * that opens the browser instead of the app.
 *
 * ⚠️ `eas.json` is parsed as **strict JSON** by EAS CLI, so it CANNOT carry
 * comments — which is why this explanation lives here instead of in the file.
 */
export const EAS_CONFIG_FILE = 'eas.json';

/** `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` — the EAS project id format. */
export const EAS_PROJECT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Validate `expo.extra.eas.projectId` — the id `eas build:configure` writes.
 *
 * ⚠️ Without it `eas build` cannot tell WHICH EAS project to build (it prompts,
 * or fails), so there is no signed build, no cert SHA-256, and the sentinel in
 * `assetlinks.json` can never be replaced. That is the whole chain.
 */
export function validateEasProjectId(expoConfig: Record<string, unknown>): string[] {
  const extra = expoConfig.extra as Record<string, unknown> | undefined;
  const eas = extra?.eas as Record<string, unknown> | undefined;
  const projectId = eas?.projectId;
  if (projectId === undefined) {
    return ['expo.extra.eas.projectId is missing — `eas build` cannot resolve the EAS project, so no signed build (and no fingerprint) is possible'];
  }
  if (!EAS_PROJECT_ID_PATTERN.test(String(projectId))) {
    return [`expo.extra.eas.projectId is not a UUID: ${JSON.stringify(projectId)}`];
  }
  return [];
}
/** The three profiles EAS CLI's own default generates (Expo docs: "the default configuration for eas.json generated in a new project"). */
export const EAS_REQUIRED_PROFILES = ['development', 'preview', 'production'] as const;

/**
 * Validate `eas.json`. Returns PROBLEMS (empty = good).
 *
 * Deliberately SHALLOW: it asserts only what Expo's documentation states — that
 * the file parses as strict JSON and carries a `build` object with the three
 * default profiles. It does not police profile contents, because inventing rules
 * the vendor does not have would be a gate that fails for the wrong reason.
 */
export function validateEasConfig(text: string): string[] {
  const problems: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return [
      `${EAS_CONFIG_FILE} is not valid JSON — EAS CLI parses it strictly, so comments are NOT allowed: ${(error as Error).message}`,
    ];
  }
  const build = (parsed as { build?: unknown } | null)?.build;
  if (!build || typeof build !== 'object') {
    problems.push('the "build" key is missing — EAS CLI would have no profiles to build');
    return problems;
  }
  for (const profile of EAS_REQUIRED_PROFILES) {
    if (!(profile in (build as Record<string, unknown>))) {
      problems.push(`the "${profile}" build profile is missing`);
    }
  }
  return problems;
}

/** The Play listing for a given package id — derived, never re-typed. */
export function playListingUrl(packageName: string): string {
  return `${PLAY_LISTING_PREFIX}${packageName}`;
}

/**
 * The ONLY keys Wrangler's schema allows under `observability` — transcribed from
 * the published config schema (`unpkg.com/wrangler/config-schema.json` →
 * `definitions.Observability`).
 *
 * ⚠️ Transcribed *because* that definition sets `"additionalProperties": false`:
 * a guessed or misspelled key is **not** ignored, it **fails the deploy**. Since
 * guessing is the failure mode, an allow-list is the guard.
 */
export const OBSERVABILITY_KEYS = [
  'enabled',
  'head_sampling_rate',
  'redact_query_string',
  'issues',
  'logs',
  'traces',
] as const;

/** The same, for `observability.logs` (schema: `definitions.Observability…logs`). */
export const OBSERVABILITY_LOGS_KEYS = [
  'enabled',
  'head_sampling_rate',
  'invocation_logs',
  'persist',
  'destinations',
] as const;

/** Keys present in `value` that the schema does not allow at `where`. */
export function unknownConfigKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  where: string,
): string[] {
  return Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .map(
      (key) =>
        `"${where}.${key}" is not a Wrangler config key — the schema sets additionalProperties:false, so it FAILS the deploy`,
    );
}

/**
 * Strip `//` and block comments from JSONC, ignoring comment markers inside
 * strings — so a `wrangler.jsonc` that merely *mentions* `"main"` in a comment
 * cannot make this validator lie.
 */
export function stripJsonComments(text: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
      out += '\n';
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
      i += 1;
      continue;
    }
    out += ch;
  }
  return out;
}

/** One `_redirects` line: `[source] [destination] [code?]`. */
export type RedirectRule = { readonly source: string; readonly destination: string; readonly code: number };

/** Parse `_redirects`. Blank lines and `#` comments are skipped. */
export function parseRedirects(text: string): RedirectRule[] {
  const rules: RedirectRule[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith('#')) continue;
    const [source, destination, code] = line.split(/\s+/);
    if (!source || !destination) continue;
    rules.push({ source, destination, code: code ? Number(code) : 302 });
  }
  return rules;
}

/** One `_headers` block: a path line, then indented `Name: value` lines. */
export type HeaderRule = {
  readonly path: string;
  readonly headers: readonly { readonly name: string; readonly value: string }[];
};

/** Parse `_headers`. Indentation is what separates a header from the next path. */
export function parseHeaders(text: string): HeaderRule[] {
  const rules: { path: string; headers: { name: string; value: string }[] }[] = [];
  let current: { path: string; headers: { name: string; value: string }[] } | null = null;
  for (const raw of text.split('\n')) {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      current = { path: trimmed, headers: [] };
      rules.push(current);
      continue;
    }
    if (!current) continue;
    const colon = raw.indexOf(':');
    if (colon === -1) continue;
    current.headers.push({ name: raw.slice(0, colon).trim(), value: raw.slice(colon + 1).trim() });
  }
  return rules;
}

/**
 * Validate `wrangler.jsonc` — must publish `public/` and stay ASSETS-ONLY.
 *
 * ⚠️ `"main"` is a problem, not a nicety: pointing at a Worker script that does
 * not exist fails the deploy outright. And no script is needed here — the
 * `/join` fallback is a `_redirects` rule, so it needs no code at all.
 */
export function validateWranglerConfig(text: string): string[] {
  const problems: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonComments(text));
  } catch (error) {
    return [`${WRANGLER_FILE} is not valid JSONC once comments are stripped: ${(error as Error).message}`];
  }
  const root = (parsed ?? {}) as Record<string, unknown>;
  if (typeof root.name !== 'string' || root.name.length === 0) {
    problems.push('"name" is missing — `npx wrangler deploy` needs a Worker name');
  }
  const assets = root.assets as Record<string, unknown> | undefined;
  if (!assets || typeof assets !== 'object') {
    problems.push('the "assets" key is missing — the deploy would publish nothing');
    return problems;
  }
  const declared = String(assets.directory ?? '')
    .replace(/^\.\//, '')
    .replace(/\/+$/, '');
  if (declared !== PUBLIC_DIR) {
    problems.push(`assets.directory must serve ${PUBLIC_DIR}/ (it is ${JSON.stringify(assets.directory)})`);
  }
  if ('main' in root) {
    problems.push('"main" must not be set — no Worker script exists in this repo, so this must be an ASSETS-ONLY Worker');
  }
  // ⚠️ Not cosmetic: Cloudflare runs the Preview command (`npx wrangler preview`)
  // on every NON-production branch, i.e. every PR, and it REFUSES to run without
  // this block — failing only as a GitHub check-run ("Workers Builds: …") that
  // `npm run check` and `ci.yml` cannot see. That is how it went unnoticed on two
  // merged PRs. Docs: "The `previews` block is required, but it can be empty."
  if (!('previews' in root)) {
    problems.push(
      '"previews" is missing — every PR\'s Cloudflare preview build FAILS without it, and only in a check-run `npm run check` cannot see (the block may be empty: `"previews": {}`)',
    );
  }
  const observability = root.observability as Record<string, unknown> | undefined;
  if (observability && typeof observability === 'object') {
    problems.push(...unknownConfigKeys(observability, OBSERVABILITY_KEYS, 'observability'));
    const observabilityLogs = observability.logs as Record<string, unknown> | undefined;
    if (observabilityLogs && typeof observabilityLogs === 'object') {
      problems.push(...unknownConfigKeys(observabilityLogs, OBSERVABILITY_LOGS_KEYS, 'observability.logs'));
    }
  }
  return problems;
}

/**
 * Validate `_redirects` — the STORE FALLBACK, plus the "no redirects" rule.
 *
 * ⚠️ Apple, verbatim: *"You must host the file using `https://` with a valid
 * certificate and with **no redirects**."* So a rule touching `/.well-known/` is
 * not a style problem — it silently breaks the iOS association.
 */
export function validateRedirects(text: string, packageName: string): string[] {
  const problems: string[] = [];
  const rules = parseRedirects(text);
  const joinPath = `${APP_LINKS_PATH_PREFIX}/*`;
  const joinRule = rules.find((rule) => rule.source === joinPath || rule.source === APP_LINKS_PATH_PREFIX);
  if (!joinRule) {
    problems.push(`no rule redirects ${joinPath} — opened in a browser, the link would dead-end`);
  } else {
    const expected = playListingUrl(packageName);
    if (joinRule.destination !== expected) {
      problems.push(`${joinPath} must point at ${expected} (it is ${JSON.stringify(joinRule.destination)})`);
    }
    if (!(joinRule.code >= 300 && joinRule.code < 400)) {
      problems.push(`${joinPath} must use a redirect status (3xx) — it is ${joinRule.code}`);
    }
  }
  for (const rule of rules) {
    if (rule.source.includes('.well-known')) {
      problems.push(
        `"${rule.source}" must NOT be redirected — Apple requires the association file be hosted "with no redirects"`,
      );
    }
  }
  return problems;
}

/**
 * Validate `_headers` — both association files must be `application/json`.
 *
 * The AASA file has **no extension** (Apple: *"create a file named
 * `apple-app-site-association` (without an extension)"*), so unlike
 * `assetlinks.json` its content type cannot be inferred from the filename.
 */
export function validateHeaders(text: string): string[] {
  const problems: string[] = [];
  const rules = parseHeaders(text);
  for (const file of [AASA_FILE, ASSET_LINKS_FILE]) {
    const path = `${WELL_KNOWN_URL_PATH}/${file}`;
    const rule = rules.find((candidate) => candidate.path === path);
    if (!rule) {
      problems.push(`no rule pins the response headers for ${path}`);
      continue;
    }
    const contentType = rule.headers.find((header) => header.name.toLowerCase() === 'content-type');
    if (!contentType || !contentType.value.toLowerCase().startsWith('application/json')) {
      problems.push(`${path} must be served as application/json (it is ${JSON.stringify(contentType?.value)})`);
    }
  }
  return problems;
}


