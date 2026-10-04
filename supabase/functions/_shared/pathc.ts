/**
 * ── PATH C, THE ONLY CARTOONIZATION PIPELINE (ADR-002, PM-locked) ──────────
 *
 *   ① identify  `fal-ai/moondream2/visual-query`  ≤3 objects + precise source
 *      colours (never closed-set here — Track B is a SCRUM-18 refinement)
 *   ② validate  THE MODEL'S JSON IS CHECKED WITH ZOD BEFORE IT DRIVES A PROMPT,
 *      then deduped and colour-sanity-checked (ADR-002 §4). A failure costs one
 *      targeted re-probe, and only one (doc 11 §4: "AI retries / picture: 1").
 *   ③ generate  `fal-ai/nano-banana-2` text-to-image with the v3 template
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
  GENERATE_CONTENT_TYPE,
  GENERATE_MODEL,
  GENERATE_OUTPUT_FORMAT,
  IDENTIFY_MODEL,
  IDENTIFY_PROMPT,
  IDENTIFY_PROMPT_RETRY,
  MAX_OBJECTS,
  MAX_RETRIES,
  type IdentifiedObject,
  colourLeak,
  colourNotes,
  costMicrosFor,
  dedupeObjects,
  stylePrompt,
} from './pathtemplate.ts';

/**
 * THE VALIDATION GATE. Nothing derived from the model is trusted until it has
 * been through this schema — the spike's extraction was the weak link (a missed
 * notebook, ×4 duplicates, an echoed example colour).
 */
export const IdentifySchema = z.object({
  objects: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(40),
        colours: z.array(z.string().trim().min(1).max(48)).min(1).max(4),
        count: z.number().int().min(1).max(20).optional(),
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

  const objects = dedupeObjects(
    result.data.objects.map((o) =>
      o.count === undefined
        ? { label: o.label, colours: o.colours }
        : { label: o.label, colours: o.colours, count: o.count },
    ),
  );
  return objects.length > 0
    ? { objects, reason: '' }
    : { objects: null, reason: 'every object was deduped away' };
}

/** A fal error, carrying enough for the orchestrator to tell a refusal apart. */
export interface FalError extends Error {
  status?: number;
  moderation?: boolean;
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
  /** Where fal parked the generated sprite (downloaded + re-uploaded by the caller). */
  readonly styledUrl: string;
  /** The validated attributes, kept so a run can be explained after the fact. */
  readonly objects: readonly IdentifiedObject[];
  /** Extra identify attempts actually spent (0 or 1). */
  readonly retries: number;
  readonly costMicros: number;
  /** The itemised unit costs, so the job row explains the total. */
  readonly unitCostMicros: { readonly identify: number; readonly generate: number };
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
    ) as Error & { code: string };
    error.code = 'extraction_unusable';
    throw error;
  }

  const generated = await falRun(GENERATE_MODEL, {
    prompt: stylePrompt(objects),
    num_images: 1,
    output_format: GENERATE_OUTPUT_FORMAT, // WebP — 49.7 KB vs PNG's 1.3 MB (measured)
    resolution: '1K',                      // the honest cost/latency point (ADR-002 §1)
    safety_tolerance: '4',                 // the model default; provider moderation still runs
    limit_generations: true,
  }) as { images?: { url?: unknown }[] };

  const styledUrl = generated?.images?.[0]?.url;
  if (typeof styledUrl !== 'string' || styledUrl.length === 0) {
    throw new Error('generate returned no image url');
  }

  return {
    styledUrl,
    objects,
    retries,
    costMicros: costMicrosFor(retries),
    unitCostMicros: { identify: COST_MICROS.identify, generate: COST_MICROS.generate },
    contentType: GENERATE_CONTENT_TYPE,
    fileExtension: GENERATE_OUTPUT_FORMAT,
    latencyMs: Date.now() - startedAt,
  };
}
