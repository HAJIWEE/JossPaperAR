-- ═══════════════════════════════════════════════════════════════════════════
-- 0008 · `purchase_item` — the `balances` view has no `amount` column
--
-- FOUND BY supabase/tests/pr3_verification.sql. `purchase_item` asked the
-- `balances` VIEW for `sum(amount)`, but the view exposes exactly three
-- columns — (user_id, currency, balance) — and `amount` lives on the
-- underlying `ledger_events`. plpgsql does not resolve a SQL statement's
-- columns until first execution, so 0005 applied cleanly and only failed the
-- moment a purchase was actually attempted. The test caught it.
--
-- THE FIX reads the view's own `balance` column, and coalesces a MISSING row to
-- 0 — which a bare `select balance into` would leave NULL.
--
-- ⚠️ A new migration rather than an edit to 0005: 0005 is applied. Same rule as
-- 0002 / 0003 / 0007.
-- ═══════════════════════════════════════════════════════════════════════════
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
    -- ⚠️ 0008 FIX: `balances` exposes (user_id, currency, balance) — there is
    -- no `amount` column on the view; `amount` is on `ledger_events`.
    select coalesce((select balance from public.balances
                      where user_id = v_uid and currency = 'tribute'), 0)
      into v_balance;
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

  -- ⚠️ 0008 FIX: read the view's own `balance`, coalescing a missing row to 0.
  select coalesce((select balance from public.balances
                    where user_id = v_uid and currency = 'tribute'), 0)
    into v_balance;
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

  -- ⚠️ 0008 FIX: the same view/column correction on the post-purchase read.
  select coalesce((select balance from public.balances
                    where user_id = v_uid and currency = 'tribute'), 0)
    into v_balance;

  return jsonb_build_object(
    'item_code', v_code, 'kind', v_kind, 'price', v_price,
    'currency', 'tribute', 'accrual', v_accrual,
    'balance', v_balance, 'idempotent_replay', false
  );
end;
$$;

-- CREATE OR REPLACE preserves grants; restated so the file stands alone.
revoke execute on function public.purchase_item(text, text) from public, anon;
grant  execute on function public.purchase_item(text, text) to authenticated;
