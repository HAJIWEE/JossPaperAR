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
 *   background     blank warm rice-paper, subject isolated → a clean sprite by
 *                  construction (no bg-removal stage at all).
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

/** ≤3 objects — the cap the spike validated (doc 07 §4.2). */
export const MAX_OBJECTS = 3;
/** ADR-002 §4 / doc 11 §4: exactly ONE retry per picture. */
export const MAX_RETRIES = 1;

/** Measured unit costs, in micro-dollars (ADR-002 §1: $0.01 + $0.08). */
export const COST_MICROS = { identify: 10_000, generate: 80_000 } as const;

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
  '"label", "colours" (an array) and optional "count".',
].join(' ');

/**
 * A TARGETED re-probe, used for the single retry when the first answer fails
 * validation (ADR-002 §4 — "failed validation ⇒ targeted re-probe").
 */
export const IDENTIFY_PROMPT_RETRY = [
  'Look carefully at this photograph and answer with JSON only.',
  'Return an array of at most three objects, each an object with the keys',
  '"label" (a short plain kind name) and "colours" (an array of the exact',
  'colours visible on that object in this photo).',
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
  readonly count?: number;
}

/**
 * Compose the final generation prompt from the validated attributes and the
 * locked template. Deterministic: the same attributes give the same prompt,
 * which is what makes the pipeline reviewable. `objects` is expected to be
 * already deduped and sanity-checked by the caller.
 */
export function stylePrompt(objects: readonly IdentifiedObject[]): string {
  const subjects = objects
    .map((o) => {
      const count = o.count && o.count > 1 ? `${o.count} × ` : '';
      return `${count}${o.label} (colours exactly: ${o.colours.join(', ')})`;
    })
    .join('; then ');

  return [
    `Subject: ${subjects}.`,
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
    byKey.set(key, count > 1 ? { label: existing.label, colours, count } : { label: existing.label, colours });
  }
  return [...byKey.values()].slice(0, MAX_OBJECTS);
}

/** Total unit cost of a pipeline run with `retries` extra identify+generate pairs. */
export function costMicrosFor(retries: number): number {
  const perAttempt = COST_MICROS.identify + COST_MICROS.generate;
  return perAttempt * (1 + Math.max(0, Math.min(retries, MAX_RETRIES)));
}
