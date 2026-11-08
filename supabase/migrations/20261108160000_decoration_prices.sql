-- ══════════════════════════════════════════════════════════════════════════════
-- 20261108160000_decoration_prices
--
-- ── WHY (owner, 2026-11-08) ──────────────────────────────────────────────────
-- *"i think the prices stated and the points stated they are ok to adopt as it is"* — the five decoration prices
-- were designed on `EN · 7b` / `ZH · 7b` and have been sitting as `price is null` since the slice went in.
--
-- ⚠️⚠️ **AND THAT NULL IS WHAT BLOCKS THE WHOLE CUSTOMISATION WORKFLOW.** `purchase_item` reads
-- `decorations_catalog.price`; with it NULL a decoration cannot be bought, so it never enters `inventory`, so
-- `equip_decoration` refuses it as *"not owned"* — the shrine can never be decorated. ⚠️ **Nothing was wrong with
-- the client or the equip RPC: the catalogue had no prices.**
--
-- ⚠️ The client already carries these same numbers (`domain/catalogue.ts`) and `check:lib` asserts them against
-- the board. This migration is the SERVER half of one decision, not a second one — the two must move together.
--
-- ⚠️ Cash prices are NOT set here. There is no cash column, and the cash rail has no billing path until Google
-- Play goes live (SCRUM-212); adding a column that nothing can charge against would be a placeholder in the schema.
-- ══════════════════════════════════════════════════════════════════════════════

update public.decorations_catalog set price = 3000 where code = 'festive_set';     -- $3.99 · 3,000 pts
update public.decorations_catalog set price = 800  where code = 'spring_couplets'; -- $0.99 ·   800 pts
update public.decorations_catalog set price = 1000 where code = 'zhong_kui';       -- $1.29 · 1,000 pts
update public.decorations_catalog set price = 1600 where code = 'door_gods';       -- $1.99 · 1,600 pts
update public.decorations_catalog set price = 1200 where code = 'lanterns';        -- $1.49 · 1,200 pts

-- ⚠️ The old note on the column now lies — it says these are NULL until an economy pass, and that pass happened.
comment on column public.decorations_catalog.price is
  'Store Points price (SCRUM-212 / SCRUM-204). Priced 2026-11-08 from the boards EN-7b / ZH-7b, which the owner adopted as-is: festive_set 3000, spring_couplets 800, zhong_kui 1000, door_gods 1600, lanterns 1200. ⚠️ NOT NULL-able yet: a new decoration may land unpriced, and purchase_item already refuses a null price rather than treating it as free. Decorations are permanent (never burn) - they are a points SINK.';
