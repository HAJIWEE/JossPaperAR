import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { ClanPill } from '@/components/clan-pill';
import { AltarHalo } from '@/components/home/altar-halo';
import { AppMark, SettingsGear } from '@/components/home/header-art';
import { ShrineBase } from '@/components/home/shrine-base';
import { ShrineCanvas } from '@/components/home/shrine-canvas';
import { myClans } from '@/lib/clan-api';
import { PILL_X_ON_REFERENCE, type PillClan } from '@/lib/clan-pill';
import { readFirstRun } from '@/lib/first-run';
import {
  HOME_BANDS,
  HOME_REGION_ORDER,
  bandRect,
  homeFitScale,
  type HomeRegion,
} from '@/lib/home-layout';
import { t } from '@/lib/i18n';
import { DEMO_PARAM, DEMO_VALUE, needsTutorial } from '@/lib/tutorial';
import { brand, fontSize, onColorCream, radius, surface } from '@/theme/tokens';

/**
 * HOME — the shrine (SCRUM-148 · SCRUM-160 · SCRUM-162).
 *
 * ── THE LAYOUT IS ABSOLUTELY PLACED ON A 390 × 844 CANVAS ───────────────────
 * ⚠️ The first pass stacked these regions as **flow** children with `marginBottom`,
 * which threw away every y-coordinate the board specifies — that is why the placement
 * was wrong on glass. The shrine is a fixed-art composition, so it is drawn as one:
 * `ShrineCanvas` gives us `width × (844 × scale)` and every element is placed from
 * `HOME_BANDS` through `bandRect`.
 *
 * ⚠️ **Responsive means "the same shrine, scaled" — not reflowed.** One uniform scale
 * (`homeFitScale` = the smaller of `w/390` and `h/844`) keeps the proportions the art and
 * the aim grader were measured against, and guarantees the whole shrine fits at any size:
 * a short or small screen **shrinks it**, it never squashes or clips. Every band goes
 * through `bandRect` — SCRUM-162 shipped one that did not, and the shrine base hung
 * 14 dp off a 360 dp screen.
 *
 * ── WHAT IS STILL A RESERVED BAND ───────────────────────────────────────────
 * A dashed outline marks a band whose ticket has not landed. They are **correctly
 * positioned** — the box you see is where the real thing goes:
 *   settings → SCRUM-151 · tribute + streak → SCRUM-161 · halo + offerings → SCRUM-162
 *   · tab bar → SCRUM-164
 * ⚠️ `HOME_REGION_ORDER` is now the **paint order (z)**, which is what the board's own
 * layer list encodes: the halo is behind the art, the art behind the CTA.
 */

