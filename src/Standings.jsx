import { useMemo } from 'react'

// Tournament rule: total = sum of each player's BEST 3 round scores (of 5).
const BEST_N = 3

function scoreRows(players, scores) {
  return players
    .map(player => {
      const playerScores = scores.filter(score => score.player_id === player.id)
      const byRound = Object.fromEntries(playerScores.map(score => [score.round_id, score.points]))
      const sorted = playerScores.map(score => score.points).sort((a, b) => b - a)
      const counted = sorted.slice(0, BEST_N)
      const total = counted.reduce((sum, points) => sum + points, 0)

      // Mark the exact score rows included in the best-three total, including ties.
      const pool = [...counted]
      const countsFor = {}
      for (const score of [...playerScores].sort((a, b) => b.points - a.points)) {
        const index = pool.indexOf(score.points)
        if (index > -1) {
          countsFor[score.round_id] = true
          pool.splice(index, 1)
        }
      }

      return { player, byRound, countsFor, total, played: playerScores.length }
    })
    .filter(row => row.played > 0)
    .sort((a, b) => b.total - a.total ||
      Math.max(...Object.values(b.byRound), 0) - Math.max(...Object.values(a.byRound), 0))
}

function DesktopStandings({ rows, rounds }) {
  return (
    <div className="standings-desktop">
      <p className="scroll-hint" id="standings-scroll-hint">Flettu töflunni til hliðar til að sjá alla hringi.</p>
      <div className="table-scroll" tabIndex="0" role="region"
        aria-label="Stigatafla með stigum eftir hring" aria-describedby="standings-scroll-hint">
        <table>
          <thead>
            <tr>
              <th className="pos" scope="col">#</th>
              <th className="pname" scope="col">Nafn</th>
              {rounds.map((round, index) => <th key={round.id} className="rnd" scope="col" title={round.course}>H{index + 1}</th>)}
              <th className="total" scope="col">Samtals</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.player.id} className={index === 0 ? 'leader' : ''}>
                <td className="pos">{index + 1}</td>
                <td className="pname">{row.player.name}</td>
                {rounds.map(round => (
                  <td key={round.id} className={`rnd${row.countsFor[round.id] ? ' counted' : ''}`}>
                    {row.byRound[round.id] ?? '·'}
                  </td>
                ))}
                <td className="total">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MobileStandings({ rows, rounds }) {
  return (
    <ol className="standings-mobile" aria-label="Stigatafla">
      {rows.map((row, index) => (
        <li key={row.player.id} className={`standings-mobile-item${index === 0 ? ' leader' : ''}`}>
          <details className="mobile-round-scores">
            <summary className="mobile-standing-summary">
              <span className="mobile-rank" aria-label={`${index + 1}. sæti`}>{index + 1}</span>
              <span className="mobile-player">
                {row.player.name}
                {index === 0 && <span className="leader-mark" aria-label="Leiðir mótið">🏆</span>}
              </span>
              <span className="mobile-total"><small>Samtals</small><strong>{row.total}</strong></span>
              <span className="mobile-expand">Stig eftir hring</span>
            </summary>
            <dl>
              {rounds.map(round => (
                <div key={round.id} className={row.countsFor[round.id] ? 'counted' : ''}>
                  <dt>
                    {round.title}
                    <small>{round.course}</small>
                  </dt>
                  <dd>
                    {row.byRound[round.id] ?? '—'}
                    {row.countsFor[round.id] && <span className="counted-label">Talið</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </li>
      ))}
    </ol>
  )
}

export default function Standings({ players, rounds, scores }) {
  const rows = useMemo(() => scoreRows(players, scores), [players, scores])

  if (rows.length === 0) {
    return <section className="panel"><h2 className="panel-title">Stigatafla</h2>
      <p className="empty">Engin stig skráð enn. Skráðu stig á „Stjórnun“ síðunni.</p></section>
  }

  return (
    <section className="panel standings">
      <h2 className="panel-title">Stigatafla — Eldtúrinn 2026</h2>
      <p className="rule-note">Samtals = besti árangur úr {BEST_N} hringjum af {rounds.length}. Talin stig eru <span className="counted-demo">merkt</span>.</p>
      <DesktopStandings rows={rows} rounds={rounds} />
      <MobileStandings rows={rows} rounds={rounds} />
    </section>
  )
}
