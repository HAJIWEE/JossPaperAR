/**
 * ═══ THE LOCKED PATH C STYLE TEMPLATE — ADR-002 §2 (normative) ═════════════
 *
 * PATH C IS LOCKED: identify with `fal-ai/moondream2/visual-query`, then
 * generate with `fal-ai/nano-banana-2` (text-to-image) using THIS template.
 * Every clause below is a decision the spike paid for and the PM accepted —
 * they are data, not prose, so `supabase/checks/pathc-check.ts` can assert they
 * are still present and that no example colour has crept back in (the leak that
 * mis-coloured five consecutive spike images).
 *
 * THIS FILE IMPORTS NOTHING ON PURPOSE. It is imported by the Edge runtime
 * (Deno) and by a zero-dependency Node check, so it must stay import-free.
 *
 * The clauses, and why each exists (spike RESULTS rounds 7–9, ADR-002 §2):
 *   colourLock     subject colours stay EXACTLY as in the source photo; the
 *                  palette applies to accents + background only.
 *   lighting       the app's fire art carries a BOTTOM shadow, so the model
 *                  must light from directly above or the look breaks.
 *   glass          "make the glass transparent" was a PM-demanded change.
 *   noGroundShadow the app draws the shadow; a baked one double-shadows.
 *   background     blank warm rice-paper, subject isolated → a FLAT, uniform
 *                  field. ⚠️ That is NOT transparency by itself: see stage ④.
 *   facets         coarse 40–60 flat facets (variant-D fidelity, PM-locked).
 *   ink            ONE consistent ink outline weight.
 *   matte          no speculars — the spike's biggest recurring defect.
 *   structure      anatomy/parts stay separate and complete.
 *   detail         accessories + printed text stay sharp (the v3 clauses).
 */

/** The generation model (ADR-002) — text-to-image, not the edit path. */
export const GENERATE_MODEL = 'fal-ai/nano-banana-2';
/** The identify model (ADR-002) — vision query, closed-set aware. */
export const IDENTIFY_MODEL = 'fal-ai/moondream2/visual-query';

/**
 * ≤3 objects — the cap the spike validated (doc 07 §4.2).
 *
 * ⚠️ THIS IS THE **DETECTION** CAP, NOT THE RENDER CAP. The identifier may name
 * up to three objects; exactly one of them is cartoonized. See
 * `CARTOONIZED_OBJECTS` and `rankObjects` below.
 */
export const MAX_OBJECTS = 3;

/**
 * ═══ DETECT UP TO THREE, CARTOONIZE ONE (ADR-002 Amendment 3, 2026-10-19) ═══
 *
 * The pipeline used to hand **every** detected object to the generator
 * (`stylePrompt` joined them with `"; then "`), so a photograph of one offering
 * on a cluttered desk came back as a low-poly *diagram of the desk*. Demoed a
 * few times and put in front of users, the feedback was consistent: **the extra
 * objects were not wanted.** The owner's decision — *"we will only have 1 object
 * cartoonized … we should still detect if there is more than one object up to 3
 * objects but we should apply an analysis that assigns a probability factor to
 * the objects and only cartoonize the one object with the highest probability."*
 *
 * So the pipeline keeps DETECTING up to `MAX_OBJECTS` (the extra objects are
 * real information — they are what tells us which one the photograph is *about*)
 * and renders `CARTOONIZED_OBJECTS`.
 *
 * ⚠️ It also settles a contradiction that was already written down and left
 * standing: `STYLE_TEMPLATE_V3.output` says *"One object only, centred"* while
 * the composed prompt listed three subjects. The template was right; the
 * pipeline was wrong.
 */
export const CARTOONIZED_OBJECTS = 1;

