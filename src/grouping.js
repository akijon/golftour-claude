/**
 * Pure grouping and tee time calculations for golftour-claude.
 */

/**
 * Calculates group sizes based on grouping rules:
 * - n < 3: no groups ([])
 * - n == 5: impossible ([])
 * - threes = (4 - (n % 4)) % 4
 * - fours = (n - 3 * threes) / 4
 * Returns an array of group sizes with 3-man groups first, then 4-man groups.
 *
 * @param {number} n - Number of valid signups
 * @returns {number[]} Array of group sizes
 */
export function calculateGroupSizes(n) {
  if (n < 3 || n === 5) {
    return []
  }

  const threes = (4 - (n % 4)) % 4
  const fours = (n - 3 * threes) / 4

  const groups = []
  for (let i = 0; i < threes; i++) {
    groups.push(3)
  }
  for (let i = 0; i < fours; i++) {
    groups.push(4)
  }

  return groups
}

/**
 * Adds minutes to an HH:MM[:SS] time string and returns HH:MM.
 * Rolls over correctly across hours and days.
 *
 * @param {string|null} timeStr - Time string (e.g. '15:30:00' or '15:30')
 * @param {number} minutesToAdd - Minutes to add
 * @returns {string|null} Formatted time string (HH:MM) or null if input is null
 */
export function addMinutesToTime(timeStr, minutesToAdd) {
  if (!timeStr) return null

  const parts = timeStr.split(':')
  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1], 10)

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null

  const totalMinutes = hours * 60 + minutes + minutesToAdd
  // Modulo with positive remainder handling
  const normalizedMinutes = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60)

  const newHours = Math.floor(normalizedMinutes / 60)
  const newMinutes = normalizedMinutes % 60

  const hh = String(newHours).padStart(2, '0')
  const mm = String(newMinutes).padStart(2, '0')

  return `${hh}:${mm}`
}

/**
 * Groups signups for a round.
 *
 * @param {Array} signups - Round signups
 * @param {Object} round - Round object (contains tee_time)
 * @param {Array} players - List of all players to resolve player details
 * @returns {{ impossibleNotice: boolean, groups: Array, validSignups: Array }}
 */
export function groupSignups(signups, round, players) {
  // Filter signups to only those whose player_id matches a known player
  const validSignupsWithPlayer = []
  for (const s of signups) {
    const p = players.find(cand => cand.id === s.player_id)
    if (p) {
      validSignupsWithPlayer.push({ signup: s, player: p })
    }
  }

  // Sort deterministically by created_at ascending, tiebreak by id ascending
  validSignupsWithPlayer.sort((a, b) => {
    const dateA = a.signup.created_at || ''
    const dateB = b.signup.created_at || ''
    if (dateA < dateB) return -1
    if (dateA > dateB) return 1
    return (a.signup.id || 0) - (b.signup.id || 0)
  })

  const n = validSignupsWithPlayer.length
  const isImpossible = n === 5
  const groupSizes = calculateGroupSizes(n)

  if (groupSizes.length === 0) {
    return {
      impossibleNotice: isImpossible,
      groups: [],
      validSignups: validSignupsWithPlayer,
    }
  }

  const groups = []
  let offset = 0

  groupSizes.forEach((size, index) => {
    const groupItems = validSignupsWithPlayer.slice(offset, offset + size)
    offset += size

    const teeTime = round?.tee_time ? addMinutesToTime(round.tee_time, index * 8) : null

    groups.push({
      groupNumber: index + 1,
      teeTime,
      signups: groupItems.map(item => item.signup),
      players: groupItems.map(item => item.player),
      items: groupItems,
    })
  })

  return {
    impossibleNotice: false,
    groups,
    validSignups: validSignupsWithPlayer,
  }
}

// ---------------------------------------------------------------------------
// Manual override support.
//
// An override is a compact, persistable description of a round's groups:
//   { version: 1, groups: [{ teeTime: '15:30' | null, playerIds: [1,2,3] }] }
// Stored in app_settings under key `round_groupings_<round_id>`. Rendered by
// resolveGrouping(). All of this is pure — no DOM, no Supabase calls.
// ---------------------------------------------------------------------------

export const OVERRIDE_VERSION = 1
export const OVERRIDE_KEY_PREFIX = 'round_groupings_'

export function overrideKey(roundId) {
  return `${OVERRIDE_KEY_PREFIX}${roundId}`
}

// Returns a normalized 'HH:MM' string, or null for null/undefined. Invalid
// non-null values also map to null so callers can fall back to round-derived
// times.
function validTime(t) {
  if (t === null || t === undefined) return null
  const m = /^(\d{2}):(\d{2})$/.exec(String(t))
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return String(t)
}

