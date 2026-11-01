/**
 * The nav bar as a **bottom band**, for any screen that is one of the bar's own destinations.
 *
 * ⚠️⚠️ **WHY THIS EXISTS** (owner's ruling, 2026-11-01):
 *
 * > *"Nav bar should be accessible for the 4 options it displays."*
 *
 * The bar used to render on the **shrine only**, so tapping League landed you on a screen with a back
 * arrow and **no bar** — the bar's own League and Profile buttons behaved like one-way pushes, and
 * *"tap League while on League"* was not even reachable. ⚠️ That is the inconsistency: the bar
 * advertised four destinations and three of them were dead ends.
 *
 * ⚠️ **The band is deliberately the SAME arithmetic as the shrine's**, so the bar does not change
 * size when you navigate:
 *
 * | | shrine | here |
 * |---|---|---|
 * | scale | `homeFitScale(screen)` | `homeFitScale(screen)` |
 * | height | `HOME_BANDS.tabbar.h * s + shrineBleedDp(...)` | identical |
 *
 * ⚠️ `Dimensions.get('screen')`, **not** `useWindowDimensions()` — the window is inset by the system
 * bars (measured 345 × 745 on a 360 × 800 device), and containing the board in it letterboxes the
 * band. Same reason as `ShrineCanvas` and `index.tsx`.
 *
 * ⚠️ The background covers the **bleed** strip too. That strip is the one place the screen would
 * otherwise show a SECOND colour (the page's `paper` under a `paperDeep` bar) — the exact gap that
 * was visible on glass on the shrine.
 *
 * ⚠️ **It is NOT for deeper screens.** Settings, History, Collection and the clan/ritual screens are
 * reached *through* a tab destination and keep `ScreenHud`'s back button, which is what the boards
 * draw for them.
 */
import { Dimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { TabBar } from '@/components/home/tab-bar';
import { HOME_BANDS, homeFitScale, shrineBleedDp } from '@/lib/home-layout';
import { surface } from '@/theme/tokens';

/**
 * ⚠️ `style` lets the **shrine** place the same band on its absolute canvas (`bandRect`), and
 * `testID` keeps that screen's existing `home-tabbar-band` id. ⚠️ **The height is still computed
 * here** — the shrine used to derive the identical number itself, which is exactly the duplication
 * that let the two placements drift.
 */
export function TabBarBand({
  style,
  testID = 'tabbar-band',
}: {
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const screen = Dimensions.get('screen');
  const s = homeFitScale(screen.width, screen.height);

  return (
    <View
      style={[
        {
          height: HOME_BANDS.tabbar.h * s + shrineBleedDp(screen.height, s),
          backgroundColor: surface.paperDeep,
        },
        style,
      ]}
      testID={testID}
    >
      <TabBar scale={s} />
    </View>
  );
}
