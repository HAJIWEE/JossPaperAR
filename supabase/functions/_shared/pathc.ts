/**
 * ── PATH C, THE ONLY CARTOONIZATION PIPELINE (ADR-002, PM-locked) ──────────
 *
 *   ① identify  `fal-ai/moondream2/visual-query`  ≤3 objects + precise source
 *      colours (never closed-set here — Track B is a SCRUM-18 refinement)
 *   ② validate  THE MODEL'S JSON IS CHECKED WITH ZOD BEFORE IT DRIVES A PROMPT,
 *      then deduped and colour-sanity-checked (ADR-002 §4). A failure costs one
 *      targeted re-probe, and only one (doc 11 §4: "AI retries / picture: 1").
 *   ②b select   RANK the detected objects by prominence and take the argmax —
 *      ONE object is cartoonized (ADR-002 Amendment 3, 2026-10-19). Detection
 *      still returns up to three; only one is rendered.
 *   ③ generate  `fal-ai/nano-banana-2` text-to-image with the v3 template
 *   ④ cut out   `fal-ai/birefnet/v2` removes the painted rice-paper background
 *      and returns the TRANSPARENT WebP the caller actually stores (Amendment 2).
 *
 * Cost and latency are returned so the orchestrator can record them on
 * `cartoonize_jobs` (the spike's numbers live there in production — doc 07 §5.3).
 *
 * The API key is read from `Deno.env` HERE, inside the runtime. It is never
 * returned, never logged, and never reaches the client (doc 19 §4.4).
 */

import { z } from 'npm:zod@3';
import { falKey } from './env.ts';
import {
  COST_MICROS,
  CUTOUT_CONTENT_TYPE,
  CUTOUT_MODEL,
  CUTOUT_OPERATING_RESOLUTION,
  CUTOUT_OUTPUT_FORMAT,
  CUTOUT_VARIANT,
  GENERATE_MODEL,
  GENERATE_OUTPUT_FORMAT,
  IDENTIFY_MODEL,
  IDENTIFY_PROMPT,
  IDENTIFY_PROMPT_RETRY,
  MAX_OBJECTS,
  MAX_RETRIES,
  type IdentifiedObject,
  type RankedObject,
  colourLeak,
  colourNotes,
  costMicrosFor,
  dedupeObjects,
  prominenceOf,
  selectSubject,
  stylePrompt,
} from './pathtemplate.ts';

/**
 * THE VALIDATION GATE. Nothing derived from the model is trusted until it has
 * been through this schema — the spike's extraction was the weak link (a missed
 * notebook, ×4 duplicates, an echoed example colour).
 *
 * ⚠️ `prominence` IS ACCEPTED LOOSELY ON PURPOSE. It is an OPTIONAL hint that
 * only feeds the ranking, so a malformed one must NOT be able to fail the whole
 * answer and buy a ≈US$0.09 re-probe — `prominenceOf` drops anything that is not
 * a finite number and clamps the rest. `label` and `colours` stay strict: those
 * are the attributes the prompt is actually built from.
 */
export const IdentifySchema = z.object({
  objects: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(40),
        colours: z.array(z.string().trim().min(1).max(48)).min(1).max(4),
        count: z.number().int().min(1).max(20).optional(),
        prominence: z.union([z.number(), z.string()]).optional(),
      }),
    )
    .min(1)
    .max(MAX_OBJECTS),
});

/** Pull JSON out of a VLM's free text: fenced block, then outermost [..]/{..}. */
function extractJson(raw: string): unknown {
  const text = raw.trim();
  const candidates: string[] = [];

  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fence?.[1]) candidates.push(fence[1].trim());

  const openBracket = text.indexOf('[');
  const closeBracket = text.lastIndexOf(']');
  if (openBracket >= 0 && closeBracket > openBracket) {
    candidates.push(text.slice(openBracket, closeBracket + 1));
  }
  const openBrace = text.indexOf('{');
  const closeBrace = text.lastIndexOf('}');
  if (openBrace >= 0 && closeBrace > openBrace) {
    candidates.push(text.slice(openBrace, closeBrace + 1));
  }
  candidates.push(text);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next shape
    }
  }
  return null;
}

