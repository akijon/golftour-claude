import { supabase } from './supabase'

// Data access for admin-only actions. Every function here calls a Postgres
// RPC that re-checks is_admin() server-side — these wrappers are convenience,
// not security. See migrations-002-admin.sql.

export async function fetchIsAdmin() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  // Reading own row succeeds only for admins (RLS), so "row found" == admin.
  const { data } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
  return data?.role === 'admin'
}

export async function fetchSettings() {
  const { data, error } = await supabase
    .from('app_settings').select('*').order('key')
  if (error) throw error
  return data
}

export async function saveSetting(key, value, description = null) {
  // value is jsonb: send real JSON types, not strings.
  const { error } = await supabase.rpc('admin_set_setting', {
    p_key: key, p_value: value, p_description: description,
  })
  if (error) throw error
}

export async function fetchAdminPlayers() {
  const { data, error } = await supabase
    .from('players').select('*').order('name')
  if (error) throw error
  return data ?? []
}

export async function createPlayer(player) {
  const { data, error } = await supabase.rpc('admin_create_player', {
    p_name: player.name,
    p_position: player.position,
    p_active: player.active,
    p_handicap: player.handicap,
    p_golfbox_id: player.golfbox_id,
  })
  if (error) throw error
  return data
}

export async function updatePlayer(playerId, player) {
  const { error } = await supabase.rpc('admin_update_player', {
    p_player_id: playerId,
    p_name: player.name,
    p_position: player.position,
    p_active: player.active,
    p_handicap: player.handicap,
    p_golfbox_id: player.golfbox_id,
  })
  if (error) throw error
}

export async function softDeletePlayer(playerId) {
  const { error } = await supabase.rpc('admin_soft_delete_player', {
    p_player_id: playerId,
  })
  if (error) throw error
}

export async function restorePlayer(playerId) {
  const { error } = await supabase.rpc('admin_restore_player', {
    p_player_id: playerId,
  })
  if (error) throw error
}

export async function fetchAuditLog(limit = 50) {
  const { data, error } = await supabase
    .from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data
}
