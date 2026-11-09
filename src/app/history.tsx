/**
 * HISTORY — `EN · 8c History` / `ZH · 8c 历史` (SCRUM-151).
 *
 * ── ⚠️ WHY THIS SCREEN NEEDED A MIGRATION ───────────────────────────────────
 * Until 2026-11-01 nothing in the RPC surface could return a user's own burns: `home_summary`
 * returns two aggregates and `clan_book` returns the CLAN's entries. So this screen reads
 * `my_offerings()` / `my_offerings_week()`, both `SECURITY DEFINER` and scoped to `auth.uid()`.
 *
 * ⚠️⚠️ **CORRECTION 2026-11-01 (S73) — the reason originally written here was WRONG, and it was
 * measured.** It claimed `burns` and `tributes` have RLS with **no policy**, so a client select
 * answers `[]` with no error. The live database says otherwise: **both carry a SELECT policy**
 * (`burns_select_own` · `tributes_select_member`) **and `authenticated` holds the SELECT grant**
 * (`has_table_privilege(...) = true`), so a client *can* read its own rows. ⚠️ **The RPC is still
 * the right shape** — one round trip joining burns, tributes and the week window, returning no ids
 * this screen does not need — but **not** because the tables were unreadable.
 *
 * ── ⚠️ A FAILED READ IS NOT THE EMPTY STATE ─────────────────────────────────
 * Three states, and they are different facts: **loading** (nothing yet), **failed** (`hist.unreachable`
 * — we could not reach the shrine) and **empty** (`hist.empty` — you have burned nothing). Rendering
 * the empty copy on a failure would state a fact about the user that the app does not know.
 *
 * ⚠️ The board's own footnote ships verbatim: *"Only your offerings — nothing about others."* — it is
 * the promise the `auth.uid()` scoping keeps, so it belongs on the screen.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { BAND_IDS, getBand, type BandId } from '@/domain/aim';
import { OFFERINGS } from '@/domain/catalogue';
import { myOfferings, myOfferingsWeek, type OfferingRow, type OfferingWeek } from '@/lib/account-api';
import { ScreenHud } from '@/components/screen-hud';
import { activeLocale, localized, t } from '@/lib/i18n';
import { HISTORY_SPEC, HUD, burnedAtLabel, offeringGlyph, streakDayKey } from '@/lib/profile';
import { brand, fontSize, radius, surface, text } from '@/theme/tokens';

export default function HistoryScreen() {
  const [rows, setRows] = useState<readonly OfferingRow[] | null>(null);
  const [week, setWeek] = useState<OfferingWeek | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const [list, summary] = await Promise.all([myOfferings(), myOfferingsWeek()]);
    if (!list.ok) {
      /** ⚠️ A failure is kept AS a failure — never folded into an empty list. */
      setFailed(true);
      setRows(null);
      setWeek(null);
      return;
    }
    setRows(list.data);
    setWeek(summary.ok ? summary.data : null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.screen}>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {failed ? (
          <Text style={styles.problem} testID="history-problem">
            {t('hist.unreachable')}
          </Text>
        ) : rows === null ? null : (
          <>
            {/* ── THIS WEEK ─────────────────────────────────────────────────── */}
            {week ? (
              <>
                <Text style={styles.sectionHead}>{t('hist.weekHead')}</Text>
                <View style={styles.week} testID="history-week">
                  <View style={styles.weekLeft}>
                    <Text style={styles.weekBurned}>
                      {t('hist.weekBurned', { count: String(week.burned) })}
                    </Text>
                    <Text style={styles.weekTribute}>
                      {t('hist.weekTribute', { points: String(week.tribute) })}
                    </Text>
                  </View>
                  <Text style={styles.weekStreak}>
                    {t(streakDayKey(week.streakDays), { days: String(week.streakDays) })}
                  </Text>
                </View>
              </>
            ) : null}

            {/* ── ALL OFFERINGS ─────────────────────────────────────────────── */}
            <Text style={styles.sectionHead}>{t('hist.allHead')}</Text>
            {rows.length === 0 ? (
              <Text style={styles.empty} testID="history-empty">
                {t('hist.empty')}
              </Text>
            ) : (
              rows.map((row) => <HistoryRow key={row.burnId} row={row} now={now} />)
            )}

            <Text style={styles.note}>{t('hist.note')}</Text>
          </>
        )}
      </ScrollView>

      <ScreenHud titleKey="hist.title" backTestID="history-back" titleTestID="history-title" band />
    </View>
  );
}

