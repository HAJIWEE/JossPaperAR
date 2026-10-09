import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Body, GhostButton, Hint, PageTitle, Row, Screen, SectionTitle } from '@/components/clan-ui';
import { type BookEntry, clanBook, myClans } from '@/lib/clan-api';
import { BOOK_WINDOW_DAYS, bookProjection } from '@/lib/clan-roles';
import { t } from '@/lib/i18n';
import { text } from '@/theme/tokens';

/**
 * THE BOOK OF TRIBUTES — the read surface (doc 15 §7).
 *
 * ⚠️ THE PROJECTION IS NOT DECIDED HERE. `clan_book` returns the full entry to a
 * member and the anonymised one to anyone else, and the entry carries
 * `anonymous` explicitly so the screen never infers a rule from a missing name.
 * Rendering `member` when it is `null` would undo §7.2 in one line.
 *
 * ⚠️ The month window is the SERVER's predicate, not a filter here — a client
 * that also filtered would hide the fact that older rows deliberately remain
 * (HIDE, not purge — §10.5).
 */
export default function ClanBookScreen() {
  const params = useLocalSearchParams<{ clanId?: string }>();
  const [entries, setEntries] = useState<BookEntry[]>([]);
  const [clanName, setClanName] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    setProblem(null);
    let clanId = params.clanId ?? null;

    // no id in the route → the caller's first clan, which is also what the card shows
    if (!clanId) {
      const mine = await myClans();
      if (!mine.ok) {
        setProblem(mine.reason);
        return;
      }
      const first = mine.data[0];
      if (!first) {
        setProblem('clan_none');
        return;
      }
      clanId = first.clanId;
      setClanName(first.name);
    }

    const result = await clanBook(clanId);
    if (!result.ok) {
      setProblem(result.reason);
      return;
    }
    setEntries(result.data);
  }, [params.clanId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen>
      <PageTitle>{clanName ?? t('book_header')}</PageTitle>
      <Hint>
        {t('book_window')} ({BOOK_WINDOW_DAYS})
      </Hint>

      {problem ? <Text style={styles.problem}>{problem}</Text> : null}

      {entries.length === 0 && !problem ? <Body>{t('book_window')}</Body> : null}

      <SectionTitle>{t('book_header')}</SectionTitle>
      {entries.map((entry, i) => {
        // ⚠️ the server decides this; the helper exists so the rule is stated once
        const projection = bookProjection(entry.member !== null);
        return (
          <Row
            key={`${entry.createdAt}-${i}`}
            testID={`book-entry-${i}`}
            left={
              <>
                <Text style={styles.points}>{entry.points}</Text>
                <Text style={styles.meta}>
                  {entry.offering ?? ''}
                  {entry.festival ? ` · ${entry.festival}` : ''}
                </Text>
                <Text style={styles.meta}>
                  {projection === 'full' ? (entry.member ?? '') : t('book_outside')}
                </Text>
              </>
            }
            right={<Text style={styles.meta}>{entry.createdAt.slice(0, 10)}</Text>}
          />
        );
      })}

      <GhostButton
        testID="book-done"
        label={t('common.done')}
        onPress={() => {
          router.back();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  points: { color: text.gold, fontSize: 16, fontWeight: '700' },
  meta: { color: text.muted, fontSize: 12, marginTop: 2 },
  problem: { color: text.cinnabar, fontSize: 14, marginTop: 8 },
});
