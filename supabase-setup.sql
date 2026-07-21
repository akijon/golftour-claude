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

-- RLS: reads public; self-signup public; all other writes need Supabase Auth.
-- Create the admin user in Dashboard -> Authentication and DISABLE public
-- sign-ups, since any authenticated user gets write access.
alter table players enable row level security;
alter table rounds  enable row level security;
alter table signups enable row level security;
alter table scores  enable row level security;

create policy "public read players"   on players for select using (true);
create policy "auth write players"    on players for all to authenticated using (true) with check (true);
create policy "public read rounds"    on rounds  for select using (true);
create policy "auth write rounds"     on rounds  for all to authenticated using (true) with check (true);
create policy "public read scores"    on scores  for select using (true);
create policy "auth write scores"     on scores  for all to authenticated using (true) with check (true);
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
