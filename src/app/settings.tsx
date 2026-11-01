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
 */

import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Body } from '@/components/clan-ui';
import { ConfirmCard } from '@/components/confirm-card';
import { LocaleToggle } from '@/components/locale-toggle';
import { deleteMyData, resetIdentity } from '@/lib/account-api';
import { clearFirstRun } from '@/lib/first-run';
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

  return (
    <View style={styles.screen}>
      {/* ── the HUD — `btn · back (ink)` + `hud · screen title` ─────────────── */}
      <View style={[styles.abs, { left: HUD.back.x, top: HUD.back.y, width: HUD.back.size, height: HUD.back.size }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('clan.back')}
          testID="settings-back"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/');
          }}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Text style={styles.backGlyph}>{'\u2039'}</Text>
        </Pressable>
      </View>
      <Text style={[styles.abs, { left: HUD.title.x, top: HUD.title.y }]} testID="settings-title">
        {t('settings.title')}
      </Text>

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
        <SettingRow labelKey="settings.signOut" subKey="settings.notBuilt" testID="settings-signout" />

        {busy ? <Body>{t('settings.deleting')}</Body> : null}
        {/* ⚠️ The server's refusal is NOT shown raw here: the only refusals are the rate limit and a
            network failure, and both mean the same thing to the user — nothing was erased. */}
        {problem ? (
          <Text style={styles.problem} testID="settings-problem">
            {problem}
          </Text>
        ) : null}
      </ScrollView>

      <ConfirmCard
        visible={confirming}
        title={t('settings.deleteTitle')}
        body={t('settings.deleteBody')}
        confirmLabel={t('settings.deleteConfirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={runDelete}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.paper },
  abs: { position: 'absolute' },
  content: { paddingTop: HUD.back.y + HUD.back.size + 18, paddingHorizontal: SETTINGS_ROW.x, paddingBottom: 40 },
  back: {
    width: HUD.back.size,
    height: HUD.back.size,
    borderRadius: HUD.back.radius,
    borderWidth: 2.5,
    borderColor: brand.ink,
    backgroundColor: surface.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: { color: text.ink, fontSize: 24, lineHeight: 28 },
  title: { color: text.ink, fontSize: fontSize.titleRow.at390, fontWeight: '700' },
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

