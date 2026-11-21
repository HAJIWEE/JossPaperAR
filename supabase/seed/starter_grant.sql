-- ══════════════════════════════════════════════════════════════════════════════
-- starter_grant.sql — give ONE named account the starter inventory (SCRUM-157)
--
-- ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
-- The acceptance gate needs an offering to PICK (step 4) and then BURN (steps 5–6).
-- A fresh account owns nothing and holds zero tribute, and the tutorial cannot break
-- the circle: `TUTORIAL_CONSEQUENCES` is `awardsPoints: false · writesLedger: false`,
-- deliberately, so the demo banks nothing (owner's ruling, 2026-11-01). Something has
-- to gift the first offering.
--
-- ⚠️⚠️ **AND IT GRANTS *YOUR* ACCOUNT, NOT A DEMO IDENTITY.** `demo_seed.sql` creates
-- five `demo-*@example.invalid` users and grants THEM — but those addresses cannot
-- receive a sign-in code, so no phone can ever sign in as one. Seeding them populates
-- the database and leaves the device the gate must run on empty. This script targets
-- an account that can actually be signed into.
--
-- ── WHAT IT WRITES, AND WHAT IT DELIBERATELY DOES NOT ───────────────────────
-- ONE row: `inventory (user_id, 'joss_paper_stack', qty, acquired_via = 'grant')`.
-- ⚠️ **No tribute, no ledger row, no clan, no identical demo identities.** Tribute is
-- EARNED by burning, and `ledger_events` is append-only — a grant must not mint money.
-- ⚠️ `acquired_via = 'grant'` is the honest provenance: `inventory` has that value for
-- exactly this case, so a future audit can tell a gift from a purchase.
--
-- ⚠️ IDEMPOTENT BY `greatest` — re-running never inflates the quantity. A grant that
-- compounded would turn a safety net into a faucet.
--
-- ⚠️ It REFUSES rather than guesses: no email, no matching account, or more than one
-- match all raise and write nothing.
-- ══════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

-- ⚠️ The email arrives as a psql variable and is parked in a SESSION setting, because
-- psql does not interpolate `:'email'` inside a dollar-quoted DO body.
select set_config('starter.email', :'email', false);

do $$
declare
  v_email   text := nullif(btrim(current_setting('starter.email', true)), '');
  v_uid     uuid;
  v_qty     constant integer := 12;   -- the demo head's own figure: enough to burn, not a hoard
  v_matches integer;
  v_total   integer;
begin
  if v_email is null then
    raise exception 'STARTER GRANT: --email is required. Nothing was written.';
  end if;

  select count(*) into v_matches from auth.users where lower(email) = lower(v_email);
  if v_matches = 0 then
    raise exception 'STARTER GRANT: no auth.users row for %. ⚠️ Sign in once in the app FIRST (that creates the row), then re-run.', v_email;
  end if;
  if v_matches > 1 then
    raise exception 'STARTER GRANT: % matches more than one account — refusing to guess.', v_email;
  end if;

  select id into v_uid from auth.users where lower(email) = lower(v_email);

  insert into public.inventory (user_id, item_code, qty, acquired_via)
  values (v_uid, 'joss_paper_stack', v_qty, 'grant')
  on conflict (user_id, item_code) do update
    -- ⚠️ `greatest`, not `+`: an idempotent top-up. Re-running must not inflate it.
    set qty = greatest(public.inventory.qty, excluded.qty);

  select qty into v_total
    from public.inventory
   where user_id = v_uid and item_code = 'joss_paper_stack';

  raise notice 'STARTER GRANT: % now owns % x joss_paper_stack (a GIFT — acquired_via = grant)', v_email, v_total;
  raise notice 'STARTER GRANT: no tribute and no ledger row were written — burn one to earn.';
end
$$;
