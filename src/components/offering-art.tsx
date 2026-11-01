/**
 * THE OFFERING ART — ported from Penpot, 2026-11-01 (SCRUM-150).
 *
 * ⚠⚠ **THESE ILLUSTRATIONS DID NOT EXIST IN THE APP.** The catalogue is code-owned NAMES and
 * PRICES (`domain/catalogue.ts`); there was no per-item art anywhere in `src/`, and
 * `components/home/offerings.tsx` is the ALTAR's art, not a per-item sprite. So the Store and the
 * Collection screen had nothing to draw in the art band the boards reserve.
 *
 * ⚠⚠ **PORTED, NOT REDRAWN, AND NOT INVENTED.** Every shape below is transcribed from the board
 * (`EN · 7 Store`, groups `art · Cash Bundle` / `art · Gold Bar` / `art · Phone` / `art · House` /
 * `art · wealth bundle (ingots)`) — same geometry, same fills, same strokes.
 *
 * ⚠ **THE COORDINATE SPACE, WHICH IS THE WHOLE TRICK.** Penpot stores a path's `content` in the
 * shape's OWN space (numbers in the thousands) while a rectangle's `x/y` are BOARD space. Mapping
 * each path's local bounding box onto its own board box puts **every shape in one space**, so the
 * `viewBox` is simply the group's board box. ⚠⚠ **Getting this wrong is invisible to `tsc`** —
 * both spaces are legal numbers — which is the same class of bug `offerings.tsx` records for the
 * offering dots.
 *
 * ⚠ The two `base-background` rectangles are **dropped**: they are the group's own bounds, not art.
 *
 * ⚠ The shadow ellipses ARE kept — they are the ground shadow the board draws under each item, and
 * omitting them would change the art's silhouette.
 */

import { Ellipse, Path, Rect, Svg } from 'react-native-svg';

import type { ReactElement } from 'react';

import type { OfferingCode } from '@/domain/catalogue';
import { ART_BOX, artSize, fitArt } from '@/lib/offering-art';


function CashBundleArt() {
  return (
    <>
    <Ellipse cx={42.9} cy={67.2} rx={30.4} ry={3.1} fill="#d8cfbd" />
    <Path d="M11.1,49.8L74,40.2L69.4,10.1L6.5,19.7Z" fill="#f0c75e" stroke="#1a1a1a" strokeWidth={3} />
    <Path d="M15.2,49.2L21.3,48.3L16.7,18.2L10.6,19.1Z" fill="#c23b22" stroke="#1a1a1a" strokeWidth={2.5} />
    <Path d="M31,42.6L62.4,37.8L59.3,17.3L27.8,22.1Z" fill="#d4af37" stroke="#c23b22" strokeWidth={4} />
    <Path d="M44.5,25.8L49.2,29.3L45.8,34L41,30.6Z" fill="#f0c75e" stroke="#1a1a1a" strokeWidth={2} />
    <Path d="M11.1,49.8L74.7,40.2L74.7,45L11.1,54.7Z" fill="#f5f0e8" stroke="#1a1a1a" strokeWidth={2.5} />
    <Path d="M11.1,54.7L74.7,45L74.7,49.8L11.1,59.5Z" fill="#eae2d2" stroke="#1a1a1a" strokeWidth={2.5} />
    <Path d="M11.1,59.5L74.7,49.8L74.7,54.7L11.1,64.4Z" fill="#f5f0e8" stroke="#1a1a1a" strokeWidth={2.5} />
    </>
  );
}

function GoldBarArt() {
  return (
    <>
    <Ellipse cx={48.9} cy={62.6} rx={38.6} ry={3.4} fill="#d8cfbd" />
    <Path d="M15.4,32.6L73.7,32.6L82.3,23.1L24,23.1Z" fill="#f0c75e" stroke="#1a1a1a" strokeWidth={3} />
    <Path d="M73.7,32.6L82.3,23.1L89.2,48.9L80.6,58.3Z" fill="#a8862a" stroke="#1a1a1a" strokeWidth={3} />
    <Path d="M8.6,58.3L80.6,58.3L73.7,32.6L15.4,32.6Z" fill="#d4af37" stroke="#1a1a1a" strokeWidth={3} />
    <Path d="M14.8,35.6L74.3,35.6L73.8,38.6L15.3,38.6Z" fill="#f0c75e" />
    <Path d="M44.6,39.4L51,45.4L44.6,51.4L38.2,45.4Z" fill="#f0c75e" stroke="#1a1a1a" strokeWidth={2.2} />
    </>
  );
}

