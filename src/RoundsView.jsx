import { useState } from 'react'
import PlayerCombobox from './PlayerCombobox'
import { supabase } from './supabase'
import { fmtDate, fmtHcp, fmtTime, friendlyError, isPast } from './utils'

function Roster({ list, players, maxPlayers }) {
  return (
    <details className="roster-details">
      <summary>
        <span className="roster-count">{list.length} skráð{maxPlayers ? ` / ${maxPlayers}` : ''}</span>
        <span className="roster-toggle" aria-hidden="true">Sýna lista</span>
      </summary>
      <div className="roster">
        <ul>
          {list.map(signup => {
            const player = players.find(candidate => candidate.id === signup.player_id)
            return player ? (
              <li key={signup.id}>
                {player.name}
                {fmtHcp(player.handicap) !== null && <span className="hcp">{fmtHcp(player.handicap)}</span>}
              </li>
            ) : null
          })}
        </ul>
        {list.length === 0 && <p className="empty">Enginn skráður enn — vertu fyrst(ur)!</p>}
      </div>
    </details>
  )
}

function RoundCard({ round, number, players, signups, me, busy, onToggle }) {
  const list = signups.filter(signup => signup.round_id === round.id)
  const signedUp = me && list.some(signup => String(signup.player_id) === String(me))
  const full = round.max_players && list.length >= round.max_players && !signedUp
  const past = isPast(round.round_date)

  return (
    <article className={past ? 'card past' : 'card'}>
      <div className="card-head">
        <span className="round-no">{number}</span>
        <div className="card-title">
          <h2>{round.title}</h2>
          <p className="course">{round.course}</p>
        </div>
        <div className="card-when">
          <span className="date">{fmtDate(round.round_date)}</span>
          {round.tee_time && <span className="tee">Rástími {fmtTime(round.tee_time)}</span>}
        </div>
      </div>
      {round.notes && <p className="notes">{round.notes}</p>}
      {!past && (
        <button
          className={signedUp ? 'cta out' : 'cta'}
          disabled={!me || busy === round.id || full}
          onClick={() => onToggle(round, signedUp)}
        >
          {busy === round.id
            ? signedUp ? 'Afskrái…' : 'Skrái…'
            : !me ? 'Veldu nafn fyrst' : full ? 'Fullbókað' : signedUp ? 'Afskrá mig' : 'Skrá mig'}
        </button>
      )}
      {past && <p className="past-label">Lokið</p>}
      <Roster list={list} players={players} maxPlayers={round.max_players} />
    </article>
  )
}

export default function RoundsView({ players, rounds, signups, me, setMe, reload, onToast }) {
  const [busy, setBusy] = useState(null)
  const [actionError, setActionError] = useState('')

  async function toggle(round, signedUp) {
    if (!me) return
    setBusy(round.id)
    setActionError('')

    try {
      const result = signedUp
        ? await supabase.from('signups').delete().eq('round_id', round.id).eq('player_id', me)
        : await supabase.from('signups').insert({ round_id: round.id, player_id: Number(me) })

      if (result.error) throw result.error

      await reload()
      onToast?.(signedUp ? 'Skráning afturkölluð' : 'Þú ert skráð(ur)')
    } catch (error) {
      const action = signedUp ? 'Afskráning' : 'Skráning'
      setActionError(`${action} tókst ekki. ${friendlyError(error)} Reyndu aftur.`)
    } finally {
      setBusy(null)
    }
  }

  const upcoming = rounds.filter(round => !isPast(round.round_date))
  const completed = rounds.filter(round => isPast(round.round_date))
  const roundNumber = round => rounds.findIndex(candidate => candidate.id === round.id) + 1

  return (
    <>
      <PlayerCombobox players={players} me={me} setMe={setMe} />
      {actionError && <p className="status error" role="alert">{actionError}</p>}

      {rounds.length === 0 && <p className="status">Engir hringir skráðir enn. Bættu við á „Stjórnun“ síðunni.</p>}

      {upcoming.length > 0 && (
        <section className="round-group upcoming-rounds" aria-labelledby="upcoming-rounds-heading">
          <h2 className="section-title" id="upcoming-rounds-heading">Næstu hringir</h2>
          <div className="cards">
            {upcoming.map(round => (
              <RoundCard key={round.id} round={round} number={roundNumber(round)} players={players} signups={signups}
                me={me} busy={busy} onToggle={toggle} />
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <details className="past-rounds">
          <summary>
            <span>Loknir hringir</span>
            <span className="summary-count">{completed.length}</span>
          </summary>
          <div className="cards">
            {completed.map(round => (
              <RoundCard key={round.id} round={round} number={roundNumber(round)} players={players} signups={signups}
                me={me} busy={busy} onToggle={toggle} />
            ))}
          </div>
        </details>
      )}
    </>
  )
}
