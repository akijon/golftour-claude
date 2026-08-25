-- ============================================
-- SHS Golfhópur 2026 — Supabase setup
-- Run this once in Supabase SQL Editor
-- ============================================

create table players (
  id bigint generated always as identity primary key,
  name text not null unique,
  position text not null default '',
  handicap numeric(4,1),
  golfbox_id text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table rounds (
  id bigint generated always as identity primary key,
  title text not null,
  course text not null default '',
  round_date date not null,
  tee_time time,
  max_players int,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table signups (
  id bigint generated always as identity primary key,
  round_id bigint not null references rounds(id) on delete cascade,
  player_id bigint not null references players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (round_id, player_id)
);

create table scores (
  id bigint generated always as identity primary key,
  round_id bigint not null references rounds(id) on delete cascade,
  player_id bigint not null references players(id) on delete cascade,
  points int not null check (points >= 0),
  position int,
  created_at timestamptz not null default now(),
  unique (round_id, player_id)
);

-- RLS: reads public and self-signup is public. Admin write policies are
-- installed after the role table and is_admin() function below.
alter table players enable row level security;
alter table rounds  enable row level security;
alter table signups enable row level security;
alter table scores  enable row level security;

create policy "public read players"   on players for select using (true);
create policy "public read rounds"    on rounds  for select using (true);
create policy "public read scores"    on scores  for select using (true);
create policy "public read signups"   on signups for select using (true);
create policy "public insert signups" on signups for insert to anon, authenticated with check (true);
create policy "public delete signups" on signups for delete to anon, authenticated using (true);

-- Seed: 58 players from golfhopur-2026 Excel
insert into players (name, position) values
('Margrét S. Sævarsdóttir', 'Launin okkar verða ekki til ef þessi væri ekki að vinna hjá SHS'),
('Aron Már Þórðarson', 'Slökkvari'),
('Atli Fannar Jónsson', 'Slökkvari'),
('Birkir Örn Skúlason', 'Slökkvari'),
('Björn Ingi Guðjónsson', 'Boss man'),
('Daði R. Skúlason', 'Slökkvari'),
('Einar Helgi Guðlaugsson', 'Reynslumesti Slökkvari SHS'),
('Einvarður M. Hermannsson', 'Nefndarmeðlimur'),
('Eva G. Georgiades', 'Búðingur'),
('Eyþór Leifsson', 'Boss man'),
('Finnur Hilmarsson', 'Boss man'),
('Gunnar Steinþórsson', 'Slökkvari'),
('Guðjón Ingason', 'Boss man'),
('Guðjón Petersen', 'Slökkvari'),
('Gylfi Dagur', 'Íslandsmeistari Slökkviliðsmanna 2026'),
('Halldór M. Hönnuson', 'Nefndarmeðlimur'),
('Haukur Jónsson', 'Eldtúrsmeistari 2026 og forgjöfin lækkaði!'),
('Jóhann Örn Ásgeirsson', 'Boss man'),
('Jón H. Sigurðsson', 'Nefndarmeðlimur'),
('Jón Haraldsson', 'Slökkvari'),
('Jón Reynir Magnússon', 'Slökkvari'),
('Jón Trausti Gylfason', 'Slökkvari'),
('Jónas Árnason', 'Boss man'),
('Lárus Petersen', 'Medic ONE'),
('Magnús Bjarnason', 'Slökkvari'),
('Pálmi Hlöðversson', 'Boss man'),
('Pétur Arnþórsson', 'Yfirmaður allra tækja hjá SHS'),
('Sigmundur Kornelíusson', 'Yfirmaður allra hjá SHS'),
('Sigurjón Ólafsson', 'Boss man'),
('Steinar Aronsson', 'Slökkvari'),
('Svavar Sigurðarson', 'Slökkvari'),
('Sævar Dór Halldórsson', 'Slökkvari'),
('Sævar Sigfússon', 'Slökkvari'),
('Áki Jónsson', 'Nefndarmeðlimur'),
('Árni Sigurðsson', 'Boss man'),
('Árni Ómar Árnason', 'Head Boss'),
('Ásgeir Halldórsson', 'The Boss'),
('Ásgeir Valur Flosason', 'Boss man'),
('Ólafur I. Grettisson', 'Head Boss'),
('Þorsteinn Gunnarsson', 'Nefndarstjóri'),
('Steinþór Darri Þorsteinsson', 'Boss man'),
('Ævar Örn Bergsson', 'Slökkvari'),
('Bjarni Ingimarsson', 'Slökkvari'),
('Breki Kjartansson', 'Slökkvari'),
('Oddur Eiríksson', 'retired'),
('Guðmundur Karl', 'retired'),
('Þórir Karl', 'retired'),
('Úlfur Árnason', 'Slökkvari'),
('Viktor retireee', 'retired'),
('Magnús Jón Kristófersson', 'retired'),
('Kristófer Bekk', 'Búðingur'),
('Erling Hugi', 'Búðingur'),
('Eyjólfur Tómedic', 'Slökkvari'),
('Carter', 'Slökkvari'),
('Sævar Ö H', 'Slökkvari'),
('Óliver Ormar Ingvarsson', 'Tölvudeild 2623'),
('Jóhanna Guðrún', 'Skrifstofa 2622'),
('Sigurjón Ingi', 'Slökkvari');

-- Seed: 5 rounds, summer 2026 (edit dates/courses in app afterwards)
insert into rounds (title, course, round_date, tee_time, notes) values
('Hringur 1', 'Grafarholt', '2026-05-29', '16:00', 'Fyrsti hringur sumarsins'),
('Hringur 2', 'Korpa', '2026-06-19', '16:00', ''),
('Hringur 3', 'Keilir', '2026-07-10', '16:00', ''),
('Hringur 4', 'Oddur', '2026-08-07', '16:00', ''),
('Hringur 5', 'Grafarholt', '2026-08-28', '15:00', 'Lokahringur + verðlaun');

-- ============================================
-- Current admin schema (included for fresh installs)
-- ============================================

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

-- migrations-004-admin-policy-hardening.sql — restrict round and score writes
-- to users explicitly assigned the admin role.
-- Run once in Supabase SQL Editor after migrations-002-admin.sql.

-- Remove the legacy policy that granted every authenticated account write access.
drop policy if exists "auth write rounds" on rounds;
drop policy if exists "auth write scores" on scores;

-- Recreating these policies is safe when this migration is re-run.
drop policy if exists "admin write rounds" on rounds;
drop policy if exists "admin write scores" on scores;

create policy "admin write rounds" on rounds
  for all to authenticated using (is_admin()) with check (is_admin());

create policy "admin write scores" on scores
  for all to authenticated using (is_admin()) with check (is_admin());
