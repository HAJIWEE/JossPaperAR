/**
 * locale-toggle.tsx — the board's `set · lang pill` (SCRUM-151).
 *
 * `EN · 8b Settings` draws a 118×32 r16 track in `surface.paperDeep` holding two segments, the
 * active one a 58×28 r14 chip in `onColorCream` with a 2.5 ink stroke. That is what this renders.
 *
 * ── ⚠️ THE LABELS ARE ENDONYMS, AND THAT IS THE POINT ───────────────────────
 * `EN` and `中文` come from `LOCALE_LABELS` and are **not** `t()` keys: a language switcher whose
 * options are written in the language you cannot read is useless. Translating them would put
 * `英语` / `中文` in front of an English speaker who is looking for their own language.
 *
 * ⚠️ **Tapping the ACTIVE segment does nothing**, deliberately: re-selecting the current locale would
 * remount the whole app (see `locale-provider.tsx`) for no change at all.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLocale } from '@/components/locale-provider';
import { LOCALES, type Locale } from '@/lib/i18n';
import { LOCALE_LABELS } from '@/lib/locale';
import { LOCALE_PILL } from '@/lib/profile';
import { brand, onColorCream, surface, text } from '@/theme/tokens';

export function LocaleToggle({ testID }: { testID?: string }) {
  const { locale, setAppLocale } = useLocale();

  return (
    <View style={styles.track} testID={testID ?? 'locale-toggle'}>
      {LOCALES.map((option: Locale) => {
        const active = option === locale;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={LOCALE_LABELS[option]}
            testID={`locale-${option}`}
            onPress={() => {
              if (!active) setAppLocale(option);
            }}
            style={({ pressed }) => [
              styles.segment,
              active && styles.segmentActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{LOCALE_LABELS[option]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: LOCALE_PILL.w,
    height: LOCALE_PILL.h,
    borderRadius: LOCALE_PILL.radius,
    backgroundColor: surface.paperDeep,
    flexDirection: 'row',
    alignItems: 'center',
    padding: LOCALE_PILL.inset,
  },
  segment: {
    flex: 1,
    height: LOCALE_PILL.h - LOCALE_PILL.inset * 2,
    borderRadius: LOCALE_PILL.segmentRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** ⚠️ The active chip is CREAM + an ink stroke — the same treatment as the clan pill's role chip. */
  segmentActive: {
    backgroundColor: onColorCream,
    borderWidth: 2.5,
    borderColor: brand.ink,
  },
  label: { color: text.inkSoft, fontSize: 12, fontWeight: '400' },
  labelActive: { color: text.ink, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
