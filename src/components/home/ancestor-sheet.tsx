/**
 * The tablet sheet — ADD · EDIT · REMOVE (SCRUM-146 · SCRUM-168 · the board port).
 *
 * ── PORTED, NOT REDRAWN ─────────────────────────────────────────────────────
 * `EN · 1s Ancestor sheet` and `EN · 1s2 Ancestor sheet / edit mode`, read through the Penpot
 * plugin on 2026-11-01. Every number below is a board px from those two frames:
 *
 * | layer | board px | note |
 * |---|---|---|
 * | `scrim · sheet (tap = close)` | 0,0 390×844 | `#1A1A1A` @ 0.42 |
 * | `sheet · panel` | 0,400 390×444 | `surface.paper`, **r24** on the top corners |
 * | `sheet · top rule` | 0,400 390×2.5 | `brand.ink` |
 * | `sheet · grab` | 173,412 44×4 | ink @ 0.2, r2 |
 * | `sheet · close (bg)` | 340,412 36×36 | ink stroke 2.5 |
 * | `sheet · title` / `· sub` | 20,436 / 20,468 | 21 · 700 / 12.5 |
 * | `field · input · *` | 20,506 / 20,578 254×46 | `surface.row`, ink stroke 2.5, r14 |
 * | `chip · *` | 20,652 and 20,696 38 tall | `surface.row` + ink 2, **r19**; selected `brand.gold` |
 * | `preview · tablet (96)` | 288,490 96×228.6 | the SAME `Tablet` art, 4× smaller |
 * | `btn · Place on altar` | 20,778 350×52 | `brand.cinnabar`, ink 2.5, r18 |
 *
 * ── ⚠️ IT IS A SHEET OVER THE SHRINE, NOT A SCREEN ──────────────────────────
 * The board draws the whole shrine BEHIND the scrim (the halo, the panels and the tab bar are
 * all present, dimmed), so the sheet is rendered as an overlay **inside the shrine canvas** —
 * not as a route. ⚠️ That is also why the previous `/ancestor` route is gone: a full-screen
 * route cannot show the shrine behind it, and declaring it in `_layout.tsx` to force a
 * transparent presentation is the exact move that once made it the stack's INITIAL route.
 *
 * ── ⚠️ THE PANEL COVERS THE TAB BAR ────────────────────────────────────────
 * The panel runs 400→844 and the tab bar sits at 764 — so the sheet is painted **after** the
 * footer region and deliberately covers it, which is what a modal bottom sheet does. The
 * `+ bleed` on the panel's height is the same treatment the tab bar gets: the board ends at
 * 844 and a taller screen has a strip below it, so the panel is stretched to the real bottom
 * rather than leaving a second colour under it.
 *
 * ── ⚠️ THE PREVIEW IS THE REAL ART, AND IT IS THE POINT ────────────────────
 * `preview · tablet (96)` is `tablet · centre` scaled to 96 wide — the same seven shapes. So
 * the preview renders the SAME `Tablet` component the altar does, at `96 × 228.6`. ⚠️ A
 * hand-drawn preview would be a second implementation of the tablet, and the first thing to
 * drift. The name it paints comes from `tabletName()`, the same rule the altar uses.
 */

import { useEffect, useMemo, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Tablet } from '@/components/home/tablet';
import {
  GIVEN_NAME_MAX,
  RELATIONSHIP_CHIPS,
  RELATIONSHIP_CHIP_ROW_BREAK,
  SURNAME_MAX,
  chipSelected,
  chipValue,
  type AncestorForm,
} from '@/lib/ancestor-sheet';
import { HOME_BANDS } from '@/lib/home-layout';
import { t } from '@/lib/i18n';
import { tabletName } from '@/lib/tablet-name';
import { brand, onColorCream, surface, text } from '@/theme/tokens';

/** ⚠️ The bands live in `home-layout.ts` so `check:lib` can hold them — not as consts here. */
const PANEL = HOME_BANDS.sheetPanel;
const PREVIEW = HOME_BANDS.sheetPreview;

export type SheetMode = 'add' | 'edit';

