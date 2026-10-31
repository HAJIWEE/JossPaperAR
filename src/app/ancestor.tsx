import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import {
  Body,
  Field,
  GhostButton,
  Hint,
  PageTitle,
  PrimaryButton,
  Screen,
} from '@/components/clan-ui';
import {
  ANCESTOR_CAP,
  GIVEN_NAME_MAX,
  RELATIONSHIP_MAX,
  SURNAME_MAX,
  canEditTablets,
  capReached,
  normaliseAncestorForm,
  sheetProblem,
  type SheetProblem,
} from '@/lib/ancestor-sheet';
import { archiveAncestor, clanAncestors, myClans, saveAncestor } from '@/lib/clan-api';
import { t } from '@/lib/i18n';
import { text } from '@/theme/tokens';

/**
 * THE TABLET SHEET — add · edit · archive (SCRUM-146 · SCRUM-168).
 *
 * ── ⚠️ WHY THIS SCREEN EXISTS ───────────────────────────────────────────────
 * Before it, Home's `＋` was a **reserved band**: nothing in the app could put a tablet on the
 * altar, so the shrine could only ever show its empty state. A control that renders and does
 * nothing is the `SCRUM-145` defect — this screen is what closes it.
 *
 * ── ⚠️ THE LADDER IS CHECKED THREE TIMES, AND THIS IS THE WEAKEST ONE ───────
 * `canEditTablets()` only decides whether to **offer** the buttons. `save_ancestor` refuses a
 * plain member with `42501`, and `ancestors_insert_elder` / `_update_elder` filter the write at
 * the table. ⚠️ The RLS filter is the dangerous one: it fails **silently** — zero rows, no
 * error — which is why `archiveAncestor()` treats an empty result as a refusal.
 *
 * ── ⚠️ PARAMS CARRY AN ID, NEVER A NAME ────────────────────────────────────
 * Editing loads the row from `clanAncestors()` by id. A surname in the URL would put a family
 * name into navigation state, the deep-link surface and anything that logs a route; doc 13 §4
 * says these names do not travel.
 */
