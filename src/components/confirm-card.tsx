/**
 * confirm-card.tsx — THE designed confirm dialog (SCRUM-123, option A).
 *
 * The geometry, the colours and the typography live in `src/lib/confirm-card.ts`,
 * measured off the Penpot boards and assertable there without a device. This file only
 * renders them — the project's usual pure/device split, the same one
 * `src/components/clan-pill.tsx` uses.
 *
 * ── ⚠️ WHY `Modal` AND NOT AN ABSOLUTELY-POSITIONED OVERLAY ──────────────────
 * A confirm is the one surface where Android's hardware BACK must be *handled*: an
 * overlay would let BACK fall through to the screen underneath while the card is still
 * on it. `Modal` owns that (`onRequestClose`), and it also gives the card its own
 * accessibility layer (`accessibilityViewIsModal`), so a screen reader cannot wander
 * into the screen behind it.
 *
 * ── ⚠️ THE CARD SIZES TO ITS CONTENT, DELIBERATELY ───────────────────────────
 * The board draws a fixed 350 × 284 box, but that height is a *consequence* of the
 * content it happens to carry. What is fixed, and what this component reproduces
 * exactly, is the card's fill, radius and paddings, its typography, and the geometry of
 * both buttons — including the 20 px bottom padding that keeps the cancel label ON the
 * card (`SCRUM-104`).
 */

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { CONFIRM_SPEC, scrimRgba } from '@/lib/confirm-card';

export interface ConfirmCardProps {
  readonly visible: boolean;
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ConfirmCard({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmCardProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // ⚠️ Android BACK dismisses the card; without this it would reach the screen.
      onRequestClose={onCancel}
    >
      <View style={styles.scrim}>
        <View style={styles.card} accessibilityViewIsModal testID="confirm-card">
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>

          <Pressable
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            onPress={onConfirm}
            accessibilityRole="button"
            testID="confirm-card-primary"
          >
            <Text style={styles.primaryLabel}>{confirmLabel}</Text>
          </Pressable>

          {/*
            ⚠️ The VISIBLE label is 20 px; the TOUCH target is 44 (this project's floor
            for the 40–50s audience). The board draws the label, not the target — the
            same resolution as the halved zoom pills: never shrink what the finger hits.
          */}
          <Pressable
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
            onPress={onCancel}
            accessibilityRole="button"
            testID="confirm-card-cancel"
          >
            <Text style={styles.cancelLabel}>{cancelLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: scrimRgba(),
    justifyContent: 'center',
    paddingHorizontal: CONFIRM_SPEC.gutter,
  },
  card: {
    backgroundColor: CONFIRM_SPEC.card.fill,
    borderRadius: CONFIRM_SPEC.card.radius,
    paddingHorizontal: CONFIRM_SPEC.card.padH,
    paddingTop: CONFIRM_SPEC.card.padTop,
    paddingBottom: CONFIRM_SPEC.card.padBottom,
  },
  title: {
    fontSize: CONFIRM_SPEC.title.size,
    fontWeight: CONFIRM_SPEC.title.weight,
    color: CONFIRM_SPEC.title.color,
  },
  body: {
    marginTop: 8,
    fontSize: CONFIRM_SPEC.body.size,
    fontWeight: CONFIRM_SPEC.body.weight,
    color: CONFIRM_SPEC.body.color,
  },
  primary: {
    marginTop: 20,
    height: CONFIRM_SPEC.primary.height,
    borderRadius: CONFIRM_SPEC.primary.radius,
    backgroundColor: CONFIRM_SPEC.primary.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontSize: CONFIRM_SPEC.primary.labelSize,
    fontWeight: CONFIRM_SPEC.primary.labelWeight,
    color: CONFIRM_SPEC.primary.labelColor,
  },
  cancel: {
    marginTop: 4,
    height: CONFIRM_SPEC.cancel.touchHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    fontSize: CONFIRM_SPEC.cancel.labelSize,
    fontWeight: CONFIRM_SPEC.cancel.labelWeight,
    color: CONFIRM_SPEC.cancel.color,
  },
  pressed: { opacity: 0.72 },
});
