-- ═══════════════════════════════════════════════════════════════════════════
-- 0025 · `home_summary()` — the tribute WALLET, not the tributes RECORD
--
-- ⚠️⚠️ THE DEFECT THIS CLOSES, measured on glass 2026-11-01 (SCRUM-150 AC 1).
--
-- `home_summary().tribute_total` read `sum(tributes.points)`. ⚠️ **`tributes` is the
-- BOOK OF TRIBUTES — a record of offerings that were actually MADE** (doc 15 §7.1),
-- so its sum is **LIFETIME EARNED and can never fall**. The Store's chip renders
-- this value as *"Store Points"*, while `purchase_item` checks **`public.balances`**
-- (`sum(ledger_events.amount)`) — the view's own comment calls that *"the ONLY thing
-- a balance is"* (`20261003085500_slice_schema.sql:293`).
--
-- ⚠️ **TWO SOURCES FOR ONE FACT.** Measured: with **5000** tribute in the ledger the
-- chip read **"Store Points 0"** — because that account's credit was an `adjustment`
-- row, which writes no `tributes` row — and the purchase **went through anyway**. A
-- player saw *"0 points"* beside a working Buy button.
--
-- ✅ THE FIX reads the SAME source `purchase_item` spends, so the number **shown** and
-- the number **enforced** cannot drift: the `balances` view, `where user_id = v_uid
-- and currency = 'tribute'` — character for character the read at
-- `20261004094000_purchase_item_balances_fix.sql:86`.
--
-- ⚠️ WHY THE WALLET IS THE RIGHT READING FOR EVERY SURFACE, not just the chip. Doc 10
-- defines `tribute` as a **WALLET** — *"tribute in: burn awards (400 × band × [ground
-- 2.0] + streak 50) · sign-in (100 store pts/day); out: store redemption"* — and the
-- ZH label is **identical** on both surfaces (shrine panel and store chip are both
-- **功德点**). So the shrine panel and the Profile row track the wallet too; they were
-- reading a record. ⚠️ **This is a product-visible change: the shrine's number now
-- FALLS when tribute is spent.** That is what a balance does — recorded in
-- `next-ai-context.md` so a future session does not read it as a regression.
--
-- ⚠️ THE STREAK IS STILL NOT RE-DERIVED — `streaks.current_days` is returned as
-- stored, exactly as the 20261031220000 version did. Only the tribute's source moved.
--
-- A new migration rather than an edit to 20261031220000: that one is APPLIED. Same
-- rule as 0002 / 0003 / 0007 / 0008.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.home_summary()
returns table (tribute_total bigint, streak_days integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- ⚠️ NOT a zero. An unauthenticated caller gets an error, because "you have earned
  -- nothing" and "you are not signed in" must not render identically.
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  return query
    select
      -- ⚠️ THE WALLET — the SAME read `purchase_item` makes before it refuses a
      -- purchase (`20261004094000:86`). A missing row is 0, never NULL.
      coalesce((select b.balance from public.balances b
                 where b.user_id = v_uid and b.currency = 'tribute'), 0)::bigint,
      coalesce((select s.current_days from public.streaks s where s.user_id = v_uid), 0)::integer;
end;
$$;

comment on function public.home_summary() is
  'The shrine panels (SCRUM-161): the caller''s own tribute WALLET and stored streak. ⚠️ The wallet is `sum(ledger_events.amount)` for currency tribute — the SAME source `purchase_item` spends (the `balances` view) — NOT `sum(tributes.points)`, which is the Book of Tributes record of lifetime earnings and never falls (SCRUM-150 AC 1). SECURITY DEFINER so the read returns ONE aggregate row filtered by auth.uid() — no rows, no ids, no names — rather than handing the client a ledger to sum. ⚠️ It is NOT because the client cannot read the ledger: measured 2026-11-01, `pg_policies` carries `ledger_select_own` for `authenticated` and `has_table_privilege(''authenticated'',''public.ledger_events'',''SELECT'')` is true.';

-- CREATE OR REPLACE preserves grants; restated so the file stands alone.
revoke all on function public.home_summary() from public;
revoke all on function public.home_summary() from anon;
grant execute on function public.home_summary() to authenticated;
