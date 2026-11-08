/**
 * PROFILE — `EN · 8 Profile` / `ZH · 8 Profile / 我的` (SCRUM-151).
 *
 * ── ⚠️ WHAT THE BOARD DRAWS THAT THIS DOES NOT ──────────────────────────────
 * `EN · 8 Profile` carries a league chip (`League · Jade`), a `remembering since Apr 2026` line and
 * three stat tiles (burned · collected · credits). ⚠️ **None of them has a read**: the league tier
 * comes from a board this screen does not load, the profile row carries no created-at to the client,
 * and there is no collected/credits aggregate in the RPC surface. ⚠️ Rendering them with sample
 * numbers would be the worst possible outcome — the values look real and are invented.
 *
 * So the header shows what IS known (the active clan and the caller's role), the tribute panel shows
 * the two numbers `home_summary` really returns, and the rows carry the board's structure. The rows
 * with no destination render **disabled** (the `tab-bar.tsx` pattern).
 *
 * ── ⚠️ THE ROWS ARE DATA ────────────────────────────────────────────────────
 * `PROFILE_ROWS` in `lib/profile.ts` is the list, so `check:lib` §26 can assert that no row links to
 * a route that does not exist. A row added here but not there is a row no gate can see.
 */

import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { fetchHomeSummary } from '@/lib/home-api';
import { homePanels } from '@/lib/home-panels';
import { TabBarBand } from '@/components/home/tab-bar-band';
import { ScreenHud } from '@/components/screen-hud';
import { t } from '@/lib/i18n';
import { HUD, PROFILE_CARD, PROFILE_ROWS, PROFILE_ROW, rowIsLive } from '@/lib/profile';
import { CHOSEN_NAME_MAX, chosenNameProblem, NAME_CHANGE_INTERVAL_DAYS, NAME_CHANGE_INTERVAL_MS, type NameCooldown } from '@/lib/user-name';
import { readMyName, setChosenName as saveChosenName } from '@/lib/user-profile';
import { brand, fontSize, onColorCream, surface, text } from '@/theme/tokens';

