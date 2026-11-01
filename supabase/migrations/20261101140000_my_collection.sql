-- ═══════════════════════════════════════════════════════════════════════════
-- MY COLLECTION — the Collection screen's read (SCRUM-151)
--
-- ⚠️ THE GAP THIS CLOSES. `EN · 8 Collection` draws a grid of the catalogue items the caller has
-- burned, each with a `burned ×N` count, above two stat cards. Until now **no RPC returned it**:
-- `home_summary` returns two aggregates, `my_offerings` returns individual burns (a page, not a
-- tally), and `clan_book` returns the CLAN's entries. So the Profile row rendered **disabled** —
-- a card would have had to invent its count, which is the class of defect this project treats as
-- worse than a missing screen.
--
-- ⚠️ `burns` has RLS enabled with **no policy** (server-written by design), so a plain client read
-- returns zero rows and no error — an empty list that LOOKS like "you have burned nothing". Same
-- posture as `my_offerings`: **SECURITY DEFINER, scoped to `auth.uid()` in the WHERE clause**, not
-- by a policy the caller could widen.
--
-- ⚠️ **THE GRID IS CATALOGUE ITEMS ONLY, AND THAT IS A CHOICE.** A burn is EITHER a catalogue item
-- (`item_code`) OR a photo (`capture_id`) — `burns_exactly_one_offering` enforces the XOR. The
-- board's cards are all catalogue art (Gold Bar · House · …), and a photo card would need a
-- thumbnail the board does not draw. So the grid counts `item_code` burns, and a caller who only
-- burns photos gets an empty grid and `items_collected = 0` — which is TRUE, not a failure.
--
-- ⚠️ **THE COUNT IS NOT RE-DERIVED.** It is `count(*)` over the caller's own rows, so it cannot
-- drift from the ledger the way a cached tally would.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.my_collection()
returns table (
  item_code      text,
  burned         integer,
  last_burned_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- ⚠️ NOT an empty set. "You have burned nothing" and "you are not signed in" must not render
  -- identically — the rule `home_summary` and `my_offerings` both follow.
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  return query
    select b.item_code,
           count(*)::integer,
           max(b.created_at)
      from public.burns b
     where b.user_id = v_uid
       -- ⚠️ The XOR guarantees a row has exactly one offering; this drops the photo burns, which
       -- the grid cannot draw. `burns_clan_created_idx`/`burns_user_created_idx` cover the filter.
       and b.item_code is not null
     group by b.item_code
     -- ⚠️ Most-burned first, then by code: `count desc` alone is not a total order, so two items
     -- with the same count could swap between calls and the grid would reshuffle on every open.
     order by count(*) desc, b.item_code asc;
end;
$$;

comment on function public.my_collection() is
  'The Collection screen (SCRUM-151): the CALLER''S OWN burns grouped by catalogue item, most-burned first. SECURITY DEFINER because burns is server-written with no client policy; scoped to auth.uid() in the WHERE clause. CATALOGUE ITEMS ONLY — photo burns are excluded because the board draws item art, not thumbnails. The count is a live count(*), never a cached tally.';

revoke all on function public.my_collection() from public;
revoke all on function public.my_collection() from anon;
grant execute on function public.my_collection() to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- MY COLLECTION TOTALS — the two stat cards
--
-- ⚠️ **A SECOND FUNCTION, NOT A SECOND DERIVATION IN THE SCREEN.** The cards read *"24 offerings
-- burned"* and *"8 items collected"*. `items_collected` IS the grid's row count, so the client
-- could count the array — but `offerings_burned` counts **every** burn, including the photo burns
-- the grid deliberately omits. Deriving one from the other would silently equate them.
--
-- ⚠️ **THE BOARD'S OWN NUMBERS ARE ILLUSTRATIVE, AND THE CONSTRAINT IS THE AUTHORITY.** `EN · 8`
-- draws *items collected 8*, but the catalogue has **five** offerings, so 8 is unreachable — and
-- the board also draws a *Family Car*, which is not a catalogue item at all. The function returns
-- what is true; the board's numbers are filed as a deviation rather than copied.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.my_collection_totals()
returns table (offerings_burned integer, items_collected integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  return query
    select
      -- ⚠️ EVERY burn — the note under the grid promises *"Every offering you burn is kept here."*
      count(*)::integer,
      -- ⚠️ DISTINCT catalogue items only, so the card and the grid cannot disagree.
      count(distinct b.item_code)::integer
    from public.burns b
   where b.user_id = v_uid;
end;
$$;

comment on function public.my_collection_totals() is
  'The Collection screen''s two stat cards (SCRUM-151). offerings_burned counts EVERY burn of the caller; items_collected counts DISTINCT catalogue items, matching the grid''s rows. SECURITY DEFINER, scoped to auth.uid(). EN . 8 draws items collected 8, but the catalogue holds five offerings, so the board''s numbers are illustrative and this returns what is true.';

revoke all on function public.my_collection_totals() from public;
revoke all on function public.my_collection_totals() from anon;
grant execute on function public.my_collection_totals() to authenticated;