/**
 * Accept the shapes the spike actually produced. `moondream2` returns a STRING
 * (it is a VQA model, not JSON-mode), and the spike's answers looked like
 * `[["blue","sedan","4 doors","medium","metal"], …]` — which is valid JSON but
 * is not the object shape the pipeline wants, so it is normalised rather than
 * rejected.
 */
function normalise(parsed: unknown): unknown {
  if (Array.isArray(parsed)) {
    if (parsed.length > 0 && Array.isArray(parsed[0])) {
      return {
        objects: (parsed as unknown[][]).map((row) => {
          const parts = row.map((v) => String(v).trim()).filter((v) => v.length > 0);
          const [first, second] = parts;
          const colours = parts.filter((p) => /^[a-z][a-z\s-]*$/i.test(p) && p.split(/\s+/).length <= 3);
          return {
            label: second ?? first ?? 'object',
            colours: colours.length > 0 ? colours.slice(0, 2) : [first ?? 'unspecified'],
          };
        }),
      };
    }
    return { objects: parsed };
  }
  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>;
    if (Array.isArray(record.objects)) return record;
    if (Array.isArray(record.results)) return { objects: record.results };
    if (typeof record.label === 'string') return { objects: [record] };
  }
  return parsed;
}

export interface IdentifyParse {
  /** Non-null only when the answer passed every gate. */
  readonly objects: IdentifiedObject[] | null;
  /** Why it failed — logged, never shown to a user. */
  readonly reason: string;
}

/**
 * Parse + zod-validate + dedupe. `objects` is null when the answer cannot be
 * used — which the caller treats as a validation failure (and retries once).
 * The `reason` is what makes a production failure diagnosable without keeping
 * the model's text (which describes the user's photo) in a log.
 */
export function parseIdentify(raw: string): IdentifyParse {
  const parsed = extractJson(raw);
  if (parsed === null) {
    return { objects: null, reason: `no JSON found in ${raw.length} chars of output` };
  }

  const result = IdentifySchema.safeParse(normalise(parsed));
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join(' | ');
    return { objects: null, reason: `schema: ${issues}` };
  }

  // ⚠️ `prominence` goes through `prominenceOf`, not straight through: the
  // schema accepts a number OR a string (a VQA model often answers in prose), and
  // the ranking must never see a `NaN` or an out-of-range value. An unusable hint
  // is DROPPED — it is never a reason to spend a retry.
  const objects = dedupeObjects(
    result.data.objects.map((o) => {
      const prominence = prominenceOf(o.prominence);
      return {
        label: o.label,
        colours: o.colours,
        ...(o.count === undefined ? {} : { count: o.count }),
        ...(prominence === undefined ? {} : { prominence }),
      };
    }),
  );
  return objects.length > 0
    ? { objects, reason: '' }
    : { objects: null, reason: 'every object was deduped away' };
}

/** A fal error, carrying enough for the orchestrator to tell a refusal apart. */
export interface FalError extends Error {
  status?: number;
  moderation?: boolean;
  /**
   * What this run cost before it stopped — set by `runPathC` on every failure
   * AFTER a provider was called. The orchestrator records it on the job row:
   * a paid run whose spend is invisible is the failure the row exists to
   * prevent (doc 07 §5.3).
   */
  spent?: Spent;
}

/** The cost/latency a run had accrued when it stopped. */
export interface Spent {
  readonly costMicros: number;
  readonly latencyMs: number;
  readonly retries: number;
}

/** One synchronous fal call. `fal.run` returns the finished result directly. */
async function falRun(model: string, body: unknown): Promise<unknown> {
  const response = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Key ${falKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const error = new Error(`fal ${model} → ${response.status}: ${text.slice(0, 300)}`) as FalError;
    error.status = response.status;
    // Provider-side moderation (doc 13 §6): the capture is refused BEFORE any
    // stylization, and the caller marks it 'rejected' — no image is kept.
    if (/moderat|nsfw|safety|content policy|blocked/i.test(text)) error.moderation = true;
    throw error;
  }
  return await response.json();
}

