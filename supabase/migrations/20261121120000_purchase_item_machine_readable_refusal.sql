-- ══════════════════════════════════════════════════════════════════════════════
-- 20261121120000_purchase_item_machine_readable_refusal
--
-- ── WHY (SCRUM-242) ─────────────────────────────────────────────────────────
-- The store showed the DATABASE's own words to a player. Measured on glass
-- 2026-11-21 (build 8de806f2, HN615L005386), UI in 中文:
--
--     not enough tribute: 2000 needed, 0 available
--
-- in red English, and ⚠️ rendered BELOW the item grid, so the confirm closed and
-- nothing visible happened until the page was swiped.
--
-- `purchaseItem` returned `error.message` unmapped, `store.tsx` rendered it raw,
-- and `i18n.ts` had no insufficient-funds string at all. That breaks SCRUM-150's
-- AC 3 ("real copy") and AC 5 ("both locales"), and the demo script's rule 4.
--
-- ── WHAT THIS DOES ──────────────────────────────────────────────────────────
-- ⚠️⚠️ **Option B: the SERVER says WHY, in a form a program can read.** The
-- MESSAGE stays byte-identical — logs, SQLERRM and existing assertions see the
-- same prose — and the reason moves into Postgres's DETAIL as JSON, which
-- PostgREST returns as `details`:
--
--     {"refusal":"insufficient_funds","needed":400,"available":0,"short_by":400}
--
-- ⚠️ **The prose is NOT the contract any more.** Option A (matching the message)
-- was rejected: a reworded `raise` would silently degrade the copy. This repo
-- already refuses prose-as-contract on the clan surface (`check:clanapi`).
--
-- ⚠️ **Additive, not behavioural:** the same conditions raise at the same points
-- with the same SQLSTATEs, so a client that ignores `details` is unaffected.
--
-- ── SCOPE ───────────────────────────────────────────────────────────────────
-- ONLY refusals a player can see get a code: insufficient_funds · rate_limited ·
-- unknown_item · unpriced_item · idempotency_key_reused · bad_idempotency_key ·
-- not_signed_in. ⚠️ Anything else still raises with NO detail — an unexpected
-- error is not something the UI should pretend to explain.
--
-- ⚠️ The body is the applied `20261109110000` function, EXTRACTED FROM ITS FILE
-- (not retyped), with the `detail =` additions and nothing else.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.purchase_item(p_item_code text, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_per_min      constant integer := 5;     -- doc 11 §5
  c_accrual_rate constant numeric := 0.2;   -- S13d — the Store-Point accrual
  v_uid      uuid := auth.uid();
  v_key      text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_code     text := btrim(coalesce(p_item_code, ''));
  v_price    integer;
  v_kind     text;
  v_composed text[];
  v_balance  bigint;
  v_accrual  integer;
  v_seq      bigint;
  v_ref      public.ledger_events;
begin
  if v_uid is null then
    -- SCRUM-242 · machine-readable refusal
    raise exception 'not signed in' using errcode = '42501',
      detail = json_build_object('refusal', 'not_signed_in')::text;
  end if;
  perform public.ensure_profile(v_uid);
  if v_key is null or char_length(v_key) < 8 or char_length(v_key) > 200 then
    -- SCRUM-242 · a client bug, but typed so the UI never prints it raw
    raise exception 'idempotency_key must be 8..200 characters' using errcode = '22023',
      detail = json_build_object('refusal', 'bad_idempotency_key')::text;
  end if;

  -- REPLAY: the ledger's UNIQUE(idempotency_key) is the memory (doc 14 N6).
  select * into v_ref from public.ledger_events where idempotency_key = v_key;
  if found then
    if v_ref.user_id <> v_uid then
      insert into public.integrity_flags (user_id, signal, severity, evidence)
      values (v_uid, 'idempotency_key_reuse', 3,
              jsonb_build_object('key', v_key, 'owner', v_ref.user_id));
      -- SCRUM-242 · machine-readable refusal
      raise exception 'idempotency key already used by another account' using errcode = '23505',
        detail = json_build_object('refusal', 'idempotency_key_reused')::text;
    end if;
    select coalesce((select balance from public.balances
                      where user_id = v_uid and currency = 'tribute'), 0)
      into v_balance;
    return jsonb_build_object(
      'item_code', v_code, 'balance', v_balance, 'idempotent_replay', true
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  if not public.rate_limit_allow(v_uid, 'purchase_item', c_per_min) then
    -- SCRUM-242 · machine-readable refusal
    raise exception 'the shrine is busy — try again in a moment' using errcode = 'P0001',
      detail = json_build_object('refusal', 'rate_limited')::text;
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
    -- SCRUM-242 · machine-readable refusal
    raise exception 'unknown item: %', v_code using errcode = '22023',
      detail = json_build_object('refusal', 'unknown_item', 'item_code', v_code)::text;
  end if;
  if v_price is null then
    -- SCRUM-242 · machine-readable refusal
    raise exception 'item % has no price yet — the economy pass has not priced it',
      v_code using errcode = 'P0001',
      detail = json_build_object('refusal', 'unpriced_item', 'item_code', v_code)::text;
  end if;

  -- ⚠️⚠️ THE COMPOSITION, read once — AND FROM THE CATALOGUE THE ITEM CAME FROM.
  -- A DECORATION can be a bundle too (the Festive Set, owner 2026-11-09), so buying it grants the four it
  -- is made of — never a `festive_set` row, which nobody could place. A plain item has no entry in either,
  -- so `v_composed` stays NULL and the plain-item branch runs.
  if v_kind = 'decoration' then
    select d.composed_of into v_composed from public.decorations_catalog d where d.code = v_code;
  else
    select o.composed_of into v_composed from public.offerings_catalog o where o.code = v_code;
  end if;

  select coalesce((select balance from public.balances
                    where user_id = v_uid and currency = 'tribute'), 0)
    into v_balance;
  if v_balance < v_price then
    -- ⚠️ SCRUM-242's headline case. `needed`/`available`/`short_by` ride along so the UI can say
    -- *"You need 400 more"* without parsing the sentence.
    raise exception 'not enough tribute: % needed, % available', v_price, v_balance
      using errcode = 'P0001',
        detail = json_build_object(
          'refusal', 'insufficient_funds',
          'needed', v_price,
          'available', v_balance,
          'short_by', v_price - v_balance
        )::text;
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

  -- ⚠️⚠️ THE GRANT. A COMPOSED item grants **one of each component** and NOT itself; a plain item
  -- (`v_composed` NULL) grants itself. `select distinct` because an `on conflict do update` acting on
  -- the SAME row twice is an error — a duplicate in a future composition would crash the purchase.
  if v_composed is not null and array_length(v_composed, 1) > 0 then
    insert into public.inventory (user_id, item_code, qty, acquired_via)
    select v_uid, c, 1, 'purchase'
      from (select distinct unnest(v_composed) as c) parts
    on conflict (user_id, item_code) do update set qty = public.inventory.qty + 1;
  else
    insert into public.inventory (user_id, item_code, qty, acquired_via)
    values (v_uid, v_code, 1, 'purchase')
    on conflict (user_id, item_code) do update set qty = public.inventory.qty + 1;
  end if;

  select coalesce((select balance from public.balances
                    where user_id = v_uid and currency = 'tribute'), 0)
    into v_balance;

  return jsonb_build_object(
    'item_code', v_code, 'kind', v_kind, 'price', v_price,
    'currency', 'tribute', 'accrual', v_accrual,
    -- ⚠️ What actually landed in the inventory — the components of a bundle, or the item itself.
    'granted', coalesce(v_composed, array[v_code]),
    'balance', v_balance, 'idempotent_replay', false
  );
end;
$$;

comment on function public.purchase_item(text, text) is
  'SCRUM-242: a business refusal carries a MACHINE-READABLE reason in Postgres DETAIL, as JSON — {"refusal":"insufficient_funds","needed":400,"available":0,"short_by":400}, or one of rate_limited / unknown_item / unpriced_item / idempotency_key_reused / bad_idempotency_key / not_signed_in. ⚠️ The MESSAGE text is unchanged for logs and SQLERRM, and the prose is deliberately NOT the contract: the client maps details.refusal, never the sentence. An unexpected failure raises with NO detail, so invented copy never explains it.';

-- CREATE OR REPLACE preserves grants; restated so the file stands alone.
revoke execute on function public.purchase_item(text, text) from public, anon;
grant  execute on function public.purchase_item(text, text) to authenticated;
