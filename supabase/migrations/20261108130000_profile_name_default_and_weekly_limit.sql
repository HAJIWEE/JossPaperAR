-- ══════════════════════════════════════════════════════════════════════════════
-- 20261108130000_profile_name_default_and_weekly_limit
--
-- ── WHY (owner, 2026-11-08 · SCRUM-223) ──────────────────────────────────────
-- *"I want the profile name to be defaulted to a simplified of the email address used to sign up with the
-- optional for the user to change it once every week."*
--
-- ⚠️ TODAY a fresh account has NO name: `chosen_name` is nullable (migration 20261108120000) and the Profile
-- screen renders its absence as a call to action — every person arrives nameless until they think of one.
--
-- ⚠️⚠️ **AND THE SIGN-UP PATH HERE IS NOT THE USUAL ONE.** This app is **anonymous-first** (ADR-004): a new
-- user is created with NO email, and the email arrives LATER when they sign in — an **UPDATE** on `auth.users`,
-- not an insert. ⚠️ So a default written only in `handle_new_user()` would never fire for the main journey.
-- Both paths are covered below, and the second one is the one that matters.
--
-- ── ⚠️ THE RULE LIVES HERE, IN SQL, AND NOWHERE ELSE ─────────────────────────
-- The client does NOT re-implement this: it reads `chosen_name` back and displays it. One implementation means
-- nothing to drift. (The 24-character limit IS in both places, deliberately — the client wants to stop a bad
-- value before a round trip. A *derivation* needs no such thing: the user never types it, so the client never
-- has to predict it.)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1 · the timestamp that makes the limit enforceable ───────────────────────
-- ⚠️ Nullable, and NULL means "never changed by the user" — the state of every existing row, and the state a
-- SERVER-SET default leaves it in. Only a user edit starts the clock.
alter table public.profiles
  add column if not exists name_changed_at timestamptz;

comment on column public.profiles.name_changed_at is
  'When the USER last changed chosen_name (SCRUM-223). NULL = never changed, which includes a name this migration DERIVED from the email — a default is not a choice, so it must not consume the once-a-week allowance. ⚠️ SERVER-OWNED: the BEFORE trigger overwrites whatever a client sends, because profiles_update_own is column-agnostic and would otherwise let anyone reset their own cooldown.';

