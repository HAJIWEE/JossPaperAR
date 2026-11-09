-- ═══════════════════════════════════════════════════════════════════════════
-- SEED — local development data
--
-- Applied by `supabase db reset` (and `supabase start`) after migrations.
-- Safe to re-run: every statement is idempotent.
--
-- SCOPE: the two catalogue tables ONLY. No users, no clans, no ancestors.
--   · Users/clans/ancestors need a real auth.users row; forging one in SQL is
--     brittle and would put fake ancestor names in the database — the one
--     column this system treats as most sensitive (doc 13 §4). If you want
--     local fixtures, create them through the app or a scripted sign-in.
--   · The catalogues are a MIRROR of code constants (doc 07 §5.1.6), so seeding
--     them here does not create a second source of truth — src/domain/
--     catalogue.ts stays authoritative and the server re-reads it.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Offerings — base_value = 1.2 x price (S13d), a GENERATED column ────────
-- Mirrors OFFERINGS in src/domain/catalogue.ts. Prices 400 · 600 · 800 · 1200
-- · 2000. The House price is DERIVED from its documented base of 1,440
-- (1440 / 1.2) and is flagged `derived` in the code — confirm before launch.
--
-- ⚠️ `wealth_bundle` is a BUNDLE, NOT an item (device report, 2026-11-07): its
-- `composed_of` is the other four codes, and it is `burnable = false`. Buying it
-- grants one of each component and NEVER a `wealth_bundle` inventory row — the
-- behaviour lives in `purchase_item` (migration 20261107120000). `composed_of` is
-- the SQL twin of `Offering.composedOf` in the code catalogue.
insert into public.offerings_catalog (code, name_en, name_zh, tier, price, burnable, composed_of) values
  ('joss_paper_stack', 'Joss Paper Stack', null, 1,  400, true,  null),
  ('gold_bar',         'Gold Bar',         null, 2,  600, true,  null),
  ('smartphone',       'Smartphone',       null, 3,  800, true,  null),
  ('house',            'House',            null, 4, 1200, true,  null),
  ('wealth_bundle',    'Wealth Bundle',    null, 5, 2000, false,
     array['joss_paper_stack', 'gold_bar', 'smartphone', 'house'])
on conflict (code) do update set
  name_en = excluded.name_en,
  name_zh = excluded.name_zh,
  tier    = excluded.tier,
  price   = excluded.price,
  burnable = excluded.burnable,
  composed_of = excluded.composed_of;

-- ── Decorations — permanent, NEVER burn (a points SINK) ────────────────────
-- Names are locked (S14). Prices come from `EN · 7b` / `ZH · 7b`, adopted as-is by the owner
-- (2026-11-08), and they MUST match `DECORATIONS` in src/domain/catalogue.ts.
--
-- ⚠️⚠️ **THE FESTIVE SET IS A BUNDLE, NOT AN ALTTARPIECE** (owner, 2026-11-09): *"it should not be a
-- selectable item for the decorations. when a user buys the Festive set he is getting all the other
-- decorations in one shot."* So `composed_of` names the four it is made of — the same column, and the
-- same `purchase_item` path, as `wealth_bundle` on the offerings side.
--
-- ⚠️⚠️ **THESE ARE SEEDED WITH THEIR PRICES ON PURPOSE.** They used to be inserted as NULL, and that made
-- the LOCAL database a different product from the hosted one: the pricing migrations run BEFORE the seed, so
-- on a fresh `supabase db reset` their UPDATEs matched no rows and every decoration stayed unpriced —
-- `purchase_item` answered *"has no price yet"* and `equip_decoration` could never be reached. ⚠️ It also
-- made `pr3_verification.sql`'s "an unpriced decoration fails loudly" assertion pass for a reason that did
-- not exist on the hosted project.
--
-- ⚠️ Pairing is asserted in `check:lib` against the board's own layer names, not against this file. It is
-- stated here because it was got wrong once (2026-11-09): DOOR GODS $1.49 / 1,200 · LANTERNS $1.99 / 1,600.
insert into public.decorations_catalog (code, slot_category, name_en, name_zh, price, composed_of) values
  ('spring_couplets', 'side',       'Spring Couplets', '春联',     800, null),
  ('zhong_kui',       'background', 'Zhong Kui Print', '鍾馗像',  1000, null),
  ('door_gods',       'side',       'Door Gods',       '门神',    1200, null),
  ('lanterns',        'top',        'Lanterns',        '灯笼',    1600, null),
  ('festive_set',     'side',       'Festive Set',     '新春套装', 3000,
     array['lanterns', 'spring_couplets', 'zhong_kui', 'door_gods'])
