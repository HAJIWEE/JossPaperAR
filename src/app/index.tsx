import { Fragment, useCallback, useState } from 'react';
import { Alert, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { ClanPill } from '@/components/clan-pill';
import { AncestorSheet, type SheetMode } from '@/components/home/ancestor-sheet';
import { AltarHalo } from '@/components/home/altar-halo';
import { DecorBack, DecorFront, DecorSlots } from '@/components/home/decor-layer';
import { DecorSheet } from '@/components/home/decor-sheet';
import { AppMark, SettingsGear } from '@/components/home/header-art';
import { Offerings } from '@/components/home/offerings';
import { StreakPanel, TributePanel } from '@/components/home/panels';
import { ShrineBase } from '@/components/home/shrine-base';
import { ShrineCanvas } from '@/components/home/shrine-canvas';
import { TabBarBand } from '@/components/home/tab-bar-band';
import { Tablet } from '@/components/home/tablet';
import { altarCaption, altarView, pageStep } from '@/lib/altar';
import {
  ANCESTOR_CAP,
  GIVEN_NAME_MAX,
  RELATIONSHIP_MAX,
  SURNAME_MAX,
  canEditTablets,
  capReached,
  normaliseAncestorForm,
  sheetProblem,
  type AncestorForm,
  type SheetProblem,
} from '@/lib/ancestor-sheet';
import {
  archiveAncestor,
  clanAncestors,
  myClans,
  saveAncestor,
  type Ancestor,
} from '@/lib/clan-api';
import { PILL_X_ON_REFERENCE, type PillClan } from '@/lib/clan-pill';
import { chipBandClear, drawPlan } from '@/lib/decorate';
import { equipDecoration, readMyDecorations, type MyDecorations } from '@/lib/decorations';
import type { DecorationCode, DecorationSlot } from '@/domain/catalogue';
import { readFirstRun } from '@/lib/first-run';
import { fetchHomeSummary } from '@/lib/home-api';
import { homePanels, type SummaryResult } from '@/lib/home-panels';
import { tabletName } from '@/lib/tablet-name';
import {
  HOME_BANDS,
  HOME_REGION_ORDER,
  bandRect,
  homeFitScale,
  shrineBleedDp,
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
  /**
   * ⚠️ `Dimensions.get('screen')`, NOT `useWindowDimensions()`. Measured on glass: the window is
   * **345 × 745** inside a 360 × 800 screen, and containing the board in that inset window
   * letterboxes it on all four sides — the "white space at the sides, top and bottom".
   */
  const screen = Dimensions.get('screen');
  /** Board px → device dp, contain-fit on BOTH axes. The ONE conversion on this screen. */
  const s = homeFitScale(screen.width, screen.height);
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
  /**
   * ⚠️ The ACTIVE clan's id and the caller's role, kept because the sheet needs both: the id to
   * save against, the role to decide whether to OFFER saving at all. `clans[0]` is the same row
   * the pill shows, so the shrine and the sheet can never disagree about which clan is open.
   */
  const [activeClanId, setActiveClanId] = useState<string | null>(null);
  /** ⚠️ The ONLY place the panel state is decided — `ready` · `loading` · `failed`. */
  const panels = homePanels(summary);

  /**
   * ⚠️ Whether to **OFFER** editing — not whether it is allowed. `save_ancestor` refuses a plain
   * member with `42501` and `ancestors_update_elder` filters the write at the table; this only
   * stops the shrine putting a button in front of someone who would be refused.
   */
  const mayEdit = canEditTablets(clans[0]?.role);

  /**
   * ── THE TABLET SHEET LIVES ON THIS SCREEN, NOT ON A ROUTE ──────────────────
   * ⚠️ `EN · 1s Ancestor sheet` draws the whole SHRINE behind the scrim — the halo, the panels
   * and the tab bar are all there, dimmed. A pushed route cannot do that: it covers the shrine,
   * and forcing `presentation: 'transparentModal'` from `_layout.tsx` is the exact declaration
   * that once made the sheet the stack's INITIAL route on glass. So the sheet is state here.
   */
  const [sheet, setSheet] = useState<{
    readonly mode: SheetMode;
    /** `null` in ADD. */
    readonly ancestorId: string | null;
    readonly initial: AncestorForm;
  } | null>(null);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [sheetIssue, setSheetIssue] = useState<string | null>(null);

  /**
   * ── THE ALTAR'S DECORATIONS (SCRUM-156 · SCRUM-205) ────────────────────────
   * ⚠️ `null` = not read yet, and NOTHING is drawn for it — an unattended altar, not an error. A failed read
   * also leaves it `null`; the picker reports the failure when it is opened, rather than the shrine claiming
   * the user owns nothing (which is a different, and false, statement).
   */
  const [decor, setDecor] = useState<MyDecorations | null>(null);
  /** Whether the six dashed zones are showing — `EN · 1f`. */
  const [customize, setCustomize] = useState(false);
  /** Which slot's picker is open, or `null`. One sheet, not one per slot. */
  const [decorSlot, setDecorSlot] = useState<DecorationSlot | null>(null);
  const [equipBusy, setEquipBusy] = useState(false);
  const [decorIssue, setDecorIssue] = useState<string | null>(null);

  /** Turn a `SheetProblem` into the copy the user reads. ⚠️ `null` = there is no problem. */
  const problemText = useCallback((p: SheetProblem): string | null => {
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
  }, []);

  /**
   * Open the tablet sheet. `ancestorId = null` → ADD.
   *
   * ⚠️ The form's initial values come from the ROW, not from the route: the row is already in
   * `ancestors` (read for the altar), so an edit needs no second fetch and no name in a URL.
   */
  const openSheet = (ancestorId: string | null) => {
    if (!activeClanId || !mayEdit) return;
    const row = ancestorId === null ? null : (ancestors.find((a) => a.id === ancestorId) ?? null);
    setSheetIssue(null);
    setSheet({
      mode: row ? 'edit' : 'add',
      ancestorId: row ? row.id : null,
      initial: {
        surname: row?.surname ?? '',
        givenName: row?.givenName ?? '',
        relationship: row?.relationship ?? '',
      },
    });
  };

  const closeSheet = useCallback(() => {
    setSheet(null);
    setSheetIssue(null);
  }, []);

  /** Re-read the altar. ⚠️ The screen re-reads; it never patches its own state optimistically. */
  const refreshTablets = useCallback(async (clanId: string) => {
    const tablets = await clanAncestors(clanId);
    setAncestors(tablets.ok ? tablets.data : []);
  }, []);

  /**
   * ⚠️ A local problem is caught BEFORE the round-trip, but the server still decides: a
   * `42501` (a member) or the cap arrives as `result.reason` and is shown as-is. The two are
   * different facts and the user can act on both — "something went wrong" would hide which.
   */
  const submitSheet = useCallback(
    (form: AncestorForm) => {
      if (!activeClanId) return;
      const local = sheetProblem(form);
      if (local) {
        setSheetIssue(problemText(local));
        return;
      }
      void (async () => {
        setSheetBusy(true);
        setSheetIssue(null);
        const clean = normaliseAncestorForm(form);
        const result = await saveAncestor({
          clanId: activeClanId,
          surname: clean.surname,
          givenName: clean.givenName,
          relationship: clean.relationship,
          ancestorId: sheet?.ancestorId ?? null,
        });
        setSheetBusy(false);
        if (!result.ok) {
          setSheetIssue(result.reason);
          return;
        }
        await refreshTablets(activeClanId);
        closeSheet();
      })();
    },
    [activeClanId, sheet?.ancestorId, problemText, refreshTablets, closeSheet],
  );

  /**
   * ⚠️ Archive is the only removal path — a hard delete would orphan the ledger row a burn
   * points at — and it cannot be undone from the app, so it asks first.
   */
  const archiveSheet = useCallback(() => {
    const ancestorId = sheet?.ancestorId ?? null;
    if (!activeClanId || !ancestorId) return;
    Alert.alert(t('ancestor.remove'), t('ancestor.archiveConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('ancestor.remove'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setSheetBusy(true);
            setSheetIssue(null);
            const result = await archiveAncestor(activeClanId, ancestorId);
            setSheetBusy(false);
            if (!result.ok) {
              setSheetIssue(result.reason);
              return;
            }
            await refreshTablets(activeClanId);
            closeSheet();
          })();
        },
      },
    ]);
  }, [activeClanId, sheet?.ancestorId, refreshTablets, closeSheet]);


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
        if (!cancelled) setActiveClanId(activeClan ? activeClan.clanId : null);
        const tablets = activeClan
          ? await clanAncestors(activeClan.clanId)
          : { ok: true as const, data: [] as Ancestor[] };
        if (!cancelled) setAncestors(tablets.ok ? tablets.data : []);
        // ⚠️ Re-read alongside the clan list: a burn awards tribute and moves the streak, so
        // the shrine comes back from `/reward` showing stale numbers without this.
        const totals = await fetchHomeSummary();
        if (!cancelled) setSummary(totals);
        /**
         * ⚠️ The decorations too — the store SELLS them and this screen PAINTS them, so a purchase made in
         * another tab has to appear on return. Same reason as the tribute panel, same re-read-on-focus rule.
         */
        const myDecor = await readMyDecorations();
        if (!cancelled) setDecor(myDecor.ok ? myDecor.data : null);
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

  /**
   * Equip a decoration into the slot whose picker is open.
   *
   * ⚠️ **The server decides, and the screen then RE-READS** — it never patches its own state optimistically.
   * `equip_decoration` checks ownership, the slot/category match and the one-set-per-category rule (S14k); a
   * `42501`/`P0001` arrives as `result.reason` and is shown as-is, because "not owned" and "wrong slot" are
   * different facts and the user can act on both.
   * ⚠️ The picker closes only on SUCCESS, so a refusal leaves the choice in front of them to change.
   */
  const pickSlot = useCallback((next: DecorationSlot) => {
    setDecorIssue(null);
    // ⚠️ The tablet sheet and the picker never share the screen — one scrim, one panel.
    setSheet(null);
    setDecorSlot(next);
  }, []);

  const equip = useCallback(
    (code: DecorationCode) => {
      const slot = decorSlot;
      if (slot === null) return;
      void (async () => {
        setEquipBusy(true);
        setDecorIssue(null);
        const result = await equipDecoration(slot, code);
        if (!result.ok) {
          setEquipBusy(false);
          setDecorIssue(result.reason);
          return;
        }
        const mine = await readMyDecorations();
        setEquipBusy(false);
        if (!mine.ok) {
          setDecorIssue(mine.reason);
          return;
        }
        setDecor(mine.data);
        setDecorSlot(null);
      })();
    },
    [decorSlot],
  );

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
              ⚠️ NOW A REAL CONTROL. It was **decorative** from SCRUM-160 until now, on purpose:
              the settings screen arrives with SCRUM-151, and *"a control that renders and does
              nothing is the SCRUM-145 defect"*. ⚠️ SCRUM-151's screen now exists, so the gear
              navigates to it — and the surface was never the problem: `btn · settings` is a
              `#EAE2D2` fill with a **2.5 px ink stroke and r14**, exactly the clan pill's
              treatment (`PILL_SPEC.radius` 14 · `borderWidth` 2.5).
              ⚠️ RN draws the stroke INSIDE the box, so at scale 1 the 2.5 is the right number
              here — no `CONTENT_PAD_H` correction, because this surface holds no text to inset.
            */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('settings.title')}
              testID="home-settings-slot"
              onPress={() => router.push('/settings')}
              style={({ pressed }) => [
                styles.abs,
                bandRect(HOME_BANDS.settings, s),
                styles.settingsBtn,
                { borderRadius: 14 * s, borderWidth: 2.5 * s },
                pressed && styles.pressed,
              ]}
            >
              <View style={{ width: 20 * s, height: 20 * s }}>
                <SettingsGear />
              </View>
            </Pressable>
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
        /**
         * ⚠️⚠️ **`SCRUM-225` IS ANSWERED** (owner, 2026-11-09): *"If that position is empty then show the Chip, else
         * clicking on the decoration enters the customizing workflow too."*
         *
         * ⚠️ The chip's band (`28,214 224×22`) sits INSIDE the top decoration band — the lantern draws 37,210 52×66 and
         * the couplets' 横批 125,213 141×40 — so the two cannot both own that space. The rule is therefore:
         *   · nothing drawn through the band → the CHIP is the way in;
         *   · something drawn there → it is hidden and **that piece** is the way in.
         * ⚠️ While CUSTOMISING the chip is always shown, because it is also the way OUT and the decorations sit under
         * the zones there (a hidden chip would strand the user in the mode).
         */
        const plan = decor === null ? [] : drawPlan(decor.equipped);
        const showChip = customize || chipBandClear(plan, HOME_BANDS.templeChip);
        const enterCustomize = () => setCustomize(true);
        // ⚠️ The board draws the ＋ slot and the CENTRE TABLET on the SAME band
        // (131,285 129×307) — see `altar.ts`. They swap in place; nothing below moves.
        const slot = HOME_BANDS.addSlot;
        const current = view.kind === 'tablet' ? ancestors[view.index] : null;
        /** ⚠️ The caption is the altar's OWN state, so it is chosen from the count — see `altar.ts`. */
        const caption = altarCaption(ancestors.length);
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
            {/* ⚠️ BEFORE the tablet: `EN · 1e` paints `decor · 鍾馗像 (background)` behind it. */}
            {decor === null ? null : (
              <DecorBack scale={s} equipped={decor.equipped} band={HOME_BANDS.templeChip} onEnter={enterCustomize} />
            )}
            {/* ⚠️ The ALTAR-STATE CAPTION — `caption · altar state`. `altarCaption()` chooses the
                EMPTY line, the board's FILLED line, or the singular; ⚠️ the screen used to render
                the empty line unconditionally, so a shrine holding three tablets still read
                *"Your altar is empty"* — exactly the difference the owner saw against the board. */}
            <View
              style={[styles.abs, bandRect(HOME_BANDS.caption, s)]}
              testID="home-caption-band"
            >
              <Text
                numberOfLines={1}
                testID="home-caption"
                style={{ color: text.inkSoft, fontSize: 12 * s }}
              >
                {t(caption.key, caption.options)}
              </Text>
            </View>

            {/* ⚠️ `hint · cta` — the line the board sets above the offer button. */}
            <View style={[styles.abs, bandRect(HOME_BANDS.hintCta, s)]} testID="home-hint-band">
              <Text numberOfLines={1} style={{ color: text.inkSoft, fontSize: 12 * s }}>
                {t('home.ctaHint')}
              </Text>
            </View>

            {/* ⚠️ `zone · customizable temple (label)` — the chip that tells the owner the altar is
                theirs. ⚠️ Only the LABEL is drawn: the chip's own background fill could not be read
                from the plugin yet, and a guessed chip is worse than a bare line. ⚠️ It is an entry AND the
                way back out of customising, so it is rendered LAST in this region (after the zones) to stay on
                top and tappable — see the block at the foot of `altar`. */}

            {/* ⚠️ EMPTY → the ＋ slot. The `＋` is the add affordance the board draws
                (`slot · ＋ add a tablet`), and since the sheet now lives on THIS screen it has a
                destination — so it is a real control, not the reserved band it used to be. */}
            {view.kind === 'empty' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('ancestor.titleAdd')}
                accessibilityState={{ disabled: !mayEdit }}
                disabled={!mayEdit}
                onPress={() => openSheet(null)}
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
                <Text
                  allowFontScaling={false}
                  style={{ color: text.gold, fontSize: 44 * s, fontWeight: '300' }}
                >
                  ＋
                </Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('ancestor.titleEdit')}
                accessibilityState={{ disabled: !mayEdit }}
                disabled={!mayEdit}
                onPress={() => openSheet(current ? current.id : null)}
                style={[styles.abs, bandRect(slot, s)]}
                testID="home-tablet"
              >
                {/* ⚠️ `tabletName()`, NOT `surname + givenName`. The board paints 陈氏 for a
                    tablet with no given name, and the sheet's preview uses the SAME function —
                    two call sites building the string is how a preview and its result drift. */}
                <Tablet
                  name={current ? tabletName(current.surname, current.givenName) : ''}
                  width={slot.w * s}
                  height={slot.h * s}
                />
              </Pressable>
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

            {/* ⚠️ AFTER the art: `1d` draws the lanterns and couplets in FRONT of the table. */}
            {decor === null ? null : (
              <DecorFront scale={s} equipped={decor.equipped} band={HOME_BANDS.templeChip} onEnter={enterCustomize} />
            )}
            {/* ⚠️ `1f` — the six dashed zones, only while customising. */}
            {customize ? (
              <DecorSlots
                scale={s}
                ownedCount={decor === null ? 0 : decor.owned.length}
                onPick={pickSlot}
              />
            ) : null}

            {/* ⚠️⚠️ **THE ENTRY TO CUSTOMISING — AND WHO WEARS IT IS `SCRUM-225`'s ANSWER** (owner, 2026-11-09):
                *"If that position is empty then show the Chip, else clicking on the decoration enters the customizing
                workflow too."* ⚠️ So the chip renders ONLY when nothing is drawn through its band (`chipBandClear`),
                and while customising (it is also the way out). Its band (`28,214 224×22`) sits inside the top
                decoration band — that collision is the whole reason the decision existed.

                ⚠️⚠️ **RENDERED LAST, AND THAT IS ON GLASS.** Painting it before the zones put its text UNDERNEATH the
                dashed border (measured 2026-11-09), and it must stay TAPPABLE. So it paints on top, with a solid
                `paperDeep` fill while the zones are up so the label is legible over them. */}
            {showChip ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('home.templeChip')}
              accessibilityState={{ selected: customize }}
              onPress={() => setCustomize((on) => !on)}
              style={({ pressed }) => [
                styles.abs,
                bandRect(HOME_BANDS.templeChip, s),
                styles.chip,
                customize && { backgroundColor: surface.paperDeep },
                pressed && styles.pressed,
              ]}
              testID="home-temple-chip"
            >
              <Text numberOfLines={1} style={{ color: text.gold, fontSize: 10.5 * s }}>
                {t('home.templeChip')}
              </Text>
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
        // ⚠️ ONE COMPONENT, TWO PLACEMENTS. The band itself — its height, the bleed that stretches
        // its `paperDeep` over the strip BELOW the board so the bar reaches the physical bottom edge,
        // and the bar — is `TabBarBand`. The shrine only supplies the position (`bandRect`).
        // ⚠️ That strip is the one place the shrine showed a SECOND colour (paper under a paperDeep
        // bar) — the most obvious gap on glass.
        // ⚠️ The height used to be recomputed HERE from the same two helpers, which is how the
        // shrine's band and League's could have drifted apart.
        return (
          <TabBarBand
            style={[styles.abs, bandRect(HOME_BANDS.tabbar, s)]}
            testID="home-tabbar-band"
          />
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

      {/*
        ⚠️ THE SHEET IS PAINTED LAST, ON PURPOSE — after `footer`, so it covers the tab bar, which
        is what `EN · 1s Ancestor sheet` draws (the panel runs 400→844 and the bar sits at 764).
        ⚠️ It is a child of the CANVAS, not of the app root: the board draws the shrine behind the
        scrim, and the canvas is where the shrine's coordinates live.
        ⚠️ `key` is the ancestor id, so opening EDIT for a different tablet remounts the form
        rather than leaving the previous person's name in the fields.
      */}
      {sheet ? (
        <AncestorSheet
          key={sheet.ancestorId ?? 'add'}
          scale={s}
          bleed={shrineBleedDp(screen.height, s)}
          mode={sheet.mode}
          initial={sheet.initial}
          busy={sheetBusy}
          problem={sheetIssue}
          blockedReason={
            sheet.mode === 'add' && capReached(ancestors.length)
              ? t('ancestor.capReached', { cap: String(ANCESTOR_CAP) })
              : null
          }
          onSubmit={submitSheet}
          onArchive={sheet.mode === 'edit' ? archiveSheet : null}
          onClose={closeSheet}
        />
      ) : null}

      {/**
       * ⚠️ THE DECORATION PICKER — painted after the tablet sheet, for the same reason: it covers the tab bar,
       * as `1f2`/`1f3`/`1f4` draw it (the panel runs to the board's bottom edge, 844, and the bar sits at 764).
       */}
      {decorSlot === null ? null : (
        <DecorSheet
          scale={s}
          bleed={shrineBleedDp(screen.height, s)}
          slot={decorSlot}
          owned={decor === null ? [] : decor.owned}
          equipped={decor === null ? null : decor.equipped[decorSlot]}
          busy={equipBusy}
          problem={decorIssue}
          onEquip={equip}
          onClose={() => {
            setDecorSlot(null);
            setDecorIssue(null);
          }}
        />
      )}
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