-- ── 2 · THE SIMPLIFICATION — one function, one set of rules ─────────────────
-- `hajiwee94.11@gmail.com`  -> `Hajiwee94`   (drop the .11 tail, capitalise)
-- `gwee+work@example.com`   -> `Gwee`        (drop the +tag)
-- `张.伟@example.com`        -> `张伟`         (CJK names strip the Latin separators — see below)
-- `...@example.com`         -> NULL          (nothing to derive; the screen keeps its call to action)
create or replace function public.simplified_name_from_email(raw_email text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  local_part text;
  candidate  text;
begin
  if raw_email is null then
    return null;
  end if;

  -- everything before the LAST '@' — a quoted local part can contain one. ⚠️ The first version split the
  -- REVERSED string and took part 1, which yields the DOMAIN: `hajiwee94.11@example.com` derived `Example`.
  -- ⚠️ The test S1 caught it; a regexp that strips the final @domain cannot express that mistake.
  local_part := regexp_replace(btrim(raw_email), '@[^@]*$', '');
  -- drop a +tag: what follows '+' is routing, never a name
  local_part := btrim(split_part(local_part, '+', 1));

  if local_part = '' then
    return null;
  end if;

  -- ⚠️ CJK / kana / hangul: a dot between 陈 and 伟 is not "surname, given name" for splitting purposes — that
  -- is a Latin-address convention. ⚠️ But KEEPING it (`张.伟`) is not a name either, so the separators are
  -- REMOVED rather than split on: `张.伟` -> `张伟`. ⚠️ The first version kept the dot and test S1 caught it.
  if local_part ~ '[一-鿿ぁ-ヿ가-힯]' then
    candidate := regexp_replace(local_part, '[._\-·]', '', 'g');
  else
    -- the first segment carrying a LETTER: `john.smith99` -> `john`, never `99`
    select s into candidate
      from regexp_split_to_table(local_part, '[._-]+') as s
     where s ~ '[[:alpha:]]'
     limit 1;
    -- nothing had a letter (`94.11`): take the first non-empty segment rather than returning NULL
    if candidate is null then
      select s into candidate
        from regexp_split_to_table(local_part, '[._-]+') as s
       where s <> ''
       limit 1;
    end if;
  end if;

  if candidate is not null then
    -- strip punctuation from both ends (`_gwee_` -> `gwee`)
    candidate := regexp_replace(candidate, '^[^[:alnum:]]+|[^[:alnum:]]+$', '', 'g');
  end if;

  if candidate is null or candidate = '' then
    -- punctuation only — keep what there is rather than inventing a name
    candidate := btrim(left(local_part, 24));
  end if;
  if candidate = '' then
    return null;
  end if;

  -- capitalise the first character. ⚠️ `upper()` is a no-op on CJK, which is exactly right.
  candidate := upper(left(candidate, 1)) || substr(candidate, 2);

  -- ⚠️ `left()` counts CHARACTERS in Postgres, so it cannot split a UTF-8 sequence — and 24 is the same 24 the
  -- column's CHECK enforces, so a derived name always fits.
  return left(candidate, 24);
end;
$$;


-- ── 3 · BACKFILL — and ⚠️ IT MUST HAPPEN BEFORE THE LIMIT TRIGGER EXISTS ────
-- ⚠️⚠️ The trigger in §4 treats a changed `chosen_name` as a USER EDIT and starts the 7-day clock. Running this
-- backfill AFTER that trigger would lock every existing account out of changing its name for a week, for a
-- change nobody made. **The order is the safety**, and this comment is why it must not be reordered.
-- ⚠️ Only nameless rows are touched, so anyone who already chose a name keeps it.
update public.profiles p
   set chosen_name = public.simplified_name_from_email(u.email)
  from auth.users u
 where u.id = p.user_id
   and p.chosen_name is null
   and u.email is not null
   and public.simplified_name_from_email(u.email) is not null;

-- ── 4 · THE ONCE-A-WEEK LIMIT ───────────────────────────────────────────────
create or replace function public.enforce_name_change_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- ⚠️ INSERT: a name arriving with the row is the DEFAULT, not a choice. It starts no clock.
  if tg_op = 'INSERT' then
    new.name_changed_at := null;
    return new;
  end if;

  -- ⚠️ A server-side DEFAULT landing on an existing row (`apply_default_name_on_email`, §6) is not a user edit
  -- either — the caller raises this flag. Without it, the anonymous→email upgrade would spend the allowance
  -- before the person ever opened the screen.
  if coalesce(current_setting('joss.name_defaulted', true), 'off') = 'on' then
    new.name_changed_at := old.name_changed_at;
    return new;
  end if;

  -- ⚠️ THE TIMESTAMP IS SERVER-OWNED. `profiles_update_own` is column-agnostic, so without this branch a client
  -- could PATCH its own row setting `name_changed_at` back to NULL — and the cooldown would be advisory only.
  if new.chosen_name is not distinct from old.chosen_name then
    new.name_changed_at := old.name_changed_at;
    return new;
  end if;

  if old.name_changed_at is not null
     and now() < old.name_changed_at + interval '7 days' then
    -- ⚠️ The message is a KEY the client maps to a translated sentence, never a sentence: the app is bilingual
    -- and a database cannot know the reader's locale. `detail` carries the next allowed instant so the screen
    -- can say WHEN rather than just "no".
    raise exception 'name_change_too_soon'
      using errcode = 'P0001',
            detail = to_char(old.name_changed_at + interval '7 days', 'YYYY-MM-DD"T"HH24:MI:SSOF'),
            hint = 'The profile name can be changed once every 7 days.';
  end if;

  new.name_changed_at := now();
  return new;
end;
$$;

comment on function public.enforce_name_change_limit() is
  'Trigger: makes the profile name changeable once every 7 days (SCRUM-223), and keeps name_changed_at server-owned so a client PATCH cannot reset its own cooldown. ⚠️ Ignores server-set defaults — INSERT and the joss.name_defaulted flag start no clock — so a derived name does not cost the user their first change.';

drop trigger if exists enforce_name_change_limit on public.profiles;
create trigger enforce_name_change_limit
  before insert or update on public.profiles
  for each row execute function public.enforce_name_change_limit();

revoke execute on function public.enforce_name_change_limit() from public, anon, authenticated, service_role;

comment on function public.simplified_name_from_email(text) is
  'Derives a first-run profile name from an email address (SCRUM-223). ⚠️ The ONLY implementation — the client displays the stored value instead of re-deriving it. NULL when there is nothing to derive (anonymous user, empty local part); the Profile screen then keeps its "Add your name" call to action.';


-- ── 5 · the default at SIGN-UP (anonymous: no email yet, so NULL) ───────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (user_id, display_label, chosen_name)
  values (new.id, public.pseudonym_for(new.id), public.simplified_name_from_email(new.email))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated, service_role;

-- ── 6 · ⚠️ AND the default when the EMAIL ARRIVES — THE PATH THAT ACTUALLY RUNS ─
-- ⚠️⚠️ This is the anonymous→email upgrade (ADR-004). It is an **UPDATE** on `auth.users`, so §5 never fires —
-- without this trigger the feature would be dead for the app's main journey while looking implemented.
create or replace function public.apply_default_name_on_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  derived text;
begin
  -- only a transition INTO an address
  if new.email is null or new.email is not distinct from old.email then
    return new;
  end if;

  derived := public.simplified_name_from_email(new.email);
  if derived is null then
    return new;
  end if;

  -- ⚠️ Transaction-scoped, and read by `enforce_name_change_limit` (§4): this write is a DEFAULT, so it must
  -- not set name_changed_at. `is_local` is right here because a function body runs inside one transaction.
  perform set_config('joss.name_defaulted', 'on', true);

  update public.profiles
     set chosen_name = derived
   where user_id = new.id
     and chosen_name is null;   -- ⚠️ never overwrite a name the person chose

  perform set_config('joss.name_defaulted', 'off', true);
  return new;
end;
$$;

comment on function public.apply_default_name_on_email() is
  'Auth trigger: gives a profile its default name when an email reaches an account that had none — the anonymous-to-email upgrade, which handle_new_user cannot see because it is an UPDATE on auth.users, not an insert (ADR-004). Never overwrites a name the user chose.';

drop trigger if exists on_auth_user_email_set on auth.users;
create trigger on_auth_user_email_set
  after update of email on auth.users
  for each row execute function public.apply_default_name_on_email();

revoke execute on function public.apply_default_name_on_email() from public, anon, authenticated, service_role;

revoke execute on function public.simplified_name_from_email(text) from public, anon, authenticated, service_role;
