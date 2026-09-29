import { expect, test } from '@playwright/test'
import fs from 'node:fs'

const root = new URL('../', import.meta.url)
const read = name => fs.readFileSync(new URL(name, root), 'utf8')

test('fresh-install schema includes the complete admin schema', () => {
  const sql = read('supabase-setup.sql').toLowerCase()

  for (const required of [
    'create table if not exists user_roles',
    'create table if not exists app_settings',
    'create table if not exists audit_log',
    'add column if not exists deleted_at',
    'create or replace function admin_create_player',
    'create or replace function admin_update_player',
    'create or replace function admin_soft_delete_player',
    'create or replace function admin_restore_player',
    'create or replace function admin_set_setting',
  ]) {
    expect(sql).toContain(required)
  }
})

test('current and fresh schemas restrict round and score writes to admins', () => {
  const migration = read('migrations-004-admin-policy-hardening.sql').toLowerCase()
  const setup = read('supabase-setup.sql').toLowerCase()

  for (const sql of [migration, setup]) {
    expect(sql).toContain('drop policy if exists "auth write rounds" on rounds')
    expect(sql).toContain('drop policy if exists "auth write scores" on scores')
    expect(sql).toContain('create policy "admin write rounds" on rounds')
    expect(sql).toContain('create policy "admin write scores" on scores')
    expect(sql).toContain('using (is_admin()) with check (is_admin())')
  }
})

test('current and fresh schemas route signups through validated RPCs', () => {
  const migration = read('migrations-005-signup-hardening.sql').toLowerCase()
  const setup = read('supabase-setup.sql').toLowerCase()

  expect(setup).not.toContain('create policy "public insert signups"')
  expect(setup).not.toContain('create policy "public delete signups"')

  for (const sql of [migration, setup]) {
    for (const legacy of ['public write players', 'public write rounds', 'public write signups',
      'public insert signups', 'public delete signups']) {
      expect(sql).toContain(`drop policy if exists "${legacy}"`)
    }
    expect(sql).toContain('create or replace function signup_player')
    expect(sql).toContain('create or replace function unsignup_player')
    expect(sql).toContain("raise exception 'round is full'")
    expect(sql).toContain('where id = p_player_id and active and deleted_at is null')
    expect(sql).toContain('for select using (deleted_at is null)')
  }
})
