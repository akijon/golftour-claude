import { test, expect } from '@playwright/test'
import {
  calculateGroupSizes,
  groupSignups,
  addMinutesToTime,
  applyOverride,
  buildDefaultOverride,
  validateOverride,
  groupingsFromStore,
  resolveGrouping,
  overrideKey,
} from '../src/grouping.js'

function makePlayers(n) {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Player ${i + 1}`, handicap: 10 + i }))
}

function makeSignups(ids, { startMin = 0 } = {}) {
  return ids.map((pid, i) => ({
    id: 1000 + pid,
    player_id: pid,
    created_at: `2026-06-01T10:${String(startMin + i).padStart(2, '0')}:00Z`,
  }))
}

test.describe('grouping algorithm (unit)', () => {
  test('edge cases: n < 3 and n == 5 have no groups', () => {
    expect(calculateGroupSizes(0)).toEqual([])
    expect(calculateGroupSizes(1)).toEqual([])
    expect(calculateGroupSizes(2)).toEqual([])
    expect(calculateGroupSizes(5)).toEqual([])
  })

  test('group sizes matching table from n=3 to n=21', () => {
    const table = {
      3: [3],
      4: [4],
      6: [3, 3],
      7: [3, 4],
      8: [4, 4],
      9: [3, 3, 3],
      10: [3, 3, 4],
      11: [3, 4, 4],
      12: [4, 4, 4],
      13: [3, 3, 3, 4],
      14: [3, 3, 4, 4],
      15: [3, 4, 4, 4],
      16: [4, 4, 4, 4],
      17: [3, 3, 3, 4, 4],
      18: [3, 3, 4, 4, 4],
      19: [3, 4, 4, 4, 4],
      20: [4, 4, 4, 4, 4],
      21: [3, 3, 3, 4, 4, 4],
    }

    for (const [nStr, expected] of Object.entries(table)) {
      const n = Number(nStr)
      expect(calculateGroupSizes(n), `n=${n}`).toEqual(expected)
    }
  })

  test('time increment and rollover', () => {
    expect(addMinutesToTime('15:30:00', 0)).toBe('15:30')
    expect(addMinutesToTime('15:30:00', 8)).toBe('15:38')
    expect(addMinutesToTime('15:30:00', 16)).toBe('15:46')
    expect(addMinutesToTime('15:30:00', 24)).toBe('15:54')
    expect(addMinutesToTime('15:55:00', 8)).toBe('16:03')
    expect(addMinutesToTime('23:55:00', 10)).toBe('00:05')
    expect(addMinutesToTime(null, 8)).toBe(null)
  })

  test('groupSignups assigns players deterministically and with correct tee times', () => {
    const players = [
      { id: 1, name: 'Player 1', handicap: 10 },
      { id: 2, name: 'Player 2', handicap: 12 },
      { id: 3, name: 'Player 3', handicap: 14 },
      { id: 4, name: 'Player 4', handicap: 16 },
      { id: 5, name: 'Player 5', handicap: 18 },
      { id: 6, name: 'Player 6', handicap: 20 },
      { id: 7, name: 'Player 7', handicap: 22 },
    ]

    const signups = [
      { id: 103, player_id: 3, created_at: '2026-06-01T10:02:00Z' },
      { id: 101, player_id: 1, created_at: '2026-06-01T10:00:00Z' },
      { id: 105, player_id: 5, created_at: '2026-06-01T10:04:00Z' },
      { id: 102, player_id: 2, created_at: '2026-06-01T10:01:00Z' },
      { id: 104, player_id: 4, created_at: '2026-06-01T10:03:00Z' },
      { id: 107, player_id: 7, created_at: '2026-06-01T10:06:00Z' },
      { id: 106, player_id: 6, created_at: '2026-06-01T10:05:00Z' },
    ]

    const round = { id: 1, tee_time: '15:30:00' }
    const result = groupSignups(signups, round, players)

    expect(result.impossibleNotice).toBe(false)
    expect(result.groups).toHaveLength(2)

    // Group 1: 3 players, 15:30
    expect(result.groups[0].groupNumber).toBe(1)
    expect(result.groups[0].teeTime).toBe('15:30')
    expect(result.groups[0].players.map(p => p.id)).toEqual([1, 2, 3])

    // Group 2: 4 players, 15:38
    expect(result.groups[1].groupNumber).toBe(2)
    expect(result.groups[1].teeTime).toBe('15:38')
    expect(result.groups[1].players.map(p => p.id)).toEqual([4, 5, 6, 7])
  })

  test('groupSignups handles n=5 impossible notice', () => {
    const players = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: `Player ${i + 1}` }))
    const signups = players.map(p => ({ id: p.id, player_id: p.id, created_at: '2026-06-01T10:00:00Z' }))
    const round = { id: 1, tee_time: '15:30:00' }
    const result = groupSignups(signups, round, players)

    expect(result.impossibleNotice).toBe(true)
    expect(result.groups).toEqual([])
  })

  test('groupSignups handles null tee_time', () => {
    const players = Array.from({ length: 4 }, (_, i) => ({ id: i + 1, name: `Player ${i + 1}` }))
    const signups = players.map(p => ({ id: p.id, player_id: p.id, created_at: '2026-06-01T10:00:00Z' }))
    const round = { id: 1, tee_time: null }
    const result = groupSignups(signups, round, players)

    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].teeTime).toBe(null)
  })
})

test.describe('manual override (unit)', () => {
  test('overrideKey and groupingsFromStore parse app_settings rows', () => {
    expect(overrideKey(7)).toBe('round_groupings_7')

    const rows = [
      { key: 'round_groupings_3', value: { version: 1, groups: [{ teeTime: '15:30', playerIds: [1, 2] }] } },
      { key: 'round_groupings_4', value: { version: 1, groups: null } }, // reset sentinel
      { key: 'other_setting', value: { foo: 1 } }, // unrelated key
      { key: 'round_groupings_abc', value: { groups: [1] } }, // non-numeric id
      null,
    ]
    const parsed = groupingsFromStore(rows)
    expect(Object.keys(parsed)).toEqual(['3'])
    expect(parsed[3].groups).toHaveLength(1)
  })

  test('buildDefaultOverride mirrors automatic grouping (n=7 sizes 3,4)', () => {
    const players = makePlayers(7)
    const signups = makeSignups([1, 2, 3, 4, 5, 6, 7])
    const round = { id: 1, tee_time: '15:30:00' }
    const ov = buildDefaultOverride(signups, round, players)

    expect(ov.groups.map(g => g.playerIds)).toEqual([[1, 2, 3], [4, 5, 6, 7]])
    expect(ov.groups[0].teeTime).toBe('15:30')
    expect(ov.groups[1].teeTime).toBe('15:38')
  })

  test('buildDefaultOverride suggests a 3+2 split for n=5 so it can be edited', () => {
    const players = makePlayers(5)
    const signups = makeSignups([1, 2, 3, 4, 5])
    const round = { id: 1, tee_time: '15:30:00' }
    const ov = buildDefaultOverride(signups, round, players)

    expect(ov.groups.map(g => g.playerIds)).toEqual([[1, 2, 3], [4, 5]])
  })

  test('applyOverride renders groups in override order and honors stored tee times', () => {
    const players = makePlayers(7)
    const signups = makeSignups([1, 2, 3, 4, 5, 6])
    const round = { id: 1, tee_time: '15:30:00' }
    const override = {
      version: 1,
      groups: [
        { teeTime: '15:30', playerIds: [3, 1] }, // order preserved, not signup order
        { teeTime: null, playerIds: [2] }, // null → fall back to round-derived (15:30 + 8)
        { teeTime: '12:00', playerIds: [9] }, // player 9 not signed up → dropped
      ],
    }
    const { groups, unassigned, validSignups } = applyOverride(signups, round, players, override)

    expect(groups).toHaveLength(3)
    expect(groups[0].teeTime).toBe('15:30')
    expect(groups[0].players.map(p => p.id)).toEqual([3, 1])
    expect(groups[1].teeTime).toBe('15:38')
    expect(groups[1].players.map(p => p.id)).toEqual([2])
    expect(groups[2].players).toEqual([]) // dropped player 9

    // 1, 2, 3 are grouped; 4, 5, 6 are not in the override → unassigned
    expect(unassigned.map(u => u.player.id)).toEqual([4, 5, 6])
    expect(validSignups).toHaveLength(6)
    expect(groups[0].groupNumber).toBe(1)
  })

  test('validateOverride rejects duplicates, bad times, malformed shapes', () => {
    expect(validateOverride(null).ok).toBe(false)
    expect(validateOverride({}).ok).toBe(false)
    expect(validateOverride({ version: 1, groups: 'nope' }).ok).toBe(false)

    const dup = {
      version: 1,
      groups: [{ teeTime: '15:30', playerIds: [1, 2] }, { teeTime: null, playerIds: [2, 3] }],
    }
    const dupResult = validateOverride(dup)
    expect(dupResult.ok).toBe(false)
    expect(dupResult.errors[0]).toContain('duplicate')

    const badTime = { version: 1, groups: [{ teeTime: '25:99', playerIds: [1] }] }
    expect(validateOverride(badTime).ok).toBe(false)

    const good = { version: 1, groups: [{ teeTime: '15:30', playerIds: [1, 2] }, { teeTime: null, playerIds: [3] }] }
    expect(validateOverride(good).ok).toBe(true)
  })

  test('resolveGrouping uses override when present, automatic otherwise', () => {
    const players = makePlayers(13)
    const signups = makeSignups(Array.from({ length: 13 }, (_, i) => i + 1))
    const round = { id: 10, tee_time: '15:30:00' }

    // Without an override: automatic 3/3/3/4, no unassigned.
    const auto = resolveGrouping(signups, round, players, null)
    expect(auto.groups.map(g => g.players.length)).toEqual([3, 3, 3, 4])
    expect(auto.unassigned).toEqual([])

    // With an override: overridden group sizes and tee times, players not in the
    // override surface as unassigned.
    const override = {
      version: 1,
      groups: [
        { teeTime: '11:00', playerIds: [1, 2, 3, 4, 5, 6] },
        { teeTime: '11:20', playerIds: [7, 8, 9, 10] },
      ],
    }
    const manual = resolveGrouping(signups, round, players, override)
    expect(manual.impossibleNotice).toBe(false)
    expect(manual.groups.map(g => g.players.length)).toEqual([6, 4])
    expect(manual.groups[0].teeTime).toBe('11:00')
    expect(manual.groups[1].teeTime).toBe('11:20')
    expect(manual.unassigned.map(u => u.player.id)).toEqual([11, 12, 13])
  })
})