function PhoneArt() {
  return (
    <>
    <Ellipse cx={27.1} cy={67.2} rx={17.6} ry={3.1} fill="#d8cfbd" />
    <Rect x={10.9} y={2.7} width={32.6} height={61.1} rx={11} fill="#1a1a1a" />
    <Rect x={14.9} y={8.2} width={24.4} height={50.3} rx={6} fill="#4a6fa5" stroke="#1a1a1a" strokeWidth={2.5} />
    <Path d="M14.9,58.4L39.4,34L39.4,58.4Z" fill="#6e8fc7" />
    <Rect x={23.1} y={5.1} width={8.1} height={2} rx={1.5} fill="#4a6fa5" />
    <Ellipse cx={35.3} cy={6.1} rx={1.4} ry={1.4} fill="#4a6fa5" />
    <Rect x={20.4} y={53} width={13.6} height={2.4} rx={1.8} fill="#f5f0e8" />
    <Rect x={23.1} y={19} width={8.8} height={13.6} rx={2} fill="#d4af37" stroke="#1a1a1a" strokeWidth={2} />
    <Rect x={21} y={31.2} width={12.9} height={2.7} fill="#a8862a" stroke="#1a1a1a" strokeWidth={1.8} />
    </>
  );
}

function HouseArt() {
  return (
    <>
    <Ellipse cx={55.6} cy={66.1} rx={47.1} ry={3.3} fill="#d8cfbd" />
    <Path d="M5.2,60.2L5.2,36.7L43.2,36.7L43.2,60.2Z" fill="#f5f0e8" stroke="#1a1a1a" strokeWidth={3} />
    <Path d="M5.2,36.7L43.2,36.7L49.8,30.1L11.8,30.1Z" fill="#eae2d2" stroke="#1a1a1a" strokeWidth={3} />
    <Rect x={9.2} y={43.2} width={21} height={17} fill="#121418" stroke="#1a1a1a" strokeWidth={2.5} />
    <Rect x={28.8} y={43.2} width={3.9} height={17} fill="#a8862a" stroke="#1a1a1a" strokeWidth={2.5} />
    <Rect x={35.4} y={39.3} width={5.9} height={20.9} fill="#4a6fa5" stroke="#1a1a1a" strokeWidth={2.2} />
    <Path d="M45.8,60.2L45.8,14.4L99.5,14.4L99.5,60.2Z" fill="#f5f0e8" stroke="#1a1a1a" strokeWidth={3} />
    <Path d="M45.8,14.4L99.5,14.4L106.1,7.9L52.4,7.9Z" fill="#eae2d2" stroke="#1a1a1a" strokeWidth={3} />
    <Path d="M99.5,14.4L106.1,7.9L106.1,53.7L99.5,60.2Z" fill="#d8cdbd" stroke="#1a1a1a" strokeWidth={3} />
    <Rect x={51.1} y={19.6} width={19.6} height={15.7} fill="#4a6fa5" stroke="#1a1a1a" strokeWidth={2.5} />
    <Path d="M51.1,35.3L70.7,19.6L70.7,35.3Z" fill="#6e8fc7" />
    <Rect x={74.6} y={19.6} width={19.6} height={15.7} fill="#f0c75e" stroke="#1a1a1a" strokeWidth={2.5} />
    <Rect x={51.1} y={40.6} width={19.6} height={17} fill="#4a6fa5" stroke="#1a1a1a" strokeWidth={2.5} />
    <Path d="M51.1,57.6L70.7,40.6L70.7,57.6Z" fill="#6e8fc7" />
    <Rect x={75.9} y={40.6} width={7.9} height={19.6} fill="#c23b22" stroke="#1a1a1a" strokeWidth={2.5} />
    <Ellipse cx={81.5} cy={51.1} rx={1} ry={1} fill="#f0c75e" />
    <Rect x={87.7} y={43.2} width={7.9} height={9.2} fill="#f0c75e" stroke="#1a1a1a" strokeWidth={2.2} />
    <Ellipse cx={6.5} cy={56.3} rx={5.2} ry={5.2} fill="#0e9b78" stroke="#1a1a1a" strokeWidth={2.5} />
    <Ellipse cx={103.4} cy={56.3} rx={4.6} ry={4.6} fill="#0e9b78" stroke="#1a1a1a" strokeWidth={2.5} />
    </>
  );
}