/**
 * ⚠️ HOW THE SUBJECT IS CHOSEN, AND WHY IT IS NOT JUST "ASK THE MODEL FOR A
 * CONFIDENCE". A VLM's self-reported number is **uncalibrated** and often absent
 * — `moondream2` is a VQA model that answers in prose, and the spike showed it
 * returning bare arrays. Making that number the ONLY signal would mean the
 * decision is made by whichever field the model happened to emit.
 *
 * So the score is a weighted sum of three components, and only ONE of them comes
 * from the model:
 *
 *   · `stated`  — the model's own optional `prominence` (0–1). The only
 *                 model-supplied term; a hint, never the whole answer.
 *   · `order`   — the identify prompt already asks for *"largest and most
 *                 central first"*, so position IS a measurement, not a guess.
 *                 Object 0 scores 1.0, the last scores 1/n.
 *   · `count`   — `count > 1` means the subject appears more than once, which is
 *                 weak evidence the photograph is about it. A TIE-BREAK only:
 *                 at 0.1 it cannot overturn a full step of `order` (0.4).
 *
 * The weights sum to 1 so a score is already in 0–1; `rankObjects` then
 * normalises the set into a probability distribution that sums to 1.
 *
 * ⚠️ THE WEIGHTS WERE RE-DERIVED FROM A SMOKE TEST, NOT GUESSED. The first cut
 * was `0.5 / 0.4 / 0.1`, and it FAILED a realistic case: with two objects, a
 * second object the model had explicitly ranked **0.9** scored **0.650** against
 * the unstated first object's **0.650** — a dead tie, decided by array order. The
 * model's own ranking was worth *nothing*. The cause is structural: for n=2 the
 * `order` gap is `order_weight × 0.5`, so `order` could out-shift a `stated`
 * swing of the same size.
 *
 * At `0.6 / 0.35 / 0.05` the intended relationships hold and are asserted:
 *   · nothing stated      ⇒ the `stated` term is a constant (0.6 × 0.5 = 0.3)
 *                           for every object, so **order decides** — the signal
 *                           we trust when the model says nothing;
 *   · a STRONG hint wins  ⇒ 0.9 on the second object beats an unstated first
 *                           (0.715 vs 0.650). A stated prominence above ≈0.75
 *                           overturns one position at n=2;
 *   · a WEAK hint does not ⇒ 0.55 on the second object still loses (0.505 vs
 *                           0.650). The hint is evidence, not a trump.
 */
export const PROMINENCE_WEIGHTS = { stated: 0.6, order: 0.35, count: 0.05 } as const;

/**
 * The `stated` value used when the model gives no prominence.
 *
 * ⚠️ A NEUTRAL CONSTANT, deliberately. It is added to EVERY unstated object
 * equally, so it cannot change the argmax among them — the ranking then falls
 * through to `order`, which is the signal we actually trust. A low default would
 * instead *penalise* an object for the model's omission, which is not evidence.
 */
export const STATED_PROMINENCE_DEFAULT = 0.5;

/** ADR-002 §4 / doc 11 §4: exactly ONE retry per picture. */
export const MAX_RETRIES = 1;

/**
 * Measured unit costs, in micro-dollars.
 * identify $0.01 + generate $0.08 (ADR-002 §1) + cutout $0.001 (stage ④).
 *
 * ⚠️ THE CUTOUT LINE IS AN UPPER BOUND ON A MEASURED RUN, not a published flat
 * price: `birefnet/v2` bills **$0.000575 per compute second**, and the measured
 * synchronous call took **1.09 s** ≈ $0.00063. $0.001 covers up to ≈1.7 s, so a
 * slow run cannot quietly under-record. A clean picture is therefore **91,000
 * micros (US$0.091)** — still "≈ US$0.09", the number the economy model and the
 * daily stop-rule were built on.
 */
export const COST_MICROS = { identify: 10_000, generate: 80_000, cutout: 1_000 } as const;

/**
 * ⚠️ THE OUTPUT FORMAT IS WEBP, AND THAT IS A MEASURED DECISION (2026-10-04).
 *
 * doc 14 §3 budgets the styled sprite at **≤ 150 KB** ("transparent PNG at
 * display size, not 2K"). Measured live, at the SAME 1K resolution and the same
 * prompt:
 *   · PNG  → 1,326,732 bytes (1.3 MB)   ✗ 8.6× over budget
 *   · WebP →    50,900 bytes (49.7 KB)  ✓ 3× under budget
 *
 * WebP carries alpha (the sprite needs it) and Android decodes it natively. The
 * alternative — keep PNG and add a resize/quantise stage — needs an image
 * library the Deno Edge runtime does not ship, so it is a PR-4-sized change for
 * no fidelity gain. The budget is the NFR; the container was an assumption.
 */
