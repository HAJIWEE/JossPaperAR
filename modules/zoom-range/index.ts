/**
 * The `zoom-range` local native module (SCRUM-132, option C).
 *
 * ⚠️ Its default export is `null` in any build without the native module — Expo Go
 * included. Read `src/lib/zoom-range.ts` rather than importing this directly: that is
 * where the fallback and the honesty about which number is being shown live.
 */
export { default } from './src/ZoomRangeModule';
export type { ZoomRangePosition } from './src/ZoomRange.types';
