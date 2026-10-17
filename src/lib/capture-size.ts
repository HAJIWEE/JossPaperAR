/**
 * capture-size.ts — the UPLOAD BUDGET, as a decision rather than a hope.
 *
 * ⚠️ WHY THIS FILE EXISTS (SCRUM-124, found on glass 2026-10-17):
 *
 * The `captures` bucket has `file_size_limit = 307200` (300 KB). The capture
 * screen used `takePictureAsync({ quality: 0.7 })` and believed that kept the
 * photo inside the budget — it does not. `quality` bounds the ENCODER QUALITY at
 * the sensor's full resolution, so on a real 50 MP-class phone the JPEG was
 * megabytes. Storage answered `413 Payload too large`, `uploadCapture` threw,
 * and `/preparing` correctly marked the offering `spent`.
 *
 * It never showed up on the emulator because a virtual camera produces a ~10 KB
 * image — two orders of magnitude under the limit.
 *
 * So the budget lives here, as numbers a gate can read, and `uploadCapture`
 * SHRINKS the bytes until they fit instead of hoping. `check:capturesize`
 * asserts this policy and that the upload path still applies it.
 *
 * ⚠️ If the bucket's limit ever changes, it changes in a NEW migration (never an
 * edit to an applied one) AND here — `check:capturesize` fails if the two drift.
 */

/** The bucket's hard limit. Mirrors `storage.buckets.file_size_limit`. */
export const CAPTURE_BUCKET_MAX_BYTES = 307_200;

/**
 * The smallest thing we will believe is a photo.
 *
 * ⚠️ MEASURED (SCRUM-124): a failed read returns the error BODY, not an error —
 * a 14-byte `{"message":…}` blob passed a "positive and under the limit" check
 * and was uploaded as the offering, then died at the next step. The floor is as
 * load-bearing as the ceiling.
 *
 * ⚠️ A JPEG magic-byte check was tried and REJECTED: React Native's `Blob` has no
 * usable `slice(…).arrayBuffer()`, so reading the first three bytes threw
 * `undefined is not a function`. The size floor catches the same failure without
 * a native API we cannot rely on.
 */
export const CAPTURE_MIN_BYTES = 1_024;

/** Longest edge we will send. 1080 keeps a phone photo legible for the styler. */
export const CAPTURE_MAX_EDGE_PX = 1080;

/** First compression attempt. */
export const CAPTURE_COMPRESS = 0.6;

/** How many times we will shrink before giving up and saying so. */
export const CAPTURE_SHRINK_ATTEMPTS = 3;

/** Never shrink below this edge — a smaller image stops being worth styling. */
export const CAPTURE_MIN_EDGE_PX = 640;

/** The compression floor across attempts. */
export const CAPTURE_MIN_COMPRESS = 0.3;

/** `true` when these bytes fit the bucket. Rejects 0/NaN rather than passing them. */
export function withinCaptureBudget(bytes: number): boolean {
  return Number.isFinite(bytes) && bytes > 0 && bytes <= CAPTURE_BUCKET_MAX_BYTES;
}

/**
 * `true` when these bytes really are something we can upload.
 *
 * ⚠️ Both halves were earned on glass: the CEILING alone let a **14-byte error
 * body** through, and the FLOOR alone would accept any large junk.
 */
export function isUploadableCaptureSize(bytes: number): boolean {
  return withinCaptureBudget(bytes) && bytes >= CAPTURE_MIN_BYTES;
}

/**
 * The parameters for shrink attempt `attempt` (0-based).
 *
 * Pure on purpose: the gate can assert the whole progression without a device.
 * Attempt 0 is the policy above; each later attempt drops the edge by 20% and
 * the compression by 0.2, both floored so quality never collapses.
 */
export function shrinkStep(attempt: number): { edge: number; compress: number } {
  const exp = Math.max(0, Math.floor(attempt));
  const decayed = Math.round(CAPTURE_MAX_EDGE_PX * Math.pow(0.8, exp));
  return {
    edge: Math.max(CAPTURE_MIN_EDGE_PX, decayed),
    compress: Math.max(CAPTURE_MIN_COMPRESS, Number((CAPTURE_COMPRESS - 0.2 * exp).toFixed(2))),
  };
}
