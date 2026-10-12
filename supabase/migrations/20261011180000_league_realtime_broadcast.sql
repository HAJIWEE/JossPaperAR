-- ═══════════════════════════════════════════════════════════════════════════
-- THE LIVE BOARD'S PUBLISHER  (SCRUM-11 step 6 · doc 18 E7 "board re-ranks live")
--
-- WHY THE SERVER HAS TO DO THIS, AND WHY IT IS A BROADCAST
--   The client subscribes to the topic `league:{cohort_id}`. It CANNOT watch the
--   data it is displaying: the weekly points come from `ledger_events`, whose RLS
--   is OWN-ROWS-ONLY (`ledger_select_own`), so a `postgres_changes` subscription
--   there would deliver only the viewer's own awards and the board would never
--   move for anyone else — a live feature that looks live and is not.
--
--   So the PUBLISHER is SECURITY DEFINER, because it may read which cohort a user
--   is in; the SUBSCRIBER is not, because it only learns "this cohort changed" and
--   then re-fetches `get_league_board()` under its own RLS. The board stays exactly
--   as permissioned as it was.
--
-- ⚠️ THE PAYLOAD CARRIES NO CONTENT — a cohort id the subscriber already holds and a
--   timestamp. That is what makes a public topic (`private := false`) defensible:
--   nothing is disclosed beyond "this cohort had activity", and the board itself is
--   still fetched under RLS. ⚠️ Note `realtime.send` defaults `private` to TRUE, so
--   `false` must be passed explicitly — the default would make the client's plain
--   `channel()` subscription receive nothing, silently.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.league_broadcast_award()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cohort uuid;
begin
  -- Points are AWARDS. A spend, a refund or a decay moves no board.
  if new.type <> 'award' or new.currency <> 'tribute' then
    return new;
  end if;

  -- The cohort this user is in for the ACTIVE week. `status` is the vocabulary the
  -- schema fixes ('active' · 'rolling' · 'closed') — a rolling or closed week is not
  -- a board anyone is looking at.
  select c.id into v_cohort
    from public.league_weeks w
    join public.cohorts c        on c.week_id = w.id
    join public.cohort_members m on m.cohort_id = c.id
   where w.status = 'active'
     and m.user_id = new.user_id
   limit 1;

  -- ⚠️ NOT PLACED IS NOT AN ERROR. Most awards in a fresh install land here, and
  --    raising would turn an ordinary burn into a failed one. There is simply no
  --    board to move, so there is nothing to announce.
  if v_cohort is null then
    return new;
  end if;

  perform realtime.send(
    jsonb_build_object('cohort_id', v_cohort, 'at', now()),
    'board_changed',                       -- must equal LEAGUE_CHANGED_EVENT on the client
    'league:' || v_cohort::text,           -- must equal leagueTopic() on the client
    false);                                -- ⚠️ public topic; the default is TRUE

  return new;
end;
$$;

comment on function public.league_broadcast_award() is
  'AFTER INSERT on ledger_events: announces the cohort whose board moved, on the topic league:{cohort_id}. SECURITY DEFINER because it may resolve a membership; the payload carries NO content, so the client''s own RLS still governs what it can fetch. SCRUM-11 step 6.';

drop trigger if exists league_broadcast_award on public.ledger_events;
create trigger league_broadcast_award
  after insert on public.ledger_events
  for each row
  execute function public.league_broadcast_award();

-- Trigger functions are invoked by the table, never by a client — and this one is
-- SECURITY DEFINER, so an execute grant would be a privilege escalation.
revoke execute on function public.league_broadcast_award()
  from public, anon, authenticated, service_role;
