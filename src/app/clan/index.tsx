import { router } from 'expo-router';

import { Body, ChoiceCard, Hint, PageTitle, Screen, SectionTitle } from '@/components/clan-ui';
import { FORK } from '@/lib/clan-flow';
import { t } from '@/lib/i18n';

/**
 * THE FORK — doc 15 §4.1: one screen, two cards.
 *
 * ⚠️ WHAT THIS SCREEN DELIBERATELY DOES NOT DO: gate first-run. doc 15 §4 says a
 * user "cannot reach Home without creating or joining a clan", but the shipped
 * behaviour is the slice's auto-create (`ensureClan()`), and **which one stays is
 * `SCRUM-83`** — an open PM decision. Making this the mandatory first screen
 * would answer that decision by accident, so the fork is reachable and the
 * routing question is left where it belongs.
 *
 * The copy comes from the `FORK` table in `clan-flow.ts` (which `check:lib`
 * asserts exists in both locales), not from strings written here.
 */

export default function ClanForkScreen() {
  return (
    <Screen>
      <PageTitle>{t('clan.forkTitle')}</PageTitle>
      <Body>{t('clan.forkCreateHint')}</Body>

      <SectionTitle>{t('clan.forkJoin')}</SectionTitle>
      <ChoiceCard
        testID="clan-fork-join"
        title={t(FORK.join.titleKey)}
        hint={t(FORK.join.hintKey)}
        onPress={() => {
          router.push('/clan/join');
        }}
      />

      <SectionTitle>{t('clan.forkCreate')}</SectionTitle>
      <ChoiceCard
        testID="clan-fork-create"
        title={t(FORK.create.titleKey)}
        hint={t(FORK.create.hintKey)}
        onPress={() => {
          router.push('/clan/create');
        }}
      />

      <Hint>{t('privacy.firstRun')}</Hint>
    </Screen>
  );
}