export const GENERATE_OUTPUT_FORMAT = 'webp';
/** The MIME type that format produces (the `styled` bucket must allow it). */
export const GENERATE_CONTENT_TYPE = 'image/webp';

/**
 * ═══ STAGE ④ — THE CUTOUT (added 2026-10-18 · ADR-002 Amendment 2) ══════════
 *
 * ⚠️ ADR-002 §Decision 1 dropped the edit path's bg-removal stages on the claim
 * that Path C's "blank rice-paper background" made the sprite **clean by
 * construction**. MEASURED ON GLASS 2026-10-18, THAT CLAIM WAS FALSE IN THE WAY
 * THAT MATTERS: the generator *paints* the background, so the stored WebP
 * arrives with an **opaque cream card** behind the subject — #F3EDD8, sampled
 * off the burn screen — which reads as a floating rectangle over the live
 * camera. "Clean" was true of the contents; the sprite needs **ALPHA**, and a
 * text-to-image model does not emit it.
 *
 * The spike had already found this (RESULTS round 4: *"the stylizer generates a
 * background … the pipeline needs a second bg-removal (stage ④,
 * post-stylization)"*) — it was simply never carried into the accepted pipeline.
 *
 * So stage ④ cuts the generated frame. Evidence for these exact settings
 * (2026-10-18, the real sprite cropped off the burn screen, 280×153):
 *   · `output_format: webp` → 4-channel RGBA, alpha **0** at every corner,
 *     **71.2%** of pixels fully transparent, **20.7 KB** (150 KB budget intact)
 *   · 'General Use (Light)' @1024 vs 'General Use (Heavy)' @1024 → 71.2% vs
 *     70.5% transparent, visually identical on magenta, at **~1.09 s** sync and
 *     ≈US$0.0006. Light is fal's recommended default, so Light is what we run.
 *   · the thin ink outline survives the cut (inspected, not assumed)
 *
 * ⚠️ ASK FOR WEBP — do not let it default to PNG. The cutout produces the bytes
 * that get stored, so its container must be the one the bucket and the client
 * expect; `check:pathc` asserts the two formats agree.
 */
export const CUTOUT_MODEL = 'fal-ai/birefnet/v2';
/** fal's recommended default; measured equivalent to Heavy on stylizer output. */
export const CUTOUT_VARIANT = 'General Use (Light)';
/** Matches the generator's `resolution: '1K'` point. */
export const CUTOUT_OPERATING_RESOLUTION = '1024x1024';
/** The sprite's real container — stage ④, not the generator, produces it. */
export const CUTOUT_OUTPUT_FORMAT = 'webp';
/** The MIME type that format produces (the `styled` bucket must allow it). */
export const CUTOUT_CONTENT_TYPE = 'image/webp';

/**
 * The identify prompt. ⚠️ IT MUST CONTAIN NO EXAMPLE COLOURS: the spike's
 * `"denim blue metallic"` example was echoed as the main object's colour on 5
 * consecutive images, including a rice cooker. Describe only what you see.
 */
export const IDENTIFY_PROMPT = [
  'Describe what you see in this photograph.',
  'List at most three main objects, largest and most central first.',
  'For each object give: a short plain kind name, and its colours exactly as',
  'they appear in this photo (be precise — name the shade, not a category).',
  'Describe ONLY what is actually visible in this image.',
  'Do NOT copy words from these instructions, and do NOT reuse any example',
  'colour from them. If an object is unclear or partly hidden, say so.',
  'Answer with JSON only, as an array of objects, each with the keys',
  '"label", "colours" (an array), and the optional keys "count" (how many of',
  'that object) and "prominence" (a number from 0 to 1 for how much this',
  'photograph is about that object).',
].join(' ');

