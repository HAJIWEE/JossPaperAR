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