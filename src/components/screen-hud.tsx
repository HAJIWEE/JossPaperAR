/**
 * screen-hud.tsx — the back button + screen title, shared by Profile · Settings · History (SCRUM-151).
 *
 * ── ⚠️ WHY THIS IS A COMPONENT AND NOT THREE COPIES ─────────────────────────
 * It was three copies, and all three shipped the SAME defect: the board's 42 dp circle sits at x18
 * with a 2.5 stroke, so its ring ends at exactly x60 — where `hud · screen title` begins. **On glass
 * the ring reads as touching the `S`**, and the heavy circle out-weighs the 17 dp title beside it.
 * Seen on `HN615L005386`, 2026-11-01.
 *
 * ⚠️ **One implementation, so the fix cannot land in two of three places** — which is exactly what
 * the copies did wrong.
 *
 * ── ⚠️⚠️ IT MUST BE RENDERED **AFTER** THE SCROLL VIEW ──────────────────────
 * **This is the defect it was extracted to fix, and it is not obvious.** The screen's `ScrollView`
 * fills the viewport and is painted LAST, so a HUD declared BEFORE it **draws** — you see it, because
 * the scroll view's background is transparent — and **never receives a tap**. ⚠️ On glass the back
 * button looked perfect and did nothing at all: the tap went to the scroll view. Measured
 * `HN615L005386`, 2026-11-01.
 *
 * ⚠️ So: `<ScrollView>…</ScrollView>` first, `<ScreenHud />` second, in the same parent. `zIndex` and
 * `elevation` are set as a SECOND line of defence, but ordering is the one that is guaranteed —
 * `check:lib` §26 asserts the order in every screen that uses this.
 *
 * ── ⚠️ THE FIX, AND WHY IT IS A DEVIATION ───────────────────────────────────
 * The visible circle is **34, not the board's 42**, with a **2** stroke, and the title moved
 * **60 → 66** so there is a real gap. ⚠️ That is a deliberate departure from `EN · 8`, `8b` and `8c`,
 * and it is recorded as a board follow-up rather than copied — a port that reproduces an unreadable
 * header is not more faithful, it is just wrong in the same way.
 *
 * ⚠️ **The TOUCH target stays 44.** The circle shrinks; what the finger hits does not — the same
 * resolution `SCRUM-123`'s confirm card made for its 20 dp cancel label, and the project's floor for
 * the 40–50s audience (N11).
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { t } from '@/lib/i18n';
import { HUD, HUD_BAND_HEIGHT, HUD_TONES, type HudTone } from '@/lib/profile';
import { fontSize, surface, text } from '@/theme/tokens';

export function ScreenHud({
  titleKey,
  tone = 'light',
  backTestID,
  titleTestID,
  band = false,
}: {
  /** ⚠️ OPTIONAL — `EN · 2 Capture` and `EN · 4 Burn` draw the circle with **no** title. */
  titleKey?: string;
  /** ⚠️ `light` on paper, `dark` on the camera — see `HUD_TONES`. They are not interchangeable. */
  tone?: HudTone;
  backTestID: string;
  titleTestID?: string;
  /**
   * ⚠️⚠️ **DRAW THE HUD'S OPAQUE GROUND — pass this on every screen whose own background is `surface.paper`.**
   *
   * Owner on glass, 2026-11-09: *"when i scroll up the Title bar is not opaque so the Store title overlaps
   * with the content."* ⚠️ The HUD has to paint ABOVE the `ScrollView` (below, for the tap), so without a
   * ground of its own the content simply shows through it — on all nine screens that scroll, not just Store.
   * ⚠️ With the band, everything scrolling under the header is hidden and the title stays legible, which is
   * the owner's second option; the first (scroll the header away) would take the back button with it.
   * ⚠️ **Opt-in, NOT derived from `tone`** — `preparing.tsx` deliberately pairs a dark `surface.camera`
   * ground with this light HUD. `check:lib` §26 asserts any screen painting `surface.paper` passes it.
   */
  band?: boolean;
}) {
  const palette = HUD_TONES[tone];

  return (
    <>
      {/*
        ⚠️⚠️ **THE BAND IS DECLARED FIRST, so it paints UNDER the circle and the title** (later siblings win
        within one parent) and OVER the scroll view (this whole fragment is a later sibling of it).
      */}
      {band ? (
        <View
          style={[styles.abs, styles.band, { height: HUD_BAND_HEIGHT }]}
          testID="hud-band"
        />
      ) : null}
      {/* ⚠️ The TOUCH target — 44, invisible, centred on the visible circle. */}
      <View
        style={[
          styles.abs,
          styles.lifted,
          { left: HUD.touch.x, top: HUD.touch.y, width: HUD.touch.size, height: HUD.touch.size },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('clan.back')}
          testID={backTestID}
          onPress={() => {
            /**
             * ⚠️ `back()` ALONE IS THE TRAP: a deep link into this screen has no history and answers
             * *"the action GO_BACK was not handled by any navigator"*. ⚠️ The fallback is `replace`,
             * **not** `push` — a push would leave the shrine on the stack TWICE.
             */
            if (router.canGoBack()) router.back();
            else router.replace('/');
          }}
          style={({ pressed }) => [styles.touchFill, pressed && styles.pressed]}
        >
          <View
            style={[
              styles.circle,
              { backgroundColor: palette.fill, borderColor: palette.stroke },
            ]}
          >
            {/* ⚠️ One glyph, U+2039 — the board's `hud · back glyph`. */}
            <Text style={[styles.glyph, { color: palette.glyph }]} allowFontScaling={false}>
              {'\u2039'}
            </Text>
          </View>
        </Pressable>
      </View>

      {titleKey === undefined ? null : (
        <Text
          style={[styles.abs, styles.lifted, styles.title, { left: HUD.title.x, top: HUD.title.y }]}
          testID={titleTestID}
        >
          {t(titleKey)}
        </Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  /**
   * ⚠️ The SECOND line of defence. Ordering is the guaranteed fix — see the header — but a screen
   * that gets the order wrong should not silently lose its back button. ⚠️ `elevation` matters on
   * Android: `zIndex` alone does not lift a view above a scroll view for TOUCH, only for paint.
   */
  lifted: { zIndex: 10, elevation: 10 },
  /**
   * ⚠️ **The band is the screen's OWN ground** (`surface.paper`), not a new colour: it must be
   * indistinguishable from the page it covers, or the header reads as a raised bar.
   * ⚠️ `zIndex` matches `lifted` on purpose — the circle and the title are declared AFTER it, so they paint on
   * top; what it has to beat is the `ScrollView`, which is an earlier sibling. ⚠️ **No `elevation`**: a
   * raised full-width strip would cast a shadow line across the screen, which the board does not draw.
   */
  band: { top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: surface.paper },
  touchFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  /** ⚠️ The FILL and the STROKE come from `HUD_TONES[tone]` — inline, because they vary. */
  circle: {
    width: HUD.back.size,
    height: HUD.back.size,
    borderRadius: HUD.back.size / 2,
    borderWidth: HUD.back.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** ⚠️ Nudged up 2 dp: the `‹` glyph sits low in its em box, and centred it reads as low. */
  glyph: { fontSize: 22, lineHeight: 24, marginTop: -2 },
  title: { color: text.ink, fontSize: fontSize.titleRow.at390, fontWeight: '700' },
  pressed: { opacity: 0.75 },
});
