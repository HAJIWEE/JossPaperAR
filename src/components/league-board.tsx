import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { Body, Hint, Label } from '@/components/clan-ui';
import {
  PROMOTE_COUNT,
  promotionMoment,
  tierOf,
  type PromotionMoment,
} from '@/domain/league';
import { localized, t } from '@/lib/i18n';
import { type LeagueBoard, type LeagueRow, boardTier } from '@/lib/league-api';
import {
  fontSize,
  radius,
  space,
  surface,
  text,
  TOUCH_TARGET,
} from '@/theme/tokens';

/**
 * THE LEAGUE BOARD — the list half of `EN · 6 League` (SCRUM-11 step 6).
 *
 * ⚠️ Every colour here is a TOKEN, and the three row surfaces are the three the
 * Penpot board uses (`--surface-row` · `-zone` · `-you`). Those exact pairs are
 * frozen in `design-system/penpot-pairs.json` and asserted by `check:contrast`, so
 * this component cannot drift from the board it is drawn from — the 4.51:1 avatar
 * margin and the 5.16:1 in-zone rank are the numbers the gate is holding.
 *
 * ⚠️ `PROMOTE_COUNT` is imported rather than written as 3: the promotion line's
 * POSITION is the rule (`doc 07 §4.4` top-3/bottom-3), and a hardcoded 3 in a
 * component is how a board ends up drawing the line in the wrong place after the
 * cohort size changes.
 */

/** A tier name in the reader's language — the ladder carries both (doc 15 §8). */
function tierName(tier: number | null): string {
  const found = tier === null ? undefined : tierOf(tier);
  return found ? localized({ en: found.name_en, zh: found.name_zh }) : '';
}

/** The row's surface: mine, in the zone, or plain. */
function rowSurface(row: LeagueRow): string {
  if (row.isMe) return surface.rowYou;
  return row.rank <= PROMOTE_COUNT ? surface.rowZone : surface.row;
}

function BoardRow({ row }: { row: LeagueRow }) {
  return (
    <View
      testID={`league-row-${row.rank}${row.isMe ? '-me' : ''}`}
      accessibilityRole="text"
      accessibilityLabel={`${row.rank}. ${row.displayLabel}, ${row.weeklyPoints}`}
      style={[styles.row, { backgroundColor: rowSurface(row) }]}
    >
      {/* #1–3 read gold — the in-zone rank pair (5.16:1), NOT --gold-text on a fill. */}
      <Text
        style={[styles.rank, row.rank <= PROMOTE_COUNT && styles.rankInZone]}
      >
        {row.rank}
      </Text>
      <Text style={styles.name} numberOfLines={1}>
        {row.displayLabel}
        {row.isMe ? <Text style={styles.youTag}>{`  ${t('league.you')}`}</Text> : null}
      </Text>
      <Text style={styles.points}>{row.weeklyPoints}</Text>
    </View>
  );
}

/**
 * THE MOMENT — SCRUM-111 answer C.
 *
 * ⚠️ **`animated` is the rule, and the rule is cultural, not aesthetic.** Only a
 * PROMOTION moves (`promotionMoment()` in `domain/league.ts` explains why a
 * demotion must not: doc 04 names guilt as the pattern to avoid, and an animation
 * played at someone who slipped a rung is that pattern with a timeline). This
 * component honours the flag rather than deciding for itself, so a future screen
 * cannot get it wrong by copying this one.
 */
export function LeagueMoment({ moment }: { moment: PromotionMoment }) {
  // ⚠️ `0.92 → 1` and a fade, on the UI thread. A demotion and a hold render at
  //    their final values immediately, so they are stated rather than performed.
  const scale = useRef(new Animated.Value(moment.animated ? 0.92 : 1)).current;
  const opacity = useRef(new Animated.Value(moment.animated ? 0 : 1)).current;

  useEffect(() => {
    if (!moment.animated) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
  }, [moment.animated, opacity, scale]);

  const name = tierName(moment.toTier);
  const from = tierName(moment.fromTier);

  return (
    <Animated.View
      testID={`league-moment-${moment.kind}`}
      style={[
        styles.moment,
        moment.animated && styles.momentPromoted,
        { opacity, transform: [{ scale }] },
      ]}
    >
      <Text style={styles.momentTitle}>{t(moment.titleKey, { tier: name })}</Text>
      <Text style={styles.momentBody}>
        {t(moment.bodyKey, { tier: name, from })}
      </Text>
    </Animated.View>
  );
}

