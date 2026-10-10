import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';

import { Body, ChoiceCard, Hint, PageTitle, Screen, SectionTitle } from '@/components/clan-ui';
import { FORK } from '@/lib/clan-flow';
import { readHeldInvite } from '@/lib/held-invite';
import { HELD_INVITE_KEY_BY_REASON, type HeldInvite } from '@/lib/invite-flow';
import { t } from '@/lib/i18n';

/**
 * THE FORK — doc 15 §4.1: one screen, two cards.
 *
 * ⚠️ WHAT THIS SCREEN DELIBERATELY DOES NOT DO: gate first-run. doc 15 §4 says a
 * user "cannot reach Home without creating or joining a clan", but the shipped
 * behaviour is the slice's tutorial-then-fork (SCRUM-83 option E), and **which
 * one stays is `SCRUM-83`** — an open PM decision. Making this the mandatory
 * first screen would answer that decision by accident, so the fork is reachable
 * and the *routing* question is left where it belongs.
 *
 * The copy comes from the `FORK` table in `clan-flow.ts` (which `check:lib`
 * asserts exists in both locales), not from strings written here.
 *
 * ⚠️ SCRUM-50 — THIS SCREEN IS ALSO WHERE A HELD INVITE COMES BACK. An invite
 * that arrived before the device had an identity (or while the shrine was
 * unreachable) is parked by `invite-entry.tsx` / `clan-join.tsx`; it is offered
 * here rather than on the deep-link screen, because by the time the user is
 * looking at the fork they are settled and ready to act on it.
 */
export default function ClanForkScreen() {
  const [held, setHeld] = useState<HeldInvite | null>(null);

  // Re-read on every focus: a user may arrive here straight from a failed join,
  // which parks the invite as they leave.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const record = await readHeldInvite();
        if (!cancelled) setHeld(record);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <Screen>
      <PageTitle>{t('clan.forkTitle')}</PageTitle>
      <Body>{t('clan.forkCreateHint')}</Body>

      {held ? (
        <>
          <SectionTitle>{t('invite.waiting')}</SectionTitle>
          <ChoiceCard
            testID="clan-fork-held-invite"
            title={t(HELD_INVITE_KEY_BY_REASON[held.reason], { code: held.code })}
            hint={t('invite.waitingHint')}
            onPress={() => {
              router.push({ pathname: '/clan/join', params: { code: held.code } });
            }}
          />
        </>
      ) : null}

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
