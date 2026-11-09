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

import { DecorationArt, type ArtVariant } from '@/components/decoration-art';
import { DECORATION_SLOTS, type DecorationCode, type DecorationSlot } from '@/domain/catalogue';
import {
  CATEGORY_LABEL_KEY,
  SLOT_HINT,
  SLOT_HIT,
  categoryOf,
  drawPlan,
  rectsOverlap,
  type Rect,
} from '@/lib/decorate';
import { t } from '@/lib/i18n';
import { brand, text } from '@/theme/tokens';

type EquippedMap = Readonly<Record<DecorationSlot, DecorationCode | null>>;

/** Board px → an absolutely-positioned dp box. The ONE conversion in this file. */
function boxOf(r: Rect, s: number) {
  return { position: 'absolute' as const, left: r.x * s, top: r.y * s, width: r.w * s, height: r.h * s };
}

function Piece({
  code,
  rect,
  s,
  art,
  onPress,
  testID,
}: {
  code: DecorationCode;
  rect: Rect;
  s: number;
  art?: ArtVariant;
  /** ⚠️ Given only when this piece IS the way into customising — see `DecorBack`/`DecorFront`. */
  onPress?: () => void;
  testID?: string;
}) {
  const inner = (
    <DecorationArt
      code={code}
      size={Math.max(rect.w, rect.h) * s}
      box={{ w: rect.w * s, h: rect.h * s }}
      art={art}
    />
  );
  if (onPress === undefined) {
    return (
      <View style={boxOf(rect, s)} pointerEvents="none">
        {/* ⚠️ The rect is the ART's own (`1d`/`1e`), and the art fills it — see `DecorationArt`'s `box` note. */}
        {inner}
      </View>
    );
  }
  /**
   * ⚠️⚠️ **THE DECORATION IS THE BUTTON** (owner, 2026-11-09 — `SCRUM-225`): *"If that position is empty then show the
   * Chip, else clicking on the decoration enters the customizing workflow too."* ⚠️ Its accessible name is the chip's
   * own promise (*"Everything here is customizable"*) rather than new copy — it is the same control, worn by the thing
   * that now occupies the space.
   */
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('home.templeChip')}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [boxOf(rect, s), pressed && { opacity: 0.75 }]}
    >
      {inner}
    </Pressable>
  );
}

/**
 * Everything the shrine should draw, from what the server said is equipped.
 *
 * ⚠️ `band` + `onEnter` exist for ONE reason: a piece that runs through the temple chip's band becomes the way in
 * (`chipBandClear` decides whether the chip is shown at all). Without them the art is inert, which is what every other
 * piece wants to be — a decoration must not steal a tap from the altar behind it.
 */
interface LayerProps {
  scale: number;
  equipped: EquippedMap;
  band?: Rect;
  onEnter?: () => void;
}

function piecesIn(plan: readonly { slot: DecorationSlot; code: DecorationCode; rect: Rect; art?: ArtVariant }[], { scale, band, onEnter }: LayerProps) {
  return plan.map((p) => {
    const inBand = band !== undefined && onEnter !== undefined && rectsOverlap(p.rect, band);
    return (
      <Piece
        key={`${p.slot}:${p.code}`}
        code={p.code}
        rect={p.rect}
        s={scale}
        art={p.art}
        onPress={inBand ? onEnter : undefined}
        testID={inBand ? `decor-piece-${p.slot}` : undefined}
      />
    );
  });
}

/** The prints that sit BEHIND the tablet — mounted before the altar art. */
export function DecorBack(props: LayerProps) {
  return <>{piecesIn(drawPlan(props.equipped).filter((p) => p.behind), props)}</>;
}

/** Everything that sits IN FRONT of the altar art — mounted after it, before the CTA. */
export function DecorFront(props: LayerProps) {
  return <>{piecesIn(drawPlan(props.equipped).filter((p) => !p.behind), props)}</>;
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