/**
 * Validates an override object. Returns { ok, errors }.
 * Rejects: missing/non-array groups, out-of-shape group entries, duplicate
 * player ids across groups, and malformed tee times.
 *
 * @param {Object} override
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateOverride(override) {
  if (!override || typeof override !== 'object' || !Array.isArray(override.groups)) {
    return { ok: false, errors: ['invalid override'] }
  }
  const seen = new Set()
  const errors = []
  override.groups.forEach((g, i) => {
    if (!g || !Array.isArray(g.playerIds)) {
      errors.push(`group ${i + 1}: missing player list`)
      return
    }
    for (const pid of g.playerIds) {
      if (typeof pid !== 'number' && typeof pid !== 'string') {
        errors.push(`group ${i + 1}: invalid player id`)
        continue
      }
      const key = String(pid)
      if (seen.has(key)) errors.push(`group ${i + 1}: duplicate player ${key}`)
      seen.add(key)
    }
    if (g.teeTime != null && validTime(g.teeTime) === null) {
      errors.push(`group ${i + 1}: invalid tee time`)
    }
  })
  return { ok: errors.length === 0, errors }
}

/**
 * Parses app_settings rows into a map { roundId: override }, keeping only rows
 * whose key matches `round_groupings_<id>` and whose value is a non-empty
 * override. Rows written as a "reset" sentinel (groups === null) are skipped so
 * they fall back to automatic grouping.
 *
 * @param {Array} rows - app_settings rows ({ key, value })
 * @returns {Object} Map of roundId string -> override object
 */
export function groupingsFromStore(rows) {
  const result = {}
  for (const row of rows || []) {
    const m = new RegExp(`^${OVERRIDE_KEY_PREFIX}(\\d+)$`).exec(row?.key || '')
    if (!m) continue
    const value = row?.value
    if (!value || typeof value !== 'object' || !Array.isArray(value.groups)) continue
    result[m[1]] = value
  }
  return result
}

/**
 * Builds the default (automatic) override shape for a round, used as the
 * admin editor's starting point. When automatic grouping is impossible (n === 5)
 * or trivially small (1–2), it suggests a workable grouping so an admin CAN make
 * a manual override (3+2 for five signups, single group otherwise).
 *
 * @param {Array} signups - The round's signups
 * @param {Object|null} round - Round object (tee_time)
 * @param {Array} players - All players
 * @returns {Object} { version, groups }
 */
export function buildDefaultOverride(signups, round, players) {
  const auto = groupSignups(signups, round, players)
  let groups

  if (auto.groups.length > 0) {
    groups = auto.groups.map(g => ({ teeTime: g.teeTime, playerIds: g.players.map(p => p.id) }))
  } else if (auto.validSignups.length > 0) {
    const n = auto.validSignups.length
    const sizes = n === 5 ? [3, 2] : [n] // n in {1, 2} otherwise
    groups = []
    let offset = 0
    sizes.forEach((size, i) => {
      const playerIds = auto.validSignups.slice(offset, offset + size).map(item => item.player.id)
      offset += size
      groups.push({ teeTime: round?.tee_time ? addMinutesToTime(round.tee_time, i * 8) : null, playerIds })
    })
  } else {
    groups = []
  }

  return { version: OVERRIDE_VERSION, groups }
}

/**
 * Reconstructs display groups from a stored override, reconciling reality:
 * - players listed in the override who are no longer signed up (or no longer
 *   exist) are dropped from their group;
 * - signups that are not in any override group (e.g. added after the override
 *   was saved) are returned in `unassigned` so they stay visible.
 *
 * @param {Array} signups - The round's signups
 * @param {Object|null} round - Round object (tee_time fallback for null times)
 * @param {Array} players - All players
 * @param {Object} override - Stored override
 * @returns {{ groups: Array, unassigned: Array, validSignups: Array }}
 */
export function applyOverride(signups, round, players, override) {
  const byPlayerId = new Map()
  for (const s of signups) {
    const p = players.find(cand => cand.id === s.player_id)
    if (p) byPlayerId.set(String(s.player_id), { signup: s, player: p })
  }

  const used = new Set()
  const groups = (override?.groups || []).map((g, i) => {
    const items = []
    for (const pid of (g?.playerIds || [])) {
      const item = byPlayerId.get(String(pid))
      if (!item) continue
      used.add(String(pid))
      items.push(item)
    }
    const teeTime = validTime(g?.teeTime) ?? (round?.tee_time ? addMinutesToTime(round.tee_time, i * 8) : null)
    return {
      groupNumber: i + 1,
      teeTime,
      signups: items.map(it => it.signup),
      players: items.map(it => it.player),
      items,
    }
  })

  const unassigned = []
  for (const item of byPlayerId.values()) {
    if (!used.has(String(item.player.id))) unassigned.push(item)
  }
  unassigned.sort((a, b) => {
    const dateA = a.signup.created_at || ''
    const dateB = b.signup.created_at || ''
    if (dateA < dateB) return -1
    if (dateA > dateB) return 1
    return (a.signup.id || 0) - (b.signup.id || 0)
  })

  return {
    groups,
    unassigned,
    validSignups: [...groups.flatMap(g => g.items), ...unassigned],
  }
}

/**
 * Unified resolver used by the roster. Applies a stored override when present;
 * otherwise falls back to automatic grouping.
 *
 * @param {Array} signups
 * @param {Object|null} round
 * @param {Array} players
 * @param {Object|null} override
 * @returns {{ impossibleNotice: boolean, groups: Array, validSignups: Array, unassigned: Array }}
 */
export function resolveGrouping(signups, round, players, override) {
  if (override) {
    const r = applyOverride(signups, round, players, override)
    return { impossibleNotice: false, groups: r.groups, validSignups: r.validSignups, unassigned: r.unassigned }
  }
  const auto = groupSignups(signups, round, players)
  return { impossibleNotice: auto.impossibleNotice, groups: auto.groups, validSignups: auto.validSignups, unassigned: [] }
}