export default function AncestorSheet() {
  const params = useLocalSearchParams<{ clanId?: string; ancestorId?: string }>();
  const clanId = typeof params.clanId === 'string' ? params.clanId : null;
  const ancestorId = typeof params.ancestorId === 'string' ? params.ancestorId : null;

  /**
   * ⚠️ The role and the live count are READ HERE, not passed in. They were params for one build
   * and that produced a screen that showed "only the head may edit" while a HEAD was using it:
   * a route param is a copy of a fact, and a copy can arrive empty. `myClans()` and
   * `clanAncestors()` are the facts — and the membership read also refuses a clan the caller has
   * left, which a param never could.
   */
  const [role, setRole] = useState<string | null>(null);
  const [liveCount, setLiveCount] = useState(0);
  const [ready, setReady] = useState(false);

  const [surname, setSurname] = useState('');
  const [givenName, setGivenName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  /**
   * Load the ROLE, the live count, and (when editing) the row — one pass.
   * ⚠️ Keyed on the ids only, so typing in a field can never trigger a refetch over it.
   */
  useEffect(() => {
    if (!clanId) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [mine, tablets] = await Promise.all([myClans(), clanAncestors(clanId)]);
      if (cancelled) return;
      setRole(mine.ok ? (mine.data.find((c) => c.clanId === clanId)?.role ?? null) : null);
      const list = tablets.ok ? tablets.data : [];
      setLiveCount(list.length);
      if (ancestorId) {
        const row = list.find((a) => a.id === ancestorId);
        if (row) {
          setSurname(row.surname);
          setGivenName(row.givenName ?? '');
          setRelationship(row.relationship ?? '');
        }
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [ancestorId, clanId]);

  const editing = ancestorId !== null;
  const mayEdit = canEditTablets(role);
  const full = capReached(liveCount) && !editing;

  const problemText = (p: SheetProblem): string | null => {
    switch (p) {
      case 'surname_required':
        return t('ancestor.problemSurname');
      case 'surname_too_long':
        return t('ancestor.problemTooLong', { max: String(SURNAME_MAX) });
      case 'given_name_too_long':
        return t('ancestor.problemTooLong', { max: String(GIVEN_NAME_MAX) });
      case 'relationship_too_long':
        return t('ancestor.problemTooLong', { max: String(RELATIONSHIP_MAX) });
      default:
        return null;
    }
  };

  const save = useCallback(async () => {
    if (!clanId) return;
    const local = sheetProblem({ surname, givenName, relationship });
    if (local) {
      setProblem(problemText(local));
      return;
    }
    setBusy(true);
    setProblem(null);
    const clean = normaliseAncestorForm({ surname, givenName, relationship });
    const result = await saveAncestor({
      clanId,
      surname: clean.surname,
      givenName: clean.givenName,
      relationship: clean.relationship,
      ancestorId,
    });
    setBusy(false);
    // ⚠️ The server's reason is shown as-is: a cap refusal and a role refusal are different
    // facts and the user can act on both. "Something went wrong" hides which one it was.
    if (!result.ok) {
      setProblem(result.reason);
      return;
    }
    router.back();
  }, [clanId, ancestorId, surname, givenName, relationship]);

  const archive = useCallback(() => {
    if (!clanId || !ancestorId) return;
    // ⚠️ Archive is the only removal path — a hard delete would orphan the ledger row a burn
    // points at — and it cannot be undone from the app, so it asks first.
    Alert.alert(t('ancestor.archive'), t('ancestor.archiveConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('ancestor.archive'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            setProblem(null);
            const result = await archiveAncestor(clanId, ancestorId);
            setBusy(false);
            if (!result.ok) {
              setProblem(result.reason);
              return;
            }
            router.back();
          })();
        },
      },
    ]);
  }, [clanId, ancestorId]);

  return (
    <Screen>
      <PageTitle>{editing ? t('ancestor.titleEdit') : t('ancestor.titleAdd')}</PageTitle>

      {/* ⚠️ Nothing until the role has loaded. Rendering the form first and the refusal after
          would flash buttons at a member — and rendering the refusal first is exactly how the
          param version told a clan HEAD that only a head may edit. */}
      {!ready ? null : !mayEdit ? (
        <Hint>{t('ancestor.readOnly')}</Hint>
      ) : full ? (
        <Hint>{t('ancestor.capReached', { cap: String(ANCESTOR_CAP) })}</Hint>
      ) : (
        <>
          <Field
            label={t('ancestor.surname')}
            value={surname}
            onChangeText={setSurname}
            autoCapitalize="words"
            testID="ancestor-surname"
          />
          <Field
            label={`${t('ancestor.givenName')} - ${t('ancestor.optional')}`}
            value={givenName}
            onChangeText={setGivenName}
            autoCapitalize="words"
            testID="ancestor-given"
          />
          <Field
            label={`${t('ancestor.relationship')} - ${t('ancestor.optional')}`}
            value={relationship}
            onChangeText={setRelationship}
            autoCapitalize="words"
            testID="ancestor-relationship"
          />

          {problem ? <Text style={styles.problem}>{problem}</Text> : null}

          <PrimaryButton
            label={t('ancestor.save')}
            onPress={() => void save()}
            disabled={busy}
            testID="ancestor-save"
          />

          {editing ? (
            <GhostButton
              label={t('ancestor.archive')}
              onPress={archive}
              danger
              testID="ancestor-archive"
            />
          ) : null}

          {!editing ? <Body>{t('home.ctaHint')}</Body> : null}
        </>
      )}

      <View style={styles.spacer} />
      <GhostButton
        label={t('common.cancel')}
        onPress={() => router.back()}
        testID="ancestor-cancel"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  problem: { color: text.ink, fontWeight: '700' },
  spacer: { height: 16 },
});
