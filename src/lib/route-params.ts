/**
 * route-params.ts — the ritual's ROUTE CONTRACT, as code.
 *
 * WHY THIS FILE EXISTS (and why it is not "just" two objects)
 *
 * Each hop of the slice is a route push, and every hop must carry the
 * **capture id** onward: it is what the award is keyed to, and rule ① means no
 * later step can re-derive it (the id was minted on the capture screen, before
 * the upload; nothing server-side knows which offering this is).
 *
 * The bug this file was written for, found 2026-10-06: `burn.tsx` pushed to
 * `/reward` with `{ offsetPx, throwNumber }` and **no `captureId`**, because the
 * burn screen never read its own route params at all. `reward.tsx` then refused
 * with a generic `bad_params`, so the last screen of the slice could never show a
 * receipt — the slice could not complete. Nothing in the type system objected,
 * because expo-router params are `Record<string, string | string[] | undefined>`:
 * every hop is untyped by construction, and a dropped key fails at run time on a
 * device, in the one place the player was expecting a reward.
 *
 * So the contract lives here, in a pure module, and `npm run check:wire` asserts
 * it — including the **regression itself**: a reward route with no capture id
 * must be *refused by name* (`missing_capture_id`), not coerced to `undefined`.
 *
 * Deliberately free of React and of expo-router, so plain Node can check it.
 */

import { DEMO_VALUE, isDemo } from './tutorial.ts';

/**
 * ⚠️ A **TYPE ALIAS**, not an `interface` — and that is load-bearing.
 *
 * expo-router types `router.push({ params })` as `UnknownInputParams`, which is an
 * index-signature record (`Record<string, …>`). TypeScript gives **implicit index
 * signatures to object type aliases but NOT to `interface` declarations**, so an
 * `interface` here fails `tsc` with *"Type 'RewardParams' is not assignable to
 * type 'UnknownInputParams'"* — which is exactly what CI caught on PR #23
 * (2026-10-06, `src/app/burn.tsx:129`). Nothing at runtime changes; the shape is
 * identical. Keep it an alias.
 */
export type RewardParams = {
  readonly captureId: string;
  /** Sent as a string — expo-router params are strings on the wire. */
  readonly offsetPx: string;
  readonly throwNumber: string;
  /**
   * SCRUM-85: `DEMO_VALUE` when this hop belongs to the first-run TUTORIAL.
   * ⚠️ It must survive EVERY hop — a demo flag dropped at one hop turns the
   * tutorial into a real, paying ritual. `check:wire` asserts it does.
   */
  readonly demo?: string;
};

/** Same alias rule as `RewardParams` above — see that note. */
export type BurnParams = {
  readonly captureId: string;
  readonly uri: string;
  readonly demo?: string;
};

/** expo-router hands a param back as `string | string[]`; take the first. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Build the `/reward` params. The only sanctioned way to reach that screen: the
 * capture id is a **required argument**, so a caller cannot forget it the way
 * `burn.tsx` did.
 *
 * `demo` is optional and omitted entirely when false, so a REAL ritual's URL is
 * byte-identical to before this flag existed — the tutorial cannot make the
 * normal path grow a param it never had.
 */
export function toRewardParams(
  captureId: string,
  offsetPx: number,
  throwNumber: number,
  demo = false,
): RewardParams {
  return {
    captureId,
    offsetPx: String(offsetPx),
    throwNumber: String(throwNumber),
    ...(demo ? { demo: DEMO_VALUE } : {}),
  };
}

/** Build the `/burn` params (preparing → burn). */
export function toBurnParams(captureId: string, uri: string, demo = false): BurnParams {
  return { captureId, uri, ...(demo ? { demo: DEMO_VALUE } : {}) };
}

export type RewardParamProblem = 'missing_capture_id' | 'bad_accuracy' | 'bad_throw_number';

export type RewardParamRead =
  | {
      readonly ok: true;
      readonly captureId: string;
      readonly accuracyPx: number;
      readonly throwNumber: number;
      /** SCRUM-85 — true when this hop is the first-run TUTORIAL. */
      readonly demo: boolean;
    }
  | { readonly ok: false; readonly reason: RewardParamProblem };

/**
 * Read and validate `/reward`'s params.
 *
 * Strictness is the point. The old screen checked only `captureId` and coerced
 * the numbers with `Number(...)`, so `Number(undefined)` produced `NaN` and the
 * award was submitted with a `NaN` offset — a failure the server would refuse
 * with nothing useful to show the player. Each field now has a named refusal.
 */
export function readRewardParams(raw: {
  readonly captureId?: string | string[];
  readonly offsetPx?: string | string[];
  readonly throwNumber?: string | string[];
  readonly demo?: string | string[];
}): RewardParamRead {
  const captureId = first(raw.captureId)?.trim() ?? '';
  if (captureId.length === 0) return { ok: false, reason: 'missing_capture_id' };

  const offsetRaw = first(raw.offsetPx);
  const accuracyPx = Number(offsetRaw);
  // `Number('')` is 0 and `Number(' ')` is 0, which would silently become a
  // bullseye. Only an explicit, finite, non-negative value is accepted.
  if (offsetRaw === undefined || offsetRaw.trim() === '' || !Number.isFinite(accuracyPx) || accuracyPx < 0) {
    return { ok: false, reason: 'bad_accuracy' };
  }

  // Absent means "the first throw" — the only safe default, because a missing
  // throw number can only under-count (the server grades the band regardless).
  const throwRaw = first(raw.throwNumber);
  const throwNumber = throwRaw === undefined || throwRaw.trim() === '' ? 1 : Number(throwRaw);
  if (!Number.isInteger(throwNumber) || throwNumber < 1) {
    return { ok: false, reason: 'bad_throw_number' };
  }

  return {
    ok: true,
    captureId,
    accuracyPx,
    throwNumber,
    // ⚠️ Anything but the exact marker is NOT a demo — an unreadable flag must
    // fall through to the REAL ritual, where the server is the authority. The
    // reverse default would let a bad param silently skip a paying award.
    demo: isDemo(first(raw.demo)),
  };
}

/** Read and validate `/burn`'s params. Same rule: the id is not optional. */
export function readBurnParams(raw: {
  readonly captureId?: string | string[];
  readonly uri?: string | string[];
  readonly demo?: string | string[];
}): {
  readonly ok: true;
  readonly captureId: string;
  readonly uri: string;
  readonly demo: boolean;
} | { readonly ok: false; readonly reason: 'missing_capture_id' | 'missing_uri' } {
  const captureId = first(raw.captureId)?.trim() ?? '';
  if (captureId.length === 0) return { ok: false, reason: 'missing_capture_id' };
  const uri = first(raw.uri)?.trim() ?? '';
  if (uri.length === 0) return { ok: false, reason: 'missing_uri' };
  return { ok: true, captureId, uri, demo: isDemo(first(raw.demo)) };
}
