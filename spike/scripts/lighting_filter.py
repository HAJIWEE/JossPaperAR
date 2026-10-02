#!/usr/bin/env python3
"""Lighting-normalisation filter — spec of record: spike/results/RESULTS.md (§3, "spec of record").

illumination map = Gaussian-blurred luminance (radius = longest edge / radius_div [default 48], floor 0.03 px)
  -> divide RGB by it
  -> exposure-restore (alpha-weighted mean-luminance match to the original)
  -> highlight-gamma (soft-knee compression above `knee`, asymptoting to 1.0)
  -> re-apply the original alpha.

Usage:
  lighting_filter.py IN.png OUT.png [--radius-div 48] [--knee 0.7] [--knee-strength 1.0]

Aggressive preset (round 5 test): --radius-div 96 --knee 0.45 --knee-strength 0.5
"""
import argparse
import numpy as np
from PIL import Image, ImageFilter

LUM = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)


def light_filter(img, radius_div=48.0, knee=0.7, knee_strength=1.0):
    im = img.convert("RGBA")
    arr = np.asarray(im).astype(np.float32) / 255.0
    rgb, alpha = arr[..., :3], arr[..., 3:4]

    lum = rgb @ LUM
    L = Image.fromarray((np.clip(lum, 0, 1) * 255).astype(np.uint8), "L")
    radius = max(max(L.size) / radius_div, 0.03)
    illum = np.asarray(L.filter(ImageFilter.GaussianBlur(radius))).astype(np.float32) / 255.0
    illum = np.maximum(illum, 1e-3)

    out = rgb / illum[..., None]

    # exposure-restore: alpha-weighted mean luminance back to the original level
    m_out = float(((out @ LUM) * alpha[..., 0]).sum() / max(alpha[..., 0].sum(), 1e-6))
    m_org = float((lum * alpha[..., 0]).sum() / max(alpha[..., 0].sum(), 1e-6))
    out *= m_org / max(m_out, 1e-6)

    # highlight-gamma: soft-knee compression above `knee`, asymptotic to 1.0
    v = out - knee
    out = np.where(out > knee, knee + (1.0 - knee) * (1.0 - np.exp(-v / (1.0 - knee) * knee_strength)), out)

    out = np.clip(out, 0.0, 1.0)
    res = np.concatenate([out, alpha], axis=-1)
    return Image.fromarray((res * 255).astype(np.uint8), "RGBA")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inp")
    ap.add_argument("out")
    ap.add_argument("--radius-div", type=float, default=48.0)
    ap.add_argument("--knee", type=float, default=0.7)
    ap.add_argument("--knee-strength", type=float, default=1.0)
    a = ap.parse_args()
    img = Image.open(a.inp)
    light_filter(img, a.radius_div, a.knee, a.knee_strength).save(a.out)
    print(f"wrote {a.out} (radius_div={a.radius_div}, knee={a.knee}, strength={a.knee_strength})")


if __name__ == "__main__":
    main()