/**
 * A TARGETED re-probe, used for the single retry when the first answer fails
 * validation (ADR-002 §4 — "failed validation ⇒ targeted re-probe").
 */
export const IDENTIFY_PROMPT_RETRY = [
  'Look carefully at this photograph and answer with JSON only.',
  'Return an array of at most three objects, largest and most central first,',
  'each an object with the keys "label" (a short plain kind name) and "colours"',
  '(an array of the exact colours visible on that object in this photo), plus',
  'the optional keys "count" and "prominence" (a number from 0 to 1 for how',
  'much this photograph is about that object).',
  'Use only words you can justify from the image itself.',
].join(' ');

/** The normative clause set. Asserted by supabase/checks/pathc-check.ts. */
export const STYLE_TEMPLATE_V3 = {
  base: 'Render this as a VERY COARSE low-poly 3D cartoon: flat faceted surfaces '
    + 'with no more than 40 to 60 large flat polygon facets in total for the '
    + 'whole object — big folded-paper planes, deliberately minimal and chunky, '
    + 'not detailed and not finely triangulated.',
  ink: 'Single consistent ink outline weight around the silhouette and major '
    + 'part boundaries.',
  matte: 'The surface must be completely matte: no specular highlights, no '
    + 'glossy or mirror-like reflections, no lens flare and no bloom — lighting '
    + 'reads only as flat per-facet shading.',
  lighting: 'Light comes from directly above: top facets bright, side facets '
    + 'mid-tone, undersides dark.',
  colourLock: 'Keep the subject\'s own colours exactly as in the source image — '
    + 'do not recolour, re-tint or stylise them. The limited palette of cinnabar '
    + 'red, gold, azurite blue and malachite green applies only to shading '
    + 'accents and to the background.',
  glass: 'Any glass or windows must read transparent and see-through — not '
    + 'blacked out, not tinted and not reflective.',
  noGroundShadow: 'Do not draw a ground shadow or a contact shadow: the app '
    + 'adds its own.',
  background: 'Place the object on a plain, blank, warm rice-paper background, '
    + 'fully isolated — no scene, no props, no floor, no horizon.',
  structure: 'Keep every part separate and complete: nothing merges, vanishes '
    + 'or is redrawn, and each limb or part stays distinct.',
  detail: 'Any accessories and any printed text stay sharp and unchanged.',
  output: 'One object only, centred, whole, clean silhouette, no text overlay, '
    + 'no watermark, no borders.',
} as const;

/** The clause keys a caller may enumerate (and the check asserts). */
export const STYLE_CLAUSES = Object.keys(STYLE_TEMPLATE_V3) as (keyof typeof STYLE_TEMPLATE_V3)[];

/** A validated object from the identify stage. */
export interface IdentifiedObject {
  readonly label: string;
  readonly colours: readonly string[];
  /**
   * How many of that kind the model saw. Recorded for diagnosis — ⚠️ it is NOT
   * put into the prompt any more: `STYLE_TEMPLATE_V3.output` demands one object,
   * and a `"3 × candle"` subject would contradict the clause the owner's
   * decision depends on (ADR-002 Amendment 3).
   */
  readonly count?: number;
  /**
   * The model's own optional 0–1 hint for how much the photograph is about this
   * object. Absent on most answers — see `PROMINENCE_WEIGHTS`.
   */
  readonly prominence?: number;
}

/** An `IdentifiedObject` plus the analysis that ranked it. */
export interface RankedObject extends IdentifiedObject {
  /** The weighted prominence score, already in 0–1. */
  readonly score: number;
  /** `score` normalised across the set — a real probability, the set sums to 1. */
  readonly probability: number;
}

/**
 * The model's own prominence hint as a number in 0–1, or `undefined`.
 *
 * ⚠️ IT IS DELIBERATELY FORGIVING, AND THAT IS THE POINT. `prominence` is an
 * OPTIONAL field: if a malformed one could fail schema validation it would turn
 * a cosmetic omission into a **paid re-probe** (≈US$0.09) — the retry is for an
 * answer we cannot use, not for a missing hint. Anything that is not a finite
 * number is DROPPED, and the analysis falls back to the structural signals it
 * owns. Out-of-range values are clamped rather than refused.
 */
