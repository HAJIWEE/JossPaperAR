-- ══════════════════════════════════════════════════════════════════════════════
-- 20261109163000_offering_price_swap
--
-- ── WHY (owner, 2026-11-09) ──────────────────────────────────────────────────
-- *"yes you should do 230 and fix that as well"* — SCRUM-230. The board is the authority, and it pairs GOLD BAR
-- and PHONE the other way round from the values this mirror has carried since PR-2.
--
-- ⚠️⚠️ **THE DEFECT IS A TRANSPOSITION, NOT A WRONG AMOUNT.** `EN · 7 Store` and `ZH · 7 商店` draw the cards
-- with their prices in layer NAMES that state the item, so the pairing is unambiguous:
--
--   card · Joss Paper Stack points =   400 pts · meta base 480    ← unchanged
--   card · Gold Bar points         =   800 pts · meta base 960    ← was 600 / 720
--   card · Phone points            =   600 pts · meta base 720    ← was 800 / 960
--   card · House points            = 1,200 pts · meta base 1,440  ← unchanged
--   card · featured                = 2,000 pts                    ← unchanged
--
-- `ZH · 7 商店` agrees (金条 800 / 基础 960 · 手机 600 / 基础 720), so this is one design in two languages.
-- ⚠️ The first pass assigned the pairing by **list position** under a `priceSource: 'derived'` that admitted it
-- *"still needs a PM confirmation"* — it never got one, and PR-2's mirror inherited it.
--
-- ⚠️ **THE PRACTICAL EFFECT IS 200 STORE POINTS, BOTH WAYS** — the gold bar charged 200 too little and the
-- phone 200 too much, so the cheaper-looking item was the dearer one. It is also a **burn-award** change:
-- `base_value` is `round(price × 1.2)`, so the gold bar's redemption base rises 720 → 960 and the phone's falls
-- 960 → 720.
--
-- ⚠️ **FOUR PLACES HAD TO MOVE TOGETHER**, because points are what `purchase_item` actually charges and a
-- client/server disagreement means the card says 800 while the server bills 600:
--   `src/domain/catalogue.ts` · `supabase/seed.sql` (and its base_value self-check) · this migration · the
--   Store's gates (`BOARD_OFFERING_POINTS`, which now asserts ZERO drift instead of tolerating this pair).
-- ✅ `cashPrice` does NOT move: the cash rail is a separate pairing and it was already correct.
--
-- ⚠️ A NEW VERSION NUMBER, NOT AN EDIT. The earlier catalogue migrations are applied on the hosted project and
-- an applied migration is permanent.
--
-- ⚠️ These are UPDATEs against rows the SEED owns, so on a fresh local database (`supabase db reset`) this runs
-- BEFORE the rows exist and matches nothing — expected and harmless. The local values come from
-- `supabase/seed.sql`, which carries the corrected pairing too. ⚠️ Do NOT add a "did it update anything?" guard:
-- it would fire on every fresh reset. The hosted check is a real read of the rows, not an assertion in here.
-- ══════════════════════════════════════════════════════════════════════════════

update public.offerings_catalog set price = 800 where code = 'gold_bar';    -- 800 pts · base 960
update public.offerings_catalog set price = 600 where code = 'smartphone';  -- 600 pts · base 720

comment on column public.offerings_catalog.price is
  'Store Points price. Read from the boards EN-7 Store / ZH-7 (which state the pairing in their layer names): joss_paper_stack 400, gold_bar 800, smartphone 600, house 1200, wealth_bundle 2000. CORRECTED 2026-11-09 by 20261109163000 (SCRUM-230): gold_bar and smartphone were transposed — the pairing had been assigned by list position, not from the board. base_value is GENERATED as round(price * 1.2), so the burn award follows automatically. Match src/domain/catalogue.ts exactly.';
