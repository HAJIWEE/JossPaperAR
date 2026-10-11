import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Body, PageTitle, Screen } from '@/components/clan-ui';
import { LeagueBoardView } from '@/components/league-board';
import { t } from '@/lib/i18n';
import {
  type LeagueBoard,
  fetchLeagueBoard,
  subscribeToLeagueBoard,
} from '@/lib/league-api';
import { space } from '@/theme/tokens';

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
    <Screen>
      <PageTitle>{t('league.title')}</PageTitle>

      {failed ? (
        <Body>{t('league.unreachable')}</Body>
      ) : board === null ? (
        <View style={{ paddingVertical: space.lg }} testID="league-loading">
          <ActivityIndicator />
        </View>
      ) : (
        <LeagueBoardView board={board} />
      )}
    </Screen>
  );
}
