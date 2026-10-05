-- ═══════════════════════════════════════════════════════════════════════════
-- 0005 · THE APP SURFACE — the other ten RPCs (SCRUM-54b / PR-3, doc 19 §3.2)
--
-- Read alongside 0004 (`submit_burn`, the spine). Two design rules govern
-- WHICH function is allowed to be elevated, because `get_advisors` measures it:
--
--   RULE A — THE MONEY PATH IS service_role ONLY.
--     `submit_burn` (0004) and `request_cartoonize` are SECURITY DEFINER with
--     EXECUTE granted ONLY to `service_role`, so they are reachable only from an
--     Edge Function holding the secret key. Zero new advisor findings, and
--     "award-service is the only writer of money" is true BY GRANT (ADR-005 §4).
--
--   RULE B — A CLIENT-CALLABLE RPC PREFERS SECURITY INVOKER.
--     `get_league_board`, `create_clan`, `reroll_clan_code`, `save_ancestor`
--     and `equip_decoration` run as the CALLER, with the access granted by RLS
--     policies added below. They add no advisor finding at all.
--     Only four functions genuinely cannot work that way — `preview_clan` and
--     `join_clan` (a code must be resolvable by a NON-member), `purchase_item`
--     (it writes the append-only ledger) and `delete_my_data` (it deletes
--     tables no client role may delete) — and those four take the one finding
--     the baseline already carries for the RLS helpers. Reported, not hidden.
--
-- Applied to the hosted project yercgevebxvtzkgctfai (ap-southeast-1).
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ PURE HELPERS (no table access → safe as INVOKER, no advisor finding) ══
-- The pseudonym the league shows. NEVER an ancestor name (doc 13 §4) — it is a
-- deterministic handle derived from the uid. The exact shape is a PM-confirmable
-- detail (like the House price), not a locked number.
create or replace function public.pseudonym_for(p_uid uuid)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$ select 'devotee-' || left(replace(p_uid::text, '-', ''), 6) $$;

-- The invite capability: 8 chars, alphabet WITHOUT 0/O and 1/I/L — it must match
-- the `clans.code` CHECK exactly, and be human-typable (doc 07 §4.6).
create or replace function public.new_clan_code()
returns text
language sql
volatile
set search_path = public, pg_temp
as $$
  select string_agg(
           substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789',
                  1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 8);
$$;

