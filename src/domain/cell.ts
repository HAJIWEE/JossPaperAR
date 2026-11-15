/**
 * cell.ts — THE COARSE LOCATION CELL (SCRUM-12 · SCRUM-233 **option A**)
 *
 * ⚠️⚠️ **WHY THIS FILE EXISTS AT ALL.** `submit_burn` has accepted a `cell_hash` since it was
 * written, computes `new_ground` from it, and writes `cell_burns` / `grid_cells` — all inside
 * `if v_cell is not null`. ⚠️ **The client never sent one**, so the ×2.0 "new ground" reward had
 * **never fired once** and the reward screen's `newGround` tag could not render. Measured
 * 2026-11-15: `grep -rn 'cell_hash' src/` → nothing.
 *
 * The owner's ruling on SCRUM-233 (2026-11-15) was **option A — device GPS to a coarse hash**,
 * which is what this module turns into a value.
 *
 * ── ⚠️ THE FOUR BOUNDS, AND WHY EACH ONE IS HERE ────────────────────────────
 *
 * The schema already states the contract on `burns.cell_id`:
 *   *"coarse ~4-block cell. **NEVER raw coordinates, NEVER a trail**"*
 *
 *   1. **≤ 16 chars.** `submit_burn` raises `22023` above that — so a 15-char token is not a
 *      stylistic choice, it is the only thing the server will accept.
 *   2. **COARSE.** `CELL_DEG` is ~555 m of latitude, i.e. several blocks and many buildings.
 *      ⚠️ A finer grid would be a location pin wearing a hash: it would be *technically* not raw
 *      coordinates while still singling out a building.
 *   3. **NOT REVERSIBLE.** The grid indices are hashed away, so the token cannot be decoded back
 *      to a latitude/longitude by anyone holding it — including us.
 *   4. **NO TRAIL.** Nothing here keeps state or history. The server stores
 *      `(user_id, cell_id, day)`, which is a SET, not a path — a sequence of daily cells is not
 *      reconstructable as movement.
 *
 * ⚠️ **IT IS PURE ON PURPOSE.** No `expo-location`, no React Native import — so `check:domain`
 * can run it under plain Node, and the coarseness/bounds are asserted by a machine rather than
 * described in a comment. The device half lives in `lib/cell.ts`.
 *
 * ⚠️ **CHANGING ANY CONSTANT HERE IS A DATA MIGRATION, NOT A TWEAK.** Every cell id in
 * `cell_burns` / `grid_cells` would stop matching, so every user would appear to be on "new
 * ground" again and be paid ×2.0 a second time. `CELL_VERSION` exists so a deliberate change is
 * visible in the data instead of silent — bump it and the old rows are at least *distinguishable*.
 */

/** ⚠️ Bump ONLY with a migration for the existing rows. See the header. */
export const CELL_VERSION = '1';

/**
 * The grid step in degrees. **0.005° ≈ 555 m of latitude** at the equator (and ~552 m of
 * longitude at Singapore's latitude) — several city blocks, hundreds of buildings.
 *
 * ⚠️ Chosen to satisfy the schema's *"~4-block"* while staying unmistakably coarse. Do NOT shrink
 * it to make "new ground" more rewarding: that trades a player's privacy for a number.
 */
export const CELL_DEG = 0.005;

/**
 * `submit_burn`'s hard ceiling — `if char_length(cell_hash) > 16 then raise … 'cell_hash is too
 * long (max 16 — a coarse ~4-block cell)'`. Mirrored here so the client can never send a token
 * the server would reject.
 */
export const CELL_MAX_LEN = 16;

/**
 * FNV-1a, 32-bit. ⚠️ `Math.imul` then `>>> 0` — a plain `*` loses the low bits above 2^53 and
 * would make the hash platform-dependent, which is the one property a cell id cannot lose.
 */
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** A 32-bit value in base36, zero-padded to exactly 7 characters (2^32-1 → "1z141z3"). */
function pad7(n: number): string {
  return n.toString(36).padStart(7, '0');
}

/**
 * The coarse cell for a fix, or `null` when the input is not a usable coordinate.
 *
 * ⚠️ **`null` is a normal answer, not an error.** A denied permission, a building, a timeout and
 * bad input all end here, and the caller must treat each as "no bonus", never as a failed burn.
 *
 * ⚠️ **TWO independent hashes** over the same indices, concatenated. A single 32-bit hash gives a
 * ~1 % collision chance across ~10 000 cells — and a collision is not cosmetic here: two distant
 * cells sharing a token would silently refuse a legitimate ×2.0 to a player standing somewhere new.
 */
export function cellFor(lat: number, lng: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // ⚠️ Gulf of Guinea (0,0) is what an unset GPS reports. It is a valid coordinate, but treating
  // it as real ground would hand ×2.0 to every device that failed to fix.
  if (lat === 0 && lng === 0) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;

  const row = Math.floor(lat / CELL_DEG);
  const col = Math.floor(lng / CELL_DEG);

  // ⚠️ `CELL_VERSION` is in the HASHED input as well as the prefix: a version bump must change
  // the hash, or "v2" would collide with the v1 cells it is meant to supersede.
  const seed = `joss-paper/cell/${CELL_VERSION}/${row}/${col}`;
  const cell = CELL_VERSION + pad7(fnv1a(`${seed}/a`)) + pad7(fnv1a(`${seed}/b`));

  // Defence in depth: the server would reject an over-long token, so never build one.
  return cell.length <= CELL_MAX_LEN ? cell : null;
}

/**
 * True when `value` is a token this module could have produced.
 *
 * ⚠️ Used by the gate and by `lib/cell.ts` before caching — a token that fails this is dropped
 * rather than sent, because `submit_burn` grades a malformed `cell_hash` by REJECTING the whole
 * burn, not by ignoring the field.
 */
export function isValidCell(value: unknown): value is string {
  return (
    typeof value === 'string'
    && value.length > 0
    && value.length <= CELL_MAX_LEN
    && /^[0-9a-z]+$/.test(value)
    && value.startsWith(CELL_VERSION)
  );
}
