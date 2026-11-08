/**
 * SETTINGS — `EN · 8b Settings` / `ZH · 8b 设置` (SCRUM-151).
 *
 * ── ⚠️ THE LANGUAGE SWITCHER IS THE POINT OF THIS SCREEN ────────────────────
 * Measured 2026-11-01: `setLocale` was called from **no screen and no component**, so the app was
 * permanently English and a reviewer could not reach 中文 — with every string translated and
 * `check:lib` §15/§16 holding both tables. This screen is where that defect ends.
 *
 * ── ⚠️ EVERY ROW THAT IS NOT BUILT SAYS SO ──────────────────────────────────
 * The board draws a notifications toggle, an analytics toggle, an export row and a policies row.
 * **None of them has anything behind it** — no notification module, no analytics, no export, and the
 * policy lives on the website. ⚠️ A toggle that looks ON and does nothing is the SCRUM-145 defect
 * ("a control that renders, is reachable, and leaves the user stuck"), so they render **disabled and
 * dimmed with `settings.notBuilt`**, which is the same ruling the tab bar made for Store/Profile.
 *
 * ⚠️ **One exception, and it is deliberate:** `Original photos` renders as a plain **statement** — its
 * sub IS the retention policy, which is what the ticket asks to surface. It has no chevron because it
 * has no destination; a chevron is a promise to navigate.
 *
 * ── ⚠️ SIGN OUT — THE ROW THAT WAS DRAWN, REACHABLE AND DEAD (SCRUM-215) ─────
 * Built 2026-11-08. It had rendered **disabled with `settings.notBuilt`** since SCRUM-151, which was
 * correct while nothing was behind it: a live-looking control with no behaviour is the SCRUM-145 defect.
 * ⚠️ But it left the account flow **one-way on glass** — a device could take on an email account and never
 * leave it, so the email-link path could not be retested without wiping the install. The row now opens a
 * `ConfirmCard` and calls `signOutAccount()`.
 *
 * ⚠️ **AND IT ERASES NOTHING.** It is NOT `resetIdentity()`: that one deletes and then mints a fresh
 * identity (*"back to first run"*, the only caller of `clearFirstRun()`). ⚠️ Signing out must **not**
 * forget the tutorial record — this device's first run did not change, and replaying the walkthrough would
 * describe an erasure that did not happen. The account keeps everything server-side; the email brings it
 * back. ⚠️ `check:lib` asserts the handler calls neither `deleteMyData` nor `clearFirstRun`.

 */

import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Body } from '@/components/clan-ui';
import { ConfirmCard } from '@/components/confirm-card';
import { LocaleToggle } from '@/components/locale-toggle';
import { deleteMyData, resetIdentity } from '@/lib/account-api';
import { signOutAccount } from '@/lib/account';
import { clearFirstRun } from '@/lib/first-run';
import { ScreenHud } from '@/components/screen-hud';
import { t } from '@/lib/i18n';
import { HUD, SETTINGS_ROW } from '@/lib/profile';
import { brand, fontSize, onColorCream, radius, surface, text } from '@/theme/tokens';

