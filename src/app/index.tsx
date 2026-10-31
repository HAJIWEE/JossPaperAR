import { Fragment, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { ClanPill } from '@/components/clan-pill';
import { AltarHalo } from '@/components/home/altar-halo';
import { AppMark, SettingsGear } from '@/components/home/header-art';
import { Offerings } from '@/components/home/offerings';
import { StreakPanel, TributePanel } from '@/components/home/panels';
import { ShrineBase } from '@/components/home/shrine-base';
import { ShrineCanvas } from '@/components/home/shrine-canvas';
import { TabBar } from '@/components/home/tab-bar';
import { Tablet } from '@/components/home/tablet';
import { altarView, pageStep } from '@/lib/altar';
import { clanAncestors, myClans, type Ancestor } from '@/lib/clan-api';
import { PILL_X_ON_REFERENCE, type PillClan } from '@/lib/clan-pill';
import { readFirstRun } from '@/lib/first-run';
import { fetchHomeSummary } from '@/lib/home-api';
import { homePanels, type SummaryResult } from '@/lib/home-panels';
import {
  HOME_BANDS,
  HOME_REGION_ORDER,
  bandRect,
  homeFitScale,
  type HomeRegion,
} from '@/lib/home-layout';
import { t } from '@/lib/i18n';
import { DEMO_PARAM, DEMO_VALUE, needsTutorial } from '@/lib/tutorial';
import { brand, fontSize, onColorCream, radius, surface, text } from '@/theme/tokens';

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
  /**
   * ⚠️ `null` = not asked yet. A failure is kept as a failure, **never** folded into a
   * zero — see `homePanels` (SCRUM-161).
   */
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  /** ⚠️ The live tablets of the active clan — names, so they never leave this screen. */
  const [ancestors, setAncestors] = useState<readonly Ancestor[]>([]);
  /** Which tablet the carousel shows. `altarView` clamps it, so a removal cannot strand it. */
  const [page, setPage] = useState(0);
  /** ⚠️ The ONLY place the panel state is decided — `ready` · `loading` · `failed`. */
  const panels = homePanels(summary);

  // The pill must reflect a clan created or joined *after* Home first mounted, so
  // this re-reads on every focus (the `clan/index.tsx` pattern).
  // ⚠️ A failed read hides the pill rather than showing a stale clan.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const mine = await myClans();
        const list = mine.ok ? mine.data : [];
        if (!cancelled) {
          setClans(list.map((c) => ({ name: c.name, role: c.role })));
        }
        // ⚠️ The tablets belong to the ACTIVE clan — the same `list[0]` the pill shows, so the
        // two can never disagree about which clan the shrine is scoped to.
        const activeClan = list[0];
        const tablets = activeClan
          ? await clanAncestors(activeClan.clanId)
          : { ok: true as const, data: [] as Ancestor[] };
        if (!cancelled) setAncestors(tablets.ok ? tablets.data : []);
        // ⚠️ Re-read alongside the clan list: a burn awards tribute and moves the streak, so
        // the shrine comes back from `/reward` showing stale numbers without this.
        const totals = await fetchHomeSummary();
        if (!cancelled) setSummary(totals);
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
            <View style={[styles.abs, bandRect(HOME_BANDS.tribute, s)]} testID="home-tribute-band">
              <TributePanel state={panels} scale={s} />
            </View>
            <View style={[styles.abs, bandRect(HOME_BANDS.streak, s)]} testID="home-streak-band">
              <StreakPanel state={panels} scale={s} />
            </View>
          </>
        );

      // ── altar · the halo, the offerings, the shrine base and the tablet ───
      case 'altar': {
        const view = altarView(ancestors.length, page);
        // ⚠️ The board draws the ＋ slot and the CENTRE TABLET on the SAME band
        // (131,285 129×307) — see `altar.ts`. They swap in place; nothing below moves.
        const slot = HOME_BANDS.addSlot;
        const current = view.kind === 'tablet' ? ancestors[view.index] : null;
        return (
          <>
            <View style={[styles.abs, bandRect(HOME_BANDS.halo, s)]} testID="home-halo-band">
              <AltarHalo />
            </View>
            <View style={[styles.abs, bandRect(HOME_BANDS.offerings, s)]} testID="home-offerings-band">
              <Offerings />
            </View>
            <View style={[styles.abs, bandRect(HOME_BANDS.shrineBase, s)]} testID="home-shrine-base">
              <ShrineBase />
            </View>
            {/* ⚠️ The ALTAR-STATE CAPTION — on the board it is `Your altar is empty — tap ＋ to add
                a tablet.`, i.e. the EMPTY state's own line. The filled board's caption text is not
                yet read, so nothing renders here when a tablet exists rather than inventing one. */}
            <View
              style={[styles.abs, bandRect(HOME_BANDS.caption, s)]}
              testID="home-caption-band"
            >
              {view.kind === 'empty' ? (
                <Text
                  numberOfLines={1}
                  style={{ color: text.inkSoft, fontSize: 12 * s }}
                >
                  {t('home.altarEmpty')}
                </Text>
              ) : null}
            </View>

            {/* ⚠️ `hint · cta` — the line the board sets above the offer button. */}
            <View style={[styles.abs, bandRect(HOME_BANDS.hintCta, s)]} testID="home-hint-band">
              <Text numberOfLines={1} style={{ color: text.inkSoft, fontSize: 12 * s }}>
                {t('home.ctaHint')}
              </Text>
            </View>

            {/* ⚠️ `zone · customizable temple (label)` — the chip that tells the owner the altar is
                theirs. ⚠️ Only the LABEL is drawn: the chip's own background fill could not be read
                from the plugin yet, and a guessed chip is worse than a bare line. */}
            <View
              style={[styles.abs, bandRect(HOME_BANDS.templeChip, s), styles.chip]}
              testID="home-temple-chip"
            >
              <Text numberOfLines={1} style={{ color: text.gold, fontSize: 10.5 * s }}>
                {t('home.templeChip')}
              </Text>
            </View>

            {/* ⚠️ EMPTY → the ＋ slot is RESERVED, not drawn: its art (`slot · ＋ add a tablet`)
                is un-ported, and the add flow is not built. A tappable ＋ with no destination
                is the SCRUM-145 defect. It becomes real with the sheet, in this same ticket. */}
            {view.kind === 'empty' ? (
              <View
                style={[
                  styles.abs,
                  bandRect(slot, s),
                  styles.reserved,
                  styles.slotCentre,
                  // ⚠️ 40 board px down, NOT centred: the slot band's lower half is where the
                  // burner and its smoke sit, so a centred ＋ reads as a cross floating in the
                  // smoke. Measured on glass 2026-10-31.
                  { paddingTop: 40 * s },
                ]}
                testID="home-add-slot"
              >
                {/* ⚠️ The ＋ ITSELF. Without it the empty altar is a dashed rectangle and the
                    caption's "tap ＋" has nothing to point at — the gap the owner found against
                    the board. ⚠️ It is still NOT a Pressable: the sheet lands in this ticket
                    (`SCRUM-168`), and a control with nowhere to go is the `SCRUM-145` defect. */}
                <Text
                  allowFontScaling={false}
                  style={{ color: text.gold, fontSize: 44 * s, fontWeight: '300' }}
                >
                  ＋
                </Text>
              </View>
            ) : (
              <View style={[styles.abs, bandRect(slot, s)]} testID="home-tablet">
                <Tablet
                  name={current ? `${current.surname}${current.givenName ?? ''}` : ''}
                  width={slot.w * s}
                  height={slot.h * s}
                />
              </View>
            )}

            {/* ⚠️ A carousel, never a "+N more": at the cap of 10 every tablet must be reachable
                (the board draws prev/next at 26,412 and 340,412). The ends are ends — no wrap. */}
            {view.kind === 'tablet' && view.hasPrev ? (
              <Pressable
                accessibilityRole="button"
                testID="home-tablet-prev"
                onPress={() => setPage(pageStep(view.index, view.count, -1))}
                style={[styles.abs, bandRect(HOME_BANDS.carouselPrev, s), styles.carousel]}
              >
                <Text style={[styles.carouselGlyph, { fontSize: 28 * s }]}>{'\u2039'}</Text>
              </Pressable>
            ) : null}
            {view.kind === 'tablet' && view.hasNext ? (
              <Pressable
                accessibilityRole="button"
                testID="home-tablet-next"
                onPress={() => setPage(pageStep(view.index, view.count, 1))}
                style={[styles.abs, bandRect(HOME_BANDS.carouselNext, s), styles.carousel]}
              >
                <Text style={[styles.carouselGlyph, { fontSize: 28 * s }]}>{'\u203A'}</Text>
              </Pressable>
            ) : null}
          </>
        );
      }

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
          <View style={[styles.abs, bandRect(HOME_BANDS.tabbar, s)]} testID="home-tabbar-band">
            {/* ⚠️ Store and Profile are DISABLED inside the bar: their screens are
                SCRUM-150 / SCRUM-151. A dead link or an inert live-looking tab would both be
                worse than a visibly unavailable one. */}
            <TabBar active="shrine" scale={s} />
          </View>
        );
    }
  };

  return (
    <ShrineCanvas>
      {HOME_REGION_ORDER.map((name) => (
        // ⚠️ The Fragment carries the key, not the region: `region()` returns either one
        // element or SEVERAL (title panels, the altar group), so without this the array's
        // items have no key and React warns "Each child in a list should have a unique key".
        <Fragment key={name}>{region(name)}</Fragment>
      ))}
    </ShrineCanvas>
  );
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
  /** The temple chip's own pill — the board's `(chip)` surface, so the line is not bare. */
  chip: {
    borderWidth: 1,
    borderColor: surface.paperEdge,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  /** ⚠️ A child of a band positions itself in the BAND's space — the trap that hid the tabs. */
  slotCentre: { alignItems: 'center', justifyContent: 'flex-start' },
  cta: {
    backgroundColor: brand.cinnabar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: { color: onColorCream, fontWeight: '600' },
  clanEntry: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  carousel: { alignItems: 'center', justifyContent: 'center' },
  carouselGlyph: { color: text.inkSoft, fontWeight: '700' },
  /** `btn · settings` — paperDeep fill, ink stroke; radius + width are scaled inline. */
  settingsBtn: {
    backgroundColor: surface.paperDeep,
    borderColor: brand.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
});
