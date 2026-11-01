/**
 * The navigation bar (SCRUM-164, SCRUM-151).
 *
 * ── PORTED FROM THE BOARD ───────────────────────────────────────────────────
 * `nav · tabbar (bg)` 0,764 390×80 in **`surface.paperDeep`**, a **3 px `brand.ink`** rule along
 * its top edge, and four tabs at 12 · 106 · 199 · 293 — each 86×62, r12 when active, icon 19,
 * label 12/700.
 *
 * ⚠️ **THE ACTIVE TAB IS DELIBERATELY NOT THE BOARD'S COLOUR.** The board inks the active icon
 * and label `#9A2B18` on a `#C23B22` pill — **1.44:1**, effectively unreadable, and the exact
 * class `SCRUM-93` closed on a board before. `onColorCream` on that fill is **4.90:1**, so the
 * bar uses it and `check:lib` §22 asserts both ratios. ⚠️ The board itself is filed.
 *
 * ⚠️ **WHICH TABS ARE LIVE IS DATA, NOT LOGIC HERE** — `NAV_TABS` in `lib/nav.ts`. **Store** is
 * disabled (no screen, SCRUM-150) and **Profile** is live (SCRUM-151). ⚠️ Wiring a tab to a route
 * that does not exist would be a **dead link**, and rendering it live-looking but inert is the
 * `SCRUM-145` defect — so Store renders **visibly disabled** and becomes tappable the day its screen
 * lands. The bar's geometry does not change, only the state.
 *
 * ⚠️ The League tab's `#4` subtext is a RANK (`nav · tab League subtext`, `text.gold`); there is
 * no rank read on this screen yet, so it is not drawn — a static "#4" would be a lie about the
 * user's position.
 *
 * ⚠️ **WHERE THE BAR APPEARS is a separate question from how it behaves.** Per the boards it is
 * drawn on the **home** screens only (`EN · 1`, `1g`, `1h`, `1h2`); `EN · 6 League`, `7 Store`,
 * `8 Profile`, `8b Settings` and `8c History` each draw a **back button** instead. So this component
 * currently renders on the shrine, and its rules are nonetheless written for **any** page it is
 * placed on.
 */

import { Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

import { TAB_BAR } from '@/lib/home-layout';
import { t } from '@/lib/i18n';
import { NAV_TABS, activeTabKey, tabPressIsNoop } from '@/lib/nav';
import { brand, onColorCream, surface, text } from '@/theme/tokens';

/**
 * ⚠️⚠️ **THE BAR DERIVES ITS OWN ACTIVE STATE — IT TAKES NO `active` PROP.**
 *
 * It used to be `<TabBar active="shrine" scale={s} />`, a literal handed in by the one screen that
 * rendered it. That is a question the **caller** answered, and it answered it correctly for exactly
 * one screen — so on any other screen the answer would be wrong and the no-op rule below would
 * quietly stop holding. ⚠️ **Deriving it from `usePathname()` is what makes the rule GLOBAL**: there
 * is no longer a caller that *can* get it wrong. `check:lib` §27 asserts the prop is gone.
 *
 * ⚠️ The destinations live in `lib/nav.ts` as data, so §27 can walk **every** tab and a
 * cross-product of paths against the real routes rather than a fixture that could drift.
 */
export function TabBar({ scale }: { scale: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const active = activeTabKey(pathname);

  return (
    <View style={{ flex: 1, backgroundColor: surface.paperDeep }} testID="home-tabbar">
      <View style={{ height: TAB_BAR.topLine * scale, backgroundColor: brand.ink }} />

      {NAV_TABS.map((tab, i) => {
        const isActive = tab.key === active;
        const disabled = tab.route === null;
        // ⚠️ Captured and narrowed once, so the press handler below needs no assertion.
        const destination = tab.route;
        return (
          <Pressable
            key={tab.key}
            testID={`home-tab-${tab.key}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive, disabled }}
            disabled={disabled}
            onPress={() => {
              /**
               * ⚠️⚠️ **TAPPING THE TAB YOU ARE ALREADY ON MUST DO NOTHING — ON EVERY PAGE.**
               * It was `router.push(tab.route)` unconditionally, so pressing the current tab pushed a
               * SECOND copy of the route: the screen re-rendered and the stack grew one duplicate per
               * tap. ⚠️ The rule is the shared `tabPressIsNoop` in `lib/nav.ts`, applied to the
               * **path this screen is actually on** — not to a prop someone passed in — so it holds
               * for League on League exactly as it does for Shrine on Shrine.
               */
              if (destination === null || tabPressIsNoop(destination, pathname)) return;
              router.push(destination);
            }}
            style={{
              position: 'absolute',
              left: TAB_BAR.xs[i] * scale,
              // ⚠️ topInBar, NOT tab.y — this View is already offset to the band's origin.
              top: TAB_BAR.tab.topInBar * scale,
              width: TAB_BAR.tab.w * scale,
              height: TAB_BAR.tab.h * scale,
              borderRadius: TAB_BAR.tab.radius * scale,
              backgroundColor: isActive ? brand.cinnabar : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              // ⚠️ Dimmed, not hidden: the tab is a real destination that simply is not built.
              opacity: disabled ? 0.45 : 1,
            }}
          >
            <Text allowFontScaling={false} style={{ fontSize: 19 * scale }}>
              {tab.icon}
            </Text>
            <Text
              numberOfLines={1}
              allowFontScaling={false}
              style={{
                // ⚠️ active → onColorCream (4.90:1), NOT the board's 1.44:1 cinnabarDeep.
                color: isActive ? onColorCream : text.inkSoft,
                fontSize: 12 * scale,
                fontWeight: '700',
              }}
            >
              {t(tab.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
