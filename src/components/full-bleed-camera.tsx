/**
 * FULL-BLEED CAMERA — a `CameraView` that cannot measure itself short.
 *
 * ⚠️ WHY THIS COMPONENT EXISTS (SCRUM-135, 2026-10-19 — measured on glass)
 *
 * `expo-camera`'s Android view does NOT honour the height it is given. Its
 * `onMeasure` resolves its own size **from its child `PreviewView`'s measured
 * size**:
 *
 * ```kotlin
 * override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
 *   measureChild(previewView, widthMeasureSpec, heightMeasureSpec)
 *   setMeasuredDimension(
 *     ViewGroup.resolveSize(previewView.measuredWidth, widthMeasureSpec),
 *     ViewGroup.resolveSize(previewView.measuredHeight, heightMeasureSpec)  // ⚠️
 *   )
 * }
 * ```
 *
 * `resolveSize(x, EXACTLY h)` is `h`, so an EXACT spec is safe. But under an
 * **AT_MOST** spec it is `min(x, h)` — so the moment the child measures itself
 * as a SQUARE (which it does before CameraX has resolved the preview), the whole
 * camera view becomes a square and stays one: nothing changes its style, so Yoga
 * never re-measures it, and the wrong size is latched for the screen's lifetime.
 *
 * **Measured, not inferred** — SurfaceFlinger on the reproduction
 * (`25128PC17G`, Android 16, 720 × 1600 px):
 *
 * ```
 * Layer [8944] SurfaceView[host.exp.exponent/…]#8944
 *     bounds={0,0,720,720}   toDisplayTransform={ scale x=1.3333 y=0.7500 }
 * ```
 *
 * A **720 × 720** surface — `360 × 360 dp` on a `360 × 800 dp` screen — with the
 * camera's own `960 × 720` buffer squashed into it, and the view's black
 * background filling the rest. The JS layout was never wrong (`onLayout` on the
 * screen reports `360 × 800`), which is exactly why this was invisible to every
 * gate and to `tsc`.
 *
 * **The fix is to remove the ambiguity.** Once the container has been measured,
 * the camera is given an **explicit pixel width and height**, so its measure spec
 * is EXACTLY the container's on every pass and `resolveSize` has nothing to
 * decide. Setting the size also CHANGES the style, which is what forces the
 * re-measure that unsticks an already-square native view.
 *
 * ⚠️ The wrapper exists only to be measured — it must not change touch routing.
 * `pointerEvents="none"` keeps the camera as touch-transparent as it was when it
 * was a bare child, which `/burn` depends on: the whole screen is one
 * `PanResponder` and an overlay that swallowed the touch would make the throw
 * undemonstrable.
 *
 * ⚠️ All THREE camera screens use this (`/capture`, `/burn`, `/clan/scan`), and
 * `check:framing` §⑥ asserts they do — a bare `<CameraView style={absoluteFill}>`
 * anywhere is the defect coming back.
 */

import { CameraView } from 'expo-camera';
import { useCallback, useState, type ComponentProps, type Ref } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

/** Every prop `expo-camera` accepts, plus the `ref` the two capture screens need. */
type Props = ComponentProps<typeof CameraView> & {
  ref?: Ref<CameraView>;
};

interface Box {
  readonly width: number;
  readonly height: number;
}

export function FullBleedCamera({ style, ref, ...rest }: Props) {
  /**
   * The container's measured box, or `null` before the first layout.
   *
   * ⚠️ `null` MEANS THE CAMERA IS NOT MOUNTED YET — AND THAT IS THE FIX, NOT A
   * CONVENIENCE. Handing the camera an `absoluteFill` for one pass and correcting
   * it afterwards is NOT enough, because `expo-camera` latches the PreviewView
   * from the parent's `measuredWidth/measuredHeight` the moment CameraX adds its
   * own SurfaceView (its init installs a `setOnHierarchyChangeListener` that
   * re-measures and re-lays the PreviewView with EXACTLY specs). If that latch
   * runs while the parent's measured height is a square, the PreviewView is
   * pinned to a square and nothing re-lays it — the parent's own bounds never
   * change again, so `onLayout`'s `if (width != lastWidth || height != lastHeight)`
   * guard never fires.
   *
   * So the camera's FIRST measure must already carry an EXACT height. Mounting it
   * one frame later costs one frame of the screen's own background (a near-black
   * `surface.camera` on every screen that uses this) and removes the race
   * entirely. Measured: the two-pass form still clipped on 2 of 3 runs.
   */
  const [box, setBox] = useState<Box | null>(null);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    // Same size ⇒ same object, so a re-layout cannot loop.
    setBox((previous) => (
      previous !== null && previous.width === width && previous.height === height
        ? previous
        : { width, height }
    ));
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {box !== null && (
        <CameraView
          {...rest}
          ref={ref}
          style={[style, styles.pinned, { width: box.width, height: box.height }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * ⚠️ `position: 'absolute'` WITH an explicit width/height, not `absoluteFill`.
   * `absoluteFill` would set `right`/`bottom` to 0 as well, and a node that is
   * over-constrained on both axes is the ambiguity this component exists to
   * remove.
   */
  pinned: { position: 'absolute', left: 0, top: 0 },
});
