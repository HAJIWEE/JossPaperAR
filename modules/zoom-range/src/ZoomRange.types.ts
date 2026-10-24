/**
 * The NATIVE module's own contract.
 *
 * ⚠️ The app's zoom-CEILING type is deliberately NOT here — it lives in
 * `src/lib/zoom-ceiling.ts`, because that file must stay importable under plain `node`
 * (the gate runs there) while this one pulls in `expo`. Two files, one reason: keep
 * the policy testable without a native runtime.
 */
export type ZoomRangePosition = 'back' | 'front';
