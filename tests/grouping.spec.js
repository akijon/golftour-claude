import { test, expect } from '@playwright/test'
import { calculateGroupSizes, groupSignups, addMinutesToTime } from '../src/grouping.js'

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
