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

## ⚠️ The files ARE deployed — but two values are still placeholders

Deploying them as-is is **safe**: a fingerprint that matches nothing behaves
exactly like no configuration at all. What it is **not** is *working* — the link
stays **unverified** until the real values are filled.

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

Re-derived from Apple's own documentation (`developer.apple.com`, *"Supporting
associated domains"*) and Cloudflare's, not recalled:

* The file is named `apple-app-site-association` **without an extension**, and
  both live at `https://josspaperar.app/.well-known/<file>`.
* ⚠️ Apple, verbatim: *"You must host the file using `https://` with a valid
  certificate and with **no redirects**."* → **`public/_redirects` must never
  touch `/.well-known/`.** `npm run check:links` asserts this.
* Both files are served as **`application/json`** — pinned in `public/_headers`,
  because the AASA file has *no extension* for a host to infer a type from.
* Apple's CDN fetches the file **within 24 hours**, and devices re-check roughly
  **once per week** after install — so a change is not instant on existing devices.
* ⚠️ After changing either file, **rebuild the native app**.
* Long-standing guidance for this file: serve it **uncompressed** and keep it
  **≤ 128 KB**. Neither appears on Apple's current page; both are cheap to honour.


## The store fallback (the ticket's other half)

The link must land somewhere useful when the app is **not** installed:

* **iOS** — add to the site's `<head>`:
  `<meta name="apple-itunes-app" content="app-id=<ITUNES_ID>" />`
  (Apple's Smart Banner; it prompts the install and only shows when the app is absent.)
* **Android** — ✅ **implemented**: `public/_redirects` sends `/join/*` to the
  Play listing for `app.josspaperar` (302), and `check:links` asserts the target
  package is the **same one `app.json` declares**.
  ⚠️ A plain redirect *is* the correct fallback, not a shortcut: the OS intercepts
  an App Link **before** any HTTP request leaves the device, so reaching this rule
  already proves the app did not take the link.
  ⚠️ Deferred deep-linking (carrying `{CODE}` through the install) needs the Play
  Install Referrer read in-app — a native capability this app does not have yet.
  Deliberately **not faked**.

## The two prerequisites

1. **The domain exists and serves these files** — ✅ **DONE, proven live 2026-10-11.**
   `josspaperar.app` (registered 2026-10-10 via Cloudflare Registrar, renews
   **2027-10-10**) serves both files with a valid certificate and **no redirects**.
   Measured, not assumed:

   | Check | Result |
   |---|---|
   | `/.well-known/assetlinks.json` | **200** · `application/json` · `redirects=0` |
   | `/.well-known/apple-app-site-association` | **200** · `application/json` · `redirects=0` |
   | `/join/{CODE}` | **302** → the Play listing for `app.josspaperar` |
   | TLS | valid (`ssl_verify_result=0`) |

   ⚠️ **`redirects=0` is the load-bearing number** — Apple requires the file be
   hosted *"with no redirects"*, and a single `301` here breaks iOS silently.
   ⚠️ The root `/` returns **404 with an empty body**. That is **correct, not a
   fault**: this host exists to serve these two files and the store fallback, not
   a website. (`curl https://josspaperar.app/` legitimately prints nothing.)
2. **A signed build exists**, so the Android fingerprint is knowable.

## Deploying it — the hosting config

⚠️ The deploy config lives **in this repo** and is asserted by `check:links`,
because a missing deploy config fails **exactly as silently** as a wrong one:

| File | What it does |
|---|---|
| `wrangler.jsonc` | tells `npx wrangler deploy` to publish `public/` as an **assets-only** Worker |
| `public/_redirects` | the **store fallback** — `/join/*` → the Play listing (302) |
| `public/_headers` | serves both association files as `application/json` |

The flow currently offered for this repo is **Workers Builds**
(`Worker → Settings → Build`). Its four fields:

| Field | Value |
|---|---|
| **Build command** | *(leave empty)* — no build step; the files are already static |
| **Deploy command** | `npx wrangler deploy` *(the default — keep it)* |
| **Preview command** | *(keep the default)* |
| **Path** | `/` — the repo root, where `wrangler.jsonc` lives |

⚠️ **`Path` must be the repo root, and the `name` in `wrangler.jsonc` must match
the project you created in the dashboard.** If they differ you get a **second,
empty Worker** and every `.well-known` URL 404s.

Then **Custom domains → Set up a domain → `josspaperar.app`**. Keep the project on
the **same Cloudflare account** as the zone — Cloudflare requires the apex domain
to be a zone on that account, and it writes the DNS record for you.

**Verify with a real call** — the only thing that settles it:

```bash
curl -sI https://josspaperar.app/.well-known/assetlinks.json             # 200 + application/json
curl -s  https://josspaperar.app/.well-known/apple-app-site-association
```

Until both are true, `app.json` is correct and complete, the in-app path
(QR · scanner · custom scheme `josspaperar://join?code=…`) already works, and
that is the whole of what can be verified. See `SCRUM-89`.
