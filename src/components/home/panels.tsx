/**
 * The shrine's two panels — tribute points and the streak (SCRUM-161).
 *
 * ── PORTED FROM THE BOARD ───────────────────────────────────────────────────
 * `panel · tribute (bg)` 20,100 230×48 · `panel · streak (bg)` 258,100 112×48. Both are
 * `#F5F0E8` (= **`surface.paper`**) with an ink stroke and **r14** — the same treatment
 * as the clan pill and the settings button.
 *
 * | layer | offset in panel | size | colour |
 * |---|---|---|---|
 * | tribute label | 8, 2 | 9.5 | `text.inkSoft` — uppercased and letter-spaced by STYLE |
 * | tribute value | 8, 16 | 22 · 700 | `text.ink` |
 * | streak flame | centred, 8 | 15 | `brand.cinnabarDeep` |
 * | streak label | centred, 18 | 10.5 · 700 | `brand.cinnabarDeep` |
 *
 * ⚠️ **`brand.cinnabarDeep` (#9A2B18) IS used as TEXT here, which the token role rule
 * normally forbids** (`brand.*` is decorative; `text.*` is for text). The board inks these
 * two run in that colour, so the exception is taken and **measured**: 6.77:1 on
 * `surface.paper` — `check:lib` §20 asserts the arithmetic, so it cannot drift below AA
 * unnoticed. `text.cinnabar` (#B73820) is the role-correct alternative if the board ever
 * moves.
 *
 * ── ⚠️ IT RENDERS NOTHING UNLESS THE READ SUCCEEDED ──────────────────────────
 * No zero, and no "—" invented to stand in for a failure. `homePanels` returns
 * `failed` and this component draws **nothing**, because *"0 tribute points"* would be a
 * claim about the user's history and a stated "unavailable" needs a copy row this project
 * has not signed off. An empty band is honest; a wrong number is not.
 */

import { Text, View } from 'react-native';

import { type HomePanels } from '@/lib/home-panels';
import { t } from '@/lib/i18n';
import { brand, fontSize, surface, text } from '@/theme/tokens';

const PANEL_RADIUS = 14;

function Panel({ children, wide }: { children: React.ReactNode; wide: boolean }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: surface.paper,
        borderColor: brand.ink,
        borderRadius: PANEL_RADIUS,
        borderWidth: 2,
        paddingHorizontal: 8,
        justifyContent: 'center',
        alignItems: wide ? 'flex-start' : 'center',
      }}
    >
      {children}
    </View>
  );
}

export function TributePanel({ state, scale }: { state: HomePanels; scale: number }) {
  if (state.kind !== 'ready') return null;
  return (
    <Panel wide>
      <Text
        numberOfLines={1}
        style={{
          color: text.inkSoft,
          fontSize: 9.5 * scale,
          letterSpacing: 0.8 * scale,
          textTransform: 'uppercase',
        }}
      >
        {t('home.tributeLabel')}
      </Text>
      <Text
        numberOfLines={1}
        testID="home-tribute-value"
        style={{ color: text.ink, fontSize: 22 * scale, fontWeight: '700' }}
      >
        {state.tribute}
      </Text>
    </Panel>
  );
}

export function StreakPanel({ state, scale }: { state: HomePanels; scale: number }) {
  if (state.kind !== 'ready') return null;
  return (
    <Panel wide={false}>
      <Text style={{ color: brand.cinnabarDeep, fontSize: 15 * scale }}>{'\u{1F525}'}</Text>
      <Text
        numberOfLines={1}
        testID="home-streak-value"
        style={{ color: brand.cinnabarDeep, fontSize: 10.5 * scale, fontWeight: '700' }}
      >
        {t('home.streakLabel', { days: state.streakDays })}
      </Text>
    </Panel>
  );
}
