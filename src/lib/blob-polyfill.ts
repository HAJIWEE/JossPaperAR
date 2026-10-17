/**
 * blob-polyfill.ts — install `expo-blob`'s Blob as `globalThis.Blob`.
 *
 * ── WHY THIS FILE EXISTS (read from the SDK 57 source, not from memory) ──────
 * In SDK 57 `expo/fetch` is also installed as the GLOBAL `fetch` (see
 * `expo/src/winter/runtime.native.ts`; set `EXPO_PUBLIC_USE_RN_FETCH=1` to opt
 * out). Its `Response.blob()` chooses how to build the returned Blob like this
 * (`packages/expo/src/winter/fetch/FetchResponse.ts`):
 *
 *     if (isReactNativeBlobGlobal()) {
 *       // ⚠️ console.warn("Response.blob() is using React Native's Blob, which
 *       //    copies the response into the native blob store and reads it back
 *       //    through base64 encoding. This may be slow for large responses.
 *       //    Add the `expo-blob` package …")
 *       return createReactNativeBlobAsync(buffer, type);
 *     }
 *     return new Blob([buffer], { type });
 *
 * …and `isReactNativeBlobGlobal()` is literally
 * (`packages/expo/src/winter/fetch/createBlob.ts`):
 *
 *     globalThis.Blob === require('react-native/Libraries/Blob/Blob').default
 *
 * ⚠️ SO INSTALLING `expo-blob` ALONE CHANGES NOTHING. Expo says so itself —
 * `createBlob.ts` carries the comment
 * `TODO(kudo,20260706): remove this when we install expo-blob as globalThis.Blob`.
 * Until the global IS swapped, every `.blob()` still round-trips its bytes
 * through React Native's native `BlobManager` as base64: the slow path the
 * warning describes.
 *
 * ── WHY THIS IS THE FIX FOR THE UPLOAD, NOT JUST FOR `.blob()` ──────────────
 * `uploadCapture` (`src/lib/ritual.ts`) is the one `.blob()` caller in this app,
 * and it runs on EVERY photo. It feeds the Blob to `supabase.storage.upload`,
 * and `@supabase/storage-js` wraps a Blob in a `FormData`
 * (`if (typeof Blob !== 'undefined' && fileBody instanceof Blob) { body = new
 * FormData(); … body.append('', fileBody) }`). `expo/fetch` then serialises that
 * part via `blobToArrayBufferAsync` (`packages/expo/src/utils/blobUtils.ts`),
 * which prefers `blob.arrayBuffer()`:
 *
 *   · react-native's Blob → `FileReader` → `BlobManager` → base64  (slow)
 *   · expo-blob's Blob    → `arrayBuffer()` → a native byte read   (no base64)
 *
 * So one swap removes the base64 round-trip from BOTH copies of the bytes.
 *
 * ── WHY IT IS A SIDE-EFFECT MODULE, IMPORTED FIRST ──────────────────────────
 * `isReactNativeBlobGlobal()` is evaluated lazily, once per `.blob()` call, so
 * the swap only has to land before the FIRST `.blob()`. Importing this module
 * from the root layout (`src/app/_layout.tsx`) is therefore early enough — and
 * keeping it in ONE file means the swap cannot be "tidied away" from a screen.
 *
 * ⚠️ `expo-blob` is a NATIVE module: it calls `requireNativeModule('ExpoBlob')`
 * at import time (`node_modules/expo-blob/build/ExpoBlob.js`), publishing as
 * `expo.modules.blob`. It is included in Expo Go for SDK 57, but a DEVELOPMENT
 * BUILD made before this change does not contain it — remaking it
 * (`npx expo run:android` · `eas build --profile development`) is REQUIRED, and
 * without it this import throws at startup rather than degrading.
 *
 * ⚠️ Version pinned to `~57.0.2` ON PURPOSE. `expo-blob` is absent from SDK 57's
 * `bundledNativeModules.json`, so a bare `npx expo install expo-blob` resolves
 * `latest` — which is the SDK **58** native module — into an SDK 57 app. On
 * SDK 57 the correct release is **57.0.2**.
 */

import { Blob as ExpoBlob } from 'expo-blob';

/** The global as an untyped slot: `globalThis.Blob`'s lib type is not `expo-blob`'s class. */
const globals = globalThis as unknown as { Blob?: unknown };

/**
 * Idempotent: a second import (Fast Refresh, or a future Expo runtime doing this
 * for us) must not churn the identity, because `instanceof Blob` checks that are
 * already in flight would silently change meaning mid-request.
 */
if (globals.Blob !== ExpoBlob) {
  globals.Blob = ExpoBlob;
}

/**
 * True when the fast implementation is the live global — i.e. when
 * `expo/fetch`'s `isReactNativeBlobGlobal()` will answer `false` and the base64
 * path is off. Exported so the swap can be inspected in a dev session (and so a
 * future check has something to read) rather than only inferred from the absence
 * of Expo's warning.
 */
export const expoBlobInstalled: boolean = globals.Blob === ExpoBlob;