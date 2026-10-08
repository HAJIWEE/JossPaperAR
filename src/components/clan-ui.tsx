import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOUCH_GAP, TOUCH_TARGET, brand, fontSize, onColorCream, radius, space, surface, text } from '@/theme/tokens';

/**
 * The small shared pieces the clan screens are built from.
 *
 * ⚠️ NON-ROUTE CODE LIVES OUTSIDE `src/app/` (AGENTS.md) — every file under
 * `src/app/` is a screen, so shared UI belongs here.
 *
 * These are deliberately plain: the real surfaces are drawn in Penpot and this
 * session could not reach it, so nothing here invents a visual idea — it uses
 * the token colours and the 44 px target the design system already fixes
 * (N11: the 40–50s audience is the accessibility case).
 */

export function Screen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl },
      ]}
    >
      {children}
    </ScrollView>
  );
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.pageTitle}>{children}</Text>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Body({ children }: { children: ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

export function Hint({ children }: { children: ReactNode }) {
  return <Text style={styles.hint}>{children}</Text>;
}

/** The one-line "what am I looking at" caption above a list. */
export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

/**
 * doc 15 §4.1 — the fork's two cards, and the reusable "big choice" surface.
 * ⚠️ minHeight, not height: system font scaling to ×1.5 (N11) must not clip a
 * two-line hint, which a fixed height would hide on the accessibility case.
 */
export function ChoiceCard({
  title,
  hint,
  onPress,
  testID,
}: {
  title: string;
  hint: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, pressed && styles.pressed]}
    >
      <Text style={styles.choiceTitle}>{title}</Text>
      <Text style={styles.choiceHint}>{hint}</Text>
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.primary, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Text style={styles.primaryLabel}>{label}</Text>
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  danger = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
    >
      <Text style={[styles.ghostLabel, danger && styles.ghostDanger]}>{label}</Text>
    </Pressable>
  );
}

/** A labelled text input — clan name, invite code, rename. */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize = 'none',
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  autoCapitalize?: 'none' | 'characters' | 'words';
  testID?: string;
}) {
  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={text.muted}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={styles.input}
      />
    </View>
  );
}

/** One row of the roster, the Book, or an action list. */
export function Row({
  left,
  right,
  onPress,
  testID,
}: {
  left: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  const content = (
    <>
      <View style={styles.rowLeft}>{left}</View>
      {right ? <View style={styles.rowRight}>{right}</View> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.paper },
  content: { paddingHorizontal: space.lg },
  pageTitle: {
    color: text.ink,
    fontSize: fontSize.titlePage.at390,
    fontWeight: '700',
    marginBottom: space.sm,
  },
  sectionTitle: {
    color: text.cinnabar,
    fontSize: fontSize.titleRow.at390,
    fontWeight: '700',
    marginTop: space.lg,
    marginBottom: space.xs,
  },
  body: { color: text.inkSoft, fontSize: fontSize.body.at390, lineHeight: 21, marginBottom: space.sm },
  hint: { color: text.muted, fontSize: fontSize.caption.at390, marginBottom: space.sm },
  label: {
    color: text.muted,
    fontSize: fontSize.caption.at390,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: space.xs,
  },
  choice: {
    minHeight: TOUCH_TARGET * 2,
    backgroundColor: surface.row,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: surface.paperEdge,
    padding: space.md,
    marginBottom: TOUCH_GAP,
    justifyContent: 'center',
  },
  choiceTitle: {
    color: text.cinnabar,
    fontSize: fontSize.titleRow.at390,
    fontWeight: '700',
    marginBottom: space.xs,
  },
  choiceHint: { color: text.inkSoft, fontSize: fontSize.body.at390, lineHeight: 20 },
  primary: {
    minHeight: TOUCH_TARGET,
    backgroundColor: brand.cinnabar,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.md,
  },
  primaryLabel: { color: onColorCream, fontSize: fontSize.bodyLg.at390, fontWeight: '600' },
  disabled: { opacity: 0.4 },
  ghost: {
    minHeight: TOUCH_TARGET,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: surface.paperEdge,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: TOUCH_GAP,
  },
  ghostLabel: { color: text.ink, fontSize: fontSize.body.at390, fontWeight: '600' },
  ghostDanger: { color: text.cinnabar },
  pressed: { opacity: 0.75 },
  field: { marginTop: space.md },
  input: {
    minHeight: TOUCH_TARGET,
    backgroundColor: surface.row,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: surface.paperEdge,
    paddingHorizontal: space.md,
    color: text.ink,
    fontSize: fontSize.bodyLg.at390,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET,
    backgroundColor: surface.row,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    marginBottom: TOUCH_GAP,
  },
  rowLeft: { flex: 1 },
  rowRight: { marginLeft: space.sm },
});