-- The six named slots and their categories — the SQL twin of SLOT_CATEGORY in
-- src/domain/catalogue.ts (S14j/S14k). NULL for anything not a real slot.
create or replace function public.slot_category_of(p_slot text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_slot
    when 'top_left'   then 'top'
    when 'top_middle' then 'top'
    when 'top_right'  then 'top'
    when 'side_left'  then 'side'
    when 'side_right' then 'side'
    when 'background' then 'background'
    else null
  end;
$$;

-- Bootstrap safety: a sign-in that predates the auth trigger (migration 0006)
-- still gets a profile. DEFINER because it must work for the service role too.
create or replace function public.ensure_profile(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_uid is null then return; end if;
  insert into public.profiles (user_id, display_label)
  values (p_uid, public.pseudonym_for(p_uid))
  on conflict (user_id) do nothing;
end;
$$;

-- ═══ request_cartoonize — the quota gate, called by the ORCHESTRATOR ═══════
-- doc 07 §4.2 step 3 / doc 10 §4 / doc 19 §3.2. The orchestrator has already
-- verified the caller's JWT and passes p_actor. RULE A: service_role only.
--
-- ⚠️ SCOPE NOTE (recorded as a PR finding): doc 10 §4's funding model — the
-- 150-credit photo fee, the 2,000-credit starter grant, the 15/month free cap,
-- the global AI-budget stop-rule — is NOT enforced here. None of those
-- mechanisms exist yet (no cash shop, no grant flow, no budget table), so
-- enforcing them would make the slice unusable. What IS enforced is the daily
-- photo allowance (10/day) and the burst rate limit (3/min), which is the part
-- the slice needs. The rest is a follow-up (SCRUM-18/ADR-006 territory).
create or replace function public.request_cartoonize(p_actor uuid, p_capture_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_photo_jobs_day constant integer := 10;   -- doc 10 §1 (photo burns / day)
  c_req_per_min    constant integer := 3;    -- doc 11 §5
  v_day   date := public.burn_day();
  v_job   public.cartoonize_jobs;
  v_today integer;
begin
  if p_actor is null then
    raise exception 'request_cartoonize requires an authenticated actor' using errcode = '42501';
  end if;
  perform public.ensure_profile(p_actor);

  perform pg_advisory_xact_lock(hashtextextended(p_actor::text, 0));

  -- ONE JOB PER CAPTURE (unique(capture_id)) — a retry cannot pay twice
  select * into v_job from public.cartoonize_jobs where capture_id = p_capture_id;
  if found then
    if not exists (select 1 from public.captures where id = p_capture_id and user_id = p_actor) then
      raise exception 'capture % does not belong to the actor', p_capture_id using errcode = '42501';
    end if;
    return jsonb_build_object(
      'job_id', v_job.id, 'status', v_job.status,
      'idempotent_replay', true, 'already_requested', true
    );
  end if;

  if not exists (
    select 1 from public.captures
    where id = p_capture_id and user_id = p_actor and status = 'pending'
  ) then
    raise exception 'capture % is not a pending capture owned by the actor', p_capture_id
      using errcode = '42501';
  end if;

  if not public.rate_limit_allow(p_actor, 'request_cartoonize', c_req_per_min) then
    raise exception 'the shrine is busy — try again in a moment' using errcode = 'P0001';
  end if;

  select count(*) into v_today
    from public.cartoonize_jobs j
    join public.captures c on c.id = j.capture_id
   where c.user_id = p_actor and (j.created_at at time zone 'utc')::date = v_day;

  if v_today >= c_photo_jobs_day then
    raise exception 'daily photo allowance is complete' using errcode = 'P0001';
  end if;

  insert into public.cartoonize_jobs (capture_id, provider, style, status)
  values (p_capture_id, 'fal', 'D', 'queued')
  returning * into v_job;

  return jsonb_build_object(
    'job_id', v_job.id, 'status', v_job.status,
    'idempotent_replay', false, 'already_requested', false
  );
end;
$$;

-- ═══ get_league_board — SECURITY INVOKER (RULE B) ══════════════════════════
-- doc 07 §4.4: the board is DERIVED from SUM(weekly tribute), never a stored
-- mutable score. ⚠️ The league tables (`league_weeks`/`cohorts`/`cohort_members`)
-- are deliberately NOT in the slice schema — they arrive with SCRUM-11 — so
-- this returns the caller's OWN weekly tribute (readable under RLS) and an
-- empty public board. It is an honest stub, not a fake ranking.
create or replace function public.get_league_board()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_start date := date_trunc('week', now())::date;   -- ISO week, Monday
  v_end   date := (date_trunc('week', now()) + interval '6 days')::date;
  v_uid   uuid := auth.uid();
  v_pts   bigint;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select coalesce(sum(amount), 0) into v_pts
    from public.ledger_events
   where user_id = v_uid
     and currency = 'tribute'
     and type = 'award'
     and created_at >= (v_start::timestamp at time zone 'utc');

  return jsonb_build_object(
    'week_start',       v_start,
    'week_end',         v_end,
    'cohort_id',        null,
    'rows',             '[]'::jsonb,
    'my_weekly_points', v_pts,
    'note',             'league cohorts arrive with SCRUM-11'
  );
end;
$$;

-- ═══ create_clan — SECURITY INVOKER (RULE B) ═══════════════════════════════
-- doc 15 §4.2: four taps to head. Allowed by RLS: `clans_insert_self` for the
-- clan and `clan_members_insert_head_of_own_clan` (added below) for the head
-- row. The code collision is resolved by RETRY, because an INVOKER function
-- cannot see other clans (and should not be able to).
create or replace function public.create_clan(p_name text)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  c_tries   constant integer := 5;
  v_uid     uuid := auth.uid();
  v_name    text := btrim(coalesce(p_name, ''));
  v_clan_id uuid;
  v_code    text;
  v_cap     smallint;
  i         integer;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 20 then
    raise exception 'clan name must be 2..20 characters' using errcode = '22023';
  end if;

  -- the caller's own profile (idempotent), so a pre-trigger sign-in still works
  insert into public.profiles (user_id, display_label)
  values (v_uid, public.pseudonym_for(v_uid))
  on conflict (user_id) do nothing;

  for i in 1..c_tries loop
    v_code := public.new_clan_code();
    begin
      insert into public.clans (name, code, created_by)
      values (v_name, v_code, v_uid)
      returning id, ancestor_cap into v_clan_id, v_cap;
      exit;                                  -- inserted: done
    exception when unique_violation then
      v_clan_id := null;                     -- code collision: roll another
    end;
  end loop;

  if v_clan_id is null then
    raise exception 'could not allocate an invite code — try again' using errcode = 'P0001';
  end if;

  insert into public.clan_members (clan_id, user_id, role)
  values (v_clan_id, v_uid, 'head');

  return jsonb_build_object(
    'clan_id', v_clan_id, 'name', v_name, 'code', v_code, 'role', 'head',
    'ancestor_cap', v_cap, 'ancestor_count', 0, 'member_count', 1
  );
end;
$$;

-- ═══ preview_clan — SECURITY DEFINER (RULE B's named exceptions) ═══════════
-- The code must resolve for a NON-member, so RLS cannot be the access model
-- here; this function is the gate. It returns the name, the counts and whether
-- the caller is already in — and NEVER an ancestor name before joining
-- (doc 13 §4 · doc 15 §4.3).
create or replace function public.preview_clan(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_per_min constant integer := 20;   -- provisional; the SCRUM-46 numbers win (§5.2)
  v_uid  uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_clan public.clans;
  v_anc  integer;
  v_mem  integer;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  perform public.ensure_profile(v_uid);

  if v_code !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$' then
    return jsonb_build_object('found', false, 'reason', 'malformed_code');
  end if;

  if not public.rate_limit_allow(v_uid, 'preview_clan', c_per_min) then
    raise exception 'the shrine is busy — try again in a moment' using errcode = 'P0001';
  end if;

  select * into v_clan from public.clans where code = v_code and archived_at is null;
  if not found then
    return jsonb_build_object('found', false, 'reason', 'unknown_or_revoked_code');
  end if;

  select count(*) into v_anc from public.ancestors
   where clan_id = v_clan.id and archived_at is null;
  select count(*) into v_mem from public.clan_members where clan_id = v_clan.id;

  return jsonb_build_object(
    'found',          true,
    'clan_id',        v_clan.id,
    'name',           v_clan.name,
    'ancestor_count', v_anc,
    'member_count',   v_mem,
    'ancestor_cap',   v_clan.ancestor_cap,
    'is_member',      exists (
                        select 1 from public.clan_members
                        where clan_id = v_clan.id and user_id = v_uid
                      )
  );
end;
$$;

-- ═══ join_clan — SECURITY DEFINER (same reason as preview) ════════════════
-- doc 15 §4.3: no approval queue. A valid code joins instantly; a bad, revoked
-- or already-used one fails loudly.
create or replace function public.join_clan(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_per_min constant integer := 10;   -- provisional (SCRUM-46 owns the numbers)
  v_uid  uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_clan public.clans;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  perform public.ensure_profile(v_uid);

  if v_code !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$' then
    raise exception 'that invite code is not valid' using errcode = '22023';
  end if;

  if not public.rate_limit_allow(v_uid, 'join_clan', c_per_min) then
    raise exception 'the shrine is busy — try again in a moment' using errcode = 'P0001';
  end if;

  select * into v_clan from public.clans where code = v_code and archived_at is null;
  if not found then
    raise exception 'that invite code is not valid' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.clan_members where clan_id = v_clan.id and user_id = v_uid
  ) then
    raise exception 'already a member of this clan' using errcode = '23505';
  end if;

  insert into public.clan_members (clan_id, user_id, role)
  values (v_clan.id, v_uid, 'member');

  return jsonb_build_object(
    'joined',         true,
    'clan_id',        v_clan.id,
    'name',           v_clan.name,
    'role',           'member',
    'ancestor_count', (
      select count(*) from public.ancestors
      where clan_id = v_clan.id and archived_at is null
    ),
    'member_count',   (
      select count(*) from public.clan_members where clan_id = v_clan.id
    )
  );
end;
$$;

-- ═══ reroll_clan_code — SECURITY INVOKER (RULE B) ═════════════════════════
-- doc 07 §4.6: one active code per clan, re-rollable by a head. The
-- `clans_update_head` policy already gates the write; the ladder is asserted
-- first so a refusal is a clean error, not a silently-empty UPDATE.
create or replace function public.reroll_clan_code(p_clan_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  c_tries constant integer := 5;
  v_uid   uuid := auth.uid();
  v_code  text;
  v_out   text;
  v_name  text;
  v_done  boolean := false;
  i       integer;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_clan_id is null then
    raise exception 'clan_id is required' using errcode = '22023';
  end if;
  if not public.is_clan_head(p_clan_id) then
    raise exception 'only a clan head may re-roll the invite code' using errcode = '42501';
  end if;

  for i in 1..c_tries loop
    v_code := public.new_clan_code();
    begin
      update public.clans set code = v_code
       where id = p_clan_id
       returning code, name into v_out, v_name;
      v_done := true;
      exit;
    exception when unique_violation then
      null;                                  -- collision: roll another
    end;
  end loop;

  if not v_done then
    raise exception 'could not allocate an invite code — try again' using errcode = 'P0001';
  end if;

  return jsonb_build_object('clan_id', p_clan_id, 'name', v_name, 'code', v_out);
end;
$$;

-- ═══ save_ancestor — SECURITY INVOKER (RULE B) ════════════════════════════
-- doc 07 §4.5 (v2.9) / doc 15 §6: the cap is the CLAN's (`clans.ancestor_cap`,
-- default 10) and is enforced by the `ancestors_enforce_cap` TRIGGER — not by
-- this function. The ladder check here is the friendly refusal; the RLS
-- policies added below are the actual gate.
create or replace function public.save_ancestor(
  p_clan_id      uuid,
  p_surname      text,
  p_given_name   text     default null,
  p_relationship text     default null,
  p_slot         smallint default null,
  p_ancestor_id  uuid     default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_role public.clan_role;
  v_slot smallint := p_slot;
  v_row  public.ancestors;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_clan_id is null then
    raise exception 'clan_id is required' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_surname, ''))) not between 1 and 20 then
    raise exception 'surname must be 1..20 characters' using errcode = '22023';
  end if;

  -- the ladder (doc 15 §3): add/edit tablets = head, co-head, elder
  v_role := public.clan_role_of(p_clan_id);
  if v_role is null then
    raise exception 'the caller is not a member of clan %', p_clan_id using errcode = '42501';
  end if;
  if v_role not in ('head', 'co_head', 'elder') then
    raise exception 'members may not add or edit tablets' using errcode = '42501';
  end if;

  if p_ancestor_id is null and v_slot is null then
    select s into v_slot
      from generate_series(0, 9) s
     where not exists (
             select 1 from public.ancestors a
              where a.clan_id = p_clan_id and a.slot = s and a.archived_at is null
           )
     order by s
     limit 1;
  end if;

  if v_slot is not null and exists (
    select 1 from public.ancestors
     where clan_id = p_clan_id and slot = v_slot and archived_at is null
       and (p_ancestor_id is null or id <> p_ancestor_id)
  ) then
    raise exception 'altar slot % is already taken', v_slot using errcode = '23505';
  end if;

  if p_ancestor_id is null then
    if v_slot is null then
      raise exception 'no altar slot is free in this clan' using errcode = 'P0001';
    end if;
    insert into public.ancestors (clan_id, surname, given_name, relationship, slot)
    values (
      p_clan_id, btrim(p_surname),
      nullif(btrim(coalesce(p_given_name, '')), ''),
      nullif(btrim(coalesce(p_relationship, '')), ''),
      v_slot
    )
    returning * into v_row;
  else
    update public.ancestors
       set surname      = btrim(p_surname),
           given_name   = nullif(btrim(coalesce(p_given_name, '')), ''),
           relationship = nullif(btrim(coalesce(p_relationship, '')), ''),
           slot         = coalesce(v_slot, slot)
     where id = p_ancestor_id and clan_id = p_clan_id
     returning * into v_row;
    if not found then
      raise exception 'tablet % is not in clan %', p_ancestor_id, p_clan_id
        using errcode = '42501';
    end if;
  end if;

  return jsonb_build_object(
    'ancestor_id', v_row.id, 'clan_id', v_row.clan_id,
    'surname', v_row.surname, 'given_name', v_row.given_name,
    'relationship', v_row.relationship, 'slot', v_row.slot
  );
end;
$$;

-- ═══ purchase_item — SECURITY DEFINER (writes the append-only ledger) ═════
-- doc 07 §4.5 / §5.1.6 / doc 10 §3. The CLIENT asserts only the INTENT (the
-- item code). The PRICE is re-read here from the catalogue tables, so a
-- tampered client cannot set its own price; the debit is a `purchase` row and
-- the S13d 20% accrual is an `accrual` row — both written by a service path.
--
-- ⚠️ SCOPE NOTES (PR findings): (a) the catalogue's DECORATION prices are NULL
-- by design (no doc prices them), so a decoration purchase fails loudly with
-- "no price yet" rather than inventing one; (b) the debit currency is `tribute`
-- (doc 10 §3: "tribute out — store redemption"), and the accrual lands in
-- `store` — the two-currency split of S13d, recorded here because the spec is
-- terse about which wallet pays.
create or replace function public.purchase_item(p_item_code text, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_per_min      constant integer := 5;     -- doc 11 §5
  c_accrual_rate constant numeric := 0.2;   -- S13d — the Store-Point accrual
  v_uid     uuid := auth.uid();
  v_key     text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_code    text := btrim(coalesce(p_item_code, ''));
  v_price   integer;
  v_kind    text;
  v_balance bigint;
  v_accrual integer;
  v_seq     bigint;
  v_ref     public.ledger_events;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  perform public.ensure_profile(v_uid);
  if v_key is null or char_length(v_key) < 8 or char_length(v_key) > 200 then
    raise exception 'idempotency_key must be 8..200 characters' using errcode = '22023';
  end if;

  -- REPLAY: the ledger's UNIQUE(idempotency_key) is the memory (doc 14 N6).
  select * into v_ref from public.ledger_events where idempotency_key = v_key;
  if found then
    if v_ref.user_id <> v_uid then
      insert into public.integrity_flags (user_id, signal, severity, evidence)
      values (v_uid, 'idempotency_key_reuse', 3,
              jsonb_build_object('key', v_key, 'owner', v_ref.user_id));
      raise exception 'idempotency key already used by another account' using errcode = '23505';
    end if;
    select coalesce(sum(amount), 0) into v_balance from public.balances
      where user_id = v_uid and currency = 'tribute';
    return jsonb_build_object(
      'item_code', v_code, 'balance', v_balance, 'idempotent_replay', true
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  if not public.rate_limit_allow(v_uid, 'purchase_item', c_per_min) then
    raise exception 'the shrine is busy — try again in a moment' using errcode = 'P0001';
  end if;

  -- THE PRICE IS RE-READ SERVER-SIDE — decorations first (permanent), offerings second.
  select d.price into v_price from public.decorations_catalog d where d.code = v_code;
  if found then
    v_kind := 'decoration';
  else
    select o.price into v_price from public.offerings_catalog o where o.code = v_code;
    if found then v_kind := 'offering'; end if;
  end if;

  if v_kind is null then
    raise exception 'unknown item: %', v_code using errcode = '22023';
  end if;
  if v_price is null then
    raise exception 'item % has no price yet — the economy pass has not priced it',
      v_code using errcode = 'P0001';
  end if;

  select coalesce(sum(amount), 0) into v_balance from public.balances
    where user_id = v_uid and currency = 'tribute';
  if v_balance < v_price then
    raise exception 'not enough tribute: % needed, % available', v_price, v_balance
      using errcode = 'P0001';
  end if;

  select coalesce(max(seq), 0) + 1 into v_seq
    from public.ledger_events where user_id = v_uid;

  insert into public.ledger_events (
    user_id, seq, currency, type, amount, ref_type, actor, idempotency_key
  ) values (
    v_uid, v_seq, 'tribute', 'purchase', -v_price, 'item', 'store', v_key
  );

  v_accrual := floor(v_price * c_accrual_rate)::integer;
  if v_accrual > 0 then
    insert into public.ledger_events (
      user_id, seq, currency, type, amount, ref_type, actor, idempotency_key
    ) values (
      v_uid, v_seq + 1, 'store', 'accrual', v_accrual, 'item', 'store', v_key || ':accrual'
    );
  end if;

  insert into public.inventory (user_id, item_code, qty, acquired_via)
  values (v_uid, v_code, 1, 'purchase')
  on conflict (user_id, item_code) do update set qty = public.inventory.qty + 1;

  select coalesce(sum(amount), 0) into v_balance from public.balances
    where user_id = v_uid and currency = 'tribute';

  return jsonb_build_object(
    'item_code', v_code, 'kind', v_kind, 'price', v_price,
    'currency', 'tribute', 'accrual', v_accrual,
    'balance', v_balance, 'idempotent_replay', false
  );
end;
$$;

-- ═══ equip_decoration — SECURITY INVOKER (RULE B) ═════════════════════════
-- doc 07 §4.5 / S14j / S14k: the six named slots, three categories, and ONE
-- SET PER CATEGORY displayed at a time. Equipping REPLACES the set in that
-- category. The rule is also enforced in the database by the trigger below, so
-- a direct client INSERT cannot break it.
create or replace function public.equip_decoration(p_slot text, p_item_code text)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_slot     text := btrim(coalesce(p_slot, ''));
  v_code     text := btrim(coalesce(p_item_code, ''));
  v_cat      text := public.slot_category_of(v_slot);
  v_item_cat text;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if v_cat is null then
    raise exception 'unknown slot: %', v_slot using errcode = '22023';
  end if;

  select d.slot_category::text into v_item_cat
    from public.decorations_catalog d where d.code = v_code;
  if v_item_cat is null then
    raise exception 'unknown decoration: %', v_code using errcode = '22023';
  end if;
  if v_item_cat <> v_cat then
    raise exception 'decoration % is a % piece — it cannot go in the % slot',
      v_code, v_item_cat, v_cat using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.inventory
    where user_id = v_uid and item_code = v_code and qty >= 1
  ) then
    raise exception 'decoration % is not owned', v_code using errcode = '42501';
  end if;

  -- S14k — equipping a set CLEARS the other slot of the same category
  delete from public.equipped_decorations
   where user_id = v_uid
     and slot <> v_slot
     and public.slot_category_of(slot) = v_cat;

  insert into public.equipped_decorations (user_id, slot, item_code)
  values (v_uid, v_slot, v_code)
  on conflict (user_id, slot) do update
    set item_code = excluded.item_code, equipped_at = now();

  return jsonb_build_object(
    'slot', v_slot, 'item_code', v_code, 'category', v_cat,
    'equipped', (
      select coalesce(
               jsonb_agg(jsonb_build_object('slot', e.slot, 'item_code', e.item_code)
                         order by e.slot),
               '[]'::jsonb)
        from public.equipped_decorations e where e.user_id = v_uid
    )
  );
end;
$$;

-- The same rule, enforced where it cannot be bypassed (S14k). Runs INVOKER, so
-- no EXECUTE grant is needed by anyone — and a trigger fires regardless.
create or replace function public.enforce_one_set_per_category()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_cat      text;
  v_item_cat text;
begin
  v_cat := case new.slot
    when 'top_left'   then 'top'
    when 'top_middle' then 'top'
    when 'top_right'  then 'top'
    when 'side_left'  then 'side'
    when 'side_right' then 'side'
    when 'background' then 'background'
    else null
  end;
  if v_cat is null then
    raise exception 'unknown slot: %', new.slot using errcode = '23514';
  end if;

  select d.slot_category::text into v_item_cat
    from public.decorations_catalog d where d.code = new.item_code;
  if v_item_cat is null then
    raise exception 'unknown decoration: %', new.item_code using errcode = '23503';
  end if;
  if v_item_cat <> v_cat then
    raise exception 'decoration % is a % piece — it cannot go in the % slot',
      new.item_code, v_item_cat, v_cat using errcode = '23514';
  end if;

  if exists (
    select 1 from public.equipped_decorations e
     where e.user_id = new.user_id
       and e.slot <> new.slot
       and (case e.slot
              when 'top_left'   then 'top'
              when 'top_middle' then 'top'
              when 'top_right'  then 'top'
              when 'side_left'  then 'side'
              when 'side_right' then 'side'
              when 'background' then 'background'
              else null
            end) = v_cat
  ) then
    raise exception 'only one set per category may be displayed (S14k)'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger equipped_enforce_one_set_per_category
  before insert or update on public.equipped_decorations
  for each row execute function public.enforce_one_set_per_category();

-- ═══ delete_my_data — SECURITY DEFINER (RULE B's exceptions) ══════════════
-- doc 13 §8/§9 (ADR-007 §7): one tap, immediate hard delete, one confirmation.
-- Children first, exactly as the runbook prescribes. Counts come back as a
-- receipt, and the function VERIFIES its own work (0 rows is the success
-- condition — a non-zero probe is a bug, not a user problem).
--
-- ⚠️ TWO THINGS THIS FUNCTION DOES **NOT** DO, recorded rather than hidden:
--   1. It does not delete the STORAGE objects. Deleting `storage.objects` rows
--      from SQL would orphan the S3 bytes; only the Storage API removes them.
--      The receipt returns the prefixes to purge with the service key.
--   2. It does not delete the `auth.users` row (that needs the Admin API). The
--      profile cascades away, so the account is empty, but a re-sign-in would
--      reuse the same uid. Both are follow-up items (SCRUM-33/53).
create or replace function public.delete_my_data()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_counts jsonb := '{}'::jsonb;
  v_n      integer;
  v_flags  integer;
  v_left   integer := 0;
  v_t      text;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  -- doc 13 §9.1 — 1 attempt / 10 min / user
  if exists (
    select 1 from public.rate_counters
     where user_id = v_uid and endpoint = 'delete_my_data'
       and window_start >= date_trunc('minute', now() - interval '10 minutes')
  ) then
    raise exception 'a delete was already attempted recently — try again in ten minutes'
      using errcode = 'P0001';
  end if;
  insert into public.rate_counters (user_id, endpoint, window_start, n)
  values (v_uid, 'delete_my_data', date_trunc('minute', now()), 1);

  -- ── children first (doc 13 §9.4) ─────────────────────────────────────────
  delete from public.equipped_decorations where user_id = v_uid;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('equipped_decorations', v_n);

  delete from public.inventory where user_id = v_uid;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('inventory', v_n);

  delete from public.cartoonize_jobs
   where capture_id in (select id from public.captures where user_id = v_uid);
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('cartoonize_jobs', v_n);

  delete from public.tributes where user_id = v_uid;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('tributes', v_n);

  delete from public.burns where user_id = v_uid;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('burns', v_n);

  delete from public.ledger_events where user_id = v_uid;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('ledger_events', v_n);

  delete from public.captures where user_id = v_uid;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('captures', v_n);

  -- tablets of the clans this user founded
  delete from public.ancestors
   where clan_id in (select id from public.clans where created_by = v_uid);
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('ancestors', v_n);

  delete from public.streaks    where user_id = v_uid;
  delete from public.quotas     where user_id = v_uid;
  delete from public.cell_burns where user_id = v_uid;
  delete from public.devices    where user_id = v_uid;
  delete from public.consent_records where user_id = v_uid;

  -- the clans the user FOUNDED go with them: a clan with no members is not a clan
  delete from public.clan_members where user_id = v_uid;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('clan_memberships', v_n);

  delete from public.clans where created_by = v_uid;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('clans_founded', v_n);

  -- `integrity_flags` survives as a PSEUDONYMOUS row (fraud evidence, 90 days)
  update public.integrity_flags set user_id = null where user_id = v_uid;
  get diagnostics v_flags = row_count;

  -- `grid_cells` is an aggregate with NO identity — nothing to delete.

  delete from public.rate_counters where user_id = v_uid;

  delete from public.profiles where user_id = v_uid;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('profiles', v_n);

  -- ── VERIFY: 0 rows across every personal table, or it is a bug ───────────
  foreach v_t in array array[
    'profiles', 'captures', 'cartoonize_jobs', 'burns', 'ledger_events',
    'streaks', 'quotas', 'cell_burns', 'inventory', 'equipped_decorations',
    'tributes', 'consent_records', 'devices', 'clan_members'
  ] loop
    execute format('select count(*) from public.%I where user_id = $1', v_t)
      into v_n using v_uid;
    v_left := v_left + coalesce(v_n, 0);
  end loop;

  select count(*) into v_n from public.clans where created_by = v_uid;
  v_left := v_left + coalesce(v_n, 0);
  select count(*) into v_n from public.ancestors
   where clan_id in (select id from public.clans where created_by = v_uid);
  v_left := v_left + coalesce(v_n, 0);

  return jsonb_build_object(
    'deleted_at',                    now(),
    'counts',                        v_counts,
    'verified_zero_rows',            v_left = 0,
    'rows_left_behind',              v_left,
    'pseudonymised_integrity_flags', v_flags,
    'grid_cells_kept',               true,
    'storage_prefixes',              jsonb_build_array(
                                       'captures/' || v_uid::text,
                                       'styled/'   || v_uid::text),
    'storage_note',                  'NOT purged here — the Storage API (service key) must remove these objects; a SQL row delete would orphan the bytes',
    'auth_user_retained',            true,
    'auth_user_note',                'the auth.users row is not removed by SQL — that needs the Admin API'
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES THE INVOKER RPCs NEED (RULE B — the access model, not a bypass)
-- Each is scoped to the caller's OWN row, or gated on the clan ROLE ladder, so
-- a client that writes the table directly cannot gain anything an RPC did not
-- already grant them.
-- ═══════════════════════════════════════════════════════════════════════════

-- `create_clan` writes the founder's head row — and ONLY for a clan they just
-- created. Role 'member' is NOT self-insertable, so the invite code stays the
-- only way in (doc 15 §4.3/§5.1).
create policy clan_members_insert_head_of_own_clan on public.clan_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and role = 'head'
    and exists (
      select 1 from public.clans c
      where c.id = clan_members.clan_id and c.created_by = auth.uid()
    )
  );

-- The ladder may add or edit tablets; the CAP is the trigger's job (0001).
create policy ancestors_insert_elder on public.ancestors
  for insert to authenticated
  with check (public.clan_role_of(clan_id) in ('head', 'co_head', 'elder'));
create policy ancestors_update_elder on public.ancestors
  for update to authenticated
  using (public.clan_role_of(clan_id) in ('head', 'co_head', 'elder'))
  with check (public.clan_role_of(clan_id) in ('head', 'co_head', 'elder'));

-- The display state is the user's own row. The one-set-per-category rule is
-- enforced by the trigger, so a direct table write is safe too.
create policy equipped_insert_own on public.equipped_decorations
  for insert to authenticated with check (user_id = auth.uid());
create policy equipped_update_own on public.equipped_decorations
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy equipped_delete_own on public.equipped_decorations
  for delete to authenticated using (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- GRANTS — RULE A (service_role only) · RULE B (invoker, or a named exception)
-- Trap: `create function` grants EXECUTE to PUBLIC, and Supabase's default
-- privileges grant it to anon/authenticated explicitly. BOTH must go.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── RULE A: the AI budget path is service_role ONLY ────────────────────────
revoke execute on function public.request_cartoonize(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.request_cartoonize(uuid, uuid) to service_role;

-- ── INTERNALS: never reachable from the Data API ───────────────────────────
revoke execute on function public.ensure_profile(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.enforce_one_set_per_category() from public, anon, authenticated, service_role;

-- ── PURE helpers (no table access) that INVOKER RPCs call — safe to expose ─
revoke execute on function public.pseudonym_for(uuid)   from public, anon;
grant  execute on function public.pseudonym_for(uuid)   to authenticated;
revoke execute on function public.new_clan_code()       from public, anon;
grant  execute on function public.new_clan_code()       to authenticated;
revoke execute on function public.slot_category_of(text) from public, anon;
grant  execute on function public.slot_category_of(text) to authenticated;

-- ── RULE B: client-callable, SECURITY INVOKER (no advisor finding) ─────────
revoke execute on function public.get_league_board() from public, anon;
grant  execute on function public.get_league_board() to authenticated;

revoke execute on function public.create_clan(text) from public, anon;
grant  execute on function public.create_clan(text) to authenticated;

revoke execute on function public.reroll_clan_code(uuid) from public, anon;
grant  execute on function public.reroll_clan_code(uuid) to authenticated;

revoke execute on function public.save_ancestor(uuid, text, text, text, smallint, uuid) from public, anon;
grant  execute on function public.save_ancestor(uuid, text, text, text, smallint, uuid) to authenticated;

revoke execute on function public.equip_decoration(text, text) from public, anon;
grant  execute on function public.equip_decoration(text, text) to authenticated;

-- ── RULE B's FOUR NAMED EXCEPTIONS: client-callable AND elevated ───────────
-- `preview_clan` / `join_clan` resolve a code for a NON-member (RLS cannot be
-- the access model); `purchase_item` writes the append-only ledger;
-- `delete_my_data` deletes tables no client role may delete. Each adds one
-- finding to the `authenticated_security_definer_function_executable` lint —
-- the SAME finding the 0001 RLS helpers already carry, and the minimum the
-- doc 19 §3.2 RPC surface can be built from. Reported in the PR, not hidden.
revoke execute on function public.preview_clan(text) from public, anon;
grant  execute on function public.preview_clan(text) to authenticated;

revoke execute on function public.join_clan(text) from public, anon;
grant  execute on function public.join_clan(text) to authenticated;

revoke execute on function public.purchase_item(text, text) from public, anon;
grant  execute on function public.purchase_item(text, text) to authenticated;

revoke execute on function public.delete_my_data() from public, anon;
grant  execute on function public.delete_my_data() to authenticated;

comment on function public.create_clan(text) is
  'SECURITY INVOKER: the RLS policies (clans_insert_self + clan_members_insert_head_of_own_clan) grant exactly what it needs, and nothing more. A code collision is resolved by retry.';
comment on function public.preview_clan(text) is
  'SECURITY DEFINER because an invite code must resolve for a NON-member. Returns the name, the counts and is_member — NEVER an ancestor name before joining (doc 13 §4).';
comment on function public.join_clan(text) is
  'SECURITY DEFINER for the same reason as preview_clan. No approval queue (doc 15 §4.3) — a valid code joins instantly; revoked/already-member fails loudly.';
comment on function public.purchase_item(text, text) is
  'SECURITY DEFINER: the price is re-read from the catalogue tables server-side (doc 07 §5.1.6) and the debit/accrual are ledger writes, which no client role may perform. Replay-safe on idempotency_key.';
comment on function public.delete_my_data() is
  'SECURITY DEFINER: the ADR-007 §7 one-tap delete, children-first per doc 13 §9.4, with a self-verifying probe (0 rows) and a receipt. It does NOT purge Storage objects or the auth.users row — see the returned notes.';
comment on function public.request_cartoonize(uuid, uuid) is
  'The quota gate (doc 07 §4.2 step 3). SECURITY DEFINER, EXECUTE to service_role ONLY — called by cartoonize-orchestrator, never by a client.';
comment on function public.get_league_board() is
  'SECURITY INVOKER. Honest STUB: the league cohorts are not in the slice schema (they arrive with SCRUM-11), so it returns the caller''s own weekly tribute sum and an empty public board.';