/**
 * The board, ready to render. Pure: it takes a `LeagueBoard` and draws it, so the
 * screen owns fetching, Realtime and error states and this owns the layout.
 *
 * ⚠️ The empty states are drawn from `cohortId`/`weekStart`, NOT from the server's
 * `note` — that field is EN prose (`"not placed in a cohort this week…"`) and a ZH
 * screen cannot localise it. Rendering it would be a language-parity break the copy
 * check cannot see, because it arrives as data rather than as a literal.
 */
export function LeagueBoardView({ board }: { board: LeagueBoard }) {
  const tier = boardTier(board);
  const mine = board.rows.find((r) => r.isMe);
  const moment =
    mine === undefined ? null : promotionMoment(mine.outcome, board.tier);

  if (board.cohortId === null) {
    return (
      <View testID="league-empty">
        <Body>{board.weekStart === null ? t('league.noWeek') : t('league.notPlaced')}</Body>
      </View>
    );
  }

  return (
    <View testID="league-board">
      <View style={styles.header}>
        <Text style={styles.tierName}>{tierName(board.tier)}</Text>
        <Text style={styles.week}>
          {t('league.week', { from: board.weekStart ?? '', to: board.weekEnd ?? '' })}
          {`  ·  ${t('league.families', { count: board.members })}`}
        </Text>
      </View>

      {board.myRank === null ? null : (
        <View style={styles.yours}>
          <Label>{t('league.yourRank')}</Label>
          <Text style={styles.yourRank}>
            {t('league.rankN', { rank: board.myRank })}
            {`  ·  `}
            {t('league.points', { points: board.myWeeklyPoints })}
          </Text>
        </View>
      )}

      {board.rows.map((row) => (
        <View key={`${row.rank}-${row.displayLabel}`}>
          <BoardRow row={row} />
          {/* The line the board draws between the rising and the falling. It sits
              AFTER `PROMOTE_COUNT` because that is the rule (doc 07 §4.4) — a row's
              `outcome` is LAST week's grading and would put the line in last week's
              place. */}
          {row.rank === PROMOTE_COUNT && board.rows.length > PROMOTE_COUNT ? (
            <View style={styles.divider} testID="league-promotion-line">
              <Text style={styles.dividerText}>{t('league.zones')}</Text>
            </View>
          ) : null}
        </View>
      ))}

      {moment ? <LeagueMoment moment={moment} /> : null}

      <Hint>{t('league.live')}</Hint>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: space.md },
  tierName: { fontSize: fontSize.titlePage.at390, fontWeight: '700', color: text.ink },
  week: { fontSize: fontSize.caption.at390, color: text.inkSoft, marginTop: space.xs },
  yours: { marginBottom: space.md },
  yourRank: { fontSize: fontSize.body.at390, fontWeight: '600', color: text.ink },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET,          // N11: font scaling must not clip a row
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    marginBottom: space.xs,
  },
  rank: {
    width: 34,
    fontSize: fontSize.body.at390,
    color: text.ink,
    fontVariant: ['tabular-nums'],
  },
  // ⚠️ `text.gold` (#7B621F) — the SAME token SCRUM-93 was about, and correct here
  //    on the cream in-zone row (5.16:1, asserted in penpot-pairs.json). SCRUM-93
  //    was a role inversion on a gold FILL, not a bad colour.
  rankInZone: { color: text.gold, fontWeight: '600' },
  name: { flex: 1, fontSize: fontSize.body.at390, fontWeight: '600', color: text.ink },
  youTag: { color: text.gold, fontWeight: '400' },
  points: { fontSize: fontSize.body.at390, color: text.ink, fontVariant: ['tabular-nums'] },
  divider: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    marginBottom: space.xs,
  },
  dividerText: { fontSize: fontSize.caption.at390, fontWeight: '700', color: text.gold },
  // The moment. ⚠️ Only the promoted variant takes the zone surface, and a demotion
  // is deliberately NOT drawn in a warning colour — it is news, not a reprimand.
  moment: {
    marginTop: space.lg,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: surface.paperDeep,
  },
  momentPromoted: { backgroundColor: surface.rowZone },
  momentTitle: { fontSize: fontSize.titleRow.at390, fontWeight: '700', color: text.ink },
  momentBody: { fontSize: fontSize.body.at390, color: text.inkSoft, marginTop: space.xs },
});
