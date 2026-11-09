/**
 * THE DECORATIONS ON THE ALTAR — what is equipped, and the outlines that change it (SCRUM-156 · SCRUM-205).
 *
 * ── ⚠️ TWO LAYERS, NOT ONE ─────────────────────────────────────────────────
 * `EN · 1e` paints `decor · 鍾馗像 (background)` **behind** the tablet and the lanterns/couplets **in front of**
 * the table. So the drawings are split: `DecorBack` is mounted before the altar art and `DecorFront` after it.
 * ⚠️ One component doing both would have to be painted either entirely behind or entirely in front of the
 * tablet, and either way one of the six slots is wrong.
 *
 * ── ⚠️ WHAT THIS FILE DOES NOT DECIDE ──────────────────────────────────────
 * Which piece is where comes from `drawPlan()` in `lib/decorate.ts` (pure, gated); this file only scales board
 * px to dp and draws. ⚠️ It never equips anything: a tap opens the picker, and `equipDecoration` writes.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DecorationArt } from '@/components/decoration-art';
import { DECORATION_SLOTS, type DecorationCode, type DecorationSlot } from '@/domain/catalogue';
import {
  CATEGORY_LABEL_KEY,
  SLOT_HINT,
  SLOT_HIT,
  categoryOf,
  drawPlan,
  type Rect,
} from '@/lib/decorate';
import { t } from '@/lib/i18n';
import { brand, text } from '@/theme/tokens';

type EquippedMap = Readonly<Record<DecorationSlot, DecorationCode | null>>;

/** Board px → an absolutely-positioned dp box. The ONE conversion in this file. */
function boxOf(r: Rect, s: number) {
  return { position: 'absolute' as const, left: r.x * s, top: r.y * s, width: r.w * s, height: r.h * s };
}

function Piece({ code, rect, s }: { code: DecorationCode; rect: Rect; s: number }) {
  return (
    <View style={boxOf(rect, s)} pointerEvents="none">
      {/* ⚠️ The rect is the ART's own (`1d`/`1e`), and the art fills it — see `DecorationArt`'s `box` note. */}
      <DecorationArt code={code} size={Math.max(rect.w, rect.h) * s} box={{ w: rect.w * s, h: rect.h * s }} />
    </View>
  );
}

/** The prints that sit BEHIND the tablet — mounted before the altar art. */
export function DecorBack({ scale, equipped }: { scale: number; equipped: EquippedMap }) {
  return (
    <>
      {drawPlan(equipped)
        .filter((p) => p.behind)
        .map((p) => (
          <Piece key={`${p.slot}:${p.code}`} code={p.code} rect={p.rect} s={scale} />
        ))}
    </>
  );
}

/** Everything that sits IN FRONT of the altar art — mounted after it, before the CTA. */
export function DecorFront({ scale, equipped }: { scale: number; equipped: EquippedMap }) {
  return (
    <>
      {drawPlan(equipped)
        .filter((p) => !p.behind)
        .map((p) => (
          <Piece key={`${p.slot}:${p.code}`} code={p.code} rect={p.rect} s={scale} />
        ))}
    </>
  );
}

/**
 * The customise overlay: the six dashed zones (`1f`), their category labels, and `slot · hint`.
 *
 * ⚠️ The zones are **tap targets**, drawn at the board's `slot · …` rects — deliberately larger than the art
 * they hold, so a 41 px-wide couplet still has a 46 px box to aim at and the background print a 190 × 320 one.
 * ⚠️ `hint` is the board's two states: `1f`'s *\"Tap a slot to place a decoration\"* and `1f5`'s *\"No decorations
 * yet — every slot is empty.\"* — chosen from whether the user owns anything, never from an assumption.
 */
export function DecorSlots({
  scale,
  ownedCount,
  onPick,
}: {
  scale: number;
  ownedCount: number;
  onPick: (slot: DecorationSlot) => void;
}) {
  return (
    <>
      {DECORATION_SLOTS.map((slot) => {
        const r = SLOT_HIT[slot];
        const labelKey = CATEGORY_LABEL_KEY[categoryOf(slot)];
        return (
          <Pressable
            key={slot}
            accessibilityRole="button"
            accessibilityLabel={t(labelKey)}
            testID={`decor-slot-${slot}`}
            onPress={() => onPick(slot)}
            style={({ pressed }) => [boxOf(r, scale), styles.slot, pressed && styles.pressed]}
          >
            <Text numberOfLines={1} style={[styles.slotLabel, { fontSize: 9 * scale }]}>
              {t(labelKey)}
            </Text>
          </Pressable>
        );
      })}
      <View style={[boxOf(SLOT_HINT, scale)]} testID="decor-slot-hint">
        <Text numberOfLines={1} style={[styles.hint, { fontSize: 11 * scale }]}>
          {t(ownedCount > 0 ? 'decor.slotHint' : 'decor.emptyHint')}
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  /** `slot · …` — `#F0C75E` @ 0.12 fill, `#A8862A` 2 px DASHED stroke, r10. */
  slot: {
    backgroundColor: 'rgba(240, 199, 94, 0.12)',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: brand.goldDeep,
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingTop: 3,
  },
  /** `slot · … (label)` — `#7B621F`, the text-safe gold. */
  slotLabel: { color: text.gold, fontWeight: '600' },
  /** `slot · hint (how it works)` — `#4A463F`. */
  hint: { color: text.inkSoft },
  pressed: { opacity: 0.7 },
});
