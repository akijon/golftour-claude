-- Migration 001: handicap + golfbox_id on players
-- Run in Supabase SQL Editor if the database already exists.
-- (New installs get these via supabase-setup.sql and can skip this.)

alter table players add column if not exists handicap numeric(4,1);
alter table players add column if not exists golfbox_id text;