export default function HomeShrine() {
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  /** Board px → device dp, contain-fit on BOTH axes. The ONE conversion on this screen. */
  const s = homeFitScale(windowWidth, windowHeight);
  const [clans, setClans] = useState<readonly PillClan[]>([]);

  // The pill must reflect a clan created or joined *after* Home first mounted, so
  // this re-reads on every focus (the `clan/index.tsx` pattern).
  // ⚠️ A failed read hides the pill rather than showing a stale clan.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const mine = await myClans();
        if (!cancelled) {
          setClans(mine.ok ? mine.data.map((c) => ({ name: c.name, role: c.role })) : []);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const startOffering = () => {
    // ── SCRUM-85 · the FIRST burn is a TUTORIAL ─────────────────────────────
    // ⚠️ Read the first-run record HERE, at the tap, rather than in an effect: the
    // flag must reflect the device's state at the moment of the decision.
    void (async () => {
      const firstRun = await readFirstRun();
      const params = needsTutorial(firstRun) ? { [DEMO_PARAM]: DEMO_VALUE } : {};
      router.push({ pathname: '/capture', params });
    })();
  };

  const region = (name: HomeRegion) => {
    switch (name) {
      // ── header · the app mark, the pill, the settings slot ─────────────────
      case 'header':
        return (
          <>
            <View style={[styles.abs, bandRect(HOME_BANDS.headerMark, s)]} testID="home-app-mark">
              <AppMark />
            </View>
            {/* ⚠️ The pill's x is board-relative: 390 − 20 − 44 − 10 − 236 = 80. */}
            <View
              style={[styles.abs, { left: PILL_X_ON_REFERENCE * s, top: HOME_BANDS.settings.y * s }]}
              testID="home-pill-slot"
            >
              <ClanPill clans={clans} scale={s} />
            </View>
            {/*
              ⚠️ DECORATIVE FOR NOW, and deliberately not a `Pressable`. The board draws
              this as `btn · settings` and the gear belongs here — but the settings screen
              arrives with SCRUM-151, and ⚠️ **a control that renders and does nothing is
              the SCRUM-145 defect** (an inert "Throw again" that passed every per-screen
              gate). It becomes a button the moment it has a destination, not before.

              ⚠️ The BUTTON SURFACE is part of the board and was missing at first: the
              owner read the bare gear as misaligned, and it was — `btn · settings` is a
              `#EAE2D2` fill with a **2.5 px ink stroke and r14**, i.e. exactly the clan
              pill's treatment (`PILL_SPEC.radius` 14 · `borderWidth` 2.5). Without it the
              icon had nothing to sit in. ⚠️ RN draws the stroke INSIDE the box, so at
              scale 1 the 2.5 is the right number here — no `CONTENT_PAD_H` correction,
              because this surface holds no text to inset.
            */}
            <View
              style={[
                styles.abs,
                bandRect(HOME_BANDS.settings, s),
                styles.settingsBtn,
                { borderRadius: 14 * s, borderWidth: 2.5 * s },
              ]}
              testID="home-settings-slot"
            >
              <View style={{ width: 20 * s, height: 20 * s }}>
                <SettingsGear />
              </View>
            </View>
          </>
        );

      // ── totals · the tribute and streak panels (SCRUM-161) ────────────────
      case 'totals':
        return (
          <>
            <View
              style={[styles.abs, bandRect(HOME_BANDS.tribute, s), styles.reserved]}
              testID="home-tribute-band"
            />
            <View
              style={[styles.abs, bandRect(HOME_BANDS.streak, s), styles.reserved]}
              testID="home-streak-band"
            />
          </>
        );

      // ── altar · the halo, the offerings and the shrine base ───────────────
      case 'altar':
        return (
          <>
            <View style={[styles.abs, bandRect(HOME_BANDS.halo, s)]} testID="home-halo-band">
              <AltarHalo />
            </View>
            <View
              style={[styles.abs, bandRect(HOME_BANDS.offerings, s), styles.reserved]}
              testID="home-offerings-band"
            />
            <View style={[styles.abs, bandRect(HOME_BANDS.shrineBase, s)]} testID="home-shrine-base">
              <ShrineBase />
            </View>
            <View
              style={[styles.abs, bandRect(HOME_BANDS.caption, s)]}
              testID="home-caption-band"
            />
          </>
        );

      // ── cta · the offer is taken AT the altar, never from the chrome ──────
      case 'cta':
        // ⚠️ With NO clan the design has no clan control (SCRUM-91 drew only the 1-
        // and 2+-clan pills) and the fork's Skip can land a user back here. The entry
        // therefore takes the CTA's band: burning needs a clan (doc 15 §6), so
        // offering the burn first would be the wrong primary action — and replacing
        // it *in place* means nothing on the shrine moves.
        return clans.length === 0 ? (
          <Pressable
            accessibilityRole="button"
            testID="home-clan-entry"
            onPress={() => router.push('/clan')}
            style={({ pressed }) => [
              styles.abs,
              bandRect(HOME_BANDS.cta, s),
              styles.cta,
              styles.clanEntry,
              { borderRadius: radius.pill * s },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.ctaLabel, { fontSize: fontSize.bodyLg.at390 * s }]}>
              {t('home.clanEntry')}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            testID="home-begin"
            onPress={startOffering}
            style={({ pressed }) => [
              styles.abs,
              bandRect(HOME_BANDS.cta, s),
              styles.cta,
              { borderRadius: radius.pill * s },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.ctaLabel, { fontSize: fontSize.bodyLg.at390 * s }]}>
              {t('home.begin')}
            </Text>
          </Pressable>
        );

      // ── footer · the tab bar (SCRUM-164) ──────────────────────────────────
      case 'footer':
        return (
          <View
            style={[styles.abs, bandRect(HOME_BANDS.tabbar, s), styles.reserved]}
            testID="home-tabbar-band"
          />
        );
    }
  };

  return <ShrineCanvas>{HOME_REGION_ORDER.map((name) => region(name))}</ShrineCanvas>;
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  /** A band whose ticket has not landed — correctly positioned, visibly not built. */
  reserved: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: surface.paperEdge,
    borderRadius: radius.md,
  },
  cta: {
    backgroundColor: brand.cinnabar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: { color: onColorCream, fontWeight: '600' },
  clanEntry: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  /** `btn · settings` — paperDeep fill, ink stroke; radius + width are scaled inline. */
  settingsBtn: {
    backgroundColor: surface.paperDeep,
    borderColor: brand.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
});
