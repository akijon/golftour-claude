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
