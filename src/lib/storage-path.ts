/**
 * storage-path.ts — the object KEY convention for the private buckets.
 *
 * PURE on purpose: it imports nothing, so the dependency-free `check:wire` can
 * assert the key shape without pulling in the native Supabase client (the same
 * reason `ritual-map.ts` is split from `ritual.ts`).
 *
 * ⚠️ THE KEYS ARE BUCKET-RELATIVE. The bucket is chosen by `.from('captures')`
 * and must NOT be repeated in the key. Getting that wrong is not cosmetic: the
 * bucket's own RLS policy scopes on `foldername(name)[1] = auth.uid()`, so a key
 * of `captures/{uid}/…` — with the bucket name baked in — is read as owner
 * `"captures"` and every upload is refused with `new row violates row-level
 * security policy`. Found on glass 2026-10-07, on the slice's first real run.
 */

/** `{userId}/{captureId}.jpg` — the key inside the private `captures` bucket. */
export function captureStoragePath(userId: string, captureId: string): string {
  return `${userId}/${captureId}.jpg`;
}
