/**
 * native-path.ts — making a `file://` URI loadable by a NATIVE decoder.
 *
 * ⚠️ MEASURED ON GLASS (SCRUM-124, 2026-10-17). Two things are true at once and
 * together they break every native image loader:
 *
 *   1. expo-router percent-encodes route params, so the captured photo arrives
 *      as `…/ExperienceData/%40josspaperar%2Fjoss-paper-ar/Camera/<id>.jpg`;
 *   2. those escapes are a **LITERAL part of the on-disk directory name** —
 *      Expo Go really does create a folder called `%40josspaperar%2F…`.
 *
 * React Native's `fetch` reads that path fine (200, 874,762 bytes measured).
 * But the native loaders (`Image.getSize`, and the bitmap decoder behind
 * `expo-image-manipulator`) parse it as a URI and **decode it once**, landing on
 * `…/@josspaperar/joss-paper-ar/…`, which does not exist:
 *
 *     open failed: ENOENT (No such file or directory)
 *     java.lang.Exception: Loading bitmap failed
 *
 * So the URI must survive exactly ONE decode. Passing it raw loses (drops to
 * `@`), and pre-decoding also loses (same destination). Escaping every `%` as
 * `%25` means the loader's single decode restores the literal path.
 *
 * ⚠️ A plain path with no `%` is returned untouched, so this is a no-op for a
 * real dev/preview build — where the sandbox is `…/app.josspaperar/cache/…` and
 * the encoding never happens.
 */

/**
 * Escape a `file://` URI so a native loader's single URI-decode lands on the
 * literal on-disk path. Non-`file` URIs are returned unchanged.
 *
 * ⚠️ This is the inverse of `unescapeFromNativeLoader` — see the header for why
 * both exist and which consumer needs which.
 */
export function escapeForNativeLoader(uri: string): string {
  if (!uri.startsWith('file://')) return uri;
  return uri.replace(/%/g, '%25');
}

/**
 * Collapse the extra escaping a native API ADDS, so JS `fetch` can read the file.
 *
 * ⚠️ MEASURED (SCRUM-124): `expo-image-manipulator` writes its result and returns
 * a uri that is escaped one level FURTHER than the disk path
 * (`…%2540josspaperar%252F…`). `fetch` does not decode, so it looks for a
 * directory literally named `%2540…` and gets a **14-byte 404 body** — which then
 * passed a naive size check and was uploaded as the offering.
 *
 * So the two consumers want opposite forms and both are needed in one flow:
 *   · the manipulator (native loader) — `escapeForNativeLoader`
 *   · `fetch` (JS, no decoding)      — this function
 */
export function unescapeFromNativeLoader(uri: string): string {
  if (!uri.startsWith('file://')) return uri;
  return uri.replace(/%25/g, '%');
}

/**
 * The form `uploadCapture` expects, from ANY form a screen happens to hold.
 *
 * ⚠️ WHY THIS EXISTS (SCRUM-131). The crop step introduces a SECOND and THIRD way to
 * hold the photo's uri, and `uploadCapture` accepts exactly one of them:
 *
 *   · `escapeForNativeLoader`  — the raw `takePictureAsync` form (`…%40scope%2F…`)
 *   · `unescapeFromNativeLoader` — `fetch` reads it as-is, so `%25` must be collapsed
 *
 * A screen may hold the uri in any of three forms, and they are indistinguishable by
 * inspection (`%40` is a *literal directory name*, not an escape):
 *
 *   1. RAW     `…/ExperienceData/%40scope%2Fslug/Camera/a.jpg`  ← `takePictureAsync`
 *   2. LOADER  `…/ExperienceData/%2540scope%252Fslug/…`         ← any native-loader form
 *   3. DECODED `…/ExperienceData/@scope/slug/Camera/a.jpg`      ← a route param (S60)
 *
 * This function collapses all three onto form 1, which is the only one
 * `uploadCapture` can consume:
 *
 *   · 1 → `nativeLoaderUriFromDecoded` is a no-op (no `@`), `unescape…` has no `%25`
 *   · 2 → `nativeLoaderUriFromDecoded` is a no-op, `unescape…` gives form 1
 *   · 3 → `nativeLoaderUriFromDecoded` rebuilds form 2, `unescape…` gives form 1
 *
 * ⚠️ It is COMPOSED of the two measured helpers rather than re-implemented, so the
 * rules stay in one place and `check:capturesize` asserts this composition on all
 * three forms. Do NOT "simplify" it to `decodeURIComponent` or to a bare `unescape`:
 * either one loses form 3, which is the black-screen case this project has already
 * paid for twice.
 *
 * A non-`file` uri (http, a `data:` uri) is returned unchanged — nothing to rebuild.
 */
export function uploadableUri(uri: string): string {
  if (!uri.startsWith('file://')) return uri;
  return unescapeFromNativeLoader(nativeLoaderUriFromDecoded(uri));
}

/**
 * Rebuild the native-loader form of a captured photo when the route param has
 * **already been decoded** — which is what `useLocalSearchParams` hands a screen.
 *
 * ⚠️ MEASURED ON GLASS (2026-10-18, S60). `escapeForNativeLoader` above assumes the
 * URI still carries `%40…` (the form `takePictureAsync` returns). A screen that
 * reads the same photo out of a **route param** instead gets the DECODED form
 * (`…/ExperienceData/@scope/slug/Camera/a.jpg`), because expo-router decodes it on
 * read — and on that form `escapeForNativeLoader` is a no-op, so the loader still
 * lands on a missing path. Measured with `Image.getSize` on the tutorial's photo:
 *
 *   · `…/@scope/slug/…`              → ENOENT
 *   · `…/%40scope%2Fslug/…`          → ENOENT (the loader decodes it back)
 *   · `…/%2540scope%252Fslug/…`      → **3000 × 4000** ✓
 *
 * So the scope directory has to be re-encoded (`@` → `%40`, `/` → `%2F`) and then
 * escaped once more (`%` → `%25`), because the loader performs exactly ONE decode.
 * The same two facts as the header — the on-disk name is literal, the loader
 * decodes once — applied to a URI that lost its escapes on the way through a param.
 *
 * The marker is `ExperienceData/`, which only Expo Go creates. A dev/preview build
 * (`…/app.josspaperar/cache/…`) has no such segment, so this is a no-op there.
 */
export function nativeLoaderUriFromDecoded(uri: string): string {
  if (!uri.startsWith('file://')) return uri;
  const marker = '/ExperienceData/';
  const at = uri.indexOf(marker);
  if (at === -1) return uri;
  const head = uri.slice(0, at + marker.length);
  const rest = uri.slice(at + marker.length).split('/');
  const [scope, slug] = rest;
  // `@scope/slug` is ONE directory on disk, so it needs two segments to rebuild
  // and at least one more (the leaf file) to be a path at all.
  if (scope === undefined || !scope.startsWith('@') || slug === undefined || rest.length < 3) {
    return uri;
  }
  return `${head}%2540${scope.slice(1)}%252F${slug}/${rest.slice(2).join('/')}`;
}