/** ⚠️ Read ONCE per render pass, so every row's "Today" is measured against the same instant. */
const now = new Date();

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.paper },
  content: { paddingTop: HUD.touch.y + HUD.touch.size + 15, paddingHorizontal: HISTORY_SPEC.row.x, paddingBottom: 40 },
  sectionHead: {
    color: text.inkSoft,
    fontSize: fontSize.caption.at390,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
  },
  week: {
    minHeight: HISTORY_SPEC.week.h,
    borderRadius: HISTORY_SPEC.week.radius,
    backgroundColor: surface.row,
    borderWidth: 2.5,
    borderColor: brand.ink,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  weekLeft: { flex: 1 },
  weekBurned: { color: text.ink, fontSize: fontSize.titleRow.at390, fontWeight: '700' },
  weekTribute: { color: text.inkSoft, fontSize: fontSize.caption.at390, marginTop: 2 },
  weekStreak: { color: text.gold, fontSize: fontSize.body.at390, fontWeight: '700' },
  row: {
    minHeight: HISTORY_SPEC.row.h,
    borderRadius: HISTORY_SPEC.row.radius,
    backgroundColor: surface.row,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: HISTORY_SPEC.row.thumbDx,
    marginBottom: 8,
  },
  thumb: {
    width: HISTORY_SPEC.row.thumb,
    height: HISTORY_SPEC.row.thumb,
    borderRadius: HISTORY_SPEC.row.thumbRadius,
    backgroundColor: surface.paperDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbGlyph: { color: text.gold, fontSize: 24, fontWeight: '700' },
  rowText: { flex: 1, paddingLeft: 14, paddingVertical: 10 },
  rowName: { color: text.ink, fontSize: fontSize.bodyLg.at390, fontWeight: '700' },
  rowMeta: { color: text.inkSoft, fontSize: fontSize.caption.at390, marginTop: 2 },
  rowBand: { color: text.inkSoft, fontSize: fontSize.caption.at390, marginTop: 2, fontWeight: '700' },
  rowPoints: { color: text.ink, fontSize: fontSize.titleRow.at390, fontWeight: '700' },
  empty: { color: text.muted, fontSize: fontSize.body.at390, marginTop: 8 },
  note: { color: text.inkSoft, fontSize: fontSize.caption.at390, marginTop: 20 },
  problem: { color: brand.cinnabar, fontWeight: '700' },
  pressed: { opacity: 0.75 },
});

function asBandId(value: string): BandId | null {
  return (BAND_IDS as readonly string[]).includes(value) ? (value as BandId) : null;
}

/** The catalogue name for a burn's item code. ⚠️ A code the catalogue does not know renders blank. */
function itemName(code: string | null): string {
  if (code === null) return t('hist.photoOffering');
  const offering = OFFERINGS.find((o) => o.code === code);
  return offering ? localized(offering.name) : '';
}

function HistoryRow({ row, now }: { row: OfferingRow; now: Date }) {
  const name = itemName(row.itemCode);
  const band = asBandId(row.band);
  const locale = activeLocale();
  /**
   * ⚠️ Resolved into locals FIRST, so the `t(...)` call itself stays on ONE line. `check:copy` rule
   * 3 cannot statically read a call split across lines — it asserts none exist, and this is why.
   */
  const bandSpec = band === null ? null : getBand(band);
  const bandName = bandSpec === null ? '' : localized(bandSpec.label);
  const bandMult = bandSpec === null ? '' : String(bandSpec.multiplier);

  return (
    <View style={styles.row} testID={`hist-row-${row.burnId}`}>
      <View style={styles.thumb}>
        <Text style={styles.thumbGlyph} allowFontScaling={false}>
          {offeringGlyph(name)}
        </Text>
      </View>
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={styles.rowName}>
          {name}
        </Text>
        <Text numberOfLines={1} style={styles.rowMeta}>
          {burnedAtLabel(row.burnedAt, now, locale)}
        </Text>
        {bandSpec === null ? null : (
          <Text numberOfLines={1} style={styles.rowBand}>
            {t('hist.band', { band: bandName, mult: bandMult })}
          </Text>
        )}
      </View>
      <Text numberOfLines={1} style={styles.rowPoints}>
        {row.points > 0 ? `+${row.points}` : String(row.points)}
      </Text>
    </View>
  );
}
