/**
 * The shrine's tab bar (SCRUM-164).
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
 * ── ⚠️ TWO TABS ARE DISABLED, AND THAT IS THE HONEST STATE ─────────────────
 * **Store** and **Profile** have no screen: the storefront is `SCRUM-150` and Profile/Settings is
 * `SCRUM-151`. ⚠️ Wiring them to a route that does not exist would be a **dead link**, and
 * rendering them as live-looking but inert is the `SCRUM-145` defect. So they render **visibly
 * disabled** (`accessibilityState.disabled`, dimmed) and become tappable the day their screen
 * lands — the bar's geometry does not change.
 *
 * ⚠️ The League tab's `#4` subtext is a RANK (`nav · tab League subtext`, `text.gold`); there is
 * no rank read on this screen yet, so it is not drawn — a static "#4" would be a lie about the
 * user's position.
 */

import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { TAB_BAR } from '@/lib/home-layout';
import { t } from '@/lib/i18n';
import { brand, onColorCream, surface, text } from '@/theme/tokens';

type Tab = {
  readonly key: string;
  readonly icon: string;
  readonly labelKey: string;
  /** ⚠️ `null` = the screen does not exist yet. */
  readonly route: string | null;
};

const TABS: readonly Tab[] = [
  { key: 'shrine', icon: '\u{1F3EE}', labelKey: 'nav.shrine', route: '/' },
  { key: 'league', icon: '\u{1F3C6}', labelKey: 'nav.league', route: '/league' },
  { key: 'store', icon: '\u{1F6CD}', labelKey: 'nav.store', route: null },
  { key: 'profile', icon: '\u{1F464}', labelKey: 'nav.profile', route: null },
];

export function TabBar({ active, scale }: { active: string; scale: number }) {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: surface.paperDeep }} testID="home-tabbar">
      <View style={{ height: TAB_BAR.topLine * scale, backgroundColor: brand.ink }} />

      {TABS.map((tab, i) => {
        const isActive = tab.key === active;
        const disabled = tab.route === null;
        return (
          <Pressable
            key={tab.key}
            testID={`home-tab-${tab.key}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive, disabled }}
            disabled={disabled}
            onPress={() => {
              if (tab.route) router.push(tab.route);
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
