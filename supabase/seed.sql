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
insert into public.offerings_catalog (code, name_en, name_zh, tier, price, burnable) values
  ('joss_paper_stack', 'Joss Paper Stack', null, 1,  400, true),
  ('gold_bar',         'Gold Bar',         null, 2,  600, true),
  ('smartphone',       'Smartphone',       null, 3,  800, true),
  ('house',            'House',            null, 4, 1200, true),
  ('wealth_bundle',    'Wealth Bundle',    null, 5, 2000, true)
on conflict (code) do update set
  name_en = excluded.name_en,
  name_zh = excluded.name_zh,
  tier    = excluded.tier,
  price   = excluded.price,
  burnable = excluded.burnable;

-- ── Decorations — permanent, NEVER burn (a points SINK) ────────────────────
-- Names are locked (S14). `price` stays NULL: no doc states a decoration price,
-- and inventing one is a product decision, not a build decision. The column
-- allows NULL precisely so this is not silently guessed.
insert into public.decorations_catalog (code, slot_category, name_en, name_zh, price) values
  ('spring_couplets', 'side',       'Spring Couplets', '春联',     null),
  ('zhong_kui',       'background', 'Zhong Kui Print', '鍾馗像',   null),
  ('door_gods',       'side',       'Door Gods',       '门神',     null),
  ('lanterns',        'top',        'Lanterns',        '灯笼',     null),
  ('festive_set',     'side',       'Festive Set',     '新春套装', null)
on conflict (code) do update set
  slot_category = excluded.slot_category,
  name_en       = excluded.name_en,
  name_zh       = excluded.name_zh;

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
  raise notice 'seed ok — % offerings · % decorations · every base_value = 1.2 x price', n_offer, n_decor;
end;
$$;