on conflict (code) do update set
  slot_category = excluded.slot_category,
  name_en       = excluded.name_en,
  name_zh       = excluded.name_zh,
  -- ⚠️ price is part of the upsert: re-seeding must CORRECT a row, not quietly leave the old number.
  price         = excluded.price,
  composed_of   = excluded.composed_of;

-- ── Sanity check (visible in `supabase db reset` output) ───────────────────
do $$
declare
  n_offer int;
  n_decor int;
  bad     int;
begin
  select count(*) into n_offer from public.offerings_catalog;
  select count(*) into n_decor from public.decorations_catalog;
  -- the generated column must reproduce the documented pairs
  select count(*) into bad from public.offerings_catalog
   where (code = 'joss_paper_stack' and base_value <> 480)
      or (code = 'gold_bar'         and base_value <> 720)
      or (code = 'smartphone'       and base_value <> 960)
      or (code = 'house'            and base_value <> 1440)
      or (code = 'wealth_bundle'    and base_value <> 2400);
  if bad > 0 then
    raise exception 'seed: % offering(s) have a base_value that is not 1.2 x price', bad;
  end if;
  -- ⚠️ the bundle is a BUNDLE: composed of the other four, and NOT burnable (2026-11-07)
  select count(*) into bad from public.offerings_catalog
   where code = 'wealth_bundle'
     and (burnable
          or composed_of is null
          or (select array_agg(x order by x) from unnest(composed_of) x)
             <> array['gold_bar', 'house', 'joss_paper_stack', 'smartphone']);
  if bad > 0 then
    raise exception 'seed: wealth_bundle must be non-burnable and composed of the other four';
  end if;
  -- ⚠️ the decoration prices must be the BOARD's pairing (`EN · 7b`), not merely non-null. The Door Gods /
  -- Lanterns transposition (fixed 2026-11-09) survived because no check compared the numbers to the board.
  select count(*) into bad from public.decorations_catalog
   where (code = 'spring_couplets' and price is distinct from  800)
      or (code = 'zhong_kui'       and price is distinct from 1000)
      or (code = 'door_gods'       and price is distinct from 1200)
      or (code = 'lanterns'        and price is distinct from 1600)
      or (code = 'festive_set'     and price is distinct from 3000);
  if bad > 0 then
    raise exception 'seed: % decoration(s) do not carry the board price (EN-7b: 800 · 1000 · 1200 · 1600 · 3000)', bad;
  end if;
  -- ⚠️ the Festive Set is a BUNDLE (owner, 2026-11-09) — it must name its four, and nothing else may.
  select count(*) into bad from public.decorations_catalog
   where (code = 'festive_set'
          and (composed_of is null
               or (select array_agg(x order by x) from unnest(composed_of) x)
                  <> array['door_gods', 'lanterns', 'spring_couplets', 'zhong_kui']))
      or (code <> 'festive_set' and composed_of is not null);
  if bad > 0 then
    raise exception 'seed: festive_set must be the ONLY composed decoration, made of the other four';
  end if;
  raise notice 'seed ok — % offerings · % decorations · every base_value = 1.2 x price', n_offer, n_decor;
end;
$$;
