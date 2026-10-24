import { registerWebModule, NativeModule } from 'expo';

/**
 * Web has no camera zoom ceiling to read, and this app's camera screens are
 * mobile-only — so the web build reports `0` ("no answer") and the JS layer falls back
 * to the documented assumed constant. ⚠️ It deliberately does NOT invent a number:
 * a made-up maximum on web would be indistinguishable from a measured one.
 */
class ZoomRangeModule extends NativeModule<{}> {
  async maxZoomRatio(): Promise<number> {
    return 0;
  }
}

export default registerWebModule(ZoomRangeModule, 'ZoomRangeModule');
