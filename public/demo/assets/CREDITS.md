# Assets · credits & licences

Everything else in this prototype is **generated or hand-authored in this repo** (the car artwork is SVG produced by
`tools/gen-car-3d.js`; the styling is in `styles.css`). This is the only third-party file.

## `car-real.jpg` — the photo the camera "sees"

- **Shows:** 2022 Mercedes-Benz A 220 4Matic sedan (Denim Blue), front-right 3/4 view
- **Source:** Wikimedia Commons — [File:2022 Mercedes-Benz A 220 4Matic Sedan in Denim Blue Metallic, Front Right, 06-29-2023.jpg](https://commons.wikimedia.org/wiki/File:2022_Mercedes-Benz_A_220_4Matic_Sedan_in_Denim_Blue_Metallic,_Front_Right,_06-29-2023.jpg)
- **Author:** Elise240SX (own work)
- **Licence:** [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) — attribution required, share-alike
- **What we changed:** resized to 900 px wide, EXIF stripped. No other edits.

## `car-real-panel.jpg` — the same photo, sized for the compare slider

A derivative of `car-real.jpg`, used only by the transform screen's *before* panel.

- **What we changed:** padded 153 px of stretched top-row sky above the frame, so the file's aspect is **1.372** —
  exactly the cartoon stage's `viewBox` (243 × 177.1). The panel then shows the photograph with `contain`, which
  lands it in the same on-screen band as the generated offering: same width, same centre, no zoom, no blur.
- The car inside that band is ~97 % of the frame's width (the offering's is ~94 %), so the two read at the same
  size; the offering is additionally drawn at 85 % (`STAGES['transform-after'].zoom` in `tools/gen-car-3d.js`)
  because the orthographic camera sees the roof while the photo is a low-angle shot. Regenerate this file from
  the swap-in photo with:

```sh
cd prototype/assets
magick car-real.jpg -crop $(magick identify -format '%w' car-real.jpg)x1+0+0 +repage -resize 900x153! /tmp/pad.png
magick /tmp/pad.png car-real.jpg -append car-real-panel.jpg
```

⚠️ **Placeholder.** It stands in for *the user's own photo of their own object* — which is precisely what the app
receives, and what the capture screen is claiming to show. Because it is CC BY-SA, swap both files for your own
photograph before this mockup is shared or published: it is better for the product story (it should be the
family's real car) and it removes the licence question entirely. Only the filenames are referenced
(`styles.css`), so replacing the files is enough.