function WealthBundleArt() {
  return (
    <>
    <Ellipse cx={51.7} cy={62.8} rx={42.4} ry={2.9} fill="#d8cfbd" />
    <Path d="M6.4,57.5L6.4,36.3L40.5,36.3L40.5,57.5Z" fill="#f5f0e8" stroke="#1a1a1a" strokeWidth={2.1} />
    <Path d="M6.4,36.3L40.5,36.3L46.4,30.5L12.3,30.5Z" fill="#eae2d2" stroke="#1a1a1a" strokeWidth={2.1} />
    <Rect x={9.9} y={42.2} width={18.8} height={15.3} fill="#121418" stroke="#1a1a1a" strokeWidth={1.8} />
    <Rect x={27.6} y={42.2} width={3.5} height={15.3} fill="#a8862a" stroke="#1a1a1a" strokeWidth={1.8} />
    <Rect x={33.5} y={38.7} width={5.3} height={18.8} fill="#4a6fa5" stroke="#1a1a1a" strokeWidth={1.5} />
    <Path d="M42.9,57.5L42.9,16.3L91.2,16.3L91.2,57.5Z" fill="#f5f0e8" stroke="#1a1a1a" strokeWidth={2.1} />
    <Path d="M42.9,16.3L91.2,16.3L97.1,10.4L48.8,10.4Z" fill="#eae2d2" stroke="#1a1a1a" strokeWidth={2.1} />
    <Path d="M91.2,16.3L97.1,10.4L97.1,51.7L91.2,57.5Z" fill="#d8cdbd" stroke="#1a1a1a" strokeWidth={2.1} />
    <Rect x={47.6} y={21} width={17.7} height={14.1} fill="#4a6fa5" stroke="#1a1a1a" strokeWidth={1.8} />
    <Path d="M47.6,35.2L65.3,21L65.3,35.2Z" fill="#6e8fc7" />
    <Rect x={68.8} y={21} width={17.7} height={14.1} fill="#f0c75e" stroke="#1a1a1a" strokeWidth={1.8} />
    <Rect x={47.6} y={39.9} width={17.7} height={15.3} fill="#4a6fa5" stroke="#1a1a1a" strokeWidth={1.8} />
    <Path d="M47.6,55.2L65.3,39.9L65.3,55.2Z" fill="#6e8fc7" />
    <Rect x={70} y={39.9} width={7.1} height={17.7} fill="#c23b22" stroke="#1a1a1a" strokeWidth={1.8} />
    <Ellipse cx={75} cy={49.3} rx={0.9} ry={0.9} fill="#f0c75e" />
    <Rect x={80.6} y={42.2} width={7.1} height={8.2} fill="#f0c75e" stroke="#1a1a1a" strokeWidth={1.5} />
    <Ellipse cx={7.6} cy={54} rx={4.7} ry={4.7} fill="#0e9b78" stroke="#1a1a1a" strokeWidth={1.8} />
    <Ellipse cx={94.7} cy={54} rx={4.1} ry={4.1} fill="#0e9b78" stroke="#1a1a1a" strokeWidth={1.8} />
    <Ellipse cx={183.4} cy={73.4} rx={17.5} ry={3} fill="#d8cfbd" />
    <Rect x={167.2} y={9.4} width={32.3} height={60.6} rx={8.8} fill="#1a1a1a" />
    <Rect x={171.3} y={14.8} width={24.2} height={49.8} rx={4.8} fill="#4a6fa5" stroke="#1a1a1a" strokeWidth={2} />
    <Path d="M171.3,64.6L195.5,40.4L195.5,64.6Z" fill="#6e8fc7" />
    <Rect x={179.3} y={11.8} width={8.1} height={2} rx={1.2} fill="#4a6fa5" />
    <Ellipse cx={191.5} cy={12.8} rx={1.3} ry={1.3} fill="#4a6fa5" />
    <Rect x={176.7} y={59.2} width={13.5} height={2.4} rx={1.4} fill="#f5f0e8" />
    <Rect x={179.3} y={25.6} width={8.7} height={13.5} rx={1.6} fill="#d4af37" stroke="#1a1a1a" strokeWidth={1.6} />
    <Rect x={177.3} y={37.7} width={12.8} height={2.7} fill="#a8862a" stroke="#1a1a1a" strokeWidth={1.4} />
    <Ellipse cx={50.8} cy={97.7} rx={22.9} ry={2.3} fill="#d8cfbd" />
    <Path d="M26.9,84.7L74.3,77.4L70.8,54.7L23.4,62Z" fill="#f0c75e" stroke="#1a1a1a" strokeWidth={1.9} />
    <Path d="M29.9,84.2L34.6,83.5L31.1,60.8L26.5,61.5Z" fill="#c23b22" stroke="#1a1a1a" strokeWidth={1.5} />
    <Path d="M41.8,79.2L65.6,75.6L63.2,60.1L39.5,63.7Z" fill="#d4af37" stroke="#c23b22" strokeWidth={2.5} />
    <Path d="M52,66.6L55.6,69.2L53,72.8L49.4,70.1Z" fill="#f0c75e" stroke="#1a1a1a" strokeWidth={1.2} />
    <Path d="M26.9,84.7L74.8,77.4L74.8,81L26.9,88.3Z" fill="#f5f0e8" stroke="#1a1a1a" strokeWidth={1.6} />
    <Path d="M26.9,88.3L74.8,81L74.8,84.7L26.9,92Z" fill="#eae2d2" stroke="#1a1a1a" strokeWidth={1.6} />
    <Path d="M26.9,92L74.8,84.7L74.8,88.3L26.9,95.6Z" fill="#f5f0e8" stroke="#1a1a1a" strokeWidth={1.6} />
    <Ellipse cx={135.9} cy={92.9} rx={30.3} ry={2.7} fill="#d8cfbd" />
    <Path d="M109.7,69.3L155.5,69.3L162.2,61.9L116.4,61.9Z" fill="#f0c75e" stroke="#1a1a1a" strokeWidth={2.4} />
    <Path d="M155.5,69.3L162.2,61.9L167.6,82.1L160.8,89.5Z" fill="#a8862a" stroke="#1a1a1a" strokeWidth={2.4} />
    <Path d="M104.3,89.5L160.8,89.5L155.5,69.3L109.7,69.3Z" fill="#d4af37" stroke="#1a1a1a" strokeWidth={2.4} />
    <Path d="M109.2,71.7L155.9,71.7L155.5,74L109.6,74Z" fill="#f0c75e" />
    <Path d="M132.6,74.7L137.6,79.4L132.6,84.1L127.5,79.4Z" fill="#f0c75e" stroke="#1a1a1a" strokeWidth={1.8} />
    </>
  );
}

