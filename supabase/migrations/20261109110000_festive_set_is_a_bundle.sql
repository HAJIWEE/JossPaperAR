-- ══════════════════════════════════════════════════════════════════════════════
-- 20261109110000_festive_set_is_a_bundle
--
-- ── WHY (owner, 2026-11-09) ─────────────────────────────────────────────────
-- *"Festive Set is just the rest of the decorations being sold together as a set, it should not be a selectable
-- item for the decorations. when a user buys the Festive set he is getting all the other decorations in one shot."*
--
-- ⚠️⚠️ **THE FESTIVE SET WAS BEING SOLD AS AN ALTTARPIECE IT IS NOT.** It sat in `decorations_catalog` as a plain
-- priced decoration, so `purchase_item` took the decoration branch, found no composition for it ANYWHERE (the
-- composition read only looked at `offerings_catalog`), and would have written a single `festive_set` row into
-- `inventory` — an item that cannot be placed in any of the six slots. This is the same defect the WEALTH BUNDLE had
-- (fixed in `20261107120000`) on the other catalogue.
--
-- So: `decorations_catalog` gains the same `composed_of` column the offerings mirror already has, the Festive Set is
-- declared as its four components, and `purchase_item` reads the composition from whichever catalogue the item came
-- from. ⚠️ Buying it grants ONE OF EACH and never a `festive_set` row — so no inventory row for it can exist, and the
-- picker never has to reason about it (the client also stops offering it: `decorate.ts#optionsForSlot` skips any
-- composed decoration).
--
-- ⚠️ The CLIENT mirrors this in `domain/catalogue.ts` (`Decoration.composedOf`), and the seed writes the column —
-- money is not the only thing that must agree across the two halves.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1 · the column, and the composition ──────────────────────────────────────────
-- ⚠️ Nullable, exactly like `offerings_catalog.composed_of`: a plain decoration has none, and the column is what
-- distinguishes a set from a piece.
alter table public.decorations_catalog add column if not exists composed_of text[];

update public.decorations_catalog
   set composed_of = array['lanterns', 'spring_couplets', 'zhong_kui', 'door_gods']
 where code = 'festive_set';

comment on column public.decorations_catalog.composed_of is
  'The decorations a SET is made of (owner, 2026-11-09: the Festive Set is the other four sold together). ⚠️ Buying a composed decoration grants ONE OF EACH component and never a row for the set itself, so no inventory row for it can exist - it is not placeable. NULL = a plain piece. Mirrors offerings_catalog.composed_of and Decoration.composedOf in src/domain/catalogue.ts.';

-- ── 2 · `purchase_item` — read the composition from the RIGHT catalogue ─────────────
-- Body is the applied `20261107120000` function, EXTRACTED FROM ITS FILE (not retyped) with ONE change: the
-- composition read branches on `v_kind`, so a composed decoration is read from `decorations_catalog`.
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

  -- ⚠️⚠️ THE COMPOSITION, read once — AND FROM THE CATALOGUE THE ITEM CAME FROM.
  -- A DECORATION can be a bundle too (the Festive Set, owner 2026-11-09: *"Festive Set is just the rest of
  -- the decorations being sold together as a set, it should not be a selectable item for the decorations.
  -- when a user buys the Festive set he is getting all the other decorations in one shot"*), so buying it
  -- grants the four it is made of — never a `festive_set` row, which nobody could place.
  -- A plain item has no entry in either, so `v_composed` stays NULL and the plain-item branch runs.
  if v_kind = 'decoration' then
    select d.composed_of into v_composed from public.decorations_catalog d where d.code = v_code;
  else
    select o.composed_of into v_composed from public.offerings_catalog o where o.code = v_code;
  end if;

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

  -- ⚠️⚠️ THE GRANT, AND THE WHOLE POINT OF THIS MIGRATION.
  -- A COMPOSED item (the wealth bundle) grants **one of each component** and NOT itself:
  -- the bundle is not an item, so no `wealth_bundle` row is ever written. A plain item
  -- (`v_composed` NULL) grants itself, exactly as before.
  -- `select distinct` because an `on conflict do update` acting on the SAME row twice is an
  -- error ("cannot affect row a second time") — a duplicate in a future composition would
  -- otherwise crash the purchase rather than double-grant.
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
    -- ⚠️ What actually landed in the inventory — the components of a bundle, or the item
    -- itself. Additive, so the existing client (which reads item_code/price/balance) is
    -- untouched; it exists so the grant is OBSERVABLE rather than inferred from the table.
    'granted', coalesce(v_composed, array[v_code]),
    'balance', v_balance, 'idempotent_replay', false
  );
end;
$$;

-- CREATE OR REPLACE preserves grants; restated so the file stands alone.
revoke execute on function public.purchase_item(text, text) from public, anon;
grant  execute on function public.purchase_item(text, text) to authenticated;