export function AncestorSheet({
  scale,
  bleed,
  mode,
  initial,
  busy,
  problem,
  blockedReason,
  onSubmit,
  onArchive,
  onClose,
}: {
  /** Board px → device dp. The shrine's one uniform scale. */
  scale: number;
  /** ⚠️ Device dp the panel must stretch past the board's 844 to reach the real bottom. */
  bleed: number;
  mode: SheetMode;
  initial: AncestorForm;
  busy: boolean;
  /** The server's own refusal, or a local validation message. `null` = none. */
  problem: string | null;
  /**
   * ⚠️ Why the form cannot be submitted — the CAP, today. `null` = it can. The board draws
   * only the submittable state, so a blocked sheet keeps its frame (title · sub · close) and
   * shows the reason where the hint goes, rather than inventing a second layout.
   */
  blockedReason: string | null;
  onSubmit: (form: AncestorForm) => void;
  /** `null` in ADD mode — there is nothing to remove. */
  onArchive: (() => void) | null;
  onClose: () => void;
}) {
  const [surname, setSurname] = useState(initial.surname);
  const [givenName, setGivenName] = useState(initial.givenName);
  const [relationship, setRelationship] = useState(initial.relationship);

  /**
   * ⚠️ The keyboard is tracked MANUALLY. The sheet is an absolutely-positioned overlay inside
   * a non-scrolling canvas, so there is no scroll view to do it for us and
   * `KeyboardAvoidingView` has no sibling to inset against. The panel simply rises by the
   * keyboard's height — clamped, so a tall keyboard cannot push the title off the top.
   */
  const [keyboard, setKeyboard] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboard(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const panelTopDp = PANEL.y * scale;
  const lift = Math.min(keyboard, panelTopDp);

  /**
   * The chips, in the board's two rows — `—` · Grandfather · Grandmother, then Father · Mother.
   *
   * ⚠️ **Rows, not one wrapping container.** `preview · tablet (96)` starts at x 288, so a single
   * wrapping row pushes `Father` under the tablet — which is exactly what the first build did on
   * glass (2026-11-01). The split is `RELATIONSHIP_CHIP_ROW_BREAK`, from the board.
   */
  const chipRows = useMemo(() => {
    const resolved = RELATIONSHIP_CHIPS.map((key) => ({ key, label: t(key) }));
    return [resolved.slice(0, RELATIONSHIP_CHIP_ROW_BREAK), resolved.slice(RELATIONSHIP_CHIP_ROW_BREAK)];
  }, []);

  /**
   * ⚠️ What the preview PAINTS. Empty input shows the board's own `姓` placeholder rather than
   * a blank plaque — the preview's job is to show the rule working, and a blank tablet shows
   * nothing. The name itself is `tabletName()`, i.e. the SAME glyphs the altar will carry.
   */
  const painted = tabletName(surname, givenName);
  const previewName = painted.length === 0 ? t('ancestor.previewPlaceholder') : painted;

  const close = () => {
    Keyboard.dismiss();
    onClose();
  };

  return (
    <View style={StyleSheet.absoluteFill} testID="ancestor-sheet">
      {/* ── the scrim · tap = close ──────────────────────────────────────── */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
        testID="ancestor-scrim"
        onPress={close}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: (PANEL.y + PANEL.h) * scale + bleed,
          backgroundColor: 'rgba(26,26,26,0.42)',
        }}
      />

      {/* ── the panel ────────────────────────────────────────────────────── */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: PANEL.h * scale + bleed,
          backgroundColor: surface.paper,
          borderTopLeftRadius: 24 * scale,
          borderTopRightRadius: 24 * scale,
          // ⚠️ transform, not `bottom`: the panel must move by the KEYBOARD's height in device
          // dp, while every child is positioned in board px × scale.
          transform: [{ translateY: -lift }],
        }}
      >
        {/* `sheet · top rule` */}
        <View style={{ height: 2.5 * scale, backgroundColor: brand.ink }} />

        {/* `sheet · grab` */}
        <View
          style={{
            position: 'absolute',
            left: 173 * scale,
            top: 12 * scale,
            width: 44 * scale,
            height: 4 * scale,
            borderRadius: 2 * scale,
            backgroundColor: 'rgba(26,26,26,0.2)',
          }}
        />

        {/* `sheet · close` — a 36 circle inside a 44 touch target (the board draws both). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          testID="ancestor-close"
          onPress={close}
          style={{
            position: 'absolute',
            left: 336 * scale,
            top: 8 * scale,
            width: 44 * scale,
            height: 44 * scale,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 36 * scale,
              height: 36 * scale,
              borderRadius: 18 * scale,
              borderWidth: 2.5 * scale,
              borderColor: brand.ink,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* ⚠️ The ✕ is DRAWN, not a glyph: `sheet · close (✕ vector)` is a 14×14 path, and a
                font's ✕ varies in weight and can be missing entirely on a stripped device.
                ⚠️ **±45°, not 0/90 — a horizontal bar plus a vertical bar is a PLUS.** Seen on
                glass 2026-11-01: the first build drew a ＋. The bars are the DIAGONALS of the
                14×14 box (14√2 ≈ 19.8 long), so the X spans the board's 14×14. */}
            <View style={{ width: 14 * scale, height: 14 * scale }}>
              <View
                style={[
                  styles.xBar,
                  {
                    left: -2.9 * scale,
                    top: 5.75 * scale,
                    width: 19.8 * scale,
                    height: 2.5 * scale,
                    transform: [{ rotate: '45deg' }],
                  },
                ]}
              />
              <View
                style={[
                  styles.xBar,
                  {
                    left: -2.9 * scale,
                    top: 5.75 * scale,
                    width: 19.8 * scale,
                    height: 2.5 * scale,
                    transform: [{ rotate: '-45deg' }],
                  },
                ]}
              />
            </View>
          </View>
        </Pressable>

        {/* `sheet · title` + `sheet · sub` */}
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          testID="ancestor-title"
          style={[styles.title, { left: 20 * scale, top: 36 * scale, width: 300 * scale, fontSize: 21 * scale }]}
        >
          {mode === 'edit' ? t('ancestor.titleEdit') : t('ancestor.titleAdd')}
        </Text>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.sub, { left: 20 * scale, top: 68 * scale, width: 340 * scale, fontSize: 12.5 * scale }]}
        >
          {t('ancestor.sheetSub')}
        </Text>

        {/* `field · label · surname` + its `＊` */}
        <Text
          allowFontScaling={false}
          style={[styles.label, { left: 20 * scale, top: 90 * scale, fontSize: 11 * scale }]}
        >
          {t('ancestor.surname')}
        </Text>
        <Text
          allowFontScaling={false}
          style={[styles.required, { left: 84 * scale, top: 90 * scale, fontSize: 11 * scale }]}
        >
          {'＊'}
        </Text>

        {/* `field · input · surname` */}
        <TextInput
          testID="ancestor-surname"
          accessibilityLabel={t('ancestor.surname')}
          value={surname}
          onChangeText={setSurname}
          autoCapitalize="words"
          autoCorrect={false}
          allowFontScaling={false}
          maxLength={SURNAME_MAX}
          style={[styles.input, inputBox(20, 106, scale)]}
        />

        {/* `field · label · given` */}
        <Text
          allowFontScaling={false}
          style={[styles.label, { left: 20 * scale, top: 162 * scale, fontSize: 11 * scale }]}
        >
          {t('ancestor.labelGivenOptional')}
        </Text>

        {/* `field · input · given` */}
        <TextInput
          testID="ancestor-given"
          accessibilityLabel={t('ancestor.givenName')}
          value={givenName}
          onChangeText={setGivenName}
          autoCapitalize="words"
          autoCorrect={false}
          allowFontScaling={false}
          maxLength={GIVEN_NAME_MAX}
          style={[styles.input, inputBox(20, 178, scale)]}
        />

        {/* `field · label · relationship` */}
        <Text
          allowFontScaling={false}
          style={[styles.label, { left: 20 * scale, top: 234 * scale, fontSize: 11 * scale }]}
        >
          {t('ancestor.relationship')}
        </Text>



        {/* ⚠️ TWO ROWS, per the board — see `chipRows`. Height 38 · r19 · gap 6 are the board's;
            the chip WIDTH is content-driven, because the board's widths are fitted to the EN
            sample (`Grandfather` is 96 board px) and 中文's 祖父 is 58. `check:lib` holds the
            height, the radius and the row split. */}
        <View style={{ position: 'absolute', left: 20 * scale, top: 252 * scale, gap: 6 * scale }}>
          {chipRows.map((row, rowIndex) => (
            <View key={rowIndex} style={{ flexDirection: 'row', gap: 6 * scale }}>
              {row.map(({ key, label }) => {
                const selected = chipSelected(key, label, relationship);
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    testID={`ancestor-chip-${key.split('.').pop()}`}
                    onPress={() => setRelationship(chipValue(key, label) ?? '')}
                    style={{
                      height: 38 * scale,
                      minWidth: 36 * scale,
                      borderRadius: 19 * scale,
                      paddingHorizontal: 10 * scale,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: selected ? brand.gold : surface.row,
                      borderWidth: 2 * scale,
                      borderColor: selected ? brand.goldDeep : brand.ink,
                    }}
                  >
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      style={{
                        color: text.ink,
                        fontSize: 13 * scale,
                        // ⚠️ The board inks the SELECTED chip's label 700 and the rest 400.
                        fontWeight: selected ? '700' : '400',
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* `preview · tablet (96)` — the real art, at the board's 96×228.6. */}
        <View
          style={{
            position: 'absolute',
            left: PREVIEW.x * scale,
            top: (PREVIEW.y - PANEL.y) * scale,
            width: PREVIEW.w * scale,
            height: PREVIEW.h * scale,
          }}
          testID="ancestor-preview"
        >
          <Tablet name={previewName} width={PREVIEW.w * scale} height={PREVIEW.h * scale} />
        </View>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={{
            position: 'absolute',
            left: PREVIEW.x * scale,
            top: 326 * scale,
            width: PREVIEW.w * scale,
            textAlign: 'center',
            color: text.inkSoft,
            fontSize: 10 * scale,
          }}
        >
          {t('ancestor.previewCaption')}
        </Text>

        {/* `sheet · hint` — or the reason the form is blocked. */}
        <Text
          allowFontScaling={false}
          style={[styles.hint, { left: 20 * scale, top: 342 * scale, width: 320 * scale, fontSize: 11.5 * scale }]}
        >
          {blockedReason ?? t('ancestor.sheetHint')}
        </Text>

        {/* The server's own refusal, or the local validation message. */}
        {problem ? (
          <Text
            allowFontScaling={false}
            numberOfLines={2}
            testID="ancestor-problem"
            style={[
              styles.problem,
              { left: 20 * scale, top: 340 * scale, width: 320 * scale, fontSize: 11.5 * scale },
            ]}
          >
            {problem}
          </Text>
        ) : null}


        {/* `btn · Place on altar` — full width in ADD, half in EDIT beside `btn · Remove`. */}
        {blockedReason === null ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('ancestor.placeOnAltar')}
              accessibilityState={{ disabled: busy }}
              testID="ancestor-save"
              disabled={busy}
              onPress={() => {
                Keyboard.dismiss();
                onSubmit({ surname, givenName, relationship });
              }}
              style={({ pressed }) => [
                styles.primary,
                {
                  left: 20 * scale,
                  top: 378 * scale,
                  width: (onArchive ? 170 : 350) * scale,
                  height: 52 * scale,
                  borderRadius: 18 * scale,
                },
                busy && styles.busy,
                pressed && styles.pressed,
              ]}
            >
              <Text allowFontScaling={false} style={[styles.primaryLabel, { fontSize: 16 * scale }]}>
                {t('ancestor.placeOnAltar')}
              </Text>
            </Pressable>

            {onArchive ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('ancestor.remove')}
                accessibilityState={{ disabled: busy }}
                testID="ancestor-remove"
                disabled={busy}
                onPress={() => {
                  Keyboard.dismiss();
                  onArchive();
                }}
                style={({ pressed }) => [
                  styles.remove,
                  {
                    left: 200 * scale,
                    top: 378 * scale,
                    width: 170 * scale,
                    height: 52 * scale,
                    borderRadius: 18 * scale,
                  },
                  busy && styles.busy,
                  pressed && styles.pressed,
                ]}
              >
                <Text allowFontScaling={false} style={[styles.removeLabel, { fontSize: 16 * scale }]}>
                  {t('ancestor.remove')}
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

/** `field · input · *` — 254×46, `surface.row`, ink 2.5, r14, value 21 · 600. */
function inputBox(left: number, top: number, scale: number) {
  return {
    left: left * scale,
    top: top * scale,
    width: 254 * scale,
    height: 46 * scale,
    borderRadius: 14 * scale,
    borderWidth: 2.5 * scale,
    paddingHorizontal: 10 * scale,
    fontSize: 21 * scale,
  } as const;
}

const styles = StyleSheet.create({
  xBar: { position: 'absolute', left: 0, backgroundColor: brand.ink },
  title: { position: 'absolute', color: text.ink, fontWeight: '700' },
  sub: { position: 'absolute', color: text.inkSoft },
  label: { position: 'absolute', color: text.inkSoft, letterSpacing: 0.6 },
  required: { position: 'absolute', color: brand.cinnabar, fontWeight: '700' },
  input: {
    position: 'absolute',
    backgroundColor: surface.row,
    borderColor: brand.ink,
    color: text.ink,
    fontWeight: '600',
    /** Noto Serif SC on the board; RN falls back to the system serif (the pill's own choice). */
    fontFamily: 'serif',
  },
  hint: { position: 'absolute', color: text.inkSoft },
  problem: { position: 'absolute', color: brand.cinnabar, fontWeight: '700' },
  primary: {
    position: 'absolute',
    backgroundColor: brand.cinnabar,
    borderWidth: 2.5,
    borderColor: brand.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { color: onColorCream, fontWeight: '700' },
  remove: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderWidth: 2.5,
    borderColor: brand.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeLabel: { color: text.ink, fontWeight: '700' },
  busy: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
});

