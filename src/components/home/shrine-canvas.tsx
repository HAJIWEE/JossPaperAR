/**
 * The shrine canvas — the 390 × 844 board, contain-fitted to the device (SCRUM-162).
 *
 * ── WHY A CANVAS AND NOT A FLOW ─────────────────────────────────────────────
 * ⚠️ The shrine is a **fixed-art composition**: the altar, the halo, the CTA and the tab
 * bar are drawn at specific y-coordinates on one board and must keep those proportions.
 * The first pass stacked them as flow children with `marginBottom`, which **discarded
 * every measured y** — that is why the placement was wrong on glass.
 *
 * So: one canvas at `390 × s` by `844 × s`, and every element placed absolutely from
 * `HOME_BANDS` through `bandRect`.
 *
 * ── RESPONSIVENESS ──────────────────────────────────────────────────────────
 * `s = homeFitScale(w, h)` — the **smaller** of width/390 and height/844 — so the whole
 * shrine always fits and is **never** squashed or clipped:
 *
 *   · 360 × 800 phone  → 0.923 (width-limited: it fills the screen)
 *   · 800 × 1280 tablet → 1.517 (height-limited: centred, with side margins)
 *   · 320 × 568 small  → 0.673 (height-limited: everything smaller, still whole)
 *
 * ⚠️ The margins on a tall/fat device are **deliberate negative space**, not a defect.
 * ⚠️ `justifyContent: 'center'` keeps it centred on both axes; the `ScrollView` is only a
 * safety net for an exotic window (a split-screen half, a keyboard-raised viewport) —
 * with contain-fit it should never engage.
 */

import type { ReactNode } from 'react';
import { Dimensions, ScrollView, View } from 'react-native';

import { REFERENCE_HEIGHT, homeFitScale } from '@/lib/home-layout';
import { DESIGN_REFERENCE_WIDTH } from '@/theme/tokens';
import { surface } from '@/theme/tokens';

/**
 * ⚠️ **`Dimensions.get('screen')`, NOT `useWindowDimensions()`.**
 * On glass the window is **345 × 745** inside a 360 × 800 screen, so containing the board in the
 * window letterboxes it on all four sides — the "white space at the sides, top and bottom". The
 * app's root does span the full screen, so the canvas is sized to the screen and pinned to its
 * top-left corner; nothing is centred in a smaller box.
 */
export function ShrineCanvas({ children }: { children: ReactNode }) {
  const screen = Dimensions.get('screen');
  const s = homeFitScale(screen.width, screen.height);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: surface.paper }}
      horizontal={false}
      contentContainerStyle={{ flexGrow: 1, alignItems: 'flex-start', justifyContent: 'flex-start' }}
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
      testID="shrine-canvas"
    >
      <View
        style={{ width: DESIGN_REFERENCE_WIDTH * s, height: REFERENCE_HEIGHT * s }}
        testID="shrine-board"
      >
        {children}
      </View>
    </ScrollView>
  );
}
