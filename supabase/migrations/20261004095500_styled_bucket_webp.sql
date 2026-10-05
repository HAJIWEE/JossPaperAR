-- ═══════════════════════════════════════════════════════════════════════════
-- 0010 · THE `styled` BUCKET ACCEPTS WebP — a MEASURED budget decision
--
-- doc 14 §3 budgets the styled sprite at **≤ 150 KB** ("transparent PNG at
-- display size, not 2K"). 0006 created the bucket with `image/png` and a
-- 153,600-byte limit, faithful to that sentence — and the first REAL Path C run
-- through the deployed orchestrator (2026-10-04) produced:
--
--   · 1K PNG  → 1,326,732 bytes (1.3 MB)   ✗ 8.6× over the budget
--   · 1K WebP →    50,900 bytes (49.7 KB)  ✓ 3× under the budget
--
-- same model, same prompt, same resolution — one output parameter. The budget is
-- the NFR; the CONTAINER was an assumption. WebP carries alpha (the sprite needs
-- it) and Android decodes it natively, so the bucket is widened to accept both
-- rather than narrowing the pipeline. The alternative (keep PNG, add a
-- resize/quantise stage) needs an image library the Deno Edge runtime does not
-- ship — a PR-4-sized change for no fidelity gain.
--
-- Recorded in doc 19 §12 and doc 14 §3's budget note.
-- ═══════════════════════════════════════════════════════════════════════════

-- ⚠️ The note is a plain SQL comment rather than `COMMENT ON`: the `storage`
-- schema is owned by Supabase, so `comment on column storage.buckets.…` fails
-- with "must be owner of relation buckets" (SQLSTATE 42501) — found by running
-- this migration, not by reading about it.

update storage.buckets
   set allowed_mime_types = array['image/webp', 'image/png']
 where id = 'styled';
