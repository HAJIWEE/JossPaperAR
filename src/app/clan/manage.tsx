import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
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
import { InviteCard } from '@/components/invite-qr';
import {
  type ClanMember,
  type ClanSummary,
  clanMembers,
  deleteClan,
  fetchClanCode,
  leaveClan,
  myClans,
  removeMember,
  renameClan,
  setMemberRole,
} from '@/lib/clan-api';
import {
  LEAVE_REFUSAL_KEY,
  LEAVE_RESULT_KEYS,
  ROLE_LABEL_KEY,
  SUCCESSOR_PROMPT_KEYS,
  actionsFor,
  leaveHintKey,
  promoteLabelKey,
} from '@/lib/clan-flow';
import { type ClanRole, type LeaveMember, canInvite, planLeave } from '@/lib/clan-roles';
import { t } from '@/lib/i18n';
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
  /** SCRUM-84 step 1 — the sole head is choosing a successor before leaving. */
  const [choosingSuccessor, setChoosingSuccessor] = useState(false);
  /** What just happened: who leads now, and whether the SERVER chose for them. */
  const [notice, setNotice] = useState<string | null>(null);
  /** SCRUM-50 — the invite capability, fetched explicitly and never from a list read. */
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  const clan: ClanSummary | null = clans[index] ?? null;

  /**
   * The SCRUM-84 leave plan for the CURRENT user, computed from the roster — so
   * the button, the successor prompt and the refusal message all read ONE rule.
   * `null` until the roster has loaded, which is why every use guards on it.
   */
  const leavePlan = clan && me && members.length > 0 ? planLeave(members, me) : null;

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

  /**
   * Leave — the SCRUM-84 ramp, in the order the PM specified.
   *
   * ⚠️ The REFUSAL is decided by the pure mirror BEFORE the call, so what the user
   * reads is OUR translated copy. The server's refusal is an English sentence
   * (`42501`), and showing it to a 中文 reader mid-flow is exactly the bug the
   * `LEAVE_REFUSAL_KEY` map exists to prevent. The server is still the authority —
   * if it refuses anyway (a race), its reason is shown as a fallback.
   */
  const leaveNow = useCallback(
    async (successorId: string | null) => {
      if (!clan) return;
      const result = await leaveClan(clan.clanId, successorId);
      if (!result.ok) {
        setProblem(result.reason);
        return;
      }
      const { successor, autoPromoted } = result.data;
      setNotice(
        t(autoPromoted ? LEAVE_RESULT_KEYS.auto : LEAVE_RESULT_KEYS.named, {
          name: successor ? successor.slice(0, 8) : '',
        }),
      );
      setChoosingSuccessor(false);
      await load();
    },
    [clan, load],
  );

  const onLeave = useCallback(() => {
    if (!clan || !leavePlan) return;
    setProblem(null);
    setNotice(null);

    if (leavePlan.action === 'refuse') {
      setProblem(t(LEAVE_REFUSAL_KEY[leavePlan.reason]));
      return;
    }

    // not the sole head-power holder: nothing to inherit, just go
    if (leavePlan.action === 'leave') {
      Alert.alert(t('clan.leave'), t('clan.leaveConfirm'), [
        { text: t('clan.back'), style: 'cancel' },
        { text: t('clan.leave'), style: 'destructive', onPress: () => void leaveNow(null) },
      ]);
      return;
    }

    // ⚠️ STEP 1 — a sole head NAMES a successor. This prompt IS the rule: skip it
    // and the family discovers afterwards who the server picked.
    setChoosingSuccessor(true);
  }, [clan, leavePlan, leaveNow]);

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

  /**
   * SCRUM-50 — the invite code is fetched EXPLICITLY, and only when the viewer
   * may invite. `myClans()` returns `code: null` ON PURPOSE (a list read must not
   * hand the capability to a non-head), so the surface has to ask — and it asks
   * only after the pure `canInvite(role)` says the viewer may.
   *
   * ⚠️ This replaces an `onShare` that read `clan.code` — which `myClans()`
   * always nulls, so the old code could only ever reach its own
   * `clan_code_unavailable` branch and the head never saw their own code.
   */
  useEffect(() => {
    const clanId = clan?.clanId;
    if (!clanId || !canInvite(clan?.role ?? null)) {
      setInviteCode(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await fetchClanCode(clanId);
      if (!cancelled) setInviteCode(result.ok ? result.data : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [clan?.clanId, clan?.role]);

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
          {clan && inviteCode ? (
            <InviteCard clanName={clan.name} code={inviteCode} />
          ) : (
            <Hint>{t('clan.shareCode')}</Hint>
          )}
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

      {actions.includes('leave') && !choosingSuccessor ? (
        <>
          <GhostButton testID="clan-leave" label={t('clan.leave')} danger onPress={onLeave} />
          <Hint>{t(leaveHintKey())}</Hint>
        </>
      ) : null}

      {/* ── SCRUM-84 STEP 1 — the sole head names a successor ────────────────
          ⚠️ "Leave without naming one" is offered ONLY when the fallback can
          actually run (`auto_promote_then_leave`). At any other time it would
          lead straight into the server's refusal — offering a path the UI
          already knows is closed is how a button becomes a lie. */}
      {choosingSuccessor && clan ? (
        <>
          <SectionTitle>{t(SUCCESSOR_PROMPT_KEYS.title)}</SectionTitle>
          <Hint>{t(SUCCESSOR_PROMPT_KEYS.hint)}</Hint>
          {members
            .filter((m) => m.userId !== me)
            .map((m) => (
              <Row
                key={m.userId}
                testID={`clan-successor-${m.userId}`}
                onPress={() => void leaveNow(m.userId)}
                left={<Text style={styles.rowTitle}>{m.userId.slice(0, 8)}</Text>}
                right={<Text style={styles.rowMeta}>{t(ROLE_LABEL_KEY[m.role])}</Text>}
              />
            ))}
          {leavePlan?.action === 'auto_promote_then_leave' ? (
            <GhostButton
              testID="clan-leave-without-successor"
              label={t(SUCCESSOR_PROMPT_KEYS.skip)}
              danger
              onPress={() => void leaveNow(null)}
            />
          ) : null}
          <GhostButton label={t('clan.back')} onPress={() => setChoosingSuccessor(false)} />
        </>
      ) : null}

      {actions.includes('delete') ? (
        <GhostButton testID="clan-delete" label={t('clan.deleteClan')} danger onPress={onDelete} />
      ) : null}

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {problem ? <Text style={styles.problem}>{problem}</Text> : null}
      <Label>{busy ? '…' : ''}</Label>
      <GhostButton label={t('common.done')} onPress={() => router.replace('/')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowTitle: { color: text.ink, fontSize: 15, fontWeight: '600' },
  rowMeta: { color: text.muted, fontSize: 12, marginTop: 2 },
  /** who leads now — a success line, so malachite (contrast-checked) not cinnabar */
  notice: { color: text.malachite, fontSize: 14, marginTop: 8 },
  problem: { color: text.cinnabar, fontSize: 14, marginTop: 8 },
});