export interface PathCResult {
  /**
   * The **TRANSPARENT** sprite Stage ④ produced — downloaded + re-uploaded by
   * the caller. This, and only this, is what belongs in the `styled` bucket.
   */
  readonly styledUrl: string;
  /**
   * The raw stylized frame BEFORE the cut: opaque, cream rice-paper background.
   * Kept so a failure downstream can be explained — **never stored as the
   * sprite** (it is the floating-card defect Amendment 2 exists to fix).
   */
  readonly generatedUrl: string;
  /**
   * ⚠️ THE ONE OBJECT THAT WAS CARTOONIZED (ADR-002 Amendment 3) — the argmax of
   * the prominence ranking, and the only thing `stylePrompt` ever saw. If a
   * sprite shows the wrong subject, this field is the receipt for what the
   * pipeline believed.
   */
  readonly subject: RankedObject;
  /**
   * Everything the identifier detected (≤3), RANKED, each carrying the `score`
   * and `probability` that placed it. Kept so a run can be explained after the
   * fact — ⚠️ only `subject` reaches the generator.
   */
  readonly objects: readonly RankedObject[];
  /** Extra identify attempts actually spent (0 or 1). */
  readonly retries: number;
  readonly costMicros: number;
  /** The itemised unit costs, so the job row explains the total. */
  readonly unitCostMicros: {
    readonly identify: number;
    readonly generate: number;
    readonly cutout: number;
  };
  /** The MIME type of the produced sprite (the bucket must allow it). */
  readonly contentType: string;
  /** The file extension to store it under — matches `contentType`. */
  readonly fileExtension: string;
  readonly latencyMs: number;
}

/**
 * Run identify → zod-validate → generate, with the single permitted retry.
 *
 * Throws an error carrying `code: 'extraction_unusable'` when the identifier
 * never produced usable attributes — the orchestrator records that on the job
 * and refunds, rather than feeding a garbage prompt to the generator.
 */
