-- ═══════════════════════════════════════════════════════════════════════════
-- 0006 · STORAGE BUCKETS + THE SIGN-IN PROFILE BOOTSTRAP (SCRUM-54b / PR-3)
--
-- Both halves of this file fix holes that were VERIFIED against the live
-- project on 2026-10-04, not assumed:
--
--  1. ⚠️ THE BUCKETS DID NOT EXIST. `select * from storage.buckets` returned
--     ZERO rows on yercgevebxvtzkgctfai, although the hand-off notes claimed
--     `captures` + `styled` were live. The slice schema migration (0001) is
--     tables/RLS only — it never created them. Without `styled` the
--     orchestrator has nowhere to write a sprite; without `captures` the app
--     cannot upload a photo. Created here at the limits doc 19 §3.3 states.
--
--  2. ⚠️ NOTHING CREATED A `profiles` ROW. There is no `handle_new_user`
--     trigger, and every money/AI table FKs to `profiles` — so a brand-new
--     anonymous sign-in (the ADR-004 first-run path, and the slice's whole
--     premise) could not burn, upload or request anything. Fixed with the
--     standard auth trigger, made safe the hard way: SECURITY DEFINER with
--     EXECUTE revoked from every client role, because a trigger does not need
--     the grant and must never be callable at /rest/v1/rpc/ (traps #1 + 0003).
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ THE TWO PRIVATE BUCKETS ═══════════════════════════════════════════════
-- Private (`public = false`): every read goes through a signed URL or RLS
-- (doc 07 §3). Sized to the NFR budget — capture ≤ 300 KB, sprite ≤ 150 KB
-- (doc 14 §3) — and MIME-restricted so the bucket itself refuses a surprise.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('captures', 'captures', false, 307200, array['image/jpeg']),
  ('styled',   'styled',   false, 153600, array['image/png'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ═══ STORAGE OBJECT RLS — the path IS the permission ══════════════════════
-- Objects live at `{bucket}/{user_id}/{capture_id}` (doc 19 §3.3), so the
-- first path segment must equal the caller's uid. There is deliberately NO
-- policy for the other buckets, and no cross-user read anywhere.
--
-- captures: the app uploads its own raw photo and reads it back.
drop policy if exists captures_upload_own on storage.objects;
create policy captures_upload_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'captures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists captures_read_own on storage.objects;
create policy captures_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'captures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- styled: WRITE belongs to the orchestrator (service role, which bypasses RLS);
-- the client may only READ its own sprite.
drop policy if exists styled_read_own on storage.objects;
create policy styled_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'styled'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ═══ THE SIGN-IN BOOTSTRAP ════════════════════════════════════════════════
-- Every sign-in — anonymous or upgraded — gets a profile, in the same
-- transaction as the auth row. The label is the deterministic pseudonym the
-- league shows, never an ancestor name (doc 13 §4).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (user_id, display_label)
  values (new.id, public.pseudonym_for(new.id))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- A trigger fires with the table owner's privileges, so NO client role needs
-- EXECUTE — and revoking it keeps the function off the Data API entirely.
revoke execute on function public.handle_new_user() from public, anon, authenticated, service_role;

comment on function public.handle_new_user() is
  'Auth trigger: creates the profiles row on sign-in (ADR-004 anonymous-first). TRIGGER function — not callable by any role; triggers fire as the table owner.';
comment on table public.profiles is
  'One row per auth user, created by the on_auth_user_created trigger (0006). display_label is the league pseudonym — NEVER the ancestor name (doc 13 §4).';
