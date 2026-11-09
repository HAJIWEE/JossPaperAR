-- ══════════════════════════════════════════════════════════════════════════════
-- 20261109100000_decoration_price_swap
--
-- ── WHY (owner, 2026-11-09) ──────────────────────────────────────────────────
-- *"lets fix the decorations price. Follow the displayed values now"* — the board is the authority, and the
-- board pairs DOOR GODS and LANTERNS the other way round from the values `20261108160000` wrote.
--
-- ⚠️⚠️ **THE DEFECT WAS A TRANSPOSITION, NOT A WRONG AMOUNT.** `EN · 7b Store · Decorations` draws the four
-- cards in a 2 × 2 grid and states each price in a layer NAMED AFTER ITS ITEM:
--
--   card · Spring Couplets cash = $0.99   · points =   800 pts   ← unchanged
--   card · Zhong Kui cash       = $1.29   · points = 1,000 pts   ← unchanged
--   card · Door Gods cash       = $1.49   · points = 1,200 pts   ← was 1,600 / $1.99
--   card · Lanterns cash        = $1.99   · points = 1,600 pts   ← was 1,200 / $1.49
--   card · featured (Festive Set) = $3.99 · 3,000 pts            ← unchanged
--
-- `ZH · 7b 商店 / 装饰` carries the same pairing (门神 $1.49 / 1,200 · 灯笼 $1.99 / 1,600), so this is one
-- design, in two languages, and it is unambiguous: the first pass paired the cards by POSITION instead of
-- reading the layer names, and swapped the two that share a row.
--
-- ⚠️ The practical effect is 400 Store Points, in the user's favour on one card and against them on the
-- other — the kind of bug that looks plausible on every screen and is only visible with the board open.
-- ⚠️ `src/domain/catalogue.ts` (the client) and `check:lib`'s board table were transcribed from the same
-- wrong pass, so **the gate agreed with the defect**; both are corrected in the same commit, and the gate
-- now also asserts that no two decorations share a price pair.
--
-- ⚠️ A NEW VERSION NUMBER, NOT AN EDIT. `20261108160000_decoration_prices` may already be applied on the
-- hosted project; an applied migration is permanent, so the correction ships as its own step.
--
-- ⚠️ These are UPDATEs against rows the SEED owns, so on a fresh local database (`supabase db reset`) this
-- migration runs BEFORE the rows exist and matches nothing — that is expected and harmless. The local
-- prices come from `supabase/seed.sql`, which now carries the corrected pairing too. Do not add a
-- "did it update anything?" guard here: it would fire on every fresh reset.
-- ══════════════════════════════════════════════════════════════════════════════

update public.decorations_catalog set price = 1200 where code = 'door_gods'; -- $1.49 · 1,200 pts
update public.decorations_catalog set price = 1600 where code = 'lanterns';  -- $1.99 · 1,600 pts

comment on column public.decorations_catalog.price is
  'Store Points price (SCRUM-212 / SCRUM-204). Priced from the boards EN-7b / ZH-7b, which the owner adopted as-is: festive_set 3000, spring_couplets 800, zhong_kui 1000, door_gods 1200 (USD 1.49), lanterns 1600 (USD 1.99). CORRECTED 2026-11-09 by 20261109100000: door_gods and lanterns were transcribed the wrong way round (by card position instead of by the board''s layer names) — the swap charged 400 points too much for the lanterns. Match src/domain/catalogue.ts exactly. NOT NULL-able yet: a new decoration may land unpriced, and purchase_item already refuses a null price rather than treating it as free. Decorations are permanent (never burn) - they are a points SINK.';
