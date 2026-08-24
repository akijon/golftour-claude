-- migrations-003-player-crud.sql — audited admin create/update RPCs.
-- Run once in Supabase SQL Editor. Idempotent where practical.
--
-- SECURITY MODEL: this app has no backend. The browser talks to Postgres
-- directly with the anon key, so every authorization rule MUST live in RLS or
-- SECURITY DEFINER functions. React checks are advisory UI only.
--
-- MANUAL STEP: this file is intentionally not applied by the app or deployment.
-- A human must run the complete file in Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- 1. Create player
-- ---------------------------------------------------------------------------
-- position is text in the deployed players table (existing rows contain role
-- descriptions), so the RPC preserves that type while allowing an empty value.
create or replace function admin_create_player(
  p_name text,
  p_position text default '',
  p_active boolean default true,
  p_handicap numeric default null,
  p_golfbox_id text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_player players%rowtype;
begin
  if not is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_name = '' then
    raise exception 'player name is required' using errcode = '23514';
  end if;

  begin
    insert into players (name, position, active, handicap, golfbox_id)
    values (
      v_name,
      btrim(coalesce(p_position, '')),
      coalesce(p_active, true),
      p_handicap,
      nullif(btrim(p_golfbox_id), '')
    )
    returning * into v_player;
  exception
    when unique_violation then
      raise exception 'player name already exists' using errcode = '23505';
  end;

  insert into audit_log (actor_id, action, target_type, target_id, detail)
  values (
    auth.uid(),
    'player.create',
    'player',
    v_player.id::text,
    jsonb_build_object(
      'name', v_player.name,
      'position', v_player.position,
      'active', v_player.active,
      'handicap', v_player.handicap,
      'golfbox_id', v_player.golfbox_id
    )
  );

  return v_player.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Update player
-- ---------------------------------------------------------------------------
-- Soft-deleted players must be restored before they can be edited. active is a
-- separate seasonal signup toggle and remains editable here.
create or replace function admin_update_player(
  p_player_id bigint,
  p_name text,
  p_position text,
  p_active boolean,
  p_handicap numeric,
  p_golfbox_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_old players%rowtype;
  v_new players%rowtype;
begin
  if not is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_name = '' then
    raise exception 'player name is required' using errcode = '23514';
  end if;

  if p_active is null then
    raise exception 'player active state is required' using errcode = '23514';
  end if;

  select * into v_old
    from players
   where id = p_player_id and deleted_at is null
   for update;

  if not found then
    raise exception 'player not found or deleted' using errcode = 'P0002';
  end if;

  begin
    update players
       set name = v_name,
           position = btrim(coalesce(p_position, '')),
           active = p_active,
           handicap = p_handicap,
           golfbox_id = nullif(btrim(p_golfbox_id), '')
     where id = p_player_id
     returning * into v_new;
  exception
    when unique_violation then
      raise exception 'player name already exists' using errcode = '23505';
  end;

  insert into audit_log (actor_id, action, target_type, target_id, detail)
  values (
    auth.uid(),
    'player.update',
    'player',
    p_player_id::text,
    jsonb_build_object(
      'old', jsonb_build_object(
        'name', v_old.name,
        'position', v_old.position,
        'active', v_old.active,
        'handicap', v_old.handicap,
        'golfbox_id', v_old.golfbox_id
      ),
      'new', jsonb_build_object(
        'name', v_new.name,
        'position', v_new.position,
        'active', v_new.active,
        'handicap', v_new.handicap,
        'golfbox_id', v_new.golfbox_id
      )
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Lock down RPC execution
-- ---------------------------------------------------------------------------
-- PostgREST exposes public-schema functions at /rest/v1/rpc/*. Revoke the
-- default PUBLIC grant and reject anon before the in-function admin check.
revoke execute on function admin_create_player(text, text, boolean, numeric, text) from anon, public;
revoke execute on function admin_update_player(bigint, text, text, boolean, numeric, text) from anon, public;

grant execute on function admin_create_player(text, text, boolean, numeric, text) to authenticated;
grant execute on function admin_update_player(bigint, text, text, boolean, numeric, text) to authenticated;
