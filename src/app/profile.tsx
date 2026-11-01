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
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { myClans } from '@/lib/clan-api';
import { fetchHomeSummary } from '@/lib/home-api';
import { homePanels } from '@/lib/home-panels';
import { t } from '@/lib/i18n';
import { HUD, PROFILE_CARD, PROFILE_ROWS, PROFILE_ROW, rowIsLive } from '@/lib/profile';
import { ROLE_LABEL_KEY } from '@/lib/clan-flow';
import { brand, fontSize, surface, text } from '@/theme/tokens';

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
  const [clanName, setClanName] = useState<string | null>(null);
  const [roleKey, setRoleKey] = useState<string | null>(null);
  const [tribute, setTribute] = useState<string | null>(null);
  const [streakDays, setStreakDays] = useState<number | null>(null);

  /**
   * ⚠️ Re-read on FOCUS, the same pattern the shrine uses: a burn moves the tribute total, and a
   * language switch remounts the tree — so this must not be a once-per-mount read.
   */
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const [mine, totals] = await Promise.all([myClans(), fetchHomeSummary()]);
        if (cancelled) return;
        const first = mine.ok ? mine.data[0] : undefined;
        setClanName(first?.name ?? null);
        setRoleKey(first ? (ROLE_LABEL_KEY[first.role] ?? null) : null);
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

  return (
    <View style={styles.screen}>
      {/* ── the HUD — `btn · back (ink)` + `hud · screen title` ─────────────── */}
      <View style={[styles.abs, { left: HUD.back.x, top: HUD.back.y, width: HUD.back.size, height: HUD.back.size }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('clan.back')}
          testID="profile-back"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/');
          }}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Text style={styles.backGlyph}>{'\u2039'}</Text>
        </Pressable>
      </View>
      <Text style={[styles.abs, { left: HUD.title.x, top: HUD.title.y }]} testID="profile-title">
        {t('profile.title')}
      </Text>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* ── the header card ──────────────────────────────────────────────── */}
        <View style={styles.card} testID="profile-header">
          <View style={styles.avatar}>
            <Text style={styles.avatarGlyph} allowFontScaling={false}>
              {clanName ? Array.from(clanName)[0] : ''}
            </Text>
          </View>
          <View style={styles.headerText}>
            {/* ⚠️ Nothing rather than a placeholder: a failed read must not invent a name. */}
            <Text numberOfLines={1} style={styles.headerName} testID="profile-clan">
              {clanName ?? ''}
            </Text>
            {roleKey ? <Text style={styles.headerRole}>{t(roleKey)}</Text> : null}
          </View>
        </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.paper },
  abs: { position: 'absolute' },
  content: { paddingTop: HUD.back.y + HUD.back.size + 18, paddingHorizontal: PROFILE_CARD.x, paddingBottom: 40 },
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

