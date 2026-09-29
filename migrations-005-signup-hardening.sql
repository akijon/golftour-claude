-- migrations-005-signup-hardening.sql — move public signup writes behind
-- validated, audited RPCs and hide soft-deleted players from public reads.
-- Run once in Supabase SQL Editor after migrations-004. Idempotent.
--
-- SECURITY MODEL: signups have no identity by design (player picks their name),
-- so anon cannot be stopped from toggling a given player's signup. What this
-- migration removes is the unbounded table access: with "using (true)" policies
-- a single `DELETE /signups?id=gt.0` erased every signup without a trace, and
-- inserts skipped every rule the UI enforces (active player, future round,
-- max_players). The RPCs below touch exactly one row per call, enforce those
-- rules server-side, and write each change to audit_log.

-- ---------------------------------------------------------------------------
-- 1. Legacy policies
-- ---------------------------------------------------------------------------
-- The original schema granted anon full write access under these names. No
-- earlier migration in this repo drops them; drop defensively so a database
-- created from the first setup script cannot keep them alongside the admin
-- policies (permissive policies are OR-ed together).
drop policy if exists "public write players" on players;
drop policy if exists "public write rounds" on rounds;
drop policy if exists "public write signups" on signups;

-- ---------------------------------------------------------------------------
-- 2. Signups: RPC-only writes
-- ---------------------------------------------------------------------------
drop policy if exists "public insert signups" on signups;
drop policy if exists "public delete signups" on signups;

create or replace function signup_player(p_round_id bigint, p_player_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round rounds%rowtype;
  v_count int;
begin
  -- Lock the round so concurrent signups cannot both pass the capacity check.
  select * into v_round from rounds where id = p_round_id for update;
  if not found then
    raise exception 'round not found' using errcode = 'P0002';
  end if;

  if v_round.round_date < current_date then
    raise exception 'round has already been played' using errcode = '23514';
  end if;

  if not exists (
    select 1 from players
     where id = p_player_id and active and deleted_at is null
  ) then
    raise exception 'player cannot sign up' using errcode = '23514';
  end if;

  if v_round.max_players is not null then
    select count(*) into v_count from signups where round_id = p_round_id;
    if v_count >= v_round.max_players then
      raise exception 'round is full' using errcode = '23514';
    end if;
  end if;

  -- unique (round_id, player_id) rejects a duplicate signup.
  insert into signups (round_id, player_id) values (p_round_id, p_player_id);

  insert into audit_log (actor_id, action, target_type, target_id, detail)
  values (auth.uid(), 'signup.create', 'signup', p_round_id::text,
          jsonb_build_object('round_id', p_round_id, 'player_id', p_player_id));
end;
$$;

create or replace function unsignup_player(p_round_id bigint, p_player_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round_date date;
begin
  select round_date into v_round_date from rounds where id = p_round_id;
  if not found then
    raise exception 'round not found' using errcode = 'P0002';
  end if;

  -- Past rosters are history (scores are entered against them).
  if v_round_date < current_date then
    raise exception 'round has already been played' using errcode = '23514';
  end if;

  delete from signups where round_id = p_round_id and player_id = p_player_id;
  if not found then
    raise exception 'signup not found' using errcode = 'P0002';
  end if;

  insert into audit_log (actor_id, action, target_type, target_id, detail)
  values (auth.uid(), 'signup.delete', 'signup', p_round_id::text,
          jsonb_build_object('round_id', p_round_id, 'player_id', p_player_id));
end;
$$;

-- Self-signup is public by design, so anon keeps EXECUTE on these two.
revoke execute on function signup_player(bigint, bigint) from public;
revoke execute on function unsignup_player(bigint, bigint) from public;
grant execute on function signup_player(bigint, bigint) to anon, authenticated;
grant execute on function unsignup_player(bigint, bigint) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Players: hide soft-deleted rows from the public
-- ---------------------------------------------------------------------------
-- Soft-deleted rows carry deleted_by (an admin's auth user id). Live rows have
-- deleted_by null, so a row filter is enough. Admins still see every row via
-- the "admin write players" policy, which is FOR ALL and so covers SELECT.
drop policy if exists "public read players" on players;
create policy "public read players" on players
  for select using (deleted_at is null);