/** One Settings row. `onPress` omitted ⇒ the row is DISABLED, never a dead link. */
function SettingRow({
  labelKey,
  subKey,
  onPress,
  danger = false,
  trailing,
  dim = true,
  testID,
}: {
  labelKey: string;
  subKey: string;
  onPress?: () => void;
  danger?: boolean;
  trailing?: React.ReactNode;
  /** ⚠️ `false` = the row is inert but NOT dimmed — it carries a live control (the switcher). */
  dim?: boolean;
  testID?: string;
}) {
  const inert = onPress === undefined;
  const body = (
    <>
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[styles.rowLabel, danger && styles.danger]}>
          {t(labelKey)}
        </Text>
        <Text numberOfLines={1} style={styles.rowSub}>
          {t(subKey)}
        </Text>
      </View>
      {trailing ?? (inert ? null : <Text style={styles.chev}>{'\u203A'}</Text>)}
    </>
  );

  if (inert) {
    return (
      <View
        style={[styles.row, dim && styles.rowDisabled]}
        testID={testID}
        accessibilityState={{ disabled: true }}
      >
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(labelKey)}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

function SectionHead({ titleKey }: { titleKey: string }) {
  return <Text style={styles.sectionHead}>{t(titleKey)}</Text>;
}

export default function SettingsScreen() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /** ⚠️ Sign-out keeps its OWN three, so a failed sign-out cannot print the delete's copy (or vice versa). */
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutProblem, setSignOutProblem] = useState<string | null>(null);

  /**
   * ⚠️ THE ORDER MATTERS, AND IT IS THE WHOLE OF "back to first run":
   *   1. delete — and only continue if the SERVER says it went through;
   *   2. forget the tutorial record, so the walkthrough replays;
   *   3. sign out and mint a FRESH identity (the RPC cannot remove `auth.users`);
   *   4. land on the shrine, which is clan-less — the first-run fork.
   * ⚠️ A failed delete stops at step 1 and says so. Nothing is half-erased.
   */
  const runDelete = useCallback(() => {
    void (async () => {
      setConfirming(false);
      setBusy(true);
      setProblem(null);

      const result = await deleteMyData();
      if (!result.ok) {
        setBusy(false);
        setProblem(t('settings.deleteFailed'));
        return;
      }

      await clearFirstRun();
      await resetIdentity();
      setBusy(false);
      router.replace('/');
    })();
  }, []);

  /**
   * ⚠️ SIGN OUT — and NOTHING here erases: no `deleteMyData`, and deliberately **no `clearFirstRun`**.
   * ⚠️ The order still matters, for a different reason than the delete's: `signOutAccount()` signs out and
   * then **re-mints the anonymous identity**, because this app has no session-less state to render. Landing
   * on the shrine afterwards is what makes the fresh anonymous device visible — it is clan-less, which is
   * the first-run fork.
   * ⚠️ A failure stops here and SAYS SO. *"You are still signed in"* must never render as if it worked.
   */
  const runSignOut = useCallback(() => {
    void (async () => {
      setConfirmingSignOut(false);
      setSigningOut(true);
      setSignOutProblem(null);

      const result = await signOutAccount();
      setSigningOut(false);
      if (!result.ok) {
        setSignOutProblem(t('settings.signOutFailed'));
        return;
      }
      router.replace('/');
    })();
  }, []);

  return (
    <View style={styles.screen}>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SectionHead titleKey="settings.general" />

        {/* ⚠️ THE SWITCHER — the reason this screen exists.
            ⚠️ NO `onPress`: the row itself is inert and `dim={false}` so it does not read as
            disabled. The TOGGLE is the control. Giving the row a no-op handler would draw a `›`
            and a press ripple for a tap that does nothing — the SCRUM-145 defect. */}
        <SettingRow
          labelKey="settings.language"
          subKey="settings.notBuilt"
          dim={false}
          testID="settings-language"
          trailing={<LocaleToggle />}
        />

        <SettingRow labelKey="settings.notifications" subKey="settings.notBuilt" testID="settings-notifications" />

        <SectionHead titleKey="settings.privacy" />

        {/* ⚠️ A STATEMENT, not a destination — its sub IS the retention policy. No chevron. */}
        <SettingRow labelKey="settings.retention" subKey="settings.retentionSub" testID="settings-retention" />
        <SettingRow labelKey="settings.analytics" subKey="settings.notBuilt" testID="settings-analytics" />
        <SettingRow labelKey="settings.export" subKey="settings.notBuilt" testID="settings-export" />

        <SettingRow
          labelKey="settings.deleteAll"
          subKey="settings.deleteAllSub"
          danger
          testID="settings-delete"
          onPress={() => setConfirming(true)}
        />

        <SettingRow labelKey="settings.policies" subKey="settings.notBuilt" testID="settings-policies" />

        {/* ⚠️ LIVE as of SCRUM-215 — the sub names the consequence, not `settings.notBuilt`. */}
        <SettingRow
          labelKey="settings.signOut"
          subKey="settings.signOutSub"
          testID="settings-signout"
          onPress={() => {
            setSignOutProblem(null);
            setConfirmingSignOut(true);
          }}
        />

        {busy ? <Body>{t('settings.deleting')}</Body> : null}
        {signingOut ? <Body>{t('settings.signingOut')}</Body> : null}
        {/* ⚠️ The server's refusal is NOT shown raw here: the only refusals are the rate limit and a
            network failure, and both mean the same thing to the user — nothing was erased. */}
        {problem ? (
          <Text style={styles.problem} testID="settings-problem">
            {problem}
          </Text>
        ) : null}
        {/* ⚠️ A FAILED SIGN-OUT IS ITS OWN LINE. Reusing `settings-problem` would let a failed sign-out
            print the delete's copy, which claims data was erased — the opposite of what happened. */}
        {signOutProblem ? (
          <Text style={styles.problem} testID="settings-signout-problem">
            {signOutProblem}
          </Text>
        ) : null}
      </ScrollView>

      <ScreenHud titleKey="settings.title" backTestID="settings-back" titleTestID="settings-title" />

      <ConfirmCard
        visible={confirming}
        title={t('settings.deleteTitle')}
        body={t('settings.deleteBody')}
        confirmLabel={t('settings.deleteConfirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={runDelete}
        onCancel={() => setConfirming(false)}
      />

      {/* ⚠️ A second card, not a shared one: the two actions differ in exactly the way a user must not
          confuse — one erases the account's data, the other leaves it. */}
      <ConfirmCard
        visible={confirmingSignOut}
        title={t('settings.signOutTitle')}
        body={t('settings.signOutBody')}
        confirmLabel={t('settings.signOutConfirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={runSignOut}
        onCancel={() => setConfirmingSignOut(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.paper },
  content: { paddingTop: HUD.touch.y + HUD.touch.size + 15, paddingHorizontal: SETTINGS_ROW.x, paddingBottom: 40 },
  sectionHead: {
    color: text.inkSoft,
    fontSize: fontSize.caption.at390,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
  },
  row: {
    minHeight: SETTINGS_ROW.h,
    borderRadius: SETTINGS_ROW.radius,
    backgroundColor: surface.row,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SETTINGS_ROW.labelDx,
    paddingRight: 12,
    marginBottom: 8,
  },
  /** ⚠️ Dimmed, not hidden — the row is a real feature that is simply not built (the tab-bar rule). */
  rowDisabled: { opacity: 0.45 },
  rowText: { flex: 1, paddingVertical: 10 },
  rowLabel: { color: text.ink, fontSize: fontSize.bodyLg.at390, fontWeight: '700' },
  rowSub: { color: text.inkSoft, fontSize: fontSize.caption.at390, marginTop: 2 },
  danger: { color: text.cinnabar },
  chev: { color: text.inkSoft, fontSize: 20, fontWeight: '700', width: 24, textAlign: 'center' },
  problem: { color: brand.cinnabar, fontWeight: '700', marginTop: 8 },
  pressed: { opacity: 0.75 },
});

