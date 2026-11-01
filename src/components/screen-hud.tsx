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
import { HUD } from '@/lib/profile';
import { brand, fontSize, surface, text } from '@/theme/tokens';

export function ScreenHud({
  titleKey,
  backTestID,
  titleTestID,
}: {
  titleKey: string;
  backTestID: string;
  titleTestID: string;
}) {
  return (
    <>
      {/* ⚠️ The TOUCH target — 44, invisible, centred on the visible circle. */}
      <View
        style={[
          styles.abs,
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
          <View style={styles.circle}>
            {/* ⚠️ One glyph, U+2039 — the board's `hud · back glyph`. */}
            <Text style={styles.glyph} allowFontScaling={false}>
              {'\u2039'}
            </Text>
          </View>
        </Pressable>
      </View>

      <Text style={[styles.abs, styles.title, { left: HUD.title.x, top: HUD.title.y }]} testID={titleTestID}>
        {t(titleKey)}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  touchFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  circle: {
    width: HUD.back.size,
    height: HUD.back.size,
    borderRadius: HUD.back.size / 2,
    borderWidth: HUD.back.borderWidth,
    borderColor: brand.ink,
    backgroundColor: surface.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** ⚠️ Nudged up 1 dp: the `‹` glyph sits low in its em box, and centred it reads as low. */
  glyph: { color: text.ink, fontSize: 22, lineHeight: 24, marginTop: -2 },
  title: { color: text.ink, fontSize: fontSize.titleRow.at390, fontWeight: '700' },
  pressed: { opacity: 0.75 },
});
