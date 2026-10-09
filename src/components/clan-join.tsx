import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Body, Field, GhostButton, Hint, Label, PageTitle, PrimaryButton, Screen } from '@/components/clan-ui';
import { type ClanPreview, joinClan, previewClan } from '@/lib/clan-api';
import { PREVIEW_MESSAGE_KEY, previewArgs } from '@/lib/clan-flow';
import { RESOLVE_MESSAGE_KEY, canJoin, resolveState } from '@/lib/invite-flow';
import { normaliseClanCode } from '@/lib/invites';
import { clearHeldInvite, holdInvite } from '@/lib/held-invite';
import { t } from '@/lib/i18n';
import { text } from '@/theme/tokens';

/**
 * The join body — ONE implementation for two entry points (SCRUM-50):
 *   · `/clan/join` — the user types, pastes or scans a code
 *   · `/join`      — the user tapped a family link (doc 07 §4.6)
 *
 * ⚠️ WHY THIS FILE EXISTS AT ALL: the deep-link route and the typed route must
 * resolve a code IDENTICALLY. Two copies of "look it up, show the preview, join"
 * is how a link joiner ends up with a subtly different rule from a typist — and
 * the difference would only ever show up on glass.
 *
 * ⚠️ THE BUG THIS FIXES: the first implementation collapsed *"that code is not
 * valid"* and *"we could not reach the shrine"* into one flag, so going offline
 * told the user their family's code was wrong and the invite was never retried.
 * `resolveState` keeps them apart (`notFound` ≠ `unreachable`).
 */
export default function ClanJoin({ initialCode = null }: { initialCode?: string | null }) {
  const [code, setCode] = useState(() => normaliseClanCode(initialCode) ?? '');
  const [preview, setPreview] = useState<ClanPreview | null>(null);
  const [looking, setLooking] = useState(false);
  const [found, setFound] = useState<boolean | null>(null);
  const [transportFailed, setTransportFailed] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  /** The canonical code, or null — "can we ask the server anything yet". */
  const canonical = normaliseClanCode(code);

  const state = resolveState({ code: canonical, looking, found, transportFailed });
  const joinable = canJoin({ state, isMember: preview?.isMember ?? false, joining });

  /**
   * Look the code up as soon as it is canonical (doc 15 §4.3 — one less tap).
   * ⚠️ Guarded against a stale response: the user can keep typing while a lookup
   * is in flight, and an out-of-order reply must not overwrite a newer one.
   */
  const latest = useRef<string | null>(null);
  const lookUp = useCallback(async (raw: string) => {
    const target = normaliseClanCode(raw);
    latest.current = target;
    if (!target) return;

    setLooking(true);
    setTransportFailed(false);
    const result = await previewClan(target);
    if (latest.current !== target) return; // a newer code won the race
    setLooking(false);

    if (result.ok) {
      setPreview(result.data);
      // ⚠️ `data === null` is the SERVER SAYING "no such clan" — a revoked or
      // mistyped code. That is `notFound`, and it is not a transport failure.
      setFound(result.data !== null);
    } else {
      setPreview(null);
      setFound(null);
      setTransportFailed(true);
      // ⚠️ PARK IT, DO NOT DROP IT (doc 07 §4.6: "the join itself queues and
      // resolves on reconnect"). The code is a capability the recipient may
      // never see again — so an unreachable shrine parks the invite and the
      // fork offers it once there is a connection again.
      await holdInvite(target, 'offline');
    }
  }, []);

  useEffect(() => {
    if (!canonical) {
      setPreview(null);
      setFound(null);
      setTransportFailed(false);
      // ⚠️ Invalidate any lookup already in flight AND clear the spinner. Without
      // this, clearing the field while a request is running leaves `looking` true
      // for ever (a stuck spinner) and lets the stale reply paint a preview card
      // for a code the user has already deleted.
      latest.current = null;
      setLooking(false);
      return;
    }
    void lookUp(code);
  }, [code, canonical, lookUp]);

  const onJoin = useCallback(async () => {
    if (!canonical) return;
    setJoining(true);
    setJoinError(null);
    const result = await joinClan(canonical);
    setJoining(false);
    if (!result.ok) {
      setJoinError(result.reason);
      return;
    }
    // The invite has been APPLIED — stop offering it on every launch.
    await clearHeldInvite();
    router.replace('/clan/manage');
  }, [canonical]);

  const messageKey = RESOLVE_MESSAGE_KEY[state];

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

      {looking ? <ActivityIndicator style={styles.spinner} testID="clan-join-looking" /> : null}

      {preview ? (
        <View style={styles.preview}>
          <Label>{t('clan_preview')}</Label>
          <Text style={styles.previewLine}>
            {t(PREVIEW_MESSAGE_KEY, previewArgs(preview.name, preview.ancestorCount, preview.memberCount))}
          </Text>
          {preview.isMember ? <Hint>{t('clan.alreadyMember')}</Hint> : null}
        </View>
      ) : null}

      {messageKey && !looking ? (
        <Text testID="clan-join-problem" style={styles.problem}>
          {t(messageKey)}
        </Text>
      ) : null}

      <PrimaryButton
        testID="clan-join-submit"
        label={joining ? '…' : t('clan.join')}
        disabled={!joinable}
        onPress={() => {
          void onJoin();
        }}
      />

      {joinError ? <Text style={styles.problem}>{joinError}</Text> : null}

      <GhostButton
        testID="clan-join-scan"
        label={t('invite.scan')}
        onPress={() => {
          router.push('/clan/scan');
        }}
      />

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