/**
 * ⚠️ **THE ART'S OWN BOX, PER CODE — AND THE ASPECTS DIFFER.** 85.8×72 for the cash bundle against
 * 220.4×106 for the wealth bundle, so a caller that stretched every item into one box would distort
 * four of the five. `fitArt` is the ONE place that is decided, and `check:lib` §29 asserts it.
 */
const ART: Record<OfferingCode, { readonly viewBox: string; readonly draw: () => ReactElement }> = {
  joss_paper_stack: { viewBox: ART_BOX.joss_paper_stack, draw: CashBundleArt },
  gold_bar: { viewBox: ART_BOX.gold_bar, draw: GoldBarArt },
  smartphone: { viewBox: ART_BOX.smartphone, draw: PhoneArt },
  house: { viewBox: ART_BOX.house, draw: HouseArt },
  wealth_bundle: { viewBox: ART_BOX.wealth_bundle, draw: WealthBundleArt },
};

export function OfferingArt({
  code,
  boxW,
  boxH,
}: {
  code: OfferingCode;
  boxW: number;
  boxH: number;
}) {
  const { viewBox, draw: Draw } = ART[code];
  const { width, height } = fitArt(code, boxW, boxH);
  return (
    <Svg width={width} height={height} viewBox={viewBox}>
      <Draw />
    </Svg>
  );
}
