# `.well-known/` — the two files that make the invite link real

These are the **website half** of the two-way association that turns
`https://josspaperar.app/join/{CODE}` into a link that opens the app instead of
the browser (doc 07 §4.6 · **SCRUM-89**). Android reads `assetlinks.json`;
iOS reads `apple-app-site-association`. Expo's guides:
`docs.expo.dev/linking/android-app-links/` · `docs.expo.dev/linking/ios-universal-links/`.

⚠️ **A universal link configured wrong fails *silently and identically* to not
being configured at all** — Android just opens the browser. So verify with a
**real tap**, or `adb shell pm get-app-links app.josspaperar` reporting `verified`.
⚠️ `adb shell am start -a android.intent.action.VIEW -d "https://…"` does **NOT**
prove it — that bypasses the association check.

---

## ⛔ These files are NOT ready to deploy — two values are placeholders

Both can only be known **after a signed build**, so they are **all-zero
sentinels** that cannot be mistaken for real values:

| Placeholder | File | Where the real value comes from |
|---|---|---|
| `sha256_cert_fingerprints` — `00:00:…:00` | `assetlinks.json` | the app's **signing certificate**: from an **EAS build** (`eas credentials`), or the local debug keystore's SHA-256 |
| `appID` — `0000000000.app.josspaperar` | `apple-app-site-association` | the **Apple Developer Team ID** + the bundle id (iOS is deferred — ADR-001/ADR-003) |

`npm run check:links` **checks the structure and the cross-file agreement** and
prints a **RELEASE GUARD** while a sentinel is still in place. It cannot fill
them for you, and it does not pretend to.

## Serving rules (both files)

* URL: `https://josspaperar.app/.well-known/<file>` — HTTPS only.
* `assetlinks.json` must be served as `content-type: application/json`.
* The AASA file must be served **uncompressed**, and must be **≤ 128 KB**.
* ⚠️ After changing either file, **rebuild the native app** — Apple and Google
  cache the association on the device and re-fetch it on the vendor's schedule.

## The store fallback (the ticket's other half)

The link must land somewhere useful when the app is **not** installed:

* **iOS** — add to the site's `<head>`:
  `<meta name="apple-itunes-app" content="app-id=<ITUNES_ID>" />`
  (Apple's Smart Banner; it prompts the install and only shows when the app is absent.)
* **Android** — `https://josspaperar.app/join/{CODE}` must **serve a page that
  redirects to the Play listing** for `app.josspaperar` when it is opened in a
  browser. That page is a **hosting** artefact on the domain, not part of this
  app repo.

## The two prerequisites (both are NOT this repo's to satisfy)

1. **The domain exists and resolves** — `SCRUM-56` item #6, a PM action.
2. **A signed build exists**, so the Android fingerprint is knowable.

Until both are true, `app.json` is correct and complete, the in-app path
(QR · scanner · custom scheme `josspaperar://join?code=…`) already works, and
that is the whole of what can be verified. See `SCRUM-89`.
