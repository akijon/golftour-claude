import { useMemo } from 'react'

// Tournament rule: total = sum of each player's BEST 3 round scores (of 5).
const BEST_N = 3

export default function Standings({ players, rounds, scores }) {
  const rows = useMemo(() => {
    return players
      .map(p => {
        const mine = scores.filter(s => s.player_id === p.id)
        const byRound = Object.fromEntries(mine.map(s => [s.round_id, s.points]))
        const sorted = mine.map(s => s.points).sort((a, b) => b - a)
        const counted = sorted.slice(0, BEST_N)
        const total = counted.reduce((a, b) => a + b, 0)
        // marks which round scores count toward the total (handles duplicates)
        const pool = [...counted]
        const countsFor = {}
        for (const s of mine.sort((a, b) => b.points - a.points)) {
          const i = pool.indexOf(s.points)
          if (i > -1) { countsFor[s.round_id] = true; pool.splice(i, 1) }
        }
        return { p, byRound, countsFor, total, played: mine.length }
      })
      .filter(r => r.played > 0)
      .sort((a, b) => b.total - a.total ||
        Math.max(...Object.values(b.byRound), 0) - Math.max(...Object.values(a.byRound), 0))
  }, [players, scores])

  if (rows.length === 0) {
    return <section className="panel"><h2 className="panel-title">Stigatafla</h2>
      <p className="empty">Engin stig skráð enn. Skráðu stig á „Stjórnun“ síðunni.</p></section>
  }

  return (
    <section className="panel standings">
      <h2 className="panel-title">Stigatafla — Eldtúrinn 2026</h2>
      <p className="rule-note">Samtals = besti árangur úr {BEST_N} hringjum af {rounds.length}. Talin stig eru <span className="counted-demo">merkt</span>.</p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th className="pos">#</th>
              <th className="pname">Nafn</th>
              {rounds.map((r, i) => <th key={r.id} className="rnd" title={r.course}>H{i + 1}</th>)}
              <th className="total">Samtals</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.p.id} className={i === 0 ? 'leader' : ''}>
                <td className="pos">{i + 1}</td>
                <td className="pname">{row.p.name}</td>
                {rounds.map(r => (
                  <td key={r.id} className={'rnd' + (row.countsFor[r.id] ? ' counted' : '')}>
                    {row.byRound[r.id] ?? '·'}
                  </td>
                ))}
                <td className="total">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
