import { NativeModule, requireOptionalNativeModule } from 'expo';
import type { ZoomRangePosition } from './ZoomRange.types';

/**
 * ⚠️ `requireOptionalNativeModule`, NOT `requireNativeModule` — AND THAT IS LOAD-BEARING.
 *
 * This is a LOCAL native module (SCRUM-132, option C), so it exists only in a
 * **development or standalone build**. `requireNativeModule` THROWS when the module is
 * missing, and Expo Go is exactly that case — so the plain form would crash the app on
 * launch for every glass run, including every run this project has ever done. The
 * optional form returns `null` instead, and `src/lib/zoom-range.ts` falls back to the
 * documented assumed constant and says so.
 *
 * ⚠️ It also means the module must stay ADDITIVE: nothing may depend on it existing,
 * and the app must be fully usable without it.
 */
export declare class ZoomRangeModule extends NativeModule<{}> {
  /**
   * The back (or front) camera's real maximum zoom ratio.
   *
   * ⚠️ RESOLVES `0` WHEN IT CANNOT BE READ — deliberately not a plausible ratio, so
   * the caller can tell "no answer" from "an answer". Call it **after the camera is
   * ready**: on iOS the value belongs to the device's active format, which is only
   * committed once a session exists.
   */
  maxZoomRatio(position: ZoomRangePosition): Promise<number>;
}

export default requireOptionalNativeModule<ZoomRangeModule>('ZoomRange');
