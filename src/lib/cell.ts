/**
 * cell.ts — the DEVICE half of the coarse cell (SCRUM-12 · SCRUM-233 option A)
 *
 * The PURE half is `domain/cell.ts` (grid, hashing, bounds — all asserted by `check:domain`).
 * This file only reads the device: permission, a fix, and a module-scoped cache.
 *
 * ── ⚠️⚠️ THE RULE THAT GOVERNS THIS FILE ────────────────────────────────────
 *
 * **A BURN MUST NEVER FAIL, WAIT, OR PROMPT BECAUSE OF LOCATION.**
 *
 * That is not a nicety — it is the design. The ×2.0 is a *bonus*; the burn is the product. So:
 *
 *   • `primeCell()` is called when a screen that may burn MOUNTS, never on the award path, so the
 *     OS permission dialog can never appear after the player has already thrown.
 *   • `currentCell()` is **SYNCHRONOUS** and returns the cache. `postBurn` calls it, so the send
 *     path cannot await the GPS, cannot time out, and cannot throw.
 *   • Every failure — denied, `canAskAgain: false`, indoors, no last-known fix, a malformed
 *     token — returns `null`. ⚠️ `null` means *"no cell, no bonus"*, which is EXACTLY the state
 *     the whole product has shipped in so far, so the degraded path is already proven in
 *     production rather than being new code.
 *
 * ⚠️ **NOTHING IS PERSISTED.** The cache is one module variable. Writing a cell to storage would
 * create a location trail on the device — the one thing the schema forbids (*"NEVER a trail"*).
 * `clearCell()` exists so the delete and the sign-out can drop it; a cached cell surviving an
 * account erasure would re-link a fresh anonymous identity to the old ground.
 */

import * as Location from 'expo-location';

import { cellFor, isValidCell } from '../domain/cell.ts';

/** ⚠️ Deliberately short. A missed fix costs a bonus; a slow fix costs the ritual its timing. */
const FIX_TIMEOUT_MS = 2500;

let cached: string | null = null;
let inFlight: Promise<string | null> | null = null;

/**
 * The token for the CURRENT cached position, or `null`.
 *
 * ⚠️ Synchronous by design — `lib/ritual.ts` calls this inside `postBurn`. If this ever became
 * async, the award path would gain a device dependency it must not have.
 */
export function currentCell(): string | null {
  return cached;
}

/**
 * Forget the cached cell.
 *
 * ⚠️ Called by the account delete and the sign-out: the cell is derived from the DEVICE's
 * position, so leaving it cached across an identity change would attribute the new anonymous
 * user to ground the old one already burned.
 */
export function clearCell(): void {
  cached = null;
}

/** `getCurrentPositionAsync` can hang for many seconds indoors — race it and give up. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

/**
 * Ask for location (once), resolve a fix, cache the cell. Safe to call on every mount.
 *
 * ⚠️ **Single-flight**, like `ensureAnonymousSession()`: two screens mounting together must not
 * produce two permission requests.
 */
export function primeCell(): Promise<string | null> {
  inFlight ??= resolveCell().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function resolveCell(): Promise<string | null> {
  try {
    /**
     * ⚠️ `getForegroundPermissionsAsync()` FIRST, then request only if this device has not been
     * asked. ⚠️ **`canAskAgain === false` means the OS will not show a dialog at all** — calling
     * request anyway is a silent no-op on Android and a wasted frame, so it returns `null`.
     */
    const existing = await Location.getForegroundPermissionsAsync();
    let granted = existing.granted;
    if (!granted) {
      if (!existing.canAskAgain) return null;
      const asked = await Location.requestForegroundPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) return null;

    /**
     * ⚠️⚠️ **LAST-KNOWN FIRST, AND THE SDK DOCS ARE WHY:** `getCurrentPositionAsync` *"may take
     * several seconds to resolve, especially when you're inside a building"* — and a shrine is
     * indoors by definition. A last-known fix is instant and, for a 555 m cell, more than precise
     * enough.
     */
    const last = await Location.getLastKnownPositionAsync();
    const fast = last === null ? null : cellFor(last.coords.latitude, last.coords.longitude);
    if (isValidCell(fast)) {
      cached = fast;
      return fast;
    }

    /**
     * ⚠️ `Accuracy.Lowest` — not thrift, correctness. We deliberately do not want a precise fix:
     * asking for one costs battery, time and (on Android 12+) a *precise* location grant we have
     * no use for. The cell is ~555 m regardless.
     */
    const fix = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }),
      FIX_TIMEOUT_MS,
    );
    if (fix === null) return null;

    const cell = cellFor(fix.coords.latitude, fix.coords.longitude);
    if (isValidCell(cell)) {
      cached = cell;
      return cell;
    }
    return null;
  } catch {
    // ⚠️ A missing/denied location service, a bad native state, a malformed fix — all one answer.
    return null;
  }
}
