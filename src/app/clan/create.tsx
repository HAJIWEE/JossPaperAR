import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';

import {
  Body,
  Field,
  GhostButton,
  Hint,
  Label,
  PageTitle,
  PrimaryButton,
  Screen,
  SectionTitle,
} from '@/components/clan-ui';
import { InviteCard } from '@/components/invite-qr';
import { type ClanSummary, createClan } from '@/lib/clan-api';
import {
  type CreateStep,
  canSubmitName,
  createStepIndex,
  nextCreateStep,
  previousCreateStep,
  CREATE_STEPS,
} from '@/lib/clan-flow';
import { t } from '@/lib/i18n';
import { text } from '@/theme/tokens';

/**
 * CREATE — doc 15 §4.2, "four taps to head".
 *
 *   1 name → 2 confirm → 3 invite card → 4 ancestor hand-off
 *
 * ⚠️ The order is the AMENDED one: the invite card comes BEFORE the ancestor
 * sheet (2026-10-02) so the signed-off ancestor-sheet boards stay the terminal
 * hand-off into Home. `CREATE_STEPS` owns that order and `check:lib` asserts it —
 * swapping the two in this file would be a silent product regression.
 *
 * ⚠️ Steps 3 and 4 are SKIPPABLE (§4.2: Skip and Continue both lead on). They are
 * not success states to be gated; the clan already exists by then.
 *
 * ⚠️ SCRUM-50 — the invite card is now the REAL `InviteCard` (QR + code + share),
 * replacing a bare code string. The share sheet used to be mounted here and is
 * now inside the card, so the QR, the code and the shared link can never drift:
 * all three come from `invites.ts`.
 */
export default function ClanCreateScreen() {
  const [step, setStep] = useState<CreateStep>('name');
  const [name, setName] = useState('');
  const [created, setCreated] = useState<ClanSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  /**
   * ⚠️ The RPC fires on leaving `confirm` — the confirmation card IS tap 2, so
   * creating any earlier would put a clan on the server before the user agreed.
   * The `created` guard makes walking back and forward again free.
   */
  const goNext = useCallback(async () => {
    setProblem(null);
    if (step === 'confirm') {
      if (created) {
        setStep('invite');
        return;
      }
      setBusy(true);
      const result = await createClan(name);
      setBusy(false);
      if (!result.ok) {
        setProblem(result.reason);
        return;
      }
      setCreated(result.data);
      setStep('invite');
      return;
    }
    const next = nextCreateStep(step);
    if (next) setStep(next);
  }, [step, name, created]);

  const goBack = useCallback(() => {
    const prev = previousCreateStep(step);
    if (prev) setStep(prev);
  }, [step]);

  const stepNumber = createStepIndex(step) + 1;

  return (
    <Screen>
      <Label>
        {stepNumber} / {CREATE_STEPS.length}
      </Label>
      <PageTitle>{t('clan.forkCreate')}</PageTitle>

      {step === 'name' ? (
        <>
          <Field
            testID="clan-name-input"
            label={t('clan_name')}
            value={name}
            onChangeText={setName}
            placeholder={t('clan.nameHint')}
            autoCapitalize="words"
          />
          <PrimaryButton
            testID="clan-name-next"
            label={busy ? '…' : t('clan.next')}
            disabled={!canSubmitName(name) || busy}
            onPress={() => {
              void goNext();
            }}
          />
          <Hint>{t('clan.nameHint')}</Hint>
        </>
      ) : null}

      {step === 'confirm' ? (
        <>
          <SectionTitle>{name.trim()}</SectionTitle>
          <Body>{t('clan.youWillBeHead')}</Body>
          <Hint>{t('privacy.firstRun')}</Hint>
          <PrimaryButton
            testID="clan-create-submit"
            label={busy ? '…' : t('clan.create')}
            disabled={busy}
            onPress={() => {
              void goNext();
            }}
          />
          {problem ? <Text style={styles.problem}>{problem}</Text> : null}
          <GhostButton label={t('clan.back')} onPress={goBack} />
        </>
      ) : null}

      {step === 'invite' ? (
        <>
          <SectionTitle>{t('clan.inviteFamily')}</SectionTitle>
          {created?.code ? <InviteCard clanName={created.name} code={created.code} /> : null}
          <PrimaryButton
            testID="clan-invite-next"
            label={t('clan.next')}
            onPress={() => {
              void goNext();
            }}
          />
          <GhostButton label={t('clan.skip')} testID="clan-invite-skip" onPress={() => void goNext()} />
        </>
      ) : null}

      {step === 'ancestors' ? (
        <>
          <SectionTitle>{t('clan.placeFirstTablet')}</SectionTitle>
          <Body>{t('clan.offerTo', { name: created?.name ?? name.trim() })}</Body>
          <PrimaryButton
            testID="clan-create-done"
            label={t('common.done')}
            onPress={() => {
              router.replace('/');
            }}
          />
          <GhostButton label={t('clan.skip')} onPress={() => router.replace('/')} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  problem: { color: text.cinnabar, fontSize: 14, marginTop: 8 },
});