/** ⚠️ A row with `route: null` renders DISABLED — never a link to a screen that does not exist. */
function ProfileRow({
  labelKey,
  subKey,
  route,
  testID,
}: {
  labelKey: string;
  subKey: string;
  route: string | null;
  testID: string;
}) {
  const body = (
    <>
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={styles.rowLabel}>
          {t(labelKey)}
        </Text>
        <Text numberOfLines={1} style={styles.rowSub}>
          {t(route === null ? 'settings.notBuilt' : subKey)}
        </Text>
      </View>
      {rowIsLive(route) ? <Text style={styles.chev}>{'\u203A'}</Text> : null}
    </>
  );

  if (!rowIsLive(route)) {
    return (
      <View style={[styles.row, styles.rowDisabled]} testID={testID} accessibilityState={{ disabled: true }}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(labelKey)}
      testID={testID}
      onPress={() => router.push(route as string)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const ROW_COPY: Record<string, { label: string; sub: string }> = {
  history: { label: 'profile.rowHistory', sub: 'profile.rowHistorySub' },
  collection: { label: 'profile.rowCollection', sub: 'profile.rowCollectionSub' },
  settings: { label: 'profile.rowSettings', sub: 'profile.rowSettingsSub' },
};

export default function ProfileScreen() {
  const [tribute, setTribute] = useState<string | null>(null);
  const [streakDays, setStreakDays] = useState<number | null>(null);
  /**
   * ⚠️ **THE USER'S OWN NAME** (SCRUM-214(A) option B, owner 2026-11-08). ⚠️ `chosenName` is what the person
   * entered; `email` is here because this is now a USER profile and *"which account am I?"* is the question a
   * profile should answer. ⚠️ The **pseudonym is deliberately not shown**: it is the league's privacy device
   * (doc 13 §4), not a name to greet someone with.
   */
  const [chosenName, setChosenName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  /** ⚠️ Interpolation values for `problem` — the weekly limit's copy needs `{days}` and `{remaining}`. */
  const [problemVars, setProblemVars] = useState<Record<string, string> | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  /**
   * ⚠️ **THE ONCE-A-WEEK LIMIT** (SCRUM-223), as the screen sees it. ⚠️ The DATABASE is the authority; this only
   * decides whether the row reads as editable, so nobody types a name and then loses it to a refusal. ⚠️ It
   * starts `allowed` because an unread profile has told us nothing — locking on a failed read would be a claim.
   */
  const [cooldown, setCooldown] = useState<NameCooldown>({ allowed: true, daysRemaining: 0, nextChangeAtMs: null });

  /**
   * ⚠️ Re-read on FOCUS, the same pattern the shrine uses: a burn moves the tribute WALLET and a
   * store purchase moves it back, so this must not be a once-per-mount read.
   */
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        /**
         * ⚠️ **`myClans()` IS GONE FROM THIS SCREEN** (SCRUM-214(A) option B). It was here only to name the
         * clan in the header, and the Clan page owns that — so the read is not merely unused, it is a network
         * call this screen no longer has any use for.
         */
        const [totals, me] = await Promise.all([fetchHomeSummary(), readMyName()]);
        if (cancelled) return;
        /** ⚠️ A failed read leaves both `null` — the header then says nothing rather than inventing a name. */
        if (me.ok) {
          setChosenName(me.data.chosenName);
          setEmail(me.data.email);
          setCooldown(me.data.cooldown);
        }
        /**
         * ⚠️ `homePanels` formats the total — the SAME function the shrine's panel uses, so the two
         * screens cannot disagree about how "12,480" is punctuated. ⚠️ A failed read stays `null`
         * (the card is not drawn) rather than showing a zero, which would be a claim about history.
         */
        const panels = homePanels(totals);
        if (panels.kind === 'ready') {
          setTribute(panels.tribute);
          setStreakDays(panels.streakDays);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  /**
   * ⚠️ Save the name, then close. ⚠️ **A FAILURE KEEPS THE EDITOR OPEN and says why** — closing it would hide
   * that nothing was stored, which reads as *"it saved"*. ⚠️ The draft is validated before the round trip and
   * the column's CHECK validates it again, because a round trip is not a validation strategy.
   */
  const save = useCallback(() => {
    void (async () => {
      const key = chosenNameProblem(draft);
      if (key === 'empty') {
        setProblem('profile.nameEmpty');
        return;
      }
      if (key === 'too_long') {
        setProblem('profile.nameTooLong');
        return;
      }
      setSaving(true);
      setProblem(null);
      setProblemVars(undefined);
      /**
       * ⚠️ **`saveChosenName`, NOT `setChosenName`** — the bare name is the React **state setter** in this
       * component, and it returns `void`. ⚠️ That collision type-checked as *"Property 'ok' does not exist on
       * type 'void'"* two frames away from the cause, which is exactly the kind of error a rename fixes and a
       * shrug hides.
       */
      const res = await saveChosenName(draft);
      setSaving(false);
      if (!res.ok) {
        /**
         * ⚠️ **`too_soon` IS THE DATABASE REFUSING**, not a validation slip — `enforce_name_change_limit` raised
         * it. ⚠️ So the remaining wait is re-READ from the row rather than computed here: the refusal's own
         * `detail` carries the next instant, and the row is the authority on when that is.
         */
        if (res.reason === 'too_soon') {
          const again = await readMyName();
          if (again.ok) {
            setCooldown(again.data.cooldown);
            setProblem('profile.nameTooSoon');
            setProblemVars({
              days: String(NAME_CHANGE_INTERVAL_DAYS),
              remaining: String(Math.max(1, again.data.cooldown.daysRemaining)),
            });
          } else {
            setProblem('profile.nameFailed');
          }
          return;
        }
        setProblem('profile.nameFailed');
        return;
      }
      setChosenName(res.data);
      /**
       * ⚠️ The write just consumed the allowance, so the row locks immediately — without this the screen would
       * offer "edit" again until the next focus, and the following tap would be refused by the database. The
       * arithmetic mirrors the trigger; a focus re-read corrects it if they ever disagree.
       */
      setCooldown({ allowed: false, daysRemaining: NAME_CHANGE_INTERVAL_DAYS, nextChangeAtMs: Date.now() + NAME_CHANGE_INTERVAL_MS });
      setEditing(false);
    })();
  }, [draft]);

  return (
    <View style={styles.screen}>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── the header card ──────────────────────────────────────────────── */}
        {/*
          ⚠️⚠️ **THIS IS A USER PROFILE NOW — THE CLAN IS NOT ITS SUBJECT** (SCRUM-214(A) option B, owner
          2026-11-08: *"Profile should be a User Profile as we already have a Clan page where the Clan details
          are shown"*). ⚠️ So the header carries the person's OWN name and the signed-in address, and the clan
          name + role that used to sit here are gone — they were a duplicate of the Clan page, and they are
          reachable from the shrine's clan pill.
          ⚠️ **No name yet is a real state, not an error:** the header says so and the row below opens the
          editor, so the empty state is a call to action rather than a blank card.
        */}
        <View style={styles.card} testID="profile-header">
          <View style={styles.avatar}>
            <Text style={styles.avatarGlyph} allowFontScaling={false}>
              {chosenName ? Array.from(chosenName)[0] : ''}
            </Text>
          </View>
          <View style={styles.headerText}>
            <Text numberOfLines={1} style={styles.headerName} testID="profile-name">
              {chosenName ?? t('profile.namePrompt')}
            </Text>
            {email === null ? null : (
              <Text numberOfLines={1} style={styles.headerRole} testID="profile-email">
                {email}
              </Text>
            )}
          </View>
        </View>

        {/*
          ⚠️ The EDIT affordance is its own row rather than a tap on the header: a header that silently opens
          an editor is the dead-looking control this project keeps removing. It reads as a row because it IS
          one — and it shows the current value, so the screen never hides its own state.

          ⚠️⚠️ **AND WHEN THE WEEKLY LIMIT IS RUNNING IT DOES NOT OPEN AT ALL** (SCRUM-223). ⚠️ The database
          would refuse the write anyway — so offering the tap would be a control that cannot do what it
          promises (the SCRUM-145 rule). Instead the row renders DISABLED and says how long is left, which is
          the same pattern the rows with no destination use.
        */}
        {cooldown.allowed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('profile.nameRow')}
            testID="profile-name-edit"
            onPress={() => {
              setDraft(chosenName ?? '');
              setProblem(null);
              setProblemVars(undefined);
              setEditing(true);
            }}
            style={({ pressed }) => [styles.card, styles.nameRow, pressed && styles.pressed]}
          >
            <View style={styles.headerText}>
              <Text numberOfLines={1} style={styles.nameRowLabel}>
                {t('profile.nameRow')}
              </Text>
              <Text numberOfLines={1} style={styles.nameRowSub}>
                {chosenName ?? t('profile.nameNotSet')}
              </Text>
            </View>
            <Text style={styles.chev}>{'\u203A'}</Text>
          </Pressable>
        ) : (
          <View
            style={[styles.card, styles.nameRow, styles.rowDisabled]}
            testID="profile-name-edit"
            accessibilityState={{ disabled: true }}
          >
            <View style={styles.headerText}>
              <Text numberOfLines={1} style={styles.nameRowLabel}>
                {t('profile.nameRow')}
              </Text>
              {/* ⚠️ The wait, not "Not set yet" — the state of the control IS the message. */}
              <Text numberOfLines={1} style={styles.nameRowSub} testID="profile-name-locked">
                {t('profile.nameLockedSub', { remaining: String(Math.max(1, cooldown.daysRemaining)) })}
              </Text>
            </View>
          </View>
        )}

        {/* ── the tribute card ─────────────────────────────────────────────── */}
        {tribute === null ? null : (
          <View style={[styles.card, styles.tributeCard]} testID="profile-tribute">
            <View style={styles.tributeLeft}>
              <Text style={styles.tributeNumber}>{tribute}</Text>
              <Text style={styles.tributeLabel}>{t('profile.tributeLabel')}</Text>
            </View>
            {streakDays === null ? null : (
              <Text style={styles.tributeStreak}>
                {t('home.streakLabel', { days: String(streakDays) })}
              </Text>
            )}
          </View>
        )}

        {/* ── the rows ─────────────────────────────────────────────────────── */}
        {PROFILE_ROWS.map((row) => (
          <ProfileRow
            key={row.id}
            labelKey={ROW_COPY[row.id].label}
            subKey={ROW_COPY[row.id].sub}
            route={row.route}
            testID={`profile-row-${row.id}`}
          />
        ))}
      </ScrollView>

      {/*
        ⚠️ **PROFILE IS ONE OF THE BAR'S OWN DESTINATIONS, SO THE BAR IS HERE** (owner's ruling,
        2026-11-01) — otherwise the bar's Profile button was a one-way push and *"tap Profile while
        on Profile"* could not happen. ⚠️ AFTER the ScrollView (`flex: 1`, so it yields room) and
        BEFORE the HUD, so the HUD stays last and keeps its taps.
      */}
      <TabBarBand />

      <ScreenHud titleKey="profile.title" backTestID="profile-back" titleTestID="profile-title" />

      {/*
        ⚠️ **A `Modal`, not an overlay** — the same reason `ConfirmCard` is one: Android's hardware BACK must be
        HANDLED here (`onRequestClose`), or a back press falls through to the screen while the sheet is still up.
        ⚠️ And it is the only place in the app where the user types their own identity, so it carries its own
        accessibility layer (`accessibilityViewIsModal`).
      */}
      <Modal
        visible={editing}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(false)}
      >
        <View style={styles.scrim}>
          <View style={styles.sheet} testID="profile-name-sheet" accessibilityViewIsModal>
            <Text style={styles.sheetTitle}>{t('profile.nameRow')}</Text>
            <Text style={styles.sheetBody}>
              {t('profile.nameHint', { days: String(NAME_CHANGE_INTERVAL_DAYS) })}
            </Text>
            <TextInput
              testID="profile-name-input"
              value={draft}
              onChangeText={setDraft}
              maxLength={CHOSEN_NAME_MAX}
              autoFocus
              placeholder={t('profile.namePlaceholder')}
              placeholderTextColor={text.inkSoft}
              returnKeyType="done"
              onSubmitEditing={save}
              style={styles.input}
              accessibilityLabel={t('profile.nameRow')}
            />
            {/* ⚠️ A limit the user can SEE, rather than a silent cap on the field. */}
            <Text style={styles.hintCount}>
              {`${draft.trim().length}/${CHOSEN_NAME_MAX}`}
            </Text>
            {problem === null ? null : (
              <Text style={styles.problem} testID="profile-name-problem">
                {t(problem, problemVars ?? {})}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              testID="profile-name-save"
              onPress={save}
              disabled={saving}
              style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed, saving && styles.saving]}
            >
              <Text style={styles.saveLabel}>
                {t(saving ? 'profile.nameSaving' : 'profile.nameSave')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              testID="profile-name-cancel"
              onPress={() => setEditing(false)}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
            >
              <Text style={styles.cancelLabel}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.paper },
  /** ⚠️ `flex: 1` so the ScrollView yields room to the tab band instead of being overlaid by it. */
  scroll: { flex: 1 },
  content: { paddingTop: HUD.touch.y + HUD.touch.size + 15, paddingHorizontal: PROFILE_CARD.x, paddingBottom: 40 },
  card: {
    minHeight: PROFILE_CARD.headerH,
    borderRadius: PROFILE_CARD.radius,
    backgroundColor: surface.row,
    borderWidth: 2.5,
    borderColor: brand.ink,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  tributeCard: { minHeight: PROFILE_CARD.tributeH },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: surface.paperDeep,
    borderWidth: 2.5,
    borderColor: brand.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlyph: { color: text.gold, fontSize: 30, fontWeight: '700' },
  headerText: { flex: 1, paddingLeft: 16 },
  headerName: { color: text.ink, fontSize: 19, fontWeight: '700' },
  headerRole: { color: text.inkSoft, fontSize: fontSize.caption.at390, marginTop: 4 },
  /** ⚠️ The name row reads as a card like the header, so the screen looks like one list, not two. */
  nameRow: { minHeight: 64, justifyContent: 'flex-start' },
  nameRowLabel: { color: text.ink, fontSize: fontSize.body.at390, fontWeight: '700' },
  nameRowSub: { color: text.inkSoft, fontSize: fontSize.caption.at390, marginTop: 2 },
  saving: { opacity: 0.6 },
  scrim: { flex: 1, backgroundColor: 'rgba(26,26,26,0.55)', justifyContent: 'center', paddingHorizontal: 20 },
  sheet: { backgroundColor: surface.paper, borderRadius: 14, padding: 24, borderWidth: 2.5, borderColor: brand.ink },
  sheetTitle: { color: text.ink, fontSize: 19, fontWeight: '700' },
  sheetBody: { color: text.inkSoft, fontSize: fontSize.body.at390, marginTop: 8, lineHeight: 20 },
  input: {
    marginTop: 16,
    minHeight: 52,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: brand.ink,
    backgroundColor: surface.row,
    paddingHorizontal: 14,
    color: text.ink,
    fontSize: fontSize.bodyLg.at390,
  },
  hintCount: { color: text.inkSoft, fontSize: fontSize.caption.at390, marginTop: 6, textAlign: 'right' },
  problem: { color: brand.cinnabar, fontSize: fontSize.body.at390, fontWeight: '700', marginTop: 8 },
  saveBtn: {
    marginTop: 16,
    height: 52,
    borderRadius: 12,
    backgroundColor: brand.cinnabar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLabel: { color: onColorCream, fontSize: fontSize.bodyLg.at390, fontWeight: '700' },
  cancelBtn: { marginTop: 4, height: 44, alignItems: 'center', justifyContent: 'center' },
  cancelLabel: { color: text.inkSoft, fontSize: fontSize.body.at390, fontWeight: '700' },
  tributeLeft: { flex: 1 },
  tributeNumber: { color: text.ink, fontSize: 26, fontWeight: '700' },
  tributeLabel: { color: text.inkSoft, fontSize: fontSize.caption.at390, marginTop: 2 },
  tributeStreak: { color: text.gold, fontSize: fontSize.body.at390, fontWeight: '700' },
  row: {
    minHeight: PROFILE_ROW.h,
    borderRadius: PROFILE_ROW.radius,
    backgroundColor: surface.row,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: PROFILE_ROW.labelDx,
    paddingRight: 12,
    marginBottom: 8,
  },
  /** ⚠️ Dimmed, not hidden — a real destination that is simply not built (the tab-bar rule). */
  rowDisabled: { opacity: 0.45 },
  rowText: { flex: 1, paddingVertical: 10 },
  rowLabel: { color: text.ink, fontSize: fontSize.bodyLg.at390, fontWeight: '700' },
  rowSub: { color: text.inkSoft, fontSize: fontSize.caption.at390, marginTop: 2 },
  chev: { color: text.inkSoft, fontSize: 20, fontWeight: '700', width: 24, textAlign: 'center' },
  pressed: { opacity: 0.75 },
});

