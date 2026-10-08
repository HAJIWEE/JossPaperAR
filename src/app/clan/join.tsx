import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Body, Field, GhostButton, Hint, Label, PageTitle, PrimaryButton, Screen } from '@/components/clan-ui';
import { type ClanPreview, joinClan, previewClan } from '@/lib/clan-api';
import { canSubmitCode, previewArgs, PREVIEW_MESSAGE_KEY } from '@/lib/clan-flow';
import { t } from '@/lib/i18n';
import { text } from '@/theme/tokens';

/**
 * JOIN — doc 15 §4.3: type or paste the code → the preview card → Join.
 *
 * ⚠️ The preview shows the name and the COUNTS, and never an ancestor name
 * before joining (doc 13 §4) — that is enforced server-side in `preview_clan`,
 * and the screen must not look for a field that is not there.
 *
 * ⚠️ No approval queue (§4.3): a valid code joins on one tap. A bad one is an
 * EXPECTED outcome, not an error state — `previewClan` returns `found: false`
 * and the screen shows `clan.invalidCode`.
 */
export default function ClanJoinScreen() {
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<ClanPreview | null>(null);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [looking, setLooking] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const ready = canSubmitCode(code);

  /** Look the code up as soon as it is canonical — one less tap (doc 15 §4.3). */
  const lookUp = useCallback(async (raw: string) => {
    setLooking(true);
    setLookupFailed(false);
    const result = await previewClan(raw);
    if (result.ok) {
      // ⚠️ `data === null` means "not found" (a revoked or mistyped code), which
      // is different from a failed REQUEST — only the latter is a transport error.
      setPreview(result.data);
      setLookupFailed(result.data === null);
    } else {
      setPreview(null);
      setLookupFailed(true);
    }
    setLooking(false);
  }, []);

  useEffect(() => {
    if (!ready) {
      setPreview(null);
      setLookupFailed(false);
      return;
    }
    void lookUp(code);
  }, [code, ready, lookUp]);

  const onJoin = useCallback(async () => {
    setJoining(true);
    setJoinError(null);
    const result = await joinClan(code);
    setJoining(false);
    if (!result.ok) {
      setJoinError(result.reason);
      return;
    }
    router.replace('/clan/manage');
  }, [code]);

  return (
    <Screen>
      <PageTitle>{t('clan.forkJoin')}</PageTitle>
      <Body>{t('clan.forkJoinHint')}</Body>

      <Field
        testID="clan-code-input"
        label={t('clan_code')}
        value={code}
        onChangeText={setCode}
        placeholder="ABCDEFGH"
        autoCapitalize="characters"
      />

      {looking ? <ActivityIndicator style={styles.spinner} /> : null}

      {preview ? (
        <View style={styles.preview}>
          <Label>{t('clan_preview')}</Label>
          <Text style={styles.previewLine}>
            {t(PREVIEW_MESSAGE_KEY, previewArgs(preview.name, preview.ancestorCount, preview.memberCount))}
          </Text>
          {preview.isMember ? <Hint>{t('clan.alreadyMember')}</Hint> : null}
        </View>
      ) : null}

      {lookupFailed && !looking ? <Text style={styles.problem}>{t('clan.invalidCode')}</Text> : null}

      <PrimaryButton
        testID="clan-join-submit"
        label={joining ? '…' : t('clan.join')}
        disabled={!preview || preview.isMember || joining}
        onPress={() => {
          void onJoin();
        }}
      />

      {joinError ? <Text style={styles.problem}>{joinError}</Text> : null}

      <GhostButton
        label={t('clan.create')}
        onPress={() => {
          router.replace('/clan/create');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  spinner: { marginTop: 12 },
  preview: { marginTop: 16 },
  previewLine: { color: text.ink, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  problem: { color: text.cinnabar, fontSize: 14, marginTop: 8 },
});
