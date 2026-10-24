package expo.modules.zoomrange

import android.content.Context
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * ZoomRange — the device's REAL maximum zoom ratio (SCRUM-132, option C).
 *
 * ⚠️ WHY THIS MODULE EXISTS. `expo-camera`'s `zoom` prop takes a **fraction of the
 * device's maximum** and the package exposes **no way to read that maximum** — so a
 * stop labelled "2×" was a claim solved against an assumed 8× ceiling. This module
 * answers the one question the JS layer needs to make that label honest.
 *
 * ⚠️ IT READS THE SAME SOURCE CameraX DOES, not a proxy. `ExpoCameraView.kt:649`
 * computes `maxZoomRatio` from `camera.cameraInfo.zoomState.value.maxZoomRatio`,
 * and CameraX derives that from this camera's `CONTROL_ZOOM_RATIO_RANGE` — the
 * identical `CameraCharacteristics` read here. ⚠️ It is a **static** read of the
 * camera's capabilities, so it does NOT open the camera and cannot fight
 * `expo-camera`'s own session.
 *
 * ⚠️ `0.0` MEANS "I COULD NOT READ IT" — deliberately not a plausible zoom ratio.
 * The caller falls back to the documented assumed constant and says so, rather than
 * silently inventing a maximum. `LENS_FACING_BACK` is the ritual's camera
 * (`<FullBleedCamera facing="back" />`), and if no back camera is reported the module
 * answers 0 rather than borrowing the front camera's range.
 */
class ZoomRangeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ZoomRange")

    AsyncFunction("maxZoomRatio") { position: String? ->
      val wantedFacing = if (position == "front") {
        CameraCharacteristics.LENS_FACING_FRONT
      } else {
        CameraCharacteristics.LENS_FACING_BACK
      }

      val context: Context = appContext.reactContext ?: return@AsyncFunction 0.0
      val manager = context.getSystemService(Context.CAMERA_SERVICE) as? CameraManager
        ?: return@AsyncFunction 0.0

      for (id in manager.cameraIdList) {
        val characteristics = try {
          manager.getCameraCharacteristics(id)
        } catch (error: Throwable) {
          // A camera can disappear mid-enumeration; skip it rather than fail the read.
          continue
        }

        if (characteristics.get(CameraCharacteristics.LENS_FACING) != wantedFacing) {
          continue
        }

        // API 30+ — the ratio range CameraX itself reports. This is the exact answer.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          val upper = characteristics.get(CameraCharacteristics.CONTROL_ZOOM_RATIO_RANGE)?.upper ?: 0f
          if (upper > 0f) return@AsyncFunction upper.toDouble()
        }

        // Below API 30 there is no zoom-RATIO range; the digital-zoom ceiling is the
        // nearest equivalent, and it is what CameraX itself falls back to.
        val digital = characteristics.get(CameraCharacteristics.SCALER_AVAILABLE_MAX_DIGITAL_ZOOM) ?: 0f
        if (digital > 0f) return@AsyncFunction digital.toDouble()
      }

      0.0
    }
  }
}
