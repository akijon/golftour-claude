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