export function prominenceOf(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' && value.trim().length === 0) return undefined;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return undefined;
  return Math.min(1, Math.max(0, n));
}

/**
 * THE SELECTION ANALYSIS — assign every detected object a probability, best
 * first. This is the "analysis that assigns a probability factor" (ADR-002
 * Amendment 3); `selectSubject` takes the argmax.
 *
 * Pure and deterministic: the same attributes always give the same ranking,
 * which is what makes the choice reviewable after the fact.
 */
export function rankObjects(objects: readonly IdentifiedObject[]): RankedObject[] {
  const n = objects.length;
  if (n === 0) return [];

  const scored = objects.map((object, index) => {
    const stated = prominenceOf(object.prominence) ?? STATED_PROMINENCE_DEFAULT;
    // Object 0 is what the prompt asked for first ("largest and most central
    // first"), so position carries real information: 1.0 down to 1/n.
    const order = (n - index) / n;
    const count = (object.count ?? 1) > 1 ? 1 : 0;
    const score = PROMINENCE_WEIGHTS.stated * stated
      + PROMINENCE_WEIGHTS.order * order
      + PROMINENCE_WEIGHTS.count * count;
    return { object, score };
  });

  const total = scored.reduce((sum, entry) => sum + entry.score, 0);
  return scored
    .map(({ object, score }) => ({
      ...object,
      score,
      probability: total > 0 ? score / total : 1 / n,
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * The ONE object the photograph is about — the argmax of `rankObjects`, with the
 * full ranking alongside it so the caller can log *why*. `null` only for an
 * empty set (which `parseIdentify` never produces — it treats "nothing usable"
 * as a validation failure).
 */
export function selectSubject(
  objects: readonly IdentifiedObject[],
): { readonly subject: RankedObject; readonly ranked: RankedObject[] } | null {
  const ranked = rankObjects(objects);
  const subject = ranked[0];
  return subject ? { subject, ranked } : null;
}

/**
 * Compose the final generation prompt from the validated attributes and the
 * locked template. Deterministic: the same attributes give the same prompt,
 * which is what makes the pipeline reviewable. The subject is expected to be
 * already deduped, sanity-checked and SELECTED by the caller.
 *
 * ⚠️ IT TAKES ONE OBJECT, NOT AN ARRAY — AND THAT IS THE GUARANTEE. The owner's
 * decision is "only 1 object cartoonized" (ADR-002 Amendment 3), and a decision
 * enforced by a doc is a decision that drifts. With a singular parameter there
 * is no expression that feeds the generator a list: a caller holding three
 * objects has to choose one, and the compiler says so.
 */
export function stylePrompt(subject: IdentifiedObject): string {
  return [
    `Subject: ${subject.label} (colours exactly: ${subject.colours.join(', ')}).`,
    STYLE_TEMPLATE_V3.base,
    STYLE_TEMPLATE_V3.ink,
    STYLE_TEMPLATE_V3.matte,
    STYLE_TEMPLATE_V3.lighting,
    STYLE_TEMPLATE_V3.colourLock,
    STYLE_TEMPLATE_V3.glass,
    STYLE_TEMPLATE_V3.noGroundShadow,
    STYLE_TEMPLATE_V3.background,
    STYLE_TEMPLATE_V3.structure,
    STYLE_TEMPLATE_V3.detail,
    STYLE_TEMPLATE_V3.output,
  ].join(' ');
}

/**
 * Colours shared across DIFFERENT object kinds.
 *
 * ADR-002 §4 says "identical colour string across different object types ⇒
 * reject and re-probe" — and the spike's leak was exactly that. But taken
 * literally the rule also refuses an HONEST answer: a real teapot and a real
 * teacup on one tray are both legitimately "brown", and refusing that would
 * block the ritual for a perfectly ordinary scene. (Observed live on
 * 2026-10-04: the pipeline rejected `Teacup[brown]` + `Teapot[brown]`.)
 *
 * So the SIGNAL is kept and the BLOCKING threshold is narrowed to the leak's
 * own fingerprint: a **multi-token paint name echoed verbatim** across
 * different labels — `"denim blue metallic"` on a sedan AND a rice cooker. A
 * one- or two-token generic name (`brown`, `dark brown`) is reported as a
 * warning and the ritual proceeds.
 */
export interface SharedColour {
  readonly colour: string;
  readonly labels: readonly string[];
  readonly tokens: number;
}

/** A colour of this many words or more, reused across labels, is the leak's shape. */
export const COLOUR_LEAK_MIN_TOKENS = 3;

/** Every colour string claimed by more than one object label. */
export function sharedColours(objects: readonly IdentifiedObject[]): SharedColour[] {
  const byColour = new Map<string, Set<string>>();
  const display = new Map<string, string>();

  for (const object of objects) {
    const label = object.label.trim().toLowerCase();
    for (const colour of object.colours) {
      const key = colour.trim().toLowerCase();
      if (key.length === 0) continue;
      display.set(key, colour.trim());
      const labels = byColour.get(key) ?? new Set<string>();
      labels.add(label);
      byColour.set(key, labels);
    }
  }

  const shared: SharedColour[] = [];
  for (const [key, labels] of byColour) {
    if (labels.size < 2) continue;
    shared.push({
      colour: display.get(key) ?? key,
      labels: [...labels],
      tokens: key.split(/\s+/).filter(Boolean).length,
    });
  }
  return shared;
}

/**
 * The blocking test, deliberately narrow. Returns the reason to reject, or null.
 */
export function colourLeak(objects: readonly IdentifiedObject[]): string | null {
  for (const shared of sharedColours(objects)) {
    if (shared.tokens >= COLOUR_LEAK_MIN_TOKENS) {
      return `${shared.colour} is claimed verbatim for both `
        + `${shared.labels.map((l) => `"${l}"`).join(' and ')} — the spike's leak signature`;
    }
  }
  return null;
}

/** Non-blocking reuses, for the log (never for a refusal). */
export function colourNotes(objects: readonly IdentifiedObject[]): string[] {
  return sharedColours(objects)
    .filter((shared) => shared.tokens < COLOUR_LEAK_MIN_TOKENS)
    .map((shared) => `"${shared.colour}" is shared by ${shared.labels.join(' + ')} (allowed)`);
}

/**
 * Drop near-duplicates and cap at MAX_OBJECTS: the spike returned the same
 * object up to four times (glasses ×4), which inflates the prompt and skews
 * the count. Keeps the first occurrence and the HIGHEST count seen per label.
 *
 * ⚠️ A MERGE MUST NOT EAT THE RANKING SIGNAL. The merge branch builds a fresh
 * object, so `prominence` has to be carried explicitly — otherwise a duplicate
 * that stated its prominence would silently lose it, and `rankObjects` would
 * fall back to order for an object the model had actually ranked. The highest
 * stated value wins, mirroring the count rule.
 */
export function dedupeObjects(objects: readonly IdentifiedObject[]): IdentifiedObject[] {
  const byKey = new Map<string, IdentifiedObject>();
  for (const object of objects) {
    const label = object.label.trim();
    const key = label.toLowerCase();
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...object, label });
      continue;
    }
    const count = Math.max(existing.count ?? 1, object.count ?? 1);
    const colours = [...new Set([...existing.colours, ...object.colours])].slice(0, 4);
    const prominence = Math.max(
      prominenceOf(existing.prominence) ?? 0,
      prominenceOf(object.prominence) ?? 0,
    );
    byKey.set(key, {
      label: existing.label,
      colours,
      ...(count > 1 ? { count } : {}),
      ...(prominence > 0 ? { prominence } : {}),
    });
  }
  return [...byKey.values()].slice(0, MAX_OBJECTS);
}

/** Total unit cost of a pipeline run with `retries` extra identify+generate pairs. */
export function costMicrosFor(retries: number): number {
  const perAttempt = COST_MICROS.identify + COST_MICROS.generate + COST_MICROS.cutout;
  return perAttempt * (1 + Math.max(0, Math.min(retries, MAX_RETRIES)));
}
