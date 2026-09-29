-- migrations-006-seasons.sql — multi-season support and the 2027 season.
-- Run once in Supabase SQL Editor after migrations-005. Idempotent.
--
-- A round's season cannot be derived from round_date, because next season's
-- rounds are created before their dates are decided (round_date is null).

alter table rounds add column if not exists season int;
update rounds set season = extract(year from round_date)::int where season is null;
alter table rounds alter column season set not null;
alter table rounds alter column round_date drop not null;

create index if not exists rounds_season_idx on rounds (season);

-- 2027: five rounds, date and course to be decided by an admin later.
insert into rounds (title, course, round_date, season)
select 'Hringur ' || n, '', null, 2027
  from generate_series(1, 5) as n
 where not exists (select 1 from rounds where season = 2027);