export async function runPathC(
  imageUrl: string,
  log: (message: string) => void,
): Promise<PathCResult> {
  const startedAt = Date.now();
  let retries = 0;
  let objects: IdentifiedObject[] | null = null;
  let lastReason = 'no attempt ran';

  /**
   * The conservative, BUDGETED cost of everything attempted so far — the same
   * unit the success path records, so an interrupted run cannot look cheaper
   * than the run it interrupted. Over-counting is the safe direction for the
   * daily stop-rule; an ABSENT line is not (doc 10 §4).
   */
  const spentSoFar = (): Spent => ({
    costMicros: costMicrosFor(retries),
    latencyMs: Date.now() - startedAt,
    retries,
  });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const prompt = attempt === 0 ? IDENTIFY_PROMPT : IDENTIFY_PROMPT_RETRY;
    const output = await falRun(IDENTIFY_MODEL, {
      image_url: imageUrl,
      prompt,
    }) as { output?: unknown };

    const raw = typeof output?.output === 'string' ? output.output : '';
    const parsed = parseIdentify(raw);

    if (!parsed.objects) {
      lastReason = parsed.reason;
      log(`identify attempt ${attempt + 1}: rejected — ${parsed.reason}`);
    } else {
      const leak = colourLeak(parsed.objects);
      if (leak) {
        lastReason = leak;
        log(`identify attempt ${attempt + 1}: rejected — ${leak}`);
      } else {
        for (const note of colourNotes(parsed.objects)) {
          log(`identify attempt ${attempt + 1}: note — ${note}`);
        }
        objects = parsed.objects;
        break;
      }
    }
    if (attempt < MAX_RETRIES) retries += 1;
  }

  if (!objects) {
    // The REASON travels with the error: it is what makes a production failure
    // diagnosable from the response, without keeping the model's text.
    const error = new Error(
      `extraction_unusable: the identifier did not return attributes that pass validation (${lastReason})`,
    ) as FalError & { code: string };
    error.code = 'extraction_unusable';
    // The identify calls were PAID FOR — carry the spend so the job row keeps it.
    error.spent = spentSoFar();
    throw error;
  }

  /**
   * ══ ②b SELECT — THE ANALYSIS THAT PICKS ONE OBJECT (ADR-002 Amendment 3) ══
   *
   * Everything above is DETECTION: the model may name up to three objects, and
   * the extra ones are genuinely useful — they are what tells us which one the
   * photograph is *about*. What changes here is that only the argmax is rendered.
   *
   * The ranking is LOGGED, with every candidate's probability, because the one
   * thing that must never happen is a silent substitution: if the sprite shows
   * the wrong subject, the log has to say what the pipeline believed and why.
   */
  const selection = selectSubject(objects);
  if (!selection) {
    const error = new Error(
      'extraction_unusable: the identifier returned no objects to rank',
    ) as FalError & { code: string };
    error.code = 'extraction_unusable';
    error.spent = spentSoFar();
    throw error;
  }
  const { subject, ranked } = selection;
  log(
    `subject: "${subject.label}" (${subject.probability.toFixed(2)})`
    + ` chosen from ${ranked.length} detected — `
    + ranked.map((o) => `"${o.label}" ${o.probability.toFixed(2)}`).join(', '),
  );

  // ══ ③ GENERATE + ④ CUT OUT — both are PAID, so both must report spend ════
  try {
    const generated = await falRun(GENERATE_MODEL, {
      prompt: stylePrompt(subject),
      num_images: 1,
      // ⚠️ The generator's container is an INTERMEDIATE now: stage ④ re-encodes
      // it, and the cutout's format is what gets stored. Kept webp anyway so the
      // intermediate is ~50 KB rather than ~1.3 MB.
      output_format: GENERATE_OUTPUT_FORMAT,
      resolution: '1K',                      // the honest cost/latency point (ADR-002 §1)
      safety_tolerance: '4',                 // the model default; provider moderation still runs
      limit_generations: true,
    }) as { images?: { url?: unknown }[] };

    const generatedUrl = generated?.images?.[0]?.url;
    if (typeof generatedUrl !== 'string' || generatedUrl.length === 0) {
      throw new Error('generate returned no image url');
    }

    /**
     * ④ THE CUTOUT (Amendment 2 — the measured evidence lives on `CUTOUT_MODEL`).
     *
     * ⚠️ WITHOUT THIS THE SPRITE IS AN OPAQUE CREAM CARD. The v3 template asks
     * for a "blank, warm rice-paper background"; the generator PAINTS it, so the
     * bytes arrive with no alpha and read as a rectangle floating over the live
     * camera (measured #F3EDD8 on glass, 2026-10-18). Asking the prompt for
     * transparency cannot fix it — a text-to-image model does not emit alpha —
     * so the generated frame is CUT, and the cut is what gets stored.
     *
     * ⚠️ A CUTOUT FAILURE IS A FAILURE, NOT A FALLBACK. Falling back to
     * `generatedUrl` would ship the exact defect being fixed while reporting
     * success; the capture stays `pending` and can be retried instead.
     */
    const cut = await falRun(CUTOUT_MODEL, {
      image_url: generatedUrl,
      model: CUTOUT_VARIANT,
      operating_resolution: CUTOUT_OPERATING_RESOLUTION,
      output_format: CUTOUT_OUTPUT_FORMAT,
      refine_foreground: true,
    }) as { image?: { url?: unknown } };

    const styledUrl = cut?.image?.url;
    if (typeof styledUrl !== 'string' || styledUrl.length === 0) {
      throw new Error('cutout returned no image url');
    }

    return {
      styledUrl,
      generatedUrl,
      subject,
      objects: ranked,
      retries,
      costMicros: costMicrosFor(retries),
      unitCostMicros: {
        identify: COST_MICROS.identify,
        generate: COST_MICROS.generate,
        cutout: COST_MICROS.cutout,
      },
      contentType: CUTOUT_CONTENT_TYPE,
      fileExtension: CUTOUT_OUTPUT_FORMAT,
      latencyMs: Date.now() - startedAt,
    };
  } catch (caught) {
    // EVERYTHING ABOVE WAS PAID FOR. Hand the spend to the caller with the
    // error, or a cutout failure would make US$0.09 vanish from the job row.
    const error = (caught instanceof Error ? caught : new Error(String(caught))) as FalError;
    error.spent = spentSoFar();
    throw error;
  }
}
