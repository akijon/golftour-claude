-- migrations-002-admin.sql — admin roles, settings, soft delete, audit log.
-- Run once in Supabase SQL Editor. Idempotent where practical.
--
-- SECURITY MODEL: this app has no backend. The browser talks to Postgres
-- directly with the anon key, so every authorization rule MUST live in RLS.
-- Any check in React is advisory UI only and is trivially bypassed.

-- ---------------------------------------------------------------------------
-- 1. Roles
-- ---------------------------------------------------------------------------
-- Roles live in their own table keyed by auth.users.id rather than in
-- auth.users.raw_user_meta_data, because user metadata is self-writable: a
-- logged-in user can call updateUser() and set their own role to 'admin'.
-- A separate table with no public write policy cannot be escalated that way.
create table if not exists user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin')),
  created_at timestamptz not null default now()
);

alter table user_roles enable row level security;

-- is_admin() is SECURITY DEFINER so it can read user_roles from inside
-- policies on other tables without those callers needing read access to
-- user_roles itself. STABLE lets Postgres cache it per statement.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- Admins may read the roster of admins; nobody may write it from the client.
-- Grant the first admin manually (see bottom of this file).
drop policy if exists "admin read roles" on user_roles;
create policy "admin read roles" on user_roles
  for select to authenticated using (is_admin());

-- ---------------------------------------------------------------------------
-- 2. System settings (key/value)
-- ---------------------------------------------------------------------------
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table app_settings enable row level security;

-- Reads are public: the SPA needs settings before anyone logs in.
-- Do not store secrets here — anon key holders can read every row.
drop policy if exists "public read settings" on app_settings;
create policy "public read settings" on app_settings
  for select using (true);

drop policy if exists "admin write settings" on app_settings;
create policy "admin write settings" on app_settings
  for all to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- 3. Soft delete on players
-- ---------------------------------------------------------------------------
-- NOTE: players.active already existed and is filtered in App.jsx. The two
-- flags mean different things and are deliberately kept separate:
--   active     = reversible "hide from signup" toggle (seasonal absence)
--   deleted_at = removed by an admin, retains WHO and WHEN for audit
-- Hard DELETE is avoided because signups/scores FK to players with ON DELETE
-- CASCADE, so a real delete would silently erase historical standings.
alter table players add column if not exists deleted_at timestamptz;
alter table players add column if not exists deleted_by uuid references auth.users(id);

create index if not exists players_deleted_at_idx on players (deleted_at) where deleted_at is null;

-- Replace the blanket authenticated-write policy with admin-scoped writes.
drop policy if exists "auth write players" on players;

drop policy if exists "admin write players" on players;
create policy "admin write players" on players
  for all to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- 4. Audit log
-- ---------------------------------------------------------------------------
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,          -- 'player.soft_delete' | 'setting.update' | ...
  target_type text not null,     -- 'player' | 'setting'
  target_id text not null,
  detail jsonb,                  -- { old, new } where relevant
  created_at timestamptz not null default now()
);

alter table audit_log enable row level security;

create index if not exists audit_log_created_at_idx on audit_log (created_at desc);

-- Append-only from the client's perspective: admins read, nobody updates or
-- deletes. Writes happen inside the SECURITY DEFINER functions below, which
-- bypass RLS, so there is intentionally no INSERT policy here.
drop policy if exists "admin read audit" on audit_log;
create policy "admin read audit" on audit_log
  for select to authenticated using (is_admin());

-- ---------------------------------------------------------------------------
-- 5. Write RPCs
-- ---------------------------------------------------------------------------
-- The mutation and its audit row must be atomic: a soft delete that succeeds
-- while its log entry fails would leave an unexplained gap in the history.
-- Wrapping both in one function gives that atomicity in a single round trip
-- and prevents the client from forging actor_id, since auth.uid() is read
-- server-side. Each function re-checks is_admin() because SECURITY DEFINER
-- bypasses RLS.

create or replace function admin_soft_delete_player(p_player_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if not is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update players
     set deleted_at = now(), deleted_by = auth.uid()
   where id = p_player_id and deleted_at is null
   returning name into v_name;

  -- No row updated => already deleted or nonexistent. Treated as an error so
  -- the UI does not report a success it did not cause.
  if v_name is null then
    raise exception 'player not found or already deleted' using errcode = 'P0002';
  end if;

  insert into audit_log (actor_id, action, target_type, target_id, detail)
  values (auth.uid(), 'player.soft_delete', 'player', p_player_id::text,
          jsonb_build_object('name', v_name));
end;
$$;

create or replace function admin_restore_player(p_player_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update players set deleted_at = null, deleted_by = null
   where id = p_player_id and deleted_at is not null;

  if not found then
    raise exception 'player not found or not deleted' using errcode = 'P0002';
  end if;

  insert into audit_log (actor_id, action, target_type, target_id)
  values (auth.uid(), 'player.restore', 'player', p_player_id::text);
end;
$$;

create or replace function admin_set_setting(
  p_key text,
  p_value jsonb,
  p_description text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
begin
  if not is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select value into v_old from app_settings where key = p_key;

  insert into app_settings (key, value, description, updated_at, updated_by)
  values (p_key, p_value, p_description, now(), auth.uid())
  on conflict (key) do update
    set value = excluded.value,
        -- keep the existing description when the caller omits one
        description = coalesce(excluded.description, app_settings.description),
        updated_at = now(),
        updated_by = auth.uid();

  insert into audit_log (actor_id, action, target_type, target_id, detail)
  values (auth.uid(),
          case when v_old is null then 'setting.create' else 'setting.update' end,
          'setting', p_key,
          jsonb_build_object('old', v_old, 'new', p_value));
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Lock down RPC execution
-- ---------------------------------------------------------------------------
-- The functions above already raise 'forbidden' for non-admins, but PostgREST
-- exposes every public function at /rest/v1/rpc/*. Revoking EXECUTE rejects
-- anon at the API boundary so the in-function check is not the only barrier.
revoke execute on function admin_soft_delete_player(bigint) from anon, public;
revoke execute on function admin_restore_player(bigint) from anon, public;
revoke execute on function admin_set_setting(text, jsonb, text) from anon, public;
revoke execute on function is_admin() from anon, public;

grant execute on function admin_soft_delete_player(bigint) to authenticated;
grant execute on function admin_restore_player(bigint) to authenticated;
grant execute on function admin_set_setting(text, jsonb, text) to authenticated;
grant execute on function is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Grant the first admin  (REQUIRED — run manually, replace the email)
-- ---------------------------------------------------------------------------
-- insert into user_roles (user_id, role)
-- select id, 'admin' from auth.users where email = 'eldtur@khalipa.net'
-- on conflict (user_id) do nothing;
