import AVFoundation
import ExpoModulesCore

/**
 * ZoomRange — the device's REAL maximum zoom ratio (SCRUM-132, option C).
 *
 * ⚠️ WHY THIS MODULE EXISTS. `expo-camera`'s `zoom` prop takes a **fraction of the
 * device's maximum** and the package exposes **no way to read that maximum** — so a
 * stop labelled "2×" was a claim solved against an assumed 8× ceiling. This module
 * answers the one question the JS layer needs to make that label honest.
 *
 * ⚠️ iOS IS THE HARDER PLATFORM, AND THE REASON IS `activeFormat`. iOS has no single
 * zoom ceiling per device: `videoMaxZoomFactor` belongs to the device's **active
 * format**, and the format is chosen by the session preset —
 * `CameraSessionManager.swift` sets `session.sessionPreset`. So the honest value is
 * whatever that session committed.
 *
 * ⚠️ WHICH IS WHY THE READ MUST HAPPEN **AFTER THE CAMERA IS READY**:
 * `device.activeFormat` reflects the *committed* configuration, so reading it while
 * `expo-camera`'s session is live returns exactly the format `expo-camera` is using.
 * Reading it before any session exists returns the default format's ceiling, which
 * can differ. That ordering is the caller's responsibility, and `src/lib/zoom-range.ts`
 * documents it.
 *
 * ⚠️ `0.0` MEANS "I COULD NOT READ IT" — deliberately not a plausible zoom ratio.
 * The caller falls back to the documented assumed constant and says so, rather than
 * silently inventing a maximum.
 */
public class ZoomRangeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ZoomRange")

    AsyncFunction("maxZoomRatio") { (position: String?) -> Double in
      let wanted: AVCaptureDevice.Position = (position == "front") ? .front : .back

      // The wide-angle device is the one a `facing="back"` preview uses; the plain
      // `.video` default is the fallback when that specific device is unavailable.
      guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: wanted)
        ?? AVCaptureDevice.default(for: .video)
      else {
        return 0
      }

      let maxZoom = device.activeFormat.videoMaxZoomFactor
      guard maxZoom.isFinite, maxZoom > 0 else {
        return 0
      }
      return Double(maxZoom)
    }
  }
}
