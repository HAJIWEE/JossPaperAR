import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Body } from '@/components/clan-ui';
import { LeagueBoardView } from '@/components/league-board';
import { TabBarBand } from '@/components/home/tab-bar-band';
import { ScreenHud } from '@/components/screen-hud';
import { t } from '@/lib/i18n';
import {
  type LeagueBoard,
  fetchLeagueBoard,
  subscribeToLeagueBoard,
} from '@/lib/league-api';
import { HUD } from '@/lib/profile';
import { space, surface } from '@/theme/tokens';

/**
 * THE LEAGUE BOARD — `EN · 6 League` / `ZH · 6 League / 联赛` (SCRUM-11 step 6).
 *
 * The screen owns the three things the board cannot: fetching, the Realtime
 * lifetime, and the failure state. The layout is `components/league-board.tsx`, so
 * a screen change cannot accidentally restyle a board that `check:contrast` is
 * holding to fixed pairs.
 *
 * ⚠️ **WHY THERE ARE TWO EFFECTS AND NOT ONE.** The channel topic is
 * `league:{cohort_id}`, so there is nothing to subscribe to until the first fetch
 * has told us the cohort. A single effect that both fetched and subscribed would
 * either open a channel with a null cohort or re-open one on every board change —
 * and "re-subscribe on every change" is exactly how a live board leaks a socket per
 * award and then reports "Realtime stopped working" an hour in. One effect loads;
 * the other owns the channel and returns its unsubscribe.
 */
export default function LeagueScreen() {
  const [board, setBoard] = useState<LeagueBoard | null>(null);
  const [failed, setFailed] = useState(false);

  /** Stable across renders, so the subscription below is not torn down per paint. */
  const load = useCallback(async () => {
    const result = await fetchLeagueBoard();
    if (result.ok) {
      setBoard(result.data);
      setFailed(false);
    } else {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cohortId = board?.cohortId ?? null;

  useEffect(() => {
    if (cohortId === null) return;
    // ⚠️ The unsubscriber IS the cleanup. React runs it on unmount and on a cohort
    //    change, so the channel's lifetime is the screen's, not the app's.
    return subscribeToLeagueBoard(cohortId, () => {
      void load();
    });
  }, [cohortId, load]);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {failed ? (
          <Body>{t('league.unreachable')}</Body>
        ) : board === null ? (
          <View style={{ paddingVertical: space.lg }} testID="league-loading">
            <ActivityIndicator />
          </View>
        ) : (
          <LeagueBoardView board={board} />
        )}
      </ScrollView>

      {/*
        ⚠️ **LEAGUE IS ONE OF THE BAR'S OWN DESTINATIONS, SO THE BAR IS HERE** (owner's ruling,
        2026-11-01). It used to be the shrine only, which made the bar's League button a one-way
        push: you arrived and the bar was gone, so *"tap League while on League"* was unreachable.
        ⚠️ The band sits AFTER the ScrollView (which is `flex: 1`, so it shrinks to make room) and
        BEFORE the HUD, so the HUD is still painted last and still receives its taps.
      */}
      <TabBarBand />

      {/*
        ⚠️ THE WAY BACK (SCRUM-164 · standardized in SCRUM-151). It was a `GhostButton` reading
        *"Return to the shrine"* — a second back idiom, and the only screen with one. It is now the
        SAME HUD every other pushed screen uses.
        ⚠️ **AFTER the ScrollView, and that is load-bearing:** the ScrollView fills the screen and is
        painted last, so a HUD rendered BEFORE it is swallowed — it draws (through the transparent
        scroll view) and never receives a tap. That was the Settings defect, 2026-11-01.
      */}
      <ScreenHud titleKey="league.title" backTestID="league-back" titleTestID="league-title" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.paper },
  /** ⚠️ `flex: 1` so the ScrollView yields room to the tab band instead of being overlaid by it. */
  scroll: { flex: 1 },
  content: { paddingTop: HUD.touch.y + HUD.touch.size + 15, paddingHorizontal: space.lg, paddingBottom: 40 },
});
