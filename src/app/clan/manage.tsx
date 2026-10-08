import { useCallback, useEffect, useState } from 'react';
import { Alert, Share, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';

import {
  Body,
  Field,
  GhostButton,
  Hint,
  Label,
  PageTitle,
  PrimaryButton,
  Row,
  Screen,
  SectionTitle,
} from '@/components/clan-ui';
import {
  type ClanMember,
  type ClanSummary,
  clanMembers,
  deleteClan,
  leaveClan,
  myClans,
  removeMember,
  renameClan,
  setMemberRole,
} from '@/lib/clan-api';
import { ROLE_LABEL_KEY, actionsFor, leaveHintKey, promoteLabelKey } from '@/lib/clan-flow';
import type { ClanRole } from '@/lib/clan-roles';
import { activeLocale, t } from '@/lib/i18n';
import { INVITE_SHARE_COPY, inviteLink } from '@/lib/invites';
import { supabase } from '@/lib/supabase';
import { text } from '@/theme/tokens';

/**
 * MANAGE — the clan card, the roster and the role ladder (doc 15 §3 · §5.3).
 *
 * ⚠️ The buttons are not decided here. `actionsFor(role)` returns the list and
 * `check:lib` asserts that list against the matrix — including that an ELDER
 * cannot invite and a MEMBER cannot touch the tablets. A screen that asked
 * `role === 'head'` itself would be free to drift from the rule.
 *
 * ⚠️ Destructive actions confirm, and the leave refusal is passed through
 * VERBATIM: when the server says "promote a co-head first" the user should read
 * exactly that, not a generic failure.
 */
export default function ClanManageScreen() {
  const [clans, setClans] = useState<ClanSummary[]>([]);
  const [index, setIndex] = useState(0);
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');

  const clan: ClanSummary | null = clans[index] ?? null;

  const load = useCallback(async () => {
    setBusy(true);
    setProblem(null);
    const { data: userData } = await supabase().auth.getUser();
    setMe(userData?.user?.id ?? null);

    const mine = await myClans();
    if (!mine.ok) {
      setBusy(false);
      setProblem(mine.reason);
      return;
    }
    setClans(mine.data);
    const first = mine.data[0];
    if (first) {
      const roster = await clanMembers(first.clanId);
      setMembers(roster.ok ? roster.data : []);
    } else {
      setMembers([]);
    }
    setBusy(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reloadRoster = useCallback(async (clanId: string) => {
    const roster = await clanMembers(clanId);
    setMembers(roster.ok ? roster.data : []);
  }, []);

  const onPromote = useCallback(
    async (userId: string, role: ClanRole) => {
      if (!clan) return;
      setProblem(null);
      const result = await setMemberRole(clan.clanId, userId, role);
      if (!result.ok) {
        setProblem(result.reason);
        return;
      }
      await reloadRoster(clan.clanId);
    },
    [clan, reloadRoster],
  );

  const onRemove = useCallback(
    (userId: string, label: string) => {
      if (!clan) return;
      Alert.alert(t('clan.removeMember'), t('clan.removeConfirm', { name: label }), [
        { text: t('clan.back'), style: 'cancel' },
        {
          text: t('clan.removeMember'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const result = await removeMember(clan.clanId, userId);
              if (!result.ok) setProblem(result.reason);
              else await reloadRoster(clan.clanId);
            })();
          },
        },
      ]);
    },
    [clan, reloadRoster],
  );

  const onRename = useCallback(async () => {
    if (!clan) return;
    const result = await renameClan(clan.clanId, newName);
    if (!result.ok) {
      setProblem(result.reason);
      return;
    }
    setRenaming(false);
    setNewName('');
    await load();
  }, [clan, newName, load]);

  const onLeave = useCallback(() => {
    if (!clan) return;
    Alert.alert(t('clan.leave'), t('clan.leaveConfirm'), [
      { text: t('clan.back'), style: 'cancel' },
      {
        text: t('clan.leave'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const result = await leaveClan(clan.clanId);
            // ⚠️ a SOLE head is refused here, by design (doc 15 §10.4)
            if (!result.ok) setProblem(result.reason);
            else await load();
          })();
        },
      },
    ]);
  }, [clan, load]);

  const onDelete = useCallback(() => {
    if (!clan) return;
    Alert.alert(t('clan.deleteClan'), t('clan.deleteConfirm'), [
      { text: t('clan.back'), style: 'cancel' },
      {
        text: t('clan.deleteClan'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const result = await deleteClan(clan.clanId);
            if (!result.ok) {
              setProblem(result.reason);
              return;
            }
            router.replace('/');
          })();
        },
      },
    ]);
  }, [clan]);

  const onShare = useCallback(async () => {
    if (!clan?.code) {
      setProblem('clan_code_unavailable');
      return;
    }
    const copy = INVITE_SHARE_COPY[activeLocale()](clan.name, clan.code);
    await Share.share({ message: `${copy}\n${inviteLink(clan.code)}` });
  }, [clan]);

  if (!busy && clans.length === 0) {
    return (
      <Screen>
        <PageTitle>{t('clan.forkTitle')}</PageTitle>
        <Body>{t('clan.forkCreateHint')}</Body>
        <PrimaryButton
          testID="clan-manage-create"
          label={t('clan.forkCreate')}
          onPress={() => {
            router.replace('/clan/create');
          }}
        />
      </Screen>
    );
  }

  // ⚠️ THE LIST OF BUTTONS COMES FROM THE PURE MODULE — see the header.
  const actions = actionsFor(clan?.role ?? null);

  return (
    <Screen>
      <PageTitle>{clan?.name ?? t('clan.forkTitle')}</PageTitle>
      {clan ? (
        <Hint>
          {t('clan.yourRole')}: {t(ROLE_LABEL_KEY[clan.role])} · {clan.ancestorCount} · {clan.memberCount}
        </Hint>
      ) : null}

      {clans.length > 1
        ? clans.map((c, i) => (
            <Row
              key={c.clanId}
              testID={`clan-switch-${i}`}
              onPress={() => {
                setIndex(i);
                void reloadRoster(c.clanId);
              }}
              left={<Text style={styles.rowTitle}>{i === index ? `· ${c.name}` : c.name}</Text>}
              right={<Text style={styles.rowMeta}>{t(ROLE_LABEL_KEY[c.role])}</Text>}
            />
          ))
        : null}

      {actions.includes('invite') ? (
        <>
          <SectionTitle>{t('clan.inviteFamily')}</SectionTitle>
          {clan?.code ? (
            <Text testID="clan-manage-code" selectable style={styles.code}>
              {clan.code}
            </Text>
          ) : (
            <Hint>{t('clan.shareCode')}</Hint>
          )}
          <GhostButton testID="clan-manage-share" label={t('clan.invite')} onPress={() => void onShare()} />
        </>
      ) : null}

      {actions.includes('manage') ? (
        <>
          <SectionTitle>{t('clan.manage')}</SectionTitle>
          {members.map((m) => {
            const isFounder = m.role === 'head';
            const isMe = m.userId === me;
            // the two promotions doc 15 §8 C12 names, and nothing else
            const target: ClanRole | null =
              m.role === 'member' ? 'elder' : m.role === 'elder' ? 'co_head' : null;
            const promoteKey = target ? promoteLabelKey(target) : null;
            return (
              <Row
                key={m.userId}
                testID={`clan-member-${m.userId}`}
                left={
                  <>
                    <Text style={styles.rowTitle}>
                      {isMe ? '· ' : ''}
                      {m.userId.slice(0, 8)}
                    </Text>
                    <Text style={styles.rowMeta}>{t(ROLE_LABEL_KEY[m.role])}</Text>
                  </>
                }
                right={
                  isFounder || isMe ? null : (
                    <>
                      {promoteKey && target ? (
                        <GhostButton
                          testID={`clan-promote-${m.userId}`}
                          label={t(promoteKey)}
                          onPress={() => void onPromote(m.userId, target)}
                        />
                      ) : null}
                      <GhostButton
                        testID={`clan-remove-${m.userId}`}
                        label={t('clan.removeMember')}
                        danger
                        onPress={() => onRemove(m.userId, m.userId.slice(0, 8))}
                      />
                    </>
                  )
                }
              />
            );
          })}
        </>
      ) : null}

      {actions.includes('book') ? (
        <GhostButton
          testID="clan-open-book"
          label={t('book_header')}
          onPress={() => {
            router.push('/clan/book');
          }}
        />
      ) : null}

      {actions.includes('rename') ? (
        renaming ? (
          <>
            <Field
              testID="clan-rename-input"
              label={t('clan.renamePrompt')}
              value={newName}
              onChangeText={setNewName}
              autoCapitalize="words"
            />
            <PrimaryButton testID="clan-rename-submit" label={t('clan.rename')} onPress={() => void onRename()} />
            <GhostButton label={t('clan.back')} onPress={() => setRenaming(false)} />
          </>
        ) : (
          <GhostButton testID="clan-rename" label={t('clan.rename')} onPress={() => setRenaming(true)} />
        )
      ) : null}

      {actions.includes('leave') ? (
        <>
          <GhostButton testID="clan-leave" label={t('clan.leave')} danger onPress={onLeave} />
          <Hint>{t(leaveHintKey())}</Hint>
        </>
      ) : null}

      {actions.includes('delete') ? (
        <GhostButton testID="clan-delete" label={t('clan.deleteClan')} danger onPress={onDelete} />
      ) : null}

      {problem ? <Text style={styles.problem}>{problem}</Text> : null}
      <Label>{busy ? '…' : ''}</Label>
      <GhostButton label={t('common.done')} onPress={() => router.replace('/')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowTitle: { color: text.ink, fontSize: 15, fontWeight: '600' },
  rowMeta: { color: text.muted, fontSize: 12, marginTop: 2 },
  code: { color: text.ink, fontSize: 24, fontWeight: '700', letterSpacing: 4, marginBottom: 8 },
  problem: { color: text.cinnabar, fontSize: 14, marginTop: 8 },
});
