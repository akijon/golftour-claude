import { useMemo, useState } from 'react'
import { fmtCourse } from './utils'

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
                    <small>{fmtCourse(round.course)}</small>
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

export default function Standings({ players, rounds, scores, seasons }) {
  const [season, setSeason] = useState(seasons[0] ?? new Date().getFullYear())
  const seasonRounds = useMemo(() => rounds.filter(round => round.season === season), [rounds, season])
  // Scores are filtered to the season's rounds so best-3 totals never mix years.
  const rows = useMemo(() => {
    const roundIds = new Set(seasonRounds.map(round => round.id))
    return scoreRows(players, scores.filter(score => roundIds.has(score.round_id)))
  }, [players, scores, seasonRounds])

  return (
    <section className="panel standings">
      <h2 className="panel-title">Stigatafla — Eldtúrinn {season}</h2>
      {seasons.length > 1 && (
        <div className="season-tabs" role="tablist" aria-label="Tímabil">
          {seasons.map(s => (
            <button key={s} role="tab" aria-selected={s === season}
              className={s === season ? 'season-tab active' : 'season-tab'} onClick={() => setSeason(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      {rows.length === 0 ? (
        <p className="empty">Engin stig skráð fyrir {season} enn.</p>
      ) : (
        <>
          <p className="rule-note">Samtals = besti árangur úr {BEST_N} hringjum af {seasonRounds.length}. Talin stig eru <span className="counted-demo">merkt</span>.</p>
          <DesktopStandings rows={rows} rounds={seasonRounds} />
          <MobileStandings rows={rows} rounds={seasonRounds} />
        </>
      )}
    </section>
  )
}
